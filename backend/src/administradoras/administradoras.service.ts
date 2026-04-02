import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class AdministradorasService {
  constructor(private prisma: PrismaService) {}

  async findAll(cooperativaId?: string) {
    return this.prisma.administradora.findMany({
      where: { ...(cooperativaId ? { cooperativaId } : {}), ativo: true },
      include: { _count: { select: { condominios: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, cooperativaId?: string) {
    const adm = await this.prisma.administradora.findUnique({
      where: { id },
      include: { condominios: { where: { ativo: true }, orderBy: { nome: 'asc' } } },
    });
    if (!adm) throw new NotFoundException('Agregador nao encontrado');
    if (cooperativaId && adm.cooperativaId !== cooperativaId) throw new NotFoundException('Agregador nao encontrado');
    return adm;
  }

  async create(data: {
    cooperativaId: string;
    razaoSocial: string;
    nomeFantasia?: string;
    cnpj: string;
    email: string;
    telefone: string;
    responsavelNome: string;
    responsavelCpf?: string;
    responsavelEmail?: string;
    responsavelTelefone?: string;
  }) {
    return this.prisma.administradora.create({ data });
  }

  async update(id: string, data: any) {
    const adm = await this.prisma.administradora.findUnique({ where: { id } });
    if (!adm) throw new NotFoundException('Agregador nao encontrado');
    return this.prisma.administradora.update({ where: { id }, data });
  }

  async remove(id: string) {
    const adm = await this.prisma.administradora.findUnique({ where: { id } });
    if (!adm) throw new NotFoundException('Agregador nao encontrado');
    return this.prisma.administradora.update({ where: { id }, data: { ativo: false } });
  }
}
