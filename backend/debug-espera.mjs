import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();

const usinas = await p.usina.findMany({ select: { id: true, nome: true, cooperativaId: true, capacidadeKwh: true } });
console.log('Usinas e suas cooperativaIds:');
usinas.forEach(u => console.log(` - ${u.nome}: cooperativaId=${u.cooperativaId}, capacidade=${u.capacidadeKwh}`));

const espera = await p.listaEspera.findMany({ select: { id: true, cooperativaId: true, status: true, kwhNecessario: true }, take: 5 });
console.log('\nLista de espera (5 primeiros):');
espera.forEach(e => console.log(` - cooperativaId=${e.cooperativaId}, status=${e.status}, kwh=${e.kwhNecessario}`));

// Ver se cooperativaIds batem
const usinaCoops = [...new Set(usinas.map(u => u.cooperativaId))];
const esperaCoops = [...new Set(espera.map(e => e.cooperativaId))];
console.log('\nCooperativaIds nas usinas:', usinaCoops);
console.log('CooperativaIds na lista de espera:', esperaCoops);
console.log('Batem?', usinaCoops.some(id => esperaCoops.includes(id)));

await p.$disconnect();
