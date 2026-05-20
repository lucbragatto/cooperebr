/**
 * Fix R1 — Sprint Saneamento (parte 1): deletar etapas GLOBAIS INATIVAS
 * duplicadas que ja tem versao ATIVA no mesmo estado.
 *
 * Banco dev — dump das ids ANTES de deletar (idempotente).
 * SO deleta etapas inativas. NAO toca em etapas ativas.
 *
 * Pares identificados no diag 20/05:
 * - ordem=8  "Confirmar Dados Extraídos" inativa <-> ordem=2 ativa
 * - ordem=9  "Confirmar Proposta / Simulação" inativa <-> ordem=3 ativa
 * - ordem=10 "Confirmar Cadastro" inativa <-> ordem=4 ativa
 * - ordem=11 "Cadastro Concluído" inativa <-> ordem=5 ativa
 *
 * Modelos referenciados pelas inativas sao COMPARTILHADOS com as ativas
 * (mesmos ids no banco), entao nao ha vazamento — basta deletar a etapa.
 *
 * Etapas ATIVAS duplicadas (NAO sao removidas — regra "nao desativar ATIVAS"):
 * - "Receber fatura" + "Boas-vindas / Menu Principal" ambas estado=INICIAL ATIVAS
 *   (decisao do Luciano: consolidar / desativar uma).
 */
import { PrismaClient } from '@prisma/client';

const PARES_DUPLICADOS: { ordem: number; estado: string; nomeEsperado: string }[] = [
  { ordem: 8, estado: 'AGUARDANDO_CONFIRMACAO_DADOS', nomeEsperado: 'Confirmar Dados Extraídos' },
  { ordem: 9, estado: 'AGUARDANDO_CONFIRMACAO_PROPOSTA', nomeEsperado: 'Confirmar Proposta / Simulação' },
  { ordem: 10, estado: 'AGUARDANDO_CONFIRMACAO_CADASTRO', nomeEsperado: 'Confirmar Cadastro' },
  { ordem: 11, estado: 'CONCLUIDO', nomeEsperado: 'Cadastro Concluído' },
];

async function main(): Promise<void> {
  const prisma = new PrismaClient();
  try {
    console.log('═══ Fix R1 — Deletar etapas GLOBAIS inativas duplicadas ═══\n');

    const dump: Array<{ id: string; nome: string; estado: string; ordem: number; modeloMensagemId: string | null; gatilhos: unknown }> = [];
    const aDeletar: string[] = [];

    for (const par of PARES_DUPLICADOS) {
      // Confirma que a ATIVA existe nesse estado (caso contrario nao deleta a inativa)
      const ativa = await prisma.fluxoEtapa.findFirst({
        where: { estado: par.estado, ativo: true, cooperativaId: null },
        orderBy: { ordem: 'asc' },
      });

      const inativa = await prisma.fluxoEtapa.findFirst({
        where: {
          estado: par.estado, ativo: false, cooperativaId: null,
          ordem: par.ordem,
        },
      });

      console.log(`─── Par estado=${par.estado} ─────────────────`);
      console.log(`  ATIVA esperada: ${ativa ? `id=${ativa.id} ordem=${ativa.ordem} "${ativa.nome}"` : 'NAO ENCONTRADA ⚠️'}`);
      console.log(`  INATIVA ordem=${par.ordem}: ${inativa ? `id=${inativa.id} "${inativa.nome}"` : 'NAO ENCONTRADA (ja deletada? skip)'}`);

      if (!ativa) {
        console.log(`  ⚠️ SKIP — sem etapa ativa pra esse estado, nao posso deletar a inativa sem deixar orfao.`);
        continue;
      }
      if (!inativa) {
        console.log(`  (nada a fazer)\n`);
        continue;
      }

      dump.push({
        id: inativa.id,
        nome: inativa.nome,
        estado: inativa.estado,
        ordem: inativa.ordem,
        modeloMensagemId: inativa.modeloMensagemId,
        gatilhos: inativa.gatilhos,
      });
      aDeletar.push(inativa.id);
      console.log(`  → MARCADA pra delecao.\n`);
    }

    if (aDeletar.length === 0) {
      console.log('Nada a deletar. Fluxo ja esta limpo.');
      return;
    }

    console.log('═══ DUMP das etapas a deletar (pra rollback se precisar) ═══');
    console.log(JSON.stringify(dump, null, 2));
    console.log();

    console.log('═══ Executando DELETE ═══');
    const result = await prisma.fluxoEtapa.deleteMany({
      where: { id: { in: aDeletar } },
    });
    console.log(`  ${result.count} etapas deletadas.\n`);

    // Validacao pos-delete
    console.log('═══ Validacao pos-update ═══');
    const restantes = await prisma.fluxoEtapa.findMany({
      where: { id: { in: aDeletar } },
      select: { id: true },
    });
    console.log(`  Restantes apos delete: ${restantes.length} (esperado: 0) ${restantes.length === 0 ? '✅' : '❌'}`);

    // Listar etapas duplicadas remanescentes (ativas no mesmo estado)
    console.log('\n─── Estados com >1 etapa ATIVA (decisao Luciano se desativar/consolidar) ───');
    const ativasPorEstado = await prisma.fluxoEtapa.groupBy({
      by: ['estado'],
      where: { ativo: true, cooperativaId: null },
      _count: { _all: true },
    });
    const remanescentes = ativasPorEstado.filter((g) => g._count._all > 1);
    if (remanescentes.length === 0) {
      console.log('  (nenhum)');
    } else {
      for (const r of remanescentes) {
        const lista = await prisma.fluxoEtapa.findMany({
          where: { estado: r.estado, ativo: true, cooperativaId: null },
          select: { id: true, nome: true, ordem: true, modeloMensagemId: true, gatilhos: true },
        });
        console.log(`  estado=${r.estado} (${r._count._all} etapas ativas GLOBAIS):`);
        for (const e of lista) {
          const gat = Array.isArray(e.gatilhos) ? (e.gatilhos as unknown as Array<unknown>).length : 0;
          console.log(`    ordem=${e.ordem} "${e.nome}" id=${e.id} modelo=${e.modeloMensagemId ?? 'null'} gatilhos=${gat}`);
        }
      }
    }

    console.log('\n[fix-r1] Concluido.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
