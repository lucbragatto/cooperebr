/**
 * Sprint Bot Autoatendimento — Bloco 0 v2 (21/05).
 *
 * Resolve 2 das 3 variaveis ORFAS REAIS achadas na PARTE 4 (a terceira —
 * {{historico}} em confirmacao_dados — foi resolvida no proprio motor
 * extrairVariaveis() populando a partir de dadosTemp.historicoConsumo).
 *
 * (1) {{valorFatura}} em lead_fora_area: naming divergente. Motor popula
 *     {{valorFaturaMedia}}. Alinhar modelo pra usar {{valorFaturaMedia}}
 *     (1 fonte de verdade, sem alias).
 *
 * (2) {{mesesGratis}} em simulacao_resultado: zero matches no backend —
 *     variavel fantasma. Remover a linha do modelo.
 *
 * Idempotente: skip se ja aplicado. ANTES/DEPOIS.
 */
import { PrismaClient } from '@prisma/client';

async function main(): Promise<void> {
  const prisma = new PrismaClient();
  try {
    console.log('═══ Bloco 0 v2 — Variaveis orfas reais ═══\n');

    // ─────────────────────────────────────────────────────────────
    // (1) lead_fora_area: {{valorFatura}} -> {{valorFaturaMedia}}
    // ─────────────────────────────────────────────────────────────
    console.log('[1] Modelo "lead_fora_area" — trocar {{valorFatura}} por {{valorFaturaMedia}}');

    const leadForaArea = await prisma.modeloMensagem.findFirst({
      where: { nome: 'lead_fora_area', cooperativaId: null },
    });

    if (!leadForaArea) {
      console.log('  ⚠️ Modelo nao encontrado (skip)\n');
    } else if (!leadForaArea.conteudo.includes('{{valorFatura}}')) {
      console.log(`  JA OK id=${leadForaArea.id} (nao tem mais {{valorFatura}}, skip)\n`);
    } else {
      const antes = leadForaArea.conteudo;
      const depois = leadForaArea.conteudo.replace(/\{\{valorFatura\}\}/g, '{{valorFaturaMedia}}');
      console.log(`  ANTES:  ${JSON.stringify(antes)}`);
      console.log(`  DEPOIS: ${JSON.stringify(depois)}`);
      await prisma.modeloMensagem.update({
        where: { id: leadForaArea.id },
        data: { conteudo: depois },
      });
      console.log('  → UPDATE aplicado.\n');
    }

    // ─────────────────────────────────────────────────────────────
    // (2) simulacao_resultado: remover linha {{mesesGratis}}
    // ─────────────────────────────────────────────────────────────
    console.log('[2] Modelo "simulacao_resultado" — remover linha {{mesesGratis}}');

    const simulacao = await prisma.modeloMensagem.findFirst({
      where: { nome: 'simulacao_resultado', cooperativaId: null },
    });

    if (!simulacao) {
      console.log('  ⚠️ Modelo nao encontrado (skip)\n');
    } else if (!simulacao.conteudo.includes('{{mesesGratis}}')) {
      console.log(`  JA OK id=${simulacao.id} (nao tem mais {{mesesGratis}}, skip)\n`);
    } else {
      const antes = simulacao.conteudo;
      // Remove a linha inteira contendo {{mesesGratis}} (incluindo \n adjacente)
      const depois = simulacao.conteudo
        .replace(/\n\{\{mesesGratis\}\}\n?/g, '\n')
        .replace(/\{\{mesesGratis\}\}/g, ''); // catch-all defensivo
      console.log(`  ANTES:  ${JSON.stringify(antes)}`);
      console.log(`  DEPOIS: ${JSON.stringify(depois)}`);
      await prisma.modeloMensagem.update({
        where: { id: simulacao.id },
        data: { conteudo: depois },
      });
      console.log('  → UPDATE aplicado.\n');
    }

    // ─────────────────────────────────────────────────────────────
    // Validacao pos-update
    // ─────────────────────────────────────────────────────────────
    console.log('═══ Validacao pos-update ═══');

    const leadPos = await prisma.modeloMensagem.findFirst({
      where: { nome: 'lead_fora_area', cooperativaId: null },
    });
    const temValorFatura = leadPos?.conteudo.includes('{{valorFatura}}');
    const temValorFaturaMedia = leadPos?.conteudo.includes('{{valorFaturaMedia}}');
    console.log(`  lead_fora_area sem {{valorFatura}}: ${!temValorFatura ? '✅' : '❌'}`);
    console.log(`  lead_fora_area com {{valorFaturaMedia}}: ${temValorFaturaMedia ? '✅' : '❌'}`);

    const simPos = await prisma.modeloMensagem.findFirst({
      where: { nome: 'simulacao_resultado', cooperativaId: null },
    });
    const temMesesGratis = simPos?.conteudo.includes('{{mesesGratis}}');
    console.log(`  simulacao_resultado sem {{mesesGratis}}: ${!temMesesGratis ? '✅' : '❌'}`);

    console.log('\n[bloco-0-v2] Concluido.');
    console.log('\nNota: a terceira orfa real ({{historico}} em confirmacao_dados)');
    console.log('foi resolvida no motor extrairVariaveis() (formatarHistoricoConsumo),');
    console.log('lendo de dadosTemp.historicoConsumo populado pelo OCR.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
