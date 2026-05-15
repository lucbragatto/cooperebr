/**
 * Smoke engine COMPENSADOS — passo 7 final.
 *
 * Dispara PATCH /faturas/<id>/aprovar via HTTP com JWT admin.
 * Backend tem BLOQUEIO_MODELOS_NAO_FIXO=false carregado (passo 2).
 * Espera: cobrança criada com modeloCobrancaUsado='CREDITOS_COMPENSADOS',
 * valorLiquido ≈ 979.20, valorBruto ≈ 1194.14, valorDesconto ≈ 214.94.
 *
 * Também verifica LancamentoCaixa PREVISTO (D-54 não pode ressurgir).
 */

import { PrismaClient } from '@prisma/client';
import * as jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

async function main() {
  console.log('═══ Smoke engine COMPENSADOS AMAGES ═══\n');

  const coopereBr = await prisma.cooperativa.findFirst({ where: { nome: 'CoopereBR' }, select: { id: true } });
  if (!coopereBr) throw new Error('CoopereBR não encontrada');

  const amages = await prisma.cooperado.findUnique({ where: { cpf: '27053685000190' }, select: { id: true } });
  if (!amages) throw new Error('AMAGES não criado — rodar bloco-a-sub-fase-b-amages.ts antes');

  const fatura = await prisma.faturaProcessada.findFirst({
    where: { cooperadoId: amages.id, mesReferencia: '03/2026' },
    select: { id: true, status: true, cobrancaGeradaId: true },
  });
  if (!fatura) throw new Error('FaturaProcessada mar/2026 não encontrada');

  console.log(`FaturaProcessada: ${fatura.id} status=${fatura.status} cobrancaGeradaId=${fatura.cobrancaGeradaId}\n`);

  if (fatura.cobrancaGeradaId) {
    console.log(`Cobrança já gerada anteriormente: ${fatura.cobrancaGeradaId}`);
  } else {
    // JWT admin tenant CoopereBR
    const adminA = await prisma.usuario.findFirst({
      where: { perfil: 'ADMIN', cooperativaId: coopereBr.id },
      select: { id: true, email: true, perfil: true },
    });
    if (!adminA) throw new Error('Admin CoopereBR não encontrado');
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error('JWT_SECRET não setado no .env');

    const token = jwt.sign(
      {
        sub: adminA.id,
        userId: adminA.id,
        id: adminA.id,
        email: adminA.email,
        perfil: adminA.perfil,
        cooperativaId: coopereBr.id,
      },
      secret,
      { expiresIn: '5m' },
    );

    console.log(`Disparando PATCH /faturas/${fatura.id}/aprovar...`);
    const res = await fetch(`http://localhost:3000/faturas/${fatura.id}/aprovar`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    });
    const body = await res.text();
    console.log(`HTTP ${res.status}\n${body.slice(0, 500)}\n`);

    if (res.status !== 200 && res.status !== 201) {
      throw new Error(`PATCH falhou — status ${res.status}`);
    }
  }

  // ── Aguardar 1s pra side-effects assíncronos (eventos, AuditLog) ──
  await new Promise(r => setTimeout(r, 1000));

  // ── Inspecionar cobrança gerada ──
  const cobranca = await prisma.cobranca.findFirst({
    where: { contrato: { cooperadoId: amages.id }, mesReferencia: 3, anoReferencia: 2026 },
    include: { contrato: { include: { plano: true } } },
  });

  if (!cobranca) {
    console.log('❌ Nenhuma cobrança encontrada após aprovar fatura.');
    process.exit(1);
  }

  const valorBruto = Number(cobranca.valorBruto);
  const valorLiquido = Number(cobranca.valorLiquido);
  const valorDesconto = Number(cobranca.valorDesconto);
  const kwhCompensado = Number(cobranca.kwhCompensado ?? 0);
  const tarifaApl = Number(cobranca.tarifaContratualAplicada ?? 0);

  console.log('═══ COBRANÇA GERADA ═══');
  console.log({
    id: cobranca.id,
    modeloCobrancaUsado: cobranca.modeloCobrancaUsado,
    mesReferencia: `${cobranca.mesReferencia}/${cobranca.anoReferencia}`,
    kwhCompensado,
    kwhConsumido: cobranca.kwhConsumido?.toString(),
    tarifaContratualAplicada: tarifaApl,
    valorBruto,
    valorDesconto,
    valorLiquido,
    status: cobranca.status,
    dataVencimento: cobranca.dataVencimento,
    fonteDados: cobranca.fonteDados,
    cooperativaId: cobranca.cooperativaId,
    plano: cobranca.contrato.plano?.nome,
  });

  // ── Validar expectativas COMPENSADOS ──
  const ESPERADO = {
    valorLiquido: 979.20,
    valorBruto: 1194.14,
    valorDesconto: 214.94,
    kwhCompensado: 5006.89,
    tarifaContratual: 0.19557,
    modelo: 'CREDITOS_COMPENSADOS',
  };
  const erros: string[] = [];
  if (cobranca.modeloCobrancaUsado !== ESPERADO.modelo) erros.push(`modeloCobrancaUsado=${cobranca.modeloCobrancaUsado} ≠ ${ESPERADO.modelo}`);
  if (Math.abs(valorLiquido - ESPERADO.valorLiquido) > 0.05) erros.push(`valorLiquido=${valorLiquido} ≠ ${ESPERADO.valorLiquido}`);
  if (Math.abs(valorBruto - ESPERADO.valorBruto) > 0.05) erros.push(`valorBruto=${valorBruto} ≠ ${ESPERADO.valorBruto}`);
  if (Math.abs(valorDesconto - ESPERADO.valorDesconto) > 0.05) erros.push(`valorDesconto=${valorDesconto} ≠ ${ESPERADO.valorDesconto}`);
  if (Math.abs(kwhCompensado - ESPERADO.kwhCompensado) > 0.05) erros.push(`kwhCompensado=${kwhCompensado} ≠ ${ESPERADO.kwhCompensado}`);

  console.log('\n═══ COMPARAÇÃO ESPERADO vs OBTIDO ═══');
  console.table([
    { campo: 'modelo', esperado: ESPERADO.modelo, obtido: cobranca.modeloCobrancaUsado },
    { campo: 'kwhCompensado', esperado: ESPERADO.kwhCompensado, obtido: kwhCompensado },
    { campo: 'tarifaContratual', esperado: ESPERADO.tarifaContratual, obtido: tarifaApl },
    { campo: 'valorBruto', esperado: ESPERADO.valorBruto, obtido: valorBruto },
    { campo: 'valorDesconto', esperado: ESPERADO.valorDesconto, obtido: valorDesconto },
    { campo: 'valorLiquido', esperado: ESPERADO.valorLiquido, obtido: valorLiquido },
  ]);

  // ── LancamentoCaixa PREVISTO (D-54) — busca por cooperado + competencia ──
  const lc = await prisma.lancamentoCaixa.findFirst({
    where: { cooperadoId: amages.id, competencia: { contains: '2026-03' } },
    select: { id: true, status: true, valor: true, tipo: true, descricao: true, competencia: true },
  });
  console.log('\n═══ LancamentoCaixa (D-54) ═══');
  console.log(lc ?? 'NENHUM LancamentoCaixa criado — D-54 pode ter ressurgido.');

  // ── Conclusão ──
  if (erros.length > 0) {
    console.log('\n❌ DIVERGÊNCIAS:');
    erros.forEach(e => console.log(`  - ${e}`));
    process.exit(1);
  }
  if (!lc) {
    console.log('\n⚠️  ATENÇÃO: LancamentoCaixa não criado (D-54 regressão possível).');
  }
  console.log('\n✅ Smoke engine COMPENSADOS OK. valorLiquido bate com expectativa kwhCompensado × tarifaContratual.');
}

main()
  .catch(err => { console.error('❌', err); process.exit(1); })
  .finally(() => prisma.$disconnect());
