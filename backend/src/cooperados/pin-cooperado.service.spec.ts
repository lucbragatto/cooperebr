/**
 * Specs PinCooperadoService — F2.3 Sprint Token-WA Fase 2.
 *
 * Cobre: definir, validar (puro), validarComLockout (com efeitos),
 * alterar, resetar, temPin, multi-tenant (anti-IDOR), rate-limit,
 * lockout 15min.
 */

import { Test } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PinCooperadoService } from './pin-cooperado.service';
import { PrismaService } from '../prisma.service';

type CooperadoRow = {
  id: string;
  cooperativaId: string;
  pinHash: string | null;
  pinSalt: string | null;
  pinTentativas: number;
  pinBloqueadoAte: Date | null;
  pinDefinidoEm: Date | null;
};

/**
 * Mock Prisma in-memory simples — mantém estado de cooperados pra simular
 * race + update incremental sem precisar de banco real.
 */
function criarPrismaMock() {
  const cooperados: Map<string, CooperadoRow> = new Map();

  return {
    cooperados,
    cooperado: {
      findFirst: jest.fn(async ({ where, select }: any) => {
        const c = cooperados.get(where.id);
        if (!c) return null;
        if (where.cooperativaId && c.cooperativaId !== where.cooperativaId) {
          return null;
        }
        if (select) {
          const out: any = {};
          for (const k of Object.keys(select)) out[k] = (c as any)[k];
          return out;
        }
        return c;
      }),
      update: jest.fn(async ({ where, data, select }: any) => {
        const c = cooperados.get(where.id);
        if (!c) throw new Error('cooperado não existe no mock');
        for (const k of Object.keys(data)) {
          const v = (data as any)[k];
          if (v && typeof v === 'object' && 'increment' in v) {
            (c as any)[k] = ((c as any)[k] ?? 0) + v.increment;
          } else {
            (c as any)[k] = v;
          }
        }
        if (select) {
          const out: any = {};
          for (const k of Object.keys(select)) out[k] = (c as any)[k];
          return out;
        }
        return c;
      }),
    },
  };
}

async function buildSut() {
  const prismaMock = criarPrismaMock();
  const module = await Test.createTestingModule({
    providers: [
      PinCooperadoService,
      { provide: PrismaService, useValue: prismaMock },
    ],
  }).compile();

  const sut = module.get(PinCooperadoService);
  return { sut, prismaMock };
}

function seed(prismaMock: ReturnType<typeof criarPrismaMock>, partial: Partial<CooperadoRow> & { id: string; cooperativaId: string }) {
  prismaMock.cooperados.set(partial.id, {
    pinHash: null,
    pinSalt: null,
    pinTentativas: 0,
    pinBloqueadoAte: null,
    pinDefinidoEm: null,
    ...partial,
  });
}

describe('PinCooperadoService', () => {
  describe('definirPin', () => {
    it('persiste hash + salt + zera tentativas', async () => {
      const { sut, prismaMock } = await buildSut();
      seed(prismaMock, { id: 'coop1', cooperativaId: 'tenantA' });

      await sut.definirPin({ cooperadoId: 'coop1', pin: '123456', cooperativaId: 'tenantA' });

      const row = prismaMock.cooperados.get('coop1')!;
      expect(row.pinHash).toMatch(/^[0-9a-f]{64}$/);
      expect(row.pinSalt).toMatch(/^[0-9a-f]{32}$/);
      expect(row.pinTentativas).toBe(0);
      expect(row.pinBloqueadoAte).toBeNull();
      expect(row.pinDefinidoEm).toBeInstanceOf(Date);
    });

    it('rejeita PIN não-numérico', async () => {
      const { sut, prismaMock } = await buildSut();
      seed(prismaMock, { id: 'coop1', cooperativaId: 'tenantA' });
      await expect(
        sut.definirPin({ cooperadoId: 'coop1', pin: 'abcdef', cooperativaId: 'tenantA' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejeita PIN com tamanho diferente de 6', async () => {
      const { sut, prismaMock } = await buildSut();
      seed(prismaMock, { id: 'coop1', cooperativaId: 'tenantA' });
      await expect(
        sut.definirPin({ cooperadoId: 'coop1', pin: '12345', cooperativaId: 'tenantA' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('404 (anti-IDOR) quando cooperado pertence a outro tenant', async () => {
      const { sut, prismaMock } = await buildSut();
      seed(prismaMock, { id: 'coop1', cooperativaId: 'tenantA' });
      await expect(
        sut.definirPin({ cooperadoId: 'coop1', pin: '123456', cooperativaId: 'tenantB' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('validarPin (puro, sem efeitos)', () => {
    it('retorna ok=true pra PIN correto', async () => {
      const { sut, prismaMock } = await buildSut();
      seed(prismaMock, { id: 'coop1', cooperativaId: 'tenantA' });
      await sut.definirPin({ cooperadoId: 'coop1', pin: '999999', cooperativaId: 'tenantA' });
      const r = await sut.validarPin({ cooperadoId: 'coop1', pin: '999999', cooperativaId: 'tenantA' });
      expect(r.ok).toBe(true);
    });

    it('retorna PIN_INCORRETO pra PIN errado', async () => {
      const { sut, prismaMock } = await buildSut();
      seed(prismaMock, { id: 'coop1', cooperativaId: 'tenantA' });
      await sut.definirPin({ cooperadoId: 'coop1', pin: '111111', cooperativaId: 'tenantA' });
      const r = await sut.validarPin({ cooperadoId: 'coop1', pin: '222222', cooperativaId: 'tenantA' });
      expect(r).toEqual({ ok: false, motivo: 'PIN_INCORRETO' });
    });

    it('retorna PIN_NAO_DEFINIDO quando hash null', async () => {
      const { sut, prismaMock } = await buildSut();
      seed(prismaMock, { id: 'coop1', cooperativaId: 'tenantA' });
      const r = await sut.validarPin({ cooperadoId: 'coop1', pin: '123456', cooperativaId: 'tenantA' });
      expect(r).toEqual({ ok: false, motivo: 'PIN_NAO_DEFINIDO' });
    });

    it('retorna PIN_BLOQUEADO quando lockout futuro', async () => {
      const { sut, prismaMock } = await buildSut();
      const futuro = new Date(Date.now() + 60_000);
      seed(prismaMock, {
        id: 'coop1',
        cooperativaId: 'tenantA',
        pinHash: 'a'.repeat(64),
        pinSalt: 'b'.repeat(32),
        pinBloqueadoAte: futuro,
      });
      const r = await sut.validarPin({ cooperadoId: 'coop1', pin: '123456', cooperativaId: 'tenantA' });
      expect(r).toEqual({ ok: false, motivo: 'PIN_BLOQUEADO', desbloqueiaEm: futuro });
    });

    it('NÃO altera estado (validação pura)', async () => {
      const { sut, prismaMock } = await buildSut();
      seed(prismaMock, { id: 'coop1', cooperativaId: 'tenantA' });
      await sut.definirPin({ cooperadoId: 'coop1', pin: '111111', cooperativaId: 'tenantA' });
      const tentativasAntes = prismaMock.cooperados.get('coop1')!.pinTentativas;
      await sut.validarPin({ cooperadoId: 'coop1', pin: '222222', cooperativaId: 'tenantA' });
      expect(prismaMock.cooperados.get('coop1')!.pinTentativas).toBe(tentativasAntes);
    });

    it('anti-IDOR cross-tenant retorna 404', async () => {
      const { sut, prismaMock } = await buildSut();
      seed(prismaMock, { id: 'coop1', cooperativaId: 'tenantA' });
      await expect(
        sut.validarPin({ cooperadoId: 'coop1', pin: '123456', cooperativaId: 'tenantB' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('validarPinComLockout (com efeitos)', () => {
    it('incrementa tentativas em falha', async () => {
      const { sut, prismaMock } = await buildSut();
      seed(prismaMock, { id: 'coop1', cooperativaId: 'tenantA' });
      await sut.definirPin({ cooperadoId: 'coop1', pin: '111111', cooperativaId: 'tenantA' });

      await sut.validarPinComLockout({ cooperadoId: 'coop1', pin: '999999', cooperativaId: 'tenantA' });
      expect(prismaMock.cooperados.get('coop1')!.pinTentativas).toBe(1);

      await sut.validarPinComLockout({ cooperadoId: 'coop1', pin: '888888', cooperativaId: 'tenantA' });
      expect(prismaMock.cooperados.get('coop1')!.pinTentativas).toBe(2);
    });

    it('zera tentativas em sucesso', async () => {
      const { sut, prismaMock } = await buildSut();
      seed(prismaMock, { id: 'coop1', cooperativaId: 'tenantA' });
      await sut.definirPin({ cooperadoId: 'coop1', pin: '111111', cooperativaId: 'tenantA' });
      await sut.validarPinComLockout({ cooperadoId: 'coop1', pin: '999999', cooperativaId: 'tenantA' });
      await sut.validarPinComLockout({ cooperadoId: 'coop1', pin: '888888', cooperativaId: 'tenantA' });
      expect(prismaMock.cooperados.get('coop1')!.pinTentativas).toBe(2);

      const r = await sut.validarPinComLockout({ cooperadoId: 'coop1', pin: '111111', cooperativaId: 'tenantA' });
      expect(r.ok).toBe(true);
      expect(prismaMock.cooperados.get('coop1')!.pinTentativas).toBe(0);
    });

    it('aplica lockout 15min após 5 falhas', async () => {
      const { sut, prismaMock } = await buildSut();
      seed(prismaMock, { id: 'coop1', cooperativaId: 'tenantA' });
      await sut.definirPin({ cooperadoId: 'coop1', pin: '111111', cooperativaId: 'tenantA' });

      const antes = Date.now();
      for (let i = 0; i < 4; i++) {
        await sut.validarPinComLockout({ cooperadoId: 'coop1', pin: '999999', cooperativaId: 'tenantA' });
      }
      const r = await sut.validarPinComLockout({ cooperadoId: 'coop1', pin: '999999', cooperativaId: 'tenantA' });
      expect(r).toMatchObject({ ok: false, motivo: 'PIN_BLOQUEADO' });

      const row = prismaMock.cooperados.get('coop1')!;
      expect(row.pinBloqueadoAte).toBeInstanceOf(Date);
      const deltaMs = row.pinBloqueadoAte!.getTime() - antes;
      // Aproximadamente 15min (900s) — folga 2s pra clock skew
      expect(deltaMs).toBeGreaterThanOrEqual(15 * 60 * 1000 - 2000);
      expect(deltaMs).toBeLessThanOrEqual(15 * 60 * 1000 + 2000);
      // Tentativas resetadas pra próxima janela
      expect(row.pinTentativas).toBe(0);
    });

    it('não incrementa tentativas quando já bloqueado', async () => {
      const { sut, prismaMock } = await buildSut();
      const futuro = new Date(Date.now() + 60_000);
      seed(prismaMock, {
        id: 'coop1',
        cooperativaId: 'tenantA',
        pinHash: 'a'.repeat(64),
        pinSalt: 'b'.repeat(32),
        pinBloqueadoAte: futuro,
        pinTentativas: 0,
      });

      await sut.validarPinComLockout({ cooperadoId: 'coop1', pin: '999999', cooperativaId: 'tenantA' });
      expect(prismaMock.cooperados.get('coop1')!.pinTentativas).toBe(0);
    });
  });

  describe('alterarPin', () => {
    it('troca PIN quando atual correto', async () => {
      const { sut, prismaMock } = await buildSut();
      seed(prismaMock, { id: 'coop1', cooperativaId: 'tenantA' });
      await sut.definirPin({ cooperadoId: 'coop1', pin: '111111', cooperativaId: 'tenantA' });

      await sut.alterarPin({
        cooperadoId: 'coop1',
        pinAtual: '111111',
        novoPin: '222222',
        cooperativaId: 'tenantA',
      });

      const r1 = await sut.validarPin({ cooperadoId: 'coop1', pin: '111111', cooperativaId: 'tenantA' });
      const r2 = await sut.validarPin({ cooperadoId: 'coop1', pin: '222222', cooperativaId: 'tenantA' });
      expect(r1.ok).toBe(false);
      expect(r2.ok).toBe(true);
    });

    it('rejeita PIN igual ao atual', async () => {
      const { sut, prismaMock } = await buildSut();
      seed(prismaMock, { id: 'coop1', cooperativaId: 'tenantA' });
      await sut.definirPin({ cooperadoId: 'coop1', pin: '111111', cooperativaId: 'tenantA' });
      await expect(
        sut.alterarPin({
          cooperadoId: 'coop1',
          pinAtual: '111111',
          novoPin: '111111',
          cooperativaId: 'tenantA',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('Forbidden quando PIN atual incorreto', async () => {
      const { sut, prismaMock } = await buildSut();
      seed(prismaMock, { id: 'coop1', cooperativaId: 'tenantA' });
      await sut.definirPin({ cooperadoId: 'coop1', pin: '111111', cooperativaId: 'tenantA' });
      await expect(
        sut.alterarPin({
          cooperadoId: 'coop1',
          pinAtual: '999999',
          novoPin: '222222',
          cooperativaId: 'tenantA',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('BadRequest quando PIN não definido', async () => {
      const { sut, prismaMock } = await buildSut();
      seed(prismaMock, { id: 'coop1', cooperativaId: 'tenantA' });
      await expect(
        sut.alterarPin({
          cooperadoId: 'coop1',
          pinAtual: '111111',
          novoPin: '222222',
          cooperativaId: 'tenantA',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('resetarPin', () => {
    it('limpa hash + salt + lockout', async () => {
      const { sut, prismaMock } = await buildSut();
      seed(prismaMock, { id: 'coop1', cooperativaId: 'tenantA' });
      await sut.definirPin({ cooperadoId: 'coop1', pin: '111111', cooperativaId: 'tenantA' });
      await sut.resetarPin({ cooperadoId: 'coop1', cooperativaId: 'tenantA' });

      const row = prismaMock.cooperados.get('coop1')!;
      expect(row.pinHash).toBeNull();
      expect(row.pinSalt).toBeNull();
      expect(row.pinDefinidoEm).toBeNull();
      expect(row.pinBloqueadoAte).toBeNull();
      expect(row.pinTentativas).toBe(0);
    });

    it('404 anti-IDOR cross-tenant', async () => {
      const { sut, prismaMock } = await buildSut();
      seed(prismaMock, { id: 'coop1', cooperativaId: 'tenantA' });
      await expect(
        sut.resetarPin({ cooperadoId: 'coop1', cooperativaId: 'tenantB' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('temPin', () => {
    it('retorna false sem PIN', async () => {
      const { sut, prismaMock } = await buildSut();
      seed(prismaMock, { id: 'coop1', cooperativaId: 'tenantA' });
      expect(await sut.temPin({ cooperadoId: 'coop1', cooperativaId: 'tenantA' })).toBe(false);
    });

    it('retorna true após definir', async () => {
      const { sut, prismaMock } = await buildSut();
      seed(prismaMock, { id: 'coop1', cooperativaId: 'tenantA' });
      await sut.definirPin({ cooperadoId: 'coop1', pin: '111111', cooperativaId: 'tenantA' });
      expect(await sut.temPin({ cooperadoId: 'coop1', cooperativaId: 'tenantA' })).toBe(true);
    });
  });
});
