import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const NOVA_ID = 'cmp9pncx30000vaiwh5eyps2g';
const ANTIGA_ID = 'cmp8fkxvt0001valkj8utb8vr';

async function main() {
  console.log('═══ Auditoria Cooperebr2 duplicada — read-only ═══\n');

  // 1) Listar todas as usinas com apelidoInterno='cooperebr2'
  const usinas = await prisma.usina.findMany({
    where: { apelidoInterno: 'cooperebr2' },
    select: {
      id: true, nome: true, apelidoInterno: true, statusHomologacao: true,
      createdAt: true, updatedAt: true, capacidadeKwh: true, cooperativaId: true,
    },
    orderBy: { createdAt: 'asc' },
  });
  console.log(`>> usinas com apelidoInterno='cooperebr2': ${usinas.length}`);
  for (const u of usinas) {
    console.log(`  - ${u.id} | ${u.nome} | status=${u.statusHomologacao} | cap=${u.capacidadeKwh} | created=${u.createdAt.toISOString()} | updated=${u.updatedAt.toISOString()}`);
  }
  console.log('');

  // 2) Contar dependências da NOVA (deve ser zero antes de deletar)
  const [
    contratos, leituras, geracoes, configs, alertas,
    migracoesO, migracoesD, contratosUso, contasPagar, monitConfig,
  ] = await Promise.all([
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

  console.log(`>> dependências NOVA (${NOVA_ID}):`);
  console.log(`  contratos:               ${contratos}`);
  console.log(`  usina_leituras:          ${leituras}`);
  console.log(`  geracoes_mensais:        ${geracoes}`);
  console.log(`  configuracoes_cobranca:  ${configs}`);
  console.log(`  usina_alertas:           ${alertas}`);
  console.log(`  migracoes_origem:        ${migracoesO}`);
  console.log(`  migracoes_destino:       ${migracoesD}`);
  console.log(`  contratos_uso:           ${contratosUso}`);
  console.log(`  contas_pagar:            ${contasPagar}`);
  console.log(`  monitoramento_config:    ${monitConfig}`);
  const totalNova = contratos + leituras + geracoes + configs + alertas + migracoesO + migracoesD + contratosUso + contasPagar + monitConfig;
  console.log(`  TOTAL:                   ${totalNova} ${totalNova === 0 ? '✅ pode deletar' : '🔴 NÃO deletar — pedir Luciano'}\n`);

  // 3) Dependências da ANTIGA (informativo)
  const [
    cAnt, lAnt, gAnt, cfAnt, alAnt, miAntO, miAntD, cuAnt, cpAnt, mcAnt,
  ] = await Promise.all([
    prisma.contrato.count({ where: { usinaId: ANTIGA_ID } }),
    prisma.usinaLeitura.count({ where: { usinaId: ANTIGA_ID } }),
    prisma.geracaoMensal.count({ where: { usinaId: ANTIGA_ID } }),
    prisma.configuracaoCobranca.count({ where: { usinaId: ANTIGA_ID } }),
    prisma.usinaAlerta.count({ where: { usinaId: ANTIGA_ID } }),
    prisma.migracaoUsina.count({ where: { usinaOrigemId: ANTIGA_ID } }),
    prisma.migracaoUsina.count({ where: { usinaDestinoId: ANTIGA_ID } }),
    prisma.contratoUso.count({ where: { usinaId: ANTIGA_ID } }),
    prisma.contaAPagar.count({ where: { usinaId: ANTIGA_ID } }),
    prisma.usinaMonitoramentoConfig.count({ where: { usinaId: ANTIGA_ID } }),
  ]);
  console.log(`>> dependências ANTIGA (${ANTIGA_ID}) — informativo:`);
  console.log(`  contratos: ${cAnt} | leituras: ${lAnt} | geracoes: ${gAnt} | configs: ${cfAnt} | alertas: ${alAnt}`);
  console.log(`  migracoes_origem: ${miAntO} | migracoes_destino: ${miAntD} | contratos_uso: ${cuAnt} | contas_pagar: ${cpAnt} | monit: ${mcAnt}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
