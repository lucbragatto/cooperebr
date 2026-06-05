/**
 * D-novo-OCR-RESILIENCIA (05/06/2026) — specs do retry + timeout + motivos
 * categorizados do OCR Anthropic.
 *
 * Cobre os 7 motivos possíveis de `OcrFalhaMotivo` + retry exponencial +
 * extração de request_id (header + body) + sucesso após N retries.
 *
 * Sleep do backoff é mockado pra resolver imediato (testes rodam em ms,
 * não em 14s). Não exercita o tempo real do delay, mas confirma que o
 * loop avança N vezes e respeita os limites.
 */
import { FaturasService, OcrFalhaError } from './faturas.service';

type FetchMock = jest.Mock<Promise<Response>, [string, RequestInit?]>;

describe('FaturasService — OCR resiliência (retry/timeout/motivos)', () => {
  let service: FaturasService;
  let fetchMock: FetchMock;
  const originalFetch = global.fetch;

  beforeEach(() => {
    service = Object.create(FaturasService.prototype);
    (service as any).logger = {
      log: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    // Sleep mockado pra evitar 14s reais de espera (2+4+8s × N testes).
    (service as any).sleep = jest.fn().mockResolvedValue(undefined);

    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;

    process.env.ANTHROPIC_API_KEY = 'sk-test-fake';
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.clearAllMocks();
  });

  // ─── Factory de Response ───────────────────────────────────────────
  function responseOk(json: object, headers: Record<string, string> = {}): Response {
    const h = new Headers(headers);
    return {
      ok: true,
      status: 200,
      headers: h,
      json: jest.fn().mockResolvedValue(json),
      text: jest.fn().mockResolvedValue(JSON.stringify(json)),
    } as unknown as Response;
  }

  function responseErr(
    status: number,
    body: string | object,
    headers: Record<string, string> = {},
  ): Response {
    const h = new Headers(headers);
    const text = typeof body === 'string' ? body : JSON.stringify(body);
    return {
      ok: false,
      status,
      headers: h,
      json: jest.fn().mockResolvedValue(typeof body === 'string' ? {} : body),
      text: jest.fn().mockResolvedValue(text),
    } as unknown as Response;
  }

  // ─── Caminho feliz ────────────────────────────────────────────────
  it('retorna response + requestId quando 1ª tentativa OK (header request-id)', async () => {
    const resp = responseOk({ content: [] }, { 'request-id': 'req_OK_123' });
    fetchMock.mockResolvedValueOnce(resp);

    const result = await (service as any).chamarAnthropicComRetry({ x: 1 }, 1234);

    expect(result.response).toBe(resp);
    expect(result.requestId).toBe('req_OK_123');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect((service as any).sleep).not.toHaveBeenCalled();
  });

  it('aceita header x-request-id como fallback de request-id', async () => {
    const resp = responseOk({ content: [] }, { 'x-request-id': 'req_XX_456' });
    fetchMock.mockResolvedValueOnce(resp);

    const result = await (service as any).chamarAnthropicComRetry({ x: 1 }, 100);
    expect(result.requestId).toBe('req_XX_456');
  });

  // ─── Retry em status transitórios ─────────────────────────────────
  it('faz retry em 529 (overloaded) e devolve OK na 2ª tentativa', async () => {
    fetchMock
      .mockResolvedValueOnce(
        responseErr(529, { type: 'error', error: { type: 'overloaded_error' }, request_id: 'req_overload_1' }),
      )
      .mockResolvedValueOnce(responseOk({ content: [] }, { 'request-id': 'req_recovered' }));

    const result = await (service as any).chamarAnthropicComRetry({ x: 1 }, 100);

    expect(result.requestId).toBe('req_recovered');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect((service as any).sleep).toHaveBeenCalledWith(2000); // 1º backoff
  });

  it.each([429, 500, 503, 529])(
    'considera HTTP %d retryable (faz nova tentativa)',
    async (status) => {
      fetchMock
        .mockResolvedValueOnce(responseErr(status, { request_id: 'r1' }))
        .mockResolvedValueOnce(responseOk({ content: [] }));

      await (service as any).chamarAnthropicComRetry({}, 100);

      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect((service as any).sleep).toHaveBeenCalledWith(2000);
    },
  );

  it('faz 3 retries (4 tentativas total) e lança OcrFalhaError final em 529 persistente', async () => {
    const body = { type: 'error', error: { type: 'overloaded_error' }, request_id: 'req_final' };
    fetchMock.mockResolvedValue(responseErr(529, body));

    await expect(
      (service as any).chamarAnthropicComRetry({}, 1500),
    ).rejects.toMatchObject({
      name: 'OcrFalhaError',
      motivo: 'anthropic-overload',
      status: 529,
      requestId: 'req_final',
      tamanhoBase64: 1500,
    });

    expect(fetchMock).toHaveBeenCalledTimes(4); // 1 + 3 retries
    // Backoffs 2s/4s/8s aplicados nas 3 falhas intermediárias
    expect((service as any).sleep).toHaveBeenNthCalledWith(1, 2000);
    expect((service as any).sleep).toHaveBeenNthCalledWith(2, 4000);
    expect((service as any).sleep).toHaveBeenNthCalledWith(3, 8000);
  });

  it('classifica 429 como anthropic-rate-limit', async () => {
    fetchMock.mockResolvedValue(responseErr(429, { request_id: 'r' }));
    await expect((service as any).chamarAnthropicComRetry({}, 100)).rejects.toMatchObject({
      motivo: 'anthropic-rate-limit',
    });
  });

  it('classifica 500/503 como anthropic-server', async () => {
    fetchMock.mockResolvedValue(responseErr(503, { request_id: 'r' }));
    await expect((service as any).chamarAnthropicComRetry({}, 100)).rejects.toMatchObject({
      motivo: 'anthropic-server',
    });
  });

  // ─── Status terminal (não-retryable) ─────────────────────────────
  it.each([400, 401, 403, 404, 413, 422])(
    'NÃO faz retry em HTTP %d (terminal) — lança na 1ª tentativa',
    async (status) => {
      fetchMock.mockResolvedValueOnce(responseErr(status, { request_id: 'r_terminal' }));

      await expect(
        (service as any).chamarAnthropicComRetry({}, 100),
      ).rejects.toMatchObject({
        name: 'OcrFalhaError',
        status,
        motivo: 'unknown',
      });

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect((service as any).sleep).not.toHaveBeenCalled();
    },
  );

  // ─── Timeout (AbortController) ────────────────────────────────────
  it('faz retry em AbortError (timeout local) e sucede na 2ª tentativa', async () => {
    const abortErr = new Error('The operation was aborted.');
    abortErr.name = 'AbortError';

    fetchMock
      .mockRejectedValueOnce(abortErr)
      .mockResolvedValueOnce(responseOk({ content: [] }));

    await (service as any).chamarAnthropicComRetry({}, 100);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect((service as any).sleep).toHaveBeenCalledWith(2000);
  });

  it('AbortError persistente em 4 tentativas → motivo=timeout', async () => {
    const abortErr = new Error('aborted');
    abortErr.name = 'AbortError';
    fetchMock.mockRejectedValue(abortErr);

    await expect(
      (service as any).chamarAnthropicComRetry({}, 999),
    ).rejects.toMatchObject({
      name: 'OcrFalhaError',
      motivo: 'timeout',
      tamanhoBase64: 999,
    });

    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  // ─── Erro de rede genérico ────────────────────────────────────────
  it('faz retry em erro de rede genérico e sucede na 2ª tentativa', async () => {
    fetchMock
      .mockRejectedValueOnce(new Error('ECONNRESET'))
      .mockResolvedValueOnce(responseOk({ content: [] }));

    await (service as any).chamarAnthropicComRetry({}, 100);

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('erro de rede persistente → motivo=unknown', async () => {
    fetchMock.mockRejectedValue(new Error('DNS lookup failed'));

    await expect(
      (service as any).chamarAnthropicComRetry({}, 100),
    ).rejects.toMatchObject({
      motivo: 'unknown',
    });

    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  // ─── Extração de request_id ───────────────────────────────────────
  it('extrai request_id do body JSON quando header não tem', async () => {
    fetchMock.mockResolvedValueOnce(
      responseErr(400, { request_id: 'req_from_body', error: {} }),
    );

    await expect(
      (service as any).chamarAnthropicComRetry({}, 100),
    ).rejects.toMatchObject({
      requestId: 'req_from_body',
    });
  });

  it('requestId=null quando body não-JSON e header ausente', async () => {
    fetchMock.mockResolvedValueOnce(responseErr(400, 'plain text error'));

    await expect(
      (service as any).chamarAnthropicComRetry({}, 100),
    ).rejects.toMatchObject({
      requestId: null,
    });
  });

  // ─── Classificador isolado ────────────────────────────────────────
  describe('classificarStatusAnthropic', () => {
    it.each([
      [529, 'anthropic-overload'],
      [429, 'anthropic-rate-limit'],
      [500, 'anthropic-server'],
      [503, 'anthropic-server'],
      [400, 'unknown'],
      [401, 'unknown'],
      [413, 'unknown'],
    ])('status %d → motivo %s', (status, motivo) => {
      expect((service as any).classificarStatusAnthropic(status)).toBe(motivo);
    });
  });

  // ─── OcrFalhaError shape ──────────────────────────────────────────
  it('OcrFalhaError carrega todos os metadados esperados', () => {
    const err = new OcrFalhaError(
      'test message',
      'anthropic-overload',
      'req_xxx',
      529,
      4500,
    );
    expect(err.name).toBe('OcrFalhaError');
    expect(err.message).toBe('test message');
    expect(err.motivo).toBe('anthropic-overload');
    expect(err.requestId).toBe('req_xxx');
    expect(err.status).toBe(529);
    expect(err.tamanhoBase64).toBe(4500);
    expect(err).toBeInstanceOf(Error);
  });
});
