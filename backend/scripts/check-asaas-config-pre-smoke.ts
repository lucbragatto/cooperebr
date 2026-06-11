/**
 * Pre-smoke check F2: confirma que existe AsaasConfig pra CoopereBR e
 * pega o webhookToken pra disparar webhooks locais no smoke.
 */
import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
(async () => {
  const ambienteReal = process.env.AMBIENTE_REAL;
  console.log(`[check] AMBIENTE_REAL env: ${ambienteReal ?? 'undefined (DEV)'}`);

  const coop = await p.cooperativa.findFirst({
    where: { nome: { contains: 'CoopereBR', mode: 'insensitive' } },
    select: { id: true, nome: true },
  });
  console.log(`[check] cooperativa: ${coop?.nome ?? 'NAO ACHADA'} (${coop?.id ?? '?'})`);

  if (!coop) {
    await p.$disconnect();
    return;
  }

  const config = await p.asaasConfig.findUnique({
    where: { cooperativaId: coop.id },
    select: {
      id: true,
      ambiente: true,
      apiKey: true,
      webhookToken: true,
    },
  });
  console.log(`[check] AsaasConfig:`, {
    ambiente: config?.ambiente,
    apiKeyDef: !!config?.apiKey,
    webhookTokenDef: !!config?.webhookToken,
  });

  // Santi
  const santi = await p.cooperado.findUnique({
    where: { id: 'cmq6qo4hi0002va2wti5k1sqw' },
    select: { id: true, nomeCompleto: true, tipoPessoa: true, status: true, ambienteTeste: true, cooperativaId: true },
  });
  console.log(`[check] Santi:`, santi);

  await p.$disconnect();
})();
