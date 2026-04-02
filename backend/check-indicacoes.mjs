import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

// Quem convidou Luciano (telefone 5527981341348)
const conv = await prisma.leadExpansao.findMany({
  where: { telefone: { contains: '27981341348' } },
  select: { id: true, nomeCompleto: true, telefone: true, status: true, createdAt: true, intencaoConfirmada: true }
});
console.log('=== LEAD DO LUCIANO ===');
console.log(JSON.stringify(conv, null, 2));

// Todos os convites pendentes (pessoas que foram convidadas mas nao concluiram)
const pendentes = await prisma.leadExpansao.findMany({
  where: { status: { in: ['PENDENTE', 'PENDENTE_CONVITE', 'NOVO'] } },
  select: { id: true, nomeCompleto: true, telefone: true, status: true, createdAt: true }
});
console.log('=== LEADS PENDENTES ===');
console.log(JSON.stringify(pendentes, null, 2));

// Verificar se existe tabela Indicacao
try {
  const indicacoes = await prisma.indicacao.findMany({ take: 5 });
  console.log('=== INDICACOES ===');
  console.log(JSON.stringify(indicacoes, null, 2));
} catch(e) {
  console.log('Tabela Indicacao nao existe:', e.message.split('\n')[0]);
}

// Cooperados com campo indicadorId ou similar
const schema = await prisma.$queryRaw`
  SELECT column_name, data_type 
  FROM information_schema.columns 
  WHERE table_name IN ('LeadExpansao', 'Cooperado', 'leadExpansao', 'cooperado')
  AND column_name ILIKE '%indica%'
`;
console.log('=== CAMPOS DE INDICACAO NO SCHEMA ===');
console.log(JSON.stringify(schema, null, 2));

await prisma.$disconnect();
