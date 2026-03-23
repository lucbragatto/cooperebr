import { Controller, Post, Body, Get, Logger } from '@nestjs/common';
import { WhatsappFaturaService } from './whatsapp-fatura.service';
import { WhatsappBotService } from './whatsapp-bot.service';
import { WhatsappSenderService } from './whatsapp-sender.service';
import { Roles } from '../auth/roles.decorator';
import { Public } from '../auth/public.decorator';
import { PerfilUsuario } from '../auth/perfil.enum';
import { PrismaService } from '../prisma.service';

const { SUPER_ADMIN, ADMIN, OPERADOR } = PerfilUsuario;

@Controller('whatsapp')
export class WhatsappFaturaController {
  private readonly logger = new Logger(WhatsappFaturaController.name);

  constructor(
    private readonly service: WhatsappFaturaService,
    private readonly bot: WhatsappBotService,
    private readonly sender: WhatsappSenderService,
    private readonly prisma: PrismaService,
  ) {}

  @Roles(ADMIN, OPERADOR)
  @Post('processar-fatura')
  processarFatura(
    @Body() body: { arquivoBase64: string; tipoArquivo: 'pdf' | 'imagem'; telefone: string },
  ) {
    return this.service.processarFatura(body);
  }

  // Webhook para mensagens recebidas do Baileys
  @Public()
  @Post('webhook-incoming')
  async webhookIncoming(
    @Body() body: {
      telefone: string;
      tipo: 'texto' | 'imagem' | 'documento';
      corpo?: string;
      mediaBase64?: string;
      mimeType?: string;
    },
  ) {
    this.logger.log(`Mensagem recebida de ${body.telefone} (${body.tipo})`);
    // Processar de forma assíncrona para responder rápido ao Baileys
    this.bot.processarMensagem(body).catch((err) => {
      this.logger.error(`Erro ao processar mensagem: ${err.message}`);
    });
    return { ok: true };
  }

  // Status da conexão Baileys
  @Roles(SUPER_ADMIN, ADMIN)
  @Get('status')
  async getStatus() {
    return this.sender.getStatus();
  }

  // Conversas ativas
  @Roles(SUPER_ADMIN, ADMIN)
  @Get('conversas')
  async getConversas() {
    return this.prisma.conversaWhatsapp.findMany({
      orderBy: { updatedAt: 'desc' },
      take: 50,
    });
  }
}
