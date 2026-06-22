import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

/**
 * Sprint Funil M48 (22/06/2026) — H1 code-reviewer 22/06.
 * Classes de erro tipadas pra LeadExpansaoService.converter — controller
 * mapeia por instanceof, sem fragilidade de substring match.
 */
export class LeadNaoEncontradoError extends Error {
  readonly code = 'LEAD_NOT_FOUND';
  constructor(msg: string) {
    super(msg);
    this.name = 'LeadNaoEncontradoError';
  }
}

export class LeadJaConvertidoError extends Error {
  readonly code = 'LEAD_ALREADY_CONVERTED';
  constructor(msg: string) {
    super(msg);
    this.name = 'LeadJaConvertidoError';
  }
}

@Injectable()
export class LeadExpansaoService {
  constructor(private prisma: PrismaService) {}

  calcularScore(lead: {
    valorFatura?: any;
    intencaoConfirmada?: boolean;
    distribuidora?: string;
    createdAt: Date;
    cooperativaId?: string | null;
  }): number {
    let score = 0;
    const valor = lead.valorFatura ? Number(lead.valorFatura) : 0;
    if (valor > 400) score += 3;
    else if (valor > 200) score += 1;
    if (lead.intencaoConfirmada) score += 2;
    // Interagiu há menos de 24h: +1
    const diffMs = Date.now() - new Date(lead.createdAt).getTime();
    if (diffMs < 24 * 60 * 60 * 1000) score += 1;
    // Cooperativa vinculada (indicado por cooperado ativo): +1
    if (lead.cooperativaId) score += 1;
    return Math.min(score, 10);
  }

  async create(data: {
    telefone: string;
    nomeCompleto?: string;
    distribuidora: string;
    cidade?: string;
    estado?: string;
    numeroUC?: string;
    valorFatura?: number;
    economiaEstimada?: number;
    intencaoConfirmada?: boolean;
    cooperativaId?: string;
  }) {
    return this.prisma.leadExpansao.create({
      data: {
        telefone: data.telefone,
        nomeCompleto: data.nomeCompleto,
        distribuidora: data.distribuidora,
        cidade: data.cidade,
        estado: data.estado,
        numeroUC: data.numeroUC,
        valorFatura: data.valorFatura,
        economiaEstimada: data.economiaEstimada,
        intencaoConfirmada: data.intencaoConfirmada ?? false,
        cooperativaId: data.cooperativaId,
      },
    });
  }

  async findAll(filtros?: {
    distribuidora?: string;
    estado?: string;
    intencaoConfirmada?: boolean;
    cooperativaId?: string;
  }) {
    const where: any = {};
    if (filtros?.distribuidora) {
      where.distribuidora = { contains: filtros.distribuidora, mode: 'insensitive' };
    }
    if (filtros?.estado) {
      where.estado = filtros.estado;
    }
    if (filtros?.intencaoConfirmada !== undefined) {
      where.intencaoConfirmada = filtros.intencaoConfirmada;
    }
    // SEC: ADMIN só vê leads da sua cooperativa
    if (filtros?.cooperativaId) {
      where.cooperativaId = filtros.cooperativaId;
    }
    const leads = await this.prisma.leadExpansao.findMany({
      where: Object.keys(where).length > 0 ? where : undefined,
      orderBy: { createdAt: 'desc' },
    });

    const leadsComScore = leads.map((lead) => ({
      ...lead,
      score: this.calcularScore(lead),
    }));

    leadsComScore.sort((a, b) => b.score - a.score);
    return leadsComScore;
  }

  async getResumoInvestidores(cooperativaId?: string) {
    const where: any = cooperativaId ? { cooperativaId } : {};
    const leads = await this.prisma.leadExpansao.findMany({ where });

    const agrupado: Record<string, {
      distribuidora: string;
      estado: string;
      totalLeads: number;
      confirmados: number;
      somaEconomia: number;
      countEconomia: number;
    }> = {};

    for (const lead of leads) {
      const key = `${lead.distribuidora}||${lead.estado ?? 'N/A'}`;
      if (!agrupado[key]) {
        agrupado[key] = {
          distribuidora: lead.distribuidora,
          estado: lead.estado ?? 'N/A',
          totalLeads: 0,
          confirmados: 0,
          somaEconomia: 0,
          countEconomia: 0,
        };
      }
      agrupado[key].totalLeads++;
      if (lead.intencaoConfirmada) agrupado[key].confirmados++;
      if (lead.economiaEstimada) {
        agrupado[key].somaEconomia += Number(lead.economiaEstimada);
        agrupado[key].countEconomia++;
      }
    }

    const resumo = Object.values(agrupado).map((g) => ({
      distribuidora: g.distribuidora,
      estado: g.estado,
      totalLeads: g.totalLeads,
      confirmados: g.confirmados,
      economiaMesMedia: g.countEconomia > 0 ? Math.round((g.somaEconomia / g.countEconomia) * 100) / 100 : 0,
      receitaLatenteAnual: Math.round(g.somaEconomia * 12 * 100) / 100,
    }));

    const totalReceitaLatente = resumo.reduce((s, r) => s + r.receitaLatenteAnual, 0);

    return { resumo, totalReceitaLatente };
  }

  /**
   * Sprint Funil M48 (22/06/2026) — Camada 1 Fatia E.
   *
   * Converte LeadExpansao em Cooperado cadastrado:
   *  - Multi-tenant: lead.cooperativaId DEVE bater com cooperativaId do JWT
   *    (controller passa direto, sem fallback).
   *  - Cria Cooperado no tenant atual com dados mínimos do lead + dados extras
   *    do admin (DTO).
   *  - Atualiza LeadExpansao.status='CONVERTIDO' (estado terminal).
   *  - Idempotente: rejeita se lead já está CONVERTIDO.
   *
   * Erros tipados (H1 code-reviewer 22/06): controller pega por instanceof,
   * não por substring de message.
   */
  async converter(
    leadId: string,
    cooperativaId: string,
    dadosCooperado: {
      nomeCompleto: string;
      cpf: string;
      email: string;
      telefone?: string;
      status?: string;
    },
  ): Promise<{ cooperadoId: string; leadId: string }> {
    const lead = await this.prisma.leadExpansao.findFirst({
      where: { id: leadId, cooperativaId },
      select: { id: true, telefone: true, status: true, distribuidora: true },
    });
    if (!lead) {
      throw new LeadNaoEncontradoError('LeadExpansao não encontrado neste tenant');
    }
    if (lead.status === 'CONVERTIDO') {
      throw new LeadJaConvertidoError('Lead já foi convertido');
    }

    // Cria Cooperado + atualiza lead atomicamente.
    const result = await this.prisma.$transaction(async (tx) => {
      const cooperado = await tx.cooperado.create({
        data: {
          nomeCompleto: dadosCooperado.nomeCompleto.trim(),
          cpf: dadosCooperado.cpf.replace(/\D/g, ''),
          email: dadosCooperado.email.trim().toLowerCase(),
          telefone: dadosCooperado.telefone?.replace(/\D/g, '') ?? lead.telefone,
          status: (dadosCooperado.status ?? 'PENDENTE') as any,
          cooperativaId,
          tipoCooperado: 'COM_UC' as any,
        },
      });
      // P2 multitenant 22/06: defense-in-depth — update inclui cooperativaId
      // no where (findFirst acima já validou posse).
      await tx.leadExpansao.update({
        where: { id: leadId, cooperativaId },
        data: { status: 'CONVERTIDO' },
      });
      return cooperado;
    });

    return { cooperadoId: result.id, leadId };
  }

  async notificarLeadsPorDistribuidora(distribuidora: string, cooperativaId?: string) {
    const where: any = {
      distribuidora: { contains: distribuidora, mode: 'insensitive' },
      intencaoConfirmada: true,
      status: 'AGUARDANDO',
    };
    if (cooperativaId) where.cooperativaId = cooperativaId;
    const leads = await this.prisma.leadExpansao.findMany({ where });

    const agora = new Date();
    await this.prisma.leadExpansao.updateMany({
      where: {
        id: { in: leads.map((l) => l.id) },
      },
      data: {
        status: 'NOTIFICADO',
        notificadoEm: agora,
      },
    });

    return { notificados: leads.length, telefones: leads.map((l) => l.telefone) };
  }
}
