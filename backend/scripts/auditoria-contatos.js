const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function classificarTelefone(tel) {
  if (!tel) return 'SEM_TEL';
  const digits = tel.replace(/\D/g, '');
  // Padrões fake óbvios
  if (/^55\d{2}(9{9}|8{9}|7{9}|1{9}|0{9})$/.test(digits)) return 'FAKE_REPETIDO';
  if (/^55\d{2}90000/.test(digits)) return 'FAKE_SEED';
  if (/^55\d{2}99999/.test(digits)) return 'FAKE_9x5';
  if (/^55\d{2}88888/.test(digits)) return 'FAKE_8x5';
  if (/123456789/.test(digits)) return 'FAKE_SEQ';
  if (/000000/.test(digits)) return 'FAKE_ZEROS';
  if (/^55\d{2}97/.test(digits) || /^55\d{2}98/.test(digits) || /^55\d{2}99[^9]/.test(digits)) return 'POSSIVEL_REAL';
  return 'SUSPEITO';
}

function classificarEmail(email) {
  if (!email) return 'SEM_EMAIL';
  const lower = email.toLowerCase();
  if (lower.includes('@test') || lower.includes('@exemplo') || lower.includes('@example')) return 'FAKE_DOMINIO';
  if (lower.includes('@removido') || lower.includes('@invalid') || lower.includes('@seed')) return 'FAKE_DOMINIO';
  if (lower.includes('@hangar') || lower.includes('@moradas') || lower.includes('@enseada')) return 'FAKE_SEED';
  if (/aluno\d+@|prof\d+@|condomino\d+@|apto\d+@/.test(lower)) return 'FAKE_PADRAO';
  if (lower.endsWith('@gmail.com') || lower.endsWith('@hotmail.com') || lower.endsWith('@outlook.com') || lower.endsWith('@yahoo.com.br') || lower.endsWith('@cooperebr.com.br')) return 'POSSIVEL_REAL';
  return 'SUSPEITO';
}

function origem(coop) {
  const nome = (coop.nomeCompleto || '').toUpperCase();
  const cpf = coop.cpf || '';
  if (cpf.startsWith('7000000') || cpf.startsWith('70000001')) return 'SEED_HANGAR_PROF';
  if (cpf.startsWith('8000000') || cpf.startsWith('80000001')) return 'SEED_HANGAR_ALUNO';
  if (cpf.startsWith('9000000')) return 'SEED_MORADAS';
  if (cpf === '36324580000110' || nome.includes('HANGAR')) return 'SEED_HANGAR_CONV';
  if (nome.includes('MORADAS') || nome.includes('ENSEADA')) return 'SEED_MORADAS_CONV';
  if (cpf === '11122233396' || cpf === '22233344405' || cpf === '52998224725') return 'TESTE_SPRINT';
  return 'POTENCIAL_REAL';
}

async function main() {
  const cooperados = await prisma.cooperado.findMany({
    select: {
      id: true,
      nomeCompleto: true,
      cpf: true,
      telefone: true,
      email: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  console.log(`\nTotal cooperados: ${cooperados.length}\n`);

  const buckets = {
    SEED_HANGAR_CONV: [],
    SEED_HANGAR_PROF: [],
    SEED_HANGAR_ALUNO: [],
    SEED_MORADAS_CONV: [],
    SEED_MORADAS: [],
    TESTE_SPRINT: [],
    POTENCIAL_REAL: [],
  };

  for (const c of cooperados) {
    const o = origem(c);
    const t = classificarTelefone(c.telefone);
    const e = classificarEmail(c.email);
    buckets[o].push({ ...c, t, e });
  }

  // Resumo por origem
  console.log('=== RESUMO POR ORIGEM ===');
  for (const [k, v] of Object.entries(buckets)) {
    console.log(`${k}: ${v.length}`);
  }

  // Estatistica de telefones/emails por bucket
  console.log('\n=== CLASSIFICACAO TEL/EMAIL POR ORIGEM ===');
  for (const [k, v] of Object.entries(buckets)) {
    if (v.length === 0) continue;
    const tels = {}, emails = {};
    for (const c of v) {
      tels[c.t] = (tels[c.t] || 0) + 1;
      emails[c.e] = (emails[c.e] || 0) + 1;
    }
    console.log(`\n[${k}] (${v.length})`);
    console.log('  TEL:', JSON.stringify(tels));
    console.log('  EMAIL:', JSON.stringify(emails));
  }

  // Listar todos POTENCIAL_REAL (os perigosos)
  console.log('\n=== POTENCIAL_REAL — DETALHE ===');
  for (const c of buckets.POTENCIAL_REAL) {
    console.log(`- [${c.t}/${c.e}] ${c.nomeCompleto} | cpf=${c.cpf} | tel=${c.telefone || '-'} | email=${c.email || '-'} | ${c.createdAt.toISOString().slice(0,10)}`);
  }

  // Listar POSSIVEL_REAL dentro dos seeds (perigo disfarçado)
  console.log('\n=== SEED MAS COM TEL OU EMAIL POSSIVEL_REAL ===');
  for (const [k, v] of Object.entries(buckets)) {
    if (k === 'POTENCIAL_REAL' || k === 'TESTE_SPRINT') continue;
    for (const c of v) {
      if (c.t === 'POSSIVEL_REAL' || c.e === 'POSSIVEL_REAL') {
        console.log(`- [${k}] [${c.t}/${c.e}] ${c.nomeCompleto} | tel=${c.telefone || '-'} | email=${c.email || '-'}`);
      }
    }
  }

  // Totais agregados
  const garantidamenteFake = Object.entries(buckets)
    .filter(([k]) => k.startsWith('SEED_') || k === 'TESTE_SPRINT')
    .reduce((acc, [, v]) => acc + v.filter(c => (c.t !== 'POSSIVEL_REAL' && c.e !== 'POSSIVEL_REAL')).length, 0);
  const suspeitosMistos = Object.entries(buckets)
    .filter(([k]) => k.startsWith('SEED_') || k === 'TESTE_SPRINT')
    .reduce((acc, [, v]) => acc + v.filter(c => (c.t === 'POSSIVEL_REAL' || c.e === 'POSSIVEL_REAL')).length, 0);
  const potenciaisReais = buckets.POTENCIAL_REAL.length;

  console.log('\n=== TOTAIS ===');
  console.log(`Garantidamente FAKE: ${garantidamenteFake}`);
  console.log(`SUSPEITOS/MISTOS (seed com tel/email real): ${suspeitosMistos}`);
  console.log(`POTENCIALMENTE REAIS (fora do seed): ${potenciaisReais}`);

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
