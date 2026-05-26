import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import {
  calcularRepasse,
  UsinaParaCalculo,
  TarifaResolver,
} from '../../usinas/helpers/calcular-repasse';

/**
 * Sub-Sprint F.5a (M33, 2026-05-27 noite).
 *
 * Backend do Dashboard Hierárquico do Super Admin pra Portal Proprietário.
 *
 * 2 endpoints expostos:
 *   - listarCooperativasComProprietarios(): grid de cards-resumo (1 card por cooperativa)
 *   - listarUsinasPorCooperativa(cooperativaId): tabela detalhada das usinas da
 *     cooperativa selecionada
 *
 * Decisões travadas:
 *   - Endpoint dedicado (não amplia MetricasSaasService) — separação de concerns
 *   - Reusa helper calcularRepasse pro YTD
 *   - LGPD: email do proprietário mascarado na lista detalhada (`jo***@example.com`)
 *   - Ordenação default: alfabética por nome da cooperativa
 *   - Retorna TODAS cooperativas (mesmo sem proprietários) — frontend mostra badge "0"
 */
@Injectable()
export class AdminProprietariosService {
  constructor(private prisma: PrismaService) {}

  // ─── Tarifa resolver compartilhado (similar a proprietario.service) ──

  private criarTarifaResolver(): TarifaResolver {
    return async (distribuidora: string | null, _competencia: Date) => {
      if (!distribuidora) return null;
      const tarifas = await this.prisma.tarifaConcessionaria.findMany({
        orderBy: { dataVigencia: 'desc' },
        take: 10,
      });
      const normD = distribuidora
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .trim();
      const match = tarifas.find((t) => {
        const normC = t.concessionaria
          .toLowerCase()
          .normalize('NFD')
          .replace(/[̀-ͯ]/g, '')
          .trim();
        return normC.includes(normD) || normD.includes(normC);
      });
      if (!match) return null;
      return Number(match.tusdNova) + Number(match.teNova);
    };
  }

  // ─── LGPD: mascaramento parcial de email ─────────────────────────────

  private mascararEmail(email: string | null): string | null {
    if (!email) return null;
    const at = email.indexOf('@');
    if (at < 2) return `***${email.slice(at)}`;
    return `${email.slice(0, 2)}***${email.slice(at)}`;
  }

  // ─── ENDPOINT 1 — Grid cooperativas ──────────────────────────────────

  async listarCooperativasComProprietarios() {
    const cooperativas = await this.prisma.cooperativa.findMany({
      where: { ativo: true },
      select: {
        id: true,
        nome: true,
        cnpj: true,
        tipoParceiro: true,
        statusSaas: true,
        planoSaas: {
          select: { id: true, nome: true, mensalidadeBase: true },
        },
      },
      orderBy: { nome: 'asc' },
    });

    if (cooperativas.length === 0) return [];

    const cooperativaIds = cooperativas.map((c) => c.id);
    const now = new Date();
    const inicioAno = new Date(now.getFullYear(), 0, 1);
    const dataLimite30d = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    // Busca todas usinas das cooperativas com geracoes do ano + dados de proprietário
    const usinas = await this.prisma.usina.findMany({
      where: { cooperativaId: { in: cooperativaIds } },
      select: {
        id: true,
        cooperativaId: true,
        proprietarioEmail: true,
        proprietarioCooperadoId: true,
        statusOperacional: true,
        potenciaKwp: true,
        capacidadeKwh: true,
        formaPagamentoDono: true,
        valorAluguelFixo: true,
        percentualGeracaoDono: true,
        valorKwhPadrao: true,
        distribuidora: true,
        geracoesMensais: {
          where: { competencia: { gte: inicioAno, lte: now } },
          select: { competencia: true, kwhGerado: true },
        },
      },
    });

    // Convites pendentes (usedAt null + expiresAt > now)
    const convitesPendentes = await this.prisma.conviteProprietario.findMany({
      where: {
        usedAt: null,
        expiresAt: { gt: now },
        usina: { cooperativaId: { in: cooperativaIds } },
      },
      select: { usina: { select: { cooperativaId: true } } },
    });

    // Contratos vencendo 30d (Contrato.dataFim entre now e now+30d)
    const contratosVencendo = await this.prisma.contrato.groupBy({
      by: ['cooperativaId'],
      where: {
        cooperativaId: { in: cooperativaIds },
        status: { in: ['ATIVO', 'PENDENTE_ATIVACAO', 'APROVADO'] },
        dataFim: { gte: now, lte: dataLimite30d },
      },
      _count: { _all: true },
    });

    const idxContratosVencendo = new Map(
      contratosVencendo.map((c) => [c.cooperativaId, c._count._all]),
    );

    const idxConvitesPendentes = new Map<string, number>();
    for (const c of convitesPendentes) {
      const cid = c.usina.cooperativaId;
      if (!cid) continue;
      idxConvitesPendentes.set(cid, (idxConvitesPendentes.get(cid) ?? 0) + 1);
    }

    const tarifaResolver = this.criarTarifaResolver();

    // Calcula resumo por cooperativa
    const resumos = await Promise.all(
      cooperativas.map(async (coop) => {
        const usinasCoop = usinas.filter((u) => u.cooperativaId === coop.id);

        const usinasComProprietario = usinasCoop.filter(
          (u) => u.proprietarioEmail !== null || u.proprietarioCooperadoId !== null,
        );

        // Proprietários únicos: pares (email|cooperadoId)
        const propsUnicos = new Set<string>();
        for (const u of usinasComProprietario) {
          if (u.proprietarioCooperadoId) propsUnicos.add(`coop:${u.proprietarioCooperadoId}`);
          else if (u.proprietarioEmail) propsUnicos.add(`mail:${u.proprietarioEmail.toLowerCase()}`);
        }

        let statusOk = 0;
        let statusAtencao = 0;
        let statusCritico = 0;
        let capacidadeKwpTotal = 0;
        let ytdTotal = 0;

        for (const u of usinasCoop) {
          capacidadeKwpTotal += Number(u.potenciaKwp ?? 0);

          const so = u.statusOperacional;
          if (so === 'OPERANDO') statusOk++;
          else if (so === 'MANUTENCAO_PLANEJADA') statusAtencao++;
          else statusCritico++;

          // YTD: só calcula pra usinas COM proprietário e forma pagamento
          if (
            u.formaPagamentoDono !== null &&
            (u.proprietarioEmail !== null || u.proprietarioCooperadoId !== null)
          ) {
            const usinaCalc: UsinaParaCalculo = {
              formaPagamentoDono: u.formaPagamentoDono,
              valorAluguelFixo:
                u.valorAluguelFixo !== null ? Number(u.valorAluguelFixo) : null,
              percentualGeracaoDono:
                u.percentualGeracaoDono !== null ? Number(u.percentualGeracaoDono) : null,
              valorKwhPadrao:
                u.valorKwhPadrao !== null ? Number(u.valorKwhPadrao) : null,
              distribuidora: u.distribuidora,
            };
            for (const g of u.geracoesMensais) {
              const r = await calcularRepasse(
                usinaCalc,
                { kwhGerado: Number(g.kwhGerado), competencia: g.competencia },
                tarifaResolver,
              );
              if (r.valor !== null) ytdTotal += r.valor;
            }
          }
        }

        return {
          cooperativaId: coop.id,
          nome: coop.nome,
          cnpj: coop.cnpj,
          tipoParceiro: coop.tipoParceiro,
          statusSaas: coop.statusSaas,
          planoSaas: coop.planoSaas
            ? {
                id: coop.planoSaas.id,
                nome: coop.planoSaas.nome,
                mensalidadeBase: Number(coop.planoSaas.mensalidadeBase),
              }
            : null,
          usinasComProprietario: usinasComProprietario.length,
          usinasTotal: usinasCoop.length,
          proprietariosUnicos: propsUnicos.size,
          totalYtdAgregado: Math.round(ytdTotal * 100) / 100,
          capacidadeTotalKwp: Math.round(capacidadeKwpTotal * 100) / 100,
          statusOk,
          statusAtencao,
          statusCritico,
          convitesPendentes: idxConvitesPendentes.get(coop.id) ?? 0,
          contratosVencendo30d: idxContratosVencendo.get(coop.id) ?? 0,
        };
      }),
    );

    return resumos;
  }

  // ─── ENDPOINT 2 — Tabela usinas+proprietarios POR cooperativa ────────

  async listarUsinasPorCooperativa(cooperativaId: string) {
    const coop = await this.prisma.cooperativa.findUnique({
      where: { id: cooperativaId },
      select: { id: true, nome: true, tipoParceiro: true },
    });
    if (!coop) {
      throw new NotFoundException('Cooperativa nao encontrada.');
    }

    const now = new Date();
    const inicioAno = new Date(now.getFullYear(), 0, 1);

    const usinas = await this.prisma.usina.findMany({
      where: { cooperativaId },
      select: {
        id: true,
        nome: true,
        apelidoInterno: true,
        statusOperacional: true,
        statusHomologacao: true,
        potenciaKwp: true,
        capacidadeKwh: true,
        proprietarioNome: true,
        proprietarioEmail: true,
        proprietarioCooperadoId: true,
        formaPagamentoDono: true,
        valorAluguelFixo: true,
        percentualGeracaoDono: true,
        valorKwhPadrao: true,
        distribuidora: true,
        geracoesMensais: {
          where: { competencia: { gte: inicioAno, lte: now } },
          select: { competencia: true, kwhGerado: true },
        },
      },
      orderBy: { nome: 'asc' },
    });

    const conviteByUsina = await this.prisma.conviteProprietario.findMany({
      where: { usinaId: { in: usinas.map((u) => u.id) } },
      orderBy: { createdAt: 'desc' },
      select: { id: true, usinaId: true, usedAt: true, expiresAt: true },
    });

    const idxConvite = new Map<
      string,
      { usedAt: Date | null; expiresAt: Date }
    >();
    for (const c of conviteByUsina) {
      if (!idxConvite.has(c.usinaId)) {
        idxConvite.set(c.usinaId, { usedAt: c.usedAt, expiresAt: c.expiresAt });
      }
    }

    const tarifaResolver = this.criarTarifaResolver();

    const linhas = await Promise.all(
      usinas.map(async (u) => {
        const usinaCalc: UsinaParaCalculo = {
          formaPagamentoDono: u.formaPagamentoDono,
          valorAluguelFixo:
            u.valorAluguelFixo !== null ? Number(u.valorAluguelFixo) : null,
          percentualGeracaoDono:
            u.percentualGeracaoDono !== null ? Number(u.percentualGeracaoDono) : null,
          valorKwhPadrao:
            u.valorKwhPadrao !== null ? Number(u.valorKwhPadrao) : null,
          distribuidora: u.distribuidora,
        };

        let ytdRepasse = 0;
        for (const g of u.geracoesMensais) {
          const r = await calcularRepasse(
            usinaCalc,
            { kwhGerado: Number(g.kwhGerado), competencia: g.competencia },
            tarifaResolver,
          );
          if (r.valor !== null) ytdRepasse += r.valor;
        }

        // conviteStatus: NAO_CONVIDADO | ATIVO | PENDENTE | EXPIRADO | USADO
        let conviteStatus: 'NAO_CONVIDADO' | 'PENDENTE' | 'EXPIRADO' | 'USADO' =
          'NAO_CONVIDADO';
        const c = idxConvite.get(u.id);
        if (c) {
          if (c.usedAt) conviteStatus = 'USADO';
          else if (c.expiresAt > now) conviteStatus = 'PENDENTE';
          else conviteStatus = 'EXPIRADO';
        }

        // contratoArrendamentoStatus: derivado de formaPagamentoDono
        let contratoArrendamento: string;
        if (!u.formaPagamentoDono) {
          contratoArrendamento = 'NAO_CONFIGURADO';
        } else if (u.formaPagamentoDono === 'FIXO') {
          contratoArrendamento = `FIXO (R$ ${Number(u.valorAluguelFixo ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })})`;
        } else if (u.formaPagamentoDono === 'PERCENTUAL') {
          contratoArrendamento = `PERCENTUAL (${Number(u.percentualGeracaoDono ?? 0)}%)`;
        } else {
          contratoArrendamento = `HIBRIDO (R$ ${Number(u.valorAluguelFixo ?? 0)} + ${Number(u.percentualGeracaoDono ?? 0)}%)`;
        }

        return {
          usinaId: u.id,
          nome: u.nome,
          apelidoInterno: u.apelidoInterno,
          statusOperacional: u.statusOperacional,
          statusHomologacao: u.statusHomologacao,
          potenciaKwp: Number(u.potenciaKwp ?? 0),
          capacidadeKwh: Number(u.capacidadeKwh ?? 0),
          proprietarioNome: u.proprietarioNome,
          proprietarioEmail: this.mascararEmail(u.proprietarioEmail),
          proprietarioEmailRaw: u.proprietarioEmail, // pra impersonate identificar
          temProprietario:
            u.proprietarioEmail !== null || u.proprietarioCooperadoId !== null,
          contratoArrendamento,
          ytdRepasse: Math.round(ytdRepasse * 100) / 100,
          conviteStatus,
        };
      }),
    );

    return {
      cooperativa: { id: coop.id, nome: coop.nome, tipoParceiro: coop.tipoParceiro },
      usinas: linhas,
    };
  }
}
