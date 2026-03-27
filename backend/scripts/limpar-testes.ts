import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();

async function main() {
  const todos = await p.cooperado.findMany({
    select: { id: true, nomeCompleto: true, telefone: true, email: true }
  });

  const testes = todos.filter(c =>
    (c.email ?? '').toLowerCase().includes('teste') ||
    (c.email ?? '').toLowerCase().includes('@test.') ||
    (c.email ?? '').toLowerCase().includes('sisgdsolar') ||
    (c.nomeCompleto ?? '').toLowerCase().startsWith('teste auto')
  );

  console.log(`Cooperados de teste: ${testes.length}`);
  testes.forEach(c => console.log(`  - ${c.nomeCompleto} | ${c.telefone} | ${c.email}`));
  if (testes.length === 0) { console.log('Banco já limpo.'); return; }

  const ids = testes.map(c => c.id);
  const tels = testes.map(c => c.telefone ?? '');

  // Cascata completa
  await p.cobranca.deleteMany({ where: { contrato: { cooperadoId: { in: ids } } } });
  await p.contrato.deleteMany({ where: { cooperadoId: { in: ids } } });
  // UCs vinculadas via contrato — contratos já deletados, UCs ficam órfãs mas ok
  await p.mensagemWhatsapp.deleteMany({ where: { telefone: { in: tels } } });
  await p.conversaWhatsapp.deleteMany({ where: { telefone: { in: tels } } });
  await p.cooperado.deleteMany({ where: { id: { in: ids } } });

  console.log(`\n✅ ${ids.length} cooperados de teste removidos.`);
}

main().then(() => p.$disconnect()).catch(e => { console.error('ERRO:', e.message); p.$disconnect(); });
