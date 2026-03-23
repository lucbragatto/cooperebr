import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class UcsService {
  constructor(private prisma: PrismaService) {}

  async findAll(cooperativaId?: string) {
    return this.prisma.uc.findMany({
      where: cooperativaId ? { cooperado: { cooperativaId } } : undefined,
      include: { cooperado: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const uc = await this.prisma.uc.findUnique({
      where: { id },
      include: { cooperado: true },
    });
    if (!uc) throw new NotFoundException(`UC com id ${id} não encontrada`);
    return uc;
  }

  async findByCooperado(cooperadoId: string) {
    return this.prisma.uc.findMany({
      where: { cooperadoId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(data: {
    numero: string;
    endereco: string;
    cidade: string;
    estado: string;
    cooperadoId: string;
    numeroUC?: string;
    cep?: string;
    bairro?: string;
    distribuidora?: string;
    classificacao?: string;
    codigoMedidor?: string;
    modalidadeTarifaria?: string;
    tensaoNominal?: string;
    tipoFornecimento?: string;
  }) {
    return this.prisma.uc.create({ data });
  }

  async update(id: string, data: Partial<{
    endereco: string;
    cidade: string;
    estado: string;
  }>) {
    return this.prisma.uc.update({ where: { id }, data });
  }

  async remove(id: string) {
    const contratos = await this.prisma.contrato.count({
      where: { ucId: id, status: { in: ['ATIVO', 'PENDENTE_ATIVACAO', 'LISTA_ESPERA'] } },
    });
    if (contratos > 0) {
      throw new BadRequestException(
        'Não é possível excluir UC com contratos vinculados. Encerre os contratos antes de remover.',
      );
    }
    return this.prisma.uc.delete({ where: { id } });
  }
}