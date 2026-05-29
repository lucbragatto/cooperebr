import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  NotFoundException,
  Post,
  Req,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma.service';
import { Roles } from './roles.decorator';
import { PerfilUsuario } from './perfil.enum';
import { AuditLog } from '../audit/audit-log.decorator';
import { isAmbienteReal } from '../common/safety/ambiente';

/**
 * D-novo-BM (29/05/2026) — Controller dev-only pra impersonate sem expor senha.
 *
 * 🚨 BLOQUEADOR REMOÇÃO PRÉ-PRODUÇÃO 🚨
 *
 * Quando o primeiro parceiro real entrar em produção:
 *   1. Setar `AMBIENTE_REAL=true` no `.env` de produção (já bloqueia endpoint)
 *   2. DELETAR este arquivo
 *   3. DELETAR `web/app/dashboard/dev/credenciais-teste/page.tsx`
 *   4. Remover item sidebar "Credenciais teste"
 *   5. DELETAR spec correspondente
 *   6. Commit: `chore(security): remove D-novo-BM painel credenciais teste pré-produção`
 *
 * Defesa em camadas:
 *   - Camada 1 (guard runtime): `isAmbienteReal()` em CADA endpoint → 403 em PROD
 *   - Camada 2 (auth): `@Roles(SUPER_ADMIN)` → 403 pra qualquer outro perfil
 *   - Camada 3 (audit): `@AuditLog` registra TODA tentativa de impersonate
 *   - Camada 4 (TTL): JWT impersonado expira em 1h (não 7d default)
 */
@Controller('auth/dev')
export class AuthDevController {
  constructor(
    private readonly authService: AuthService,
    private readonly prisma: PrismaService,
  ) {}

  @Roles(PerfilUsuario.SUPER_ADMIN)
  @Get('usuarios-teste')
  async listarUsuariosTeste() {
    if (isAmbienteReal()) {
      throw new ForbiddenException('Endpoint dev desabilitado em produção.');
    }

    return this.prisma.usuario.findMany({
      where: { ativo: true },
      select: {
        id: true,
        nome: true,
        email: true,
        perfil: true,
        cooperativaId: true,
        cooperativa: { select: { id: true, nome: true } },
      },
      orderBy: [{ perfil: 'asc' }, { email: 'asc' }],
    });
  }

  @Roles(PerfilUsuario.SUPER_ADMIN)
  @AuditLog({
    acao: 'auth.dev.impersonate',
    recurso: 'Usuario',
    recursoIdParam: 'userId',
  })
  @HttpCode(200)
  @Post('impersonate')
  async impersonate(@Body() body: { userId: string }, @Req() req: any) {
    if (isAmbienteReal()) {
      throw new ForbiddenException('Impersonate desabilitado em produção.');
    }

    if (!body?.userId) {
      throw new ForbiddenException('userId obrigatório.');
    }

    const target = await this.prisma.usuario.findUnique({
      where: { id: body.userId },
      select: {
        id: true,
        nome: true,
        email: true,
        perfil: true,
        cpf: true,
        cooperativaId: true,
        administradoraId: true,
        ativo: true,
      },
    });

    if (!target) throw new NotFoundException('Usuário alvo não encontrado.');
    if (!target.ativo) throw new ForbiddenException('Usuário alvo inativo.');

    const token = await this.authService.assinarTokenImpersonate({
      id: target.id,
      email: target.email,
      perfil: target.perfil as PerfilUsuario,
      cooperativaId: target.cooperativaId,
      administradoraId: (target as any).administradoraId ?? null,
      cpf: target.cpf,
    });

    return {
      token,
      usuario: {
        id: target.id,
        nome: target.nome,
        email: target.email,
        perfil: target.perfil,
        cooperativaId: target.cooperativaId,
      },
      expiresIn: '8h', // AN.3.1 — bump pra reduzir fricção operacional

      impersonadoPor: req.user?.email ?? null,
    };
  }
}
