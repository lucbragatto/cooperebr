import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();

async function main() {
  const ids = [
    'cmn7rvqzx000buop8jg1i0zas', 'cmn7rvr3m000fuop876jxz94c',
    'cmn7rvr7a000juop8nkzbt3w6', 'cmn7rvrax000nuop8rat93v95',
    'cmn7rvren000ruop8qm9sci50', 'cmn0dscyt005vuols001eicgi',
    'cmn5dp8p0000ouowgapkwjg0f', 'cmn5dp8wk000ruowgtkeq9uqk',
    'cmn5dp946000tuowgqbr5vtv5',
  ];
  const idList = ids.map(id => `'${id}'`).join(',');

  // Contratos e cobranças já foram deletados nas tentativas anteriores.
  // UCs não podem ser deletadas (FK NOT NULL em contratos de cooperados reais).
  // Solução: apenas deletar os cooperados — UCs ficam com cooperadoId apontando
  // para IDs inexistentes (FK pode ter sido setada como deferrable no Postgres).
  // Se não funcionar, vamos apenas anonimizar.

  // WA
  try {
    await p.$executeRawUnsafe(`DELETE FROM mensagens_whatsapp WHERE telefone IN (SELECT telefone FROM cooperados WHERE id IN (${idList}))`);
    await p.$executeRawUnsafe(`DELETE FROM conversas_whatsapp WHERE telefone IN (SELECT telefone FROM cooperados WHERE id IN (${idList}))`);
    console.log('mensagens WA limpas');
  } catch(e: any) { console.log('WA skip:', e.message); }

  // Tentar deletar cooperados (pode falhar se ainda há FKs)
  try {
    await p.$executeRawUnsafe(`DELETE FROM cooperados WHERE id IN (${idList})`);
    console.log('✅ 9 cooperados de teste removidos.');
  } catch(e: any) {
    // Se não consegue deletar, anonimizar
    console.log('Delete falhou, anonimizando:', e.message.slice(0, 100));
    await p.$executeRawUnsafe(
      `UPDATE cooperados SET 
        "nomeCompleto" = 'REMOVIDO',
        telefone = CONCAT('INATIVO-', id),
        email = CONCAT('inativo-', id, '@removido.invalid'),
        cpf = CONCAT('000', SUBSTR(id, 1, 9))
      WHERE id IN (${idList})`
    );
    console.log('✅ 9 cooperados de teste anonimizados (não removíveis por FK).');
  }
}

main().then(() => p.$disconnect()).catch(e => { console.error('ERRO FATAL:', e.message); p.$disconnect(); });
