/**
 * Seed de dados de teste — Clínica Teste com 3 membros cotas 300/400/500.
 *
 * Aplica:
 *  1. Confirma tarifa do convênio (VALOR_FIXO R$ 1,00/kWh).
 *  2. cotaKwhMensal nos 3 primeiros membros MEMBRO_ATIVO ativos da Clínica.
 *
 * Mostra ANTES/DEPOIS. Idempotente — pode rodar quantas vezes quiser.
 *
 * Uso: `npx ts-node scripts/seed-clinica-teste-cotas.ts`
 */
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const CONVENIO_ID_CLINICA = 'cmpwof5h6000avaf8547cj3pb';
const COTAS = [300, 400, 500];

async function snapshot(label: string) {
  const convenio = await prisma.contratoConvenio.findUnique({
    where: { id: CONVENIO_ID_CLINICA },
    select: {
      empresaNome: true,
      tipoTarifaEmpresa: true,
      tarifaFixaKwhEmpresa: true,
      kwhAlocadoMensal: true,
    },
  });
  const membros = await prisma.convenioCooperado.findMany({
    where: {
      convenioId: CONVENIO_ID_CLINICA,
      ativo: true,
      status: 'MEMBRO_ATIVO',
    },
    select: {
      id: true,
      cooperado: { select: { id: true, nomeCompleto: true, cotaKwhMensal: true } },
    },
    orderBy: { createdAt: 'asc' },
  });
  const somaCotas = membros.reduce(
    (acc, m) => acc + Number(m.cooperado.cotaKwhMensal ?? 0),
    0,
  );
  const tarifa = Number(convenio?.tarifaFixaKwhEmpresa ?? 0);
  const valorAPagar = Math.round(somaCotas * tarifa * 100) / 100;

  console.log(`\n═══ ${label} ═══`);
  console.log(`Convênio: ${convenio?.empresaNome} | tarifa R$ ${tarifa.toFixed(2)}/kWh | disponível ${convenio?.kwhAlocadoMensal} kWh`);
  console.log(`Membros ATIVOS (${membros.length}):`);
  membros.forEach((m, i) => {
    const c = Number(m.cooperado.cotaKwhMensal ?? 0);
    console.log(`  ${i + 1}. ${m.cooperado.nomeCompleto.padEnd(36)} cota=${c} kWh`);
  });
  console.log(`Total atual (soma): ${somaCotas} kWh | Valor a pagar: R$ ${valorAPagar.toFixed(2)}\n`);
  return { somaCotas, valorAPagar, membros };
}

async function main() {
  console.log('Seed cotas Clínica Teste — dados de teste demo\n');
  const antes = await snapshot('ANTES');
  if (antes.membros.length < 3) {
    console.error(`❌ Esperado >= 3 membros; encontrados ${antes.membros.length}.`);
    process.exit(1);
  }
  for (let i = 0; i < 3; i++) {
    const m = antes.membros[i]!;
    await prisma.cooperado.update({
      where: { id: m.cooperado.id },
      data: { cotaKwhMensal: COTAS[i] },
    });
  }
  console.log(`🌱 Cotas ${COTAS.join('/')} aplicadas nos 3 primeiros membros.`);
  await snapshot('DEPOIS');
  console.log('✅ Seed concluído. Reabra a tela do convênio pra ver.');
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error('FATAL:', e);
  process.exit(2);
});
