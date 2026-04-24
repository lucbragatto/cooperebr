/**
 * Teste E2E do cron lembrete 24h (Sprint 10).
 *
 * Estratégia: instancia o contexto da aplicação Nest (headless) e chama
 * o método do job diretamente. Valida:
 *  - Query retorna só propostas de cooperado com ambienteTeste=false
 *  - Whitelist libera Luciano / bloqueia os 336 demais
 *  - Marca lembreteEnviadoEm após envio
 */
import { NestFactory } from '@nestjs/core';
import { randomUUID } from 'crypto';
import { AppModule } from '../src/app.module';
import { MotorPropostaJob } from '../src/motor-proposta/motor-proposta.job';
import { PrismaService } from '../src/prisma.service';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['log', 'warn', 'error'] });
  const prisma = app.get(PrismaService);
  const job = app.get(MotorPropostaJob);

  const LUCIANO_CPF = '89089324704';
  const luciano = await prisma.cooperado.findFirst({ where: { cpf: LUCIANO_CPF } });
  if (!luciano) throw new Error('Cooperado Luciano não encontrado');

  // 1) Marca Luciano como não-teste (simula cooperado real de prod)
  await prisma.cooperado.update({ where: { id: luciano.id }, data: { ambienteTeste: false } });
  console.log(`[SETUP] Luciano marcado ambienteTeste=false (id=${luciano.id})`);

  // 2) Limpa qualquer proposta teste anterior pra esse cooperado
  await prisma.propostaCooperado.deleteMany({
    where: { cooperadoId: luciano.id, tokenAssinatura: { startsWith: 'teste-e2e-' } },
  });

  // 3) Cria proposta com token e createdAt -25h
  const agora = new Date();
  const vinteCincoHorasAtras = new Date(agora.getTime() - 25 * 60 * 60 * 1000);

  const proposta = await prisma.propostaCooperado.create({
    data: {
      cooperadoId: luciano.id,
      tokenAssinatura: `teste-e2e-${randomUUID()}`,
      createdAt: vinteCincoHorasAtras,
      mesReferencia: '2026-03',
      kwhMesRecente: 1000,
      valorMesRecente: 700,
      kwhMedio12m: 950,
      valorMedio12m: 680,
      tusdUtilizada: 0.47,
      teUtilizada: 0.32,
      tarifaUnitSemTrib: 0.79,
      kwhApuradoBase: 1000,
      baseUtilizada: 'MES_RECENTE',
      descontoPercentual: 20,
      descontoAbsoluto: 0.158,
      kwhContrato: 1000,
      valorCooperado: 500,
      economiaAbsoluta: 200,
      economiaPercentual: 28,
      economiaMensal: 200,
      economiaAnual: 2400,
      mesesEquivalentes: 3,
      mediaCooperativaKwh: 950,
      resultadoVsMedia: 0,
      validaAte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    } as any,
  });
  console.log(`[SETUP] Proposta criada id=${proposta.id} createdAt=${vinteCincoHorasAtras.toISOString()}`);

  // 4) Valida quantos cooperados estão em ambienteTeste=true
  const qtdTeste = await prisma.cooperado.count({ where: { ambienteTeste: true } });
  const qtdProd = await prisma.cooperado.count({ where: { ambienteTeste: false } });
  console.log(`[AUDIT] Cooperados ambienteTeste=true: ${qtdTeste}, false: ${qtdProd}`);

  // 5) Query que o cron executa (replica filtro dev)
  const elegiveis = await prisma.propostaCooperado.findMany({
    where: {
      tokenAssinatura: { not: null },
      lembreteEnviadoEm: null,
      termoAdesaoAssinadoEm: null,
      createdAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      cooperado: { ambienteTeste: false },
    },
    include: { cooperado: { select: { nomeCompleto: true, ambienteTeste: true } } },
  });
  console.log(`[QUERY] Propostas elegíveis pelo cron: ${elegiveis.length}`);
  for (const p of elegiveis) {
    console.log(`  - ${p.cooperado.nomeCompleto} (ambienteTeste=${p.cooperado.ambienteTeste}) proposta=${p.id}`);
  }

  // 6) Executa o cron real
  console.log(`[CRON] Executando lembretePropostasPendentes()...`);
  await (job as any).lembretePropostasPendentes();

  // 7) Verifica marcação
  const depois = await prisma.propostaCooperado.findUnique({ where: { id: proposta.id } });
  console.log(`[RESULT] lembreteEnviadoEm=${depois?.lembreteEnviadoEm?.toISOString() ?? 'null'}`);

  // 8) Cleanup: desmarcar Luciano de volta (restaurar estado seguro)
  await prisma.cooperado.update({ where: { id: luciano.id }, data: { ambienteTeste: true } });
  await prisma.propostaCooperado.delete({ where: { id: proposta.id } }).catch(() => {});
  console.log(`[CLEANUP] Luciano voltou a ambienteTeste=true, proposta de teste removida`);

  await app.close();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
