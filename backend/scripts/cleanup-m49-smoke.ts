/**
 * Sprint Convênio FAMÍLIA M49 (22/06/2026) — Cleanup pós-smoke.
 *
 * Re-review do orquestrador 22/06: limpar artefatos do smoke que rodou
 * na tenant CoopereBR REAL (próximos smokes vão pra CoopereBR Teste).
 *
 * NÃO deleta os 2 cooperados CAROLINA + AMAGES — eles foram criados por
 * sub-canários M46/M47 anteriores e fazem parte do histórico documentado.
 * Deletar quebraria continuidade de outras sprints + auditoria.
 *
 * Reverte SOMENTE o que o M49 smoke criou:
 *   1. AutorizacaoTokenFamiliar criada (entre PAGADORA + TITULAR).
 *   2. Saldo PAGADORA: subtrai os tokens "setup" do smoke ainda no saldo.
 *      (Os tokens abatidos já saíram via DEBITO no usarNaFatura — invariante
 *      FUNDACAO preservada, não tocar.)
 *   3. Cobranca TITULAR: reverte tokenDescontoQt + tokenDescontoReais +
 *      valorLiquido pro estado pré-abate.
 *   4. Ledger setup BONUS_INDICACAO M49 (descricao 'Smoke M49 — setup ...').
 *
 * Preserva:
 *   - AuditLog token.usar-na-fatura.familiar (auditoria forense imutável)
 *   - MensagemWhatsapp ENVIADA (histórico de comunicação real)
 *   - TokenTransacao USO_FATURA (rastro contábil do abate)
 *   - Ledger DEBITO do abate (invariante)
 */
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const EMAIL_PAGADORA = 'lucbragatto+carolina@gmail.com';
const EMAIL_TITULAR = 'lucbragatto+amages@gmail.com';
const TENANT_NOME = 'CoopereBR';

async function main() {
  console.log('\n=== M49 Cleanup pós-smoke ===\n');

  const tenant = await prisma.cooperativa.findFirstOrThrow({
    where: { nome: TENANT_NOME },
    select: { id: true },
  });
  const pagadora = await prisma.cooperado.findFirstOrThrow({
    where: { email: EMAIL_PAGADORA, cooperativaId: tenant.id },
    select: { id: true, nomeCompleto: true },
  });
  const titular = await prisma.cooperado.findFirstOrThrow({
    where: { email: EMAIL_TITULAR, cooperativaId: tenant.id },
    select: { id: true, nomeCompleto: true },
  });

  console.log(`PAGADORA: ${pagadora.nomeCompleto} (${pagadora.id})`);
  console.log(`TITULAR:  ${titular.nomeCompleto} (${titular.id})`);

  // 1) Deletar AutorizacaoTokenFamiliar do smoke
  console.log('\n[1] Deletando AutorizacaoTokenFamiliar...');
  const delAut = await prisma.autorizacaoTokenFamiliar.deleteMany({
    where: {
      cooperativaId: tenant.id,
      cooperadoPagadorId: pagadora.id,
      cooperadoTitularId: titular.id,
    },
  });
  console.log(`  removidas: ${delAut.count}`);

  // 2) Ledger setup do smoke (BONUS_INDICACAO + descricao com 'Smoke M49')
  console.log('\n[2] Deletando ledger setup do smoke (BONUS_INDICACAO + descricao smoke)...');
  const ledgers = await prisma.cooperTokenLedger.findMany({
    where: {
      cooperativaId: tenant.id,
      cooperadoId: pagadora.id,
      tipo: 'BONUS_INDICACAO',
      descricao: { contains: 'Smoke M49' },
    },
    select: { id: true, quantidade: true, createdAt: true },
  });
  let totalSetup = 0;
  for (const l of ledgers) totalSetup += Number(l.quantidade);
  console.log(`  encontrados ${ledgers.length} ledgers de setup somando ${totalSetup} tokens`);
  if (ledgers.length > 0) {
    const delLedger = await prisma.cooperTokenLedger.deleteMany({
      where: { id: { in: ledgers.map((l) => l.id) } },
    });
    console.log(`  ledgers removidos: ${delLedger.count}`);
  }

  // 3) Saldo: subtrai os tokens "setup" extra ainda no saldo da pagadora
  console.log('\n[3] Revertendo saldo PAGADORA (subtrai setup smoke)...');
  if (totalSetup > 0) {
    const saldoAtual = await prisma.cooperTokenSaldo.findUnique({
      where: { cooperadoId: pagadora.id },
      select: { saldoDisponivel: true },
    });
    const novoSaldo = Math.max(0, Number(saldoAtual?.saldoDisponivel ?? 0) - totalSetup);
    await prisma.cooperTokenSaldo.update({
      where: { cooperadoId: pagadora.id },
      data: { saldoDisponivel: novoSaldo },
    });
    console.log(`  saldo PAGADORA: ${saldoAtual?.saldoDisponivel} → ${novoSaldo}`);
  } else {
    console.log(`  nada a reverter`);
  }

  // 4) Cobrança titular: reverter tokenDescontoQt + tokenDescontoReais + valorLiquido
  // Pra cada AuditLog token.usar-na-fatura.familiar dessa cobrança, somar tokens/valor
  // e desfazer no cobranca record.
  console.log('\n[4] Revertendo cobrança TITULAR (subtrai abates do smoke)...');
  // Acha as cobranças tocadas pelo smoke via AuditLog.
  const logs = await prisma.auditLog.findMany({
    where: {
      cooperativaId: tenant.id,
      acao: 'token.usar-na-fatura.familiar',
      usuarioId: pagadora.id,
    },
    select: { recursoId: true, metadata: true },
  });
  const cobrancasAfetadas: Record<string, { tokens: number; reais: number }> = {};
  for (const l of logs) {
    const cid = l.recursoId;
    if (!cid) continue;
    const m: any = l.metadata ?? {};
    const tokens = Number(m.tokensAbatidos ?? 0);
    const reais = Number(m.valorReais ?? 0);
    if (!cobrancasAfetadas[cid]) cobrancasAfetadas[cid] = { tokens: 0, reais: 0 };
    cobrancasAfetadas[cid].tokens += tokens;
    cobrancasAfetadas[cid].reais += reais;
  }
  for (const [cid, totais] of Object.entries(cobrancasAfetadas)) {
    const cob = await prisma.cobranca.findUnique({
      where: { id: cid },
      select: { tokenDescontoQt: true, tokenDescontoReais: true, valorLiquido: true },
    });
    if (!cob) continue;
    const novoQt = Math.max(0, Number(cob.tokenDescontoQt ?? 0) - totais.tokens);
    const novoReais = Math.max(0, Number(cob.tokenDescontoReais ?? 0) - totais.reais);
    const novoValor = Number(cob.valorLiquido) + totais.reais;
    await prisma.cobranca.update({
      where: { id: cid },
      data: {
        tokenDescontoQt: Math.round(novoQt * 10000) / 10000,
        tokenDescontoReais: Math.round(novoReais * 100) / 100,
        valorLiquido: Math.round(novoValor * 100) / 100,
      },
    });
    console.log(
      `  cobranca ${cid}: tokenDescontoQt-=${totais.tokens} valorLiquido+=R$${totais.reais}`,
    );
  }
  console.log(`  total ${Object.keys(cobrancasAfetadas).length} cobranças revertidas`);

  console.log('\n=== Preservado (NÃO deletado) ===');
  console.log('  - AuditLog token.usar-na-fatura.familiar (auditoria forense)');
  console.log('  - MensagemWhatsapp ENVIADA (histórico de comunicação real)');
  console.log('  - TokenTransacao + ledger DEBITO do abate (invariante FUNDACAO)');
  console.log('  - Cooperados CAROLINA + AMAGES (criados em sub-canários M46/M47)');

  console.log('\n✅ M49 cleanup OK\n');
}

main()
  .catch((err) => {
    console.error('cleanup falhou:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
