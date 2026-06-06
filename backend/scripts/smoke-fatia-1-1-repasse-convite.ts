/**
 * Smoke E2E programático — Fatia 1.1 (repasse do convite).
 *
 * Cobre:
 *  1. GET /publico/convites/:token retorna { convenioId, permiteSemUc }
 *     (frontend usa esses 2 campos pro payload do /cadastro-web).
 *  2. Convite com permiteSemUc=true devolve flag intacto.
 *  3. Token inválido NÃO vaza convenioId (defesa anti-enumeração).
 *  4. Convite cross-tenant continua escondido (vacina geral, n/a aqui).
 *
 * Bate HTTP real (backend rodando) + cleanup automático.
 */
import { PrismaClient } from '@prisma/client';
import { randomBytes } from 'crypto';

const prisma = new PrismaClient();
const API = process.env.SMOKE_API_URL ?? 'http://localhost:3000';
const TENANT_A = 'cmn0ho8bx0000uox8wu96u6fd';
const CONVENIO_ID_CLINICA = 'cmpwof5h6000avaf8547cj3pb';
const ADMIN_USER_ID = 'cmn0ds0i80000uolsxtnts907';
const TELEFONE_PROTEGIDO_BASE = '5511999988';

const failures: string[] = [];
const fail = (m: string) => { console.error('❌', m); failures.push(m); };
const ok = (m: string) => console.log('✅', m);

function telefoneUnico() {
  const d = randomBytes(2).readUInt16BE(0) % 1000;
  return TELEFONE_PROTEGIDO_BASE + d.toString().padStart(3, '0');
}

async function main() {
  const inicio = Date.now();

  // Cleanup smokes anteriores
  await prisma.conviteConvenioMembro.deleteMany({
    where: { nomeConvidado: { startsWith: 'SMOKE-1-1' } },
  });

  // Ping backend
  try {
    const r = await fetch(`${API}/publico/desconto-padrao?cooperativaId=${TENANT_A}`);
    if (!r.ok) console.warn(`⚠️  backend ping ${r.status}`);
  } catch (e: any) {
    fail(`Backend não responde em ${API}: ${e.message}`);
    process.exit(2);
  }

  const conviteComUc = randomBytes(32).toString('hex');
  const conviteSemUc = randomBytes(32).toString('hex');
  const conviteUsado = randomBytes(32).toString('hex');
  const conviteExpirado = randomBytes(32).toString('hex');
  let idConvComUc: string | null = null;
  let idConvSemUc: string | null = null;
  let idUsado: string | null = null;
  let idExpirado: string | null = null;

  try {
    // Setup: 4 convites cobrindo todos os casos
    const c1 = await prisma.conviteConvenioMembro.create({
      data: {
        convenioId: CONVENIO_ID_CLINICA,
        cooperativaId: TENANT_A,
        nomeConvidado: 'SMOKE-1-1 ComUC',
        telefone: telefoneUnico(),
        token: conviteComUc,
        expiresAt: new Date(Date.now() + 7 * 86400000),
        createdBy: ADMIN_USER_ID,
        permiteSemUc: false,
      },
    });
    idConvComUc = c1.id;

    const c2 = await prisma.conviteConvenioMembro.create({
      data: {
        convenioId: CONVENIO_ID_CLINICA,
        cooperativaId: TENANT_A,
        nomeConvidado: 'SMOKE-1-1 SemUC',
        telefone: telefoneUnico(),
        token: conviteSemUc,
        expiresAt: new Date(Date.now() + 7 * 86400000),
        createdBy: ADMIN_USER_ID,
        permiteSemUc: true, // <-- slim path
      },
    });
    idConvSemUc = c2.id;

    const c3 = await prisma.conviteConvenioMembro.create({
      data: {
        convenioId: CONVENIO_ID_CLINICA,
        cooperativaId: TENANT_A,
        nomeConvidado: 'SMOKE-1-1 Usado',
        telefone: telefoneUnico(),
        token: conviteUsado,
        expiresAt: new Date(Date.now() + 7 * 86400000),
        usedAt: new Date(),
        createdBy: ADMIN_USER_ID,
        permiteSemUc: false,
      },
    });
    idUsado = c3.id;

    const c4 = await prisma.conviteConvenioMembro.create({
      data: {
        convenioId: CONVENIO_ID_CLINICA,
        cooperativaId: TENANT_A,
        nomeConvidado: 'SMOKE-1-1 Expirado',
        telefone: telefoneUnico(),
        token: conviteExpirado,
        expiresAt: new Date(Date.now() - 86400000), // já expirou
        createdBy: ADMIN_USER_ID,
        permiteSemUc: false,
      },
    });
    idExpirado = c4.id;
    ok(`Setup: 4 convites (válido COM_UC, válido SEM_UC, usado, expirado)\n`);

    // ── 1) Convite válido COM_UC devolve { convenioId, permiteSemUc=false }
    {
      const r = await fetch(`${API}/publico/convites/${conviteComUc}`);
      const data: any = await r.json();
      if (!r.ok) fail(`1) GET válido status=${r.status}`);
      else if (data.valido !== true) fail(`1) valido != true: ${JSON.stringify(data)}`);
      else {
        if (data.convenioId !== CONVENIO_ID_CLINICA) {
          fail(`1) convenioId esperado=${CONVENIO_ID_CLINICA} obtido=${data.convenioId}`);
        } else {
          ok(`1) Convite COM_UC retorna convenioId=${data.convenioId.slice(-6)} ✓ frontend vincula convênio CERTO`);
        }
        if (data.permiteSemUc !== false) {
          fail(`1) permiteSemUc esperado=false obtido=${data.permiteSemUc}`);
        } else {
          ok(`1) Convite COM_UC retorna permiteSemUc=false ✓ exige UC no wizard`);
        }
        if (!data.empresaNome) fail(`1) empresaNome ausente`);
        else ok(`1) empresaNome="${data.empresaNome}" preservado`);
      }
    }

    // ── 2) Convite SEM_UC devolve permiteSemUc=true
    {
      const r = await fetch(`${API}/publico/convites/${conviteSemUc}`);
      const data: any = await r.json();
      if (!r.ok) fail(`2) GET SEM_UC status=${r.status}`);
      else if (data.permiteSemUc !== true) {
        fail(`2) permiteSemUc esperado=true obtido=${data.permiteSemUc} (slim path quebrado)`);
      } else {
        ok(`2) Convite SEM_UC retorna permiteSemUc=true ✓ wizard aceita slim path`);
      }
    }

    // ── 3) Convite usado → não vaza convenioId
    {
      const r = await fetch(`${API}/publico/convites/${conviteUsado}`);
      const data: any = await r.json();
      if (data.valido === true) fail(`3) Convite usado retornou valido=true`);
      else if (data.convenioId !== undefined) {
        fail(`3) Convite usado VAZOU convenioId: ${data.convenioId}`);
      } else {
        ok(`3) Convite usado: valido=false, convenioId não vazado (anti-enumeração)`);
      }
    }

    // ── 4) Convite expirado → não vaza convenioId
    {
      const r = await fetch(`${API}/publico/convites/${conviteExpirado}`);
      const data: any = await r.json();
      if (data.valido === true) fail(`4) Convite expirado retornou valido=true`);
      else if (data.convenioId !== undefined) {
        fail(`4) Convite expirado VAZOU convenioId: ${data.convenioId}`);
      } else {
        ok(`4) Convite expirado: valido=false, convenioId não vazado`);
      }
    }

    // ── 5) Token inexistente → não vaza
    {
      const r = await fetch(`${API}/publico/convites/${'z'.repeat(64)}`);
      const data: any = await r.json();
      if (data.valido !== false || data.convenioId !== undefined) {
        fail(`5) Token inexistente: ${JSON.stringify(data)}`);
      } else {
        ok(`5) Token inexistente: valido=false, sem vazamento`);
      }
    }

    // ── 6) Verifica payload completo (todos os campos)
    {
      const r = await fetch(`${API}/publico/convites/${conviteComUc}`);
      const data: any = await r.json();
      const camposEsperados = [
        'valido', 'empresaNome', 'nomeConvidado', 'telefoneSufixo',
        'expiresAt', 'otpJaValidado', 'convenioId', 'permiteSemUc',
      ];
      const faltando = camposEsperados.filter((c) => !(c in data));
      if (faltando.length) fail(`6) Campos faltando no payload: ${faltando.join(', ')}`);
      else ok(`6) Payload completo: ${camposEsperados.join(', ')}`);
      // Defesa LGPD: NÃO retornar telefone integral
      const json = JSON.stringify(data);
      if (json.match(/55\d{10,11}/)) fail(`6) Telefone integral vazou: ${json.slice(0, 200)}`);
      else ok(`6) Telefone integral NÃO vazou (LGPD preservada)`);
    }
  } finally {
    for (const id of [idConvComUc, idConvSemUc, idUsado, idExpirado]) {
      if (id) await prisma.conviteConvenioMembro.delete({ where: { id } }).catch(() => null);
    }
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
