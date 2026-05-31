/**
 * Smoke CT.1 runtime — valida schema delta + migration + seed contra banco real.
 *
 * Não roda specs Jest (Convenio/ApuracaoMensalSegregada ainda não têm service;
 * isso vem em CT.2). Aqui só validamos que o schema funciona ponta a ponta.
 *
 * Rodar: `npx ts-node scripts/smoke-ct1.ts`
 */
import { PrismaClient, NaturezaCooperativa, NaturezaContabil, TipoBeneficioConvenio, FluxoConvenio, StatusApuracao, TipoRegimeContabil } from '@prisma/client';

const prisma = new PrismaClient();

type Result = { name: string; ok: boolean; detail?: string };
const results: Result[] = [];
function assert(name: string, ok: boolean, detail?: string) {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'OK ' : 'XX '} ${name}${detail ? '  → ' + detail : ''}`);
}

async function main() {
  const ts = Date.now();
  console.log(`\n=== Smoke CT.1 runtime — ts ${ts} ===\n`);

  // ============ 1. Migration preservou 58 LancamentoCaixa ============
  const dist = await prisma.lancamentoCaixa.groupBy({ by: ['naturezaAto'], _count: true });
  const total = dist.reduce((acc, g) => acc + g._count, 0);
  assert(`Migration: 58 LancamentoCaixa preservados como enum (encontrado ${total})`, total >= 58);
  const todosPropriosCorrects = dist.every((g) => g.naturezaAto === NaturezaCooperativa.PROPRIO);
  assert('Migration: todos os 58 viraram PROPRIO (enum válido)', todosPropriosCorrects);

  // ============ 2. Enums válidos ============
  assert('Enum NaturezaCooperativa.PROPRIO existe', NaturezaCooperativa.PROPRIO === 'PROPRIO');
  assert('Enum NaturezaCooperativa.AUXILIAR existe', NaturezaCooperativa.AUXILIAR === 'AUXILIAR');
  assert('Enum NaturezaCooperativa.NAO_COOPERATIVO existe', NaturezaCooperativa.NAO_COOPERATIVO === 'NAO_COOPERATIVO');
  assert('Enum TipoRegimeContabil.COOPERATIVO existe', TipoRegimeContabil.COOPERATIVO === 'COOPERATIVO');

  // ============ 3. Cooperativa tem regimeContabil + isencaoPisCofinsAtiva ============
  const sampleCoop = await prisma.cooperativa.findFirst({
    where: { tipoParceiro: 'COOPERATIVA' },
    select: { id: true, nome: true, regimeContabil: true, isencaoPisCofinsAtiva: true },
  });
  assert(`Cooperativa.regimeContabil populado (${sampleCoop?.regimeContabil})`, sampleCoop?.regimeContabil === TipoRegimeContabil.COOPERATIVO);
  assert(`Cooperativa.isencaoPisCofinsAtiva default true`, sampleCoop?.isencaoPisCofinsAtiva === true);

  // ============ 4. Seed plano de contas — 10 contas segregadas ============
  const planoSegregado = await prisma.planoContas.findMany({
    where: { naturezaContabil: { not: null } },
    select: { codigo: true, naturezaContabil: true, naturezaCooperativa: true, fundamentoLegal: true },
  });
  assert(`Plano contas segregado: ${planoSegregado.length} contas com naturezaContabil`, planoSegregado.length >= 10);

  // FATES + Fundo Reserva (Art. 28)
  const fates = planoSegregado.find((p) => p.codigo === '2.4.02');
  const fundoReserva = planoSegregado.find((p) => p.codigo === '2.4.01');
  assert('Seed: FATES (2.4.02) presente com fundamento Art. 28 II', !!fates?.fundamentoLegal?.includes('Art. 28'));
  assert('Seed: Fundo Reserva (2.4.01) presente com fundamento Art. 28 I', !!fundoReserva?.fundamentoLegal?.includes('Art. 28'));

  // Sobras separada de Resultado Não-Coop (risco 3 parecer)
  const sobras = planoSegregado.find((p) => p.codigo === '2.5.01');
  const resultadoNaoCoop = planoSegregado.find((p) => p.codigo === '2.6.01');
  assert('Seed: Sobras Distribuíveis (2.5.01) SEPARADA de Resultado Não-Coop', sobras?.naturezaContabil === NaturezaContabil.SOBRAS_DISTRIBUIVEIS);
  assert('Seed: Resultado Não-Coop (2.6.01) com natureza própria', resultadoNaoCoop?.naturezaContabil === NaturezaContabil.RESULTADO_NAO_COOPERATIVO);

  // ============ 5. Convenio + ApuracaoMensalSegregada — CRUD básico ============
  const coopId = sampleCoop!.id;
  const tsName = `CT1Test${ts}`;

  // Create Convenio
  const conv = await prisma.convenio.create({
    data: {
      cooperativaId: coopId,
      nome: tsName,
      tipoBeneficio: TipoBeneficioConvenio.ENERGIA_SCEE,
      fluxoFinanceiro: FluxoConvenio.INGRESSO_CUSTEIO_AUXILIAR,
      classificacaoFiscal: 'Ato Auxiliar Art. 88 Lei 5.764/71 + STF Tema 536',
      vigenciaInicio: new Date(),
    },
  });
  assert('Convenio.create OK (multi-tenant)', conv.cooperativaId === coopId && conv.tipoBeneficio === 'ENERGIA_SCEE');

  // Create ApuracaoMensalSegregada
  const apur = await prisma.apuracaoMensalSegregada.create({
    data: {
      cooperativaId: coopId,
      ano: 2030,
      mes: 12,
      fundamentoIsencao: 'STF Tema 536 + STJ Tema 986 + Art. 79 Lei 5.764/71',
    },
  });
  assert('ApuracaoMensalSegregada.create OK (status ABERTA default)', apur.status === StatusApuracao.ABERTA);

  // Unique [cooperativaId, ano, mes]
  try {
    await prisma.apuracaoMensalSegregada.create({
      data: { cooperativaId: coopId, ano: 2030, mes: 12 },
    });
    assert('ApuracaoMensalSegregada @@unique[cooperativaId,ano,mes] FALHOU em rejeitar duplicata', false);
  } catch (err: any) {
    assert('ApuracaoMensalSegregada @@unique[cooperativaId,ano,mes] rejeita duplicata', err.code === 'P2002');
  }

  // Cleanup
  await prisma.apuracaoMensalSegregada.delete({ where: { id: apur.id } });
  await prisma.convenio.delete({ where: { id: conv.id } });

  // ============ 6. LancamentoCaixa.create com enum funciona ============
  const lanc = await prisma.lancamentoCaixa.create({
    data: {
      tipo: 'RECEITA',
      descricao: `CT1 smoke ${ts}`,
      valor: 100,
      competencia: '2030-12',
      naturezaAto: NaturezaCooperativa.AUXILIAR,
    },
  });
  assert('LancamentoCaixa.create aceita enum AUXILIAR', lanc.naturezaAto === 'AUXILIAR');
  await prisma.lancamentoCaixa.delete({ where: { id: lanc.id } });

  // Resumo
  const fails = results.filter((r) => !r.ok);
  console.log(`\n=== Resumo: ${results.length - fails.length}/${results.length} OK ===`);
  if (fails.length > 0) {
    console.error('FALHAS:');
    fails.forEach((f) => console.error(` - ${f.name} ${f.detail ?? ''}`));
    process.exitCode = 1;
  } else {
    console.log('✅ CT.1 schema multi-regime + migration + seed VALIDADOS em runtime.\n');
  }
}

main()
  .catch((err) => { console.error('Erro fatal:', err); process.exitCode = 1; })
  .finally(async () => { await prisma.$disconnect(); });
