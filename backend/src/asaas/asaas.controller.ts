import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Req,
  Headers,
  HttpCode,
} from '@nestjs/common';
import { AsaasService } from './asaas.service';
import { Roles } from '../auth/roles.decorator';
import { Public } from '../auth/public.decorator';
import { PerfilUsuario } from '../auth/perfil.enum';

const { SUPER_ADMIN, ADMIN } = PerfilUsuario;

@Controller('asaas')
export class AsaasController {
  constructor(private readonly asaasService: AsaasService) {}

  // ─── Config ──────────────────────────────────────────────

  @Roles(SUPER_ADMIN, ADMIN)
  @Post('config')
  salvarConfig(
    @Req() req: any,
    @Body() body: { apiKey: string; ambiente: string; webhookToken?: string },
  ) {
    const cooperativaId = req.user?.cooperativaId;
    if (!cooperativaId) {
      throw new Error('Cooperativa não identificada');
    }
    return this.asaasService.salvarConfig(cooperativaId, body);
  }

  @Roles(SUPER_ADMIN, ADMIN)
  @Get('config')
  async getConfig(@Req() req: any) {
    const cooperativaId = req.user?.cooperativaId;
    if (!cooperativaId) return null;
    const config = await this.asaasService.getConfigMasked(cooperativaId);
    if (!config) return null;
    return { ...config, apiKeyDefinida: !!config.apiKey };
  }

  @Roles(SUPER_ADMIN, ADMIN)
  @Get('testar-conexao')
  testarConexao(@Req() req: any) {
    return this.asaasService.testarConexao(req.user?.cooperativaId);
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
