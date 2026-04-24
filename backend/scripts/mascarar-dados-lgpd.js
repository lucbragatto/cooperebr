const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const LUCIANO_CPF = '89089324704';
const LUCIANO_EMAIL_LOWER = 'lucbragatto@gmail.com';

function isSeedFake(cpf, email) {
  if (!cpf) return false;
  if (cpf.startsWith('7000000') || cpf.startsWith('70000001')) return true; // profs
  if (cpf.startsWith('8000000') || cpf.startsWith('80000001')) return true; // alunos
  if (cpf.startsWith('9000000')) return true; // moradas
  if (cpf === '36324580000110') return true; // hangar LTDA
  if (cpf === '11122233396' || cpf === '22233344405' || cpf === '52998224725') return true; // sprint
  if (cpf === '05521718000147') return true; // moradas cond (se houver)
  if ((email || '').toLowerCase().includes('.teste.coopere.br')) return true;
  return false;
}

function isJaMascarado(email, telefone) {
  if (!email && !telefone) return false;
  const e = (email || '').toLowerCase();
  const t = telefone || '';
  return e.includes('@removido.invalid') || t.startsWith('INATIVO-') || (email || '') === '';
}

function construirEmailMascarado(emailAntigo, id) {
  const sufixo = id.slice(-6);
  if (!emailAntigo) return `anon-${sufixo}-removido@removido.invalid`;
  const lower = emailAntigo.toLowerCase();
  const local = lower.split('@')[0];
  const seguro = local.replace(/[^a-z0-9._-]/g, '').slice(0, 30);
  return `${seguro || 'anon'}-${sufixo}-removido@removido.invalid`;
}

async function main() {
  const cooperados = await prisma.cooperado.findMany({
    select: { id: true, cpf: true, telefone: true, email: true },
  });

  let total = cooperados.length;
  let preservados = 0;
  let ignoradosSeed = 0;
  let ignoradosJaMasc = 0;
  let aMascarar = [];

  for (const c of cooperados) {
    if (c.cpf === LUCIANO_CPF) { preservados++; continue; }
    if ((c.email || '').toLowerCase() === LUCIANO_EMAIL_LOWER) { preservados++; continue; }
    if (isSeedFake(c.cpf, c.email)) { ignoradosSeed++; continue; }
    if (isJaMascarado(c.email, c.telefone)) { ignoradosJaMasc++; continue; }
    aMascarar.push(c);
  }

  console.log(`Total cooperados: ${total}`);
  console.log(`Preservados (Luciano): ${preservados}`);
  console.log(`Ignorados (seed fake): ${ignoradosSeed}`);
  console.log(`Ignorados (ja mascarado): ${ignoradosJaMasc}`);
  console.log(`A mascarar: ${aMascarar.length}`);

  if (process.argv[2] !== '--execute') {
    console.log('\nDry-run. Passar --execute pra aplicar.');
    await prisma.$disconnect();
    return;
  }

  let atualizados = 0;
  for (const c of aMascarar) {
    const novoEmail = construirEmailMascarado(c.email, c.id);
    await prisma.cooperado.update({
      where: { id: c.id },
      data: {
        telefone: '+5511000000000',
        email: novoEmail,
      },
    });
    atualizados++;
  }

  console.log(`\nMascarados: ${atualizados}`);
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
