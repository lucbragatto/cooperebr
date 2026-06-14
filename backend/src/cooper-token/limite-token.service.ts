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

    // F2.9 hardening (08/06/2026): updateMany com cooperativaId (anti-IDOR
    // defesa em profundidade — findFirst guard acima ja barrou cross-tenant).
    await this.prisma.cooperado.updateMany({
      where: { id: params.cooperadoId, cooperativaId: params.cooperativaId },
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
   * Soma valor (R$) das TokenTransacao CONFIRMADAS + ResgateRecibo do
   * dia (em fuso America/Sao_Paulo) onde o cooperado é pagador. Multi-
   * tenant safe.
   *
   * F2.9 hardening (08/06/2026): cutoff de "hoje" usa fuso America/Sao_Paulo
   * em vez de fuso do servidor. Servidor em UTC fazia o ciclo virar 21h
   * BR (3h adiantado), permitindo gastar 2x o limite diário entre 21h-00h
   * BR. Cálculo correto: midnight BR convertido pra UTC.
   *
   * F6 C.4 P1 F6-3 (14/06/2026 — review pesada): inclui ResgateRecibo
   * no gastoHoje. Sem isto, o limite diário era BURLÁVEL — estabelecimento
   * solicitava R$ 1.999 em token (passa pelo limite porque verificarValor
   * só olhava TokenTransacao) e depois solicitava resgate de R$ 1.999
   * em PIX (passava porque resgate não criava TokenTransacao). Soma agora
   * inclui PENDENTE_APROVACAO_COOP + APROVADO_PIX_DISPARADO + PAGO_RECIBO_
   * EMITIDO (RECUSADO/CANCELADO/FALHA_PIX já estornaram, não contam).
   */
  private async somarGastoHoje(params: {
    cooperadoId: string;
    cooperativaId: string;
  }): Promise<number> {
    const inicioHoje = inicioDoDiaEmSaoPaulo(new Date());

    const [aggTokenTx, aggResgate] = await Promise.all([
      this.prisma.tokenTransacao.aggregate({
        where: {
          pagadorId: params.cooperadoId,
          pagadorCooperativaId: params.cooperativaId,
          status: 'CONFIRMADA',
          confirmadaEm: { gte: inicioHoje },
        },
        _sum: { valorReaisEstimado: true },
      }),
      // F6-3: resgates do dia (estados que comprometem saldo).
      this.prisma.resgateRecibo.aggregate({
        where: {
          cooperadoEstabelecimentoId: params.cooperadoId,
          cooperativaId: params.cooperativaId,
          status: {
            in: [
              'PENDENTE_APROVACAO_COOP',
              'APROVADO_PIX_DISPARADO',
              'PAGO_RECIBO_EMITIDO',
            ],
          },
          createdAt: { gte: inicioHoje },
        },
        _sum: { valorBrutoReais: true },
      }),
    ]);

    const gastoTokenTx = toNumber(aggTokenTx._sum.valorReaisEstimado) ?? 0;
    const gastoResgate = toNumber(aggResgate._sum.valorBrutoReais) ?? 0;
    return gastoTokenTx + gastoResgate;
  }
}

/**
 * Retorna 00:00:00 do dia local em São Paulo, expresso como Date UTC.
 * Ex: agora=2026-06-08T03:00:00Z (00:00 BRT) → 2026-06-08T03:00:00Z.
 *     agora=2026-06-08T15:00:00Z (12:00 BRT) → 2026-06-08T03:00:00Z.
 *
 * Implementação via Intl.DateTimeFormat (timezone-aware) — robusto a
 * mudanças de horário de verão.
 */
export function inicioDoDiaEmSaoPaulo(referencia: Date): Date {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const parts = fmt.formatToParts(referencia).reduce<Record<string, string>>(
    (acc, p) => {
      if (p.type !== 'literal') acc[p.type] = p.value;
      return acc;
    },
    {},
  );
  const ano = Number(parts.year);
  const mes = Number(parts.month);
  const dia = Number(parts.day);
  const horaBR = Number(parts.hour === '24' ? '00' : parts.hour);
  const minBR = Number(parts.minute);
  const segBR = Number(parts.second);
  // Diferença em ms entre "agora no fuso BR" e UTC = referencia.getTime() - (UTC fictícia com componentes BR)
  const utcDoMesmoInstanteSeFosseBR = Date.UTC(ano, mes - 1, dia, horaBR, minBR, segBR);
  const offsetMs = utcDoMesmoInstanteSeFosseBR - referencia.getTime();
  // Início do dia BR convertido pra Date UTC
  const inicioDiaUtc = Date.UTC(ano, mes - 1, dia, 0, 0, 0) - offsetMs;
  return new Date(inicioDiaUtc);
}
