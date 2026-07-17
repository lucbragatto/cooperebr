import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma.service';
import { podeEnviarEmDev } from '../common/safety/whitelist-teste';

export interface WhatsappMensagemEnviadaEvent {
  telefone: string;
  texto: string;
  direcao: 'ENVIADA' | 'RECEBIDA';
}

/**
 * D-novo-WA-DEV-FALSE-OK (05/06/2026) — Resultado estruturado do envio.
 *
 * Antes: `enviarMensagem` retornava `Promise<void>` e fazia `return` silencioso
 * em 2 caminhos (`isNumeroProtegido` + `!podeEnviarEmDev`), o que dava falso
 * positivo "enviado ✓" pra callers que assumiam `await sem throw = enviado`.
 *
 * Agora: retorna `WhatsappEnvioResult` explícito. Callers que ignorarem o
 * valor continuam compatíveis (await Promise<X> aceita ignorar). Callers
 * que se importam (ex: convite-indicacao.service) propagam o motivo até
 * a UI dev pra mostrar status honesto.
 *
 * Em PROD (`AMBIENTE_REAL=true`), nenhum skip dev acontece — só falha real
 * vira `{ enviado: false, motivo: 'erro-runtime' }` ou throw (HTTP 4xx/5xx).
 *
 * ─── Corretiva 2026-07-16, Achado 1 (Flag `sensivel`) ──────────────────
 *
 * O espelho super-admin (SUPER_ADMIN_PHONE) copia integralmente TODA
 * mensagem enviada. Hoje dormente (env não setada), mas ativo por desenho.
 * Se um OTP for espelhado, o segundo fator vaza pro admin.
 *
 * Fix: classificação NA ORIGEM (não regex). Quem envia OTP passa
 * `sensivel: true` em `opcoes`. O bloco do espelho pula quando sensível,
 * loga `[ESPELHO SKIP: sensivel]`. Envios normais logam `[ESPELHO] enviado`.
 *
 * Emissores OTP-por-WA ATIVOS hoje que passam `sensivel: true`:
 *  - `convenios/convites-convenio.service.ts` — OTP convite convênio
 *  - `whatsapp/whatsapp-fluxo-motor.service.ts` — código "definir PIN"
 *
 * TODO (carry-over — não enviam WA hoje, ficam pendentes):
 *  - `cooperados/aparelho-vinculado.service.ts` — retorna código plain;
 *    quando algum caller consumir `iniciarAtivacao` + enviar WA, PASSAR
 *    `sensivel: true` na chamada.
 *  - `cooper-token step-up` — carry-over Bloco D; quando
 *    `TokenNotificacaoService.enviarOtpAltoValor` for wireado pra WA,
 *    PASSAR `sensivel: true`.
 *
 * Cobertura da fachada pelo `sensivel` (completude V1 — 16/07/2026):
 *  - `enviarMensagem`     — espelha; filtra via `sensivel`. ✓
 *  - `enviarMenuComBotoes` — delega a `enviarMensagem`, herda o filtro.
 *    Tipo do 3º arg alargado pra aceitar `sensivel` e propagar. ✓
 *  - `enviarListaMensagem` — fetch direto pra /send-list, NÃO espelha.
 *    Sem risco de vazamento pelo super-admin. Nenhuma mudança necessária.
 *  - `enviarPdfWhatsApp`  — fetch direto pra /send-document, NÃO espelha.
 *    Sem risco de vazamento pelo super-admin. Nenhuma mudança necessária.
 */
export type WhatsappEnvioMotivo =
  | 'whitelist-dev'      // pulou por whitelist em DEV (regra 18/05)
  | 'numero-protegido'   // número fake/anonimizado bloqueado (defense in depth)
  | 'erro-runtime';      // erro inesperado (espelhamento failed, etc — não-throw)

export interface WhatsappEnvioResult {
  enviado: boolean;
  motivo?: WhatsappEnvioMotivo;
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

  private async getNomeParceiro(cooperativaId?: string): Promise<string> {
    if (!cooperativaId) return 'SISGD';
    try {
      const cooperativa = await this.prisma.cooperativa.findUnique({
        where: { id: cooperativaId },
        select: { nome: true },
      });
      return cooperativa?.nome || 'SISGD';
    } catch {
      return 'SISGD';
    }
  }

  async getStatus(): Promise<{ status: string; qrCode?: string }> {
    const res = await fetch(`${this.baseUrl}/status`);
    return res.json();
  }

  // Número do super admin — recebe cópia de todas as mensagens enviadas pelo sistema
  private readonly SUPER_ADMIN_PHONE = process.env.SUPER_ADMIN_PHONE || null;

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
    opcoes?: {
      tipoDisparo?: string;
      disparoId?: string;
      cooperadoId?: string;
      cooperativaId?: string;
      /**
       * Corretiva 2026-07-16 Achado 1 — quando `true`, o espelho pro
       * SUPER_ADMIN_PHONE é PULADO. Default `false` preserva compat com os
       * ~43 callers existentes. Só emissores de OTP/2FA setam `true`.
       * Classificação NA ORIGEM (não regex) — quem sabe que o conteúdo é
       * sensível é quem constrói a mensagem.
       */
      sensivel?: boolean;
    },
  ): Promise<WhatsappEnvioResult> {
    // Bloquear envio para números de teste/anonimizados
    if (this.isNumeroProtegido(telefone)) {
      this.logger.warn(`[BLOQUEADO] Tentativa de envio para número de teste: ${telefone}`);
      return { enviado: false, motivo: 'numero-protegido' };
    }
    // Whitelist em dev: só envia para números autorizados
    if (!podeEnviarEmDev(telefone, 'WA')) {
      this.logger.log(`[DEV] WA para ${telefone} SKIPPED (não está na whitelist)`);
      return { enviado: false, motivo: 'whitelist-dev' };
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

    // Espelhar para o super admin (exceto se já for ele o destinatário
    // OU se a mensagem for sensível — corretiva 2026-07-16 Achado 1).
    if (this.SUPER_ADMIN_PHONE && telefone.replace(/\D/g, '') !== this.SUPER_ADMIN_PHONE.replace(/\D/g, '')) {
      if (opcoes?.sensivel === true) {
        // Auditoria do próprio espelho: registra que pulou por sensibilidade.
        this.logger.log(`[ESPELHO SKIP: sensivel] tipoDisparo=${opcoes?.tipoDisparo ?? '(none)'} destino=${telefone}`);
      } else {
        const espelho = `📋 *[ESPELHO]* → para *${telefone}*:\n\n${texto}`;
        try {
          await fetch(`${this.baseUrl}/send-message`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ to: this.SUPER_ADMIN_PHONE, text: espelho }),
          });
          // Auditoria do próprio espelho: registra que espelhou.
          this.logger.log(`[ESPELHO] enviado tipoDisparo=${opcoes?.tipoDisparo ?? '(none)'} destino=${telefone}`);
        } catch (err) {
          this.logger.warn(`Falha ao espelhar mensagem para super admin: ${err.message}`);
          // Espelhamento é best-effort — não invalida o envio principal.
        }
      }
    }

    return { enviado: true };
  }

  /**
   * Envia menu interativo com botões (até 3 opções) ou lista (4+ opções).
   * Se falhar, envia fallback em texto simples com opções numeradas.
   */
  /**
   * Envia menu como texto formatado com opções numeradas.
   * Baileys interactive list/button messages são instáveis (WhatsApp restringe ao Business API),
   * causando menus que "enviam com sucesso" mas não aparecem para o usuário.
   * Texto simples é 100% confiável em todos os dispositivos.
   */
  async enviarMenuComBotoes(
    telefone: string,
    menu: MenuInterativo,
    opcoes?: {
      tipoDisparo?: string;
      disparoId?: string;
      cooperadoId?: string;
      cooperativaId?: string;
      /**
       * Corretiva 2026-07-16 Achado 1 (V1 completude) — propaga a flag pro
       * `enviarMensagem` que roda por baixo. Se algum dia rolar menu com
       * conteúdo sensível (código embutido, PIN provisório), o caller
       * consegue evitar o espelho pro SUPER_ADMIN_PHONE.
       */
      sensivel?: boolean;
    },
  ): Promise<void> {
    if (this.isNumeroProtegido(telefone)) {
      this.logger.warn(`[BLOQUEADO] Menu para número protegido: ${telefone}`);
      return;
    }
    const { corpo, rodape, opcoes: itens } = menu;
    const nomeParceiro = await this.getNomeParceiro(opcoes?.cooperativaId);
    const footerText = rodape || nomeParceiro;

    let texto = `${corpo}\n`;
    for (const item of itens) {
      texto += `\n*${item.id}.* ${item.texto}`;
      if (item.descricao) texto += ` — _${item.descricao}_`;
    }
    texto += `\n\n_Responda com o número da opção desejada._`;
    if (footerText) texto += `\n_${footerText}_`;

    await this.enviarMensagem(telefone, texto, opcoes);
  }

  async enviarListaMensagem(
    telefone: string,
    texto: string,
    buttonText: string,
    sections: Array<{ title: string; rows: Array<{ title: string; rowId: string; description?: string }> }>,
    opcoes?: { tipoDisparo?: string; cooperadoId?: string; cooperativaId?: string },
  ): Promise<void> {
    if (this.isNumeroProtegido(telefone)) {
      this.logger.warn(`[BLOQUEADO] Lista para número protegido: ${telefone}`);
      return;
    }
    if (!podeEnviarEmDev(telefone, 'WA')) {
      this.logger.log(`[DEV] Lista WA para ${telefone} SKIPPED (não está na whitelist)`);
      return;
    }
    const res = await fetch(`${this.baseUrl}/send-list`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: telefone,
        text: texto,
        footer: await this.getNomeParceiro(opcoes?.cooperativaId),
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
    if (this.isNumeroProtegido(telefone)) {
      this.logger.warn(`[BLOQUEADO] PDF para número protegido: ${telefone}`);
      return;
    }
    if (!podeEnviarEmDev(telefone, 'WA')) {
      this.logger.log(`[DEV] PDF WA para ${telefone} SKIPPED (não está na whitelist)`);
      return;
    }
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

  /**
   * Marcador usado em `mensagens_whatsapp.conteudo` quando a mensagem é
   * sensível (OTP/2FA). Exportado como constante pra reuso no UPDATE de
   * redação histórica e nos specs. NÃO trocar o valor sem migrar
   * histórico + specs juntos.
   */
  static readonly CONTEUDO_REDACTED = '[REDACTED-OTP]';

  private async registrarMensagem(
    telefone: string,
    conteudo: string,
    status: string,
    opcoes?: {
      tipoDisparo?: string;
      disparoId?: string;
      cooperadoId?: string;
      cooperativaId?: string;
      tipo?: string;
      /**
       * Corretiva 2026-07-16 Achado 5 — quando `true`, o `conteudo` não
       * é persistido em claro. Grava sentinel `[REDACTED-OTP]` e mantém
       * TODOS os metadados intactos (direcao, status, tipoDisparo,
       * disparoId, cooperadoId, cooperativaId, tipo, telefone). Prova
       * de envio permanece; segundo fator não fica lookupável no banco.
       * Classificação NA ORIGEM via a mesma flag do espelho super-admin
       * (não regex, não tipoDisparo — mesma decisão do Achado 1).
       */
      sensivel?: boolean;
    },
  ): Promise<void> {
    try {
      await this.prisma.mensagemWhatsapp.create({
        data: {
          telefone,
          direcao: 'SAIDA',
          tipo: opcoes?.tipo ?? 'texto',
          conteudo: opcoes?.sensivel === true ? WhatsappSenderService.CONTEUDO_REDACTED : conteudo,
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
