/**
 * Sub-Sprint Gateways de Pagamento Fatia F2 Etapa D (M29, 2026-05-26).
 *
 * Migra registros pré-existentes de AsaasConfig pro espelho em
 * ConfigGateway. A partir da Etapa C, novos saves passam pelo dual-write
 * automaticamente — este script só preenche o gap dos registros antigos.
 *
 * Execução:
 *   - DRY-RUN (default, seguro):
 *       npx ts-node backend/scripts/migrate-asaas-to-config-gateway.ts
 *   - APPLY (escreve no banco, exige --apply explícito):
 *       npx ts-node backend/scripts/migrate-asaas-to-config-gateway.ts --apply
 *
 * Idempotente: rodar 2x não duplica. UPDATE quando ConfigGateway já existe
 * (atualiza credenciaisCriptografadas + metadados), CREATE caso contrário.
 *
 * Multi-tenant: por cooperativaId. Cada registro AsaasConfig (1 por
 * cooperativa devido a @unique cooperativaId no model) migra para 1
 * ConfigGateway (chave composta cooperativaId+gateway=ASAAS).
 *
 * NUNCA expõe valores em log:
 *   - apiKey: mostra apenas sufixo 4 chars (mascarado pra confirmação visual)
 */
import { PrismaClient } from '@prisma/client';
import * as crypto from 'node:crypto';

const isApply = process.argv.includes('--apply');

// ─── Decryption ASAAS (chave legada via SHA-256 wrapping) ───────────

function getAsaasKey(): Buffer {
  const key = process.env.ASAAS_ENCRYPT_KEY;
  if (!key) throw new Error('ASAAS_ENCRYPT_KEY ausente no .env');
  return crypto.createHash('sha256').update(key).digest();
}

function decryptAsaas(ciphertext: string): string {
  const parts = ciphertext.split(':');
  if (parts.length !== 3) return ciphertext; // legado plain text fallback
  const [ivHex, encHex, tagHex] = parts;
  try {
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      getAsaasKey(),
      Buffer.from(ivHex, 'hex'),
    );
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
    return (decipher.update(Buffer.from(encHex, 'hex')) + decipher.final('utf8')) as string;
  } catch {
    return ciphertext;
  }
}

// ─── Encryption Gateway (chave forte AES-256-GCM puro) ──────────────

function getGatewayKey(): Buffer {
  const raw = process.env.GATEWAY_ENCRYPT_KEY;
  if (!raw) throw new Error('GATEWAY_ENCRYPT_KEY ausente no .env');
  const buf = Buffer.from(raw, 'base64');
  if (buf.length !== 32) throw new Error(`GATEWAY_ENCRYPT_KEY deve ter 32 bytes (got ${buf.length})`);
  return buf;
}

function encryptGateway(plaintext: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getGatewayKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    iv.toString('base64'),
    encrypted.toString('base64'),
    tag.toString('base64'),
  ].join(':');
}

// ─── Mask helper ─────────────────────────────────────────────────────

function mask(s: string): string {
  if (!s || s.length <= 4) return '****';
  return '****' + s.slice(-4);
}

// ─── Main ────────────────────────────────────────────────────────────

async function main() {
  const prisma = new PrismaClient();

  console.log('═══════════════════════════════════════════════════════════════════');
  console.log(`📦 Migration AsaasConfig → ConfigGateway (F2 Etapa D)`);
  console.log(`   Modo: ${isApply ? '🚨 APPLY (escreve no banco)' : '🔍 DRY-RUN (somente leitura)'}`);
  console.log('═══════════════════════════════════════════════════════════════════\n');

  const asaasConfigs = await prisma.asaasConfig.findMany({
    orderBy: { createdAt: 'asc' },
  });

  console.log(`Encontrados ${asaasConfigs.length} registro(s) em AsaasConfig.\n`);

  let criados = 0;
  let atualizados = 0;
  let inalterados = 0;
  let pulados = 0;

  for (const cfg of asaasConfigs) {
    const cooperativa = await prisma.cooperativa.findUnique({
      where: { id: cfg.cooperativaId },
      select: { nome: true },
    });

    console.log(`──── Cooperativa: ${cooperativa?.nome ?? '(?)'} (id=${cfg.cooperativaId})`);

    let plainApiKey: string;
    try {
      plainApiKey = decryptAsaas(cfg.apiKey);
      if (plainApiKey === cfg.apiKey) {
        console.log(`  ⚠️  apiKey nao decifrou (formato invalido?) — PULANDO este registro pra investigacao`);
        pulados++;
        continue;
      }
    } catch (err) {
      console.log(`  ❌ ERRO ao decifrar apiKey: ${(err as Error).message}`);
      pulados++;
      continue;
    }

    const apiKeyMasked = mask(plainApiKey);
    console.log(`  apiKey atual (sufixo): ${mask(cfg.apiKey)} (390 chars ciphertext)`);
    console.log(`  apiKey decryptada (sufixo): ${apiKeyMasked}`);

    // Verifica se ConfigGateway já existe pro tenant + ASAAS
    const existing = await prisma.configGateway.findUnique({
      where: {
        cooperativaId_gateway: { cooperativaId: cfg.cooperativaId, gateway: 'ASAAS' },
      },
    });

    const credenciaisCriptografadas = {
      apiKey: encryptGateway(plainApiKey),
    };
    const metadados = {
      apiKeyMasked,
      webhookTokenDefinido: !!cfg.webhookToken,
      atualizadoEm: new Date().toISOString(),
      origem: 'migrate-asaas-to-config-gateway-script',
      migradoEm: new Date().toISOString(),
    };

    if (existing) {
      const existingMasked = (existing.metadados as any)?.apiKeyMasked;
      console.log(`  ConfigGateway ASAAS ja existe (id=${existing.id}, apiKeyMasked=${existingMasked ?? '(vazio)'})`);
      console.log(`  → ${isApply ? 'UPDATE' : 'UPDATE (dry-run)'} credenciaisCriptografadas + metadados`);
      if (isApply) {
        await prisma.configGateway.update({
          where: { id: existing.id },
          data: {
            ambiente: cfg.ambiente,
            credenciaisCriptografadas,
            metadados,
            webhookToken: cfg.webhookToken ?? null,
            ativo: true,
          },
        });
      }
      atualizados++;
    } else {
      console.log(`  ConfigGateway ASAAS nao existe pra este tenant`);
      console.log(`  → ${isApply ? 'CREATE' : 'CREATE (dry-run)'} novo registro ConfigGateway gateway=ASAAS ambiente=${cfg.ambiente}`);
      if (isApply) {
        await prisma.configGateway.create({
          data: {
            cooperativaId: cfg.cooperativaId,
            gateway: 'ASAAS',
            ambiente: cfg.ambiente,
            credenciaisCriptografadas,
            metadados,
            webhookToken: cfg.webhookToken ?? null,
            ativo: true,
          },
        });
      }
      criados++;
    }

    // Limpar plaintext da memoria
    plainApiKey = '';
    console.log('');
  }

  console.log('═══════════════════════════════════════════════════════════════════');
  console.log(`Resumo ${isApply ? '(APLICADO)' : '(DRY-RUN — nada gravado)'}:`);
  console.log(`  ${criados} CREATE`);
  console.log(`  ${atualizados} UPDATE`);
  console.log(`  ${inalterados} INALTERADOS`);
  console.log(`  ${pulados} PULADOS (erro decrypt)`);
  console.log('═══════════════════════════════════════════════════════════════════');

  if (!isApply) {
    console.log('\n🔍 Foi DRY-RUN. Pra aplicar de fato, rode com --apply:');
    console.log('     npx ts-node backend/scripts/migrate-asaas-to-config-gateway.ts --apply\n');
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error('Falha:', e);
  process.exit(1);
});
