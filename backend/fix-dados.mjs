import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();

const COOPEREBR_ID = 'cmn0ho8bx0000uox8wu96u6fd';

// 1. Vincular cooperados sem cooperativaId à CoopereBR
const fixCooperados = await p.cooperado.updateMany({
  where: { cooperativaId: null },
  data: { cooperativaId: COOPEREBR_ID }
});
console.log(`✅ Cooperados vinculados à CoopereBR: ${fixCooperados.count}`);

// 2. Vincular admin@cooperebr.com.br à CoopereBR
const fixAdmin = await p.usuario.update({
  where: { email: 'admin@cooperebr.com.br' },
  data: { cooperativaId: COOPEREBR_ID }
});
console.log(`✅ admin@cooperebr.com.br vinculado à CoopereBR`);

// 3. Vincular UCs sem cooperativaId
const fixUcs = await p.uc.updateMany({
  where: { cooperativaId: null },
  data: { cooperativaId: COOPEREBR_ID }
});
console.log(`✅ UCs vinculadas: ${fixUcs.count}`);

// 4. Vincular contratos sem cooperativaId
const fixContratos = await p.contrato.updateMany({
  where: { cooperativaId: null },
  data: { cooperativaId: COOPEREBR_ID }
});
console.log(`✅ Contratos vinculados: ${fixContratos.count}`);

// 5. Vincular cobranças sem cooperativaId
const fixCobrancas = await p.cobranca.updateMany({
  where: { cooperativaId: null },
  data: { cooperativaId: COOPEREBR_ID }
});
console.log(`✅ Cobranças vinculadas: ${fixCobrancas.count}`);

// Verificar resultado
const counts = {
  cooperados: await p.cooperado.count({ where: { cooperativaId: COOPEREBR_ID } }),
  ucs: await p.uc.count({ where: { cooperativaId: COOPEREBR_ID } }),
  contratos: await p.contrato.count({ where: { cooperativaId: COOPEREBR_ID } }),
};
console.log('\n=== RESULTADO FINAL — CoopereBR ===');
console.log(JSON.stringify(counts, null, 2));

await p.$disconnect();
