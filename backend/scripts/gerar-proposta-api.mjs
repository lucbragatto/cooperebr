import https from 'https';
import http from 'http';

// 1. Login para pegar token
function req(url, method, body, token) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const urlObj = new URL(url);
    const opts = {
      hostname: urlObj.hostname,
      port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
      path: urlObj.pathname,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {})
      }
    };
    const r = (urlObj.protocol === 'https:' ? https : http).request(opts, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve(d); } });
    });
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}

const BASE = 'http://localhost:3000';

// Login
const login = await req(`${BASE}/auth/login`, 'POST', { identificador: 'teste@cooperebr.com', senha: 'admin123' });
console.log('Login:', login.access_token ? 'OK' : JSON.stringify(login));
const token = login.access_token;

// Buscar cooperado Marcio
const cooperados = await req(`${BASE}/cooperados`, 'GET', null, token);
const marcio = cooperados.find(c => c.nomeCompleto?.includes('MARCIO'));
console.log('Márcio:', marcio?.id, marcio?.nomeCompleto);

// Buscar plano prata
const planos = await req(`${BASE}/planos`, 'GET', null, token);
const planoPrata = planos.find(p => p.id === 'plano-prata');
console.log('Plano:', planoPrata?.id, planoPrata?.nome);

// Calcular proposta
const resultado = await req(`${BASE}/motor-proposta/calcular`, 'POST', {
  cooperadoId: marcio.id,
  planoId: planoPrata.id,
  ucId: marcio.ucs?.[0]?.id,
  consumoMedioKwh: 1757,
  historicoConsumo: [
    { mesAno: 'Fev/25', consumoKwh: 2615, valorRS: 0 },
    { mesAno: 'Mar/25', consumoKwh: 2161, valorRS: 0 },
    { mesAno: 'Abr/25', consumoKwh: 2268, valorRS: 0 },
    { mesAno: 'Mai/25', consumoKwh: 1399, valorRS: 0 },
    { mesAno: 'Jun/25', consumoKwh: 1102, valorRS: 0 },
    { mesAno: 'Jul/25', consumoKwh: 1109, valorRS: 0 },
    { mesAno: 'Ago/25', consumoKwh: 1508, valorRS: 0 },
    { mesAno: 'Set/25', consumoKwh: 1503, valorRS: 0 },
    { mesAno: 'Out/25', consumoKwh: 1656, valorRS: 0 },
    { mesAno: 'Nov/25', consumoKwh: 1736, valorRS: 0 },
    { mesAno: 'Dez/25', consumoKwh: 1807, valorRS: 0 },
    { mesAno: 'Jan/26', consumoKwh: 2219, valorRS: 0 },
  ],
  kwhMesRecente: 1848,
  valorMesRecente: 1920.61,
  tipoFornecimento: 'TRIFASICO',
}, token);

console.log('Proposta:', JSON.stringify(resultado, null, 2));
