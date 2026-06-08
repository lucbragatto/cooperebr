/**
 * Cleanup pós-F2.10 (08/06/2026):
 * 1. Reseta conversa do telefone Luciano (estado ENCERRADO → INICIAL,
 *    cooperadoId/cooperativaId null → re-identificação via VERIFICAR_COOPERADO).
 * 2. Marca cooperado "teste" PENDENTE duplicado (mesmo telefone) com
 *    telefone null pra não colidir com Luciano em lookups futuros.
 *    (NÃO deleta — só anonimiza o telefone do registro sintético.)
 */
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log('═══ Cleanup conversa Luciano + duplicata "teste" ═══\n');

  // (1) Reset conversa
  const conv = await prisma.conversaWhatsapp.update({
    where: { telefone: '5527981341348' },
    data: {
      estado: 'INICIAL',
      cooperadoId: null,
      cooperativaId: null,
      dadosTemp: undefined,
    },
    select: { id: true, estado: true, cooperadoId: true, cooperativaId: true, updatedAt: true },
  });
  console.log('✅ Conversa Luciano resetada:', conv);

  // (2) Marca cooperado "teste" duplicado com telefone null (sem deletar)
  const teste = await prisma.cooperado.findUnique({
    where: { id: 'cmpzl0izf0002vac4vuug9mvv' },
    select: { id: true, nomeCompleto: true, telefone: true, status: true },
  });
  if (!teste) {
    console.log('ℹ️ Cooperado "teste" cmpzl0izf0002vac4vuug9mvv não encontrado — skip.');
  } else {
    console.log('ANTES:', teste);
    const atual = await prisma.cooperado.update({
      where: { id: teste.id },
      data: { telefone: null },
      select: { id: true, nomeCompleto: true, telefone: true, status: true },
    });
    console.log('DEPOIS:', atual);
  }

  // (3) Confirma SÓ Luciano fica com 5527981341348
  const matches = await prisma.cooperado.findMany({
    where: { telefone: '5527981341348' },
    select: { id: true, nomeCompleto: true, status: true },
  });
  console.log(`\nMatches finais com telefone='5527981341348': ${matches.length}`);
  for (const c of matches) console.log(`  - ${c.id} | ${c.nomeCompleto} | ${c.status}`);
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
