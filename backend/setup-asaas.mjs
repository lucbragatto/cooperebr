import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();

// Buscar cooperativa principal (CoopereBR)
const cooperativas = await p.cooperativa.findMany({ select: { id: true, nome: true } });
console.log('Cooperativas:', cooperativas.map(c => `${c.nome} (${c.id})`).join('\n'));

// Configurar Asaas para a CoopereBR principal
const COOPEREBR_ID = 'cmn0ho8bx0000uox8wu96u6fd';
const API_KEY = '$aact_hmlg_000MzkwODA2MWY2OGM3MWRlMDU2NWM3MzJlNzZmNGZhZGY6OjdjMjI4NmQ2LTJkMTktNGJlNS05ZjMwLWJjMzM3ZGNlOWZkMDo6JGFhY2hfODgzZDAyZGQtZDgyYi00NWUxLWFmYTYtMDdhNDUwZmVjZGM0';

const existing = await p.asaasConfig.findUnique({ where: { cooperativaId: COOPEREBR_ID } });

if (existing) {
  await p.asaasConfig.update({
    where: { cooperativaId: COOPEREBR_ID },
    data: { apiKey: API_KEY, ambiente: 'SANDBOX' }
  });
  console.log('\n✅ Asaas atualizado para CoopereBR (SANDBOX)');
} else {
  await p.asaasConfig.create({
    data: { cooperativaId: COOPEREBR_ID, apiKey: API_KEY, ambiente: 'SANDBOX' }
  });
  console.log('\n✅ Asaas configurado para CoopereBR (SANDBOX)');
}

// Testar a conexão
const res = await fetch('https://sandbox.asaas.com/api/v3/customers?limit=1', {
  headers: { access_token: API_KEY }
});
console.log('Status Asaas API:', res.status, res.ok ? '✅ Conectado!' : '❌ Erro');
if (res.ok) {
  const data = await res.json();
  console.log('Resposta:', JSON.stringify(data, null, 2));
}

await p.$disconnect();
