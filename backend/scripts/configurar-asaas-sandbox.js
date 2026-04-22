/**
 * Configura Asaas Sandbox pra CoopereBR.
 *
 * Uso (PowerShell):
 *   $env:ASAAS_SANDBOX_KEY="sua_key"; node scripts/configurar-asaas-sandbox.js
 */

const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');

const COOPEREBR_ID = 'cmn0ho8bx0000uox8wu96u6fd';

function getEncryptKey() {
  const key = process.env.ASAAS_ENCRYPT_KEY;
  if (!key) throw new Error('ASAAS_ENCRYPT_KEY nao encontrada no .env');
  return crypto.createHash('sha256').update(key).digest();
}

function encrypt(text) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getEncryptKey(), iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString('hex'), encrypted.toString('hex'), tag.toString('hex')].join(':');
}

function maskKey(key) {
  if (!key || key.length <= 4) return '****';
  return '****' + key.slice(-4);
}

async function main() {
  const apiKey = process.env.ASAAS_SANDBOX_KEY;
  if (!apiKey) {
    console.error('Defina ASAAS_SANDBOX_KEY. Exemplo:');
    console.error('  $env:ASAAS_SANDBOX_KEY="sua_key"; node scripts/configurar-asaas-sandbox.js');
    process.exit(1);
  }

  console.log('\n=== Configurar Asaas Sandbox — CoopereBR ===\n');

  const p = new PrismaClient();

  // Salvar config criptografada
  const encrypted = encrypt(apiKey);
  await p.asaasConfig.upsert({
    where: { cooperativaId: COOPEREBR_ID },
    update: { apiKey: encrypted, ambiente: 'SANDBOX' },
    create: { cooperativaId: COOPEREBR_ID, apiKey: encrypted, ambiente: 'SANDBOX' },
  });
  console.log('Config salva (criptografada AES-256-GCM)');
  console.log('API key masked: ' + maskKey(apiKey));
  console.log('Ambiente: SANDBOX');

  // Testar conexao
  console.log('\nTestando conexao com Asaas Sandbox...');
  const axios = require('axios');
  try {
    const { data } = await axios.get('https://sandbox.asaas.com/api/v3/customers', {
      params: { limit: 1 },
      headers: { access_token: apiKey },
      timeout: 15000,
    });
    console.log('Conexao OK!');
    console.log('  Customers no Asaas sandbox: ' + (data.totalCount || 0));
  } catch (err) {
    console.error('Conexao FALHOU:', err.response?.data || err.message);
  }

  await p.$disconnect();
}

main().catch(err => { console.error(err.message); process.exit(1); });
