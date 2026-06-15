import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

(async () => {
  const contas = await prisma.planoContas.findMany({
    select: {
      id: true,
      codigo: true,
      nome: true,
      cooperativaId: true,
      naturezaContabil: true,
      naturezaCooperativa: true,
      fundamentoLegal: true,
      ativo: true,
    },
    orderBy: { codigo: 'asc' },
  });
  console.log(`TOTAL CONTAS: ${contas.length}`);
  const globais = contas.filter((c) => c.cooperativaId === null);
  const porCoop = contas.filter((c) => c.cooperativaId !== null);
  const pendentes = contas.filter((c) => !c.naturezaContabil);
  console.log(`Globais (cooperativaId=null): ${globais.length}`);
  console.log(`Tenant-scoped: ${porCoop.length}`);
  console.log(`Pendentes (naturezaContabil=null): ${pendentes.length}`);
  console.log('---DETALHE---');
  contas.forEach((c) => {
    const cId = c.cooperativaId ? c.cooperativaId.slice(0, 8) : 'GLOBAL  ';
    console.log(
      `${c.codigo.padEnd(8)} ${c.nome.padEnd(40)} ${cId} contabil=${(c.naturezaContabil ?? '—').padEnd(24)} coop=${(c.naturezaCooperativa ?? '—').padEnd(17)} fund="${(c.fundamentoLegal ?? '—').slice(0, 30)}"`,
    );
  });
  console.log('---COOPERATIVAS---');
  const coops = await prisma.cooperativa.findMany({ select: { id: true, nome: true } });
  coops.forEach((c) => console.log(`${c.id}  ${c.nome}`));
  console.log('---ADMINs CADASTRADOS---');
  const admins = await prisma.usuario.findMany({
    where: { perfil: { in: ['ADMIN', 'SUPER_ADMIN'] } },
    select: {
      email: true,
      perfil: true,
      cooperativaId: true,
      cooperativa: { select: { nome: true } },
    },
  });
  admins.forEach((a) => console.log(`${a.email.padEnd(40)} ${a.perfil}  coop=${a.cooperativa?.nome ?? '—'} (${a.cooperativaId ?? 'null'})`));
  await prisma.$disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
