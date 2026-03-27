import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();

const ids = [
  'cmn7rvqzx000buop8jg1i0zas','cmn7rvr3m000fuop876jxz94c',
  'cmn7rvr7a000juop8nkzbt3w6','cmn7rvrax000nuop8rat93v95',
  'cmn7rvren000ruop8qm9sci50','cmn0dscyt005vuols001eicgi',
  'cmn5dp8p0000ouowgapkwjg0f','cmn5dp8wk000ruowgtkeq9uqk',
  'cmn5dp946000tuowgqbr5vtv5',
];

async function main() {
  // Verificar contratos reais que referenciam UCs dos cooperados de teste
  const contratos = await p.$queryRawUnsafe<any[]>(
    `SELECT c.id, c."cooperadoId", c."ucId", u."cooperadoId" as uc_owner
     FROM contratos c 
     JOIN ucs u ON u.id = c."ucId"
     WHERE u."cooperadoId" IN (${ids.map(id => `'${id}'`).join(',')})`
  );
  console.log('Contratos restantes com essas UCs:', contratos.length);
  console.log(JSON.stringify(contratos, null, 2));
}

main().then(() => p.$disconnect()).catch(e => { console.error('ERRO:', e.message); p.$disconnect(); });
