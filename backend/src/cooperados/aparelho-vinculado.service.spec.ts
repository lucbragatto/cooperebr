/**
 * Specs AparelhoVinculadoService — F2.4 Sprint Token-WA Fase 2.
 *
 * Cobre o fluxo 2 passos: iniciar -> confirmar (sucesso), revogação anterior
 * automática, anti-IDOR cross-tenant, telefone-mismatch, idempotência OTP,
 * busca ativo, revogar manual, listar.
 */

import { Test } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { AparelhoVinculadoService } from './aparelho-vinculado.service';
import { OtpDesafioService } from '../common/security/otp-desafio.service';
import { PrismaService } from '../prisma.service';

type CooperadoRow = {
  id: string;
  cooperativaId: string;
  telefone: string;
};

type AparelhoRow = {
  id: string;
  cooperadoId: string;
  cooperativaId: string;
  numeroTelefone: string;
  pushName: string | null;
  ipAtivacao: string | null;
  userAgentAtivacao: string | null;
  ativadoEm: Date;
  revogadoEm: Date | null;
  motivoRevogacao: string | null;
  usadoEm: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

function criarPrismaMock() {
  const cooperados: Map<string, CooperadoRow> = new Map();
  const aparelhos: Map<string, AparelhoRow> = new Map();
  let seq = 0;

  const matchWhere = (row: any, where: any): boolean => {
    for (const k of Object.keys(where)) {
      const v = where[k];
      if (v === null) {
        if (row[k] !== null && row[k] !== undefined) return false;
      } else if (row[k] !== v) {
        return false;
      }
    }
    return true;
  };

  const project = (row: any, select: any) => {
    if (!select) return row;
    const out: any = {};
    for (const k of Object.keys(select)) out[k] = row[k];
    return out;
  };

  const tx = {
    aparelhoVinculado: {
      findFirst: jest.fn(async ({ where, select }: any) => {
        for (const row of aparelhos.values()) {
          if (matchWhere(row, where)) return project(row, select);
        }
        return null;
      }),
      create: jest.fn(async ({ data, select }: any) => {
        seq++;
        const id = `aparelho-${seq}`;
        const now = new Date();
        const row: AparelhoRow = {
          id,
          cooperadoId: data.cooperadoId,
          cooperativaId: data.cooperativaId,
          numeroTelefone: data.numeroTelefone,
          pushName: data.pushName ?? null,
          ipAtivacao: data.ipAtivacao ?? null,
          userAgentAtivacao: data.userAgentAtivacao ?? null,
          ativadoEm: now,
          revogadoEm: null,
          motivoRevogacao: null,
          usadoEm: null,
          createdAt: now,
          updatedAt: now,
        };
        aparelhos.set(id, row);
        return project(row, select);
      }),
      update: jest.fn(async ({ where, data, select }: any) => {
        const row = aparelhos.get(where.id);
        if (!row) throw new Error('aparelho não existe no mock');
        for (const k of Object.keys(data)) row[k as keyof AparelhoRow] = data[k];
        row.updatedAt = new Date();
        return project(row, select);
      }),
    },
  };

  return {
    cooperados,
    aparelhos,
    cooperado: {
      findFirst: jest.fn(async ({ where, select }: any) => {
        const row = cooperados.get(where.id);
        if (!row) return null;
        if (where.cooperativaId && row.cooperativaId !== where.cooperativaId) return null;
        return project(row, select);
      }),
    },
    aparelhoVinculado: {
      findFirst: tx.aparelhoVinculado.findFirst,
      create: tx.aparelhoVinculado.create,
      update: tx.aparelhoVinculado.update,
      findMany: jest.fn(async ({ where, orderBy }: any) => {
        const rows = [];
        for (const row of aparelhos.values()) {
          let match = true;
          for (const k of Object.keys(where)) {
            const v = where[k];
            if (v === null) {
              if (row[k as keyof AparelhoRow] !== null) match = false;
            } else if (typeof v === 'object' && v !== null) {
              continue;
            } else if (row[k as keyof AparelhoRow] !== v) {
              match = false;
            }
            if (!match) break;
          }
          if (match) rows.push(row);
        }
        if (orderBy?.ativadoEm === 'desc') {
          rows.sort((a, b) => b.ativadoEm.getTime() - a.ativadoEm.getTime());
        }
        return rows;
      }),
    },
    $transaction: jest.fn(async (cb: any) => {
      return cb(tx);
    }),
  };
}

function fakeOtpService(criarOverride?: any, validarOverride?: any) {
  return {
    criarDesafio: jest.fn(criarOverride ?? (async () => ({
      desafioId: 'desafio-1',
      codigo: '123456',
      expiresAt: new Date(Date.now() + 600_000),
    }))),
    validarOuLancar: jest.fn(validarOverride ?? (async () => undefined)),
    validar: jest.fn(),
  };
}

async function buildSut(overrides?: { otp?: any }) {
  const prismaMock = criarPrismaMock();
  const otpMock = overrides?.otp ?? fakeOtpService();
  const module = await Test.createTestingModule({
    providers: [
      AparelhoVinculadoService,
      { provide: PrismaService, useValue: prismaMock },
      { provide: OtpDesafioService, useValue: otpMock },
    ],
  }).compile();
  const sut = module.get(AparelhoVinculadoService);
  return { sut, prismaMock, otpMock };
}

function seedCoop(prismaMock: any, partial: { id: string; cooperativaId: string; telefone: string }) {
  prismaMock.cooperados.set(partial.id, partial);
}

describe('AparelhoVinculadoService', () => {
  describe('iniciarAtivacao', () => {
    it('cria desafio OTP quando telefone bate', async () => {
      const { sut, prismaMock, otpMock } = await buildSut();
      seedCoop(prismaMock, { id: 'coop1', cooperativaId: 'tenantA', telefone: '5527981341348' });

      const r = await sut.iniciarAtivacao({
        cooperadoId: 'coop1',
        cooperativaId: 'tenantA',
        numeroTelefone: '5527981341348',
        ip: '1.2.3.4',
      });

      expect(otpMock.criarDesafio).toHaveBeenCalledWith({
        motivo: 'COOPERADO_DEVICE_BIND',
        sujeitoTipo: 'COOPERADO',
        sujeitoId: 'coop1',
        telefoneDestino: '5527981341348',
        criadoPorIp: '1.2.3.4',
        criadoPorUserAgent: null,
      });
      expect(r.codigo).toBe('123456');
      expect(r.desafioId).toBe('desafio-1');
    });

    it('rejeita E.164 inválido', async () => {
      const { sut, prismaMock } = await buildSut();
      seedCoop(prismaMock, { id: 'coop1', cooperativaId: 'tenantA', telefone: '5527981341348' });
      await expect(
        sut.iniciarAtivacao({
          cooperadoId: 'coop1',
          cooperativaId: 'tenantA',
          numeroTelefone: '27981341348', // sem 55
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('Forbidden quando telefone não bate', async () => {
      const { sut, prismaMock } = await buildSut();
      seedCoop(prismaMock, { id: 'coop1', cooperativaId: 'tenantA', telefone: '5527981341348' });
      await expect(
        sut.iniciarAtivacao({
          cooperadoId: 'coop1',
          cooperativaId: 'tenantA',
          numeroTelefone: '5527999999999',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('404 anti-IDOR cross-tenant', async () => {
      const { sut, prismaMock } = await buildSut();
      seedCoop(prismaMock, { id: 'coop1', cooperativaId: 'tenantA', telefone: '5527981341348' });
      await expect(
        sut.iniciarAtivacao({
          cooperadoId: 'coop1',
          cooperativaId: 'tenantB',
          numeroTelefone: '5527981341348',
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('confirmarAtivacao', () => {
    it('cria aparelho novo sem anterior', async () => {
      const { sut, prismaMock } = await buildSut();
      seedCoop(prismaMock, { id: 'coop1', cooperativaId: 'tenantA', telefone: '5527981341348' });

      const r = await sut.confirmarAtivacao({
        desafioId: 'desafio-1',
        codigo: '123456',
        cooperadoId: 'coop1',
        cooperativaId: 'tenantA',
        numeroTelefone: '5527981341348',
        pushName: 'Luciano',
      });

      expect(r.aparelhoId).toBeTruthy();
      expect(r.aparelhoAnteriorRevogadoId).toBeNull();
      const row = prismaMock.aparelhos.get(r.aparelhoId)!;
      expect(row.revogadoEm).toBeNull();
      expect(row.pushName).toBe('Luciano');
    });

    it('revoga aparelho anterior antes de criar novo (TROCA_APARELHO)', async () => {
      const { sut, prismaMock } = await buildSut();
      seedCoop(prismaMock, { id: 'coop1', cooperativaId: 'tenantA', telefone: '5527981341348' });

      const r1 = await sut.confirmarAtivacao({
        desafioId: 'desafio-1',
        codigo: '123456',
        cooperadoId: 'coop1',
        cooperativaId: 'tenantA',
        numeroTelefone: '5527981341348',
      });

      const r2 = await sut.confirmarAtivacao({
        desafioId: 'desafio-2',
        codigo: '654321',
        cooperadoId: 'coop1',
        cooperativaId: 'tenantA',
        numeroTelefone: '5527981341348',
      });

      expect(r2.aparelhoAnteriorRevogadoId).toBe(r1.aparelhoId);
      const anterior = prismaMock.aparelhos.get(r1.aparelhoId)!;
      expect(anterior.revogadoEm).toBeInstanceOf(Date);
      expect(anterior.motivoRevogacao).toBe('TROCA_APARELHO');
      const novo = prismaMock.aparelhos.get(r2.aparelhoId)!;
      expect(novo.revogadoEm).toBeNull();
    });

    it('Forbidden quando telefone não bate', async () => {
      const { sut, prismaMock } = await buildSut();
      seedCoop(prismaMock, { id: 'coop1', cooperativaId: 'tenantA', telefone: '5527981341348' });
      await expect(
        sut.confirmarAtivacao({
          desafioId: 'desafio-1',
          codigo: '123456',
          cooperadoId: 'coop1',
          cooperativaId: 'tenantA',
          numeroTelefone: '5527999999999',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('propaga erro do OtpDesafioService.validarOuLancar', async () => {
      const otpMock = fakeOtpService(undefined, async () => {
        throw new ForbiddenException('Código OTP incorreto.');
      });
      const { sut, prismaMock } = await buildSut({ otp: otpMock });
      seedCoop(prismaMock, { id: 'coop1', cooperativaId: 'tenantA', telefone: '5527981341348' });
      await expect(
        sut.confirmarAtivacao({
          desafioId: 'desafio-1',
          codigo: '000000',
          cooperadoId: 'coop1',
          cooperativaId: 'tenantA',
          numeroTelefone: '5527981341348',
        }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('buscarAtivo', () => {
    it('retorna ativo quando existe', async () => {
      const { sut, prismaMock } = await buildSut();
      seedCoop(prismaMock, { id: 'coop1', cooperativaId: 'tenantA', telefone: '5527981341348' });
      const { aparelhoId } = await sut.confirmarAtivacao({
        desafioId: 'desafio-1',
        codigo: '123456',
        cooperadoId: 'coop1',
        cooperativaId: 'tenantA',
        numeroTelefone: '5527981341348',
      });
      const ativo = await sut.buscarAtivo({
        cooperadoId: 'coop1',
        numeroTelefone: '5527981341348',
        cooperativaId: 'tenantA',
      });
      expect(ativo?.id).toBe(aparelhoId);
    });

    it('retorna null quando todos revogados', async () => {
      const { sut, prismaMock } = await buildSut();
      seedCoop(prismaMock, { id: 'coop1', cooperativaId: 'tenantA', telefone: '5527981341348' });
      const { aparelhoId } = await sut.confirmarAtivacao({
        desafioId: 'desafio-1',
        codigo: '123456',
        cooperadoId: 'coop1',
        cooperativaId: 'tenantA',
        numeroTelefone: '5527981341348',
      });
      await sut.revogar({
        aparelhoId,
        cooperativaId: 'tenantA',
        motivo: 'USUARIO_REVOGOU',
      });
      const ativo = await sut.buscarAtivo({
        cooperadoId: 'coop1',
        numeroTelefone: '5527981341348',
        cooperativaId: 'tenantA',
      });
      expect(ativo).toBeNull();
    });
  });

  describe('revogar', () => {
    it('seta revogadoEm + motivoRevogacao', async () => {
      const { sut, prismaMock } = await buildSut();
      seedCoop(prismaMock, { id: 'coop1', cooperativaId: 'tenantA', telefone: '5527981341348' });
      const { aparelhoId } = await sut.confirmarAtivacao({
        desafioId: 'desafio-1',
        codigo: '123456',
        cooperadoId: 'coop1',
        cooperativaId: 'tenantA',
        numeroTelefone: '5527981341348',
      });

      const revogado = await sut.revogar({
        aparelhoId,
        cooperativaId: 'tenantA',
        motivo: 'SIM_SWAP_DETECTED',
      });

      expect(revogado).not.toBeNull();
      expect(prismaMock.aparelhos.get(aparelhoId)!.motivoRevogacao).toBe('SIM_SWAP_DETECTED');
    });

    it('404 anti-IDOR cross-tenant', async () => {
      const { sut, prismaMock } = await buildSut();
      seedCoop(prismaMock, { id: 'coop1', cooperativaId: 'tenantA', telefone: '5527981341348' });
      const { aparelhoId } = await sut.confirmarAtivacao({
        desafioId: 'desafio-1',
        codigo: '123456',
        cooperadoId: 'coop1',
        cooperativaId: 'tenantA',
        numeroTelefone: '5527981341348',
      });
      await expect(
        sut.revogar({
          aparelhoId,
          cooperativaId: 'tenantB',
          motivo: 'ADMIN_REVOGOU',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('retorna null se já revogado (idempotente)', async () => {
      const { sut, prismaMock } = await buildSut();
      seedCoop(prismaMock, { id: 'coop1', cooperativaId: 'tenantA', telefone: '5527981341348' });
      const { aparelhoId } = await sut.confirmarAtivacao({
        desafioId: 'desafio-1',
        codigo: '123456',
        cooperadoId: 'coop1',
        cooperativaId: 'tenantA',
        numeroTelefone: '5527981341348',
      });
      await sut.revogar({ aparelhoId, cooperativaId: 'tenantA', motivo: 'USUARIO_REVOGOU' });
      const segunda = await sut.revogar({ aparelhoId, cooperativaId: 'tenantA', motivo: 'USUARIO_REVOGOU' });
      expect(segunda).toBeNull();
    });
  });
});
