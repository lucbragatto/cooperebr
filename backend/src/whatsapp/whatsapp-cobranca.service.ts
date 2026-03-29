import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma.service';
import { AsaasService } from '../asaas/asaas.service';
import { WhatsappSenderService } from './whatsapp-sender.service';
import {
  ConfiguracaoNotificacaoService,
  TipoNotificacaoCobranca,
} from '../cobrancas/configuracao-notificacao.service';

@Injectable()
export class WhatsappCobrancaService {
  private readonly logger = new Logger(WhatsappCobrancaService.name);

  constructor(
    private prisma: PrismaService,
    private asaasService: AsaasService,
    private sender: WhatsappSenderService,
    private configNotificacao: ConfiguracaoNotificacaoService,
  ) {}


  /**
   * Dispara cobranças do mês via WhatsApp com PIX copia-e-cola.
   * Cron: dia 5 de cada mês às 8h (America/Sao_Paulo)
   */
  @Cron('0 8 5 * *', { timeZone: 'America/Sao_Paulo' })
  async cronEnviarCobrancas() {
    this.logger.log('Cron: disparando cobranças do mês via WhatsApp...');
    await this.enviarCobrancasDoMes();
  }

  async enviarCobrancasDoMes(
    cooperativaId?: string,
    mesReferencia?: string,
    opcoes?: { modo?: 'todos' | 'parceiro' | 'lista'; parceiroId?: string; telefones?: string[]; limiteEnvios?: number },
  ) {
    const agora = new Date();
    const mes = mesReferencia
      ? parseInt(mesReferencia.split('/')[0] || mesReferencia.split('-')[0])
      : agora.getMonth() + 1;
    const ano = mesReferencia
      ? parseInt(mesReferencia.split('/')[1] || mesReferencia.split('-')[1])
      : agora.getFullYear();

    const modo = opcoes?.modo ?? 'todos';

    // Buscar cobranças A_VENCER do mês que ainda não foram enviadas por WhatsApp
    const where: any = {
      status: 'A_VENCER',
      mesReferencia: mes,
      anoReferencia: ano,
      whatsappEnviadoEm: null,
    };
    if (modo === 'parceiro' && opcoes?.parceiroId) {
      where.cooperativaId = opcoes.parceiroId;
    } else if (cooperativaId) {
      where.cooperativaId = cooperativaId;
    }

    // Filtrar por telefones específicos
    if (modo === 'lista' && opcoes?.telefones?.length) {
      const telefonesNorm = opcoes.telefones.map((t) => this.formatarTelefone(t));
      where.contrato = {
        cooperado: {
          telefone: { in: telefonesNorm },
        },
      };
    }

    const cobrancas = await this.prisma.cobranca.findMany({
      where,
      include: {
        contrato: {
          include: {
            cooperado: true,
          },
        },
        asaasCobrancas: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    this.logger.log(`Encontradas ${cobrancas.length} cobranças pendentes para envio WhatsApp (${mes}/${ano})`);

    const limite = opcoes?.limiteEnvios ?? 30;
    const listaLimitada = cobrancas.slice(0, limite);
    const limitado = cobrancas.length > limite;

    let enviados = 0;
    let erros = 0;

    for (const cobranca of listaLimitada) {
      const cooperado = cobranca.contrato?.cooperado;
      if (!cooperado?.telefone) {
        this.logger.warn(`Cobrança ${cobranca.id}: cooperado sem telefone — pulando`);
        continue;
      }

      try {
        const telefone = this.formatarTelefone(cooperado.telefone);
        const nome = cooperado.nomeCompleto.split(' ')[0]; // Primeiro nome
        const valor = Number(cobranca.valorLiquido);
        const dataVenc = new Date(cobranca.dataVencimento);
        const dataFormatada = dataVenc.toLocaleDateString('pt-BR');

        // Buscar dados de PIX/pagamento do Asaas (se existir)
        let pixCopiaECola = '';
        let invoiceUrl = '';

        const asaasCobranca = cobranca.asaasCobrancas?.[0];
        if (asaasCobranca) {
          pixCopiaECola = asaasCobranca.pixCopiaECola || '';
          invoiceUrl = asaasCobranca.linkPagamento || '';
        } else if (cobranca.cooperativaId) {
          // Tentar emitir cobrança no Asaas
          try {
            const asaasResult = await this.asaasService.emitirCobranca(
              cooperado.id,
              cobranca.cooperativaId,
              {
                valor,
                vencimento: dataVenc.toISOString().split('T')[0],
                descricao: `Fatura CoopereBR ${mes.toString().padStart(2, '0')}/${ano}`,
                formaPagamento: 'PIX',
                cobrancaId: cobranca.id,
              },
            );
            pixCopiaECola = asaasResult.pixCopiaECola || '';
            invoiceUrl = asaasResult.linkPagamento || '';
          } catch (err) {
            this.logger.warn(`Não foi possível emitir Asaas para cobrança ${cobranca.id}: ${err.message}`);
          }
        }

        // Montar mensagem
        const mesStr = mes.toString().padStart(2, '0');
        const cabecalho = await this.montarTextoStatusFatura(cobranca.cooperativaId, valor, null, null, null, dataVenc, cobranca.status, 0);
        let mensagem = `💚 *CoopereBR — Fatura ${mesStr}/${ano}*\n\n`;
        mensagem += `Olá, ${nome}! 👋\n\n`;
        mensagem += `${cabecalho}\n`;
        mensagem += `📅 Vencimento: ${dataFormatada}\n`;

        if (pixCopiaECola) {
          mensagem += `\n*Pague via PIX — Copia e Cola:*\n${pixCopiaECola}\n`;
        }

        const linhaDigitavel = asaasCobranca?.linhaDigitavel;
        if (linhaDigitavel) {
          mensagem += `\n*Linha digitável:*\n${linhaDigitavel}\n`;
        }

        if (invoiceUrl) {
          mensagem += `\n🔗 Ou acesse: ${invoiceUrl}\n`;
        }

        mensagem += `\n_Dúvidas? Responda esta mensagem._`;

        await this.sender.enviarMensagem(telefone, mensagem, {
          tipoDisparo: 'COBRANCA',
          cooperadoId: cooperado.id,
          cooperativaId: cobranca.cooperativaId ?? undefined,
        });

        // Marcar como enviado
        await this.prisma.cobranca.update({
          where: { id: cobranca.id },
          data: { whatsappEnviadoEm: new Date() },
        });

        enviados++;
        this.logger.log(`WhatsApp cobrança enviada para ${cooperado.nomeCompleto} (${telefone})`);

        // Pausa aleatória entre mensagens para evitar bloqueio
        await this.delayAleatorio();
      } catch (err) {
        erros++;
        this.logger.error(`Erro ao enviar cobrança ${cobranca.id}: ${err.message}`);
      }
    }

    const resultado = {
      total: cobrancas.length,
      enviados,
      erros,
      mes,
      ano,
      limitado,
      ...(limitado ? { totalNaoEnviados: cobrancas.length - limite } : {}),
    };
    this.logger.log(`Resultado envio cobranças: ${JSON.stringify(resultado)}`);
    return resultado;
  }

  /**
   * Abordar inadimplentes (cobranças vencidas) via WhatsApp.
   * Cron: todo dia às 9h
   */
  @Cron('0 9 * * *', { timeZone: 'America/Sao_Paulo' })
  async cronAbordarInadimplentes() {
    this.logger.log('Cron: abordando inadimplentes via WhatsApp...');
    await this.abordarInadimplentes();
  }

  async abordarInadimplentes(cooperativaId?: string) {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const where: any = {
      status: 'VENCIDO',
      whatsappEnviadoEm: { not: null }, // já recebeu a cobrança original
    };
    if (cooperativaId) where.cooperativaId = cooperativaId;

    const cobrancas = await this.prisma.cobranca.findMany({
      where,
      include: {
        contrato: {
          include: {
            cooperado: true,
            cooperativa: { select: { id: true, diasCarencia: true, multaAtraso: true, jurosDiarios: true } },
          },
        },
        asaasCobrancas: true,
      },
      orderBy: { dataVencimento: 'asc' },
    });

    this.logger.log(`Encontradas ${cobrancas.length} cobranças vencidas para abordagem`);

    let enviados = 0;
    let erros = 0;

    for (const cobranca of cobrancas) {
      const cooperado = cobranca.contrato?.cooperado;
      if (!cooperado?.telefone) continue;

      try {
        const telefone = this.formatarTelefone(cooperado.telefone);
        const nome = cooperado.nomeCompleto.split(' ')[0];
        const valorLiquido = Number(cobranca.valorLiquido);
        const valorAtualizado = Number(cobranca.valorAtualizado || cobranca.valorLiquido);
        const dataVenc = new Date(cobranca.dataVencimento);
        dataVenc.setHours(0, 0, 0, 0);

        const config = cobranca.contrato?.cooperativa;
        const diasCarencia = config?.diasCarencia ?? 3;

        const cabecalho = await this.montarTextoStatusFatura(
          cobranca.cooperativaId,
          valorLiquido,
          valorAtualizado,
          Number(cobranca['valorMulta'] || 0),
          Number(cobranca['valorJuros'] || 0),
          dataVenc,
          cobranca.status,
          diasCarencia,
        );

        let mensagem = `💚 *CoopereBR — Aviso de Pendência*\n\n`;
        mensagem += `Olá, ${nome}! 👋\n\n`;
        mensagem += `${cabecalho}\n`;

        const asaasCobranca = cobranca.asaasCobrancas?.[0];
        if (asaasCobranca?.pixCopiaECola) {
          mensagem += `\n*Pague via PIX — Copia e Cola:*\n${asaasCobranca.pixCopiaECola}\n`;
        }
        if (asaasCobranca?.linhaDigitavel) {
          mensagem += `\n*Linha digitável:*\n${asaasCobranca.linhaDigitavel}\n`;
        }
        if (asaasCobranca?.linkPagamento) {
          mensagem += `\n🔗 Ou acesse: ${asaasCobranca.linkPagamento}\n`;
        }

        mensagem += `\n_Dúvidas? Responda esta mensagem._`;

        await this.sender.enviarMensagem(telefone, mensagem, {
          tipoDisparo: 'COBRANCA',
          cooperadoId: cooperado.id,
          cooperativaId: cobranca.cooperativaId ?? undefined,
        });

        enviados++;
        await this.delayAleatorio();
      } catch (err) {
        erros++;
        this.logger.error(`Erro ao abordar inadimplente ${cobranca.id}: ${err.message}`);
      }
    }

    const resultado = { total: cobrancas.length, enviados, erros };
    this.logger.log(`Resultado abordagem inadimplentes: ${JSON.stringify(resultado)}`);
    return resultado;
  }

  /**
   * Monta o texto de status da fatura baseado na proximidade do vencimento.
   * Usa ConfiguracaoNotificacaoService para buscar textos configuráveis.
   */
  private async montarTextoStatusFatura(
    cooperativaId: string | null,
    valorLiquido: number,
    valorAtualizado: number | null,
    valorMulta: number | null,
    valorJuros: number | null,
    dataVencimento: Date,
    status: string,
    diasCarencia: number,
  ): Promise<string> {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const venc = new Date(dataVencimento);
    venc.setHours(0, 0, 0, 0);
    const diff = Math.floor((venc.getTime() - hoje.getTime()) / 86400000);
    const fmt = (v: number) => v.toFixed(2).replace('.', ',');
    const valor = Number(valorLiquido);

    if (status === 'A_VENCER' || status === 'PENDENTE') {
      let tipo: TipoNotificacaoCobranca;
      if (diff > 5) tipo = TipoNotificacaoCobranca.AVENCER_MAIS5;
      else if (diff >= 2) tipo = TipoNotificacaoCobranca.AVENCER_2A4;
      else if (diff === 1) tipo = TipoNotificacaoCobranca.AVENCER_AMANHA;
      else tipo = TipoNotificacaoCobranca.VENCE_HOJE;

      return this.configNotificacao.getTexto(cooperativaId, tipo, {
        dias: Math.abs(diff),
        valor: fmt(valor),
      });
    }

    // VENCIDO
    const diasAtraso = Math.abs(diff);
    const diasEfetivos = Math.max(0, diasAtraso - diasCarencia);

    if (diasEfetivos === 0) {
      return this.configNotificacao.getTexto(
        cooperativaId,
        TipoNotificacaoCobranca.VENCIDA_CARENCIA,
        { dias: diasAtraso, valor: fmt(valor) },
      );
    }

    const vAtualizado = valorAtualizado ? Number(valorAtualizado) : valor;
    const multa = valorMulta ? Number(valorMulta) : 0;
    const juros = valorJuros ? Number(valorJuros) : 0;

    return this.configNotificacao.getTexto(
      cooperativaId,
      TipoNotificacaoCobranca.VENCIDA_MULTA,
      {
        dias: diasAtraso,
        valor: fmt(valor),
        valorAtualizado: fmt(vAtualizado),
        multa: fmt(multa),
        juros: fmt(juros),
      },
    );
  }

  /**
   * Busca cooperado e cobranças A_VENCER/VENCIDO pelo telefone.
   * Usado pelo menu de fatura no bot.
   */
  async buscarCobrancasPorTelefone(telefone: string): Promise<{ cooperado: any | null; cobrancas: any[] }> {
    const telefoneNorm = this.formatarTelefone(telefone);
    const telefoneSemPais = telefoneNorm.replace(/^55/, '');
    const cooperado = await this.prisma.cooperado.findFirst({
      where: {
        OR: [
          { telefone: telefoneNorm },
          { telefone: telefoneSemPais },
          { telefone: `55${telefoneSemPais}` },
        ],
        status: { in: ['ATIVO', 'AGUARDANDO_CONCESSIONARIA', 'AGUARDANDO_DOCUMENTOS'] as any[] },
      },
      select: { id: true, nomeCompleto: true, telefone: true, cooperativaId: true },
    });
    if (!cooperado) return { cooperado: null, cobrancas: [] };
    const cobrancas = await this.prisma.cobranca.findMany({
      where: {
        contrato: { cooperadoId: cooperado.id },
        status: { in: ['A_VENCER', 'PENDENTE', 'VENCIDO'] as any[] },
      },
      include: {
        asaasCobrancas: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { id: true, pixCopiaECola: true, linkPagamento: true, boletoUrl: true, linhaDigitavel: true, status: true },
        },
      },
      orderBy: { dataVencimento: 'asc' },
    });
    return { cooperado, cobrancas };
  }

  /**
   * Alerta preventivo: cobranças com vencimento em 3 dias, status PENDENTE ou A_VENCER.
   * Cron: todo dia às 9h30 (America/Sao_Paulo)
   */
  @Cron('30 9 * * *', { timeZone: 'America/Sao_Paulo' })
  async cronAlertarVencimentoProximo() {
    this.logger.log('Cron: alertando cobranças com vencimento em 3 dias...');
    await this.alertarVencimentoProximo();
  }

  async alertarVencimentoProximo() {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const em3Dias = new Date(hoje);
    em3Dias.setDate(em3Dias.getDate() + 3);
    const em3DiasFim = new Date(em3Dias);
    em3DiasFim.setHours(23, 59, 59, 999);

    const cobrancas = await this.prisma.cobranca.findMany({
      where: {
        status: { in: ['PENDENTE', 'A_VENCER'] },
        dataVencimento: { gte: em3Dias, lte: em3DiasFim },
        notificadoVencimento: false,
      },
      include: {
        contrato: {
          include: { cooperado: true },
        },
      },
    });

    this.logger.log(`Encontradas ${cobrancas.length} cobranças vencendo em 3 dias`);

    let enviados = 0;
    const fmt = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    for (const cobranca of cobrancas) {
      const cooperado = cobranca.contrato?.cooperado;
      if (!cooperado?.telefone) continue;

      const dataVenc = new Date(cobranca.dataVencimento);
      const dataFmt = `${String(dataVenc.getDate()).padStart(2, '0')}/${String(dataVenc.getMonth() + 1).padStart(2, '0')}`;

      const texto =
        `📅 Lembrete: sua fatura CoopereBR de R$ ${fmt(Number(cobranca.valorLiquido))} vence em 3 dias (${dataFmt}).\n` +
        `Para pagar, acesse o portal ou aguarde o link PIX.\n` +
        `Qualquer dúvida, responda aqui! 💚`;

      try {
        await this.sender.enviarMensagem(cooperado.telefone, texto);
        await this.prisma.cobranca.update({
          where: { id: cobranca.id },
          data: { notificadoVencimento: true },
        });
        enviados++;
        await this.delayAleatorio();
      } catch (err) {
        this.logger.warn(`Erro ao alertar vencimento cobrança ${cobranca.id}: ${err.message}`);
      }
    }

    this.logger.log(`Alertas de vencimento enviados: ${enviados}/${cobrancas.length}`);
    return { enviados, total: cobrancas.length };
  }

  private formatarTelefone(telefone: string): string {
    let digits = telefone.replace(/\D/g, '');
    if (!digits.startsWith('55')) digits = '55' + digits;
    // Garantir 9º dígito
    if (digits.length === 12 && digits[4] !== '9') {
      digits = digits.slice(0, 4) + '9' + digits.slice(4);
    }
    return digits;
  }

  private delayAleatorio(): Promise<void> {
    const ms = 3000 + Math.random() * 5000; // entre 3s e 8s
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
