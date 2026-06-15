import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log('=== AUDIT 1: Contratos com tenant divergente Contrato.cooperativaId != Usina.cooperativaId ===');
  const todosContratos = await prisma.contrato.findMany({
    where: { usinaId: { not: null } },
    include: { usina: { select: { id: true, nome: true, cooperativaId: true } } },
  });
  const divergentes = todosContratos.filter(
    c => c.usina?.cooperativaId != null && c.cooperativaId !== c.usina.cooperativaId
  );
  console.log(`Total contratos com usina: ${todosContratos.length}`);
  console.log(`Total divergentes: ${divergentes.length}`);
  if (divergentes.length > 0) {
    console.log(JSON.stringify(divergentes.map(c => ({
      id: c.id, numero: c.numero, status: c.status,
      contratoCoop: c.cooperativaId,
      usinaCoop: c.usina?.cooperativaId,
      usinaNome: c.usina?.nome,
    })), null, 2));
  }

  console.log('\n=== AUDIT 2: DIEGO Cooperado + entidades ===');
  const diego = await prisma.cooperado.findFirst({
    where: { cpf: '05375082799' },
  });
  console.log('DIEGO:', JSON.stringify(diego, null, 2));

  if (diego) {
    const ucs = await prisma.uc.findMany({
      where: { cooperadoId: diego.id },
      include: { contratos: { include: { usina: true } } },
    });
    console.log('\nUCs do DIEGO:');
    console.log(JSON.stringify(ucs, null, 2));

    const faturas = await prisma.faturaProcessada.findMany({
      where: { cooperadoId: diego.id },
    });
    console.log('\nFaturas do DIEGO:');
    console.log(JSON.stringify(faturas, null, 2));

    const propostas = await prisma.propostaCooperado.findMany({
      where: { cooperadoId: diego.id },
    });
    console.log('\nPropostas do DIEGO:');
    console.log(JSON.stringify(propostas, null, 2));

    const contratos = await prisma.contrato.findMany({
      where: { cooperadoId: diego.id },
    });
    if (contratos.length > 0) {
      const cobs = await prisma.cobranca.findMany({
        where: { contratoId: { in: contratos.map(c => c.id) } },
      });
      console.log('\nCobranças do DIEGO (esperado 0):');
      console.log(JSON.stringify(cobs, null, 2));
    }
  }

  console.log('\n=== AUDIT 3: Usinas EDP_ES no banco ===');
  const usinas = await prisma.usina.findMany({
    where: { distribuidora: 'EDP_ES' },
    select: { id: true, nome: true, cooperativaId: true, capacidadeKwh: true },
  });
  console.log(JSON.stringify(usinas, null, 2));

  console.log('\n=== AUDIT 4: Contratos CoopereBR com usina divergente ===');
  const coopereBrId = 'cmn0ho8bx0000uox8wu96u6fd';
  const contratosCoopereBr = await prisma.contrato.findMany({
    where: { cooperativaId: coopereBrId, usinaId: { not: null } },
    include: { usina: { select: { nome: true, cooperativaId: true } } },
  });
  const errados = contratosCoopereBr.filter(c => c.usina?.cooperativaId !== coopereBrId);
  console.log(`Total contratos CoopereBR com usina: ${contratosCoopereBr.length}`);
  console.log(`Com cooperativaId divergente: ${errados.length}`);
  if (errados.length > 0) {
    console.log(JSON.stringify(errados.map(c => ({ id: c.id, numero: c.numero, usina: c.usina })), null, 2));
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
