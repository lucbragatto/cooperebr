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

  async findOne(id: string, cooperativaId?: string | null) {
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

  async update(id: string, data: any, cooperativaId?: string | null) {
    // D-novo-BR F0.1 CA1 IDOR fix (31/05/2026) — posse antes do update.
    // cooperativaId null = SUPER_ADMIN bypass.
    const adm = cooperativaId
      ? await this.prisma.administradora.findFirst({ where: { id, cooperativaId } })
      : await this.prisma.administradora.findUnique({ where: { id } });
    if (!adm) throw new NotFoundException('Agregador nao encontrado');
    return this.prisma.administradora.update({ where: { id }, data });
  }

  async remove(id: string, cooperativaId?: string | null) {
    // D-novo-BR F0.1 CA2 IDOR fix (31/05/2026) — posse antes do soft-delete.
    const adm = cooperativaId
      ? await this.prisma.administradora.findFirst({ where: { id, cooperativaId } })
      : await this.prisma.administradora.findUnique({ where: { id } });
    if (!adm) throw new NotFoundException('Agregador nao encontrado');
    return this.prisma.administradora.update({ where: { id }, data: { ativo: false } });
  }
}
