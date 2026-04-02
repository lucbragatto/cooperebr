import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const hoje = new Date('2026-04-01T00:00:00-03:00');

const msgs = await prisma.mensagemWhatsapp.findMany({
  where: {
    createdAt: { gte: hoje },
    direcao: 'SAIDA',
  },
  select: {
    telefone: true,
    conteudo: true,
    createdAt: true,
    status: true,
  },
  orderBy: { createdAt: 'asc' },
});

console.log(`Total enviadas hoje: ${msgs.length}`);
const numeros = [...new Set(msgs.map(m => m.telefone))];
console.log(`Números únicos: ${numeros.length}`);
numeros.forEach(n => console.log(' -', n));
if (msgs.length > 0) {
  console.log('\nPrimeiras 5 mensagens:');
  msgs.slice(0, 5).forEach(m => console.log(` [${m.createdAt.toISOString()}] ${m.telefone}: ${String(m.conteudo).substring(0, 80)}`));
}

await prisma.$disconnect();
