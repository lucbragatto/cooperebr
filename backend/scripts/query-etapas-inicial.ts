import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const todasInicial = await prisma.fluxoEtapa.findMany({
    where: { estado: 'INICIAL' },
    orderBy: [{ cooperativaId: 'asc' }, { ordem: 'asc' }],
  });

  console.log('=== Total etapas com estado=INICIAL:', todasInicial.length);
  console.log(JSON.stringify(todasInicial, null, 2));

  console.log('\n=== Resumo:');
  todasInicial.forEach((e, i) => {
    const gatilhos = Array.isArray(e.gatilhos) ? e.gatilhos : [];
    console.log(
      `[${i}] id=${e.id} | nome="${e.nome}" | ordem=${e.ordem} | ativo=${e.ativo} | cooperativaId=${e.cooperativaId ?? 'NULL'} | modeloMensagemId=${e.modeloMensagemId ?? 'NULL'} | gatilhos=${gatilhos.length}`,
    );
  });

  console.log('\n=== TODAS as etapas (qualquer estado):');
  const todas = await prisma.fluxoEtapa.findMany({
    orderBy: [{ cooperativaId: 'asc' }, { ordem: 'asc' }],
  });
  console.log(`Total geral: ${todas.length}`);
  todas.forEach((e, i) => {
    const gatilhos = Array.isArray(e.gatilhos) ? e.gatilhos : [];
    console.log(
      `[${i}] estado="${e.estado}" nome="${e.nome}" ativo=${e.ativo} coop=${e.cooperativaId ?? 'NULL'} mod=${e.modeloMensagemId ?? 'NULL'} gat=${gatilhos.length}`,
    );
  });
}

main().finally(() => prisma.$disconnect());
