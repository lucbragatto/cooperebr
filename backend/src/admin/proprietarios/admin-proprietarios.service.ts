import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
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

  // ─── Helpers compartilhados N2 + N3 (F.6a) ──────────────────────────

  /**
   * Chave de dedupe por proprietário:
   *   Caminho A (proprietarioCooperadoId set): `c-<cooperadoId>`
   *   Caminho B (proprietarioEmail set): `e-<email.toLowerCase()>`
   *   Órfã (ambos null): 'SEM_PROPRIETARIO'
   */
  private chaveProprietario(u: {
    proprietarioCooperadoId: string | null;
    proprietarioEmail: string | null;
  }): string {
    if (u.proprietarioCooperadoId) return `c-${u.proprietarioCooperadoId}`;
    if (u.proprietarioEmail) return `e-${u.proprietarioEmail.toLowerCase()}`;
    return 'SEM_PROPRIETARIO';
  }

  /**
   * Parse propId vindo da URL.
   * Aceita: c-<cooperadoId> | e-<email URL-encoded> | SEM_PROPRIETARIO
   * Retorna info estruturada pra filtrar usinas.
   */
  private parsePropId(propId: string): {
    caminho: 'COOPERADO' | 'EMAIL' | 'ORFAO';
    cooperadoId?: string;
    email?: string;
  } {
    if (propId === 'SEM_PROPRIETARIO') return { caminho: 'ORFAO' };
    if (propId.startsWith('c-')) {
      const cooperadoId = propId.slice(2);
      if (!cooperadoId) throw new BadRequestException('propId inválido: cooperadoId vazio.');
      return { caminho: 'COOPERADO', cooperadoId };
    }
    if (propId.startsWith('e-')) {
      // Next.js + Express decodam URL automaticamente; passamos pra lowercase pra match dedup.
      const email = propId.slice(2).toLowerCase();
      if (!email) throw new BadRequestException('propId inválido: email vazio.');
      return { caminho: 'EMAIL', email };
    }
    throw new BadRequestException(`propId inválido: '${propId}'. Use 'c-<id>', 'e-<email>', ou 'SEM_PROPRIETARIO'.`);
  }

  /**
   * Tipo intermediário das usinas com geração do ano (usado por N2 + N3).
   */
  private async buscarUsinasComGeracoesAno(cooperativaId: string) {
    const now = new Date();
    const inicioAno = new Date(now.getFullYear(), 0, 1);
    return this.prisma.usina.findMany({
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
        updatedAt: true,
        geracoesMensais: {
          where: { competencia: { gte: inicioAno, lte: now } },
          select: { competencia: true, kwhGerado: true },
        },
        alertas: {
          where: { resolvidoEm: null },
          select: { id: true },
        },
      },
      orderBy: { nome: 'asc' },
    });
  }

  /**
   * Calcula YTD repasse de uma usina via helper calcularRepasse.
   */
  private async calcularYtdUsina(
    u: Awaited<ReturnType<typeof this.buscarUsinasComGeracoesAno>>[number],
    tarifaResolver: TarifaResolver,
  ): Promise<number> {
    const usinaCalc: UsinaParaCalculo = {
      formaPagamentoDono: u.formaPagamentoDono,
      valorAluguelFixo: u.valorAluguelFixo !== null ? Number(u.valorAluguelFixo) : null,
      percentualGeracaoDono:
        u.percentualGeracaoDono !== null ? Number(u.percentualGeracaoDono) : null,
      valorKwhPadrao: u.valorKwhPadrao !== null ? Number(u.valorKwhPadrao) : null,
      distribuidora: u.distribuidora,
    };
    let ytd = 0;
    for (const g of u.geracoesMensais) {
      const r = await calcularRepasse(
        usinaCalc,
        { kwhGerado: Number(g.kwhGerado), competencia: g.competencia },
        tarifaResolver,
      );
      if (r.valor !== null) ytd += r.valor;
    }
    return Math.round(ytd * 100) / 100;
  }

  /**
   * Formata contratoArrendamento descritivo conforme formaPagamentoDono.
   */
  private formatarContratoArrendamento(u: {
    formaPagamentoDono: string | null;
    valorAluguelFixo: any;
    percentualGeracaoDono: any;
  }): string {
    if (!u.formaPagamentoDono) return 'NAO_CONFIGURADO';
    const fixo = Number(u.valorAluguelFixo ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
    const pct = Number(u.percentualGeracaoDono ?? 0);
    if (u.formaPagamentoDono === 'FIXO') return `FIXO (R$ ${fixo})`;
    if (u.formaPagamentoDono === 'PERCENTUAL') return `PERCENTUAL (${pct}%)`;
    return `HIBRIDO (R$ ${fixo} + ${pct}%)`;
  }

  /**
   * Status operacional → categoria do semáforo agregado.
   */
  private classificarStatus(statusOperacional: string): 'OK' | 'ATENCAO' | 'CRITICO' {
    if (statusOperacional === 'OPERANDO') return 'OK';
    if (statusOperacional === 'MANUTENCAO_PLANEJADA') return 'ATENCAO';
    return 'CRITICO';
  }

  /**
   * Guard multi-tenant compartilhado: SUPER_ADMIN global, ADMIN só sua coop.
   */
  private assertAcessoCooperativa(cooperativaId: string, user?: any) {
    if (
      user &&
      user.perfil !== 'SUPER_ADMIN' &&
      user.cooperativaId !== cooperativaId
    ) {
      throw new ForbiddenException(
        'Voce so pode acessar dados da sua propria cooperativa.',
      );
    }
  }

  // ─── ENDPOINT 2 (REFATORADO F.6a) — Cards de proprietários por cooperativa ──

  /**
   * GET /admin/proprietarios/cooperativas/:coopId/usinas
   *
   * Retorna `{cooperativa, proprietarios[]}` agregado por chave de dedupe
   * (Caminho A cooperadoId / Caminho B email lowercase / SEM_PROPRIETARIO).
   *
   * Sort: alfabético por nome; SEM_PROPRIETARIO sempre último.
   */
  async listarProprietariosPorCooperativa(cooperativaId: string, user?: any) {
    this.assertAcessoCooperativa(cooperativaId, user);

    const coop = await this.prisma.cooperativa.findUnique({
      where: { id: cooperativaId },
      select: { id: true, nome: true, tipoParceiro: true },
    });
    if (!coop) throw new NotFoundException('Cooperativa nao encontrada.');

    const usinas = await this.buscarUsinasComGeracoesAno(cooperativaId);
    const tarifaResolver = this.criarTarifaResolver();

    // Calcula YTD de cada usina uma única vez
    const ytdPorUsina = new Map<string, number>();
    for (const u of usinas) {
      ytdPorUsina.set(u.id, await this.calcularYtdUsina(u, tarifaResolver));
    }

    // Convites pra Caminho B (agregado por chave de proprietário)
    const convitesPorUsina = await this.prisma.conviteProprietario.findMany({
      where: { usinaId: { in: usinas.map((u) => u.id) } },
      orderBy: { createdAt: 'desc' },
      select: { usinaId: true, usedAt: true, expiresAt: true },
    });
    const idxConviteMaisRecente = new Map<string, { usedAt: Date | null; expiresAt: Date }>();
    for (const c of convitesPorUsina) {
      if (!idxConviteMaisRecente.has(c.usinaId)) {
        idxConviteMaisRecente.set(c.usinaId, { usedAt: c.usedAt, expiresAt: c.expiresAt });
      }
    }

    // Caminho A: precisamos do nome do Cooperado (single source of truth)
    const cooperadoIds = Array.from(
      new Set(
        usinas
          .map((u) => u.proprietarioCooperadoId)
          .filter((x): x is string => !!x),
      ),
    );
    const cooperados = cooperadoIds.length
      ? await this.prisma.cooperado.findMany({
          where: { id: { in: cooperadoIds } },
          select: { id: true, nomeCompleto: true },
        })
      : [];
    const idxCooperadoNome = new Map(cooperados.map((c) => [c.id, c.nomeCompleto]));

    // Agrega por chave de proprietário
    const grupos = new Map<
      string,
      {
        proprietarioId: string;
        usinas: typeof usinas;
        nomesObservados: { nome: string | null; updatedAt: Date }[];
        emailRaw: string | null;
        cooperadoId: string | null;
      }
    >();

    for (const u of usinas) {
      const chave = this.chaveProprietario(u);
      let g = grupos.get(chave);
      if (!g) {
        g = {
          proprietarioId: chave,
          usinas: [] as typeof usinas,
          nomesObservados: [],
          emailRaw: u.proprietarioEmail,
          cooperadoId: u.proprietarioCooperadoId,
        };
        grupos.set(chave, g);
      }
      g.usinas.push(u);
      g.nomesObservados.push({ nome: u.proprietarioNome, updatedAt: u.updatedAt });
    }

    const now = new Date();
    const proprietarios = Array.from(grupos.values()).map((g) => {
      // Nome: Caminho A => Cooperado.nomeCompleto. Caminho B => nome da usina mais recente.
      let nome: string;
      if (g.proprietarioId === 'SEM_PROPRIETARIO') {
        nome = 'Sem proprietário cadastrado';
      } else if (g.cooperadoId && idxCooperadoNome.has(g.cooperadoId)) {
        nome = idxCooperadoNome.get(g.cooperadoId) ?? '—';
      } else {
        // Caminho B: pega da usina updatedAt mais recente (D-novo-BE catalogado)
        const recente = [...g.nomesObservados].sort(
          (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime(),
        )[0];
        nome = recente?.nome ?? '—';
      }

      // Tipo: derivado de proprietarioTipo da primeira usina (sem dedupe sofisticado)
      const tipo: 'PF' | 'PJ' | 'INDEFINIDO' =
        g.proprietarioId === 'SEM_PROPRIETARIO' ? 'INDEFINIDO' : 'PF'; // schema default PF

      const emailMascarado =
        g.proprietarioId === 'SEM_PROPRIETARIO'
          ? null
          : this.mascararEmail(g.emailRaw);

      const numeroUsinas = g.usinas.length;
      const capacidadeTotalKwp = g.usinas.reduce(
        (s, u) => s + Number(u.potenciaKwp ?? 0),
        0,
      );
      const totalYtdAgregado = g.usinas.reduce(
        (s, u) => s + (ytdPorUsina.get(u.id) ?? 0),
        0,
      );

      let statusOk = 0;
      let statusAtencao = 0;
      let statusCritico = 0;
      for (const u of g.usinas) {
        const cat = this.classificarStatus(u.statusOperacional);
        if (cat === 'OK') statusOk++;
        else if (cat === 'ATENCAO') statusAtencao++;
        else statusCritico++;
      }

      // Convite agregado:
      //   Caminho A / órfã => NA (Caminho A não usa convite; órfã também não)
      //   Caminho B => derivado dos convites das usinas do grupo
      let conviteStatusAgregado:
        | 'USADO'
        | 'PENDENTE'
        | 'EXPIRADO'
        | 'NAO_CONVIDADO'
        | 'MIXED'
        | 'NA' = 'NA';
      if (g.proprietarioId.startsWith('e-')) {
        const statusList = g.usinas.map((u) => {
          const c = idxConviteMaisRecente.get(u.id);
          if (!c) return 'NAO_CONVIDADO';
          if (c.usedAt) return 'USADO';
          if (c.expiresAt > now) return 'PENDENTE';
          return 'EXPIRADO';
        });
        const unique = Array.from(new Set(statusList));
        if (unique.length === 1) conviteStatusAgregado = unique[0] as any;
        else conviteStatusAgregado = 'MIXED';
      }

      return {
        proprietarioId: g.proprietarioId,
        nome,
        tipo,
        emailMascarado,
        numeroUsinas,
        capacidadeTotalKwp: Math.round(capacidadeTotalKwp * 100) / 100,
        totalYtdAgregado: Math.round(totalYtdAgregado * 100) / 100,
        statusOk,
        statusAtencao,
        statusCritico,
        conviteStatusAgregado,
      };
    });

    // Sort: alfabético; SEM_PROPRIETARIO sempre último
    proprietarios.sort((a, b) => {
      if (a.proprietarioId === 'SEM_PROPRIETARIO') return 1;
      if (b.proprietarioId === 'SEM_PROPRIETARIO') return -1;
      return a.nome.localeCompare(b.nome, 'pt-BR');
    });

    return {
      cooperativa: { id: coop.id, nome: coop.nome, tipoParceiro: coop.tipoParceiro },
      proprietarios,
    };
  }

  // ─── ENDPOINT 3 (NOVO F.6a) — Usinas de UM proprietário ─────────────

  /**
   * GET /admin/proprietarios/cooperativas/:coopId/proprietarios/:propId/usinas
   *
   * Retorna `{cooperativa, proprietario, usinas[]}` filtrado pela chave de
   * dedupe parseada de propId.
   */
  async listarUsinasDoProprietario(
    cooperativaId: string,
    propId: string,
    user?: any,
  ) {
    this.assertAcessoCooperativa(cooperativaId, user);

    const coop = await this.prisma.cooperativa.findUnique({
      where: { id: cooperativaId },
      select: { id: true, nome: true, tipoParceiro: true },
    });
    if (!coop) throw new NotFoundException('Cooperativa nao encontrada.');

    const parsed = this.parsePropId(propId);

    // Filtra usinas conforme caminho
    const todas = await this.buscarUsinasComGeracoesAno(cooperativaId);
    const usinasFiltradas = todas.filter((u) => {
      if (parsed.caminho === 'ORFAO') {
        return u.proprietarioCooperadoId === null && u.proprietarioEmail === null;
      }
      if (parsed.caminho === 'COOPERADO') {
        return u.proprietarioCooperadoId === parsed.cooperadoId;
      }
      // EMAIL (case-insensitive)
      return (
        u.proprietarioEmail !== null &&
        u.proprietarioEmail.toLowerCase() === parsed.email
      );
    });

    // Header info do proprietário
    let nomeProprietario: string;
    let emailMascarado: string | null = null;
    if (parsed.caminho === 'ORFAO') {
      nomeProprietario = 'Sem proprietário cadastrado';
    } else if (parsed.caminho === 'COOPERADO') {
      const c = await this.prisma.cooperado.findUnique({
        where: { id: parsed.cooperadoId },
        select: { nomeCompleto: true },
      });
      nomeProprietario = c?.nomeCompleto ?? '—';
    } else {
      // EMAIL: pega da usina updatedAt mais recente
      const recente = [...usinasFiltradas].sort(
        (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime(),
      )[0];
      nomeProprietario = recente?.proprietarioNome ?? '—';
      emailMascarado = this.mascararEmail(parsed.email ?? null);
    }

    const tarifaResolver = this.criarTarifaResolver();

    // Convites pra Caminho B
    const conviteByUsina = new Map<
      string,
      { usedAt: Date | null; expiresAt: Date }
    >();
    if (parsed.caminho === 'EMAIL' && usinasFiltradas.length > 0) {
      const convs = await this.prisma.conviteProprietario.findMany({
        where: { usinaId: { in: usinasFiltradas.map((u) => u.id) } },
        orderBy: { createdAt: 'desc' },
        select: { usinaId: true, usedAt: true, expiresAt: true },
      });
      for (const c of convs) {
        if (!conviteByUsina.has(c.usinaId)) {
          conviteByUsina.set(c.usinaId, { usedAt: c.usedAt, expiresAt: c.expiresAt });
        }
      }
    }

    const now = new Date();
    const usinasResposta = await Promise.all(
      usinasFiltradas.map(async (u) => {
        const ytdRepasse = await this.calcularYtdUsina(u, tarifaResolver);

        let conviteStatus:
          | 'USADO'
          | 'PENDENTE'
          | 'EXPIRADO'
          | 'NAO_CONVIDADO'
          | 'NA' = 'NA';
        if (parsed.caminho === 'EMAIL') {
          const c = conviteByUsina.get(u.id);
          if (!c) conviteStatus = 'NAO_CONVIDADO';
          else if (c.usedAt) conviteStatus = 'USADO';
          else if (c.expiresAt > now) conviteStatus = 'PENDENTE';
          else conviteStatus = 'EXPIRADO';
        }

        return {
          usinaId: u.id,
          nome: u.nome,
          apelidoInterno: u.apelidoInterno,
          statusOperacional: u.statusOperacional,
          statusHomologacao: u.statusHomologacao,
          potenciaKwp: Number(u.potenciaKwp ?? 0),
          capacidadeKwh: Number(u.capacidadeKwh ?? 0),
          contratoArrendamento: this.formatarContratoArrendamento(u),
          ytdRepasse,
          conviteStatus,
          alertas: u.alertas.length,
        };
      }),
    );

    return {
      cooperativa: { id: coop.id, nome: coop.nome, tipoParceiro: coop.tipoParceiro },
      proprietario: {
        proprietarioId: propId,
        caminho: parsed.caminho,
        nome: nomeProprietario,
        tipo:
          parsed.caminho === 'ORFAO'
            ? ('INDEFINIDO' as const)
            : ('PF' as const),
        emailMascarado,
      },
      usinas: usinasResposta,
    };
  }
}
