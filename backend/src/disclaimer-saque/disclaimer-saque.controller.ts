import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Post,
  Request,
} from '@nestjs/common';
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
  @Get('saas/disclaimer-saque/global/historico')
  async listarHistoricoGlobal() {
    const lista = await this.service.listarHistorico(null);
    return { items: lista, total: lista.length };
  }

  @Roles(SUPER_ADMIN)
  @Get('saas/disclaimer-saque/global/ativo')
  async getAtivoGlobal() {
    // Resolução com cooperativaId fake (string vazia não tem override
    // → cai pro global). Mas pra ser explícito, busca direto.
    const { disclaimer } = await this.service.getAtivoComOrigem(
      '___SUPER_ADMIN_GLOBAL_VIEW___', // qualquer string sem override existente
    );
    return disclaimer;
  }

  @Roles(SUPER_ADMIN)
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

  // ─── ADMIN — OVERRIDE do TENANT ──────────────────────────────

  @Roles(ADMIN, SUPER_ADMIN)
  @Get('cooperativa/disclaimer-saque/historico')
  async listarHistoricoTenant(@Request() req: any) {
    const cooperativaId = req.user?.cooperativaId;
    if (!cooperativaId) {
      throw new BadRequestException(
        'Cooperativa não identificada no contexto.',
      );
    }
    const lista = await this.service.listarHistorico(cooperativaId);
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
  @AuditLog({
    acao: 'cooperativa.disclaimer-saque.criar',
    recurso: 'DisclaimerSaque',
  })
  @HttpCode(201)
  @Post('cooperativa/disclaimer-saque')
  async criarTenant(@Body() body: CriarDisclaimerDto, @Request() req: any) {
    const cooperativaId = req.user?.cooperativaId;
    const criadoPorUsuarioId = req.user?.id ?? req.user?.userId;
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
