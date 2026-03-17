import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class ContratosService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.contrato.findMany({
      include: { cooperado: true, uc: true, usina: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    return this.prisma.contrato.findUnique({
      where: { id },
      include: { cooperado: true, uc: true, usina: true },
    });
  }

  async findByCooperado(cooperadoId: string) {
    return this.prisma.contrato.findMany({
      where: { cooperadoId },
      include: { uc: true, usina: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(data: {
    cooperadoId: string;
    ucId: string;
    usinaId?: string;
    planoId?: string;
    dataInicio: Date;
    dataFim?: Date;
    percentualDesconto: number;
    kwhContrato?: number;
  }) {
    const ano = new Date().getFullYear();
    const lastContrato = await this.prisma.contrato.findFirst({
      where: { numero: { startsWith: `CTR-${ano}-` } },
      orderBy: { numero: 'desc' },
    });
    const seq = lastContrato ? parseInt(lastContrato.numero.split('-')[2] ?? '0', 10) + 1 : 1;
    const numero = `CTR-${ano}-${String(seq).padStart(4, '0')}`;

    return this.prisma.contrato.create({
      data: { ...data, numero },
      include: { uc: true, usina: true, plano: true, cobrancas: true },
    });
  }

  async update(id: string, data: Partial<{
    ucId: string;
    usinaId: string;
    planoId: string;
    dataInicio: Date;
    dataFim: Date;
    percentualDesconto: number;
    kwhContrato: number;
    status: 'ATIVO' | 'SUSPENSO' | 'ENCERRADO' | 'LISTA_ESPERA';
  }>) {
    return this.prisma.contrato.update({ where: { id }, data });
  }

  async remove(id: string) {
    return this.prisma.contrato.delete({ where: { id } });
  }
}
