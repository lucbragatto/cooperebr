// Smoke E2E do funil — Frente 2 vitrines mínimas (01/07/2026).
// Valida que POST /publico/cadastro-web com jaRecebeCreditosGd=true +
// fornecedorGdAtual leva o motor roteador M48 a classificar como
// A_MIGRACAO ou AMBIGUO_ADMIN.
//
// Executar: node backend/scripts/smoke-funil-frente2.mjs

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const BACKEND = 'http://localhost:3000';

async function main() {
  const coop = await prisma.cooperativa.findFirst({
    where: { ativo: true },
    select: { id: true, nome: true },
    orderBy: { createdAt: 'asc' },
  });
  if (!coop) throw new Error('nenhuma cooperativa ativa no banco');
  console.log(`[SMOKE] tenant=${coop.nome} (${coop.id})`);

  const cpfSmoke = String(Date.now()).slice(-11).padStart(11, '9');
  const emailSmoke = `lucbragatto+smoke${Date.now()}@gmail.com`;
  const payload = {
    nome: 'Smoke Frente 2 Funil',
    cpf: cpfSmoke,
    email: emailSmoke,
    telefone: '27981341348',
    endereco: {
      cep: '29100000', logradouro: 'R Smoke', numero: '1',
      bairro: 'Centro', cidade: 'Vitoria', estado: 'ES',
    },
    instalacao: {
      // Canônico 6-11 dígitos — usa timestamp encurtado pra ficar único.
      numeroUC: String(Date.now()).slice(-10),
      distribuidora: 'EDP_ES',
      consumoMedioKwh: 320,
    },
    temCreditosInjetados: true,
    jaRecebeCreditosGd: true,
    fornecedorGdAtual: 'Cooperativa Solar Verde',
    dadosOcr: { energiaInjetadaKwh: 200, saldoCreditosKwh: 500, valorCompensadoReais: 180 },
  };

  const url = `${BACKEND}/publico/cadastro-web?tenant=${coop.id}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  console.log(`[SMOKE] HTTP ${res.status} — ${JSON.stringify(data).slice(0, 200)}`);

  if (!res.ok) {
    console.log('[SMOKE] BAD status — abort');
    process.exit(1);
  }

  const cooperadoId = data?.data?.cooperadoId;
  if (!cooperadoId) throw new Error('sem cooperadoId no retorno');

  // Aguarda micro-ticks pra fire-and-forget da notificação.
  await new Promise((r) => setTimeout(r, 500));

  const cooperado = await prisma.cooperado.findUnique({
    where: { id: cooperadoId },
    select: {
      id: true, nomeCompleto: true, cooperativaId: true,
      roteamentoCaminho: true, roteamentoRazao: true, roteamentoTenantAlvo: true,
      jaRecebeCreditosGd: true, fornecedorGdAtual: true,
      consumoStashOcr: true,
      // Frente Jornada (01/07/2026) — canalCadastro deve vir CADASTRO_PUBLICO
      // no fluxo cadastroWebV2 (tela pública com créditos injetados).
      canalCadastro: true,
    },
  });

  console.log('[SMOKE] Cooperado gravado:');
  console.log(JSON.stringify(cooperado, null, 2));

  const oks = [];
  const nao = [];
  const assert = (cond, msg) => (cond ? oks : nao).push(msg);

  assert(cooperado?.jaRecebeCreditosGd === true, 'jaRecebeCreditosGd=true persistido');
  assert(cooperado?.fornecedorGdAtual === 'Cooperativa Solar Verde', 'fornecedorGdAtual persistido');
  assert(!!cooperado?.roteamentoCaminho, 'roteamentoCaminho gravado');
  assert(
    cooperado?.roteamentoCaminho === 'A_MIGRACAO' || cooperado?.roteamentoCaminho === 'AMBIGUO_ADMIN',
    `roteamentoCaminho ∈ {A_MIGRACAO, AMBIGUO_ADMIN} (foi: ${cooperado?.roteamentoCaminho})`,
  );
  assert(!!cooperado?.roteamentoRazao, 'roteamentoRazao populado');
  assert(!!cooperado?.consumoStashOcr, 'consumoStashOcr populado (dadosOcr no payload)');
  assert(
    cooperado?.canalCadastro === 'CADASTRO_PUBLICO',
    `canalCadastro=CADASTRO_PUBLICO (foi: ${cooperado?.canalCadastro})`,
  );

  console.log(`\n[SMOKE] OK (${oks.length}):`);
  oks.forEach((m) => console.log(`  ✅ ${m}`));
  if (nao.length) {
    console.log(`\n[SMOKE] FALHOU (${nao.length}):`);
    nao.forEach((m) => console.log(`  ❌ ${m}`));
    process.exit(1);
  }

  // Cleanup — não deixar smoke sujar o banco. Deletar UCs primeiro (FK).
  await prisma.uc.deleteMany({ where: { cooperadoId } });
  await prisma.cooperado.delete({ where: { id: cooperadoId } });
  console.log('\n[SMOKE] cleanup: UCs + cooperado deletados');
}

main()
  .catch((err) => {
    console.error('[SMOKE] erro:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
