import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class OcorrenciasService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.ocorrencia.findMany({
      include: { cooperado: true, uc: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const ocorrencia = await this.prisma.ocorrencia.findUnique({
      where: { id },
      include: { cooperado: true, uc: true },
    });
    if (!ocorrencia) throw new NotFoundException(`Ocorrência com id ${id} não encontrada`);
    return ocorrencia;
  }

  async findByCooperado(cooperadoId: string) {
    return this.prisma.ocorrencia.findMany({
      where: { cooperadoId },
      include: { uc: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(data: {
    cooperadoId: string;
    ucId?: string;
    tipo: 'FALTA_ENERGIA' | 'MEDICAO_INCORRETA' | 'PROBLEMA_FATURA' | 'SOLICITACAO' | 'OUTROS';
    descricao: string;
    prioridade: 'BAIXA' | 'MEDIA' | 'ALTA' | 'CRITICA';
  }) {
    return this.prisma.ocorrencia.create({ data });
  }

  async update(id: string, data: Partial<{
    ucId: string;
    tipo: 'FALTA_ENERGIA' | 'MEDICAO_INCORRETA' | 'PROBLEMA_FATURA' | 'SOLICITACAO' | 'OUTROS';
    descricao: string;
    status: 'ABERTA' | 'EM_ANDAMENTO' | 'RESOLVIDA' | 'CANCELADA';
    prioridade: 'BAIXA' | 'MEDIA' | 'ALTA' | 'CRITICA';
    resolucao: string;
  }>) {
    return this.prisma.ocorrencia.update({ where: { id }, data });
  }

  async remove(id: string) {
    return this.prisma.ocorrencia.delete({ where: { id } });
  }
}
