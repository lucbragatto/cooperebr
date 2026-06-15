/**
 * Diag FASE 1 — comparar templates do MENU/INÍCIO vs saudação ("ola").
 * Por que MENU mostra "**" mas saudação mostra "CoopereBR"?
 */
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

(async () => {
  const tenantId = 'cmn0ho8bx0000uox8wu96u6fd';

  console.log('═══ DIAG templates MENU/INÍCIO vs saudação ═══\n');

  // (a) Templates candidatos a "MENU/INÍCIO" (boas-vindas com foto/PDF)
  console.log('── (a) Modelos boas_vindas com "foto" + "PDF" ──');
  const modelosBoasVindas = await prisma.modeloMensagem.findMany({
    where: {
      OR: [
        { nome: 'boas_vindas' },
        { nome: { contains: 'menu_principal' } },
        { nome: { contains: 'inicio' } },
      ],
    },
  });
  for (const m of modelosBoasVindas) {
    console.log(`\n[${m.cooperativaId ?? 'global'}] "${m.nome}" (id=${m.id})`);
    console.log(`  Conteúdo:\n${m.conteudo}`);
  }

  // (b) Etapa INICIAL global E tenant — qual é usada
  console.log('\n\n── (b) Etapa INICIAL (qual modelo cada uma aponta?) ──');
  for (const ten of [null, tenantId]) {
    const e = await prisma.fluxoEtapa.findFirst({
      where: { estado: 'INICIAL', cooperativaId: ten, ativo: true },
    });
    console.log(`\n[${ten ?? 'global'}] INICIAL:`);
    if (e) {
      const modelo = e.modeloMensagemId
        ? await prisma.modeloMensagem.findUnique({ where: { id: e.modeloMensagemId } })
        : null;
      console.log(`  id=${e.id}`);
      console.log(`  modeloMensagemId=${e.modeloMensagemId}`);
      console.log(`  modelo.nome="${modelo?.nome}"`);
      console.log(`  modelo.cooperativaId=${modelo?.cooperativaId ?? 'global'}`);
      console.log(`  acaoAutomatica=${e.acaoAutomatica}`);
      console.log(`  Conteúdo modelo:\n${modelo?.conteudo}`);
    } else {
      console.log('  (não existe)');
    }
  }

  // (c) Onde está a saudação ("ola" → mensagem com "CoopereBR" hardcoded ou template)
  console.log('\n\n── (c) handleMenuPrincipalInicio hardcoded (caminho saudação) ──');
  console.log('  Em whatsapp-bot.service.ts:635 — string LITERAL "*CoopereBR*"');
  console.log('  (não usa template) → SEMPRE renderiza correto.');

  // (d) Path do INÍCIO: usa motor.executarComandoUniversalReal → buscarEtapa(INICIAL, cooperativaId)
  console.log('\n── (d) Path MENU/INÍCIO via motor ──');
  console.log('  motor:333 resolverEstadoComandoUniversal(INICIO) → INICIAL');
  console.log('  motor:339 atualiza conversa.estado=INICIAL (não toca cooperativaId)');
  console.log('  motor:344 buscarEtapa(INICIAL, cooperativaId) — se conversa sem coop, busca GLOBAL');
  console.log('  motor:353 carregarContextoCooperativa(cooperativaId) — se undefined, retorna NULL');
  console.log('  motor:354 extrairVariaveis(conversa, null) → vars.parceiro=""');
  console.log('  motor:356 renderizarTemplate(modelo, vars) — agora elimina ** (fix anterior) mas');
  console.log('             texto ainda fica "Olá! Sou o assistente da. ..." (lacuna)');

  // (e) Conversa Luciano agora — tem cooperativaId?
  console.log('\n── (e) Conversa Luciano ──');
  const conv = await prisma.conversaWhatsapp.findFirst({
    where: { telefone: '5527981341348' },
    select: { id: true, estado: true, cooperadoId: true, cooperativaId: true, updatedAt: true },
  });
  console.log('  ', conv);

  await prisma.$disconnect();
})();
