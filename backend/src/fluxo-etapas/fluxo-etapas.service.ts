import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class FluxoEtapasService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    const etapas = await this.prisma.fluxoEtapa.findMany({
      orderBy: { ordem: 'asc' },
    });

    const modeloIds = etapas.map((e) => e.modeloMensagemId).filter(Boolean) as string[];
    if (modeloIds.length === 0) return etapas.map((e) => ({ ...e, modeloMensagem: null }));

    const modelos = await this.prisma.modeloMensagem.findMany({
      where: { id: { in: modeloIds } },
    });
    const modeloMap = new Map(modelos.map((m) => [m.id, m]));

    return etapas.map((e) => ({
      ...e,
      modeloMensagem: e.modeloMensagemId ? modeloMap.get(e.modeloMensagemId) ?? null : null,
    }));
  }

  findOne(id: string) {
    return this.prisma.fluxoEtapa.findUniqueOrThrow({ where: { id } });
  }

  create(data: {
    cooperativaId?: string;
    nome: string;
    ordem: number;
    estado: string;
    modeloMensagemId?: string;
    gatilhos: any;
    timeoutHoras?: number;
    modeloFollowupId?: string;
    acaoAutomatica?: string;
    ativo?: boolean;
  }) {
    return this.prisma.fluxoEtapa.create({ data });
  }

  update(id: string, data: {
    nome?: string;
    ordem?: number;
    estado?: string;
    modeloMensagemId?: string;
    gatilhos?: any;
    timeoutHoras?: number;
    modeloFollowupId?: string;
    acaoAutomatica?: string;
    ativo?: boolean;
  }) {
    return this.prisma.fluxoEtapa.update({ where: { id }, data });
  }

  delete(id: string) {
    return this.prisma.fluxoEtapa.delete({ where: { id } });
  }

  async preview() {
    const etapas = await this.prisma.fluxoEtapa.findMany({
      where: { ativo: true },
      orderBy: { ordem: 'asc' },
    });

    const modelos = await this.prisma.modeloMensagem.findMany({
      where: { id: { in: etapas.map((e) => e.modeloMensagemId).filter(Boolean) as string[] } },
    });

    const modeloMap = new Map(modelos.map((m) => [m.id, m]));

    return etapas.map((e) => ({
      ...e,
      modeloMensagem: e.modeloMensagemId ? modeloMap.get(e.modeloMensagemId) ?? null : null,
    }));
  }
}
