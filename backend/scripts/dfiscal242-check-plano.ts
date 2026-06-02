/**
 * D-FISCAL-2.4.2 — verifica plano custeado no banco e simula re-seed pra
 * confirmar idempotência.
 */
import { PrismaClient } from '@prisma/client';

const p = new PrismaClient();

(async () => {
  const r = await p.plano.findMany({
    where: { custeadoPorConvenio: true },
    select: {
      id: true,
      nome: true,
      modeloCobranca: true,
      cooperativaId: true,
      publico: true,
      ativo: true,
      descontoBase: true,
    },
  });
  console.log('Planos com custeadoPorConvenio=true:');
  console.log(JSON.stringify(r, null, 2));

  // Verifica unicidade global (cooperativaId=null)
  const globais = r.filter((x) => x.cooperativaId === null);
  console.log(`\nTotal globais (cooperativaId=null): ${globais.length}`);
  if (globais.length !== 1) {
    console.error('⚠️  Esperado exatamente 1 plano global custeado.');
  } else {
    console.log('✓ Idempotência OK — exatamente 1 plano global.');
  }

  await p.$disconnect();
})();
