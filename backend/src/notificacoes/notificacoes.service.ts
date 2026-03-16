import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import type { Usuario } from '@prisma/client';
import { PerfilUsuario } from '../auth/perfil.enum';

interface CriarNotificacaoDto {
  tipo: string;
  titulo: string;
  mensagem: string;
  cooperadoId?: string;
  adminId?: string;
  link?: string;
}

@Injectable()
export class NotificacoesService {
  constructor(private prisma: PrismaService) {}

  async criar(data: CriarNotificacaoDto) {
    return this.prisma.notificacao.create({ data });
  }

  async findAll(user: Usuario) {
    const where = await this.buildWhere(user);
    return this.prisma.notificacao.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        cooperado: { select: { nomeCompleto: true } },
      },
    });
  }

  async countNaoLidas(user: Usuario): Promise<{ count: number }> {
    const where = await this.buildWhere(user);
    const count = await this.prisma.notificacao.count({
      where: { ...where, lida: false },
    });
    return { count };
  }

  async marcarComoLida(id: string) {
    return this.prisma.notificacao.update({
      where: { id },
      data: { lida: true },
    });
  }

  async marcarTodasComoLidas(user: Usuario) {
    const where = await this.buildWhere(user);
    await this.prisma.notificacao.updateMany({
      where: { ...where, lida: false },
      data: { lida: true },
    });
    return { sucesso: true };
  }

  private async buildWhere(user: Usuario) {
    if (user.perfil !== PerfilUsuario.COOPERADO) {
      return {
        OR: [{ adminId: null }, { adminId: user.id }],
      };
    }
    const cooperado = await this.prisma.cooperado.findUnique({
      where: { email: user.email },
      select: { id: true },
    });
    if (!cooperado) {
      return { id: '__none__' } as Record<string, unknown>;
    }
    return { cooperadoId: cooperado.id };
  }
}
