import { Controller, Post, Get, Body, Param, BadRequestException, Logger } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../auth/public.decorator';
import { PrismaService } from '../prisma.service';
import { WhatsappSenderService } from '../whatsapp/whatsapp-sender.service';

@Controller('publico')
export class PublicoController {
  private readonly logger = new Logger(PublicoController.name);

  constructor(
    private prisma: PrismaService,
    private sender: WhatsappSenderService,
  ) {}

  @Public()
  @Post('iniciar-cadastro')
  async iniciarCadastro(
    @Body() body: { nome: string; telefone: string; codigoRef?: string },
  ) {
    const { nome, codigoRef } = body;
    let { telefone } = body;

    if (!nome || !telefone) {
      throw new BadRequestException('Nome e telefone são obrigatórios');
    }

    // Formatar telefone: remover não-numéricos, adicionar 55 e dígito 9
    telefone = telefone.replace(/\D/g, '');
    if (!telefone.startsWith('55')) {
      telefone = '55' + telefone;
    }
    // Se DDD + número tem 10 dígitos (sem o 9), adicionar
    const semPais = telefone.slice(2);
    if (semPais.length === 10) {
      telefone = '55' + semPais.slice(0, 2) + '9' + semPais.slice(2);
    }

    // Verificar/criar conversa
    let conversa = await this.prisma.conversaWhatsapp.findUnique({
      where: { telefone },
    });

    const dadosTemp: Record<string, unknown> = { nomePublico: nome };
    if (codigoRef) {
      dadosTemp.codigoIndicacao = codigoRef;
    }

    if (conversa) {
      await this.prisma.conversaWhatsapp.update({
        where: { id: conversa.id },
        data: {
          estado: 'INICIAL',
          dadosTemp: {
            ...((conversa.dadosTemp as Record<string, unknown>) ?? {}),
            ...dadosTemp,
          } as any,
        },
      });
    } else {
      conversa = await this.prisma.conversaWhatsapp.create({
        data: {
          telefone,
          estado: 'INICIAL',
          dadosTemp: dadosTemp as any,
        },
      });
    }

    // Enviar mensagem de boas-vindas
    const mensagem =
      `Olá, ${nome}! 👋 Bem-vindo(a) à CoopereBR! ` +
      `Somos uma cooperativa de energia solar e você pode economizar até 20% na sua conta de luz sem investir nada. ` +
      `Para começar sua simulação, envie uma foto ou PDF da sua última conta de energia elétrica! 💡`;

    try {
      await this.sender.enviarMensagem(telefone, mensagem);
    } catch (err) {
      // Log but don't fail — the conversation was created
    }

    return { ok: true, mensagem: 'Mensagem enviada! Verifique seu WhatsApp.' };
  }

  @Public()
  @Get('convite/:codigo')
  async getConvite(@Param('codigo') codigo: string) {
    const cooperado = await this.prisma.cooperado.findUnique({
      where: { codigoIndicacao: codigo },
      select: { nomeCompleto: true },
    });

    if (!cooperado) {
      return { valido: false };
    }

    return { nomeIndicador: cooperado.nomeCompleto, valido: true };
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('salvar-lead')
  async salvarLead(
    @Body() body: { telefone: string; nome?: string; email?: string; fonte?: string },
  ) {
    if (!body.telefone) {
      throw new BadRequestException('Telefone é obrigatório');
    }

    const telefone = body.telefone.replace(/\D/g, '');
    if (telefone.length < 10 || telefone.length > 13) {
      throw new BadRequestException('Telefone inválido');
    }

    try {
      const lead = await this.prisma.leadWhatsapp.upsert({
        where: { telefone },
        update: {
          ...(body.nome ? { nome: body.nome } : {}),
          ...(body.email ? { email: body.email } : {}),
        },
        create: {
          telefone,
          nome: body.nome ?? null,
          email: body.email ?? null,
          fonte: body.fonte ?? 'site',
        },
      });
      return { ok: true, data: { id: lead.id, telefone: lead.telefone } };
    } catch (err) {
      this.logger.error(`Erro ao salvar lead: ${err.message}`);
      return { ok: false, error: 'Erro ao salvar lead' };
    }
  }
}
