const res = await fetch('http://localhost:3000/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ identificador: 'superadmin@cooperebr.com.br', senha: 'SuperAdmin@2026' })
});
const data = await res.json();
console.log('Status:', res.status);
console.log('Resposta:', JSON.stringify(data, null, 2));
