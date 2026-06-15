/**
 * Dispara o EmailMonitorService.processarManual diretamente — bypass HTTP.
 *
 * Útil pra testar o pipeline IMAP→OCR→FaturaProcessada sem precisar de
 * JWT super-admin nem esperar o CRON das 6h. Roda exatamente a mesma logica
 * que o endpoint POST /email-monitor/processar, mas invocando o NestJS
 * standalone application sem servidor HTTP.
 *
 * REGRA INEGOCIÁVEL (decisão Luciano 14/06/2026):
 *   "Basta UMA fatura por pessoa". Aqui apenas DISPARAMOS o pipeline; a
 *   dedupe por cooperado vive dentro do service (identificarCooperado).
 *
 * Como executar (PowerShell):
 *   cd C:\Users\Luciano\cooperebr\backend
 *   npx ts-node scripts/dispara-email-monitor.ts
 *
 * O que esperar:
 *   - se SSL OK → "processados: N, pendentes: M, erros: 0"
 *   - se SSL ainda falhar → erro SELF_SIGNED_CERT_IN_CHAIN
 *   - tempo: 5-60 minutos dependendo do volume da INBOX
 */

import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { EmailMonitorService } from '../src/email-monitor/email-monitor.service';
import { PrismaService } from '../src/prisma.service';

async function main(): Promise<void> {
  console.log('\n=== DISPARO MANUAL EmailMonitorService ===\n');
  console.log('Subindo NestJS standalone (sem servidor HTTP)...');

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  const prisma = app.get(PrismaService);
  const monitor = app.get(EmailMonitorService);

  // Localizar CoopereBR REAL
  const candidatas = await prisma.cooperativa.findMany({
    where: { nome: { contains: 'CoopereBR', mode: 'insensitive' } },
    select: { id: true, nome: true, _count: { select: { cooperados: true } } },
  });
  const coop = candidatas.reduce((max, atual) =>
    atual._count.cooperados > max._count.cooperados ? atual : max,
  );

  console.log(`\nCooperativa: ${coop.nome} (id=${coop.id})`);
  console.log(`Cooperados ativos: ${coop._count.cooperados}\n`);
  console.log('▶️  Disparando processarManual... (pode demorar minutos)\n');

  const inicio = Date.now();
  try {
    const resultado = await monitor.processarManual(coop.id);
    const duracao = ((Date.now() - inicio) / 1000).toFixed(1);

    console.log('\n=== RESULTADO ===');
    console.log(`Processados: ${resultado.processados}`);
    console.log(`Pendentes:   ${resultado.pendentes}`);
    console.log(`Erros:       ${resultado.erros}`);
    console.log(`Duração:     ${duracao}s`);

    if (resultado.erros > 0) {
      console.log(
        '\n⚠️  Houve erros. Veja `pm2 logs cooperebr-backend` pra detalhes.',
      );
    } else if (resultado.processados === 0 && resultado.pendentes === 0) {
      console.log('\nℹ️  INBOX vazia ou sem anexos PDF reconheciveis.');
    } else {
      console.log('\n✅ Pipeline destravado!');
    }
  } catch (err) {
    console.error('\n❌ ERRO ao disparar processarManual:');
    console.error(err);
  } finally {
    await app.close();
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
