/**
 * Fix R2 — substitui "CoopereBR" literal por {{parceiro}} nos modelos
 * `menu_principal` e `nps_aguardando_nota`.
 *
 * Idempotente: se já está com {{parceiro}}, não faz nada.
 * Mostra ANTES/DEPOIS de cada update.
 *
 * Roda: cd backend ; npx ts-node scripts/fix-r2-coopereb-para-parceiro.ts
 */
import { PrismaClient } from '@prisma/client';

const NOMES_ALVO = ['menu_principal', 'nps_aguardando_nota'] as const;

async function main(): Promise<void> {
  const prisma = new PrismaClient();
  try {
    const modelos = await prisma.modeloMensagem.findMany({
      where: { nome: { in: [...NOMES_ALVO] } },
      select: { id: true, nome: true, conteudo: true, cooperativaId: true },
      orderBy: [{ nome: 'asc' }, { id: 'asc' }],
    });

    if (modelos.length === 0) {
      console.log('[fix-r2] Nenhum modelo encontrado com nomes alvo. Nada a fazer.');
      return;
    }

    console.log(`[fix-r2] ${modelos.length} modelos encontrados:\n`);

    for (const m of modelos) {
      const escopo = m.cooperativaId === null ? 'GLOBAL' : `TENANT(${m.cooperativaId})`;
      const temHardcode = /CoopereBR/i.test(m.conteudo);
      console.log(`────────────────────────────────────────`);
      console.log(`Modelo "${m.nome}" id=${m.id} ${escopo}`);
      console.log(`Hardcode "CoopereBR"? ${temHardcode ? 'SIM ⚠️' : 'NÃO (já corrigido)'}`);

      if (!temHardcode) {
        console.log('  → SKIP (idempotente).\n');
        continue;
      }

      const antes = m.conteudo;
      const depois = m.conteudo.replace(/CoopereBR/g, '{{parceiro}}');

      console.log(`ANTES:\n${JSON.stringify(antes)}`);
      console.log(`DEPOIS:\n${JSON.stringify(depois)}`);

      await prisma.modeloMensagem.update({
        where: { id: m.id },
        data: { conteudo: depois },
      });
      console.log(`  → UPDATE aplicado.\n`);
    }

    console.log(`────────────────────────────────────────`);
    console.log('[fix-r2] Concluído. Validação pós-update:');
    const pos = await prisma.modeloMensagem.findMany({
      where: { nome: { in: [...NOMES_ALVO] } },
      select: { nome: true, conteudo: true },
    });
    for (const m of pos) {
      const aindaTemHardcode = /CoopereBR/i.test(m.conteudo);
      const temVar = m.conteudo.includes('{{parceiro}}');
      console.log(`  ${m.nome}: hardcode? ${aindaTemHardcode ? '⚠️ SIM' : 'NÃO ✅'} | {{parceiro}}? ${temVar ? 'SIM ✅' : 'NÃO'}`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
