/**
 * Diagnóstico read-only do fluxo do bot WhatsApp do CoopereBR.
 * Responde: quais etapas existem, quais estados têm etapa, conteúdo dos modelos.
 * NÃO modifica nada.
 */
import { PrismaClient } from '@prisma/client';

async function main(): Promise<void> {
  const prisma = new PrismaClient();
  try {
    const coopId = 'cmn0ho8bx0000uox8wu96u6fd';
    const coop = await prisma.cooperativa.findUnique({
      where: { id: coopId },
      select: { id: true, nome: true },
    });
    console.log(`[diag] Cooperativa: ${coop?.nome} (${coop?.id})\n`);

    const etapas = await prisma.fluxoEtapa.findMany({
      where: { OR: [{ cooperativaId: coopId }, { cooperativaId: null }] },
      select: {
        id: true, nome: true, estado: true, ordem: true, ativo: true,
        cooperativaId: true, gatilhos: true, modeloMensagemId: true,
      },
      orderBy: { ordem: 'asc' },
    });

    console.log(`[diag] FluxoEtapa visíveis ao tenant (${etapas.length}):`);
    const estadosComEtapa = new Set<string>();
    for (const e of etapas) {
      const escopo = e.cooperativaId === null ? 'GLOBAL' : 'TENANT';
      const gat = Array.isArray(e.gatilhos) ? (e.gatilhos as any[]) : [];
      if (e.ativo) estadosComEtapa.add(e.estado);
      console.log(
        `  [${e.ativo ? 'ATIVA' : 'inativa'}] "${e.nome}" estado=${e.estado} ordem=${e.ordem} ${escopo} modelo=${e.modeloMensagemId ?? 'NENHUM'}`,
      );
      for (const g of gat) {
        console.log(`        gatilho: "${g.resposta}" -> ${g.proximoEstado}`);
      }
    }

    // Quais estados-destino dos gatilhos NÃO têm etapa ativa?
    console.log(`\n[diag] Análise de destinos de gatilho:`);
    const destinos = new Set<string>();
    for (const e of etapas) {
      if (!e.ativo) continue;
      const gat = Array.isArray(e.gatilhos) ? (e.gatilhos as any[]) : [];
      for (const g of gat) destinos.add(g.proximoEstado);
    }
    for (const d of destinos) {
      const temEtapa = estadosComEtapa.has(d);
      console.log(`  ${d}: ${temEtapa ? '✅ tem etapa ativa' : '❌ SEM etapa ativa — bot não continua no simulador'}`);
    }

    // Conteúdo dos modelos referenciados
    console.log(`\n[diag] Conteúdo dos modelos referenciados:`);
    const modeloIds = etapas.map((e) => e.modeloMensagemId).filter((x): x is string => !!x);
    for (const mid of modeloIds) {
      const m = await prisma.modeloMensagem.findUnique({
        where: { id: mid },
        select: { id: true, nome: true, conteudo: true, cooperativaId: true },
      });
      if (!m) continue;
      const escopo = m.cooperativaId === null ? 'GLOBAL' : 'TENANT';
      const temVarParceiro = m.conteudo.includes('{{parceiro}}');
      const temHardcodeCoop = /CoopereBR/i.test(m.conteudo);
      console.log(`  modelo "${m.nome}" (${escopo})`);
      console.log(`    {{parceiro}}? ${temVarParceiro ? 'SIM' : 'NAO'} | "CoopereBR" literal? ${temHardcodeCoop ? 'SIM ⚠️' : 'nao'}`);
      console.log(`    conteudo: ${JSON.stringify(m.conteudo.slice(0, 220))}`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
