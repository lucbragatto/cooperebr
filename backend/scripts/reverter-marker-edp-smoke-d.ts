/**
 * Reverte marker 'lembrete_edp:1' gravado por engano no smoke D
 * (whitelist LGPD barrou envio real mas service gravou marker).
 */
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const cooperados = await prisma.cooperado.findMany({
    where: { emailFaturasObservacao: { contains: 'lembrete_edp:' } },
    select: { id: true, nomeCompleto: true, emailFaturasObservacao: true },
  });
  console.log(`Encontrados ${cooperados.length} cooperados com marker lembrete_edp:`);
  for (const c of cooperados) {
    const obs = c.emailFaturasObservacao ?? '';
    const novaObs = obs
      .split(';')
      .filter(s => !s.startsWith('lembrete_edp:'))
      .join(';');
    await prisma.cooperado.update({
      where: { id: c.id },
      data: { emailFaturasObservacao: novaObs || null },
    });
  }
  console.log(`✅ ${cooperados.length} cooperados revertidos`);
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
