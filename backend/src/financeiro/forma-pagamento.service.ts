import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class FormaPagamentoService {
  constructor(private prisma: PrismaService) {}

  async findByCooperado(cooperadoId: string, cooperativaId?: string) {
    // D-48-financeiro IDOR fix: valida tenant do cooperado primeiro.
    if (cooperativaId) {
      const coop = await this.prisma.cooperado.findFirst({
        where: { id: cooperadoId, cooperativaId },
        select: { id: true },
      });
      if (!coop) throw new NotFoundException('Cooperado não encontrado');
    }
    const forma = await this.prisma.formaPagamentoCooperado.findUnique({
      where: { cooperadoId },
    });
    if (!forma) throw new NotFoundException(`Forma de pagamento não encontrada para cooperado ${cooperadoId}`);
    return forma;
  }

  async createOrUpdate(cooperadoId: string, data: {
    tipo: string;
    recorrente?: boolean;
    convenioId?: string;
    agencia?: string;
    conta?: string;
    banco?: string;
    dadosGateway?: any;
    ativo?: boolean;
  }, cooperativaId?: string) {
    // D-48-financeiro IDOR fix: cooperado precisa pertencer ao tenant do caller.
    const cooperado = await this.prisma.cooperado.findFirst({
      where: { id: cooperadoId, ...(cooperativaId ? { cooperativaId } : {}) },
    });
    if (!cooperado) throw new NotFoundException('Cooperado não encontrado');

    const existente = await this.prisma.formaPagamentoCooperado.findUnique({
      where: { cooperadoId },
    });

    if (existente) {
      return this.prisma.formaPagamentoCooperado.update({
        where: { cooperadoId },
        data,
      });
    }

    return this.prisma.formaPagamentoCooperado.create({
      data: { cooperadoId, ...data },
    });
  }
}
