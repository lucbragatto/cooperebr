/**
 * Identifica cooperado Luciano + fatura processada dele.
 *
 * Busca por email lucbragatto@gmail.com (case-insensitive) e variantes
 * `lucbragatto+<algo>@gmail.com` (alias Gmail). Lista UCs + FaturaProcessada
 * vinculadas e printa dump dos `dadosExtraidos` da primeira fatura encontrada.
 *
 * READ-ONLY. Sem mutação. PII fica no terminal, NÃO salva em arquivo.
 *
 * Executar:
 *   cd C:\Users\Luciano\cooperebr\backend
 *   npx ts-node scripts/identificar-fatura-luciano.ts
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

interface DadosOcrAgregados {
  titular?: string;
  documento?: string;
  enderecoInstalacao?: string;
  numero?: string;
  numeroUC?: string;
  distribuidora?: string;
  consumoAtualKwh?: number;
  energiaFornecidaKwh?: number;
  energiaInjetadaKwh?: number;
  valorCompensadoReais?: number;
  totalAPagar?: number;
  [k: string]: unknown;
}

async function main(): Promise<void> {
  const prisma = new PrismaClient();

  const cooperado = await prisma.cooperado.findFirst({
    where: {
      OR: [
        { email: { contains: 'lucbragatto', mode: 'insensitive' } },
        { nomeCompleto: { contains: 'luciano bragatto', mode: 'insensitive' } },
      ],
    },
    select: {
      id: true,
      nomeCompleto: true,
      email: true,
      cpf: true,
      documento: true,
      cotaKwhMensal: true,
      cidade: true,
      estado: true,
      cooperativa: { select: { nome: true } },
      ucs: {
        select: {
          id: true,
          numero: true,
          numeroUC: true,
          numeroConcessionariaOriginal: true,
          distribuidora: true,
          cidade: true,
          estado: true,
        },
      },
      faturasProcessadas: {
        select: {
          id: true,
          mesReferencia: true,
          dadosExtraidos: true,
          arquivoUrl: true,
          createdAt: true,
          ucId: true,
        },
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  if (!cooperado) {
    console.log('❌ Nenhum cooperado encontrado com email/nome contendo "lucbragatto" ou "Luciano Bragatto".');
    await prisma.$disconnect();
    return;
  }

  console.log('=== COOPERADO LUCIANO ENCONTRADO ===');
  console.log(`  id:              ${cooperado.id}`);
  console.log(`  nome:            ${cooperado.nomeCompleto}`);
  console.log(`  email:           ${cooperado.email}`);
  console.log(`  cpf:             ${cooperado.cpf}`);
  console.log(`  documento:       ${cooperado.documento ?? '(vazio)'}`);
  console.log(`  cota kWh/mês:    ${cooperado.cotaKwhMensal ?? '(vazio)'}`);
  console.log(`  cidade/estado:   ${cooperado.cidade ?? '?'} / ${cooperado.estado ?? '?'}`);
  console.log(`  cooperativa:     ${cooperado.cooperativa?.nome ?? '?'}`);
  console.log(`  UCs vinculadas:  ${cooperado.ucs.length}`);

  for (const uc of cooperado.ucs) {
    console.log(`    - UC ${uc.numero} | numeroUC=${uc.numeroUC ?? '-'} | original=${uc.numeroConcessionariaOriginal ?? '-'} | dist=${uc.distribuidora} | ${uc.cidade ?? '?'}/${uc.estado ?? '?'}`);
  }

  console.log(`\n  FaturaProcessada: ${cooperado.faturasProcessadas.length}`);
  if (cooperado.faturasProcessadas.length === 0) {
    console.log('  ❌ Nenhuma fatura processada. O Luciano não está no universo Concierge ainda.');
    console.log('  Causa provável: a fatura dele não foi processada ainda OU o processar-V2 não encontrou.');
    await prisma.$disconnect();
    return;
  }

  for (const f of cooperado.faturasProcessadas) {
    console.log(`    - ${f.id} | mês=${f.mesReferencia ?? '-'} | criada=${f.createdAt.toISOString().slice(0, 10)} | ucId=${f.ucId ?? '-'}`);
  }

  // Dump dos dadosExtraidos da fatura MAIS RECENTE
  const recente = cooperado.faturasProcessadas[0];
  const dados = recente.dadosExtraidos as DadosOcrAgregados;
  console.log('\n=== DUMP dadosExtraidos da fatura MAIS RECENTE ===');
  console.log(`  faturaId: ${recente.id}`);
  console.log(`  mesReferencia: ${recente.mesReferencia ?? '-'}`);
  console.log(`  arquivoUrl: ${recente.arquivoUrl ?? '(sem url salva)'}`);
  console.log('');
  console.log('  Campos disponíveis no JSON:');
  for (const [k, v] of Object.entries(dados)) {
    if (v === null || v === undefined || v === '') continue;
    const str = typeof v === 'object' ? JSON.stringify(v) : String(v);
    const display = str.length > 100 ? str.slice(0, 97) + '...' : str;
    console.log(`    ${k.padEnd(28)} = ${display}`);
  }

  // Tem rubricas detalhadas?
  const rubricas =
    (dados as { rubricas?: unknown[] }).rubricas ??
    (dados as { itensFatura?: unknown[] }).itensFatura ??
    (dados as { detalhesFaturamento?: unknown[] }).detalhesFaturamento;
  console.log('');
  if (Array.isArray(rubricas) && rubricas.length > 0) {
    console.log(`  ✅ Tem rubricas detalhadas (${rubricas.length} linhas) — pode rodar detectores Concierge!`);
  } else {
    console.log('  ⚠️  SEM rubricas detalhadas no JSON.');
    console.log('  Pra rodar os 4 detectores Concierge precisamos:');
    console.log('    (A) Re-OCR detalhado da fatura — custa ~R$ 0,30 + 5min');
    console.log('    (B) Estimativa por agregados (PIS+COFINS, ICMS sobre totais)');
    console.log('    (C) Dados manuais ditados — Luciano informa rubricas linha a linha');
  }

  await prisma.$disconnect();
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
