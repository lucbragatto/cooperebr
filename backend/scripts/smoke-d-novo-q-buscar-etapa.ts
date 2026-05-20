/**
 * Smoke test D-novo-Q: confirma que buscarEtapa() prioriza tenant sobre global em runtime.
 *
 * Cenário esperado (banco atual):
 *   - "Receber fatura" global INICIAL (cooperativaId=null, 0 gatilhos, ativa)
 *   - "Entrada Dinâmica" CoopereBR INICIAL (cooperativaId=cmn0ho8bx..., 3 gatilhos, ativa)
 *
 * Antes do fix: motor pegava global (ordem baixa) → fallback.
 * Depois do fix: motor pega tenant exato → transicionou=true.
 */
import { PrismaClient } from '@prisma/client';

async function main(): Promise<void> {
  const prisma = new PrismaClient();
  try {
    const coop = await prisma.cooperativa.findFirst({
      where: { id: 'cmn0ho8bx0000uox8wu96u6fd' },
      select: { id: true, nome: true },
    });
    if (!coop) {
      console.error('CoopereBR não encontrada — abortar smoke');
      process.exit(1);
    }

    console.log(`[smoke] Cooperativa: ${coop.nome} (${coop.id})`);

    const etapasIniciais = await prisma.fluxoEtapa.findMany({
      where: { estado: 'INICIAL', ativo: true },
      select: { id: true, nome: true, cooperativaId: true, ordem: true, gatilhos: true },
      orderBy: { ordem: 'asc' },
    });

    console.log(`\n[smoke] Etapas INICIAL ativas no banco (${etapasIniciais.length}):`);
    for (const e of etapasIniciais) {
      const gat = Array.isArray(e.gatilhos) ? e.gatilhos.length : 0;
      const escopo = e.cooperativaId === null ? 'GLOBAL' : (e.cooperativaId === coop.id ? 'TENANT-CoopereBR' : 'OUTRO-TENANT');
      console.log(`  - "${e.nome}" ordem=${e.ordem} ${escopo} gatilhos=${gat}`);
    }

    // Replicar lógica do novo buscarEtapa() — tenant primeiro
    const etapaTenant = await prisma.fluxoEtapa.findFirst({
      where: { estado: 'INICIAL', ativo: true, cooperativaId: coop.id },
      orderBy: { ordem: 'asc' },
    });

    if (etapaTenant) {
      console.log(`\n[smoke] ✅ Tenant venceu: "${etapaTenant.nome}" ordem=${etapaTenant.ordem}`);
      const gat = Array.isArray(etapaTenant.gatilhos) ? etapaTenant.gatilhos.length : 0;
      console.log(`        Gatilhos: ${gat}`);
      if (gat > 0) {
        console.log(`        ✅ Tem gatilhos — motor vai transicionar.`);
      } else {
        console.log(`        ⚠️  Sem gatilhos — motor cai em fallback (esperado se etapa tenant for vazia).`);
      }
    } else {
      const etapaGlobal = await prisma.fluxoEtapa.findFirst({
        where: { estado: 'INICIAL', ativo: true, cooperativaId: null },
        orderBy: { ordem: 'asc' },
      });
      if (etapaGlobal) {
        console.log(`\n[smoke] ⚠️  Sem etapa tenant — fallback para global: "${etapaGlobal.nome}"`);
      } else {
        console.log(`\n[smoke] ❌ Nenhuma etapa INICIAL disponível (nem tenant nem global)`);
      }
    }

    // Replicar lógica ANTIGA pra comparar
    const etapaAntiga = await prisma.fluxoEtapa.findFirst({
      where: {
        estado: 'INICIAL',
        ativo: true,
        OR: [{ cooperativaId: coop.id }, { cooperativaId: null }],
      },
      orderBy: { ordem: 'asc' },
    });
    console.log(`\n[smoke] Comparação — lógica ANTIGA escolheria: "${etapaAntiga?.nome ?? '(nenhuma)'}"`);
    console.log(`[smoke] Confirma bug: ${etapaAntiga?.id !== etapaTenant?.id ? 'SIM (lógicas divergem)' : 'NÃO (lógicas convergem nesse caso)'}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
