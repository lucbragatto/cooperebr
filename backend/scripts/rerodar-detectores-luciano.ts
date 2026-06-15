/**
 * Re-roda DetectoresRegistry sobre a FaturaCanonica persistida do Luciano,
 * SEM gastar OCR novo. Usado pra validar correções nos detectores.
 *
 * Executar:
 *   cd C:\Users\Luciano\cooperebr\backend
 *   npx ts-node scripts/rerodar-detectores-luciano.ts
 */

import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { Prisma } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma.service';
import { DetectoresRegistry } from '../src/concierge/detectores/detectores.registry';
import type { FaturaCanonica } from '../src/concierge/fatura-canonica/fatura-canonica.types';

async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });
  const prisma = app.get(PrismaService);
  const detectores = app.get(DetectoresRegistry);

  const cooperado = await prisma.cooperado.findFirst({
    where: { email: 'lucbragatto@gmail.com' },
    select: {
      nomeCompleto: true,
      faturasProcessadas: {
        select: { id: true, dadosExtraidos: true },
        take: 1,
        orderBy: { createdAt: 'desc' },
      },
    },
  });
  if (!cooperado || cooperado.faturasProcessadas.length === 0) {
    console.log('Sem fatura.');
    await app.close();
    return;
  }

  const fatura = cooperado.faturasProcessadas[0];
  const dados = fatura.dadosExtraidos as {
    concierge?: { faturaCanonica?: FaturaCanonica };
  };
  const fc = dados.concierge?.faturaCanonica;
  if (!fc) {
    console.log('Sem FaturaCanonica — rode reocerizar-fatura-concierge.ts primeiro.');
    await app.close();
    return;
  }

  console.log(`\n=== Re-rodando detectores em ${cooperado.nomeCompleto} ===\n`);

  const consolidado = detectores.detectarTodos(fc);

  console.log(`Padrões detectados: ${consolidado.padroes.length}`);
  console.log(`Indébito mensal total: R$ ${consolidado.indebitoMensalTotal.toFixed(2)}`);
  console.log(`Indébito 60m+SELIC:    R$ ${consolidado.indebito60mSelicTotal.toFixed(2)}\n`);

  for (const p of consolidado.padroes) {
    console.log('─'.repeat(80));
    console.log(`[${p.codigo}]`);
    console.log(`  Sinal:  ${p.sinal}`);
    console.log(`  Risco:  ${p.fundamento.risco}`);
    console.log(`  Mensal: R$ ${p.valorIndebitoMensal.toFixed(2)}`);
    console.log(`  60m+SELIC: R$ ${p.valorIndebito60mSelic.toFixed(2)}`);
    console.log(`  Tema: ${p.fundamento.tema}`);
    console.log(`  Detalhe:`);
    for (const linha of p.detalhe.split(' | ')) {
      console.log(`    ${linha.trim()}`);
    }
  }

  // Persiste o resultado atualizado no banco
  const merged = {
    ...(fatura.dadosExtraidos as object),
    concierge: {
      ...(dados.concierge ?? {}),
      padroes: consolidado.padroes,
      indebitoMensalTotal: consolidado.indebitoMensalTotal,
      indebito60mSelicTotal: consolidado.indebito60mSelicTotal,
      detectoresRerodadosEm: new Date().toISOString(),
    },
  };
  await prisma.faturaProcessada.update({
    where: { id: fatura.id },
    data: { dadosExtraidos: JSON.parse(JSON.stringify(merged)) as Prisma.InputJsonValue },
  });

  console.log(`\n✓ Resultado atualizado no banco.`);

  await app.close();
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
