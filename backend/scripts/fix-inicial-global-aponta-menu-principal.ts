/**
 * Adendo "Qual cadastro?" (08/06/2026) — INICIAL global aponta pro
 * modelo menu_principal (4 opções) em vez de boas_vindas (envie foto)
 * + adiciona 4 gatilhos (1/2/3/4) consistentes com o tenant CoopereBR.
 *
 * Motivação: quando comando INICIO/MENU não reconhece cooperado, o
 * fallback atual rendia "envie uma foto da fatura" — pouco útil pra
 * visitante curioso. O modelo menu_principal mostra "1 Já sou cooperado,
 * 2 Quero ser, 3 Atendente, 4 Convidar" — fluxo aquisição melhor.
 *
 * Tenant CoopereBR JÁ usa menu_principal (override em INICIAL tenant);
 * essa fix alinha GLOBAL com a prática real.
 *
 * Idempotente. Roda 1x.
 */
import { PrismaClient, Prisma } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log('═══ Fix INICIAL global -> menu_principal ═══\n');

  const inicialGlobal = await prisma.fluxoEtapa.findFirst({
    where: { estado: 'INICIAL', cooperativaId: null },
  });
  if (!inicialGlobal) {
    console.log('❌ INICIAL global não encontrado.');
    process.exit(1);
  }

  const menuPrincipal = await prisma.modeloMensagem.findFirst({
    where: { nome: 'menu_principal', cooperativaId: null },
    select: { id: true },
  });
  if (!menuPrincipal) {
    console.log('❌ Modelo "menu_principal" global não encontrado.');
    process.exit(1);
  }

  // Gatilhos esperados (espelham INICIAL tenant CoopereBR).
  const gatilhosEsperados = [
    { resposta: '1', proximoEstado: 'MENU_COOPERADO', acao: 'VERIFICAR_COOPERADO' },
    { resposta: '2', proximoEstado: 'MENU_SEM_FATURA' },
    { resposta: '3', proximoEstado: 'AGUARDANDO_ATENDENTE' },
    { resposta: '4', proximoEstado: 'ENVIAR_CONVITE' },
  ];

  const modeloOk = inicialGlobal.modeloMensagemId === menuPrincipal.id;
  const gatilhosAtuais = (Array.isArray(inicialGlobal.gatilhos) ? inicialGlobal.gatilhos : []) as unknown[];
  const gatilhosOk = JSON.stringify(gatilhosAtuais) === JSON.stringify(gatilhosEsperados);

  if (modeloOk && gatilhosOk) {
    console.log('⏭️  INICIAL global já com modelo + gatilhos corretos — nada a fazer.');
    return;
  }

  console.log(`Antes:`);
  console.log(`  modeloMensagemId=${inicialGlobal.modeloMensagemId}`);
  console.log(`  gatilhos=${JSON.stringify(gatilhosAtuais)}`);
  await prisma.fluxoEtapa.update({
    where: { id: inicialGlobal.id },
    data: {
      modeloMensagemId: menuPrincipal.id,
      gatilhos: gatilhosEsperados as unknown as Prisma.InputJsonValue,
    },
  });
  console.log(`Depois:`);
  console.log(`  modeloMensagemId=${menuPrincipal.id} (menu_principal)`);
  console.log(`  gatilhos=${JSON.stringify(gatilhosEsperados)}\n`);

  console.log('✅ Aplicado. Reinicie o backend (PM2) pra recarregar cache de fluxos.');
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
