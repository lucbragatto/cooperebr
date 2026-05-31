/**
 * CT.1 Seed Plano de Contas Segregado — Regime COOPERATIVA (31/05/2026)
 *
 * Cria/atualiza o plano de contas com segregação por natureza cooperativa
 * (Próprio / Auxiliar / Não-Coop) + fundos obrigatórios Art. 28 Lei 5.764/71.
 *
 * Idempotente: usa upsert por código. Roda 1× por cooperativa (ou global se
 * cooperativaId=null, herdado por todas).
 *
 * NÃO cria contas pra outros regimes (CONSORCIO/ASSOCIACAO/CONDOMINIO)
 * — esses templates ficam pros sprints futuros (CT.7+).
 *
 * Rodar: `npx ts-node scripts/ct1-seed-plano-contas-cooperativa.ts`
 */
import { PrismaClient, NaturezaContabil, NaturezaCooperativa } from '@prisma/client';

const prisma = new PrismaClient();

interface ContaSeed {
  codigo: string;
  nome: string;
  tipo: string; // legado: RECEITA/DESPESA/etc
  grupo: string;
  naturezaContabil: NaturezaContabil;
  naturezaCooperativa: NaturezaCooperativa | null;
  fundamentoLegal: string;
  descricao?: string;
}

/**
 * Plano de contas mínimo defensável (parecer subagent conformidade — MVP obrigatório #2):
 * ≥6 contas segregadas + 2 fundos obrigatórios + 2 resultados separados.
 *
 * Códigos seguem estrutura hierárquica:
 *   3.1.x = Receita Ato Próprio (ingressos)
 *   3.2.x = Receita Ato Auxiliar
 *   3.3.x = Receita Não-Cooperativo
 *   5.1.x = Despesa Ato Próprio (dispêndios)
 *   5.2.x = Despesa Ato Auxiliar
 *   5.3.x = Despesa Não-Cooperativo
 *   2.4.x = Fundos Obrigatórios (Patrimônio Líquido)
 *   2.5.x = Sobras Distribuíveis (PL)
 *   2.6.x = Resultado Não-Cooperativo (PL — separado das sobras)
 */
const CONTAS_COOPERATIVA: ContaSeed[] = [
  // ── 3.1.x RECEITA ATO PRÓPRIO ──
  {
    codigo: '3.1.01',
    nome: 'Ingresso Cobranca SCEE (Cooperado)',
    tipo: 'RECEITA',
    grupo: 'RECEITAS_ATO_PROPRIO',
    naturezaContabil: NaturezaContabil.RECEITA_ATO_PROPRIO,
    naturezaCooperativa: NaturezaCooperativa.PROPRIO,
    fundamentoLegal: 'Lei 5.764/71 Art. 79 + STF Tema 536 + STJ Tema 986 (SCEE = empréstimo gratuito)',
    descricao: 'Mensalidades pagas por cooperados ativos pela energia SCEE compensada.',
  },
  // ── 3.2.x RECEITA ATO AUXILIAR ──
  {
    codigo: '3.2.01',
    nome: 'Ingresso Convenio Auxiliar (custeio)',
    tipo: 'RECEITA',
    grupo: 'RECEITAS_ATO_AUXILIAR',
    naturezaContabil: NaturezaContabil.RECEITA_ATO_AUXILIAR,
    naturezaCooperativa: NaturezaCooperativa.AUXILIAR,
    fundamentoLegal: 'Lei 5.764/71 Art. 88 (convênios de custeio — terceiro necessário ao objeto social)',
    descricao: 'Aportes recebidos de provedores externos via convênio. Trânsito não-tributado se soma de saída = entrada.',
  },
  // ── 3.3.x RECEITA NÃO COOPERATIVA ──
  {
    codigo: '3.3.01',
    nome: 'Receita Atos Nao Cooperativos',
    tipo: 'RECEITA',
    grupo: 'RECEITAS_NAO_COOPERATIVO',
    naturezaContabil: NaturezaContabil.RECEITA_NAO_COOPERATIVO,
    naturezaCooperativa: NaturezaCooperativa.NAO_COOPERATIVO,
    fundamentoLegal: 'Lei 5.764/71 Art. 86 (operações com terceiros) + Lei 9.718/98 (PIS/COFINS plenos)',
    descricao: 'Cobranças a não-associados (ex: recarga eletroposto público). Tributação plena.',
  },
  // ── 5.1.x DESPESA ATO PRÓPRIO ──
  {
    codigo: '5.1.01',
    nome: 'Dispendio Operacional Usina (Propria)',
    tipo: 'DESPESA',
    grupo: 'DESPESAS_ATO_PROPRIO',
    naturezaContabil: NaturezaContabil.DESPESA_ATO_PROPRIO,
    naturezaCooperativa: NaturezaCooperativa.PROPRIO,
    fundamentoLegal: 'Lei 5.764/71 Art. 79 (consecução do objeto social — manutenção, seguro, CUSD)',
    descricao: 'Custos operacionais das usinas para benefício coletivo dos cooperados.',
  },
  // ── 5.2.x DESPESA ATO AUXILIAR ──
  {
    codigo: '5.2.01',
    nome: 'Repasse Provedor Externo (Auxiliar)',
    tipo: 'DESPESA',
    grupo: 'DESPESAS_ATO_AUXILIAR',
    naturezaContabil: NaturezaContabil.DESPESA_ATO_AUXILIAR,
    naturezaCooperativa: NaturezaCooperativa.AUXILIAR,
    fundamentoLegal: 'Lei 5.764/71 Art. 88 — saida de convênio = entrada (sem retenção)',
    descricao: 'Repasse integral a provedores externos via convênio. Soma = entrada do 3.2.01.',
  },
  // ── 5.3.x DESPESA NÃO COOPERATIVA ──
  {
    codigo: '5.3.01',
    nome: 'Despesa Arrendamento Usina (Terceiro)',
    tipo: 'DESPESA',
    grupo: 'DESPESAS_NAO_COOPERATIVO',
    naturezaContabil: NaturezaContabil.DESPESA_NAO_COOPERATIVO,
    naturezaCooperativa: NaturezaCooperativa.NAO_COOPERATIVO,
    fundamentoLegal: 'Lei 5.764/71 Art. 86 + RIR/2018 Art. 656 (IRRF arrendamento PF/PJ)',
    descricao: 'Repasse de arrendamento ao proprietário externo da usina (não-cooperado). Sujeito a IRRF.',
  },
  // ── 2.4.x FUNDOS OBRIGATÓRIOS Art. 28 Lei 5.764/71 ──
  {
    codigo: '2.4.01',
    nome: 'Fundo de Reserva (10% sobras)',
    tipo: 'PATRIMONIO',
    grupo: 'FUNDOS_OBRIGATORIOS',
    naturezaContabil: NaturezaContabil.FUNDOS_OBRIGATORIOS,
    naturezaCooperativa: null,
    fundamentoLegal: 'Lei 5.764/71 Art. 28 I (mínimo 10% das sobras líquidas; NBC ITG 2004 item 22)',
    descricao: 'Fundo destinado a reparar perdas + desenvolver atividades. Mínimo 10% sobras.',
  },
  {
    codigo: '2.4.02',
    nome: 'FATES (5% sobras + 100% nao-coop)',
    tipo: 'PATRIMONIO',
    grupo: 'FUNDOS_OBRIGATORIOS',
    naturezaContabil: NaturezaContabil.FUNDOS_OBRIGATORIOS,
    naturezaCooperativa: null,
    fundamentoLegal: 'Lei 5.764/71 Art. 28 II + Art. 87 (resultado nao-cooperativo INTEGRAL pro FATES)',
    descricao: 'Fundo de Assistência Técnica, Educacional e Social. Mínimo 5% sobras + 100% resultado não-coop.',
  },
  // ── 2.5.x SOBRAS DISTRIBUÍVEIS ──
  {
    codigo: '2.5.01',
    nome: 'Sobras Distribuiveis',
    tipo: 'PATRIMONIO',
    grupo: 'SOBRAS_DISTRIBUIVEIS',
    naturezaContabil: NaturezaContabil.SOBRAS_DISTRIBUIVEIS,
    naturezaCooperativa: NaturezaCooperativa.PROPRIO,
    fundamentoLegal: 'Lei 5.764/71 Arts. 87+89 (apuração após fundos; rateio pro-rata operações)',
    descricao: 'Sobras líquidas após FATES + Fundo Reserva. Rateio pro-rata aos cooperados.',
  },
  // ── 2.6.x RESULTADO NÃO COOPERATIVO (separado das sobras — risco 3 parecer) ──
  {
    codigo: '2.6.01',
    nome: 'Resultado Atos Nao Cooperativos',
    tipo: 'PATRIMONIO',
    grupo: 'RESULTADO_NAO_COOPERATIVO',
    naturezaContabil: NaturezaContabil.RESULTADO_NAO_COOPERATIVO,
    naturezaCooperativa: NaturezaCooperativa.NAO_COOPERATIVO,
    fundamentoLegal: 'Lei 5.764/71 Art. 87 + IN RFB 1.700/2017 Art. 215 (separar de Sobras OBRIGATORIO)',
    descricao: 'Resultado de operações com terceiros. NUNCA misturar com sobras — vai INTEGRAL pro FATES após IRPJ/CSLL.',
  },
];

async function main() {
  console.log('\n=== CT.1 Seed Plano de Contas Segregado (COOPERATIVA) ===\n');
  console.log(`Total contas a aplicar: ${CONTAS_COOPERATIVA.length}\n`);

  // Aplicar como template global (cooperativaId=null) — cada cooperativa herda
  // por padrão; pode customizar criando contas próprias com cooperativaId.
  let criadas = 0;
  let atualizadas = 0;

  for (const conta of CONTAS_COOPERATIVA) {
    const existing = await prisma.planoContas.findUnique({ where: { codigo: conta.codigo } });
    if (existing) {
      await prisma.planoContas.update({
        where: { codigo: conta.codigo },
        data: {
          nome: conta.nome,
          tipo: conta.tipo,
          grupo: conta.grupo,
          descricao: conta.descricao,
          naturezaContabil: conta.naturezaContabil,
          naturezaCooperativa: conta.naturezaCooperativa,
          fundamentoLegal: conta.fundamentoLegal,
        },
      });
      atualizadas++;
      console.log(`  ↻ ${conta.codigo} ${conta.nome}`);
    } else {
      await prisma.planoContas.create({
        data: {
          codigo: conta.codigo,
          nome: conta.nome,
          tipo: conta.tipo,
          grupo: conta.grupo,
          descricao: conta.descricao,
          naturezaContabil: conta.naturezaContabil,
          naturezaCooperativa: conta.naturezaCooperativa,
          fundamentoLegal: conta.fundamentoLegal,
          cooperativaId: null, // template global
        },
      });
      criadas++;
      console.log(`  + ${conta.codigo} ${conta.nome}`);
    }
  }

  console.log(`\nCriadas: ${criadas} | Atualizadas: ${atualizadas}`);

  // Verifica distribuição final
  const dist = await prisma.planoContas.groupBy({
    by: ['naturezaContabil'],
    _count: true,
    where: { naturezaContabil: { not: null } },
  });
  console.log('\nDistribuição naturezaContabil:');
  dist.forEach((g) => console.log(`  ${g.naturezaContabil}: ${g._count}`));

  console.log('\n✅ Seed plano de contas COOPERATIVA aplicado.\n');
  console.log('Próximo: Walter validar nomenclatura + fundamentos legais antes da apuração real (CT.4).\n');
}

main()
  .catch((err) => {
    console.error('Erro fatal:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
