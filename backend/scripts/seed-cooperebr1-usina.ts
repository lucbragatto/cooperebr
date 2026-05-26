/**
 * Sub-Sprint F Sessao 1 F.1 Etapa A (M30, 2026-05-26).
 *
 * Seed idempotente da Usina cooperebr1 (E-Solares) com placeholders.
 * Luciano preenche os campos faltantes via painel admin depois.
 *
 * Idempotente: se ja existe Usina com apelidoInterno='cooperebr1' na
 * cooperativa CoopereBR, NAO duplica — apenas reporta status atual.
 *
 * Execucao:
 *   ./node_modules/.bin/ts-node scripts/seed-cooperebr1-usina.ts
 */
import { PrismaClient } from '@prisma/client';

const COOPEREBR_ID = 'cmn0ho8bx0000uox8wu96u6fd';
const APELIDO = 'cooperebr1';

async function main() {
  const prisma = new PrismaClient();

  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('🌞 Seed Usina cooperebr1 (E-Solares) — Sub-Sprint F Sessao 1 Etapa A');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  // Verifica se ja existe
  const existente = await prisma.usina.findFirst({
    where: { cooperativaId: COOPEREBR_ID, apelidoInterno: APELIDO },
  });

  if (existente) {
    console.log(`⚠️  Usina cooperebr1 JA EXISTE (id=${existente.id})`);
    console.log(`    Status atual:`);
    console.log(`      nome: ${existente.nome}`);
    console.log(`      apelidoInterno: ${existente.apelidoInterno}`);
    console.log(`      proprietarioNome: ${existente.proprietarioNome ?? '(vazio)'}`);
    console.log(`      proprietarioEmail: ${existente.proprietarioEmail ?? '(vazio)'}`);
    console.log(`      proprietarioCpfCnpj: ${existente.proprietarioCpfCnpj ?? '(vazio)'}`);
    console.log(`      formaAquisicao: ${existente.formaAquisicao ?? '(vazio)'}`);
    console.log(`      formaPagamentoDono: ${existente.formaPagamentoDono ?? '(vazio)'}`);
    console.log(`      valorAluguelFixo: ${existente.valorAluguelFixo ?? '(vazio)'}`);
    console.log(`      percentualGeracaoDono: ${existente.percentualGeracaoDono ?? '(vazio)'}`);
    console.log(`      classeGdAnotada: ${existente.classeGdAnotada ?? '(vazio)'}`);
    console.log(`      distribuidora: ${existente.distribuidora}`);
    console.log(`\n    Idempotente: nao recria. Edite via painel admin pra preencher campos faltantes.`);
    await prisma.$disconnect();
    return;
  }

  // Cria nova com placeholders
  const usina = await prisma.usina.create({
    data: {
      cooperativaId: COOPEREBR_ID,
      nome: 'COOPERE BR — Usina cooperebr1',
      apelidoInterno: APELIDO,
      capacidadeKwh: 0, // Luciano preenche
      potenciaKwp: 0,    // Luciano preenche
      cidade: '',         // Luciano preenche
      estado: 'ES',
      distribuidora: 'EDP_ES',

      // Status + classeGd (pre-2023 confirmado pela Decisao 23 da sessao 25/05)
      statusHomologacao: 'CADASTRADA',
      classeGdAnotada: 'GD_I',

      // Proprietario (placeholders pra Luciano completar)
      proprietarioNome: 'E-Solares',
      proprietarioCpfCnpj: null,
      proprietarioTelefone: null,
      proprietarioEmail: null,
      proprietarioTipo: 'PJ',
      proprietarioCooperadoId: null,

      // Bloco H' (16/05 + Mini-Bloco H'.9 17/05)
      formaAquisicao: 'ALUGUEL',
      formaPagamentoDono: null, // Luciano escolhe FIXO/PERCENTUAL/HIBRIDO
      valorAluguelFixo: null,
      percentualGeracaoDono: null,
      cnpjUsina: null,
      numeroContratoEdp: null,
      dataContratoEdp: null,
    },
  });

  console.log(`✅ Usina cooperebr1 CRIADA (id=${usina.id})`);
  console.log(`\n   Cooperativa: CoopereBR (${COOPEREBR_ID})`);
  console.log(`   Apelido: ${usina.apelidoInterno}`);
  console.log(`   Distribuidora: ${usina.distribuidora}`);
  console.log(`   ClasseGD: ${usina.classeGdAnotada} (pre-2023, 0% Fio B confirmado Decisao 25/05)`);
  console.log(`   Forma aquisicao: ${usina.formaAquisicao}`);
  console.log(`   Proprietario: ${usina.proprietarioNome} (tipo=${usina.proprietarioTipo})`);

  console.log(`\n📋 PROXIMOS PASSOS LUCIANO (preencher via painel admin /dashboard/usinas/${usina.id}):`);
  console.log(`   - capacidadeKwh (kWh/mes)`);
  console.log(`   - potenciaKwp`);
  console.log(`   - cidade`);
  console.log(`   - cnpjUsina, numeroContratoEdp, dataContratoEdp`);
  console.log(`   - proprietarioCpfCnpj, proprietarioTelefone, proprietarioEmail`);
  console.log(`   - formaPagamentoDono (FIXO/PERCENTUAL/HIBRIDO)`);
  console.log(`   - valorAluguelFixo E/OU percentualGeracaoDono`);
  console.log(`   - dataInicioProducao`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error('Falha:', e);
  process.exit(1);
});
