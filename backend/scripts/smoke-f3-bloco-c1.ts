/**
 * Smoke E2E — Sprint Clube P1 F3 Bloco A+B+C+C.1 (12/06/2026).
 *
 * Valida end-to-end o caminho empresa-PJ distribui tokens pra funcionarios
 * (MEMBRO_ATIVO do convenio) via HTTP contra backend :3000.
 *
 * AMAGES = empresa cooperada PJ (ambienteTeste=true), PIN '123456' do
 * smoke F4. Convenio criado dentro do smoke (idempotente) + 2 funcionarios
 * (João, Ana) viram MEMBRO_ATIVO.
 *
 * Cenarios:
 *  (a) PIN AMAGES já configurado (do smoke F4) — confirma
 *  (b) Golden path: 2 destinatarios + quantidades diferentes → CONFIRM →
 *      verifica saldo empresa debitado 1×, ledger DISTRIBUICAO_CONVENIO
 *      em 2 lados, TokenTransacao natureza gravada
 *  (c) Retry com MESMO clientRequestId → idempotente:true
 *  (d) VOLUNTARIA sem empresaDeclaraTetoClt → 400
 *  (e) Ledger funcionario mostra DISTRIBUICAO_CONVENIO (não DOACAO)
 */
import { PrismaClient } from '@prisma/client';
import * as crypto from 'node:crypto';
import * as jwt from 'jsonwebtoken';

const API = process.env.API ?? 'http://localhost:3000';
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error('JWT_SECRET nao encontrado no .env — abort');
  process.exit(1);
}

const AMAGES_ID = 'cmp7034d70002vaf0af5ws4ud';
const COOPEREBR_ID = 'cmn0ho8bx0000uox8wu96u6fd';
const FUNC1_ID = 'cmmnf5dl10000uo70ta9698mi'; // João Santos
const FUNC2_ID = 'cmmnf5don0001uo70hfy8h4rb'; // Ana Oliveira
const SUB_USUARIO_ID = 'cmq6qo5c40005va2w8gyyzzj7'; // Santi (qualquer cooperado da CoopereBR)
const PIN_TESTE = '123456';

const prisma = new PrismaClient();

let passCount = 0;
let failCount = 0;
const failures: string[] = [];

function pass(msg: string) {
  console.log(`  ✓ ${msg}`);
  passCount++;
}
function fail(msg: string) {
  console.log(`  ✗ ${msg}`);
  failures.push(msg);
  failCount++;
}

async function call(
  method: string,
  path: string,
  opts: { token?: string; body?: any } = {},
): Promise<{ status: number; json: any }> {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const text = await res.text();
  let json: any;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  return { status: res.status, json };
}

function gerarJwtAMAGES(): string {
  return jwt.sign(
    {
      sub: SUB_USUARIO_ID,
      email: 'lucbragatto+amages@gmail.com',
      perfil: 'COOPERADO',
      cooperadoId: AMAGES_ID,
      cooperativaId: COOPEREBR_ID,
    },
    JWT_SECRET!,
    { expiresIn: '1h' },
  );
}

function hashPin(pin: string, salt: string): string {
  return crypto.createHash('sha256').update(pin + salt).digest('hex');
}

async function setupConvenio(): Promise<string> {
  // Idempotente: se já existe convênio onde AMAGES é conveniada, reusa.
  let convenio = await prisma.contratoConvenio.findFirst({
    where: { conveniadoId: AMAGES_ID, cooperativaId: COOPEREBR_ID },
    select: { id: true, numero: true },
  });
  if (!convenio) {
    convenio = await prisma.contratoConvenio.create({
      data: {
        numero: 'SMOKE-F3-AMAGES-' + Date.now().toString(36),
        empresaNome: 'AMAGES Smoke F3',
        empresaCnpj: '27053685000190',
        status: 'ATIVO',
        cooperativaId: COOPEREBR_ID,
        conveniadoId: AMAGES_ID,
        tipoDesconto: 'PERCENTUAL',
        diaEnvioRelatorio: 5,
        diaDesconto: 1,
        tipo: 'OUTRO',
        configBeneficio: {},
      } as any,
      select: { id: true, numero: true },
    });
    console.log(`  Convênio CRIADO: ${convenio.id} (${convenio.numero})`);
  } else {
    console.log(`  Convênio existente: ${convenio.id} (${convenio.numero})`);
  }
  return convenio.id;
}

async function setupMembros(convenioId: string) {
  // Adiciona João + Ana como MEMBRO_ATIVO (idempotente).
  for (const cooperadoId of [FUNC1_ID, FUNC2_ID]) {
    await prisma.convenioCooperado.upsert({
      where: { convenioId_cooperadoId: { convenioId, cooperadoId } },
      create: {
        convenioId,
        cooperadoId,
        ativo: true,
        status: 'MEMBRO_ATIVO',
      },
      update: { ativo: true, status: 'MEMBRO_ATIVO' },
    });
  }
  console.log(`  Membros MEMBRO_ATIVO: João, Ana`);
}

async function setupSaldoAMAGES(quantidade: number) {
  await prisma.cooperTokenSaldo.upsert({
    where: { cooperadoId: AMAGES_ID },
    create: {
      cooperadoId: AMAGES_ID,
      cooperativaId: COOPEREBR_ID,
      saldoDisponivel: quantidade,
      totalEmitido: quantidade,
    },
    update: { saldoDisponivel: quantidade },
  });
  console.log(`  Saldo AMAGES = ${quantidade} tokens`);
}

async function ensurePinAMAGES() {
  const c = await prisma.cooperado.findUnique({
    where: { id: AMAGES_ID },
    select: { pinHash: true, pinSalt: true },
  });
  if (c?.pinHash && c?.pinSalt) {
    const hashEsperado = hashPin(PIN_TESTE, c.pinSalt);
    if (hashEsperado === c.pinHash) {
      console.log(`  PIN AMAGES já configurado e válido (smoke F4 anterior)`);
      // Reset tentativas + lockout só pra garantir.
      await prisma.cooperado.update({
        where: { id: AMAGES_ID },
        data: { pinTentativas: 0, pinBloqueadoAte: null, limiteTokenTransacao: 500, limiteTokenDiario: 5000 },
      });
      return;
    }
  }
  // Define do zero.
  const salt = crypto.randomBytes(16).toString('hex');
  await prisma.cooperado.update({
    where: { id: AMAGES_ID },
    data: {
      pinHash: hashPin(PIN_TESTE, salt),
      pinSalt: salt,
      pinTentativas: 0,
      pinBloqueadoAte: null,
      pinDefinidoEm: new Date(),
      limiteTokenTransacao: 500,
      limiteTokenDiario: 5000,
    },
  });
  console.log(`  PIN '${PIN_TESTE}' configurado pra AMAGES + limites trans=500 diario=5000`);
}

async function limparRastros(convenioId: string) {
  // Limpa TokenTransacao + Ledger DISTRIBUICAO_CONVENIO + AuditLog do smoke
  await prisma.tokenTransacao.deleteMany({
    where: { pagadorId: AMAGES_ID },
  });
  await prisma.cooperTokenLedger.deleteMany({
    where: {
      cooperativaId: COOPEREBR_ID,
      tipo: 'DISTRIBUICAO_CONVENIO',
    },
  });
  // Resetar saldos funcionarios pra ter snapshot limpo.
  await prisma.cooperTokenSaldo.deleteMany({
    where: { cooperadoId: { in: [FUNC1_ID, FUNC2_ID] } },
  });
}

async function main() {
  console.log('═══ Smoke E2E F3 Bloco A+B+C+C.1 — AMAGES → 2 funcionários ═══\n');

  // [0] Setup
  console.log('[0] Setup');
  await ensurePinAMAGES();
  const convenioId = await setupConvenio();
  await setupMembros(convenioId);
  await setupSaldoAMAGES(150);
  await limparRastros(convenioId);

  const token = gerarJwtAMAGES();
  console.log(`  JWT manual gerado (${token.length} chars)\n`);

  // [1] Cenário (a) — confirmação PIN via GET membros-disponiveis
  console.log('Cenário (a) — listar membros-disponiveis');
  const lista = await call(
    'GET',
    `/cooper-token/empresa/convenio/${convenioId}/membros-disponiveis`,
    { token },
  );
  if (lista.status === 200) {
    const r = lista.json;
    if (r.membros.ativos.length >= 2 && r.saldoEmpresa.saldoDisponivel >= 150) {
      pass(`200 OK — ${r.membros.ativos.length} ativos + saldo R$${r.saldoEmpresa.saldoDisponivel} + valorTokenReais=${r.config.valorTokenReais}`);
    } else {
      fail(`retorno incompleto: ${JSON.stringify(r)}`);
    }
  } else {
    fail(`HTTP ${lista.status}: ${JSON.stringify(lista.json)}`);
  }

  // Confirmar MT-B: NÃO retorna cpf/telefone
  if (lista.json?.membros?.ativos?.[0]) {
    const sample = lista.json.membros.ativos[0];
    if (!('cpf' in sample) && !('telefone' in sample)) {
      pass(`MT-B: response NÃO inclui cpf/telefone (PII)`);
    } else {
      fail(`MT-B: response inclui PII desnecessária: ${Object.keys(sample).join(', ')}`);
    }
  }

  const valorTokenReais: number = lista.json.config.valorTokenReais;

  // [2] Cenário (b) — golden path quantidades DIFERENTES
  console.log('\nCenário (b) — golden path quantidades diferentes');
  const clientRequestId1 = `smoke-${crypto.randomUUID()}`;
  const distribuicoes = [
    { destinatarioCooperadoId: FUNC1_ID, quantidade: 10 }, // João
    { destinatarioCooperadoId: FUNC2_ID, quantidade: 5 },  // Ana
  ];
  const somaEsperada = 15;

  // PREVIEW primeiro
  const preview = await call('POST', '/cooper-token/empresa/distribuir', {
    token,
    body: {
      convenioId,
      clientRequestId: clientRequestId1,
      pin: PIN_TESTE,
      modo: 'PREVIEW',
      distribuicoes,
      naturezaDistribuicao: 'ORIGEM_REGULAMENTO',
      valorTokenEsperado: valorTokenReais,
    },
  });
  if (preview.status === 200 || preview.status === 201) {
    const r = preview.json;
    if (r.modo === 'PREVIEW' && r.podeProsseguir === true && r.preview.resumo.somaQuantidade === somaEsperada) {
      pass(`PREVIEW OK — soma=${r.preview.resumo.somaQuantidade}, saldoAntes=${r.preview.resumo.saldoEmpresaAntes}, saldoDepois=${r.preview.resumo.saldoEmpresaDepois}`);
    } else {
      fail(`PREVIEW retorno: ${JSON.stringify(r)}`);
    }
  } else {
    fail(`PREVIEW HTTP ${preview.status}: ${JSON.stringify(preview.json)}`);
  }

  // CONFIRM
  const confirm = await call('POST', '/cooper-token/empresa/distribuir', {
    token,
    body: {
      convenioId,
      clientRequestId: clientRequestId1,
      pin: PIN_TESTE,
      modo: 'CONFIRM',
      distribuicoes,
      naturezaDistribuicao: 'ORIGEM_REGULAMENTO',
      valorTokenEsperado: valorTokenReais,
    },
  });
  if (confirm.status === 200 || confirm.status === 201) {
    const r = confirm.json;
    if (r.modo === 'CONFIRM' && r.resultado.distribuidos === 2 && !r.idempotente) {
      pass(`CONFIRM 200 — distribuidos=${r.resultado.distribuidos} soma=${r.resultado.somaQuantidade} saldoDepois=${r.resultado.saldoEmpresaDepois}`);
    } else {
      fail(`CONFIRM retorno: ${JSON.stringify(r)}`);
    }
  } else {
    fail(`CONFIRM HTTP ${confirm.status}: ${JSON.stringify(confirm.json)}`);
  }

  // Verificar saldo AMAGES debitado 1× (não múltiplos updates)
  const saldoAmagesPos = await prisma.cooperTokenSaldo.findUnique({
    where: { cooperadoId: AMAGES_ID },
    select: { saldoDisponivel: true, totalResgatado: true },
  });
  if (saldoAmagesPos && Number(saldoAmagesPos.saldoDisponivel) === 135) {
    pass(`saldo AMAGES debitado: 150 → 135 (= -${somaEsperada})`);
  } else {
    fail(`saldo AMAGES errado: ${Number(saldoAmagesPos?.saldoDisponivel)} (esperado 135)`);
  }

  // Verificar saldo dos 2 funcionarios
  const saldoFunc1 = await prisma.cooperTokenSaldo.findUnique({ where: { cooperadoId: FUNC1_ID } });
  const saldoFunc2 = await prisma.cooperTokenSaldo.findUnique({ where: { cooperadoId: FUNC2_ID } });
  if (Number(saldoFunc1?.saldoDisponivel) === 10) {
    pass(`saldo João: 10 (creditado)`);
  } else {
    fail(`saldo João errado: ${Number(saldoFunc1?.saldoDisponivel)} (esperado 10)`);
  }
  if (Number(saldoFunc2?.saldoDisponivel) === 5) {
    pass(`saldo Ana: 5 (creditado)`);
  } else {
    fail(`saldo Ana errado: ${Number(saldoFunc2?.saldoDisponivel)} (esperado 5)`);
  }

  // Verificar ledger DISTRIBUICAO_CONVENIO em 2 lados (4 entries total)
  const ledger = await prisma.cooperTokenLedger.findMany({
    where: {
      cooperativaId: COOPEREBR_ID,
      tipo: 'DISTRIBUICAO_CONVENIO',
    },
  });
  if (ledger.length === 4) {
    const debitos = ledger.filter((l) => l.operacao === 'DEBITO');
    const creditos = ledger.filter((l) => l.operacao === 'CREDITO');
    if (debitos.length === 2 && creditos.length === 2) {
      pass(`ledger DISTRIBUICAO_CONVENIO: 2 DEBITO (AMAGES) + 2 CREDITO (funcionários)`);
    } else {
      fail(`ledger desbalanceado: ${debitos.length} DEBITO, ${creditos.length} CREDITO`);
    }
  } else {
    fail(`ledger count = ${ledger.length} (esperado 4)`);
  }

  // 1ª linha do DEBITO tem referência idempotência
  const debitoComRef = ledger.find(
    (l) => l.operacao === 'DEBITO' && l.referenciaId === clientRequestId1,
  );
  if (debitoComRef && debitoComRef.referenciaTabela === 'MASS_WRITE_DISTRIBUICAO') {
    pass(`1ª linha DEBITO grava referenciaId+referenciaTabela='MASS_WRITE_DISTRIBUICAO'`);
  } else {
    fail(`1ª linha DEBITO sem referência idempotência`);
  }

  // TokenTransacao com natureza gravada
  const tts = await prisma.tokenTransacao.findMany({
    where: { pagadorId: AMAGES_ID },
  });
  if (tts.length === 2 && tts.every((t) => t.naturezaDistribuicao === 'ORIGEM_REGULAMENTO')) {
    pass(`TokenTransacao: 2 entries com naturezaDistribuicao='ORIGEM_REGULAMENTO' (CLT=null)`);
  } else {
    fail(`TokenTransacao incorretas: ${tts.length} entries, naturezas=${tts.map((t) => t.naturezaDistribuicao).join(',')}`);
  }

  // [3] Cenário (c) — Retry com MESMO clientRequestId → idempotente
  console.log('\nCenário (c) — retry com mesmo clientRequestId');
  const retry = await call('POST', '/cooper-token/empresa/distribuir', {
    token,
    body: {
      convenioId,
      clientRequestId: clientRequestId1, // MESMO
      pin: PIN_TESTE,
      modo: 'CONFIRM',
      distribuicoes,
      naturezaDistribuicao: 'ORIGEM_REGULAMENTO',
      valorTokenEsperado: valorTokenReais,
    },
  });
  if (retry.status === 200 || retry.status === 201) {
    if (retry.json.idempotente === true) {
      pass(`idempotente:true — retry não duplicou`);
    } else {
      fail(`retry NÃO marcou idempotente: ${JSON.stringify(retry.json)}`);
    }
  } else {
    fail(`retry HTTP ${retry.status}: ${JSON.stringify(retry.json)}`);
  }

  // Verificar que saldos NÃO mudaram (idempotência preservou)
  const saldoAmagesRetry = await prisma.cooperTokenSaldo.findUnique({
    where: { cooperadoId: AMAGES_ID },
  });
  if (Number(saldoAmagesRetry?.saldoDisponivel) === 135) {
    pass(`saldo AMAGES inalterado após retry (135 == 135) — sem dupla distribuição`);
  } else {
    fail(`DUPLICIDADE detectada: saldo AMAGES = ${Number(saldoAmagesRetry?.saldoDisponivel)} (esperado 135)`);
  }

  // [4] Cenário (d) — VOLUNTARIA sem empresaDeclaraTetoClt → 400
  console.log('\nCenário (d) — VOLUNTARIA sem checkbox CLT');
  const semClt = await call('POST', '/cooper-token/empresa/distribuir', {
    token,
    body: {
      convenioId,
      clientRequestId: `smoke-${crypto.randomUUID()}`,
      pin: PIN_TESTE,
      modo: 'CONFIRM',
      distribuicoes: [{ destinatarioCooperadoId: FUNC1_ID, quantidade: 1 }],
      naturezaDistribuicao: 'VOLUNTARIA',
      valorTokenEsperado: valorTokenReais,
    },
  });
  if (semClt.status === 400 && /VOLUNTARIA.*CLT 458/i.test(semClt.json.message ?? '')) {
    pass(`VOLUNTARIA s/ checkbox CLT → 400 — "${semClt.json.message?.slice(0, 80)}..."`);
  } else {
    fail(`VOLUNTARIA s/ CLT: HTTP ${semClt.status} — ${JSON.stringify(semClt.json)}`);
  }

  // [5] Cenário (e) — extrato do funcionário mostra DISTRIBUICAO_CONVENIO
  console.log('\nCenário (e) — extrato funcionário mostra DISTRIBUICAO_CONVENIO');
  const ledgerJoao = await prisma.cooperTokenLedger.findFirst({
    where: { cooperadoId: FUNC1_ID, operacao: 'CREDITO' },
    orderBy: { createdAt: 'desc' },
  });
  if (ledgerJoao && ledgerJoao.tipo === 'DISTRIBUICAO_CONVENIO') {
    pass(`extrato João: tipo='DISTRIBUICAO_CONVENIO' (não DOACAO_RECEBIDA) — segregação Art. 87 ✓`);
  } else {
    fail(`extrato João: tipo='${ledgerJoao?.tipo}' (esperado DISTRIBUICAO_CONVENIO)`);
  }

  // ─────────────────────────────────────────────────
  console.log('\n═══ Resumo ═══');
  console.log(`✓ PASS: ${passCount}`);
  console.log(`✗ FAIL: ${failCount}`);
  if (failures.length > 0) {
    console.log('\nFalhas:');
    failures.forEach((f) => console.log(`  - ${f}`));
  }

  await prisma.$disconnect();
  process.exit(failCount === 0 ? 0 : 1);
}

main().catch(async (err) => {
  console.error('SMOKE ERRO FATAL:', err);
  await prisma.$disconnect();
  process.exit(1);
});
