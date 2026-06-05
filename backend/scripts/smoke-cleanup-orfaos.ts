/**
 * Limpa convites/cooperados órfãos deixados por rodadas anteriores do smoke
 * golden-path. Identifica por telefone começando com `5511999988` (prefixo
 * `numero-protegido` usado pelo smoke).
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Procurando convites smoke órfãos (telefone começando 5511999988)...');
  const orfaos = await prisma.conviteConvenioMembro.findMany({
    where: { telefone: { startsWith: '5511999988' } },
    select: { id: true, telefone: true, createdAt: true, usedAt: true, membroId: true },
  });
  console.log(`Encontrados ${orfaos.length} convites smoke`);

  for (const c of orfaos) {
    // Membro vinculado (cross-ref) precisa ser limpo primeiro
    if (c.membroId) {
      await prisma.aprovacaoConvenioMembro.deleteMany({ where: { membroId: c.membroId } });
      await prisma.convenioCooperado.delete({ where: { id: c.membroId } }).catch(() => null);
    }
    await prisma.conviteConvenioMembro.delete({ where: { id: c.id } });
    console.log(`  ✅ deletado convite ${c.id} (telefone=${c.telefone})`);
  }

  console.log('\nProcurando cooperados smoke órfãos (email começando smoke+)...');
  const cooperados = await prisma.cooperado.findMany({
    where: { email: { startsWith: 'smoke+' } },
    select: { id: true, email: true },
  });
  console.log(`Encontrados ${cooperados.length} cooperados smoke`);

  for (const co of cooperados) {
    await prisma.indicacao.deleteMany({ where: { cooperadoIndicadoId: co.id } });
    await prisma.aprovacaoConvenioMembro.deleteMany({
      where: { membro: { cooperadoId: co.id } },
    });
    await prisma.convenioCooperado.deleteMany({ where: { cooperadoId: co.id } });
    await prisma.uc.deleteMany({ where: { cooperadoId: co.id } });
    await prisma.cooperado.delete({ where: { id: co.id } });
    console.log(`  ✅ deletado cooperado ${co.id} (${co.email})`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
