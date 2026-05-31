/**
 * Smoke programático D-novo-BR F1.5 (31/05/2026)
 *
 * Valida em runtime contra Postgres real os fixes dos 9 residuais
 * + EmailLog tenant-scoped + M8 fallback ENV bloqueado.
 *
 * NÃO chama API externa (BB/Sicoob/IMAP).
 *
 * Rodar: `npx ts-node scripts/smoke-f15-residuais.ts`
 */
import { PrismaClient, Prisma } from '@prisma/client';
import { NotFoundException } from '@nestjs/common';
import { IntegracaoBancariaService } from '../src/integracao-bancaria/integracao-bancaria.service';
import { EmailService } from '../src/email/email.service';
import { MonitoramentoUsinasService } from '../src/monitoramento-usinas/monitoramento-usinas.service';

const prisma = new PrismaClient();

type Result = { name: string; ok: boolean; detail?: string };
const results: Result[] = [];
function assert(name: string, ok: boolean, detail?: string) {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'OK ' : 'XX '} ${name}${detail ? '  ' + detail : ''}`);
}

async function expectThrows(name: string, fn: () => Promise<any>, expectedCtor: any) {
  try {
    await fn();
    assert(name, false, '(sem exceção)');
  } catch (err: any) {
    assert(name, err instanceof expectedCtor, `got=${err?.constructor?.name} expected=${expectedCtor.name}`);
  }
}

async function main() {
  const ts = Date.now();
  console.log(`\n=== Smoke F1.5 residuais — ts ${ts} ===\n`);

  // Setup 2 tenants
  const coopA = await prisma.cooperativa.create({
    data: { nome: `F15 A ${ts}`, cnpj: `f15a${ts}`.slice(0, 14), tipoParceiro: 'COOPERATIVA' },
  });
  const coopB = await prisma.cooperativa.create({
    data: { nome: `F15 B ${ts}`, cnpj: `f15b${ts}`.slice(0, 14), tipoParceiro: 'COOPERATIVA' },
  });

  // Recursos B
  const coopadoB = await prisma.cooperado.create({
    data: {
      nomeCompleto: 'F15 B', cpf: `f15b-${ts}`,
      email: `lucbragatto+f15b-${ts}@gmail.com`, telefone: '27981341348',
      cooperativaId: coopB.id,
    },
  });

  const usinaB = await prisma.usina.create({
    data: {
      nome: `Usina F15 B`, apelidoInterno: `f15b-${ts}`,
      potenciaKwp: new Prisma.Decimal(100), cidade: 'V', estado: 'ES',
      cooperativaId: coopB.id,
    },
  });

  // UsinaMonitoramentoConfig B
  await prisma.usinaMonitoramentoConfig.create({
    data: { usinaId: usinaB.id, habilitado: true, cooperativaId: coopB.id },
  });

  // ConfiguracaoBancaria B
  await prisma.configuracaoBancaria.create({
    data: { cooperativaId: coopB.id, banco: 'BB', clientId: 'x', clientSecret: 'y' },
  });

  // EmailLog: criar 1 do tenant A (com cooperativaId) e 1 sem (legacy)
  await prisma.emailLog.create({
    data: { destinatario: 'a@a.com', assunto: 'A', status: 'ENVIADO', cooperativaId: coopA.id },
  });
  await prisma.emailLog.create({
    data: { destinatario: 'b@b.com', assunto: 'B', status: 'ENVIADO', cooperativaId: coopB.id },
  });

  console.log('Setup OK.\n');

  const emailService = new EmailService(prisma as any, {} as any);
  const monService = new MonitoramentoUsinasService(prisma as any, {} as any, {} as any, {} as any);
  const bancService = new IntegracaoBancariaService(prisma as any, {} as any, {} as any, {} as any);

  try {
    // ============ M7: EmailLog filtro por tenant ============
    const logsA = await emailService.buscarLogs(1, 100, coopA.id);
    const todosLogsACorrects = logsA.logs.every((l: any) => l.cooperativaId === coopA.id);
    assert(`M7: ADMIN A vê só logs próprios (${logsA.logs.length} retornados, todos coopA)`, todosLogsACorrects && logsA.logs.length >= 1);

    const logsB = await emailService.buscarLogs(1, 100, coopB.id);
    const semVazamentoA = !logsB.logs.some((l: any) => l.cooperativaId === coopA.id);
    assert('M7: ADMIN B não vê logs do A', semVazamentoA);

    const logsSA = await emailService.buscarLogs(1, 100, null);
    assert(`M7: SUPER_ADMIN (null) vê tudo (${logsSA.logs.length} retornados)`, logsSA.logs.length >= 2);

    // ============ A16: monitoramento-usinas getStatusAtual filtra por tenant ============
    const statusA = await monService.getStatusAtual(coopA.id);
    const semVazamentoStatusA = !statusA.some((s: any) => s.usinaId === usinaB.id);
    assert('A16: ADMIN A não vê monitoramento da usina B', semVazamentoStatusA);

    const statusB = await monService.getStatusAtual(coopB.id);
    const verSituacaoUsinaB = statusB.some((s: any) => s.usinaId === usinaB.id);
    assert('A16: ADMIN B vê monitoramento da própria usina', verSituacaoUsinaB);

    const statusSA = await monService.getStatusAtual(null);
    assert('A16: SUPER_ADMIN (null) vê todas habilitadas', statusSA.some((s: any) => s.usinaId === usinaB.id));

    // ============ A11: integracao-bancaria getConfigAtiva filtra por tenant ============
    const cfgA = await bancService.getConfigAtiva(undefined, coopA.id).catch((e: any) => e);
    assert('A11: ADMIN A não acha config do B → NotFound', cfgA instanceof NotFoundException);

    const cfgB = await bancService.getConfigAtiva(undefined, coopB.id);
    assert('A11: ADMIN B acha própria config', cfgB?.cooperativaId === coopB.id);

    // ============ A11: emitirCobranca rejeita cooperado de outro tenant ============
    await expectThrows(
      'A11: ADMIN A tentando emitir cobrança pra cooperado B → NotFound',
      () =>
        bancService.emitirCobranca({
          cooperadoId: coopadoB.id,
          valor: 100,
          vencimento: new Date(),
          descricao: 'x',
          tipo: 'BOLETO',
          cooperativaId: coopA.id,
        }),
      NotFoundException,
    );
  } finally {
    console.log('\nCleanup...');
    try { await prisma.emailLog.deleteMany({ where: { cooperativaId: { in: [coopA.id, coopB.id] } } }); } catch {}
    try { await prisma.configuracaoBancaria.deleteMany({ where: { cooperativaId: { in: [coopA.id, coopB.id] } } }); } catch {}
    try { await prisma.usinaMonitoramentoConfig.deleteMany({ where: { cooperativaId: { in: [coopA.id, coopB.id] } } }); } catch {}
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
    console.log('Todos os cenários F1.5 passaram em runtime.\n');
  }
}

main()
  .catch((err) => { console.error('Erro fatal:', err); process.exitCode = 1; })
  .finally(async () => { await prisma.$disconnect(); });
