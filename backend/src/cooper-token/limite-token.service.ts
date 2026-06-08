/**
 * LimiteTokenService — Sprint Token-WA Fase 2 (F2.5, 07/06/2026).
 *
 * Gerencia os limites de transação CooperToken em dois níveis:
 *
 *   1. TETO COOPERATIVA (Cooperativa.limiteTokenTransacaoTeto / Diario)
 *      Defaults: R$ 500 por transação / R$ 2.000 por dia.
 *      Admin da cooperativa define.
 *
 *   2. AUTO-LIMITE COOPERADO (Cooperado.limiteTokenTransacao / Diario)
 *      Cooperado define o próprio limite, sempre <= teto cooperativa.
 *      Se cooperado.limite for NULL → herda teto cooperativa.
 *
 * Limite efetivo = min(teto cooperativa, auto-limite cooperado).
 *
 * Verificações:
 * - limiteTransacao: valor único de transação não pode exceder limite efetivo
 * - limiteDiario: soma valor + somatório do dia < limite diário efetivo
 *
 * Multi-tenant: TODA query filtra cooperativaId (anti-IDOR).
 *
 * Decimal: valores Prisma vêm como Prisma.Decimal — converte pra number
 * em pontos de comparação (escopo de centavos, sem precision-loss).
 */

import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { Prisma } from '@prisma/client';

export interface LimiteEfetivoResult {
  limiteTransacao: number;
  limiteDiario: number;
  /** Origem: 'COOPERATIVA' = teto vence; 'COOPERADO' = auto-limite vence. */
  origemTransacao: 'COOPERATIVA' | 'COOPERADO';
  origemDiario: 'COOPERATIVA' | 'COOPERADO';
}

export type VerificarValorResult =
  | { ok: true; limiteEfetivo: number; gastoHoje: number; saldoDisponivel: number }
  | { ok: false; motivo: 'EXCEDE_LIMITE_TRANSACAO'; limite: number }
  | { ok: false; motivo: 'EXCEDE_LIMITE_DIARIO'; limiteDiario: number; gastoHoje: number };

function toNumber(d: Prisma.Decimal | number | null | undefined): number | null {
  if (d === null || d === undefined) return null;
  if (typeof d === 'number') return d;
  return Number(d.toString());
}

@Injectable()
export class LimiteTokenService {
  private readonly logger = new Logger(LimiteTokenService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Retorna limite efetivo para o cooperado = min(teto cooperativa, auto-limite).
   * Se auto-limite cooperado for NULL, usa teto direto.
   */
  async limiteEfetivo(params: {
    cooperadoId: string;
    cooperativaId: string;
  }): Promise<LimiteEfetivoResult> {
    const cooperado = await this.prisma.cooperado.findFirst({
      where: { id: params.cooperadoId, cooperativaId: params.cooperativaId },
      select: {
        limiteTokenTransacao: true,
        limiteTokenDiario: true,
        cooperativa: {
          select: {
            limiteTokenTransacaoTeto: true,
            limiteTokenDiarioTeto: true,
          },
        },
      },
    });

    if (!cooperado || !cooperado.cooperativa) {
      throw new NotFoundException('Cooperado não encontrado.');
    }

    const tetoTrans = toNumber(cooperado.cooperativa.limiteTokenTransacaoTeto) ?? 500;
    const tetoDiario = toNumber(cooperado.cooperativa.limiteTokenDiarioTeto) ?? 2000;
    const autoTrans = toNumber(cooperado.limiteTokenTransacao);
    const autoDiario = toNumber(cooperado.limiteTokenDiario);

    const limiteTransacao = autoTrans === null ? tetoTrans : Math.min(tetoTrans, autoTrans);
    const limiteDiario = autoDiario === null ? tetoDiario : Math.min(tetoDiario, autoDiario);

    return {
      limiteTransacao,
      limiteDiario,
      origemTransacao: autoTrans !== null && autoTrans < tetoTrans ? 'COOPERADO' : 'COOPERATIVA',
      origemDiario: autoDiario !== null && autoDiario < tetoDiario ? 'COOPERADO' : 'COOPERATIVA',
    };
  }

  /**
   * Verifica se valor proposto pode ser autorizado:
   *  - <= limite por transação efetivo
   *  - gasto hoje + valor <= limite diário efetivo
   *
   * `gastoHoje` = soma `valorReaisEstimado` das TokenTransacao com
   * status CONFIRMADA do cooperado pagador hoje (0h-23:59).
   *
   * NÃO incrementa gasto (quem chama é responsável por criar TokenTransacao).
   */
  async verificarValor(params: {
    cooperadoId: string;
    cooperativaId: string;
    valorReais: number;
  }): Promise<VerificarValorResult> {
    if (!Number.isFinite(params.valorReais) || params.valorReais <= 0) {
      throw new BadRequestException('valorReais deve ser número positivo.');
    }

    const limite = await this.limiteEfetivo({
      cooperadoId: params.cooperadoId,
      cooperativaId: params.cooperativaId,
    });

    if (params.valorReais > limite.limiteTransacao) {
      return {
        ok: false,
        motivo: 'EXCEDE_LIMITE_TRANSACAO',
        limite: limite.limiteTransacao,
      };
    }

    const gastoHoje = await this.somarGastoHoje({
      cooperadoId: params.cooperadoId,
      cooperativaId: params.cooperativaId,
    });

    if (gastoHoje + params.valorReais > limite.limiteDiario) {
      return {
        ok: false,
        motivo: 'EXCEDE_LIMITE_DIARIO',
        limiteDiario: limite.limiteDiario,
        gastoHoje,
      };
    }

    return {
      ok: true,
      limiteEfetivo: limite.limiteTransacao,
      gastoHoje,
      saldoDisponivel: limite.limiteDiario - gastoHoje,
    };
  }

  /**
   * Cooperado define auto-limite. Valida que valor <= teto cooperativa.
   * NULL = remover auto-limite (volta a herdar teto).
   */
  async definirAutoLimiteCooperado(params: {
    cooperadoId: string;
    cooperativaId: string;
    limiteTransacao: number | null;
    limiteDiario: number | null;
  }): Promise<void> {
    const cooperado = await this.prisma.cooperado.findFirst({
      where: { id: params.cooperadoId, cooperativaId: params.cooperativaId },
      select: {
        cooperativa: {
          select: {
            limiteTokenTransacaoTeto: true,
            limiteTokenDiarioTeto: true,
          },
        },
      },
    });

    if (!cooperado || !cooperado.cooperativa) {
      throw new NotFoundException('Cooperado não encontrado.');
    }

    const tetoTrans = toNumber(cooperado.cooperativa.limiteTokenTransacaoTeto) ?? 500;
    const tetoDiario = toNumber(cooperado.cooperativa.limiteTokenDiarioTeto) ?? 2000;

    if (params.limiteTransacao !== null) {
      if (params.limiteTransacao <= 0) {
        throw new BadRequestException('limiteTransacao deve ser positivo.');
      }
      if (params.limiteTransacao > tetoTrans) {
        throw new BadRequestException(
          `limiteTransacao (R$ ${params.limiteTransacao}) excede teto da cooperativa (R$ ${tetoTrans}).`,
        );
      }
    }

    if (params.limiteDiario !== null) {
      if (params.limiteDiario <= 0) {
        throw new BadRequestException('limiteDiario deve ser positivo.');
      }
      if (params.limiteDiario > tetoDiario) {
        throw new BadRequestException(
          `limiteDiario (R$ ${params.limiteDiario}) excede teto da cooperativa (R$ ${tetoDiario}).`,
        );
      }
    }

    await this.prisma.cooperado.update({
      where: { id: params.cooperadoId },
      data: {
        limiteTokenTransacao: params.limiteTransacao,
        limiteTokenDiario: params.limiteDiario,
      },
    });

    this.logger.log(
      `[limite-token] Auto-limite atualizado cooperadoId=${params.cooperadoId} transacao=${params.limiteTransacao} diario=${params.limiteDiario}`,
    );
  }

  /**
   * Admin define teto cooperativa. Aplica a TODOS os cooperados (auto-limites
   * acima do novo teto continuam ativos no banco mas o `limiteEfetivo` clampa
   * pelo teto novo — efeito imediato sem migração).
   */
  async definirTetoCooperativa(params: {
    cooperativaId: string;
    limiteTransacaoTeto: number;
    limiteDiarioTeto: number;
  }): Promise<void> {
    if (params.limiteTransacaoTeto <= 0 || params.limiteDiarioTeto <= 0) {
      throw new BadRequestException('Tetos devem ser positivos.');
    }
    if (params.limiteDiarioTeto < params.limiteTransacaoTeto) {
      throw new BadRequestException(
        'Teto diário não pode ser menor que teto por transação.',
      );
    }

    const cooperativa = await this.prisma.cooperativa.findUnique({
      where: { id: params.cooperativaId },
      select: { id: true },
    });
    if (!cooperativa) {
      throw new NotFoundException('Cooperativa não encontrada.');
    }

    await this.prisma.cooperativa.update({
      where: { id: params.cooperativaId },
      data: {
        limiteTokenTransacaoTeto: params.limiteTransacaoTeto,
        limiteTokenDiarioTeto: params.limiteDiarioTeto,
      },
    });

    this.logger.log(
      `[limite-token] Teto cooperativa atualizado cooperativaId=${params.cooperativaId} transacao=${params.limiteTransacaoTeto} diario=${params.limiteDiarioTeto}`,
    );
  }

  /**
   * Soma valor (R$) das TokenTransacao CONFIRMADAS hoje (00:00:00 a now)
   * onde o cooperado é pagador. Multi-tenant safe.
   */
  private async somarGastoHoje(params: {
    cooperadoId: string;
    cooperativaId: string;
  }): Promise<number> {
    const inicioHoje = new Date();
    inicioHoje.setHours(0, 0, 0, 0);

    const agg = await this.prisma.tokenTransacao.aggregate({
      where: {
        pagadorId: params.cooperadoId,
        pagadorCooperativaId: params.cooperativaId,
        status: 'CONFIRMADA',
        confirmadaEm: { gte: inicioHoje },
      },
      _sum: { valorReaisEstimado: true },
    });

    return toNumber(agg._sum.valorReaisEstimado) ?? 0;
  }
}
