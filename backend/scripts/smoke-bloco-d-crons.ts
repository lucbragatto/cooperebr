/**
 * Smoke D — dispara manualmente os 3 jobs de notificação proativa.
 * Whitelist LGPD (whitelist-teste.ts) bloqueia envio real em dev — só registra logs.
 *
 * Espera: serviços não lançam exception, retornam contadores zerados ou positivos.
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { NotificacoesProativasService } from '../src/notificacoes-proativas/notificacoes-proativas.service';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('═══ Smoke D — Bloco D crons E2E ═══\n');

  // Estado do banco
  const cooperativas = await prisma.cooperativa.findMany({
    where: { ativo: true },
    select: { id: true, nome: true },
  });
  console.log(`Cooperativas ativas: ${cooperativas.length}`);
  for (const c of cooperativas) {
    const pendentes = await prisma.cooperado.count({
      where: { cooperativaId: c.id, status: 'PENDENTE_DOCUMENTOS' },
    });
    const ativosSemEmailEdp = await prisma.cooperado.count({
      where: {
        cooperativaId: c.id,
        emailFaturasAtivo: false,
        contratos: { some: { status: 'ATIVO', cooperativaId: c.id } },
      },
    });
    console.log(`  ${c.nome}: ${pendentes} cooperado(s) PENDENTE_DOCUMENTOS, ${ativosSemEmailEdp} com contrato ATIVO + emailFaturasAtivo=false`);
  }

  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['warn', 'error'] });
  const service = app.get(NotificacoesProativasService);

  let pass = 0;
  let fail = 0;

  for (const coop of cooperativas) {
    console.log(`\n--- ${coop.nome} ---`);
    try {
      const a = await service.processarLembreteDocsCooperado(coop.id);
      console.log(`  CRON A: enviados=${a.enviados} pulados=${a.pulados}`);
      pass++;
    } catch (e: any) { console.log(`  CRON A ❌ ${e.message}`); fail++; }
    try {
      const b = await service.processarAlertaAdminDocsParados(coop.id);
      console.log(`  CRON B: alertado=${b.alertado} cooperados=${b.cooperados}`);
      pass++;
    } catch (e: any) { console.log(`  CRON B ❌ ${e.message}`); fail++; }
    try {
      const c = await service.processarLembreteEmailEdp(coop.id);
      console.log(`  CRON C: enviados=${c.enviados} pulados=${c.pulados}`);
      pass++;
    } catch (e: any) { console.log(`  CRON C ❌ ${e.message}`); fail++; }
  }

  await app.close();
  console.log(`\n${pass} PASS / ${fail} FAIL`);
  if (fail > 0) process.exit(1);
  console.log('✅ Smoke OK');
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
