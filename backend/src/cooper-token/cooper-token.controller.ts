import {
  Controller,
  Get,
  Put,
  Post,
  Body,
  Query,
  Req,
  BadRequestException,
} from '@nestjs/common';
import { CooperTokenService } from './cooper-token.service';
import { CooperTokenJob } from './cooper-token.job';
import { Roles } from '../auth/roles.decorator';
import { PerfilUsuario } from '../auth/perfil.enum';
import { CooperTokenTipo } from '@prisma/client';

const { SUPER_ADMIN, ADMIN, OPERADOR, COOPERADO } = PerfilUsuario;

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
  async getConsolidado(@Req() req: any) {
    const cooperativaId = req.user?.cooperativaId;
    if (!cooperativaId && req.user?.perfil !== SUPER_ADMIN) {
      throw new BadRequestException('Cooperativa não identificada');
    }
    return this.cooperTokenService.getConsolidado(cooperativaId);
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
    },
  ) {
    const cooperativaId = req.user?.cooperativaId;
    if (!cooperativaId && req.user?.perfil !== SUPER_ADMIN) {
      throw new BadRequestException('Cooperativa não identificada');
    }
    if (!body.cooperadoId || !body.quantidade || body.quantidade <= 0) {
      throw new BadRequestException(
        'cooperadoId e quantidade (> 0) são obrigatórios',
      );
    }

    return this.cooperTokenService.creditar({
      cooperadoId: body.cooperadoId,
      cooperativaId,
      tipo: CooperTokenTipo.GERACAO_EXCEDENTE,
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

  // ── Config CooperToken por Parceiro ──

  @Roles(ADMIN, SUPER_ADMIN)
  @Get('admin/config')
  async getConfig(@Req() req: any) {
    const cooperativaId = req.user?.cooperativaId;
    if (!cooperativaId && req.user?.perfil !== SUPER_ADMIN) {
      throw new BadRequestException('Cooperativa não identificada');
    }
    return this.cooperTokenService.getConfig(cooperativaId);
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
  async updateConfigDefaults(
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
    // Para implementação futura com tabela de defaults globais
    // Por agora retorna o body como confirmação
    return { message: 'Defaults atualizados', ...body };
  }

  // ── Enviar Tokens (parceiro → cooperado) ──

  @Roles(ADMIN, SUPER_ADMIN)
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

    if (!cooperativaId && req.user?.perfil !== SUPER_ADMIN) {
      throw new BadRequestException('Cooperativa não identificada');
    }
    if (!remetenteCooperadoId) {
      throw new BadRequestException('Cooperado remetente não identificado no JWT');
    }
    if (!body.cooperadoId || !body.quantidade || body.quantidade <= 0) {
      throw new BadRequestException('cooperadoId e quantidade (> 0) são obrigatórios');
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
