// Login
const loginRes = await fetch('http://localhost:3000/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ identificador: 'teste@cooperebr.com', senha: 'Coopere@123' })
});
const { token } = await loginRes.json();
console.log('Login OK');

// Buscar usinas
const usinasRes = await fetch('http://localhost:3000/usinas', {
  headers: { Authorization: `Bearer ${token}` }
});
const usinas = await usinasRes.json();
console.log(`\nUsinas encontradas: ${usinas.length}`);

// Chamar verificar-espera em cada usina
for (const usina of usinas) {
  console.log(`\nVerificando fila para: ${usina.nome} (${usina.potenciaKwp} kWp)`);
  const res = await fetch(`http://localhost:3000/usinas/${usina.id}/verificar-espera`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
  });
  if (res.ok) {
    const result = await res.json();
    console.log('Resultado:', JSON.stringify(result, null, 2));
  } else {
    console.log('Status:', res.status, await res.text());
  }
}
