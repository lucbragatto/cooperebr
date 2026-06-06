/**
 * Smoke E2E programático — Fatia 1.2 (cota + pendência visível + stash).
 *
 * Cobre:
 *  1. Cadastro via convite custeio (caminho feliz) → cotaKwhMensal>0 +
 *     consumoStashOcr populado + pendenciaMotorMsg=null.
 *  2. Cadastro com consumo zero → motor falha → pendenciaMotorMsg gravada
 *     (admin vê selo "Cadastro incompleto").
 *  3. Cadastro com só histórico (sem consumoMedioKwh direto) → média do
 *     histórico vira cotaKwhMensal.
 *  4. Stash do consumo preserva historicoConsumo pra reconciliação futura.
 *
 * NÃO mocka — bate o controller via HTTP. Cleanup automático.
 */
import { PrismaClient } from '@prisma/client';
import { randomBytes } from 'crypto';

const prisma = new PrismaClient();
const API = process.env.SMOKE_API_URL ?? 'http://localhost:3000';
const TENANT_A = 'cmn0ho8bx0000uox8wu96u6fd';
const CONVENIO_ID_CLINICA = 'cmpwof5h6000avaf8547cj3pb';
const ADMIN_USER_ID = 'cmn0ds0i80000uolsxtnts907';

const failures: string[] = [];
const fail = (m: string) => { console.error('❌', m); failures.push(m); };
const ok = (m: string) => console.log('✅', m);

function telUnico() {
  const d = randomBytes(2).readUInt16BE(0) % 1000;
  return '5511999988' + d.toString().padStart(3, '0');
}

async function criarConviteValidado(suffix: string, opts?: { permiteSemUc?: boolean }) {
  const token = randomBytes(32).toString('hex');
  const convite = await prisma.conviteConvenioMembro.create({
    data: {
      convenioId: CONVENIO_ID_CLINICA,
      cooperativaId: TENANT_A,
      nomeConvidado: `SMOKE-1-2 ${suffix}`,
      telefone: telUnico(),
      token,
      expiresAt: new Date(Date.now() + 7 * 86400000),
      createdBy: ADMIN_USER_ID,
      otpValidadoEm: new Date(), // bypass OTP em DEV
      permiteSemUc: opts?.permiteSemUc ?? false,
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
    nome: `SMOKE 1.2 ${o.cpfSuffix}`,
    cpf: `099${o.cpfSuffix.padStart(8, '0')}`,
    email: `smoke12+${o.cpfSuffix}@example.invalid`,
    telefone: '5511999998888',
    endereco: {
      cep: '29100000', logradouro: 'R X', numero: '1',
      bairro: 'B', cidade: 'Vitória', estado: 'ES',
    },
    instalacao: {
      numeroUC: '0001' + o.cpfSuffix.slice(-6).padStart(6, '0'),
      distribuidora: 'EDP_ES',
      consumoMedioKwh: o.consumoMedioKwh ?? 0,
    },
    historicoConsumo: o.historicoConsumo ?? [],
    valorUltimaFatura: o.valorUltimaFatura,
    token: o.token,
    origem: 'CONVITE_PUBLICO',
  };
}

async function main() {
  const inicio = Date.now();

  // Cleanup
  await prisma.convenioCooperado.deleteMany({ where: { cooperado: { email: { startsWith: 'smoke12+' } } } });
  await prisma.aprovacaoConvenioMembro.deleteMany({ where: { membro: { cooperado: { email: { startsWith: 'smoke12+' } } } } });
  await prisma.uc.deleteMany({ where: { cooperado: { email: { startsWith: 'smoke12+' } } } });
  await prisma.cooperado.deleteMany({ where: { email: { startsWith: 'smoke12+' } } });
  await prisma.conviteConvenioMembro.deleteMany({ where: { nomeConvidado: { startsWith: 'SMOKE-1-2' } } });

  try {
    // ── CENÁRIO 1: caminho feliz com consumo direto + histórico ──
    {
      const ts = Date.now().toString().slice(-7);
      const { conviteId, token } = await criarConviteValidado(`feliz-${ts}`);
      const payload = payloadCadastro({
        cpfSuffix: `1${ts}`,
        consumoMedioKwh: 350,
        historicoConsumo: Array.from({ length: 6 }, (_, i) => ({
          mesAno: `0${i + 1}/2026`, consumoKwh: 300 + i * 10, valorRS: 250,
        })),
        valorUltimaFatura: 280.5,
        token,
      });

      const r = await fetch(`${API}/publico/cadastro-web`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data: any = await r.json();
      if (!r.ok) {
        fail(`1) POST cadastro-web feliz → ${r.status} ${JSON.stringify(data)}`);
      } else {
        ok(`1) POST cadastro-web feliz → ${r.status}`);
        // Verificar cooperado no banco
        const c = await prisma.cooperado.findFirst({
          where: { email: payload.email },
          select: {
            id: true, cotaKwhMensal: true, consumoStashOcr: true,
            pendenciaMotorMsg: true, pendenciaMotorEm: true,
          },
        });
        if (!c) fail(`1) cooperado não criado`);
        else {
          const cota = Number(c.cotaKwhMensal ?? 0);
          if (cota !== 350) fail(`1) cotaKwhMensal esperado=350 obtido=${cota}`);
          else ok(`1)   cotaKwhMensal=${cota} ✓ (consumoMedioKwh direto)`);

          const stash = c.consumoStashOcr as any;
          if (!stash) fail(`1) consumoStashOcr null (esperado preenchido)`);
          else {
            if (stash.consumoMedioKwh !== 350) fail(`1) stash.consumoMedioKwh ${stash.consumoMedioKwh}`);
            else if (!Array.isArray(stash.historicoConsumo) || stash.historicoConsumo.length !== 6) {
              fail(`1) stash.historicoConsumo len=${stash.historicoConsumo?.length}`);
            } else if (stash.valorUltimaFatura !== 280.5) fail(`1) stash.valorUltimaFatura ${stash.valorUltimaFatura}`);
            else ok(`1)   consumoStashOcr OK (consumoMedio=${stash.consumoMedioKwh}, ${stash.historicoConsumo.length} meses, valor=${stash.valorUltimaFatura})`);
          }
        }
      }
    }

    // ── CENÁRIO 2: consumo zero → motor estoura → pendência VISÍVEL ──
    {
      const ts = Date.now().toString().slice(-7) + 'x';
      const { token } = await criarConviteValidado(`pend-${ts}`);
      const payload = payloadCadastro({
        cpfSuffix: `2${ts.slice(0, 7)}`,
        consumoMedioKwh: 0, // <-- consumo ZERO (caso LEONARDO)
        historicoConsumo: [],
        token,
      });

      const r = await fetch(`${API}/publico/cadastro-web`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data: any = await r.json();
      if (!r.ok) {
        // Pode ser 200 (motor falhou silenciosamente) ou 400 (gate de consumo).
        // Em DEV (consumo aceita 0) → cadastro completa mas motor estoura.
        fail(`2) POST cadastro-web → ${r.status} ${JSON.stringify(data).slice(0, 200)}`);
      } else {
        ok(`2) POST cadastro-web (consumo=0) → ${r.status} (cadastro completou)`);
        // Aguarda hook async
        await new Promise((res) => setTimeout(res, 1500));
        const c = await prisma.cooperado.findFirst({
          where: { email: payload.email },
          select: {
            id: true, cotaKwhMensal: true, pendenciaMotorMsg: true,
            pendenciaMotorEm: true, consumoStashOcr: true,
          },
        });
        if (!c) fail(`2) cooperado não criado`);
        else {
          if (c.pendenciaMotorMsg === null) {
            fail(`2) pendenciaMotorMsg null — esperado mensagem do motor`);
          } else {
            ok(`2)   pendenciaMotorMsg gravada: "${c.pendenciaMotorMsg.slice(0, 80)}..."`);
          }
          if (!c.pendenciaMotorEm) fail(`2) pendenciaMotorEm null`);
          else ok(`2)   pendenciaMotorEm=${c.pendenciaMotorEm.toISOString()}`);
          const cota = Number(c.cotaKwhMensal ?? 0);
          if (cota > 0) fail(`2) cotaKwhMensal=${cota} esperado 0/null`);
          else ok(`2)   cotaKwhMensal=null (sem consumo capturado, correto)`);
        }
      }
    }

    // ── CENÁRIO 3: só histórico (sem consumoMedioKwh direto) → média ──
    {
      const ts = Date.now().toString().slice(-7) + 'y';
      const { token } = await criarConviteValidado(`media-${ts}`);
      const payload = payloadCadastro({
        cpfSuffix: `3${ts.slice(0, 7)}`,
        consumoMedioKwh: 0, // ausente
        historicoConsumo: [
          { mesAno: '01/2026', consumoKwh: 100, valorRS: 50 },
          { mesAno: '02/2026', consumoKwh: 200, valorRS: 100 },
          { mesAno: '03/2026', consumoKwh: 300, valorRS: 150 },
        ],
        token,
      });

      const r = await fetch(`${API}/publico/cadastro-web`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!r.ok) {
        const data = await r.json();
        fail(`3) POST cadastro-web → ${r.status} ${JSON.stringify(data).slice(0, 200)}`);
      } else {
        ok(`3) POST cadastro-web (só histórico) → ${r.status}`);
        const c = await prisma.cooperado.findFirst({
          where: { email: payload.email },
          select: { cotaKwhMensal: true, consumoStashOcr: true },
        });
        if (!c) fail(`3) cooperado não criado`);
        else {
          const cota = Number(c.cotaKwhMensal ?? 0);
          // Média de 100+200+300 = 200
          if (cota !== 200) fail(`3) cotaKwhMensal esperado=200 obtido=${cota}`);
          else ok(`3)   cotaKwhMensal=${cota} ✓ (média do histórico)`);
        }
      }
    }
  } finally {
    // Cleanup ordem: AprovacaoConvenioMembro → ConvenioCooperado → Uc → Cooperado → Convite
    await prisma.aprovacaoConvenioMembro.deleteMany({ where: { membro: { cooperado: { email: { startsWith: 'smoke12+' } } } } }).catch(() => null);
    await prisma.convenioCooperado.deleteMany({ where: { cooperado: { email: { startsWith: 'smoke12+' } } } }).catch(() => null);
    await prisma.contrato.deleteMany({ where: { cooperado: { email: { startsWith: 'smoke12+' } } } }).catch(() => null);
    await prisma.uc.deleteMany({ where: { cooperado: { email: { startsWith: 'smoke12+' } } } }).catch(() => null);
    await prisma.cooperado.deleteMany({ where: { email: { startsWith: 'smoke12+' } } }).catch(() => null);
    await prisma.conviteConvenioMembro.deleteMany({ where: { nomeConvidado: { startsWith: 'SMOKE-1-2' } } }).catch(() => null);
    console.log(`\n🧹 Cleanup OK`);
  }

  const dur = ((Date.now() - inicio) / 1000).toFixed(1);
  console.log(`\n══════ RESUMO ══════`);
  console.log(`Duração: ${dur}s`);
  console.log(`Falhas:  ${failures.length}`);
  if (failures.length === 0) console.log('\n✅ TODOS OS PASSOS PASSARAM');
  else { console.log('\n❌ FALHAS:'); failures.forEach((f) => console.log(`  - ${f}`)); }
  process.exit(failures.length === 0 ? 0 : 1);
}

main()
  .catch((e) => { console.error('FATAL:', e); process.exit(2); })
  .finally(() => prisma.$disconnect());
