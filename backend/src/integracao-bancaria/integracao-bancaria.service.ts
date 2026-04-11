import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma.service';
import { BbService } from './bb.service';
import { SicoobService } from './sicoob.service';
import { CobrancasService } from '../cobrancas/cobrancas.service';

@Injectable()
export class IntegracaoBancariaService {
  private readonly logger = new Logger(IntegracaoBancariaService.name);

  constructor(
    private prisma: PrismaService,
    private bbService: BbService,
    private sicoobService: SicoobService,
    private cobrancasService: CobrancasService,
  ) {}

  // ── Configuração ──────────────────────────────────────────

  async criarConfig(data: {
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
  }) {
    return this.prisma.configuracaoBancaria.create({ data });
  }

  async atualizarConfig(id: string, data: any) {
    return this.prisma.configuracaoBancaria.update({ where: { id }, data });
  }

  async listarConfigs() {
    return this.prisma.configuracaoBancaria.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async getConfigAtiva(banco?: string): Promise<any> {
    const where: any = { ativo: true };
    if (banco) where.banco = banco;
    const config = await this.prisma.configuracaoBancaria.findFirst({ where });
    if (!config) throw new NotFoundException('Nenhuma configuração bancária ativa encontrada');
    return config;
  }

  // ── Emissão ───────────────────────────────────────────────

  async emitirCobranca(data: {
    cooperadoId: string;
    valor: number;
    vencimento: Date;
    descricao: string;
    tipo: 'BOLETO' | 'PIX';
    cobrancaId?: string;
    banco?: string;
  }) {
    const config = await this.getConfigAtiva(data.banco);
    const cooperado = await this.prisma.cooperado.findUnique({
      where: { id: data.cooperadoId },
    });
    if (!cooperado) throw new NotFoundException('Cooperado não encontrado');

    // Criar registro local
    const cobrancaBancaria = await this.prisma.cobrancaBancaria.create({
      data: {
        cooperadoId: data.cooperadoId,
        configuracaoId: config.id,
        cobrancaId: data.cobrancaId || null,
        tipo: data.tipo,
        valor: data.valor,
        vencimento: new Date(data.vencimento),
        descricao: data.descricao,
        status: 'PENDENTE',
        cooperativaId: config.cooperativaId,
      },
    });

    const dadosComuns = {
      valor: data.valor,
      vencimento: new Date(data.vencimento),
      descricao: data.descricao,
      cooperadoNome: cooperado.nomeCompleto,
      cooperadoCpf: cooperado.cpf,
    };

    let resultado: any;

    if (data.tipo === 'BOLETO') {
      resultado = config.banco === 'BB'
        ? await this.bbService.emitirBoleto(config, dadosComuns)
        : await this.sicoobService.emitirBoleto(config, dadosComuns);
    } else {
      resultado = config.banco === 'BB'
        ? await this.bbService.emitirPix(config, dadosComuns)
        : await this.sicoobService.emitirPix(config, dadosComuns);
    }

    // Atualizar registro com retorno do banco
    const updateData: any = {
      retornoBanco: resultado.retornoBanco || resultado,
      tentativas: { increment: 1 },
    };

    if (resultado.erro) {
      this.logger.error(`Erro ao emitir ${data.tipo} via ${config.banco}: ${JSON.stringify(resultado.retornoBanco)}`);
    } else {
      updateData.status = 'REGISTRADO';
      if (data.tipo === 'BOLETO') {
        updateData.nossoNumero = resultado.nossoNumero;
        updateData.codigoBarras = resultado.codigoBarras;
        updateData.linhaDigitavel = resultado.linhaDigitavel;
        updateData.urlBoleto = resultado.urlBoleto;
      } else {
        updateData.txId = resultado.txId;
        updateData.pixCopiaECola = resultado.pixCopiaECola;
        updateData.qrCodeBase64 = resultado.qrCodeBase64;
      }
    }

    return this.prisma.cobrancaBancaria.update({
      where: { id: cobrancaBancaria.id },
      data: updateData,
    });
  }

  // ── Consulta ──────────────────────────────────────────────

  async listarCobrancas(filtros?: {
    status?: string;
    cooperadoId?: string;
    dataInicio?: Date;
    dataFim?: Date;
  }) {
    const where: any = {};
    if (filtros?.status) where.status = filtros.status;
    if (filtros?.cooperadoId) where.cooperadoId = filtros.cooperadoId;
    if (filtros?.dataInicio || filtros?.dataFim) {
      where.vencimento = {};
      if (filtros.dataInicio) where.vencimento.gte = new Date(filtros.dataInicio);
      if (filtros.dataFim) where.vencimento.lte = new Date(filtros.dataFim);
    }

    return this.prisma.cobrancaBancaria.findMany({
      where,
      include: { cooperado: true, configuracao: { select: { banco: true, ambiente: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const cobranca = await this.prisma.cobrancaBancaria.findUnique({
      where: { id },
      include: { cooperado: true, configuracao: true },
    });
    if (!cobranca) throw new NotFoundException('Cobrança bancária não encontrada');
    return cobranca;
  }

  // ── Cancelamento ──────────────────────────────────────────

  async cancelarCobranca(id: string) {
    const cobranca = await this.findOne(id);
    if (cobranca.status === 'CANCELADO') {
      throw new BadRequestException('Cobrança já está cancelada');
    }
    if (cobranca.status === 'LIQUIDADO') {
      throw new BadRequestException('Não é possível cancelar cobrança já liquidada');
    }

    const config = cobranca.configuracao;

    // Tentar cancelar no banco se já foi registrado
    if (cobranca.status === 'REGISTRADO' && cobranca.tipo === 'BOLETO' && cobranca.nossoNumero) {
      if (config.banco === 'BB') {
        await this.bbService.cancelarBoleto(config as any, cobranca.nossoNumero);
      } else {
        await this.sicoobService.cancelarBoleto(config as any, cobranca.nossoNumero);
      }
    }

    return this.prisma.cobrancaBancaria.update({
      where: { id },
      data: { status: 'CANCELADO' },
    });
  }

  // ── Re-emissão ────────────────────────────────────────────

  async reemitirCobranca(id: string) {
    const cobranca = await this.findOne(id);

    // Cancelar a cobrança atual
    if (['PENDENTE', 'REGISTRADO'].includes(cobranca.status)) {
      await this.cancelarCobranca(id);
    }

    // Re-emitir com os mesmos dados
    return this.emitirCobranca({
      cooperadoId: cobranca.cooperadoId,
      valor: Number(cobranca.valor),
      vencimento: cobranca.vencimento,
      descricao: cobranca.descricao,
      tipo: cobranca.tipo as 'BOLETO' | 'PIX',
      cobrancaId: cobranca.cobrancaId || undefined,
      banco: cobranca.configuracao.banco,
    });
  }

  // ── Webhook ───────────────────────────────────────────────

  async processarWebhookBB(payload: any) {
    try {
      // BB envia array de pagamentos ou evento individual
      const pagamentos = payload.pagamentos || (payload.pix ? payload.pix : [payload]);

      for (const pag of pagamentos) {
        const nossoNumero = pag.nossoNumero || pag.numero;
        const txId = pag.txid || pag.txId;

        let cobranca: any = null;

        if (nossoNumero) {
          cobranca = await this.prisma.cobrancaBancaria.findFirst({
            where: { nossoNumero: String(nossoNumero) },
          });
        } else if (txId) {
          cobranca = await this.prisma.cobrancaBancaria.findFirst({
            where: { txId },
          });
        }

        if (!cobranca) {
          this.logger.warn(`Webhook BB: cobrança não encontrada (nossoNumero=${nossoNumero}, txId=${txId})`);
          continue;
        }

        await this.atualizarPagamento(cobranca, {
          dataPagamento: pag.dataCredito || pag.horario || new Date().toISOString(),
          valorPago: pag.valorPagoSacado || pag.valor || Number(cobranca.valor),
          retornoBanco: pag,
        });
      }
    } catch (err) {
      this.logger.error(`Erro ao processar webhook BB: ${err.message}`);
    }
  }

  async processarWebhookSicoob(payload: any) {
    try {
      const pagamentos = payload.pix || [payload];

      for (const pag of pagamentos) {
        const nossoNumero = pag.nossoNumero;
        const txId = pag.txid || pag.txId || pag.endToEndId;

        let cobranca: any = null;

        if (nossoNumero) {
          cobranca = await this.prisma.cobrancaBancaria.findFirst({
            where: { nossoNumero: String(nossoNumero) },
          });
        } else if (txId) {
          cobranca = await this.prisma.cobrancaBancaria.findFirst({
            where: { txId },
          });
        }

        if (!cobranca) {
          this.logger.warn(`Webhook Sicoob: cobrança não encontrada (nossoNumero=${nossoNumero}, txId=${txId})`);
          continue;
        }

        await this.atualizarPagamento(cobranca, {
          dataPagamento: pag.dataPagamento || pag.horario || new Date().toISOString(),
          valorPago: pag.valorPago || pag.valor || Number(cobranca.valor),
          retornoBanco: pag,
        });
      }
    } catch (err) {
      this.logger.error(`Erro ao processar webhook Sicoob: ${err.message}`);
    }
  }

  private async atualizarPagamento(
    cobranca: any,
    dados: { dataPagamento: string; valorPago: number; retornoBanco: any },
  ) {
    await this.prisma.cobrancaBancaria.update({
      where: { id: cobranca.id },
      data: {
        status: 'LIQUIDADO',
        dataPagamento: new Date(dados.dataPagamento),
        valorPago: dados.valorPago,
        retornoBanco: dados.retornoBanco,
        webhookRecebidoEm: new Date(),
      },
    });

    // Se vinculado a cobrança interna, dar baixa
    if (cobranca.cobrancaId) {
      try {
        await this.cobrancasService.darBaixa(
          cobranca.cobrancaId,
          dados.dataPagamento,
          dados.valorPago,
        );
        this.logger.log(`Baixa automática da cobrança ${cobranca.cobrancaId}`);
      } catch (err) {
        this.logger.warn(`Não foi possível dar baixa automática: ${err.message}`);
      }
    }
  }

  // ── Polling diário ────────────────────────────────────────

  @Cron('5 6 * * *')
  async pollingLiquidadas() {
    this.logger.log('Iniciando polling de cobranças liquidadas...');

    const pendentes = await this.prisma.cobrancaBancaria.findMany({
      where: {
        status: { in: ['PENDENTE', 'REGISTRADO'] },
        vencimento: { lt: new Date() },
      },
      include: { configuracao: true },
    });

    if (pendentes.length === 0) {
      this.logger.log('Nenhuma cobrança pendente/registrada vencida para polling');
      return;
    }

    this.logger.log(`Polling: ${pendentes.length} cobranças para verificar`);

    for (const cobranca of pendentes) {
      try {
        let resultado: any;
        const config = cobranca.configuracao;

        if (cobranca.tipo === 'BOLETO' && cobranca.nossoNumero) {
          resultado = config.banco === 'BB'
            ? await this.bbService.consultarCobranca(config as any, cobranca.nossoNumero)
            : await this.sicoobService.consultarCobranca(config as any, cobranca.nossoNumero);
        } else if (cobranca.tipo === 'PIX' && cobranca.txId) {
          resultado = config.banco === 'BB'
            ? await this.bbService.consultarPix(config as any, cobranca.txId)
            : await this.sicoobService.consultarPix(config as any, cobranca.txId);
        } else {
          continue;
        }

        if (resultado.erro) continue;

        if (resultado.status === 'LIQUIDADO') {
          await this.atualizarPagamento(cobranca, {
            dataPagamento: resultado.dataPagamento || new Date().toISOString(),
            valorPago: resultado.valorPago || Number(cobranca.valor),
            retornoBanco: resultado.retornoBanco,
          });
          this.logger.log(`Polling: cobrança ${cobranca.id} marcada como LIQUIDADO`);
        } else if (resultado.status === 'CANCELADO') {
          await this.prisma.cobrancaBancaria.update({
            where: { id: cobranca.id },
            data: { status: 'CANCELADO', retornoBanco: resultado.retornoBanco },
          });
        }
      } catch (err) {
        this.logger.error(`Polling erro na cobrança ${cobranca.id}: ${err.message}`);
      }
    }

    this.logger.log('Polling de cobranças finalizado');
  }
}
