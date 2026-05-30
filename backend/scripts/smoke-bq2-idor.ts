/**
 * Smoke programático D-novo-BQ.2 IDOR (30/05/2026)
 *
 * Valida em runtime contra Postgres real os 4 fixes BQ.2:
 *   C5 — configuracao-cobranca upsertCooperativa (body→JWT)
 *   C6 — configuracao-cobranca upsertUsina (body→JWT + posse usina)
 *   C7 — motor-proposta aprovarPresencial (posse via cooperado)
 *   A6 — cooper-token confirmarCompraParceiro (posse financeira)
 *
 * Setup: 2 tenants (A, B) + recursos em cada. Tenta cross-tenant em todos
 * os 4 endpoints (chamando services com cooperativaId errado) e confirma
 * que A NÃO altera/lê estado de B. Asserção A6 extra: saldo de tokens
 * de B permanece intacto após tentativa A → B.
 *
 * Cleanup ao final.
 *
 * Rodar: `npx ts-node scripts/smoke-bq2-idor.ts`
 */
import { PrismaClient, Prisma } from '@prisma/client';
import { NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';

import { ConfiguracaoCobrancaController } from '../src/configuracao-cobranca/configuracao-cobranca.controller';
import { ConfiguracaoCobrancaService } from '../src/configuracao-cobranca/configuracao-cobranca.service';
import { MotorPropostaService } from '../src/motor-proposta/motor-proposta.service';
import { CooperTokenService } from '../src/cooper-token/cooper-token.service';

const prisma = new PrismaClient();

type Result = { name: string; ok: boolean; detail?: string };
const results: Result[] = [];
function assert(name: string, ok: boolean, detail?: string) {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'OK ' : 'XX '} ${name}${detail ? '  ' + detail : ''}`);
}

async function expectThrows(name: string, fn: () => Promise<any> | any, expected: any) {
  try {
    const r = fn();
    if (r && typeof r.then === 'function') await r;
    assert(name, false, '(nenhuma exceção lançada)');
  } catch (err: any) {
    const got = err?.constructor?.name ?? typeof err;
    const expectedName = expected.name;
    assert(name, err instanceof expected, `got=${got} expected=${expectedName}`);
  }
}

async function main() {
  const ts = Date.now();
  console.log(`\n=== Smoke BQ.2 IDOR — ts ${ts} ===\n`);

  // Setup
  const coopA = await prisma.cooperativa.create({
    data: { nome: `Smoke BQ2 A ${ts}`, cnpj: `bq2a${ts}`.slice(0, 14), tipoParceiro: 'COOPERATIVA' },
  });
  const coopB = await prisma.cooperativa.create({
    data: { nome: `Smoke BQ2 B ${ts}`, cnpj: `bq2b${ts}`.slice(0, 14), tipoParceiro: 'COOPERATIVA' },
  });

  const coopadoB = await prisma.cooperado.create({
    data: {
      nomeCompleto: 'Smoke BQ2 B Membro',
      cpf: `bq2b-mb-${ts}`,
      email: `lucbragatto+bq2b-${ts}@gmail.com`,
      telefone: '27981341348',
      cooperativaId: coopB.id,
    },
  });

  const usinaB = await prisma.usina.create({
    data: {
      nome: `Smoke BQ2 B Usina`,
      apelidoInterno: `smoke-bq2-b-${ts}`,
      potenciaKwp: new Prisma.Decimal(100),
      cidade: 'Vitória',
      estado: 'ES',
      cooperativaId: coopB.id,
    },
  });

  // Config de B (antes do "ataque")
  await prisma.configuracaoCobranca.create({
    data: {
      cooperativaId: coopB.id,
      descontoPadrao: new Prisma.Decimal(20),
      descontoMin: new Prisma.Decimal(5),
      descontoMax: new Prisma.Decimal(40),
      baseCalculo: 'TUSD_TE',
    },
  });

  // Proposta de B (muitos campos required no schema)
  const z = new Prisma.Decimal(0);
  const propostaB = await prisma.propostaCooperado.create({
    data: {
      cooperadoId: coopadoB.id,
      cooperativaId: coopB.id,
      status: 'PENDENTE',
      mesReferencia: '2026-05',
      kwhMesRecente: z, valorMesRecente: z,
      kwhMedio12m: z, valorMedio12m: z,
      tusdUtilizada: z, teUtilizada: z, tarifaUnitSemTrib: z,
      kwhApuradoBase: z, baseUtilizada: 'TUSD_TE',
      descontoPercentual: z, descontoAbsoluto: z,
      kwhContrato: new Prisma.Decimal(500), valorCooperado: z,
      economiaAbsoluta: z, economiaPercentual: z,
      economiaMensal: z, economiaAnual: z,
      mesesEquivalentes: z, mediaCooperativaKwh: z, resultadoVsMedia: z,
      validaAte: new Date(Date.now() + 30 * 86400_000),
    },
  });

  // Compra de tokens de B em AGUARDANDO_PAGAMENTO
  const compraB = await prisma.cooperTokenCompra.create({
    data: {
      cooperativaId: coopB.id,
      quantidade: new Prisma.Decimal(1000),
      valorTokenReais: new Prisma.Decimal(0.1),
      valorTotal: new Prisma.Decimal(100),
      formaPagamento: 'PIX',
      status: 'AGUARDANDO_PAGAMENTO',
    },
  });

  // Saldo inicial de B (cria zero)
  const saldoBAntes = await prisma.cooperTokenSaldoParceiro
    .findUnique({ where: { cooperativaId: coopB.id } })
    .then((r) => Number(r?.saldoDisponivel ?? 0));

  console.log(`Setup OK. Saldo B antes: ${saldoBAntes}\n`);

  // Instancia services + controllers (DI manual)
  const configService = new ConfiguracaoCobrancaService(prisma as any);
  const configController = new ConfiguracaoCobrancaController(configService, prisma as any);
  const motorService = new MotorPropostaService(
    prisma as any,
    {} as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any,
  );
  const cooperTokenService = new CooperTokenService(prisma as any, { emit: () => undefined } as any);

  try {
    // ============ C5 — ADMIN A injeta body.cooperativaId=B → ignorado (atualiza A, não B) ============
    const reqAdminA: any = { user: { perfil: 'ADMIN', cooperativaId: coopA.id } };
    await configController.upsertCooperativa(
      { descontoPadrao: 0, descontoMin: 0, descontoMax: 50, cooperativaId: coopB.id } as any,
      reqAdminA,
    );
    // Confirma que config de B NÃO foi alterado (ainda 20%)
    const configB = await prisma.configuracaoCobranca.findFirst({
      where: { cooperativaId: coopB.id, usinaId: null },
    });
    assert('C5: ADMIN A body→B não alterou config B (descontoPadrao ainda 20)', Number(configB?.descontoPadrao) === 20);
    // E criou config A (sem body→B)
    const configA = await prisma.configuracaoCobranca.findFirst({
      where: { cooperativaId: coopA.id, usinaId: null },
    });
    assert('C5: config A foi criada (descontoMax=50)', Number(configA?.descontoMax) === 50);

    // ============ C6 — ADMIN A tenta usinaId=usinaB → ForbiddenException ============
    await expectThrows(
      'C6: ADMIN A com usinaId=B → ForbiddenException',
      () =>
        configController.upsertUsina(
          usinaB.id,
          { descontoPadrao: 0, descontoMin: 0, descontoMax: 50 } as any,
          reqAdminA,
        ),
      ForbiddenException,
    );
    // Confirma: nenhuma config criada pra usinaB com tampering A
    const usinaConfigB = await prisma.configuracaoCobranca.findFirst({
      where: { usinaId: usinaB.id },
    });
    assert('C6: nenhuma config criada pra usinaB pelo ataque A', usinaConfigB === null);

    // ============ C7 — ADMIN A tenta aprovarPresencial proposta de B → NotFoundException ============
    await expectThrows(
      'C7: ADMIN A aprovando proposta B → NotFoundException',
      () => motorService.aprovarPresencial(propostaB.id, coopA.id),
      NotFoundException,
    );
    const propostaBDepois = await prisma.propostaCooperado.findUnique({ where: { id: propostaB.id } });
    assert('C7: proposta B continua PENDENTE (não foi aprovada cross-tenant)', propostaBDepois?.status === 'PENDENTE');

    // ============ A6 — ADMIN A tenta confirmar compra B → ForbiddenException + saldo B intacto ============
    await expectThrows(
      'A6: ADMIN A confirmando compra B → ForbiddenException',
      () => cooperTokenService.confirmarCompraParceiro(compraB.id, coopA.id),
      ForbiddenException,
    );
    const compraBDepois = await prisma.cooperTokenCompra.findUnique({ where: { id: compraB.id } });
    assert('A6: compra B continua AGUARDANDO_PAGAMENTO (não foi paga cross-tenant)', compraBDepois?.status === 'AGUARDANDO_PAGAMENTO');
    const saldoBDepois = await prisma.cooperTokenSaldoParceiro
      .findUnique({ where: { cooperativaId: coopB.id } })
      .then((r) => Number(r?.saldoDisponivel ?? 0));
    assert(`A6: saldo B intacto (${saldoBAntes} → ${saldoBDepois})`, saldoBDepois === saldoBAntes);

    // ============ Sanity: same-tenant funciona ============
    // C7 mesmo tenant
    const okC7 = await motorService.aprovarPresencial(propostaB.id, coopB.id);
    assert('Sanity C7: ADMIN B aprovando própria proposta → sucesso', okC7?.sucesso === true);

    // A6 SUPER_ADMIN
    const okA6 = await cooperTokenService.confirmarCompraParceiro(compraB.id, null);
    assert('Sanity A6: SUPER_ADMIN bypass → sucesso', okA6?.sucesso === true);
    const saldoBFinal = await prisma.cooperTokenSaldoParceiro
      .findUnique({ where: { cooperativaId: coopB.id } })
      .then((r) => Number(r?.saldoDisponivel ?? 0));
    assert(`Sanity A6: saldo B creditado (${saldoBAntes} → ${saldoBFinal})`, saldoBFinal > saldoBAntes);
  } finally {
    console.log('\nCleanup...');
    try { await prisma.cooperTokenCompra.deleteMany({ where: { cooperativaId: { in: [coopA.id, coopB.id] } } }); } catch {}
    try { await prisma.cooperTokenSaldoParceiro.deleteMany({ where: { cooperativaId: { in: [coopA.id, coopB.id] } } }); } catch {}
    try { await prisma.propostaCooperado.deleteMany({ where: { cooperado: { cooperativaId: { in: [coopA.id, coopB.id] } } } }); } catch {}
    try { await prisma.configuracaoCobranca.deleteMany({ where: { cooperativaId: { in: [coopA.id, coopB.id] } } }); } catch {}
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
    console.log('Todos os cenários BQ.2 cross-tenant passaram em runtime.\n');
  }
}

main()
  .catch((err) => {
    console.error('Erro fatal smoke BQ.2:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
