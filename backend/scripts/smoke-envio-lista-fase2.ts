import { PrismaClient } from '@prisma/client';
import { EnvioListaConcessionariaService } from '../src/envio-lista-concessionaria/envio-lista-concessionaria.service';

const prisma = new PrismaClient();
const service = new EnvioListaConcessionariaService(prisma as any);

// Constantes do estado atual (validado em sessões anteriores)
const COOPEREBR_ID = 'cmn0ho8bx0000uox8wu96u6fd';
const COOPEREBR2_USINA_ID = 'cmp8fkxvt0001valkj8utb8vr';
const EXFISHES_COOPERADO_ID = 'cmn0ds7pi0038uols6p1arduv';

async function main() {
  console.log('═══ Smoke Sub-Fase 1 Fase 2 — envio-lista-concessionaria ═══\n');

  // CENÁRIO 1: listar cooperados elegíveis da Cooperebr2
  console.log('▶ Cenário 1: listarCooperadosElegiveis(Cooperebr2, CoopereBR)');
  const elegiveis = await service.listarCooperadosElegiveis(
    COOPEREBR2_USINA_ID,
    COOPEREBR_ID,
  );
  console.log(`  usina: ${elegiveis.usina.nome} (apelido=${elegiveis.usina.apelidoInterno}, cap=${elegiveis.usina.capacidadeKwh})`);
  console.log(`  cooperados elegíveis: ${elegiveis.cooperados.length}`);
  for (const c of elegiveis.cooperados) {
    console.log(`    - ${c.nome.slice(0, 30).padEnd(30)} | UC=${c.ucNumero} | kwh=${c.kwhContrato} | %=${c.percentualUsina} | status=${c.statusContrato} | jaEnviado=${c.jaEnviado}`);
  }
  const exfishesEntry = elegiveis.cooperados.find((c) => c.cooperadoId === EXFISHES_COOPERADO_ID);
  if (!exfishesEntry) {
    throw new Error('CENÁRIO 1 falhou — Exfishes não apareceu nos elegíveis.');
  }
  console.log(`  ✅ Exfishes encontrado, jaEnviado=${exfishesEntry.jaEnviado}\n`);

  // CENÁRIO 2: criarRascunho com cooperadoIds=[Exfishes]
  console.log('▶ Cenário 2: criarRascunho({ usinaId, cooperadoIds: [Exfishes] })');
  const envio = await service.criarRascunho({
    usinaId: COOPEREBR2_USINA_ID,
    cooperativaId: COOPEREBR_ID,
    cooperadoIds: [EXFISHES_COOPERADO_ID],
  });
  console.log(`  envioId: ${envio.id}`);
  console.log(`  numeroInterno: ${envio.numeroInterno}`);
  console.log(`  status: ${envio.status}`);
  console.log(`  cooperados snapshotados: ${envio.cooperados.length}`);
  for (const c of envio.cooperados as any[]) {
    console.log(`    - ${c.cooperado.nomeCompleto} | UC=${c.ucNumero} | kwhSnapshot=${c.kwhContratoSnapshot} | %Snapshot=${c.percentualUsinaSnapshot} | statusInd=${c.statusIndividual}`);
  }
  if (envio.status !== 'RASCUNHO') throw new Error('CENÁRIO 2 falhou — status inicial não é RASCUNHO');
  if (envio.cooperados.length !== 1) throw new Error('CENÁRIO 2 falhou — esperava 1 cooperado snapshotado');
  console.log(`  ✅ Rascunho criado\n`);

  // CENÁRIO 3: obterDetalhe
  console.log('▶ Cenário 3: obterDetalhe(envioId)');
  const detalhe = await service.obterDetalhe(envio.id, COOPEREBR_ID);
  console.log(`  numeroInterno: ${detalhe.numeroInterno}`);
  console.log(`  status: ${detalhe.status}`);
  console.log(`  usina: ${detalhe.usina.nome}`);
  console.log(`  cooperativa: ${detalhe.cooperativa.nome}`);
  console.log(`  cooperados: ${detalhe.cooperados.length}`);
  for (const c of detalhe.cooperados) {
    console.log(`    - ${c.cooperado.nomeCompleto} | contrato=${c.contrato.numero} | status=${c.statusIndividual}`);
  }
  console.log(`  ✅ Detalhe carregado\n`);

  // CENÁRIO 4 (bônus): cooperados-elegiveis novamente — Exfishes deve aparecer com jaEnviado=true
  console.log('▶ Cenário 4 (bônus): cooperados-elegiveis após criarRascunho — Exfishes.jaEnviado=true');
  const elegiveis2 = await service.listarCooperadosElegiveis(COOPEREBR2_USINA_ID, COOPEREBR_ID);
  const ex2 = elegiveis2.cooperados.find((c) => c.cooperadoId === EXFISHES_COOPERADO_ID);
  console.log(`  Exfishes.jaEnviado=${ex2?.jaEnviado} (esperado true)`);
  console.log(`  Exfishes.ultimoEnvioStatus=${ex2?.ultimoEnvioStatus} (esperado PENDENTE)`);
  console.log(`  Exfishes.ultimoEnvioNumero=${ex2?.ultimoEnvioNumero}`);
  if (!ex2?.jaEnviado) throw new Error('CENÁRIO 4 falhou — jaEnviado deveria ser true');
  console.log(`  ✅ Bônus OK\n`);

  // CENÁRIO 5 (cleanup): cancelar o smoke pra deixar banco limpo
  console.log('▶ Cleanup: cancelar envio de smoke');
  const cancelado = await service.cancelar(envio.id, 'Smoke Fase 2 Sub-Fase 1', COOPEREBR_ID);
  console.log(`  status: ${cancelado.status}\n`);

  // CENÁRIO 6 (defensivo): testar transição inválida
  console.log('▶ Cenário 6 (defensivo): tentar validar() um envio CANCELADO → deve lançar BadRequest');
  try {
    await service.validar(envio.id, 'fake-user-id', COOPEREBR_ID);
    throw new Error('Deveria ter lançado erro');
  } catch (e: any) {
    if (e.message?.includes('Transição inválida')) {
      console.log(`  ✅ Erro esperado: ${e.message.slice(0, 80)}...`);
    } else {
      throw e;
    }
  }

  console.log('\n═══ Smoke OK — 6/6 cenários PASSARAM ═══');
}

main()
  .catch((e) => {
    console.error('❌ ERRO no smoke:', e?.message ?? e);
    if (e?.stack) console.error(e.stack);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
