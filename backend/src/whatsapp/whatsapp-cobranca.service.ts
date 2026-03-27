import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma.service';
import { AsaasService } from '../asaas/asaas.service';
import { WhatsappSenderService } from './whatsapp-sender.service';
import { WhatsappBotService } from './whatsapp-bot.service';

@Injectable()
export class WhatsappCobrancaService {
  private readonly logger = new Logger(WhatsappCobrancaService.name);

  constructor(
    private prisma: PrismaService,
    private asaasService: AsaasService,
    private sender: WhatsappSenderService,
    @Inject(forwardRef(() => WhatsappBotService)) private bot: WhatsappBotService,
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

    // Buscar cobranças PENDENTE do mês que ainda não foram enviadas por WhatsApp
    const where: any = {
      status: 'PENDENTE',
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
        let mensagem = `💚 *CoopereBR — Fatura ${mesStr}/${ano}*\n\n`;
        mensagem += `Olá, ${nome}! 👋\n\n`;
        mensagem += `Sua fatura deste mês está disponível:\n`;
        mensagem += `💰 Valor: R$ ${valor.toFixed(2).replace('.', ',')}\n`;
        mensagem += `📅 Vencimento: ${dataFormatada}\n`;

        if (pixCopiaECola) {
          mensagem += `\n*Pague via PIX — Copia e Cola:*\n${pixCopiaECola}\n`;
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
   * Cron: Abordagem proativa de cooperados inadimplentes.
   * Executa diariamente às 9h, busca cobranças vencidas há mais de 5 dias
   * que ainda não foram abordadas via fluxo de inadimplente.
   */
  @Cron('0 9 * * *', { timeZone: 'America/Sao_Paulo' })
  async cronAbordagemInadimplentes() {
    this.logger.log('Cron: verificando cooperados inadimplentes para abordagem...');
    await this.abordarInadimplentes();
  }

  async abordarInadimplentes(limiteEnvios = 20): Promise<{ total: number; enviados: number; erros: number }> {
    const cincoAtras = new Date();
    cincoAtras.setDate(cincoAtras.getDate() - 5);

    const cobrancas = await this.prisma.cobranca.findMany({
      where: {
        status: { in: ['VENCIDO', 'PENDENTE'] as any[] },
        dataVencimento: { lt: cincoAtras },
        // Não abordar quem já recebeu notificação de vencimento
        notificadoVencimento: false,
      },
      include: {
        contrato: {
          include: {
            cooperado: true,
          },
        },
        asaasCobrancas: true,
      },
      orderBy: { dataVencimento: 'asc' },
      take: limiteEnvios,
    });

    this.logger.log(`Encontradas ${cobrancas.length} cobranças vencidas há 5+ dias para abordagem`);

    let enviados = 0;
    let erros = 0;

    for (const cobranca of cobrancas) {
      const cooperado = (cobranca as any).contrato?.cooperado;
      if (!cooperado?.telefone) continue;

      try {
        const telefone = this.formatarTelefone(cooperado.telefone);
        const valor = Number(cobranca.valorLiquido ?? cobranca.valorBruto);
        const dataVencimento = new Date(cobranca.dataVencimento);

        // Buscar PIX
        let pixCopiaECola: string | undefined;
        let linkPagamento: string | undefined;
        const asaasCobranca = (cobranca as any).asaasCobrancas?.[0];
        if (asaasCobranca) {
          pixCopiaECola = asaasCobranca.pixCopiaECola || undefined;
          linkPagamento = asaasCobranca.linkPagamento || undefined;
        }

        await this.bot.iniciarFluxoInadimplente(
          telefone,
          cobranca.id,
          cooperado.nomeCompleto,
          valor,
          dataVencimento,
          pixCopiaECola,
          linkPagamento,
        );

        // Marcar como notificado
        await this.prisma.cobranca.update({
          where: { id: cobranca.id },
          data: { notificadoVencimento: true },
        });

        enviados++;
        this.logger.log(`Abordagem inadimplente enviada para ${cooperado.nomeCompleto} (${telefone})`);
        await this.delayAleatorio();
      } catch (err) {
        erros++;
        this.logger.error(`Erro na abordagem inadimplente cobrança ${cobranca.id}: ${err.message}`);
      }
    }

    const resultado = { total: cobrancas.length, enviados, erros };
    this.logger.log(`Resultado abordagem inadimplentes: ${JSON.stringify(resultado)}`);
    return resultado;
  }

  /**
   * Busca cooperado e suas cobranças A_VENCER/VENCIDO pelo telefone.
   * Usado pelo menu de fatura no bot.
   */
  async buscarCobrancasPorTelefone(telefone: string): Promise<{
    cooperado: any | null;
    cobrancas: any[];
  }> {
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
          select: {
            id: true,
            pixCopiaECola: true,
            linkPagamento: true,
            boletoUrl: true,
            status: true,
          },
        },
      },
      orderBy: { dataVencimento: 'asc' },
    });

    return { cooperado, cobrancas };
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
