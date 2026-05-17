import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log('═══ Verificação Prisma Client — Sub-Fase 1 ═══\n');

  // Verificar que os 2 novos models estão expostos
  const hasEnvioLista = typeof (prisma as any).envioListaConcessionaria === 'object';
  const hasEnvioCooperado = typeof (prisma as any).envioListaCooperado === 'object';

  console.log(`prisma.envioListaConcessionaria exposto: ${hasEnvioLista ? '✅' : '❌'}`);
  console.log(`prisma.envioListaCooperado exposto:      ${hasEnvioCooperado ? '✅' : '❌'}`);

  // Smoke: contar registros (0 esperado — banco vazio)
  if (hasEnvioLista) {
    const count1 = await prisma.envioListaConcessionaria.count();
    console.log(`COUNT envios_lista_concessionaria:       ${count1} (esperado 0)`);
  }
  if (hasEnvioCooperado) {
    const count2 = await prisma.envioListaCooperado.count();
    console.log(`COUNT envio_lista_cooperados:            ${count2} (esperado 0)`);
  }

  // Verificar campo novo em Usina
  const usinas = await prisma.usina.findMany({
    select: { id: true, nome: true, classeGdAnotada: true },
    take: 3,
  });
  console.log(`\nclasseGdAnotada exposto em Usina (3 amostras):`);
  for (const u of usinas) {
    console.log(`  ${u.nome.slice(0, 40).padEnd(40)} | classeGdAnotada=${u.classeGdAnotada ?? 'null'}`);
  }
}

main()
  .catch((e) => { console.error('ERRO:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
