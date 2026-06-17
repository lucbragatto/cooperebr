import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Req,
  Query,
  Headers,
  HttpCode,
  BadRequestException,
} from '@nestjs/common';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import { AsaasService } from './asaas.service';
import { Roles } from '../auth/roles.decorator';
import { TenantResource } from '../auth/tenant-resource.decorator';
import { Public } from '../auth/public.decorator';
import { PerfilUsuario } from '../auth/perfil.enum';
import { AuditLog } from '../audit/audit-log.decorator';

const { SUPER_ADMIN, ADMIN } = PerfilUsuario;

@Controller('asaas')
export class AsaasController {
  constructor(private readonly asaasService: AsaasService) {}

  // ─── Config ──────────────────────────────────────────────

  @Roles(SUPER_ADMIN, ADMIN)
  @AuditLog({ acao: 'asaas.config.salvar', recurso: 'AsaasConfig' })
  @Post('config')
  salvarConfig(
    @Req() req: any,
    @Body() body: { apiKey: string; ambiente: string; webhookToken?: string; cooperativaId?: string },
  ) {
    // SUPER_ADMIN não tem cooperativaId no JWT — aceita do body
    const cooperativaId = req.user?.cooperativaId || body.cooperativaId;
    if (!cooperativaId) {
      throw new BadRequestException('Cooperativa não identificada. SUPER_ADMIN: envie cooperativaId no body.');
    }
    return this.asaasService.salvarConfig(cooperativaId, body);
  }

  @Roles(SUPER_ADMIN, ADMIN)
  @Get('config')
  async getConfig(@Req() req: any, @Query('cooperativaId') queryCoopId?: string) {
    // SUPER_ADMIN não tem cooperativaId no JWT — aceita da query
    const cooperativaId = req.user?.cooperativaId || queryCoopId;
    if (!cooperativaId) return null;
    const config = await this.asaasService.getConfigMasked(cooperativaId);
    if (!config) return null;
    return { ...config, apiKeyDefinida: !!config.apiKey };
  }

  @Roles(SUPER_ADMIN, ADMIN)
  @Get('testar-conexao')
  testarConexao(@Req() req: any, @Query('cooperativaId') queryCoopId?: string) {
    const cooperativaId = req.user?.cooperativaId || queryCoopId;
    return this.asaasService.testarConexao(cooperativaId);
  }

  // ─── Cobranças ───────────────────────────────────────────

  @Roles(SUPER_ADMIN, ADMIN)
  @Post('cobrancas')
  emitirCobranca(
    @Req() req: any,
    @Body()
    body: {
      cooperadoId: string;
      valor: number;
      vencimento: string;
      descricao: string;
      formaPagamento: string;
      cobrancaId?: string;
    },
  ) {
    return this.asaasService.emitirCobranca(
      body.cooperadoId,
      req.user?.cooperativaId,
      body,
    );
  }

  // D-novo-BR F1.2 A9 — Guard valida :cooperadoId pertence ao tenant.
  // findMany resultante já fica restrito ao cooperado validado (não há cobranças
  // do cooperado A no tenant B). Defesa em profundidade: service inalterado.
  @TenantResource({ model: 'cooperado', idParam: 'cooperadoId' })
  @Roles(SUPER_ADMIN, ADMIN)
  @Get('cobrancas/:cooperadoId')
  listarCobrancas(@Param('cooperadoId') cooperadoId: string) {
    return this.asaasService.listarCobrancasCooperado(cooperadoId);
  }

  @Roles(SUPER_ADMIN, ADMIN)
  @AuditLog({ acao: 'asaas.cobranca.cancelar', recurso: 'AsaasCobranca', recursoIdParam: 'asaasId' })
  @Post('cobrancas/:asaasId/cancelar')
  cancelarCobranca(
    @Param('asaasId') asaasId: string,
    @Req() req: any,
  ) {
    // D-novo-BR F0.5 — SUPER_ADMIN passa null pra bypass (service descobre tenant)
    const perfil = req.user?.perfil;
    const cooperativaId = perfil === PerfilUsuario.SUPER_ADMIN
      ? null
      : (req.user?.cooperativaId ?? null);
    return this.asaasService.cancelarCobranca(asaasId, cooperativaId);
  }

  @Roles(SUPER_ADMIN, ADMIN)
  @Get('cobrancas/:asaasId/status')
  buscarStatus(
    @Param('asaasId') asaasId: string,
    @Req() req: any,
  ) {
    return this.asaasService.buscarStatusCobranca(asaasId, req.user?.cooperativaId);
  }

  // ─── Assinatura ──────────────────────────────────────────

  @Roles(SUPER_ADMIN, ADMIN)
  @Post('assinaturas')
  criarAssinatura(
    @Req() req: any,
    @Body()
    body: {
      cooperadoId: string;
      valor: number;
      ciclo?: string;
      descricao: string;
    },
  ) {
    return this.asaasService.criarAssinatura(
      body.cooperadoId,
      req.user?.cooperativaId,
      body,
    );
  }

  // ─── Webhook (público — sem JWT) ─────────────────────────

  // Sprint C Hardening (17/06/2026) — tier `webhook` 600/min.
  // SkipThrottle({default:true}) desativa o tier default 100/min
  // (que se aplicaria automaticamente como o mais restritivo).
  // Restam só o tier `webhook` 600/min do forRoot — Asaas pode
  // mandar burst em apuração massa de pagamentos (centenas de
  // eventos quando cobranças em lote são pagas).
  // Auth via `asaas-access-token` header validada dentro do
  // service. 429 absorvido pelo retry+backoff do Asaas +
  // idempotência do processarWebhook (eventId UNIQUE no DB).
  @Public()
  @SkipThrottle({ default: true })
  @Throttle({ webhook: { limit: 600, ttl: 60_000 } })
  @Post('webhook')
  @HttpCode(200)
  processarWebhook(
    @Body() payload: any,
    @Headers('asaas-access-token') headerToken: string,
  ) {
    // P2 review security Sprint C (17/06): token aceito SOMENTE no header
    // `asaas-access-token`. Removido fallback `@Body('token')` — Asaas
    // envia exclusivamente via header; aceitar body abria risco de log
    // de body capturar token + superfície de injeção via parser.
    return this.asaasService.processarWebhook(payload, headerToken ?? '');
  }
}
