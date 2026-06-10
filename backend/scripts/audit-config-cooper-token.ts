/**
 * Audit F1.5 — quantas linhas em ConfigCooperToken existem hoje e quais valores
 * têm. Pré-requisito da Decisão 23 (schema delta exige auditoria).
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const total = await prisma.configCooperToken.count();
  const linhas = await prisma.configCooperToken.findMany({
    select: {
      cooperativaId: true,
      modoGeracao: true,
      modeloVida: true,
      limiteTokenMensal: true,
      valorTokenReais: true,
      descontoMaxPerc: true,
      bonusIndicacao: true,
      tetoCoop: true,
      ativo: true,
      cooperativa: { select: { nome: true, ativo: true } },
    },
  });
  console.log(`[audit] total: ${total}`);
  for (const r of linhas) {
    console.log(
      `[audit]   coop="${r.cooperativa.nome}" (ativo=${r.cooperativa.ativo}) | modoGeracao=${r.modoGeracao} modeloVida=${r.modeloVida} | valor=${r.valorTokenReais} desc=${r.descontoMaxPerc}% bonus=${r.bonusIndicacao} teto=${r.tetoCoop ?? '-'} limite=${r.limiteTokenMensal ?? '-'} ativo=${r.ativo}`,
    );
  }
  // Quantas cooperativas existem (pra estimar diff entre cooperativas com config vs sem)
  const totalCoops = await prisma.cooperativa.count();
  const coopsAtivas = await prisma.cooperativa.count({ where: { ativo: true } });
  console.log(`[audit] cooperativas no banco: total=${totalCoops} ativas=${coopsAtivas}`);
  console.log(`[audit] cooperativas SEM ConfigCooperToken: ${totalCoops - total}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
