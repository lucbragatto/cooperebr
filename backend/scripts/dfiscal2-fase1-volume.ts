import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

(async () => {
  console.log('═══ D-FISCAL-2 Fase 1 — Volume de dados ═══\n');

  // ContratoConvenio legado MLM
  const totalCC = await prisma.contratoConvenio.count();
  const ativos = await prisma.contratoConvenio.count({ where: { status: 'ATIVO' } });
  const conveniosMaisMembros = await prisma.contratoConvenio.findMany({
    include: { _count: { select: { cooperados: true } } },
    orderBy: { createdAt: 'desc' },
  });
  console.log(`ContratoConvenio total: ${totalCC} (${ativos} ATIVO)`);
  for (const c of conveniosMaisMembros) {
    const coop = c.cooperativaId
      ? await prisma.cooperativa.findUnique({ where: { id: c.cooperativaId }, select: { nome: true } })
      : null;
    console.log(
      `  ${c.id.slice(0, 8)} ${c.empresaNome.padEnd(38)} tipo=${c.tipo.padEnd(15)} status=${c.status.padEnd(8)} membros=${c._count.cooperados} mod=${c.modalidade} coop=${coop?.nome ?? '—'}`,
    );
  }

  // ConvenioCooperado (membros)
  const totalMembros = await prisma.convenioCooperado.count();
  const membrosAtivos = await prisma.convenioCooperado.count({
    where: { ativo: true, status: 'MEMBRO_ATIVO' },
  });
  console.log(`\nConvenioCooperado total: ${totalMembros} (${membrosAtivos} ativos)`);

  // HistoricoFaixaConvenio
  const historico = await prisma.historicoFaixaConvenio.count();
  console.log(`HistoricoFaixaConvenio: ${historico}`);

  // Indicacao via convenio (registrarComoIndicacao + indicacaoId em ConvenioCooperado)
  const comIndicacao = await prisma.convenioCooperado.count({
    where: { indicacaoId: { not: null } },
  });
  console.log(`ConvenioCooperado com indicacaoId: ${comIndicacao}`);

  // Convenio CT (CT.2)
  console.log('\n--- Convenio (CT.2/CT.9) ---');
  const totalCT = await prisma.convenio.count();
  const conveniosCT = await prisma.convenio.findMany({
    include: {
      cooperativa: { select: { nome: true } },
      _count: { select: { lancamentos: true } },
    },
  });
  console.log(`Convenio CT total: ${totalCT}`);
  conveniosCT.forEach((c) => {
    console.log(
      `  ${c.id.slice(0, 8)} ${c.nome.padEnd(38)} fluxo=${c.fluxoFinanceiro.padEnd(28)} ativo=${c.ativo} movimentos=${c._count.lancamentos} coop=${c.cooperativa?.nome ?? '—'}`,
    );
  });

  // LancamentoCaixa com origemTipo=CONVENIO
  const lancCT = await prisma.lancamentoCaixa.count({ where: { origemTipo: 'CONVENIO' } });
  const movimentos = await prisma.lancamentoCaixa.findMany({
    where: { origemTipo: 'CONVENIO' },
    select: {
      id: true,
      tipo: true,
      valor: true,
      competencia: true,
      naturezaAto: true,
      descricao: true,
      convenioContabilId: true,
    },
  });
  console.log(`\nLancamentoCaixa (origemTipo=CONVENIO): ${lancCT}`);
  movimentos.forEach((m) => {
    console.log(
      `  ${m.id.slice(0, 8)} ${m.tipo} R$${m.valor.toString().padEnd(8)} ${m.competencia} ${m.naturezaAto.padEnd(12)} → conv=${m.convenioContabilId?.slice(0, 8)} "${m.descricao.slice(0, 35)}"`,
    );
  });

  await prisma.$disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
