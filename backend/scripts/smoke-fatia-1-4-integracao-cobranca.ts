/**
 * Smoke E2E Fatia 1.4 — integração de cobrança.
 *
 * Confirma o ciclo completo do membro custeado pós-Fatia 1.3:
 *
 *  (1) cadastro convite custeio + cota → empresa aprova → admin aprova
 *      → membro completo (Fatia 1.3 já valida).
 *
 *  (2) tenta criar cobrança INDIVIDUAL do contrato custeado → DEVE FALHAR
 *      com guard `custeadoPorConvenio` (cobrancas.service.ts:179).
 *      Sem isso = double-bill: cooperado paga individual + empresa paga
 *      consolidada com o mesmo kWh.
 *
 *  (3) ativa contrato (UPDATE direto — simula admin pós-protocolo
 *      concessionária) + gera consolidada do convênio Clinica Teste
 *      (base=ALOCACAO_FIXA, tarifa fixa R$1/kWh). Confirma que:
 *        - consolidada CRIADA (não SEM_MEMBROS nem JA_EXISTE)
 *        - valorBruto > 0 (energia entra)
 *
 * Não mocka — bate controller via HTTP + Prisma direto. Cleanup automático.
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
  return '5511999966' + d.toString().padStart(3, '0');
}

async function criarConviteValidado(suffix: string) {
  const token = randomBytes(32).toString('hex');
  await prisma.conviteConvenioMembro.create({
    data: {
      convenioId: CONVENIO_ID_CLINICA,
      cooperativaId: TENANT_A,
      nomeConvidado: `SMOKE-1-4 ${suffix}`,
      telefone: telUnico(),
      token,
      expiresAt: new Date(Date.now() + 7 * 86400000),
      createdBy: ADMIN_USER_ID,
      otpValidadoEm: new Date(),
      permiteSemUc: false,
    },
  });
  return { token };
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

async function main() {
  const inicio = Date.now();

  // Cleanup pré
  await prisma.aprovacaoConvenioMembro.deleteMany({
    where: { membro: { cooperado: { email: { startsWith: 'smoke14+' } } } },
  });
  await prisma.cobranca.deleteMany({
    where: { contrato: { cooperado: { email: { startsWith: 'smoke14+' } } } },
  });
  await prisma.convenioCooperado.deleteMany({
    where: { cooperado: { email: { startsWith: 'smoke14+' } } },
  });
  await prisma.contrato.deleteMany({
    where: { cooperado: { email: { startsWith: 'smoke14+' } } },
  });
  await prisma.uc.deleteMany({
    where: { cooperado: { email: { startsWith: 'smoke14+' } } },
  });
  await prisma.progressaoClube.deleteMany({
    where: { cooperado: { email: { startsWith: 'smoke14+' } } },
  });
  await prisma.historicoStatusCooperado.deleteMany({
    where: { cooperado: { email: { startsWith: 'smoke14+' } } },
  });
  await prisma.propostaCooperado.deleteMany({
    where: { cooperado: { email: { startsWith: 'smoke14+' } } },
  });
  await prisma.listaEspera.deleteMany({
    where: { cooperado: { email: { startsWith: 'smoke14+' } } },
  });
  await prisma.cooperado.deleteMany({
    where: { email: { startsWith: 'smoke14+' } },
  });
  await prisma.conviteConvenioMembro.deleteMany({
    where: { nomeConvidado: { startsWith: 'SMOKE-1-4' } },
  });

  const jwtAdmin = await obterJwtAdmin();
  console.log('🔑 JWT admin gerado.');

  let cooperadoId: string | null = null;
  let contratoId: string | null = null;

  try {
    // ── ETAPA (1): cadastro + 2 aprovações → membro completo ──
    const ts = Date.now().toString().slice(-7);
    const { token } = await criarConviteValidado(`integ-${ts}`);
    const payload = {
      nome: `SMOKE 1.4 ${ts}`,
      cpf: `077${ts.padStart(8, '0')}`,
      email: `smoke14+${ts}@example.invalid`,
      telefone: '5511999996666',
      endereco: {
        cep: '29100000',
        logradouro: 'R Z',
        numero: '3',
        bairro: 'B',
        cidade: 'Vitória',
        estado: 'ES',
      },
      instalacao: {
        numeroUC: '0004' + ts.padStart(6, '0'),
        distribuidora: 'EDP_ES',
        consumoMedioKwh: 350,
      },
      historicoConsumo: Array.from({ length: 3 }, (_, i) => ({
        mesAno: `0${i + 1}/2026`,
        consumoKwh: 300 + i * 25,
        valorRS: 250,
      })),
      valorUltimaFatura: 280,
      token,
      origem: 'CONVITE_PUBLICO',
    };

    const rCad = await fetch(`${API}/publico/cadastro-web`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!rCad.ok) {
      fail(`(1) cadastro-web → ${rCad.status}`);
      return;
    }
    ok(`(1) cadastro-web → ${rCad.status}`);

    const cooperado = await prisma.cooperado.findFirst({
      where: { email: payload.email },
      select: { id: true },
    });
    cooperadoId = cooperado!.id;
    const membro = await prisma.convenioCooperado.findFirst({
      where: { cooperadoId, convenioId: CONVENIO_ID_CLINICA },
      select: { id: true },
    });
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
          Authorization: `Bearer ${jwtAdmin}`,
        },
      },
    );
    if (!rApr.ok) {
      fail(`(1) aprovar-admin → ${rApr.status}`);
      return;
    }
    ok(`(1) aprovar-admin → ${rApr.status} (membro construído pelo helper)`);
    await new Promise((res) => setTimeout(res, 800));

    const ctr = await prisma.contrato.findFirst({
      where: { cooperadoId },
      select: {
        id: true,
        status: true,
        kwhContrato: true,
        plano: { select: { nome: true, custeadoPorConvenio: true } },
      },
    });
    if (!ctr) {
      fail('(1) contrato não foi criado pelo helper');
      return;
    }
    contratoId = ctr.id;
    ok(
      `(1)   contrato criado plano="${ctr.plano?.nome}" custeadoPorConvenio=${ctr.plano?.custeadoPorConvenio} ` +
        `status=${ctr.status}`,
    );

    // ── ETAPA (2): tenta criar cobrança INDIVIDUAL — DEVE FALHAR ──
    const rCobInd = await fetch(`${API}/cobrancas`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${jwtAdmin}`,
      },
      body: JSON.stringify({
        contratoId,
        mesReferencia: 5,
        anoReferencia: 2026,
        valorBruto: 280,
        dataVencimento: new Date('2026-06-15').toISOString(),
      }),
    });
    const cobIndData = await rCobInd.json().catch(() => ({}));
    if (rCobInd.ok) {
      fail(
        `(2) cobrança INDIVIDUAL foi criada — DEVERIA falhar pelo guard custeadoPorConvenio ` +
          `(status=${rCobInd.status} data=${JSON.stringify(cobIndData).slice(0, 200)})`,
      );
    } else if (rCobInd.status === 400 && JSON.stringify(cobIndData).includes('custeado')) {
      ok(
        `(2) cobrança INDIVIDUAL bloqueada → ${rCobInd.status} ` +
          `("${(cobIndData as any).message?.slice(0, 80) ?? 'msg'}...")` +
          ` — guard custeadoPorConvenio funciona`,
      );
    } else {
      fail(
        `(2) cobrança INDIVIDUAL falhou mas com erro INESPERADO ` +
          `(status=${rCobInd.status} data=${JSON.stringify(cobIndData).slice(0, 200)})`,
      );
    }

    // ── ETAPA (3): ativa contrato + gera consolidada ALOCACAO_FIXA ──
    // Simula o admin ativando o contrato pós-protocolo concessionária.
    await prisma.contrato.update({
      where: { id: contratoId },
      data: { status: 'ATIVO' },
    });
    ok(`(3)   contrato ativado manualmente (simula pós-protocolo concessionária)`);

    // Conta consolidadas pré-existentes da Clinica Teste em 05/2026.
    // Consolidada usa o contrato consolidador do convênio (lazy-created).
    const convenioInfo = await prisma.contratoConvenio.findUnique({
      where: { id: CONVENIO_ID_CLINICA },
      select: { contratoConsolidadorId: true },
    });
    const cobsAntes = convenioInfo?.contratoConsolidadorId
      ? await prisma.cobranca.findMany({
          where: {
            contratoId: convenioInfo.contratoConsolidadorId,
            mesReferencia: 5,
            anoReferencia: 2026,
          },
          select: { id: true },
        })
      : [];
    // Cleanup pra rodar idempotente
    if (cobsAntes.length > 0) {
      await prisma.cobranca.deleteMany({
        where: { id: { in: cobsAntes.map((c) => c.id) } },
      });
      console.log(`   limpou ${cobsAntes.length} consolidada(s) preexistente(s) pra 05/2026`);
    }

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
    const consData: any = await rCons.json().catch(() => ({}));
    if (!rCons.ok) {
      fail(
        `(3) gerar consolidada → ${rCons.status} ${JSON.stringify(consData).slice(0, 250)}`,
      );
    } else if (consData.status === 'CRIADA') {
      ok(
        `(3) consolidada CRIADA cobrancaId=${(consData.cobrancaId ?? '').slice(-8)} ` +
          `bruto=R$${consData.valorBruto} liquido=R$${consData.valorLiquido}`,
      );
      if (!consData.valorBruto || consData.valorBruto <= 0) {
        fail(`(3) valorBruto deveria ser > 0 (energia entra no total) — obtido=${consData.valorBruto}`);
      } else {
        ok(`(3)   valorBruto>0 — energia ALOCACAO_FIXA entrou no total`);
      }
    } else if (consData.status === 'SEM_MEMBROS') {
      fail(
        `(3) gerar consolidada retornou SEM_MEMBROS — membro deveria ter contrato ATIVO com plano custeado.`,
      );
    } else {
      fail(`(3) gerar consolidada estado inesperado: ${JSON.stringify(consData).slice(0, 200)}`);
    }
  } finally {
    // Cleanup pós
    await prisma.aprovacaoConvenioMembro
      .deleteMany({
        where: { membro: { cooperado: { email: { startsWith: 'smoke14+' } } } },
      })
      .catch(() => null);
    await prisma.cobranca
      .deleteMany({
        where: { contrato: { cooperado: { email: { startsWith: 'smoke14+' } } } },
      })
      .catch(() => null);
    // Limpa consolidadas do convênio em 05/2026 (cleanup pós)
    const convenioCleanup = await prisma.contratoConvenio.findUnique({
      where: { id: CONVENIO_ID_CLINICA },
      select: { contratoConsolidadorId: true },
    }).catch(() => null);
    if (convenioCleanup?.contratoConsolidadorId) {
      await prisma.cobranca
        .deleteMany({
          where: {
            contratoId: convenioCleanup.contratoConsolidadorId,
            mesReferencia: 5,
            anoReferencia: 2026,
          },
        })
        .catch(() => null);
    }
    await prisma.convenioCooperado
      .deleteMany({
        where: { cooperado: { email: { startsWith: 'smoke14+' } } },
      })
      .catch(() => null);
    await prisma.contrato
      .deleteMany({
        where: { cooperado: { email: { startsWith: 'smoke14+' } } },
      })
      .catch(() => null);
    await prisma.listaEspera
      .deleteMany({
        where: { cooperado: { email: { startsWith: 'smoke14+' } } },
      })
      .catch(() => null);
    await prisma.propostaCooperado
      .deleteMany({
        where: { cooperado: { email: { startsWith: 'smoke14+' } } },
      })
      .catch(() => null);
    await prisma.progressaoClube
      .deleteMany({
        where: { cooperado: { email: { startsWith: 'smoke14+' } } },
      })
      .catch(() => null);
    await prisma.historicoStatusCooperado
      .deleteMany({
        where: { cooperado: { email: { startsWith: 'smoke14+' } } },
      })
      .catch(() => null);
    await prisma.uc
      .deleteMany({ where: { cooperado: { email: { startsWith: 'smoke14+' } } } })
      .catch(() => null);
    await prisma.cooperado
      .deleteMany({ where: { email: { startsWith: 'smoke14+' } } })
      .catch(() => null);
    await prisma.conviteConvenioMembro
      .deleteMany({ where: { nomeConvidado: { startsWith: 'SMOKE-1-4' } } })
      .catch(() => null);
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
