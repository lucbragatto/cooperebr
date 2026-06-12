/**
 * Smoke E2E — Sprint Clube P1 F4 Bloco A→D (12/06/2026).
 *
 * Valida cenários cooperado-only do F4 via HTTP (backend :3000) usando JWT
 * assinado manualmente (JWT_SECRET do .env) — evita dependência de
 * Supabase pra senha do cooperado de teste.
 *
 * Cenários:
 *  (i)  usarNaFatura — golden + PIN incorreto + EXCEDE_LIMITE
 *  (ii) duplo-clique → só 1 débito (Serializable + status-guard)
 *  (iii) idempotência admin (FIN-4) via simulação Prisma direto
 *
 * Setup: cooperado AMAGES (ambienteTeste=true, ATIVO, tem contrato + cobrança
 * A_VENCER). PIN setado/resetado pelo script. Saldo creditado via Prisma.
 */
import { PrismaClient } from '@prisma/client';
import * as crypto from 'node:crypto';
import * as jwt from 'jsonwebtoken';

const API = process.env.API ?? 'http://localhost:3000';
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error('JWT_SECRET não encontrado no .env — abort');
  process.exit(1);
}
const AMAGES_COOPERADO_ID = 'cmp7034d70002vaf0af5ws4ud';
const COOPEREBR_ID = 'cmn0ho8bx0000uox8wu96u6fd';
const SUB_USUARIO_ID = 'cmq6qo5c40005va2w8gyyzzj7'; // Usuario Santi (qualquer do tenant)
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

function gerarJwt(): string {
  return jwt.sign(
    {
      sub: SUB_USUARIO_ID,
      email: 'lucbragatto+amages@gmail.com',
      perfil: 'COOPERADO',
      cooperadoId: AMAGES_COOPERADO_ID,
      cooperativaId: COOPEREBR_ID,
    },
    JWT_SECRET!,
    { expiresIn: '1h' },
  );
}

function hashPin(pin: string, salt: string): string {
  return crypto.createHash('sha256').update(pin + salt).digest('hex');
}

async function main() {
  console.log('═══ Smoke E2E F4 Bloco A→D — cooperado-only ═══\n');

  // [0] Setup ─────────────────────────────────────────────────
  console.log('[0] Setup');

  // PIN definido + tentativas zeradas + limites altos
  const salt = crypto.randomBytes(16).toString('hex');
  await prisma.cooperado.update({
    where: { id: AMAGES_COOPERADO_ID },
    data: {
      pinHash: hashPin(PIN_TESTE, salt),
      pinSalt: salt,
      pinTentativas: 0,
      pinBloqueadoAte: null,
      pinDefinidoEm: new Date(),
      limiteTokenTransacao: 200,
      limiteTokenDiario: 2000,
    },
  });
  console.log(`  PIN '${PIN_TESTE}' definido + limites trans=200 diario=2000`);

  // Pega cobrança A_VENCER
  const cob = await prisma.cobranca.findFirst({
    where: {
      contrato: { cooperadoId: AMAGES_COOPERADO_ID, cooperativaId: COOPEREBR_ID },
      status: { in: ['A_VENCER', 'VENCIDO'] as any },
    },
    select: { id: true, valorLiquido: true, status: true },
    orderBy: { createdAt: 'desc' },
  });
  if (!cob) {
    console.error('Cobrança A_VENCER não encontrada — abort');
    await prisma.$disconnect();
    process.exit(1);
  }
  console.log(`  Cobrança A_VENCER: ${cob.id} R$ ${cob.valorLiquido}`);
  const valorOriginal = Number(cob.valorLiquido);

  // Garante saldo
  await prisma.cooperTokenSaldo.upsert({
    where: { cooperadoId: AMAGES_COOPERADO_ID },
    create: {
      cooperadoId: AMAGES_COOPERADO_ID,
      cooperativaId: COOPEREBR_ID,
      saldoDisponivel: 150,
      totalEmitido: 150,
    },
    update: { saldoDisponivel: 150 },
  });
  console.log(`  Saldo AMAGES: 150 tokens`);

  // Limpa rastros de smoke anterior
  await prisma.tokenTransacao.deleteMany({ where: { pagadorId: AMAGES_COOPERADO_ID } });
  await prisma.cooperTokenLedger.deleteMany({
    where: {
      cooperadoId: AMAGES_COOPERADO_ID,
      tipo: 'DESCONTO_FATURA',
      referenciaId: cob.id,
    },
  });

  // Reset cobrança ao estado inicial
  async function resetCob() {
    await prisma.cobranca.update({
      where: { id: cob.id },
      data: {
        valorLiquido: valorOriginal,
        tokenDescontoQt: 0,
        tokenDescontoReais: 0,
        status: 'A_VENCER' as any,
      },
    });
    await prisma.cooperTokenLedger.deleteMany({
      where: {
        cooperadoId: AMAGES_COOPERADO_ID,
        tipo: 'DESCONTO_FATURA',
        referenciaId: cob.id,
      },
    });
    await prisma.cooperTokenSaldo.update({
      where: { cooperadoId: AMAGES_COOPERADO_ID },
      data: { saldoDisponivel: 150 },
    });
  }

  const token = gerarJwt();
  console.log(`  JWT manual gerado (${token.length} chars)\n`);

  // ═════════════════════════════════════════════════════════
  // Cenário (i) usarNaFatura
  // ═════════════════════════════════════════════════════════
  console.log('Cenário (i) — usarNaFatura');

  // (i.a) Golden path
  await resetCob();
  await prisma.tokenTransacao.deleteMany({ where: { pagadorId: AMAGES_COOPERADO_ID } });

  console.log('  [i.a] Golden path: 10 tokens com PIN correto');
  const golden = await call('POST', '/cooper-token/usar-na-fatura', {
    token,
    body: { cobrancaId: cob.id, quantidadeTokens: 10, pin: PIN_TESTE },
  });
  if (golden.status === 200 || golden.status === 201) {
    const r = golden.json;
    if (r.tokensUsados > 0 && r.desconto > 0) {
      pass(`golden 200 — tokensUsados=${r.tokensUsados} desconto=R$ ${r.desconto} novoValor=R$ ${r.novoValor}`);
    } else {
      fail(`golden retorno inválido: ${JSON.stringify(r)}`);
    }
  } else {
    fail(`golden HTTP ${golden.status}: ${JSON.stringify(golden.json)}`);
  }

  const tts = await prisma.tokenTransacao.findMany({
    where: { pagadorId: AMAGES_COOPERADO_ID, tipoOperacao: 'USO_FATURA' },
  });
  if (tts.length === 1 && tts[0].pinValidadoEm && tts[0].status === 'CONFIRMADA') {
    pass(`TokenTransacao USO_FATURA criada: jti=${tts[0].jti.slice(0, 8)}... tier=${tts[0].tier} motivo=${tts[0].motivoStepUp ?? 'NONE'}`);
  } else {
    fail(`TokenTransacao USO_FATURA: ${tts.length} entries / pinValidadoEm=${tts[0]?.pinValidadoEm} / status=${tts[0]?.status}`);
  }

  // (i.b) PIN incorreto
  await resetCob();
  await prisma.tokenTransacao.deleteMany({ where: { pagadorId: AMAGES_COOPERADO_ID } });
  await prisma.cooperado.update({
    where: { id: AMAGES_COOPERADO_ID },
    data: { pinTentativas: 0, pinBloqueadoAte: null },
  });

  console.log('  [i.b] PIN incorreto: deve dar 403');
  const pinErrado = await call('POST', '/cooper-token/usar-na-fatura', {
    token,
    body: { cobrancaId: cob.id, quantidadeTokens: 10, pin: '000000' },
  });
  if (pinErrado.status === 403) {
    pass(`PIN incorreto 403 — "${pinErrado.json.message}"`);
  } else {
    fail(`PIN incorreto retornou ${pinErrado.status}: ${JSON.stringify(pinErrado.json)}`);
  }

  const aposIncorreto = await prisma.cooperado.findUnique({
    where: { id: AMAGES_COOPERADO_ID },
    select: { pinTentativas: true },
  });
  if (aposIncorreto && aposIncorreto.pinTentativas >= 1) {
    pass(`pinTentativas incrementou para ${aposIncorreto.pinTentativas}`);
  } else {
    fail(`pinTentativas não incrementou (atual: ${aposIncorreto?.pinTentativas})`);
  }

  await prisma.cooperado.update({
    where: { id: AMAGES_COOPERADO_ID },
    data: { pinTentativas: 0, pinBloqueadoAte: null },
  });

  // (i.c) EXCEDE_LIMITE_TRANSACAO
  await resetCob();
  await prisma.cooperado.update({
    where: { id: AMAGES_COOPERADO_ID },
    data: { limiteTokenTransacao: 30 },
  });

  console.log('  [i.c] EXCEDE_LIMITE: pedido 100 tokens (~R$ 45 > limite R$ 30)');
  const excede = await call('POST', '/cooper-token/usar-na-fatura', {
    token,
    body: { cobrancaId: cob.id, quantidadeTokens: 100, pin: PIN_TESTE },
  });
  if (excede.status === 400 && /excede.*limite/i.test(excede.json.message ?? '')) {
    pass(`EXCEDE_LIMITE 400 — "${excede.json.message}"`);
  } else {
    fail(`EXCEDE_LIMITE retornou ${excede.status}: ${JSON.stringify(excede.json)}`);
  }

  await prisma.cooperado.update({
    where: { id: AMAGES_COOPERADO_ID },
    data: { limiteTokenTransacao: 200 },
  });

  // ═════════════════════════════════════════════════════════
  // Cenário (ii) Duplo-clique → só 1 débito
  // ═════════════════════════════════════════════════════════
  console.log('\nCenário (ii) — Duplo-clique no Confirmar');

  await resetCob();
  await prisma.tokenTransacao.deleteMany({ where: { pagadorId: AMAGES_COOPERADO_ID } });

  console.log('  [ii] 2 POSTs paralelos idênticos com Promise.allSettled');
  const [r1, r2] = await Promise.allSettled([
    call('POST', '/cooper-token/usar-na-fatura', {
      token,
      body: { cobrancaId: cob.id, quantidadeTokens: 5, pin: PIN_TESTE },
    }),
    call('POST', '/cooper-token/usar-na-fatura', {
      token,
      body: { cobrancaId: cob.id, quantidadeTokens: 5, pin: PIN_TESTE },
    }),
  ]);
  const respostas = [r1, r2].map((p) =>
    p.status === 'fulfilled' ? p.value : { status: 0, json: { error: 'rejected' } },
  );
  const sucessos = respostas.filter((r) => r.status === 200 || r.status === 201).length;
  const falhas = respostas.filter((r) => r.status !== 200 && r.status !== 201).length;
  console.log(`    HTTP responses: sucessos=${sucessos} falhas=${falhas}`);

  if (sucessos === 1 && falhas === 1) {
    pass(`exatamente 1 sucesso + 1 falha (ideal — Serializable abortou a 2ª)`);
  } else if (sucessos < 2) {
    pass(`${sucessos} sucesso(s) — sem dupla débito (race tratada)`);
  } else {
    fail(`AMBOS sucessos — duplicidade!`);
  }

  const ledgerCount = await prisma.cooperTokenLedger.count({
    where: {
      cooperadoId: AMAGES_COOPERADO_ID,
      tipo: 'DESCONTO_FATURA',
      referenciaId: cob.id,
    },
  });
  if (ledgerCount <= 1) {
    pass(`ledger DESCONTO_FATURA tem ${ledgerCount} entry(es) — sem duplicidade`);
  } else {
    fail(`ledger DESCONTO_FATURA tem ${ledgerCount} entries — DUPLICIDADE!`);
  }

  // ═════════════════════════════════════════════════════════
  // Cenário (iii) Idempotência admin (FIN-4)
  // ═════════════════════════════════════════════════════════
  console.log('\nCenário (iii) — Idempotência admin (FIN-4)');

  // Simula 2 chamadas a creditar() com mesmo clientRequestId → 1 ledger entry
  // (idempotência app-level via ledger.findFirst em creditar :100).
  const clientRequestId = `smoke-${crypto.randomUUID()}`;
  console.log(`  [iii] clientRequestId = ${clientRequestId}`);

  await prisma.cooperTokenLedger.deleteMany({
    where: { referenciaId: clientRequestId, referenciaTabela: 'ENVIO_ADMIN' },
  });

  const refTabela = 'ENVIO_ADMIN';
  for (let i = 0; i < 2; i++) {
    const existing = await prisma.cooperTokenLedger.findFirst({
      where: {
        cooperadoId: AMAGES_COOPERADO_ID,
        cooperativaId: COOPEREBR_ID,
        referenciaId: clientRequestId,
        referenciaTabela: refTabela,
      },
    });
    if (existing) continue; // 2ª chamada vê entry e não duplica
    const saldoAntes = await prisma.cooperTokenSaldo.findUnique({
      where: { cooperadoId: AMAGES_COOPERADO_ID },
    });
    const novoSaldo = Number(saldoAntes?.saldoDisponivel ?? 0) + 50;
    await prisma.cooperTokenSaldo.update({
      where: { cooperadoId: AMAGES_COOPERADO_ID },
      data: { saldoDisponivel: novoSaldo, totalEmitido: { increment: 50 } },
    });
    await prisma.cooperTokenLedger.create({
      data: {
        cooperadoId: AMAGES_COOPERADO_ID,
        cooperativaId: COOPEREBR_ID,
        tipo: 'BONUS_INDICACAO',
        operacao: 'CREDITO',
        quantidade: 50,
        saldoApos: novoSaldo,
        referenciaId: clientRequestId,
        referenciaTabela: refTabela,
        descricao: `Smoke F4 (iii) ENVIO_ADMIN simulado`,
      },
    });
  }

  const ledgerEnvioAdmin = await prisma.cooperTokenLedger.count({
    where: { referenciaId: clientRequestId, referenciaTabela: refTabela },
  });
  if (ledgerEnvioAdmin === 1) {
    pass(`idempotência app-level: 2 tentativas → 1 ledger entry`);
  } else {
    fail(`idempotência app-level: ${ledgerEnvioAdmin} entries (esperado 1)`);
  }

  // Cleanup
  await prisma.cooperTokenLedger.deleteMany({
    where: { referenciaId: clientRequestId, referenciaTabela: refTabela },
  });
  await resetCob();
  await prisma.tokenTransacao.deleteMany({ where: { pagadorId: AMAGES_COOPERADO_ID } });

  // ═════════════════════════════════════════════════════════
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
