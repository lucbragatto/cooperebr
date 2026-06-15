/**
 * Revisao sistematica etapa-por-etapa do fluxo WhatsApp (Sprint Bot
 * Autoatendimento — PARTE 3 do prompt 21/05). Read-only.
 *
 * Pra cada etapa ATIVA do tenant CoopereBR, simula com etapaIdForcado e
 * analisa o output. Output usado pra montar tabela no relatorio.
 */
import { PrismaClient } from '@prisma/client';
import { WhatsappFluxoMotorService } from '../src/whatsapp/whatsapp-fluxo-motor.service';

const COOP_ID = 'cmn0ho8bx0000uox8wu96u6fd';

async function main(): Promise<void> {
  const prisma = new PrismaClient();
  const motor = new WhatsappFluxoMotorService(
    prisma as any,
    { incrementarUso: async () => {} } as any,
    { enviarMensagem: async () => {} } as any,
  );

  try {
    const etapas = await prisma.fluxoEtapa.findMany({
      where: {
        OR: [{ cooperativaId: COOP_ID }, { cooperativaId: null }],
        ativo: true,
      },
      orderBy: [{ cooperativaId: 'asc' }, { ordem: 'asc' }],
    });

    // Estados ativos pra analise de gatilhos
    const estadosAtivos = new Set(etapas.map((e) => e.estado));

    console.log(`\n═══ REVISAO ETAPA-POR-ETAPA — ${etapas.length} etapas ATIVAS ═══\n`);

    for (const etapa of etapas) {
      const escopo = etapa.cooperativaId === null ? 'GLOBAL' : 'TENANT';
      const gatilhos = Array.isArray(etapa.gatilhos)
        ? (etapa.gatilhos as unknown as Array<{ resposta: string; proximoEstado: string }>)
        : [];

      // Simula forcando esta etapa especifica
      const sim = await motor.simular({
        mensagem: '__simulador_ping__',
        cooperativaId: COOP_ID,
        estadoInicial: etapa.estado,
        etapaIdForcado: etapa.id,
      });

      // Renderiza?
      const renderizou = sim.mensagemEtapaAtual !== null && sim.mensagemEtapaAtual.length > 0;
      // Variaveis vazias deixaram marca? Heuristica: presenca de {{}} nao-substituido ou padrao tipo "acesse: " seguido de quebra
      const temVarVazia =
        renderizou &&
        (/\{\{[a-zA-Z_]+\}\}/.test(sim.mensagemEtapaAtual ?? '') ||
          /:\s*\n/.test(sim.mensagemEtapaAtual ?? '') ||
          /:\s*$/.test(sim.mensagemEtapaAtual ?? ''));

      // Analise dos gatilhos
      const analiseGatilhos: string[] = [];
      let uteis = 0;
      let loops = 0;
      let orfaos = 0;

      for (const g of gatilhos) {
        if (g.proximoEstado === etapa.estado) {
          loops++;
          analiseGatilhos.push(`"${g.resposta}"→LOOP`);
        } else if (!estadosAtivos.has(g.proximoEstado)) {
          orfaos++;
          analiseGatilhos.push(`"${g.resposta}"→ORFAO(${g.proximoEstado})`);
        } else {
          uteis++;
          analiseGatilhos.push(`"${g.resposta}"→${g.proximoEstado}`);
        }
      }

      // Redundancia: outra etapa ATIVA no mesmo estado?
      const duplicada = etapas.filter((e) => e.estado === etapa.estado && e.id !== etapa.id);
      const redundante = duplicada.length > 0
        ? `SIM — duplica com ${duplicada.map((d) => `"${d.nome}" (id=${d.id})`).join(', ')}`
        : 'nao';

      console.log(`──────────────────────────────────────────`);
      console.log(`📌 "${etapa.nome}" estado=${etapa.estado} ordem=${etapa.ordem} ${escopo}`);
      console.log(`   id=${etapa.id}`);
      console.log(`   modelo=${etapa.modeloMensagemId ?? '(nenhum)'} acao=${etapa.acaoAutomatica ?? '—'}`);
      console.log(`   Renderiza? ${renderizou ? '✅' : '❌ (sem modelo ou erro)'}`);
      console.log(`   Variavel vazia detectada? ${temVarVazia ? '⚠️ SIM' : 'nao'}`);
      console.log(`   Gatilhos: ${gatilhos.length} (uteis=${uteis} | loops=${loops} | orfaos=${orfaos})`);
      if (analiseGatilhos.length > 0) {
        console.log(`     ${analiseGatilhos.join(' | ')}`);
      }
      console.log(`   Redundante? ${redundante}`);
      if (renderizou && sim.mensagemEtapaAtual) {
        const preview = sim.mensagemEtapaAtual.replace(/\n/g, ' ').slice(0, 120);
        console.log(`   Preview: "${preview}${sim.mensagemEtapaAtual.length > 120 ? '...' : ''}"`);
      }
    }

    console.log(`\n──────────────────────────────────────────`);
    console.log('[revisao] Concluido.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
