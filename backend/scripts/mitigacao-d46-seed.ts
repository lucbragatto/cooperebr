/**
 * Mitigação D-46.SEED — passo 1 do Bloco A Sub-Fase B AMAGES.
 *
 * Marca 5 planos COMPENSADOS globais publico=false ANTES de desligar
 * BLOQUEIO_MODELOS_NAO_FIXO. Sem isso, os planos vazariam na vitrine
 * pública quando o bloqueio for off.
 *
 * Idempotente: UPDATE no nome explícito, com SELECT antes/depois pra
 * auditoria.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const NOMES = [
  'Plano Residencial 15%',
  'Campanha Lançamento 20%',
  'PLANO OURO',
  'PLANO PRATA',
  'CONSUMO DE CREDITOS DE KWH',
];

async function snapshot(label: string) {
  console.log(`\n--- SELECT ${label} ---`);
  const planos = await prisma.plano.findMany({
    where: { nome: { in: NOMES } },
    select: { id: true, nome: true, publico: true, ativo: true, modeloCobranca: true, cooperativaId: true },
    orderBy: { nome: 'asc' },
  });
  console.table(planos.map(p => ({
    id: p.id.length > 14 ? p.id.slice(0, 14) + '...' : p.id,
    nome: p.nome,
    publico: p.publico,
    ativo: p.ativo,
    modelo: p.modeloCobranca,
    coop: p.cooperativaId ?? 'GLOBAL',
  })));
  return planos;
}

async function main() {
  console.log('═══ Mitigação D-46.SEED — 5 planos COMPENSADOS publico=false ═══');

  const antes = await snapshot('ANTES');

  const result = await prisma.plano.updateMany({
    where: { nome: { in: NOMES } },
    data: { publico: false },
  });
  console.log(`\nUPDATE planos SET publico=false WHERE nome IN (...) → ${result.count} rows afetadas`);

  const depois = await snapshot('DEPOIS');

  const todosFalse = depois.every(p => p.publico === false);
  if (!todosFalse) {
    console.error('\n❌ FALHOU: algum plano não ficou publico=false. Abortar.');
    process.exit(1);
  }
  console.log('\n✅ Todos os 5 planos agora publico=false. Mitigação OK.');
  console.log(`\nAuditoria: antes ${antes.filter(p => p.publico).length}/5 publico=true → depois 0/5 publico=true.`);
}

main()
  .catch(err => { console.error(err); process.exit(1); })
  .finally(() => prisma.$disconnect());
