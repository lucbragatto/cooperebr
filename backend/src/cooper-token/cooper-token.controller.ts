import {
  Controller,
  Get,
  Put,
  Post,
  Body,
  Query,
  Req,
  Param,
  BadRequestException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuditLog } from '../audit/audit-log.decorator';
import { CooperTokenService } from './cooper-token.service';
import { CooperTokenJob } from './cooper-token.job';
import { Roles } from '../auth/roles.decorator';
import { PerfilUsuario } from '../auth/perfil.enum';
import { CooperTokenTipo } from '@prisma/client';
// Sprint Clube P1 — Fase 1.5 Bloco 4 (10/06/2026): DTO formal com validators.
import { UpsertCooperTokenConfigDto } from './dto/upsert-cooper-token-config.dto';
// Sprint Clube P1 — Fase 2 Bloco 2 (11/06/2026): cooperado-PJ compra tokens.
import { ComprarTokensCooperadoDto } from './dto/comprar-tokens-cooperado.dto';
// Sprint Clube P1 — F4 Bloco A (12/06/2026): DTO formal com PIN obrigatório.
import { UsarNaFaturaDto } from './dto/usar-na-fatura.dto';
// Sprint Clube P1 — F4 Bloco C (12/06/2026): DTOs com PIN/OTP.
import { ProcessarPagamentoQrDto } from './dto/processar-pagamento-qr.dto';
import { EnviarTokensDto } from './dto/enviar-tokens.dto';
// Sprint Clube P1 — F3 Bloco B (12/06/2026): empresa-PJ distribui lote.
import { DistribuirTokensDto } from './dto/distribuir-tokens.dto';
// Sprint Clube P1 — F6 Bloco B (12/06/2026): estabelecimento resgata em PIX.
import { RecusarResgateDto, SolicitarResgateDto } from './dto/solicitar-resgate.dto';

const { SUPER_ADMIN, ADMIN, OPERADOR, COOPERADO, AGREGADOR } = PerfilUsuario;

@Controller('cooper-token')
export class CooperTokenController {
  constructor(
    private readonly cooperTokenService: CooperTokenService,
    private readonly cooperTokenJob: CooperTokenJob,
  ) {}

  @Roles(COOPERADO, ADMIN, SUPER_ADMIN, OPERADOR)
  @Get('saldo')
  async getSaldo(@Req() req: any) {
    const cooperadoId = req.user?.cooperadoId;
    if (!cooperadoId) {
      throw new BadRequestException('Cooperado não identificado');
    }
    return this.cooperTokenService.getSaldo(cooperadoId);
  }

  @Roles(COOPERADO, ADMIN, SUPER_ADMIN, OPERADOR)
  @Get('extrato')
  async getExtrato(
    @Req() req: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const cooperadoId = req.user?.cooperadoId;
    if (!cooperadoId) {
      throw new BadRequestException('Cooperado não identificado');
    }
    return this.cooperTokenService.getExtrato(
      cooperadoId,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
  }

  @Roles(ADMIN, SUPER_ADMIN)
  @Get('admin/consolidado')
  async getConsolidado(
    @Req() req: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const cooperativaId = req.user?.cooperativaId;
    if (!cooperativaId && req.user?.perfil !== SUPER_ADMIN) {
      throw new BadRequestException('Cooperativa não identificada');
    }
    return this.cooperTokenService.getConsolidado(
      cooperativaId,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 50,
    );
  }

  @Roles(ADMIN, SUPER_ADMIN)
  @Post('admin/creditar-manual')
  async creditarManual(
    @Req() req: any,
    @Body()
    body: {
      cooperadoId: string;
      quantidade: number;
      descricao?: string;
      tipo?: string;
    },
  ) {
    let cooperativaId = req.user?.cooperativaId;
    if (!cooperativaId && req.user?.perfil !== SUPER_ADMIN) {
      throw new BadRequestException('Cooperativa não identificada');
    }
    if (!body.cooperadoId || !body.quantidade || body.quantidade <= 0) {
      throw new BadRequestException(
        'cooperadoId e quantidade (> 0) são obrigatórios',
      );
    }

    // Validar tipo se fornecido
    const tiposPermitidos: string[] = [
      CooperTokenTipo.GERACAO_EXCEDENTE,
      CooperTokenTipo.BONUS_INDICACAO,
      CooperTokenTipo.SOCIAL,
    ];
    const tipoFinal = body.tipo && tiposPermitidos.includes(body.tipo)
      ? (body.tipo as CooperTokenTipo)
      : CooperTokenTipo.GERACAO_EXCEDENTE;

    // SUPER_ADMIN não tem cooperativaId no JWT — busca pelo cooperado alvo
    if (!cooperativaId) {
      const coop = await this.cooperTokenService.getCooperativaIdByCooperado(body.cooperadoId);
      if (!coop) {
        throw new BadRequestException('Cooperado não encontrado ou sem cooperativa associada');
      }
      cooperativaId = coop;
    }

    const result = await this.cooperTokenService.creditar({
      cooperadoId: body.cooperadoId,
      cooperativaId,
      tipo: tipoFinal,
      quantidade: body.quantidade,
      descricao: body.descricao,
    } as any);

    if (!result) {
      throw new BadRequestException(
        'Cooperado não está ATIVO — ative o cooperado antes de creditar tokens',
      );
    }

    return result;
  }

  // ════════════════════════════════════════════════════════════════════
  //  M39 (16/06/2026) — Emissão Admin em Lote (4 endpoints)
  // ════════════════════════════════════════════════════════════════════
  //
  // Substitui `POST /cooper-token/parceiro/enviar` single-target quando
  // chamado por admin (sem cooperadoId no JWT). enviarTokensAdmin é
  // @deprecated APÓS Bloco 5 redirecionar o frontend.
  //
  // 4 endpoints:
  //   POST   /cooper-token/admin/emitir-lote                — PREVIEW/CONFIRM
  //   POST   /cooper-token/admin/emitir-lote/:loteId/estornar — Estorno
  //   GET    /cooper-token/admin/lotes-emitidos             — Lista paginada
  //   GET    /cooper-token/admin/lotes-emitidos/:loteId     — Detalhe (UI confirmação)
  //
  // Multi-tenant: cooperativaId + usuarioId do JWT (anti-IDOR). Servidor
  // revalida cada cooperadoId.cooperativaId do lote (no service).
  // ════════════════════════════════════════════════════════════════════

  @Roles(ADMIN, SUPER_ADMIN, OPERADOR)
  @Post('admin/emitir-lote')
  async emitirLoteAdmin(
    @Req() req: any,
    @Body() body: {
      distribuicoes: Array<{ destinatarioCooperadoId: string; quantidade: number }>;
      descricao?: string;
      otpDesafioId?: string;
      otpCodigo?: string;
      clientRequestId: string;
      modo: 'PREVIEW' | 'CONFIRM';
    },
  ) {
    const cooperativaId = req.user?.cooperativaId;
    const usuarioId = req.user?.sub ?? req.user?.id;
    if (!cooperativaId) {
      throw new BadRequestException(
        'Cooperativa não identificada. SUPER_ADMIN puro deve impersonar uma cooperativa.',
      );
    }
    if (!usuarioId) {
      throw new BadRequestException('Usuário não identificado no JWT.');
    }
    if (!body.clientRequestId) {
      throw new BadRequestException(
        'clientRequestId obrigatório (UUID v4 recomendado). Garante idempotência: retry do mesmo lote não emite 2×.',
      );
    }
    if (!body.modo || !['PREVIEW', 'CONFIRM'].includes(body.modo)) {
      throw new BadRequestException('modo obrigatório: PREVIEW ou CONFIRM.');
    }
    return this.cooperTokenService.emitirLoteAdmin({
      cooperativaId,
      usuarioId,
      // P2 reviewer multitenant 16/06: AuditLog precisa do perfil REAL
      // do caller (ADMIN/SUPER_ADMIN/OPERADOR), não o default 'COOPERADO'
      // do helper. Sem isso, rastreabilidade de auditoria em operação de
      // emissão de dinheiro fica errada.
      usuarioPerfil: req.user?.perfil,
      distribuicoes: body.distribuicoes,
      descricao: body.descricao,
      otpDesafioId: body.otpDesafioId,
      otpCodigo: body.otpCodigo,
      clientRequestId: body.clientRequestId,
      modo: body.modo,
      ip: req.ip ?? req.headers?.['x-forwarded-for'] ?? null,
      userAgent: req.headers?.['user-agent'] ?? null,
    });
  }

  @Roles(ADMIN, SUPER_ADMIN, OPERADOR)
  @Post('admin/emitir-lote/:loteId/estornar')
  async estornarEmissaoLote(
    @Req() req: any,
    @Param('loteId') loteId: string,
    @Body() body: { motivo: string; confirmado: boolean },
  ) {
    const cooperativaId = req.user?.cooperativaId;
    const usuarioId = req.user?.sub ?? req.user?.id;
    if (!cooperativaId) {
      throw new BadRequestException('Cooperativa não identificada.');
    }
    if (!usuarioId) {
      throw new BadRequestException('Usuário não identificado no JWT.');
    }
    return this.cooperTokenService.estornarEmissaoLote({
      cooperativaId,
      loteId,
      usuarioId,
      motivo: body.motivo,
      confirmado: body.confirmado === true,
    });
  }

  @Roles(ADMIN, SUPER_ADMIN, OPERADOR)
  @Get('admin/lotes-emitidos')
  async listarLotesEmitidos(
    @Req() req: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const cooperativaId = req.user?.cooperativaId;
    if (!cooperativaId) {
      throw new BadRequestException('Cooperativa não identificada.');
    }
    return this.cooperTokenService.listarLotesEmitidos({
      cooperativaId,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
    });
  }

  @Roles(ADMIN, SUPER_ADMIN, OPERADOR)
  @Get('admin/lotes-emitidos/:loteId')
  async getLoteEmitido(@Req() req: any, @Param('loteId') loteId: string) {
    const cooperativaId = req.user?.cooperativaId;
    if (!cooperativaId) {
      throw new BadRequestException('Cooperativa não identificada.');
    }
    return this.cooperTokenService.getLoteEmitido({ cooperativaId, loteId });
  }

  @Roles(ADMIN, SUPER_ADMIN)
  @Get('admin/ledger')
  async getLedger(
    @Req() req: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const cooperativaId = req.user?.cooperativaId;
    if (!cooperativaId && req.user?.perfil !== SUPER_ADMIN) {
      throw new BadRequestException('Cooperativa não identificada');
    }
    return this.cooperTokenService.getLedger(
      cooperativaId,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 50,
    );
  }

  @Roles(ADMIN, SUPER_ADMIN)
  @Get('admin/resumo')
  async getResumo(@Req() req: any) {
    const cooperativaId = req.user?.cooperativaId;
    if (!cooperativaId && req.user?.perfil !== SUPER_ADMIN) {
      throw new BadRequestException('Cooperativa não identificada');
    }
    return this.cooperTokenService.getResumoAdmin(cooperativaId);
  }

  @Roles(ADMIN, SUPER_ADMIN)
  @Get('admin/financeiro')
  async getFinanceiro(
    @Req() req: any,
    @Query('periodo') periodo?: string,
    @Query('ano') ano?: string,
    @Query('mes') mes?: string,
  ) {
    const cooperativaId = req.user?.cooperativaId;
    if (!cooperativaId && req.user?.perfil !== SUPER_ADMIN) {
      throw new BadRequestException('Cooperativa não identificada');
    }
    return this.cooperTokenService.getFinanceiro(
      cooperativaId,
      periodo,
      ano ? parseInt(ano, 10) : undefined,
      mes ? parseInt(mes, 10) : undefined,
    );
  }

  // Sprint M52a Bloco E (23/06/2026) — D-novo-FAXINA-PASSIVO-VISIBILIDADE.
  // Decomposição do passivo 2.3.01 (face × valorToken) + forecast de
  // expiração (30/60/90/365 dias) + top 10 cooperados em concentração.
  // Cooperativa do JWT (SUPER_ADMIN sem cooperativaId → cross-tenant).
  @Roles(ADMIN, SUPER_ADMIN)
  @Get('admin/passivo-detalhado')
  async getPassivoDetalhado(@Req() req: any) {
    const cooperativaId = req.user?.cooperativaId;
    if (!cooperativaId && req.user?.perfil !== SUPER_ADMIN) {
      throw new BadRequestException('Cooperativa não identificada');
    }
    return this.cooperTokenService.getPassivoDetalhado(cooperativaId);
  }

  @Roles(ADMIN, SUPER_ADMIN)
  @Get('admin/fluxo-caixa')
  async getFluxoCaixa(@Req() req: any) {
    const cooperativaId = req.user?.cooperativaId;
    if (!cooperativaId && req.user?.perfil !== SUPER_ADMIN) {
      throw new BadRequestException('Cooperativa não identificada');
    }
    return this.cooperTokenService.getFluxoCaixa(cooperativaId);
  }

  @Roles(ADMIN, SUPER_ADMIN)
  @Get('admin/rendimento-cooperados')
  async getRendimentoCooperados(
    @Req() req: any,
    @Query('limit') limit?: string,
  ) {
    const cooperativaId = req.user?.cooperativaId;
    if (!cooperativaId && req.user?.perfil !== SUPER_ADMIN) {
      throw new BadRequestException('Cooperativa não identificada');
    }
    return this.cooperTokenService.getRendimentoCooperados(
      cooperativaId,
      limit ? parseInt(limit, 10) : 10,
    );
  }

  @Roles(ADMIN, SUPER_ADMIN)
  @Post('admin/processar')
  async processar(@Req() req: any) {
    const cooperativaId = req.user?.cooperativaId;
    if (!cooperativaId && req.user?.perfil !== SUPER_ADMIN) {
      throw new BadRequestException('Cooperativa não identificada');
    }
    await this.cooperTokenJob.apurarExcedentes();
    return { message: 'Apuração de excedentes executada com sucesso' };
  }

  // Sprint C Hardening (17/06/2026) — D-novo-RECONCILIACAO-CONTABIL-CRON.
  // Trigger manual do cron de reconciliação. Útil pra:
  //  - Ops: SUPER_ADMIN força reconciliação imediata em emergência sem
  //    esperar o próximo ciclo de 15min.
  //  - Smoke E2E: prova que recibos PAGO_CREDITO_PENDENTE são
  //    re-processados corretamente.
  //
  // SUPER_ADMIN-only (operação cross-tenant pra cura). @AuditLog
  // rastreável. @Throttle agressivo (3/min) pra evitar abuso.
  @Roles(SUPER_ADMIN)
  @AuditLog({
    acao: 'cooper-token.reconciliacao.trigger-manual',
    recurso: 'ResgateRecibo',
  })
  @Throttle({ default: { ttl: 60_000, limit: 3 } })
  @Post('admin/reconciliacao/trigger')
  async triggerReconciliacao() {
    await this.cooperTokenJob.reconciliarContabilPendentes();
    return { message: 'Ciclo de reconciliação contábil disparado.' };
  }

  // Sprint M52a Bloco D (23/06/2026) — D-novo-FAXINA-DELTA-COOPEREBR.
  // Trigger admin pro cron diário 04:30 reconciliarInvariantesSaldo.
  // Ancorado em saldoDisponivel (decisão orquestrador 23/06).
  // SUPER_ADMIN-only — operação cross-tenant. Retorna síncrono pro painel.
  @Roles(SUPER_ADMIN)
  @AuditLog({
    acao: 'cooper-token.invariante.trigger-manual',
    recurso: 'CooperTokenLedger',
  })
  @Throttle({ default: { ttl: 60_000, limit: 3 } })
  @Post('admin/reconciliacao/invariantes-trigger')
  async triggerInvariantes() {
    const resumo = await this.cooperTokenJob.reconciliarInvariantesSaldo();
    return {
      message: 'Varredura de invariantes saldo × ledger concluída.',
      resumo,
    };
  }

  @Roles(COOPERADO, ADMIN, SUPER_ADMIN, OPERADOR)
  @Post('gerar-qr-pagamento')
  async gerarQrPagamento(
    @Req() req: any,
    @Body() body: { quantidade: number },
  ) {
    const cooperadoId = req.user?.cooperadoId;
    const cooperativaId = req.user?.cooperativaId;
    if (!cooperadoId) {
      throw new BadRequestException('Cooperado não identificado');
    }
    if (!cooperativaId) {
      throw new BadRequestException('Cooperativa não identificada');
    }
    if (!body.quantidade || body.quantidade <= 0) {
      throw new BadRequestException('Quantidade deve ser maior que zero');
    }

    return this.cooperTokenService.gerarQrPagamento({
      pagadorId: cooperadoId,
      cooperativaId,
      quantidade: body.quantidade,
    });
  }

  /**
   * F4 Bloco C (12/06/2026) — body migrado pra DTO com PIN obrigatório do
   * pagador. PIN validado contra `decoded.pagadorId` (extraído do QR JWT)
   * dentro do service.
   */
  @Roles(COOPERADO, ADMIN, SUPER_ADMIN, OPERADOR)
  @Post('processar-pagamento-qr')
  async processarPagamentoQr(
    @Req() req: any,
    @Body() body: ProcessarPagamentoQrDto,
  ) {
    const cooperadoId = req.user?.cooperadoId;
    const cooperativaId = req.user?.cooperativaId;
    if (!cooperadoId) {
      throw new BadRequestException('Cooperado não identificado');
    }
    if (!cooperativaId) {
      throw new BadRequestException('Cooperativa não identificada');
    }
    return this.cooperTokenService.processarPagamentoQr({
      qrToken: body.qrToken,
      recebedorId: cooperadoId,
      recebedorCooperativaId: cooperativaId,
      pin: body.pin,
    });
  }

  // ── Cooperado: Usar tokens na fatura ──

  /**
   * F4 Bloco A (12/06/2026) — body migrado pra DTO formal com PIN obrigatório
   * (6 dígitos numéricos) + class-validator. Substitui body inline antigo.
   * cooperadoId e cooperativaId sempre do JWT (anti-IDOR).
   *
   * M49 Fatia D (22/06/2026) — opcional `titularCooperadoId` no body abre o
   * caminho FAMILIAR (saldo/PIN/limite da PAGADORA=JWT abatem fatura do
   * TITULAR). Service valida AutorizacaoTokenFamiliar ativa entre os 2.
   * cooperadoId e cooperativaId continuam do JWT (lição M45 inegociável).
   */
  @Roles(COOPERADO, ADMIN, SUPER_ADMIN, OPERADOR)
  @Post('usar-na-fatura')
  async usarNaFatura(@Req() req: any, @Body() body: UsarNaFaturaDto) {
    const cooperadoId = req.user?.cooperadoId;
    const cooperativaId = req.user?.cooperativaId;
    if (!cooperadoId) {
      throw new BadRequestException('Cooperado não identificado');
    }
    if (!cooperativaId) {
      throw new BadRequestException('Cooperativa não identificada');
    }
    return this.cooperTokenService.usarNaFatura({
      cooperadoId,
      cooperativaId,
      cobrancaId: body.cobrancaId,
      quantidadeTokens: body.quantidadeTokens,
      pin: body.pin,
      titularCooperadoId: body.titularCooperadoId,
    });
  }

  // ── Cooperado: Listar cobranças pendentes para abatimento ──

  @Roles(COOPERADO, ADMIN, SUPER_ADMIN, OPERADOR)
  @Get('cobrancas-pendentes')
  async getCobrancasPendentes(@Req() req: any) {
    const cooperadoId = req.user?.cooperadoId;
    const cooperativaId = req.user?.cooperativaId;
    if (!cooperadoId) {
      throw new BadRequestException('Cooperado não identificado');
    }
    if (!cooperativaId) {
      throw new BadRequestException('Cooperativa não identificada');
    }
    return this.cooperTokenService.getCobrancasPendentesCooperado(cooperadoId, cooperativaId);
  }

  // ── Config CooperToken por Parceiro ──

  @Roles(ADMIN, SUPER_ADMIN)
  @Get('admin/config')
  async getConfig(@Req() req: any) {
    const cooperativaId = req.user?.cooperativaId;
    if (!cooperativaId && req.user?.perfil !== SUPER_ADMIN) {
      throw new BadRequestException('Cooperativa não identificada');
    }
    return (await this.cooperTokenService.getConfig(cooperativaId)) ?? {};
  }

  @Roles(ADMIN, SUPER_ADMIN)
  @Put('admin/config')
  async upsertConfig(
    @Req() req: any,
    @Body() body: UpsertCooperTokenConfigDto,
  ) {
    // F1.5 MT P2 (10/06/2026) — `cooperativaId` SEMPRE do JWT, NUNCA
    // undefined (antes SUPER_ADMIN sem cooperativaId passava undefined ao
    // Prisma → `where: { cooperativaId: undefined }` poderia bater em
    // qualquer linha. Multi-tenant inegociavel: 400 se contexto ausente.).
    const cooperativaId = req.user?.cooperativaId;
    if (!cooperativaId) {
      throw new BadRequestException(
        'cooperativaId obrigatorio no contexto do usuario. SUPER_ADMIN precisa estar impersonando uma cooperativa pra editar a config.',
      );
    }
    return this.cooperTokenService.upsertConfig(cooperativaId, body);
  }

  @Roles(SUPER_ADMIN)
  @Get('superadmin/config-defaults')
  async getConfigDefaults() {
    // Defaults globais — retorna valores padrão do sistema (espelham os
    // @default do schema Prisma em ConfigCooperToken).
    return {
      // Geral
      modoGeracao: 'AMBOS',
      modeloVida: 'AMBOS',
      limiteTokenMensal: null,
      valorTokenReais: 0.45,
      descontoMaxPerc: 30,
      bonusIndicacao: 50,
      tetoCoop: null,
      ativo: true,
      // F1.5 Bloco 2 — Taxa de Operacao (defaults preservam 2%/1% antigos)
      taxaEmissaoPerc: 2,
      taxaEmissaoFixa: 0,
      taxaQrPerc: 1,
      taxaQrFixa: 0,
      taxaTransferenciaPerc: 0,
      taxaTransferenciaFixa: 0,
      taxaResgatePerc: 0,
      taxaResgateFixa: 0,
      // F1.5 Bloco 3 — Oxidacao DECAY_CONTINUO (default desligada)
      oxidacaoPercMes: 0,
      oxidacaoPeriodoGracaDias: 0,
      oxidacaoPiso: 0,
      oxidacaoAtivadaEm: null,
    };
  }

  @Roles(SUPER_ADMIN)
  @Put('superadmin/config-defaults')
  async updateConfigDefaults() {
    // SEC-NEW-001: Endpoint ainda não implementado — retornar 501 em vez de 200 enganoso
    throw new HttpException('Funcionalidade ainda nao implementada', HttpStatus.NOT_IMPLEMENTED);
  }

  // ── Parceiro: Saldo de tokens recebidos ──

  @Roles(ADMIN, SUPER_ADMIN, OPERADOR, AGREGADOR)
  @Get('parceiro/saldo')
  async getSaldoParceiro(@Req() req: any) {
    const cooperativaId = req.user?.cooperativaId;
    if (!cooperativaId) {
      throw new BadRequestException('Cooperativa não identificada');
    }
    return this.cooperTokenService.getSaldoParceiro(cooperativaId);
  }

  @Roles(ADMIN, SUPER_ADMIN, OPERADOR, AGREGADOR)
  @Get('parceiro/extrato')
  async getExtratoParceiro(
    @Req() req: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const cooperativaId = req.user?.cooperativaId;
    if (!cooperativaId) {
      throw new BadRequestException('Cooperativa não identificada');
    }
    return this.cooperTokenService.getExtratoParceiro(
      cooperativaId,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 50,
    );
  }

  // ── Cooperado-PJ: Comprar tokens ──
  // Sprint Clube P1 — Fase 2 Bloco 2 (11/06/2026). Empresa cooperada PJ
  // compra tokens creditando no proprio CooperTokenSaldo. cooperadoId
  // SEMPRE do JWT (anti-IDOR). Guard ROLE COOPERADO + service valida
  // isEmpresaCooperada + status ATIVO/ATIVO_RECEBENDO_CREDITOS.

  @Roles(COOPERADO)
  @Post('cooperado/comprar')
  async comprarTokensCooperado(
    @Req() req: any,
    @Body() body: ComprarTokensCooperadoDto,
  ) {
    const compradorCooperadoId = req.user?.cooperadoId;
    const cooperativaId = req.user?.cooperativaId;
    if (!compradorCooperadoId) {
      throw new BadRequestException('Cooperado nao identificado no contexto.');
    }
    if (!cooperativaId) {
      throw new BadRequestException('Cooperativa nao identificada no contexto.');
    }
    return this.cooperTokenService.comprarTokensCooperado({
      compradorCooperadoId,
      cooperativaId,
      quantidade: body.quantidade,
      formaPagamento: body.formaPagamento,
      // Sprint Convênio-Token-Cooperado (20/06/2026) — opcional. Service
      // valida cross-tenant (cooperativaId == convenio.cooperativaId).
      convenioId: body.convenioId,
    });
  }

  // ── Parceiro: Comprar tokens ──

  @Roles(ADMIN, SUPER_ADMIN, OPERADOR, AGREGADOR)
  @Post('parceiro/comprar')
  async comprarTokens(
    @Req() req: any,
    @Body() body: { quantidade: number; formaPagamento: 'PIX' | 'BOLETO' },
  ) {
    const cooperativaId = req.user?.cooperativaId;
    if (!cooperativaId) {
      throw new BadRequestException('Cooperativa não identificada');
    }
    if (!body.quantidade || body.quantidade <= 0) {
      throw new BadRequestException('Quantidade deve ser maior que zero');
    }
    if (!['PIX', 'BOLETO'].includes(body.formaPagamento)) {
      throw new BadRequestException('formaPagamento deve ser PIX ou BOLETO');
    }
    return this.cooperTokenService.comprarTokensParceiro({
      cooperativaId,
      quantidade: body.quantidade,
      formaPagamento: body.formaPagamento,
    });
  }

  @Roles(ADMIN, SUPER_ADMIN)
  @Post('admin/confirmar-compra')
  async confirmarCompra(
    @Req() req: any,
    @Body() body: { compraId: string },
  ) {
    if (!body.compraId) {
      throw new BadRequestException('compraId é obrigatório');
    }
    // D-novo-BQ.2 A6 (30/05/2026) — passa cooperativaId do JWT
    // (null = SUPER_ADMIN bypass; ADMIN só confirma compras do próprio tenant)
    return this.cooperTokenService.confirmarCompraParceiro(
      body.compraId,
      req.user?.cooperativaId ?? null,
    );
  }

  @Roles(ADMIN, SUPER_ADMIN, OPERADOR, AGREGADOR)
  @Post('parceiro/usar-energia')
  async usarTokensEnergia(
    @Req() req: any,
    @Body() body: { quantidade: number; descricao?: string },
  ) {
    const cooperativaId = req.user?.cooperativaId;
    if (!cooperativaId) {
      throw new BadRequestException('Cooperativa não identificada');
    }
    if (!body.quantidade || body.quantidade <= 0) {
      throw new BadRequestException('Quantidade deve ser maior que zero');
    }
    return this.cooperTokenService.usarTokensEnergia({
      cooperativaId,
      quantidade: body.quantidade,
      descricao: body.descricao,
    });
  }

  @Roles(ADMIN, SUPER_ADMIN, OPERADOR, AGREGADOR)
  @Post('parceiro/transferir')
  async transferirTokensParceiro(
    @Req() req: any,
    @Body() body: { destinatarioCooperativaId: string; quantidade: number; descricao?: string },
  ) {
    const cooperativaId = req.user?.cooperativaId;
    if (!cooperativaId) {
      throw new BadRequestException('Cooperativa não identificada');
    }
    if (!body.destinatarioCooperativaId || !body.quantidade || body.quantidade <= 0) {
      throw new BadRequestException('destinatarioCooperativaId e quantidade (> 0) são obrigatórios');
    }
    return this.cooperTokenService.transferirTokensParceiro({
      remetenteCooperativaId: cooperativaId,
      destinatarioCooperativaId: body.destinatarioCooperativaId,
      quantidade: body.quantidade,
      descricao: body.descricao,
    });
  }

  @Roles(ADMIN, SUPER_ADMIN, OPERADOR, AGREGADOR)
  @Post('admin/processar-qr-parceiro')
  async processarQrParceiro(
    @Req() req: any,
    @Body() body: { qrToken: string },
  ) {
    const cooperativaId = req.user?.cooperativaId;
    const cooperadoId = req.user?.cooperadoId;
    if (!cooperativaId) {
      throw new BadRequestException('Cooperativa não identificada');
    }
    if (!cooperadoId) {
      throw new BadRequestException('Cooperado recebedor não identificado');
    }
    if (!body.qrToken) {
      throw new BadRequestException('Token QR é obrigatório');
    }
    return this.cooperTokenService.processarQrParceiro({
      qrToken: body.qrToken,
      parceiroCooperativaId: cooperativaId,
      recebedorId: cooperadoId,
    });
  }

  @Roles(SUPER_ADMIN)
  @Get('admin/parceiros/saldos')
  async listarSaldosParceiros() {
    return this.cooperTokenService.listarSaldosParceiros();
  }

  // ── Enviar Tokens (parceiro → cooperado) ──

  /**
   * F4 Bloco C (12/06/2026) — bifurca em 2 caminhos:
   *
   *   COOPERADO→COOPERADO (remetenteCooperadoId presente):
   *     - PIN obrigatório (validado contra Cooperado.pinHash do remetente)
   *     - taxa F1.5 transferencia + jti via criarTokenTransacao
   *     - tx Serializable
   *
   *   ADMIN crédito direto (req.user.cooperadoId ausente):
   *     - tier BAIXO (≤R$50): segue sem OTP
   *     - tier ALTO (>R$50): exige otpDesafioId + otpCodigo no body
   *       (criar via /cooper-token/otp-step-up — endpoint stub deste bloco)
   */
  @Roles(ADMIN, SUPER_ADMIN, OPERADOR, AGREGADOR)
  @Post('parceiro/enviar')
  async enviarTokens(@Req() req: any, @Body() body: EnviarTokensDto) {
    // M39 (16/06/2026): o RAMO admin deste endpoint chama
    // enviarTokensAdmin (@deprecated). UI já redirecionada pro novo
    // POST /cooper-token/admin/emitir-lote (Bloco 5 M39). Endpoint
    // mantido por COMPAT do caminho cooperado→cooperado (com PIN) e
    // de eventuais callers externos legados. Avaliar remoção do ramo
    // admin quando logs ENVIO_ADMIN ficarem 30 dias sem nova entry.
    const cooperativaId = req.user?.cooperativaId;
    const remetenteCooperadoId = req.user?.cooperadoId;
    const perfil = req.user?.perfil;

    if (!cooperativaId && perfil !== SUPER_ADMIN) {
      throw new BadRequestException('Cooperativa não identificada');
    }

    // ADMIN/OPERADOR/SUPER_ADMIN/AGREGADOR crédito direto (sem cooperadoId próprio).
    if ([ADMIN, SUPER_ADMIN, OPERADOR, AGREGADOR].includes(perfil) && !remetenteCooperadoId) {
      // F4 Bloco C.1 FIN-4 — clientRequestId obrigatório no caminho admin.
      if (!body.clientRequestId) {
        throw new BadRequestException(
          'clientRequestId obrigatório no caminho admin (mínimo 8 chars; recomendado UUID v4). Gere no cliente e envie no body pra evitar duplo-clique creditar 2×.',
        );
      }
      return this.cooperTokenService.enviarTokensAdmin({
        destinatarioCooperadoId: body.cooperadoId,
        cooperativaId,
        quantidade: body.quantidade,
        descricao: body.descricao,
        otpDesafioId: body.otpDesafioId,
        otpCodigo: body.otpCodigo,
        clientRequestId: body.clientRequestId,
      });
    }

    // AGREGADOR ou ADMIN que também é cooperado: transferência com débito.
    if (!remetenteCooperadoId) {
      throw new BadRequestException('Cooperado remetente não identificado no JWT');
    }
    if (!body.pin) {
      throw new BadRequestException(
        'PIN obrigatório no envio cooperado→cooperado.',
      );
    }

    return this.cooperTokenService.enviarTokens({
      remetenteCooperadoId,
      destinatarioCooperadoId: body.cooperadoId,
      cooperativaId,
      quantidade: body.quantidade,
      descricao: body.descricao,
      pin: body.pin,
    });
  }

  /**
   * F4 Bloco C (12/06/2026) — Endpoint stub pra solicitar desafio OTP de
   * step-up. Usado pelo admin antes de chamar /parceiro/enviar em tier ALTO.
   *
   * MVP:
   *  - Cria desafio via OtpDesafioService (motivo TOKEN_TRANSACAO_STEP_UP)
   *  - Retorna { desafioId, expiresAt }
   *  - Em ambiente NÃO-real (dev/sandbox/teste), retorna o `codigo` no body
   *    pra agilizar smoke E2E (regra contatos de teste — Luciano 14/05).
   *  - Em ambiente real, `codigo` NÃO sai do servidor — entrega via canal
   *    (email/WA do admin) é carry-over Bloco D (TokenNotificacaoService já
   *    tem enviarOtpAltoValor, falta wirar aqui).
   */
  @Roles(ADMIN, SUPER_ADMIN, OPERADOR, AGREGADOR)
  @Post('otp-step-up')
  async solicitarOtpStepUp(
    @Req() req: any,
    @Body() body: { telefoneDestino?: string },
  ) {
    const cooperativaId = req.user?.cooperativaId;
    const usuarioId = req.user?.sub ?? req.user?.userId ?? 'desconhecido';
    if (!cooperativaId) {
      throw new BadRequestException(
        'Cooperativa não identificada — SUPER_ADMIN precisa impersonar tenant.',
      );
    }

    const otp = await this.cooperTokenService.criarDesafioStepUp({
      usuarioId,
      cooperativaId,
      telefoneDestino: body?.telefoneDestino,
    });
    return otp;
  }

  /**
   * Sprint Clube P1 — F3 Bloco B (12/06/2026).
   *
   * Empresa-PJ distribui tokens (LOTE ou INDIVIDUAL, IGUAIS ou DIFERENTES)
   * pra funcionários = MEMBRO_ATIVO do convênio onde ela é conveniada.
   *
   * Multi-tenant: cooperadoId (empresa) e cooperativaId SEMPRE do JWT.
   * Body declara apenas convenioId + destinatários + valores + PIN +
   * natureza/CLT + clientRequestId (idempotência).
   *
   * Modos:
   *  - PREVIEW: dry-run; retorna `{modo:'PREVIEW', preview, podeProsseguir}`.
   *  - CONFIRM: grava em $transaction Serializable; retorna `{modo:'CONFIRM',
   *    preview, resultado, idempotente?}`. Duplo-clique do MESMO
   *    clientRequestId retorna `idempotente:true` + resultado anterior
   *    (cooperTokenLedger.findFirst por referenciaTabela=MASS_WRITE_DISTRIBUICAO).
   */
  @Roles(COOPERADO)
  @Post('empresa/distribuir')
  async distribuirTokens(@Req() req: any, @Body() body: DistribuirTokensDto) {
    const empresaCooperadoId = req.user?.cooperadoId;
    const cooperativaId = req.user?.cooperativaId;
    if (!empresaCooperadoId) {
      throw new BadRequestException('Cooperado (empresa) não identificado no contexto.');
    }
    if (!cooperativaId) {
      throw new BadRequestException('Cooperativa não identificada no contexto.');
    }
    return this.cooperTokenService.distribuirTokens({
      empresaCooperadoId,
      cooperativaId,
      convenioId: body.convenioId,
      clientRequestId: body.clientRequestId,
      pin: body.pin,
      modo: body.modo,
      distribuicoes: body.distribuicoes,
      naturezaDistribuicao: body.naturezaDistribuicao,
      empresaDeclaraTetoClt: body.empresaDeclaraTetoClt,
      descricao: body.descricao,
      valorTokenEsperado: body.valorTokenEsperado,
      ip: req.ip ?? req.headers?.['x-forwarded-for'] ?? null,
      userAgent: req.headers?.['user-agent'] ?? null,
    });
  }

  /**
   * F3 Bloco C (12/06/2026) — Endpoint auxiliar pra UI da distribuição.
   * Empresa-PJ consulta saldo + membros do convênio (segregados por status)
   * num único request, sem precisar bater em 2 controllers.
   *
   * Multi-tenant: cooperadoId+cooperativaId do JWT; valida que a empresa
   * é a conveniada do convênio (mesma regra do POST /distribuir).
   */
  @Roles(COOPERADO)
  @Get('empresa/convenio/:convenioId/membros-disponiveis')
  async listarMembrosDisponiveis(
    @Req() req: any,
    @Param('convenioId') convenioId: string,
  ) {
    const empresaCooperadoId = req.user?.cooperadoId;
    const cooperativaId = req.user?.cooperativaId;
    if (!empresaCooperadoId) {
      throw new BadRequestException('Cooperado (empresa) não identificado no contexto.');
    }
    if (!cooperativaId) {
      throw new BadRequestException('Cooperativa não identificada no contexto.');
    }
    return this.cooperTokenService.listarMembrosDisponiveisPraDistribuicao({
      empresaCooperadoId,
      cooperativaId,
      convenioId,
    });
  }

  // ═══════════════════════════════════════════════════════════════════
  // F6 Bloco B (12/06/2026) — Estabelecimento resgata em R$ via PIX
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Estabelecimento solicita liquidação de voucher (RESGATE em R$ via PIX).
   * Multi-tenant: cooperado e cooperativa SEMPRE do JWT.
   */
  @Roles(COOPERADO)
  // F6 C.4 P1 F6-5 (14/06/2026 — review pesada): rate-limit antes do PIN
  // lockout. Mesmo padrão de /meu-perfil/dados-bancarios — 5/min por IP.
  // Anti-enumeração e defesa contra spam pré-lockout.
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  // P1 review security (16/06): operação financeira mais sensível do
  // sprint — solicitação de saque PIX. AuditLog rastreável no banco.
  @AuditLog({
    acao: 'cooper-token.resgate.solicitar',
    recurso: 'ResgateRecibo',
  })
  @Post('empresa/resgatar')
  async solicitarResgate(@Req() req: any, @Body() body: SolicitarResgateDto) {
    const estabelecimentoCooperadoId = req.user?.cooperadoId;
    const cooperativaId = req.user?.cooperativaId;
    if (!estabelecimentoCooperadoId) {
      throw new BadRequestException('Cooperado (estabelecimento) não identificado no contexto.');
    }
    if (!cooperativaId) {
      throw new BadRequestException('Cooperativa não identificada no contexto.');
    }
    // Sprint D2.1 (16/06/2026) — captura ip + UA pra Salvaguarda 5
    // (aceite forense). Apenas usado pra colaborador comum (service
    // ignora pra estabelecimento via bypass).
    const aceiteIp =
      (req.headers?.['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.socket?.remoteAddress ||
      req.ip ||
      undefined;
    const aceiteUserAgent = req.headers?.['user-agent'] as string | undefined;
    return this.cooperTokenService.solicitarResgate({
      estabelecimentoCooperadoId,
      cooperativaId,
      quantidade: body.quantidade,
      pin: body.pin,
      clientRequestId: body.clientRequestId,
      otpDesafioId: body.otpDesafioId,
      otpCodigo: body.otpCodigo,
      observacao: body.observacao,
      disclaimerAceito: body.disclaimerAceito,
      disclaimerSaqueId: body.disclaimerSaqueId,
      aceiteIp,
      aceiteUserAgent,
    });
  }

  /**
   * F6 Bloco C.1 (13/06/2026) — Estabelecimento lista os PRÓPRIOS resgates.
   * Anti-IDOR estrito: cooperadoId do JWT, NUNCA do query/body.
   */
  @Roles(COOPERADO)
  @Get('empresa/meus-resgates')
  async meusResgates(
    @Req() req: any,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const estabelecimentoCooperadoId = req.user?.cooperadoId;
    const cooperativaId = req.user?.cooperativaId;
    if (!estabelecimentoCooperadoId) {
      throw new BadRequestException('Cooperado não identificado no contexto.');
    }
    if (!cooperativaId) {
      throw new BadRequestException('Cooperativa não identificada no contexto.');
    }
    return this.cooperTokenService.listarMeusResgates({
      estabelecimentoCooperadoId,
      cooperativaId,
      status,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
    });
  }

  /**
   * Estabelecimento cancela própria solicitação pendente.
   * Compare-and-swap protege contra corrida admin-aprova × estabelecimento-cancela.
   */
  @Roles(COOPERADO)
  @Post('empresa/resgates/:id/cancelar')
  async cancelarResgate(@Req() req: any, @Param('id') id: string) {
    const estabelecimentoCooperadoId = req.user?.cooperadoId;
    const cooperativaId = req.user?.cooperativaId;
    if (!estabelecimentoCooperadoId) {
      throw new BadRequestException('Cooperado não identificado no contexto.');
    }
    if (!cooperativaId) {
      throw new BadRequestException('Cooperativa não identificada no contexto.');
    }
    return this.cooperTokenService.cancelarResgate({
      reciboId: id,
      cooperativaId,
      estabelecimentoCooperadoId,
    });
  }

  /**
   * Admin lista resgates pendentes pra revisão. Paginação + filtros.
   * Default status=PENDENTE_APROVACAO_COOP.
   */
  @Roles(ADMIN, SUPER_ADMIN)
  @Get('admin/resgates-pendentes')
  async listarResgatesPendentes(
    @Req() req: any,
    @Query('status') status?: string,
    @Query('valorMin') valorMin?: string,
    @Query('valorMax') valorMax?: string,
    @Query('dataInicio') dataInicio?: string,
    @Query('dataFim') dataFim?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const cooperativaId = req.user?.cooperativaId;
    if (!cooperativaId) {
      throw new BadRequestException(
        'cooperativaId obrigatório no contexto (SUPER_ADMIN deve impersonar tenant).',
      );
    }
    return this.cooperTokenService.listarResgatesPendentes({
      cooperativaId,
      status,
      valorMin: valorMin ? parseFloat(valorMin) : undefined,
      valorMax: valorMax ? parseFloat(valorMax) : undefined,
      dataInicio: dataInicio ? new Date(dataInicio) : undefined,
      dataFim: dataFim ? new Date(dataFim) : undefined,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
    });
  }

  /**
   * Admin aprova resgate pendente. Dispara PIX-out via Asaas (SIMULATED
   * em ambiente NÃO-real). Compare-and-swap protege contra 2 admins.
   */
  @Roles(ADMIN, SUPER_ADMIN)
  @Post('admin/resgates/:id/aprovar')
  async aprovarResgate(@Req() req: any, @Param('id') id: string) {
    const cooperativaId = req.user?.cooperativaId;
    const aprovadoPorUserId = req.user?.sub ?? req.user?.userId ?? 'desconhecido';
    if (!cooperativaId) {
      throw new BadRequestException('cooperativaId obrigatório no contexto.');
    }
    return this.cooperTokenService.aprovarResgate({
      reciboId: id,
      cooperativaId,
      aprovadoPorUserId,
    });
  }

  /**
   * Admin recusa resgate pendente. Estorno auditável imediato.
   * Compare-and-swap protege contra 2 admins.
   */
  @Roles(ADMIN, SUPER_ADMIN)
  @Post('admin/resgates/:id/recusar')
  async recusarResgate(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: RecusarResgateDto,
  ) {
    const cooperativaId = req.user?.cooperativaId;
    const recusadoPorUserId = req.user?.sub ?? req.user?.userId ?? 'desconhecido';
    if (!cooperativaId) {
      throw new BadRequestException('cooperativaId obrigatório no contexto.');
    }
    return this.cooperTokenService.recusarResgate({
      reciboId: id,
      cooperativaId,
      recusadoPorUserId,
      motivoRecusa: body.motivoRecusa,
    });
  }
}
