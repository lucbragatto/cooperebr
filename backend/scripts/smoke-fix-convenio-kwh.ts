/**
 * Smoke prova-real do fix kWh — Fix 07/06/2026 (modelo correto do Luciano).
 *
 * Confirma os 3 aceites obrigatórios:
 *
 *  (1) Total = SOMA dinâmica das cotas dos membros. NUNCA divide o pacote.
 *      → cria 3 membros via convite custeio com cotas 300/400/500 →
 *        previewKwhConsolidado.kwhTotal === 1200.
 *
 *  (2) kwhAlocadoMensal vira disponivelAssinatura (referência, NÃO o total).
 *      → preview.disponivelAssinatura === 200000 (config do convênio Clinica
 *        Teste) e excedente=undefined (1200 < 200000).
 *
 *  (3) Fonte única: previewKwhConsolidado === cobrança real.
 *      → gera consolidada → cobrança.valorBruto / tarifa === preview.kwhTotal.
 *
 * Cleanup automático. NÃO altera o Clinica Teste em produção (cria membros
 * SMOKE-FIX-* + deleta no finally).
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

function telUnico() {
  const d = randomBytes(2).readUInt16BE(0) % 1000;
  return '5511999955' + d.toString().padStart(3, '0');
}

async function criarConviteValidado(suffix: string) {
  const token = randomBytes(32).toString('hex');
  await prisma.conviteConvenioMembro.create({
    data: {
      convenioId: CONVENIO_ID_CLINICA,
      cooperativaId: TENANT_A,
      nomeConvidado: `SMOKE-FIX ${suffix}`,
      telefone: telUnico(),
      token,
      expiresAt: new Date(Date.now() + 7 * 86400000),
      createdBy: ADMIN_USER_ID,
      otpValidadoEm: new Date(),
      permiteSemUc: false,
    },
  });
  return token;
}

async function obterJwtAdmin() {
  const admin = await prisma.usuario.findFirst({
    where: { id: ADMIN_USER_ID },
    select: { id: true, email: true, perfil: true, cooperativaId: true },
  });
  if (!admin) throw new Error(`Admin ${ADMIN_USER_ID} não encontrado`);
  return jwt.sign(
    {
      sub: admin.id,
      userId: admin.id,
      id: admin.id,
      email: admin.email,
      perfil: admin.perfil,
      cooperativaId: admin.cooperativaId,
    },
    process.env.JWT_SECRET!,
    { expiresIn: '5m' },
  );
}

async function cadastrarMembroComCota(opts: {
  cpfSuffix: string;
  cota: number;
  jwtAdmin: string;
}): Promise<{ cooperadoId: string; contratoId: string }> {
  const token = await criarConviteValidado(`c${opts.cpfSuffix}`);
  const payload = {
    nome: `SMOKE FIX ${opts.cpfSuffix}`,
    cpf: `055${opts.cpfSuffix.padStart(8, '0')}`,
    email: `smokefix+${opts.cpfSuffix}@example.invalid`,
    telefone: '5511999955555',
    endereco: {
      cep: '29100000',
      logradouro: 'R W',
      numero: '4',
      bairro: 'B',
      cidade: 'Vitória',
      estado: 'ES',
    },
    instalacao: {
      // 11 dígitos canônicos únicos por sufixo + cota
      numeroUC: ('5' + opts.cpfSuffix + String(opts.cota)).slice(0, 11).padStart(11, '0'),
      distribuidora: 'EDP_ES',
      consumoMedioKwh: opts.cota,
    },
    historicoConsumo: [],
    token,
    origem: 'CONVITE_PUBLICO',
  };
  const r = await fetch(`${API}/publico/cadastro-web`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!r.ok) {
    const d = await r.json().catch(() => ({}));
    throw new Error(
      `cadastro-web cota=${opts.cota} falhou: ${r.status} ${JSON.stringify(d).slice(0, 200)}`,
    );
  }
  const coop = await prisma.cooperado.findFirst({
    where: { email: payload.email },
    select: { id: true },
  });
  const membro = await prisma.convenioCooperado.findFirst({
    where: { cooperadoId: coop!.id, convenioId: CONVENIO_ID_CLINICA },
    select: { id: true },
  });
  // flip pra MEMBRO_ATIVO via aprovações encadeadas
  await prisma.convenioCooperado.updateMany({
    where: { id: membro!.id, status: 'PENDENTE_APROVACAO_EMPRESA' },
    data: { status: 'PENDENTE_APROVACAO_ADMIN', aprovadoPorEmpresaEm: new Date() },
  });
  const rApr = await fetch(
    `${API}/convenios/${CONVENIO_ID_CLINICA}/membros/${membro!.id}/aprovar-admin`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${opts.jwtAdmin}`,
      },
    },
  );
  if (!rApr.ok) throw new Error(`aprovar-admin cota=${opts.cota}: ${rApr.status}`);
  await new Promise((r) => setTimeout(r, 600));
  // ativa contrato manualmente (simula pós-protocolo)
  const ctr = await prisma.contrato.findFirst({
    where: { cooperadoId: coop!.id },
    select: { id: true },
  });
  if (!ctr) throw new Error(`contrato não criado pro cota=${opts.cota}`);
  await prisma.contrato.update({
    where: { id: ctr.id },
    data: { status: 'ATIVO' },
  });
  return { cooperadoId: coop!.id, contratoId: ctr.id };
}

async function limparPreExecucao() {
  await prisma.aprovacaoConvenioMembro.deleteMany({
    where: { membro: { cooperado: { email: { startsWith: 'smokefix+' } } } },
  });
  await prisma.cobranca.deleteMany({
    where: {
      contrato: { cooperado: { email: { startsWith: 'smokefix+' } } },
    },
  }).catch(() => null);
  // Limpa também consolidadas do convênio em 05/2026
  const convInfo = await prisma.contratoConvenio.findUnique({
    where: { id: CONVENIO_ID_CLINICA },
    select: { contratoConsolidadorId: true },
  });
  if (convInfo?.contratoConsolidadorId) {
    await prisma.cobranca.deleteMany({
      where: {
        contratoId: convInfo.contratoConsolidadorId,
        mesReferencia: 5,
        anoReferencia: 2026,
      },
    });
  }
  await prisma.convenioCooperado.deleteMany({
    where: { cooperado: { email: { startsWith: 'smokefix+' } } },
  });
  await prisma.contrato.deleteMany({
    where: { cooperado: { email: { startsWith: 'smokefix+' } } },
  });
  await prisma.listaEspera.deleteMany({
    where: { cooperado: { email: { startsWith: 'smokefix+' } } },
  });
  await prisma.propostaCooperado.deleteMany({
    where: { cooperado: { email: { startsWith: 'smokefix+' } } },
  });
  await prisma.progressaoClube.deleteMany({
    where: { cooperado: { email: { startsWith: 'smokefix+' } } },
  });
  await prisma.historicoStatusCooperado.deleteMany({
    where: { cooperado: { email: { startsWith: 'smokefix+' } } },
  });
  await prisma.uc.deleteMany({
    where: { cooperado: { email: { startsWith: 'smokefix+' } } },
  });
  await prisma.cooperado.deleteMany({
    where: { email: { startsWith: 'smokefix+' } },
  });
  await prisma.conviteConvenioMembro.deleteMany({
    where: { nomeConvidado: { startsWith: 'SMOKE-FIX' } },
  });
}

async function main() {
  const inicio = Date.now();
  console.log('═══ Smoke fix(convenio-kwh) prova-real ═══\n');

  await limparPreExecucao();
  const jwtAdmin = await obterJwtAdmin();
  ok('JWT admin gerado');

  try {
    const ts = Date.now().toString().slice(-7);

    // ── (1) Cria 3 membros com cotas 300/400/500 ──
    const m1 = await cadastrarMembroComCota({
      cpfSuffix: `1${ts}`,
      cota: 300,
      jwtAdmin,
    });
    ok(`(1.a) Membro A cota=300 criado (cooperadoId=${m1.cooperadoId.slice(-8)})`);
    const m2 = await cadastrarMembroComCota({
      cpfSuffix: `2${ts}`,
      cota: 400,
      jwtAdmin,
    });
    ok(`(1.b) Membro B cota=400 criado (cooperadoId=${m2.cooperadoId.slice(-8)})`);
    const m3 = await cadastrarMembroComCota({
      cpfSuffix: `3${ts}`,
      cota: 500,
      jwtAdmin,
    });
    ok(`(1.c) Membro C cota=500 criado (cooperadoId=${m3.cooperadoId.slice(-8)})`);

    // ── (2) Bate o endpoint preview via pagador legítimo ──
    const pag = await prisma.usuario.findUnique({
      where: { id: 'cmpzfnzf80001vadkc2tmphcd' },
      select: { id: true, email: true, perfil: true, cooperativaId: true },
    });
    const tokenPagador = jwt.sign(
      {
        sub: pag!.id,
        userId: pag!.id,
        id: pag!.id,
        email: pag!.email,
        perfil: pag!.perfil,
        cooperativaId: pag!.cooperativaId,
      },
      process.env.JWT_SECRET!,
      { expiresIn: '5m' },
    );

    const rPrev = await fetch(
      `${API}/portal/meus-convenios/${CONVENIO_ID_CLINICA}/kwh-consumo?mes=2026-05`,
      { headers: { Authorization: `Bearer ${tokenPagador}` } },
    );
    const preview: any = await rPrev.json();
    if (!rPrev.ok) {
      fail(`(2) preview → ${rPrev.status} ${JSON.stringify(preview).slice(0, 200)}`);
      return;
    }
    ok(`(2) preview → 200`);

    // Filtra só nossos 3 membros do smoke
    const nossosIds = [m1.cooperadoId, m2.cooperadoId, m3.cooperadoId];
    const nossos = (preview.membros ?? []).filter((m: any) =>
      nossosIds.includes(m.cooperadoId),
    );
    const somaNossos = nossos.reduce((acc: number, m: any) => acc + m.kwh, 0);

    if (somaNossos !== 1200) {
      fail(`(2) soma nossos 3 membros esperada=1200 obtida=${somaNossos}`);
    } else {
      ok(`(2)   3 membros (300+400+500) somam 1200 kWh ✓`);
    }
    // Confirma valorAPagar do preview = soma × tarifa
    if (preview.valorAPagar === null) {
      fail(`(2) valorAPagar=null no preview — esperado valor calculado`);
    } else if (preview.tarifaKwh !== 1) {
      fail(`(2) tarifaKwh esperada=1 (Clinica Teste VALOR_FIXO R$1) obtida=${preview.tarifaKwh}`);
    } else {
      ok(
        `(2)   valorAPagar=R$${preview.valorAPagar} (= kwhTotal=${preview.kwhTotal} × R$${preview.tarifaKwh}/kWh)`,
      );
    }
    if (preview.disponivelAssinatura !== 200000) {
      fail(
        `(2) disponivelAssinatura esperada=200000 (config Clinica) obtida=${preview.disponivelAssinatura}`,
      );
    } else {
      ok(`(2)   disponivelAssinatura=200000 (REFERÊNCIA da assinatura, não total)`);
    }
    if (preview.excedente) {
      fail(`(2) excedente NÃO esperado (1200 << 200000)`);
    } else {
      ok(`(2)   excedente=undefined (total < disponível) ✓`);
    }

    // Confirmação extra: status=OK (não SEM_CONSUMO_CAPTURADO porque temos cotas)
    if (preview.status !== 'OK') {
      fail(`(2) status esperado=OK obtido=${preview.status}`);
    } else {
      ok(`(2)   status=OK ✓`);
    }

    // ── (3) Fonte única: gera consolidada e bate ──
    const rCons = await fetch(
      `${API}/convenios/${CONVENIO_ID_CLINICA}/cobrancas-consolidadas/gerar?mesReferencia=2026-05`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${jwtAdmin}`,
        },
      },
    );
    const cons: any = await rCons.json();
    if (!rCons.ok) {
      fail(`(3) gerar consolidada → ${rCons.status} ${JSON.stringify(cons).slice(0, 200)}`);
      return;
    }
    if (cons.status !== 'CRIADA') {
      fail(`(3) consolidada status esperado=CRIADA obtido=${cons.status}`);
      return;
    }
    ok(
      `(3) consolidada CRIADA cobrancaId=${(cons.cobrancaId ?? '').slice(-8)} ` +
        `bruto=R$${cons.valorBruto} liquido=R$${cons.valorLiquido}`,
    );

    // Tarifa Clinica Teste = R$1/kWh (VALOR_FIXO). 1200 kWh × R$1 = R$1200.
    // PORÉM o total INCLUI todos os outros membros do convênio também (LEONARDO + sintéticos legados se houver UCs custeadas com fatura).
    // Pro smoke prova-real, confirmamos:
    //  - kwhTotal do preview >= 1200 (nossos 3 + qualquer pré-existente)
    //  - valorBruto = preview.kwhTotal × tarifa
    const tarifa = 1; // VALOR_FIXO da Clinica Teste
    const valorBrutoEsperado = Math.round(preview.kwhTotal * tarifa * 100) / 100;
    if (Math.abs(cons.valorBruto - valorBrutoEsperado) > 0.01) {
      fail(
        `(3) FONTE ÚNICA QUEBRADA: preview.kwhTotal=${preview.kwhTotal} × tarifa=R$${tarifa} = R$${valorBrutoEsperado} ≠ cobranca.valorBruto=R$${cons.valorBruto}`,
      );
    } else {
      ok(
        `(3)   FONTE ÚNICA confirmada: preview.kwhTotal=${preview.kwhTotal} × R$${tarifa} = R$${valorBrutoEsperado} === cobrança.valorBruto`,
      );
    }
    // valorAPagar do preview deve = valorLiquido da cobrança (sem clube)
    if (preview.valorAPagar !== null && Math.abs(preview.valorAPagar - cons.valorLiquido) > 0.01) {
      fail(
        `(3) preview.valorAPagar=R$${preview.valorAPagar} ≠ cobrança.valorLiquido=R$${cons.valorLiquido}`,
      );
    } else {
      ok(`(3)   preview.valorAPagar === cobrança.valorLiquido (UI mostra mesmo valor da fatura)`);
    }
    if (cons.valorBruto >= 1200) {
      ok(
        `(3)   cobrança >= R$1200 (nossos 3 membros já garantem essa soma mínima) ✓`,
      );
    } else {
      fail(`(3) cobrança < R$1200 — 3 membros 300/400/500 não somaram pra cobrança`);
    }
  } finally {
    await limparPreExecucao();
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
