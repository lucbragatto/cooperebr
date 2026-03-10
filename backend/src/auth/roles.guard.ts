import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from './public.decorator';
import { ROLES_KEY } from './roles.decorator';
import { PerfilUsuario } from './perfil.enum';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const roles = this.reflector.getAllAndOverride<PerfilUsuario[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // Sem @Roles(): rota autenticada mas sem restrição de perfil
    if (!roles || roles.length === 0) return true;

    const { user } = context.switchToHttp().getRequest();
    if (!user) return false;

    // SUPER_ADMIN sempre tem acesso
    if (user.perfil === PerfilUsuario.SUPER_ADMIN) return true;

    if (!roles.includes(user.perfil)) {
      throw new ForbiddenException(
        `Acesso negado: perfil '${user.perfil}' não tem permissão para esta ação`,
      );
    }

    return true;
  }
}
