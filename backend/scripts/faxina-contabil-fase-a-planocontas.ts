/**
 * Sprint FAXINA CONTÁBIL DO TOKEN — Fase A (PlanoContas)
 *
 * Re-review orquestrador 22/06 — escopo Q5 (recodificar 5.1.02→2.3.01) +
 * Q6 (colisão 5.1.01 com Usina). DRY-RUN obrigatório (CLAUDE.md schema).
 *
 * AÇÕES:
 *  1. Criar 5.1.10 Custo Desconto Token (DESPESA, grupo TOKENS).
 *  2. Recodificar 5.1.02 → 2.3.01 + tipo DESPESA → PASSIVO + nome igual.
 *     (2.3.01 já tomado por conta global "Transmissao/Distribuicao EDP";
 *      série 2.3.x está livre — passivos token isolados.)
 *  3. Aposentar 1.2.01 Receita Venda Tokens (ativo=false, preserva histórico).
 *  4. Criar contas de melt (sem usar ainda — gated): 1.2.10 Receita Spread
 *     Resgate, 1.2.11 Receita Taxa Circulação QR, 1.2.12 Receita Quebra
 *     Oxidação.
 *
 * Multi-tenant: para cada tenant que tem alguma conta token, replica a
 * mudança. Hoje só CoopereBR (tenant=cmn0ho8bx0000uox8wu96u6fd) tem.
 *
 * Uso:
 *   node -e "require('dotenv').config({path:'.env'}); require('ts-node').register({transpileOnly:true}); require('./scripts/faxina-contabil-fase-a-planocontas.ts');"            # DRY-RUN
 *   FAXINA_APPLY=1 node ... # APLICA
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const APPLY = process.env.FAXINA_APPLY === '1';

interface ContaNova {
  codigo: string;
  nome: string;
  tipo: 'PASSIVO' | 'DESPESA' | 'RECEITA';
  grupo: string;
  descricao?: string;
}

const CONTAS_NOVAS: ContaNova[] = [
  { codigo: '5.1.10', nome: 'Custo Desconto Token', tipo: 'DESPESA', grupo: 'TOKENS',
    descricao: 'Bonificação/desconto emitido em token (kWh excedente, FATURA_CHEIA, FLEX, BONUS_INDICACAO, SOCIAL). Faxina FaseA 22/06.' },
  { codigo: '1.2.10', nome: 'Receita Spread Resgate Token', tipo: 'RECEITA', grupo: 'TOKENS',
    descricao: 'Melt — face menos líquido pago no resgate PIX. GATED ATIVAÇÃO até parecer Walter. Faxina FaseA 22/06.' },
  { codigo: '1.2.11', nome: 'Receita Taxa Circulação QR', tipo: 'RECEITA', grupo: 'TOKENS',
    descricao: 'Melt — taxa cobrada na transferência QR entre cooperados. GATED. Faxina FaseA 22/06.' },
  { codigo: '1.2.12', nome: 'Receita Quebra Oxidação', tipo: 'RECEITA', grupo: 'TOKENS',
    descricao: 'Melt — baixa do passivo por decay (oxidação mensal). GATED. Faxina FaseA 22/06.' },
];

async function main() {
  console.log('\n=== FAXINA CONTÁBIL Fase A — PlanoContas ===');
  console.log(APPLY ? 'MODO: APLICAR (FAXINA_APPLY=1)' : 'MODO: DRY-RUN');

  // PlanoContas não tem back-relation em Cooperativa → consulta direta.
  const contas5102 = await prisma.planoContas.findMany({
    where: { codigo: '5.1.02', cooperativaId: { not: null } },
    select: { cooperativaId: true },
  });
  const tenantIds = Array.from(new Set(contas5102.map((c) => c.cooperativaId!)));
  if (tenantIds.length === 0) {
    console.log('Nenhum tenant com conta 5.1.02 — nada a fazer.');
    return;
  }
  const tenants = await prisma.cooperativa.findMany({
    where: { id: { in: tenantIds } },
    select: { id: true, nome: true },
  });
  console.log(`Tenants afetados: ${tenants.length}`);
  for (const t of tenants) console.log(`  - ${t.nome} (${t.id})`);

  for (const tenant of tenants) {
    console.log(`\n--- Tenant ${tenant.nome} ---`);

    // 1) Criar 4 contas novas (5.1.10 + 1.2.10/11/12)
    for (const nova of CONTAS_NOVAS) {
      const existe = await prisma.planoContas.findFirst({
        where: { codigo: nova.codigo, cooperativaId: tenant.id },
      });
      if (existe) {
        console.log(`  [skip] ${nova.codigo} já existe (id=${existe.id})`);
        continue;
      }
      console.log(`  [CRIAR] ${nova.codigo} ${nova.nome} [${nova.tipo}/${nova.grupo}]`);
      if (APPLY) {
        await prisma.planoContas.create({
          data: { ...nova, cooperativaId: tenant.id },
        });
      }
    }

    // 2) Recodificar 5.1.02 → 2.3.01 + DESPESA → PASSIVO
    const c5102 = await prisma.planoContas.findFirst({
      where: { codigo: '5.1.02', cooperativaId: tenant.id },
    });
    if (c5102) {
      const lancsAfetados = await prisma.lancamentoCaixa.count({
        where: { planoContasId: c5102.id },
      });
      console.log(`  [RECODIFICAR] 5.1.02 → 2.3.01 (tipo ${c5102.tipo} → PASSIVO; ${lancsAfetados} lançamentos preservados via FK)`);
      // 2.3.01 é GLOBAL @unique → checa em qualquer tenant.
      const ja2301 = await prisma.planoContas.findFirst({
        where: { codigo: '2.3.01' },
      });
      if (ja2301 && ja2301.id !== c5102.id) {
        console.log(`     [skip-recod] 2.3.01 já existe (id=${ja2301.id}) — recodificação não-idempotente, parar`);
      } else if (APPLY) {
        await prisma.planoContas.update({
          where: { id: c5102.id },
          data: { codigo: '2.3.01', tipo: 'PASSIVO' },
        });
      }
    } else {
      console.log('  [skip] 5.1.02 não existe');
    }

    // 3) Aposentar 1.2.01 (ativo=false; 0 lançamentos — preserva histórico)
    const c1201 = await prisma.planoContas.findFirst({
      where: { codigo: '1.2.01', cooperativaId: tenant.id },
    });
    if (c1201) {
      const lancs1201 = await prisma.lancamentoCaixa.count({
        where: { planoContasId: c1201.id },
      });
      if (lancs1201 > 0) {
        console.log(`  [WARN] 1.2.01 tem ${lancs1201} lançamentos — verificar antes de aposentar`);
      }
      if (c1201.ativo) {
        console.log(`  [APOSENTAR] 1.2.01 Receita Venda Tokens (ativo=false; ${lancs1201} lanç. preservados)`);
        if (APPLY) {
          await prisma.planoContas.update({
            where: { id: c1201.id },
            data: { ativo: false },
          });
        }
      } else {
        console.log('  [skip] 1.2.01 já está inativa');
      }
    } else {
      console.log('  [skip] 1.2.01 não existe');
    }
  }

  console.log('\n=== ESTADO PÓS-OPERAÇÃO (verificação) ===');
  for (const tenant of tenants) {
    const contas = await prisma.planoContas.findMany({
      where: { cooperativaId: tenant.id, OR: [
        { codigo: { startsWith: '5.1.' } },
        { codigo: { startsWith: '2.1.' } },
        { codigo: { startsWith: '1.2.' } },
      ] },
      orderBy: { codigo: 'asc' },
      select: { codigo: true, nome: true, tipo: true, ativo: true },
    });
    console.log(`\n${tenant.nome}:`);
    for (const c of contas) console.log(`  ${c.codigo} ${c.nome} [${c.tipo}] ativo=${c.ativo}`);
  }
}

main()
  .catch((err) => {
    console.error('FAXINA Fase A falhou:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
