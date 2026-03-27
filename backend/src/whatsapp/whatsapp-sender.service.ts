import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma.service';

export interface WhatsappMensagemEnviadaEvent {
  telefone: string;
  texto: string;
  direcao: 'ENVIADA' | 'RECEBIDA';
}

export interface OpcaoMenu {
  id: string;
  texto: string;
  descricao?: string;
}

export interface MenuInterativo {
  titulo: string;
  corpo: string;
  rodape?: string;
  opcoes: OpcaoMenu[];
}

@Injectable()
export class WhatsappSenderService {
  private readonly logger = new Logger(WhatsappSenderService.name);
  private readonly baseUrl = process.env.WHATSAPP_SERVICE_URL || 'http://localhost:3002';

  constructor(
    private prisma: PrismaService,
    private eventEmitter: EventEmitter2,
  ) {}

  async getStatus(): Promise<{ status: string; qrCode?: string }> {
    const res = await fetch(`${this.baseUrl}/status`);
    return res.json();
  }

  // Número do super admin — recebe cópia de todas as mensagens enviadas pelo sistema
  private readonly SUPER_ADMIN_PHONE = process.env.SUPER_ADMIN_PHONE || '5527981341348';

  /**
   * Números bloqueados de receber mensagens do sistema.
   * Inclui: números de teste, números anonimizados, prefixos inválidos.
   */
  private isNumeroProtegido(telefone: string): boolean {
    const digits = telefone.replace(/\D/g, '');
    // Números anonimizados no banco começam com 'INATIVO-'
    if (telefone.startsWith('INATIVO-')) return true;
    // Números de teste conhecidos (padrões usados em seeds)
    const BLOQUEADOS = ['551199988', '551199900', '551172620', '551175410', '551178110'];
    return BLOQUEADOS.some(p => digits.startsWith(p));
  }

  async enviarMensagem(
    telefone: string,
    texto: string,
    opcoes?: { tipoDisparo?: string; disparoId?: string; cooperadoId?: string; cooperativaId?: string },
  ): Promise<void> {
    // Bloquear envio para números de teste/anonimizados
    if (this.isNumeroProtegido(telefone)) {
      this.logger.warn(`[BLOQUEADO] Tentativa de envio para número de teste: ${telefone}`);
      return;
    }
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

    // Emitir evento para observadores (Modo Observador)
    this.eventEmitter.emit('whatsapp.mensagem.enviada', {
      telefone,
      texto,
      direcao: 'ENVIADA',
    } as WhatsappMensagemEnviadaEvent);

    // Espelhar para o super admin (exceto se já for ele o destinatário)
    if (telefone.replace(/\D/g, '') !== this.SUPER_ADMIN_PHONE.replace(/\D/g, '')) {
      const espelho = `📋 *[ESPELHO]* → para *${telefone}*:\n\n${texto}`;
      try {
        await fetch(`${this.baseUrl}/send-message`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ to: this.SUPER_ADMIN_PHONE, text: espelho }),
        });
      } catch (err) {
        this.logger.warn(`Falha ao espelhar mensagem para super admin: ${err.message}`);
      }
    }
  }

  /**
   * Envia menu interativo com botões (até 3 opções) ou lista (4+ opções).
   * Se falhar, envia fallback em texto simples com opções numeradas.
   */
  async enviarMenuComBotoes(
    telefone: string,
    menu: MenuInterativo,
    opcoes?: { tipoDisparo?: string; disparoId?: string; cooperadoId?: string; cooperativaId?: string },
  ): Promise<void> {
    const { titulo, corpo, rodape, opcoes: itens } = menu;
    const footerText = rodape || 'CoopereBR - Energia Solar Compartilhada';

    try {
      let payload: any;

      if (itens.length <= 3) {
        // Botões interativos (máx 3)
        payload = {
          to: telefone,
          type: 'buttons',
          message: {
            text: corpo,
            footerText,
            headerType: 1,
            buttons: itens.map((item, i) => ({
              buttonId: item.id,
              buttonText: { displayText: item.texto },
              type: 1,
            })),
          },
        };
      } else {
        // Lista interativa (4+ opções)
        payload = {
          to: telefone,
          type: 'list',
          message: {
            title: titulo,
            text: corpo,
            footerText,
            buttonText: 'Ver opções',
            sections: [{
              title: titulo,
              rows: itens.map(item => ({
                title: item.texto,
                description: item.descricao || '',
                rowId: item.id,
              })),
            }],
          },
        };
      }

      const res = await fetch(`${this.baseUrl}/send-interactive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        this.logger.log(`Menu interativo enviado para ${telefone} (${itens.length} opções)`);
        const textoRegistro = `[MENU] ${corpo}\n${itens.map(o => `${o.id}. ${o.texto}`).join('\n')}`;
        await this.registrarMensagem(telefone, textoRegistro, 'ENVIADA', opcoes);
        this.eventEmitter.emit('whatsapp.mensagem.enviada', {
          telefone,
          texto: textoRegistro,
          direcao: 'ENVIADA',
        } as WhatsappMensagemEnviadaEvent);
        return;
      }

      // Se retornou erro, cai no fallback abaixo
      this.logger.warn(`Botões interativos falharam para ${telefone}, usando fallback texto`);
    } catch (err) {
      this.logger.warn(`Erro ao enviar botões interativos para ${telefone}: ${err.message} — usando fallback texto`);
    }

    // Fallback: mensagem de texto simples com opções numeradas
    let textoFallback = `${corpo}\n`;
    for (const item of itens) {
      textoFallback += `\n${item.id}️⃣ ${item.texto}`;
      if (item.descricao) textoFallback += ` — ${item.descricao}`;
    }
    if (footerText) textoFallback += `\n\n_${footerText}_`;

    await this.enviarMensagem(telefone, textoFallback, opcoes);
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
