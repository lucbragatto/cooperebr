import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();

const tarifas = await p.tarifaConcessionaria.findMany({ orderBy: { dataVigencia: 'desc' }, take: 3 });
console.log('=== Tarifas no banco ===');
console.log(JSON.stringify(tarifas, null, 2));

const config = await p.configuracaoMotor.findFirst();
console.log('\n=== Config motor ===');
console.log(JSON.stringify(config, null, 2));

const configTenant = await p.configTenant.findMany();
console.log('\n=== ConfigTenant ===');
console.log(JSON.stringify(configTenant, null, 2));

await p.$disconnect();
