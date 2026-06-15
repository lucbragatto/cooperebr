/* Read-only audit. Sem expor secrets — apenas length e sufixo 4 chars.
   Models cobertos: AsaasConfig (legado), ConfigGateway (multi-tenant),
   ConfigGatewayPlataforma (global SISGD), ConfigTenant (key-value email). */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function tail4(s: string | null | undefined): string {
  if (!s) return '(null)';
  return s.length >= 4 ? '****' + s.slice(-4) : '****' + s;
}

async function main() {
  // === 1. AsaasConfig (legado) ===
  console.log('\n=== AsaasConfig (LEGADO) ===');
  const asaasConfigs = await prisma.asaasConfig.findMany({
    orderBy: { createdAt: 'asc' },
  });
  console.log(`Total: ${asaasConfigs.length}`);
  for (const c of asaasConfigs) {
    const coop = await prisma.cooperativa.findUnique({
      where: { id: c.cooperativaId },
      select: { nome: true, tipoParceiro: true },
    });
    console.log({
      cooperativa: coop?.nome,
      ambiente: c.ambiente,
      apiKey_len: c.apiKey?.length ?? 0,
      apiKey_suffix: tail4(c.apiKey),
      webhookToken_len: c.webhookToken?.length ?? 0,
      createdAt: c.createdAt.toISOString().slice(0, 10),
      updatedAt: c.updatedAt.toISOString().slice(0, 10),
    });
  }

  // === 2. ConfigGateway (multi-tenant atual) ===
  console.log('\n=== ConfigGateway (multi-tenant — Fluxo 2 cobrar membros) ===');
  const gateways = await prisma.configGateway.findMany({
    orderBy: { createdAt: 'asc' },
  });
  console.log(`Total: ${gateways.length}`);
  for (const g of gateways) {
    const coop = await prisma.cooperativa.findUnique({
      where: { id: g.cooperativaId },
      select: { nome: true },
    });
    const cred = (g.credenciais as Record<string, unknown>) || {};
    const credKeys = Object.keys(cred);
    console.log({
      cooperativa: coop?.nome,
      gateway: g.gateway,
      ambiente: g.ambiente,
      ativo: g.ativo,
      credenciais_keys: credKeys,
      apiKey_suffix: credKeys.includes('apiKey')
        ? tail4(String(cred.apiKey))
        : '(sem-apiKey)',
      webhookToken_len: g.webhookToken?.length ?? 0,
      createdAt: g.createdAt.toISOString().slice(0, 10),
      updatedAt: g.updatedAt.toISOString().slice(0, 10),
    });
  }

  // === 3. ConfigGatewayPlataforma (global SISGD — Fluxo 1) ===
  console.log('\n=== ConfigGatewayPlataforma (SISGD — Fluxo 1 FaturaSaas) ===');
  const plataformaConfigs = await prisma.configGatewayPlataforma.findMany({
    orderBy: { createdAt: 'asc' },
  });
  console.log(`Total: ${plataformaConfigs.length}`);
  for (const p of plataformaConfigs) {
    const cred = (p.credenciais as Record<string, unknown>) || {};
    const credKeys = Object.keys(cred);
    console.log({
      gateway: p.gateway,
      ambiente: p.ambiente,
      ativo: p.ativo,
      credenciais_keys: credKeys,
      apiKey_suffix: credKeys.includes('apiKey')
        ? tail4(String(cred.apiKey))
        : '(sem-apiKey)',
      webhookToken_len: p.webhookToken?.length ?? 0,
      createdAt: p.createdAt.toISOString().slice(0, 10),
      updatedAt: p.updatedAt.toISOString().slice(0, 10),
    });
  }

  // === 4. ConfigTenant — chaves de email (smtp/imap) ===
  console.log('\n=== ConfigTenant — chaves de email (smtp/monitor/imap) ===');
  const emailConfigs = await prisma.configTenant.findMany({
    where: {
      OR: [
        { chave: { startsWith: 'email.smtp.' } },
        { chave: { startsWith: 'email.monitor.' } },
        { chave: { startsWith: 'email.imap.' } },
      ],
    },
    orderBy: [{ cooperativaId: 'asc' }, { chave: 'asc' }],
  });
  console.log(`Total: ${emailConfigs.length} (linhas de config de email)`);
  const byCoop = new Map<string | null, Set<string>>();
  for (const e of emailConfigs) {
    const k = e.cooperativaId;
    if (!byCoop.has(k)) byCoop.set(k, new Set());
    byCoop.get(k)!.add(e.chave);
  }
  for (const [coopId, chaves] of byCoop) {
    const coopNome = coopId
      ? (await prisma.cooperativa.findUnique({
          where: { id: coopId },
          select: { nome: true },
        }))?.nome ?? '(coop não encontrada)'
      : '(GLOBAL/SISGD — cooperativaId=null)';
    const smtp = [...chaves].filter((c) => c.startsWith('email.smtp.'));
    const monitor = [...chaves].filter((c) => c.startsWith('email.monitor.'));
    console.log({
      cooperativa: coopNome,
      cooperativaId: coopId ?? 'NULL',
      chaves_smtp: smtp.length,
      chaves_monitor_imap: monitor.length,
      total: chaves.size,
    });
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
