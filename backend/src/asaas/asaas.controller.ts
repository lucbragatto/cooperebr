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
import { AsaasService } from './asaas.service';
import { Roles } from '../auth/roles.decorator';
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
    return this.asaasService.cancelarCobranca(asaasId, req.user?.cooperativaId);
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

  @Public()
  @Post('webhook')
  @HttpCode(200)
  processarWebhook(
    @Body() payload: any,
    @Headers('asaas-access-token') headerToken: string,
    @Body('token') bodyToken: string,
  ) {
    const token = headerToken || bodyToken || '';
    return this.asaasService.processarWebhook(payload, token);
  }
}
