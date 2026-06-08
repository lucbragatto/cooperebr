/**
 * Specs LimiteTokenService — F2.5 Sprint Token-WA Fase 2.
 *
 * Cobre: limiteEfetivo (4 cenários — defaults/teto/auto/min), verificarValor
 * (ok / excede-transação / excede-diário / soma gastos), definirAutoLimite
 * (clamp pelo teto), definirTetoCooperativa (validações), multi-tenant.
 */

import { Test } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { LimiteTokenService } from './limite-token.service';
import { PrismaService } from '../prisma.service';

type CooperativaRow = {
  id: string;
  limiteTokenTransacaoTeto: Prisma.Decimal;
  limiteTokenDiarioTeto: Prisma.Decimal;
};

type CooperadoRow = {
  id: string;
  cooperativaId: string;
  limiteTokenTransacao: Prisma.Decimal | null;
  limiteTokenDiario: Prisma.Decimal | null;
};

type TransacaoRow = {
  pagadorId: string;
  pagadorCooperativaId: string;
  status: string;
  valorReaisEstimado: Prisma.Decimal;
  confirmadaEm: Date | null;
};

function dec(v: number): Prisma.Decimal {
  return new Prisma.Decimal(v);
}

function criarPrismaMock() {
  const cooperativas: Map<string, CooperativaRow> = new Map();
  const cooperados: Map<string, CooperadoRow> = new Map();
  const transacoes: TransacaoRow[] = [];

  const project = (row: any, select: any) => {
    if (!select) return row;
    const out: any = {};
    for (const k of Object.keys(select)) {
      if (select[k] === true) {
        out[k] = row[k];
      } else if (typeof select[k] === 'object' && select[k].select) {
        const rel = row[k];
        out[k] = rel ? project(rel, select[k].select) : null;
      }
    }
    return out;
  };

  return {
    cooperativas,
    cooperados,
    transacoes,
    cooperado: {
      findFirst: jest.fn(async ({ where, select }: any) => {
        const c = cooperados.get(where.id);
        if (!c) return null;
        if (where.cooperativaId && c.cooperativaId !== where.cooperativaId) return null;
        const enriched = {
          ...c,
          cooperativa: cooperativas.get(c.cooperativaId),
        };
        return project(enriched, select);
      }),
      update: jest.fn(async ({ where, data }: any) => {
        const c = cooperados.get(where.id);
        if (!c) throw new Error('cooperado não existe');
        for (const k of Object.keys(data)) (c as any)[k] = data[k];
        return c;
      }),
    },
    cooperativa: {
      findUnique: jest.fn(async ({ where, select }: any) => {
        const c = cooperativas.get(where.id);
        if (!c) return null;
        return project(c, select);
      }),
      update: jest.fn(async ({ where, data }: any) => {
        const c = cooperativas.get(where.id);
        if (!c) throw new Error('cooperativa não existe');
        for (const k of Object.keys(data)) (c as any)[k] = data[k];
        return c;
      }),
    },
    tokenTransacao: {
      aggregate: jest.fn(async ({ where, _sum }: any) => {
        const filtradas = transacoes.filter((t) => {
          if (t.pagadorId !== where.pagadorId) return false;
          if (t.pagadorCooperativaId !== where.pagadorCooperativaId) return false;
          if (t.status !== where.status) return false;
          if (where.confirmadaEm?.gte && (!t.confirmadaEm || t.confirmadaEm < where.confirmadaEm.gte)) {
            return false;
          }
          return true;
        });
        const total = filtradas.reduce(
          (acc, t) => acc.plus(t.valorReaisEstimado),
          new Prisma.Decimal(0),
        );
        return { _sum: { valorReaisEstimado: filtradas.length === 0 ? null : total } };
      }),
    },
  };
}

async function buildSut() {
  const prismaMock = criarPrismaMock();
  const module = await Test.createTestingModule({
    providers: [
      LimiteTokenService,
      { provide: PrismaService, useValue: prismaMock },
    ],
  }).compile();
  const sut = module.get(LimiteTokenService);
  return { sut, prismaMock };
}

function seedCoopRoot(
  prismaMock: any,
  cooperativa: { id: string; tetoTrans: number; tetoDiario: number },
  cooperado: {
    id: string;
    autoTrans?: number | null;
    autoDiario?: number | null;
  },
) {
  prismaMock.cooperativas.set(cooperativa.id, {
    id: cooperativa.id,
    limiteTokenTransacaoTeto: dec(cooperativa.tetoTrans),
    limiteTokenDiarioTeto: dec(cooperativa.tetoDiario),
  });
  prismaMock.cooperados.set(cooperado.id, {
    id: cooperado.id,
    cooperativaId: cooperativa.id,
    limiteTokenTransacao:
      cooperado.autoTrans === undefined || cooperado.autoTrans === null
        ? null
        : dec(cooperado.autoTrans),
    limiteTokenDiario:
      cooperado.autoDiario === undefined || cooperado.autoDiario === null
        ? null
        : dec(cooperado.autoDiario),
  });
}

describe('LimiteTokenService', () => {
  describe('limiteEfetivo', () => {
    it('usa teto cooperativa quando auto null', async () => {
      const { sut, prismaMock } = await buildSut();
      seedCoopRoot(
        prismaMock,
        { id: 'tenantA', tetoTrans: 500, tetoDiario: 2000 },
        { id: 'coop1' },
      );
      const r = await sut.limiteEfetivo({ cooperadoId: 'coop1', cooperativaId: 'tenantA' });
      expect(r.limiteTransacao).toBe(500);
      expect(r.limiteDiario).toBe(2000);
      expect(r.origemTransacao).toBe('COOPERATIVA');
      expect(r.origemDiario).toBe('COOPERATIVA');
    });

    it('usa auto-limite quando menor que teto', async () => {
      const { sut, prismaMock } = await buildSut();
      seedCoopRoot(
        prismaMock,
        { id: 'tenantA', tetoTrans: 500, tetoDiario: 2000 },
        { id: 'coop1', autoTrans: 200, autoDiario: 1000 },
      );
      const r = await sut.limiteEfetivo({ cooperadoId: 'coop1', cooperativaId: 'tenantA' });
      expect(r.limiteTransacao).toBe(200);
      expect(r.limiteDiario).toBe(1000);
      expect(r.origemTransacao).toBe('COOPERADO');
      expect(r.origemDiario).toBe('COOPERADO');
    });

    it('clampa auto-limite ao teto quando excede', async () => {
      // Cooperativa baixa teto APÓS cooperado ter definido auto-limite maior.
      const { sut, prismaMock } = await buildSut();
      seedCoopRoot(
        prismaMock,
        { id: 'tenantA', tetoTrans: 300, tetoDiario: 1500 },
        { id: 'coop1', autoTrans: 500, autoDiario: 2000 },
      );
      const r = await sut.limiteEfetivo({ cooperadoId: 'coop1', cooperativaId: 'tenantA' });
      expect(r.limiteTransacao).toBe(300);
      expect(r.limiteDiario).toBe(1500);
      expect(r.origemTransacao).toBe('COOPERATIVA');
      expect(r.origemDiario).toBe('COOPERATIVA');
    });

    it('404 anti-IDOR cross-tenant', async () => {
      const { sut, prismaMock } = await buildSut();
      seedCoopRoot(
        prismaMock,
        { id: 'tenantA', tetoTrans: 500, tetoDiario: 2000 },
        { id: 'coop1' },
      );
      await expect(
        sut.limiteEfetivo({ cooperadoId: 'coop1', cooperativaId: 'tenantB' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('verificarValor', () => {
    it('ok quando valor dentro dos limites e sem gasto hoje', async () => {
      const { sut, prismaMock } = await buildSut();
      seedCoopRoot(
        prismaMock,
        { id: 'tenantA', tetoTrans: 500, tetoDiario: 2000 },
        { id: 'coop1' },
      );
      const r = await sut.verificarValor({
        cooperadoId: 'coop1',
        cooperativaId: 'tenantA',
        valorReais: 100,
      });
      expect(r.ok).toBe(true);
      if (r.ok) {
        expect(r.gastoHoje).toBe(0);
        expect(r.saldoDisponivel).toBe(2000);
      }
    });

    it('excede limite por transação', async () => {
      const { sut, prismaMock } = await buildSut();
      seedCoopRoot(
        prismaMock,
        { id: 'tenantA', tetoTrans: 500, tetoDiario: 2000 },
        { id: 'coop1' },
      );
      const r = await sut.verificarValor({
        cooperadoId: 'coop1',
        cooperativaId: 'tenantA',
        valorReais: 600,
      });
      expect(r.ok).toBe(false);
      expect((r as any).motivo).toBe('EXCEDE_LIMITE_TRANSACAO');
    });

    it('excede limite diário considerando gastos do dia', async () => {
      const { sut, prismaMock } = await buildSut();
      seedCoopRoot(
        prismaMock,
        { id: 'tenantA', tetoTrans: 500, tetoDiario: 1000 },
        { id: 'coop1' },
      );
      const inicio = new Date();
      inicio.setHours(10, 0, 0, 0);
      prismaMock.transacoes.push(
        {
          pagadorId: 'coop1',
          pagadorCooperativaId: 'tenantA',
          status: 'CONFIRMADA',
          valorReaisEstimado: dec(400),
          confirmadaEm: inicio,
        },
        {
          pagadorId: 'coop1',
          pagadorCooperativaId: 'tenantA',
          status: 'CONFIRMADA',
          valorReaisEstimado: dec(400),
          confirmadaEm: new Date(inicio.getTime() + 60_000),
        },
      );
      const r = await sut.verificarValor({
        cooperadoId: 'coop1',
        cooperativaId: 'tenantA',
        valorReais: 300,
      });
      expect(r.ok).toBe(false);
      if (!r.ok && r.motivo === 'EXCEDE_LIMITE_DIARIO') {
        expect(r.limiteDiario).toBe(1000);
        expect(r.gastoHoje).toBe(800);
      }
    });

    it('ignora transações de ontem (cutoff inicio do dia)', async () => {
      const { sut, prismaMock } = await buildSut();
      seedCoopRoot(
        prismaMock,
        { id: 'tenantA', tetoTrans: 500, tetoDiario: 1000 },
        { id: 'coop1' },
      );
      const ontem = new Date(Date.now() - 25 * 60 * 60 * 1000);
      prismaMock.transacoes.push({
        pagadorId: 'coop1',
        pagadorCooperativaId: 'tenantA',
        status: 'CONFIRMADA',
        valorReaisEstimado: dec(900),
        confirmadaEm: ontem,
      });
      const r = await sut.verificarValor({
        cooperadoId: 'coop1',
        cooperativaId: 'tenantA',
        valorReais: 100,
      });
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.gastoHoje).toBe(0);
    });

    it('ignora transações CANCELADAS', async () => {
      const { sut, prismaMock } = await buildSut();
      seedCoopRoot(
        prismaMock,
        { id: 'tenantA', tetoTrans: 500, tetoDiario: 1000 },
        { id: 'coop1' },
      );
      prismaMock.transacoes.push({
        pagadorId: 'coop1',
        pagadorCooperativaId: 'tenantA',
        status: 'CANCELADA',
        valorReaisEstimado: dec(900),
        confirmadaEm: new Date(),
      });
      const r = await sut.verificarValor({
        cooperadoId: 'coop1',
        cooperativaId: 'tenantA',
        valorReais: 100,
      });
      expect(r.ok).toBe(true);
    });

    it('rejeita valor zero ou negativo', async () => {
      const { sut, prismaMock } = await buildSut();
      seedCoopRoot(
        prismaMock,
        { id: 'tenantA', tetoTrans: 500, tetoDiario: 2000 },
        { id: 'coop1' },
      );
      await expect(
        sut.verificarValor({ cooperadoId: 'coop1', cooperativaId: 'tenantA', valorReais: 0 }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('definirAutoLimiteCooperado', () => {
    it('permite valor ≤ teto', async () => {
      const { sut, prismaMock } = await buildSut();
      seedCoopRoot(
        prismaMock,
        { id: 'tenantA', tetoTrans: 500, tetoDiario: 2000 },
        { id: 'coop1' },
      );
      await sut.definirAutoLimiteCooperado({
        cooperadoId: 'coop1',
        cooperativaId: 'tenantA',
        limiteTransacao: 200,
        limiteDiario: 1000,
      });
      expect(Number(prismaMock.cooperados.get('coop1')!.limiteTokenTransacao)).toBe(200);
    });

    it('rejeita valor > teto', async () => {
      const { sut, prismaMock } = await buildSut();
      seedCoopRoot(
        prismaMock,
        { id: 'tenantA', tetoTrans: 500, tetoDiario: 2000 },
        { id: 'coop1' },
      );
      await expect(
        sut.definirAutoLimiteCooperado({
          cooperadoId: 'coop1',
          cooperativaId: 'tenantA',
          limiteTransacao: 700,
          limiteDiario: 1000,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('permite null pra remover auto-limite', async () => {
      const { sut, prismaMock } = await buildSut();
      seedCoopRoot(
        prismaMock,
        { id: 'tenantA', tetoTrans: 500, tetoDiario: 2000 },
        { id: 'coop1', autoTrans: 200, autoDiario: 1000 },
      );
      await sut.definirAutoLimiteCooperado({
        cooperadoId: 'coop1',
        cooperativaId: 'tenantA',
        limiteTransacao: null,
        limiteDiario: null,
      });
      expect(prismaMock.cooperados.get('coop1')!.limiteTokenTransacao).toBeNull();
    });
  });

  describe('definirTetoCooperativa', () => {
    it('atualiza tetos', async () => {
      const { sut, prismaMock } = await buildSut();
      seedCoopRoot(
        prismaMock,
        { id: 'tenantA', tetoTrans: 500, tetoDiario: 2000 },
        { id: 'coop1' },
      );
      await sut.definirTetoCooperativa({
        cooperativaId: 'tenantA',
        limiteTransacaoTeto: 1000,
        limiteDiarioTeto: 5000,
      });
      expect(Number(prismaMock.cooperativas.get('tenantA')!.limiteTokenTransacaoTeto)).toBe(1000);
    });

    it('rejeita teto diário < teto por transação', async () => {
      const { sut, prismaMock } = await buildSut();
      seedCoopRoot(
        prismaMock,
        { id: 'tenantA', tetoTrans: 500, tetoDiario: 2000 },
        { id: 'coop1' },
      );
      await expect(
        sut.definirTetoCooperativa({
          cooperativaId: 'tenantA',
          limiteTransacaoTeto: 1000,
          limiteDiarioTeto: 500,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('404 cooperativa inexistente', async () => {
      const { sut } = await buildSut();
      await expect(
        sut.definirTetoCooperativa({
          cooperativaId: 'fantasma',
          limiteTransacaoTeto: 500,
          limiteDiarioTeto: 2000,
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
