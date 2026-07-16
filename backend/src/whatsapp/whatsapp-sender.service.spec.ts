/**
 * Corretiva de segurança 2026-07-16 — Achado 1 (revisão do Luciano).
 *
 * O espelho super-admin (SUPER_ADMIN_PHONE) copia integralmente TODA
 * mensagem enviada. Se um OTP for espelhado, o segundo fator vaza pro
 * admin. Fix: classificação NA ORIGEM via flag `sensivel: true` — o
 * bloco do espelho pula quando sensível.
 *
 * AVISO CRÍTICO catalogado pelo Luciano:
 *   O espelho está DORMENTE em prod (SUPER_ADMIN_PHONE não setada).
 *   Um teste que asserta só "sensível → não espelhou" passa trivialmente
 *   (o espelho nem roda). Verde vazio.
 *   → Este spec ATIVA o espelho via process.env.SUPER_ADMIN_PHONE dentro
 *     do teste (não no .env) e prova o PAR:
 *       1. NÃO-sensível + espelho ligado → ESPELHOU (prova que o teste
 *          exercita o caminho e o espelho funciona)
 *       2. SENSÍVEL + espelho ligado    → NÃO ESPELHOU
 *   Sem o (1), o (2) passa até com o espelho quebrado.
 *
 * Regra contatos de teste (Luciano 14/05): jest unitário puro com fetch
 * mockado. Nenhum WhatsApp real é disparado por este spec.
 */
import { WhatsappSenderService } from './whatsapp-sender.service';

describe('WhatsappSenderService — espelho super-admin + flag `sensivel` (Achado 1)', () => {
  const SUPER_ADMIN_PHONE = '5511999999999';
  const DESTINO_COOPERADO = '5527981341348'; // whitelist dev — Luciano
  const originalFetch = global.fetch;
  const originalSuperAdmin = process.env.SUPER_ADMIN_PHONE;

  function response200(): Response {
    return {
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({ ok: true }),
    } as unknown as Response;
  }

  /**
   * Cria SUT com fetch mockado que registra CADA POST /send-message.
   * Retorna array `sends` com o body parseado (to, text) na ordem chamada.
   */
  function buildSut(): {
    sut: WhatsappSenderService;
    sends: Array<{ to: string; text: string }>;
    logger: { log: jest.Mock; warn: jest.Mock; error: jest.Mock };
  } {
    const sends: Array<{ to: string; text: string }> = [];
    global.fetch = jest.fn((_url: RequestInfo | URL, init?: RequestInit) => {
      if (init?.body) {
        const parsed = JSON.parse(init.body as string);
        if (parsed?.to && parsed?.text) sends.push(parsed);
      }
      return Promise.resolve(response200());
    }) as unknown as typeof fetch;

    const prisma = {
      mensagemWhatsapp: { create: jest.fn().mockResolvedValue({ id: 'msg' }) },
      cooperativa: { findUnique: jest.fn().mockResolvedValue({ nome: 'CoopereBR' }) },
    };
    const eventEmitter = { emit: jest.fn() };
    const sut = new WhatsappSenderService(prisma as any, eventEmitter as any);

    const logger = { log: jest.fn(), warn: jest.fn(), error: jest.fn() };
    (sut as any).logger = logger;

    return { sut, sends, logger };
  }

  beforeEach(() => {
    // ATIVAÇÃO EXPLÍCITA DO ESPELHO (env mockada, NÃO real). O sender lê
    // process.env.SUPER_ADMIN_PHONE no CONSTRUTOR — precisa vir antes de
    // instanciar. Todos os testes deste describe rodam com espelho ligado.
    process.env.SUPER_ADMIN_PHONE = SUPER_ADMIN_PHONE;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    if (originalSuperAdmin === undefined) {
      delete process.env.SUPER_ADMIN_PHONE;
    } else {
      process.env.SUPER_ADMIN_PHONE = originalSuperAdmin;
    }
    jest.clearAllMocks();
  });

  it('PAR (1/2) — mensagem NÃO-sensível + espelho ATIVO → ESPELHOU (prova que o teste exercita o caminho)', async () => {
    const { sut, sends, logger } = buildSut();

    const resultado = await sut.enviarMensagem(DESTINO_COOPERADO, 'oi, mensagem comum', {
      tipoDisparo: 'MANUAL',
      // sensivel omitido → default false
    });

    expect(resultado).toEqual({ enviado: true });
    // 2 POSTs: destino + espelho.
    expect(sends).toHaveLength(2);
    expect(sends[0]).toEqual({ to: DESTINO_COOPERADO, text: 'oi, mensagem comum' });
    expect(sends[1].to).toBe(SUPER_ADMIN_PHONE);
    expect(sends[1].text).toContain('[ESPELHO]');
    expect(sends[1].text).toContain(DESTINO_COOPERADO);
    expect(sends[1].text).toContain('oi, mensagem comum');
    // Auditoria do próprio espelho.
    const espelhouLogs = logger.log.mock.calls.filter(([msg]) =>
      typeof msg === 'string' && msg.startsWith('[ESPELHO] enviado'),
    );
    expect(espelhouLogs).toHaveLength(1);
  });

  it('PAR (2/2) — mensagem SENSÍVEL (OTP) + espelho ATIVO → NÃO ESPELHOU', async () => {
    const { sut, sends, logger } = buildSut();

    const resultado = await sut.enviarMensagem(
      DESTINO_COOPERADO,
      'Seu código de confirmação: *123456*',
      { tipoDisparo: 'convite_convenio_otp', sensivel: true },
    );

    expect(resultado).toEqual({ enviado: true });
    // Apenas 1 POST: destino. Espelho NÃO deve ter sido acionado.
    expect(sends).toHaveLength(1);
    expect(sends[0]).toEqual({
      to: DESTINO_COOPERADO,
      text: 'Seu código de confirmação: *123456*',
    });
    // Nenhum POST para o super-admin.
    const paraSuperAdmin = sends.filter((s) => s.to === SUPER_ADMIN_PHONE);
    expect(paraSuperAdmin).toHaveLength(0);
    // Auditoria do próprio espelho: registrou o SKIP com tipoDisparo.
    const skipLogs = logger.log.mock.calls.filter(([msg]) =>
      typeof msg === 'string' && msg.startsWith('[ESPELHO SKIP: sensivel]'),
    );
    expect(skipLogs).toHaveLength(1);
    expect(skipLogs[0][0]).toContain('tipoDisparo=convite_convenio_otp');
    // E o log "enviado" (espelho normal) NÃO fira.
    const espelhouLogs = logger.log.mock.calls.filter(([msg]) =>
      typeof msg === 'string' && msg.startsWith('[ESPELHO] enviado'),
    );
    expect(espelhouLogs).toHaveLength(0);
  });
});
