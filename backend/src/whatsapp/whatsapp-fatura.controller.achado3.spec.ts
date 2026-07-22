/**
 * Corretiva de segurança 2026-07-16 — Achado 3.
 *
 * Escopo: prova que `POST /whatsapp/webhook-incoming` autentica APENAS via
 * HEADER `x-whatsapp-secret`. Fallback query `?secret=` foi REMOVIDO em
 * 2026-07-22 após Bloco 6 do runbook fechar a compat window (24h após rotação
 * 21/07 07:46 apresentou 0 usos de query + 0 Unauthorized no log real).
 *
 * 4 cenários canônicos + 1 regressão do fallback removido:
 *  - C1 header válido               → 200 (caminho único)
 *  - C4 sem header                  → 401 (nem chega no bot)
 *  - C5 header de TAMANHO ERRADO    → 401 (NÃO 500 — length-check do helper
 *                                      impede o RangeError do timingSafeEqual)
 *  - Csem-env sem WHATSAPP_WEBHOOK_SECRET no env → 401 (fail-safe de config)
 *  - Cregression header vazio       → 401 (empty string NÃO autoriza —
 *                                      antes caía no fallback, agora rejeita)
 *
 * Nenhum canal externo é acionado: `bot.processarMensagem`, `logger.*`
 * e `WHATSAPP_WEBHOOK_SECRET` são mockados/stubados. Sem envio real.
 */
import { WhatsappFaturaController } from './whatsapp-fatura.controller';
import { UnauthorizedException } from '@nestjs/common';

describe('WhatsappFaturaController.webhookIncoming — auth via header (Achado 3, fallback query removido 22/07)', () => {
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

  it('C1 — header valido → 200 (caminho unico apos remocao do fallback query)', async () => {
    const { controller, processarMensagem, loggerWarn } = buildSut();

    const resp = await controller.webhookIncoming(SECRET, bodyValido as any);

    expect(resp).toEqual({ ok: true });
    expect(processarMensagem).toHaveBeenCalledTimes(1);
    expect(processarMensagem).toHaveBeenCalledWith(bodyValido);
    // Sem fallback query, nao ha mais warn de deprecated no path normal.
    expect(loggerWarn).not.toHaveBeenCalled();
  });

  it('C4 — sem header → 401 (bot nem eh chamado)', async () => {
    const { controller, processarMensagem } = buildSut();

    await expect(
      controller.webhookIncoming(undefined, bodyValido as any),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(processarMensagem).not.toHaveBeenCalled();
  });

  it('C5 — header de TAMANHO ERRADO → 401 (NAO 500, length-check antes de timingSafeEqual)', async () => {
    const { controller, processarMensagem } = buildSut();

    await expect(
      controller.webhookIncoming(SECRET_TAMANHO_ERRADO, bodyValido as any),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(processarMensagem).not.toHaveBeenCalled();
  });

  it('Cregression — header VAZIO → 401 (antes caia no fallback query, agora rejeita)', async () => {
    // Antes da remocao do fallback query (22/07), header vazio + query valida
    // = 200 com warn (Cbonus antigo). Sem fallback, header vazio nao tem
    // canal alternativo — vai direto pra 401. Regressao explicita.
    const { controller, processarMensagem } = buildSut();

    await expect(
      controller.webhookIncoming('', bodyValido as any),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(processarMensagem).not.toHaveBeenCalled();
  });

  it('Csem-env — sem WHATSAPP_WEBHOOK_SECRET no env → 401 mesmo com header valido (fail-safe de config)', async () => {
    delete process.env.WHATSAPP_WEBHOOK_SECRET;
    const { controller, processarMensagem } = buildSut();

    await expect(
      controller.webhookIncoming(SECRET, bodyValido as any),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(processarMensagem).not.toHaveBeenCalled();
  });
});
