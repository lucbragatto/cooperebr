import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class OcorrenciasService {
  constructor(private prisma: PrismaService) {}

  async findAll(cooperativaId?: string) {
    return this.prisma.ocorrencia.findMany({
      where: cooperativaId ? { cooperativaId } : undefined,
      include: { cooperado: true, uc: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, cooperativaId?: string) {
    const ocorrencia = await this.prisma.ocorrencia.findUnique({
      where: { id },
      include: { cooperado: true, uc: true },
    });
    if (!ocorrencia) throw new NotFoundException(`Ocorrência com id ${id} não encontrada`);
    if (cooperativaId && ocorrencia.cooperativaId !== cooperativaId) {
      throw new NotFoundException(`Ocorrência com id ${id} não encontrada`);
    }
    return ocorrencia;
  }

  async findByCooperado(cooperadoId: string) {
    return this.prisma.ocorrencia.findMany({
      where: { cooperadoId },
      include: { uc: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * D-novo-BR F0.3 MA2 (31/05/2026) — cooperativaId vem do JWT (parâmetro
   * obrigatório do controller). cooperadoId precisa pertencer ao tenant.
   */
  async create(
    data: {
      cooperadoId: string;
      ucId?: string;
      tipo: 'FALTA_ENERGIA' | 'MEDICAO_INCORRETA' | 'PROBLEMA_FATURA' | 'SOLICITACAO' | 'FALHA_USINA' | 'OUTROS';
      descricao: string;
      prioridade: 'BAIXA' | 'MEDIA' | 'ALTA' | 'CRITICA';
    },
    cooperativaId?: string | null,
  ) {
    // Cooperado tem que pertencer ao tenant (quando informado pelo controller)
    if (cooperativaId) {
      const coop = await this.prisma.cooperado.findFirst({
        where: { id: data.cooperadoId, cooperativaId },
        select: { id: true },
      });
      if (!coop) throw new NotFoundException('Cooperado não encontrado');
    }
    return this.prisma.ocorrencia.create({
      data: { ...data, ...(cooperativaId ? { cooperativaId } : {}) },
    });
  }

  async update(
    id: string,
    data: Partial<{
      ucId: string;
      tipo: 'FALTA_ENERGIA' | 'MEDICAO_INCORRETA' | 'PROBLEMA_FATURA' | 'SOLICITACAO' | 'FALHA_USINA' | 'OUTROS';
      descricao: string;
      status: 'ABERTA' | 'EM_ANDAMENTO' | 'RESOLVIDA' | 'CANCELADA';
      prioridade: 'BAIXA' | 'MEDIA' | 'ALTA' | 'CRITICA';
      resolucao: string;
    }>,
    cooperativaId?: string | null,
  ) {
    // D-novo-BR F0.3 AA5 — posse antes do update.
    if (cooperativaId) {
      const ok = await this.prisma.ocorrencia.findFirst({
        where: { id, cooperativaId },
        select: { id: true },
      });
      if (!ok) throw new NotFoundException(`Ocorrência com id ${id} não encontrada`);
    }
    return this.prisma.ocorrencia.update({ where: { id }, data });
  }

  async remove(id: string, cooperativaId?: string | null) {
    // D-novo-BR F0.3 AA6 — posse antes do delete.
    if (cooperativaId) {
      const ok = await this.prisma.ocorrencia.findFirst({
        where: { id, cooperativaId },
        select: { id: true },
      });
      if (!ok) throw new NotFoundException(`Ocorrência com id ${id} não encontrada`);
    }
    return this.prisma.ocorrencia.delete({ where: { id } });
  }
}
