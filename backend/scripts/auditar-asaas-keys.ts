/* Read-only — comparar suffixes longos dos 2 caminhos Asaas pra resolver
   discrepância com a UI '****MzY5'. Mostra os 8 últimos chars. */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function tail(s: string | null | undefined, n = 8): string {
  if (!s) return '(null)';
  return s.length >= n ? '****' + s.slice(-n) : '****' + s;
}

async function main() {
  const a = await prisma.asaasConfig.findFirst({});
  if (a) {
    console.log('AsaasConfig:', {
      ambiente: a.ambiente,
      apiKey_len: a.apiKey.length,
      apiKey_tail8: tail(a.apiKey, 8),
      apiKey_tail12: tail(a.apiKey, 12),
      starts_with_aact: a.apiKey.startsWith('$aact'),
      starts_with_dollar: a.apiKey.startsWith('$'),
    });
  }
  const g = await prisma.configGateway.findFirst({ where: { gateway: 'ASAAS' } });
  if (g) {
    const cred = (g.credenciais as Record<string, unknown>) || {};
    const apiKey = String(cred.apiKey ?? '');
    console.log('ConfigGateway[ASAAS]:', {
      ambiente: g.ambiente,
      cred_keys: Object.keys(cred),
      apiKey_len: apiKey.length,
      apiKey_tail8: tail(apiKey, 8),
      apiKey_tail12: tail(apiKey, 12),
      starts_with_aact: apiKey.startsWith('$aact'),
      starts_with_dollar: apiKey.startsWith('$'),
    });
  }
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
