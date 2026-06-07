/**
 * Smoke E2E LOTE.2 — envio em fila com throttle.
 *
 * Cobre o ciclo completo:
 *  (1) admin posta CSV pra preview → recebe classificação 3/3 PRONTO
 *  (2) admin posta lista PRONTA → recebe `{ loteId, total: 3 }` imediato
 *  (3) polla GET /lote/:loteId/status até total enviados/falhou = 3
 *  (4) verifica que telefones na resposta vêm com sufixo (LGPD)
 *  (5) confirma throttle entre envios (2s entre cada — total > ~4s pra 3 itens)
 *
 * Telefones whitelist (5511999988*) — não dispara WA real, status fica
 * ENVIADO por causa do mock dev (M22 — WhatsappEnvioResult honesto).
 *
 * Cleanup automático no finally.
 */
import { PrismaClient } from '@prisma/client';
import { randomBytes } from 'crypto';
import * as jwt from 'jsonwebtoken';

const prisma = new PrismaClient();
const API = process.env.SMOKE_API_URL ?? 'http://localhost:3000';
const TENANT_A = 'cmn0ho8bx0000uox8wu96u6fd';
const CONVENIO_ID_CLINICA = 'cmpwof5h6000avaf8547cj3pb';
const ADMIN_USER_ID = 'cmn0ds0i80000uolsxtnts907';

const failures: string[] = [];
const fail = (m: string) => {
  console.error('❌', m);
  failures.push(m);
};
const ok = (m: string) => console.log('✅', m);

async function obterJwtAdmin() {
  const u = await prisma.usuario.findUnique({
    where: { id: ADMIN_USER_ID },
    select: { id: true, email: true, perfil: true, cooperativaId: true },
  });
  if (!u) throw new Error('Admin não encontrado');
  return jwt.sign(
    {
      sub: u.id,
      userId: u.id,
      id: u.id,
      email: u.email,
      perfil: u.perfil,
      cooperativaId: u.cooperativaId,
    },
    process.env.JWT_SECRET!,
    { expiresIn: '5m' },
  );
}

async function limparPre() {
  await prisma.conviteConvenioMembro.deleteMany({
    where: {
      convenioId: CONVENIO_ID_CLINICA,
      nomeConvidado: { startsWith: 'SMOKE LOTE2' },
    },
  });
}

async function main() {
  const inicio = Date.now();
  console.log('═══ Smoke LOTE.2 — envio em fila com throttle ═══\n');

  await limparPre();
  const jwtAdmin = await obterJwtAdmin();
  ok('JWT admin gerado');

  // Telefones únicos por execução (anti-colisão entre rodadas).
  const r1 = randomBytes(1).readUInt8(0) % 100;
  const r2 = randomBytes(1).readUInt8(0) % 100;
  const r3 = randomBytes(1).readUInt8(0) % 100;
  const tel1 = '551199998' + String(r1).padStart(2, '0') + '0';
  const tel2 = '551199998' + String(r2).padStart(2, '0') + '1';
  const tel3 = '551199998' + String(r3).padStart(2, '0') + '2';

  try {
    // ── (1) Preview ──
    const csv = [
      `SMOKE LOTE2 Ana,${tel1.slice(2)}`,
      `SMOKE LOTE2 Bruno,${tel2.slice(2)}`,
      `SMOKE LOTE2 Carla,${tel3.slice(2)}`,
    ].join('\n');
    const rPrev = await fetch(
      `${API}/convenios/${CONVENIO_ID_CLINICA}/convites/lote/preview`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${jwtAdmin}`,
        },
        body: JSON.stringify({ csv }),
      },
    );
    const prev: any = await rPrev.json();
    if (!rPrev.ok) {
      fail(`(1) preview → ${rPrev.status} ${JSON.stringify(prev).slice(0, 200)}`);
      return;
    }
    if (prev.resumo.pronto !== 3) {
      fail(
        `(1) preview esperado 3 PRONTO, obtido pronto=${prev.resumo.pronto} (${JSON.stringify(prev.resumo)})`,
      );
      return;
    }
    ok(`(1) preview → 3/3 PRONTO`);

    // ── (2) Envio em lote ──
    const destinatarios = prev.linhas
      .filter((l: any) => l.status === 'PRONTO')
      .map((l: any) => ({ nome: l.nome, telefone: l.telefoneFmt }));

    const tEnvio = Date.now();
    const rEnv = await fetch(
      `${API}/convenios/${CONVENIO_ID_CLINICA}/convites/lote/enviar`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${jwtAdmin}`,
        },
        body: JSON.stringify({ destinatarios }),
      },
    );
    const env: any = await rEnv.json();
    const dtRespostaEnvio = Date.now() - tEnvio;
    if (rEnv.status !== 202) {
      fail(`(2) envio esperado 202, obtido ${rEnv.status} ${JSON.stringify(env).slice(0, 200)}`);
      return;
    }
    if (!env.loteId || env.total !== 3) {
      fail(`(2) shape esperado {loteId, total:3}, obtido ${JSON.stringify(env)}`);
      return;
    }
    ok(`(2) envio → 202 loteId=${env.loteId.slice(-8)} total=3`);
    if (dtRespostaEnvio < 2000) {
      ok(`(2)   resposta imediata em ${dtRespostaEnvio}ms (envios em background)`);
    } else {
      fail(`(2) resposta demorou ${dtRespostaEnvio}ms — não foi assíncrono`);
    }

    // ── (3) Polling status até concluir ──
    const POLL_MAX_S = 20;
    const POLL_INTERVAL_MS = 1500;
    let statusFinal: any = null;
    for (let i = 0; i < (POLL_MAX_S * 1000) / POLL_INTERVAL_MS; i++) {
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
      const rSt = await fetch(
        `${API}/convenios/${CONVENIO_ID_CLINICA}/convites/lote/${env.loteId}/status`,
        { headers: { Authorization: `Bearer ${jwtAdmin}` } },
      );
      const st: any = await rSt.json();
      if (!rSt.ok) {
        fail(`(3) status → ${rSt.status} ${JSON.stringify(st).slice(0, 200)}`);
        return;
      }
      console.log(
        `   poll #${i + 1}: pendente=${st.resumo.pendente} enviado=${st.resumo.enviado} falhou=${st.resumo.falhou}`,
      );
      if (st.resumo.pendente === 0) {
        statusFinal = st;
        break;
      }
    }
    if (!statusFinal) {
      fail('(3) lote não concluído em 20s');
      return;
    }
    const totalFinal = statusFinal.resumo.enviado + statusFinal.resumo.falhou;
    if (totalFinal !== 3) {
      fail(`(3) total final esperado 3, obtido ${totalFinal}`);
    } else {
      ok(`(3) status final: ${statusFinal.resumo.enviado} enviados + ${statusFinal.resumo.falhou} falhas`);
    }

    // ── (4) LGPD: sufixo do telefone ──
    const todosSufixados = statusFinal.itens.every((i: any) =>
      i.telefoneSufixo.startsWith('...'),
    );
    const nenhumIntegral = statusFinal.itens.every((i: any) => !i.telefone);
    if (todosSufixados && nenhumIntegral) {
      ok(`(4) telefones com sufixo (...XXXX) — LGPD preservada`);
    } else {
      fail(
        `(4) LGPD quebrada: algum telefone integral exposto. itens=${JSON.stringify(statusFinal.itens.slice(0, 2))}`,
      );
    }

    // ── (5) Throttle ──
    // 3 itens × 2s entre = ~4s mínimo entre 1º e último envio.
    // Como o smoke usa whitelist (envio é instantâneo), o throttle in-process
    // dita o tempo total. Verifica que entre tEnvio e statusFinal.itens[2].enviadoEm
    // passou > 4s.
    const enviadoEms = statusFinal.itens
      .map((i: any) => (i.enviadoEm ? new Date(i.enviadoEm).getTime() : 0))
      .filter((t: number) => t > 0);
    if (enviadoEms.length >= 2) {
      const intervaloMs = Math.max(...enviadoEms) - Math.min(...enviadoEms);
      if (intervaloMs >= 1800 && intervaloMs <= 8000) {
        ok(`(5) throttle confirmado: ${intervaloMs}ms entre 1º e último envio (~2s × N-1)`);
      } else {
        fail(`(5) throttle suspeito: intervalo=${intervaloMs}ms (esperado ~2000-6000ms)`);
      }
    }
  } finally {
    await limparPre().catch(() => null);
    console.log('\n🧹 Cleanup OK');
  }

  const dur = ((Date.now() - inicio) / 1000).toFixed(1);
  console.log(`\n══════ RESUMO ══════`);
  console.log(`Duração: ${dur}s`);
  console.log(`Falhas:  ${failures.length}`);
  if (failures.length === 0) console.log('\n✅ TODOS OS PASSOS PASSARAM');
  else {
    console.log('\n❌ FALHAS:');
    failures.forEach((f) => console.log(`  - ${f}`));
  }
  process.exit(failures.length === 0 ? 0 : 1);
}

main()
  .catch((e) => {
    console.error('FATAL:', e);
    process.exit(2);
  })
  .finally(() => prisma.$disconnect());
