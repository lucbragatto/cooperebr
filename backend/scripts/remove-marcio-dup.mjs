import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

// Buscar todos os Marcio Maciel
const marcioList = await prisma.cooperado.findMany({
  where: { nomeCompleto: { contains: 'MARCIO MACIEL', mode: 'insensitive' } },
  orderBy: { createdAt: 'asc' }
});

console.log('Encontrados:', marcioList.map(m => ({ id: m.id, cpf: m.cpf, createdAt: m.createdAt })));

// Remove o sem CPF ou o mais antigo sem dados
const semCpf = marcioList.find(m => !m.cpf || m.cpf === '');
if (semCpf) {
  await prisma.cooperado.delete({ where: { id: semCpf.id } });
  console.log('Removido duplicado sem CPF:', semCpf.id);
} else {
  // Remove o mais antigo (primeiro criado)
  await prisma.cooperado.delete({ where: { id: marcioList[0].id } });
  console.log('Removido duplicado mais antigo:', marcioList[0].id);
}

await prisma.$disconnect();
