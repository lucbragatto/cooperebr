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
    const existing = await this.prisma.configTenant.findFirst({
      where: { chave, cooperativaId },
    });
    if (existing) {
      return this.prisma.configTenant.update({
        where: { id: existing.id },
        data: { valor, ...(descricao !== undefined && { descricao }) },
      });
    }
    return this.prisma.configTenant.create({
      data: { chave, valor, cooperativaId, descricao: descricao ?? null },
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
