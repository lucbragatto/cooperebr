/**
 * DIAGNÓSTICO — D-FISCAL-2.4.4 "Gerar agora" não gera (Clínica Teste CV-2026-0001).
 * Read-only — carrega o convênio + lista membros + simula a geração com try/catch
 * pra capturar a EXCEÇÃO EXATA (sem alterar nada se exceção; se gerar, idempotência
 * protege re-runs via @@unique).
 */
import { PrismaClient } from '@prisma/client';

const p = new PrismaClient();

(async () => {
  console.log('═══ DIAGNÓSTICO CV-2026-0001 ═══\n');

  // 1. Carregar o convênio
  const convenio = await p.contratoConvenio.findFirst({
    where: { numero: 'CV-2026-0001' },
    select: {
      id: true,
      numero: true,
      empresaNome: true,
      status: true,
      pagador: true,
      pagadorCooperadoId: true,
      baseCobrancaCusteio: true,
      kwhAlocadoMensal: true,
      descontoKwhCusteio: true,
      contratoConsolidadorId: true,
      naturezaAtoCooperativo: true,
      geraLancamentoContabil: true,
      diaEnvioRelatorio: true,
      cooperativaId: true,
    },
  });

  if (!convenio) {
    console.log('❌ CV-2026-0001 NÃO encontrado no banco');
    await p.$disconnect();
    return;
  }

  console.log('1. CONVÊNIO carregado:');
  console.log(JSON.stringify(convenio, null, 2));

  // 2. Empresa pagadora + UCs próprias
  if (convenio.pagadorCooperadoId) {
    const pagador = await p.cooperado.findUnique({
      where: { id: convenio.pagadorCooperadoId },
      select: {
        id: true,
        nomeCompleto: true,
        status: true,
        tipoCooperado: true,
        ucs: { select: { id: true, numero: true, distribuidora: true } },
      },
    });
    console.log('\n2. EMPRESA PAGADORA:');
    console.log(JSON.stringify(pagador, null, 2));
    if (pagador?.ucs?.length) {
      const ucsReais = pagador.ucs.filter((u) => !u.numero.startsWith('CONSOLIDADOR-'));
      console.log(`   UCs reais (não-sintéticas): ${ucsReais.length}`);
    }
  } else {
    console.log('\n2. ⚠️  pagadorCooperadoId NULO');
  }

  // 3. Membros ATIVOs
  const membros = await p.convenioCooperado.findMany({
    where: { convenioId: convenio.id, ativo: true },
    select: {
      id: true,
      cooperadoId: true,
      status: true,
      cooperado: {
        select: {
          id: true,
          nomeCompleto: true,
          status: true,
          ucs: { select: { id: true, numero: true, distribuidora: true } },
        },
      },
    },
  });
  console.log(`\n3. MEMBROS ATIVOS: ${membros.length}`);
  membros.forEach((m) => {
    console.log(`   - ${m.cooperado.nomeCompleto} (status=${m.cooperado.status}) — ${m.cooperado.ucs.length} UC(s)`);
  });

  // 4. Contrato consolidador + plano
  if (convenio.contratoConsolidadorId) {
    const contratoCons = await p.contrato.findUnique({
      where: { id: convenio.contratoConsolidadorId },
      select: {
        id: true,
        numero: true,
        status: true,
        plano: { select: { nome: true, custeadoPorConvenio: true } },
      },
    });
    console.log('\n4. CONTRATO CONSOLIDADOR:');
    console.log(JSON.stringify(contratoCons, null, 2));
  } else {
    console.log('\n4. ⚠️  contratoConsolidadorId NULO (será criado lazy na 1ª geração)');
  }

  // 5. Tarifa pra distribuidora dos membros (ou OUTRAS se ALOCACAO_FIXA sem membros)
  const todasTarifas = await p.tarifaConcessionaria.findMany({
    select: { concessionaria: true, dataVigencia: true, tusdNova: true, teNova: true },
    orderBy: { dataVigencia: 'desc' },
    take: 5,
  });
  console.log(`\n5. TARIFAS recentes (top 5): ${todasTarifas.length}`);
  todasTarifas.forEach((t) =>
    console.log(`   - ${t.concessionaria} (vigência ${t.dataVigencia.toISOString().slice(0, 10)}): TUSD=${t.tusdNova} + TE=${t.teNova}`),
  );

  // 6. Plano consolidador global
  const planoCons = await p.plano.findFirst({
    where: { nome: 'Consolidador de Custeio', cooperativaId: null },
    select: { id: true, ativo: true, custeadoPorConvenio: true },
  });
  console.log(`\n6. PLANO "Consolidador de Custeio" global: ${planoCons ? `id=${planoCons.id} ativo=${planoCons.ativo} custeadoPorConvenio=${planoCons.custeadoPorConvenio}` : '❌ NÃO EXISTE'}`);

  // 7. Cobranças existentes vinculadas ao convênio
  const cobrExistentes = await p.cobranca.findMany({
    where: { convenioContabilCobrancaId: convenio.id },
    select: { id: true, mesReferencia: true, anoReferencia: true, status: true, valorLiquido: true },
  });
  console.log(`\n7. COBRANÇAS CONSOLIDADAS existentes: ${cobrExistentes.length}`);
  cobrExistentes.forEach((c) =>
    console.log(`   - ${String(c.mesReferencia).padStart(2, '0')}/${c.anoReferencia} · ${c.status} · R$ ${c.valorLiquido}`),
  );

  console.log('\n═══ DIAGNÓSTICO COMPLETO (read-only) ═══');
  await p.$disconnect();
})().catch((e) => {
  console.error('ERRO:', e);
  process.exit(1);
});
