/**
 * D-FISCAL-2.4.4a — verifica plano "Consolidador de Custeio" no banco.
 * Confirma idempotência do seed (1 único registro global).
 */
import { PrismaClient } from '@prisma/client';

const p = new PrismaClient();

(async () => {
  const planos = await p.plano.findMany({
    where: {
      OR: [
        { custeadoPorConvenio: true },
        { nome: 'Consolidador de Custeio' },
      ],
    },
    select: {
      id: true,
      nome: true,
      modeloCobranca: true,
      cooperativaId: true,
      publico: true,
      ativo: true,
      descontoBase: true,
      custeadoPorConvenio: true,
    },
  });
  console.log('Planos globais técnicos D-FISCAL-2.4:');
  console.log(JSON.stringify(planos, null, 2));

  const custeado = planos.filter(
    (p) => p.custeadoPorConvenio === true && p.cooperativaId === null,
  );
  const consolidador = planos.filter(
    (p) => p.nome === 'Consolidador de Custeio' && p.cooperativaId === null,
  );

  console.log(`\nTotais:`);
  console.log(`  Custeado por convênio (global): ${custeado.length} (esperado 1)`);
  console.log(`  Consolidador de Custeio (global): ${consolidador.length} (esperado 1)`);

  if (custeado.length !== 1 || consolidador.length !== 1) {
    console.error('⚠️  Falha de idempotência — seed gerou múltiplas instâncias.');
    process.exit(1);
  }

  // CRÍTICO: consolidador NÃO PODE ser custeado
  if (consolidador[0].custeadoPorConvenio === true) {
    console.error(
      '🚨 BUG GRAVE — plano "Consolidador de Custeio" está com custeadoPorConvenio=true. ' +
        'Os GUARDs da 2.4.2 vão suprimir a própria cobrança consolidada. Corrigir AGORA.',
    );
    process.exit(1);
  }

  console.log(
    `\n✓ Custeado=true: ${custeado[0].id} (${custeado[0].nome})`,
  );
  console.log(
    `✓ Consolidador (custeado=false): ${consolidador[0].id} (${consolidador[0].nome})`,
  );
  console.log(`✓ Idempotência OK + flags corretas.`);

  await p.$disconnect();
})();
