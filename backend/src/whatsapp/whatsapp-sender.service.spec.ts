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

/**
 * Corretiva de segurança 2026-07-16 — Achado 5 (severidade mais alta dos 5).
 *
 * `WhatsappSenderService.registrarMensagem` grava o texto completo da
 * mensagem em `mensagens_whatsapp.conteudo` (`String? @db.Text`). Como o
 * texto do OTP inclui o código em claro (ex.: "*123456*"), o segundo fator
 * fica lookupável pra QUALQUER `ADMIN` do tenant via o painel de conversas
 * (whatsapp-fatura.controller.ts:194/235/278/313 → ConversaDetalhe.tsx:159
 * renderiza texto integral).
 *
 * Contradiz o design catalogado no próprio schema:
 *   - Convite.otpCodigoHash (schema.prisma:1897) — "NUNCA plain"
 *   - OtpDesafio.codigoHash (schema.prisma:4167) — "NUNCA armazenar plain"
 *
 * Fix: `registrarMensagem` reusa a MESMA flag `sensivel` construída no
 * Achado 1 (classificação NA ORIGEM). Se `true`, grava sentinel
 * `[REDACTED-OTP]` no `conteudo`; TODOS os metadados ficam intactos
 * (direcao, status, tipoDisparo, disparoId, cooperadoId, cooperativaId,
 * tipo, telefone). Prova de envio permanece; segundo fator some do banco.
 *
 * NÃO filtrar por `tipoDisparo` — isso é regex/detecção-por-padrão, o que
 * o Achado 1 explicitamente proibiu. `tipoDisparo` foi usado one-off pra
 * redigir o histórico (14 linhas), não pro fluxo vivo.
 */
describe('WhatsappSenderService — persistência REDACTED em OTP (Achado 5)', () => {
  const DESTINO_COOPERADO = '5527981341348';
  const originalFetch = global.fetch;
  const originalSuperAdmin = process.env.SUPER_ADMIN_PHONE;

  function response200(): Response {
    return {
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({ ok: true }),
    } as unknown as Response;
  }

  function buildSut() {
    global.fetch = jest.fn(() => Promise.resolve(response200())) as unknown as typeof fetch;
    const create = jest.fn().mockResolvedValue({ id: 'msg' });
    const prisma = {
      mensagemWhatsapp: { create },
      cooperativa: { findUnique: jest.fn().mockResolvedValue({ nome: 'CoopereBR' }) },
    };
    const eventEmitter = { emit: jest.fn() };
    const sut = new WhatsappSenderService(prisma as any, eventEmitter as any);
    return { sut, create };
  }

  beforeEach(() => {
    // Espelho DESATIVADO — o foco deste describe é a persistência em
    // `mensagens_whatsapp`, não o espelho super-admin (Achado 1).
    delete process.env.SUPER_ADMIN_PHONE;
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

  it('PAR (1/2) — mensagem NÃO-sensível → conteudo gravado INTEGRAL no banco', async () => {
    const { sut, create } = buildSut();
    const TEXTO = 'Olá! Sua fatura de Julho/2026 está disponível. Ver: https://app.cooperebr.com.br';

    await sut.enviarMensagem(DESTINO_COOPERADO, TEXTO, {
      tipoDisparo: 'RELATORIO_POS_APROVACAO',
      cooperadoId: 'coop-1',
      cooperativaId: 'tenant-A',
      // sensivel omitido → default false
    });

    // Persistência ocorre 1× (status=ENVIADA).
    expect(create).toHaveBeenCalledTimes(1);
    const dataGravada = create.mock.calls[0][0].data;
    // Conteúdo INTEGRAL (prova que o teste exercita o caminho de gravação).
    expect(dataGravada.conteudo).toBe(TEXTO);
    // Metadados canônicos preservados.
    expect(dataGravada.telefone).toBe(DESTINO_COOPERADO);
    expect(dataGravada.direcao).toBe('SAIDA');
    expect(dataGravada.status).toBe('ENVIADA');
    expect(dataGravada.tipoDisparo).toBe('RELATORIO_POS_APROVACAO');
    expect(dataGravada.cooperadoId).toBe('coop-1');
    expect(dataGravada.cooperativaId).toBe('tenant-A');
  });

  it('PAR (2/2) — mensagem SENSÍVEL (OTP) → conteudo = "[REDACTED-OTP]", metadados INTACTOS', async () => {
    const { sut, create } = buildSut();
    const CODIGO_OTP = '842197'; // 6 dígitos aleatórios
    const TEXTO = `Seu código de confirmação CoopereBR (convênio *Grupo Mule*):\n\n*${CODIGO_OTP}*\n\nVálido por 10 minutos.`;

    await sut.enviarMensagem(DESTINO_COOPERADO, TEXTO, {
      tipoDisparo: 'convite_convenio_otp',
      disparoId: 'convite-abc',
      cooperadoId: 'coop-1',
      cooperativaId: 'tenant-A',
      sensivel: true,
    });

    expect(create).toHaveBeenCalledTimes(1);
    const dataGravada = create.mock.calls[0][0].data;
    // Conteúdo REDIGIDO — o código NÃO pode aparecer.
    expect(dataGravada.conteudo).toBe(WhatsappSenderService.CONTEUDO_REDACTED);
    expect(dataGravada.conteudo).not.toContain(CODIGO_OTP);
    expect(dataGravada.conteudo).not.toContain('código');
    // Metadados canônicos preservados (rastreabilidade não é sacrificada).
    expect(dataGravada.telefone).toBe(DESTINO_COOPERADO);
    expect(dataGravada.direcao).toBe('SAIDA');
    expect(dataGravada.status).toBe('ENVIADA');
    expect(dataGravada.tipoDisparo).toBe('convite_convenio_otp');
    expect(dataGravada.disparoId).toBe('convite-abc');
    expect(dataGravada.cooperadoId).toBe('coop-1');
    expect(dataGravada.cooperativaId).toBe('tenant-A');
  });
});
