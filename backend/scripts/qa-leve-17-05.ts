import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log('═══ QA Leve 17/05 — Frente 4 smoke Prisma direto ═══\n');

  // Cenário 1: contagem envios criados durante smoke da Fase 3
  const envios = await prisma.envioListaConcessionaria.findMany({
    select: {
      id: true, numeroInterno: true, status: true,
      cooperativaId: true, usinaId: true,
      createdAt: true, updatedAt: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });
  console.log(`>> envios_lista_concessionaria total recentes: ${envios.length}`);
  for (const e of envios) {
    console.log(`   ${e.numeroInterno} | status=${e.status} | created=${e.createdAt.toISOString().slice(0, 19)}`);
  }

  // Cenário 2: cooperados em envio com statusIndividual=HOMOLOGADO
  const homologados = await prisma.envioListaCooperado.findMany({
    where: { statusIndividual: 'HOMOLOGADO' },
    include: {
      cooperado: { select: { nomeCompleto: true } },
      envio: { select: { numeroInterno: true, status: true } },
    },
  });
  console.log(`\n>> EnvioListaCooperado HOMOLOGADO: ${homologados.length}`);
  for (const h of homologados) {
    console.log(`   ${h.cooperado.nomeCompleto} | envio=${h.envio.numeroInterno} (${h.envio.status}) | dataHomologacao=${h.dataHomologacao?.toISOString().slice(0, 10)}`);
  }

  // Cenário 3: classeGdAnotada estado (deve ser null em todas)
  const usinas = await prisma.usina.findMany({
    select: { nome: true, apelidoInterno: true, classeGdAnotada: true },
    take: 10,
  });
  console.log(`\n>> Usina.classeGdAnotada (esperado null em todas):`);
  let comAnotacao = 0;
  for (const u of usinas) {
    if (u.classeGdAnotada !== null) comAnotacao++;
  }
  console.log(`   total amostradas: ${usinas.length} | com anotação: ${comAnotacao} (esperado 0)`);

  // Cenário 4: Exfishes Contrato continua ATIVO
  const exfishesContrato = await prisma.contrato.findFirst({
    where: {
      cooperado: { nomeCompleto: { contains: 'EXFISHES', mode: 'insensitive' } },
      status: { in: ['ATIVO', 'PENDENTE_ATIVACAO'] },
    },
    select: {
      id: true, numero: true, status: true,
      percentualUsina: true, kwhContrato: true,
      cooperado: { select: { nomeCompleto: true } },
      usina: { select: { nome: true, apelidoInterno: true } },
    },
  });
  console.log(`\n>> Exfishes contrato vigente:`);
  if (exfishesContrato) {
    console.log(`   ${exfishesContrato.numero} | status=${exfishesContrato.status} | %=${exfishesContrato.percentualUsina} | kwh=${exfishesContrato.kwhContrato}`);
    console.log(`   usina: ${exfishesContrato.usina?.nome} (${exfishesContrato.usina?.apelidoInterno})`);
  } else {
    console.log('   ❌ Exfishes não tem contrato ATIVO/PENDENTE');
  }

  // Cenário 5: schema apelidoInterno @unique — tentar duplicar deve falhar (NÃO vou inserir; só conferir o unique no Prisma generate)
  const coopebr2Count = await prisma.usina.count({ where: { apelidoInterno: 'cooperebr2' } });
  console.log(`\n>> usinas com apelidoInterno='cooperebr2' (esperado 1 — duplicada deletada no M9): ${coopebr2Count}`);

  // Cenário 6: AuditLog table
  try {
    const audit = await (prisma as any).auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
    console.log(`\n>> audit_log entries recentes: ${audit.length}`);
    if (audit.length === 0) {
      console.log('   ⚠️  Tabela existe mas vazia — D-30N interceptor ainda inativo (confirma estado catalogado)');
    } else {
      for (const a of audit.slice(0, 5)) {
        console.log(`   ${a.createdAt?.toISOString?.()?.slice(0, 19)} | ${a.acao ?? a.action ?? '?'} | ${a.recurso ?? a.resource ?? '?'}`);
      }
    }
  } catch (e: any) {
    console.log(`\n>> audit_log: ERRO acessando — ${e.message?.slice(0, 80)}`);
  }

  // Cenário 7: ConfigTenant chaves do Bloco D (9 chaves esperadas)
  try {
    const configs = await (prisma as any).configuracaoTenant.findMany({
      where: {
        OR: [
          { chave: { startsWith: 'cron.' } },
          { chave: { startsWith: 'lembrete.' } },
        ],
      },
      select: { cooperativaId: true, chave: true, valor: true },
    });
    console.log(`\n>> ConfigTenant Bloco D (cron.* OR lembrete.*): ${configs.length} chaves (esperado ≥9)`);
    const distintas = new Set(configs.map((c: any) => c.chave));
    console.log(`   chaves distintas: ${Array.from(distintas).sort().join(', ')}`);
  } catch (e: any) {
    console.log(`\n>> ConfigTenant: ERRO — ${e.message?.slice(0, 80)}`);
  }

  // Cenário 8: timezone bug D-novo-I — pegar 1 envio com geradaEm e mostrar formatação
  if (envios.length > 0) {
    const e0 = envios[0];
    console.log(`\n>> D-novo-I timezone check em geradaEm:`);
    console.log(`   raw UTC: ${e0.createdAt.toISOString()}`);
    console.log(`   toLocaleDateString pt-BR default: ${e0.createdAt.toLocaleDateString('pt-BR')}`);
    console.log(`   toLocaleString pt-BR default: ${e0.createdAt.toLocaleString('pt-BR')}`);
    console.log(`   toLocaleString pt-BR São Paulo: ${e0.createdAt.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`);
    // Se UTC for 02:00 e Brasil for 23:00 do dia anterior, há offset
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
