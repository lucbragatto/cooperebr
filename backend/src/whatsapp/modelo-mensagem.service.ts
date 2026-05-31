import { Injectable, Logger, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class ModeloMensagemService {
  private readonly logger = new Logger(ModeloMensagemService.name);

  constructor(private prisma: PrismaService) {}

  async findAll(cooperativaId?: string, categoria?: string) {
    const where: any = {};
    if (categoria) where.categoria = categoria;
    if (cooperativaId) {
      where.OR = [{ cooperativaId }, { cooperativaId: null }];
    }
    return this.prisma.modeloMensagem.findMany({
      where,
      orderBy: { nome: 'asc' },
    });
  }

  async findByNome(nome: string, cooperativaId?: string) {
    // Prioriza modelo da cooperativa, fallback para global
    if (cooperativaId) {
      const especifico = await this.prisma.modeloMensagem.findFirst({
        where: { nome, cooperativaId, ativo: true },
      });
      if (especifico) return especifico;
    }
    return this.prisma.modeloMensagem.findFirst({
      where: { nome, cooperativaId: null, ativo: true },
    });
  }

  async create(data: {
    nome: string;
    categoria: string;
    conteudo: string;
    cooperativaId?: string;
    ativo?: boolean;
  }) {
    return this.prisma.modeloMensagem.create({ data });
  }

  async update(id: string, data: Partial<{ nome: string; categoria: string; conteudo: string; ativo: boolean }>) {
    return this.prisma.modeloMensagem.update({ where: { id }, data });
  }

  async delete(id: string, cooperativaId?: string | null, isSuperAdmin = false) {
    // D-novo-BR F0.5 CRITICO (31/05/2026) — qualquer ADMIN podia deletar modelo
    // global (cooperativaId=null) ou de outro tenant. Agora:
    // - modelo global (null): só SUPER_ADMIN
    // - modelo tenant-scoped: só o dono ou SUPER_ADMIN
    const modelo = await this.prisma.modeloMensagem.findUnique({ where: { id } });
    if (!modelo) throw new NotFoundException('Modelo não encontrado');
    if (modelo.cooperativaId === null) {
      if (!isSuperAdmin) throw new ForbiddenException('Modelo global só pode ser deletado por SUPER_ADMIN');
    } else if (cooperativaId && modelo.cooperativaId !== cooperativaId) {
      throw new NotFoundException('Modelo não encontrado');
    }
    return this.prisma.modeloMensagem.delete({ where: { id } });
  }

  renderizar(modelo: { conteudo: string }, variaveis: Record<string, string>): string {
    let texto = modelo.conteudo;
    for (const [chave, valor] of Object.entries(variaveis)) {
      texto = texto.replace(new RegExp(`\\{\\{${chave}\\}\\}`, 'g'), valor);
    }
    return texto;
  }

  async incrementarUso(id: string) {
    try {
      await this.prisma.modeloMensagem.update({
        where: { id },
        data: { usosCount: { increment: 1 } },
      });
    } catch {
      // non-critical
    }
  }

  // ─── Fluxos ──────────────────────────────────────────────────────────────

  async findAllFluxos(cooperativaId?: string) {
    const where: any = {};
    if (cooperativaId) {
      where.OR = [{ cooperativaId }, { cooperativaId: null }];
    }
    return this.prisma.fluxoEtapa.findMany({
      where,
      orderBy: [{ estado: 'asc' }, { ordem: 'asc' }],
    });
  }

  async createFluxo(data: {
    nome: string;
    ordem: number;
    estado: string;
    cooperativaId?: string;
    modeloMensagemId?: string;
    gatilhos: any;
    timeoutHoras?: number;
    modeloFollowupId?: string;
    acaoAutomatica?: string;
  }) {
    return this.prisma.fluxoEtapa.create({ data });
  }

  async updateFluxo(id: string, data: Partial<{
    nome: string;
    ordem: number;
    estado: string;
    modeloMensagemId: string;
    gatilhos: any;
    timeoutHoras: number;
    modeloFollowupId: string;
    acaoAutomatica: string;
    ativo: boolean;
  }>) {
    return this.prisma.fluxoEtapa.update({ where: { id }, data });
  }
}
