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
import { LimiteTokenService, inicioDoDiaEmSaoPaulo } from './limite-token.service';
// F6 C.4 P2 (14/06/2026 — review pesada): mascaramento de pixChave em
// listas (admin + cooperado). Helper estático — sem dep injection.
import { DadosBancariosService } from '../meu-perfil/dados-bancarios.service';
// F4 Bloco C.1 (12/06/2026) FIN-4: jti pra idempotência do caminho admin
// (clientRequestId-based).
import { gerarTokenHex } from '../common/security/otp-helper';
// F3 Bloco B (12/06/2026): helper mass-write reusável.
import {
  executarMassWrite,
  MassWriteAlerta,
} from '../common/mass-write/mass-write.helper';
// F6 Bloco B (12/06/2026): PIX-out helper pra resgate de voucher.
import { AsaasPixOutService } from '../financeiro/asaas-pix-out.service';
// M39 (16/06/2026) — Emissao Admin em Lote: template contabil dedicado
// (D Despesa de Bonificacao / C Passivo Tokens). NAO reusar o evento
// COOPER_TOKEN_EVENTS.EMITIDO porque ele dispara lancarEmissaoFaturaCheia
// (template errado de "Custo Desconto Concedido").
import { TokenContabilService } from '../financeiro/token-contabil.service';
// Sprint D2.1 v2 (16/06/2026) — disclaimer versionado (entidade global
// default + override tenant). Service exportado pelo DisclaimerSaqueModule.
import { DisclaimerSaqueService } from '../disclaimer-saque/disclaimer-saque.service';
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
    // F6 Bloco B (12/06/2026) — PIX-out pra resgate de voucher
    // (estabelecimento → R$). Optional pelas mesmas razões dos demais.
    private asaasPixOutService?: AsaasPixOutService,
    // M39 (16/06/2026) — Emissão Admin em Lote: chama
    // lancarEmissaoAdminLote diretamente (bypass do event emitter pra
    // evitar template contábil errado da F1 lancarEmissaoFaturaCheia).
    // Optional pelas mesmas razões dos demais (specs antigos passam
    // undefined). Em prod sempre injetado via FinanceiroModule export.
    private tokenContabilService?: TokenContabilService,
    // Sprint D2.1 v2 (16/06/2026) — disclaimer versionado pra Guard 1.6.
    // Optional pelas mesmas razões. Em prod sempre injetado via
    // DisclaimerSaqueModule (export). Specs antigos do F6 que NÃO exercem
    // colaborador comum não dependem (estab bypassa Guard 1.6).
    private disclaimerSaqueService?: DisclaimerSaqueService,
  ) {}

  /** Status permitidos para receber crédito de tokens */
  private static readonly STATUS_PERMITIDOS_CREDITO = ['ATIVO', 'ATIVO_RECEBENDO_CREDITOS'];

  // ── Sprint D2.1 (16/06/2026) — Salvaguarda 1 do parecer de conformidade ──
  //
  // Filtro de ORIGEM no saque PIX do colaborador comum (não-Estab). Parecer
  // §3 trabalhista: token de empresa→funcionário convertido em R$ = risco
  // P0 (CLT Art. 458 salário in natura). Bloqueia até parecer trabalhista
  // externo + ata assembleia (para BONIFICACAO_ADMIN).
  //
  // PERMITIDOS = origens "BAIXO risco" do parecer (cooperado recebe sem
  // empregador envolvido).
  // BLOQUEADOS = origens "MÉDIO/ALTO risco" (bonificação gratuita, convênio
  // empresa→funcionário, MLM cascata, QR — origem complexa do pagador).
  //
  // Estabelecimento BYPASSA filtro (parecer §3#6: liquidação comercial,
  // risco zero — PJ não tem empregado-relação trabalhista no fluxo).
  private static readonly TIPOS_PERMITIDOS_SAQUE = new Set<string>([
    'DESCONTO_FATURA',
    'FATURA_CHEIA',
    'GERACAO_EXCEDENTE',
  ]);
  // BLOQUEADOS (não usados na lógica — qualquer tipo NÃO PERMITIDO conta
  // como bloqueado, mas listamos pra docs:
  //   BONIFICACAO_ADMIN, DISTRIBUICAO_CONVENIO, BONUS_INDICACAO,
  //   PAGAMENTO_QR, BENEFICIO_CONVENIO, COMPRA_PJ_COOPERADA.

  // Sprint D2.1 v2 (16/06/2026): a constante DISCLAIMER_VERSAO_ATUAL foi
  // removida — versão é dinâmica e por tenant, lida via
  // DisclaimerSaqueService.getAtivo(cooperativaId). FK no recibo
  // (disclaimerSaqueId) é o vínculo autoritativo do aceite.

  /**
   * Sprint D2.1 Bloco (b) — Composição de origem do saldo (Salvaguarda 1).
   *
   * Calcula o saldoSacavel (= máximo que o colaborador comum pode tentar
   * sacar via PIX) usando agregado conservador da Decisão Luciano:
   *
   *   saldoSacavel = clamp(
   *     Σ CREDITO permitidos − Σ todas reduções − saldoBloqueadoResgate,
   *     0,
   *     saldoDisponivel
   *   )
   *
   * Onde:
   * - Σ CREDITO permitidos = ledger entries CREDITO de tipos em
   *   TIPOS_PERMITIDOS_SAQUE.
   * - Σ todas reduções = ledger entries DEBITO (todas — uso na fatura,
   *   transferência QR, resgate PIX queimado). Estornos NÃO entram aqui
   *   (são operações CREDITO).
   * - saldoBloqueadoResgate = tokens já travados num resgate pendente
   *   (Luciano: evitar saque duplo da mesma origem permitida).
   * - clamp pelo saldoDisponivel = defesa em profundidade (saldoSacavel
   *   nunca excede o saldo real do cooperado).
   *
   * Invariante asserção: saldoSacavel ≤ Σ CREDITO permitidos sempre.
   * Se violada → throw genérico (bug catastrófico no ledger; melhor
   * bloquear o saque que liberar token arriscado).
   *
   * Performance: 1 query no ledger + 1 no saldo. Em escala grande (>10k
   * entries por cooperado), considerar cache em CooperTokenSaldo numa
   * coluna persistente.
   */
  private async composicaoOrigemSaldo(params: {
    cooperadoId: string;
    cooperativaId: string;
  }): Promise<{
    saldoSacavel: number;
    saldoDisponivel: number;
    saldoBloqueadoResgate: number;
    totalCreditoPermitido: number;
    totalReducoes: number;
  }> {
    const { cooperadoId, cooperativaId } = params;

    const [ledger, saldo] = await Promise.all([
      this.prisma.cooperTokenLedger.findMany({
        where: { cooperadoId, cooperativaId },
        select: { tipo: true, operacao: true, quantidade: true },
      }),
      this.prisma.cooperTokenSaldo.findUnique({
        where: { cooperadoId },
        select: { saldoDisponivel: true, saldoBloqueadoResgate: true },
      }),
    ]);

    let totalCreditoPermitido = 0;
    let totalReducoes = 0;
    for (const entry of ledger) {
      const q = Number(entry.quantidade);
      if (entry.operacao === 'CREDITO') {
        if (CooperTokenService.TIPOS_PERMITIDOS_SAQUE.has(entry.tipo)) {
          totalCreditoPermitido += q;
        }
        // Tipos bloqueados (BONIFICACAO_ADMIN, DISTRIBUICAO_CONVENIO,
        // BONUS_INDICACAO, PAGAMENTO_QR, BENEFICIO_CONVENIO,
        // COMPRA_PJ_COOPERADA) NÃO acumulam em totalCreditoPermitido.
      } else if (entry.operacao === 'DEBITO') {
        // Σ todas reduções (qualquer DEBITO — uso, transferência, resgate).
        totalReducoes += q;
      }
    }
    // Arredondamento defensivo (Decimal→Number pode introduzir float).
    totalCreditoPermitido = Math.round(totalCreditoPermitido * 10000) / 10000;
    totalReducoes = Math.round(totalReducoes * 10000) / 10000;

    const saldoDisponivel = Number(saldo?.saldoDisponivel ?? 0);
    const saldoBloqueadoResgate = Number(saldo?.saldoBloqueadoResgate ?? 0);

    // saldoSacavel = clamp(Σ CREDITO permitidos − Σ todas reduções −
    // saldoBloqueado, 0, saldoDisponivel).
    const saldoSacavelBruto =
      totalCreditoPermitido - totalReducoes - saldoBloqueadoResgate;
    let saldoSacavel = Math.max(0, saldoSacavelBruto);
    saldoSacavel = Math.min(saldoSacavel, saldoDisponivel);
    saldoSacavel = Math.round(saldoSacavel * 10000) / 10000;

    // Asserção invariante (defense in depth):
    // saldoSacavel deve ser ≤ Σ CREDITO permitidos SEMPRE. Se violar, há
    // bug catastrófico no ledger (CREDITO retroativo, race na escrita,
    // etc) — bloqueia o saque por segurança.
    if (saldoSacavel > totalCreditoPermitido + 0.0001) {
      this.logger.error(
        `[D2.1] INVARIANTE VIOLADA: saldoSacavel=${saldoSacavel} > totalCreditoPermitido=${totalCreditoPermitido}. ` +
          `cooperadoId=${cooperadoId.slice(0, 8)}… cooperativaId=${cooperativaId.slice(0, 8)}… ` +
          `saldoDisp=${saldoDisponivel} saldoBloq=${saldoBloqueadoResgate} reducoes=${totalReducoes}. ` +
          `Bloqueando saque por segurança.`,
      );
      throw new Error(
        'Invariante de composição de saldo violada — saque bloqueado por segurança.',
      );
    }

    return {
      saldoSacavel,
      saldoDisponivel,
      saldoBloqueadoResgate,
      totalCreditoPermitido,
      totalReducoes,
    };
  }

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
   * @deprecated M39 (16/06/2026) — substituído por `emitirLoteAdmin` (POST
   *   /cooper-token/admin/emitir-lote). Razões:
   *   1. Single-target → "1 por 1" inviável pra emissão em lote real.
   *   2. Reusa `creditar()` que dispara COOPER_TOKEN_EVENTS.EMITIDO →
   *      handleEmitido → `lancarEmissaoFaturaCheia` (template contábil
   *      ERRADO — "D Custo Desconto Concedido" em vez de "D Despesa de
   *      Bonificação"). `emitirLoteAdmin` bypassa o evento e chama
   *      `lancarEmissaoAdminLote` direto (D 5.1.03 / C 5.1.02).
   *   3. Tipo fixo `BONUS_INDICACAO` (MLM — classificação fiscal errada).
   *      `emitirLoteAdmin` usa `BONIFICACAO_ADMIN` semanticamente correto.
   *
   * Endpoint `POST /cooper-token/parceiro/enviar` ainda existe pra COMPAT
   * porque também roteia pro caminho cooperado→cooperado (`enviarTokens`
   * com PIN). Mas o ramo admin desse endpoint (que chega aqui) é
   * @deprecated — UI já redirecionada (Bloco 5 M39).
   *
   * NÃO REMOVER ainda. Specs F4-C/C1 continuam testando este método em
   * isolamento. Remoção quando confirmado zero callers de produção
   * (logs ENVIO_ADMIN sem nova entry por 30 dias).
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
  /** @deprecated M39 — usar emitirLoteAdmin. Ver JSDoc acima. */
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

    // ── Guard 3: convênio existe + empresa é a pagadora ──
    // Bug fix 15/06/2026 (blocker Santi): JWT empresa_conveniada injeta
    // `cooperadoId = pagadorCooperadoId` (auth.service.ts:545-578). O guard
    // antes comparava contra `convenio.conveniadoId` (campo legado
    // "representante" — schema.prisma:1525, opcional, raramente preenchido).
    // Caso 1 D-FISCAL-2.4.1 (01/06/2026) introduziu `pagadorCooperadoId`
    // como a FK pro Cooperado PJ que paga — esse é o campo correto pro
    // guard. `conveniadoId` permanece como débito P3 de housekeeping.
    const convenio = await this.prisma.contratoConvenio.findFirst({
      where: { id: convenioId, cooperativaId },
      select: { id: true, pagadorCooperadoId: true, status: true, empresaNome: true },
    });
    if (!convenio) {
      throw new NotFoundException('Convênio não encontrado.');
    }
    if (convenio.status !== 'ATIVO') {
      throw new BadRequestException(`Convênio status=${convenio.status}; só convênios ATIVO permitem distribuição.`);
    }
    if (convenio.pagadorCooperadoId !== empresaCooperadoId) {
      throw new ForbiddenException(
        'Apenas a empresa pagadora do convênio pode distribuir tokens.',
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
        // Bug fix 15/06/2026 (blocker Santi): trocado `conveniadoId` (legado
        // representante) por `pagadorCooperadoId` (D-FISCAL-2.4.1, Caso 1 —
        // FK Cooperado PJ pagador). JWT empresa_conveniada injeta
        // pagadorCooperadoId como cooperadoId. Ver guard idêntico em
        // distribuirTokens (linha ~1366).
        pagadorCooperadoId: true,
        status: true,
      },
    });
    if (!convenio) {
      throw new NotFoundException('Convênio não encontrado.');
    }
    if (convenio.pagadorCooperadoId !== empresaCooperadoId) {
      throw new ForbiddenException(
        'Apenas a empresa pagadora do convênio pode listar membros pra distribuição.',
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

  // ═══════════════════════════════════════════════════════════════════
  // F6 Bloco B (12/06/2026) — Estabelecimento resgata tokens em R$ via PIX
  // ═══════════════════════════════════════════════════════════════════
  //
  // MODELO: "Resgate/Liquidação de voucher" com RECIBO — cooperativa quita
  // passivo próprio (token que emitiu). NUNCA "recompra"/"venda" — vira
  // erro de conformidade (decisao_modelo_token_voucher_sobra_resgate
  // _2026_06_04.md).
  //
  // 3 REFORÇOS (Luciano 12/06):
  //   1. Compare-and-swap em TODAS as transições de status (aprovar/recusar/
  //      cancelar/webhook): updateMany({where:{id, cooperativaId, status:
  //      esperado}}) + count===1. Dois admins/cancelar×aprovar/webhook
  //      duplicado = sempre 1 vencedor.
  //   2. Estorno auditável: FALHA_PIX/recusa/cancelamento → ledger
  //      ESTORNO_RESGATE_PIX devolvendo ao saldoDisponivel — NUNCA apaga.
  //      Invariante: saldoDisponivel + saldoBloqueadoResgate conservada em
  //      TODA transição.
  //   3. Webhook idempotente: ultimoWebhookEventId checado antes de
  //      qualquer transição (Asaas envia eventos duplicados).

  /**
   * Helper interno: gera próximo número sequencial RES-{YYYY}-{NNNNN} por
   * cooperativa+ano dentro da tx. Upsert atômico no ResgateReciboCounter
   * + increment de `proximoNumero`. Multi-tenant: cada cooperativa tem
   * sua sequência isolada (Decisão Q3 — não vaza volume).
   */
  private async gerarNumeroRecibo(
    tx: Prisma.TransactionClient,
    cooperativaId: string,
  ): Promise<string> {
    // F6 C.4 P2 F6-8 (14/06/2026 — review pesada): ano derivado em fuso
    // São Paulo, NÃO UTC. Servidor em UTC entre 21h e 00h BR fazia o
    // contador pular pro ano seguinte 3h antes do real — recibos com
    // ano errado em janelas de virada de ano.
    const inicioHoje = inicioDoDiaEmSaoPaulo(new Date());
    const ano = new Date(inicioHoje).getUTCFullYear();
    // Upsert idempotente: cria contador se ano novo, ou reusa existente.
    await tx.resgateReciboCounter.upsert({
      where: { cooperativaId_ano: { cooperativaId, ano } },
      create: { cooperativaId, ano, proximoNumero: 1 },
      update: {},
    });
    // Increment atômico → retorna o número usado.
    const atual = await tx.resgateReciboCounter.update({
      where: { cooperativaId_ano: { cooperativaId, ano } },
      data: { proximoNumero: { increment: 1 } },
      select: { proximoNumero: true },
    });
    // proximoNumero APÓS increment; o número desta operação é o ANTERIOR.
    const numero = atual.proximoNumero - 1;
    return `RES-${ano}-${String(numero).padStart(5, '0')}`;
  }

  /**
   * Estabelecimento solicita resgate de tokens em R$ via PIX.
   *
   * Fluxo:
   *  1. Guards (FORA da tx): ehEstabelecimento + status + pixChave cadastrada
   *     + PIN via PinCooperadoService.validarPinComLockout + tier ALTO OTP.
   *  2. assertLimite sobre o valor R$ total (mesma fórmula F3).
   *  3. Dentro da tx Serializable:
   *     a. Re-snapshot saldo (defesa anti-race).
   *     b. Gera numeroRecibo via counter (atômico).
   *     c. Bloqueia saldo: saldoDisponivel -= qty, saldoBloqueadoResgate += qty.
   *        SEM ledger ainda (token NÃO saiu — invariante conserva).
   *     d. Cria ResgateRecibo status='PENDENTE_APROVACAO_COOP' + snapshot
   *        pixChave/pixTipo (do Cooperado.pixChave, NUNCA do body).
   *  4. Retorna {recibo, status, observacao "aguardando aprovação"}.
   */
  async solicitarResgate(params: {
    estabelecimentoCooperadoId: string;
    cooperativaId: string;
    quantidade: number;
    pin: string;
    clientRequestId: string;
    otpDesafioId?: string;
    otpCodigo?: string;
    observacao?: string;
    // ── Sprint D2.1 v2 (16/06/2026) — Salvaguarda 5 versionada ──
    // Aceite do disclaimer obrigatório para colaborador comum (não-Estab).
    // Estabelecimento NÃO precisa (parecer §3#6 — bypass via flag).
    // O cliente envia `disclaimerSaqueId` (FK pro DisclaimerSaque ativo)
    // — id é o vínculo autoritativo (Decisão Luciano Q1). Service
    // re-valida `id === getAtivo(cooperativaId).id` no Guard 1.6.
    disclaimerAceito?: boolean;
    disclaimerSaqueId?: string;
    // IP + UserAgent capturados pelo controller (req.ip/headers) e
    // gravados no recibo pra trilha forense (defesa documental).
    aceiteIp?: string;
    aceiteUserAgent?: string;
  }) {
    const {
      estabelecimentoCooperadoId,
      cooperativaId,
      quantidade,
      pin,
      clientRequestId,
      otpDesafioId,
      otpCodigo,
      observacao,
      disclaimerAceito,
      disclaimerSaqueId,
      aceiteIp,
      aceiteUserAgent,
    } = params;

    if (!Number.isFinite(quantidade) || quantidade <= 0) {
      throw new BadRequestException('Quantidade deve ser positiva.');
    }
    if (!clientRequestId || clientRequestId.trim().length < 8) {
      throw new BadRequestException(
        'clientRequestId obrigatório (mínimo 8 chars; recomendado UUID v4). Idempotência: retry do mesmo ID = mesmo recibo.',
      );
    }

    // ── Guard 1: cooperado existe + tenant + autorizado a resgatar ──
    //
    // Sprint D2 (16/06/2026) — Gate dual pra Saque PIX Colaborador Comum:
    //   (A) estabelecimento (ehEstabelecimento=true) → SEMPRE autorizado.
    //   (B) cooperado comum (não-estab) → autorizado SE:
    //       (B.1) flag tenant Cooperativa.saqueColaboradorAtivo=true (SUPER_ADMIN liga); E
    //       (B.2) gate produção: !isAmbienteReal() OU
    //             env SAQUE_COLABORADOR_PRODUCAO_LIBERADO='true' (Luciano libera
    //             após parecer escrito do cooperebr-analista-conformidade).
    // Espelha exatamente o gate da oxidação (OXIDACAO_PRODUCAO_LIBERADA).
    const estabelecimento = await this.prisma.cooperado.findFirst({
      where: { id: estabelecimentoCooperadoId, cooperativaId },
      select: {
        id: true,
        nomeCompleto: true,
        status: true,
        ehEstabelecimento: true,
        pixChave: true,
        pixTipo: true,
      },
    });
    if (!estabelecimento) {
      throw new NotFoundException('Cooperado não encontrado no seu tenant.');
    }
    if (!estabelecimento.ehEstabelecimento) {
      // Fallback Sprint D2: tenta liberar pelo gate Saque Colaborador.
      const coop = await this.prisma.cooperativa.findUnique({
        where: { id: cooperativaId },
        select: { saqueColaboradorAtivo: true },
      });
      const flagTenant = coop?.saqueColaboradorAtivo === true;
      const gateProducaoLiberado =
        !isAmbienteReal() ||
        process.env.SAQUE_COLABORADOR_PRODUCAO_LIBERADO === 'true';
      const saqueColabPermitido = flagTenant && gateProducaoLiberado;
      if (!saqueColabPermitido) {
        // Mensagem informativa SEM revelar o gate de produção (anti-enumeração):
        // o cooperado vê a mesma mensagem se a flag está OFF ou o env está OFF.
        throw new ForbiddenException(
          'Resgate em PIX bloqueado pra este cooperado. Disponível pra cooperados-Estabelecimento do Clube ou cooperados de cooperativa com saque-colaborador habilitado pelo admin SISGD (exige parecer do analista-conformidade).',
        );
      }
      this.logger.log(
        `[F6 D2] Saque Colaborador autorizado: cooperado=${estabelecimentoCooperadoId.slice(0, 8)}… (não-estab) tenant=${cooperativaId.slice(0, 8)}… flag=ON env-prod-gate=${gateProducaoLiberado}`,
      );
    }
    if (!CooperTokenService.STATUS_PERMITIDOS_CREDITO.includes(estabelecimento.status)) {
      throw new ForbiddenException(
        `Status ${estabelecimento.status} não permite solicitar resgate. Permitidos: ATIVO ou ATIVO_RECEBENDO_CREDITOS.`,
      );
    }
    if (!estabelecimento.pixChave || estabelecimento.pixChave.trim().length === 0) {
      throw new BadRequestException(
        'Chave PIX não cadastrada. Cadastre em /portal/seguranca/dados-bancarios antes de solicitar resgate (anti-fraude — chave nunca vem do body).',
      );
    }

    // ── Guards Sprint D2.1 (16/06/2026) — Salvaguardas 1 + 5 ──
    //
    // Aplicam APENAS para colaborador comum (não-Estab). Estabelecimento
    // bypassa ambos: parecer §3#6 (risco zero — liquidação comercial PJ
    // sem relação trabalhista).
    if (!estabelecimento.ehEstabelecimento) {
      // ── Guard 1.5: Filtro de ORIGEM (Salvaguarda 1) ──
      // Bloqueia se a `quantidade` solicitada exceder o `saldoSacavel`
      // computado pela composição agregada conservadora do helper.
      const composicao = await this.composicaoOrigemSaldo({
        cooperadoId: estabelecimentoCooperadoId,
        cooperativaId,
      });
      if (quantidade > composicao.saldoSacavel + 0.0001) {
        // Mensagem genérica anti-enumeração: atacante não deve distinguir
        // "tem saldo mas não é elegível" (Salvaguarda 1) de
        // "saldo bruto insuficiente". Loga detalhe pro admin investigar.
        this.logger.warn(
          `[D2.1] Saque bloqueado pelo filtro de origem: cooperado=${estabelecimentoCooperadoId.slice(0, 8)}… ` +
            `solicitado=${quantidade} saldoSacavel=${composicao.saldoSacavel} ` +
            `(disp=${composicao.saldoDisponivel} bloq=${composicao.saldoBloqueadoResgate} ` +
            `permitido=${composicao.totalCreditoPermitido} reducoes=${composicao.totalReducoes})`,
        );
        throw new ForbiddenException(
          'Saldo elegível para saque insuficiente. Saques em R$ são limitados a tokens de origem específica (desconto da sua fatura própria) — fale com o admin da cooperativa pra entender quais dos seus tokens são elegíveis.',
        );
      }

      // ── Guard 1.6: Aceite do disclaimer (Salvaguarda 5 versionado) ──
      // Sprint D2.1 v2 (16/06/2026): cliente envia `disclaimerSaqueId` =
      // FK pro DisclaimerSaque que estava ativo no momento. Service
      // resolve o ativo pelo TENANT (override > global) e re-valida
      // `disclaimerSaqueId === ativo.id`. Anti-staleness: se ADMIN ou
      // SUPER_ADMIN editar entre o GET do front e o POST do cooperado,
      // o id deixou de ser ativo → BadRequest. Cliente recarrega.
      if (disclaimerAceito !== true) {
        throw new BadRequestException(
          'Aceite do termo de saque obrigatório. Leia o aviso e confirme antes de prosseguir.',
        );
      }
      if (!disclaimerSaqueId) {
        throw new BadRequestException(
          'Identificador do termo aceito ausente. Recarregue a página.',
        );
      }
      if (!this.disclaimerSaqueService) {
        throw new Error(
          'DisclaimerSaqueService não disponível (wiring do módulo) — bug operacional.',
        );
      }
      const ativo = await this.disclaimerSaqueService.getAtivo(cooperativaId);
      if (disclaimerSaqueId !== ativo.id) {
        throw new BadRequestException(
          'Termo de saque desatualizado. Recarregue a página e aceite a versão atual.',
        );
      }
    }

    // ── Guard 2: PIN FORA da tx (mesmo padrão F4) ──
    if (!pin || !/^\d{6}$/.test(pin)) {
      throw new BadRequestException('PIN obrigatório (6 dígitos numéricos).');
    }
    if (!this.pinCooperadoService) {
      throw new Error('PinCooperadoService não disponível (wiring do módulo).');
    }
    const pinResult = await this.pinCooperadoService.validarPinComLockout({
      cooperadoId: estabelecimentoCooperadoId,
      cooperativaId,
      pin,
    });
    if (!pinResult.ok) {
      if (pinResult.motivo === 'PIN_NAO_DEFINIDO') {
        throw new BadRequestException(
          'PIN do estabelecimento não foi definido. Configure no portal de segurança antes de solicitar resgate.',
        );
      }
      if (pinResult.motivo === 'PIN_BLOQUEADO') {
        throw new ForbiddenException(
          `PIN bloqueado por excesso de tentativas. Tente após ${pinResult.desbloqueiaEm.toISOString()}.`,
        );
      }
      throw new ForbiddenException('PIN incorreto.');
    }

    // ── Calcular valor R$ + tier ──
    const config = await this.getConfig(cooperativaId);
    const valorTokenReais = Number(config?.valorTokenReais ?? 0.45);
    const valorBrutoReais = Math.round(quantidade * valorTokenReais * 100) / 100;
    const { taxa: taxaTokens, liquido: liquidoTokens } = calcularTaxa(
      'resgate',
      quantidade,
      config,
    );

    // F6 Bloco B — guard taxa>0 análogo ao F3 GAP-F3-4: bloqueado até
    // D-novo-TAXA-RESGATE-DESTINO definir destino contábil.
    if (taxaTokens > 0) {
      throw new BadRequestException(
        `Resgate em PIX está bloqueado enquanto a taxa de resgate > 0 (atual: ${taxaTokens} tokens). ` +
          `Definir destino contábil da taxa de resgate exige decisão produto (ver D-novo-TAXA-RESGATE-DESTINO P2 — análogo a D-novo-TAXA-TRANSFER-DESTINO). ` +
          `Setar taxaResgatePerc=0 em /cooper-token/admin/config até o gate ser definido.`,
      );
    }
    const valorTaxaReais = 0; // Por design v1 — taxa zero.
    const valorLiquidoReais = valorBrutoReais;
    const tier = calcularTier(valorBrutoReais);

    // ── Guard 3: tier ALTO exige OTP step-up ──
    if (tier === 'ALTO') {
      if (!otpDesafioId || !otpCodigo) {
        throw new BadRequestException(
          `Resgate tier ALTO (>R$ 50): OTP obrigatório. Solicite OTP via /cooper-token/otp-step-up antes (informe otpDesafioId e otpCodigo).`,
        );
      }
      if (!this.otpDesafioService) {
        throw new Error(
          'OtpDesafioService não disponível (wiring do módulo). F6 Bloco B exige injeção via CooperadosModule.',
        );
      }
      await this.otpDesafioService.validarOuLancar({
        desafioId: otpDesafioId,
        codigo: otpCodigo,
        cooperativaId,
      });
    }

    // ── Guard 4: limite por transação + diário do estabelecimento ──
    await this.assertLimite({
      cooperadoId: estabelecimentoCooperadoId,
      cooperativaId,
      valorReais: valorBrutoReais,
      origem: 'enviarTokens', // alias semântico
    });

    // ── Idempotência: clientRequestId duplicado retorna recibo existente ──
    const reciboExistente = await this.prisma.resgateRecibo.findUnique({
      where: { clientRequestId },
    });
    if (reciboExistente) {
      if (reciboExistente.cooperativaId !== cooperativaId) {
        // Anti-IDOR: pode existir noutro tenant (raríssimo). Retorna NotFound
        // genérico em vez de revelar.
        throw new NotFoundException('Solicitação não encontrada.');
      }
      this.logger.log(
        `[F6] solicitarResgate idempotência hit — clientRequestId=${clientRequestId.slice(0, 8)}… retornando recibo ${reciboExistente.numeroRecibo}`,
      );
      return {
        idempotente: true,
        recibo: reciboExistente,
      };
    }

    // ── Tx Serializable: re-snapshot saldo + gera numero + bloqueia + cria recibo ──
    const recibo = await this.prisma.$transaction(
      async (tx) => {
        // Re-snapshot do saldo DENTRO da tx (tudo-ou-nada).
        const saldo = await tx.cooperTokenSaldo.findUnique({
          where: { cooperadoId: estabelecimentoCooperadoId },
        });
        if (!saldo) {
          throw new BadRequestException(
            'Estabelecimento não tem saldo de tokens. Receba via QR (F4) ou comprado (F2) antes de solicitar resgate.',
          );
        }
        const saldoDisp = Number(saldo.saldoDisponivel);
        const saldoBloq = Number(saldo.saldoBloqueadoResgate ?? 0);
        if (saldoDisp < quantidade) {
          throw new BadRequestException(
            `Saldo insuficiente. Disponível: ${saldoDisp} tokens; solicitado: ${quantidade}. Saldo bloqueado (aguardando aprovação): ${saldoBloq}.`,
          );
        }

        // Bloquear: -saldoDisponivel, +saldoBloqueadoResgate. Conserva soma.
        const novoSaldoDisp = Math.round((saldoDisp - quantidade) * 10000) / 10000;
        const novoSaldoBloq = Math.round((saldoBloq + quantidade) * 10000) / 10000;
        // F6 C.4 P2 (14/06/2026 — review pesada): updateMany com cooperativaId
        // pra defesa em profundidade (cooperadoId é @unique, mas o filtro
        // explícito documenta o invariante multi-tenant). count===0 não pode
        // acontecer aqui — Guard 1 já confirmou cooperado no tenant.
        await tx.cooperTokenSaldo.updateMany({
          where: { cooperadoId: estabelecimentoCooperadoId, cooperativaId },
          data: {
            saldoDisponivel: novoSaldoDisp,
            saldoBloqueadoResgate: novoSaldoBloq,
          },
        });

        // Gera número do recibo via counter atômico (multi-tenant).
        const numeroRecibo = await this.gerarNumeroRecibo(tx, cooperativaId);

        // Cria ResgateRecibo PENDENTE_APROVACAO_COOP.
        // Sprint D2.1 v2 (16/06/2026) Bloco (3): grava aceite do disclaimer
        // se cooperado COMUM (estab passou no bypass, campos ficam null).
        // disclaimerSaqueId é FK autoritativa pra recuperar texto exato
        // depois (mesmo após edições). disclaimerVersao copiado pra
        // display rápido (evita JOIN nas listagens admin).
        let aceiteData: Record<string, unknown> = {};
        if (!estabelecimento.ehEstabelecimento) {
          // Re-busca o ativo dentro da tx pra grudar versão correspondente
          // (Guard 1.6 fora da tx já validou que disclaimerSaqueId é o ativo).
          const disclaimerAtivo = await tx.disclaimerSaque.findUnique({
            where: { id: disclaimerSaqueId! },
            select: { id: true, versao: true },
          });
          aceiteData = {
            disclaimerSaqueId: disclaimerAtivo?.id ?? disclaimerSaqueId,
            disclaimerVersao: disclaimerAtivo?.versao ?? null,
            disclaimerAceitoEm: new Date(),
            disclaimerAceiteIp: aceiteIp ?? null,
            disclaimerAceiteUserAgent: aceiteUserAgent ?? null,
          };
        }

        const created = await tx.resgateRecibo.create({
          data: {
            numeroRecibo,
            cooperativaId,
            cooperadoEstabelecimentoId: estabelecimentoCooperadoId,
            clientRequestId,
            valorBrutoTokens: quantidade,
            valorTaxaTokens: taxaTokens,
            valorLiquidoTokens: liquidoTokens,
            valorBrutoReais,
            valorTaxaReais,
            valorLiquidoReais,
            // Snapshot anti-fraude: chave do cadastro, NUNCA do body.
            pixChave: estabelecimento.pixChave!,
            pixTipo: estabelecimento.pixTipo ?? 'ALEATORIA',
            status: 'PENDENTE_APROVACAO_COOP',
            observacao: observacao ?? null,
            ...aceiteData,
          },
        });

        return created;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    this.logger.log(
      `[F6] solicitarResgate ${recibo.numeroRecibo} estabelecimento=${estabelecimentoCooperadoId} valor R$ ${valorLiquidoReais} status=PENDENTE_APROVACAO_COOP`,
    );

    return {
      idempotente: false,
      recibo,
    };
  }

  /**
   * Admin aprova resgate pendente e dispara PIX-out via Asaas.
   *
   * REFORÇO 3 (compare-and-swap): updateMany com filtro de status; só
   * dispara o PIX se count===1. Dois admins clicando juntos = 1 PIX só.
   *
   * Em caso de erro Asaas: status=FALHA_PIX + estorno auditável imediato.
   * (Se Asaas aceitou mas demorou, fica APROVADO_PIX_DISPARADO aguardando
   * webhook PAGO ou FAILED.)
   */
  async aprovarResgate(params: {
    reciboId: string;
    cooperativaId: string;
    aprovadoPorUserId: string;
  }) {
    const { reciboId, cooperativaId, aprovadoPorUserId } = params;
    if (!this.asaasPixOutService) {
      throw new Error('AsaasPixOutService não disponível (wiring do módulo).');
    }

    const recibo = await this.prisma.resgateRecibo.findFirst({
      where: { id: reciboId, cooperativaId },
    });
    if (!recibo) {
      throw new NotFoundException('Recibo de resgate não encontrado.');
    }

    // REFORÇO 3: compare-and-swap PENDENTE_APROVACAO_COOP → APROVADO_PIX_DISPARADO.
    const swap = await this.prisma.resgateRecibo.updateMany({
      where: {
        id: reciboId,
        cooperativaId,
        status: 'PENDENTE_APROVACAO_COOP',
      },
      data: {
        status: 'APROVADO_PIX_DISPARADO',
        aprovadoPorUserId,
        aprovadoEm: new Date(),
      },
    });
    if (swap.count === 0) {
      throw new BadRequestException(
        `Não foi possível aprovar: o recibo já está em outro estado (status atual: ${recibo.status}). Recarregue a lista.`,
      );
    }

    // PIX-out via helper (SIMULATED em ambiente NÃO-real).
    const valorPix = Number(recibo.valorLiquidoReais);
    const pixResult = await this.asaasPixOutService.transferir({
      cooperativaId,
      pixChave: recibo.pixChave,
      pixTipo: recibo.pixTipo,
      valor: valorPix,
      descricao: `Resgate ${recibo.numeroRecibo} — liquidação de voucher CooperToken (cooperativa quita passivo). Recibo ref: ${recibo.numeroRecibo}.`,
    });

    if (pixResult.status === 'ERROR') {
      // F6 C.4 P1 F6-2 (14/06/2026 — review pesada): ANTES do estorno,
      // CAS APROVADO_PIX_DISPARADO → FALHA_PIX. Status não pode mentir
      // (estado anterior dizia "PIX em curso" e Asaas já rejeitou).
      // Tx Serializable conserva ordem: troca status ANTES de devolver
      // tokens (defesa contra UI ler "APROVADO" com saldo já estornado).
      const motivoFalha = `Asaas rejeitou: ${pixResult.erro ?? 'erro desconhecido'}`;
      const swapFalha = await this.prisma.resgateRecibo.updateMany({
        where: { id: reciboId, cooperativaId, status: 'APROVADO_PIX_DISPARADO' },
        data: { status: 'FALHA_PIX', motivoFalha, falhaEm: new Date() },
      });
      // count===0 → outro fluxo (cancelar?) já mexeu. Estorna mesmo assim
      // pra invariante saldoDisp+saldoBloq seguir conservada — estorno é
      // idempotente (tolera invariante reaplicada).
      if (swapFalha.count === 0) {
        this.logger.warn(
          `[F6] Asaas ERROR mas status já mudou (recibo ${recibo.numeroRecibo}). Estornando mesmo assim pra conservar invariante.`,
        );
      }
      await this.estornarResgateInterno({
        recibo,
        statusFinal: 'FALHA_PIX',
        motivoFalha,
        skipStatusUpdate: true, // status já trocado acima
      });
      throw new BadRequestException(
        `Asaas rejeitou a transferência: ${pixResult.erro}. Tokens devolvidos ao saldo disponível (lançamento de estorno). Recibo agora em FALHA_PIX — reprocessar PIX ou recusar.`,
      );
    }

    // Asaas aceitou — guarda asaasTransferId. status fica APROVADO_PIX_DISPARADO
    // até webhook PAGO/FAILED. (SIMULATED também segue esse caminho — listener
    // simulado pode promover pra PAGO no smoke.)
    //
    // F6 C.4 P1 MT (14/06/2026): updateMany com cooperativaId no where
    // (defesa em profundidade — recibo.cooperativaId já casou no Guard +
    // CAS acima, mas o write isolado da transferId precisa do tenant
    // explícito).
    await this.prisma.resgateRecibo.updateMany({
      where: { id: reciboId, cooperativaId },
      data: {
        asaasTransferId: pixResult.asaasTransferId,
      },
    });

    this.logger.log(
      `[F6] aprovarResgate ${recibo.numeroRecibo} → APROVADO_PIX_DISPARADO asaasTransferId=${pixResult.asaasTransferId} status=${pixResult.status}`,
    );

    return {
      sucesso: true,
      reciboId,
      asaasTransferId: pixResult.asaasTransferId,
      asaasStatus: pixResult.status,
    };
  }

  /**
   * Admin recusa resgate pendente. Estorno auditável imediato.
   * REFORÇO 3 — compare-and-swap PENDENTE_APROVACAO_COOP → RECUSADO.
   */
  async recusarResgate(params: {
    reciboId: string;
    cooperativaId: string;
    recusadoPorUserId: string;
    motivoRecusa: string;
  }) {
    const { reciboId, cooperativaId, recusadoPorUserId, motivoRecusa } = params;
    if (!motivoRecusa || motivoRecusa.trim().length < 3) {
      throw new BadRequestException('motivoRecusa obrigatório (mínimo 3 chars).');
    }

    const recibo = await this.prisma.resgateRecibo.findFirst({
      where: { id: reciboId, cooperativaId },
    });
    if (!recibo) {
      throw new NotFoundException('Recibo de resgate não encontrado.');
    }

    const swap = await this.prisma.resgateRecibo.updateMany({
      where: { id: reciboId, cooperativaId, status: 'PENDENTE_APROVACAO_COOP' },
      data: {
        status: 'RECUSADO',
        recusadoPorUserId,
        recusadoEm: new Date(),
        motivoRecusa: motivoRecusa.trim(),
      },
    });
    if (swap.count === 0) {
      throw new BadRequestException(
        `Não foi possível recusar: o recibo já está em outro estado (status atual: ${recibo.status}).`,
      );
    }

    await this.estornarResgateInterno({
      recibo,
      statusFinal: 'RECUSADO', // já gravamos via swap acima — função só faz o estorno
      skipStatusUpdate: true,
    });

    this.logger.log(`[F6] recusarResgate ${recibo.numeroRecibo} → RECUSADO motivo="${motivoRecusa.slice(0, 60)}"`);

    return { sucesso: true, reciboId };
  }

  /**
   * Estabelecimento cancela própria solicitação pendente.
   * REFORÇO 3 — compare-and-swap PENDENTE_APROVACAO_COOP → CANCELADO.
   * Cobre a corrida admin-aprova × estabelecimento-cancela.
   */
  async cancelarResgate(params: {
    reciboId: string;
    cooperativaId: string;
    estabelecimentoCooperadoId: string;
  }) {
    const { reciboId, cooperativaId, estabelecimentoCooperadoId } = params;

    const recibo = await this.prisma.resgateRecibo.findFirst({
      where: { id: reciboId, cooperativaId },
    });
    if (!recibo) {
      throw new NotFoundException('Recibo de resgate não encontrado.');
    }
    // Anti-IDOR: estabelecimento só cancela próprios recibos.
    if (recibo.cooperadoEstabelecimentoId !== estabelecimentoCooperadoId) {
      throw new NotFoundException('Recibo de resgate não encontrado.');
    }

    const swap = await this.prisma.resgateRecibo.updateMany({
      where: { id: reciboId, cooperativaId, status: 'PENDENTE_APROVACAO_COOP' },
      data: {
        status: 'CANCELADO',
        canceladoEm: new Date(),
      },
    });
    if (swap.count === 0) {
      throw new BadRequestException(
        `Não foi possível cancelar: o recibo já está em outro estado (status atual: ${recibo.status}). Provavelmente o admin já aprovou.`,
      );
    }

    await this.estornarResgateInterno({
      recibo,
      statusFinal: 'CANCELADO',
      skipStatusUpdate: true,
    });

    this.logger.log(`[F6] cancelarResgate ${recibo.numeroRecibo} → CANCELADO`);

    return { sucesso: true, reciboId };
  }

  /**
   * Processa webhook Asaas de transferência (PAYMENT_RECEIVED / FAILED).
   *
   * REFORÇO 2 (idempotência webhook): ultimoWebhookEventId checado ANTES
   * de qualquer transição. Asaas reenvia o mesmo evento — sem isso, FAILED
   * duplicado devolveria tokens 2×.
   *
   * REFORÇO 3 (compare-and-swap): só promove APROVADO_PIX_DISPARADO →
   * PAGO_RECIBO_EMITIDO (count===1) ou → FALHA_PIX + estorno (count===1).
   */
  async processarWebhookResgate(params: {
    asaasTransferId: string;
    eventId: string;
    sucesso: boolean;
    motivoFalha?: string;
    /**
     * F6 C.4 re-review (14/06): tenant esperado vindo do listener/emit
     * pra DOUBLE-CHECK anti-IDOR. asaas.service.ts já validou tenant via
     * configCooperativaId === recibo.cooperativaId antes do emit, mas
     * este service também valida — se outro emissor do evento for criado
     * no futuro, a defesa fica no lugar certo.
     *
     * P2 reviewer multi-tenant Sprint D2 (16/06): tornado OBRIGATÓRIO
     * pra fechar a janela "findFirst sem cooperativaId no where +
     * cooperativaIdEsperada opcional pulado = colisão de asaasTransferId
     * cross-tenant processaria recibo do tenant errado". Specs antigos
     * que chamavam sem passar agora precisam passar o cooperativaId
     * (o caller listener sempre passa).
     */
    cooperativaIdEsperada: string;
  }) {
    const { asaasTransferId, eventId, sucesso, motivoFalha, cooperativaIdEsperada } = params;

    if (!cooperativaIdEsperada) {
      this.logger.error(
        `[F6] webhook chamado SEM cooperativaIdEsperada — bug de wiring (Sprint D2 P2 fix). asaasTransferId=${asaasTransferId}`,
      );
      throw new Error('cooperativaIdEsperada obrigatório (anti-IDOR cross-tenant).');
    }

    const recibo = await this.prisma.resgateRecibo.findFirst({
      where: { asaasTransferId, cooperativaId: cooperativaIdEsperada },
    });
    if (!recibo) {
      this.logger.warn(
        `[F6] webhook asaasTransferId=${asaasTransferId} cooperativaId=${cooperativaIdEsperada} — recibo não encontrado, ignorando`,
      );
      return { skipped: 'recibo-nao-encontrado' };
    }

    // Defense in depth — recibo.cooperativaId vem do banco; igual ao where.
    if (cooperativaIdEsperada !== recibo.cooperativaId) {
      this.logger.error(
        `[F6] webhook double-check tenant FALHOU: esperado=${cooperativaIdEsperada} recibo=${recibo.cooperativaId} (${recibo.numeroRecibo}) — rejeitando`,
      );
      return { skipped: 'tenant-mismatch', reciboId: recibo.id };
    }

    // REFORÇO 2: idempotência webhook.
    if (recibo.ultimoWebhookEventId === eventId) {
      this.logger.log(
        `[F6] webhook duplicado eventId=${eventId} recibo=${recibo.numeroRecibo} — skip`,
      );
      return { skipped: 'webhook-duplicado', reciboId: recibo.id };
    }

    if (sucesso) {
      // Sprint D2 (16/06/2026) — D-novo-RESGATE-PIX-SEM-CAIXA P1:
      // tokenContabilService é OBRIGATÓRIO no caminho de webhook PAGO. Em
      // produção sempre está injetado via FinanceiroModule.export; specs
      // antigos que passam undefined falham aqui (fail-fast antes da tx).
      // Asaas re-envia eventId em backoff se a tx Serializable abaixo falhar
      // ou se este throw acontecer.
      if (!this.tokenContabilService) {
        this.logger.error(
          `[F6 D2] tokenContabilService AUSENTE no webhook PAGO — bug de wiring? recibo=${recibo.numeroRecibo} tenant=${recibo.cooperativaId}`,
        );
        throw new Error(
          'tokenContabilService obrigatório no webhook PAGO (D-RESGATE-PIX-SEM-CAIXA P1) — verifique injeção via FinanceiroModule.',
        );
      }

      // F6 C.4 P2 F6-7 (14/06/2026 — review pesada): CAS + queima + ledger
      // unidos numa ÚNICA tx Serializable. Antes: CAS fora da tx, queima
      // numa tx separada — crash entre os 2 deixava recibo=PAGO_RECIBO_
      // EMITIDO com tokens não-queimados (saldoBloqueadoResgate preso,
      // contabilidade desencontrada). Agora tudo num bloco atômico.
      //
      // Sprint D2 (16/06/2026): contábil (lancarResgatePix) NÃO entra dentro
      // da tx Serializable. Razão: queremos commit garantido de saldo+ledger
      // mesmo se contábil falhar (PIX já saiu de fato em Asaas). Estratégia:
      // tx commita saldo+ledger; APÓS commit, tenta contábil; se falhar, marca
      // recibo PAGO_CREDITO_PENDENTE em tx separada pra alerta admin (nunca
      // perde o lançamento — cron de reconciliação re-tenta).
      let result: { swapCount: number; numeroRecibo: string };
      try {
        result = await this.prisma.$transaction(
          async (tx) => {
            // REFORÇO 3: CAS APROVADO_PIX_DISPARADO → PAGO_RECIBO_EMITIDO.
            const swap = await tx.resgateRecibo.updateMany({
              where: {
                id: recibo.id,
                cooperativaId: recibo.cooperativaId,
                status: 'APROVADO_PIX_DISPARADO',
              },
              data: {
                status: 'PAGO_RECIBO_EMITIDO',
                pagoEm: new Date(),
                ultimoWebhookEventId: eventId,
              },
            });
            if (swap.count === 0) {
              // CAS perdeu — sai da tx sem fazer nada (rollback implícito).
              return { swapCount: 0, numeroRecibo: recibo.numeroRecibo };
            }

            // QUEIMA do saldo bloqueado + ledger DEBITO RESGATE_PIX.
            const saldo = await tx.cooperTokenSaldo.findUnique({
              where: { cooperadoId: recibo.cooperadoEstabelecimentoId },
            });
            if (!saldo) throw new Error('Saldo do estabelecimento sumiu pré-queima');
            const saldoBloq = Number(saldo.saldoBloqueadoResgate ?? 0);
            const quantidade = Number(recibo.valorBrutoTokens);
            const novoSaldoBloq = Math.round((saldoBloq - quantidade) * 10000) / 10000;
            if (novoSaldoBloq < 0) {
              throw new Error(`Invariante violada: saldoBloqueadoResgate ficaria negativo (${novoSaldoBloq})`);
            }
            // P2: updateMany com tenant.
            await tx.cooperTokenSaldo.updateMany({
              where: {
                cooperadoId: recibo.cooperadoEstabelecimentoId,
                cooperativaId: recibo.cooperativaId,
              },
              data: {
                saldoBloqueadoResgate: novoSaldoBloq,
                totalResgatado: { increment: quantidade },
              },
            });
            // F6 C.4 re-review (14/06): `saldoApos` reflete o saldo TOTAL
            // de tokens pós-operação (disp + bloq), não só o disponível —
            // pra auditoria contábil ver o estado completo após a queima.
            const saldoTotalApos =
              Math.round(
                (Number(saldo.saldoDisponivel) + novoSaldoBloq) * 10000,
              ) / 10000;
            await tx.cooperTokenLedger.create({
              data: {
                cooperadoId: recibo.cooperadoEstabelecimentoId,
                cooperativaId: recibo.cooperativaId,
                tipo: CooperTokenTipo.RESGATE_PIX,
                operacao: CooperTokenOperacao.DEBITO,
                quantidade,
                saldoApos: saldoTotalApos, // disp + bloq pós-queima
                referenciaId: recibo.id,
                referenciaTabela: 'ResgateRecibo',
                descricao: `Liquidação de voucher CooperToken — Recibo ${recibo.numeroRecibo} (R$ ${Number(recibo.valorLiquidoReais).toFixed(2)} via PIX). Cooperativa quitou passivo.`,
              },
            });
            return { swapCount: 1, numeroRecibo: recibo.numeroRecibo };
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
      } catch (err) {
        // Erro na tx Serializable — tudo revertido. Loga + re-throw pro
        // listener tratar (Asaas re-envia em backoff; cron de reconciliação
        // D-novo-F6-RECONCILIACAO-CRON P2 cobre janela longa).
        this.logger.error(
          `[F6] webhook PAGO tx falhou recibo=${recibo.numeroRecibo}: ${(err as Error).message}`,
        );
        throw err;
      }

      if (result.swapCount === 0) {
        this.logger.warn(
          `[F6] webhook PAGO compare-and-swap perdeu — recibo ${recibo.numeroRecibo} já estava em outro estado (atual: ${recibo.status})`,
        );
        return { skipped: 'compare-and-swap-perdeu', reciboId: recibo.id };
      }

      // Sprint D2 (16/06/2026) — Bloco (c) D-RESGATE-PIX-SEM-CAIXA P1:
      // contábil pós-tx. PIX já saiu (TRANSFER_DONE), saldo+ledger
      // commitados na tx acima. Tenta lançar D Passivo / C Caixa.
      // Falha aqui NÃO faz throw (PIX é irreversível); degrada status pra
      // PAGO_CREDITO_PENDENTE pra alerta admin (cron reconciliação re-tenta).
      try {
        // P1 reviewers (16/06): assinatura sem `tx` (método é fora da tx
        // Serializable por design — usa this.prisma); referenciaId + Tabela
        // obrigatórios pra idempotência da cron de reconciliação; valor
        // arredondado no ponto de origem (defesa Decimal→Number float).
        // recibo.cooperativaId vem do banco (findFirst sem JWT inject —
        // confiável por origem, igualdade com params.cooperativaId implícita).
        await this.tokenContabilService.lancarResgatePix({
          cooperativaId: recibo.cooperativaId,
          cooperadoId: recibo.cooperadoEstabelecimentoId,
          valor: Math.round(Number(recibo.valorLiquidoReais) * 100) / 100,
          descricao: `Resgate ${recibo.numeroRecibo}`,
          observacoes: `Recibo ${recibo.numeroRecibo} — liquidação voucher CooperToken (PIX-out Asaas ${recibo.asaasTransferId ?? '?'})`,
          referenciaId: recibo.id,
          referenciaTabela: 'ResgateRecibo',
        });
        this.logger.log(
          `[F6 D2] LancamentoCaixa D Passivo/C Caixa emitido pra recibo=${recibo.numeroRecibo} valor=R$ ${Number(recibo.valorLiquidoReais).toFixed(2)}`,
        );
      } catch (errContabil) {
        const msgContabil =
          errContabil instanceof Error ? errContabil.message : 'erro desconhecido';
        this.logger.error(
          `[F6 D2] CONTABIL FALHOU pós-saída-de-caixa recibo=${recibo.numeroRecibo} — degradando pra PAGO_CREDITO_PENDENTE. Motivo: ${msgContabil}`,
        );
        try {
          await this.prisma.resgateRecibo.updateMany({
            where: { id: recibo.id, cooperativaId: recibo.cooperativaId, status: 'PAGO_RECIBO_EMITIDO' },
            data: {
              status: 'PAGO_CREDITO_PENDENTE',
              motivoFalha: `Contábil pendente: ${msgContabil.slice(0, 400)}`,
            },
          });
          this.logger.warn(
            `[F6 D2] recibo=${recibo.numeroRecibo} marcado PAGO_CREDITO_PENDENTE — admin revisar + cron reconciliação re-tenta.`,
          );
          // Re-review orquestrador Sprint D2 (16/06): espelha F2 (compra-pj
          // credito-pendente) — emite evento pra admin ver pendência no
          // painel, não só no log. Princípio "nenhuma saída de caixa
          // silenciosa". Cron de reconciliação (D-novo-RECONCILIACAO-
          // CONTABIL-CRON P2) re-tenta o lançamento contábil + zera o
          // alerta quando sucesso.
          this.eventEmitter.emit('cooper-token-resgate.credito-pendente', {
            reciboId: recibo.id,
            cooperativaId: recibo.cooperativaId,
            cooperadoEstabelecimentoId: recibo.cooperadoEstabelecimentoId,
            numeroRecibo: recibo.numeroRecibo,
            valorLiquidoReais: Number(recibo.valorLiquidoReais),
            asaasTransferId: recibo.asaasTransferId,
            motivoContabil: msgContabil.slice(0, 400),
            eventId,
          });
        } catch (errStatus) {
          // Não conseguiu nem mudar status — caso extremo, loga pra investigação.
          this.logger.error(
            `[F6 D2] FALHA EXTREMA: recibo=${recibo.numeroRecibo} contábil falhou E status update falhou. Investigar manualmente. Motivo status: ${(errStatus as Error).message}`,
          );
        }
      }

      this.logger.log(
        `[F6] webhook PAGO recibo=${recibo.numeroRecibo} — queima de ${Number(recibo.valorBrutoTokens)} tokens + ledger RESGATE_PIX (tx Serializable única) + LancamentoCaixa (Sprint D2)`,
      );
      return { sucesso: true, reciboId: recibo.id };
    }

    // ── FAILED ──
    //
    // F6 C.5 GAP-1 (14/06/2026 — re-review orquestrador): CAS de status +
    // estorno (saldo + ledger) + gravação do ultimoWebhookEventId TUDO numa
    // ÚNICA tx Serializable. Espelha o caminho de sucesso (F6-7). Crash
    // entre os passos NÃO deixa mais o recibo em FALHA_PIX com tokens
    // ainda bloqueados — tx Serializable rollback restaura estado anterior
    // (status volta pra APROVADO_PIX_DISPARADO; Asaas re-envia webhook).
    let failedResult: { swapCount: number; estornoAplicado: boolean };
    try {
      failedResult = await this.prisma.$transaction(
        async (tx) => {
          const swap = await tx.resgateRecibo.updateMany({
            where: {
              id: recibo.id,
              cooperativaId: recibo.cooperativaId,
              status: 'APROVADO_PIX_DISPARADO',
            },
            data: {
              status: 'FALHA_PIX',
              falhaEm: new Date(),
              motivoFalha: motivoFalha ?? 'Asaas reportou falha',
              ultimoWebhookEventId: eventId,
            },
          });
          if (swap.count === 0) {
            return { swapCount: 0, estornoAplicado: false };
          }
          const r = await this.aplicarEstornoEmTx(tx, {
            recibo,
            statusFinal: 'FALHA_PIX',
            motivoFalha,
          });
          return { swapCount: 1, estornoAplicado: r.aplicado };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (err) {
      this.logger.error(
        `[F6] webhook FAILED tx falhou recibo=${recibo.numeroRecibo}: ${(err as Error).message}`,
      );
      throw err;
    }

    if (failedResult.swapCount === 0) {
      this.logger.warn(
        `[F6] webhook FAILED compare-and-swap perdeu — recibo ${recibo.numeroRecibo}`,
      );
      return { skipped: 'compare-and-swap-perdeu', reciboId: recibo.id };
    }

    this.logger.warn(
      `[F6] webhook FAILED recibo=${recibo.numeroRecibo} — estorno ${failedResult.estornoAplicado ? 'aplicado' : 'skip (já estornado por outra via)'}, motivo: ${motivoFalha}`,
    );
    return { sucesso: false, reciboId: recibo.id, motivoFalha };
  }

  /**
   * F6 C.5 GAP-1 (14/06/2026 — re-review orquestrador): helper extraído pra
   * permitir que webhook FAILED faça CAS + estorno + gravação do eventId
   * numa ÚNICA tx Serializable (espelha o caminho de sucesso/F6-7). Sem
   * isso, crash entre o CAS de status e o estorno deixaria recibo em
   * FALHA_PIX com tokens ainda bloqueados (saldoBloqueadoResgate preso).
   *
   * Executa só o que precisa estar dentro da tx (saldo + ledger). Caller
   * é responsável por abrir a tx Serializable e gravar o status do recibo.
   *
   * Retorna `aplicado: false` se a invariante detectar que o estorno já
   * aconteceu por outra via (saldoBloq < quantidade); caller decide
   * continuar ou abortar.
   */
  private async aplicarEstornoEmTx(
    tx: Prisma.TransactionClient,
    params: {
      recibo: {
        id: string;
        cooperativaId: string;
        cooperadoEstabelecimentoId: string;
        valorBrutoTokens: any;
        numeroRecibo: string;
      };
      statusFinal: 'RECUSADO' | 'CANCELADO' | 'FALHA_PIX';
      motivoFalha?: string;
    },
  ): Promise<{ aplicado: boolean; saldoTotalApos: number | null }> {
    const { recibo, statusFinal, motivoFalha } = params;
    const quantidade = Number(recibo.valorBrutoTokens);

    const saldo = await tx.cooperTokenSaldo.findUnique({
      where: { cooperadoId: recibo.cooperadoEstabelecimentoId },
    });
    if (!saldo) {
      throw new Error('Saldo do estabelecimento sumiu pré-estorno');
    }
    const saldoDisp = Number(saldo.saldoDisponivel);
    const saldoBloq = Number(saldo.saldoBloqueadoResgate ?? 0);
    const novoSaldoDisp = Math.round((saldoDisp + quantidade) * 10000) / 10000;
    const novoSaldoBloq = Math.round((saldoBloq - quantidade) * 10000) / 10000;
    if (novoSaldoBloq < 0) {
      // Invariante: estorno já aplicado por outra via — log + skip silencioso.
      this.logger.warn(
        `[F6] estornar ${recibo.numeroRecibo} já aplicado (saldoBloqueado=${saldoBloq}, qtd=${quantidade}) — skip`,
      );
      return { aplicado: false, saldoTotalApos: null };
    }
    // Multi-tenant: updateMany com tenant guard.
    await tx.cooperTokenSaldo.updateMany({
      where: {
        cooperadoId: recibo.cooperadoEstabelecimentoId,
        cooperativaId: recibo.cooperativaId,
      },
      data: {
        saldoDisponivel: novoSaldoDisp,
        saldoBloqueadoResgate: novoSaldoBloq,
      },
    });
    // GAP-2 (C.5): saldoApos = total disp + bloq pós-operação (não só
    // disp). Auditoria contábil vê o estado completo do saldo.
    const saldoTotalApos =
      Math.round((novoSaldoDisp + novoSaldoBloq) * 10000) / 10000;
    await tx.cooperTokenLedger.create({
      data: {
        cooperadoId: recibo.cooperadoEstabelecimentoId,
        cooperativaId: recibo.cooperativaId,
        tipo: CooperTokenTipo.ESTORNO_RESGATE_PIX,
        operacao: CooperTokenOperacao.CREDITO,
        quantidade,
        saldoApos: saldoTotalApos,
        referenciaId: recibo.id,
        referenciaTabela: 'ResgateRecibo',
        descricao: `Estorno de resgate ${recibo.numeroRecibo} (${statusFinal}). Tokens devolvidos ao saldo disponível.${motivoFalha ? ` Motivo: ${motivoFalha}` : ''}`,
      },
    });
    return { aplicado: true, saldoTotalApos };
  }

  /**
   * Estorno auditável (interno) — devolve tokens bloqueados ao saldoDisponivel
   * e cria ledger CREDITO ESTORNO_RESGATE_PIX. NUNCA apaga registros.
   *
   * Wrapper que abre tx Serializable própria. Usado por `recusarResgate` e
   * `cancelarResgate` (que NÃO compartilham tx com nada externo). Webhook
   * FAILED chama `aplicarEstornoEmTx` diretamente DENTRO da própria tx que
   * faz o CAS de status (F6 C.5 GAP-1).
   *
   * Invariante: saldoDisponivel + saldoBloqueadoResgate conserva (saí de
   * bloqueado, volta pra disponível — soma constante).
   */
  private async estornarResgateInterno(params: {
    recibo: { id: string; cooperativaId: string; cooperadoEstabelecimentoId: string; valorBrutoTokens: any; numeroRecibo: string };
    statusFinal: 'RECUSADO' | 'CANCELADO' | 'FALHA_PIX';
    motivoFalha?: string;
    skipStatusUpdate?: boolean;
  }) {
    const { recibo, statusFinal, motivoFalha } = params;

    await this.prisma.$transaction(
      async (tx) => {
        await this.aplicarEstornoEmTx(tx, { recibo, statusFinal, motivoFalha });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  /**
   * Lista recibos PENDENTE_APROVACAO_COOP pra admin revisar.
   * Filtros: status (default PENDENTE_APROVACAO_COOP), valor mín/máx, datas.
   */
  async listarResgatesPendentes(params: {
    cooperativaId: string;
    status?: string;
    valorMin?: number;
    valorMax?: number;
    dataInicio?: Date;
    dataFim?: Date;
    page?: number;
    limit?: number;
  }) {
    const { cooperativaId, status, valorMin, valorMax, dataInicio, dataFim } = params;
    const page = params.page ?? 1;
    const limit = params.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: any = { cooperativaId };
    if (status) {
      where.status = status;
    } else {
      where.status = 'PENDENTE_APROVACAO_COOP';
    }
    if (valorMin !== undefined || valorMax !== undefined) {
      where.valorBrutoReais = {};
      if (valorMin !== undefined) where.valorBrutoReais.gte = valorMin;
      if (valorMax !== undefined) where.valorBrutoReais.lte = valorMax;
    }
    if (dataInicio || dataFim) {
      where.createdAt = {};
      if (dataInicio) where.createdAt.gte = dataInicio;
      if (dataFim) where.createdAt.lte = dataFim;
    }

    const [itemsRaw, total] = await Promise.all([
      this.prisma.resgateRecibo.findMany({
        where,
        include: {
          cooperadoEstabelecimento: {
            // F6 Bloco C.3 (13/06/2026): pixUltimaAlteracaoEm vem junto pra
            // o admin ver banner amber "alterada <24h" no Dialog de
            // aprovação (REFORÇO ANTI-FRAUDE Luciano). Single query, sem N+1.
            select: {
              id: true,
              nomeCompleto: true,
              email: true,
              pixUltimaAlteracaoEm: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.resgateRecibo.count({ where }),
    ]);

    // Deriva `alteradaRecentemente` (chave alterada nas últimas 24h ANTES
    // de o recibo ter sido criado — fecha vetor sessão-sequestrada).
    const VINTE_QUATRO_H_MS = 24 * 60 * 60 * 1000;
    const items = itemsRaw.map((r) => {
      const alteradaEm = r.cooperadoEstabelecimento?.pixUltimaAlteracaoEm;
      const alteradaRecentemente =
        !!alteradaEm &&
        r.createdAt.getTime() - alteradaEm.getTime() < VINTE_QUATRO_H_MS &&
        r.createdAt.getTime() >= alteradaEm.getTime();
      // F6 C.4 P2 (14/06/2026 — review pesada): pixChave SEMPRE MASCARADA
      // na resposta do admin. PII (chave PIX) não passa pela UI — o snapshot
      // pro Asaas usa recibo.pixChave do banco direto (no aprovarResgate).
      // Admin valida por OUTRO canal (telefone/email do estabelecimento) +
      // o tipo (TELEFONE/EMAIL/CPF/...) já sinaliza se a chave esperada bate.
      return {
        ...r,
        pixChave: DadosBancariosService.mascarar(r.pixChave),
        alteradaRecentemente,
      };
    });

    return { items, total, page, limit, pages: Math.ceil(total / limit) };
  }

  /**
   * F6 Bloco C.1 (13/06/2026) — Lista resgates DO PRÓPRIO estabelecimento.
   *
   * Anti-IDOR estrito: filtra por `cooperadoEstabelecimentoId = req.user.
   * cooperadoId` + `cooperativaId` do JWT. Cooperado NUNCA vê resgates de
   * outro cooperado nem de outro tenant (espelha padrão F3 membros-
   * disponiveis). Ordem decrescente por criação — usuário vê o mais
   * recente em cima.
   */
  async listarMeusResgates(params: {
    estabelecimentoCooperadoId: string;
    cooperativaId: string;
    status?: string;
    page?: number;
    limit?: number;
  }) {
    const { estabelecimentoCooperadoId, cooperativaId, status } = params;
    const page = params.page ?? 1;
    const limit = params.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: any = {
      cooperadoEstabelecimentoId: estabelecimentoCooperadoId,
      cooperativaId,
    };
    if (status) where.status = status;

    const [itemsRaw, total] = await Promise.all([
      this.prisma.resgateRecibo.findMany({
        where,
        // Sem `include cooperadoEstabelecimento` aqui — é ele mesmo, redundante.
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.resgateRecibo.count({ where }),
    ]);

    // F6 C.4 P2 (14/06/2026 — review pesada): pixChave MASCARADA mesmo
    // na lista do próprio cooperado. Defense in depth contra shoulder
    // surfing + console screenshots; cooperado já viu/digitou a chave em
    // /portal/seguranca/dados-bancarios — não precisa ver de novo aqui.
    const items = itemsRaw.map((r) => ({
      ...r,
      pixChave: DadosBancariosService.mascarar(r.pixChave),
    }));

    return { items, total, page, limit, pages: Math.ceil(total / limit) };
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

  // ════════════════════════════════════════════════════════════════════
  //  M39 (16/06/2026) — Emissão Admin em Lote
  // ════════════════════════════════════════════════════════════════════
  //
  // Admin/SUPER_ADMIN/OPERADOR emite CooperTokens novos no ecossistema
  // da cooperativa pra N destinatários num único lote. Substitui
  // `enviarTokensAdmin` single-target (que fica @deprecated).
  //
  // Substituicao SEMÂNTICA crítica: NÃO reusar `creditar()` cru.
  // creditar() emite COOPER_TOKEN_EVENTS.EMITIDO → handleEmitido →
  // lancarEmissaoFaturaCheia (D Custo Desconto / C Passivo) — template
  // ERRADO pra bonificação admin. Em vez disso, fazemos write self-
  // contained (saldo + ledger) DENTRO da tx + chamamos o template
  // novo `lancarEmissaoAdminLote` (D Despesa de Bonificação / C
  // Passivo Tokens) APÓS commit, agregado 1× pelo lote inteiro.
  //
  // Multi-tenant: servidor REVALIDA cada cooperadoId.cooperativaId
  // no DB (anti-IDOR). Nunca confiar na lista vinda do cliente.
  //
  // Idempotência: clientRequestId → referenciaTabela='EMISSAO_ADMIN_
  // LOTE' + referenciaId=clientRequestId. Helper executarMassWrite
  // checa via verificarIdempotencia (ledger.findFirst com mesma chave).
  //
  // Tier ALTO sobre TOTAL: 1 OTP único, não per-linha. assertLimite
  // sobre soma (mesma fórmula F3 distribuir).
  // ════════════════════════════════════════════════════════════════════

  async emitirLoteAdmin(params: {
    cooperativaId: string;
    /** Usuário admin que emite (vai pro AuditLog + observacoes). */
    usuarioId: string;
    /** Perfil real do usuário (ADMIN/SUPER_ADMIN/OPERADOR) — vai pro AuditLog. */
    usuarioPerfil?: string;
    /** Linhas do lote — cada uma é 1 destinatário + quantidade. */
    distribuicoes: Array<{ destinatarioCooperadoId: string; quantidade: number }>;
    /** Descrição livre do lote (vai pro ledger entry de cada destinatário). */
    descricao?: string;
    /** Tipo de bonificação semântico (default BONIFICACAO_ADMIN). */
    tipo?: CooperTokenTipo;
    /** OTP step-up — exigido em tier ALTO (>R$50 no total). */
    otpDesafioId?: string;
    otpCodigo?: string;
    /** Idempotency-key estável (UUID v4 recomendado, mínimo 8 chars). */
    clientRequestId: string;
    /** PREVIEW = dry-run; CONFIRM = grava em tx Serializable. */
    modo: 'PREVIEW' | 'CONFIRM';
    /** Audit trail (vem do controller via req.ip + headers). */
    ip?: string;
    userAgent?: string;
  }) {
    const {
      cooperativaId,
      usuarioId,
      usuarioPerfil,
      distribuicoes,
      descricao,
      tipo,
      otpDesafioId,
      otpCodigo,
      clientRequestId,
      modo,
      ip,
      userAgent,
    } = params;

    // ── Guards universais ──
    if (!cooperativaId) {
      throw new BadRequestException(
        'cooperativaId obrigatório no caminho admin. SUPER_ADMIN deve impersonar uma cooperativa antes de emitir lote.',
      );
    }
    if (!distribuicoes || distribuicoes.length === 0) {
      throw new BadRequestException('Lote vazio — informe ao menos 1 destinatário.');
    }
    if (distribuicoes.some((d) => !d.destinatarioCooperadoId || d.quantidade <= 0)) {
      throw new BadRequestException('Cada linha precisa ter destinatarioCooperadoId + quantidade > 0.');
    }

    // ── Anti-IDOR: re-validar cada cooperadoId.cooperativaId ──
    // Nunca confiar na lista vinda do cliente. Buscar TODOS os cooperados
    // do lote num único query filtrando por cooperativaId + STATUS_PERMITIDOS_CREDITO.
    const destinatariosIds = [...new Set(distribuicoes.map((d) => d.destinatarioCooperadoId))];
    const cooperadosValidos = await this.prisma.cooperado.findMany({
      where: {
        id: { in: destinatariosIds },
        cooperativaId,
        status: { in: CooperTokenService.STATUS_PERMITIDOS_CREDITO as any[] },
      },
      select: { id: true, nomeCompleto: true, status: true },
    });
    const idsValidos = new Set(cooperadosValidos.map((c) => c.id));
    const idsInvalidos = destinatariosIds.filter((id) => !idsValidos.has(id));

    // ── Calcular totais (round 4 decimais — mata ruído IEEE) ──
    const somaQuantidade =
      Math.round(distribuicoes.reduce((s, d) => s + d.quantidade, 0) * 10000) / 10000;
    const config = await this.getConfig(cooperativaId);
    const valorTokenReais = Number(config?.valorTokenReais ?? 0.45);
    const valorTotalReais = Math.round(somaQuantidade * valorTokenReais * 100) / 100;
    const tier = calcularTier(valorTotalReais);

    // ── Tier ALTO: OTP único sobre o TOTAL ──
    if (modo === 'CONFIRM' && tier === 'ALTO') {
      if (!otpDesafioId || !otpCodigo) {
        throw new BadRequestException(
          `Lote tier ALTO (valor total R$ ${valorTotalReais.toFixed(2)} > R$ 50): OTP obrigatório. Solicite via /cooper-token/otp-step-up antes do CONFIRM.`,
        );
      }
      if (!this.otpDesafioService) {
        throw new Error('OtpDesafioService não disponível (wiring do módulo).');
      }
      await this.otpDesafioService.validarOuLancar({
        desafioId: otpDesafioId,
        codigo: otpCodigo,
        cooperativaId,
      });
    }

    // ── Idempotência callback ──
    type LoteResult = {
      loteId: string;
      idempotente: boolean;
      totalEmitido: number;
      valorTotalReais: number;
      tier?: string;
      destinatarios: Array<{ cooperadoId: string; nomeCompleto: string; quantidade: number; ledgerId: string }>;
    };
    const verificarIdempotencia = async (): Promise<LoteResult | null> => {
      const jaProcessado = await this.prisma.cooperTokenLedger.findFirst({
        where: {
          referenciaId: clientRequestId,
          referenciaTabela: 'EMISSAO_ADMIN_LOTE',
          cooperativaId,
        },
        select: { id: true, referenciaId: true, createdAt: true },
      });
      if (!jaProcessado) return null;
      this.logger.log(
        `[M39 emitirLoteAdmin] idempotência hit — clientRequestId=${clientRequestId} já processado em ${jaProcessado.createdAt.toISOString()}`,
      );
      return {
        loteId: clientRequestId,
        idempotente: true,
        totalEmitido: somaQuantidade,
        valorTotalReais,
        destinatarios: [],
      };
    };

    // ── Preview callback ──
    const preview = async (items: typeof distribuicoes) => {
      const alertas: MassWriteAlerta[] = [];
      if (idsInvalidos.length > 0) {
        alertas.push({
          codigo: 'DESTINATARIOS_INVALIDOS',
          mensagem: `${idsInvalidos.length} destinatário(s) não encontrado(s) ou inativos no tenant: ${idsInvalidos.slice(0, 3).join(', ')}${idsInvalidos.length > 3 ? '...' : ''}.`,
          severidade: 'bloqueante',
        });
      }
      return {
        totalItens: items.length,
        alertas,
        resumo: {
          somaQuantidade,
          valorTokenReais,
          valorTotalReais,
          tier,
          destinatariosValidos: cooperadosValidos.length,
          destinatariosInvalidos: idsInvalidos.length,
        },
      };
    };

    // ── Commit callback ──
    const commit = async (ctx: { tx: Prisma.TransactionClient; items: typeof distribuicoes }): Promise<LoteResult> => {
      const { tx, items } = ctx;
      const tipoFinal = tipo ?? CooperTokenTipo.BONIFICACAO_ADMIN;
      const descricaoFinal = descricao ?? `Emissão admin lote ${clientRequestId.slice(0, 8)}`;
      const ledgerEntries: LoteResult['destinatarios'] = [];

      for (const linha of items) {
        const { destinatarioCooperadoId, quantidade } = linha;
        // saldo (criar se não existir)
        let saldo = await tx.cooperTokenSaldo.findUnique({
          where: { cooperadoId: destinatarioCooperadoId },
        });
        const novoSaldoDisponivel = Number(saldo?.saldoDisponivel ?? 0) + quantidade;
        const novoTotalEmitido = Number(saldo?.totalEmitido ?? 0) + quantidade;
        if (saldo) {
          await tx.cooperTokenSaldo.update({
            where: { cooperadoId: destinatarioCooperadoId },
            data: {
              saldoDisponivel: novoSaldoDisponivel,
              totalEmitido: novoTotalEmitido,
            },
          });
        } else {
          await tx.cooperTokenSaldo.create({
            data: {
              cooperadoId: destinatarioCooperadoId,
              cooperativaId,
              saldoDisponivel: quantidade,
              totalEmitido: quantidade,
            },
          });
        }

        const expiracaoEm = new Date();
        expiracaoEm.setMonth(expiracaoEm.getMonth() + 12);
        const entry = await tx.cooperTokenLedger.create({
          data: {
            cooperadoId: destinatarioCooperadoId,
            cooperativaId,
            tipo: tipoFinal,
            operacao: CooperTokenOperacao.CREDITO,
            quantidade,
            saldoApos: novoSaldoDisponivel,
            valorReais: Math.round(quantidade * valorTokenReais * 100) / 100,
            // Tag pra reclassificação contábil futura.
            referenciaId: clientRequestId,
            referenciaTabela: 'EMISSAO_ADMIN_LOTE',
            expiracaoEm,
            descricao: `${descricaoFinal} (admin ${usuarioId})`,
          },
        });
        ledgerEntries.push({
          cooperadoId: destinatarioCooperadoId,
          nomeCompleto: cooperadosValidos.find((c) => c.id === destinatarioCooperadoId)?.nomeCompleto ?? '?',
          quantidade,
          ledgerId: entry.id,
        });
      }

      return {
        loteId: clientRequestId,
        idempotente: false,
        totalEmitido: somaQuantidade,
        valorTotalReais,
        tier,
        destinatarios: ledgerEntries,
      };
    };

    // ── Executar via helper ──
    const resultado = await executarMassWrite(this.prisma, {
      acao: 'MASS_WRITE_EMISSAO_ADMIN',
      cooperativaId,
      usuarioId,
      // P2 fix reviewer multitenant 16/06 — perfil real no AuditLog
      usuarioPerfil,
      clientRequestId,
      items: distribuicoes,
      mode: modo,
      verificarIdempotencia,
      preview,
      commit,
      logExtra: () => ({
        somaQuantidade,
        valorTotalReais,
        tier,
        destinatariosCount: distribuicoes.length,
      }),
      ip,
      userAgent,
    });

    // ── Lançamento contábil agregado (APÓS commit, fora da tx) ──
    // Bypass do COOPER_TOKEN_EVENTS.EMITIDO pra evitar template errado.
    // Chama o template novo lancarEmissaoAdminLote (D 5.1.03 / C 5.1.02).
    // Idempotente: só dispara em CONFIRM não-idempotente.
    //
    // P1 reviewer financeiro 16/06 — LancamentoCaixa.cooperadoId é null
    // (lote AGREGADO 1× por design: schema é String? nullable). Reports
    // por cooperado precisam reconstruir via ledger (referenciaTabela=
    // 'EMISSAO_ADMIN_LOTE' + referenciaId=loteId casa entries N:1 com 1
    // LancamentoCaixa). Rastreabilidade preservada via `observacoes`.
    //
    // P1 reviewer financeiro 16/06 — catch escalado de warn → error.
    // Se contábil falha (ex: conta 5.1.03 não criada por bug futuro),
    // saldo+ledger já commitaram → divergência ledger↔contábil. Hoje
    // log.error sinaliza pra ops + AuditLog do mass-write já tem o
    // payload. Próxima evolução: fila de reprocessamento (catalogado
    // como follow-up no D-novo-EMISSAO-ADMIN-CONTABIL P2).
    if (
      resultado.modo === 'CONFIRM' &&
      !(resultado.resultado as any).idempotente &&
      valorTotalReais > 0 &&
      this.tokenContabilService
    ) {
      try {
        await this.tokenContabilService.lancarEmissaoAdminLote({
          cooperativaId,
          valor: valorTotalReais,
          competencia: new Date().toISOString().slice(0, 7),
          descricao: descricao ?? `Emissão admin lote ${clientRequestId.slice(0, 8)}`,
          loteId: clientRequestId,
        });
      } catch (err) {
        this.logger.error(
          `[M39 emitirLoteAdmin] ⚠️ DIVERGÊNCIA LEDGER↔CONTÁBIL — falha ao lançar contábil pro lote ${clientRequestId} (cooperativa ${cooperativaId}, R$ ${valorTotalReais}). Saldo+ledger já commitaram. Erro: ${(err as Error).message}. Necessário reprocessamento manual.`,
        );
      }
    }

    return resultado;
  }

  // ════════════════════════════════════════════════════════════════════
  //  M39 (16/06/2026) — Estorno de Emissão Admin em Lote
  // ════════════════════════════════════════════════════════════════════
  //
  // Reverte o lote INTEIRO: debita saldo de volta + cria entries
  // ESTORNO_BONIFICACAO_ADMIN no ledger (NUNCA apaga registro original).
  // Dispara lancarEstornoEmissaoAdminLote (D 5.1.02 / C 5.1.03) agregado.
  //
  // Confirmação explícita: admin precisa passar `confirmado: true` no
  // payload (UI mostra lista + total ANTES de chamar este método).
  //
  // Multi-tenant: filtro por cooperativaId em todas as queries.
  //
  // Idempotência: estornar 2× o mesmo lote retorna `idempotente: true`
  // (procura entries ESTORNO já criadas com referencia ao loteId).
  // ════════════════════════════════════════════════════════════════════

  async estornarEmissaoLote(params: {
    cooperativaId: string;
    /** loteId = clientRequestId da emissão original. */
    loteId: string;
    /** Admin que estorna (vai pro ledger + AuditLog). */
    usuarioId: string;
    /** Razão do estorno (mín 10 chars — admin precisa justificar). */
    motivo: string;
    /** UI obrigatoriamente preenche após mostrar lista + total ao admin. */
    confirmado: boolean;
  }) {
    const { cooperativaId, loteId, usuarioId, motivo, confirmado } = params;

    if (!cooperativaId) {
      throw new BadRequestException('cooperativaId obrigatório.');
    }
    if (!loteId || loteId.trim().length < 8) {
      throw new BadRequestException('loteId obrigatório (UUID da emissão original).');
    }
    if (!motivo || motivo.trim().length < 10) {
      throw new BadRequestException(
        'Motivo do estorno obrigatório (mínimo 10 chars). Admin precisa justificar a reversão de passivo.',
      );
    }
    if (!confirmado) {
      throw new BadRequestException(
        'Confirmação explícita obrigatória. A UI deve apresentar a lista de destinatários + total ao admin ANTES de chamar este endpoint com confirmado=true.',
      );
    }

    // Buscar todas as entries da emissão original (referenciaTabela='EMISSAO_ADMIN_LOTE')
    const entriesOriginais = await this.prisma.cooperTokenLedger.findMany({
      where: {
        referenciaId: loteId,
        referenciaTabela: 'EMISSAO_ADMIN_LOTE',
        cooperativaId, // multi-tenant explícito
      },
    });
    if (entriesOriginais.length === 0) {
      throw new NotFoundException(
        `Lote ${loteId} não encontrado nesta cooperativa (ou já foi totalmente estornado).`,
      );
    }

    // Idempotência: se já existe estorno do mesmo lote, retorna idempotente
    const estornosExistentes = await this.prisma.cooperTokenLedger.findFirst({
      where: {
        referenciaId: loteId,
        referenciaTabela: 'ESTORNO_EMISSAO_ADMIN_LOTE',
        cooperativaId,
      },
      select: { id: true, createdAt: true },
    });
    if (estornosExistentes) {
      this.logger.log(
        `[M39 estornarEmissaoLote] idempotência hit — lote ${loteId} já estornado em ${estornosExistentes.createdAt.toISOString()}`,
      );
      return {
        loteId,
        idempotente: true,
        totalEstornado: 0,
        destinatarios: [],
      };
    }

    const somaQuantidade =
      Math.round(entriesOriginais.reduce((s, e) => s + Number(e.quantidade), 0) * 10000) / 10000;
    // P1 fix reviewer financeiro 16/06: usar o valorReais HISTÓRICO do
    // ledger original (imutável desde a emissão), NÃO recalcular com o
    // `valorTokenReais` atual da config. Sem isso, se admin mudou o preço
    // do token entre a emissão e o estorno, o D/C do estorno não fecha
    // com o D/C da emissão original (assimetria contábil silenciosa).
    const valorTotalReais =
      Math.round(
        entriesOriginais.reduce((s, e) => s + Math.abs(Number(e.valorReais ?? 0)), 0) * 100,
      ) / 100;

    // P1-B fix re-review orquestrador 16/06: integridade dos entries originais.
    // Se há tokens emitidos (somaQuantidade > 0) mas valorReais total é 0
    // (todos os entries originais têm valorReais null), o estorno NÃO consegue
    // calcular o valor contábil correto pra reversão. Em vez de pular o
    // contábil silenciosamente (geraria divergência ledger↔contábil), bloqueia
    // antes da tx — admin precisa investigar/reprocessar manualmente os
    // entries originais antes de estornar.
    if (somaQuantidade > 0 && valorTotalReais === 0) {
      throw new BadRequestException(
        `Entries originais do lote ${loteId} sem valorReais — integridade comprometida, estorno bloqueado. Verifique se os entries originais foram gravados corretamente (todos com valorReais != null) antes de tentar estornar.`,
      );
    }

    // Executar dentro de tx Serializable (atomicidade — ou tudo, ou nada)
    const resultado = await this.prisma.$transaction(
      async (tx) => {
        const ledgerEstornos: any[] = [];
        for (const entry of entriesOriginais) {
          // Debitar saldo de volta (com guard de não-negativo)
          const saldo = await tx.cooperTokenSaldo.findUnique({
            where: { cooperadoId: entry.cooperadoId },
          });
          const saldoAtual = Number(saldo?.saldoDisponivel ?? 0);
          const quantidade = Number(entry.quantidade);
          // Se cooperado já gastou parte/tudo dos tokens (saldo < quantidade
          // original), debita o que tem (mas SEMPRE registra o estorno
          // completo no ledger pra rastreabilidade).
          const debitarReal = Math.min(saldoAtual, quantidade);
          const novoSaldo = Math.round((saldoAtual - debitarReal) * 10000) / 10000;
          await tx.cooperTokenSaldo.update({
            where: { cooperadoId: entry.cooperadoId },
            data: { saldoDisponivel: novoSaldo },
          });

          const estornoEntry = await tx.cooperTokenLedger.create({
            data: {
              cooperadoId: entry.cooperadoId,
              cooperativaId,
              tipo: CooperTokenTipo.ESTORNO_BONIFICACAO_ADMIN,
              operacao: CooperTokenOperacao.DEBITO,
              quantidade: -quantidade, // negativo pra distinguir do crédito original
              saldoApos: novoSaldo,
              // P1 fix reviewer financeiro 16/06 — usar valorReais HISTÓRICO
              // do entry original (imutável), não recalcular com preço atual.
              valorReais: entry.valorReais != null ? -Math.abs(Number(entry.valorReais)) : null,
              referenciaId: loteId,
              referenciaTabela: 'ESTORNO_EMISSAO_ADMIN_LOTE',
              descricao: `Estorno lote ${loteId.slice(0, 8)} (admin ${usuarioId}): ${motivo}`,
            },
          });
          ledgerEstornos.push({
            cooperadoId: entry.cooperadoId,
            quantidadeOriginal: quantidade,
            quantidadeDebitada: debitarReal,
            saldoFinal: novoSaldo,
            estornoLedgerId: estornoEntry.id,
          });
        }

        return {
          loteId,
          idempotente: false,
          totalEstornado: somaQuantidade,
          valorTotalReais,
          destinatarios: ledgerEstornos,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    // Lançamento contábil de reversão (fora da tx). Mesmo tratamento de
    // erro do emitirLoteAdmin: log.error sinalizando divergência ledger↔
    // contábil pra ops reprocessar manualmente.
    if (valorTotalReais > 0 && this.tokenContabilService) {
      try {
        await this.tokenContabilService.lancarEstornoEmissaoAdminLote({
          cooperativaId,
          valor: valorTotalReais,
          competencia: new Date().toISOString().slice(0, 7),
          descricao: `Estorno lote ${loteId.slice(0, 8)}: ${motivo}`,
          loteId,
        });
      } catch (err) {
        this.logger.error(
          `[M39 estornarEmissaoLote] ⚠️ DIVERGÊNCIA LEDGER↔CONTÁBIL — falha ao lançar contábil reversão pro lote ${loteId} (cooperativa ${cooperativaId}, R$ ${valorTotalReais}). Ledger ESTORNO já commitou. Erro: ${(err as Error).message}. Necessário reprocessamento manual.`,
        );
      }
    }

    this.logger.log(
      `[M39 estornarEmissaoLote] lote ${loteId} estornado por admin ${usuarioId}: ${somaQuantidade} tokens, R$ ${valorTotalReais.toFixed(2)}, ${resultado.destinatarios.length} destinatário(s)`,
    );

    return resultado;
  }

  // ════════════════════════════════════════════════════════════════════
  //  M39 — Listar lotes emitidos (UI estorno)
  // ════════════════════════════════════════════════════════════════════
  //
  // Lista lotes (groupBy referenciaId) emitidos pela cooperativa.
  // Cada lote = N entries no ledger com mesmo `referenciaId` +
  // `referenciaTabela='EMISSAO_ADMIN_LOTE'`. Inclui flag `estornado`
  // (true se já há entry ESTORNO_EMISSAO_ADMIN_LOTE pro mesmo loteId).
  // ════════════════════════════════════════════════════════════════════

  async listarLotesEmitidos(params: {
    cooperativaId: string;
    page?: number;
    limit?: number;
  }) {
    const { cooperativaId, page = 1, limit = 20 } = params;

    const lotesAgg = await this.prisma.cooperTokenLedger.groupBy({
      by: ['referenciaId'],
      where: {
        cooperativaId,
        referenciaTabela: 'EMISSAO_ADMIN_LOTE',
      },
      _sum: { quantidade: true },
      _count: { id: true },
      _min: { createdAt: true },
      orderBy: { _min: { createdAt: 'desc' } },
      skip: (page - 1) * limit,
      take: limit,
    });

    // Pra cada lote, checar se já foi estornado
    const loteIds = lotesAgg.map((l) => l.referenciaId).filter((id): id is string => !!id);
    const estornados = await this.prisma.cooperTokenLedger.findMany({
      where: {
        cooperativaId,
        referenciaTabela: 'ESTORNO_EMISSAO_ADMIN_LOTE',
        referenciaId: { in: loteIds },
      },
      select: { referenciaId: true, createdAt: true },
      distinct: ['referenciaId'],
    });
    const estornadosMap = new Map(estornados.map((e) => [e.referenciaId, e.createdAt]));

    return {
      items: lotesAgg.map((l) => ({
        loteId: l.referenciaId,
        totalDestinatarios: l._count.id,
        somaQuantidade: Number(l._sum.quantidade ?? 0),
        emitidoEm: l._min.createdAt,
        estornado: estornadosMap.has(l.referenciaId ?? ''),
        estornadoEm: estornadosMap.get(l.referenciaId ?? '') ?? null,
      })),
      page,
      limit,
    };
  }

  // ════════════════════════════════════════════════════════════════════
  //  M39 — Detalhe de 1 lote (UI estorno — confirmação)
  // ════════════════════════════════════════════════════════════════════

  async getLoteEmitido(params: { cooperativaId: string; loteId: string }) {
    const { cooperativaId, loteId } = params;

    const entries = await this.prisma.cooperTokenLedger.findMany({
      where: {
        cooperativaId,
        referenciaId: loteId,
        referenciaTabela: 'EMISSAO_ADMIN_LOTE',
      },
      orderBy: { createdAt: 'asc' },
    });
    if (entries.length === 0) {
      throw new NotFoundException(`Lote ${loteId} não encontrado nesta cooperativa.`);
    }

    const cooperadoIds = [...new Set(entries.map((e) => e.cooperadoId))];
    const cooperados = await this.prisma.cooperado.findMany({
      where: { id: { in: cooperadoIds }, cooperativaId },
      select: { id: true, nomeCompleto: true, email: true },
    });
    const cooperadoMap = new Map(cooperados.map((c) => [c.id, c]));

    const estorno = await this.prisma.cooperTokenLedger.findFirst({
      where: {
        cooperativaId,
        referenciaId: loteId,
        referenciaTabela: 'ESTORNO_EMISSAO_ADMIN_LOTE',
      },
      select: { id: true, createdAt: true, descricao: true },
    });

    const somaQuantidade =
      Math.round(entries.reduce((s, e) => s + Number(e.quantidade), 0) * 10000) / 10000;
    const config = await this.getConfig(cooperativaId);
    const valorTokenReais = Number(config?.valorTokenReais ?? 0.45);

    return {
      loteId,
      totalDestinatarios: entries.length,
      somaQuantidade,
      valorTotalReais: Math.round(somaQuantidade * valorTokenReais * 100) / 100,
      valorTokenReais,
      emitidoEm: entries[0].createdAt,
      estornado: !!estorno,
      estornadoEm: estorno?.createdAt ?? null,
      estornoDescricao: estorno?.descricao ?? null,
      destinatarios: entries.map((e) => ({
        cooperadoId: e.cooperadoId,
        nomeCompleto: cooperadoMap.get(e.cooperadoId)?.nomeCompleto ?? '?',
        email: cooperadoMap.get(e.cooperadoId)?.email ?? null,
        quantidade: Number(e.quantidade),
        ledgerId: e.id,
      })),
    };
  }
}
