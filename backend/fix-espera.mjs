import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();

// Buscar todos da lista de espera sem kwhNecessario
const lista = await p.listaEspera.findMany({
  include: { cooperado: { select: { nomeCompleto: true, cotaKwhMensal: true } } }
});

console.log(`Lista de espera: ${lista.length} registros`);
console.log('Amostra:', lista.slice(0,3).map(e => ({
  nome: e.cooperado.nomeCompleto,
  kwhNecessario: e.kwhNecessario,
  cotaKwh: e.cooperado.cotaKwhMensal
})));

// Atualizar os que têm kwhNecessario zerado ou nulo
let atualizados = 0;
for (const item of lista) {
  if (!item.kwhNecessario || Number(item.kwhNecessario) === 0) {
    // Usar cotaKwhMensal do cooperado, ou default 200 kWh
    const kwh = Number(item.cooperado.cotaKwhMensal) || 200;
    await p.listaEspera.update({
      where: { id: item.id },
      data: { kwhNecessario: kwh }
    });
    atualizados++;
  }
}

console.log(`\nAtualizados: ${atualizados} registros com kwhNecessario`);

// Mostrar estado final
const final = await p.listaEspera.findMany({
  include: { cooperado: { select: { nomeCompleto: true } } },
  orderBy: { posicao: 'asc' },
  take: 5
});
console.log('\nPrimeiros 5 da fila:');
final.forEach(e => console.log(` ${e.posicao}. ${e.cooperado.nomeCompleto} — ${e.kwhNecessario} kWh`));

await p.$disconnect();
