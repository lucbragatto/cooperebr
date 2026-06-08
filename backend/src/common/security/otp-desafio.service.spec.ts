/**
 * Specs OtpDesafioService — F2.4 Sprint Token-WA Fase 2.
 *
 * Cobre criação, validação (success path), expiração, rate-limit, lockout,
 * idempotência (já-validado), versão "Lancar" e desafio inexistente.
 */

import { Test } from '@nestjs/testing';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import {
  OtpDesafioService,
  OTP_MAX_TENTATIVAS,
  OTP_LOCKOUT_MINUTOS,
} from './otp-desafio.service';
import { PrismaService } from '../../prisma.service';

type DesafioRow = {
  id: string;
  motivo: string;
  sujeitoTipo: string;
  sujeitoId: string;
  codigoHash: string;
  salt: string;
  expiresAt: Date;
  validadoEm: Date | null;
  tentativas: number;
  bloqueadoAte: Date | null;
  telefoneDestino: string;
  criadoPorIp: string | null;
  criadoPorUserAgent: string | null;
  validadoPorIp: string | null;
};

function criarPrismaMock() {
  const desafios: Map<string, DesafioRow> = new Map();
  let seq = 0;

  return {
    desafios,
    otpDesafio: {
      create: jest.fn(async ({ data, select }: any) => {
        seq++;
        const id = `desafio-${seq}`;
        const row: DesafioRow = {
          id,
          motivo: data.motivo,
          sujeitoTipo: data.sujeitoTipo,
          sujeitoId: data.sujeitoId,
          codigoHash: data.codigoHash,
          salt: data.salt,
          expiresAt: data.expiresAt,
          validadoEm: null,
          tentativas: data.tentativas ?? 0,
          bloqueadoAte: null,
          telefoneDestino: data.telefoneDestino,
          criadoPorIp: data.criadoPorIp ?? null,
          criadoPorUserAgent: data.criadoPorUserAgent ?? null,
          validadoPorIp: null,
        };
        desafios.set(id, row);
        if (select) {
          const out: any = {};
          for (const k of Object.keys(select)) out[k] = (row as any)[k];
          return out;
        }
        return row;
      }),
      findUnique: jest.fn(async ({ where, select }: any) => {
        const row = desafios.get(where.id);
        if (!row) return null;
        if (select) {
          const out: any = {};
          for (const k of Object.keys(select)) out[k] = (row as any)[k];
          return out;
        }
        return row;
      }),
      update: jest.fn(async ({ where, data, select }: any) => {
        const row = desafios.get(where.id);
        if (!row) throw new Error('desafio não existe no mock');
        for (const k of Object.keys(data)) {
          const v = (data as any)[k];
          if (v && typeof v === 'object' && 'increment' in v) {
            (row as any)[k] = ((row as any)[k] ?? 0) + v.increment;
          } else {
            (row as any)[k] = v;
          }
        }
        if (select) {
          const out: any = {};
          for (const k of Object.keys(select)) out[k] = (row as any)[k];
          return out;
        }
        return row;
      }),
    },
  };
}

async function buildSut() {
  const prismaMock = criarPrismaMock();
  const module = await Test.createTestingModule({
    providers: [
      OtpDesafioService,
      { provide: PrismaService, useValue: prismaMock },
    ],
  }).compile();
  const sut = module.get(OtpDesafioService);
  return { sut, prismaMock };
}

describe('OtpDesafioService', () => {
  describe('criarDesafio', () => {
    it('cria desafio + retorna código + hash diferente do código', async () => {
      const { sut, prismaMock } = await buildSut();
      const r = await sut.criarDesafio({
        motivo: 'COOPERADO_DEVICE_BIND',
        sujeitoTipo: 'COOPERADO',
        sujeitoId: 'coop1',
        telefoneDestino: '5527981341348',
      });
      expect(r.desafioId).toBeTruthy();
      expect(r.codigo).toMatch(/^\d{6}$/);
      expect(r.expiresAt.getTime()).toBeGreaterThan(Date.now());
      const row = prismaMock.desafios.get(r.desafioId)!;
      expect(row.codigoHash).not.toBe(r.codigo);
      expect(row.codigoHash).toMatch(/^[0-9a-f]{64}$/);
    });

    it('expiresAt ~10min no futuro', async () => {
      const { sut } = await buildSut();
      const antes = Date.now();
      const r = await sut.criarDesafio({
        motivo: 'PIN_RESET',
        sujeitoTipo: 'COOPERADO',
        sujeitoId: 'coop1',
        telefoneDestino: '5527981341348',
      });
      const delta = r.expiresAt.getTime() - antes;
      expect(delta).toBeGreaterThanOrEqual(10 * 60 * 1000 - 2000);
      expect(delta).toBeLessThanOrEqual(10 * 60 * 1000 + 2000);
    });
  });

  describe('validar', () => {
    it('retorna ok=true pra código correto + marca validadoEm', async () => {
      const { sut, prismaMock } = await buildSut();
      const { desafioId, codigo } = await sut.criarDesafio({
        motivo: 'COOPERADO_DEVICE_BIND',
        sujeitoTipo: 'COOPERADO',
        sujeitoId: 'coop1',
        telefoneDestino: '5527981341348',
      });

      const r = await sut.validar({ desafioId, codigo });
      expect(r.ok).toBe(true);
      expect(prismaMock.desafios.get(desafioId)!.validadoEm).toBeInstanceOf(Date);
    });

    it('DESAFIO_NAO_ENCONTRADO', async () => {
      const { sut } = await buildSut();
      const r = await sut.validar({ desafioId: 'nao-existe', codigo: '123456' });
      expect(r).toEqual({ ok: false, motivo: 'DESAFIO_NAO_ENCONTRADO' });
    });

    it('JA_VALIDADO retorna no 2º uso', async () => {
      const { sut } = await buildSut();
      const { desafioId, codigo } = await sut.criarDesafio({
        motivo: 'COOPERADO_DEVICE_BIND',
        sujeitoTipo: 'COOPERADO',
        sujeitoId: 'coop1',
        telefoneDestino: '5527981341348',
      });
      const r1 = await sut.validar({ desafioId, codigo });
      expect(r1.ok).toBe(true);
      const r2 = await sut.validar({ desafioId, codigo });
      expect(r2).toEqual({ ok: false, motivo: 'JA_VALIDADO' });
    });

    it('DESAFIO_EXPIRADO quando expiresAt no passado', async () => {
      const { sut, prismaMock } = await buildSut();
      const { desafioId, codigo } = await sut.criarDesafio({
        motivo: 'COOPERADO_DEVICE_BIND',
        sujeitoTipo: 'COOPERADO',
        sujeitoId: 'coop1',
        telefoneDestino: '5527981341348',
      });
      prismaMock.desafios.get(desafioId)!.expiresAt = new Date(Date.now() - 1000);

      const r = await sut.validar({ desafioId, codigo });
      expect(r).toEqual({ ok: false, motivo: 'DESAFIO_EXPIRADO' });
    });

    it('CODIGO_INCORRETO incrementa tentativas', async () => {
      const { sut, prismaMock } = await buildSut();
      const { desafioId } = await sut.criarDesafio({
        motivo: 'COOPERADO_DEVICE_BIND',
        sujeitoTipo: 'COOPERADO',
        sujeitoId: 'coop1',
        telefoneDestino: '5527981341348',
      });
      const r = await sut.validar({ desafioId, codigo: '000000' });
      expect(r.ok).toBe(false);
      expect((r as any).motivo).toBe('CODIGO_INCORRETO');
      expect(prismaMock.desafios.get(desafioId)!.tentativas).toBe(1);
    });

    it('bloqueia após MAX tentativas', async () => {
      const { sut, prismaMock } = await buildSut();
      const { desafioId } = await sut.criarDesafio({
        motivo: 'COOPERADO_DEVICE_BIND',
        sujeitoTipo: 'COOPERADO',
        sujeitoId: 'coop1',
        telefoneDestino: '5527981341348',
      });
      let last: any;
      const antes = Date.now();
      for (let i = 0; i < OTP_MAX_TENTATIVAS; i++) {
        last = await sut.validar({ desafioId, codigo: '000000' });
      }
      expect(last.ok).toBe(false);
      expect(last.motivo).toBe('DESAFIO_BLOQUEADO');
      const row = prismaMock.desafios.get(desafioId)!;
      expect(row.bloqueadoAte).toBeInstanceOf(Date);
      const delta = row.bloqueadoAte!.getTime() - antes;
      expect(delta).toBeGreaterThanOrEqual(OTP_LOCKOUT_MINUTOS * 60 * 1000 - 2000);
    });

    it('DESAFIO_BLOQUEADO quando lockout futuro mesmo com código correto', async () => {
      const { sut, prismaMock } = await buildSut();
      const { desafioId, codigo } = await sut.criarDesafio({
        motivo: 'COOPERADO_DEVICE_BIND',
        sujeitoTipo: 'COOPERADO',
        sujeitoId: 'coop1',
        telefoneDestino: '5527981341348',
      });
      prismaMock.desafios.get(desafioId)!.bloqueadoAte = new Date(Date.now() + 60_000);

      const r = await sut.validar({ desafioId, codigo });
      expect(r.ok).toBe(false);
      expect((r as any).motivo).toBe('DESAFIO_BLOQUEADO');
    });
  });

  describe('validarOuLancar', () => {
    it('não lança em sucesso', async () => {
      const { sut } = await buildSut();
      const { desafioId, codigo } = await sut.criarDesafio({
        motivo: 'COOPERADO_DEVICE_BIND',
        sujeitoTipo: 'COOPERADO',
        sujeitoId: 'coop1',
        telefoneDestino: '5527981341348',
      });
      await expect(sut.validarOuLancar({ desafioId, codigo })).resolves.toBeUndefined();
    });

    it('lança BadRequest em desafio não-encontrado', async () => {
      const { sut } = await buildSut();
      await expect(
        sut.validarOuLancar({ desafioId: 'nao-existe', codigo: '123456' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('lança Forbidden em código incorreto', async () => {
      const { sut } = await buildSut();
      const { desafioId } = await sut.criarDesafio({
        motivo: 'COOPERADO_DEVICE_BIND',
        sujeitoTipo: 'COOPERADO',
        sujeitoId: 'coop1',
        telefoneDestino: '5527981341348',
      });
      await expect(
        sut.validarOuLancar({ desafioId, codigo: '000000' }),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
