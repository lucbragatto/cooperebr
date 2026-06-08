/**
 * Fix dev — normaliza telefone do Luciano pra E.164 (5527981341348).
 * Sem este UPDATE o bot não reconhece "(27)98134-1348" como cooperado.
 * Aplicado uma única vez em 08/06/2026 (D-novo-WA-PHONE-NORMALIZE cataloga
 * a auditoria + migração ampla pendente).
 */
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const id = 'cmn0dsc4w005guols56peyc5h';
  const antes = await prisma.cooperado.findUnique({
    where: { id },
    select: { id: true, nomeCompleto: true, telefone: true, status: true },
  });
  console.log('ANTES:', antes);

  if (!antes) {
    console.error('Cooperado não encontrado.');
    process.exit(1);
  }

  if (antes.telefone === '5527981341348') {
    console.log('Já normalizado. Nada a fazer.');
    return;
  }

  const depois = await prisma.cooperado.update({
    where: { id },
    data: { telefone: '5527981341348' },
    select: { id: true, nomeCompleto: true, telefone: true, status: true },
  });
  console.log('DEPOIS:', depois);
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
