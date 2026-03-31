import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CooperTokenTipo, CooperTokenOperacao, Prisma } from '@prisma/client';

interface CreditarParams {
  cooperadoId: string;
  cooperativaId: string;
  tipo: CooperTokenTipo;
  quantidade: number;
  referenciaId?: string;
  referenciaTabela?: string;
  expiracaoMeses?: number;
}

interface DebitarParams {
  cooperadoId: string;
  cooperativaId: string;
  quantidade: number;
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

@Injectable()
export class CooperTokenService {
  private readonly logger = new Logger(CooperTokenService.name);

  constructor(private prisma: PrismaService) {}

  async creditar(params: CreditarParams) {
    const {
      cooperadoId,
      cooperativaId,
      tipo,
      quantidade,
      referenciaId,
      referenciaTabela,
      expiracaoMeses = 12,
    } = params;

    return this.prisma.$transaction(async (tx) => {
      // Buscar ou criar saldo
      let saldo = await tx.cooperTokenSaldo.findUnique({
        where: { cooperadoId },
      });

      const novoSaldoDisponivel = Number(saldo?.saldoDisponivel ?? 0) + quantidade;
      const novoTotalEmitido = Number(saldo?.totalEmitido ?? 0) + quantidade;

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
            saldoDisponivel: quantidade,
            totalEmitido: quantidade,
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
          quantidade,
          saldoApos: novoSaldoDisponivel,
          valorReais: null,
          referenciaId,
          referenciaTabela,
          expiracaoEm,
          descricao: `Crédito ${tipo} de ${quantidade} tokens`,
        },
      });

      this.logger.log(
        `Creditado ${quantidade} tokens (${tipo}) para cooperado ${cooperadoId}`,
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
          tipo: CooperTokenTipo.GERACAO_EXCEDENTE,
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
      };
    }

    return saldo;
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

  async getConsolidado(cooperativaId: string) {
    const [saldos, emitidoMes, resgatadoMes] = await Promise.all([
      this.prisma.cooperTokenSaldo.findMany({
        where: { cooperativaId },
        include: { cooperado: { select: { nomeCompleto: true, email: true } } },
      }),
      this.prisma.cooperTokenLedger.aggregate({
        where: {
          cooperativaId,
          operacao: CooperTokenOperacao.CREDITO,
          createdAt: {
            gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
          },
        },
        _sum: { quantidade: true },
      }),
      this.prisma.cooperTokenLedger.aggregate({
        where: {
          cooperativaId,
          operacao: CooperTokenOperacao.DEBITO,
          createdAt: {
            gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
          },
        },
        _sum: { quantidade: true },
      }),
    ]);

    return {
      cooperados: saldos,
      tokensEmitidosMes: Number(emitidoMes._sum.quantidade ?? 0),
      tokensResgatadosMes: Number(resgatadoMes._sum.quantidade ?? 0),
      totalCooperados: saldos.length,
    };
  }
}
