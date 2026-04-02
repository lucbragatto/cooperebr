import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { MODULO_KEY } from './require-modulo.decorator';
import { PrismaService } from '../prisma.service';
import { PerfilUsuario } from './perfil.enum';

@Injectable()
export class ModuloGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const modulo = this.reflector.getAllAndOverride<string>(MODULO_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // Sem @RequireModulo: não aplica
    if (!modulo) return true;

    const { user } = context.switchToHttp().getRequest();
    if (!user) return false;

    // SUPER_ADMIN sempre tem acesso
    if (user.perfil === PerfilUsuario.SUPER_ADMIN) return true;

    if (!user.cooperativaId) {
      throw new ForbiddenException('Módulo não disponível: sem cooperativa vinculada');
    }

    const coop = await this.prisma.cooperativa.findUnique({
      where: { id: user.cooperativaId },
      select: { modulosAtivos: true },
    });

    if (!coop || !coop.modulosAtivos.includes(modulo)) {
      throw new ForbiddenException(`Módulo '${modulo}' não está habilitado para sua cooperativa`);
    }

    return true;
  }
}
