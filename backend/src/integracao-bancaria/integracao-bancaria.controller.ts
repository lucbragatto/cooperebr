import { Controller, Get, Post, Patch, Param, Body, Query, Headers, UnauthorizedException, Logger, Req, BadRequestException, ForbiddenException } from '@nestjs/common';
import { IntegracaoBancariaService } from './integracao-bancaria.service';
import { Roles } from '../auth/roles.decorator';
import { Public } from '../auth/public.decorator';
import { PerfilUsuario } from '../auth/perfil.enum';

const { SUPER_ADMIN, ADMIN, OPERADOR } = PerfilUsuario;

@Controller('integracao-bancaria')
export class IntegracaoBancariaController {
  private readonly logger = new Logger(IntegracaoBancariaController.name);

  constructor(private readonly service: IntegracaoBancariaService) {}

  private validateWebhookToken(token?: string) {
    const expectedToken = process.env.WEBHOOK_BANCO_TOKEN;
    if (!expectedToken) {
      this.logger.error('WEBHOOK_BANCO_TOKEN não configurado — rejeitando webhook');
      throw new UnauthorizedException('Webhook não configurado');
    }
    if (token !== expectedToken) {
      throw new UnauthorizedException('Token de webhook inválido');
    }
  }

  // ── Cobranças ─────────────────────────────────────────────

  @Roles(SUPER_ADMIN, ADMIN, OPERADOR)
  @Post('cobrancas')
  emitirCobranca(
    @Body() body: {
      cooperadoId: string;
      valor: number;
      vencimento: string;
      descricao: string;
      tipo: 'BOLETO' | 'PIX';
      cobrancaId?: string;
      banco?: string;
    },
  ) {
    return this.service.emitirCobranca({
      ...body,
      vencimento: new Date(body.vencimento),
    });
  }

  @Roles(SUPER_ADMIN, ADMIN, OPERADOR)
  @Get('cobrancas')
  listarCobrancas(
    @Query('status') status?: string,
    @Query('cooperadoId') cooperadoId?: string,
    @Query('dataInicio') dataInicio?: string,
    @Query('dataFim') dataFim?: string,
  ) {
    return this.service.listarCobrancas({
      status,
      cooperadoId,
      dataInicio: dataInicio ? new Date(dataInicio) : undefined,
      dataFim: dataFim ? new Date(dataFim) : undefined,
    });
  }

  @Roles(SUPER_ADMIN, ADMIN, OPERADOR)
  @Get('cobrancas/:id')
  findOne(@Param('id') id: string, @Req() req: any) {
    const cooperativaId = req.user?.perfil === SUPER_ADMIN ? null : (req.user?.cooperativaId ?? null);
    return this.service.findOne(id, cooperativaId);
  }

  @Roles(SUPER_ADMIN, ADMIN, OPERADOR)
  @Post('cobrancas/:id/cancelar')
  cancelarCobranca(@Param('id') id: string, @Req() req: any) {
    // D-novo-BR F0.5 CRITICO — boleto irreversível, posse antes
    const cooperativaId = req.user?.perfil === SUPER_ADMIN ? null : (req.user?.cooperativaId ?? null);
    return this.service.cancelarCobranca(id, cooperativaId);
  }

  @Roles(SUPER_ADMIN, ADMIN, OPERADOR)
  @Post('cobrancas/:id/reemitir')
  reemitirCobranca(@Param('id') id: string) {
    return this.service.reemitirCobranca(id);
  }

  // ── Webhooks (públicos — banco envia sem auth JWT) ────────

  @Public()
  @Post('webhook/bb')
  webhookBB(
    @Body() payload: any,
    @Query('token') token?: string,
    @Headers('x-webhook-token') headerToken?: string,
  ) {
    this.validateWebhookToken(token || headerToken);
    this.service.processarWebhookBB(payload);
    return { received: true };
  }

  @Public()
  @Post('webhook/sicoob')
  webhookSicoob(
    @Body() payload: any,
    @Query('token') token?: string,
    @Headers('x-webhook-token') headerToken?: string,
  ) {
    this.validateWebhookToken(token || headerToken);
    this.service.processarWebhookSicoob(payload);
    return { received: true };
  }

  // ── Configuração bancária ─────────────────────────────────

  @Roles(SUPER_ADMIN, ADMIN)
  @Get('config')
  listarConfigs(@Req() req: any) {
    // SUPER_ADMIN vê tudo; ADMIN vê só do próprio tenant
    const cooperativaId = req.user?.perfil === SUPER_ADMIN ? null : (req.user?.cooperativaId ?? null);
    return this.service.listarConfigs(cooperativaId);
  }

  @Roles(SUPER_ADMIN, ADMIN)
  @Post('config')
  criarConfig(
    @Body() body: {
      banco: string;
      ambiente?: string;
      clientId: string;
      clientSecret: string;
      convenio?: string;
      carteira?: string;
      agencia?: string;
      conta?: string;
      digitoConta?: string;
      certificadoPfx?: string;
      certificadoSenha?: string;
      webhookSecret?: string;
      cooperativaId?: string;
    },
    @Req() req: any,
  ) {
    // D-novo-BR F0.5 CRITICO — body-injection bloqueado.
    // ADMIN sempre JWT; SUPER_ADMIN pode override via body.cooperativaId.
    const perfil = req.user?.perfil;
    const jwtCoop = req.user?.cooperativaId;
    let cooperativaId: string;
    if (perfil === SUPER_ADMIN) {
      cooperativaId = body.cooperativaId ?? jwtCoop;
      if (!cooperativaId) throw new BadRequestException('SUPER_ADMIN deve informar cooperativaId');
    } else {
      if (!jwtCoop) throw new ForbiddenException('Usuário sem cooperativaId no token');
      cooperativaId = jwtCoop;
    }
    const { cooperativaId: _ignored, ...rest } = body;
    return this.service.criarConfig(rest, cooperativaId);
  }

  @Roles(SUPER_ADMIN, ADMIN)
  @Patch('config/:id')
  atualizarConfig(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    const cooperativaId = req.user?.perfil === SUPER_ADMIN ? null : (req.user?.cooperativaId ?? null);
    return this.service.atualizarConfig(id, body, cooperativaId);
  }

  // ── Polling manual ────────────────────────────────────────

  @Roles(SUPER_ADMIN, ADMIN)
  @Get('polling/executar')
  executarPolling() {
    this.service.pollingLiquidadas();
    return { message: 'Polling iniciado' };
  }
}
