import { Injectable, BadRequestException, NotFoundException, ForbiddenException, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma.service';
import { CooperTokenTipo, CooperTokenOperacao, Prisma } from '@prisma/client';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  COOPER_TOKEN_EVENTS,
  CooperTokenEmitidoEvent,
  CooperTokenResgatadoEvent,
  CooperTokenExpiradoEvent,
  CooperTokenCompraParceiroPagoEvent,
} from './cooper-token.events';
// Sprint Clube P1 — Fase 1.5 Bloco 2 (10/06/2026): helper de Taxa de Operacao.
import { calcularTaxa } from './taxa-helper';
// Sprint Clube P1 — Fase 1.5 G3 (10/06/2026): gate juridico tambem dentro
// do service (defense in depth — protege chamadores diretos futuros, nao so
// o cron mensal).
import { isAmbienteReal } from '../common/safety/ambiente';
// Sprint Clube P1 — Fase 2 Bloco 2 (11/06/2026): empresa-PJ-cooperada
// compra tokens.
import { AsaasService } from '../asaas/asaas.service';
import { isEmpresaCooperada } from '../cooperados/cooperado-tipo.helper';
// Sprint Clube P1 — F4 Bloco A (12/06/2026): step-up via PIN em usarNaFatura.
// Optional pra não quebrar specs antigos do CooperTokenService que instanciam
// sem injetar tudo — F4 lança em runtime se faltar.
import { PinCooperadoService } from '../cooperados/pin-cooperado.service';
// F4 Bloco B (12/06/2026): helper anti-replay TokenTransacao + tier/motivoStepUp.
import { criarTokenTransacao, calcularTier } from './token-transacao.helper';
// F4 Bloco C (12/06/2026): step-up OTP no caminho admin de enviarTokens
// (crédito direto, tier ALTO). Reusa OtpDesafioService exportado pelo
// CooperadosModule (motivo TOKEN_TRANSACAO_STEP_UP).
import { OtpDesafioService } from '../common/security/otp-desafio.service';
// F4 Bloco C.1 (12/06/2026) FIN-1: verificar limite por transação +
// limite diário (LimiteTokenService — F2.5 Sprint Token-WA) ANTES da tx
// dos 3 endpoints de movimento. SUSPENSO/limite estourado dispara erro
// antes de bloquear linhas do saldo na tx Serializable.
import { LimiteTokenService } from './limite-token.service';
// F4 Bloco C.1 (12/06/2026) FIN-4: jti pra idempotência do caminho admin
// (clientRequestId-based).
import { gerarTokenHex } from '../common/security/otp-helper';
// F3 Bloco B (12/06/2026): helper mass-write reusável.
import {
  executarMassWrite,
  MassWriteAlerta,
} from '../common/mass-write/mass-write.helper';
import * as jwt from 'jsonwebtoken';import { AsPlatform } from '../common/tenant-context';


interface CreditarParams {
  cooperadoId: string;
  cooperativaId: string;
  tipo: CooperTokenTipo;
  quantidade: number;
  valorEmissao?: number;
  referenciaId?: string;
  referenciaTabela?: string;
  expiracaoMeses?: number;
  /**
   * Sprint Clube P1 — Fase 2 Bloco 3 (11/06/2026): forca credito direto
   * no saldoDisponivel sem aguardar status ATIVO_RECEBENDO_CREDITOS.
   * Usado pelo F2 (compra cooperado-PJ ja paga via Asaas) e admin manual.
   * Documentado em :130 e lido via (params as any).forcarDisponivel desde
   * antes — formalizando aqui no type pra build TS limpo.
   */
  forcarDisponivel?: boolean;
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

// Sprint Clube P1 — Fase 1.5 Bloco 2 (10/06/2026): constantes TAXA_EMISSAO (2%)
// e TAXA_QR (1%) removidas. Taxas agora vem da ConfigCooperToken via
// calcularTaxa() — fallback no helper preserva 2%/1% quando config eh null
// ou campo especifico vem null/undefined. Comportamento antigo: intacto.

@Injectable()
export class CooperTokenService {
  private readonly logger = new Logger(CooperTokenService.name);

  constructor(
    private prisma: PrismaService,
    private eventEmitter: EventEmitter2,
    // Optional — testes unitarios passam undefined (specs antigos nao
    // dependem do Asaas). F2 chama via comprarTokensCooperado.
    private asaasService?: AsaasService,
    // F4 Bloco A (12/06/2026) — optional pela mesma razão (specs antigos).
    // usarNaFatura lança em runtime se PinCooperadoService não estiver
    // disponível (ambiente real sempre injeta via CooperadosModule).
    private pinCooperadoService?: PinCooperadoService,
    // F4 Bloco C (12/06/2026) — step-up OTP no caminho admin de enviarTokens
    // (tier ALTO). Optional pelas mesmas razões dos demais.
    private otpDesafioService?: OtpDesafioService,
    // F4 Bloco C.1 (12/06/2026) — limite por transação + diário. Optional
    // pelas mesmas razões; em prod sempre injetado via CooperTokenModule.providers.
    private limiteTokenService?: LimiteTokenService,
  ) {}

  /** Status permitidos para receber crédito de tokens */
  private static readonly STATUS_PERMITIDOS_CREDITO = ['ATIVO', 'ATIVO_RECEBENDO_CREDITOS'];

  /**
   * F4 Bloco C.1 FIN-1 (12/06/2026) — guard de limite por transação + diário
   * usado pelos 3 endpoints de movimento (usarNaFatura, processarPagamentoQr,
   * enviarTokens cooperado→cooperado). Roda FORA da tx (Serializable).
   *
   * Se LimiteTokenService não estiver disponível (specs antigos), pula
   * silenciosamente — em prod sempre injetado.
   */
  private async assertLimite(params: {
    cooperadoId: string;
    cooperativaId: string;
    valorReais: number;
    origem: 'usarNaFatura' | 'processarPagamentoQr' | 'enviarTokens';
  }): Promise<void> {
    if (!this.limiteTokenService) return; // spec antigo sem injeção — skip
    if (params.valorReais <= 0) return; // ops com valor zero (ex.: clamp) — skip
    const r = await this.limiteTokenService.verificarValor({
      cooperadoId: params.cooperadoId,
      cooperativaId: params.cooperativaId,
      valorReais: params.valorReais,
    });
    if (r.ok) return;
    if (r.motivo === 'EXCEDE_LIMITE_TRANSACAO') {
      throw new BadRequestException(
        `Valor R$ ${params.valorReais.toFixed(2)} excede o limite por transação (R$ ${r.limite.toFixed(2)}). Ajuste o limite em /portal/seguranca ou peça ao admin pra elevar o teto da cooperativa.`,
      );
    }
    // EXCEDE_LIMITE_DIARIO
    throw new BadRequestException(
      `Limite diário (R$ ${r.limiteDiario.toFixed(2)}) seria estourado: já gastou R$ ${r.gastoHoje.toFixed(2)} hoje, tentativa de R$ ${params.valorReais.toFixed(2)}. Tente amanhã ou peça ao admin pra elevar o teto.`,
    );
  }

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

    // BUG-11-003: Só creditar tokens para cooperados com status ATIVO
    const cooperado = await this.prisma.cooperado.findUnique({
      where: { id: cooperadoId },
      select: { id: true, status: true, cooperativaId: true },
    });

    if (!cooperado) {
      this.logger.warn(`creditar: cooperado ${cooperadoId} não encontrado, crédito negado`);
      return null;
    }

    // Fix pos-review F2 (11/06/2026) — defesa multi-tenant em profundidade:
    // garante que o cooperado pertence ao tenant do creditante (mesmo padrao
    // anti-IDOR D-novo-BQ.2). Sem isso, um caminho que confiasse no
    // cooperadoId vindo de fora poderia creditar tokens cross-tenant.
    if (cooperado.cooperativaId !== cooperativaId) {
      this.logger.warn(
        `creditar: cross-tenant bloqueado — cooperado ${cooperadoId} pertence a ${cooperado.cooperativaId} mas o credito veio com cooperativaId=${cooperativaId}. Credito NEGADO.`,
      );
      return null;
    }

    if (!CooperTokenService.STATUS_PERMITIDOS_CREDITO.includes(cooperado.status)) {
      this.logger.warn(
        `creditar: cooperado ${cooperadoId} com status ${cooperado.status} — crédito de ${quantidade} ${tipo} negado (requer ATIVO)`,
      );
      return null;
    }

    // Idempotência: se referenciaId fornecido, verificar duplicidade
    if (referenciaId && referenciaTabela) {
      const jaCredidato = await this.prisma.cooperTokenLedger.findFirst({
        where: { referenciaId, referenciaTabela, cooperadoId, cooperativaId },
      });
      if (jaCredidato) {
        this.logger.log(`creditar: ${tipo} já creditado para ref ${referenciaTabela}/${referenciaId}, cooperado ${cooperadoId} — idempotente`);
        return jaCredidato;
      }
    }

    // F1.5 Bloco 2 — Taxa de emissao agora vem da ConfigCooperToken do tenant
    // (campos taxaEmissaoPerc + taxaEmissaoFixa). Fallback: 2% + 0 quando
    // config null (preserva TAXA_EMISSAO antigo). Leitura ANTES da transacao
    // porque a config nao muda durante a operacao.
    const configEmissao = await this.getConfig(cooperativaId);
    const { taxa: taxaEmissao, liquido: quantidadeLiquida } = calcularTaxa(
      'emissao',
      quantidade,
      configEmissao,
    );

    // Sprint 8A: tokens ficam pendentes até cooperado cumprir 3 condições:
    // 1. Cadastro completo, 2. ATIVO_RECEBENDO_CREDITOS, 3. Primeira fatura paga.
    // forcarDisponivel=true pula esse check (ex: admin creditando manualmente).
    const forcarDisponivel = (params as any).forcarDisponivel === true;
    const deveSerDisponivel = forcarDisponivel || cooperado.status === 'ATIVO_RECEBENDO_CREDITOS';

    const ledger = await this.prisma.$transaction(async (tx) => {
      // Buscar ou criar saldo
      let saldo = await tx.cooperTokenSaldo.findUnique({
        where: { cooperadoId },
      });

      const campoSaldo = deveSerDisponivel ? 'saldoDisponivel' : 'saldoPendente';
      const novoValor = Number(saldo?.[campoSaldo] ?? 0) + quantidadeLiquida;
      const novoTotalEmitido = Number(saldo?.totalEmitido ?? 0) + quantidadeLiquida;

      if (saldo) {
        saldo = await tx.cooperTokenSaldo.update({
          where: { cooperadoId },
          data: {
            [campoSaldo]: novoValor,
            totalEmitido: novoTotalEmitido,
          },
        });
      } else {
        saldo = await tx.cooperTokenSaldo.create({
          data: {
            cooperadoId,
            cooperativaId,
            [campoSaldo]: quantidadeLiquida,
            totalEmitido: quantidadeLiquida,
          },
        });
      }

      if (!deveSerDisponivel) {
        this.logger.log(
          `creditar: ${quantidadeLiquida} tokens em saldoPendente (cooperado ${cooperadoId}, status ${cooperado.status})`,
        );
      }

      const expiracaoEm = new Date();
      expiracaoEm.setMonth(expiracaoEm.getMonth() + expiracaoMeses);

      const entry = await tx.cooperTokenLedger.create({
        data: {
          cooperadoId,
          cooperativaId,
          tipo,
          operacao: CooperTokenOperacao.CREDITO,
          quantidade: quantidadeLiquida,
          saldoApos: novoValor,
          valorReais: valorEmissao != null ? Math.round(quantidadeLiquida * valorEmissao * 100) / 100 : null,
          referenciaId,
          referenciaTabela,
          expiracaoEm,
          // F1.5 G2 (10/06/2026) — sem string hardcoded "2%": taxa real
          // calculada via calcularTaxa() vai pra descricao.
          descricao: `Crédito ${tipo} de ${quantidadeLiquida} tokens (bruto: ${quantidade}, taxa: ${taxaEmissao})`,
        },
      });

      this.logger.log(
        `Creditado ${quantidadeLiquida} tokens líquidos (${tipo}) para cooperado ${cooperadoId} | Split: bruto=${quantidade}, taxa=${taxaEmissao}`,
      );

      return entry;
    });

    // Emitir evento para lançamento contábil
    const valorReais = valorEmissao != null
      ? Math.round(quantidadeLiquida * valorEmissao * 100) / 100
      : 0;
    this.eventEmitter.emit(
      COOPER_TOKEN_EVENTS.EMITIDO,
      new CooperTokenEmitidoEvent(cooperativaId, cooperadoId, tipo, quantidadeLiquida, valorReais),
    );

    // Sprint 9: contabilidade preparatória — LancamentoCaixa PROVISIONAL
    if (valorReais > 0) {
      try {
        const competencia = new Date().toISOString().slice(0, 7);
        await this.prisma.lancamentoCaixa.create({
          data: {
            tipo: 'PROVISIONAL',
            descricao: `Emissão ${tipo}: ${quantidadeLiquida} tokens (R$ ${valorReais.toFixed(2)})`,
            valor: valorReais,
            competencia,
            status: 'PROVISIONAL',
            naturezaClube: 'PROVISIONAL_TOKEN_EMISSAO',
            cooperTokenLedgerId: ledger?.id || null,
            cooperadoId,
            cooperativaId,
          },
        });
      } catch (err) {
        this.logger.warn(`LancamentoCaixa PROVISIONAL falhou: ${(err as Error).message}`);
      }
    }

    return ledger;
  }

  /**
   * Débito genérico em transação própria (ReadCommitted default).
   *
   * ⚠ ESPELHADO INLINE em `usarNaFatura` (F4 Bloco A, 12/06/2026) — lá a
   * lógica é inlinada dentro da tx Serializable pra evitar nested
   * transaction. **Mudanças aqui (cálculo de novoSaldo, ledger fields,
   * LancamentoCaixa PROVISIONAL) PRECISAM ser replicadas no inline do
   * `usarNaFatura` pra não criar drift de comportamento.**
   *
   * F4 Bloco B (12/06/2026): helper `criarTokenTransacao` (em
   * token-transacao.helper.ts) entregue pra audit/anti-replay, MAS não
   * substitui o débito do saldo — só registra a TokenTransacao paralela.
   * Bloco C avalia se vale extrair `_debitarTx(tx, params)` interno que
   * sirva debitar() + usarNaFatura sem nested-tx.
   */
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

      // Sprint 9: contabilidade preparatória — débito gera LancamentoCaixa PROVISIONAL
      const tipoDebito = params.tipo ?? 'GERACAO_EXCEDENTE';
      const natureza = tipoDebito === 'DESCONTO_FATURA'
        ? 'PROVISIONAL_TOKEN_ABATIMENTO'
        : tipoDebito === 'PAGAMENTO_QR'
        ? 'PROVISIONAL_TOKEN_TRANSFERENCIA'
        : 'PROVISIONAL_TOKEN_ABATIMENTO';

      try {
        const competencia = new Date().toISOString().slice(0, 7);
        // F4 Bloco C.1 FIN-7 (12/06/2026) — antes era 0.20 chumbado.
        // valorTokenReais vem da config do tenant (fallback 0.45 = mesmo
        // default usado em calcularDesconto e processarPagamentoQr).
        // debitar() é genérico (cron de excedente, etc), então usa config
        // direto — quando vier do usarNaFatura (caminho com plano), o
        // valorToken correto é refletido lá pelo inline (espelho mantido).
        const configDebit = await this.getConfig(cooperativaId);
        const valorTokenDeb = Number(configDebit?.valorTokenReais ?? 0.45);
        const valorEstimado = Math.round(quantidade * valorTokenDeb * 100) / 100;
        await this.prisma.lancamentoCaixa.create({
          data: {
            tipo: 'PROVISIONAL',
            descricao: `Débito ${tipoDebito}: ${quantidade} tokens`,
            valor: valorEstimado,
            competencia,
            status: 'PROVISIONAL',
            naturezaClube: natureza,
            cooperTokenLedgerId: ledger.id,
            cooperadoId,
            cooperativaId,
          },
        });
      } catch (err) {
        this.logger.warn(`LancamentoCaixa PROVISIONAL débito falhou: ${(err as Error).message}`);
      }

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

  /**
   * Sprint 8A: libera tokens pendentes → disponíveis.
   * Chamado quando cooperado cumpre as 3 condições (cadastro completo +
   * créditos liberados + primeira fatura paga).
   */
  async liberarTokensPendentes(cooperadoId: string): Promise<number> {
    const saldo = await this.prisma.cooperTokenSaldo.findUnique({
      where: { cooperadoId },
    });

    const pendente = Number(saldo?.saldoPendente ?? 0);
    if (pendente <= 0) return 0;

    await this.prisma.cooperTokenSaldo.update({
      where: { cooperadoId },
      data: {
        saldoDisponivel: { increment: pendente },
        saldoPendente: 0,
      },
    });

    // Registrar no ledger pra rastreabilidade
    const novoDisponivel = Number(saldo!.saldoDisponivel) + pendente;
    await this.prisma.cooperTokenLedger.create({
      data: {
        cooperadoId,
        cooperativaId: saldo!.cooperativaId,
        tipo: 'GERACAO_EXCEDENTE', // reutiliza enum existente
        operacao: 'CREDITO',
        quantidade: pendente,
        saldoApos: novoDisponivel,
        descricao: 'Liberação de tokens pendentes após primeira fatura paga',
      },
    });

    this.logger.log(
      `liberarTokensPendentes: ${pendente} tokens liberados pra cooperado ${cooperadoId}`,
    );

    return pendente;
  }

  /**
   * Sprint 8A: quando cooperado recebe créditos liberados pela concessionária,
   * verificar se já pagou primeira fatura. Se sim, liberar pendentes.
   */
  @OnEvent('cooperado.creditos.liberados')

  @AsPlatform()
  async handleCreditosLiberados(payload: { cooperadoId: string }) {
    try {
      // Verificar se já teve primeira fatura paga
      const totalPagas = await this.prisma.cobranca.count({
        where: { contrato: { cooperadoId: payload.cooperadoId }, status: 'PAGO' },
      });
      if (totalPagas > 0) {
        const liberados = await this.liberarTokensPendentes(payload.cooperadoId);
        if (liberados > 0) {
          this.logger.log(`handleCreditosLiberados: ${liberados} tokens liberados pra ${payload.cooperadoId}`);
        }
      }
    } catch (err) {
      this.logger.warn(`handleCreditosLiberados falhou: ${(err as Error).message}`);
    }
  }

  /**
   * Sprint 8A: quando primeira fatura é paga, verificar se cooperado
   * tem ATIVO_RECEBENDO_CREDITOS. Se sim, liberar pendentes.
   */
  @OnEvent('cobranca.primeira.paga')

  @AsPlatform()
  async handlePrimeiraFaturaPagaToken(payload: { cooperadoId: string }) {
    try {
      const cooperado = await this.prisma.cooperado.findUnique({
        where: { id: payload.cooperadoId },
        select: { status: true },
      });
      if (cooperado?.status === 'ATIVO_RECEBENDO_CREDITOS') {
        const liberados = await this.liberarTokensPendentes(payload.cooperadoId);
        if (liberados > 0) {
          this.logger.log(`handlePrimeiraFaturaPaga: ${liberados} tokens liberados pra ${payload.cooperadoId}`);
        }
      }
    } catch (err) {
      this.logger.warn(`handlePrimeiraFaturaPagaToken falhou: ${(err as Error).message}`);
    }
  }

  /**
   * Sprint 9B: handler de benefício de convênio em tokens.
   */
  @OnEvent('convenio.beneficio.tokens')

  @AsPlatform()
  async handleConvenioBeneficioTokens(payload: {
    conveniadoId: string;
    cooperativaId: string;
    quantidade: number;
    convenioId: string;
    convenioNome: string;
    faixa: number;
    membrosAtivos: number;
  }) {
    try {
      await this.creditar({
        cooperadoId: payload.conveniadoId,
        cooperativaId: payload.cooperativaId,
        tipo: 'BENEFICIO_CONVENIO' as any,
        quantidade: payload.quantidade,
        referenciaId: payload.convenioId,
        referenciaTabela: 'ContratoConvenio',
      });
      this.logger.log(
        `BENEFICIO_CONVENIO: ${payload.quantidade} tokens pro conveniado ${payload.conveniadoId}`,
      );
    } catch (err) {
      this.logger.warn(`Falha ao creditar tokens de convênio: ${(err as Error).message}`);
    }
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

    // Emitir evento para lançamento contábil
    if (totalExpirado > 0) {
      const config = await this.getConfig(cooperativaId);
      const valorToken = config ? Number(config.valorTokenReais) : 0.45;
      const valorReais = Math.round(totalExpirado * valorToken * 100) / 100;
      this.eventEmitter.emit(
        COOPER_TOKEN_EVENTS.EXPIRADO,
        new CooperTokenExpiradoEvent(cooperativaId, totalExpirado, valorReais),
      );
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

  /**
   * Envio de tokens cooperado → cooperado (caminho com débito do remetente).
   *
   * F4 Bloco C (12/06/2026):
   *  - `pin` obrigatório (PIN do remetente).
   *  - `$transaction` com isolationLevel Serializable.
   *  - `calcularTaxa('transferencia')` aplicado sobre o bruto. Default 0%
   *    + 0 fixa = comportamento idêntico ao legado (Bloco C não muda valor
   *    transferido na ausência de config); admin do tenant pode configurar
   *    taxa via /cooper-token/admin/config (campos taxaTransferenciaPerc/Fixa).
   *  - `criarTokenTransacao(tx, ...)` dentro da tx (tier baseado em valor R$;
   *    motivoStepUp via histórico do par pagador→recebedor).
   *
   * Caminho ADMIN crédito direto (sem débito do remetente) NÃO usa este
   * método — controller chama `enviarTokensAdmin` abaixo, que aplica
   * step-up OTP em tier ALTO.
   */
  async enviarTokens(params: {
    remetenteCooperadoId: string;
    destinatarioCooperadoId: string;
    cooperativaId: string;
    quantidade: number;
    descricao?: string;
    /** F4 Bloco C — PIN 6 dígitos do REMETENTE. Obrigatório. */
    pin: string;
  }) {
    const { remetenteCooperadoId, destinatarioCooperadoId, cooperativaId, quantidade, descricao, pin } = params;

    if (remetenteCooperadoId === destinatarioCooperadoId) {
      throw new BadRequestException('Remetente e destinatário não podem ser o mesmo');
    }
    if (!pin || !/^\d{6}$/.test(pin)) {
      throw new BadRequestException('PIN obrigatório (6 dígitos numéricos).');
    }
    if (!this.pinCooperadoService) {
      throw new Error('PinCooperadoService não disponível (wiring do módulo).');
    }

    // Validar que destinatário pertence à mesma cooperativa
    const destinatario = await this.prisma.cooperado.findFirst({
      where: { id: destinatarioCooperadoId, cooperativaId },
      select: { id: true, status: true },
    });
    if (!destinatario) {
      throw new BadRequestException('Cooperado destinatário não encontrado nesta cooperativa');
    }

    // BUG-11-003: Só enviar tokens para cooperados ATIVO
    if (!CooperTokenService.STATUS_PERMITIDOS_CREDITO.includes(destinatario.status)) {
      throw new BadRequestException(
        `Cooperado destinatário não está ATIVO (status: ${destinatario.status})`,
      );
    }

    // PIN FORA da tx (mesmo padrão do usarNaFatura/processarPagamentoQr).
    const pinResult = await this.pinCooperadoService.validarPinComLockout({
      cooperadoId: remetenteCooperadoId,
      cooperativaId,
      pin,
    });
    if (!pinResult.ok) {
      if (pinResult.motivo === 'PIN_NAO_DEFINIDO') {
        throw new BadRequestException(
          'PIN ainda não foi definido. Configure seu PIN no portal antes de operar.',
        );
      }
      if (pinResult.motivo === 'PIN_BLOQUEADO') {
        throw new ForbiddenException(
          `PIN bloqueado por excesso de tentativas. Tente novamente após ${pinResult.desbloqueiaEm.toISOString()}.`,
        );
      }
      throw new ForbiddenException('PIN incorreto.');
    }

    // F4 Bloco C — taxa transferência (default 0% = behavior legado).
    const configTransf = await this.getConfig(cooperativaId);
    const { taxa, liquido: quantidadeLiquida } = calcularTaxa(
      'transferencia',
      quantidade,
      configTransf,
    );

    const valorTokenReais = Number(configTransf?.valorTokenReais ?? 0.45);
    const valorReaisEstimado =
      Math.round(quantidade * valorTokenReais * 100) / 100;

    // F4 Bloco C.1 FIN-1 — limite por transação / diário do REMETENTE ANTES da tx.
    await this.assertLimite({
      cooperadoId: remetenteCooperadoId,
      cooperativaId,
      valorReais: valorReaisEstimado,
      origem: 'enviarTokens',
    });

    return this.prisma.$transaction(
      async (tx) => {
        // Debitar do remetente (quantidade BRUTA).
        const saldoRemetente = await tx.cooperTokenSaldo.findUnique({
          where: { cooperadoId: remetenteCooperadoId },
        });

        if (!saldoRemetente || Number(saldoRemetente.saldoDisponivel) < quantidade) {
          throw new BadRequestException(
            `Saldo insuficiente. Disponível: ${Number(saldoRemetente?.saldoDisponivel ?? 0)}, solicitado: ${quantidade}`,
          );
        }

        const novoSaldoRemetente = Math.round((Number(saldoRemetente.saldoDisponivel) - quantidade) * 10000) / 10000;

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
            descricao: descricao ?? `Envio de ${quantidade} tokens (líquido ${quantidadeLiquida}, taxa F1.5 transferencia: ${taxa})`,
          },
        });

        // Creditar no destinatário (quantidade LÍQUIDA).
        let saldoDestinatario = await tx.cooperTokenSaldo.findUnique({
          where: { cooperadoId: destinatarioCooperadoId },
        });

        const novoSaldoDestinatario = Math.round(
          (Number(saldoDestinatario?.saldoDisponivel ?? 0) + quantidadeLiquida) * 10000,
        ) / 10000;
        const novoTotalEmitido = Math.round(
          (Number(saldoDestinatario?.totalEmitido ?? 0) + quantidadeLiquida) * 10000,
        ) / 10000;

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
              saldoDisponivel: quantidadeLiquida,
              totalEmitido: quantidadeLiquida,
            },
          });
        }

        await tx.cooperTokenLedger.create({
          data: {
            cooperadoId: destinatarioCooperadoId,
            cooperativaId,
            tipo: CooperTokenTipo.BONUS_INDICACAO,
            operacao: CooperTokenOperacao.DOACAO_RECEBIDA,
            quantidade: quantidadeLiquida,
            saldoApos: novoSaldoDestinatario,
            descricao: descricao ?? `Recebimento de ${quantidadeLiquida} tokens (líquido, taxa: ${taxa})`,
          },
        });

        // F4 Bloco C — TokenTransacao paralela (audit + jti). Quantidade BRUTA
        // (espelha o que SAIU do pagador). Helper trata histórico do par
        // pagador→destinatário pra motivoStepUp.
        const tokenTx = await criarTokenTransacao(tx, {
          pagadorId: remetenteCooperadoId,
          pagadorCooperativaId: cooperativaId,
          recebedorId: destinatarioCooperadoId,
          recebedorCooperativaId: cooperativaId,
          quantidadeTokens: quantidade,
          valorReaisEstimado,
          tipoOperacao: 'TRANSFERENCIA',
          status: 'CONFIRMADA',
          pinValidadoEm: new Date(),
          descricao:
            descricao ??
            `Transferência cooperado→cooperado (taxa F1.5 transferencia: ${taxa})`,
        });

        this.logger.log(
          `[F4-C] Envio tokens: ${remetenteCooperadoId} → ${destinatarioCooperadoId}, bruto=${quantidade} liquido=${quantidadeLiquida} taxa=${taxa} jti=${tokenTx.jti} tier=${tokenTx.tier} motivo=${tokenTx.motivoStepUp ?? 'NONE'}`,
        );

        return {
          sucesso: true,
          quantidade,
          quantidadeLiquida,
          taxa,
          remetenteId: remetenteCooperadoId,
          destinatarioId: destinatarioCooperadoId,
          tokenTransacaoId: tokenTx.id,
          tokenTransacaoJti: tokenTx.jti,
          tier: tokenTx.tier,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  /**
   * F4 Bloco C (12/06/2026) — Solicita desafio OTP de step-up pra admin
   * antes de chamar enviarTokensAdmin tier ALTO.
   *
   *  - Cria desafio via OtpDesafioService (motivo TOKEN_TRANSACAO_STEP_UP,
   *    sujeito TOKEN_TRANSACAO + sujeitoId derivado do usuário admin).
   *  - Em ambiente NÃO-real (`isAmbienteReal() === false`), retorna o
   *    `codigo` na response pra facilitar smoke E2E (regra contatos de
   *    teste — Luciano 14/05 — não envia SMS/WA em dev/sandbox/teste).
   *  - Em ambiente real, response NÃO inclui o `codigo` (carry-over Bloco D
   *    pra entrega via WA/email — `TokenNotificacaoService.enviarOtpAltoValor`).
   *
   * Multi-tenant: cooperativaId é passado pro OtpDesafio (defesa em
   * profundidade — quando admin valida, OtpDesafioService.validar exige
   * que cooperativaId bata).
   */
  async criarDesafioStepUp(params: {
    usuarioId: string;
    cooperativaId: string;
    telefoneDestino?: string;
  }) {
    if (!this.otpDesafioService) {
      throw new Error(
        'OtpDesafioService não disponível (wiring do módulo). F4 Bloco C exige injeção via CooperadosModule.',
      );
    }
    const desafio = await this.otpDesafioService.criarDesafio({
      motivo: 'TOKEN_TRANSACAO_STEP_UP',
      sujeitoTipo: 'TOKEN_TRANSACAO',
      sujeitoId: params.usuarioId,
      cooperativaId: params.cooperativaId,
      telefoneDestino: params.telefoneDestino ?? '',
    });

    // Em ambiente real, NÃO devolver código no response — entrega real
    // fica a cargo do canal (carry-over Bloco D). Em sandbox/dev/teste,
    // devolver pra acelerar smoke (regra contatos de teste 14/05).
    if (isAmbienteReal()) {
      return {
        desafioId: desafio.desafioId,
        expiresAt: desafio.expiresAt,
        // Sem `codigo` em prod.
      };
    }
    return desafio;
  }

  /**
   * F4 Bloco C (12/06/2026) — Envio admin (crédito direto, sem débito).
   *
   * Caminho ADMIN/OPERADOR/SUPER_ADMIN/AGREGADOR do controller `parceiro/enviar`
   * quando o user NÃO tem `cooperadoId` próprio (não pode debitar saldo
   * pessoal). Substitui a chamada direta a `creditar()` do controller pra
   * aplicar STEP-UP em tier ALTO:
   *
   *  - tier BAIXO (≤R$50): segue só com auth da sessão (sem OTP).
   *  - tier ALTO (>R$50): exige `otpDesafioId` + `otpCodigo`. Validado
   *    via `OtpDesafioService.validarOuLancar` (motivo TOKEN_TRANSACAO_STEP_UP,
   *    cooperativaId-bound). OTP gerado previamente em fluxo separado
   *    (`POST /cooper-token/otp-step-up` — endpoint stub no controller F4).
   *
   * Helper criarTokenTransacao NÃO é chamado aqui — caminho admin é crédito
   * unilateral (creditar() já tem idempotência via ledger.findFirst). A
   * audit fica no `CooperTokenLedger` que `creditar` produz; jti via
   * TokenTransacao só pra paths com pagador real (cooperado→cooperado).
   */
  async enviarTokensAdmin(params: {
    destinatarioCooperadoId: string;
    cooperativaId: string;
    quantidade: number;
    descricao?: string;
    otpDesafioId?: string;
    otpCodigo?: string;
    /**
     * F4 Bloco C.1 FIN-4 (12/06/2026) — idempotency-key gerada pelo cliente
     * (UUID/uuid no React, header X-Idempotency-Key ou body). Garante que
     * duplo-clique do MESMO request resulta em 1 crédito (creditar()
     * já tem idempotência app-level via referenciaId + referenciaTabela).
     * Obrigatório no caminho admin pra ser auditável.
     */
    clientRequestId: string;
  }) {
    const { destinatarioCooperadoId, cooperativaId, quantidade, descricao, otpDesafioId, otpCodigo, clientRequestId } = params;

    // F4 Bloco C.1 MT-2 — cooperativaId obrigatório (espelha creditarManual:96).
    // SUPER_ADMIN sem cooperativaId no JWT precisa impersonar tenant ANTES de
    // enviar. Nunca {sucesso:true, ledgerCreditado:false}.
    if (!cooperativaId) {
      throw new BadRequestException(
        'cooperativaId obrigatório no caminho admin. SUPER_ADMIN deve impersonar uma cooperativa antes de enviar tokens.',
      );
    }
    if (quantidade <= 0) {
      throw new BadRequestException('Quantidade deve ser maior que zero');
    }
    // F4 Bloco C.1 FIN-4 — clientRequestId obrigatório.
    if (!clientRequestId || clientRequestId.trim().length < 8) {
      throw new BadRequestException(
        'clientRequestId obrigatório no caminho admin (mínimo 8 chars; recomendado UUID v4). Usado pra idempotência: duplo-clique do mesmo request não credita 2×.',
      );
    }

    // Calcular tier (mesma fórmula do helper — valorTokenReais da config).
    const configTransf = await this.getConfig(cooperativaId);
    const valorTokenReais = Number(configTransf?.valorTokenReais ?? 0.45);
    const valorReaisEstimado =
      Math.round(quantidade * valorTokenReais * 100) / 100;
    const tier = calcularTier(valorReaisEstimado);

    if (tier === 'ALTO') {
      if (!otpDesafioId || !otpCodigo) {
        throw new BadRequestException(
          `Operação tier ALTO (>R$ 50): OTP obrigatório. Solicite OTP via /cooper-token/otp-step-up antes (informe otpDesafioId e otpCodigo).`,
        );
      }
      if (!this.otpDesafioService) {
        throw new Error(
          'OtpDesafioService não disponível (wiring do módulo). F4 Bloco C exige injeção via CooperadosModule.',
        );
      }
      // Lança HttpException se OTP inválido/expirado/bloqueado.
      await this.otpDesafioService.validarOuLancar({
        desafioId: otpDesafioId,
        codigo: otpCodigo,
        cooperativaId,
      });
    }

    // F4 Bloco C.1 FIN-4 — referenciaId estável = clientRequestId. Combinado
    // com referenciaTabela='ENVIO_ADMIN' garante idempotência via
    // creditar() :100 (ledger.findFirst). Duplo-clique do MESMO clientRequestId
    // retorna o ledger entry existente sem criar novo.
    const ledgerEntry = await this.creditar({
      cooperadoId: destinatarioCooperadoId,
      cooperativaId,
      tipo: CooperTokenTipo.BONUS_INDICACAO,
      quantidade,
      descricao: descricao ?? `Envio admin tier ${tier} (req ${clientRequestId})`,
      referenciaId: clientRequestId,
      referenciaTabela: 'ENVIO_ADMIN',
      // Bloco C — admin pode enviar pra qualquer status ATIVO ou
      // ATIVO_RECEBENDO_CREDITOS (creditar() já gating); sem forcarDisponivel.
    } as any);

    // MT-2 hardening: se creditar() retornou null (cooperado SUSPENSO/cross-tenant
    // bloqueado), propagar como BadRequest em vez de devolver {sucesso:true,
    // ledgerCreditado:false} que confunde o admin (visualmente parece OK).
    if (!ledgerEntry) {
      throw new BadRequestException(
        `Crédito negado: destinatário ${destinatarioCooperadoId} não está apto a receber (status inválido ou cross-tenant). Consulte os logs do servidor.`,
      );
    }

    this.logger.log(
      `[F4-C admin] Envio admin tier=${tier} req=${clientRequestId} → ${destinatarioCooperadoId}: ${quantidade} tokens (valor R$ ${valorReaisEstimado})`,
    );

    return {
      sucesso: true,
      quantidade,
      destinatarioId: destinatarioCooperadoId,
      tier,
      valorReaisEstimado,
      clientRequestId,
      ledgerCreditado: true,
    };
  }

  /**
   * Sprint Clube P1 — F3 Bloco B (12/06/2026).
   *
   * Empresa-PJ (cooperada PJ) distribui tokens já comprados (F2) para
   * funcionários (MEMBRO_ATIVO do convênio onde ela é `conveniada`).
   *
   * Decisões Luciano travadas:
   *  - Origem TRANSFERÊNCIA, não emissão: débito do saldo da empresa +
   *    crédito do funcionário; sem `creditar()` nem `enviarTokens`.
   *  - Tudo-ou-nada: saldo empresa ≥ soma validado DENTRO da tx Serializable.
   *  - PIN da empresa FORA da tx (mesmo padrão F4).
   *  - assertLimite sobre TOTAL do lote (somaValorReais) vs limite de
   *    transação da empresa. Por linha mantém jti.
   *  - Ledger por linha = `CooperTokenTipo.DISTRIBUICAO_CONVENIO`
   *    (NÃO DOACAO_ENVIADA/RECEBIDA — segregação Art. 87).
   *  - Idempotência por lote: 1ª linha do crédito grava
   *    `referenciaTabela='MASS_WRITE_DISTRIBUICAO'` + `referenciaId=clientRequestId`.
   *  - Naturezas:
   *    - VOLUNTARIA exige `empresaDeclaraTetoClt=true` (CLT 458 §2º).
   *    - PREMIACAO exige `descricao` com motivo/meta (CLT 457 §2º).
   *    - ORIGEM_REGULAMENTO ignora o checkbox.
   *  - Helper `executarMassWrite` (Bloco A) coordena cap + preview/confirm +
   *    idempotência + AuditLog.
   */
  async distribuirTokens(params: {
    /** Empresa-PJ (vem do JWT — NUNCA do body). */
    empresaCooperadoId: string;
    cooperativaId: string;
    convenioId: string;
    clientRequestId: string;
    pin: string;
    modo: 'PREVIEW' | 'CONFIRM';
    distribuicoes: Array<{ destinatarioCooperadoId: string; quantidade: number }>;
    naturezaDistribuicao: 'ORIGEM_REGULAMENTO' | 'VOLUNTARIA' | 'PREMIACAO';
    empresaDeclaraTetoClt?: boolean;
    descricao?: string;
    /**
     * F3 C.1 GAP-F3-3 — valor do token que a UI usou pra calcular o preview.
     * No CONFIRM, service compara com o config atual. Divergiu → BadRequest.
     */
    valorTokenEsperado?: number;
    /** Pra AuditLog. Opcional. */
    ip?: string;
    userAgent?: string;
  }) {
    const {
      empresaCooperadoId,
      cooperativaId,
      convenioId,
      clientRequestId,
      pin,
      modo,
      distribuicoes,
      naturezaDistribuicao,
      empresaDeclaraTetoClt,
      descricao,
      ip,
      userAgent,
    } = params;

    // ── Guard 1: validação semântica das naturezas ──
    if (naturezaDistribuicao === 'VOLUNTARIA' && empresaDeclaraTetoClt !== true) {
      throw new BadRequestException(
        'Distribuição VOLUNTARIA exige declaração explícita de respeito ao teto de 50% da remuneração (CLT 458 §2º). Confirme empresaDeclaraTetoClt=true.',
      );
    }
    if (naturezaDistribuicao === 'PREMIACAO' && (!descricao || descricao.trim().length < 3)) {
      throw new BadRequestException(
        'Distribuição PREMIACAO exige descricao com motivo/meta da premiação (CLT 457 §2º — prêmio excluído da remuneração desde que vinculado a desempenho).',
      );
    }

    // ── Guard 2: empresa-PJ existe + é PJ + status válido ──
    const empresa = await this.prisma.cooperado.findFirst({
      where: { id: empresaCooperadoId, cooperativaId },
      select: { id: true, tipoPessoa: true, status: true, nomeCompleto: true },
    });
    if (!empresa) {
      throw new NotFoundException('Empresa cooperada não encontrada ou não pertence ao seu tenant.');
    }
    if (!isEmpresaCooperada(empresa)) {
      throw new ForbiddenException(
        'Distribuir tokens é operação exclusiva de empresas cooperadas (PJ). Pessoas físicas usam transferência cooperado→cooperado.',
      );
    }
    if (!CooperTokenService.STATUS_PERMITIDOS_CREDITO.includes(empresa.status)) {
      throw new ForbiddenException(
        `Status ${empresa.status} não permite distribuir tokens. Permitidos: ATIVO ou ATIVO_RECEBENDO_CREDITOS.`,
      );
    }

    // ── Guard 3: convênio existe + empresa é a `conveniada` ──
    const convenio = await this.prisma.contratoConvenio.findFirst({
      where: { id: convenioId, cooperativaId },
      select: { id: true, conveniadoId: true, status: true, empresaNome: true },
    });
    if (!convenio) {
      throw new NotFoundException('Convênio não encontrado.');
    }
    if (convenio.status !== 'ATIVO') {
      throw new BadRequestException(`Convênio status=${convenio.status}; só convênios ATIVO permitem distribuição.`);
    }
    if (convenio.conveniadoId !== empresaCooperadoId) {
      throw new ForbiddenException(
        'Apenas a empresa conveniada (representante) pode distribuir tokens nesse convênio.',
      );
    }

    // ── Guard 4: PIN FORA da tx (mesmo padrão F4 — rate-limit/lockout não bloqueia row) ──
    if (!pin || !/^\d{6}$/.test(pin)) {
      throw new BadRequestException('PIN obrigatório (6 dígitos numéricos).');
    }
    if (!this.pinCooperadoService) {
      throw new Error('PinCooperadoService não disponível (wiring do módulo).');
    }
    const pinResult = await this.pinCooperadoService.validarPinComLockout({
      cooperadoId: empresaCooperadoId,
      cooperativaId,
      pin,
    });
    if (!pinResult.ok) {
      if (pinResult.motivo === 'PIN_NAO_DEFINIDO') {
        throw new BadRequestException(
          'PIN da empresa não foi definido. Configure no portal de segurança antes de distribuir.',
        );
      }
      if (pinResult.motivo === 'PIN_BLOQUEADO') {
        throw new ForbiddenException(
          `PIN bloqueado por excesso de tentativas. Tente após ${pinResult.desbloqueiaEm.toISOString()}.`,
        );
      }
      throw new ForbiddenException('PIN incorreto.');
    }

    // ── Calcular totais + valor R$ ──
    const config = await this.getConfig(cooperativaId);
    const valorTokenReais = Number(config?.valorTokenReais ?? 0.45);
    // F3 C.1 GAP-F3-2/5 (12/06/2026): round na soma das quantidades pra matar
    // ruído IEEE 754 das somas float (ex: 0.1 + 0.2 != 0.3). Reflete em
    // todas as comparações posteriores: saldo, assertLimite, ledger.saldoApos.
    const somaQuantidade =
      Math.round(distribuicoes.reduce((s, d) => s + d.quantidade, 0) * 10000) / 10000;
    const somaValorReais = Math.round(somaQuantidade * valorTokenReais * 100) / 100;
    const { taxa: taxaTransfer, liquido: somaLiquido } = calcularTaxa(
      'transferencia',
      somaQuantidade,
      config,
    );

    // F3 C.1 GAP-F3-4 (12/06/2026) — taxa de transferência em LOTE fica
    // BLOQUEADA até D-novo-TAXA-TRANSFER-DESTINO definir destino contábil
    // (mesma filosofia do gate da oxidação F1.5). Distribuição é mass-write
    // e taxa > 0 em massa precisa de decisão produto (queima? crédito
    // emissora? fundo reserva?) antes de virar prática.
    if (taxaTransfer > 0) {
      throw new BadRequestException(
        `Distribuição em lote está bloqueada enquanto a taxa de transferência > 0 (atual: ${taxaTransfer} tokens). ` +
          `Definir destino contábil da taxa em distribuição massa exige decisão produto (ver D-novo-TAXA-TRANSFER-DESTINO P2). ` +
          `Setar taxaTransferenciaPerc=0 em /cooper-token/admin/config até o gate ser definido.`,
      );
    }

    // F3 C.1 GAP-F3-3 (12/06/2026) — preview === cobrança.
    // No CONFIRM, UI envia valorTokenEsperado = valor que ela usou pra
    // calcular o preview. Service compara com a config ATUAL; se divergiu,
    // o saldo restante mostrado na UI virou ficção. Bloqueia + pede recarga.
    if (modo === 'CONFIRM' && typeof params.valorTokenEsperado === 'number') {
      const esperado = params.valorTokenEsperado;
      // Tolerância centesimal — config armazena Decimal(10,4); UI envia número.
      if (Math.abs(valorTokenReais - esperado) > 0.0001) {
        throw new BadRequestException(
          `Valor do token mudou entre a prévia e a confirmação ` +
            `(prévia: R$ ${esperado.toFixed(4)}; atual: R$ ${valorTokenReais.toFixed(4)}). ` +
            `Recarregue a tela e revise a prévia antes de confirmar.`,
        );
      }
    }

    // ── Guard 5: assertLimite sobre TOTAL do lote (decisão Luciano ajuste 2) ──
    // A empresa é quem gasta — limite por transação dela vs soma total.
    await this.assertLimite({
      cooperadoId: empresaCooperadoId,
      cooperativaId,
      valorReais: somaValorReais,
      origem: 'enviarTokens', // 'distribuirTokens' não existe no enum origem; alias semântico
    });

    // ── Guard 6: validar destinatários (MEMBRO_ATIVO + ativo + mesma cooperativa) ──
    // F3 C.1 MT-A — filtro multi-tenant SQL explícito via relação `cooperado.is`
    // (defense-in-depth — mesmo padrão dos guards do helper criarTokenTransacao).
    const destinatarioIds = distribuicoes.map((d) => d.destinatarioCooperadoId);
    const membros = await this.prisma.convenioCooperado.findMany({
      where: {
        convenioId,
        cooperadoId: { in: destinatarioIds },
        status: 'MEMBRO_ATIVO',
        ativo: true,
        cooperado: { is: { cooperativaId } },
      },
      select: { cooperadoId: true, cooperado: { select: { status: true, cooperativaId: true, nomeCompleto: true } } },
    });
    const membrosValidosSet = new Set(
      membros
        .filter(
          (m) =>
            m.cooperado.cooperativaId === cooperativaId &&
            CooperTokenService.STATUS_PERMITIDOS_CREDITO.includes(m.cooperado.status),
        )
        .map((m) => m.cooperadoId),
    );
    const invalidos = destinatarioIds.filter((id) => !membrosValidosSet.has(id));

    // ── Tipo unificado de retorno (idempotência hit + commit fresco) ──
    type DistribuirResultado = {
      clientRequestId: string;
      distribuidos: number;
      somaQuantidade: number;
      somaValorReais: number;
      somaLiquido?: number;
      taxaTransfer?: number;
      saldoEmpresaAntes?: number;
      saldoEmpresaDepois?: number;
      naturezaDistribuicao?: typeof naturezaDistribuicao;
      linhas?: Array<{
        destinatarioCooperadoId: string;
        quantidade: number;
        ledgerDebitoId: string;
        ledgerCreditoId: string;
        tokenTransacaoId: string;
        jti: string;
      }>;
      /** Presente apenas em idempotência hit. */
      primeiroLedgerId?: string;
      processadoEm?: Date;
    };

    // ── Idempotência callback (consumer do helper) ──
    const verificarIdempotencia = async (): Promise<DistribuirResultado | null> => {
      const ledgerExistente = await this.prisma.cooperTokenLedger.findFirst({
        where: {
          cooperativaId,
          referenciaId: clientRequestId,
          referenciaTabela: 'MASS_WRITE_DISTRIBUICAO',
        },
        select: { id: true, createdAt: true },
      });
      if (!ledgerExistente) return null;
      // Retorno sintético — UI mostra "lote já processado em ...".
      return {
        clientRequestId,
        distribuidos: distribuicoes.length,
        somaQuantidade,
        somaValorReais,
        primeiroLedgerId: ledgerExistente.id,
        processadoEm: ledgerExistente.createdAt,
      };
    };

    // ── Preview callback ──
    const previewCb = async (items: typeof distribuicoes) => {
      const alertas: MassWriteAlerta[] = [];
      // Saldo empresa (snapshot fora da tx — só pra alerta UI).
      const saldoEmpresa = await this.prisma.cooperTokenSaldo.findUnique({
        where: { cooperadoId: empresaCooperadoId },
        select: { saldoDisponivel: true },
      });
      const saldoDisponivel = Number(saldoEmpresa?.saldoDisponivel ?? 0);
      if (saldoDisponivel < somaQuantidade) {
        alertas.push({
          codigo: 'SALDO_INSUFICIENTE',
          mensagem: `Saldo da empresa (${saldoDisponivel} tokens) é menor que o total do lote (${somaQuantidade}). Compre mais tokens ou ajuste as quantidades.`,
          severidade: 'bloqueante',
        });
      }
      if (invalidos.length > 0) {
        alertas.push({
          codigo: 'MEMBROS_INVALIDOS',
          mensagem: `${invalidos.length} destinatário(s) não são MEMBRO_ATIVO deste convênio ou estão inativos. Aprove ou remova antes de distribuir.`,
          severidade: 'bloqueante',
        });
      }
      return {
        totalItens: items.length,
        alertas,
        resumo: {
          convenioId,
          somaQuantidade,
          somaValorReais,
          somaLiquido,
          taxaTransfer,
          saldoEmpresaAntes: saldoDisponivel,
          saldoEmpresaDepois: saldoDisponivel - somaQuantidade,
          membrosValidos: distribuicoes.length - invalidos.length,
          membrosInvalidos: invalidos.length,
          naturezaDistribuicao,
        },
      };
    };

    // ── Commit callback (Serializable) ──
    const commitCb = async ({
      tx,
      items,
    }: {
      tx: Prisma.TransactionClient;
      items: typeof distribuicoes;
    }): Promise<DistribuirResultado> => {
      // Re-snapshot saldo DENTRO da tx (tudo-ou-nada).
      const saldoEmpresa = await tx.cooperTokenSaldo.findUnique({
        where: { cooperadoId: empresaCooperadoId },
      });
      if (!saldoEmpresa || Number(saldoEmpresa.saldoDisponivel) < somaQuantidade) {
        throw new BadRequestException(
          `Saldo insuficiente DENTRO da tx (race com outro lote?). Disponível: ${Number(saldoEmpresa?.saldoDisponivel ?? 0)}, soma do lote: ${somaQuantidade}. Tente novamente.`,
        );
      }

      const saldoAntes = Number(saldoEmpresa.saldoDisponivel);
      let saldoAtualEmpresa = saldoAntes;
      const linhas: Array<{
        destinatarioCooperadoId: string;
        quantidade: number;
        ledgerDebitoId: string;
        ledgerCreditoId: string;
        tokenTransacaoId: string;
        jti: string;
      }> = [];

      for (let i = 0; i < items.length; i++) {
        const { destinatarioCooperadoId, quantidade } = items[i];

        // F3 C.1 GAP-F3-6 (12/06/2026) — antes: N updates do saldo da empresa
        // (1 por linha). Agora: calcula saldoApos cumulativo pra cada ledger
        // entry, mas o UPDATE real do saldo acontece UMA vez no fim do loop.
        // Reduz ops de 2N+1 pra N+1 e simplifica o caminho crítico.
        saldoAtualEmpresa = Math.round((saldoAtualEmpresa - quantidade) * 10000) / 10000;
        const ledgerDebito = await tx.cooperTokenLedger.create({
          data: {
            cooperadoId: empresaCooperadoId,
            cooperativaId,
            tipo: CooperTokenTipo.DISTRIBUICAO_CONVENIO,
            operacao: CooperTokenOperacao.DEBITO,
            quantidade,
            saldoApos: saldoAtualEmpresa,
            descricao: `Distribuição p/ funcionário ${destinatarioCooperadoId} (lote ${clientRequestId.slice(0, 8)}…)`,
            // Idempotência de lote: 1ª linha (i=0) grava a referência. Linhas
            // seguintes ficam sem (já estão amarradas via mesma tx + auditLog).
            ...(i === 0
              ? { referenciaId: clientRequestId, referenciaTabela: 'MASS_WRITE_DISTRIBUICAO' }
              : {}),
          },
        });

        // Crédito ao destinatário.
        const saldoDestExistente = await tx.cooperTokenSaldo.findUnique({
          where: { cooperadoId: destinatarioCooperadoId },
        });
        let novoSaldoDest: number;
        if (saldoDestExistente) {
          novoSaldoDest = Math.round(
            (Number(saldoDestExistente.saldoDisponivel) + quantidade) * 10000,
          ) / 10000;
          await tx.cooperTokenSaldo.update({
            where: { cooperadoId: destinatarioCooperadoId },
            data: {
              saldoDisponivel: novoSaldoDest,
              totalEmitido: { increment: quantidade },
            },
          });
        } else {
          novoSaldoDest = quantidade;
          await tx.cooperTokenSaldo.create({
            data: {
              cooperadoId: destinatarioCooperadoId,
              cooperativaId,
              saldoDisponivel: quantidade,
              totalEmitido: quantidade,
            },
          });
        }
        const ledgerCredito = await tx.cooperTokenLedger.create({
          data: {
            cooperadoId: destinatarioCooperadoId,
            cooperativaId,
            tipo: CooperTokenTipo.DISTRIBUICAO_CONVENIO,
            operacao: CooperTokenOperacao.CREDITO,
            quantidade,
            saldoApos: novoSaldoDest,
            descricao: `Recebimento de tokens distribuídos pela empresa ${empresa.nomeCompleto} (lote ${clientRequestId.slice(0, 8)}…)`,
          },
        });

        // TokenTransacao paralela (jti anti-replay + tier + motivoStepUp +
        // naturezaDistribuicao + empresaDeclaraTetoClt — defesa CLT auditável).
        const valorReaisLinha = Math.round(quantidade * valorTokenReais * 100) / 100;
        const tokenTx = await criarTokenTransacao(tx, {
          pagadorId: empresaCooperadoId,
          pagadorCooperativaId: cooperativaId,
          recebedorId: destinatarioCooperadoId,
          recebedorCooperativaId: cooperativaId,
          quantidadeTokens: quantidade,
          valorReaisEstimado: valorReaisLinha,
          tipoOperacao: 'TRANSFERENCIA',
          status: 'CONFIRMADA',
          pinValidadoEm: new Date(),
          descricao: descricao ?? `Distribuição ${naturezaDistribuicao} (convênio ${convenioId})`,
          referenciaExterna: clientRequestId,
        });

        // Persistir naturezaDistribuicao + empresaDeclaraTetoClt (Bloco A
        // schema delta) — não está no helper porque é F3-specific. Update
        // pós-create (criarTokenTransacao não tem esses campos no params).
        // F3 C.1 carona P3 — filtro multi-tenant também no update por id
        // (Prisma não tem updateMany filtro composto leve aqui; mas garantir
        // pagadorCooperativaId fechado defende contra row vazada caso o id
        // viesse de input não confiável; aqui vem do create acima, então
        // é segurança redundante mas barata).
        await tx.tokenTransacao.updateMany({
          where: { id: tokenTx.id, pagadorCooperativaId: cooperativaId },
          data: {
            naturezaDistribuicao,
            empresaDeclaraTetoClt:
              naturezaDistribuicao === 'VOLUNTARIA' ? !!empresaDeclaraTetoClt : null,
          },
        });

        linhas.push({
          destinatarioCooperadoId,
          quantidade,
          ledgerDebitoId: ledgerDebito.id,
          ledgerCreditoId: ledgerCredito.id,
          tokenTransacaoId: tokenTx.id,
          jti: tokenTx.jti,
        });
      }

      // F3 C.1 GAP-F3-6 — único update do saldo da empresa NO FIM com o total
      // pré-calculado (soma — já com round). totalResgatado também consolidado.
      await tx.cooperTokenSaldo.update({
        where: { cooperadoId: empresaCooperadoId },
        data: {
          saldoDisponivel: saldoAtualEmpresa,
          totalResgatado: { increment: somaQuantidade },
        },
      });

      this.logger.log(
        `[F3] Distribuição lote=${clientRequestId.slice(0, 8)}… empresa=${empresaCooperadoId} convênio=${convenioId} linhas=${linhas.length} soma=${somaQuantidade} natureza=${naturezaDistribuicao} saldoAntes=${saldoAntes} saldoDepois=${saldoAtualEmpresa}`,
      );

      return {
        clientRequestId,
        distribuidos: linhas.length,
        somaQuantidade,
        somaValorReais,
        somaLiquido,
        taxaTransfer,
        saldoEmpresaAntes: saldoAntes,
        saldoEmpresaDepois: saldoAtualEmpresa,
        naturezaDistribuicao,
        linhas,
      };
    };

    // ── Executar via helper mass-write ──
    return executarMassWrite(this.prisma, {
      acao: 'MASS_WRITE_DISTRIBUICAO',
      cooperativaId,
      usuarioId: empresaCooperadoId, // empresa-PJ é o "usuário" da ação
      clientRequestId,
      items: distribuicoes,
      mode: modo,
      verificarIdempotencia,
      preview: previewCb,
      commit: commitCb,
      logExtra: () => ({
        convenioId,
        somaQuantidade,
        somaValorReais,
        naturezaDistribuicao,
        empresaDeclaraTetoClt: empresaDeclaraTetoClt ?? null,
      }),
      ip,
      userAgent,
    });
  }

  /**
   * F3 Bloco C (12/06/2026) — Helper de UI: empresa-PJ consulta saldo +
   * membros do convênio (segregados por status) num único request.
   *
   * Multi-tenant: valida que a empresa é a `conveniada` do convênio.
   * Não toca dinheiro — só leitura.
   */
  async listarMembrosDisponiveisPraDistribuicao(params: {
    empresaCooperadoId: string;
    cooperativaId: string;
    convenioId: string;
  }) {
    const { empresaCooperadoId, cooperativaId, convenioId } = params;

    // Guard convênio + ownership (mesma regra do POST /distribuir).
    const convenio = await this.prisma.contratoConvenio.findFirst({
      where: { id: convenioId, cooperativaId },
      select: {
        id: true,
        numero: true,
        empresaNome: true,
        conveniadoId: true,
        status: true,
      },
    });
    if (!convenio) {
      throw new NotFoundException('Convênio não encontrado.');
    }
    if (convenio.conveniadoId !== empresaCooperadoId) {
      throw new ForbiddenException(
        'Apenas a empresa conveniada (representante) pode listar membros pra distribuição.',
      );
    }

    // Saldo da empresa (pra UI mostrar quanto tem).
    const saldoEmpresa = await this.prisma.cooperTokenSaldo.findUnique({
      where: { cooperadoId: empresaCooperadoId },
      select: { saldoDisponivel: true, totalEmitido: true, totalResgatado: true },
    });

    // Membros segregados por status.
    // F3 C.1 MT-A — filtro multi-tenant SQL explícito via relação `cooperado.is`
    // (defense-in-depth — convenioCooperado é filtrado por convenioId, mas o
    // cooperado linked pode teoricamente estar em outra cooperativa por bug;
    // SQL explícito barra de qualquer jeito).
    // F3 C.1 MT-B — remover `cpf` e `telefone` do select (over-fetch de PII
    // descartada — UI usa nome + email + matricula).
    const membros = await this.prisma.convenioCooperado.findMany({
      where: { convenioId, cooperado: { is: { cooperativaId } } },
      select: {
        id: true,
        cooperadoId: true,
        status: true,
        ativo: true,
        matricula: true,
        cooperado: {
          select: {
            nomeCompleto: true,
            email: true,
            status: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    const ativos = membros.filter(
      (m) =>
        m.ativo &&
        m.status === 'MEMBRO_ATIVO' &&
        CooperTokenService.STATUS_PERMITIDOS_CREDITO.includes(m.cooperado.status),
    );
    const pendentes = membros.filter((m) =>
      m.status === 'PENDENTE_APROVACAO_EMPRESA' || m.status === 'PENDENTE_APROVACAO_ADMIN',
    );
    const inativos = membros.filter(
      (m) =>
        !ativos.includes(m) &&
        !pendentes.includes(m),
    );

    // Config pro UI calcular valor R$ no front (sem bater no banco a cada digito).
    const config = await this.getConfig(cooperativaId);
    const valorTokenReais = Number(config?.valorTokenReais ?? 0.45);

    return {
      convenio: {
        id: convenio.id,
        numero: convenio.numero,
        empresaNome: convenio.empresaNome,
        status: convenio.status,
      },
      saldoEmpresa: {
        saldoDisponivel: Number(saldoEmpresa?.saldoDisponivel ?? 0),
        totalEmitido: Number(saldoEmpresa?.totalEmitido ?? 0),
        totalResgatado: Number(saldoEmpresa?.totalResgatado ?? 0),
      },
      config: { valorTokenReais },
      membros: {
        ativos: ativos.map((m) => ({
          membroId: m.id,
          cooperadoId: m.cooperadoId,
          nomeCompleto: m.cooperado.nomeCompleto,
          email: m.cooperado.email,
          matricula: m.matricula,
        })),
        pendentes: {
          total: pendentes.length,
          breakdown: {
            empresa: pendentes.filter((m) => m.status === 'PENDENTE_APROVACAO_EMPRESA').length,
            admin: pendentes.filter((m) => m.status === 'PENDENTE_APROVACAO_ADMIN').length,
          },
        },
        inativosCount: inativos.length,
      },
    };
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
      bonusIndicacao?: number;
      tetoCoop?: number | null;
      ativo?: boolean;
      // F1.5 Bloco 2 — Taxa de Operacao (% E/OU fixo por operacao)
      taxaEmissaoPerc?: number;
      taxaEmissaoFixa?: number;
      taxaQrPerc?: number;
      taxaQrFixa?: number;
      taxaTransferenciaPerc?: number;
      taxaTransferenciaFixa?: number;
      taxaResgatePerc?: number;
      taxaResgateFixa?: number;
      // F1.5 Bloco 3 — Oxidacao DECAY_CONTINUO
      oxidacaoPercMes?: number;
      oxidacaoPeriodoGracaDias?: number;
      oxidacaoPiso?: number;
    },
  ) {
    // F1.5 MT P2 (10/06/2026) — Defesa em profundidade. Controller ja
    // valida e lanca 400 antes, mas o service tambem trava qualquer chamador
    // interno futuro que passe undefined/empty (evita where: { cooperativaId:
    // undefined } no Prisma).
    if (!cooperativaId) {
      throw new BadRequestException('cooperativaId obrigatorio em upsertConfig.');
    }
    const payload: Prisma.ConfigCooperTokenUncheckedUpdateInput = {
      ...data,
      valorTokenReais: data.valorTokenReais != null
        ? Math.round(data.valorTokenReais * 100) / 100
        : undefined,
      descontoMaxPerc: data.descontoMaxPerc != null
        ? Math.round(data.descontoMaxPerc * 100) / 100
        : undefined,
      // F1.5 Bloco 2: arredondamento das taxas em 4 casas (formato tokens).
      taxaEmissaoPerc: data.taxaEmissaoPerc != null
        ? Math.round(data.taxaEmissaoPerc * 100) / 100 : undefined,
      taxaEmissaoFixa: data.taxaEmissaoFixa != null
        ? Math.round(data.taxaEmissaoFixa * 10000) / 10000 : undefined,
      taxaQrPerc: data.taxaQrPerc != null
        ? Math.round(data.taxaQrPerc * 100) / 100 : undefined,
      taxaQrFixa: data.taxaQrFixa != null
        ? Math.round(data.taxaQrFixa * 10000) / 10000 : undefined,
      taxaTransferenciaPerc: data.taxaTransferenciaPerc != null
        ? Math.round(data.taxaTransferenciaPerc * 100) / 100 : undefined,
      taxaTransferenciaFixa: data.taxaTransferenciaFixa != null
        ? Math.round(data.taxaTransferenciaFixa * 10000) / 10000 : undefined,
      taxaResgatePerc: data.taxaResgatePerc != null
        ? Math.round(data.taxaResgatePerc * 100) / 100 : undefined,
      taxaResgateFixa: data.taxaResgateFixa != null
        ? Math.round(data.taxaResgateFixa * 10000) / 10000 : undefined,
      // F1.5 Bloco 3: oxidacao normalizada em 4 casas.
      oxidacaoPercMes: data.oxidacaoPercMes != null
        ? Math.round(data.oxidacaoPercMes * 100) / 100 : undefined,
      oxidacaoPeriodoGracaDias: data.oxidacaoPeriodoGracaDias,
      oxidacaoPiso: data.oxidacaoPiso != null
        ? Math.round(data.oxidacaoPiso * 10000) / 10000 : undefined,
    };

    // F1.5 Bloco 3 (10/06/2026) — Marco prospectivo `oxidacaoAtivadaEm`.
    // Carimba quando admin sobe `oxidacaoPercMes` de 0 (ou config nova) → >0.
    // Limpa marco quando admin desliga (volta pra 0). Tokens com
    // ledger.createdAt < oxidacaoAtivadaEm NUNCA sao oxidados.
    if (data.oxidacaoPercMes !== undefined) {
      const novoPerc = data.oxidacaoPercMes;
      const atual = await this.prisma.configCooperToken.findUnique({
        where: { cooperativaId },
        select: { oxidacaoPercMes: true, oxidacaoAtivadaEm: true },
      });
      const percAtual = atual ? Number(atual.oxidacaoPercMes) : 0;
      if (novoPerc > 0 && percAtual <= 0) {
        // Ligou: carimba marco AGORA.
        payload.oxidacaoAtivadaEm = new Date();
      } else if (novoPerc <= 0 && percAtual > 0) {
        // Desligou: limpa marco (nunca mais oxida ate religar).
        payload.oxidacaoAtivadaEm = null;
      }
      // Caso ja estava >0 e continua >0 (so muda a porcentagem) — marco
      // PRESERVADO. Mudar % nao reinicia prospectividade.
    }

    return this.prisma.configCooperToken.upsert({
      where: { cooperativaId },
      update: payload,
      create: { cooperativaId, ...payload } as Prisma.ConfigCooperTokenUncheckedCreateInput,
    });
  }

  /**
   * Sprint Clube P1 — Fase 1.5 Bloco 3 (10/06/2026).
   *
   * Aplica oxidacao DECAY_CONTINUO no saldo dos cooperados de uma
   * cooperativa, respeitando 3 invariantes inegociaveis:
   *
   *  1. PROSPECTIVIDADE: tokens com `ledger.createdAt < oxidacaoAtivadaEm`
   *     NUNCA sao oxidados. Sempre preservados.
   *  2. PERIODO DE GRACA: tokens emitidos a menos de `oxidacaoPeriodoGracaDias`
   *     dias atras NUNCA sao oxidados. Recencia preservada.
   *  3. PISO: saldoDisponivel apos oxidacao NUNCA cai abaixo de `oxidacaoPiso`.
   *
   * Modelo conservador (defensivo):
   *   saldoElegivel = max(0, saldoAtual - preservados)
   *   preservados   = soma de CREDITO com createdAt < oxidacaoAtivadaEm
   *                 + soma de CREDITO com createdAt > now - graca
   *   decaimento    = round(saldoElegivel * percMes / 100, 4)
   *   novoSaldo     = max(saldoAtual - decaimento, piso)
   *
   * Esta formula NAO rastreia FIFO real, mas garante que tokens preservados
   * nunca somem matematicamente — oxidacao SEMPRE menor ou igual ao
   * verdadeiro saldo elegivel.
   *
   * Audit trail: cada oxidacao por cooperado cria entrada
   * CooperTokenLedger(OXIDACAO) com saldoApos final e descricao
   * explicando o calculo aplicado.
   *
   * Tenant scope: cooperativaId vindo do JOB que itera Cooperativa.findMany,
   * ou direto do controller (caso futuro de execucao manual com tenant
   * extraido do JWT).
   */
  async aplicarOxidacao(cooperativaId: string): Promise<{
    cooperadosAfetados: number;
    totalTokensReduzidos: number;
  }> {
    // F1.5 G3 (10/06/2026) — Gate juridico TAMBEM aqui no service (alem do
    // cron em cooper-token.job.ts:aplicarOxidacaoMensal). Defense in depth:
    // qualquer chamador futuro (controller manual, script de operacao, smoke)
    // sera barrado em producao real sem a flag.
    if (isAmbienteReal() && process.env.OXIDACAO_PRODUCAO_LIBERADA !== 'true') {
      this.logger.warn(
        `[oxidacao] ${cooperativaId}: gate juridico ATIVO em producao (OXIDACAO_PRODUCAO_LIBERADA != true). SKIPADO. Liberar so apos politica de quebra escrita/aprovada + auditoria.`,
      );
      return { cooperadosAfetados: 0, totalTokensReduzidos: 0 };
    }

    const config = await this.getConfig(cooperativaId);
    if (!config) {
      this.logger.log(
        `[oxidacao] ${cooperativaId}: sem config — skip (oxidacao desligada).`,
      );
      return { cooperadosAfetados: 0, totalTokensReduzidos: 0 };
    }

    const percMes = Number(config.oxidacaoPercMes);
    if (percMes <= 0 || !config.oxidacaoAtivadaEm) {
      this.logger.log(
        `[oxidacao] ${cooperativaId}: desligada (percMes=${percMes}, ativadaEm=${config.oxidacaoAtivadaEm ?? 'null'}) — skip.`,
      );
      return { cooperadosAfetados: 0, totalTokensReduzidos: 0 };
    }

    const gracaDias = Number(config.oxidacaoPeriodoGracaDias) || 0;
    const piso = Number(config.oxidacaoPiso);
    const ativadaEm = config.oxidacaoAtivadaEm;
    const agora = new Date();
    const limiteGraca = new Date(agora.getTime() - gracaDias * 86400000);

    // Cooperados com saldo > 0 nesta cooperativa (potenciais candidatos).
    const saldos = await this.prisma.cooperTokenSaldo.findMany({
      where: {
        saldoDisponivel: { gt: 0 },
        cooperado: { cooperativaId, status: { in: ['ATIVO', 'ATIVO_RECEBENDO_CREDITOS'] } },
      },
      select: { cooperadoId: true, saldoDisponivel: true },
    });

    let cooperadosAfetados = 0;
    let totalTokensReduzidos = 0;

    for (const s of saldos) {
      const saldoAtual = Number(s.saldoDisponivel);
      if (saldoAtual <= piso) continue;

      // Preservados = creditos PRE-marco + creditos em GRACA.
      const [creditosPreMarcoAgg, creditosEmGracaAgg] = await Promise.all([
        this.prisma.cooperTokenLedger.aggregate({
          _sum: { quantidade: true },
          where: {
            cooperadoId: s.cooperadoId,
            cooperativaId,
            operacao: CooperTokenOperacao.CREDITO,
            createdAt: { lt: ativadaEm },
          },
        }),
        this.prisma.cooperTokenLedger.aggregate({
          _sum: { quantidade: true },
          where: {
            cooperadoId: s.cooperadoId,
            cooperativaId,
            operacao: CooperTokenOperacao.CREDITO,
            createdAt: { gt: limiteGraca },
          },
        }),
      ]);

      const preservados =
        Number(creditosPreMarcoAgg._sum.quantidade ?? 0) +
        Number(creditosEmGracaAgg._sum.quantidade ?? 0);

      const saldoElegivel = Math.max(0, saldoAtual - preservados);
      if (saldoElegivel <= 0) continue;

      const decaimentoBruto = Math.round((saldoElegivel * percMes) / 100 * 10000) / 10000;
      const novoSaldoCalculado = saldoAtual - decaimentoBruto;
      const novoSaldo = Math.max(novoSaldoCalculado, piso);
      const reducaoReal = Math.round((saldoAtual - novoSaldo) * 10000) / 10000;

      if (reducaoReal <= 0) continue;

      await this.prisma.$transaction(async (tx) => {
        await tx.cooperTokenSaldo.update({
          where: { cooperadoId: s.cooperadoId },
          data: { saldoDisponivel: novoSaldo },
        });
        await tx.cooperTokenLedger.create({
          data: {
            cooperadoId: s.cooperadoId,
            cooperativaId,
            tipo: 'DESCONTO_FATURA' as CooperTokenTipo,
            operacao: CooperTokenOperacao.OXIDACAO,
            quantidade: reducaoReal,
            saldoApos: novoSaldo,
            descricao:
              `Oxidacao DECAY_CONTINUO ${percMes}% sobre elegivel ${saldoElegivel}` +
              ` (graca ${gracaDias}d, piso ${piso}) — reducao ${reducaoReal}`,
          },
        });
      });

      cooperadosAfetados += 1;
      totalTokensReduzidos = Math.round((totalTokensReduzidos + reducaoReal) * 10000) / 10000;
    }

    this.logger.log(
      `[oxidacao] ${cooperativaId}: ${cooperadosAfetados} cooperados afetados, ${totalTokensReduzidos} tokens reduzidos (perc=${percMes}%, graca=${gracaDias}d, piso=${piso}, ativadaEm=${ativadaEm.toISOString()})`,
    );

    return { cooperadosAfetados, totalTokensReduzidos };
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

  /**
   * Processa QR de pagamento cooperado→cooperado.
   *
   * F4 Bloco C (12/06/2026):
   *  - `pin` opcional no service (caminho cooperado→cooperado via controller
   *    exige; caminho `processarQrParceiro` que reusa este método NÃO passa
   *    PIN porque o parceiro confia no QR JWT já assinado e o pagador não
   *    está presente no fluxo do parceiro). Trade-off documentado.
   *  - `$transaction` agora com `isolationLevel: Serializable` (era default
   *    ReadCommitted). 2 escaneamentos paralelos do mesmo QR ou serializam
   *    ou um aborta com 40001.
   *  - `criarTokenTransacao(tx, ...)` dentro da tx (audit + jti anti-replay
   *    + tier baseado em valorReais).
   *
   * F0 INTOCÁVEL (decisão Luciano 12/06): a TAXA do QR continua sendo
   * cobrada UMA ÚNICA VEZ via `calcularTaxa('qr')` sobre o bruto, ANTES
   * de abrir a tx. O helper criarTokenTransacao NÃO recalcula taxa —
   * registra apenas quantidade bruta + valor R$.
   */
  async processarPagamentoQr(params: {
    qrToken: string;
    recebedorId: string;
    recebedorCooperativaId: string;
    /** F4 Bloco C — PIN do pagador. Opcional no service; controller exige. */
    pin?: string;
  }) {
    const { qrToken, recebedorId, recebedorCooperativaId, pin } = params;

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

    // F4 Bloco C — PIN FORA da tx (mesmo padrão de usarNaFatura). Só valida
    // se o caller passou `pin` — controller cooperado→cooperado exige; o
    // caminho processarQrParceiro (parceiro recebe) reusa este método sem
    // PIN, e a defesa é o JWT do QR + jti em criarTokenTransacao.
    let pinValidadoEm: Date | null = null;
    if (pin) {
      if (!/^\d{6}$/.test(pin)) {
        throw new BadRequestException('PIN deve ter 6 dígitos numéricos.');
      }
      if (!this.pinCooperadoService) {
        throw new Error(
          'PinCooperadoService não disponível (wiring do módulo).',
        );
      }
      const pinResult = await this.pinCooperadoService.validarPinComLockout({
        cooperadoId: decoded.pagadorId,
        cooperativaId: decoded.cooperativaId,
        pin,
      });
      if (!pinResult.ok) {
        if (pinResult.motivo === 'PIN_NAO_DEFINIDO') {
          throw new BadRequestException(
            'PIN do pagador ainda não foi definido. Configure no portal antes de operar.',
          );
        }
        if (pinResult.motivo === 'PIN_BLOQUEADO') {
          throw new ForbiddenException(
            `PIN do pagador bloqueado por excesso de tentativas. Tente novamente após ${pinResult.desbloqueiaEm.toISOString()}.`,
          );
        }
        throw new ForbiddenException('PIN do pagador incorreto.');
      }
      pinValidadoEm = new Date();
    }

    // F1.5 Bloco 2 — Taxa de QR agora vem da ConfigCooperToken do tenant
    // (campos taxaQrPerc + taxaQrFixa). Fallback: 1% + 0 quando config null
    // (preserva TAXA_QR antigo). Cobrada UMA UNICA VEZ sobre o bruto —
    // processarQrParceiro reusa { taxa, quantidadeLiquida } daqui sem
    // reaplicar (F0 preservado).
    const configQr = await this.getConfig(recebedorCooperativaId);
    const { taxa, liquido: quantidadeLiquida } = calcularTaxa(
      'qr',
      decoded.quantidade,
      configQr,
    );

    // F4 Bloco C — valor R$ pra tier (usa valorTokenReais da config; fallback
    // 0.45 igual aos demais paths). Calculado fora da tx (read-only).
    const valorTokenReais = Number(configQr?.valorTokenReais ?? 0.45);
    const valorReaisEstimado =
      Math.round(decoded.quantidade * valorTokenReais * 100) / 100;

    // F4 Bloco C.1 FIN-1 — limite por transação / diário do PAGADOR ANTES da tx.
    await this.assertLimite({
      cooperadoId: decoded.pagadorId,
      cooperativaId: decoded.cooperativaId,
      valorReais: valorReaisEstimado,
      origem: 'processarPagamentoQr',
    });

    return this.prisma.$transaction(async (tx) => {
      // F4 Bloco C.1 MT-5 — saldo do pagador filtrado por cooperativaId
      // (defesa em profundidade; JWT do QR já trouxe cooperativaId, mas se
      // alguém forjar pagadorId apontando pra outra tenant, o filtro barra).
      const saldoPagador = await tx.cooperTokenSaldo.findFirst({
        where: {
          cooperadoId: decoded.pagadorId,
          cooperativaId: decoded.cooperativaId,
        },
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
          // F1.5 G2 (10/06/2026) — sem string hardcoded "1%": taxa real
          // calculada via calcularTaxa() vai pra descricao.
          descricao: `Recebimento QR de ${quantidadeLiquida} tokens (líquido, taxa: ${taxa})`,
        },
      });

      // F0 (09/06/2026) — Cessão peer-to-peer entre cooperados NÃO emite saldo
      // novo pra cooperativa: tokens circulam, não nascem. O crédito ao
      // CooperTokenSaldoParceiro fica restrito aos paths legítimos
      // (confirmarCompraParceiro, resgate Clube, processarQrParceiro).

      // F4 Bloco C (12/06/2026) — TokenTransacao paralela (audit + jti).
      // Tipo PAGAMENTO; quantidade BRUTA (TokenTransacao reflete o valor
      // que saiu do pagador, não o líquido que chegou no recebedor).
      // Taxa F0 INTOCÁVEL — registramos em descricao mas helper não
      // recalcula. qrExpiresAt=null porque o JWT do QR já foi consumido
      // (não há expiração futura — a tx em si é a operação confirmada).
      const tokenTx = await criarTokenTransacao(tx, {
        pagadorId: decoded.pagadorId,
        pagadorCooperativaId: decoded.cooperativaId,
        recebedorId,
        recebedorCooperativaId,
        quantidadeTokens: decoded.quantidade,
        valorReaisEstimado,
        tipoOperacao: 'PAGAMENTO',
        status: 'CONFIRMADA',
        pinValidadoEm,
        descricao: `Pagamento QR (taxa F1.5 qr: ${taxa})`,
      });

      this.logger.log(
        `[F4-C] Pagamento QR: ${decoded.pagadorId} → ${recebedorId}, ${decoded.quantidade} tokens (taxa: ${taxa} jti=${tokenTx.jti} tier=${tokenTx.tier} motivo=${tokenTx.motivoStepUp ?? 'NONE'})`,
      );

      // Sprint 9: emitir evento pra notificação WA
      this.eventEmitter.emit('cooper-token.transferencia-qr', {
        pagadorId: decoded.pagadorId,
        recebedorId,
        quantidade: decoded.quantidade,
        quantidadeLiquida,
        taxa,
        cooperativaId: decoded.cooperativaId,
      });

      return {
        sucesso: true,
        quantidadeBruta: decoded.quantidade,
        taxa,
        quantidadeLiquida,
        pagadorId: decoded.pagadorId,
        recebedorId,
        tokenTransacaoId: tokenTx.id,
        tokenTransacaoJti: tokenTx.jti,
        tier: tokenTx.tier,
      };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
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

    // F0 (09/06/2026) — TAXA_QR é cobrada UMA ÚNICA VEZ sobre o bruto dentro
    // de processarPagamentoQr (linhas 978-980). Reusar o que ja saiu de la em
    // vez de reaplicar TAXA_QR sobre o liquido (era ~1,99% efetivo: 98,01 em
    // vez de 99 num bruto de 100).
    const taxa1Pct = resultado.taxa;
    const liquidoParceiro = resultado.quantidadeLiquida;

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

  /**
   * Cooperado abate fatura com tokens.
   *
   * F4 Bloco A (12/06/2026) — blindagem de 3 camadas:
   *  1. PIN obrigatório (6 dígitos) via `PinCooperadoService.validarPinComLockout`
   *     (rate-limit 5 tentativas, lockout 30min, multi-tenant updateMany).
   *  2. `$transaction` com `isolationLevel: Serializable` envolve ler-saldo +
   *     debitar + atualizar cobrança — Postgres garante linearizabilidade,
   *     duas chamadas concorrentes ou serializam ou uma aborta com `40001`.
   *  3. `updateMany` da cobrança com status-guard `{ A_VENCER, VENCIDO }`:
   *     se entre o read e o write a cobrança mudou (ex: pagamento Asaas
   *     chegou via webhook), `count === 0` → BadRequestException, sem
   *     overwrite silencioso de PAGA. Mata o D-novo-F4-RACE catalogado.
   *
   * Não usa `this.debitar()` (que abre própria $transaction sem isolationLevel)
   * — em vez disso inlina a lógica de débito dentro da tx Serializable, pra
   * garantir uma única unidade atômica. Bloco B (helper `criarTokenTransacao`
   * + jti anti-replay) entra depois do schema delta de TokenTransacao.
   */
  async usarNaFatura(params: {
    cooperadoId: string;
    cooperativaId: string;
    cobrancaId: string;
    quantidadeTokens: number;
    /** F4 Bloco A — PIN 6 dígitos. DTO valida regex, service só repassa. */
    pin: string;
  }) {
    const { cooperadoId, cooperativaId, cobrancaId, quantidadeTokens, pin } = params;

    if (quantidadeTokens <= 0) {
      throw new BadRequestException('Quantidade de tokens deve ser maior que zero');
    }
    if (!pin || !/^\d{6}$/.test(pin)) {
      throw new BadRequestException('PIN obrigatório (6 dígitos numéricos).');
    }
    if (!this.pinCooperadoService) {
      // F4 Bloco A: optional injection — em prod sempre vem. Se faltar, é
      // bug de wiring de módulo e não falha silenciosa.
      throw new Error('PinCooperadoService não disponível (wiring do módulo).');
    }

    // ── PIN FORA da tx ──
    // Rate-limit/lockout não pode bloquear linha do saldo. Atualiza
    // contadores em cooperado.pinTentativas/pinBloqueadoAte (linhas
    // diferentes do saldo + cobrança da tx Serializable abaixo).
    const pinResult = await this.pinCooperadoService.validarPinComLockout({
      cooperadoId,
      pin,
      cooperativaId,
    });
    if (!pinResult.ok) {
      if (pinResult.motivo === 'PIN_NAO_DEFINIDO') {
        throw new BadRequestException(
          'PIN ainda não foi definido. Configure seu PIN no portal antes de operar.',
        );
      }
      if (pinResult.motivo === 'PIN_BLOQUEADO') {
        throw new ForbiddenException(
          `PIN bloqueado por excesso de tentativas. Tente novamente após ${pinResult.desbloqueiaEm.toISOString()}.`,
        );
      }
      throw new ForbiddenException('PIN incorreto.');
    }

    // F4 Bloco C.1 FIN-1 — verifica limite por transação / diário ANTES da
    // tx Serializable (não bloqueia row do saldo se o caller já vai abortar).
    // valorReais = valor MÁXIMO possível do desconto = valorLiquido da cobrança.
    // O clamp triplo dentro da tx pode reduzir, mas pra autorização usamos
    // o teto (mais conservador — se o usuário pediu R$ 100 e o limite é R$ 50,
    // bloqueamos mesmo que o clamp fosse aplicar só R$ 40).
    // Pré-leitura read-only fora da tx só pra obter valorLiquido pro guard.
    const cobrancaPreview = await this.prisma.cobranca.findFirst({
      where: { id: cobrancaId, contrato: { cooperadoId, cooperativaId } },
      select: { valorLiquido: true },
    });
    if (cobrancaPreview) {
      const valorPreLim = Math.min(
        Number(cobrancaPreview.valorLiquido),
        quantidadeTokens * 0.45, // upper bound usando default; clamp real dentro da tx
      );
      await this.assertLimite({
        cooperadoId,
        cooperativaId,
        valorReais: valorPreLim,
        origem: 'usarNaFatura',
      });
    }

    // ── Tx Serializable: ler cobrança/saldo + debitar + atualizar cobrança ──
    const txResult = await this.prisma.$transaction(
      async (tx) => {
        // F4 Bloco C.1 MT-1 — multi-tenant via JOIN com contrato (cobrança
        // tem cooperativaId? nullable; usamos contrato.{cooperadoId,
        // cooperativaId} como fonte de verdade). NotFound genérica não
        // revela existência de cobrança em outro tenant.
        const cobranca = await tx.cobranca.findFirst({
          where: {
            id: cobrancaId,
            contrato: { cooperadoId, cooperativaId },
          },
          include: { contrato: { include: { plano: true } } },
        });
        if (!cobranca) {
          throw new NotFoundException('Cobrança não encontrada');
        }
        const statusAtual = cobranca.status as string;
        if (statusAtual !== 'A_VENCER' && statusAtual !== 'VENCIDO') {
          throw new BadRequestException(
            'Só é possível usar tokens em cobranças A_VENCER ou VENCIDO',
          );
        }

        // F4 Bloco C.1 FIN-2 — status do cooperado DENTRO da tx (mesmo
        // padrão de creditar() :134). SUSPENSO/INATIVO/CADASTRO_INCOMPLETO
        // não gasta. Defesa contra suspensão entre PIN-validation e debit.
        const cooperadoSnap = await tx.cooperado.findUnique({
          where: { id: cooperadoId },
          select: { status: true, cooperativaId: true },
        });
        if (!cooperadoSnap || cooperadoSnap.cooperativaId !== cooperativaId) {
          throw new NotFoundException('Cooperado não encontrado');
        }
        if (!CooperTokenService.STATUS_PERMITIDOS_CREDITO.includes(cooperadoSnap.status)) {
          throw new ForbiddenException(
            `Status ${cooperadoSnap.status} não permite gastar tokens. Status permitido: ATIVO ou ATIVO_RECEBENDO_CREDITOS.`,
          );
        }

        const plano = cobranca.contrato?.plano;
        const valorCobranca = Number(cobranca.valorLiquido);
        const valorToken = Number(plano?.valorTokenReais ?? 0.45);
        const maxPerc = Number(plano?.tokenDescontoMaxPerc ?? 30);

        // Saldo + teto plano DENTRO da tx — clamp final sem race.
        const saldo = await tx.cooperTokenSaldo.findUnique({
          where: { cooperadoId },
        });
        const saldoDisponivel = Number(saldo?.saldoDisponivel ?? 0);

        const descontoMaxReais = (valorCobranca * maxPerc) / 100;
        const tetoTokensPlano = valorToken > 0 ? descontoMaxReais / valorToken : 0;
        const tokensEfetivos = Math.round(
          Math.min(quantidadeTokens, tetoTokensPlano, saldoDisponivel) * 10000,
        ) / 10000;

        if (tokensEfetivos <= 0) {
          throw new BadRequestException(
            'Saldo insuficiente ou desconto máximo já atingido',
          );
        }
        // Defesa redundante (saldo já clampado, mas guard explícito).
        if (!saldo || saldoDisponivel < tokensEfetivos) {
          throw new BadRequestException(
            `Saldo insuficiente. Disponível: ${saldoDisponivel}, solicitado: ${tokensEfetivos}`,
          );
        }

        const descontoReais = Math.round(tokensEfetivos * valorToken * 100) / 100;
        const novoValorLiquido = Math.round(
          (valorCobranca - descontoReais) * 100,
        ) / 100;
        const novoSaldoDisponivel = Math.round(
          (saldoDisponivel - tokensEfetivos) * 10000,
        ) / 10000;

        // ⚠ ESPELHO INLINE de `this.debitar()` (linhas ~260).
        // Não dá pra chamar `debitar()` daqui porque ele abre uma
        // `$transaction` própria — nested transactions em Prisma quebram
        // o isolationLevel Serializable do tx externo. Manter os 2 lugares
        // em sincronia: cálculo de novoSaldo, fields do ledger, e
        // LancamentoCaixa PROVISIONAL idênticos. Bloco B do F4 avalia se
        // vale extrair `_debitarTx(tx, ...)` interno.
        await tx.cooperTokenSaldo.update({
          where: { cooperadoId },
          data: {
            saldoDisponivel: novoSaldoDisponivel,
            totalResgatado: { increment: tokensEfetivos },
          },
        });

        // Ledger de débito.
        const ledger = await tx.cooperTokenLedger.create({
          data: {
            cooperadoId,
            cooperativaId,
            tipo: CooperTokenTipo.DESCONTO_FATURA,
            operacao: CooperTokenOperacao.DEBITO,
            quantidade: tokensEfetivos,
            saldoApos: novoSaldoDisponivel,
            referenciaId: cobrancaId,
            descricao: 'Abatimento na fatura via CooperToken (F4 Bloco A)',
          },
        });

        // Status-guard idempotente: updateMany só passa se cobrança ainda
        // estiver A_VENCER/VENCIDO. Se webhook Asaas mudou pra PAGA entre
        // o read e o write, count === 0 → tx aborta, débito faz rollback.
        const tokenDescontoQtAnterior = Number(cobranca.tokenDescontoQt ?? 0);
        const tokenDescontoReaisAnterior = Number(cobranca.tokenDescontoReais ?? 0);
        const swap = await tx.cobranca.updateMany({
          where: {
            id: cobrancaId,
            status: { in: ['A_VENCER', 'VENCIDO'] as any },
          },
          data: {
            valorLiquido: novoValorLiquido,
            tokenDescontoQt:
              Math.round((tokenDescontoQtAnterior + tokensEfetivos) * 10000) / 10000,
            tokenDescontoReais:
              Math.round((tokenDescontoReaisAnterior + descontoReais) * 100) / 100,
          },
        });
        if (swap.count === 0) {
          throw new BadRequestException(
            'Cobrança mudou de status durante a operação (provavelmente foi paga). Atualize a tela e tente novamente.',
          );
        }

        // LancamentoCaixa PROVISIONAL — mesmo padrão de `debitar()` original
        // (swallow erro pra não derrubar a tx por hint contábil). Roda dentro
        // da tx pra consistência referencial com ledger.id.
        try {
          const competencia = new Date().toISOString().slice(0, 7);
          // F4 Bloco C.1 FIN-7 — antes 0.20 chumbado. Aqui usa o `valorToken`
          // do PLANO da cobrança (já calculado acima como Number(plano.valorTokenReais ?? 0.45)),
          // mais preciso que default da config porque reflete o plano específico.
          const valorEstimado = Math.round(tokensEfetivos * valorToken * 100) / 100;
          await tx.lancamentoCaixa.create({
            data: {
              tipo: 'PROVISIONAL',
              descricao: `Débito DESCONTO_FATURA: ${tokensEfetivos} tokens`,
              valor: valorEstimado,
              competencia,
              status: 'PROVISIONAL',
              naturezaClube: 'PROVISIONAL_TOKEN_ABATIMENTO',
              cooperTokenLedgerId: ledger.id,
              cooperadoId,
              cooperativaId,
            },
          });
        } catch (err) {
          this.logger.warn(
            `LancamentoCaixa PROVISIONAL débito falhou (não derruba tx): ${(err as Error).message}`,
          );
        }

        // F4 Bloco C (12/06/2026) — TokenTransacao paralela pra audit/anti-replay.
        // Sem recebedor (uso de fatura = consumo unilateral). Helper trata
        // sem-recebedor sem disparar DESTINATARIO_NOVO. Tier baseado no valor
        // R$ do desconto. PIN já validado fora da tx → marca pinValidadoEm.
        // status CONFIRMADA porque a operação é síncrona (sem QR/OTP step).
        const tokenTx = await criarTokenTransacao(tx, {
          pagadorId: cooperadoId,
          pagadorCooperativaId: cooperativaId,
          quantidadeTokens: tokensEfetivos,
          valorReaisEstimado: descontoReais,
          tipoOperacao: 'USO_FATURA',
          status: 'CONFIRMADA',
          pinValidadoEm: new Date(),
          descricao: `Abatimento de fatura ${cobrancaId}`,
          referenciaExterna: cobrancaId,
        });

        return {
          novoValorLiquido,
          descontoReais,
          tokensEfetivos,
          ledgerId: ledger.id,
          tokenTransacaoId: tokenTx.id,
          tokenTransacaoJti: tokenTx.jti,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    this.logger.log(
      `[F4-C] Cooperado ${cooperadoId} usou ${txResult.tokensEfetivos} tokens na fatura ${cobrancaId}: desconto R$ ${txResult.descontoReais} (ledger=${txResult.ledgerId} tokenTx=${txResult.tokenTransacaoId} jti=${txResult.tokenTransacaoJti})`,
    );

    // Eventos APÓS commit (fora da tx) — não bloqueiam pagamento.
    this.eventEmitter.emit(
      COOPER_TOKEN_EVENTS.RESGATADO,
      new CooperTokenResgatadoEvent(
        cooperativaId,
        cooperadoId,
        cobrancaId,
        txResult.tokensEfetivos,
        txResult.descontoReais,
      ),
    );

    return {
      novoValor: txResult.novoValorLiquido,
      desconto: txResult.descontoReais,
      tokensUsados: txResult.tokensEfetivos,
    };
  }

  // ── Cooperado-PJ (empresa cooperada): Comprar tokens ──
  // Sprint Clube P1 — Fase 2 Bloco 2 (11/06/2026).

  /**
   * Empresa cooperada PJ compra tokens via Asaas. Diferente do legado
   * `comprarTokensParceiro` que credita `saldoParceiro` (tenant):
   *
   *  - Credito vai pro `CooperTokenSaldo` do proprio cooperado (PJ)
   *    via `creditar()` (que ja aplica `calcularTaxa('emissao')` da
   *    ConfigCooperToken — F1.5 sai de graca).
   *  - Asaas emite cobranca real (PIX/BOLETO) com link de pagamento.
   *  - Webhook Asaas (Bloco 3) confirma pagamento + chama `creditar()`
   *    com idempotencia 2 camadas (CooperTokenCompra.ultimoWebhookEventId
   *    + ledger.referenciaId).
   *
   * Guards:
   *  1. Cooperado existe e pertence ao tenant.
   *  2. `isEmpresaCooperada(cooperado)` true (tipoPessoa=PJ).
   *  3. Status ATIVO ou ATIVO_RECEBENDO_CREDITOS (v1 conservador —
   *     PENDENTE/AGUARDANDO_CONCESSIONARIA nao compram ainda).
   *  4. Quantidade > 0.
   *
   * Reusa shape do legado parceiro/comprar (controller + CooperTokenCompra
   * + confirmacao via evento) — espinha conceitual identica.
   */
  async comprarTokensCooperado(params: {
    compradorCooperadoId: string;
    cooperativaId: string;
    quantidade: number;
    formaPagamento: 'PIX' | 'BOLETO';
  }) {
    const { compradorCooperadoId, cooperativaId, quantidade, formaPagamento } = params;

    if (quantidade <= 0) {
      throw new BadRequestException('Quantidade deve ser maior que zero');
    }

    // Guard multi-tenant: cooperado existe E pertence ao tenant do JWT.
    const cooperado = await this.prisma.cooperado.findFirst({
      where: { id: compradorCooperadoId, cooperativaId },
      select: { id: true, tipoPessoa: true, status: true, nomeCompleto: true },
    });
    if (!cooperado) {
      throw new NotFoundException('Cooperado nao encontrado ou nao pertence ao seu tenant.');
    }

    // Guard semantico: so empresa cooperada PJ pode comprar tokens neste caminho.
    if (!isEmpresaCooperada(cooperado)) {
      throw new ForbiddenException(
        'Apenas empresas cooperadas (PJ) podem comprar tokens. Pessoas fisicas recebem tokens por outros caminhos (excedente, indicacao, etc).',
      );
    }

    // Guard status (v1 conservador — decisao Luciano 11/06).
    const STATUS_PERMITIDOS = ['ATIVO', 'ATIVO_RECEBENDO_CREDITOS'];
    if (!STATUS_PERMITIDOS.includes(cooperado.status)) {
      throw new ForbiddenException(
        `Status ${cooperado.status} nao permite compra de tokens. Status permitidos: ${STATUS_PERMITIDOS.join(', ')}.`,
      );
    }

    // Buscar config para valor do token.
    const config = await this.prisma.configCooperToken.findUnique({
      where: { cooperativaId },
    });
    const valorTokenReais = Number(config?.valorTokenReais ?? 0.45);
    const valorTotal = Math.round(quantidade * valorTokenReais * 100) / 100;

    // 1. Criar registro CooperTokenCompra pendente (sem asaasId ainda).
    const compra = await this.prisma.cooperTokenCompra.create({
      data: {
        cooperativaId,
        compradorCooperadoId,
        quantidade,
        valorTokenReais,
        valorTotal,
        formaPagamento,
        status: 'AGUARDANDO_PAGAMENTO',
      },
    });

    // 2. Emitir cobranca Asaas (vencimento +5 dias).
    if (!this.asaasService) {
      // Fallback defensivo — em testes unitarios o spec instancia o service
      // sem Asaas. Em runtime real o DI sempre injeta (modulo importa
      // AsaasModule no Bloco 2). Lanca pra nao deixar a compra orfa.
      throw new BadRequestException(
        'AsaasService nao disponivel — verifique a configuracao do CooperTokenModule.',
      );
    }
    const vencimento = new Date(Date.now() + 5 * 86400000);
    let asaasCobranca: any;
    try {
      asaasCobranca = await this.asaasService.emitirCobranca(
        compradorCooperadoId,
        cooperativaId,
        {
          valor: valorTotal,
          vencimento: vencimento.toISOString().slice(0, 10),
          descricao: `Compra de ${quantidade} CooperTokens (cooperado PJ)`,
          formaPagamento,
        },
      );
    } catch (err) {
      // Cobranca Asaas falhou — marca compra como CANCELADO pra nao deixar
      // orfa em AGUARDANDO_PAGAMENTO indefinidamente.
      await this.prisma.cooperTokenCompra
        .update({
          where: { id: compra.id },
          data: { status: 'CANCELADO' },
        })
        .catch(() => undefined);
      throw err;
    }

    // 3. Linkar bidirecionalmente — defesa multi-tenant (fix pos-review
    //    11/06/2026): updateMany com cooperativaId no where. Garante que
    //    so atualiza se a compra continua no tenant (defesa contra race
    //    entre tenants ou bug futuro de cross-tenant).
    await this.prisma.cooperTokenCompra.updateMany({
      where: { id: compra.id, cooperativaId },
      data: {
        asaasId: asaasCobranca.asaasId,
        asaasCobrancaId: asaasCobranca.id,
      },
    });
    const compraAtualizada = await this.prisma.cooperTokenCompra.findUnique({
      where: { id: compra.id },
    });

    this.logger.log(
      `Cooperado PJ ${compradorCooperadoId} (${cooperado.nomeCompleto}) solicitou compra de ${quantidade} tokens (R$ ${valorTotal}) via ${formaPagamento}. CompraId=${compra.id} AsaasId=${asaasCobranca.asaasId}`,
    );

    return {
      compraId: compraAtualizada?.id ?? compra.id,
      quantidade,
      valorTokenReais,
      valorTotal,
      formaPagamento,
      status: 'AGUARDANDO_PAGAMENTO',
      asaasId: asaasCobranca.asaasId,
      linkPagamento: asaasCobranca.linkPagamento,
      pixQrCode: asaasCobranca.pixQrCode ?? null,
      pixCopiaECola: asaasCobranca.pixCopiaECola ?? null,
      linhaDigitavel: asaasCobranca.linhaDigitavel ?? null,
      vencimento: vencimento.toISOString(),
    };
  }

  /**
   * Sprint Clube P1 — Fase 2 Bloco 3 (11/06/2026).
   *
   * Processa o pagamento confirmado de uma CooperTokenCompra do tipo PJ
   * (compradorCooperadoId nao-nulo). Invocado pelo
   * `CooperTokenCompraPjListener` quando o webhook Asaas
   * (`processarWebhook` em asaas.service.ts) detecta o pagamento via
   * `payment.id` match `CooperTokenCompra.asaasId`.
   *
   * Idempotencia em 2 camadas:
   *  1. `CooperTokenCompra.ultimoWebhookEventId === eventId` → skip
   *     (mesmo padrao de AsaasCobranca:484).
   *  2. `creditar()` linhas 100-107 detecta `referenciaId + referenciaTabela`
   *     ja creditado → retorna entry existente sem duplicar.
   *
   * Status guard: so processa AGUARDANDO_PAGAMENTO. Reentrada apos PAGO
   * eh skip silencioso.
   *
   * Taxa F1.5: `creditar()` ja aplica `calcularTaxa('emissao')` da
   * ConfigCooperToken via :113-118 — F2 nao precisa fazer nada extra.
   *
   * Evento contabil: `creditar():193` emite COOPER_TOKEN_EVENTS.EMITIDO
   * → FinanceiroTokenListener.handleEmitido lança "rio token" automatico.
   */
  async processarPagamentoCompraPj(compraId: string, eventId: string): Promise<{
    skipped?: string;
    creditado?: boolean;
    quantidadeLiquida?: number;
    alertaPendencia?: boolean;
  }> {
    const compra = await this.prisma.cooperTokenCompra.findUnique({
      where: { id: compraId },
    });
    if (!compra) {
      this.logger.warn(`[compra-pj] compra ${compraId} nao encontrada — skip`);
      return { skipped: 'compra-nao-encontrada' };
    }

    // Camada 1 — idempotencia via ultimoWebhookEventId.
    if (compra.ultimoWebhookEventId === eventId) {
      this.logger.log(
        `[compra-pj] webhook duplicado ${eventId} (compra ${compraId}) — skip`,
      );
      return { skipped: 'webhook-duplicado' };
    }

    // Guard status — so processa AGUARDANDO_PAGAMENTO.
    if (compra.status !== 'AGUARDANDO_PAGAMENTO') {
      this.logger.log(
        `[compra-pj] compra ${compraId} status=${compra.status} — ja processada, skip`,
      );
      return { skipped: `status-${compra.status}` };
    }

    // Guard semantico — so caminho cooperado-PJ (compradorCooperadoId != null).
    if (!compra.compradorCooperadoId) {
      this.logger.warn(
        `[compra-pj] compra ${compraId} sem compradorCooperadoId — caminho legado tenant, ignora aqui`,
      );
      return { skipped: 'compra-legada-tenant' };
    }

    // 1. GAP 1 fix (11/06/2026): COMPARE-AND-SWAP atomico — substitui
    //    update simples por updateMany {where: status=AGUARDANDO_PAGAMENTO}.
    //    Se 2 webhooks concorrentes (CONFIRMED+RECEIVED do mesmo payment)
    //    bate o where ao mesmo tempo, so 1 muda o status (count===1); o
    //    outro retorna count===0 → skip. Race-free no banco. Tambem filtra
    //    por cooperativaId (defesa em profundidade multi-tenant).
    const swap = await this.prisma.cooperTokenCompra.updateMany({
      where: {
        id: compraId,
        cooperativaId: compra.cooperativaId,
        status: 'AGUARDANDO_PAGAMENTO',
      },
      data: {
        status: 'PAGO',
        dataPagamento: new Date(),
        ultimoWebhookEventId: eventId,
      },
    });
    if (swap.count === 0) {
      // Outro webhook ja venceu a corrida OU status mudou desde o read.
      this.logger.log(
        `[compra-pj] compare-and-swap perdeu pra ${compraId} (eventId=${eventId}) — outro evento ja venceu, skip`,
      );
      return { skipped: 'corrida-perdida' };
    }

    // 2. Creditar tokens no proprio cooperado-PJ via `creditar()`.
    //    Taxa F1.5 sai de graca (calcularTaxa('emissao') aplicada em :113-118).
    //    forcarDisponivel=true porque o cooperado JA pagou — credito vai
    //    direto pro saldoDisponivel (vs saldoPendente que so libera apos
    //    ATIVO_RECEBENDO_CREDITOS).
    //    Idempotencia adicional via referenciaId+referenciaTabela em :100-107.
    const ledgerEntry = await this.creditar({
      cooperadoId: compra.compradorCooperadoId,
      cooperativaId: compra.cooperativaId,
      tipo: 'COMPRA_PJ_COOPERADA' as any,
      quantidade: Number(compra.quantidade),
      valorEmissao: Number(compra.valorTokenReais),
      referenciaId: compra.id,
      referenciaTabela: 'CooperTokenCompra',
      forcarDisponivel: true,
    });

    if (!ledgerEntry) {
      // GAP 2 fix (11/06/2026): NAO deixar PAGO silencioso sem token.
      // Atualiza status pra PAGO_CREDITO_PENDENTE + emite evento de
      // pendencia operacional pra reprocessamento manual/cron futuro.
      // Cooperativa fica visivel via status especial no painel admin.
      await this.prisma.cooperTokenCompra.updateMany({
        where: { id: compraId, cooperativaId: compra.cooperativaId, status: 'PAGO' },
        data: { status: 'PAGO_CREDITO_PENDENTE' },
      });
      this.logger.error(
        `[compra-pj] ALERTA: compra ${compraId} PAGA mas creditar() retornou null pra cooperado ${compra.compradorCooperadoId} (cooperativaId=${compra.cooperativaId}, qty=${compra.quantidade}). Status -> PAGO_CREDITO_PENDENTE. Acao operacional: reprocessar apos resolver causa (status do cooperado, tenant cross-cooperativa, etc).`,
      );
      this.eventEmitter.emit('cooper-token-compra-pj.credito-pendente', {
        compraId,
        cooperativaId: compra.cooperativaId,
        compradorCooperadoId: compra.compradorCooperadoId,
        quantidade: Number(compra.quantidade),
        eventId,
      });
      return { creditado: false, alertaPendencia: true };
    }

    const quantidadeLiquida = Number((ledgerEntry as any).quantidade ?? 0);
    this.logger.log(
      `[compra-pj] compra ${compraId} → ${quantidadeLiquida} tokens creditados ao cooperado ${compra.compradorCooperadoId} (bruto ${compra.quantidade}, taxa via F1.5)`,
    );
    return { creditado: true, quantidadeLiquida };
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

  async confirmarCompraParceiro(compraId: string, cooperativaId?: string | null) {
    const compra = await this.prisma.cooperTokenCompra.findUnique({
      where: { id: compraId },
    });

    if (!compra) {
      throw new NotFoundException('Compra não encontrada');
    }

    // D-novo-BQ.2 A6 IDOR fix (30/05/2026) — impacto financeiro.
    // cooperativaId null = SUPER_ADMIN bypass; ADMIN só confirma compra do próprio tenant.
    if (cooperativaId && compra.cooperativaId !== cooperativaId) {
      throw new ForbiddenException('Compra não pertence ao seu tenant');
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

    // Emitir evento para lançamento contábil
    this.eventEmitter.emit(
      COOPER_TOKEN_EVENTS.COMPRA_PARCEIRO_PAGO,
      new CooperTokenCompraParceiroPagoEvent(
        compra.cooperativaId,
        compraId,
        Number(compra.quantidade),
        Number(compra.valorTotal),
      ),
    );

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

  // ── Financeiro: Relatório completo ──

  async getFinanceiro(
    cooperativaId: string | undefined,
    periodo?: string,
    ano?: number,
    mes?: number,
  ) {
    const whereCoopId = cooperativaId ? { cooperativaId } : {};
    const agora = new Date();
    const anoRef = ano ?? agora.getFullYear();
    const mesRef = mes ?? agora.getMonth() + 1;

    let dateFrom: Date;
    let dateTo: Date;

    if (periodo === 'ano') {
      dateFrom = new Date(anoRef, 0, 1);
      dateTo = new Date(anoRef + 1, 0, 1);
    } else if (periodo === 'trimestre') {
      const trimestreInicio = Math.floor((mesRef - 1) / 3) * 3;
      dateFrom = new Date(anoRef, trimestreInicio, 1);
      dateTo = new Date(anoRef, trimestreInicio + 3, 1);
    } else {
      // default: mês
      dateFrom = new Date(anoRef, mesRef - 1, 1);
      dateTo = new Date(anoRef, mesRef, 1);
    }

    const dateFilter = { createdAt: { gte: dateFrom, lt: dateTo } };

    // Buscar config para valorTokenReais
    const plano = await this.prisma.plano.findFirst({
      where: { ...whereCoopId, cooperTokenAtivo: true },
      select: { valorTokenReais: true },
    });
    const valorToken = Number(plano?.valorTokenReais ?? 0.45);

    const [
      circulacaoAgg,
      receitaParceiros,
      resgateFaturaAgg,
      expiradosAgg,
    ] = await Promise.all([
      // Passivo total: tokens em circulação
      this.prisma.cooperTokenSaldo.aggregate({
        where: whereCoopId,
        _sum: { saldoDisponivel: true },
      }),
      // Receita de parceiros: compras PAGO no período
      this.prisma.cooperTokenCompra.aggregate({
        where: {
          ...whereCoopId,
          status: 'PAGO',
          dataPagamento: { gte: dateFrom, lt: dateTo },
        },
        _sum: { valorTotal: true },
      }),
      // Custo resgates (usar-na-fatura) no período
      this.prisma.cooperTokenLedger.aggregate({
        where: {
          ...whereCoopId,
          operacao: CooperTokenOperacao.DEBITO,
          descricao: { contains: 'Desconto' },
          ...dateFilter,
        },
        _sum: { quantidade: true },
      }),
      // Tokens expirados no período
      this.prisma.cooperTokenLedger.aggregate({
        where: {
          ...whereCoopId,
          operacao: CooperTokenOperacao.EXPIRACAO,
          ...dateFilter,
        },
        _sum: { quantidade: true },
      }),
    ]);

    const circulacao = Number(circulacaoAgg._sum.saldoDisponivel ?? 0);
    const resgatados = Number(resgateFaturaAgg._sum.quantidade ?? 0);
    const expirados = Number(expiradosAgg._sum.quantidade ?? 0);

    return {
      passivoTotal: Math.round(circulacao * valorToken * 100) / 100,
      receitaParceiros: Math.round(Number(receitaParceiros._sum.valorTotal ?? 0) * 100) / 100,
      custoResgates: Math.round(resgatados * valorToken * 100) / 100,
      receitaExpiracao: Math.round(expirados * valorToken * 100) / 100,
      tokensCirculacao: circulacao,
      tokensResgatados: resgatados,
      tokensExpirados: expirados,
      valorTokenReais: valorToken,
      periodo: periodo ?? 'mes',
      ano: anoRef,
      mes: mesRef,
    };
  }

  // ── Financeiro: Fluxo de caixa 12 meses ──

  async getFluxoCaixa(cooperativaId: string | undefined) {
    const whereCoopId = cooperativaId ? { cooperativaId } : {};
    const agora = new Date();
    const meses: Array<{ mes: string; dateFrom: Date; dateTo: Date }> = [];

    for (let i = 11; i >= 0; i--) {
      const d = new Date(agora.getFullYear(), agora.getMonth() - i, 1);
      const dEnd = new Date(d.getFullYear(), d.getMonth() + 1, 1);
      const label = `${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
      meses.push({ mes: label, dateFrom: d, dateTo: dEnd });
    }

    // Buscar config
    const plano = await this.prisma.plano.findFirst({
      where: { ...whereCoopId, cooperTokenAtivo: true },
      select: { valorTokenReais: true },
    });
    const valorToken = Number(plano?.valorTokenReais ?? 0.45);

    const resultado = await Promise.all(
      meses.map(async ({ mes, dateFrom, dateTo }) => {
        const dateFilter = { createdAt: { gte: dateFrom, lt: dateTo } };

        const [emitidosAgg, resgatadosAgg, expiradosAgg, comprasAgg] =
          await Promise.all([
            this.prisma.cooperTokenLedger.aggregate({
              where: { ...whereCoopId, operacao: CooperTokenOperacao.CREDITO, ...dateFilter },
              _sum: { quantidade: true },
            }),
            this.prisma.cooperTokenLedger.aggregate({
              where: { ...whereCoopId, operacao: CooperTokenOperacao.DEBITO, ...dateFilter },
              _sum: { quantidade: true },
            }),
            this.prisma.cooperTokenLedger.aggregate({
              where: { ...whereCoopId, operacao: CooperTokenOperacao.EXPIRACAO, ...dateFilter },
              _sum: { quantidade: true },
            }),
            this.prisma.cooperTokenCompra.aggregate({
              where: { ...whereCoopId, status: 'PAGO', dataPagamento: { gte: dateFrom, lt: dateTo } },
              _sum: { valorTotal: true },
            }),
          ]);

        return {
          mes,
          emitido: Math.round(Number(emitidosAgg._sum.quantidade ?? 0) * valorToken * 100) / 100,
          resgatado: Math.round(Number(resgatadosAgg._sum.quantidade ?? 0) * valorToken * 100) / 100,
          expirado: Math.round(Number(expiradosAgg._sum.quantidade ?? 0) * valorToken * 100) / 100,
          compraParceiro: Math.round(Number(comprasAgg._sum.valorTotal ?? 0) * 100) / 100,
        };
      }),
    );

    return resultado;
  }

  // ── Financeiro: Top cooperados por economia via tokens ──

  async getRendimentoCooperados(cooperativaId: string | undefined, limit = 10) {
    const whereCoopId = cooperativaId ? { cooperativaId } : {};

    // Buscar config
    const plano = await this.prisma.plano.findFirst({
      where: { ...whereCoopId, cooperTokenAtivo: true },
      select: { valorTokenReais: true },
    });
    const valorToken = Number(plano?.valorTokenReais ?? 0.45);

    // Agregar resgates (DEBITO com desconto fatura) por cooperado
    const resgates = await this.prisma.cooperTokenLedger.groupBy({
      by: ['cooperadoId'],
      where: {
        ...whereCoopId,
        operacao: CooperTokenOperacao.DEBITO,
      },
      _sum: { quantidade: true },
      orderBy: { _sum: { quantidade: 'desc' } },
      take: limit,
    });

    // Buscar dados dos cooperados
    const cooperadoIds = resgates.map((r) => r.cooperadoId);
    const cooperados = await this.prisma.cooperado.findMany({
      where: { id: { in: cooperadoIds } },
      select: { id: true, nomeCompleto: true, email: true },
    });

    const cooperadoMap = new Map(cooperados.map((c) => [c.id, c]));

    return resgates.map((r) => {
      const coop = cooperadoMap.get(r.cooperadoId);
      const tokensUsados = Number(r._sum.quantidade ?? 0);
      return {
        cooperadoId: r.cooperadoId,
        nomeCompleto: coop?.nomeCompleto ?? 'N/A',
        email: coop?.email ?? '',
        tokensUsados,
        economiaReais: Math.round(tokensUsados * valorToken * 100) / 100,
      };
    });
  }
}
