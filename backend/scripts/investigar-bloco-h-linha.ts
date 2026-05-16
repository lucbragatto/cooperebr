/**
 * Bloco H' Fase 1 read-only — estado AMAGES + Exfishes + usinas + schema atual.
 */
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log('═══ Bloco H linha — Fase 1 read-only ═══\n');

  // 1. AMAGES
  console.log('1. AMAGES (cmp7034d70002vaf0af5ws4ud):');
  const amages = await prisma.cooperado.findUnique({
    where: { id: 'cmp7034d70002vaf0af5ws4ud' },
    select: { id: true, nomeCompleto: true, cpf: true, status: true, ambienteTeste: true, email: true, cooperativaId: true, tipoPessoa: true },
  });
  console.log('  ', amages ?? '❌ NÃO encontrado');

  // 2. Exfishes
  console.log('\n2. Exfishes (cmn0ds7pi0038uols6p1arduv):');
  const exfishes = await prisma.cooperado.findUnique({
    where: { id: 'cmn0ds7pi0038uols6p1arduv' },
    select: {
      id: true, nomeCompleto: true, cpf: true, status: true, ambienteTeste: true,
      contratos: { select: { id: true, numero: true, status: true, kwhContratoAnual: true, kwhContratoMensal: true, percentualUsina: true, usinaId: true, usina: { select: { nome: true } } } },
    },
  });
  console.log('  ', JSON.stringify(exfishes, null, 2));

  // 3. Usinas
  console.log('\n3. Usinas (CoopereBR + Teste):');
  const usinas = await prisma.usina.findMany({
    where: { cooperativa: { nome: { contains: 'CoopereBR' } } },
    select: { id: true, nome: true, potenciaKwp: true, capacidadeKwh: true, distribuidora: true, statusHomologacao: true, cooperativaId: true },
    orderBy: { createdAt: 'asc' },
  });
  console.table(usinas.map(u => ({
    id: u.id.length > 18 ? u.id.slice(0, 18) + '...' : u.id,
    nome: u.nome,
    kwp: u.potenciaKwp?.toString() ?? '-',
    cap: u.capacidadeKwh?.toString() ?? '-',
    dist: u.distribuidora ?? '-',
    status: u.statusHomologacao,
    coop: u.cooperativaId?.slice(0, 8) ?? '-',
  })));

  // 4. Cooperebr2 já existe?
  console.log('\n4. Cooperebr2 já existe?');
  const cooperebr2 = await prisma.usina.findFirst({
    where: { OR: [
      { nome: { contains: 'Cooperebr 2', mode: 'insensitive' } },
      { nome: { contains: 'COOPEREBR 2', mode: 'insensitive' } },
      { nome: { contains: 'Linhares 2', mode: 'insensitive' } },
      { nome: { contains: 'cooperebr2', mode: 'insensitive' } },
    ] },
    select: { id: true, nome: true },
  });
  console.log('  ', cooperebr2 ?? '❌ NÃO existe (cadastrar em H linha.5)');

  // 5. CoopereBR id
  console.log('\n5. CoopereBR (produção real):');
  const coopBR = await prisma.cooperativa.findFirst({
    where: { nome: 'CoopereBR' },
    select: { id: true, nome: true, cnpj: true },
  });
  console.log('  ', coopBR);
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
