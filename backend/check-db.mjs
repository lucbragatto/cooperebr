import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();

const total = await p.cooperado.count();
const comContrato = await p.contrato.count({ where: { status: { in: ['ATIVO', 'PENDENTE_ATIVACAO'] } } });
const listaEspera = await p.listaEspera.count();
const porStatus = await p.cooperado.groupBy({ by: ['status'], _count: true });

console.log('Total cooperados:', total);
console.log('Com contrato ativo:', comContrato);
console.log('Na lista de espera:', listaEspera);
console.log('Por status:', JSON.stringify(porStatus, null, 2));

const espera = await p.listaEspera.findMany({ 
  include: { cooperado: { select: { nome: true } } },
  take: 5 
});
console.log('\nPrimeiros da lista de espera:', JSON.stringify(espera.map(e => ({ nome: e.cooperado.nome, kwhNecessario: e.kwhNecessario, posicao: e.posicao })), null, 2));

await p.$disconnect();
