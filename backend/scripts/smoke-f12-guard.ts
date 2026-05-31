/**
 * Smoke programático D-novo-BR F1.2 (31/05/2026)
 *
 * Valida em runtime contra Postgres real que o TenantOwnershipGuard
 * bloqueia acesso cross-tenant nos 15 endpoints anotados na F1.2.
 *
 * Aborda guard diretamente (sem HTTP) instanciando-o com Reflector mockado
 * + Prisma real. Pra cada endpoint anotado:
 *  - tenant A tenta acessar recurso do tenant B → espera NotFoundException
 *  - mesmo tenant A → passa (ou globalOnly Forbidden quando aplicável)
 *  - SUPER_ADMIN → bypass
 *
 * Cleanup ao final.
 *
 * Rodar: `npx ts-node scripts/smoke-f12-guard.ts`
 */
import { PrismaClient, Prisma } from '@prisma/client';
import {
  ExecutionContext,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  TenantResource,
  TenantResourceOpts,
  TENANT_RESOURCE_KEY,
} from '../src/auth/tenant-resource.decorator';
import { TenantOwnershipGuard } from '../src/auth/tenant-ownership.guard';

const prisma = new PrismaClient();

type Result = { name: string; ok: boolean; detail?: string };
const results: Result[] = [];
function assert(name: string, ok: boolean, detail?: string) {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'OK ' : 'XX '} ${name}${detail ? '  ' + detail : ''}`);
}

function makeCtx({
  user,
  params,
  opts,
}: {
  user?: any;
  params: Record<string, string>;
  opts?: TenantResourceOpts;
}): ExecutionContext {
  const handler = function mockHandler() {};
  if (opts) Reflect.defineMetadata(TENANT_RESOURCE_KEY, opts, handler);
  return {
    switchToHttp: () => ({ getRequest: () => ({ user, params }) }) as any,
    getHandler: () => handler,
    getClass: () => function MockCtl() {},
  } as any;
}

async function expectThrows(name: string, fn: () => Promise<any>, expected: any) {
  try {
    await fn();
    assert(name, false, '(sem exceção)');
  } catch (err: any) {
    assert(name, err instanceof expected, `got=${err?.constructor?.name} expected=${expected.name}`);
  }
}

async function main() {
  const ts = Date.now();
  console.log(`\n=== Smoke F1.2 Guard — ts ${ts} ===\n`);

  const reflector = new Reflector();
  const guard = new TenantOwnershipGuard(reflector, prisma as any);

  // Setup 2 tenants
  const coopA = await prisma.cooperativa.create({
    data: { nome: `F12 A ${ts}`, cnpj: `f12a${ts}`.slice(0, 14), tipoParceiro: 'COOPERATIVA' },
  });
  const coopB = await prisma.cooperativa.create({
    data: { nome: `F12 B ${ts}`, cnpj: `f12b${ts}`.slice(0, 14), tipoParceiro: 'COOPERATIVA' },
  });

  // Recursos B
  const coopadoB = await prisma.cooperado.create({
    data: {
      nomeCompleto: 'F12 B', cpf: `f12b-${ts}`,
      email: `lucbragatto+f12b-${ts}@gmail.com`, telefone: '27981341348',
      cooperativaId: coopB.id,
    },
  });

  const usinaB = await prisma.usina.create({
    data: {
      nome: `Usina F12 B`, apelidoInterno: `f12b-${ts}`,
      potenciaKwp: new Prisma.Decimal(100), cidade: 'Vitória', estado: 'ES',
      cooperativaId: coopB.id,
    },
  });

  const listaB = await prisma.listaContatos.create({
    data: { nome: 'Lista B', cooperativaId: coopB.id, telefones: [], cooperadoIds: [] },
  });
  const listaGlobal = await prisma.listaContatos.create({
    data: { nome: `Lista Global ${ts}`, cooperativaId: null, telefones: [], cooperadoIds: [] },
  });

  const modeloB = await prisma.modeloMensagem.create({
    data: { nome: `Mod B ${ts}`, categoria: 'BOT', conteudo: 'x', cooperativaId: coopB.id },
  });
  const modeloGlobal = await prisma.modeloMensagem.create({
    data: { nome: `Mod Global ${ts}`, categoria: 'BOT', conteudo: 'x', cooperativaId: null },
  });

  const fluxoB = await prisma.fluxoEtapa.create({
    data: {
      nome: `Fluxo B ${ts}`, ordem: 1, estado: 'INICIAL',
      gatilhos: [], cooperativaId: coopB.id,
    },
  });

  // CobrancaBancaria B
  const cfgB = await prisma.configuracaoBancaria.create({
    data: { cooperativaId: coopB.id, banco: 'BB', clientId: 'x', clientSecret: 'y' },
  });
  const cobBancariaB = await prisma.cobrancaBancaria.create({
    data: {
      cooperativaId: coopB.id, cooperadoId: coopadoB.id, configuracaoId: cfgB.id,
      tipo: 'BOLETO', valor: new Prisma.Decimal(100), vencimento: new Date(),
      descricao: 'B', status: 'PENDENTE',
    },
  });

  console.log('Setup OK.\n');

  const userA: any = { perfil: 'ADMIN', cooperativaId: coopA.id };
  const userB: any = { perfil: 'ADMIN', cooperativaId: coopB.id };
  const userSA: any = { perfil: 'SUPER_ADMIN', cooperativaId: null };

  try {
    // ============ A1 + A2 + M1 (listaContatos, globalOnlySA) ============
    const optsLista: TenantResourceOpts = { model: 'listaContatos', globalOnlySuperAdmin: true };

    await expectThrows(
      'A1/A2/M1: ADMIN A → lista B (NotFound)',
      () => guard.canActivate(makeCtx({ user: userA, params: { id: listaB.id }, opts: optsLista })),
      NotFoundException,
    );
    assert(
      'A1/A2/M1: ADMIN B → lista própria (passa)',
      (await guard.canActivate(makeCtx({ user: userB, params: { id: listaB.id }, opts: optsLista }))) === true,
    );
    await expectThrows(
      'A1/A2/M1: ADMIN A → lista GLOBAL (Forbidden)',
      () => guard.canActivate(makeCtx({ user: userA, params: { id: listaGlobal.id }, opts: optsLista })),
      ForbiddenException,
    );
    assert(
      'A1/A2/M1: SUPER_ADMIN → lista GLOBAL (bypass)',
      (await guard.canActivate(makeCtx({ user: userSA, params: { id: listaGlobal.id }, opts: optsLista }))) === true,
    );

    // ============ A3 + M2 (modeloMensagem, globalOnlySA) ============
    const optsModelo: TenantResourceOpts = { model: 'modeloMensagem', globalOnlySuperAdmin: true };

    await expectThrows(
      'A3/M2: ADMIN A → modelo B (NotFound)',
      () => guard.canActivate(makeCtx({ user: userA, params: { id: modeloB.id }, opts: optsModelo })),
      NotFoundException,
    );
    assert(
      'A3/M2: ADMIN B → modelo próprio (passa)',
      (await guard.canActivate(makeCtx({ user: userB, params: { id: modeloB.id }, opts: optsModelo }))) === true,
    );
    await expectThrows(
      'A3/M2: ADMIN A → modelo GLOBAL (Forbidden)',
      () => guard.canActivate(makeCtx({ user: userA, params: { id: modeloGlobal.id }, opts: optsModelo })),
      ForbiddenException,
    );

    // ============ A4 (fluxoEtapa, globalOnlySA) ============
    const optsFluxo: TenantResourceOpts = { model: 'fluxoEtapa', globalOnlySuperAdmin: true };

    await expectThrows(
      'A4: ADMIN A → fluxo B (NotFound)',
      () => guard.canActivate(makeCtx({ user: userA, params: { id: fluxoB.id }, opts: optsFluxo })),
      NotFoundException,
    );
    assert(
      'A4: ADMIN B → fluxo próprio (passa)',
      (await guard.canActivate(makeCtx({ user: userB, params: { id: fluxoB.id }, opts: optsFluxo }))) === true,
    );

    // ============ A5 (cobrancaBancaria) ============
    const optsCob: TenantResourceOpts = { model: 'cobrancaBancaria' };

    await expectThrows(
      'A5: ADMIN A → cobrancaBancaria B (NotFound, sem chamar API banco)',
      () => guard.canActivate(makeCtx({ user: userA, params: { id: cobBancariaB.id }, opts: optsCob })),
      NotFoundException,
    );
    assert(
      'A5: ADMIN B → própria cobrancaBancaria (passa)',
      (await guard.canActivate(makeCtx({ user: userB, params: { id: cobBancariaB.id }, opts: optsCob }))) === true,
    );

    // ============ A6 + A7 + M3 + M4 + M5 + M6 (usina, idParam=usinaId) ============
    const optsUsina: TenantResourceOpts = { model: 'usina', idParam: 'usinaId' };

    await expectThrows(
      'A6/A7/M3/M4/M5/M6: ADMIN A → usina B (NotFound)',
      () => guard.canActivate(makeCtx({ user: userA, params: { usinaId: usinaB.id }, opts: optsUsina })),
      NotFoundException,
    );
    assert(
      'A6/A7/M3/M4/M5/M6: ADMIN B → usina própria (passa)',
      (await guard.canActivate(makeCtx({ user: userB, params: { usinaId: usinaB.id }, opts: optsUsina }))) === true,
    );

    // ============ A8 + A9 (cooperado, idParam=cooperadoId) ============
    const optsCoop: TenantResourceOpts = { model: 'cooperado', idParam: 'cooperadoId' };

    await expectThrows(
      'A8/A9: ADMIN A → cooperado B (NotFound — bloqueia email reenviar + asaas listar)',
      () => guard.canActivate(makeCtx({ user: userA, params: { cooperadoId: coopadoB.id }, opts: optsCoop })),
      NotFoundException,
    );
    assert(
      'A8/A9: ADMIN B → próprio cooperado (passa)',
      (await guard.canActivate(makeCtx({ user: userB, params: { cooperadoId: coopadoB.id }, opts: optsCoop }))) === true,
    );

    // ============ Sanity: SA bypass total ============
    assert(
      'SA bypass: usina B (sem findFirst)',
      (await guard.canActivate(makeCtx({ user: userSA, params: { usinaId: usinaB.id }, opts: optsUsina }))) === true,
    );

    // ============ Edge: id faltando → BadRequest ============
    await expectThrows(
      'Edge: id faltando → BadRequest',
      () => guard.canActivate(makeCtx({ user: userA, params: {}, opts: optsUsina })),
      BadRequestException,
    );
  } finally {
    console.log('\nCleanup...');
    try { await prisma.cobrancaBancaria.deleteMany({ where: { cooperativaId: { in: [coopA.id, coopB.id] } } }); } catch {}
    try { await prisma.configuracaoBancaria.deleteMany({ where: { cooperativaId: { in: [coopA.id, coopB.id] } } }); } catch {}
    try { await prisma.fluxoEtapa.deleteMany({ where: { cooperativaId: { in: [coopA.id, coopB.id] } } }); } catch {}
    try { await prisma.modeloMensagem.deleteMany({ where: { id: { in: [modeloB.id, modeloGlobal.id] } } }); } catch {}
    try { await prisma.listaContatos.deleteMany({ where: { id: { in: [listaB.id, listaGlobal.id] } } }); } catch {}
    try { await prisma.usina.deleteMany({ where: { cooperativaId: { in: [coopA.id, coopB.id] } } }); } catch {}
    try { await prisma.cooperado.deleteMany({ where: { cooperativaId: { in: [coopA.id, coopB.id] } } }); } catch {}
    try { await prisma.cooperativa.deleteMany({ where: { id: { in: [coopA.id, coopB.id] } } }); } catch {}
    console.log('Cleanup OK.\n');
  }

  const fails = results.filter((r) => !r.ok);
  console.log(`\n=== Resumo: ${results.length - fails.length}/${results.length} OK ===`);
  if (fails.length > 0) {
    console.error('FALHAS:');
    fails.forEach((f) => console.error(` - ${f.name} ${f.detail ?? ''}`));
    process.exitCode = 1;
  } else {
    console.log('Todos os cenários F1.2 cross-tenant passaram em runtime.\n');
  }
}

main()
  .catch((err) => { console.error('Erro fatal:', err); process.exitCode = 1; })
  .finally(async () => { await prisma.$disconnect(); });
