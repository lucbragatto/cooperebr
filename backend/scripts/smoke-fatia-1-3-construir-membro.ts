/**
 * Smoke E2E programático — Fatia 1.3 (aprovação CONSTRÓI o membro).
 *
 * Cobre 2 cenários do alinhamento #7 do Luciano:
 *
 *  (a) caminho feliz: cadastro via convite custeio COM cota → empresa aprova
 *      → admin aprova → membro COMPLETO:
 *        - Cooperado.status=ATIVO
 *        - Contrato com custeadoPorConvenio=true + cotaKwhMensal>0
 *          (ListaEspera com cooperativaId — verificada onde aplica)
 *        - ProgressaoClube BRONZE
 *        - pendenciaMotorMsg=null
 *
 *  (b) sem consumo (LEONARDO-like): cadastro SEM cota → empresa aprova
 *      → admin aprova → membro PARCIAL graceful:
 *        - Cooperado.status=ATIVO (aprovação NÃO falha)
 *        - Sem contrato
 *        - ProgressaoClube BRONZE (clube matriculado mesmo sem motor)
 *        - pendenciaMotorMsg gravada (admin vê selo amarelo na lista)
 *
 * Não mocka — bate o controller via HTTP (`/publico/cadastro-web` +
 * `/convenios/.../aprovar-admin`). Cleanup automático.
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
  return '5511999977' + d.toString().padStart(3, '0');
}

async function criarConviteValidado(suffix: string) {
  const token = randomBytes(32).toString('hex');
  const convite = await prisma.conviteConvenioMembro.create({
    data: {
      convenioId: CONVENIO_ID_CLINICA,
      cooperativaId: TENANT_A,
      nomeConvidado: `SMOKE-1-3 ${suffix}`,
      telefone: telUnico(),
      token,
      expiresAt: new Date(Date.now() + 7 * 86400000),
      createdBy: ADMIN_USER_ID,
      otpValidadoEm: new Date(),
      permiteSemUc: false,
    },
  });
  return { conviteId: convite.id, token };
}

interface PayloadOpts {
  cpfSuffix: string;
  consumoMedioKwh?: number;
  historicoConsumo?: Array<{ mesAno: string; consumoKwh: number; valorRS: number }>;
  token: string;
  valorUltimaFatura?: number;
}

function payloadCadastro(o: PayloadOpts) {
  return {
    nome: `SMOKE 1.3 ${o.cpfSuffix}`,
    cpf: `088${o.cpfSuffix.padStart(8, '0')}`,
    email: `smoke13+${o.cpfSuffix}@example.invalid`,
    telefone: '5511999997777',
    endereco: {
      cep: '29100000',
      logradouro: 'R Y',
      numero: '2',
      bairro: 'B',
      cidade: 'Vitória',
      estado: 'ES',
    },
    instalacao: {
      numeroUC: '0002' + o.cpfSuffix.slice(-6).padStart(6, '0'),
      distribuidora: 'EDP_ES',
      consumoMedioKwh: o.consumoMedioKwh ?? 0,
    },
    historicoConsumo: o.historicoConsumo ?? [],
    valorUltimaFatura: o.valorUltimaFatura,
    token: o.token,
    origem: 'CONVITE_PUBLICO',
  };
}

async function obterJwtAdmin() {
  const admin = await prisma.usuario.findFirst({
    where: { id: ADMIN_USER_ID },
    select: { id: true, email: true, perfil: true, cooperativaId: true },
  });
  if (!admin) throw new Error(`Admin ${ADMIN_USER_ID} não encontrado`);
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET não configurado no .env do backend');
  }
  return jwt.sign(
    {
      sub: admin.id,
      userId: admin.id,
      id: admin.id,
      email: admin.email,
      perfil: admin.perfil,
      cooperativaId: admin.cooperativaId,
    },
    process.env.JWT_SECRET,
    { expiresIn: '5m' },
  );
}

async function flipEmpresaParaAdmin(membroId: string) {
  // Atalho: pula a porta da empresa (já testada em outra fatia). Vai direto
  // pra PENDENTE_APROVACAO_ADMIN simulando o fluxo natural pós magic link.
  await prisma.convenioCooperado.updateMany({
    where: { id: membroId, status: 'PENDENTE_APROVACAO_EMPRESA' },
    data: {
      status: 'PENDENTE_APROVACAO_ADMIN',
      aprovadoPorEmpresaEm: new Date(),
    },
  });
}

async function main() {
  const inicio = Date.now();

  // Cleanup pré-execução
  await prisma.aprovacaoConvenioMembro.deleteMany({
    where: { membro: { cooperado: { email: { startsWith: 'smoke13+' } } } },
  });
  await prisma.convenioCooperado.deleteMany({
    where: { cooperado: { email: { startsWith: 'smoke13+' } } },
  });
  await prisma.contrato.deleteMany({
    where: { cooperado: { email: { startsWith: 'smoke13+' } } },
  });
  await prisma.uc.deleteMany({
    where: { cooperado: { email: { startsWith: 'smoke13+' } } },
  });
  await prisma.progressaoClube.deleteMany({
    where: { cooperado: { email: { startsWith: 'smoke13+' } } },
  });
  await prisma.historicoStatusCooperado.deleteMany({
    where: { cooperado: { email: { startsWith: 'smoke13+' } } },
  });
  await prisma.propostaCooperado.deleteMany({
    where: { cooperado: { email: { startsWith: 'smoke13+' } } },
  });
  await prisma.listaEspera.deleteMany({
    where: { cooperado: { email: { startsWith: 'smoke13+' } } },
  });
  await prisma.cooperado.deleteMany({
    where: { email: { startsWith: 'smoke13+' } },
  });
  await prisma.conviteConvenioMembro.deleteMany({
    where: { nomeConvidado: { startsWith: 'SMOKE-1-3' } },
  });

  const jwtAdmin = await obterJwtAdmin();
  console.log('🔑 JWT admin gerado.');

  try {
    // ── CENÁRIO (a): caminho feliz com cota ──
    {
      const ts = Date.now().toString().slice(-7);
      const { token } = await criarConviteValidado(`feliz-${ts}`);
      const payload = payloadCadastro({
        cpfSuffix: `1${ts}`,
        consumoMedioKwh: 350,
        historicoConsumo: Array.from({ length: 6 }, (_, i) => ({
          mesAno: `0${i + 1}/2026`,
          consumoKwh: 300 + i * 10,
          valorRS: 250,
        })),
        valorUltimaFatura: 280.5,
        token,
      });

      const rCad = await fetch(`${API}/publico/cadastro-web`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!rCad.ok) {
        const data = await rCad.json().catch(() => ({}));
        fail(`(a) cadastro-web → ${rCad.status} ${JSON.stringify(data).slice(0, 200)}`);
        return;
      }
      ok(`(a) cadastro-web feliz → ${rCad.status}`);

      const cooperado = await prisma.cooperado.findFirst({
        where: { email: payload.email },
        select: { id: true, cotaKwhMensal: true, pendenciaMotorMsg: true, status: true },
      });
      if (!cooperado) {
        fail('(a) cooperado não criado');
        return;
      }
      const cota = Number(cooperado.cotaKwhMensal ?? 0);
      if (cota !== 350) fail(`(a) cotaKwhMensal esperado=350 obtido=${cota}`);
      else ok(`(a)   cotaKwhMensal=${cota} (Fatia 1.2 já persistiu)`);

      const membro = await prisma.convenioCooperado.findFirst({
        where: { cooperadoId: cooperado.id, convenioId: CONVENIO_ID_CLINICA },
        select: { id: true, status: true },
      });
      if (!membro) {
        fail('(a) membro convenio não criado pelo cadastro-web');
        return;
      }
      ok(`(a)   membro criado status=${membro.status}`);

      // Empresa aprova (atalho)
      await flipEmpresaParaAdmin(membro.id);
      ok('(a)   empresa flipou pra PENDENTE_APROVACAO_ADMIN');

      // Admin aprova via HTTP — dispara construirMembroCompleto
      const rApr = await fetch(
        `${API}/convenios/${CONVENIO_ID_CLINICA}/membros/${membro.id}/aprovar-admin`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${jwtAdmin}`,
          },
        },
      );
      const aprData = await rApr.json().catch(() => ({}));
      if (!rApr.ok) {
        fail(`(a) aprovar-admin → ${rApr.status} ${JSON.stringify(aprData).slice(0, 200)}`);
        return;
      }
      ok(`(a) aprovar-admin → ${rApr.status}`);

      // Aguarda eventual async (helper roda sync, mas notificações são fire-and-forget)
      await new Promise((res) => setTimeout(res, 800));

      const cooperadoPos = await prisma.cooperado.findUnique({
        where: { id: cooperado.id },
        select: { status: true, pendenciaMotorMsg: true, pendenciaMotorEm: true },
      });
      const contratos = await prisma.contrato.findMany({
        where: { cooperadoId: cooperado.id },
        select: {
          id: true,
          status: true,
          kwhContrato: true,
          planoId: true,
          plano: { select: { nome: true, custeadoPorConvenio: true } },
        },
      });
      const progressao = await prisma.progressaoClube.findUnique({
        where: { cooperadoId: cooperado.id },
        select: { nivelAtual: true },
      });
      if (!cooperadoPos) {
        fail('(a) cooperado sumiu pós-aprovação');
        return;
      }
      if (cooperadoPos.status !== 'ATIVO') {
        fail(`(a) status esperado=ATIVO obtido=${cooperadoPos.status}`);
      } else {
        ok(`(a)   status=${cooperadoPos.status} (flip PENDENTE→ATIVO ok)`);
      }
      if (contratos.length === 0) {
        fail('(a) nenhum contrato criado (motor falhou silenciosamente?)');
      } else {
        const c = contratos[0]!;
        ok(
          `(a)   contrato criado id=${c.id.slice(-8)} status=${c.status} ` +
            `kwh=${c.kwhContrato} ` +
            `plano="${c.plano?.nome ?? '?'}" (custeadoPorConvenio=${c.plano?.custeadoPorConvenio ?? '?'})`,
        );
        if (!c.plano?.custeadoPorConvenio) {
          fail(`(a) contrato usa plano que NÃO é custeadoPorConvenio (plano="${c.plano?.nome}")`);
        }
      }
      if (!progressao) {
        fail('(a) ProgressaoClube não foi matriculada');
      } else {
        ok(`(a)   ProgressaoClube nivel=${progressao.nivelAtual}`);
      }
      if (cooperadoPos.pendenciaMotorMsg !== null) {
        fail(`(a) pendenciaMotorMsg deveria ser null, obtido="${cooperadoPos.pendenciaMotorMsg.slice(0, 60)}..."`);
      } else {
        ok('(a)   pendenciaMotorMsg=null (limpa após sucesso)');
      }

      const membroPos = await prisma.convenioCooperado.findUnique({
        where: { id: membro.id },
        select: { status: true, ativo: true },
      });
      if (membroPos?.status !== 'MEMBRO_ATIVO' || !membroPos.ativo) {
        fail(`(a) membro status=${membroPos?.status} ativo=${membroPos?.ativo}`);
      } else {
        ok('(a)   membro MEMBRO_ATIVO + ativo=true');
      }
    }

    // ── CENÁRIO (b): sem cota (LEONARDO-like) — aprovação NÃO falha ──
    {
      const ts = Date.now().toString().slice(-7) + 'z';
      const { token } = await criarConviteValidado(`sem-cota-${ts}`);
      const payload = payloadCadastro({
        cpfSuffix: `2${ts.slice(0, 7)}`,
        consumoMedioKwh: 0,
        historicoConsumo: [],
        token,
      });

      const rCad = await fetch(`${API}/publico/cadastro-web`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!rCad.ok) {
        const data = await rCad.json().catch(() => ({}));
        fail(`(b) cadastro-web → ${rCad.status} ${JSON.stringify(data).slice(0, 200)}`);
        return;
      }
      ok(`(b) cadastro-web sem cota → ${rCad.status}`);

      const cooperado = await prisma.cooperado.findFirst({
        where: { email: payload.email },
        select: { id: true, cotaKwhMensal: true, pendenciaMotorMsg: true },
      });
      if (!cooperado) {
        fail('(b) cooperado não criado');
        return;
      }
      ok(
        `(b)   cota=${cooperado.cotaKwhMensal ?? 'null'} ` +
          `pendencia=${cooperado.pendenciaMotorMsg ? 'sim' : 'não'} (Fatia 1.2)`,
      );

      const membro = await prisma.convenioCooperado.findFirst({
        where: { cooperadoId: cooperado.id, convenioId: CONVENIO_ID_CLINICA },
        select: { id: true, status: true },
      });
      if (!membro) {
        fail('(b) membro convenio não criado');
        return;
      }

      await flipEmpresaParaAdmin(membro.id);
      ok('(b)   empresa flipou pra PENDENTE_APROVACAO_ADMIN');

      const rApr = await fetch(
        `${API}/convenios/${CONVENIO_ID_CLINICA}/membros/${membro.id}/aprovar-admin`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${jwtAdmin}`,
          },
        },
      );
      const aprData = await rApr.json().catch(() => ({}));
      if (!rApr.ok) {
        fail(
          `(b) aprovar-admin DEVERIA passar (degradação graciosa) → ${rApr.status} ${JSON.stringify(aprData).slice(0, 200)}`,
        );
        return;
      }
      ok(`(b) aprovar-admin → ${rApr.status} (aprovação NÃO falhou, mesmo sem cota)`);

      await new Promise((res) => setTimeout(res, 800));

      const cooperadoPos = await prisma.cooperado.findUnique({
        where: { id: cooperado.id },
        select: { status: true, pendenciaMotorMsg: true, pendenciaMotorEm: true },
      });
      const contratosB = await prisma.contrato.findMany({
        where: { cooperadoId: cooperado.id },
        select: { id: true, status: true },
      });
      const progressaoB = await prisma.progressaoClube.findUnique({
        where: { cooperadoId: cooperado.id },
        select: { nivelAtual: true },
      });
      if (!cooperadoPos) {
        fail('(b) cooperado sumiu pós-aprovação');
        return;
      }
      if (cooperadoPos.status !== 'ATIVO') {
        fail(`(b) status esperado=ATIVO obtido=${cooperadoPos.status}`);
      } else {
        ok(`(b)   status=${cooperadoPos.status} (flip PENDENTE→ATIVO ok)`);
      }
      if (contratosB.length > 0) {
        fail(`(b) NÃO deveria ter contrato (sem cota) — encontrou ${contratosB.length}`);
      } else {
        ok('(b)   sem contrato (correto — motor pulado)');
      }
      if (!progressaoB) {
        fail('(b) ProgressaoClube não foi matriculada (clube deveria matricular mesmo sem motor)');
      } else {
        ok(
          `(b)   ProgressaoClube nivel=${progressaoB.nivelAtual} ` +
            `(matriculou mesmo sem cota — degradação graciosa OK)`,
        );
      }
      if (!cooperadoPos.pendenciaMotorMsg) {
        fail('(b) pendenciaMotorMsg deveria estar gravada (sem cota = pendência visível)');
      } else {
        ok(
          `(b)   pendenciaMotorMsg gravada: "${cooperadoPos.pendenciaMotorMsg.slice(0, 70)}..."`,
        );
      }

      const membroPos = await prisma.convenioCooperado.findUnique({
        where: { id: membro.id },
        select: { status: true, ativo: true },
      });
      if (membroPos?.status !== 'MEMBRO_ATIVO' || !membroPos.ativo) {
        fail(`(b) membro status=${membroPos?.status} ativo=${membroPos?.ativo}`);
      } else {
        ok('(b)   membro MEMBRO_ATIVO + ativo=true (aprovação efetivada)');
      }
    }

    // ── CENÁRIO (c): idempotência — chamar aprovar-admin 2× não duplica ──
    {
      const ts = Date.now().toString().slice(-7) + 'i';
      const { token } = await criarConviteValidado(`idem-${ts}`);
      const payload = payloadCadastro({
        cpfSuffix: `3${ts.slice(0, 7)}`,
        consumoMedioKwh: 320,
        historicoConsumo: [
          { mesAno: '01/2026', consumoKwh: 300, valorRS: 240 },
          { mesAno: '02/2026', consumoKwh: 340, valorRS: 270 },
        ],
        valorUltimaFatura: 270,
        token,
      });

      const rCad = await fetch(`${API}/publico/cadastro-web`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!rCad.ok) {
        fail(`(c) cadastro-web → ${rCad.status}`);
        return;
      }
      ok(`(c) cadastro-web idempotência → ${rCad.status}`);

      const cooperado = await prisma.cooperado.findFirst({
        where: { email: payload.email },
        select: { id: true },
      });
      const membro = await prisma.convenioCooperado.findFirst({
        where: { cooperadoId: cooperado!.id, convenioId: CONVENIO_ID_CLINICA },
        select: { id: true },
      });
      await flipEmpresaParaAdmin(membro!.id);

      // 1ª chamada → MEMBRO_ATIVO + contrato + clube
      const r1 = await fetch(
        `${API}/convenios/${CONVENIO_ID_CLINICA}/membros/${membro!.id}/aprovar-admin`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${jwtAdmin}`,
          },
        },
      );
      if (!r1.ok) {
        fail(`(c) 1ª aprovar-admin → ${r1.status}`);
        return;
      }
      ok('(c)   1ª aprovar-admin OK');
      await new Promise((res) => setTimeout(res, 500));

      const ctrSnap1 = await prisma.contrato.findMany({
        where: { cooperadoId: cooperado!.id },
        select: { id: true },
      });
      const progSnap1 = await prisma.progressaoClube.findUnique({
        where: { cooperadoId: cooperado!.id },
        select: { id: true },
      });
      const ctrCount1 = ctrSnap1.length;
      const progId1 = progSnap1?.id ?? null;

      // 2ª chamada — agora membro JÁ está MEMBRO_ATIVO. Guard estrito do
      // aprovarPorAdmin retorna 400 (esperado). Idempotência aqui é:
      // estado NÃO degradou (contrato/progressão intactos).
      const r2 = await fetch(
        `${API}/convenios/${CONVENIO_ID_CLINICA}/membros/${membro!.id}/aprovar-admin`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${jwtAdmin}`,
          },
        },
      );
      if (r2.ok) {
        fail('(c) 2ª aprovar-admin DEVERIA falhar com 400 (guard estrito)');
      } else {
        ok(`(c)   2ª aprovar-admin → ${r2.status} (guard estrito ok)`);
      }
      await new Promise((res) => setTimeout(res, 300));

      const ctrSnap2 = await prisma.contrato.findMany({
        where: { cooperadoId: cooperado!.id },
        select: { id: true },
      });
      const progSnap2 = await prisma.progressaoClube.findUnique({
        where: { cooperadoId: cooperado!.id },
        select: { id: true },
      });
      const ctrCount2 = ctrSnap2.length;
      const progId2 = progSnap2?.id ?? null;

      if (ctrCount2 !== ctrCount1) {
        fail(`(c) idempotência quebrada: contratos antes=${ctrCount1} depois=${ctrCount2}`);
      } else {
        ok(`(c)   contratos intactos (${ctrCount1}) — sem duplicação`);
      }
      if (progId2 !== progId1) {
        fail(`(c) idempotência clube quebrada: id antes=${progId1} depois=${progId2}`);
      } else {
        ok('(c)   ProgressaoClube preservada (mesmo id)');
      }
    }
  } finally {
    // Cleanup (ordem reversa)
    await prisma.aprovacaoConvenioMembro
      .deleteMany({
        where: { membro: { cooperado: { email: { startsWith: 'smoke13+' } } } },
      })
      .catch(() => null);
    await prisma.listaEspera
      .deleteMany({
        where: { cooperado: { email: { startsWith: 'smoke13+' } } },
      })
      .catch(() => null);
    await prisma.convenioCooperado
      .deleteMany({
        where: { cooperado: { email: { startsWith: 'smoke13+' } } },
      })
      .catch(() => null);
    await prisma.contrato
      .deleteMany({
        where: { cooperado: { email: { startsWith: 'smoke13+' } } },
      })
      .catch(() => null);
    await prisma.propostaCooperado
      .deleteMany({
        where: { cooperado: { email: { startsWith: 'smoke13+' } } },
      })
      .catch(() => null);
    await prisma.progressaoClube
      .deleteMany({
        where: { cooperado: { email: { startsWith: 'smoke13+' } } },
      })
      .catch(() => null);
    await prisma.historicoStatusCooperado
      .deleteMany({
        where: { cooperado: { email: { startsWith: 'smoke13+' } } },
      })
      .catch(() => null);
    await prisma.uc
      .deleteMany({ where: { cooperado: { email: { startsWith: 'smoke13+' } } } })
      .catch(() => null);
    await prisma.cooperado
      .deleteMany({ where: { email: { startsWith: 'smoke13+' } } })
      .catch(() => null);
    await prisma.conviteConvenioMembro
      .deleteMany({ where: { nomeConvidado: { startsWith: 'SMOKE-1-3' } } })
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
