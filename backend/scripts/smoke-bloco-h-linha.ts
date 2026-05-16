/**
 * Smoke H'.9 — validar todas as mutações Bloco H'.
 */
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log('═══ Smoke H linha.9 — validação consolidada ═══\n');

  // 1. AMAGES com ambienteTeste=true
  const amages = await prisma.cooperado.findUnique({
    where: { id: 'cmp7034d70002vaf0af5ws4ud' },
    select: { id: true, nomeCompleto: true, ambienteTeste: true, status: true },
  });
  console.log('1. AMAGES ambienteTeste:', amages?.ambienteTeste, '→ esperado true');
  console.log('   ', amages);

  // 2. Exfishes CTR-000134 preenchido
  const ctr = await prisma.contrato.findUnique({
    where: { id: 'cmn0ds7w0003cuolsty25olf8' },
    select: { numero: true, status: true, kwhContratoAnual: true, kwhContratoMensal: true, percentualUsina: true,
      usina: { select: { nome: true, apelidoInterno: true } } },
  });
  console.log('\n2. CTR-000134 Exfishes:');
  console.log('   ', ctr);

  // 3. Cooperebr1
  const cooperebr1 = await prisma.usina.findUnique({
    where: { id: 'usina-linhares' },
    select: { id: true, nome: true, apelidoInterno: true, formaAquisicao: true, formaPagamentoDono: true, valorAluguelFixo: true, percentualGeracaoDono: true },
  });
  console.log('\n3. Cooperebr1:');
  console.log('   ', cooperebr1);

  // 4. Cooperebr2
  const cooperebr2 = await prisma.usina.findFirst({
    where: { apelidoInterno: 'cooperebr2' },
    select: {
      id: true, nome: true, apelidoInterno: true, potenciaKwp: true, capacidadeKwh: true,
      cidade: true, estado: true, distribuidora: true, statusHomologacao: true,
      enderecoLogradouro: true, enderecoNumero: true, enderecoBairro: true, enderecoCep: true,
      cnpjUsina: true, formaAquisicao: true, formaPagamentoDono: true,
      valorAluguelFixo: true, percentualGeracaoDono: true,
      numeroContratoEdp: true, dataContratoEdp: true, dataInicioProducao: true,
    },
  });
  console.log('\n4. Cooperebr2:');
  console.log('   ', JSON.stringify(cooperebr2, null, 2));

  // 5. Listagem geral
  console.log('\n5. Listagem CoopereBR usinas:');
  const list = await prisma.usina.findMany({
    where: { cooperativa: { nome: 'CoopereBR' } },
    select: { id: true, nome: true, apelidoInterno: true, formaAquisicao: true, distribuidora: true },
    orderBy: { createdAt: 'asc' },
  });
  console.table(list.map(u => ({
    id: u.id.length > 18 ? u.id.slice(0, 18) + '…' : u.id,
    nome: u.nome,
    apelido: u.apelidoInterno ?? '-',
    forma: u.formaAquisicao ?? '-',
    dist: u.distribuidora ?? '-',
  })));

  console.log('\n✅ Smoke OK');
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
