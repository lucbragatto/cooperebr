import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const SEED_COOP_ID = 'cmn7qygzg0000uoawdtfvokt5';
const REAL_COOP_ID = 'cmn0ho8bx0000uox8wu96u6fd';

async function main() {
  console.log('🔧 Migrando seed data para cooperativa existente...\n');

  // Atualiza ConfigClubeVantagens
  const clubeUpdate = await prisma.configClubeVantagens.updateMany({
    where: { cooperativaId: SEED_COOP_ID },
    data: { cooperativaId: REAL_COOP_ID },
  });
  console.log(`ConfigClubeVantagens: ${clubeUpdate.count} atualizado(s)`);

  // Atualiza Administradora
  const admUpdate = await prisma.administradora.updateMany({
    where: { cooperativaId: SEED_COOP_ID },
    data: { cooperativaId: REAL_COOP_ID },
  });
  console.log(`Administradora: ${admUpdate.count} atualizado(s)`);

  // Atualiza Condominio
  const condUpdate = await prisma.condominio.updateMany({
    where: { cooperativaId: SEED_COOP_ID },
    data: { cooperativaId: REAL_COOP_ID },
  });
  console.log(`Condominio: ${condUpdate.count} atualizado(s)`);

  // Atualiza Cooperados
  const cooperadoUpdate = await prisma.cooperado.updateMany({
    where: { cooperativaId: SEED_COOP_ID },
    data: { cooperativaId: REAL_COOP_ID },
  });
  console.log(`Cooperados: ${cooperadoUpdate.count} atualizado(s)`);

  // Atualiza UCs
  const ucUpdate = await prisma.uc.updateMany({
    where: { cooperativaId: SEED_COOP_ID },
    data: { cooperativaId: REAL_COOP_ID },
  });
  console.log(`UCs: ${ucUpdate.count} atualizado(s)`);

  // Atualiza Usinas
  const usinaUpdate = await prisma.usina.updateMany({
    where: { cooperativaId: SEED_COOP_ID },
    data: { cooperativaId: REAL_COOP_ID },
  });
  console.log(`Usinas: ${usinaUpdate.count} atualizado(s)`);

  // Atualiza Planos
  const planoUpdate = await prisma.plano.updateMany({
    where: { cooperativaId: SEED_COOP_ID },
    data: { cooperativaId: REAL_COOP_ID },
  });
  console.log(`Planos: ${planoUpdate.count} atualizado(s)`);

  // Atualiza Contratos
  const contratoUpdate = await prisma.contrato.updateMany({
    where: { cooperativaId: SEED_COOP_ID },
    data: { cooperativaId: REAL_COOP_ID },
  });
  console.log(`Contratos: ${contratoUpdate.count} atualizado(s)`);

  // Atualiza Cobranças
  const cobrancaUpdate = await prisma.cobranca.updateMany({
    where: { cooperativaId: SEED_COOP_ID },
    data: { cooperativaId: REAL_COOP_ID },
  });
  console.log(`Cobranças: ${cobrancaUpdate.count} atualizado(s)`);

  // Também configura o ConfigClubeVantagens para a cooperativa real se não existir
  const existingConfig = await prisma.configClubeVantagens.findUnique({
    where: { cooperativaId: REAL_COOP_ID },
  });
  if (!existingConfig) {
    await prisma.configClubeVantagens.create({
      data: {
        cooperativaId: REAL_COOP_ID,
        ativo: true,
        criterio: 'KWH_INDICADO_ACUMULADO',
        niveisConfig: [
          { nivel: 'BRONZE', minKwh: 0, maxKwh: 5000, beneficioPercentual: 2 },
          { nivel: 'PRATA', minKwh: 5001, maxKwh: 15000, beneficioPercentual: 4 },
          { nivel: 'OURO', minKwh: 15001, maxKwh: 50000, beneficioPercentual: 6 },
          { nivel: 'DIAMANTE', minKwh: 50001, maxKwh: null, beneficioPercentual: 10 },
        ],
      },
    });
    console.log('ConfigClubeVantagens para cooperativa real: CRIADO');
  } else {
    console.log('ConfigClubeVantagens para cooperativa real: já existe');
  }

  console.log('\n✅ Migração concluída!');

  // Verificar resultado
  const condominios = await prisma.condominio.findMany({
    where: { cooperativaId: REAL_COOP_ID },
    select: { id: true, nome: true },
  });
  console.log('\nCondominios na cooperativa real:', condominios.map(c => c.nome));
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
