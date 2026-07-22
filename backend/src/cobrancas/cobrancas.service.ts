import { Injectable, NotFoundException, BadRequestException, Logger, Optional } from '@nestjs/common';
import { ContabilidadeTributariaService } from '../contabilidade-tributaria/contabilidade-tributaria.service';
import { OnEvent } from '@nestjs/event-emitter';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma.service';
import { GatewayPagamentoService } from '../gateway-pagamento/gateway-pagamento.service';
import { ClubeVantagensService } from '../clube-vantagens/clube-vantagens.service';
import { WhatsappCicloVidaService } from '../whatsapp/whatsapp-ciclo-vida.service';
import { WhatsappSenderService } from '../whatsapp/whatsapp-sender.service';
import { EmailService } from '../email/email.service';
import { CooperTokenService } from '../cooper-token/cooper-token.service';
import { TokenContabilService } from '../financeiro/token-contabil.service';
import { CalculoMultaJurosService } from './calculo-multa-juros.service';
// Sprint Onboarding Bloco 0 Fatia 0.4 (06/06/2026) — clube discriminado.
import { CooperadoClubeService } from '../cooperado-clube/cooperado-clube.service';
import { CooperTokenTipo, Prisma } from '@prisma/client';import { AsPlatform } from '../common/tenant-context';


/**
 * Tarefa 4 correção #1 (22/07/2026) — retorno discriminado de
 * `emitirNoGatewaySeConfigurado`. Substitui o `null` anterior que confundia
 * 3 skips legítimos com 1 falha real. Ver JSDoc do método pra detalhes de
 * cada branch e do gate #4 no chamador (não notificar quando FALHOU).
 */
export type EmissaoGatewayResult =
  | { tipo: 'SEM_GATEWAY'; motivo: 'sem_cooperativa' | 'sem_config' | 'sem_forma_pagamento' }
  | {
      tipo: 'EMITIDO';
      gatewayId: string;
      linkPagamento: string | null;
      boletoUrl: string | null;
      pixQrCode: string | null;
      pixCopiaECola: string | null;
      linhaDigitavel: string | null;
    }
  | { tipo: 'FALHOU'; erro: string };

// Calcula valorDesconto e valorLiquido respeitando o modo de remuneração.
// Especificação `docs/especificacao-clube-cooper-token.md` seção 2:
//   CAMINHO DESCONTO  → cooperado paga reduzido (valBruto - valDesc), sem token
//   CAMINHO CLUBE     → cooperado paga cheio (valBruto), recebe tokens equivalentes
// valorDesconto sempre é registrado: em DESCONTO é o abatimento real,
// em CLUBE é a base pra emissão de tokens FATURA_CHEIA no darBaixa().
export function calcularValoresCobranca(
  valBruto: number,
  pctDesc: number,
  modoClube: boolean,
): { valorDesconto: number; valorLiquido: number } {
  const valDesc = Math.round(valBruto * (pctDesc / 100) * 100) / 100;
  const valLiq = modoClube
    ? valBruto
    : Math.round((valBruto - valDesc) * 100) / 100;
  return { valorDesconto: valDesc, valorLiquido: valLiq };
}

// Normaliza entrada de data:
// - "YYYY-MM-DD" (input HTML date)        → UTC midnight
// - "YYYY-MM-DDTHH:MM:SS..." (ISO completo) → new Date(...)
// - Date object                              → mantém
// Lança BadRequestException se inválido.
function normalizarData(valor: Date | string, campo: string): Date {
  if (valor instanceof Date) {
    if (Number.isNaN(valor.getTime())) {
      throw new BadRequestException(`${campo} inválida: Date instance inválido`);
    }
    return valor;
  }
  const str = String(valor);
  const isoNormalizado = str.length === 10 ? `${str}T00:00:00.000Z` : str;
  const d = new Date(isoNormalizado);
  if (Number.isNaN(d.getTime())) {
    throw new BadRequestException(`${campo} inválida: ${valor}`);
  }
  return d;
}

@Injectable()
export class CobrancasService {
  private readonly logger = new Logger(CobrancasService.name);

  constructor(
    private prisma: PrismaService,
    private eventEmitter: EventEmitter2,
    private gatewayPagamento: GatewayPagamentoService,
    private clubeVantagensService: ClubeVantagensService,
    private whatsappCicloVida: WhatsappCicloVidaService,
    private whatsappSender: WhatsappSenderService,
    private emailService: EmailService,
    private cooperTokenService: CooperTokenService,
    private tokenContabil: TokenContabilService,
    private calculoMultaJuros: CalculoMultaJurosService,
    // Sprint Onboarding Bloco 0 Fatia 0.4 — resolve adesão opt-in pra somar
    // mensalidade no valorLiquido. @Optional pra preservar compat com specs
    // existentes que instanciam o service em isolamento.
    @Optional() private cooperadoClubeService?: CooperadoClubeService,
    // CT.3 — hook contábil opcional (módulo registra; tests podem omitir)
    @Optional() private contabilidadeTributaria?: ContabilidadeTributariaService,
  ) {}

  @OnEvent('pagamento.confirmado')


  @AsPlatform()
  async handlePagamentoConfirmado(payload: {
    cobrancaId: string;
    dataPagamento: string;
    valorPago: number;
    metodoPagamento: string;
  }) {
    try {
      await this.darBaixa(payload.cobrancaId, payload.dataPagamento, payload.valorPago, payload.metodoPagamento);
    } catch (err) {
      this.logger.warn(`Falha ao dar baixa via evento pagamento.confirmado: ${err.message}`);
    }
  }

  async findAll(cooperativaId?: string, status?: string[]) {
    const where: any = {};
    if (cooperativaId) where.cooperativaId = cooperativaId;
    if (status?.length) where.status = { in: status };
    return this.prisma.cobranca.findMany({
      where,
      include: { contrato: { include: { cooperado: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, cooperativaId?: string) {
    const cobranca = await this.prisma.cobranca.findUnique({
      where: { id },
      include: { contrato: { include: { cooperado: true } } },
    });
    if (!cobranca) throw new NotFoundException(`Cobrança com id ${id} não encontrada`);
    if (cooperativaId && cobranca.cooperativaId !== cooperativaId) {
      throw new NotFoundException(`Cobrança com id ${id} não encontrada`);
    }
    return cobranca;
  }

  async findByContrato(contratoId: string, cooperativaId?: string) {
    // D-48-cobrancas IDOR fix: filtro tenant via contrato.
    return this.prisma.cobranca.findMany({
      where: {
        contratoId,
        ...(cooperativaId ? { contrato: { cooperativaId } } : {}),
      },
      orderBy: [{ anoReferencia: 'desc' }, { mesReferencia: 'desc' }],
    });
  }

  async create(data: {
    contratoId: string;
    mesReferencia: number;
    anoReferencia: number;
    valorBruto: number;
    percentualDesconto?: number;
    valorDesconto?: number;
    valorLiquido?: number;
    dataVencimento: Date | string;
    dataPagamento?: Date | string;
    /**
     * D-FISCAL-2.4.4a — Caso 1 custeio: id do ContratoConvenio (pagador=EMPRESA)
     * que originou esta cobrança consolidada. Quando presente, o `darBaixa`
     * roteia o lançamento contábil pro `criarLancamentoConvenioContrato`
     * (natureza do convênio — médico=AUXILIAR) em vez do hook CT.3 padrão
     * (que classificaria como PRÓPRIO). NÃO valida tenant aqui (já filtrado
     * upstream no convenios-custeio.service).
     */
    convenioContabilCobrancaId?: string;
  }, cooperativaId?: string) {
    // T6 Sprint 5: guard anti-duplicacao.
    // Mesma logica dos outros 2 gatilhos (pipeline individual + lote no
    // faturas.service.ts). Garante idempotencia: admin clica 2x sem medo.
    // A constraint unique no schema eh rede de seguranca — aqui lançamos
    // erro amigavel antes de chegar no Prisma.
    const jaExiste = await this.prisma.cobranca.findFirst({
      where: {
        contratoId: data.contratoId,
        mesReferencia: data.mesReferencia,
        anoReferencia: data.anoReferencia,
      },
      select: { id: true },
    });
    if (jaExiste) {
      throw new BadRequestException(
        `Ja existe cobranca para este contrato em ${String(data.mesReferencia).padStart(2, '0')}/${data.anoReferencia} (cobranca ${jaExiste.id}). Se precisa refazer, cancele a existente primeiro.`,
      );
    }

    // Buscar contrato para obter cooperativaId e dados do cooperado
    const contrato = await this.prisma.contrato.findUnique({
      where: { id: data.contratoId },
      include: { cooperado: true, plano: true },
    });

    // D-FISCAL-2.4.2 — GUARD #2: bloquear cobrança individual em cooperado
    // custeado por convênio (Caso 1: empresa paga total).
    if ((contrato as any)?.plano?.custeadoPorConvenio) {
      throw new BadRequestException(
        `Cooperado custeado por convênio — cobrança individual não permitida; ` +
        `a empresa paga a consolidada (plano "${contrato!.plano!.nome}", contrato ${contrato!.numero}).`,
      );
    }

    // Sprint MIGRAÇÃO M47 (21/06/2026) — GUARD MUST-FIX: bloquear cobrança
    // para cooperado em PENDENTE_MIGRACAO ou DESLIGADO. Risco de
    // double-charge durante transição (cooperado ainda recebe da
    // distribuidora/cooperativa concorrente E receberia cobrança SISGD ao
    // mesmo tempo). Status_PERMITIDOS_CREDITO no cooper-token já bloqueia,
    // mas billing é fluxo separado — guard aqui é defesa em camada.
    const statusBloqueadoBilling: string[] = ['PENDENTE_MIGRACAO', 'DESLIGADO'];
    if (contrato?.cooperado?.status && statusBloqueadoBilling.includes(contrato.cooperado.status)) {
      throw new BadRequestException(
        `Cobrança bloqueada — cooperado em status '${contrato.cooperado.status}'. ` +
        `Durante migração/desligamento o cooperado não entra em billing pra evitar double-charge. ` +
        `Conclua a migração (/cooperados/:id/migrar/concluir) antes de gerar cobranças.`,
      );
    }

    // Resolver cooperativaId: parâmetro > contrato
    const resolvedCoopId = cooperativaId || contrato?.cooperativaId || undefined;

    // Sprint 12 (2026-04-27): backend é fonte da verdade do desconto + modo CLUBE.
    // Cobrança herda Contrato.percentualDesconto. Se body enviar percentualDesconto,
    // vira override (?? cai pra body).
    // Se cooperado.modoRemuneracao === 'CLUBE', valorLiquido = valorBruto (paga cheio),
    // valorDesconto fica registrado como base pra emissão de tokens FATURA_CHEIA
    // no darBaixa() (ver docs/especificacao-clube-cooper-token.md seção 2 e 3.2).
    const modoClube = contrato?.cooperado?.modoRemuneracao === 'CLUBE';
    const pctDesc = data.percentualDesconto ?? Number(contrato?.percentualDesconto ?? 0);
    const valBruto = Number(data.valorBruto);
    const calc = calcularValoresCobranca(valBruto, pctDesc, modoClube);
    const valDesc = data.valorDesconto ?? calc.valorDesconto;
    const valLiq = data.valorLiquido ?? calc.valorLiquido;

    // Normalizar dataVencimento — frontend (input HTML date) envia "YYYY-MM-DD".
    // Prisma exige Date object ou ISO-8601 completo. Converter pra UTC midnight
    // pra evitar deslocamento de timezone.
    const dataVenc = normalizarData(data.dataVencimento, 'dataVencimento');
    const dataPag = data.dataPagamento != null
      ? normalizarData(data.dataPagamento, 'dataPagamento')
      : undefined;

    // Sprint Onboarding Bloco 0 Fatia 0.4 (06/06/2026) — componente CLUBE.
    // Quando cooperado tem adesão opt-in ativa (Cooperado.planoClubeId) e o
    // plano cobra (cobra=true + valorMensal>0), soma a mensalidade no
    // valorLiquido DEPOIS do desconto de energia.
    //
    // INVARIANTE crítica: valorLiquido = energia_liquida + mensalidade_clube.
    //   - Gateway/PIX/boleto cobra valorLiquido → clube TEM que estar dentro.
    //   - valorMensalidadeClube é CARVE-OUT discriminativo (UI mostra
    //     "Energia: R$ X − Clube: R$ Y = Total R$ Z").
    //   - Funcionário custeado por convênio: guard custeado-por-convênio
    //     (linhas 173-178 acima) JÁ BARRA cobrança individual. Defesa redundante:
    //     CooperadoClubeService.aderir() bloqueia setar planoClubeId em
    //     conveniado (Fatia 0.3). Aqui só somamos quando o helper resolve.
    let valorMensalidadeClube = 0;
    let planoClubeIdCobrado: string | null = null;
    if (this.cooperadoClubeService && contrato?.cooperadoId) {
      const cooperativaPraClube =
        resolvedCoopId || contrato.cooperativaId || undefined;
      if (cooperativaPraClube) {
        const snap = await this.cooperadoClubeService.resolverParaCobrancaIndividual(
          contrato.cooperadoId,
          cooperativaPraClube,
        );
        if (snap) {
          valorMensalidadeClube = Math.round(snap.valorMensal * 100) / 100;
          planoClubeIdCobrado = snap.planoClubeId;
        }
      }
    }
    const valLiqComClube =
      Math.round((valLiq + valorMensalidadeClube) * 100) / 100;

    // Refletir valores resolvidos em data pra o código posterior
    // (CooperToken, gateway, lançamento contábil) ler valLiquido/valDesc.
    data.percentualDesconto = pctDesc;
    data.valorDesconto = valDesc;
    data.valorLiquido = valLiqComClube;
    data.dataVencimento = dataVenc;
    if (dataPag) data.dataPagamento = dataPag;

    // Tarefa 4 correção #2 (22/07/2026) — MARCAR-ANTES-DE-TENTAR no caminho
    // regular, replicando padrão de convenios-custeio.service.ts:1005.
    // Se vai tentar emitir (resolvedCoopId + cooperado), a cobrança nasce
    // AGUARDANDO_EMISSAO — o método `emitirNoGatewaySeConfigurado` transiciona
    // pra EMITIDO/FALHOU/null (SEM_GATEWAY) depois. Se NÃO vai tentar emitir
    // (fatura manual sem tenant/cooperado), fica null desde o início.
    const vaiTentarEmitir = !!(resolvedCoopId && contrato?.cooperadoId);
    const cobranca = await this.prisma.cobranca.create({
      data: {
        ...data,
        percentualDesconto: pctDesc,
        valorDesconto: valDesc,
        valorLiquido: valLiqComClube,
        dataVencimento: dataVenc,
        ...(dataPag ? { dataPagamento: dataPag } : {}),
        ...(resolvedCoopId ? { cooperativaId: resolvedCoopId } : {}),
        ...(valorMensalidadeClube > 0 ? { valorMensalidadeClube } : {}),
        ...(planoClubeIdCobrado ? { planoClubeId: planoClubeIdCobrado } : {}),
        ...(vaiTentarEmitir ? { statusEmissao: 'AGUARDANDO_EMISSAO' as any } : {}),
      },
    });

    // ── CooperToken: desconto automático ou crédito FATURA_CHEIA_TOKEN ──
    const plano = contrato?.plano;
    if (
      plano?.cooperTokenAtivo === true &&
      contrato?.cooperadoId &&
      resolvedCoopId
    ) {
      try {
        const modoToken = (plano as any).modoToken ?? 'DESCONTO_DIRETO';

        if (modoToken === 'FATURA_CHEIA_TOKEN') {
          // Modo Fatura Cheia: NÃO aplica desconto, credita tokens equivalentes
          const valorToken = Number(plano.valorTokenReais ?? 0.45);
          const maxPerc = Number(plano.tokenDescontoMaxPerc ?? 30);
          const valorDescontoEmReais = Math.round(data.valorLiquido! * (maxPerc / 100) * 100) / 100;
          const valorDescontoEmTokens = Math.round((valorDescontoEmReais / valorToken) * 10000) / 10000;

          if (valorDescontoEmTokens > 0) {
            await this.cooperTokenService.creditar({
              cooperadoId: contrato.cooperadoId,
              cooperativaId: resolvedCoopId,
              tipo: CooperTokenTipo.FATURA_CHEIA,
              quantidade: valorDescontoEmTokens,
              valorEmissao: valorToken,
              referenciaId: cobranca.id,
              referenciaTabela: 'Cobranca',
            });
            this.logger.log(
              `CooperToken FATURA_CHEIA: ${valorDescontoEmTokens} tokens creditados ao cooperado ${contrato.cooperadoId} (cobrança ${cobranca.id})`,
            );
            // Sprint Faxina Contábil (22/06/2026) — fix P1 financeiro-token-reviewer:
            // a chamada direta a `lancarEmissaoFaturaCheia` DUPLICAVA o lançamento
            // (creditar() já emite EMITIDO → handleEmitido → lancarEmissaoFaturaCheia).
            // Passivo 2.3.01 inflado 2× a cada FATURA_CHEIA_TOKEN. Removido — o evento
            // pós-commit é canônico.
          }
        } else if (Number(plano.tokenDescontoMaxPerc ?? 0) > 0) {
          // Modo DESCONTO_DIRETO: desconto automático na fatura
          const desconto = await this.cooperTokenService.calcularDesconto({
            cooperadoId: contrato.cooperadoId,
            valorCobranca: data.valorLiquido!,
            plano,
          });

          if (desconto.tokensNecessarios > 0) {
            await this.cooperTokenService.debitar({
              cooperadoId: contrato.cooperadoId,
              cooperativaId: resolvedCoopId,
              quantidade: desconto.tokensNecessarios,
              tipo: CooperTokenTipo.DESCONTO_FATURA,
              referenciaId: cobranca.id,
              // Corretiva CooperToken 2026-07-20 — participa do unique parcial
              // cooper_token_ledger_ref_origem_uniq (Cobranca+cobrancaId+DEBITO).
              // Sem isso, retry desta geração criaria débito duplicado.
              referenciaTabela: 'Cobranca',
              descricao: 'Desconto automático na fatura via CooperToken',
            });

            const novoValorLiquido = Math.round((data.valorLiquido! - desconto.descontoReais) * 100) / 100;

            await this.prisma.cobranca.update({
              where: { id: cobranca.id },
              data: {
                tokenDescontoQt: desconto.tokensNecessarios,
                tokenDescontoReais: desconto.descontoReais,
                ledgerDebitoId: cobranca.id,
                valorLiquido: novoValorLiquido,
              },
            });

            // Atualizar valorLiquido no objeto para uso nas notificações abaixo
            (data as any).valorLiquido = novoValorLiquido;

            this.logger.log(
              `CooperToken DESCONTO: ${desconto.tokensNecessarios} tokens debitados, R$ ${desconto.descontoReais} de desconto na cobrança ${cobranca.id}`,
            );
          }
        }
      } catch (err) {
        this.logger.warn(
          `Falha ao processar CooperToken na cobrança ${cobranca.id}: ${(err as Error).message}`,
        );
      }
    }

    // Emitir automaticamente no gateway de pagamento se configurado.
    // Tarefa 4 correção #1 (22/07/2026) — método retorna EmissaoGatewayResult
    // (SEM_GATEWAY | EMITIDO | FALHOU) e nunca lança; try/catch anterior era
    // código morto. Resultado gate as notificações abaixo (correção #4).
    let emissaoResult: EmissaoGatewayResult = { tipo: 'SEM_GATEWAY', motivo: 'sem_cooperativa' };
    if (resolvedCoopId && contrato?.cooperadoId) {
      emissaoResult = await this.emitirNoGatewaySeConfigurado(
        cobranca.id,
        resolvedCoopId,
        contrato.cooperadoId,
        {
          valor: data.valorLiquido!,
          vencimento: data.dataVencimento,
          descricao: `Cobrança ${data.mesReferencia}/${data.anoReferencia}`,
        },
      );
    }

    // Tarefa 4 correção #4 (22/07/2026) — GATE de notificação: só notifica
    // cooperado se a emissão NÃO falhou. SEM_GATEWAY continua notificando
    // (os 307 faturados manualmente NÃO podem parar de receber aviso).
    // EMITIDO também notifica. FALHOU bloqueia — cobrança sem instrumento
    // de pagamento fica pra retry do cron (correções #2 + #3).
    const podeNotificarCooperado = emissaoResult.tipo !== 'FALHOU';

    // Notificar cooperado via WhatsApp sobre nova cobrança (aviso de vencimento)
    if (podeNotificarCooperado && contrato?.cooperado?.telefone) {
      try {
        const mesRef = `${String(data.mesReferencia).padStart(2, '0')}/${data.anoReferencia}`;
        const vencimento = data.dataVencimento.toLocaleDateString('pt-BR');
        this.whatsappCicloVida.notificarCobrancaGerada(
          { ...contrato.cooperado, cooperativaId: resolvedCoopId ?? contrato.cooperado.cooperativaId },
          mesRef,
          Number(data.valorLiquido!),
          vencimento,
        ).catch(() => {});
      } catch (err) {
        this.logger.warn(`Falha ao notificar cobrança gerada via WhatsApp: ${(err as Error).message}`);
      }
    }

    // Sprint 8B: enviar email de fatura ao cooperado.
    // Tarefa 4 correção #4 (22/07/2026) — mesmo gate do WhatsApp acima.
    if (podeNotificarCooperado && contrato?.cooperado?.email) {
      try {
        // Buscar dados do gateway pra incluir PIX/boleto no email
        const gwData = await this.prisma.cobrancaGateway.findFirst({
          where: { cobrancaId: cobranca.id },
          orderBy: { createdAt: 'desc' },
        });
        const asaasData = await this.prisma.asaasCobranca.findFirst({
          where: { cobrancaId: cobranca.id },
          orderBy: { createdAt: 'desc' },
        });

        await this.emailService.enviarFatura(
          contrato.cooperado,
          cobranca,
          {
            pixCopiaECola: gwData?.pixCopiaECola || asaasData?.pixCopiaECola || null,
            boletoUrl: gwData?.boletoUrl || asaasData?.boletoUrl || null,
            linhaDigitavel: gwData?.linhaDigitavel || (asaasData as any)?.linhaDigitavel || null,
          },
        );
      } catch (err) {
        this.logger.warn(`Falha ao enviar email de fatura: ${(err as Error).message}`);
      }
    }

    // Criar LancamentoCaixa PREVISTO (Contas a Receber)
    try {
      const nomeCooperado = contrato?.cooperado?.nomeCompleto || 'Cooperado';
      const mesRef = `${String(data.mesReferencia).padStart(2, '0')}/${data.anoReferencia}`;
      const competencia = `${data.anoReferencia}-${String(data.mesReferencia).padStart(2, '0')}`;

      const planoContas = await this.prisma.planoContas.findFirst({
        where: { codigo: '1.1.01' },
      });

      await this.prisma.lancamentoCaixa.create({
        data: {
          tipo: 'RECEITA',
          descricao: `Mensalidade - ${nomeCooperado} - ${mesRef}`,
          valor: data.valorLiquido!,
          competencia,
          dataVencimento: data.dataVencimento,
          status: 'PREVISTO',
          cooperativaId: resolvedCoopId || undefined,
          cooperadoId: contrato?.cooperadoId || undefined,
          planoContasId: planoContas?.id || undefined,
          observacoes: `Ref. cobrança ${cobranca.id}`,
        },
      });
    } catch (err) {
      this.logger.warn(`Falha ao criar LancamentoCaixa PREVISTO: ${(err as Error).message}`);
    }

    return cobranca;
  }

  async update(
    id: string,
    data: Partial<{
      mesReferencia: number;
      anoReferencia: number;
      valorBruto: number;
      percentualDesconto: number;
      valorDesconto: number;
      valorLiquido: number;
      status: 'A_VENCER' | 'PAGO' | 'VENCIDO' | 'CANCELADO';
      dataVencimento: Date | string;
      dataPagamento: Date | string;
    }>,
    cooperativaId?: string,
  ) {
    // D-52 fix: normalizar datas vindas como string ISO curto (YYYY-MM-DD).
    if (data.dataPagamento && typeof data.dataPagamento === 'string') {
      data.dataPagamento = normalizarData(data.dataPagamento, 'dataPagamento');
    }
    if (data.dataVencimento && typeof data.dataVencimento === 'string') {
      data.dataVencimento = normalizarData(data.dataVencimento, 'dataVencimento');
    }
    // D-48-cobrancas IDOR fix: validar tenant antes do update.
    if (cooperativaId) {
      const cob = await this.prisma.cobranca.findFirst({
        where: { id, cooperativaId },
        select: { id: true },
      });
      if (!cob) throw new NotFoundException(`Cobrança com id ${id} não encontrada`);
    }
    // D-55 fix: retornar com mesmo include do findOne.
    return this.prisma.cobranca.update({
      where: { id },
      data: data as any,
      include: { contrato: { include: { cooperado: true } } },
    });
  }

  /**
   * Corretiva Asaas Webhook 2026-07-20 (sessão dedicada) — variante TX-AWARE
   * do `darBaixa` pra `processarWebhook` do Asaas invocar dentro da sua própria
   * `$transaction` (que também insere o WebhookEvent como fonte única de
   * idempotência).
   *
   * Diferenças vs `darBaixa` público:
   *  - Recebe `tx: Prisma.TransactionClient` — zero `$transaction` aninhada.
   *  - Executa APENAS efeitos ESSENCIAIS (atômicos com WebhookEvent):
   *      1. Cobranca.updateMany PAGO (CAS anti-race preservado)
   *      2. LancamentoCaixa PREVISTO→REALIZADO
   *      3. Tokens CLUBE via `creditarTx` (se modoRemuneracao=='CLUBE' e
   *         valorDesconto > 0)
   *  - NÃO executa best-effort: notificações WA/Email, evento cobranca.primeira.paga
   *    (MLM cascade), hook CT.3 (contabilidade tributária), métricas Clube de
   *    Vantagens. Esses o caller (webhook) deve chamar SEPARADAMENTE pós-commit.
   *  - Throw se qualquer essencial falhar → caller faz rollback → Asaas re-tenta.
   *
   * Guard de duplicidade: se cobrança já está PAGO/CANCELADO, `updateMany` retorna
   * count=0 e este método throw. Combinado com a idempotência do WebhookEvent
   * (P2002 na 2ª entrega), evita duplo pagamento.
   */
  async darBaixaTx(
    tx: Prisma.TransactionClient,
    params: {
      cobrancaId: string;
      dataPagamento: Date;
      valorPago: number;
      metodoPagamento?: string;
    },
  ) {
    const { cobrancaId, dataPagamento: dtPagamento, valorPago, metodoPagamento } = params;

    const cobranca = await tx.cobranca.findFirst({
      where: { id: cobrancaId },
      include: { contrato: { include: { cooperado: true } } },
    });
    if (!cobranca) {
      throw new NotFoundException(`darBaixaTx: cobrança ${cobrancaId} não encontrada`);
    }

    // 1) UPDATE PAGO com CAS — se já foi PAGO/CANCELADO, count=0 → throw
    //    (defesa em profundidade DEPOIS da idempotência do WebhookEvent).
    // Corretiva Asaas Webhook 2026-07-20 (A1 P1 revisor) — `valorPago`
    // vem de `payment.value` do JSON externo do Asaas (tipo `any`).
    // Math.round pra evitar centavos de drift de float propagando
    // pra Cobranca.valorPago e LancamentoCaixa.valor.
    const valorFinal = Math.round((valorPago ?? Number(cobranca.valorLiquido)) * 100) / 100;
    const updated = await tx.cobranca.updateMany({
      where: { id: cobrancaId, status: { notIn: ['PAGO', 'CANCELADO'] } },
      data: {
        status: 'PAGO',
        dataPagamento: dtPagamento,
        valorPago: valorFinal,
      },
    });
    if (updated.count === 0) {
      throw new BadRequestException(
        `darBaixaTx: cobrança ${cobrancaId} já PAGA/CANCELADA (processamento concorrente ou re-entrega)`,
      );
    }

    // 2) LancamentoCaixa PREVISTO→REALIZADO. Diferente do darBaixa público
    //    (que engolia erro com try/warn), aqui deixa propagar — se lançamento
    //    falha, a tx rollback e Asaas re-tenta.
    const nomeCooperado = cobranca.contrato?.cooperado?.nomeCompleto || 'Cooperado';
    const mesRef = `${String(cobranca.mesReferencia).padStart(2, '0')}/${cobranca.anoReferencia}`;
    const competencia = `${cobranca.anoReferencia}-${String(cobranca.mesReferencia).padStart(2, '0')}`;

    const lancamentoExistente = await tx.lancamentoCaixa.findFirst({
      where: {
        observacoes: { contains: `Ref. cobrança ${cobranca.id}` },
        status: 'PREVISTO',
      },
    });
    if (lancamentoExistente) {
      await tx.lancamentoCaixa.update({
        where: { id: lancamentoExistente.id },
        data: {
          status: 'REALIZADO',
          valor: valorFinal,
          dataPagamento: dtPagamento,
          descricao: `Recebimento mensalidade - ${nomeCooperado} - ${mesRef}`,
          observacoes: `Ref. cobrança ${cobranca.id}${metodoPagamento ? ` | Método: ${metodoPagamento}` : ''}`,
        },
      });
    } else {
      await tx.lancamentoCaixa.create({
        data: {
          tipo: 'RECEITA',
          descricao: `Recebimento mensalidade - ${nomeCooperado} - ${mesRef}`,
          valor: valorFinal,
          competencia,
          dataPagamento: dtPagamento,
          status: 'REALIZADO',
          cooperativaId: cobranca.cooperativaId || cobranca.contrato?.cooperativaId || undefined,
          cooperadoId: cobranca.contrato?.cooperadoId || undefined,
          observacoes: `Ref. cobrança ${cobranca.id}${metodoPagamento ? ` | Método: ${metodoPagamento}` : ''}`,
        },
      });
    }

    // 3) Tokens CLUBE (FATURA_CHEIA) — só se cooperado escolheu modo CLUBE
    //    e a cobrança tem valorDesconto (o "abre mão" que vira token).
    //    Usa creditarTx pra ficar dentro da mesma tx. Fast-path idempotente
    //    do creditarTx via referenciaTabela='Cobranca' + unique parcial já
    //    protege contra double-emit.
    const cooperadoId = cobranca.contrato?.cooperadoId;
    if (cooperadoId) {
      const cooperadoClube = await tx.cooperado.findUnique({
        where: { id: cooperadoId },
        select: { modoRemuneracao: true, cooperativaId: true },
      });
      if (cooperadoClube?.modoRemuneracao === 'CLUBE' && cooperadoClube.cooperativaId) {
        // Corretiva Asaas Webhook 2026-07-20 (A2 P2 revisor) — arredondar
        // pra 4 casas antes de creditar (Decimal→Number pode dar drift float).
        const descontoNaoAplicado =
          Math.round(Number(cobranca.valorDesconto ?? 0) * 10000) / 10000;
        if (descontoNaoAplicado > 0) {
          await this.cooperTokenService.creditarTx(tx, {
            cooperadoId,
            cooperativaId: cooperadoClube.cooperativaId,
            tipo: 'FATURA_CHEIA' as any,
            quantidade: descontoNaoAplicado,
            referenciaId: cobranca.id,
            referenciaTabela: 'Cobranca',
          });
          this.logger.log(
            `darBaixaTx: tokens CLUBE emitidos — ${descontoNaoAplicado} pra cooperado ${cooperadoId} (cobrança ${cobranca.id})`,
          );
        }
      }
    }

    this.logger.log(`darBaixaTx: cobrança ${cobrancaId} PAGA — R$ ${valorFinal}`);
    return { cobrancaId, valorFinal, cooperadoId };
  }

  /**
   * Corretiva Asaas Webhook 2026-07-20 — chamado pelo webhook DEPOIS
   * do commit do WebhookEvent + darBaixaTx (essenciais atômicos). Executa
   * SÓ efeitos BEST-EFFORT (não reverte pagamento se falhar):
   *   - Hook contábil CT.3 (fiscal, idempotente downstream via unique)
   *   - Notificações WA/Email pro cooperado
   *   - Evento `cobranca.primeira.paga` (MLM cascade — listener idempotente)
   *   - Métricas Clube de Vantagens + notificações a indicadores
   *
   * NÃO reproduz: tokens CLUBE (já rodou no `darBaixaTx` como essencial).
   *
   * Cada bloco tem try/catch próprio — falha isolada não cascateia.
   * Se algum best-effort falhar aqui, o pagamento continua confirmado
   * (Asaas NÃO re-tenta — a idempotência do WebhookEvent já marcou).
   */
  async executarPosBaixaBestEffort(cobrancaId: string, valorFinal: number, dtPagamento: Date) {
    const cobranca = await this.prisma.cobranca.findFirst({
      where: { id: cobrancaId },
      include: { contrato: { include: { cooperado: true } } },
    });
    if (!cobranca) {
      this.logger.warn(`executarPosBaixaBestEffort: cobrança ${cobrancaId} não encontrada — skip`);
      return;
    }

    // Hook contábil CT.3 (idempotente downstream via @@unique).
    if (this.contabilidadeTributaria) {
      const coopIdHook = cobranca.cooperativaId || cobranca.contrato?.cooperativaId;
      const tipoCoopHook = cobranca.contrato?.cooperado?.tipoCooperado ?? null;
      const convenioContabilId = (cobranca as any).convenioContabilCobrancaId as string | null;
      const valorClube = Number((cobranca as any).valorMensalidadeClube ?? 0);
      const valorEnergiaFiscal = Math.round((valorFinal - valorClube) * 100) / 100;
      if (coopIdHook) {
        const mesRefHook = `${cobranca.anoReferencia}-${String(cobranca.mesReferencia).padStart(2, '0')}`;
        if (convenioContabilId) {
          this.contabilidadeTributaria
            .criarLancamentoConvenioContrato({
              contratoConvenioId: convenioContabilId,
              valor: valorEnergiaFiscal,
              dataMovimento: dtPagamento,
              competencia: mesRefHook,
              descricao: `[CT] Consolidada custeio paga — cobrança ${cobranca.id}`,
              cooperativaId: coopIdHook,
            })
            .catch((err) =>
              this.logger.error(
                `[CT.3 webhook] convênio ${cobranca.id} lançamento falhou: ${err.message}`,
              ),
            );
        } else {
          this.contabilidadeTributaria
            .criarLancamentoAutomatico({
              cooperativaId: coopIdHook,
              origemTipo: 'COBRANCA',
              origemId: cobranca.id,
              fonte: { tipo: 'COBRANCA', cooperadoTipoCooperado: tipoCoopHook },
              tipo: 'RECEITA',
              descricao: `[CT] Cobrança paga — ${cobranca.id.slice(0, 8)}`,
              valor: valorEnergiaFiscal,
              competencia: mesRefHook,
              dataPagamento: dtPagamento,
              cooperadoId: cobranca.contrato?.cooperadoId ?? null,
            })
            .catch((err) =>
              this.logger.error(
                `[CT.3 webhook] cobrança ${cobranca.id} classificação falhou: ${err.message}`,
              ),
            );
        }
      }
    }

    // Notificações WA/Email pro cooperado.
    try {
      const cooperado = cobranca.contrato?.cooperado;
      if (cooperado) {
        const mesRef = `${String(cobranca.mesReferencia).padStart(2, '0')}/${cobranca.anoReferencia}`;
        this.whatsappCicloVida.notificarPagamentoConfirmado(cooperado, valorFinal, mesRef).catch(() => {});
        this.emailService.enviarConfirmacaoPagamento(cooperado, cobranca).catch(() => {});
      }
    } catch (err) {
      this.logger.warn(`[webhook posBaixa] notificar falhou: ${err.message}`);
    }

    // Evento cobranca.primeira.paga (MLM cascade — listener idempotente).
    try {
      const cooperadoId = cobranca.contrato?.cooperadoId;
      if (cooperadoId) {
        const totalPagas = await this.prisma.cobranca.count({
          where: { contrato: { cooperadoId }, status: 'PAGO' },
        });
        if (totalPagas === 1) {
          this.eventEmitter.emit('cobranca.primeira.paga', {
            cooperadoId,
            cobrancaId,
            valorFatura: valorFinal,
          });
        }
      }
    } catch (err) {
      this.logger.warn(`[webhook posBaixa] evento primeira.paga falhou: ${err.message}`);
    }

    // Métricas Clube de Vantagens + notificações a indicadores.
    try {
      const cooperadoId = cobranca.contrato?.cooperadoId;
      if (cooperadoId) {
        const indicacoes = await this.prisma.indicacao.findMany({
          where: { cooperadoIndicadoId: cooperadoId, status: 'PRIMEIRA_FATURA_PAGA' },
          select: { cooperadoIndicadorId: true },
        });
        const indicadorIds = indicacoes.map((i) => i.cooperadoIndicadorId);
        const indicadores = indicadorIds.length > 0
          ? await this.prisma.cooperado.findMany({
              where: { id: { in: indicadorIds } },
              select: { id: true, telefone: true, nomeCompleto: true, cooperativaId: true },
            })
          : [];
        const indicadorMap = new Map(indicadores.map((i) => [i.id, i]));
        const kwhEntregue = cobranca.kwhEntregue ?? 0;
        const nomeIndicado = cobranca.contrato?.cooperado?.nomeCompleto ?? 'Indicado';
        for (const ind of indicacoes) {
          const resultado = await this.clubeVantagensService.atualizarMetricas(
            ind.cooperadoIndicadorId,
            kwhEntregue,
            valorFinal,
          );
          const indicador = indicadorMap.get(ind.cooperadoIndicadorId);
          if (indicador) {
            this.whatsappCicloVida
              .notificarIndicadoPagou(indicador, nomeIndicado, `R$ ${valorFinal.toFixed(2)}`)
              .catch(() => {});
            if (resultado?.promovido && resultado.nivelAnterior && resultado.nivelNovo) {
              const progressao = await this.prisma.progressaoClube.findUnique({
                where: { cooperadoId: ind.cooperadoIndicadorId },
              });
              this.whatsappCicloVida
                .notificarNivelPromovido(
                  indicador,
                  resultado.nivelAnterior,
                  resultado.nivelNovo,
                  progressao?.beneficioPercentualAtual ?? 0,
                )
                .catch(() => {});
            }
          }
        }
      }
    } catch (err) {
      this.logger.warn(`[webhook posBaixa] métricas Clube falhou: ${err.message}`);
    }
  }

  async darBaixa(id: string, dataPagamento: string, valorPago: number, metodoPagamento?: string, cooperativaId?: string) {
    // D-48-cobrancas IDOR fix: findFirst com filtro tenant.
    const cobranca = await this.prisma.cobranca.findFirst({
      where: { id, ...(cooperativaId ? { cooperativaId } : {}) },
      include: { contrato: { include: { cooperado: true } } },
    });
    if (!cobranca) throw new NotFoundException(`Cobrança com id ${id} não encontrada`);
    if (cobranca.status === 'PAGO') {
      throw new BadRequestException('Esta cobrança já foi paga');
    }
    if (cobranca.status === 'CANCELADO') {
      throw new BadRequestException('Não é possível dar baixa em cobrança cancelada');
    }

    const dtPagamento = new Date(dataPagamento);

    // Recalcular multa/juros em tempo real se cobrança vencida (VENCIDO ou PENDENTE com dataVencimento < hoje)
    const vencida = cobranca.status === 'VENCIDO' ||
      (cobranca.status === 'PENDENTE' && new Date(cobranca.dataVencimento) < dtPagamento);
    if (vencida && !Number(cobranca.valorMulta)) {
      const coopId = cobranca.cooperativaId || cobranca.contrato?.cooperativaId;
      if (coopId) {
        const calculo = await this.calculoMultaJuros.calcular(
          Number(cobranca.valorLiquido),
          cobranca.dataVencimento,
          coopId,
        );

        if (calculo.diasEfetivos > 0) {
          await this.prisma.cobranca.update({
            where: { id },
            data: {
              valorMulta: calculo.multa,
              valorJuros: calculo.juros,
              valorAtualizado: calculo.valorAtualizado,
            },
          });

          (cobranca as any).valorAtualizado = calculo.valorAtualizado;
          (cobranca as any).valorMulta = calculo.multa;
          (cobranca as any).valorJuros = calculo.juros;
        }
      }
    }

    const valorFinal = valorPago ?? Number((cobranca as any).valorAtualizado ?? cobranca.valorLiquido);

    const updated = await this.prisma.cobranca.updateMany({
      where: { id, status: { notIn: ['PAGO', 'CANCELADO'] } },
      data: {
        status: 'PAGO',
        dataPagamento: dtPagamento,
        valorPago: valorFinal,
      },
    });
    if (updated.count === 0) {
      throw new BadRequestException('Cobrança já foi paga ou cancelada (processamento concorrente)');
    }
    const cobrancaAtualizada = (await this.prisma.cobranca.findUnique({ where: { id } }))!;

    // Atualizar LancamentoCaixa PREVISTO → REALIZADO (Contas a Receber)
    try {
      const nomeCooperado = cobranca.contrato?.cooperado?.nomeCompleto || 'Cooperado';
      const mesRef = `${String(cobranca.mesReferencia).padStart(2, '0')}/${cobranca.anoReferencia}`;
      const competencia = `${cobranca.anoReferencia}-${String(cobranca.mesReferencia).padStart(2, '0')}`;

      const lancamentoExistente = await this.prisma.lancamentoCaixa.findFirst({
        where: {
          observacoes: { contains: `Ref. cobrança ${cobranca.id}` },
          status: 'PREVISTO',
        },
      });

      if (lancamentoExistente) {
        await this.prisma.lancamentoCaixa.update({
          where: { id: lancamentoExistente.id },
          data: {
            status: 'REALIZADO',
            valor: valorFinal,
            dataPagamento: dtPagamento,
            descricao: `Recebimento mensalidade - ${nomeCooperado} - ${mesRef}`,
            observacoes: `Ref. cobrança ${cobranca.id}${metodoPagamento ? ` | Método: ${metodoPagamento}` : ''}`,
          },
        });
      } else {
        await this.prisma.lancamentoCaixa.create({
          data: {
            tipo: 'RECEITA',
            descricao: `Recebimento mensalidade - ${nomeCooperado} - ${mesRef}`,
            valor: valorFinal,
            competencia,
            dataPagamento: dtPagamento,
            status: 'REALIZADO',
            cooperativaId: cobranca.cooperativaId || cobranca.contrato?.cooperativaId || undefined,
            cooperadoId: cobranca.contrato?.cooperadoId || undefined,
            observacoes: `Ref. cobrança ${cobranca.id}${metodoPagamento ? ` | Método: ${metodoPagamento}` : ''}`,
          },
        });
      }
      this.logger.log(
        `LancamentoCaixa REALIZADO: R$ ${valorFinal} — cobrança ${cobranca.id} — ` +
          `${nomeCooperado} (${mesRef})`,
      );
    } catch (err) {
      this.logger.warn(`Falha ao atualizar LancamentoCaixa na baixa: ${err.message}`);
    }

    // CT.3 — Hook contábil classificado (fire-and-forget, NUNCA reverte pagamento).
    // Idempotente via @@unique([origemTipo, origemId]). cooperativaId da fonte.
    //
    // D-FISCAL-2.4.4c — ROTEAMENTO da consolidada custeio (Caso 1 — empresa
    // paga total). Quando cobranca.convenioContabilCobrancaId != null (cobrança
    // gerada por ConveniosCusteioService 2.4.4a), o lançamento fiscal usa a
    // naturezaAtoCooperativo DO CONVÊNIO (médico = AUXILIAR configurável)
    // via criarLancamentoConvenioContrato (2.2) — não o default
    // criarLancamentoAutomatico(COBRANCA→PRÓPRIO da factory cooperativo.regime).
    // SUBSTITUI (não complementa) — senão geraria 2 lançamentos fiscais
    // pra mesma cobrança paga.
    //
    // Bloco OPERACIONAL (LancamentoCaixa caixa puro acima) permanece
    // intocado — esse é sobre fluxo de caixa, não classificação fiscal.
    if (this.contabilidadeTributaria) {
      const coopIdHook = cobranca.cooperativaId || cobranca.contrato?.cooperativaId;
      const tipoCoopHook = cobranca.contrato?.cooperado?.tipoCooperado ?? null;
      const convenioContabilId = (cobranca as any).convenioContabilCobrancaId as string | null;
      // Sprint Onboarding Bloco 0 Fatia 0.4 (06/06/2026) — não inflar energia.
      // valorFinal inclui a mensalidade do clube (carve-out semântico). O
      // lançamento de natureza ENERGIA_SCEE deve usar APENAS a parte de
      // energia — senão o clube vira receita SCEE (natureza fiscal errada).
      // 2º lançamento de natureza "taxa de clube" fica adiado pra Sprint
      // Contabilidade (D-novo-CLUBE-LANCAMENTO-FISCAL P3).
      const valorClube = Number((cobranca as any).valorMensalidadeClube ?? 0);
      const valorEnergiaFiscal = Math.round((valorFinal - valorClube) * 100) / 100;
      if (coopIdHook) {
        const mesRefHook = `${cobranca.anoReferencia}-${String(cobranca.mesReferencia).padStart(2, '0')}`;
        if (convenioContabilId) {
          // CONSOLIDADA — usa natureza do convênio (AUXILIAR/PRÓPRIO/etc)
          this.contabilidadeTributaria
            .criarLancamentoConvenioContrato({
              contratoConvenioId: convenioContabilId,
              valor: valorEnergiaFiscal,
              dataMovimento: dtPagamento,
              competencia: mesRefHook, // CT.9.1: competência LOCAL via string
              descricao: `[CT] Consolidada custeio paga — cobrança ${cobranca.id}`,
              cooperativaId: coopIdHook,
            })
            .catch((err) =>
              this.logger.error(
                `[D-FISCAL-2.4.4c hook] cobrança consolidada ${cobranca.id} ` +
                  `lançamento de convênio falhou: ${err.message}`,
              ),
            );
        } else {
          // COBRANÇA NORMAL — caminho CT.3 original (factory classifica PRÓPRIO)
          this.contabilidadeTributaria
            .criarLancamentoAutomatico({
              cooperativaId: coopIdHook,
              origemTipo: 'COBRANCA',
              origemId: cobranca.id,
              fonte: { tipo: 'COBRANCA', cooperadoTipoCooperado: tipoCoopHook },
              tipo: 'RECEITA',
              descricao: `[CT] Cobrança paga — ${cobranca.id.slice(0, 8)}`,
              valor: valorEnergiaFiscal,
              competencia: mesRefHook,
              dataPagamento: dtPagamento,
              cooperadoId: cobranca.contrato?.cooperadoId ?? null,
            })
            .catch((err) =>
              this.logger.error(
                `[CT.3 hook] cobranca ${cobranca.id} classificação falhou: ${err.message}`,
              ),
            );
        }
      }
    }

    // Notificar pagamento confirmado via WhatsApp e E-mail
    try {
      const cooperado = cobranca.contrato?.cooperado;
      if (cooperado) {
        const mesRef = `${String(cobranca.mesReferencia).padStart(2, '0')}/${cobranca.anoReferencia}`;
        this.whatsappCicloVida.notificarPagamentoConfirmado(cooperado, valorFinal, mesRef).catch(() => {});
        this.emailService.enviarConfirmacaoPagamento(cooperado, cobrancaAtualizada).catch(() => {});
      }
    } catch (err) {
      this.logger.warn(`Falha ao notificar pagamento via WhatsApp/E-mail: ${err.message}`);
    }

    // Verificar se é a primeira fatura paga do cooperado e emitir evento para cascade MLM
    // Evento emitido APÓS confirmação de que a baixa foi persistida (idempotente via count check)
    try {
      const cooperadoId = cobranca.contrato?.cooperadoId;
      if (cooperadoId) {
        // Confirmar que o status PAGO foi realmente persistido antes de emitir evento
        const cobrancaConfirmada = await this.prisma.cobranca.findUnique({
          where: { id },
          select: { status: true },
        });
        if (cobrancaConfirmada?.status === 'PAGO') {
          const totalPagas = await this.prisma.cobranca.count({
            where: { contrato: { cooperadoId }, status: 'PAGO' },
          });
          if (totalPagas === 1) {
            this.eventEmitter.emit('cobranca.primeira.paga', {
              cooperadoId,
              cobrancaId: id,
              valorFatura: valorFinal,
            });
          }
        }
      }
    } catch (err) {
      this.logger.warn(`Falha ao processar primeira fatura paga: ${err.message}`);
    }

    // Sprint 8B: emitir tokens pra cooperado no Caminho CLUBE
    try {
      const cooperadoId = cobranca.contrato?.cooperadoId;
      if (cooperadoId) {
        const cooperadoClube = await this.prisma.cooperado.findUnique({
          where: { id: cooperadoId },
          select: { modoRemuneracao: true, cooperativaId: true },
        });
        if (cooperadoClube?.modoRemuneracao === 'CLUBE' && cooperadoClube.cooperativaId) {
          const descontoNaoAplicado = Number(cobranca.valorDesconto ?? 0);
          if (descontoNaoAplicado > 0) {
            // Tokens = valor do desconto que o cooperado abriu mão
            await this.cooperTokenService.creditar({
              cooperadoId,
              cooperativaId: cooperadoClube.cooperativaId,
              tipo: 'FATURA_CHEIA' as any,
              quantidade: descontoNaoAplicado,
              referenciaId: cobranca.id,
              referenciaTabela: 'Cobranca',
            });
            this.logger.log(
              `Tokens CLUBE emitidos: ${descontoNaoAplicado} pra cooperado ${cooperadoId} (cobrança ${cobranca.id})`,
            );
          }
        }
      }
    } catch (err) {
      this.logger.warn(`Falha ao emitir tokens CLUBE: ${(err as Error).message}`);
    }

    // Clube de Vantagens: atualizar métricas dos indicadores
    try {
      const cooperadoId = cobranca.contrato?.cooperadoId;
      if (cooperadoId) {
        const indicacoes = await this.prisma.indicacao.findMany({
          where: { cooperadoIndicadoId: cooperadoId, status: 'PRIMEIRA_FATURA_PAGA' },
          select: { cooperadoIndicadorId: true },
        });

        // Buscar dados dos indicadores para notificação
        const indicadorIds = indicacoes.map(i => i.cooperadoIndicadorId);
        const indicadores = indicadorIds.length > 0
          ? await this.prisma.cooperado.findMany({
              where: { id: { in: indicadorIds } },
              select: { id: true, telefone: true, nomeCompleto: true, cooperativaId: true },
            })
          : [];
        const indicadorMap = new Map(indicadores.map(i => [i.id, i]));

        const kwhEntregue = cobranca.kwhEntregue ?? 0;
        const nomeIndicado = cobranca.contrato?.cooperado?.nomeCompleto ?? 'Indicado';

        for (const ind of indicacoes) {
          const resultado = await this.clubeVantagensService.atualizarMetricas(
            ind.cooperadoIndicadorId,
            kwhEntregue,
            valorFinal,
          );

          // Notificar indicador que indicado pagou
          const indicador = indicadorMap.get(ind.cooperadoIndicadorId);
          if (indicador) {
            this.whatsappCicloVida.notificarIndicadoPagou(
              indicador,
              nomeIndicado,
              `R$ ${valorFinal.toFixed(2)}`,
            ).catch(() => {});

            // Se houve promoção de nível, notificar
            if (resultado?.promovido && resultado.nivelAnterior && resultado.nivelNovo) {
              const progressao = await this.prisma.progressaoClube.findUnique({
                where: { cooperadoId: ind.cooperadoIndicadorId },
              });
              this.whatsappCicloVida.notificarNivelPromovido(
                indicador,
                resultado.nivelAnterior,
                resultado.nivelNovo,
                progressao?.beneficioPercentualAtual ?? 0,
              ).catch(() => {});
            }
          }
        }
      }
    } catch (err) {
      this.logger.warn(`Falha ao atualizar Clube de Vantagens na baixa: ${err.message}`);
    }

    return cobrancaAtualizada;
  }

  async cancelar(id: string, motivo: string, cooperativaId?: string) {
    // D-48-cobrancas IDOR fix: findFirst com filtro tenant.
    const cobranca = await this.prisma.cobranca.findFirst({
      where: { id, ...(cooperativaId ? { cooperativaId } : {}) },
    });
    if (!cobranca) throw new NotFoundException(`Cobrança com id ${id} não encontrada`);
    if (cobranca.status === 'CANCELADO') {
      throw new BadRequestException('Esta cobrança já está cancelada');
    }
    if (cobranca.status === 'PAGO') {
      throw new BadRequestException('Não é possível cancelar cobrança já paga');
    }
    const updatedCancel = await this.prisma.cobranca.updateMany({
      where: { id, status: { notIn: ['PAGO', 'CANCELADO'] } },
      data: {
        status: 'CANCELADO',
        motivoCancelamento: motivo,
      },
    });
    if (updatedCancel.count === 0) {
      throw new BadRequestException('Cobrança já foi paga ou cancelada (processamento concorrente)');
    }
    const cobrancaAtualizada = await this.prisma.cobranca.findUnique({ where: { id } });

    // Cancelar LancamentoCaixa correspondente (Contas a Receber)
    try {
      const lancamento = await this.prisma.lancamentoCaixa.findFirst({
        where: {
          observacoes: { contains: `Ref. cobrança ${id}` },
          status: 'PREVISTO',
        },
      });
      if (lancamento) {
        await this.prisma.lancamentoCaixa.update({
          where: { id: lancamento.id },
          data: { status: 'CANCELADO' },
        });
      }
    } catch (err) {
      this.logger.warn(`Falha ao cancelar LancamentoCaixa: ${(err as Error).message}`);
    }

    return cobrancaAtualizada;
  }

  async remove(id: string, cooperativaId?: string) {
    // D-48-cobrancas IDOR fix: valida tenant antes do delete.
    if (cooperativaId) {
      const cob = await this.prisma.cobranca.findFirst({
        where: { id, cooperativaId },
        select: { id: true },
      });
      if (!cob) throw new NotFoundException(`Cobrança com id ${id} não encontrada`);
    }
    return this.prisma.cobranca.delete({ where: { id } });
  }

  /**
   * Após criar uma cobrança, emite automaticamente no gateway (Asaas) se a
   * cooperativa tiver config ativa e o cooperado tiver forma de pagamento
   * compatível.
   *
   * Tarefa 4 correção #1 (22/07/2026) — retorno DISCRIMINADO. Antes retornava
   * `null` em 4 cenarios diferentes (3 skips legitimos + 1 falha real), o que
   * apagava o sinal de falha na origem e tornava o try/catch do chamador
   * (:366-379) codigo morto. Agora:
   *   - SEM_GATEWAY → skip legitimo (sem cooperativa, sem config, sem forma
   *     de pagamento). Cooperado deve continuar sendo notificado (307
   *     faturados manualmente NAO podem parar de receber aviso).
   *   - EMITIDO → sucesso; retorna dados pra usar em notificacao/email.
   *   - FALHOU → falha real do gateway (erro capturado no catch). Cooperado
   *     NAO deve ser notificado (correcao #4) — cobranca fica sem
   *     instrumento de pagamento ate retry do cron (correcoes #2 + #3).
   *
   * NUNCA lanca — o catch interno cobre. try/catch no chamador pode ser
   * removido com seguranca (fica codigo morto).
   */
  async emitirNoGatewaySeConfigurado(
    cobrancaId: string,
    cooperativaId: string,
    cooperadoId: string,
    dados: { valor: number; vencimento: Date; descricao: string },
  ): Promise<EmissaoGatewayResult> {
    // Correção #2 helper — atualiza statusEmissao + auditoria de tentativas.
    // Chamado após cada branch pra manter o método self-contained (usável
    // tanto por criar() na 1ª tentativa quanto por retry do cron).
    const marcarStatus = async (result: EmissaoGatewayResult): Promise<void> => {
      try {
        if (result.tipo === 'EMITIDO') {
          await this.prisma.cobranca.update({
            where: { id: cobrancaId },
            data: {
              statusEmissao: 'EMITIDO' as any,
              ultimoErroEmissao: null, // limpa erro anterior se foi retry
              ultimaTentativaEmissaoEm: new Date(),
              tentativasEmissao: { increment: 1 },
            },
          });
        } else if (result.tipo === 'FALHOU') {
          await this.prisma.cobranca.update({
            where: { id: cobrancaId },
            data: {
              // Mantém statusEmissao=AGUARDANDO_EMISSAO. Decisão de FALHA_EMISSAO
              // fica com o job retry (sabe se atingiu o cap).
              tentativasEmissao: { increment: 1 },
              ultimoErroEmissao: result.erro.slice(0, 500),
              ultimaTentativaEmissaoEm: new Date(),
            },
          });
        } else if (result.tipo === 'SEM_GATEWAY') {
          // Cobrança manual — não pertence ao ciclo de retry. Se o create
          // marcou AGUARDANDO_EMISSAO (vaiTentarEmitir=true), reseta pra null
          // pra não ficar sendo varrida pelo cron eternamente.
          await this.prisma.cobranca.update({
            where: { id: cobrancaId },
            data: { statusEmissao: null },
          });
        }
      } catch (updateErr) {
        this.logger.error(
          `Falha ao gravar statusEmissao/tentativasEmissao na cobrança ${cobrancaId}: ${(updateErr as Error).message}`,
        );
      }
    };

    if (!cooperativaId) {
      const r: EmissaoGatewayResult = { tipo: 'SEM_GATEWAY', motivo: 'sem_cooperativa' };
      await marcarStatus(r);
      return r;
    }

    try {
      // Verificar se parceiro tem gateway configurado
      const config = await this.prisma.configGateway.findFirst({
        where: { cooperativaId, ativo: true },
      });
      if (!config) {
        const r: EmissaoGatewayResult = { tipo: 'SEM_GATEWAY', motivo: 'sem_config' };
        await marcarStatus(r);
        return r;
      }

      // Buscar forma de pagamento do cooperado
      const formaPagamento = await this.prisma.formaPagamentoCooperado.findUnique({
        where: { cooperadoId },
      });

      const formasValidas = ['BOLETO', 'PIX', 'CARTAO_CREDITO', 'CREDIT_CARD'];
      const tipo = formaPagamento?.tipo;
      if (!tipo || !formasValidas.includes(tipo)) {
        const r: EmissaoGatewayResult = { tipo: 'SEM_GATEWAY', motivo: 'sem_forma_pagamento' };
        await marcarStatus(r);
        return r;
      }

      const resultado = await this.gatewayPagamento.emitirCobranca(cooperadoId, cooperativaId, {
        valor: dados.valor,
        vencimento: dados.vencimento.toISOString().split('T')[0],
        descricao: dados.descricao,
        formaPagamento: tipo as 'BOLETO' | 'PIX' | 'CREDIT_CARD',
        cobrancaId,
      });

      const r: EmissaoGatewayResult = {
        tipo: 'EMITIDO',
        gatewayId: resultado.gatewayId,
        linkPagamento: resultado.linkPagamento ?? null,
        boletoUrl: resultado.boletoUrl ?? null,
        pixQrCode: resultado.pixQrCode ?? null,
        pixCopiaECola: resultado.pixCopiaECola ?? null,
        linhaDigitavel: resultado.linhaDigitavel ?? null,
      };
      await marcarStatus(r);
      return r;
    } catch (err) {
      this.logger.warn(`Falha ao emitir no gateway automaticamente: ${(err as Error).message}`);
      const r: EmissaoGatewayResult = { tipo: 'FALHOU', erro: (err as Error).message };
      await marcarStatus(r);
      return r;
    }
  }

  /**
   * Reenvia notificação WhatsApp individual para uma cobrança.
   * Inclui PIX copia-e-cola e linha digitável (se disponíveis),
   * e valor atualizado com multa/juros se vencida.
   */
  async reenviarNotificacao(id: string, cooperativaId?: string) {
    const cobranca = await this.prisma.cobranca.findUnique({
      where: { id },
      include: {
        contrato: { include: { cooperado: true } },
        asaasCobrancas: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });
    if (!cobranca) throw new NotFoundException(`Cobrança com id ${id} não encontrada`);
    if (cooperativaId && cobranca.cooperativaId !== cooperativaId) {
      throw new NotFoundException(`Cobrança com id ${id} não encontrada`);
    }

    const cooperado = cobranca.contrato?.cooperado;
    if (!cooperado?.telefone) {
      throw new BadRequestException('Cooperado sem telefone cadastrado');
    }

    // Calcular valor atualizado se vencida
    let valor = Number(cobranca.valorAtualizado ?? cobranca.valorLiquido);
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const venc = new Date(cobranca.dataVencimento);
    venc.setHours(0, 0, 0, 0);

    if ((cobranca.status === 'VENCIDO' || (cobranca.status === 'PENDENTE' && venc < hoje)) && !Number(cobranca.valorMulta)) {
      const coopId = cobranca.cooperativaId || cobranca.contrato?.cooperativaId;
      if (coopId) {
        const calculo = await this.calculoMultaJuros.calcular(
          Number(cobranca.valorLiquido),
          cobranca.dataVencimento,
          coopId,
        );
        if (calculo.diasEfetivos > 0) {
          valor = calculo.valorAtualizado;
        }
      }
    }

    const telefone = cooperado.telefone.replace(/\D/g, '').replace(/^(?!55)/, '55');
    const nome = cooperado.nomeCompleto.split(' ')[0];
    const mesStr = String(cobranca.mesReferencia).padStart(2, '0');
    const dataFormatada = venc.toLocaleDateString('pt-BR');
    const fmt = (v: number) => v.toFixed(2).replace('.', ',');

    let mensagem = `💚 *CoopereBR — Fatura ${mesStr}/${cobranca.anoReferencia}*\n\n`;
    mensagem += `Olá, ${nome}! 👋\n\n`;
    mensagem += `💰 Valor: R$ ${fmt(valor)}\n`;
    mensagem += `📅 Vencimento: ${dataFormatada}\n`;

    const asaas = cobranca.asaasCobrancas?.[0];
    if (asaas?.pixCopiaECola) {
      mensagem += `\n*Pague via PIX — Copia e Cola:*\n${asaas.pixCopiaECola}\n`;
    }
    if ((asaas as any)?.linhaDigitavel) {
      mensagem += `\n*Linha digitável:*\n${(asaas as any).linhaDigitavel}\n`;
    }
    if (asaas?.linkPagamento) {
      mensagem += `\n🔗 Ou acesse: ${asaas.linkPagamento}\n`;
    }

    mensagem += `\n_Dúvidas? Responda esta mensagem._`;

    await this.whatsappSender.enviarMensagem(telefone, mensagem, {
      tipoDisparo: 'COBRANCA',
      cooperadoId: cooperado.id,
      cooperativaId: cobranca.cooperativaId ?? undefined,
    });

    await this.prisma.cobranca.update({
      where: { id },
      data: { whatsappEnviadoEm: new Date() },
    });

    return { enviado: true, telefone, valor };
  }
}
