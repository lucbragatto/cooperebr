/**
 * Diagnostico read-only — modelos de mensagem agrupados por nome.
 * Confirma se ha duplicacao REAL (ids distintos com mesmo nome) ou se
 * o que parecia duplicado no diag anterior eram so etapas referenciando
 * o MESMO id.
 */
import { PrismaClient } from '@prisma/client';

async function main(): Promise<void> {
  const prisma = new PrismaClient();
  try {
    const modelos = await prisma.modeloMensagem.findMany({
      select: { id: true, nome: true, conteudo: true, cooperativaId: true, ativo: true },
      orderBy: [{ nome: 'asc' }, { id: 'asc' }],
    });

    console.log(`[diag-modelos] Total: ${modelos.length}\n`);

    // Agrupa por nome
    const porNome = new Map<string, typeof modelos>();
    for (const m of modelos) {
      const arr = porNome.get(m.nome) ?? [];
      arr.push(m);
      porNome.set(m.nome, arr);
    }

    const duplicados: string[] = [];
    for (const [nome, lista] of porNome) {
      if (lista.length > 1) {
        duplicados.push(nome);
      }
    }

    if (duplicados.length === 0) {
      console.log('✅ Nenhum modelo duplicado por nome.');
    } else {
      console.log(`⚠️  ${duplicados.length} nomes com IDS distintos:\n`);
      for (const nome of duplicados) {
        const lista = porNome.get(nome)!;
        console.log(`─── "${nome}" (${lista.length} registros) ───`);
        for (const m of lista) {
          const escopo = m.cooperativaId === null ? 'GLOBAL' : `TENANT(${m.cooperativaId})`;
          console.log(`  id=${m.id} ${escopo} ativo=${m.ativo}`);
          console.log(`  conteudo: ${JSON.stringify(m.conteudo.slice(0, 160))}`);
        }
        console.log();
      }
    }

    // Quais modelos sao referenciados por etapas
    const etapas = await prisma.fluxoEtapa.findMany({
      select: { id: true, nome: true, estado: true, ativo: true, modeloMensagemId: true },
    });
    const refsCount = new Map<string, number>();
    for (const e of etapas) {
      if (!e.modeloMensagemId) continue;
      refsCount.set(e.modeloMensagemId, (refsCount.get(e.modeloMensagemId) ?? 0) + 1);
    }

    console.log('─── Modelos referenciados por >1 etapa (compartilhados) ───');
    for (const [mid, n] of refsCount) {
      if (n < 2) continue;
      const m = modelos.find((x) => x.id === mid);
      console.log(`  id=${mid} nome="${m?.nome}" -> ${n} etapas`);
    }

    console.log('\n─── Modelos sem nenhuma etapa apontando (orfaos) ───');
    let orfaos = 0;
    for (const m of modelos) {
      if (!refsCount.has(m.id)) {
        console.log(`  id=${m.id} nome="${m.nome}"`);
        orfaos++;
      }
    }
    if (orfaos === 0) console.log('  (nenhum)');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
