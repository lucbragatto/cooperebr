import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
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
import { CooperTokenTipo } from '@prisma/client';

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
  ) {}

  @OnEvent('pagamento.confirmado')
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

  async findByContrato(contratoId: string) {
    return this.prisma.cobranca.findMany({
      where: { contratoId },
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

    // Refletir valores resolvidos em data pra o código posterior
    // (CooperToken, gateway, lançamento contábil) ler valLiquido/valDesc.
    data.percentualDesconto = pctDesc;
    data.valorDesconto = valDesc;
    data.valorLiquido = valLiq;
    data.dataVencimento = dataVenc;
    if (dataPag) data.dataPagamento = dataPag;

    const cobranca = await this.prisma.cobranca.create({
      data: {
        ...data,
        percentualDesconto: pctDesc,
        valorDesconto: valDesc,
        valorLiquido: valLiq,
        dataVencimento: dataVenc,
        ...(dataPag ? { dataPagamento: dataPag } : {}),
        ...(resolvedCoopId ? { cooperativaId: resolvedCoopId } : {}),
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

            // Lançamento contábil: emissão fatura-cheia
            try {
              await this.tokenContabil.lancarEmissaoFaturaCheia({
                cooperativaId: resolvedCoopId,
                cooperadoId: contrato.cooperadoId,
                valor: valorDescontoEmReais,
                competencia: new Date().toISOString().slice(0, 7),
                descricao: `Fatura-cheia ${valorDescontoEmTokens} tokens (cobrança ${cobranca.id})`,
              });
            } catch (err) {
              this.logger.warn(`Falha ao lançar contábil fatura-cheia: ${(err as Error).message}`);
            }
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

    // Emitir automaticamente no gateway de pagamento se configurado
    if (resolvedCoopId && contrato?.cooperadoId) {
      try {
        await this.emitirNoGatewaySeConfigurado(
          cobranca.id,
          resolvedCoopId,
          contrato.cooperadoId,
          {
            valor: data.valorLiquido!,
            vencimento: data.dataVencimento,
            descricao: `Cobrança ${data.mesReferencia}/${data.anoReferencia}`,
          },
        );
      } catch (err) {
        this.logger.warn(`Falha ao emitir no gateway na criação da cobrança: ${(err as Error).message}`);
      }
    }

    // Notificar cooperado via WhatsApp sobre nova cobrança (aviso de vencimento)
    if (contrato?.cooperado?.telefone) {
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

    // Sprint 8B: enviar email de fatura ao cooperado
    if (contrato?.cooperado?.email) {
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

  async update(id: string, data: Partial<{
    mesReferencia: number;
    anoReferencia: number;
    valorBruto: number;
    percentualDesconto: number;
    valorDesconto: number;
    valorLiquido: number;
    status: 'A_VENCER' | 'PAGO' | 'VENCIDO' | 'CANCELADO';
    dataVencimento: Date | string;
    dataPagamento: Date | string;
  }>) {
    // D-52 fix: normalizar datas vindas como string ISO curto (YYYY-MM-DD)
    // do input HTML date — Prisma rejeita "YYYY-MM-DD", exige DateTime ISO-8601
    // completo. Mesmo padrão de normalizarData() já usado em create.
    if (data.dataPagamento && typeof data.dataPagamento === 'string') {
      data.dataPagamento = normalizarData(data.dataPagamento, 'dataPagamento');
    }
    if (data.dataVencimento && typeof data.dataVencimento === 'string') {
      data.dataVencimento = normalizarData(data.dataVencimento, 'dataVencimento');
    }
    // D-55 fix: retornar com mesmo include do findOne — sem isso a UI
    // sobrescreve o estado com objeto plano e perde contrato.cooperado
    // após Dar Baixa / Editar (tela detalhe fica com "—").
    return this.prisma.cobranca.update({
      where: { id },
      data: data as any,
      include: { contrato: { include: { cooperado: true } } },
    });
  }

  async darBaixa(id: string, dataPagamento: string, valorPago: number, metodoPagamento?: string) {
    const cobranca = await this.prisma.cobranca.findUnique({
      where: { id },
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

  async cancelar(id: string, motivo: string) {
    const cobranca = await this.prisma.cobranca.findUnique({ where: { id } });
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

  async remove(id: string) {
    return this.prisma.cobranca.delete({ where: { id } });
  }

  /**
   * Após criar uma cobrança, emite automaticamente no Asaas se a cooperativa
   * tiver config ativa e o cooperado tiver forma de pagamento compatível.
   */
  async emitirNoGatewaySeConfigurado(
    cobrancaId: string,
    cooperativaId: string,
    cooperadoId: string,
    dados: { valor: number; vencimento: Date; descricao: string },
  ) {
    if (!cooperativaId) return null;

    try {
      // Verificar se parceiro tem gateway configurado
      const config = await this.prisma.configGateway.findFirst({
        where: { cooperativaId, ativo: true },
      });
      if (!config) return null;

      // Buscar forma de pagamento do cooperado
      const formaPagamento = await this.prisma.formaPagamentoCooperado.findUnique({
        where: { cooperadoId },
      });

      const formasValidas = ['BOLETO', 'PIX', 'CARTAO_CREDITO', 'CREDIT_CARD'];
      const tipo = formaPagamento?.tipo;
      if (!tipo || !formasValidas.includes(tipo)) return null;

      return await this.gatewayPagamento.emitirCobranca(cooperadoId, cooperativaId, {
        valor: dados.valor,
        vencimento: dados.vencimento.toISOString().split('T')[0],
        descricao: dados.descricao,
        formaPagamento: tipo as 'BOLETO' | 'PIX' | 'CREDIT_CARD',
        cobrancaId,
      });
    } catch (err) {
      this.logger.warn(`Falha ao emitir no gateway automaticamente: ${(err as Error).message}`);
      return null;
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
