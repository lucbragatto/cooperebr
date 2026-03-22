import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class ConfigTenantService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.configTenant.findMany({
      orderBy: { chave: 'asc' },
    });
  }

  async get(chave: string): Promise<string | null> {
    const config = await this.prisma.configTenant.findUnique({ where: { chave } });
    return config?.valor ?? null;
  }

  async set(chave: string, valor: string, descricao?: string) {
    return this.prisma.configTenant.upsert({
      where: { chave },
      update: { valor, ...(descricao !== undefined && { descricao }) },
      create: { chave, valor, descricao: descricao ?? null },
    });
  }

  async remove(chave: string) {
    return this.prisma.configTenant.delete({ where: { chave } });
  }
}
