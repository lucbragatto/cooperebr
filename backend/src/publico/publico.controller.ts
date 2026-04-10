import { Controller, Post, Get, Body, Param, BadRequestException, Logger } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../auth/public.decorator';
import { PrismaService } from '../prisma.service';
import { WhatsappSenderService } from '../whatsapp/whatsapp-sender.service';
import { CooperTokenService } from '../cooper-token/cooper-token.service';

@Controller('publico')
export class PublicoController {
  private readonly logger = new Logger(PublicoController.name);

  constructor(
    private prisma: PrismaService,
    private sender: WhatsappSenderService,
    private cooperToken: CooperTokenService,
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
  @Post('cadastro-web')
  async cadastroWeb(
    @Body()
    body: {
      nome: string;
      cpf: string;
      email: string;
      telefone: string;
      dataNascimento: string;
      endereco: {
        cep: string;
        logradouro: string;
        numero: string;
        complemento?: string;
        bairro: string;
        cidade: string;
        estado: string;
      };
      instalacao: {
        numeroUC: string;
        distribuidora: string;
        consumoMedioKwh: number;
      };
      codigoRef?: string;
    },
  ) {
    if (!body.nome || !body.cpf || !body.email || !body.telefone) {
      throw new BadRequestException('Nome, CPF, email e telefone são obrigatórios');
    }

    const cpfLimpo = body.cpf.replace(/\D/g, '');
    if (cpfLimpo.length !== 11) {
      throw new BadRequestException('CPF inválido');
    }

    const telefoneLimpo = body.telefone.replace(/\D/g, '');
    if (telefoneLimpo.length < 10 || telefoneLimpo.length > 13) {
      throw new BadRequestException('Telefone inválido');
    }

    try {
      const dadosLead: Record<string, unknown> = {
        dataNascimento: body.dataNascimento,
        endereco: body.endereco,
        instalacao: body.instalacao,
      };

      if (body.codigoRef) {
        dadosLead.codigoRef = body.codigoRef;
      }

      const lead = await this.prisma.leadWhatsapp.upsert({
        where: { telefone: telefoneLimpo },
        update: {
          nome: body.nome,
          email: body.email,
          cpf: cpfLimpo,
          fonte: 'cadastro-web',
          dados: dadosLead as any,
        },
        create: {
          telefone: telefoneLimpo,
          nome: body.nome,
          email: body.email,
          cpf: cpfLimpo,
          fonte: 'cadastro-web',
          dados: dadosLead as any,
        },
      });

      this.logger.log(`Lead cadastro-web criado: ${lead.id} (${body.nome})`);

      // Processar indicação se veio com código de convite
      if (body.codigoRef) {
        this.processarIndicacao(body.codigoRef, body.nome, lead.id).catch((err) => {
          this.logger.error(`Erro ao processar indicação ref=${body.codigoRef}: ${err.message}`);
        });
      }

      return { ok: true, data: { id: lead.id } };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro desconhecido';
      this.logger.error(`Erro ao salvar cadastro-web: ${message}`);
      throw new BadRequestException('Erro ao processar cadastro. Tente novamente.');
    }
  }

  private async processarIndicacao(codigoRef: string, nomeNovo: string, leadId: string) {
    const indicador = await this.prisma.cooperado.findUnique({
      where: { codigoIndicacao: codigoRef },
      select: { id: true, nomeCompleto: true, telefone: true, cooperativaId: true },
    });

    if (!indicador || !indicador.cooperativaId) {
      this.logger.warn(`Código de convite não encontrado ou sem cooperativa: ${codigoRef}`);
      return;
    }

    // Creditar 50 tokens BONUS_INDICACAO ao indicador
    try {
      await this.cooperToken.creditar({
        cooperadoId: indicador.id,
        cooperativaId: indicador.cooperativaId,
        tipo: 'BONUS_INDICACAO' as any,
        quantidade: 50,
        referenciaId: leadId,
        referenciaTabela: 'LeadWhatsapp',
      });
      this.logger.log(`50 tokens BONUS_INDICACAO creditados ao indicador ${indicador.id}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro desconhecido';
      this.logger.error(`Erro ao creditar tokens ao indicador: ${message}`);
    }

    // Notificar indicador via WhatsApp
    if (indicador.telefone) {
      const telefoneIndicador = indicador.telefone.replace(/\D/g, '');
      const msgNotificacao =
        `Boa notícia! ${nomeNovo} acabou de iniciar o cadastro usando seu convite CoopereBR! 🎉 ` +
        `Quando ele for aprovado, você receberá seus tokens de indicação.`;

      try {
        await this.sender.enviarMensagem(telefoneIndicador, msgNotificacao);
      } catch {
        // Log but don't fail
      }
    }
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
