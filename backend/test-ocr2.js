const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:3000';
const BASE64_FILE = path.join(__dirname, 'fatura-real-base64.txt');

async function main() {
  // 1. Login
  console.log('1. Fazendo login...');
  const loginResp = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identificador: 'teste@cooperebr.com', senha: 'Coopere@123' }),
  });

  const loginData = await loginResp.json();
  console.log(`   Status: ${loginResp.status}`);

  if (!loginResp.ok) {
    console.error('   Erro no login:', JSON.stringify(loginData, null, 2));
    process.exit(1);
  }

  const token = loginData.token;
  console.log(`   Token obtido: ${token.substring(0, 40)}...\n`);

  // 2. Ler base64
  console.log('2. Lendo fatura-real-base64.txt...');
  const arquivoBase64 = fs.readFileSync(BASE64_FILE, 'utf-8').trim();
  console.log(`   ${arquivoBase64.length} chars carregados\n`);

  // 3. Processar fatura
  console.log('3. Enviando para POST /faturas/processar...');
  console.log('   (aguardando Claude analisar a fatura...)\n');

  const faturaTick = Date.now();
  const faturaResp = await fetch(`${BASE_URL}/faturas/processar`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      cooperadoId: 'cmmnf5dl10000uo70ta9698mi', // João Santos da Silva
      tipoArquivo: 'pdf',
      arquivoBase64,
    }),
  });

  const faturaData = await faturaResp.json();
  const elapsed = ((Date.now() - faturaTick) / 1000).toFixed(1);

  console.log(`Status HTTP: ${faturaResp.status} (${elapsed}s)`);
  console.log('\n=== RESPOSTA ===\n');
  console.log(JSON.stringify(faturaData, null, 2));
}

main().catch((err) => {
  console.error('Erro fatal:', err.message);
  process.exit(1);
});
