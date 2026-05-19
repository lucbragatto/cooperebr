import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import type { EscopoTenant } from '../modelos-mensagem/modelos-mensagem.service';

interface Gatilho {
  resposta: string;
  proximoEstado: string;
}

interface CreateFluxoEtapaInput {
  cooperativaId?: string | null;
  nome: string;
  ordem: number;
  estado: string;
  modeloMensagemId?: string | null;
  gatilhos: Gatilho[];
  timeoutHoras?: number | null;
  modeloFollowupId?: string | null;
  acaoAutomatica?: string | null;
  ativo?: boolean;
}

interface UpdateFluxoEtapaInput {
  nome?: string;
  ordem?: number;
  estado?: string;
  modeloMensagemId?: string | null;
  gatilhos?: Gatilho[];
  timeoutHoras?: number | null;
  modeloFollowupId?: string | null;
  acaoAutomatica?: string | null;
  ativo?: boolean;
}

@Injectable()
export class FluxoEtapasService {
  constructor(private prisma: PrismaService) {}

  async findAll(escopo: EscopoTenant) {
    const etapas = await this.prisma.fluxoEtapa.findMany({
      where: this.filtroTenant(escopo),
      orderBy: { ordem: 'asc' },
    });

    return this.hidratarModelos(etapas, escopo);
  }

  async findOne(id: string, escopo: EscopoTenant) {
    const etapa = await this.prisma.fluxoEtapa.findUnique({ where: { id } });
    if (!etapa) throw new NotFoundException(`Etapa ${id} não encontrada`);
    this.garantirAcesso(etapa.cooperativaId, escopo);
    return etapa;
  }

  create(data: CreateFluxoEtapaInput, escopo: EscopoTenant) {
    const cooperativaId =
      escopo === undefined ? (data.cooperativaId ?? null) : escopo;

    return this.prisma.fluxoEtapa.create({
      data: {
        ...data,
        cooperativaId,
        gatilhos: data.gatilhos as unknown as object, // Prisma Json
      },
    });
  }

  async update(id: string, data: UpdateFluxoEtapaInput, escopo: EscopoTenant) {
    await this.findOne(id, escopo); // valida acesso
    const payload: Record<string, unknown> = { ...data };
    if (data.gatilhos !== undefined) {
      payload.gatilhos = data.gatilhos as unknown as object;
    }
    return this.prisma.fluxoEtapa.update({ where: { id }, data: payload });
  }

  async delete(id: string, escopo: EscopoTenant) {
    await this.findOne(id, escopo); // valida acesso
    return this.prisma.fluxoEtapa.delete({ where: { id } });
  }

  async preview(escopo: EscopoTenant) {
    const where: Record<string, unknown> = { ativo: true };
    Object.assign(where, this.filtroTenant(escopo));

    const etapas = await this.prisma.fluxoEtapa.findMany({
      where,
      orderBy: { ordem: 'asc' },
    });

    return this.hidratarModelos(etapas, escopo);
  }

  // ─── helpers internos ────────────────────────────────────────────────────

  private async hidratarModelos<T extends { modeloMensagemId: string | null }>(
    etapas: T[],
    escopo: EscopoTenant,
  ): Promise<Array<T & { modeloMensagem: unknown }>> {
    const modeloIds = etapas.map((e) => e.modeloMensagemId).filter(Boolean) as string[];
    if (modeloIds.length === 0) {
      return etapas.map((e) => ({ ...e, modeloMensagem: null }));
    }

    const modelos = await this.prisma.modeloMensagem.findMany({
      where: {
        id: { in: modeloIds },
        ...this.filtroTenant(escopo),
      },
    });
    const modeloMap = new Map(modelos.map((m) => [m.id, m]));

    return etapas.map((e) => ({
      ...e,
      modeloMensagem: e.modeloMensagemId ? modeloMap.get(e.modeloMensagemId) ?? null : null,
    }));
  }

  private filtroTenant(escopo: EscopoTenant): Record<string, unknown> {
    if (escopo === undefined) return {};
    if (escopo === null) return { cooperativaId: null };
    return { OR: [{ cooperativaId: escopo }, { cooperativaId: null }] };
  }

  private garantirAcesso(recursoCooperativaId: string | null, escopo: EscopoTenant): void {
    if (escopo === undefined) return;
    if (recursoCooperativaId === null) return;
    if (recursoCooperativaId !== escopo) {
      throw new ForbiddenException('Acesso negado: etapa pertence a outro tenant');
    }
  }
}
