import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Busca ou cria a cooperativa padrão
  let cooperativa = await prisma.cooperativa.findFirst();
  if (!cooperativa) {
    cooperativa = await prisma.cooperativa.create({
      data: {
        nome: 'CoopereBR',
        cnpj: '00.000.000/0001-00',
        email: 'contato@cooperebr.com.br',
      },
    });
    console.log('Cooperativa padrão criada:', cooperativa.id);
  }

  const existing = await prisma.configuracaoCobranca.findFirst({
    where: { cooperativaId: cooperativa.id, usinaId: null },
  });

  const data = {
    descontoPadrao: 20,
    descontoMin: 10,
    descontoMax: 35,
    baseCalculo: 'TUSD_TE' as const,
  };

  const config = existing
    ? await prisma.configuracaoCobranca.update({ where: { id: existing.id }, data })
    : await prisma.configuracaoCobranca.create({ data: { ...data, cooperativaId: cooperativa.id } });

  console.log('ConfiguracaoCobranca criada/atualizada:', config);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
