/**
 * Dump completo dos dadosExtraidos da fatura de um cooperado específico.
 *
 * Aceita o cooperadoId como argumento.
 *
 * Executar:
 *   cd C:\Users\Luciano\cooperebr\backend
 *   # Luciano (real):
 *   npx ts-node scripts/dump-fatura-cooperado.ts cmn0dsh4z008euolsfqq5lcd6
 *   # ou por nome parcial:
 *   npx ts-node scripts/dump-fatura-cooperado.ts --nome="luciano costa"
 *   npx ts-node scripts/dump-fatura-cooperado.ts --nome="leonardo capucho"
 *
 * READ-ONLY.
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

async function main(): Promise<void> {
  const prisma = new PrismaClient();
  const arg = process.argv[2] ?? '';
  const nomeArg = arg.startsWith('--nome=') ? arg.slice(7).replace(/^"|"$/g, '') : null;
  const idArg = nomeArg ? null : arg;

  if (!arg) {
    console.log('Uso:');
    console.log('  npx ts-node scripts/dump-fatura-cooperado.ts <cooperadoId>');
    console.log('  npx ts-node scripts/dump-fatura-cooperado.ts --nome="<parte do nome>"');
    await prisma.$disconnect();
    return;
  }

  const cooperado = await prisma.cooperado.findFirst({
    where: nomeArg
      ? { nomeCompleto: { contains: nomeArg, mode: 'insensitive' } }
      : { id: idArg ?? '__none__' },
    select: {
      id: true,
      nomeCompleto: true,
      email: true,
      cpf: true,
      documento: true,
      cotaKwhMensal: true,
      cidade: true,
      estado: true,
      ucs: {
        select: {
          numero: true,
          numeroUC: true,
          numeroConcessionariaOriginal: true,
          distribuidora: true,
          cidade: true,
        },
      },
      faturasProcessadas: {
        select: {
          id: true,
          mesReferencia: true,
          dadosExtraidos: true,
          arquivoUrl: true,
          createdAt: true,
          mediaKwhCalculada: true,
          saldoKwhAnterior: true,
          saldoKwhAtual: true,
          valorSemDesconto: true,
          economiaGerada: true,
        },
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  if (!cooperado) {
    console.log(`❌ Nenhum cooperado encontrado por ${nomeArg ?? idArg}`);
    await prisma.$disconnect();
    return;
  }

  console.log('=== COOPERADO ===');
  console.log(`  id:         ${cooperado.id}`);
  console.log(`  nome:       ${cooperado.nomeCompleto}`);
  console.log(`  email:      ${cooperado.email}`);
  console.log(`  cpf:        ${cooperado.cpf}`);
  console.log(`  documento:  ${cooperado.documento ?? '(vazio)'}`);
  console.log(`  cota kWh:   ${cooperado.cotaKwhMensal ?? '(vazio)'}`);
  console.log(`  cidade/uf:  ${cooperado.cidade ?? '?'} / ${cooperado.estado ?? '?'}`);
  console.log(`  UCs:        ${cooperado.ucs.length}`);
  for (const uc of cooperado.ucs) {
    console.log(`    - ${uc.numero} | numeroUC=${uc.numeroUC ?? '-'} | orig=${uc.numeroConcessionariaOriginal ?? '-'} | ${uc.distribuidora} | ${uc.cidade ?? '?'}`);
  }
  console.log(`  Faturas:    ${cooperado.faturasProcessadas.length}\n`);

  for (let i = 0; i < cooperado.faturasProcessadas.length; i++) {
    const f = cooperado.faturasProcessadas[i];
    console.log(`=== FATURA ${i + 1} ===`);
    console.log(`  id:           ${f.id}`);
    console.log(`  mesRef:       ${f.mesReferencia ?? '(vazio)'}`);
    console.log(`  criada:       ${f.createdAt.toISOString().slice(0, 16)}`);
    console.log(`  mediaKwh:     ${f.mediaKwhCalculada}`);
    console.log(`  saldoAnt:     ${f.saldoKwhAnterior ?? '-'}`);
    console.log(`  saldoAtual:   ${f.saldoKwhAtual ?? '-'}`);
    console.log(`  valorSemDesc: ${f.valorSemDesconto ?? '-'}`);
    console.log(`  economiaGer:  ${f.economiaGerada ?? '-'}`);
    console.log(`  arquivoUrl:   ${f.arquivoUrl ? f.arquivoUrl.slice(0, 60) + '...' : '(vazio)'}`);
    console.log(`\n  dadosExtraidos (JSON completo):`);
    console.log(JSON.stringify(f.dadosExtraidos, null, 2));
    console.log('');
  }

  await prisma.$disconnect();
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
