import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma.service';
import { WhatsappSenderService } from './whatsapp-sender.service';
import { WhatsappBotService } from './whatsapp-bot.service';

@Injectable()
export class WhatsappMlmService {
  private readonly logger = new Logger(WhatsappMlmService.name);

  constructor(
    private prisma: PrismaService,
    private sender: WhatsappSenderService,
    private bot: WhatsappBotService,
  ) {}

  /**
   * Envia convites de indicação no dia 1 de cada mês às 10h.
   */
  @Cron('0 10 1 * *', { timeZone: 'America/Sao_Paulo' })
  async cronEnviarConvites() {
    // 🔴 DISPARO EM MASSA — requer aprovação explícita de Luciano
    if (process.env.WA_MLM_CONVITES_HABILITADO !== 'true') {
      this.logger.warn('WhatsappMlmService: disparo convites MLM bloqueado — WA_MLM_CONVITES_HABILITADO não está ativo.');
      return;
    }
    this.logger.log('Cron: disparando convites MLM via WhatsApp...');
    // Buscar todas as cooperativas com config de indicação ativa
    const configs = await this.prisma.configIndicacao.findMany({
      where: { ativo: true },
    });
    for (const config of configs) {
      await this.enviarConvitesIndicacao(config.cooperativaId);
    }
  }

  async enviarConvitesIndicacao(
    cooperativaId: string,
    opcoes?: { modo?: 'todos' | 'parceiro' | 'lista'; parceiroId?: string; telefones?: string[]; limiteEnvios?: number },
  ) {
    const modo = opcoes?.modo ?? 'todos';
    const targetCooperativaId = modo === 'parceiro' && opcoes?.parceiroId
      ? opcoes.parceiroId
      : cooperativaId;

    // Buscar config de indicação
    const config = await this.prisma.configIndicacao.findUnique({
      where: { cooperativaId: targetCooperativaId },
    });
    if (!config || !config.ativo) {
      this.logger.warn(`Config indicação não encontrada ou inativa para cooperativa ${targetCooperativaId}`);
      return { total: 0, enviados: 0, erros: 0 };
    }

    // Extrair percentual do nível 1
    const niveisConfig = config.niveisConfig as Array<{ nivel: number; percentual: number }>;
    const percentualNivel1 = niveisConfig?.find(n => n.nivel === 1)?.percentual ?? 5;

    // Buscar cooperados ativos com telefone
    const whereCooperado: any = {
      cooperativaId: targetCooperativaId,
      telefone: { not: null },
      contratos: {
        some: { status: 'ATIVO' },
      },
    };

    // Filtrar por telefones específicos
    if (modo === 'lista' && opcoes?.telefones?.length) {
      const telefonesNorm = opcoes.telefones.map((t) => this.formatarTelefone(t));
      whereCooperado.telefone = { in: telefonesNorm };
    }

    const cooperados = await this.prisma.cooperado.findMany({
      where: whereCooperado,
      select: {
        id: true,
        nomeCompleto: true,
        telefone: true,
        codigoIndicacao: true,
      },
    });

    this.logger.log(`Encontrados ${cooperados.length} cooperados ativos para convite MLM (cooperativa ${cooperativaId})`);

    const limite = opcoes?.limiteEnvios ?? 30;

    const inicioDoMes = new Date();
    inicioDoMes.setDate(1);
    inicioDoMes.setHours(0, 0, 0, 0);

    let enviados = 0;
    let erros = 0;

    for (const cooperado of cooperados) {
      if (enviados >= limite) break;
      if (!cooperado.telefone) continue;

      try {
        const telefone = this.formatarTelefone(cooperado.telefone);

        // Verificar se já enviou convite este mês
        const conversa = await this.prisma.conversaWhatsapp.findUnique({
          where: { telefone },
        });
        if (conversa?.mlmConviteEnviadoEm && conversa.mlmConviteEnviadoEm >= inicioDoMes) {
          this.logger.log(`Convite MLM já enviado este mês para ${cooperado.nomeCompleto} — pulando`);
          continue;
        }

        const nome = cooperado.nomeCompleto.split(' ')[0];
        const baseUrl = process.env.FRONTEND_URL ?? 'https://cooperebr.com.br';
        const link = `${baseUrl}/entrar?ref=${cooperado.codigoIndicacao}`;

        let mensagem = `🎁 *Programa de Recompensas CoopereBR*\n\n`;
        mensagem += `Olá, ${nome}! 🌱\n\n`;
        mensagem += `Você sabia que pode *ganhar desconto na sua fatura* indicando amigos?\n\n`;
        mensagem += `✅ Seu amigo economiza na conta de luz\n`;
        mensagem += `✅ Você ganha ${percentualNivel1}% de desconto na sua fatura\n`;
        mensagem += `✅ Quanto mais indicar, mais desconto!\n\n`;
        mensagem += `📲 *Seu link personalizado:*\n${link}\n\n`;
        mensagem += `Encaminhe para seus contatos agora e comece a economizar ainda mais! 💚`;

        await this.sender.enviarMensagem(telefone, mensagem, { tipoDisparo: 'MLM', cooperadoId: cooperado.id, cooperativaId });

        // Registrar envio
        await this.prisma.conversaWhatsapp.upsert({
          where: { telefone },
          update: { mlmConviteEnviadoEm: new Date() },
          create: { telefone, estado: 'INICIAL', mlmConviteEnviadoEm: new Date() },
        });

        enviados++;
        this.logger.log(`Convite MLM enviado para ${cooperado.nomeCompleto} (${telefone})`);

        // Pausa aleatória entre mensagens para evitar bloqueio
        await this.delayAleatorio();
      } catch (err) {
        erros++;
        this.logger.error(`Erro ao enviar convite MLM para ${cooperado.nomeCompleto}: ${err.message}`);
      }
    }

    // Modo lista: enviar mensagem genérica para telefones avulsos (não encontrados como cooperados ativos)
    let qtdAvulsos = 0;
    if (modo === 'lista' && opcoes?.telefones?.length) {
      const telefonesEncontrados = new Set(cooperados.map((c) => this.formatarTelefone(c.telefone!)));
      const telefonesAvulsos = opcoes.telefones
        .map((t) => this.formatarTelefone(t))
        .filter((t) => !telefonesEncontrados.has(t));
      qtdAvulsos = telefonesAvulsos.length;

      for (const telefone of telefonesAvulsos) {
        if (enviados >= limite) break;
        try {
          const msgAvulso =
            'Olá! 👋 A *CoopereBR* é uma cooperativa de energia solar que gera *economia real na sua conta de luz* — sem investimento, sem obras e sem fidelidade.\n\n' +
            '☀️ Como funciona: você recebe créditos de energia solar direto na sua fatura da distribuidora, pagando menos todo mês.\n\n' +
            '📸 Quer descobrir quanto pode economizar? Envie uma *foto da sua última conta de energia* e faço uma simulação gratuita na hora! 💡';
          await this.sender.enviarMensagem(telefone, msgAvulso, { tipoDisparo: 'MLM', cooperativaId });
          enviados++;
          this.logger.log(`Convite avulso enviado para ${telefone}`);
          await this.delayAleatorio();
        } catch (err) {
          erros++;
          this.logger.error(`Erro ao enviar convite avulso para ${telefone}: ${err.message}`);
        }
      }
    }

    const totalGeral = cooperados.length + qtdAvulsos;
    const limitado = totalGeral > limite && enviados >= limite;
    const resultado = {
      total: totalGeral,
      enviados,
      erros,
      cooperativaId,
      limitado,
      ...(limitado ? { totalNaoEnviados: totalGeral - enviados } : {}),
    };
    this.logger.log(`Resultado envio convites MLM: ${JSON.stringify(resultado)}`);
    return resultado;
  }

  /**
   * Processa entrada de indicado via link MLM (chamado quando alguém clica no link de indicação).
   */
  async processarEntradaIndicado(telefone: string, codigoRef: string) {
    const telefoneNorm = this.formatarTelefone(telefone);

    // Buscar indicador para nome e cooperativaId
    const indicador = await this.prisma.cooperado.findUnique({
      where: { codigoIndicacao: codigoRef },
      select: { nomeCompleto: true, cooperativaId: true },
    });

    const indicadorNome = indicador?.nomeCompleto?.split(' ')[0] ?? 'um amigo';

    // Usar o fluxo de convite melhorado com botões interativos
    await this.bot.iniciarFluxoConviteIndicacao(telefoneNorm, indicadorNome, codigoRef);

    return { ok: true, telefone: telefoneNorm };
  }

  private formatarTelefone(telefone: string): string {
    let digits = telefone.replace(/\D/g, '');
    if (!digits.startsWith('55')) digits = '55' + digits;
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
