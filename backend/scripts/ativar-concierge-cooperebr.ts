/**
 * Script idempotente — ativa o modulo Concierge Tributario pra CoopereBR.
 *
 * Uso: cd backend ; npx ts-node scripts/ativar-concierge-cooperebr.ts
 *
 * Operacao read-only no banco se ja estiver ativo (idempotente).
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  // Identifica CoopereBR pelo CNPJ ou nome "CoopereBR" (sem o sufixo "Teste")
  const cooperebr = await prisma.cooperativa.findFirst({
    where: {
      nome: 'CoopereBR',
      // garante que nao pega a "CoopereBR Teste"
      NOT: { nome: { contains: 'Teste' } },
    },
    select: {
      id: true,
      nome: true,
      moduloConciergeAtivo: true,
      conciergeAtivadoEm: true,
    },
  });

  if (!cooperebr) {
    console.error('[ativar-concierge] CoopereBR nao encontrada no banco.');
    process.exit(1);
  }

  console.log(`[ativar-concierge] CoopereBR id=${cooperebr.id}`);
  console.log(
    `[ativar-concierge] estado atual: moduloConciergeAtivo=${cooperebr.moduloConciergeAtivo} conciergeAtivadoEm=${cooperebr.conciergeAtivadoEm?.toISOString() ?? 'null'}`,
  );

  if (cooperebr.moduloConciergeAtivo) {
    console.log('[ativar-concierge] modulo JA esta ativo - nada a fazer (idempotente)');
    return;
  }

  await prisma.cooperativa.update({
    where: { id: cooperebr.id },
    data: {
      moduloConciergeAtivo: true,
      conciergeAtivadoEm: new Date(),
    },
  });
  console.log('[ativar-concierge] modulo ATIVADO com sucesso pra CoopereBR.');
}

main()
  .catch((e) => {
    console.error('[ativar-concierge] ERRO:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
