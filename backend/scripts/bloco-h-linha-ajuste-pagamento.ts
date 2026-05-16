/**
 * Ajuste H'.5/H'.6 pós-decisão Luciano 16/05:
 * - Cooperebr2: formaPagamentoDono=null (a definir pelo parceiro)
 * - Cooperebr1: formaAquisicao=ALUGUEL, formaPagamentoDono=null
 * - valorAluguelFixo e percentualGeracaoDono = null em ambas
 */
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const cooperebr2 = await prisma.usina.update({
    where: { apelidoInterno: 'cooperebr2' } as any,
    data: { formaPagamentoDono: null, valorAluguelFixo: null, percentualGeracaoDono: null },
    select: { id: true, nome: true, apelidoInterno: true, formaAquisicao: true, formaPagamentoDono: true, valorAluguelFixo: true, percentualGeracaoDono: true },
  }).catch(async () => {
    const u = await prisma.usina.findFirst({ where: { apelidoInterno: 'cooperebr2' } });
    if (!u) throw new Error('cooperebr2 não achada');
    return prisma.usina.update({
      where: { id: u.id },
      data: { formaPagamentoDono: null, valorAluguelFixo: null, percentualGeracaoDono: null },
      select: { id: true, nome: true, apelidoInterno: true, formaAquisicao: true, formaPagamentoDono: true, valorAluguelFixo: true, percentualGeracaoDono: true },
    });
  });
  console.log('Cooperebr2 ajustado:', cooperebr2);

  const cooperebr1 = await prisma.usina.update({
    where: { id: 'usina-linhares' },
    data: {
      formaAquisicao: 'ALUGUEL',
      formaPagamentoDono: null,
      valorAluguelFixo: null,
      percentualGeracaoDono: null,
    },
    select: { id: true, nome: true, apelidoInterno: true, formaAquisicao: true, formaPagamentoDono: true },
  });
  console.log('Cooperebr1 ajustado:', cooperebr1);
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
