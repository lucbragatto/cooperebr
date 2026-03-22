import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class ModelosCobrancaService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.modeloCobrancaConfig.findMany({
      orderBy: { nome: 'asc' },
    });
  }

  async findOne(id: string) {
    const modelo = await this.prisma.modeloCobrancaConfig.findUnique({
      where: { id },
    });
    if (!modelo) throw new NotFoundException('Modelo não encontrado');
    return modelo;
  }

  async update(id: string, data: Record<string, unknown>) {
    await this.findOne(id);
    return this.prisma.modeloCobrancaConfig.update({
      where: { id },
      data,
    });
  }

  async ativar(id: string) {
    await this.findOne(id);
    return this.prisma.modeloCobrancaConfig.update({
      where: { id },
      data: { ativo: true },
    });
  }

  async desativar(id: string) {
    await this.findOne(id);
    return this.prisma.modeloCobrancaConfig.update({
      where: { id },
      data: { ativo: false },
    });
  }
}
