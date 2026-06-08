/**
 * Diagnóstico bot WA — verifica se telefone 27981341348 / 5527981341348
 * está vinculado a Cooperado ATIVO em qualquer cooperativa.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const variantes = [
    '27981341348',
    '5527981341348',
    '027981341348',
    '+5527981341348',
    '2781341348',
    '5527981341348'.slice(2),
  ];

  console.log('═══ Diagnóstico telefone bot WA ═══\n');

  for (const tel of variantes) {
    const cooperados = await prisma.cooperado.findMany({
      where: { telefone: tel },
      select: {
        id: true,
        nomeCompleto: true,
        cpf: true,
        email: true,
        telefone: true,
        status: true,
        cooperativaId: true,
      },
    });
    console.log(`telefone="${tel}": ${cooperados.length} matches`);
    for (const c of cooperados) {
      console.log(
        `  - id=${c.id} nome="${c.nomeCompleto}" status=${c.status} cooperativaId=${c.cooperativaId} email=${c.email}`,
      );
    }
  }

  console.log('\n── Cooperado Luciano específico (id cmn0dsc4w005guols56peyc5h) ──');
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
    },
  });
  console.log(luciano);

  console.log('\n── ConversaWhatsapp recentes deste telefone ──');
  const conversas = await prisma.conversaWhatsapp.findMany({
    where: {
      telefone: { in: variantes },
    },
    orderBy: { updatedAt: 'desc' },
    take: 5,
    select: {
      id: true,
      telefone: true,
      estado: true,
      cooperadoId: true,
      cooperativaId: true,
      updatedAt: true,
    },
  });
  for (const c of conversas) {
    console.log(
      `  id=${c.id} tel=${c.telefone} estado=${c.estado} cooperadoId=${c.cooperadoId} cooperativaId=${c.cooperativaId} updatedAt=${c.updatedAt.toISOString()}`,
    );
  }
  if (conversas.length === 0) console.log('  (nenhuma)');

  console.log('\n── MENU_COOPERADO global: gatilhos atuais ──');
  const menu = await prisma.fluxoEtapa.findFirst({
    where: { estado: 'MENU_COOPERADO', cooperativaId: null },
    select: { id: true, gatilhos: true, modeloMensagemId: true },
  });
  if (menu) {
    console.log(`  id=${menu.id}`);
    console.log(`  gatilhos=`, JSON.stringify(menu.gatilhos, null, 2));
    if (menu.modeloMensagemId) {
      const modelo = await prisma.modeloMensagem.findUnique({
        where: { id: menu.modeloMensagemId },
        select: { conteudo: true },
      });
      console.log(`\n  modelo:\n${modelo?.conteudo}`);
    }
  } else {
    console.log('  ❌ MENU_COOPERADO global não encontrado.');
  }
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
