/**
 * Lista cooperados que TÊM FaturaProcessada (universo Concierge real).
 *
 * Filtra cooperados sintéticos:
 *   - emails `lucbragatto+[hexlong]@gmail.com` (timestamps)
 *   - cpfs com prefixo de teste
 *
 * Pra cada cooperado real, lista: nome, email, mês ref da fatura,
 * distribuidora da UC vinculada, consumo, valor compensado.
 *
 * READ-ONLY. Sem PII em arquivo — só no terminal.
 *
 * Executar:
 *   cd C:\Users\Luciano\cooperebr\backend
 *   npx ts-node scripts/listar-cooperados-com-fatura-real.ts
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

interface DadosOcr {
  consumoAtualKwh?: number;
  energiaInjetadaKwh?: number;
  valorCompensadoReais?: number;
  totalAPagar?: number;
  distribuidora?: string;
}

function ehSintetico(email: string | null, cpf: string | null): boolean {
  if (!email) return false;
  // Padrão sintético: lucbragatto+brXXX-NNNNNNNNNN@gmail.com (timestamp >= 10 dígitos)
  if (/lucbragatto\+[a-z0-9]+-\d{10,}@/i.test(email)) return true;
  // CPF prefixo teste
  if (cpf && /^[a-z]+\d*-cp-/i.test(cpf)) return true;
  return false;
}

async function main(): Promise<void> {
  const prisma = new PrismaClient();

  const cooperativas = await prisma.cooperativa.findMany({
    where: { nome: { contains: 'CoopereBR', mode: 'insensitive' } },
    select: { id: true, nome: true, _count: { select: { cooperados: true } } },
  });
  const coop = cooperativas.reduce((max, atual) =>
    atual._count.cooperados > max._count.cooperados ? atual : max,
  );
  console.log(`\nCooperativa: ${coop.nome} (id=${coop.id})\n`);

  // Todos cooperados com fatura processada
  const cooperados = await prisma.cooperado.findMany({
    where: {
      cooperativaId: coop.id,
      faturasProcessadas: { some: {} },
    },
    select: {
      id: true,
      nomeCompleto: true,
      email: true,
      cpf: true,
      cidade: true,
      cotaKwhMensal: true,
      ucs: {
        select: {
          numero: true,
          numeroUC: true,
          distribuidora: true,
        },
        take: 1,
      },
      faturasProcessadas: {
        select: {
          id: true,
          mesReferencia: true,
          dadosExtraidos: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
    orderBy: { nomeCompleto: 'asc' },
  });

  // Separa reais x sintéticos
  const reais = cooperados.filter((c) => !ehSintetico(c.email, c.cpf));
  const sinteticos = cooperados.filter((c) => ehSintetico(c.email, c.cpf));

  console.log(`Total cooperados com fatura processada: ${cooperados.length}`);
  console.log(`  Sintéticos (filtrados):                ${sinteticos.length}`);
  console.log(`  REAIS (universo Concierge):            ${reais.length}\n`);

  console.log('=== COOPERADOS REAIS COM FATURA (universo Concierge) ===\n');

  // Tabela
  const linhas: Array<{
    nome: string;
    mes: string;
    dist: string;
    cidade: string;
    consumo: number;
    compensado: number;
    pagar: number;
    id: string;
  }> = [];

  let totalCompensado = 0;
  let totalPagar = 0;
  let totalConsumo = 0;

  for (const c of reais) {
    const f = c.faturasProcessadas[0];
    if (!f) continue;
    const d = (f.dadosExtraidos as DadosOcr) ?? {};
    linhas.push({
      nome: c.nomeCompleto,
      mes: f.mesReferencia ?? '-',
      dist: c.ucs[0]?.distribuidora ?? '?',
      cidade: c.cidade ?? '?',
      consumo: Number(d.consumoAtualKwh ?? 0),
      compensado: Number(d.valorCompensadoReais ?? 0),
      pagar: Number(d.totalAPagar ?? 0),
      id: c.id,
    });
    totalConsumo += Number(d.consumoAtualKwh ?? 0);
    totalCompensado += Number(d.valorCompensadoReais ?? 0);
    totalPagar += Number(d.totalAPagar ?? 0);
  }

  // Ordena por valor compensado desc
  linhas.sort((a, b) => b.compensado - a.compensado);

  console.log(
    'Nome'.padEnd(32) +
      'Mês'.padEnd(9) +
      'Dist'.padEnd(8) +
      'Cidade'.padEnd(16) +
      'Consumo'.padStart(10) +
      'Compens'.padStart(12) +
      'Pagar'.padStart(12),
  );
  console.log('-'.repeat(99));
  for (const l of linhas) {
    console.log(
      l.nome.slice(0, 30).padEnd(32) +
        l.mes.padEnd(9) +
        l.dist.padEnd(8) +
        (l.cidade.slice(0, 14) || '?').padEnd(16) +
        l.consumo.toFixed(0).padStart(10) +
        l.compensado.toFixed(2).padStart(12) +
        l.pagar.toFixed(2).padStart(12),
    );
  }

  console.log('-'.repeat(99));
  console.log(
    'TOTAIS'.padEnd(65) +
      totalConsumo.toFixed(0).padStart(10) +
      totalCompensado.toFixed(2).padStart(12) +
      totalPagar.toFixed(2).padStart(12),
  );

  console.log(`\n=== ESTATÍSTICAS REAIS ===`);
  console.log(`Cooperados reais com fatura: ${linhas.length}`);
  console.log(`Consumo médio: ${(totalConsumo / linhas.length).toFixed(0)} kWh`);
  console.log(`Compensação média: R$ ${(totalCompensado / linhas.length).toFixed(2)}`);
  console.log(`Pagar médio: R$ ${(totalPagar / linhas.length).toFixed(2)}`);

  // Top 3 maior compensação — candidatos a caso-modelo
  console.log(`\n=== TOP 3 candidatos a caso-modelo (maior compensação) ===`);
  for (let i = 0; i < Math.min(3, linhas.length); i++) {
    const l = linhas[i];
    console.log(`  ${i + 1}. ${l.nome.padEnd(32)} | R$ ${l.compensado.toFixed(2).padStart(8)} | ${l.dist} | id=${l.id}`);
  }

  await prisma.$disconnect();
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
