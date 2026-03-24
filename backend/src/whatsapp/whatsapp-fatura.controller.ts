import { Controller, Post, Body, Get, Logger, Req } from '@nestjs/common';
import { WhatsappFaturaService } from './whatsapp-fatura.service';
import { WhatsappBotService } from './whatsapp-bot.service';
import { WhatsappCobrancaService } from './whatsapp-cobranca.service';
import { WhatsappMlmService } from './whatsapp-mlm.service';
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
    private readonly cobrancaService: WhatsappCobrancaService,
    private readonly mlmService: WhatsappMlmService,
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

  // ─── Fluxo 2: Cobrança mensal via WhatsApp ──────────────────────────────

  @Roles(SUPER_ADMIN, ADMIN)
  @Post('disparar-cobrancas')
  async dispararCobrancas(
    @Req() req: any,
    @Body() body: {
      mesReferencia?: string;
      modo?: 'todos' | 'parceiro' | 'lista';
      parceiroId?: string;
      telefones?: string[];
    },
  ) {
    const cooperativaId = req.user?.cooperativaId;
    return this.cobrancaService.enviarCobrancasDoMes(cooperativaId, body.mesReferencia, {
      modo: body.modo,
      parceiroId: body.parceiroId,
      telefones: body.telefones,
    });
  }

  // ─── Fluxo 3: MLM viral via WhatsApp ─────────────────────────────────────

  @Roles(SUPER_ADMIN, ADMIN)
  @Post('disparar-convites-indicacao')
  async dispararConvitesIndicacao(
    @Req() req: any,
    @Body() body: {
      modo?: 'todos' | 'parceiro' | 'lista';
      parceiroId?: string;
      telefones?: string[];
    },
  ) {
    const cooperativaId = req.user?.cooperativaId;
    if (!cooperativaId) {
      return { error: 'Cooperativa não identificada' };
    }
    return this.mlmService.enviarConvitesIndicacao(cooperativaId, {
      modo: body.modo,
      parceiroId: body.parceiroId,
      telefones: body.telefones,
    });
  }

  // Endpoint para processar entrada de indicado (chamado pela landing page)
  @Public()
  @Post('entrada-indicado')
  async entradaIndicado(
    @Body() body: { telefone: string; codigoRef: string },
  ) {
    return this.mlmService.processarEntradaIndicado(body.telefone, body.codigoRef);
  }
}
