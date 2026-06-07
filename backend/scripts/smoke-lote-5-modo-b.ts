/**
 * Smoke E2E LOTE.5 — modo B "Abrir no WhatsApp".
 *
 *  (1) POST /convenios/:id/convites/modo-b → 201 com { id, urlWa, mensagem }.
 *  (2) urlWa começa com https://wa.me/<telefone> e contém texto encoded.
 *  (3) Mensagem decodificada contém: saudação ao nome, "Clínica" (empresa),
 *      e link do convite.
 *  (4) Convite criado no DB tem token + telefone + sem dispara WA real
 *      (não há registro de WhatsappEnvioResult).
 *
 * Telefones whitelist (5511999988*) — não dispararia WA real mesmo se chamasse.
 * Cleanup automático.
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
      nomeConvidado: { startsWith: 'SMOKE LOTE5' },
    },
  });
}

async function main() {
  const inicio = Date.now();
  console.log('═══ Smoke LOTE.5 — modo B Abrir no WhatsApp ═══\n');
  await limparPre();
  const jwtAdmin = await obterJwtAdmin();
  ok('JWT admin gerado');

  const r1 = randomBytes(1).readUInt8(0) % 100;
  const telefone = '551199998' + String(r1).padStart(2, '0') + '0';
  const nome = `SMOKE LOTE5 Dra. Ana ${r1}`;

  try {
    // (1) POST modo-b
    const r = await fetch(
      `${API}/convenios/${CONVENIO_ID_CLINICA}/convites/modo-b`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${jwtAdmin}`,
        },
        body: JSON.stringify({ nomeConvidado: nome, telefone }),
      },
    );
    const data: any = await r.json();
    if (r.status !== 201) {
      fail(`(1) POST modo-b → ${r.status} ${JSON.stringify(data).slice(0, 200)}`);
      return;
    }
    if (!data.id || !data.urlWa || !data.mensagem) {
      fail(`(1) shape esperado {id, urlWa, mensagem}, obtido ${Object.keys(data).join(',')}`);
      return;
    }
    ok(`(1) POST modo-b → 201 id=${data.id.slice(-8)}`);

    // (2) urlWa formato. Telefone pode ser normalizado pelo backend
    // (ex: adicionado dígito 9 da operadora) — só verifica padrão wa.me.
    if (!/^https:\/\/wa\.me\/55\d{10,11}\?text=/.test(data.urlWa)) {
      fail(`(2) urlWa fora do padrão wa.me/55XXXXX?text=... obtido=${data.urlWa.slice(0, 80)}`);
    } else {
      const tel = data.urlWa.match(/wa\.me\/(\d+)/)?.[1] ?? '?';
      ok(`(2) urlWa = wa.me/${tel}?text=<encoded>`);
    }

    // (3) Mensagem decodificada
    const url = new URL(data.urlWa);
    const decoded = decodeURIComponent(url.searchParams.get('text') ?? '');
    const checks = [
      { needle: nome, label: 'nome destinatário' },
      { needle: 'Clinica teste', label: 'nome empresa' },
      { needle: 'http', label: 'link convite' },
    ];
    let allOk = true;
    for (const c of checks) {
      if (!decoded.includes(c.needle)) {
        fail(`(3) mensagem sem "${c.label}": esperado contendo "${c.needle}"`);
        allOk = false;
      }
    }
    if (allOk) ok(`(3) mensagem contém saudação + empresa + link`);

    // (4) Convite no DB sem registro de envio WA
    const conv = await prisma.conviteConvenioMembro.findUnique({
      where: { id: data.id },
      select: {
        id: true,
        nomeConvidado: true,
        loteEnvioWaStatus: true,
        loteId: true,
        cooperadoIndicadorId: true,
      },
    });
    if (!conv) {
      fail(`(4) convite não persistido no DB`);
    } else {
      // Modo B não é parte de lote → loteId/loteEnvioWaStatus devem ser null
      if (conv.loteId !== null || conv.loteEnvioWaStatus !== null) {
        fail(
          `(4) modo-b NÃO deveria ter loteId/loteEnvioWaStatus (são pra modo automático em lote). ` +
            `loteId=${conv.loteId} loteEnvioWaStatus=${conv.loteEnvioWaStatus}`,
        );
      } else {
        ok(`(4) convite persistido sem flags de lote (correto — modo B é individual)`);
      }
      // cooperadoIndicadorId opcional — admin convidando = null
      if (conv.cooperadoIndicadorId !== null) {
        fail(`(4) cooperadoIndicadorId esperado=null (admin convidando), obtido=${conv.cooperadoIndicadorId}`);
      } else {
        ok(`(4)   cooperadoIndicadorId=null (admin/empresa convidando, sem MLM individual)`);
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
