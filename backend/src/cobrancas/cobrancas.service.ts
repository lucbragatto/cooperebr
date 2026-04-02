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
  valorBruto: number;
  valorDesconto: number;
  valorLiquido: number;
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
      include: { cooperado: true },
    });

    // Resolver cooperativaId: parâmetro > contrato
    const resolvedCoopId = cooperativaId || contrato?.cooperativaId || undefined;

    const cobranca = await this.prisma.cobranca.create({
      data: {
        ...data,
        ...(resolvedCoopId ? { cooperativaId: resolvedCoopId } : {}),
      },
    });

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

    const cobrancaAtualizada = await this.prisma.cobranca.update({
      where: { id },
      data: {
        status: 'PAGO',
        dataPagamento: dtPagamento,
        valorPago: valorFinal,
      },
    });

    // Criar LancamentoCaixa automático
    try {
      const nomeCooperado = cobranca.contrato?.cooperado?.nomeCompleto || 'Cooperado';
      const mesRef = `${String(cobranca.mesReferencia).padStart(2, '0')}/${cobranca.anoReferencia}`;
      const competencia = `${cobranca.anoReferencia}-${String(cobranca.mesReferencia).padStart(2, '0')}`;

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
    } catch (err) {
      this.logger.warn(`Falha ao criar LancamentoCaixa na baixa: ${err.message}`);
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
    try {
      const cooperadoId = cobranca.contrato?.cooperadoId;
      if (cooperadoId) {
        const totalPagas = await this.prisma.cobranca.count({
          where: { contrato: { cooperadoId }, status: 'PAGO' },
        });
        if (totalPagas === 1) {
          this.eventEmitter.emit('cobranca.primeira.paga', {
            cooperadoId,
            valorFatura: valorFinal,
          });
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
    return this.prisma.cobranca.update({
      where: { id },
      data: {
        status: 'CANCELADO',
        motivoCancelamento: motivo,
      },
    });
  }

  async remove(id: string) {
    return this.prisma.cobranca.delete({ where: { id } });
  }

  async calcularCobrancaMensal(contratoId: string, competencia: Date): Promise<CobrancaCalculo> {
    // 1. Buscar contrato com usina, UC e plano (para distribuidora e modelo de cobrança)
    const contrato = await this.prisma.contrato.findUnique({
      where: { id: contratoId },
      include: { usina: true, uc: true, plano: true },
    });
    if (!contrato) throw new NotFoundException('Contrato não encontrado');
    if (!contrato.usinaId || !contrato.usina) {
      throw new BadRequestException('Contrato não possui usina vinculada');
    }
    if (contrato.percentualUsina == null) {
      throw new BadRequestException('Contrato não possui percentualUsina definido');
    }

    // 2. Buscar GeracaoMensal da usina para a competência
    const competenciaNormalizada = new Date(competencia.getFullYear(), competencia.getMonth(), 1);
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
    // Normalizar distribuidora para match: lowercase, sem acentos, trimmed
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
    const tarifaKwh = Number(tarifaVigente.tusdNova) + Number(tarifaVigente.teNova);

    // 6. Resolver modelo de cobrança (contrato override → usina override → plano → FIXO_MENSAL)
    const modeloCobranca =
      (contrato as any).modeloCobrancaOverride ||
      (contrato.usina as any)?.modeloCobrancaOverride ||
      (contrato as any).plano?.modeloCobranca ||
      'CREDITOS_COMPENSADOS';

    // 7. Calcular valor conforme modelo
    let kwhCobranca: number;
    const kwhContrato = Number(contrato.kwhContrato ?? 0);

    if (modeloCobranca === 'FIXO_MENSAL') {
      // Valor fixo mensal: usa kWhContrato como base, independente da geração real
      kwhCobranca = kwhContrato;
    } else if (modeloCobranca === 'CREDITOS_DINAMICO') {
      // Similar a CREDITOS_COMPENSADOS mas usa tarifa vigente atual (já obtida acima)
      // kWh cobrança = min(entregue, contrato) — cobra apenas o que foi efetivamente entregue
      kwhCobranca = Math.min(kwhEntregue, kwhContrato);
    } else {
      // CREDITOS_COMPENSADOS (padrão): cobra pelos kWh efetivamente entregues
      kwhCobranca = Math.min(kwhEntregue, kwhContrato);
    }

    const valorBruto = kwhCobranca * tarifaKwh;
    const valorDesconto = valorBruto * (descontoAplicado / 100);
    const valorLiquido = valorBruto - valorDesconto;

    return {
      contratoId,
      competencia: competenciaNormalizada,
      geracaoMensalId: geracao.id,
      kwhEntregue,
      kwhConsumido: null, // será preenchido quando houver fatura do cooperado
      kwhCompensado: null,
      kwhSaldo: null,
      descontoAplicado,
      baseCalculoUsada: `${baseCalculoUsada} (${modeloCobranca})`,
      fonteDesconto,
      valorBruto,
      valorDesconto,
      valorLiquido,
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
