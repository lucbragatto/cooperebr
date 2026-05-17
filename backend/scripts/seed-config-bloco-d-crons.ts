/**
 * Bloco D — Seed configs tenant pra os 3 crons proativos.
 * Idempotente: usa upsert.
 *
 * Defaults conservadores:
 *   - CRON A: 48h espera, max 5 lembretes
 *   - CRON B: 7d limite
 *   - CRON C: 24h primeiro lembrete + reforço 72h se EDP-PENDENTE
 */
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const CONFIGS = [
  { chave: 'cron_lembrete_doc_cooperado_ativo', valor: 'true' },
  { chave: 'cron_lembrete_doc_cooperado_horas', valor: '48' },
  { chave: 'cron_lembrete_doc_cooperado_max_tentativas', valor: '5' },
  { chave: 'cron_alerta_admin_doc_ativo', valor: 'true' },
  { chave: 'cron_alerta_admin_doc_dias', valor: '7' },
  { chave: 'cron_lembrete_email_edp_ativo', valor: 'true' },
  { chave: 'cron_lembrete_email_edp_horas', valor: '24' },
  // Email admin alertas — default temporário Luciano (validação)
  { chave: 'email_admin_alertas', valor: 'lucbragatto+admin@gmail.com' },
  // Email institucional usado nas instruções EDP (CRON C)
  { chave: 'email_institucional_parceiro', valor: 'contato@cooperebr.com.br' },
];

async function main() {
  console.log('═══ Seed configs Bloco D ═══\n');
  const coops = await prisma.cooperativa.findMany({
    where: { nome: { contains: 'CoopereBR' } },
    select: { id: true, nome: true },
  });
  for (const coop of coops) {
    console.log(`\nCooperativa: ${coop.nome} (${coop.id})`);
    for (const cfg of CONFIGS) {
      const r = await prisma.configTenant.upsert({
        where: { chave_cooperativaId: { chave: cfg.chave, cooperativaId: coop.id } },
        update: { valor: cfg.valor },
        create: { chave: cfg.chave, valor: cfg.valor, cooperativaId: coop.id },
        select: { chave: true, valor: true },
      });
      console.log(`  ✓ ${r.chave} = ${r.valor}`);
    }
  }
  console.log('\n✅ Seed concluído.');
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
