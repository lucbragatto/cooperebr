import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  Request,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuditLog } from '../audit/audit-log.decorator';
import { PerfilUsuario } from '../auth/perfil.enum';
import { Roles } from '../auth/roles.decorator';
import { CriarDisclaimerDto } from './disclaimer-saque.dto';
import { DisclaimerSaqueService } from './disclaimer-saque.service';

const { SUPER_ADMIN, ADMIN, COOPERADO } = PerfilUsuario;

/**
 * Sprint D2.1 v2 (16/06/2026) — Endpoints versionados do disclaimer de
 * saque PIX.
 *
 * **Cooperado** (qualquer perfil COOPERADO):
 *   GET /portal/disclaimer-saque  → resolve (tenant override ?? global)
 *
 * **SUPER_ADMIN** — gerencia GLOBAL (cooperativaId=null forçado):
 *   GET  /saas/disclaimer-saque/global/historico
 *   GET  /saas/disclaimer-saque/global/ativo
 *   POST /saas/disclaimer-saque/global  { texto }
 *
 * **ADMIN tenant** — gerencia OVERRIDE do PRÓPRIO tenant (cooperativaId
 * SEMPRE do JWT, NUNCA do body):
 *   GET    /cooperativa/disclaimer-saque/historico
 *   GET    /cooperativa/disclaimer-saque/ativo
 *   POST   /cooperativa/disclaimer-saque  { texto }
 *   DELETE /cooperativa/disclaimer-saque/ativo
 *
 * Multi-tenant CRÍTICO: ADMIN NUNCA edita global; ADMIN NUNCA vê/edita
 * override de outro tenant; SUPER_ADMIN edita só global (no v1).
 * Histórico inviolável (ativo=false NUNCA deletado).
 */
@Controller()
export class DisclaimerSaqueController {
  constructor(private readonly service: DisclaimerSaqueService) {}

  // ─── Cooperado ──────────────────────────────────────────────

  @Roles(COOPERADO, ADMIN, SUPER_ADMIN)
  @Get('portal/disclaimer-saque')
  async getDisclaimerCooperado(@Request() req: any) {
    const cooperativaId = req.user?.cooperativaId;
    if (!cooperativaId) {
      throw new BadRequestException(
        'Cooperativa não identificada no contexto do usuário.',
      );
    }
    const { disclaimer, origem } =
      await this.service.getAtivoComOrigem(cooperativaId);
    return {
      id: disclaimer.id,
      versao: disclaimer.versao,
      texto: disclaimer.texto,
      origem, // 'TENANT' | 'GLOBAL' (UI pode mostrar nota)
    };
  }

  // ─── SUPER_ADMIN — GLOBAL ────────────────────────────────────

  @Roles(SUPER_ADMIN)
  // P1 review security (16/06): leitura SUPER de dados sensíveis também
  // auditada (quem leu o histórico/ativo global e quando).
  @AuditLog({
    acao: 'saas.disclaimer-saque.global.listar-historico',
    recurso: 'DisclaimerSaque',
  })
  @Get('saas/disclaimer-saque/global/historico')
  async listarHistoricoGlobal(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const lista = await this.service.listarHistorico(null, {
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
    return { items: lista, total: lista.length };
  }

  @Roles(SUPER_ADMIN)
  @AuditLog({
    acao: 'saas.disclaimer-saque.global.ler-ativo',
    recurso: 'DisclaimerSaque',
  })
  @Get('saas/disclaimer-saque/global/ativo')
  async getAtivoGlobal() {
    // P1 review financeiro-token + multitenant (16/06): leitor direto do
    // GLOBAL ativo (sem string mágica `___SUPER_ADMIN_GLOBAL_VIEW___`
    // que era frágil e podia colidir com tenant fantasma).
    return this.service.getAtivoGlobal();
  }

  @Roles(SUPER_ADMIN)
  // P1 review security (16/06): rate-limit explícito por endpoint (Throttler
  // global ainda não está em APP_GUARD — débito catalogado D-novo-THROTTLER-
  // APP-GUARD). 10/min de publicação suficiente pra SUPER_ADMIN, evita DoS.
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @AuditLog({
    acao: 'saas.disclaimer-saque.global.criar',
    recurso: 'DisclaimerSaque',
  })
  @HttpCode(201)
  @Post('saas/disclaimer-saque/global')
  async criarGlobal(@Body() body: CriarDisclaimerDto, @Request() req: any) {
    const criadoPorUsuarioId = req.user?.id ?? req.user?.userId;
    if (!criadoPorUsuarioId) {
      throw new BadRequestException('Usuário não identificado.');
    }
    return this.service.criarGlobal({
      texto: body.texto,
      criadoPorUsuarioId,
    });
  }

  // P1 review multitenant (16/06): SUPER_ADMIN inspeciona override de um
  // tenant específico SEM precisar impersonar — `:cooperativaId` vem do
  // path (não do JWT). Necessário pra gestão centralizada do SaaS sem
  // depender de impersonation, que mascarava trilha forense.
  @Roles(SUPER_ADMIN)
  @AuditLog({
    acao: 'saas.disclaimer-saque.tenant.listar-historico',
    recurso: 'DisclaimerSaque',
  })
  @Get('saas/disclaimer-saque/tenant/:cooperativaId/historico')
  async listarHistoricoTenantPeloSuper(
    @Param('cooperativaId') cooperativaId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    if (!cooperativaId) {
      throw new BadRequestException('cooperativaId obrigatório.');
    }
    const lista = await this.service.listarHistorico(cooperativaId, {
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
    return { items: lista, total: lista.length, cooperativaId };
  }

  // ─── ADMIN — OVERRIDE do TENANT ──────────────────────────────

  @Roles(ADMIN, SUPER_ADMIN)
  @Get('cooperativa/disclaimer-saque/historico')
  async listarHistoricoTenant(
    @Request() req: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const cooperativaId = req.user?.cooperativaId;
    if (!cooperativaId) {
      throw new BadRequestException(
        'Cooperativa não identificada no contexto.',
      );
    }
    const lista = await this.service.listarHistorico(cooperativaId, {
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
    return { items: lista, total: lista.length };
  }

  @Roles(ADMIN, SUPER_ADMIN)
  @Get('cooperativa/disclaimer-saque/ativo')
  async getAtivoTenant(@Request() req: any) {
    const cooperativaId = req.user?.cooperativaId;
    if (!cooperativaId) {
      throw new BadRequestException(
        'Cooperativa não identificada no contexto.',
      );
    }
    const { disclaimer, origem } =
      await this.service.getAtivoComOrigem(cooperativaId);
    return { ...disclaimer, origem };
  }

  @Roles(ADMIN, SUPER_ADMIN)
  // P1 review security (16/06): rate-limit explícito por endpoint (vide
  // débito D-novo-THROTTLER-APP-GUARD).
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @AuditLog({
    acao: 'cooperativa.disclaimer-saque.criar',
    recurso: 'DisclaimerSaque',
  })
  @HttpCode(201)
  @Post('cooperativa/disclaimer-saque')
  async criarTenant(@Body() body: CriarDisclaimerDto, @Request() req: any) {
    const cooperativaId = req.user?.cooperativaId;
    const criadoPorUsuarioId = req.user?.id ?? req.user?.userId;
    // P2 review multitenant (16/06): perfil REAL (ADMIN ou SUPER_ADMIN
    // se este impersona um tenant) — passar pro service grava trilha
    // forense correta em vez de hardcoded 'ADMIN' que mascarava SUPER.
    const criadoPorPerfil = req.user?.perfil ?? 'ADMIN';
    if (!cooperativaId) {
      throw new BadRequestException(
        'Cooperativa não identificada (ADMIN nunca edita global).',
      );
    }
    if (!criadoPorUsuarioId) {
      throw new BadRequestException('Usuário não identificado.');
    }
    return this.service.criarTenantOverride({
      cooperativaId,
      texto: body.texto,
      criadoPorUsuarioId,
      criadoPorPerfil,
    });
  }

  @Roles(ADMIN, SUPER_ADMIN)
  @AuditLog({
    acao: 'cooperativa.disclaimer-saque.desativar',
    recurso: 'DisclaimerSaque',
  })
  @HttpCode(200)
  @Delete('cooperativa/disclaimer-saque/ativo')
  async desativarTenant(@Request() req: any) {
    const cooperativaId = req.user?.cooperativaId;
    const desativadoPorUsuarioId = req.user?.id ?? req.user?.userId;
    if (!cooperativaId) {
      throw new BadRequestException('Cooperativa não identificada.');
    }
    if (!desativadoPorUsuarioId) {
      throw new BadRequestException('Usuário não identificado.');
    }
    return this.service.desativarOverrideTenant({
      cooperativaId,
      desativadoPorUsuarioId,
    });
  }
}
