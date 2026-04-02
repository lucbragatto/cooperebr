import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

// Ver quem convidou Luciano — buscar pelo telefone em ConvitePendente ou similar
try {
  const convites = await prisma.convitePendente.findMany({ take: 5 });
  console.log('ConvitePendente:', JSON.stringify(convites, null, 2));
} catch(e) { console.log('Sem ConvitePendente'); }

// Ver todos os cooperados para achar o de Luciano
const coop = await prisma.cooperado.findMany({
  where: { OR: [
    { telefone: { contains: '27981341348' } },
    { telefone: { contains: '5527981341348' } },
  ]},
  select: { id: true, nomeCompleto: true, telefone: true, status: true, createdAt: true }
});
console.log('=== COOPERADO LUCIANO ===');
console.log(JSON.stringify(coop, null, 2));

// Ver estrutura da tabela Indicacao
const indSchema = await prisma.$queryRaw`
  SELECT column_name, data_type 
  FROM information_schema.columns 
  WHERE table_name = 'Indicacao'
  ORDER BY ordinal_position
`;
console.log('=== SCHEMA INDICACAO ===');
console.log(JSON.stringify(indSchema, null, 2));

// Ver total de indicacoes no banco
const total = await prisma.indicacao.count();
console.log('Total indicacoes:', total);

// Quem indicou quem — pegar indicacoes com status PENDENTE
const pendInd = await prisma.indicacao.findMany({
  where: { status: { notIn: ['PRIMEIRA_FATURA_PAGA'] } },
  take: 10,
  select: { id: true, cooperadoIndicadorId: true, cooperadoIndicadoId: true, status: true, createdAt: true }
});
console.log('=== INDICACOES PENDENTES ===');
console.log(JSON.stringify(pendInd, null, 2));

await prisma.$disconnect();
