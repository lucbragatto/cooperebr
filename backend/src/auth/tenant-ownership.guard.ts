import {
  Injectable,
  CanActivate,
  ExecutionContext,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../prisma.service';
import { PerfilUsuario } from './perfil.enum';
import { IS_PUBLIC_KEY } from './public.decorator';
import {
  TENANT_RESOURCE_KEY,
  TENANT_EXEMPT_KEY,
  TenantResourceOpts,
} from './tenant-resource.decorator';
import { buildNestedWhere } from './build-nested-where';

/**
 * D-novo-BR F1.1 (31/05/2026) — Guard sistêmico de posse multi-tenant.
 *
 * **Opt-in:** roda apenas quando o handler tem `@TenantResource(opts)`.
 * Sem decorator → passa direto (não-quebrante pros ~38 endpoints já
 * protegidos via fix manual D-48/Fase2/BQ/BR-F0 + ~25 endpoints globais).
 *
 * **SUPER_ADMIN bypass:** mantém intenção de acesso cross-tenant.
 *
 * **Ordem:** registrado depois de RolesGuard + ModuloGuard. Quando dispara,
 * `req.user` já foi autenticado, perfil já foi validado, módulo já foi
 * checado — só falta confirmar posse do recurso por id.
 *
 * **Padrão consolidado D-novo-BR (4 categorias suportadas):**
 *  1. Posse direta:        `{ model: 'usina' }`                              → where: { id, cooperativaId }
 *  2. Posse via relação:   `{ model: 'doc', via: 'cooperado.cooperativaId' }` → where: { id, cooperado: { cooperativaId } }
 *  3. Global-only-SA:      `{ model: 'modeloMensagem', globalOnlySuperAdmin: true }` → ADMIN bloqueado se recurso global
 *  4. Body-injection:      fora do alcance do Guard — fix controller-side continua (Fase 1.5)
 */
@Injectable()
export class TenantOwnershipGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // 1. Public skip
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    // 2. Exempt explícito skip
    const isExempt = this.reflector.getAllAndOverride<boolean>(TENANT_EXEMPT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isExempt) return true;

    // 3. Opt-in: sem @TenantResource → passa (não-quebrante)
    const opts = this.reflector.getAllAndOverride<TenantResourceOpts>(TENANT_RESOURCE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!opts) return true;

    // 4. user precisa estar autenticado (JwtAuthGuard já rodou antes)
    const req = context.switchToHttp().getRequest();
    const user = req?.user;
    if (!user) return false;

    // 5. SUPER_ADMIN bypass
    if (user.perfil === PerfilUsuario.SUPER_ADMIN) return true;

    // 6. ADMIN sem cooperativaId no token é estado inválido
    if (!user.cooperativaId) {
      throw new ForbiddenException('Usuário sem cooperativaId no token');
    }

    // 7. Extrair id do param
    const idParam = opts.idParam ?? 'id';
    const id = req.params?.[idParam];
    if (!id || typeof id !== 'string') {
      throw new BadRequestException(
        `@TenantResource exige param '${idParam}' presente na rota`,
      );
    }

    // 8. Validar model existe no PrismaClient
    const delegate = (this.prisma as any)[opts.model];
    if (!delegate || typeof delegate.findFirst !== 'function') {
      throw new BadRequestException(
        `@TenantResource: model '${opts.model}' não encontrado no PrismaService`,
      );
    }

    // 9. Construir where (direto ou via relação)
    const wherePosse = opts.via
      ? buildNestedWhere(opts.via, user.cooperativaId)
      : { cooperativaId: user.cooperativaId };

    // 10. Consulta opt-in: descobre se recurso existe pra esse tenant.
    //     Se globalOnlySuperAdmin, precisamos saber se cooperativaId é null
    //     (recurso global) — caso em que findFirst com filtro de cooperativaId
    //     do user não retornaria. Por isso, quando flag ativa, buscamos pelo
    //     id puro e validamos manualmente.
    if (opts.globalOnlySuperAdmin) {
      const found = await delegate.findUnique({
        where: { id },
        select: { id: true, cooperativaId: true },
      });
      if (!found) throw new NotFoundException('Recurso não encontrado');
      if (found.cooperativaId === null) {
        throw new ForbiddenException('Recurso global só pode ser alterado por SUPER_ADMIN');
      }
      if (found.cooperativaId !== user.cooperativaId) {
        throw new NotFoundException('Recurso não encontrado');
      }
      return true;
    }

    // 11. Caso comum (sem globalOnlySuperAdmin): findFirst com posse
    const found = await delegate.findFirst({
      where: { id, ...wherePosse },
      select: { id: true },
    });
    if (!found) throw new NotFoundException('Recurso não encontrado');

    return true;
  }
}
