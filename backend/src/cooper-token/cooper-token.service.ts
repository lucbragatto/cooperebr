import { Injectable, BadRequestException, NotFoundException, Logger, Inject, Optional } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CooperTokenTipo, CooperTokenOperacao, Prisma } from '@prisma/client';
import { TokenContabilService } from '../financeiro/token-contabil.service';
import * as jwt from 'jsonwebtoken';

interface CreditarParams {
  cooperadoId: string;
  cooperativaId: string;
  tipo: CooperTokenTipo;
  quantidade: number;
  valorEmissao?: number;
  referenciaId?: string;
  referenciaTabela?: string;
  expiracaoMeses?: number;
}

interface DebitarParams {
  cooperadoId: string;
  cooperativaId: string;
  quantidade: number;
  tipo?: CooperTokenTipo;
  referenciaId?: string;
  descricao?: string;
}

interface CalcularDescontoParams {
  cooperadoId: string;
  valorCobranca: number;
  plano: {
    valorTokenReais?: Prisma.Decimal | null;
    tokenDescontoMaxPerc?: Prisma.Decimal | null;
  };
}

/** Taxa de emissão de tokens (creditar) — 2% */
const TAXA_EMISSAO = 0.02;
/** Taxa de pagamento via QR Code (processarPagamentoQr) — 1% */
const TAXA_QR = 0.01;

@Injectable()
export class CooperTokenService {
  private readonly logger = new Logger(CooperTokenService.name);

  constructor(
    private prisma: PrismaService,
    @Optional() @Inject(TokenContabilService) private tokenContabil?: TokenContabilService,
  ) {}

  async creditar(params: CreditarParams) {
    const {
      cooperadoId,
      cooperativaId,
      tipo,
      quantidade,
      valorEmissao,
      referenciaId,
      referenciaTabela,
      expiracaoMeses = 12,
    } = params;

    const taxaEmissao = Math.round(quantidade * TAXA_EMISSAO * 10000) / 10000;
    const quantidadeLiquida = Math.round((quantidade - taxaEmissao) * 10000) / 10000;

    return this.prisma.$transaction(async (tx) => {
      // Buscar ou criar saldo
      let saldo = await tx.cooperTokenSaldo.findUnique({
        where: { cooperadoId },
      });

      const novoSaldoDisponivel = Number(saldo?.saldoDisponivel ?? 0) + quantidadeLiquida;
      const novoTotalEmitido = Number(saldo?.totalEmitido ?? 0) + quantidadeLiquida;

      if (saldo) {
        saldo = await tx.cooperTokenSaldo.update({
          where: { cooperadoId },
          data: {
            saldoDisponivel: novoSaldoDisponivel,
            totalEmitido: novoTotalEmitido,
          },
        });
      } else {
        saldo = await tx.cooperTokenSaldo.create({
          data: {
            cooperadoId,
            cooperativaId,
            saldoDisponivel: quantidadeLiquida,
            totalEmitido: quantidadeLiquida,
          },
        });
      }

      const expiracaoEm = new Date();
      expiracaoEm.setMonth(expiracaoEm.getMonth() + expiracaoMeses);

      const ledger = await tx.cooperTokenLedger.create({
        data: {
          cooperadoId,
          cooperativaId,
          tipo,
          operacao: CooperTokenOperacao.CREDITO,
          quantidade: quantidadeLiquida,
          saldoApos: novoSaldoDisponivel,
          valorReais: valorEmissao != null ? Math.round(quantidadeLiquida * valorEmissao * 100) / 100 : null,
          referenciaId,
          referenciaTabela,
          expiracaoEm,
          descricao: `Crédito ${tipo} de ${quantidadeLiquida} tokens (bruto: ${quantidade}, taxa emissão 2%: ${taxaEmissao})`,
        },
      });

      this.logger.log(
        `Creditado ${quantidadeLiquida} tokens líquidos (${tipo}) para cooperado ${cooperadoId} | Split: bruto=${quantidade}, taxa=${taxaEmissao}`,
      );

      return ledger;
    });
  }

  async debitar(params: DebitarParams) {
    const { cooperadoId, cooperativaId, quantidade, referenciaId, descricao } =
      params;

    return this.prisma.$transaction(async (tx) => {
      const saldo = await tx.cooperTokenSaldo.findUnique({
        where: { cooperadoId },
      });

      if (!saldo || Number(saldo.saldoDisponivel) < quantidade) {
        throw new BadRequestException(
          `Saldo insuficiente. Disponível: ${Number(saldo?.saldoDisponivel ?? 0)}, solicitado: ${quantidade}`,
        );
      }

      const novoSaldo = Number(saldo.saldoDisponivel) - quantidade;

      await tx.cooperTokenSaldo.update({
        where: { cooperadoId },
        data: {
          saldoDisponivel: novoSaldo,
          totalResgatado: { increment: quantidade },
        },
      });

      const ledger = await tx.cooperTokenLedger.create({
        data: {
          cooperadoId,
          cooperativaId,
          tipo: params.tipo ?? CooperTokenTipo.GERACAO_EXCEDENTE,
          operacao: CooperTokenOperacao.DEBITO,
          quantidade,
          saldoApos: novoSaldo,
          referenciaId,
          descricao: descricao ?? `Débito de ${quantidade} tokens`,
        },
      });

      this.logger.log(
        `Debitado ${quantidade} tokens do cooperado ${cooperadoId}`,
      );

      return ledger;
    });
  }

  calcularValorAtual(valorEmissao: number, createdAt: Date): number {
    const diasVida = Math.floor((Date.now() - createdAt.getTime()) / 86400000);
    const fator = diasVida <= 10 ? 1.0 : diasVida <= 20 ? 0.9 : diasVida <= 26 ? 0.75 : diasVida <= 29 ? 0.5 : 0;
    return Math.round(valorEmissao * fator * 10000) / 10000;
  }

  async getSaldo(cooperadoId: string) {
    const saldo = await this.prisma.cooperTokenSaldo.findUnique({
      where: { cooperadoId },
    });

    if (!saldo) {
      return {
        cooperadoId,
        saldoDisponivel: 0,
        saldoPendente: 0,
        totalEmitido: 0,
        totalResgatado: 0,
        totalExpirado: 0,
        valorAtualEstimado: 0,
      };
    }

    // Estimar valor atual: buscar créditos ativos para calcular fator médio
    const creditosAtivos = await this.prisma.cooperTokenLedger.findMany({
      where: {
        cooperadoId,
        operacao: CooperTokenOperacao.CREDITO,
        expiracaoEm: { gt: new Date() },
      },
      select: { quantidade: true, valorReais: true, createdAt: true },
    });

    let valorAtualEstimado = 0;
    if (creditosAtivos.length > 0) {
      const totalQtd = creditosAtivos.reduce((sum, c) => sum + Number(c.quantidade), 0);
      const avgValorEmissao = totalQtd > 0
        ? creditosAtivos.reduce((sum, c) => sum + Number(c.quantidade) * Number(c.valorReais ?? 0.45), 0) / totalQtd
        : 0.45;
      const avgFator = totalQtd > 0
        ? creditosAtivos.reduce((sum, c) => {
            const diasVida = Math.floor((Date.now() - c.createdAt.getTime()) / 86400000);
            const fator = diasVida <= 10 ? 1.0 : diasVida <= 20 ? 0.9 : diasVida <= 26 ? 0.75 : diasVida <= 29 ? 0.5 : 0;
            return sum + Number(c.quantidade) * fator;
          }, 0) / totalQtd
        : 1.0;
      valorAtualEstimado = Math.round(Number(saldo.saldoDisponivel) * avgValorEmissao * avgFator * 100) / 100;
    }

    return { ...saldo, valorAtualEstimado };
  }

  async calcularDesconto(params: CalcularDescontoParams) {
    const { cooperadoId, valorCobranca, plano } = params;

    const valorToken = Number(plano.valorTokenReais ?? 0.45);
    const maxPerc = Number(plano.tokenDescontoMaxPerc ?? 30);

    const descontoMaximo = (valorCobranca * maxPerc) / 100;
    const tokensParaDescontoMax = descontoMaximo / valorToken;

    const saldo = await this.getSaldo(cooperadoId);
    const saldoDisponivel = Number(saldo.saldoDisponivel);

    const tokensNecessarios = Math.min(tokensParaDescontoMax, saldoDisponivel);
    const descontoReais = Math.round(tokensNecessarios * valorToken * 100) / 100;

    return {
      tokensNecessarios: Math.round(tokensNecessarios * 10000) / 10000,
      descontoReais,
      saldoSuficiente: saldoDisponivel >= tokensParaDescontoMax,
    };
  }

  async expirarVencidos(cooperativaId: string): Promise<number> {
    const agora = new Date();

    // Buscar ledgers CREDITO com expiração vencida que ainda não foram expirados
    const ledgersVencidos = await this.prisma.cooperTokenLedger.findMany({
      where: {
        cooperativaId,
        operacao: CooperTokenOperacao.CREDITO,
        expiracaoEm: { lt: agora },
      },
      orderBy: { expiracaoEm: 'asc' },
    });

    // Agrupar por cooperadoId para processar saldos
    const porCooperado = new Map<string, typeof ledgersVencidos>();
    for (const l of ledgersVencidos) {
      const arr = porCooperado.get(l.cooperadoId) ?? [];
      arr.push(l);
      porCooperado.set(l.cooperadoId, arr);
    }

    // Verificar quais já foram expirados (tem EXPIRACAO referenciando o mesmo ledger)
    const idsVencidos = ledgersVencidos.map((l) => l.id);
    const jaExpirados = await this.prisma.cooperTokenLedger.findMany({
      where: {
        operacao: CooperTokenOperacao.EXPIRACAO,
        referenciaId: { in: idsVencidos },
        referenciaTabela: 'CooperTokenLedger',
      },
      select: { referenciaId: true },
    });
    const setJaExpirados = new Set(jaExpirados.map((e) => e.referenciaId));

    let totalExpirado = 0;

    for (const [cooperadoId, ledgers] of porCooperado) {
      const pendentes = ledgers.filter((l) => !setJaExpirados.has(l.id));
      if (pendentes.length === 0) continue;

      const qtdExpirar = pendentes.reduce(
        (sum, l) => sum + Number(l.quantidade),
        0,
      );

      await this.prisma.$transaction(async (tx) => {
        const saldo = await tx.cooperTokenSaldo.findUnique({
          where: { cooperadoId },
        });

        if (!saldo) return;

        const novoDisponivel = Math.max(
          0,
          Number(saldo.saldoDisponivel) - qtdExpirar,
        );

        await tx.cooperTokenSaldo.update({
          where: { cooperadoId },
          data: {
            saldoDisponivel: novoDisponivel,
            totalExpirado: { increment: qtdExpirar },
          },
        });

        for (const ledger of pendentes) {
          await tx.cooperTokenLedger.create({
            data: {
              cooperadoId,
              cooperativaId,
              tipo: ledger.tipo,
              operacao: CooperTokenOperacao.EXPIRACAO,
              quantidade: Number(ledger.quantidade),
              saldoApos: novoDisponivel,
              referenciaId: ledger.id,
              referenciaTabela: 'CooperTokenLedger',
              descricao: `Expiração de ${Number(ledger.quantidade)} tokens`,
            },
          });
        }
      });

      totalExpirado += qtdExpirar;
    }

    this.logger.log(
      `Expirados ${totalExpirado} tokens para cooperativa ${cooperativaId}`,
    );

    // Lançamento contábil: expiração de tokens
    if (totalExpirado > 0) {
      try {
        const config = await this.getConfig(cooperativaId);
        const valorToken = config ? Number(config.valorTokenReais) : 0.45;
        const valorReais = Math.round(totalExpirado * valorToken * 100) / 100;
        await this.tokenContabil?.lancarExpiracao({
          cooperativaId,
          valor: valorReais,
          competencia: new Date().toISOString().slice(0, 7),
          descricao: `Expiração de ${totalExpirado} tokens`,
        });
      } catch (err) {
        this.logger.warn(`Falha ao lançar contábil expiração: ${(err as Error).message}`);
      }
    }

    return totalExpirado;
  }

  async getExtrato(
    cooperadoId: string,
    page = 1,
    limit = 20,
  ) {
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.prisma.cooperTokenLedger.findMany({
        where: { cooperadoId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.cooperTokenLedger.count({
        where: { cooperadoId },
      }),
    ]);

    return { items, total, page, limit };
  }

  async getLedger(cooperativaId: string | undefined, page = 1, limit = 50) {
    const skip = (page - 1) * limit;
    const where = cooperativaId ? { cooperativaId } : {};

    const [items, total] = await Promise.all([
      this.prisma.cooperTokenLedger.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          cooperado: { select: { nomeCompleto: true, email: true } },
        },
      }),
      this.prisma.cooperTokenLedger.count({ where }),
    ]);

    return { items, total, page, limit };
  }

  async getResumoAdmin(cooperativaId: string | undefined) {
    const agora = new Date();
    const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1);

    // Build where clause — SUPER_ADMIN without cooperativaId sees all
    const whereCoopId = cooperativaId ? { cooperativaId } : {};

    const [
      totalEmitido,
      totalEmCirculacao,
      totalExpirado,
      emitidoMes,
      saldos,
    ] = await Promise.all([
      this.prisma.cooperTokenSaldo.aggregate({
        where: whereCoopId,
        _sum: { totalEmitido: true },
      }),
      this.prisma.cooperTokenSaldo.aggregate({
        where: whereCoopId,
        _sum: { saldoDisponivel: true },
      }),
      this.prisma.cooperTokenSaldo.aggregate({
        where: whereCoopId,
        _sum: { totalExpirado: true },
      }),
      this.prisma.cooperTokenLedger.aggregate({
        where: {
          ...whereCoopId,
          operacao: CooperTokenOperacao.CREDITO,
          createdAt: { gte: inicioMes },
        },
        _sum: { quantidade: true },
      }),
      this.prisma.cooperTokenSaldo.count({
        where: whereCoopId,
      }),
    ]);

    // Buscar config do plano (valorTokenReais)
    const plano = await this.prisma.plano.findFirst({
      where: {
        ...whereCoopId,
        cooperTokenAtivo: true,
      },
      select: {
        valorTokenReais: true,
        tokenExpiracaoMeses: true,
        tokenPorKwhExcedente: true,
        tokenDescontoMaxPerc: true,
      },
    });

    const emitidoNum = Number(totalEmitido._sum.totalEmitido ?? 0);
    const circulacaoNum = Number(totalEmCirculacao._sum.saldoDisponivel ?? 0);
    const expiradoNum = Number(totalExpirado._sum.totalExpirado ?? 0);
    const valorToken = Number(plano?.valorTokenReais ?? 0.45);

    return {
      totalEmitido: emitidoNum,
      emCirculacao: circulacaoNum,
      totalExpirado: expiradoNum,
      emitidoMes: Number(emitidoMes._sum.quantidade ?? 0),
      valorTotalReais: Math.round(circulacaoNum * valorToken * 100) / 100,
      totalCooperados: saldos,
      config: plano
        ? {
            valorTokenReais: Number(plano.valorTokenReais),
            tokenExpiracaoMeses: plano.tokenExpiracaoMeses,
            tokenPorKwhExcedente: Number(plano.tokenPorKwhExcedente),
            tokenDescontoMaxPerc: Number(plano.tokenDescontoMaxPerc),
          }
        : null,
    };
  }

  async getCooperativaIdByCooperado(cooperadoId: string): Promise<string | null> {
    const cooperado = await this.prisma.cooperado.findUnique({
      where: { id: cooperadoId },
      select: { cooperativaId: true },
    });
    return cooperado?.cooperativaId ?? null;
  }

  async getConsolidado(cooperativaId: string, page = 1, limit = 50) {
    const skip = (page - 1) * limit;
    const inicioMes = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

    const [cooperados, totalCooperados, emitidoMes, resgatadoMes] = await Promise.all([
      this.prisma.cooperTokenSaldo.findMany({
        where: { cooperativaId },
        include: { cooperado: { select: { nomeCompleto: true, email: true } } },
        skip,
        take: limit,
      }),
      this.prisma.cooperTokenSaldo.count({
        where: { cooperativaId },
      }),
      this.prisma.cooperTokenLedger.aggregate({
        where: {
          cooperativaId,
          operacao: CooperTokenOperacao.CREDITO,
          createdAt: { gte: inicioMes },
        },
        _sum: { quantidade: true },
      }),
      this.prisma.cooperTokenLedger.aggregate({
        where: {
          cooperativaId,
          operacao: CooperTokenOperacao.DEBITO,
          createdAt: { gte: inicioMes },
        },
        _sum: { quantidade: true },
      }),
    ]);

    return {
      cooperados,
      tokensEmitidosMes: Number(emitidoMes._sum.quantidade ?? 0),
      tokensResgatadosMes: Number(resgatadoMes._sum.quantidade ?? 0),
      totalCooperados,
      page,
      limit,
      pages: Math.ceil(totalCooperados / limit),
    };
  }

  // ── Enviar Tokens (parceiro → cooperado) ──

  async enviarTokens(params: {
    remetenteCooperadoId: string;
    destinatarioCooperadoId: string;
    cooperativaId: string;
    quantidade: number;
    descricao?: string;
  }) {
    const { remetenteCooperadoId, destinatarioCooperadoId, cooperativaId, quantidade, descricao } = params;

    if (remetenteCooperadoId === destinatarioCooperadoId) {
      throw new BadRequestException('Remetente e destinatário não podem ser o mesmo');
    }

    // Validar que destinatário pertence à mesma cooperativa
    const destinatario = await this.prisma.cooperado.findFirst({
      where: { id: destinatarioCooperadoId, cooperativaId },
    });
    if (!destinatario) {
      throw new BadRequestException('Cooperado destinatário não encontrado nesta cooperativa');
    }

    return this.prisma.$transaction(async (tx) => {
      // Debitar do remetente
      const saldoRemetente = await tx.cooperTokenSaldo.findUnique({
        where: { cooperadoId: remetenteCooperadoId },
      });

      if (!saldoRemetente || Number(saldoRemetente.saldoDisponivel) < quantidade) {
        throw new BadRequestException(
          `Saldo insuficiente. Disponível: ${Number(saldoRemetente?.saldoDisponivel ?? 0)}, solicitado: ${quantidade}`,
        );
      }

      const novoSaldoRemetente = Number(saldoRemetente.saldoDisponivel) - quantidade;

      // BUG-CT-003: Doação NÃO é resgate — não incrementar totalResgatado
      await tx.cooperTokenSaldo.update({
        where: { cooperadoId: remetenteCooperadoId },
        data: {
          saldoDisponivel: novoSaldoRemetente,
        },
      });

      await tx.cooperTokenLedger.create({
        data: {
          cooperadoId: remetenteCooperadoId,
          cooperativaId,
          tipo: CooperTokenTipo.BONUS_INDICACAO,
          operacao: CooperTokenOperacao.DOACAO_ENVIADA,
          quantidade,
          saldoApos: novoSaldoRemetente,
          descricao: descricao ?? `Envio de ${quantidade} tokens para cooperado`,
        },
      });

      // Creditar no destinatário (sem taxa)
      let saldoDestinatario = await tx.cooperTokenSaldo.findUnique({
        where: { cooperadoId: destinatarioCooperadoId },
      });

      const novoSaldoDestinatario = Number(saldoDestinatario?.saldoDisponivel ?? 0) + quantidade;
      const novoTotalEmitido = Number(saldoDestinatario?.totalEmitido ?? 0) + quantidade;

      if (saldoDestinatario) {
        await tx.cooperTokenSaldo.update({
          where: { cooperadoId: destinatarioCooperadoId },
          data: {
            saldoDisponivel: novoSaldoDestinatario,
            totalEmitido: novoTotalEmitido,
          },
        });
      } else {
        saldoDestinatario = await tx.cooperTokenSaldo.create({
          data: {
            cooperadoId: destinatarioCooperadoId,
            cooperativaId,
            saldoDisponivel: quantidade,
            totalEmitido: quantidade,
          },
        });
      }

      await tx.cooperTokenLedger.create({
        data: {
          cooperadoId: destinatarioCooperadoId,
          cooperativaId,
          tipo: CooperTokenTipo.BONUS_INDICACAO,
          operacao: CooperTokenOperacao.DOACAO_RECEBIDA,
          quantidade,
          saldoApos: novoSaldoDestinatario,
          descricao: descricao ?? `Recebimento de ${quantidade} tokens do parceiro`,
        },
      });

      this.logger.log(
        `Envio tokens: ${remetenteCooperadoId} → ${destinatarioCooperadoId}, ${quantidade} tokens (sem taxa)`,
      );

      return {
        sucesso: true,
        quantidade,
        remetenteId: remetenteCooperadoId,
        destinatarioId: destinatarioCooperadoId,
      };
    });
  }

  // ── ConfigCooperToken ──

  async getConfig(cooperativaId: string | undefined) {
    if (!cooperativaId) return null;
    return this.prisma.configCooperToken.findUnique({
      where: { cooperativaId },
    });
  }

  async upsertConfig(
    cooperativaId: string,
    data: {
      modoGeracao?: string;
      modeloVida?: string;
      limiteTokenMensal?: number | null;
      valorTokenReais?: number;
      descontoMaxPerc?: number;
      tetoCoop?: number | null;
      ativo?: boolean;
    },
  ) {
    const payload = {
      ...data,
      valorTokenReais: data.valorTokenReais != null
        ? Math.round(data.valorTokenReais * 100) / 100
        : undefined,
      descontoMaxPerc: data.descontoMaxPerc != null
        ? Math.round(data.descontoMaxPerc * 100) / 100
        : undefined,
    };

    return this.prisma.configCooperToken.upsert({
      where: { cooperativaId },
      update: payload,
      create: { cooperativaId, ...payload },
    });
  }

  async gerarQrPagamento(params: {
    pagadorId: string;
    cooperativaId: string;
    quantidade: number;
  }) {
    const { pagadorId, cooperativaId, quantidade } = params;

    if (quantidade <= 0) {
      throw new BadRequestException('Quantidade deve ser maior que zero');
    }

    const saldo = await this.getSaldo(pagadorId);
    if (Number(saldo.saldoDisponivel) < quantidade) {
      throw new BadRequestException(
        `Saldo insuficiente. Disponível: ${Number(saldo.saldoDisponivel)}, solicitado: ${quantidade}`,
      );
    }

    const secret = process.env.COOPERTOKEN_QR_SECRET;
    if (!secret || secret.length < 32) {
      throw new BadRequestException('COOPERTOKEN_QR_SECRET deve ter no mínimo 32 caracteres');
    }

    const payload = {
      pagadorId,
      cooperativaId,
      quantidade,
      tipo: 'COOPER_TOKEN_QR',
    };

    const token = jwt.sign(payload, secret, { expiresIn: '5m' });

    return { qrToken: token, expiresIn: 300 };
  }

  async processarPagamentoQr(params: {
    qrToken: string;
    recebedorId: string;
    recebedorCooperativaId: string;
  }) {
    const { qrToken, recebedorId, recebedorCooperativaId } = params;

    const secret = process.env.COOPERTOKEN_QR_SECRET;
    if (!secret || secret.length < 32) {
      throw new BadRequestException('COOPERTOKEN_QR_SECRET deve ter no mínimo 32 caracteres');
    }

    let decoded: {
      pagadorId: string;
      cooperativaId: string;
      quantidade: number;
      tipo: string;
    };

    try {
      decoded = jwt.verify(qrToken, secret) as typeof decoded;
    } catch {
      throw new BadRequestException('QR Code inválido ou expirado');
    }

    if (decoded.tipo !== 'COOPER_TOKEN_QR') {
      throw new BadRequestException('Token inválido');
    }

    if (decoded.pagadorId === recebedorId) {
      throw new BadRequestException('Pagador e recebedor não podem ser o mesmo');
    }

    if (decoded.cooperativaId !== recebedorCooperativaId) {
      throw new BadRequestException(
        'Pagador e recebedor devem pertencer à mesma cooperativa',
      );
    }

    const taxa = Math.round(decoded.quantidade * TAXA_QR * 10000) / 10000;
    const quantidadeLiquida =
      Math.round((decoded.quantidade - taxa) * 10000) / 10000;

    return this.prisma.$transaction(async (tx) => {
      // Validate sender balance
      const saldoPagador = await tx.cooperTokenSaldo.findUnique({
        where: { cooperadoId: decoded.pagadorId },
      });

      if (
        !saldoPagador ||
        Number(saldoPagador.saldoDisponivel) < decoded.quantidade
      ) {
        throw new BadRequestException(
          `Saldo insuficiente do pagador. Disponível: ${Number(saldoPagador?.saldoDisponivel ?? 0)}`,
        );
      }

      // Debit sender (full amount)
      const novoSaldoPagador =
        Number(saldoPagador.saldoDisponivel) - decoded.quantidade;

      await tx.cooperTokenSaldo.update({
        where: { cooperadoId: decoded.pagadorId },
        data: {
          saldoDisponivel: novoSaldoPagador,
          totalResgatado: { increment: decoded.quantidade },
        },
      });

      await tx.cooperTokenLedger.create({
        data: {
          cooperadoId: decoded.pagadorId,
          cooperativaId: decoded.cooperativaId,
          tipo: CooperTokenTipo.PAGAMENTO_QR,
          operacao: CooperTokenOperacao.DEBITO,
          quantidade: decoded.quantidade,
          saldoApos: novoSaldoPagador,
          descricao: `Pagamento QR de ${decoded.quantidade} tokens (taxa: ${taxa})`,
        },
      });

      // Credit receiver (net amount)
      let saldoRecebedor = await tx.cooperTokenSaldo.findUnique({
        where: { cooperadoId: recebedorId },
      });

      const novoSaldoRecebedor =
        Number(saldoRecebedor?.saldoDisponivel ?? 0) + quantidadeLiquida;
      const novoTotalEmitido =
        Number(saldoRecebedor?.totalEmitido ?? 0) + quantidadeLiquida;

      if (saldoRecebedor) {
        await tx.cooperTokenSaldo.update({
          where: { cooperadoId: recebedorId },
          data: {
            saldoDisponivel: novoSaldoRecebedor,
            totalEmitido: novoTotalEmitido,
          },
        });
      } else {
        saldoRecebedor = await tx.cooperTokenSaldo.create({
          data: {
            cooperadoId: recebedorId,
            cooperativaId: recebedorCooperativaId,
            saldoDisponivel: quantidadeLiquida,
            totalEmitido: quantidadeLiquida,
          },
        });
      }

      await tx.cooperTokenLedger.create({
        data: {
          cooperadoId: recebedorId,
          cooperativaId: recebedorCooperativaId,
          tipo: CooperTokenTipo.PAGAMENTO_QR,
          operacao: CooperTokenOperacao.CREDITO,
          quantidade: quantidadeLiquida,
          saldoApos: novoSaldoRecebedor,
          descricao: `Recebimento QR de ${quantidadeLiquida} tokens (líquido, taxa 1%)`,
        },
      });

      // Também creditar no saldo do parceiro (cooperativa do recebedor)
      if (recebedorCooperativaId) {
        await this.creditarSaldoParceiroTx(tx, recebedorCooperativaId, quantidadeLiquida);
      }

      this.logger.log(
        `Pagamento QR: ${decoded.pagadorId} → ${recebedorId}, ${decoded.quantidade} tokens (taxa: ${taxa})`,
      );

      return {
        sucesso: true,
        quantidadeBruta: decoded.quantidade,
        taxa,
        quantidadeLiquida,
        pagadorId: decoded.pagadorId,
        recebedorId,
      };
    });
  }

  // ── Parceiro: Saldo ──

  async getSaldoParceiro(cooperativaId: string) {
    let saldo = await this.prisma.cooperTokenSaldoParceiro.findUnique({
      where: { cooperativaId },
    });

    if (!saldo) {
      saldo = await this.prisma.cooperTokenSaldoParceiro.create({
        data: { cooperativaId },
      });
    }

    return saldo;
  }

  // ── Parceiro: Extrato ──

  async getExtratoParceiro(cooperativaId: string, page = 1, limit = 50) {
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.prisma.cooperTokenLedger.findMany({
        where: { parceiroId: cooperativaId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          cooperado: { select: { nomeCompleto: true, email: true } },
        },
      }),
      this.prisma.cooperTokenLedger.count({
        where: { parceiroId: cooperativaId },
      }),
    ]);

    return { items, total, page, limit };
  }

  // ── Parceiro: Usar tokens para abater energia ──

  async usarTokensEnergia(params: {
    cooperativaId: string;
    quantidade: number;
    descricao?: string;
  }) {
    const { cooperativaId, quantidade, descricao } = params;

    if (quantidade <= 0) {
      throw new BadRequestException('Quantidade deve ser maior que zero');
    }

    return this.prisma.$transaction(async (tx) => {
      const saldo = await tx.cooperTokenSaldoParceiro.findUnique({
        where: { cooperativaId },
      });

      if (!saldo || Number(saldo.saldoDisponivel) < quantidade) {
        throw new BadRequestException(
          `Saldo insuficiente. Disponível: ${Number(saldo?.saldoDisponivel ?? 0)}, solicitado: ${quantidade}`,
        );
      }

      const novoSaldo = Math.round((Number(saldo.saldoDisponivel) - quantidade) * 10000) / 10000;

      await tx.cooperTokenSaldoParceiro.update({
        where: { cooperativaId },
        data: {
          saldoDisponivel: novoSaldo,
          totalUsadoEnergia: { increment: quantidade },
        },
      });

      // Registrar no ledger — usa o primeiro cooperado da cooperativa como referência
      const adminCooperado = await tx.cooperado.findFirst({
        where: { cooperativaId },
        select: { id: true },
      });

      const cooperadoId = adminCooperado?.id ?? 'SISTEMA';

      const ledger = await tx.cooperTokenLedger.create({
        data: {
          cooperadoId,
          cooperativaId,
          tipo: CooperTokenTipo.PAGAMENTO_QR,
          operacao: CooperTokenOperacao.ABATIMENTO_ENERGIA,
          quantidade,
          saldoApos: novoSaldo,
          parceiroId: cooperativaId,
          descricao: descricao ?? `Abatimento de ${quantidade} tokens em conta de energia`,
        },
      });

      this.logger.log(
        `Parceiro ${cooperativaId} usou ${quantidade} tokens para energia. Novo saldo: ${novoSaldo}`,
      );

      return { sucesso: true, quantidade, novoSaldo, ledger };
    });
  }

  // ── Parceiro: Transferir tokens para outro parceiro ──

  async transferirTokensParceiro(params: {
    remetenteCooperativaId: string;
    destinatarioCooperativaId: string;
    quantidade: number;
    descricao?: string;
  }) {
    const { remetenteCooperativaId, destinatarioCooperativaId, quantidade, descricao } = params;

    if (quantidade <= 0) {
      throw new BadRequestException('Quantidade deve ser maior que zero');
    }

    if (remetenteCooperativaId === destinatarioCooperativaId) {
      throw new BadRequestException('Remetente e destinatário não podem ser o mesmo');
    }

    // Validar que o destinatário existe e está ativo
    const destinatario = await this.prisma.cooperativa.findFirst({
      where: { id: destinatarioCooperativaId, ativo: true },
    });

    if (!destinatario) {
      throw new NotFoundException('Parceiro destinatário não encontrado ou inativo');
    }

    return this.prisma.$transaction(async (tx) => {
      // Debitar do remetente
      const saldoRemetente = await tx.cooperTokenSaldoParceiro.findUnique({
        where: { cooperativaId: remetenteCooperativaId },
      });

      if (!saldoRemetente || Number(saldoRemetente.saldoDisponivel) < quantidade) {
        throw new BadRequestException(
          `Saldo insuficiente. Disponível: ${Number(saldoRemetente?.saldoDisponivel ?? 0)}, solicitado: ${quantidade}`,
        );
      }

      const novoSaldoRemetente = Math.round((Number(saldoRemetente.saldoDisponivel) - quantidade) * 10000) / 10000;

      await tx.cooperTokenSaldoParceiro.update({
        where: { cooperativaId: remetenteCooperativaId },
        data: {
          saldoDisponivel: novoSaldoRemetente,
          totalTransferido: { increment: quantidade },
        },
      });

      // Creditar no destinatário
      let saldoDestinatario = await tx.cooperTokenSaldoParceiro.findUnique({
        where: { cooperativaId: destinatarioCooperativaId },
      });

      const novoSaldoDestinatario = Math.round(
        (Number(saldoDestinatario?.saldoDisponivel ?? 0) + quantidade) * 10000,
      ) / 10000;

      if (saldoDestinatario) {
        await tx.cooperTokenSaldoParceiro.update({
          where: { cooperativaId: destinatarioCooperativaId },
          data: {
            saldoDisponivel: novoSaldoDestinatario,
            totalRecebido: { increment: quantidade },
          },
        });
      } else {
        await tx.cooperTokenSaldoParceiro.create({
          data: {
            cooperativaId: destinatarioCooperativaId,
            saldoDisponivel: quantidade,
            totalRecebido: quantidade,
          },
        });
      }

      // Ledger entries — buscar cooperado referência para cada lado
      const adminRemetente = await tx.cooperado.findFirst({
        where: { cooperativaId: remetenteCooperativaId },
        select: { id: true },
      });
      const adminDestinatario = await tx.cooperado.findFirst({
        where: { cooperativaId: destinatarioCooperativaId },
        select: { id: true },
      });

      await tx.cooperTokenLedger.create({
        data: {
          cooperadoId: adminRemetente?.id ?? 'SISTEMA',
          cooperativaId: remetenteCooperativaId,
          tipo: CooperTokenTipo.PAGAMENTO_QR,
          operacao: CooperTokenOperacao.TRANSFERENCIA_PARCEIRO,
          quantidade,
          saldoApos: novoSaldoRemetente,
          parceiroId: remetenteCooperativaId,
          descricao: descricao ?? `Transferência de ${quantidade} tokens para parceiro ${destinatario.nome}`,
        },
      });

      await tx.cooperTokenLedger.create({
        data: {
          cooperadoId: adminDestinatario?.id ?? 'SISTEMA',
          cooperativaId: destinatarioCooperativaId,
          tipo: CooperTokenTipo.PAGAMENTO_QR,
          operacao: CooperTokenOperacao.CREDITO,
          quantidade,
          saldoApos: novoSaldoDestinatario,
          parceiroId: destinatarioCooperativaId,
          descricao: descricao ?? `Recebimento de ${quantidade} tokens do parceiro`,
        },
      });

      this.logger.log(
        `Transferência parceiro: ${remetenteCooperativaId} → ${destinatarioCooperativaId}, ${quantidade} tokens`,
      );

      return {
        sucesso: true,
        quantidade,
        remetenteCooperativaId,
        destinatarioCooperativaId,
        novoSaldoRemetente,
      };
    });
  }

  // ── Parceiro: Processar QR de cooperado ──

  async processarQrParceiro(params: {
    qrToken: string;
    parceiroCooperativaId: string;
    recebedorId: string;
  }) {
    // Reutilizar processarPagamentoQr e, após, creditar no saldo parceiro
    const resultado = await this.processarPagamentoQr({
      qrToken: params.qrToken,
      recebedorId: params.recebedorId,
      recebedorCooperativaId: params.parceiroCooperativaId,
    });

    // Taxa de 1% já foi aplicada — creditar o líquido no saldo parceiro
    const taxa1Pct = Math.round(resultado.quantidadeLiquida * TAXA_QR * 10000) / 10000;
    const liquidoParceiro = Math.round((resultado.quantidadeLiquida - taxa1Pct) * 10000) / 10000;

    await this.prisma.$transaction(async (tx) => {
      let saldoParceiro = await tx.cooperTokenSaldoParceiro.findUnique({
        where: { cooperativaId: params.parceiroCooperativaId },
      });

      const novoSaldo = Math.round(
        (Number(saldoParceiro?.saldoDisponivel ?? 0) + liquidoParceiro) * 10000,
      ) / 10000;

      if (saldoParceiro) {
        await tx.cooperTokenSaldoParceiro.update({
          where: { cooperativaId: params.parceiroCooperativaId },
          data: {
            saldoDisponivel: novoSaldo,
            totalRecebido: { increment: liquidoParceiro },
          },
        });
      } else {
        await tx.cooperTokenSaldoParceiro.create({
          data: {
            cooperativaId: params.parceiroCooperativaId,
            saldoDisponivel: liquidoParceiro,
            totalRecebido: liquidoParceiro,
          },
        });
      }
    });

    this.logger.log(
      `QR Parceiro: creditado ${liquidoParceiro} tokens no saldo parceiro ${params.parceiroCooperativaId} (taxa cooperativa mãe: ${taxa1Pct})`,
    );

    return { ...resultado, liquidoParceiro, taxaCooperativaMae: taxa1Pct };
  }

  // ── Cooperado: Usar tokens para abater fatura (ação manual) ──

  async usarNaFatura(params: {
    cooperadoId: string;
    cooperativaId: string;
    cobrancaId: string;
    quantidadeTokens: number;
  }) {
    const { cooperadoId, cooperativaId, cobrancaId, quantidadeTokens } = params;

    if (quantidadeTokens <= 0) {
      throw new BadRequestException('Quantidade de tokens deve ser maior que zero');
    }

    // Buscar cobrança e validar ownership
    const cobranca = await this.prisma.cobranca.findUnique({
      where: { id: cobrancaId },
      include: { contrato: { include: { plano: true } } },
    });

    if (!cobranca) {
      throw new NotFoundException('Cobrança não encontrada');
    }

    if (cobranca.contrato?.cooperadoId !== cooperadoId) {
      throw new BadRequestException('Cobrança não pertence ao cooperado autenticado');
    }

    const status = cobranca.status as string;
    if (status !== 'A_VENCER' && status !== 'VENCIDO') {
      throw new BadRequestException('Só é possível usar tokens em cobranças A_VENCER ou VENCIDO');
    }

    // Calcular desconto disponível
    const plano = cobranca.contrato?.plano;
    const valorCobranca = Number(cobranca.valorLiquido);
    const desconto = await this.calcularDesconto({
      cooperadoId,
      valorCobranca,
      plano: plano ?? { valorTokenReais: null, tokenDescontoMaxPerc: null },
    });

    // Limitar tokens ao necessário
    const tokensEfetivos = Math.min(quantidadeTokens, desconto.tokensNecessarios);

    if (tokensEfetivos <= 0) {
      throw new BadRequestException('Saldo insuficiente ou desconto máximo já atingido');
    }

    const valorToken = Number(plano?.valorTokenReais ?? 0.45);
    const descontoReais = Math.round(tokensEfetivos * valorToken * 100) / 100;
    const novoValorLiquido = Math.round((valorCobranca - descontoReais) * 100) / 100;

    // Debitar tokens
    await this.debitar({
      cooperadoId,
      cooperativaId,
      quantidade: tokensEfetivos,
      tipo: CooperTokenTipo.DESCONTO_FATURA,
      referenciaId: cobrancaId,
      descricao: 'Abatimento manual na fatura via CooperToken',
    });

    // Atualizar cobrança
    const tokenDescontoQtAnterior = Number(cobranca.tokenDescontoQt ?? 0);
    const tokenDescontoReaisAnterior = Number(cobranca.tokenDescontoReais ?? 0);

    await this.prisma.cobranca.update({
      where: { id: cobrancaId },
      data: {
        valorLiquido: novoValorLiquido,
        tokenDescontoQt: Math.round((tokenDescontoQtAnterior + tokensEfetivos) * 10000) / 10000,
        tokenDescontoReais: Math.round((tokenDescontoReaisAnterior + descontoReais) * 100) / 100,
      },
    });

    this.logger.log(
      `Cooperado ${cooperadoId} usou ${tokensEfetivos} tokens na fatura ${cobrancaId}: desconto R$ ${descontoReais}`,
    );

    // Lançamento contábil: resgate na fatura (baixa passivo)
    try {
      await this.tokenContabil?.lancarResgateFatura({
        cooperativaId,
        cooperadoId,
        valor: descontoReais,
        competencia: new Date().toISOString().slice(0, 7),
        descricao: `Resgate ${tokensEfetivos} tokens na cobrança ${cobrancaId}`,
      });
    } catch (err) {
      this.logger.warn(`Falha ao lançar contábil resgate fatura: ${(err as Error).message}`);
    }

    return {
      novoValor: novoValorLiquido,
      desconto: descontoReais,
      tokensUsados: tokensEfetivos,
    };
  }

  // ── Parceiro: Comprar tokens ──

  async comprarTokensParceiro(params: {
    cooperativaId: string;
    quantidade: number;
    formaPagamento: 'PIX' | 'BOLETO';
  }) {
    const { cooperativaId, quantidade, formaPagamento } = params;

    if (quantidade <= 0) {
      throw new BadRequestException('Quantidade deve ser maior que zero');
    }

    // Buscar config para valor do token
    const config = await this.prisma.configCooperToken.findUnique({
      where: { cooperativaId },
    });
    const valorTokenReais = Number(config?.valorTokenReais ?? 0.45);
    const valorTotal = Math.round(quantidade * valorTokenReais * 100) / 100;

    // Criar registro de compra pendente
    const compra = await this.prisma.cooperTokenCompra.create({
      data: {
        cooperativaId,
        quantidade,
        valorTokenReais,
        valorTotal,
        formaPagamento,
        status: 'AGUARDANDO_PAGAMENTO',
      },
    });

    this.logger.log(
      `Parceiro ${cooperativaId} solicitou compra de ${quantidade} tokens (R$ ${valorTotal}) via ${formaPagamento}`,
    );

    return {
      compraId: compra.id,
      quantidade,
      valorTokenReais,
      valorTotal,
      formaPagamento,
      status: 'AGUARDANDO_PAGAMENTO',
      instrucoes: formaPagamento === 'PIX'
        ? `Realize o PIX de R$ ${valorTotal.toFixed(2)}. Envie o comprovante para confirmar.`
        : `Boleto será gerado em breve no valor de R$ ${valorTotal.toFixed(2)}.`,
    };
  }

  // ── Confirmar compra de tokens (webhook ou manual) ──

  async confirmarCompraParceiro(compraId: string) {
    const compra = await this.prisma.cooperTokenCompra.findUnique({
      where: { id: compraId },
    });

    if (!compra) {
      throw new NotFoundException('Compra não encontrada');
    }

    if (compra.status !== 'AGUARDANDO_PAGAMENTO') {
      throw new BadRequestException('Compra já processada');
    }

    // Creditar tokens no saldo do parceiro
    await this.creditarSaldoParceiro(compra.cooperativaId, Number(compra.quantidade));

    // Atualizar status da compra
    await this.prisma.cooperTokenCompra.update({
      where: { id: compraId },
      data: {
        status: 'PAGO',
        dataPagamento: new Date(),
      },
    });

    this.logger.log(
      `Compra ${compraId} confirmada: ${compra.quantidade} tokens creditados ao parceiro ${compra.cooperativaId}`,
    );

    // Lançamento contábil: receita venda tokens
    try {
      await this.tokenContabil?.lancarCompraParceiroPago({
        cooperativaId: compra.cooperativaId,
        valor: Number(compra.valorTotal),
        competencia: new Date().toISOString().slice(0, 7),
        descricao: `Compra parceiro ${compraId}: ${compra.quantidade} tokens`,
      });
    } catch (err) {
      this.logger.warn(`Falha ao lançar contábil compra parceiro: ${(err as Error).message}`);
    }

    return {
      sucesso: true,
      quantidade: compra.quantidade,
      cooperativaId: compra.cooperativaId,
    };
  }

  // ── Cooperado: Listar cobranças pendentes ──

  async getCobrancasPendentesCooperado(cooperadoId: string, cooperativaId: string) {
    const cobrancas = await this.prisma.cobranca.findMany({
      where: {
        cooperativaId,
        status: { in: ['A_VENCER', 'VENCIDO'] },
        contrato: { cooperadoId },
      },
      select: {
        id: true,
        mesReferencia: true,
        anoReferencia: true,
        valorBruto: true,
        valorLiquido: true,
        status: true,
        dataVencimento: true,
        tokenDescontoQt: true,
        tokenDescontoReais: true,
      },
      orderBy: { dataVencimento: 'asc' },
    });

    return cobrancas;
  }

  // ── Admin: Listar saldos de todos parceiros ──

  async listarSaldosParceiros() {
    return this.prisma.cooperTokenSaldoParceiro.findMany({
      include: {
        cooperativa: { select: { nome: true, cnpj: true, ativo: true } },
      },
      orderBy: { saldoDisponivel: 'desc' },
    });
  }

  // ── Creditar no saldo parceiro (usado internamente) ──

  async creditarSaldoParceiro(cooperativaId: string, quantidade: number) {
    return this.prisma.$transaction(async (tx) => {
      return this.creditarSaldoParceiroTx(tx, cooperativaId, quantidade);
    });
  }

  // Versão que aceita transação existente (para uso dentro de $transaction)
  private async creditarSaldoParceiroTx(tx: any, cooperativaId: string, quantidade: number) {
    const saldo = await tx.cooperTokenSaldoParceiro.findUnique({
      where: { cooperativaId },
    });

    const novoSaldo = Math.round(
      (Number(saldo?.saldoDisponivel ?? 0) + quantidade) * 10000,
    ) / 10000;

    if (saldo) {
      return tx.cooperTokenSaldoParceiro.update({
        where: { cooperativaId },
        data: {
          saldoDisponivel: novoSaldo,
          totalRecebido: { increment: quantidade },
        },
      });
    }

    return tx.cooperTokenSaldoParceiro.create({
      data: {
        cooperativaId,
        saldoDisponivel: quantidade,
        totalRecebido: quantidade,
      },
    });
  }
}
