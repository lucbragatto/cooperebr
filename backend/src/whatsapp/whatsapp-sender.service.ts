import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class WhatsappSenderService {
  private readonly logger = new Logger(WhatsappSenderService.name);
  private readonly baseUrl = process.env.WHATSAPP_SERVICE_URL || 'http://localhost:3002';

  async getStatus(): Promise<{ status: string; qrCode?: string }> {
    const res = await fetch(`${this.baseUrl}/status`);
    return res.json();
  }

  async enviarMensagem(telefone: string, texto: string): Promise<void> {
    const res = await fetch(`${this.baseUrl}/send-message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: telefone, text: texto }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(`Erro ao enviar mensagem WhatsApp: ${err.error}`);
    }
    this.logger.log(`Mensagem enviada para ${telefone}`);
  }

  async enviarPdfWhatsApp(
    telefone: string,
    pdfPath: string,
    nomeArquivo: string,
    caption: string,
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
      throw new Error(`Erro ao enviar PDF WhatsApp: ${err.error}`);
    }
    this.logger.log(`PDF ${nomeArquivo} enviado para ${telefone}`);
  }
}
