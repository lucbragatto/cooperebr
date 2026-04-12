/// <reference types="multer" />
import { Controller, Post, Get, Body, Param, BadRequestException, Logger, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../auth/public.decorator';
import { PrismaService } from '../prisma.service';
import { WhatsappSenderService } from '../whatsapp/whatsapp-sender.service';
import { CooperTokenService } from '../cooper-token/cooper-token.service';
import { FaturasService } from '../faturas/faturas.service';

@Controller('publico')
export class PublicoController {
  private readonly logger = new Logger(PublicoController.name);

  constructor(
    private prisma: PrismaService,
    private sender: WhatsappSenderService,
    private cooperToken: CooperTokenService,
    private faturasService: FaturasService,
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
      planoSelecionado?: string;
      aceitaClube?: boolean;
      pendenciaDocumentos?: boolean;
      faturaBase64?: string;
      faturaNome?: string;
      faturaTipo?: string;
      valorUltimaFatura?: number;
      temCreditosInjetados?: boolean;
      dadosOcr?: {
        energiaFornecidaKwh?: number;
        energiaInjetadaKwh?: number;
        saldoCreditosKwh?: number;
        valorCompensadoReais?: number;
        valorTotalFatura?: number;
      };
    },
  ) {
    // Em fase de testes: campos opcionais. Em produção: descomentar as validações abaixo.
    // if (!body.nome || !body.cpf || !body.email || !body.telefone) {
    //   throw new BadRequestException('Nome, CPF, email e telefone são obrigatórios');
    // }

    const cpfLimpo = (body.cpf || '').replace(/\D/g, '');
    // if (cpfLimpo.length !== 11) { throw new BadRequestException('CPF inválido'); }

    const telefoneLimpo = (body.telefone || '').replace(/\D/g, '');
    // if (telefoneLimpo.length < 10) { throw new BadRequestException('Telefone inválido'); }

    try {
      const dadosLead: Record<string, unknown> = {
        endereco: body.endereco,
        instalacao: body.instalacao,
      };

      if (body.codigoRef) {
        dadosLead.codigoRef = body.codigoRef;
      }

      if (body.valorUltimaFatura) {
        dadosLead.valorUltimaFatura = body.valorUltimaFatura;
      }

      if (body.faturaBase64) {
        dadosLead.faturaArquivo = {
          base64: body.faturaBase64,
          nome: body.faturaNome ?? 'fatura',
          tipo: body.faturaTipo ?? 'application/octet-stream',
        };
      }

      // Flag de créditos injetados
      if (body.temCreditosInjetados) {
        dadosLead.temCreditosInjetados = true;
        dadosLead.motivoContato = 'Fatura com créditos de energia injetada detectados';
      }

      // Dados de créditos extraídos do OCR da fatura (histórico GD)
      if (body.dadosOcr) {
        const ocr = body.dadosOcr;
        dadosLead.creditosFatura = {
          ...(ocr.energiaFornecidaKwh != null && { energiaFornecidaKwh: ocr.energiaFornecidaKwh }),
          ...(ocr.energiaInjetadaKwh != null && { energiaInjetadaKwh: ocr.energiaInjetadaKwh }),
          ...(ocr.saldoCreditosKwh != null && { saldoCreditosKwh: ocr.saldoCreditosKwh }),
          ...(ocr.valorCompensadoReais != null && { valorCompensadoReais: ocr.valorCompensadoReais }),
          ...(ocr.valorTotalFatura != null && { valorTotalFatura: ocr.valorTotalFatura }),
        };
      }

      const lead = await this.prisma.leadWhatsapp.upsert({
        where: { telefone: telefoneLimpo },
        update: {
          nome: body.nome,
          email: body.email,
          cpf: cpfLimpo,
          fonte: 'cadastro-web',
          dados: dadosLead as any,
          planoSelecionado: body.planoSelecionado ?? null,
          aceitaClube: body.aceitaClube ?? false,
          pendenciaDocumentos: body.pendenciaDocumentos ?? false,
        },
        create: {
          telefone: telefoneLimpo,
          nome: body.nome,
          email: body.email,
          cpf: cpfLimpo,
          fonte: 'cadastro-web',
          dados: dadosLead as any,
          planoSelecionado: body.planoSelecionado ?? null,
          aceitaClube: body.aceitaClube ?? false,
          pendenciaDocumentos: body.pendenciaDocumentos ?? false,
        },
      });

      this.logger.log(`Lead cadastro-web criado: ${lead.id} (${body.nome})`);

      // Notificar admin se lead tem créditos injetados
      if (body.temCreditosInjetados) {
        this.notificarAdminCreditosInjetados(body.nome, body.instalacao?.numeroUC, lead.id).catch((err) => {
          this.logger.error(`Erro ao notificar admin sobre créditos injetados: ${err.message}`);
        });
      }

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

    // BUG-11-003: NÃO creditar tokens no momento do cadastro do lead.
    // Tokens BONUS_INDICACAO são creditados apenas quando o cooperado indicado
    // tem sua primeira fatura paga (via indicacoes.service.ts → processarPrimeiraFaturaPaga).
    this.logger.log(
      `BONUS_INDICACAO para indicador ${indicador.id} será creditado após aprovação/primeira fatura do lead ${leadId}`,
    );

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

  private async notificarAdminCreditosInjetados(nome: string, numeroUC: string | undefined, leadId: string) {
    const adminPhone = process.env.ADMIN_WHATSAPP_NUMBER ?? '5527981341348';
    const msg =
      `🔔 Novo lead com créditos injetados!\n` +
      `Nome: ${nome}\n` +
      `UC: ${numeroUC || 'não informada'}\n` +
      `Lead ID: ${leadId}\n` +
      `A UC já possui energia solar/GD. Entrar em contato para proposta personalizada.`;

    try {
      await this.sender.enviarMensagem(adminPhone, msg);
      this.logger.log(`Notificação de créditos injetados enviada ao admin para lead ${leadId}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro desconhecido';
      this.logger.error(`Falha ao enviar notificação admin créditos injetados: ${message}`);
    }
  }

  @Public()
  @Throttle({ default: { limit: 30, ttl: 60000 } }) // 30 por minuto para processamento em lote
  @Post('processar-fatura-ocr')
  @UseInterceptors(FileInterceptor('fatura'))
  async processarFaturaOcr(
    @UploadedFile() arquivo: Express.Multer.File,
    @Body() body?: { faturaBase64?: string; faturaTipo?: string; faturaNome?: string }
  ): Promise<{
    sucesso: boolean;
    mensagem?: string;
    dados: Record<string, unknown>;
  }> {
    // Aceitar base64 via JSON quando não vier arquivo multipart
    if (!arquivo && body?.faturaBase64) {
      const base64 = body.faturaBase64;
      const tipo = body.faturaTipo || 'application/pdf';
      const isPdf = tipo === 'application/pdf';
      const isImage = tipo.startsWith('image/');
      if (!isPdf && !isImage) throw new BadRequestException('Formato não suportado.');
      try {
        const tipoArquivo = isPdf ? 'pdf' as const : 'imagem' as const;
        const dadosExtraidos = await this.faturasService.extrairOcr(base64, tipoArquivo);
        const consumoMedio = dadosExtraidos.historicoConsumo?.length > 0
          ? Math.round(dadosExtraidos.historicoConsumo.reduce((s: number, h: any) => s + h.consumoKwh, 0) / dadosExtraidos.historicoConsumo.length)
          : dadosExtraidos.consumoAtualKwh || 0;
        const temCreditosInjetados = !!(dadosExtraidos as any).energiaInjetadaKwh && (dadosExtraidos as any).energiaInjetadaKwh > 0;
        return { sucesso: true, dados: { ...dadosExtraidos, consumoMedio, temCreditosInjetados } };
      } catch(e: any) {
        return { sucesso: false, mensagem: 'OCR não disponivel ou falhou: ' + (e.message || ''), dados: {} };
      }
    }
    if (!arquivo) {
      throw new BadRequestException('Arquivo da fatura é obrigatório');
    }

    const maxSize = 10 * 1024 * 1024; // 10MB
    if (arquivo.size > maxSize) {
      throw new BadRequestException('Arquivo excede o limite de 10MB');
    }

    const isPdf = arquivo.mimetype === 'application/pdf';
    const isImage = arquivo.mimetype.startsWith('image/');

    if (!isPdf && !isImage) {
      throw new BadRequestException('Formato não suportado. Envie PDF ou imagem.');
    }

    try {
      const arquivoBase64 = arquivo.buffer.toString('base64');
      const tipoArquivo = isPdf ? 'pdf' as const : 'imagem' as const;
      const dadosExtraidos = await this.faturasService.extrairOcr(arquivoBase64, tipoArquivo);

      const consumoMedio = dadosExtraidos.historicoConsumo?.length > 0
        ? Math.round(dadosExtraidos.historicoConsumo.reduce((s, h) => s + h.consumoKwh, 0) / dadosExtraidos.historicoConsumo.length)
        : dadosExtraidos.consumoAtualKwh || 0;

      const temCreditosInjetados = !!(
        dadosExtraidos.temCreditosInjetados ||
        (dadosExtraidos.energiaInjetadaKwh && dadosExtraidos.energiaInjetadaKwh > 0) ||
        (dadosExtraidos.creditosRecebidosKwh && dadosExtraidos.creditosRecebidosKwh > 0) ||
        dadosExtraidos.possuiCompensacao
      );

      return {
        sucesso: true,
        dados: {
          nome: dadosExtraidos.titular || '',
          cpf: dadosExtraidos.documento || '',
          numeroUC: dadosExtraidos.numeroUC || '',
          distribuidora: dadosExtraidos.distribuidora || '',
          consumoMedioKwh: consumoMedio,
          totalAPagar: dadosExtraidos.totalAPagar || 0,
          endereco: dadosExtraidos.enderecoInstalacao || '',
          bairro: dadosExtraidos.bairro || '',
          cidade: dadosExtraidos.cidade || '',
          estado: dadosExtraidos.estado || '',
          cep: dadosExtraidos.cep || '',
          historicoConsumo: dadosExtraidos.historicoConsumo || [],
          temCreditosInjetados,
          energiaInjetadaKwh: dadosExtraidos.energiaInjetadaKwh || 0,
          energiaFornecidaKwh: dadosExtraidos.energiaFornecidaKwh || 0,
          saldoCreditosKwh: dadosExtraidos.saldoTotalKwh || 0,
          valorCompensadoReais: dadosExtraidos.valorCompensadoReais || 0,
        },
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro desconhecido';
      this.logger.warn(`OCR fatura pública falhou: ${message}`);
      return {
        sucesso: false,
        mensagem: 'Leitura automática não disponível. Preencha manualmente.',
        dados: {},
      };
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
