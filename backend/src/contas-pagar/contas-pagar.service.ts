import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CategoriaContaAPagar, StatusContaAPagar } from '@prisma/client';

interface CreateContaAPagarDto {
  descricao: string;
  categoria: CategoriaContaAPagar;
  valor: number;
  dataVencimento: string;
  usinaId?: string;
  comprovante?: string;
}

interface UpdateContaAPagarDto {
  descricao?: string;
  categoria?: CategoriaContaAPagar;
  valor?: number;
  dataVencimento?: string;
  dataPagamento?: string;
  status?: StatusContaAPagar;
  usinaId?: string;
  comprovante?: string;
}

@Injectable()
export class ContasPagarService {
  constructor(private prisma: PrismaService) {}

  async findAll(cooperativaId: string, filtros?: { status?: string; categoria?: string }) {
    if (!cooperativaId) throw new BadRequestException('cooperativaId é obrigatório');
    return this.prisma.contaAPagar.findMany({
      where: {
        cooperativaId,
        ...(filtros?.status ? { status: filtros.status as StatusContaAPagar } : {}),
        ...(filtros?.categoria ? { categoria: filtros.categoria as CategoriaContaAPagar } : {}),
      },
      include: { usina: { select: { id: true, nome: true } } },
      orderBy: { dataVencimento: 'asc' },
    });
  }

  async findOne(id: string, cooperativaId: string) {
    if (!cooperativaId) throw new BadRequestException('cooperativaId é obrigatório');
    const conta = await this.prisma.contaAPagar.findFirst({
      where: { id, cooperativaId },
      include: { usina: { select: { id: true, nome: true } } },
    });
    if (!conta) throw new NotFoundException('Conta a pagar não encontrada');
    return conta;
  }

  async create(cooperativaId: string, dto: CreateContaAPagarDto) {
    if (!cooperativaId) throw new BadRequestException('cooperativaId é obrigatório');
    return this.prisma.contaAPagar.create({
      data: {
        cooperativaId,
        descricao: dto.descricao,
        categoria: dto.categoria,
        valor: dto.valor,
        dataVencimento: new Date(dto.dataVencimento),
        usinaId: dto.usinaId ?? null,
        comprovante: dto.comprovante ?? null,
      },
    });
  }

  async update(id: string, cooperativaId: string, dto: UpdateContaAPagarDto) {
    await this.findOne(id, cooperativaId);

    const data: Record<string, unknown> = {};
    if (dto.descricao !== undefined) data.descricao = dto.descricao;
    if (dto.categoria !== undefined) data.categoria = dto.categoria;
    if (dto.valor !== undefined) data.valor = dto.valor;
    if (dto.dataVencimento !== undefined) data.dataVencimento = new Date(dto.dataVencimento);
    if (dto.dataPagamento !== undefined) data.dataPagamento = new Date(dto.dataPagamento);
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.usinaId !== undefined) data.usinaId = dto.usinaId;
    if (dto.comprovante !== undefined) data.comprovante = dto.comprovante;

    return this.prisma.contaAPagar.update({
      where: { id },
      data,
    });
  }

  async remove(id: string, cooperativaId: string) {
    await this.findOne(id, cooperativaId);
    return this.prisma.contaAPagar.delete({ where: { id } });
  }
}
