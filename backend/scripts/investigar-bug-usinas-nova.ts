import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const usinas = await prisma.usina.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5,
    select: {
      id: true, nome: true, apelidoInterno: true,
      potenciaKwp: true, capacidadeKwh: true, producaoMensalKwh: true,
      cidade: true, estado: true, statusHomologacao: true,
      formaAquisicao: true, formaPagamentoDono: true,
      valorAluguelFixo: true, percentualGeracaoDono: true,
      observacoes: true,
      createdAt: true, updatedAt: true,
    },
  });
  console.log(`Últimas ${usinas.length} usinas (mais recente primeiro):\n`);
  for (const u of usinas) {
    console.log(`──────────────────────────────────────────`);
    console.log(`id: ${u.id}`);
    console.log(`nome: ${u.nome}`);
    console.log(`apelido: ${u.apelidoInterno}`);
    console.log(`potenciaKwp: ${u.potenciaKwp}`);
    console.log(`capacidadeKwh: ${u.capacidadeKwh}`);
    console.log(`producaoMensalKwh: ${u.producaoMensalKwh}`);
    console.log(`cidade/estado: ${u.cidade}/${u.estado}`);
    console.log(`statusHomologacao: ${u.statusHomologacao}`);
    console.log(`formaAquisicao: ${u.formaAquisicao}`);
    console.log(`formaPagamentoDono: ${u.formaPagamentoDono}`);
    console.log(`valorAluguelFixo: ${u.valorAluguelFixo}`);
    console.log(`percentualGeracaoDono: ${u.percentualGeracaoDono}`);
    console.log(`observacoes: ${u.observacoes?.slice(0, 200) ?? null}${(u.observacoes?.length ?? 0) > 200 ? '…' : ''}`);
    console.log(`createdAt: ${u.createdAt.toISOString()}`);
    console.log(`updatedAt: ${u.updatedAt.toISOString()}`);
    console.log(`tempo create→update: ${Math.round((u.updatedAt.getTime() - u.createdAt.getTime())/1000)}s`);
  }
}
main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
