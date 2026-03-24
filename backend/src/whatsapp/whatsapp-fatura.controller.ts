import { Controller, Post, Body, Get, Put, Delete, Logger, Req, Query, Param } from '@nestjs/common';
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

  // ─── Histórico de mensagens ────────────────────────────────────────────────

  @Roles(SUPER_ADMIN, ADMIN)
  @Get('historico')
  async getHistorico(
    @Query('telefone') telefone?: string,
    @Query('direcao') direcao?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const take = Math.min(Number(limit) || 50, 200);
    const skip = Number(offset) || 0;

    const where: any = {};
    if (telefone) where.telefone = { contains: telefone.replace(/\D/g, '') };
    if (direcao && ['ENTRADA', 'SAIDA'].includes(direcao)) where.direcao = direcao;

    const [mensagens, total] = await Promise.all([
      this.prisma.mensagemWhatsapp.findMany({
        where,
        orderBy: { enviadaEm: 'desc' },
        take,
        skip,
      }),
      this.prisma.mensagemWhatsapp.count({ where }),
    ]);

    return { mensagens, total, limit: take, offset: skip };
  }

  @Roles(SUPER_ADMIN, ADMIN)
  @Get('historico/:telefone')
  async getHistoricoContato(@Param('telefone') telefone: string) {
    const telefoneNorm = telefone.replace(/\D/g, '');
    return this.prisma.mensagemWhatsapp.findMany({
      where: { telefone: { contains: telefoneNorm } },
      orderBy: { enviadaEm: 'asc' },
    });
  }

  // ─── Listas de contatos ────────────────────────────────────────────────────

  @Roles(SUPER_ADMIN, ADMIN)
  @Get('listas')
  async getListas(@Req() req: any) {
    const cooperativaId = req.user?.cooperativaId;
    const where: any = {};
    if (cooperativaId) where.cooperativaId = cooperativaId;
    return this.prisma.listaContatos.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  @Roles(SUPER_ADMIN, ADMIN)
  @Post('listas')
  async criarLista(
    @Req() req: any,
    @Body() body: { nome: string; descricao?: string; telefones?: string[]; cooperadoIds?: string[] },
  ) {
    const cooperativaId = req.user?.cooperativaId;
    return this.prisma.listaContatos.create({
      data: {
        nome: body.nome,
        descricao: body.descricao ?? null,
        cooperativaId: cooperativaId ?? null,
        telefones: body.telefones ?? [],
        cooperadoIds: body.cooperadoIds ?? [],
      },
    });
  }

  @Roles(SUPER_ADMIN, ADMIN)
  @Put('listas/:id')
  async atualizarLista(
    @Param('id') id: string,
    @Body() body: { nome?: string; descricao?: string; telefones?: string[]; cooperadoIds?: string[] },
  ) {
    const data: any = {};
    if (body.nome !== undefined) data.nome = body.nome;
    if (body.descricao !== undefined) data.descricao = body.descricao;
    if (body.telefones !== undefined) data.telefones = body.telefones;
    if (body.cooperadoIds !== undefined) data.cooperadoIds = body.cooperadoIds;
    return this.prisma.listaContatos.update({ where: { id }, data });
  }

  @Roles(SUPER_ADMIN, ADMIN)
  @Delete('listas/:id')
  async deletarLista(@Param('id') id: string) {
    return this.prisma.listaContatos.delete({ where: { id } });
  }

  @Roles(SUPER_ADMIN, ADMIN)
  @Post('listas/:id/usar')
  async usarLista(@Param('id') id: string) {
    const lista = await this.prisma.listaContatos.findUnique({ where: { id } });
    if (!lista) return { error: 'Lista não encontrada' };
    return { telefones: lista.telefones, nome: lista.nome };
  }

  // ─── Enviar mensagem manual ────────────────────────────────────────────────

  @Roles(SUPER_ADMIN, ADMIN)
  @Post('enviar-mensagem')
  async enviarMensagem(@Body() body: { telefone: string; texto: string }) {
    await this.sender.enviarMensagem(body.telefone, body.texto, { tipoDisparo: 'MANUAL' });
    return { ok: true };
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
