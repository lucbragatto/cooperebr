import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class CooperativasService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    const cooperativas = await this.prisma.cooperativa.findMany({
      orderBy: { nome: 'asc' },
    });

    return Promise.all(
      cooperativas.map(async (c) => {
        const [qtdUsinas, qtdCooperados] = await Promise.all([
          this.prisma.usina.count({ where: { cooperativaId: c.id } }),
          this.prisma.cooperado.count({
            where: { cooperativaId: c.id, status: { in: ['ATIVO', 'APROVADO'] } },
          }),
        ]);
        return { ...c, qtdUsinas, qtdCooperados };
      }),
    );
  }

  async findOne(id: string) {
    const cooperativa = await this.prisma.cooperativa.findUnique({
      where: { id },
      include: { usinas: true },
    });
    if (!cooperativa) {
      throw new NotFoundException(`Cooperativa com id ${id} não encontrada`);
    }
    return cooperativa;
  }

  async create(data: {
    nome: string;
    cnpj: string;
    email?: string;
    telefone?: string;
    endereco?: string;
    numero?: string;
    bairro?: string;
    cidade?: string;
    estado?: string;
    cep?: string;
    ativo?: boolean;
  }) {
    const existe = await this.prisma.cooperativa.findUnique({
      where: { cnpj: data.cnpj },
    });
    if (existe) {
      throw new BadRequestException(`Já existe uma cooperativa com o CNPJ ${data.cnpj}`);
    }
    return this.prisma.cooperativa.create({ data });
  }

  async update(
    id: string,
    data: Partial<{
      nome: string;
      cnpj: string;
      email: string;
      telefone: string;
      endereco: string;
      numero: string;
      bairro: string;
      cidade: string;
      estado: string;
      cep: string;
      ativo: boolean;
    }>,
  ) {
    const cooperativa = await this.prisma.cooperativa.findUnique({ where: { id } });
    if (!cooperativa) {
      throw new NotFoundException(`Cooperativa com id ${id} não encontrada`);
    }
    return this.prisma.cooperativa.update({ where: { id }, data });
  }

  async remove(id: string) {
    const cooperativa = await this.prisma.cooperativa.findUnique({ where: { id } });
    if (!cooperativa) {
      throw new NotFoundException(`Cooperativa com id ${id} não encontrada`);
    }

    const [qtdUsinas, qtdCooperados] = await Promise.all([
      this.prisma.usina.count({ where: { cooperativaId: id } }),
      this.prisma.cooperado.count({ where: { cooperativaId: id } }),
    ]);

    if (qtdUsinas > 0) {
      throw new BadRequestException(
        `Cooperativa possui ${qtdUsinas} usina(s) vinculada(s). Remova as usinas antes de excluir.`,
      );
    }
    if (qtdCooperados > 0) {
      throw new BadRequestException(
        `Cooperativa possui ${qtdCooperados} cooperado(s) vinculado(s). Remova os cooperados antes de excluir.`,
      );
    }

    return this.prisma.cooperativa.delete({ where: { id } });
  }
}
