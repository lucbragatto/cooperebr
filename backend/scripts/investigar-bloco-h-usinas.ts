/**
 * Bloco H — Fase 1 read-only — investigação usinas + engine Fio B.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('═══ Bloco H Fase 1 read-only — Usinas + Fio B ═══\n');

  // 1. Todas as usinas
  const usinas = await prisma.usina.findMany({
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      nome: true,
      potenciaKwp: true,
      capacidadeKwh: true,
      producaoMensalKwh: true,
      cidade: true,
      estado: true,
      distribuidora: true,
      statusHomologacao: true,
      cooperativaId: true,
      proprietarioNome: true,
      proprietarioCpfCnpj: true,
      proprietarioCooperadoId: true,
    },
  });
  console.log('1. Total usinas:', usinas.length);
  console.table(usinas.map(u => ({
    id: u.id.length > 14 ? u.id.slice(0, 14) + '…' : u.id,
    nome: u.nome,
    kwp: u.potenciaKwp?.toString() ?? '-',
    cap: u.capacidadeKwh?.toString() ?? '-',
    prodMes: u.producaoMensalKwh?.toString() ?? '-',
    dist: u.distribuidora ?? '-',
    status: u.statusHomologacao,
    coop: u.cooperativaId?.slice(0, 8) ?? '-',
    prop: u.proprietarioNome ?? '-',
    propId: u.proprietarioCooperadoId?.slice(0, 8) ?? '-',
  })));

  // 2. Contratos ativos por usina (alocação)
  console.log('\n2. Contratos ativos por usina:');
  for (const u of usinas) {
    const aloc = await prisma.contrato.aggregate({
      where: { usinaId: u.id, status: { in: ['ATIVO', 'PENDENTE_ATIVACAO'] } },
      _sum: { kwhContratoAnual: true, kwhContratoMensal: true },
      _count: { id: true },
    });
    console.log(`  - ${u.nome}: ${aloc._count.id} contratos | alocado anual=${aloc._sum.kwhContratoAnual ?? 0} | mensal=${aloc._sum.kwhContratoMensal ?? 0}`);
  }

  // 3. Caso Exfishes — auditar concentração
  console.log('\n3. Caso Exfishes (D-30B):');
  const exfishes = await prisma.cooperado.findFirst({
    where: { nomeCompleto: { contains: 'EXFISHES', mode: 'insensitive' } },
    select: { id: true, nomeCompleto: true, status: true, cooperativaId: true, contratos: { select: { id: true, numero: true, status: true, kwhContratoAnual: true, percentualUsina: true, usinaId: true, usina: { select: { nome: true } } } } },
  });
  console.log('  ', exfishes ?? 'EXFISHES não encontrado no banco atual');

  // 4. Migracoes existentes
  console.log('\n4. Histórico de MigracaoUsina:');
  const migracoes = await prisma.migracaoUsina.findMany({
    take: 5,
    select: { id: true, cooperadoId: true, usinaOrigemId: true, usinaDestinoId: true },
  });
  console.table(migracoes);

  // 5. Cooperebr2 — verificar se já existe
  console.log('\n5. Usina cooperebr2 — busca:');
  const cooperebr2 = await prisma.usina.findFirst({
    where: { OR: [
      { nome: { contains: 'cooperebr2', mode: 'insensitive' } },
      { nome: { contains: 'COOPEREBR 2', mode: 'insensitive' } },
    ] },
    select: { id: true, nome: true },
  });
  console.log('   ', cooperebr2 ?? 'NÃO existe — precisa cadastrar (Fase 2 H.4)');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
