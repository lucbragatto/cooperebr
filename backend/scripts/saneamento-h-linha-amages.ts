/**
 * H'.3 Saneamento AMAGES — Opção A confirmada Luciano:
 * marcar ambienteTeste=true (preserva smoke histórico M4 + cobrança R$ 979,20).
 */
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
const AMAGES_ID = 'cmp7034d70002vaf0af5ws4ud';

async function main() {
  console.log('═══ H linha.3 Saneamento AMAGES ═══\n');

  const antes = await prisma.cooperado.findUnique({
    where: { id: AMAGES_ID },
    select: { id: true, nomeCompleto: true, ambienteTeste: true, status: true, cooperativaId: true,
      contratos: { select: { numero: true, status: true, kwhContratoAnual: true } },
      ucs: { select: { numero: true, distribuidora: true } },
    },
  });
  console.log('ANTES:', JSON.stringify(antes, null, 2));

  const r = await prisma.cooperado.update({
    where: { id: AMAGES_ID },
    data: { ambienteTeste: true },
    select: { id: true, ambienteTeste: true, nomeCompleto: true },
  });
  console.log('\nUPDATE ambienteTeste=true →', r);

  const depois = await prisma.cooperado.findUnique({
    where: { id: AMAGES_ID },
    select: { id: true, ambienteTeste: true,
      contratos: { select: { numero: true, status: true } },
      ucs: { select: { numero: true } },
    },
  });
  console.log('\nDEPOIS:', JSON.stringify(depois, null, 2));

  // Preservações
  const cob = await prisma.cobranca.findFirst({ where: { contrato: { cooperadoId: AMAGES_ID } }, select: { id: true, valorLiquido: true, modeloCobrancaUsado: true } });
  console.log('\nCobrança M4 preservada:', cob);
  const plano = await prisma.plano.findFirst({ where: { nome: 'PLANO AMAGES COMPENSADOS' }, select: { id: true, nome: true, publico: true } });
  console.log('Plano preservado:', plano);
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
