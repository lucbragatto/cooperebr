/**
 * Corretiva de segurança 2026-07-16 — Achado 3.
 *
 * Escopo: prova que `POST /whatsapp/webhook-incoming` autentica via
 * HEADER `x-whatsapp-secret` (preferencial) com fallback pra query
 * `?secret=` na janela de compat.
 *
 * 5 cenários canônicos + 1 bônus:
 *  - C1 só header válido            → 200, SEM warn (caminho preferencial)
 *  - C2 só query válida             → 200, COM warn (fallback deprecated)
 *  - C3 header + query juntos       → 200, SEM warn duplicado (header vence
 *                                      antes de consultar query)
 *  - C4 sem secret nenhum           → 401 (nem chega no bot)
 *  - C5 secret de TAMANHO ERRADO    → 401 (NÃO 500 — length-check do helper
 *                                      impede o RangeError do timingSafeEqual)
 *  - Cbonus header VAZIO + query    → 200, COM warn (empty string cai pro
 *                                      fallback pra não travar emissor legado)
 *
 * PROVA POR MUTAÇÃO (executada localmente, resultado colado no doc-sessão):
 *  1. Comentar o branch `if (secretHeader && ...)` no controller → C1 e C3
 *     falham (secretHeader nunca é lido; C1 vira 401 por não ter query;
 *     C3 warna porque cai no fallback e viola o "sem warn duplicado").
 *  2. Comentar `this.logger.warn(...)` → C2 e Cbonus falham
 *     (`toHaveBeenCalledTimes(1)` vira 0).
 *
 * Nenhum canal externo é acionado: `bot.processarMensagem`, `logger.*`
 * e `WHATSAPP_WEBHOOK_SECRET` são mockados/stubados. Sem envio real.
 */
import { WhatsappFaturaController } from './whatsapp-fatura.controller';
import { UnauthorizedException } from '@nestjs/common';

describe('WhatsappFaturaController.webhookIncoming — auth via header (Achado 3)', () => {
  const SECRET = 'test-secret-abcdef123456';
  const SECRET_TAMANHO_ERRADO = 'curto'; // len !== SECRET.length → sem length-check, timingSafeEqual RangeError => 500

  function buildSut() {
    const processarMensagem = jest.fn().mockResolvedValue(undefined);
    const bot = { processarMensagem } as any;

    const loggerLog = jest.fn();
    const loggerWarn = jest.fn();
    const loggerError = jest.fn();

    const controller = Object.create(WhatsappFaturaController.prototype) as WhatsappFaturaController;
    (controller as any).bot = bot;
    (controller as any).logger = { log: loggerLog, warn: loggerWarn, error: loggerError };

    return { controller, processarMensagem, loggerWarn, loggerLog };
  }

  const bodyValido = {
    telefone: '5527981341348',
    tipo: 'texto' as const,
    corpo: 'oi',
  };

  beforeEach(() => {
    process.env.WHATSAPP_WEBHOOK_SECRET = SECRET;
  });

  afterEach(() => {
    delete process.env.WHATSAPP_WEBHOOK_SECRET;
    jest.clearAllMocks();
  });

  it('C1 — só header válido → 200 SEM warn (caminho preferencial)', async () => {
    const { controller, processarMensagem, loggerWarn } = buildSut();

    const resp = await controller.webhookIncoming(SECRET, undefined, bodyValido as any);

    expect(resp).toEqual({ ok: true });
    expect(processarMensagem).toHaveBeenCalledTimes(1);
    expect(processarMensagem).toHaveBeenCalledWith(bodyValido);
    // Warn é a assinatura do fallback — header preferencial NÃO warna.
    expect(loggerWarn).not.toHaveBeenCalled();
  });

  it('C2 — só query válida → 200 COM warn (fallback deprecated)', async () => {
    const { controller, processarMensagem, loggerWarn } = buildSut();

    const resp = await controller.webhookIncoming(undefined, SECRET, bodyValido as any);

    expect(resp).toEqual({ ok: true });
    expect(processarMensagem).toHaveBeenCalledTimes(1);
    expect(loggerWarn).toHaveBeenCalledTimes(1);
    expect(String(loggerWarn.mock.calls[0][0])).toMatch(/deprecated/i);
    expect(String(loggerWarn.mock.calls[0][0])).toMatch(/x-whatsapp-secret/);
  });

  it('C3 — header válido + query presente → 200 SEM warn duplicado (header vence)', async () => {
    const { controller, processarMensagem, loggerWarn } = buildSut();

    const resp = await controller.webhookIncoming(SECRET, SECRET, bodyValido as any);

    expect(resp).toEqual({ ok: true });
    expect(processarMensagem).toHaveBeenCalledTimes(1);
    // O ponto do cenário: header já autorizou → query nem foi consultada
    // → o warn do fallback NÃO dispara. Sem isso, o log fica poluído
    // durante toda a janela de compat (o emissor pode mandar os dois).
    expect(loggerWarn).not.toHaveBeenCalled();
  });

  it('C4 — sem secret nenhum → 401 (bot nem é chamado)', async () => {
    const { controller, processarMensagem } = buildSut();

    await expect(
      controller.webhookIncoming(undefined, undefined, bodyValido as any),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(processarMensagem).not.toHaveBeenCalled();
  });

  it('C5 — secret de TAMANHO ERRADO → 401 (NÃO 500, length-check antes de timingSafeEqual)', async () => {
    const { controller, processarMensagem } = buildSut();

    // No header:
    await expect(
      controller.webhookIncoming(SECRET_TAMANHO_ERRADO, undefined, bodyValido as any),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    // Na query (mesmo helper cobre os dois caminhos):
    await expect(
      controller.webhookIncoming(undefined, SECRET_TAMANHO_ERRADO, bodyValido as any),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(processarMensagem).not.toHaveBeenCalled();
  });

  it('Cbonus — header VAZIO + query válida → 200 COM warn (empty string cai pro fallback)', async () => {
    const { controller, processarMensagem, loggerWarn } = buildSut();

    // Emissor legado pode enviar `x-whatsapp-secret: ''` (ex: axios default).
    // "Header presente" precisa significar NÃO-VAZIO — senão empty string
    // trava toda query válida durante a janela de compat.
    const resp = await controller.webhookIncoming('', SECRET, bodyValido as any);

    expect(resp).toEqual({ ok: true });
    expect(processarMensagem).toHaveBeenCalledTimes(1);
    expect(loggerWarn).toHaveBeenCalledTimes(1);
  });

  it('sem WHATSAPP_WEBHOOK_SECRET no env → 401 mesmo com header válido (fail-safe de config)', async () => {
    delete process.env.WHATSAPP_WEBHOOK_SECRET;
    const { controller, processarMensagem } = buildSut();

    await expect(
      controller.webhookIncoming(SECRET, undefined, bodyValido as any),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(processarMensagem).not.toHaveBeenCalled();
  });
});
