import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class WhatsappSenderService {
  private readonly logger = new Logger(WhatsappSenderService.name);
  private readonly baseUrl = process.env.WHATSAPP_SERVICE_URL || 'http://localhost:3002';

  constructor(private prisma: PrismaService) {}

  async getStatus(): Promise<{ status: string; qrCode?: string }> {
    const res = await fetch(`${this.baseUrl}/status`);
    return res.json();
  }

  async enviarMensagem(
    telefone: string,
    texto: string,
    opcoes?: { tipoDisparo?: string; disparoId?: string; cooperadoId?: string; cooperativaId?: string },
  ): Promise<void> {
    const res = await fetch(`${this.baseUrl}/send-message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: telefone, text: texto }),
    });
    if (!res.ok) {
      const err = await res.json();
      // Registrar mensagem com status FALHOU
      await this.registrarMensagem(telefone, texto, 'FALHOU', opcoes);
      throw new Error(`Erro ao enviar mensagem WhatsApp: ${err.error}`);
    }
    this.logger.log(`Mensagem enviada para ${telefone}`);

    // Registrar mensagem enviada
    await this.registrarMensagem(telefone, texto, 'ENVIADA', opcoes);
  }

  async enviarListaMensagem(
    telefone: string,
    texto: string,
    buttonText: string,
    sections: Array<{ title: string; rows: Array<{ title: string; rowId: string; description?: string }> }>,
    opcoes?: { tipoDisparo?: string; cooperadoId?: string; cooperativaId?: string },
  ): Promise<void> {
    const res = await fetch(`${this.baseUrl}/send-list`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: telefone,
        text: texto,
        footer: 'CoopereBR',
        buttonText,
        sections,
      }),
    });
    if (!res.ok) {
      const err = await res.json();
      await this.registrarMensagem(telefone, texto, 'FALHOU', opcoes);
      throw new Error(`Erro ao enviar lista WhatsApp: ${err.error}`);
    }
    this.logger.log(`Lista interativa enviada para ${telefone}`);
    await this.registrarMensagem(telefone, texto, 'ENVIADA', opcoes);
  }

  async enviarMenuComBotoes(
    telefone: string,
    texto: string,
    botoes: Array<{ id: string; texto: string }>,
    rodape?: string,
    opcoes?: { tipoDisparo?: string; cooperadoId?: string; cooperativaId?: string },
  ): Promise<void> {
    const res = await fetch(`${this.baseUrl}/send-buttons`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: telefone,
        text: texto,
        footer: rodape || 'CoopereBR',
        buttons: botoes,
      }),
    });
    if (!res.ok) {
      const err = await res.json();
      await this.registrarMensagem(telefone, texto, 'FALHOU', opcoes);
      throw new Error(`Erro ao enviar menu com botões WhatsApp: ${err.error}`);
    }
    this.logger.log(`Menu com botões enviado para ${telefone}`);
    await this.registrarMensagem(telefone, texto, 'ENVIADA', opcoes);
  }

  async enviarPdfWhatsApp(
    telefone: string,
    pdfPath: string,
    nomeArquivo: string,
    caption: string,
    opcoes?: { tipoDisparo?: string; disparoId?: string; cooperadoId?: string; cooperativaId?: string },
  ): Promise<void> {
    const res = await fetch(`${this.baseUrl}/send-document`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: telefone,
        filePath: pdfPath,
        filename: nomeArquivo,
        caption,
      }),
    });
    if (!res.ok) {
      const err = await res.json();
      await this.registrarMensagem(telefone, `[PDF: ${nomeArquivo}] ${caption}`, 'FALHOU', { ...opcoes, tipo: 'documento' });
      throw new Error(`Erro ao enviar PDF WhatsApp: ${err.error}`);
    }
    this.logger.log(`PDF ${nomeArquivo} enviado para ${telefone}`);

    await this.registrarMensagem(telefone, `[PDF: ${nomeArquivo}] ${caption}`, 'ENVIADA', { ...opcoes, tipo: 'documento' });
  }

  private async registrarMensagem(
    telefone: string,
    conteudo: string,
    status: string,
    opcoes?: { tipoDisparo?: string; disparoId?: string; cooperadoId?: string; cooperativaId?: string; tipo?: string },
  ): Promise<void> {
    try {
      await this.prisma.mensagemWhatsapp.create({
        data: {
          telefone,
          direcao: 'SAIDA',
          tipo: opcoes?.tipo ?? 'texto',
          conteudo,
          status,
          tipoDisparo: opcoes?.tipoDisparo ?? null,
          disparoId: opcoes?.disparoId ?? null,
          cooperadoId: opcoes?.cooperadoId ?? null,
          cooperativaId: opcoes?.cooperativaId ?? null,
        },
      });
    } catch (err) {
      this.logger.warn(`Falha ao registrar mensagem: ${err.message}`);
    }
  }
}
