/**
 * Seta `webhookToken` no AsaasConfig da CoopereBR (parceiro principal).
 *
 * Uso:
 *   npx ts-node --transpile-only scripts/setar-webhook-token-asaas.ts --token=BASE64==
 *
 * Garantias:
 *  - Idempotente (rodar 2x com mesmo token não falha)
 *  - Multi-tenant respeitado: NUNCA atualiza tenant 'CoopereBR Teste'
 *  - Nunca imprime o token no log (só prefixo + tamanho)
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const COOPEREBR_PRINCIPAL_ID = 'cmn0ho8bx0000uox8wu96u6fd';

function parseToken(): string {
  const arg = process.argv.find((a) => a.startsWith('--token='));
  if (!arg) {
    console.error('ERRO: passe --token=<valor>');
    process.exit(1);
  }
  return arg.slice('--token='.length);
}

function mascarar(token: string): string {
  if (!token) return '(vazio)';
  return `${token.slice(0, 4)}...${token.slice(-4)} (len=${token.length})`;
}

async function main() {
  const token = parseToken();
  if (token.length < 32) {
    console.error(`ERRO: token tem ${token.length} chars, mínimo 32`);
    process.exit(1);
  }

  console.log(`Token recebido: ${mascarar(token)}`);

  const cooperativa = await prisma.cooperativa.findUnique({
    where: { id: COOPEREBR_PRINCIPAL_ID },
    select: { id: true, nome: true, tipoParceiro: true },
  });

  if (!cooperativa) {
    console.error(`ERRO: cooperativa ${COOPEREBR_PRINCIPAL_ID} não encontrada`);
    process.exit(1);
  }

  if (cooperativa.nome !== 'CoopereBR' || cooperativa.tipoParceiro !== 'COOPERATIVA') {
    console.error(
      `ERRO: cooperativa ${COOPEREBR_PRINCIPAL_ID} não é a CoopereBR principal. ` +
        `Encontrado: nome="${cooperativa.nome}", tipo="${cooperativa.tipoParceiro}"`,
    );
    process.exit(1);
  }

  console.log(`Cooperativa alvo OK: ${cooperativa.nome} (tipo=${cooperativa.tipoParceiro})`);

  const asaasConfig = await prisma.asaasConfig.findUnique({
    where: { cooperativaId: cooperativa.id },
    select: {
      id: true,
      ambiente: true,
      webhookToken: true,
      updatedAt: true,
    },
  });

  if (!asaasConfig) {
    console.error(`ERRO: AsaasConfig não existe pra cooperativaId ${cooperativa.id}`);
    process.exit(1);
  }

  console.log(
    `AsaasConfig encontrado: id=${asaasConfig.id} ambiente=${asaasConfig.ambiente} ` +
      `webhookToken_anterior=${asaasConfig.webhookToken ? mascarar(asaasConfig.webhookToken) : 'NULL'}`,
  );

  if (asaasConfig.webhookToken === token) {
    console.log('Token já está setado com este valor exato — idempotência preservada.');
    await prisma.$disconnect();
    return;
  }

  const updated = await prisma.asaasConfig.update({
    where: { id: asaasConfig.id },
    data: { webhookToken: token },
    select: { id: true, updatedAt: true, webhookToken: true },
  });

  console.log('---');
  console.log('UPDATE concluído.');
  console.log({
    asaas_config_id: updated.id,
    cooperativa_id: cooperativa.id,
    cooperativa_nome: cooperativa.nome,
    webhook_token: mascarar(updated.webhookToken!),
    updated_at: updated.updatedAt.toISOString(),
  });

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('ERRO FATAL:', err.message ?? err);
  process.exit(1);
});
