import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class ConfigTenantService {
  constructor(private prisma: PrismaService) {}

  async findAll(cooperativaId: string) {
    return this.prisma.configTenant.findMany({
      where: { cooperativaId },
      orderBy: { chave: 'asc' },
    });
  }

  async get(chave: string, cooperativaId: string): Promise<string | null> {
    const config = await this.prisma.configTenant.findFirst({
      where: { chave, cooperativaId },
    });
    return config?.valor ?? null;
  }

  async set(chave: string, valor: string, cooperativaId: string, descricao?: string) {
    // Upsert pelo unique composto [chave, cooperativaId] — isolamento total por tenant
    return this.prisma.configTenant.upsert({
      where: { chave_cooperativaId: { chave, cooperativaId } },
      update: { valor, ...(descricao !== undefined && { descricao }) },
      create: { chave, valor, cooperativaId, descricao: descricao ?? null },
    });
  }

  async remove(chave: string, cooperativaId: string) {
    const existing = await this.prisma.configTenant.findFirst({
      where: { chave, cooperativaId },
    });
    if (!existing) return null;
    return this.prisma.configTenant.delete({ where: { id: existing.id } });
  }
}
