import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma.service';
import { ConfiguracaoCobrancaService } from '../configuracao-cobranca/configuracao-cobranca.service';
import { AsaasService } from '../asaas/asaas.service';
import { ClubeVantagensService } from '../clube-vantagens/clube-vantagens.service';
import { WhatsappCicloVidaService } from '../whatsapp/whatsapp-ciclo-vida.service';
import { WhatsappSenderService } from '../whatsapp/whatsapp-sender.service';
import { EmailService } from '../email/email.service';
import { CooperTokenService } from '../cooper-token/cooper-token.service';
import { TokenContabilService } from '../financeiro/token-contabil.service';
import { CooperTokenTipo } from '@prisma/client';

export type FonteDados = 'FATURA_OCR' | 'GERACAO_MANUAL' | 'ESTIMADO';

export interface CobrancaCalculo {
  contratoId: string;
  competencia: Date;
  geracaoMensalId: string;
  kwhEntregue: number;
  kwhConsumido: number | null;
  kwhCompensado: number | null;
  kwhSaldo: number | null;
  descontoAplicado: number;
  baseCalculoUsada: string;
  fonteDesconto: string;
  fonteDados: FonteDados;
  faturaProcessadaId: string | null;
  valorBruto: number;
  valorDesconto: number;
  valorLiquido: number;
  avisos: string[];
}

@Injectable()
export class CobrancasService {
  private readonly logger = new Logger(CobrancasService.name);

  constructor(
    private prisma: PrismaService,
    private eventEmitter: EventEmitter2,
    private configuracaoCobrancaService: ConfiguracaoCobrancaService,
    private asaasService: AsaasService,
    private clubeVantagensService: ClubeVantagensService,
    private whatsappCicloVida: WhatsappCicloVidaService,
    private whatsappSender: WhatsappSenderService,
    private emailService: EmailService,
    private cooperTokenService: CooperTokenService,
    private tokenContabil: TokenContabilService,
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
    percentualDesconto: number;
    valorDesconto: number;
    valorLiquido: number;
    dataVencimento: Date;
    dataPagamento?: Date;
  }, cooperativaId?: string) {
    // Buscar contrato para obter cooperativaId e dados do cooperado
    const contrato = await this.prisma.contrato.findUnique({
      where: { id: data.contratoId },
      include: { cooperado: true, plano: true },
    });

    // Resolver cooperativaId: parâmetro > contrato
    const resolvedCoopId = cooperativaId || contrato?.cooperativaId || undefined;

    const cobranca = await this.prisma.cobranca.create({
      data: {
        ...data,
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
          const valorDescontoEmReais = Math.round(data.valorLiquido * (maxPerc / 100) * 100) / 100;
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
            valorCobranca: data.valorLiquido,
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

            const novoValorLiquido = Math.round((data.valorLiquido - desconto.descontoReais) * 100) / 100;

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

    // Emitir automaticamente no Asaas se configurado
    if (resolvedCoopId && contrato?.cooperadoId) {
      try {
        await this.emitirNoAsaasSeConfigurado(
          cobranca.id,
          resolvedCoopId,
          contrato.cooperadoId,
          {
            valor: data.valorLiquido,
            vencimento: data.dataVencimento,
            descricao: `Cobrança ${data.mesReferencia}/${data.anoReferencia}`,
          },
        );
      } catch (err) {
        this.logger.warn(`Falha ao emitir Asaas na criação da cobrança: ${err.message}`);
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
          Number(data.valorLiquido),
          vencimento,
        ).catch(() => {});
      } catch (err) {
        this.logger.warn(`Falha ao notificar cobrança gerada via WhatsApp: ${(err as Error).message}`);
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
          valor: data.valorLiquido,
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
    dataVencimento: Date;
    dataPagamento: Date;
  }>) {
    return this.prisma.cobranca.update({ where: { id }, data });
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
        const config = await this.prisma.cooperativa.findUnique({
          where: { id: coopId },
          select: { multaAtraso: true, jurosDiarios: true, diasCarencia: true },
        });

        if (config) {
          const vencimento = new Date(cobranca.dataVencimento);
          vencimento.setHours(0, 0, 0, 0);
          const hoje = new Date();
          hoje.setHours(0, 0, 0, 0);
          const diasAtraso = Math.floor((hoje.getTime() - vencimento.getTime()) / (1000 * 60 * 60 * 24));
          const diasCarencia = config.diasCarencia ?? 0;
          const diasEfetivos = Math.max(0, diasAtraso - diasCarencia);

          if (diasEfetivos > 0) {
            const valorOriginal = Number(cobranca.valorLiquido);
            // BUG-1: Precisão de 4 casas intermediárias, arredondando para 2 no final
            const multa = Math.round(valorOriginal * (Number(config.multaAtraso) / 100) * 1e4) / 1e4;
            const juros = Math.round(valorOriginal * (Number(config.jurosDiarios) / 100) * diasEfetivos * 1e4) / 1e4;
            const valorAtualizado = Math.round((valorOriginal + multa + juros) * 100) / 100;

            await this.prisma.cobranca.update({
              where: { id },
              data: {
                valorMulta: Math.round(multa * 100) / 100,
                valorJuros: Math.round(juros * 100) / 100,
                valorAtualizado,
              },
            });

            // Atualizar referência local para usar valor correto abaixo
            (cobranca as any).valorAtualizado = valorAtualizado;
            (cobranca as any).valorMulta = Math.round(multa * 100) / 100;
            (cobranca as any).valorJuros = Math.round(juros * 100) / 100;
          }
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

  async calcularCobrancaMensal(contratoId: string, competencia: Date): Promise<CobrancaCalculo> {
    const avisos: string[] = [];

    // 1. Buscar contrato com usina, UC e plano (para distribuidora e modelo de cobrança)
    const contrato = await this.prisma.contrato.findUnique({
      where: { id: contratoId },
      include: { usina: true, uc: true, plano: true, cooperado: { select: { status: true } } },
    });
    if (!contrato) throw new NotFoundException('Contrato não encontrado');
    if (contrato.status !== 'ATIVO') {
      throw new BadRequestException(`Contrato ${contratoId} não está ATIVO (status: ${contrato.status}). Cobrança não gerada.`);
    }
    if (contrato.cooperado?.status !== 'ATIVO') {
      throw new BadRequestException(`Cooperado do contrato ${contratoId} não está ATIVO (status: ${contrato.cooperado?.status}). Cobrança não gerada.`);
    }
    if (!contrato.usinaId || !contrato.usina) {
      throw new BadRequestException('Contrato não possui usina vinculada');
    }
    if (contrato.percentualUsina == null) {
      throw new BadRequestException('Contrato não possui percentualUsina definido');
    }

    // 2. Buscar GeracaoMensal da usina para a competência
    const competenciaNormalizada = new Date(competencia.getFullYear(), competencia.getMonth(), 1);
    const mesRef = competenciaNormalizada.getMonth() + 1;
    const anoRef = competenciaNormalizada.getFullYear();

    const geracao = await this.prisma.geracaoMensal.findUnique({
      where: {
        usinaId_competencia: {
          usinaId: contrato.usinaId,
          competencia: competenciaNormalizada,
        },
      },
    });
    if (!geracao) {
      throw new NotFoundException(
        `Geração mensal não encontrada para usina ${contrato.usina.nome} na competência ${competenciaNormalizada.toISOString().slice(0, 7)}`,
      );
    }

    // 3. Calcular kWh entregue ao cooperado
    const percentualUsina = Number(contrato.percentualUsina) / 100;
    const kwhEntregue = geracao.kwhGerado * percentualUsina;

    // 4. Resolver desconto via hierarquia (contrato → usina → cooperativa)
    const configDesconto = await this.configuracaoCobrancaService.resolverDesconto(contratoId);
    const descontoAplicado = configDesconto.desconto;
    const baseCalculoUsada = configDesconto.baseCalculo;
    const fonteDesconto = configDesconto.fonte;

    // 5. Buscar tarifa da distribuidora do cooperado (TUSD + TE)
    const distribuidora = contrato.uc?.distribuidora || contrato.usina?.distribuidora;
    if (!distribuidora) {
      throw new BadRequestException('UC/Usina não possui distribuidora definida — impossível calcular tarifa');
    }
    const normDistrib = distribuidora
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
    const todasTarifas = await this.prisma.tarifaConcessionaria.findMany({
      orderBy: { dataVigencia: 'desc' },
    });
    const tarifaVigente = todasTarifas.find(t => {
      const normConc = t.concessionaria
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim();
      return normConc.includes(normDistrib) || normDistrib.includes(normConc);
    }) || null;
    if (!tarifaVigente) {
      throw new BadRequestException(`Tarifa não encontrada para a distribuidora "${distribuidora}". Cadastre a tarifa antes de gerar cobranças.`);
    }
    let tarifaKwh = Number(tarifaVigente.tusdNova) + Number(tarifaVigente.teNova);

    // 6. Resolver modelo de cobrança (contrato override → usina override → plano → CREDITOS_COMPENSADOS)
    const modeloCobranca =
      (contrato as any).modeloCobrancaOverride ||
      (contrato.usina as any)?.modeloCobrancaOverride ||
      (contrato as any).plano?.modeloCobranca ||
      'CREDITOS_COMPENSADOS';

    // 7. Buscar FaturaProcessada APROVADA para este cooperado/mês (dados OCR)
    const mesRefStr = `${anoRef}-${String(mesRef).padStart(2, '0')}`;
    const faturaAprovada = await this.prisma.faturaProcessada.findFirst({
      where: {
        cooperadoId: contrato.cooperadoId,
        status: 'APROVADA',
        mesReferencia: mesRefStr,
      },
      orderBy: { updatedAt: 'desc' },
    });

    const dadosOcr = faturaAprovada?.dadosExtraidos as any;
    let fonteDados: FonteDados = 'GERACAO_MANUAL';
    let faturaProcessadaId: string | null = null;
    let kwhCompensadoOcr: number | null = null;
    let kwhConsumidoOcr: number | null = null;

    if (faturaAprovada && dadosOcr) {
      faturaProcessadaId = faturaAprovada.id;
      kwhCompensadoOcr = dadosOcr.creditosRecebidosKwh != null
        ? Number(dadosOcr.creditosRecebidosKwh)
        : null;
      kwhConsumidoOcr = dadosOcr.consumoAtualKwh != null
        ? Number(dadosOcr.consumoAtualKwh)
        : null;
    }

    // 8. Calcular valor conforme modelo, usando OCR quando disponível
    let kwhCobranca: number;
    const kwhContrato = Number(contrato.kwhContrato ?? 0);

    if (modeloCobranca === 'FIXO_MENSAL') {
      kwhCobranca = kwhContrato;
    } else if (modeloCobranca === 'CREDITOS_COMPENSADOS') {
      if (kwhCompensadoOcr != null && kwhCompensadoOcr > 0) {
        // Usar kwhCompensado da fatura OCR em vez de kwhEntregue da GeracaoMensal
        kwhCobranca = Math.min(kwhCompensadoOcr, kwhContrato);
        fonteDados = 'FATURA_OCR';
        avisos.push(`Dados OCR utilizados: kwhCompensado=${kwhCompensadoOcr} da fatura ${faturaAprovada!.id}`);
      } else {
        kwhCobranca = Math.min(kwhEntregue, kwhContrato);
        if (faturaAprovada) {
          avisos.push('Fatura aprovada encontrada mas sem kwhCompensado — usando GeracaoMensal');
        }
      }
    } else if (modeloCobranca === 'CREDITOS_DINAMICO') {
      // CREDITOS_DINAMICO: usar tarifas OCR se disponíveis
      if (faturaAprovada && dadosOcr) {
        const tusdOcr = dadosOcr.tarifaTUSD != null ? Number(dadosOcr.tarifaTUSD) : null;
        const teOcr = dadosOcr.tarifaTE != null ? Number(dadosOcr.tarifaTE) : null;
        if (tusdOcr != null && teOcr != null && tusdOcr > 0 && teOcr > 0) {
          tarifaKwh = tusdOcr + teOcr;
          fonteDados = 'FATURA_OCR';
          avisos.push(`Tarifa OCR utilizada: TUSD=${tusdOcr} + TE=${teOcr} = ${tarifaKwh} da fatura ${faturaAprovada.id}`);
        } else {
          avisos.push('Fatura aprovada encontrada mas sem tarifaTUSD/tarifaTE — usando tarifa vigente cadastrada');
        }
      }

      if (kwhCompensadoOcr != null && kwhCompensadoOcr > 0) {
        kwhCobranca = Math.min(kwhCompensadoOcr, kwhContrato);
        if (fonteDados !== 'FATURA_OCR') fonteDados = 'FATURA_OCR';
        avisos.push(`Dados OCR utilizados: kwhCompensado=${kwhCompensadoOcr} da fatura ${faturaAprovada!.id}`);
      } else {
        kwhCobranca = Math.min(kwhEntregue, kwhContrato);
      }
    } else {
      kwhCobranca = Math.min(kwhEntregue, kwhContrato);
      fonteDados = 'ESTIMADO';
    }

    const valorBruto = Math.round(kwhCobranca * tarifaKwh * 100) / 100;
    const valorDesconto = Math.round(valorBruto * (descontoAplicado / 100) * 100) / 100;
    const valorLiquido = Math.round((valorBruto - valorDesconto) * 100) / 100;

    return {
      contratoId,
      competencia: competenciaNormalizada,
      geracaoMensalId: geracao.id,
      kwhEntregue,
      kwhConsumido: kwhConsumidoOcr,
      kwhCompensado: kwhCompensadoOcr,
      kwhSaldo: kwhCompensadoOcr != null ? kwhCompensadoOcr - (kwhConsumidoOcr ?? 0) : null,
      descontoAplicado,
      baseCalculoUsada: `${baseCalculoUsada} (${modeloCobranca})`,
      fonteDesconto,
      fonteDados,
      faturaProcessadaId,
      valorBruto,
      valorDesconto,
      valorLiquido,
      avisos,
    };
  }

  /**
   * Após criar uma cobrança, emite automaticamente no Asaas se a cooperativa
   * tiver config ativa e o cooperado tiver forma de pagamento compatível.
   */
  async emitirNoAsaasSeConfigurado(
    cobrancaId: string,
    cooperativaId: string,
    cooperadoId: string,
    dados: { valor: number; vencimento: Date; descricao: string },
  ) {
    if (!cooperativaId) return null;

    try {
      const config = await this.asaasService.getConfig(cooperativaId);
      if (!config) return null;

      // Buscar forma de pagamento do cooperado
      const formaPagamento = await this.prisma.formaPagamentoCooperado.findUnique({
        where: { cooperadoId },
      });

      const formasAsaas = ['BOLETO', 'PIX', 'CARTAO_CREDITO', 'CREDIT_CARD'];
      const tipo = formaPagamento?.tipo;
      if (!tipo || !formasAsaas.includes(tipo)) return null;

      return await this.asaasService.emitirCobranca(cooperadoId, cooperativaId, {
        valor: dados.valor,
        vencimento: dados.vencimento.toISOString().split('T')[0],
        descricao: dados.descricao,
        formaPagamento: tipo,
        cobrancaId,
      });
    } catch (err) {
      this.logger.warn(`Falha ao emitir cobrança Asaas automaticamente: ${err.message}`);
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
        const config = await this.prisma.cooperativa.findUnique({
          where: { id: coopId },
          select: { multaAtraso: true, jurosDiarios: true, diasCarencia: true },
        });
        if (config) {
          const diasAtraso = Math.floor((hoje.getTime() - venc.getTime()) / 86400000);
          const diasEfetivos = Math.max(0, diasAtraso - (config.diasCarencia ?? 0));
          if (diasEfetivos > 0) {
            const base = Number(cobranca.valorLiquido);
            const multa = base * (Number(config.multaAtraso) / 100);
            const juros = base * (Number(config.jurosDiarios) / 100) * diasEfetivos;
            valor = Math.round((base + multa + juros) * 100) / 100;
          }
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
