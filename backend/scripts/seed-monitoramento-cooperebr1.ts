/**
 * Sub-Sprint F Etapa E (M30, 2026-05-26).
 *
 * Cria UsinaMonitoramentoConfig PLACEHOLDER pra cooperebr1 com:
 * - habilitado: false (NAO ativa monitoramento real — credenciais vazias)
 * - intervaloMinutos: 30 (default)
 * - sungrowUsuario/Senha/AppKey/PlantId: null
 *
 * Luciano preenche credenciais reais via UI admin /dashboard/usinas/[id]/monitoramento
 * quando E-Solares fornecer dados de acesso ao iSolar Cloud (Sungrow).
 *
 * Idempotente: se ja existe config pra usina cooperebr1, nao recria.
 *
 * Execucao:
 *   ./node_modules/.bin/ts-node scripts/seed-monitoramento-cooperebr1.ts
 */
import { PrismaClient } from '@prisma/client';

const COOPEREBR_ID = 'cmn0ho8bx0000uox8wu96u6fd';
const APELIDO = 'cooperebr1';

async function main() {
  const prisma = new PrismaClient();

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('🌞 Seed UsinaMonitoramentoConfig placeholder pra cooperebr1');
  console.log('   Sub-Sprint F Etapa E (M30, 2026-05-26)');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const usina = await prisma.usina.findFirst({
    where: { cooperativaId: COOPEREBR_ID, apelidoInterno: APELIDO },
    select: { id: true, nome: true },
  });

  if (!usina) {
    console.log('❌ Usina cooperebr1 nao encontrada. Rodar seed-cooperebr1-usina.ts primeiro.');
    await prisma.$disconnect();
    process.exit(1);
  }

  console.log(`Usina: ${usina.nome} (id=${usina.id})\n`);

  const existente = await prisma.usinaMonitoramentoConfig.findUnique({
    where: { usinaId: usina.id },
  });

  if (existente) {
    console.log(`⚠️  Config ja existe (id=${existente.id})`);
    console.log(`    habilitado: ${existente.habilitado}`);
    console.log(`    intervaloMinutos: ${existente.intervaloMinutos}`);
    console.log(`    sungrowUsuario: ${existente.sungrowUsuario ?? '(vazio)'}`);
    console.log(`    sungrowPlantId: ${existente.sungrowPlantId ?? '(vazio)'}`);
    console.log(`    sungrowSenha: ${existente.sungrowSenha ? '(senha definida)' : '(vazio)'}`);
    console.log(`\n    Idempotente: nao recria. Edite via UI admin.`);
    await prisma.$disconnect();
    return;
  }

  const config = await prisma.usinaMonitoramentoConfig.create({
    data: {
      usinaId: usina.id,
      cooperativaId: COOPEREBR_ID,
      habilitado: false, // CRITICAL: placeholder — nao ativa cron pra essa usina
      intervaloMinutos: 30,
      reCheckMinutos: 10,
      potenciaMinimaPct: 20,
      sungrowUsuario: null,
      sungrowSenha: null,
      sungrowAppKey: null,
      sungrowPlantId: null,
      prioridadeAlerta: 'ALTA',
    },
  });

  console.log(`✅ UsinaMonitoramentoConfig CRIADA (id=${config.id})`);
  console.log(`   habilitado: false (placeholder — NAO ativa monitoramento real)`);
  console.log(`   intervaloMinutos: 30 (cron a cada 30 min quando habilitado=true)`);
  console.log(`\n📋 PROXIMOS PASSOS LUCIANO:`);
  console.log(`   1. Obter credenciais iSolar Cloud / Sungrow com E-Solares`);
  console.log(`   2. Acessar /dashboard/usinas/${usina.id}/monitoramento (UI admin)`);
  console.log(`   3. Preencher: sungrowUsuario, sungrowSenha, sungrowAppKey, sungrowPlantId`);
  console.log(`   4. Marcar habilitado=true pra ativar cron a cada 30min`);
  console.log(`\n   Senha sera encryptada via CredentialsEncryptor (GATEWAY_ENCRYPT_KEY) ao salvar.`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error('Falha:', e);
  process.exit(1);
});
