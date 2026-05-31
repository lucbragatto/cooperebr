import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
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

  /**
   * D-novo-BR F0.1 AA9+AA10+AA11 (31/05/2026):
   * - Modelo com cooperativaId !== null: só pode ser tocado pelo dono ou SA.
   * - Modelo GLOBAL (cooperativaId === null): só SA pode alterar (impacto sistêmico).
   */
  private async carregarComGuardPosse(id: string, cooperativaId?: string | null, isSuperAdmin = false) {
    const modelo = await this.prisma.modeloCobrancaConfig.findUnique({ where: { id } });
    if (!modelo) throw new NotFoundException('Modelo não encontrado');
    if (modelo.cooperativaId === null) {
      // Global: somente SA
      if (!isSuperAdmin) {
        throw new ForbiddenException('Modelo global só pode ser alterado por SUPER_ADMIN');
      }
      return modelo;
    }
    // Tenant-scoped
    if (cooperativaId && modelo.cooperativaId !== cooperativaId) {
      throw new NotFoundException('Modelo não encontrado');
    }
    return modelo;
  }

  async update(id: string, data: Record<string, unknown>, cooperativaId?: string | null, isSuperAdmin = false) {
    await this.carregarComGuardPosse(id, cooperativaId, isSuperAdmin);
    return this.prisma.modeloCobrancaConfig.update({
      where: { id },
      data,
    });
  }

  async ativar(id: string, cooperativaId?: string | null, isSuperAdmin = false) {
    await this.carregarComGuardPosse(id, cooperativaId, isSuperAdmin);
    return this.prisma.modeloCobrancaConfig.update({
      where: { id },
      data: { ativo: true },
    });
  }

  async desativar(id: string, cooperativaId?: string | null, isSuperAdmin = false) {
    await this.carregarComGuardPosse(id, cooperativaId, isSuperAdmin);
    return this.prisma.modeloCobrancaConfig.update({
      where: { id },
      data: { ativo: false },
    });
  }
}
