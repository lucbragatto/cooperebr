// 1. Login
const loginRes = await fetch('http://localhost:3000/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ identificador: 'superadmin@cooperebr.com.br', senha: 'SuperAdmin@2026' })
});
const { token } = await loginRes.json();
console.log('Login status:', loginRes.status, token ? '✅ Token OK' : '❌ Sem token');

const headers = { Authorization: `Bearer ${token}` };

// 2. Testar /auth/me
const meRes = await fetch('http://localhost:3000/auth/me', { headers });
const me = await meRes.json();
console.log('\n/auth/me status:', meRes.status, meRes.ok ? '✅' : '❌');
console.log('Perfil:', me.perfil);

// 3. Testar /cooperados
const coopRes = await fetch('http://localhost:3000/cooperados?limit=1', { headers });
console.log('\n/cooperados status:', coopRes.status, coopRes.ok ? '✅' : '❌');

// 4. Testar dashboard stats
const dashRes = await fetch('http://localhost:3000/motor-proposta/dashboard-stats', { headers });
console.log('/dashboard-stats status:', dashRes.status, dashRes.ok ? '✅' : '❌');
if (!dashRes.ok) console.log('Erro:', await dashRes.text());
