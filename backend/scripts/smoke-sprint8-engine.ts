/**
 * Smoke M14.A — invoca AlocacaoEngineService direto contra o banco real.
 * Sem dispatch externo (engine é pure-read + grava snapshot via service).
 *
 * Roda contra CoopereBR (cooperativaId real) e imprime snapshot.
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { AlocacaoEngineService } from '../src/alocacao/alocacao-engine.service';
import { AlocacaoValidadorService } from '../src/alocacao/alocacao-validador.service';

const COOPEREBR_ID = 'cmn0ho8bx0000uox8wu96u6fd';

async function main() {
  const prisma = new PrismaClient();
  const validador = new AlocacaoValidadorService(prisma as any);
  const engine = new AlocacaoEngineService(prisma as any, validador as any);

  console.log(`▸ Rodando engine.simular para CoopereBR (${COOPEREBR_ID})…`);
  const snapshot = await engine.simular(COOPEREBR_ID);

  console.log('\n══ Snapshot ══');
  console.log(`  contratosAvaliados:   ${snapshot.contratosAvaliados}`);
  console.log(`  realocacoesSugeridas: ${snapshot.realocacoesSugeridas}`);
  console.log(`  custoTotalAntesProxy: ${snapshot.custoTotalAntesProxy}`);
  console.log(`  custoTotalDepoisProxy: ${snapshot.custoTotalDepoisProxy}`);
  console.log(`  economiaTotalProxy:   ${snapshot.economiaTotalProxy}`);
  console.log(`  geradoEm: ${snapshot.geradoEm}`);

  if (snapshot.realocacoes.length > 0) {
    console.log('\n══ Realocações sugeridas ══');
    for (const r of snapshot.realocacoes.slice(0, 5)) {
      console.log(`  • ${r.cooperadoNome} (${r.kwhContrato} kWh)`);
      console.log(`      ${r.usinaAtualNome ?? '(sem usina)'} → ${r.usinaSugeridaNome}`);
      console.log(`      motivos: ${r.motivosMudanca.join(' | ')}`);
    }
    if (snapshot.realocacoes.length > 5) {
      console.log(`  … + ${snapshot.realocacoes.length - 5} outras`);
    }
  } else {
    console.log('\n  (sem realocações sugeridas — todos os contratos já estão em usina compatível com a política)');
  }

  console.log('\n══ Persistindo snapshot em AlocacaoOtima ══');
  const gravada = await prisma.alocacaoOtima.create({
    data: {
      cooperativaId: COOPEREBR_ID,
      snapshot: snapshot as unknown as object,
      status: 'SUGERIDA',
    },
    select: { id: true, calculadaEm: true, status: true },
  });
  console.log(`  ✅ ID: ${gravada.id}`);
  console.log(`  status: ${gravada.status}`);
  console.log(`  calculadaEm: ${gravada.calculadaEm.toISOString()}`);

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error('ERRO:', e);
  process.exit(1);
});
