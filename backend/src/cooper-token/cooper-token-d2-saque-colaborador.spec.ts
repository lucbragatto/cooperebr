/**
 * Sprint D2 (16/06/2026) — Saque PIX Colaborador Comum.
 *
 * Cobre o gate dual em `CooperTokenService.solicitarResgate` que permite
 * cooperado NÃO-Estabelecimento solicitar resgate PIX quando:
 *  (A) `Cooperativa.saqueColaboradorAtivo === true` (SUPER_ADMIN liga), E
 *  (B) `!isAmbienteReal() || SAQUE_COLABORADOR_PRODUCAO_LIBERADO === 'true'`.
 *
 * Espelha o gate da oxidação (OXIDACAO_PRODUCAO_LIBERADA). Toggle nasce OFF;
 * ligar em produção exige parecer escrito do cooperebr-analista-conformidade.
 *
 * Cenários cobertos:
 *  1. cooperado-comum + flag OFF + env qualquer  → Forbidden
 *  2. cooperado-comum + flag ON  + ambiente NÃO-real → OK (passa do guard)
 *  3. cooperado-comum + flag ON  + ambiente REAL + env OFF → Forbidden
 *  4. cooperado-comum + flag ON  + ambiente REAL + env ON  → OK
 *  5. estabelecimento (ignora flag, comportamento legado preservado)  → OK
 *  6. mensagem genérica não revela qual gate está OFF (anti-enumeração)
 */
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { CooperTokenService } from './cooper-token.service';

const COLABORADOR = 'coop-pf-1';
const COOP = 'coop-A';

interface SetupD2Opts {
  cooperadoEhEstab?: boolean;
  saqueColaboradorAtivo?: boolean;
}

function setupD2(opts: SetupD2Opts = {}) {
  const ehEstab = opts.cooperadoEhEstab ?? false;
  const flagSaqueColab = opts.saqueColaboradorAtivo ?? false;

  const updateMany = jest.fn().mockResolvedValue({ count: 1 });
  const txCreateLedger = jest.fn().mockResolvedValue({ id: 'ledger-1' });
  const txUpdateSaldo = jest.fn().mockResolvedValue({});
  const txCreateRecibo = jest.fn().mockResolvedValue({
    id: 'recibo-1',
    numeroRecibo: 'RES-2026-00001',
    status: 'PENDENTE_APROVACAO_COOP',
    cooperativaId: COOP,
    cooperadoEstabelecimentoId: COLABORADOR,
    valorBrutoTokens: 10,
    valorLiquidoTokens: 10,
    valorBrutoReais: 4.5,
    valorLiquidoReais: 4.5,
    pixChave: '+5527981341348',
    pixTipo: 'TELEFONE',
  });

  const txFindSaldo = jest.fn().mockImplementation(() =>
    Promise.resolve({
      cooperadoId: COLABORADOR,
      saldoDisponivel: 100,
      saldoBloqueadoResgate: 0,
    }),
  );

  const tx: any = {
    cooperTokenSaldo: {
      findUnique: txFindSaldo,
      update: txUpdateSaldo,
      updateMany: txUpdateSaldo,
    },
    cooperTokenLedger: { create: txCreateLedger },
    resgateRecibo: { create: txCreateRecibo, update: jest.fn().mockResolvedValue({}), updateMany },
    resgateReciboCounter: {
      upsert: jest.fn().mockResolvedValue({}),
      update: jest.fn().mockResolvedValue({ proximoNumero: 2 }),
    },
  };

  const prisma: any = {
    $transaction: jest.fn(async (cb: any) => cb(tx)),
    cooperado: {
      findFirst: jest.fn().mockResolvedValue({
        id: COLABORADOR,
        nomeCompleto: ehEstab ? 'Padaria Maria' : 'Maria Silva (colaboradora)',
        status: 'ATIVO',
        ehEstabelecimento: ehEstab,
        pixChave: '+5527981341348',
        pixTipo: 'TELEFONE',
      }),
    },
    cooperativa: {
      findUnique: jest
        .fn()
        .mockResolvedValue({ saqueColaboradorAtivo: flagSaqueColab }),
    },
    cooperTokenSaldo: { findUnique: txFindSaldo },
    resgateRecibo: {
      findUnique: jest.fn().mockResolvedValue(null),
      findFirst: jest.fn().mockResolvedValue(null),
      updateMany,
      update: jest.fn().mockResolvedValue({}),
    },
    configCooperToken: { findUnique: jest.fn().mockResolvedValue(null) },
  };

  const pin = { validarPinComLockout: jest.fn().mockResolvedValue({ ok: true }) };
  const limite = {
    verificarValor: jest
      .fn()
      .mockResolvedValue({ ok: true, limiteEfetivo: 5000, gastoHoje: 0, saldoDisponivel: 5000 }),
  };
  const otp = { validarOuLancar: jest.fn().mockResolvedValue(undefined) };
  const pixOut = {
    transferir: jest
      .fn()
      .mockResolvedValue({ asaasTransferId: 'asaas-tx-1', status: 'PENDING', raw: null }),
  };

  const service = new CooperTokenService(
    prisma,
    { emit: jest.fn() } as any,
    undefined,
    pin as any,
    otp as any,
    limite as any,
    pixOut as any,
  );

  return { service, prisma };
}

const baseInput = {
  estabelecimentoCooperadoId: COLABORADOR,
  cooperativaId: COOP,
  quantidade: 10,
  pin: '123456',
  clientRequestId: 'uuid-d2-12345678-test-1234-9999-aaaabbbbcccc',
};

describe('D2 — Saque PIX Colaborador (gate dual flag tenant + env produção)', () => {
  // Backup env pra restaurar.
  const ENV_BACKUP = { ...process.env };
  afterEach(() => {
    process.env = { ...ENV_BACKUP };
  });

  // ───────────────────────────────────────────────────────────────────
  // Caso 1 — flag OFF: SEMPRE bloqueia cooperado-comum (independente env).
  // ───────────────────────────────────────────────────────────────────
  it('flag OFF + cooperado-comum → Forbidden mesmo com env=true', async () => {
    process.env.SAQUE_COLABORADOR_PRODUCAO_LIBERADO = 'true';
    const { service } = setupD2({ cooperadoEhEstab: false, saqueColaboradorAtivo: false });
    await expect(service.solicitarResgate(baseInput)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  // ───────────────────────────────────────────────────────────────────
  // Caso 2 — flag ON + ambiente NÃO-real → libera (dev/sandbox).
  // ───────────────────────────────────────────────────────────────────
  it('flag ON + ambiente NÃO-real (sem AMBIENTE_REAL) → passa do guard', async () => {
    delete process.env.AMBIENTE_REAL;
    process.env.SAQUE_COLABORADOR_PRODUCAO_LIBERADO = 'false';
    const { service } = setupD2({ cooperadoEhEstab: false, saqueColaboradorAtivo: true });
    // Não-Forbidden — pode falhar mais adiante por outros guards mas o ponto
    // é validar que o guard D2 deixou passar. Aqui esperamos OK (mock retorna
    // valido até o fim).
    const r = await service.solicitarResgate(baseInput);
    expect(r.idempotente).toBe(false);
    expect(r.recibo).toBeDefined();
  });

  // ───────────────────────────────────────────────────────────────────
  // Caso 3 — flag ON + ambiente REAL + env OFF → Forbidden.
  // ───────────────────────────────────────────────────────────────────
  it('flag ON + AMBIENTE_REAL=true + env LIBERADO=false → Forbidden', async () => {
    process.env.AMBIENTE_REAL = 'true';
    process.env.SAQUE_COLABORADOR_PRODUCAO_LIBERADO = 'false';
    const { service } = setupD2({ cooperadoEhEstab: false, saqueColaboradorAtivo: true });
    await expect(service.solicitarResgate(baseInput)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  // ───────────────────────────────────────────────────────────────────
  // Caso 4 — flag ON + ambiente REAL + env ON → libera (gate completo).
  // ───────────────────────────────────────────────────────────────────
  it('flag ON + AMBIENTE_REAL=true + env LIBERADO=true → passa do guard', async () => {
    process.env.AMBIENTE_REAL = 'true';
    process.env.SAQUE_COLABORADOR_PRODUCAO_LIBERADO = 'true';
    const { service } = setupD2({ cooperadoEhEstab: false, saqueColaboradorAtivo: true });
    const r = await service.solicitarResgate(baseInput);
    expect(r.recibo).toBeDefined();
  });

  // ───────────────────────────────────────────────────────────────────
  // Caso 5 — Estabelecimento: ignora flag/env (comportamento legado).
  // ───────────────────────────────────────────────────────────────────
  it('estabelecimento passa SEM consultar flag (comportamento legado preservado)', async () => {
    process.env.AMBIENTE_REAL = 'true';
    process.env.SAQUE_COLABORADOR_PRODUCAO_LIBERADO = 'false';
    const { service, prisma } = setupD2({
      cooperadoEhEstab: true,
      saqueColaboradorAtivo: false,
    });
    const r = await service.solicitarResgate(baseInput);
    expect(r.recibo).toBeDefined();
    // Defesa: o gate D2 não foi consultado pra estabelecimento.
    expect(prisma.cooperativa.findUnique).not.toHaveBeenCalled();
  });

  // ───────────────────────────────────────────────────────────────────
  // Caso 6 — Mensagem genérica não revela qual gate está OFF.
  // ───────────────────────────────────────────────────────────────────
  it('mensagem do Forbidden é a mesma pra flag OFF ou env OFF (anti-enumeração)', async () => {
    process.env.AMBIENTE_REAL = 'true';
    // Cenário A: flag OFF, env ON.
    process.env.SAQUE_COLABORADOR_PRODUCAO_LIBERADO = 'true';
    const { service: svc1 } = setupD2({
      cooperadoEhEstab: false,
      saqueColaboradorAtivo: false,
    });
    let msg1 = '';
    try {
      await svc1.solicitarResgate(baseInput);
    } catch (e: any) {
      msg1 = e.message;
    }
    // Cenário B: flag ON, env OFF.
    process.env.SAQUE_COLABORADOR_PRODUCAO_LIBERADO = 'false';
    const { service: svc2 } = setupD2({
      cooperadoEhEstab: false,
      saqueColaboradorAtivo: true,
    });
    let msg2 = '';
    try {
      await svc2.solicitarResgate(baseInput);
    } catch (e: any) {
      msg2 = e.message;
    }
    expect(msg1).toBe(msg2);
    expect(msg1).toMatch(/Resgate em PIX bloqueado/);
  });
});
