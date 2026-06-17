/**
 * Sprint D2.1 v2 (16/06/2026) — DisclaimerSaqueService specs.
 *
 * Cobre as 4 superfícies do service que sustentam a Salvaguarda 5 do
 * parecer de conformidade (analise-conformidade-2026-06-16-saque-
 * colaborador-d2.md):
 *
 *  RESOLUÇÃO
 *   1. getAtivo: override do tenant tem prioridade sobre global.
 *   2. getAtivo: sem override → cai no global.
 *   3. getAtivo: sem nada → NotFound.
 *   4. getAtivoComOrigem: distingue TENANT × GLOBAL.
 *
 *  MUTAÇÃO + HISTÓRICO
 *   5. criarGlobal: zera ativa anterior + cria nova ativa em tx.
 *   6. criarGlobal: histórico imutável (UpdateMany ativa anterior → ativo=false,
 *      nunca delete).
 *   7. criarTenantOverride: força cooperativaId do input (vem do JWT),
 *      NUNCA do body.
 *   8. criarTenantOverride: 2 tenants editando em paralelo NÃO se sobrescrevem.
 *
 *  ISOLAMENTO + DEFENSE-IN-DEPTH
 *   9. listarHistorico(tenant): NUNCA vaza outros tenants.
 *  10. desativarOverrideTenant: marca ativo=false (não deleta).
 *  11. desativarOverrideTenant: NotFound se tenant não tem override ativo.
 *  12. buscarPorId: recibo antigo recupera texto exato via FK
 *      (mesmo após ativo=false).
 *  13. buscarPorId: bloqueia leitura de override de outro tenant
 *      (multi-tenant safe).
 *
 *  VALIDAÇÃO
 *  14. validarTexto: rejeita <50 caracteres.
 *  15. validarTexto: rejeita HTML tags (anti-XSS).
 */
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DisclaimerSaqueService } from './disclaimer-saque.service';

const TENANT_A = 'coop-A-id';
const TENANT_B = 'coop-B-id';
const SUPER_ID = 'super-admin-id';
const ADMIN_A_ID = 'admin-A-id';

function mockTx(state: Map<string, any>): any {
  return {
    disclaimerSaque: {
      count: jest.fn(async (args: any) => {
        const where = args.where ?? {};
        let n = 0;
        for (const row of state.values()) {
          if (where.cooperativaId === null && row.cooperativaId === null) n++;
          else if (
            where.cooperativaId !== null &&
            where.cooperativaId !== undefined &&
            row.cooperativaId === where.cooperativaId
          )
            n++;
        }
        return n;
      }),
      updateMany: jest.fn(async (args: any) => {
        const where = args.where ?? {};
        let count = 0;
        for (const row of state.values()) {
          const matchCoop =
            where.cooperativaId === undefined ||
            row.cooperativaId === where.cooperativaId;
          const matchAtivo =
            where.ativo === undefined || row.ativo === where.ativo;
          if (matchCoop && matchAtivo) {
            Object.assign(row, args.data);
            count++;
          }
        }
        return { count };
      }),
      create: jest.fn(async (args: any) => {
        const id = `entry-${state.size + 1}`;
        const row = {
          id,
          createdAt: new Date(),
          ...args.data,
        };
        state.set(id, row);
        return row;
      }),
    },
  };
}

function setup() {
  const state = new Map<string, any>();
  const prisma: any = {
    disclaimerSaque: {
      findFirst: jest.fn(async (args: any) => {
        const where = args.where ?? {};
        for (const row of state.values()) {
          const matchCoop =
            (where.cooperativaId === null && row.cooperativaId === null) ||
            (where.cooperativaId !== null &&
              where.cooperativaId !== undefined &&
              row.cooperativaId === where.cooperativaId);
          const matchAtivo =
            where.ativo === undefined || row.ativo === where.ativo;
          if (matchCoop && matchAtivo) return row;
        }
        return null;
      }),
      findMany: jest.fn(async (args: any) => {
        const where = args.where ?? {};
        const matches: any[] = [];
        for (const row of state.values()) {
          if (row.cooperativaId === where.cooperativaId) matches.push(row);
        }
        return matches.sort(
          (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
        );
      }),
      findUnique: jest.fn(async (args: any) => state.get(args.where.id) ?? null),
      update: jest.fn(async (args: any) => {
        const row = state.get(args.where.id);
        if (!row) throw new Error('row not found');
        Object.assign(row, args.data);
        return row;
      }),
    },
    usuario: {
      findFirst: jest.fn().mockResolvedValue({ id: SUPER_ID }),
    },
    $transaction: jest.fn(async (cb: any) => {
      return cb(mockTx(state));
    }),
  };
  const service = new DisclaimerSaqueService(prisma);
  return { service, prisma, state };
}

// ═════════════════════════════════════════════════════════════════════
// RESOLUÇÃO
// ═════════════════════════════════════════════════════════════════════

describe('DisclaimerSaqueService — resolução (getAtivo + getAtivoComOrigem)', () => {
  it('1. tenant override TEM prioridade sobre global', async () => {
    const { service, state } = setup();
    state.set('g', {
      id: 'g',
      cooperativaId: null,
      versao: 'v1-2026-06-17',
      texto: 'texto global global global global global global global global',
      ativo: true,
      createdAt: new Date('2026-06-15'),
    });
    state.set('t', {
      id: 't',
      cooperativaId: TENANT_A,
      versao: 'tenant-v1-2026-06-17',
      texto: 'texto tenant A custom custom custom custom custom custom custom',
      ativo: true,
      createdAt: new Date('2026-06-16'),
    });

    const ativo = await service.getAtivo(TENANT_A);
    expect(ativo.id).toBe('t');
    expect(ativo.cooperativaId).toBe(TENANT_A);
  });

  it('2. sem override do tenant → cai no global', async () => {
    const { service, state } = setup();
    state.set('g', {
      id: 'g',
      cooperativaId: null,
      versao: 'v1-2026-06-17',
      texto: 'texto global global global global global global global global',
      ativo: true,
      createdAt: new Date(),
    });

    const ativo = await service.getAtivo(TENANT_B);
    expect(ativo.id).toBe('g');
    expect(ativo.cooperativaId).toBeNull();
  });

  it('3. sem global nem override → NotFound (bug operacional)', async () => {
    const { service } = setup();
    await expect(service.getAtivo(TENANT_A)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('4. getAtivoComOrigem distingue TENANT × GLOBAL pro front', async () => {
    const { service, state } = setup();
    state.set('g', {
      id: 'g',
      cooperativaId: null,
      versao: 'v1-2026-06-17',
      texto: 'global global global global global global global global global',
      ativo: true,
      createdAt: new Date(),
    });
    const sem = await service.getAtivoComOrigem(TENANT_B);
    expect(sem.origem).toBe('GLOBAL');

    state.set('t', {
      id: 't',
      cooperativaId: TENANT_A,
      versao: 'tenant-v1-2026-06-17',
      texto: 'tenant tenant tenant tenant tenant tenant tenant tenant tenant',
      ativo: true,
      createdAt: new Date(),
    });
    const com = await service.getAtivoComOrigem(TENANT_A);
    expect(com.origem).toBe('TENANT');
  });
});

// ═════════════════════════════════════════════════════════════════════
// MUTAÇÃO + HISTÓRICO
// ═════════════════════════════════════════════════════════════════════

const TEXTO_VALIDO =
  'Este texto tem mais de cinquenta caracteres pra passar na validação do service e ser aceito.';
const TEXTO_NOVO =
  'Versão nova do disclaimer global aprovada pelo SUPER_ADMIN com texto suficiente.';

describe('DisclaimerSaqueService — mutação + histórico imutável', () => {
  it('5. criarGlobal: zera ativa anterior + cria nova ativa em tx', async () => {
    const { service, state } = setup();
    state.set('g1', {
      id: 'g1',
      cooperativaId: null,
      versao: 'v1-2026-06-17',
      texto: TEXTO_VALIDO,
      ativo: true,
      createdAt: new Date('2026-06-15'),
    });

    const nova = await service.criarGlobal({
      texto: TEXTO_NOVO,
      criadoPorUsuarioId: SUPER_ID,
    });

    expect(nova.cooperativaId).toBeNull();
    expect(nova.ativo).toBe(true);
    expect(nova.criadoPorPerfil).toBe('SUPER_ADMIN');
    // A versão anterior agora está ativo=false (histórico preservado).
    expect(state.get('g1').ativo).toBe(false);
  });

  it('6. criarGlobal: histórico imutável (NUNCA deleta)', async () => {
    const { service, state } = setup();
    state.set('g1', {
      id: 'g1',
      cooperativaId: null,
      versao: 'v1-2026-06-17',
      texto: TEXTO_VALIDO,
      ativo: true,
      createdAt: new Date(),
    });

    const sizeAntes = state.size;
    await service.criarGlobal({
      texto: TEXTO_NOVO,
      criadoPorUsuarioId: SUPER_ID,
    });
    // Cresce em +1 (criou), nunca encolhe.
    expect(state.size).toBe(sizeAntes + 1);
    // Entry antiga continua existindo.
    expect(state.has('g1')).toBe(true);
  });

  it('7. criarTenantOverride: força cooperativaId do input (do JWT)', async () => {
    const { service, state } = setup();
    const nova = await service.criarTenantOverride({
      cooperativaId: TENANT_A,
      texto: TEXTO_VALIDO,
      criadoPorUsuarioId: ADMIN_A_ID,
    });
    expect(nova.cooperativaId).toBe(TENANT_A);
    expect(nova.criadoPorPerfil).toBe('ADMIN');
    expect(state.get(nova.id).cooperativaId).toBe(TENANT_A);
  });

  it('8. criarTenantOverride: 2 tenants distintos NÃO se sobrescrevem', async () => {
    const { service, state } = setup();
    await service.criarTenantOverride({
      cooperativaId: TENANT_A,
      texto: TEXTO_VALIDO,
      criadoPorUsuarioId: ADMIN_A_ID,
    });
    await service.criarTenantOverride({
      cooperativaId: TENANT_B,
      texto: TEXTO_VALIDO,
      criadoPorUsuarioId: 'admin-B-id',
    });
    const ativoA = await service.getAtivo(TENANT_A);
    const ativoB = await service.getAtivo(TENANT_B);
    expect(ativoA.id).not.toBe(ativoB.id);
    expect(ativoA.cooperativaId).toBe(TENANT_A);
    expect(ativoB.cooperativaId).toBe(TENANT_B);
    // 2 ativos coexistem, cada um no seu tenant — sem vazamento.
    let ativosTenantA = 0;
    let ativosTenantB = 0;
    for (const row of state.values()) {
      if (row.ativo && row.cooperativaId === TENANT_A) ativosTenantA++;
      if (row.ativo && row.cooperativaId === TENANT_B) ativosTenantB++;
    }
    expect(ativosTenantA).toBe(1);
    expect(ativosTenantB).toBe(1);
  });
});

// ═════════════════════════════════════════════════════════════════════
// ISOLAMENTO MULTI-TENANT + DESATIVAÇÃO
// ═════════════════════════════════════════════════════════════════════

describe('DisclaimerSaqueService — isolamento + desativação', () => {
  it('9. listarHistorico(tenant) NÃO vaza outros tenants', async () => {
    const { service, state } = setup();
    state.set('a1', {
      id: 'a1',
      cooperativaId: TENANT_A,
      versao: 'tenant-v1-2026-06-17',
      texto: TEXTO_VALIDO,
      ativo: false,
      createdAt: new Date('2026-06-15'),
    });
    state.set('a2', {
      id: 'a2',
      cooperativaId: TENANT_A,
      versao: 'tenant-v2-2026-06-17',
      texto: TEXTO_VALIDO,
      ativo: true,
      createdAt: new Date('2026-06-16'),
    });
    state.set('b1', {
      id: 'b1',
      cooperativaId: TENANT_B,
      versao: 'tenant-v1-2026-06-17',
      texto: TEXTO_VALIDO,
      ativo: true,
      createdAt: new Date(),
    });
    state.set('g1', {
      id: 'g1',
      cooperativaId: null,
      versao: 'v1-2026-06-17',
      texto: TEXTO_VALIDO,
      ativo: true,
      createdAt: new Date(),
    });

    const histA = await service.listarHistorico(TENANT_A);
    expect(histA).toHaveLength(2);
    expect(histA.every((d) => d.cooperativaId === TENANT_A)).toBe(true);

    const histGlobal = await service.listarHistorico(null);
    expect(histGlobal).toHaveLength(1);
    expect(histGlobal[0].cooperativaId).toBeNull();
  });

  it('10. desativarOverrideTenant marca ativo=false (NUNCA deleta)', async () => {
    const { service, state } = setup();
    state.set('a1', {
      id: 'a1',
      cooperativaId: TENANT_A,
      versao: 'tenant-v1-2026-06-17',
      texto: TEXTO_VALIDO,
      ativo: true,
      createdAt: new Date(),
    });
    const sizeAntes = state.size;

    const r = await service.desativarOverrideTenant({
      cooperativaId: TENANT_A,
      desativadoPorUsuarioId: ADMIN_A_ID,
    });
    expect(r.desativado).toBe(true);
    expect(state.size).toBe(sizeAntes);
    expect(state.get('a1').ativo).toBe(false);
  });

  it('11. desativarOverrideTenant sem override ativo → NotFound', async () => {
    const { service } = setup();
    await expect(
      service.desativarOverrideTenant({
        cooperativaId: TENANT_A,
        desativadoPorUsuarioId: ADMIN_A_ID,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('12. buscarPorId: recibo antigo recupera texto via FK (mesmo ativo=false)', async () => {
    const { service, state } = setup();
    state.set('old', {
      id: 'old',
      cooperativaId: null,
      versao: 'v1-2026-06-17',
      texto: 'texto antigo arquivado ' + TEXTO_VALIDO,
      ativo: false, // já desativada
      createdAt: new Date('2026-06-15'),
    });

    const found = await service.buscarPorId({
      id: 'old',
      cooperativaIdEsperado: TENANT_A,
    });
    expect(found).not.toBeNull();
    expect(found!.id).toBe('old');
    expect(found!.texto).toContain('texto antigo arquivado');
  });

  it('13. buscarPorId NUNCA vaza override de outro tenant', async () => {
    const { service, state } = setup();
    state.set('b-secret', {
      id: 'b-secret',
      cooperativaId: TENANT_B,
      versao: 'tenant-v1-2026-06-17',
      texto: TEXTO_VALIDO,
      ativo: true,
      createdAt: new Date(),
    });

    // Cooperado/admin do TENANT_A tenta acessar override do B → bloqueado.
    const found = await service.buscarPorId({
      id: 'b-secret',
      cooperativaIdEsperado: TENANT_A,
    });
    expect(found).toBeNull();
  });
});

// ═════════════════════════════════════════════════════════════════════
// VALIDAÇÃO
// ═════════════════════════════════════════════════════════════════════

describe('DisclaimerSaqueService — validação de texto', () => {
  it('14. rejeita texto < 50 caracteres', async () => {
    const { service } = setup();
    await expect(
      service.criarGlobal({ texto: 'curto demais', criadoPorUsuarioId: SUPER_ID }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('15. rejeita HTML tags no texto (anti-XSS)', async () => {
    const { service } = setup();
    await expect(
      service.criarGlobal({
        texto:
          TEXTO_VALIDO + ' <script>alert("xss")</script> tentativa de injeção',
        criadoPorUsuarioId: SUPER_ID,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
