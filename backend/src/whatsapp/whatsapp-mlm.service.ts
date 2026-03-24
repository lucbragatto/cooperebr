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
    opcoes?: { modo?: 'todos' | 'parceiro' | 'lista'; parceiroId?: string; telefones?: string[] },
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

    const inicioDoMes = new Date();
    inicioDoMes.setDate(1);
    inicioDoMes.setHours(0, 0, 0, 0);

    let enviados = 0;
    let erros = 0;

    for (const cooperado of cooperados) {
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
        const link = `https://app.cooperebr.com.br/indicar?ref=${cooperado.codigoIndicacao}`;

        let mensagem = `🎁 *Programa de Recompensas CoopereBR*\n\n`;
        mensagem += `Olá, ${nome}! 🌱\n\n`;
        mensagem += `Você sabia que pode *ganhar desconto na sua fatura* indicando amigos?\n\n`;
        mensagem += `✅ Seu amigo economiza na conta de luz\n`;
        mensagem += `✅ Você ganha ${percentualNivel1}% de desconto na sua fatura\n`;
        mensagem += `✅ Quanto mais indicar, mais desconto!\n\n`;
        mensagem += `📲 *Seu link personalizado:*\n${link}\n\n`;
        mensagem += `Encaminhe para seus contatos agora e comece a economizar ainda mais! 💚`;

        await this.sender.enviarMensagem(telefone, mensagem);

        // Registrar envio
        await this.prisma.conversaWhatsapp.upsert({
          where: { telefone },
          update: { mlmConviteEnviadoEm: new Date() },
          create: { telefone, estado: 'INICIAL', mlmConviteEnviadoEm: new Date() },
        });

        enviados++;
        this.logger.log(`Convite MLM enviado para ${cooperado.nomeCompleto} (${telefone})`);

        // Pausa de 2s entre mensagens
        await this.delay(2000);
      } catch (err) {
        erros++;
        this.logger.error(`Erro ao enviar convite MLM para ${cooperado.nomeCompleto}: ${err.message}`);
      }
    }

    const resultado = { total: cooperados.length, enviados, erros, cooperativaId };
    this.logger.log(`Resultado envio convites MLM: ${JSON.stringify(resultado)}`);
    return resultado;
  }

  /**
   * Processa entrada de indicado via link MLM (chamado quando alguém clica no link de indicação).
   */
  async processarEntradaIndicado(telefone: string, codigoRef: string) {
    const telefoneNorm = this.formatarTelefone(telefone);

    // Buscar config para saber o percentual
    const indicador = await this.prisma.cooperado.findUnique({
      where: { codigoIndicacao: codigoRef },
      select: { cooperativaId: true },
    });

    let percentual = 15; // default
    if (indicador?.cooperativaId) {
      const config = await this.prisma.configIndicacao.findUnique({
        where: { cooperativaId: indicador.cooperativaId },
      });
      if (config) {
        const niveisConfig = config.niveisConfig as Array<{ nivel: number; percentual: number }>;
        percentual = niveisConfig?.find(n => n.nivel === 1)?.percentual ?? 15;
      }
    }

    // Salvar código de indicação na conversa para uso futuro no fluxo 1
    await this.prisma.conversaWhatsapp.upsert({
      where: { telefone: telefoneNorm },
      update: { dadosTemp: { codigoIndicacao: codigoRef } },
      create: {
        telefone: telefoneNorm,
        estado: 'INICIAL',
        dadosTemp: { codigoIndicacao: codigoRef },
      },
    });

    // Enviar mensagem de boas-vindas
    let mensagem = `👋 Olá! Você foi indicado por um amigo para conhecer a CoopereBR!\n\n`;
    mensagem += `🌱 Economize até ${percentual}% na sua conta de luz todos os meses.\n\n`;
    mensagem += `Para ver quanto você economizaria, *mande uma foto da sua última conta de energia!* 📸`;

    await this.sender.enviarMensagem(telefoneNorm, mensagem);

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

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
