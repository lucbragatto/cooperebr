/**
 * D-novo-CADWEB-CONV-TENANT (05/06/2026) — specs do fix do gate inicial
 * de POST /publico/cadastro-web quando o cadastro vem via convite público
 * (?conv=<token>).
 *
 * Bug original: handler só conhecia `body.cooperativaId` e `?tenant=` como
 * fontes de tenant. Link de convite por WhatsApp não tem `?tenant=`, e
 * `NEXT_PUBLIC_COOPERATIVA_ID` no celular real é vazio → wizard quebrava
 * com 400 "cooperativaId ou query param ?tenant= é obrigatório no modo v2",
 * mesmo com `payload.token` chegando no body.
 *
 * Fix: deriva cooperativaId do convênio do convite server-side, espelhando
 * o padrão anti-spoof já usado em /auto-inscrever (linha 568).
 *
 * Cobertura:
 *  1. token válido sem cooperativaId/?tenant= → resolve do convite
 *  2. token válido + body.cooperativaId diferente → anti-spoof (convite vence)
 *  3. token inválido sem fallback → 400 "Convite inválido ou expirado"
 *  4. token inválido + body.cooperativaId presente → 400 "Convite inválido ou expirado"
 *     (não cai no fallback — token corrompido = erro claro, mesmo com tenant alternativo)
 *  5. sem token e sem cooperativaId/?tenant= → 400 genérico (regressão guard)
 */
import { BadRequestException } from '@nestjs/common';
import { PublicoController } from './publico.controller';

describe('PublicoController.cadastroWeb — resolução de tenant via convite (?conv=)', () => {
  let controller: PublicoController;
  let prismaMock: {
    conviteConvenioMembro: {
      findUnique: jest.Mock;
    };
  };
  let cadastroWebV2Mock: jest.Mock;
  const originalEnv = process.env.CADASTRO_V2_ATIVO;

  beforeEach(() => {
    process.env.CADASTRO_V2_ATIVO = 'true';

    prismaMock = {
      conviteConvenioMembro: {
        findUnique: jest.fn(),
      },
    };

    controller = Object.create(PublicoController.prototype);
    (controller as any).prisma = prismaMock;
    (controller as any).logger = { log: jest.fn(), warn: jest.fn(), error: jest.fn() };

    cadastroWebV2Mock = jest.fn().mockResolvedValue({ ok: true });
    (controller as any).cadastroWebV2 = cadastroWebV2Mock;
  });

  afterEach(() => {
    process.env.CADASTRO_V2_ATIVO = originalEnv;
    jest.clearAllMocks();
  });

  const bodyBase = (overrides: Record<string, unknown> = {}) => ({
    nome: 'Convidado Teste',
    cpf: '12345678901',
    email: 'convidado@example.com',
    telefone: '5527999999999',
    endereco: { cep: '29100000', logradouro: 'R X', numero: '1', bairro: 'B', cidade: 'Vitória', estado: 'ES' },
    instalacao: { numeroUC: '0001234567', distribuidora: 'EDP_ES', consumoMedioKwh: 300 },
    ...overrides,
  });

  // ─── Cenário 1 — caminho feliz: token resolve tenant ───────────
  it('1) token válido sem cooperativaId/?tenant= → resolve do convite', async () => {
    prismaMock.conviteConvenioMembro.findUnique.mockResolvedValue({
      cooperativaId: 'coop-derivada-do-convite',
    });

    const body = bodyBase({ token: 'tok_abc123', origem: 'CONVITE_PUBLICO' });

    await controller.cadastroWeb(body as any, undefined);

    expect(prismaMock.conviteConvenioMembro.findUnique).toHaveBeenCalledWith({
      where: { token: 'tok_abc123' },
      select: { cooperativaId: true },
    });
    expect(cadastroWebV2Mock).toHaveBeenCalledTimes(1);
    expect(cadastroWebV2Mock).toHaveBeenCalledWith(body, 'coop-derivada-do-convite');
  });

  // ─── Cenário 2 — anti-spoof: convite sobrepõe body.cooperativaId ─
  it('2) token válido + body.cooperativaId diferente → convite vence (anti-spoof cross-tenant)', async () => {
    prismaMock.conviteConvenioMembro.findUnique.mockResolvedValue({
      cooperativaId: 'coop-real-do-convite',
    });

    const body = bodyBase({
      token: 'tok_xyz789',
      origem: 'CONVITE_PUBLICO',
      cooperativaId: 'coop-spoofed-pelo-client', // tentativa de spoof
    });

    await controller.cadastroWeb(body as any, 'tenant-via-query-spoof');

    expect(cadastroWebV2Mock).toHaveBeenCalledWith(body, 'coop-real-do-convite');
    expect(cadastroWebV2Mock).not.toHaveBeenCalledWith(body, 'coop-spoofed-pelo-client');
    expect(cadastroWebV2Mock).not.toHaveBeenCalledWith(body, 'tenant-via-query-spoof');
  });

  // ─── Cenário 3 — token inválido sem fallback ─────────────────────
  it('3) token presente mas convite não existe → 400 "Convite inválido ou expirado"', async () => {
    prismaMock.conviteConvenioMembro.findUnique.mockResolvedValue(null);

    const body = bodyBase({ token: 'tok_invalido' });

    await expect(
      controller.cadastroWeb(body as any, undefined),
    ).rejects.toThrow(BadRequestException);
    await expect(
      controller.cadastroWeb(body as any, undefined),
    ).rejects.toThrow('Convite inválido ou expirado.');

    expect(cadastroWebV2Mock).not.toHaveBeenCalled();
  });

  // ─── Cenário 4 — token inválido + body.cooperativaId presente ────
  it('4) token inválido + body.cooperativaId presente → 400 (NÃO cai no fallback)', async () => {
    prismaMock.conviteConvenioMembro.findUnique.mockResolvedValue(null);

    const body = bodyBase({
      token: 'tok_revogado',
      cooperativaId: 'coop-alternativa', // não deve mascarar o erro
    });

    await expect(
      controller.cadastroWeb(body as any, undefined),
    ).rejects.toThrow('Convite inválido ou expirado.');

    expect(cadastroWebV2Mock).not.toHaveBeenCalled();
  });

  // ─── Cenário 5 — sem token e sem cooperativaId (regressão guard) ─
  it('5) sem token e sem cooperativaId/?tenant= → 400 genérico (regressão original)', async () => {
    const body = bodyBase(); // sem token, sem cooperativaId

    await expect(
      controller.cadastroWeb(body as any, undefined),
    ).rejects.toThrow('cooperativaId ou query param ?tenant= é obrigatório no modo v2');

    expect(prismaMock.conviteConvenioMembro.findUnique).not.toHaveBeenCalled();
    expect(cadastroWebV2Mock).not.toHaveBeenCalled();
  });

  // ─── Bônus: sem token mas com ?tenant= → caminho legado funciona ─
  it('bônus) sem token mas com ?tenant= → usa tenantParam, não consulta convite', async () => {
    const body = bodyBase();

    await controller.cadastroWeb(body as any, 'tenant-via-query');

    expect(prismaMock.conviteConvenioMembro.findUnique).not.toHaveBeenCalled();
    expect(cadastroWebV2Mock).toHaveBeenCalledWith(body, 'tenant-via-query');
  });
});

// ═══════════════════════════════════════════════════════════════════════
// D-novo-CADWEB-CONV-MEMBRO (05/06/2026) — specs do consume-once + criação
// de Membro PENDENTE_APROVACAO_EMPRESA + magic link dentro do MESMO tx
// que cria Cooperado+UC.
//
// Exercita o trecho da $transaction dentro de cadastroWebV2 em isolamento,
// reproduzindo a sequência sem importar o controller inteiro (evita montar
// 9+ dependências). Foco: invariantes de atomicidade + consume-once + estado
// inicial do membro.
// ═══════════════════════════════════════════════════════════════════════
describe('cadastroWebV2 — Membro+consume-once dentro do tx (CONVITE_PUBLICO)', () => {
  // Mock tx que reproduz o subconjunto usado pelo trecho.
  type TxMock = {
    conviteConvenioMembro: { findUnique: jest.Mock; update: jest.Mock };
    cooperado: { create: jest.Mock };
    uc: { create: jest.Mock };
  };
  let tx: TxMock;
  let adicionarMembroMock: jest.Mock;

  beforeEach(() => {
    tx = {
      conviteConvenioMembro: { findUnique: jest.fn(), update: jest.fn() },
      cooperado: { create: jest.fn().mockResolvedValue({ id: 'coop-novo' }) },
      uc: { create: jest.fn().mockResolvedValue({ id: 'uc-novo' }) },
    };
    adicionarMembroMock = jest.fn();
  });

  // Helper que reproduz o trecho da $transaction:
  // 1. Resolve+consume-once convite quando origem=CONVITE_PUBLICO
  // 2. Cria Cooperado
  // 3. Cria UC
  // 4. Se convite resolvido, chama adicionarMembro com tx + cross-ref
  async function trechoTx(body: {
    token?: string;
    origem?: string;
  }): Promise<{ cooperadoId: string; ucId: string; membroId: string | null }> {
    let conviteResolved: { id: string; convenioId: string } | null = null;

    if (body.token && body.origem === 'CONVITE_PUBLICO') {
      const convite = await tx.conviteConvenioMembro.findUnique({
        where: { token: body.token },
        select: { id: true, convenioId: true, usedAt: true, expiresAt: true },
      });
      if (!convite) {
        const e: any = new Error('Convite inválido ou expirado.');
        e.name = 'BadRequestException';
        throw e;
      }
      if (convite.usedAt) {
        const e: any = new Error('Convite já utilizado.');
        e.name = 'ConflictException';
        throw e;
      }
      if (convite.expiresAt <= new Date()) {
        const e: any = new Error('Convite expirado.');
        e.name = 'BadRequestException';
        throw e;
      }
      try {
        await tx.conviteConvenioMembro.update({
          where: { id: convite.id, usedAt: null },
          data: { usedAt: new Date() },
        });
      } catch (err: any) {
        if (err?.code === 'P2025') {
          const e: any = new Error('Convite já utilizado.');
          e.name = 'ConflictException';
          throw e;
        }
        throw err;
      }
      conviteResolved = { id: convite.id, convenioId: convite.convenioId };
    }

    const cooperado = await tx.cooperado.create({ data: { nome: 'X' } });
    const uc = await tx.uc.create({ data: { cooperadoId: cooperado.id } });

    let membroIdCriado: string | null = null;
    if (conviteResolved) {
      const membro = await adicionarMembroMock(
        conviteResolved.convenioId,
        cooperado.id,
        undefined,
        tx,
        'CONVITE_PUBLICO',
      );
      membroIdCriado = membro.id;
      await tx.conviteConvenioMembro.update({
        where: { id: conviteResolved.id },
        data: { membroId: membro.id },
      });
    }

    return { cooperadoId: cooperado.id, ucId: uc.id, membroId: membroIdCriado };
  }

  it('A) sem token → não toca em conviteConvenioMembro nem chama adicionarMembro', async () => {
    const result = await trechoTx({ origem: 'ADMIN_MANUAL' });
    expect(tx.conviteConvenioMembro.findUnique).not.toHaveBeenCalled();
    expect(adicionarMembroMock).not.toHaveBeenCalled();
    expect(result.membroId).toBeNull();
    expect(result.cooperadoId).toBe('coop-novo');
  });

  it('B) token + CONVITE_PUBLICO + convite válido → consume-once + adicionarMembro + cross-ref', async () => {
    tx.conviteConvenioMembro.findUnique.mockResolvedValue({
      id: 'conv-1',
      convenioId: 'cv-1',
      usedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
    });
    tx.conviteConvenioMembro.update.mockResolvedValue({});
    adicionarMembroMock.mockResolvedValue({ id: 'membro-novo', status: 'PENDENTE_APROVACAO_EMPRESA' });

    const result = await trechoTx({ token: 'tok_ok', origem: 'CONVITE_PUBLICO' });

    // consume-once: usedAt setado com where usedAt:null
    const calls = tx.conviteConvenioMembro.update.mock.calls;
    const consumeOnceCall = calls.find((c) => c[0].where?.usedAt === null);
    expect(consumeOnceCall).toBeDefined();
    expect(consumeOnceCall![0].data.usedAt).toBeInstanceOf(Date);

    // adicionarMembro chamado com tx + CONVITE_PUBLICO
    expect(adicionarMembroMock).toHaveBeenCalledTimes(1);
    expect(adicionarMembroMock).toHaveBeenCalledWith(
      'cv-1',
      'coop-novo',
      undefined,
      tx,
      'CONVITE_PUBLICO',
    );

    // cross-ref convite.membroId
    const crossRefCall = calls.find((c) => c[0].data?.membroId === 'membro-novo');
    expect(crossRefCall).toBeDefined();
    expect(crossRefCall![0].where).toEqual({ id: 'conv-1' });

    expect(result.membroId).toBe('membro-novo');
  });

  it('C) convite inexistente → throw "Convite inválido ou expirado." ANTES de criar Cooperado', async () => {
    tx.conviteConvenioMembro.findUnique.mockResolvedValue(null);

    await expect(trechoTx({ token: 'tok_x', origem: 'CONVITE_PUBLICO' })).rejects.toThrow(
      'Convite inválido ou expirado.',
    );

    expect(tx.cooperado.create).not.toHaveBeenCalled();
    expect(tx.uc.create).not.toHaveBeenCalled();
    expect(adicionarMembroMock).not.toHaveBeenCalled();
  });

  it('D) convite já usado (usedAt setado) → throw "Convite já utilizado." ANTES de criar Cooperado', async () => {
    tx.conviteConvenioMembro.findUnique.mockResolvedValue({
      id: 'conv-1',
      convenioId: 'cv-1',
      usedAt: new Date(),
      expiresAt: new Date(Date.now() + 60_000),
    });

    await expect(trechoTx({ token: 'tok_x', origem: 'CONVITE_PUBLICO' })).rejects.toThrow(
      'Convite já utilizado.',
    );

    expect(tx.cooperado.create).not.toHaveBeenCalled();
  });

  it('E) convite expirado → throw "Convite expirado." ANTES de criar Cooperado', async () => {
    tx.conviteConvenioMembro.findUnique.mockResolvedValue({
      id: 'conv-1',
      convenioId: 'cv-1',
      usedAt: null,
      expiresAt: new Date(Date.now() - 60_000),
    });

    await expect(trechoTx({ token: 'tok_x', origem: 'CONVITE_PUBLICO' })).rejects.toThrow(
      'Convite expirado.',
    );

    expect(tx.cooperado.create).not.toHaveBeenCalled();
  });

  it('F) race condition consume-once (P2025) → throw "Convite já utilizado."', async () => {
    tx.conviteConvenioMembro.findUnique.mockResolvedValue({
      id: 'conv-1',
      convenioId: 'cv-1',
      usedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
    });
    // Update do consume-once falha com P2025 (linha foi consumida entre find e update)
    tx.conviteConvenioMembro.update.mockRejectedValueOnce(
      Object.assign(new Error('record not found'), { code: 'P2025' }),
    );

    await expect(trechoTx({ token: 'tok_x', origem: 'CONVITE_PUBLICO' })).rejects.toThrow(
      'Convite já utilizado.',
    );

    expect(tx.cooperado.create).not.toHaveBeenCalled();
  });

  it('G) adicionarMembro falha → erro propaga (tx será rollback pelo Postgres)', async () => {
    tx.conviteConvenioMembro.findUnique.mockResolvedValue({
      id: 'conv-1',
      convenioId: 'cv-1',
      usedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
    });
    tx.conviteConvenioMembro.update.mockResolvedValue({});
    adicionarMembroMock.mockRejectedValue(
      new Error('Cooperado já é membro de outro convênio ativo. Desvincule primeiro.'),
    );

    await expect(trechoTx({ token: 'tok_x', origem: 'CONVITE_PUBLICO' })).rejects.toThrow(
      'já é membro de outro',
    );

    // Cooperado já foi criado dentro do tx — rollback nativo Postgres cuidaria,
    // mas nos asserts confirmamos que o consume-once foi tentado.
    expect(tx.conviteConvenioMembro.update).toHaveBeenCalledTimes(1); // só o consume-once
  });

  it('H) cross-ref convite→membro usa membroId retornado por adicionarMembro', async () => {
    tx.conviteConvenioMembro.findUnique.mockResolvedValue({
      id: 'conv-99',
      convenioId: 'cv-99',
      usedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
    });
    tx.conviteConvenioMembro.update.mockResolvedValue({});
    adicionarMembroMock.mockResolvedValue({ id: 'membro-ID-CRUZADO', status: 'PENDENTE_APROVACAO_EMPRESA' });

    await trechoTx({ token: 'tok_ok', origem: 'CONVITE_PUBLICO' });

    const crossRef = tx.conviteConvenioMembro.update.mock.calls.find(
      (c) => c[0].data?.membroId !== undefined,
    );
    expect(crossRef![0].data.membroId).toBe('membro-ID-CRUZADO');
    expect(crossRef![0].where).toEqual({ id: 'conv-99' });
  });
});
