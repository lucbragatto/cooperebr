/**
 * Helper diagnóstico (efêmero) — procura o token informado pelo Luciano em
 * todas as tabelas com campo `token` + mostra os 5 convites mais recentes.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const TOKEN =
    process.argv[2] ??
    '0463134d9d36cbf10df31c8fce03b391e3cc9af6c8ffe5b3ecb2211afb5fd37c';

  console.log('Buscando token nas tabelas com campo `token`...\n');

  const r1 = await prisma.conviteConvenioMembro.findUnique({
    where: { token: TOKEN },
    select: { id: true, telefone: true, expiresAt: true, usedAt: true },
  });
  console.log('ConviteConvenioMembro:', r1 ? 'ACHADO' : 'não');
  if (r1) console.log(r1);

  const r2 = await prisma.conviteProprietario.findUnique({
    where: { token: TOKEN },
    select: { id: true, email: true },
  });
  console.log('ConviteProprietario:', r2 ? 'ACHADO' : 'não');
  if (r2) console.log(r2);

  const r3 = await prisma.aprovacaoConvenioMembro.findUnique({
    where: { token: TOKEN },
    select: { id: true, membroId: true },
  });
  console.log('AprovacaoConvenioMembro:', r3 ? 'ACHADO' : 'não');
  if (r3) console.log(r3);

  console.log('\n5 últimos ConviteConvenioMembro:');
  const recent = await prisma.conviteConvenioMembro.findMany({
    take: 5,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      token: true,
      telefone: true,
      nomeConvidado: true,
      createdAt: true,
      usedAt: true,
      expiresAt: true,
      otpBloqueadoAte: true,
      otpTentativas: true,
      otpReenvios: true,
      otpValidadoEm: true,
    },
  });
  console.log(JSON.stringify(recent, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
