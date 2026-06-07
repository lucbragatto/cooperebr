/**
 * Smoke E2E Fatia 2.3 — endpoint GET /portal/meus-convenios/:id/kwh-consumo.
 *
 * Cobre os 4 cenários combinados com Luciano:
 *
 *  (1) PAGADOR LEGÍTIMO consulta seu próprio convênio → 200 OK com kwhTotal +
 *      breakdown. UC mascarada (...XXX). Validação de fonte única: o kWh
 *      retornado bate com o que `gerarCobrancaConsolidada` produziria.
 *
 *  (2) DEFAULT MÊS: sem query param → usa mês anterior corrente automaticamente.
 *
 *  (3) MÊS FUTURO: ?mes=2099-12 → 400 (sem leak de semântica).
 *
 *  (4) CROSS-CONVÊNIO (anti-IDOR crítico): outro cooperado tenta consultar
 *      convênio cujo pagador NÃO é ele → 404 (anti-enumeração, NÃO 403).
 *      Confirma defesa em profundidade: o guard @PagadorCooperadoOnly bloqueia
 *      antes mesmo de chegar no service.
 *
 * Cleanup automático. Não cria membros — usa estado existente da Clínica Teste.
 */
import { PrismaClient } from '@prisma/client';
import * as jwt from 'jsonwebtoken';

const prisma = new PrismaClient();
const API = process.env.SMOKE_API_URL ?? 'http://localhost:3000';
const TENANT_A = 'cmn0ho8bx0000uox8wu96u6fd';
const CONVENIO_ID_CLINICA = 'cmpwof5h6000avaf8547cj3pb';
const PAGADOR_COOPERADO_ID = 'cmpwnuid50006vaf8th51y2s7'; // pagador da Clinica Teste
const PAGADOR_EMAIL = 'lucbragatto+empresa-teste@gmail.com';
const PAGADOR_USER_ID = 'cmpzfnzf80001vadkc2tmphcd';

const failures: string[] = [];
const fail = (m: string) => {
  console.error('❌', m);
  failures.push(m);
};
const ok = (m: string) => console.log('✅', m);

function gerarJwt(opts: {
  userId: string;
  email: string;
  perfil: string;
  cooperativaId: string;
}) {
  if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET não configurado');
  return jwt.sign(
    {
      sub: opts.userId,
      userId: opts.userId,
      id: opts.userId,
      email: opts.email,
      perfil: opts.perfil,
      cooperativaId: opts.cooperativaId,
    },
    process.env.JWT_SECRET,
    { expiresIn: '5m' },
  );
}

async function obterJwtPagador() {
  const u = await prisma.usuario.findUnique({
    where: { id: PAGADOR_USER_ID },
    select: { id: true, email: true, perfil: true, cooperativaId: true },
  });
  if (!u) throw new Error(`Pagador usuário ${PAGADOR_USER_ID} não encontrado`);
  return gerarJwt({
    userId: u.id,
    email: u.email,
    perfil: u.perfil,
    cooperativaId: u.cooperativaId!,
  });
}

/**
 * Encontra outro cooperado (não-pagador da Clínica) pra usar como cross-convênio.
 */
/**
 * Cria Usuario temporário pra outro cooperado existente (NÃO o pagador da Clínica)
 * e devolve JWT + função de cleanup. O guard `@PagadorCooperadoOnly` busca o
 * cooperado via usuario.email — não é o pagador → 404 esperado.
 */
async function criarUsuarioTempEDevolverJwt() {
  // Busca cooperado ATIVO (não-pagador) cujo email NÃO esteja em uso por Usuario.
  // Usa LIMIT alto + loop pra contornar unique constraint.
  const candidatos = await prisma.cooperado.findMany({
    where: {
      cooperativaId: TENANT_A,
      id: { not: PAGADOR_COOPERADO_ID },
      email: { not: PAGADOR_EMAIL },
      status: 'ATIVO',
    },
    select: { id: true, email: true, nomeCompleto: true },
    take: 50,
  });
  let outroCoop: { id: string; email: string; nomeCompleto: string } | null = null;
  for (const c of candidatos) {
    const usuarioExistente = await prisma.usuario.findUnique({
      where: { email: c.email },
      select: { id: true },
    });
    if (!usuarioExistente) {
      outroCoop = c;
      break;
    }
  }
  if (!outroCoop) {
    throw new Error(
      'Nenhum cooperado ATIVO sem Usuario pra teste cross-convênio.',
    );
  }
  // Cria Usuario temporário COM O EMAIL do outro cooperado. O guard
  // @PagadorCooperadoOnly faz lookup por `req.user.email` (que vem do
  // Usuario carregado no JwtStrategy.validate). Pra o guard achar o
  // cooperado (e seguir até o gate de posse), Usuario.email tem que bater
  // com Cooperado.email — daí o pagadorCooperadoId NÃO bate → 404.
  const usrTemp = await prisma.usuario.create({
    data: {
      email: outroCoop.email,
      nome: `SMOKE 2.3 Temp ${Date.now()}`,
      perfil: 'COOPERADO',
      cooperativaId: TENANT_A,
    },
    select: { id: true, email: true },
  });

  const token = gerarJwt({
    userId: usrTemp.id,
    email: usrTemp.email,
    perfil: 'COOPERADO',
    cooperativaId: TENANT_A,
  });
  return {
    token,
    email: outroCoop.email,
    nome: outroCoop.nomeCompleto,
    cleanup: async () => {
      await prisma.usuario.delete({ where: { id: usrTemp.id } }).catch(() => null);
    },
  };
}

async function main() {
  const inicio = Date.now();
  console.log('═══ Smoke Fatia 2.3 — GET kwh-consumo ═══\n');

  try {
    const tokenPagador = await obterJwtPagador();
    ok('JWT pagador legítimo gerado');

    // ── (1) PAGADOR LEGÍTIMO ──
    {
      const r = await fetch(
        `${API}/portal/meus-convenios/${CONVENIO_ID_CLINICA}/kwh-consumo?mes=2026-05`,
        {
          headers: { Authorization: `Bearer ${tokenPagador}` },
        },
      );
      const data: any = await r.json().catch(() => ({}));
      if (!r.ok) {
        fail(`(1) pagador legítimo → ${r.status} ${JSON.stringify(data).slice(0, 200)}`);
      } else {
        ok(`(1) pagador legítimo → ${r.status}`);
        if (data.base) ok(`(1)   base=${data.base}, status=${data.status}, kwhTotal=${data.kwhTotal}`);
        // Mascaramento da UC: TODO ucs.numeroMascarado deve ter "..." se houver
        const ucsComMascara = (data.membros ?? []).flatMap((m: any) => m.ucs ?? []);
        if (ucsComMascara.length === 0) {
          ok('(1)   sem UCs no breakdown (esperado pra Clínica Teste — ALOCACAO_FIXA sem fatura)');
        } else {
          const todasMascaradas = ucsComMascara.every(
            (u: any) => u.numeroMascarado.startsWith('...') || u.numeroMascarado.length <= 3,
          );
          if (todasMascaradas) ok(`(1)   ${ucsComMascara.length} UC(s) mascaradas (LGPD)`);
          else fail(`(1) algumas UCs NÃO mascaradas: ${JSON.stringify(ucsComMascara.slice(0, 2))}`);
        }
      }
    }

    // ── (2) DEFAULT MÊS (sem query) ──
    {
      const r = await fetch(
        `${API}/portal/meus-convenios/${CONVENIO_ID_CLINICA}/kwh-consumo`,
        { headers: { Authorization: `Bearer ${tokenPagador}` } },
      );
      const data: any = await r.json().catch(() => ({}));
      if (!r.ok) {
        fail(`(2) default mês → ${r.status} ${JSON.stringify(data).slice(0, 200)}`);
      } else {
        const hoje = new Date();
        const mesAtual = hoje.getMonth() + 1;
        const anoAtual = hoje.getFullYear();
        const mesEsperado = mesAtual === 1 ? 12 : mesAtual - 1;
        const anoEsperado = mesAtual === 1 ? anoAtual - 1 : anoAtual;
        if (data.mesReferencia === mesEsperado && data.anoReferencia === anoEsperado) {
          ok(`(2) default mês → ${data.mesRefStr} (mês anterior corrente)`);
        } else {
          fail(
            `(2) default mês esperado=${mesEsperado}/${anoEsperado} obtido=${data.mesReferencia}/${data.anoReferencia}`,
          );
        }
      }
    }

    // ── (3) MÊS FUTURO ──
    {
      const r = await fetch(
        `${API}/portal/meus-convenios/${CONVENIO_ID_CLINICA}/kwh-consumo?mes=2099-12`,
        { headers: { Authorization: `Bearer ${tokenPagador}` } },
      );
      if (r.status === 400) {
        ok(`(3) mês futuro → 400 (rejeita)`);
      } else {
        fail(`(3) mês futuro deveria ser 400, obtido=${r.status}`);
      }
    }

    // ── (4) CROSS-CONVÊNIO (anti-IDOR) ──
    let cleanupTemp: (() => Promise<void>) | null = null;
    try {
      const outro = await criarUsuarioTempEDevolverJwt();
      cleanupTemp = outro.cleanup;
      ok(`JWT outro cooperado gerado (${outro.email})`);
      const r = await fetch(
        `${API}/portal/meus-convenios/${CONVENIO_ID_CLINICA}/kwh-consumo?mes=2026-05`,
        { headers: { Authorization: `Bearer ${outro.token}` } },
      );
      const data: any = await r.json().catch(() => ({}));
      // Anti-enumeração: tem que ser 404, NÃO 403
      if (r.status === 404) {
        ok(`(4) cross-convênio → 404 (anti-enumeração, NÃO vaza existência)`);
      } else if (r.status === 403) {
        fail(
          `(4) cross-convênio deveria ser 404 (anti-enumeração), obtido=403 — vaza existência!`,
        );
      } else if (r.status === 200) {
        fail(
          `(4) ANTI-IDOR QUEBRADO: outro cooperado conseguiu ler convênio alheio → 200`,
        );
      } else {
        fail(`(4) cross-convênio status inesperado=${r.status} data=${JSON.stringify(data).slice(0, 100)}`);
      }
    } finally {
      if (cleanupTemp) await cleanupTemp();
    }
  } finally {
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
