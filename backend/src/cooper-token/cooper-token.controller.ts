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

    return this.cooperTokenService.creditar({
      cooperadoId: body.cooperadoId,
      cooperativaId,
      tipo: tipoFinal,
      quantidade: body.quantidade,
      descricao: body.descricao,
    } as any);
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

  @Roles(COOPERADO, ADMIN, SUPER_ADMIN, OPERADOR)
  @Post('processar-pagamento-qr')
  async processarPagamentoQr(
    @Req() req: any,
    @Body() body: { qrToken: string },
  ) {
    const cooperadoId = req.user?.cooperadoId;
    const cooperativaId = req.user?.cooperativaId;
    if (!cooperadoId) {
      throw new BadRequestException('Cooperado não identificado');
    }
    if (!cooperativaId) {
      throw new BadRequestException('Cooperativa não identificada');
    }
    if (!body.qrToken) {
      throw new BadRequestException('Token QR é obrigatório');
    }

    return this.cooperTokenService.processarPagamentoQr({
      qrToken: body.qrToken,
      recebedorId: cooperadoId,
      recebedorCooperativaId: cooperativaId,
    });
  }

  // ── Cooperado: Usar tokens na fatura ──

  @Roles(COOPERADO, ADMIN, SUPER_ADMIN, OPERADOR)
  @Post('usar-na-fatura')
  async usarNaFatura(
    @Req() req: any,
    @Body() body: { cobrancaId: string; quantidadeTokens: number },
  ) {
    const cooperadoId = req.user?.cooperadoId;
    const cooperativaId = req.user?.cooperativaId;
    if (!cooperadoId) {
      throw new BadRequestException('Cooperado não identificado');
    }
    if (!cooperativaId) {
      throw new BadRequestException('Cooperativa não identificada');
    }
    if (!body.cobrancaId || !body.quantidadeTokens || body.quantidadeTokens <= 0) {
      throw new BadRequestException('cobrancaId e quantidadeTokens (> 0) são obrigatórios');
    }
    return this.cooperTokenService.usarNaFatura({
      cooperadoId,
      cooperativaId,
      cobrancaId: body.cobrancaId,
      quantidadeTokens: body.quantidadeTokens,
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
    @Body()
    body: {
      modoGeracao?: string;
      modeloVida?: string;
      limiteTokenMensal?: number | null;
      valorTokenReais?: number;
      descontoMaxPerc?: number;
      tetoCoop?: number | null;
      ativo?: boolean;
    },
  ) {
    const cooperativaId = req.user?.cooperativaId;
    if (!cooperativaId && req.user?.perfil !== SUPER_ADMIN) {
      throw new BadRequestException('Cooperativa não identificada');
    }
    return this.cooperTokenService.upsertConfig(cooperativaId, body);
  }

  @Roles(SUPER_ADMIN)
  @Get('superadmin/config-defaults')
  async getConfigDefaults() {
    // Defaults globais — retorna valores padrão do sistema
    return {
      modoGeracao: 'AMBOS',
      modeloVida: 'AMBOS',
      limiteTokenMensal: null,
      valorTokenReais: 0.45,
      descontoMaxPerc: 30,
      tetoCoop: null,
      ativo: true,
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
    return this.cooperTokenService.confirmarCompraParceiro(body.compraId);
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

  @Roles(ADMIN, SUPER_ADMIN, OPERADOR, AGREGADOR)
  @Post('parceiro/enviar')
  async enviarTokens(
    @Req() req: any,
    @Body()
    body: {
      cooperadoId: string;
      quantidade: number;
      descricao?: string;
    },
  ) {
    const cooperativaId = req.user?.cooperativaId;
    const remetenteCooperadoId = req.user?.cooperadoId;
    const perfil = req.user?.perfil;

    if (!cooperativaId && perfil !== SUPER_ADMIN) {
      throw new BadRequestException('Cooperativa não identificada');
    }
    if (!body.cooperadoId || !body.quantidade || body.quantidade <= 0) {
      throw new BadRequestException('cooperadoId e quantidade (> 0) são obrigatórios');
    }

    // ADMIN/OPERADOR/SUPER_ADMIN/AGREGADOR: crédito direto (envio do parceiro, sem débito pessoal)
    if ([ADMIN, SUPER_ADMIN, OPERADOR, AGREGADOR].includes(perfil) && !remetenteCooperadoId) {
      return this.cooperTokenService.creditar({
        cooperadoId: body.cooperadoId,
        cooperativaId,
        tipo: CooperTokenTipo.BONUS_INDICACAO,
        quantidade: body.quantidade,
        descricao: body.descricao,
      } as any);
    }

    // AGREGADOR ou ADMIN que também é cooperado: transferência com débito
    if (!remetenteCooperadoId) {
      throw new BadRequestException('Cooperado remetente não identificado no JWT');
    }

    return this.cooperTokenService.enviarTokens({
      remetenteCooperadoId,
      destinatarioCooperadoId: body.cooperadoId,
      cooperativaId,
      quantidade: body.quantidade,
      descricao: body.descricao,
    });
  }
}
