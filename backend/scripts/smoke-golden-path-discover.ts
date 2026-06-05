/**
 * Discovery — lista o que precisamos pra montar o smoke E2E:
 *  - Cooperativa ativa (CoopereBR esperado)
 *  - Convênio ATIVO+EMPRESA pra rodar fluxo ?conv=
 *  - Cooperado ATIVO com codigoIndicacao pra rodar fluxo ?ref=
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const coops = await prisma.cooperativa.findMany({
    where: { ativo: true },
    select: { id: true, nome: true, tipoParceiro: true },
  });
  console.log('=== Cooperativas ativas ===');
  console.log(JSON.stringify(coops, null, 2));

  const convenios = await prisma.contratoConvenio.findMany({
    where: { status: 'ATIVO', pagador: 'EMPRESA' },
    select: {
      id: true,
      empresaNome: true,
      cooperativaId: true,
      pagador: true,
      status: true,
      limiteMembros: true,
      kwhAlocadoMaxMensal: true,
      baseCobrancaCusteio: true,
    },
    take: 5,
  });
  console.log('\n=== Convênios ATIVO+EMPRESA (top 5) ===');
  console.log(JSON.stringify(convenios, null, 2));

  const indicadores = await prisma.cooperado.findMany({
    where: { status: 'ATIVO' },
    select: { id: true, nomeCompleto: true, codigoIndicacao: true, cooperativaId: true },
    take: 3,
    orderBy: { createdAt: 'desc' },
  });
  console.log('\n=== Cooperados ATIVOs com codigoIndicacao (top 3) ===');
  console.log(JSON.stringify(indicadores, null, 2));

  const usuarioAdmin = await prisma.usuario.findFirst({
    where: { perfil: { in: ['ADMIN', 'SUPER_ADMIN'] } },
    select: { id: true, email: true, perfil: true, cooperativaId: true },
  });
  console.log('\n=== Usuário admin (pra createdBy de convite) ===');
  console.log(JSON.stringify(usuarioAdmin, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
