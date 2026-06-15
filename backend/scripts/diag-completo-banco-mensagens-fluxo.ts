/**
 * Diagnostico read-only consolidado pro relatorio
 * docs/relatorios/2026-05-20-banco-mensagens-fluxo-bot.md
 *
 * Coleta:
 * 1. Todos os ModeloMensagem com flags (ativo, escopo, parceiro?, hardcode?)
 * 2. Todas as FluxoEtapa (escopo, gatilhos, modelo)
 * 3. Cruzamento etapa<->modelo (qtd etapas por modelo)
 * 4. Estados-destino orfaos
 * 5. Modelos referenciados por etapas mas inexistentes
 *
 * Imprime JSON estruturado pra eu usar no relatorio.
 */
import { PrismaClient } from '@prisma/client';

const COOP_ID = 'cmn0ho8bx0000uox8wu96u6fd';

async function main(): Promise<void> {
  const prisma = new PrismaClient();
  try {
    // ──────────────────────────────────────────────
    // 1. MODELOS
    // ──────────────────────────────────────────────
    const modelos = await prisma.modeloMensagem.findMany({
      where: { OR: [{ cooperativaId: COOP_ID }, { cooperativaId: null }] },
      orderBy: [{ categoria: 'asc' }, { nome: 'asc' }],
    });

    // ──────────────────────────────────────────────
    // 2. ETAPAS
    // ──────────────────────────────────────────────
    const etapas = await prisma.fluxoEtapa.findMany({
      where: { OR: [{ cooperativaId: COOP_ID }, { cooperativaId: null }] },
      orderBy: [{ ordem: 'asc' }],
    });

    // Quantas etapas referenciam cada modelo
    const refsPorModelo = new Map<string, string[]>();
    for (const e of etapas) {
      if (!e.modeloMensagemId) continue;
      const arr = refsPorModelo.get(e.modeloMensagemId) ?? [];
      arr.push(e.nome);
      refsPorModelo.set(e.modeloMensagemId, arr);
    }

    // ──────────────────────────────────────────────
    // SEÇÃO 1 — Banco de Mensagens
    // ──────────────────────────────────────────────
    console.log('═══ SECAO 1 — Banco de Mensagens ═══\n');
    const modelosOut = modelos.map((m) => ({
      id: m.id,
      nome: m.nome,
      categoria: m.categoria,
      ativo: m.ativo,
      escopo: m.cooperativaId === null ? 'GLOBAL' : 'TENANT',
      usos: m.usosCount,
      temParceiro: m.conteudo.includes('{{parceiro}}'),
      temHardcodeCoop: /CoopereBR/i.test(m.conteudo),
      temUrlHardcoded: /cooperebr\.com|coopereai\./i.test(m.conteudo),
      resumo: m.conteudo.slice(0, 80).replace(/\n/g, ' '),
      qtdEtapas: refsPorModelo.get(m.id)?.length ?? 0,
      etapasQueUsam: refsPorModelo.get(m.id) ?? [],
    }));
    console.log(JSON.stringify(modelosOut, null, 2));

    // ──────────────────────────────────────────────
    // SEÇÃO 2 — Etapas
    // ──────────────────────────────────────────────
    console.log('\n═══ SECAO 2 — Fluxo do Bot ═══\n');
    const etapasOut = etapas.map((e) => {
      const modelo = modelos.find((m) => m.id === e.modeloMensagemId);
      const gat = Array.isArray(e.gatilhos)
        ? (e.gatilhos as unknown as Array<{ resposta: string; proximoEstado: string }>)
        : [];
      return {
        id: e.id,
        nome: e.nome,
        estado: e.estado,
        ordem: e.ordem,
        ativo: e.ativo,
        escopo: e.cooperativaId === null ? 'GLOBAL' : 'TENANT',
        modeloNome: modelo?.nome ?? null,
        modeloId: e.modeloMensagemId,
        modeloExiste: !!modelo,
        acaoAutomatica: e.acaoAutomatica,
        gatilhos: gat,
      };
    });
    console.log(JSON.stringify(etapasOut, null, 2));

    // ──────────────────────────────────────────────
    // SEÇÃO 3 — Mapa
    // ──────────────────────────────────────────────
    console.log('\n═══ SECAO 3 — Estados ativos e orfaos ═══\n');
    const estadosAtivos = new Set<string>();
    for (const e of etapas) {
      if (e.ativo) estadosAtivos.add(e.estado);
    }

    const destinosUsados = new Set<string>();
    const destinosPorEtapa: Record<string, string[]> = {};
    for (const e of etapas) {
      if (!e.ativo) continue;
      const gat = Array.isArray(e.gatilhos)
        ? (e.gatilhos as unknown as Array<{ resposta: string; proximoEstado: string }>)
        : [];
      destinosPorEtapa[e.nome] = [];
      for (const g of gat) {
        destinosUsados.add(g.proximoEstado);
        destinosPorEtapa[e.nome].push(`"${g.resposta}" → ${g.proximoEstado}${estadosAtivos.has(g.proximoEstado) ? '' : ' ❌ ORFAO'}`);
      }
    }

    console.log('Estados-destino orfaos (gatilho aponta mas sem etapa ativa):');
    for (const d of destinosUsados) {
      if (!estadosAtivos.has(d)) console.log(`  ❌ ${d}`);
    }

    // ──────────────────────────────────────────────
    // SEÇÃO 4/5 — Modelos inexistentes referenciados; estados duplicados
    // ──────────────────────────────────────────────
    console.log('\n═══ Modelos referenciados que NAO existem ═══\n');
    const modelosIdsExistentes = new Set(modelos.map((m) => m.id));
    let modInex = 0;
    for (const e of etapas) {
      if (e.modeloMensagemId && !modelosIdsExistentes.has(e.modeloMensagemId)) {
        console.log(`  ❌ Etapa "${e.nome}" -> modelo id=${e.modeloMensagemId} INEXISTENTE`);
        modInex++;
      }
    }
    if (modInex === 0) console.log('  (nenhum)');

    console.log('\n═══ Estados com >1 etapa ATIVA (duplicacao) ═══\n');
    const ativasPorEstado: Record<string, typeof etapas> = {};
    for (const e of etapas) {
      if (!e.ativo) continue;
      const chave = `${e.estado}|${e.cooperativaId ?? 'null'}`;
      ativasPorEstado[chave] = ativasPorEstado[chave] ?? [];
      ativasPorEstado[chave].push(e);
    }
    let qtdDup = 0;
    for (const [chave, lista] of Object.entries(ativasPorEstado)) {
      if (lista.length > 1) {
        qtdDup++;
        console.log(`  estado=${chave} -> ${lista.length} ATIVAS:`);
        for (const e of lista) console.log(`    - "${e.nome}" id=${e.id} ordem=${e.ordem}`);
      }
    }
    if (qtdDup === 0) console.log('  (nenhum)');

    console.log('\n═══ Mapa do fluxo (etapas ATIVAS + transicoes) ═══\n');
    for (const [nome, destinos] of Object.entries(destinosPorEtapa)) {
      console.log(`  ${nome}:`);
      destinos.forEach((d) => console.log(`    ├─ ${d}`));
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
