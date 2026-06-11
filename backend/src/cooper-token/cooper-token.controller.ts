import {
  Controller,
  Get,
  Put,
  Post,
  Body,
  Query,
  Req,
  BadRequestException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
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
}
