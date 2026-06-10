/**
 * Sprint Clube P1 — Fase 1.5 Bloco 3 (10/06/2026).
 *
 * Specs de `aplicarOxidacao` + `upsertConfig` (carimbo oxidacaoAtivadaEm).
 *
 * Cobre as 3 invariantes inegociaveis declaradas no service:
 *  1. PROSPECTIVIDADE: tokens com ledger.createdAt < oxidacaoAtivadaEm NUNCA
 *     sao oxidados.
 *  2. PERIODO DE GRACA: tokens emitidos a menos de oxidacaoPeriodoGracaDias
 *     dias atras NUNCA sao oxidados.
 *  3. PISO: saldoDisponivel apos oxidacao NUNCA cai abaixo de oxidacaoPiso.
 *
 * + carimbo automatico de oxidacaoAtivadaEm em upsertConfig (carimba ao ligar,
 *   limpa ao desligar, preserva ao so alterar a porcentagem).
 */
import { CooperTokenService } from './cooper-token.service';
import { CooperTokenOperacao } from '@prisma/client';

const COOP_ID = 'coop-A';
const COOPERADO_A = 'coopd-A';

const buildPrisma = (opts: {
  config?: any;
  saldos?: Array<{ cooperadoId: string; saldoDisponivel: number }>;
  ledgerSums?: Array<{ cooperadoId: string; preMarco: number; emGraca: number }>;
  configAtualUpsert?: any;
}) => {
  const txSaldoUpdate = jest.fn().mockResolvedValue({});
  const txLedgerCreate = jest.fn().mockResolvedValue({});

  const tx = {
    cooperTokenSaldo: { update: txSaldoUpdate },
    cooperTokenLedger: { create: txLedgerCreate },
  };

  const prisma: any = {
    configCooperToken: {
      findUnique: jest.fn(({ where, select }: any) => {
        // upsertConfig usa findUnique com select { oxidacaoPercMes, oxidacaoAtivadaEm }
        if (select && select.oxidacaoPercMes) {
          return Promise.resolve(opts.configAtualUpsert ?? null);
        }
        return Promise.resolve(opts.config ?? null);
      }),
      upsert: jest.fn((args: any) => Promise.resolve({ ...args.update, ...args.create })),
    },
    cooperTokenSaldo: {
      findMany: jest.fn().mockResolvedValue(opts.saldos ?? []),
    },
    cooperTokenLedger: {
      aggregate: jest.fn(({ where }: any) => {
        const cooperadoId = where.cooperadoId;
        const sum = opts.ledgerSums?.find((s) => s.cooperadoId === cooperadoId);
        if (!sum) return Promise.resolve({ _sum: { quantidade: 0 } });
        // Discriminar pre-marco vs em-graca pelo predicate do where.createdAt
        if (where.createdAt?.lt) {
          return Promise.resolve({ _sum: { quantidade: sum.preMarco } });
        }
        if (where.createdAt?.gt) {
          return Promise.resolve({ _sum: { quantidade: sum.emGraca } });
        }
        return Promise.resolve({ _sum: { quantidade: 0 } });
      }),
    },
    $transaction: jest.fn((cb: any) => cb(tx)),
  };

  return { prisma, txSaldoUpdate, txLedgerCreate, tx };
};

const buildService = (prismaMock: any) => {
  const eventMock = { emit: jest.fn() } as any;
  return new CooperTokenService(prismaMock, eventMock);
};

describe('CooperTokenService.aplicarOxidacao — F1.5 Bloco 3', () => {
  describe('Desligada / config ausente', () => {
    it('config null → skip (0 afetados)', async () => {
      const { prisma } = buildPrisma({ config: null });
      const service = buildService(prisma);
      const r = await service.aplicarOxidacao(COOP_ID);
      expect(r).toEqual({ cooperadosAfetados: 0, totalTokensReduzidos: 0 });
    });

    it('oxidacaoPercMes = 0 → skip mesmo com saldo > 0', async () => {
      const { prisma, txSaldoUpdate } = buildPrisma({
        config: { oxidacaoPercMes: 0, oxidacaoAtivadaEm: new Date() },
      });
      const service = buildService(prisma);
      const r = await service.aplicarOxidacao(COOP_ID);
      expect(r.cooperadosAfetados).toBe(0);
      expect(txSaldoUpdate).not.toHaveBeenCalled();
    });

    it('oxidacaoPercMes > 0 mas oxidacaoAtivadaEm null → skip', async () => {
      const { prisma, txSaldoUpdate } = buildPrisma({
        config: { oxidacaoPercMes: 5, oxidacaoAtivadaEm: null },
      });
      const service = buildService(prisma);
      const r = await service.aplicarOxidacao(COOP_ID);
      expect(r.cooperadosAfetados).toBe(0);
      expect(txSaldoUpdate).not.toHaveBeenCalled();
    });
  });

  describe('Invariante 1 — PROSPECTIVIDADE (tokens pre-marco preservados)', () => {
    it('saldo 100 todo pre-marco → 0 oxidacao (saldoElegivel=0)', async () => {
      const { prisma, txSaldoUpdate } = buildPrisma({
        config: {
          oxidacaoPercMes: 10,
          oxidacaoPeriodoGracaDias: 0,
          oxidacaoPiso: 0,
          oxidacaoAtivadaEm: new Date('2026-06-01'),
        },
        saldos: [{ cooperadoId: COOPERADO_A, saldoDisponivel: 100 }],
        ledgerSums: [{ cooperadoId: COOPERADO_A, preMarco: 100, emGraca: 0 }],
      });
      const service = buildService(prisma);
      const r = await service.aplicarOxidacao(COOP_ID);
      expect(r.cooperadosAfetados).toBe(0);
      expect(r.totalTokensReduzidos).toBe(0);
      expect(txSaldoUpdate).not.toHaveBeenCalled();
    });

    it('saldo 100 = 60 pre-marco + 40 pos-marco → oxida 10% de 40 = 4', async () => {
      const { prisma, txSaldoUpdate, txLedgerCreate } = buildPrisma({
        config: {
          oxidacaoPercMes: 10,
          oxidacaoPeriodoGracaDias: 0,
          oxidacaoPiso: 0,
          oxidacaoAtivadaEm: new Date('2026-06-01'),
        },
        saldos: [{ cooperadoId: COOPERADO_A, saldoDisponivel: 100 }],
        ledgerSums: [{ cooperadoId: COOPERADO_A, preMarco: 60, emGraca: 0 }],
      });
      const service = buildService(prisma);
      const r = await service.aplicarOxidacao(COOP_ID);
      expect(r.cooperadosAfetados).toBe(1);
      expect(r.totalTokensReduzidos).toBe(4);
      expect(txSaldoUpdate).toHaveBeenCalledWith({
        where: { cooperadoId: COOPERADO_A },
        data: { saldoDisponivel: 96 },
      });
      // Audit trail no ledger com operacao OXIDACAO
      expect(txLedgerCreate).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          operacao: CooperTokenOperacao.OXIDACAO,
          quantidade: 4,
          saldoApos: 96,
        }),
      }));
    });
  });

  describe('Invariante 2 — PERIODO DE GRACA (tokens recentes preservados)', () => {
    it('saldo 100 todo em graca → 0 oxidacao', async () => {
      const { prisma, txSaldoUpdate } = buildPrisma({
        config: {
          oxidacaoPercMes: 10,
          oxidacaoPeriodoGracaDias: 30,
          oxidacaoPiso: 0,
          oxidacaoAtivadaEm: new Date('2026-01-01'),
        },
        saldos: [{ cooperadoId: COOPERADO_A, saldoDisponivel: 100 }],
        ledgerSums: [{ cooperadoId: COOPERADO_A, preMarco: 0, emGraca: 100 }],
      });
      const service = buildService(prisma);
      const r = await service.aplicarOxidacao(COOP_ID);
      expect(r.cooperadosAfetados).toBe(0);
      expect(txSaldoUpdate).not.toHaveBeenCalled();
    });

    it('saldo 100 = 30 em graca + 70 elegivel → oxida 10% de 70 = 7', async () => {
      const { prisma, txSaldoUpdate } = buildPrisma({
        config: {
          oxidacaoPercMes: 10,
          oxidacaoPeriodoGracaDias: 30,
          oxidacaoPiso: 0,
          oxidacaoAtivadaEm: new Date('2026-01-01'),
        },
        saldos: [{ cooperadoId: COOPERADO_A, saldoDisponivel: 100 }],
        ledgerSums: [{ cooperadoId: COOPERADO_A, preMarco: 0, emGraca: 30 }],
      });
      const service = buildService(prisma);
      const r = await service.aplicarOxidacao(COOP_ID);
      expect(r.cooperadosAfetados).toBe(1);
      expect(r.totalTokensReduzidos).toBe(7);
      expect(txSaldoUpdate).toHaveBeenCalledWith({
        where: { cooperadoId: COOPERADO_A },
        data: { saldoDisponivel: 93 },
      });
    });
  });

  describe('Invariante 3 — PISO (saldo nunca cai abaixo)', () => {
    it('saldo ja igual ao piso → skip (saldoAtual <= piso early return)', async () => {
      const { prisma, txSaldoUpdate } = buildPrisma({
        config: {
          oxidacaoPercMes: 50,
          oxidacaoPeriodoGracaDias: 0,
          oxidacaoPiso: 10,
          oxidacaoAtivadaEm: new Date('2026-01-01'),
        },
        saldos: [{ cooperadoId: COOPERADO_A, saldoDisponivel: 10 }],
        ledgerSums: [{ cooperadoId: COOPERADO_A, preMarco: 0, emGraca: 0 }],
      });
      const service = buildService(prisma);
      const r = await service.aplicarOxidacao(COOP_ID);
      expect(r.cooperadosAfetados).toBe(0);
      expect(txSaldoUpdate).not.toHaveBeenCalled();
    });

    it('decay total > piso → clampa em piso (reducao = saldoAtual - piso)', async () => {
      const { prisma, txSaldoUpdate, txLedgerCreate } = buildPrisma({
        config: {
          oxidacaoPercMes: 50,
          oxidacaoPeriodoGracaDias: 0,
          oxidacaoPiso: 80,
          oxidacaoAtivadaEm: new Date('2026-01-01'),
        },
        saldos: [{ cooperadoId: COOPERADO_A, saldoDisponivel: 100 }],
        ledgerSums: [{ cooperadoId: COOPERADO_A, preMarco: 0, emGraca: 0 }],
      });
      const service = buildService(prisma);
      const r = await service.aplicarOxidacao(COOP_ID);
      // decaimento bruto = 100 * 50% = 50 → novoSaldo = max(50, 80) = 80
      // reducaoReal = 100 - 80 = 20
      expect(r.cooperadosAfetados).toBe(1);
      expect(r.totalTokensReduzidos).toBe(20);
      expect(txSaldoUpdate).toHaveBeenCalledWith({
        where: { cooperadoId: COOPERADO_A },
        data: { saldoDisponivel: 80 },
      });
      expect(txLedgerCreate).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ quantidade: 20, saldoApos: 80 }),
      }));
    });
  });

  describe('Multi-cooperado + Math.round', () => {
    it('2 cooperados → soma cooperadosAfetados + totalReduzido', async () => {
      const { prisma } = buildPrisma({
        config: {
          oxidacaoPercMes: 10,
          oxidacaoPeriodoGracaDias: 0,
          oxidacaoPiso: 0,
          oxidacaoAtivadaEm: new Date('2026-01-01'),
        },
        saldos: [
          { cooperadoId: 'c1', saldoDisponivel: 100 },
          { cooperadoId: 'c2', saldoDisponivel: 200 },
        ],
        ledgerSums: [
          { cooperadoId: 'c1', preMarco: 0, emGraca: 0 },
          { cooperadoId: 'c2', preMarco: 0, emGraca: 0 },
        ],
      });
      const service = buildService(prisma);
      const r = await service.aplicarOxidacao(COOP_ID);
      expect(r.cooperadosAfetados).toBe(2);
      expect(r.totalTokensReduzidos).toBe(30); // 10 + 20
    });

    it('saldo 33 + 1% → reducao 0.33 sem ruido float', async () => {
      const { prisma } = buildPrisma({
        config: {
          oxidacaoPercMes: 1,
          oxidacaoPeriodoGracaDias: 0,
          oxidacaoPiso: 0,
          oxidacaoAtivadaEm: new Date('2026-01-01'),
        },
        saldos: [{ cooperadoId: COOPERADO_A, saldoDisponivel: 33 }],
        ledgerSums: [{ cooperadoId: COOPERADO_A, preMarco: 0, emGraca: 0 }],
      });
      const service = buildService(prisma);
      const r = await service.aplicarOxidacao(COOP_ID);
      expect(r.totalTokensReduzidos).toBe(0.33);
    });
  });
});

describe('CooperTokenService.upsertConfig — F1.5 Bloco 3 carimbo oxidacaoAtivadaEm', () => {
  it('ligar (0 → 5) carimba oxidacaoAtivadaEm com a data atual', async () => {
    const before = new Date();
    const { prisma } = buildPrisma({
      configAtualUpsert: { oxidacaoPercMes: 0, oxidacaoAtivadaEm: null },
    });
    const service = buildService(prisma);
    await service.upsertConfig(COOP_ID, { oxidacaoPercMes: 5 });
    const after = new Date();
    const args = prisma.configCooperToken.upsert.mock.calls[0][0];
    expect(args.update.oxidacaoAtivadaEm).toBeInstanceOf(Date);
    expect(args.update.oxidacaoAtivadaEm.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(args.update.oxidacaoAtivadaEm.getTime()).toBeLessThanOrEqual(after.getTime());
  });

  it('desligar (5 → 0) limpa oxidacaoAtivadaEm pra null', async () => {
    const { prisma } = buildPrisma({
      configAtualUpsert: { oxidacaoPercMes: 5, oxidacaoAtivadaEm: new Date('2026-01-01') },
    });
    const service = buildService(prisma);
    await service.upsertConfig(COOP_ID, { oxidacaoPercMes: 0 });
    const args = prisma.configCooperToken.upsert.mock.calls[0][0];
    expect(args.update.oxidacaoAtivadaEm).toBeNull();
  });

  it('alterar perc sem zerar (5 → 8) PRESERVA o marco original (nao recarimba)', async () => {
    const marcoOriginal = new Date('2026-01-01');
    const { prisma } = buildPrisma({
      configAtualUpsert: { oxidacaoPercMes: 5, oxidacaoAtivadaEm: marcoOriginal },
    });
    const service = buildService(prisma);
    await service.upsertConfig(COOP_ID, { oxidacaoPercMes: 8 });
    const args = prisma.configCooperToken.upsert.mock.calls[0][0];
    // oxidacaoAtivadaEm NAO esta no update — sinal de que preserva.
    expect(args.update.oxidacaoAtivadaEm).toBeUndefined();
  });

  it('upsert sem mexer em oxidacaoPercMes nao toca em oxidacaoAtivadaEm', async () => {
    const { prisma } = buildPrisma({
      configAtualUpsert: { oxidacaoPercMes: 5, oxidacaoAtivadaEm: new Date() },
    });
    const service = buildService(prisma);
    await service.upsertConfig(COOP_ID, { taxaEmissaoPerc: 3 });
    const args = prisma.configCooperToken.upsert.mock.calls[0][0];
    expect(args.update.oxidacaoAtivadaEm).toBeUndefined();
  });
});
