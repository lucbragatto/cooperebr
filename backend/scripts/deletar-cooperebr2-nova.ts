import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const NOVA_ID = 'cmp9pncx30000vaiwh5eyps2g';

async function main() {
  console.log('═══ Saneamento Cooperebr2 duplicada — Fase 2 ═══\n');

  // Re-validar zero dependências (defensivo) antes do delete
  const [contratos, leituras, geracoes, configs, alertas, migO, migD, cu, cp, mc] = await Promise.all([
    prisma.contrato.count({ where: { usinaId: NOVA_ID } }),
    prisma.usinaLeitura.count({ where: { usinaId: NOVA_ID } }),
    prisma.geracaoMensal.count({ where: { usinaId: NOVA_ID } }),
    prisma.configuracaoCobranca.count({ where: { usinaId: NOVA_ID } }),
    prisma.usinaAlerta.count({ where: { usinaId: NOVA_ID } }),
    prisma.migracaoUsina.count({ where: { usinaOrigemId: NOVA_ID } }),
    prisma.migracaoUsina.count({ where: { usinaDestinoId: NOVA_ID } }),
    prisma.contratoUso.count({ where: { usinaId: NOVA_ID } }),
    prisma.contaAPagar.count({ where: { usinaId: NOVA_ID } }),
    prisma.usinaMonitoramentoConfig.count({ where: { usinaId: NOVA_ID } }),
  ]);
  const total = contratos + leituras + geracoes + configs + alertas + migO + migD + cu + cp + mc;
  if (total !== 0) {
    console.error(`🔴 ABORT: nova tem ${total} dependência(s). NÃO deletar sem revisão.`);
    process.exit(1);
  }
  console.log('✅ re-validado: zero dependências.\n');

  // Snapshot antes do delete
  const snapshot = await prisma.usina.findUnique({
    where: { id: NOVA_ID },
    select: {
      id: true, nome: true, apelidoInterno: true, statusHomologacao: true,
      capacidadeKwh: true, potenciaKwp: true, cooperativaId: true,
      createdAt: true, updatedAt: true,
    },
  });
  if (!snapshot) {
    console.error(`🔴 ABORT: usina ${NOVA_ID} não encontrada — já deletada?`);
    process.exit(1);
  }
  console.log('>> Snapshot pré-delete:');
  console.log(JSON.stringify(snapshot, null, 2));
  console.log('');

  // Delete
  await prisma.usina.delete({ where: { id: NOVA_ID } });
  console.log(`✅ DELETE OK em usinas.id=${NOVA_ID}\n`);

  // Confirmar pós-delete
  const remanescentes = await prisma.usina.findMany({
    where: { apelidoInterno: 'cooperebr2' },
    select: { id: true, nome: true, apelidoInterno: true, statusHomologacao: true, capacidadeKwh: true },
  });
  console.log(`>> usinas com apelidoInterno='cooperebr2' pós-delete: ${remanescentes.length}`);
  for (const u of remanescentes) {
    console.log(`  - ${u.id} | ${u.nome} | status=${u.statusHomologacao} | cap=${u.capacidadeKwh}`);
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
