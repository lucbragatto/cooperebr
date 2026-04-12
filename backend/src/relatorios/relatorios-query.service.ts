import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

export interface InadimplenciaFiltros {
  cooperativaId: string; // obrigatório
  usinaId?: string;
  tipoCooperado?: string;
  periodoInicio?: Date;
  periodoFim?: Date;
}

export interface ProducaoVsCobrancaRow {
  cooperadoId: string;
  nome: string;
  kwhContrato: number;
  kwhEntregue: number;
  excedente: number;
  valorCobranca: number;
  status: 'SUPERAVITARIO' | 'DEFICITARIO' | 'ADEQUADO';
}

export interface ConferenciaKwhRow {
  cooperadoId: string;
  nome: string;
  ucNumero: string | null;
  kwhContratado: number;
  kwhCompensado: number;
  diferenca: number;
  status: 'OK' | 'EXCEDENTE' | 'DEFICIT';
}

export interface ConferenciaKwhResult {
  competencia: string;
  totalCooperados: number;
  totalKwhContratado: number;
  totalKwhCompensado: number;
  resumo: { ok: number; excedente: number; deficit: number };
  itens: ConferenciaKwhRow[];
}

@Injectable()
export class RelatoriosQueryService {
  constructor(private prisma: PrismaService) {}

  async inadimplencia(filtros: InadimplenciaFiltros) {
    const where: any = { status: 'VENCIDO', cooperativaId: filtros.cooperativaId };
    if (filtros.usinaId) where.contrato = { usinaId: filtros.usinaId };
    if (filtros.periodoInicio || filtros.periodoFim) {
      where.dataVencimento = {};
      if (filtros.periodoInicio) where.dataVencimento.gte = filtros.periodoInicio;
      if (filtros.periodoFim) where.dataVencimento.lte = filtros.periodoFim;
    }
    const cobrancas = await this.prisma.cobranca.findMany({
      where,
      include: { contrato: { include: { usina: { select: { id: true, nome: true } }, cooperado: { select: { id: true, nomeCompleto: true, tipoCooperado: true } } } } },
      orderBy: { dataVencimento: 'asc' },
    });
    const resultado = filtros.tipoCooperado
      ? cobrancas.filter(c => c.contrato?.cooperado?.tipoCooperado === filtros.tipoCooperado)
      : cobrancas;
    return resultado;
  }

  async producaoVsCobranca(cooperativaId: string, competencia: string): Promise<ProducaoVsCobrancaRow[]> {
    const data = new Date(competencia);
    const inicioMes = new Date(data.getFullYear(), data.getMonth(), 1);
    const fimMes = new Date(data.getFullYear(), data.getMonth() + 1, 0);
    const competenciaNormalizada = new Date(data.getFullYear(), data.getMonth(), 1);

    const contratos = await this.prisma.contrato.findMany({
      where: { status: 'ATIVO', cooperado: { cooperativaId } },
      include: {
        cooperado: { select: { id: true, nomeCompleto: true } },
        usina: true,
        cobrancas: { where: { createdAt: { gte: inicioMes, lte: fimMes } }, select: { valorLiquido: true } },
      },
    });

    // Buscar geração mensal real para todas as usinas nesta competência
    const usinaIds = [...new Set(contratos.map(c => c.usinaId).filter(Boolean))] as string[];
    const geracoes = usinaIds.length > 0
      ? await this.prisma.geracaoMensal.findMany({
          where: { usinaId: { in: usinaIds }, competencia: competenciaNormalizada },
        })
      : [];
    const geracaoPorUsina = new Map(geracoes.map(g => [g.usinaId, g.kwhGerado]));

    return contratos.map(c => {
      const geracaoUsina = c.usinaId ? (geracaoPorUsina.get(c.usinaId) ?? 0) : 0;
      const kwhEntregue = c.percentualUsina ? Number(geracaoUsina) * (Number(c.percentualUsina) / 100) : 0;
      const kwhContrato = Number(c.kwhContrato ?? 0);
      const excedente = kwhEntregue - kwhContrato;
      const valorCobranca = c.cobrancas.reduce((acc, cb) => acc + Number(cb.valorLiquido), 0);
      const status: ProducaoVsCobrancaRow['status'] =
        kwhEntregue >= kwhContrato ? 'SUPERAVITARIO' :
        kwhEntregue >= kwhContrato * 0.8 ? 'ADEQUADO' : 'DEFICITARIO';

      return {
        cooperadoId: c.cooperado.id,
        nome: c.cooperado.nomeCompleto,
        kwhContrato,
        kwhEntregue,
        excedente,
        valorCobranca,
        status,
      };
    });
  }

  async conferenciaKwh(cooperativaId: string, competencia: string): Promise<ConferenciaKwhResult> {
    // competencia = "YYYY-MM"
    const [anoStr, mesStr] = competencia.split('-');
    const ano = parseInt(anoStr, 10);
    const mes = parseInt(mesStr, 10);

    // Buscar contratos ATIVO do tenant com cooperado e UC
    const contratos = await this.prisma.contrato.findMany({
      where: {
        status: 'ATIVO',
        cooperado: { cooperativaId, status: 'ATIVO' },
      },
      include: {
        cooperado: { select: { id: true, nomeCompleto: true } },
        uc: { select: { id: true, numero: true } },
      },
    });

    // Buscar FaturaProcessada APROVADA do período para os cooperados
    const cooperadoIds = [...new Set(contratos.map(c => c.cooperadoId))];
    const faturas = cooperadoIds.length > 0
      ? await this.prisma.faturaProcessada.findMany({
          where: {
            cooperativaId,
            status: 'APROVADA',
            cooperadoId: { in: cooperadoIds },
            mesReferencia: competencia,
          },
          select: {
            cooperadoId: true,
            ucId: true,
            dadosExtraidos: true,
          },
        })
      : [];

    // Mapear kWhCompensado por cooperadoId (soma de todas as faturas do mês)
    const kwhPorCooperado = new Map<string, number>();
    for (const f of faturas) {
      const dados = f.dadosExtraidos as Record<string, unknown> | null;
      const kwh = Number(dados?.creditosRecebidosKwh ?? 0);
      const atual = kwhPorCooperado.get(f.cooperadoId!) ?? 0;
      kwhPorCooperado.set(f.cooperadoId!, atual + kwh);
    }

    // Agrupar contratos por cooperadoId (somar kwhContratoMensal)
    const porCooperado = new Map<string, {
      nome: string;
      ucNumero: string | null;
      kwhContratado: number;
    }>();
    for (const c of contratos) {
      const existing = porCooperado.get(c.cooperadoId);
      const kwhMensal = Number(c.kwhContratoMensal ?? c.kwhContrato ?? 0);
      if (existing) {
        existing.kwhContratado += kwhMensal;
      } else {
        porCooperado.set(c.cooperadoId, {
          nome: c.cooperado.nomeCompleto,
          ucNumero: c.uc?.numero ?? null,
          kwhContratado: kwhMensal,
        });
      }
    }

    const itens: ConferenciaKwhRow[] = [];
    let totalKwhContratado = 0;
    let totalKwhCompensado = 0;
    const resumo = { ok: 0, excedente: 0, deficit: 0 };

    for (const [cooperadoId, info] of porCooperado) {
      const kwhCompensado = kwhPorCooperado.get(cooperadoId) ?? 0;
      const diferenca = Math.round((kwhCompensado - info.kwhContratado) * 100) / 100;
      const tolerancia = info.kwhContratado * 0.05; // 5% de tolerância

      let status: ConferenciaKwhRow['status'];
      if (diferenca > tolerancia) {
        status = 'EXCEDENTE';
        resumo.excedente++;
      } else if (diferenca < -tolerancia) {
        status = 'DEFICIT';
        resumo.deficit++;
      } else {
        status = 'OK';
        resumo.ok++;
      }

      totalKwhContratado += info.kwhContratado;
      totalKwhCompensado += kwhCompensado;

      itens.push({
        cooperadoId,
        nome: info.nome,
        ucNumero: info.ucNumero,
        kwhContratado: Math.round(info.kwhContratado * 100) / 100,
        kwhCompensado: Math.round(kwhCompensado * 100) / 100,
        diferenca,
        status,
      });
    }

    // Ordenar: DEFICIT primeiro, depois EXCEDENTE, depois OK
    const statusOrder = { DEFICIT: 0, EXCEDENTE: 1, OK: 2 };
    itens.sort((a, b) => statusOrder[a.status] - statusOrder[b.status] || a.diferenca - b.diferenca);

    return {
      competencia,
      totalCooperados: itens.length,
      totalKwhContratado: Math.round(totalKwhContratado * 100) / 100,
      totalKwhCompensado: Math.round(totalKwhCompensado * 100) / 100,
      resumo,
      itens,
    };
  }

  async geracaoPorUsina(usinaId: string, ano: number, cooperativaId: string) {
    return this.prisma.geracaoMensal.findMany({
      where: { usinaId, usina: { cooperativaId }, competencia: { gte: new Date(ano, 0, 1), lt: new Date(ano + 1, 0, 1) } },
      orderBy: { competencia: 'asc' },
      include: { usina: { select: { id: true, nome: true } } },
    });
  }
}
