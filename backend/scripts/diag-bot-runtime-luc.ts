/**
 * Diagnóstico runtime bot WA — TAREFA 1.a (08/06/2026).
 *
 * Verifica:
 * 1. Telefone Luciano = 5527981341348 (UPDATE pegou?)
 * 2. Cooperado ATIVO multi-tenant
 * 3. MENU_COOPERADO global tem gatilho "8" → MENU_COOPERTOKENS
 * 4. Existe FluxoEtapa override de MENU_COOPERADO em tenant da CoopereBR?
 *    (regra fix tenant>global: se o tenant tem etapa própria, global não vale)
 * 5. Modelo do MENU_COOPERADO tem linha "8 CooperTokens"?
 * 6. Conversa atual do telefone Luciano: estado + cooperadoId resolvido?
 */
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log('\n═══ DIAG BOT RUNTIME — TAREFA 1.a ═══\n');

  // (1) (2) Cooperado Luciano + variantes telefone
  console.log('── (1)(2) Cooperado Luciano + telefone ──');
  const luciano = await prisma.cooperado.findUnique({
    where: { id: 'cmn0dsc4w005guols56peyc5h' },
    select: {
      id: true,
      nomeCompleto: true,
      cpf: true,
      email: true,
      telefone: true,
      status: true,
      cooperativaId: true,
      cooperativa: { select: { nome: true } },
    },
  });
  console.log('Luciano:', luciano);

  const matches5527 = await prisma.cooperado.findMany({
    where: { telefone: '5527981341348' },
    select: { id: true, nomeCompleto: true, status: true, cooperativaId: true },
  });
  console.log(`\nMatches telefone='5527981341348': ${matches5527.length}`);
  for (const c of matches5527) console.log(`  - ${c.id} | ${c.nomeCompleto} | ${c.status} | coop=${c.cooperativaId}`);

  // (3) MENU_COOPERADO global
  console.log('\n── (3) MENU_COOPERADO global ──');
  const menuGlobal = await prisma.fluxoEtapa.findFirst({
    where: { estado: 'MENU_COOPERADO', cooperativaId: null },
    select: {
      id: true, nome: true, modeloMensagemId: true, gatilhos: true,
      acaoAutomatica: true, ativo: true, ordem: true,
    },
  });
  console.log('Global encontrado:', !!menuGlobal, 'id=', menuGlobal?.id, 'ativo=', menuGlobal?.ativo);
  if (menuGlobal) {
    const gatilhos = Array.isArray(menuGlobal.gatilhos) ? menuGlobal.gatilhos : [];
    const tem8 = gatilhos.some((g: any) => g.resposta === '8');
    console.log(`  Tem gatilho "8"? ${tem8}`);
    console.log(`  Total gatilhos: ${gatilhos.length}`);
  }

  // (4) Override MENU_COOPERADO no tenant CoopereBR (cmn0ho8bx0000uox8wu96u6fd)
  console.log('\n── (4) MENU_COOPERADO override no tenant CoopereBR ──');
  const menuTenant = await prisma.fluxoEtapa.findFirst({
    where: { estado: 'MENU_COOPERADO', cooperativaId: 'cmn0ho8bx0000uox8wu96u6fd' },
    select: {
      id: true, nome: true, modeloMensagemId: true, gatilhos: true,
      acaoAutomatica: true, ativo: true, ordem: true,
    },
  });
  console.log('Tenant override existe:', !!menuTenant);
  if (menuTenant) {
    console.log(`  id=${menuTenant.id} ativo=${menuTenant.ativo}`);
    const gatilhos = Array.isArray(menuTenant.gatilhos) ? menuTenant.gatilhos : [];
    const tem8 = gatilhos.some((g: any) => g.resposta === '8');
    console.log(`  Tem gatilho "8"? ${tem8}`);
    console.log(`  Gatilhos:`, JSON.stringify(gatilhos, null, 2));
  }

  // (5) Modelo MENU_COOPERADO (tenant + global)
  console.log('\n── (5) Modelo MENU_COOPERADO ──');
  if (menuTenant?.modeloMensagemId) {
    const m = await prisma.modeloMensagem.findUnique({
      where: { id: menuTenant.modeloMensagemId },
      select: { id: true, nome: true, conteudo: true, cooperativaId: true },
    });
    console.log('Modelo TENANT:', m?.nome, 'cooperativaId=', m?.cooperativaId);
    console.log('  Tem "CooperTokens"?', m?.conteudo.includes('CooperTokens'));
    console.log('  Conteúdo:\n', m?.conteudo);
  }
  if (menuGlobal?.modeloMensagemId) {
    const m = await prisma.modeloMensagem.findUnique({
      where: { id: menuGlobal.modeloMensagemId },
      select: { id: true, nome: true, conteudo: true, cooperativaId: true },
    });
    console.log('\nModelo GLOBAL:', m?.nome, 'cooperativaId=', m?.cooperativaId);
    console.log('  Tem "CooperTokens"?', m?.conteudo.includes('CooperTokens'));
  }

  // (6) Submenu MENU_COOPERTOKENS — só existe global?
  console.log('\n── (6) MENU_COOPERTOKENS (submenu) ──');
  const submenuGlobal = await prisma.fluxoEtapa.findFirst({
    where: { estado: 'MENU_COOPERTOKENS', cooperativaId: null },
    select: { id: true, ativo: true, gatilhos: true, modeloMensagemId: true },
  });
  const submenuTenant = await prisma.fluxoEtapa.findFirst({
    where: { estado: 'MENU_COOPERTOKENS', cooperativaId: 'cmn0ho8bx0000uox8wu96u6fd' },
    select: { id: true, ativo: true },
  });
  console.log('Submenu GLOBAL existe:', !!submenuGlobal, 'ativo=', submenuGlobal?.ativo);
  console.log('Submenu TENANT existe:', !!submenuTenant, 'ativo=', submenuTenant?.ativo);

  // (7) Conversa atual do telefone Luciano
  console.log('\n── (7) Conversa Luciano (5527981341348) ──');
  const conversa = await prisma.conversaWhatsapp.findFirst({
    where: { telefone: '5527981341348' },
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true, telefone: true, estado: true,
      cooperadoId: true, cooperativaId: true,
      updatedAt: true,
    },
  });
  console.log(conversa);
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
