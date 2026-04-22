/**
 * Configura Asaas Sandbox pra CoopereBR.
 *
 * Uso:
 *   ASAAS_SANDBOX_KEY=sua_key npx ts-node scripts/configurar-asaas-sandbox.ts
 *
 * O que faz:
 *   1. Lê API key da env var ASAAS_SANDBOX_KEY
 *   2. Criptografa com ASAAS_ENCRYPT_KEY (do .env)
 *   3. Salva/atualiza AsaasConfig pra CoopereBR com ambiente=SANDBOX
 *   4. Testa conexão chamando GET /customers?limit=1
 *   5. Reporta resultado
 */

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { AsaasService } from '../src/asaas/asaas.service';

const COOPEREBR_ID = 'cmn0ho8bx0000uox8wu96u6fd';

function red(s: string) { return `\x1b[31m${s}\x1b[0m`; }
function green(s: string) { return `\x1b[32m${s}\x1b[0m`; }
function bold(s: string) { return `\x1b[1m${s}\x1b[0m`; }
function gray(s: string) { return `\x1b[90m${s}\x1b[0m`; }

async function main() {
  const apiKey = process.env.ASAAS_SANDBOX_KEY;
  if (!apiKey) {
    console.error(red('Defina ASAAS_SANDBOX_KEY na env. Exemplo:'));
    console.error(gray('  ASAAS_SANDBOX_KEY=sua_key npx ts-node scripts/configurar-asaas-sandbox.ts'));
    process.exit(1);
  }

  if (!process.env.ASAAS_ENCRYPT_KEY) {
    console.error(red('ASAAS_ENCRYPT_KEY não encontrada no .env. Necessária pra criptografar.'));
    process.exit(1);
  }

  console.log(bold('\n=== Configurar Asaas Sandbox — CoopereBR ===\n'));
  console.log(gray('Subindo contexto Nest...'));

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });
  const asaas = app.get(AsaasService);

  // 1. Salvar config
  console.log('Salvando API key (criptografada) com ambiente=SANDBOX...');
  await asaas.salvarConfig(COOPEREBR_ID, {
    apiKey,
    ambiente: 'SANDBOX',
  });
  console.log(green('Config salva.'));

  // 2. Verificar que foi salva criptografada
  const configMasked = await asaas.getConfigMasked(COOPEREBR_ID);
  console.log(`API key no banco (masked): ${configMasked?.apiKey}`);
  console.log(`Ambiente: ${configMasked?.ambiente}`);

  // 3. Testar conexão
  console.log('\nTestando conexão com Asaas Sandbox...');
  const teste = await asaas.testarConexao(COOPEREBR_ID);

  if (teste.ok) {
    console.log(green(bold('Conexão OK!')));
    console.log(gray(`  Customers no Asaas: ${teste.totalCustomers}`));
  } else {
    console.error(red('Conexão FALHOU:'));
    console.error(teste.erro);
  }

  await app.close();
  process.exit(teste.ok ? 0 : 1);
}

main().catch(err => {
  console.error(red(`Erro: ${err.message}`));
  process.exit(1);
});
