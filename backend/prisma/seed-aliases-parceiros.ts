/**
 * Sprint Funil M48 (22/06/2026) — Camada 1: Seed inicial de aliases.
 *
 * Cada parceiro SISGD precisa cadastrar seus próprios aliases (UI admin
 * futura — D-novo-M48-UI-ADMIN-ALIASES P2). Por enquanto seed inicial
 * com CoopereBR (parceiro piloto). Outros parceiros virão na onboarding.
 *
 * Aliases armazenados normalizados (lowercase + sem acento + sem pontuação)
 * pra match rápido. Service normaliza no insert via
 * RoteamentoCadastroService.normalizarAlias.
 */
import { PrismaClient } from '@prisma/client';
// L1 code-reviewer 22/06: importa o normalizador canônico em vez de duplicar.
// Evita divergência se o algoritmo mudar (ex: M3 NFD + \p{M}).
import { RoteamentoCadastroService } from '../src/roteamento-cadastro/roteamento-cadastro.service';

const prisma = new PrismaClient();

const COOPEREBR_ID = 'cmn0ho8bx0000uox8wu96u6fd';

const ALIASES_COOPEREBR = [
  { alias: 'cooperebr', tipo: 'NOME_CURTO' },
  { alias: 'coopere br', tipo: 'NOME_CURTO' },
  { alias: 'cooperativa cooperebr', tipo: 'NOME_CURTO' },
  { alias: 'cooperebr energia', tipo: 'MARCA_COMERCIAL' },
  { alias: 'cooperebr energia solar', tipo: 'MARCA_COMERCIAL' },
  { alias: 'cooperebr com br', tipo: 'SLUG_HISTORICO' },
];

const normalizar = RoteamentoCadastroService.normalizarAlias;

async function main() {
  console.log('Seeding aliases AliasParceiroSisgd...');

  const coop = await prisma.cooperativa.findUnique({
    where: { id: COOPEREBR_ID },
    select: { id: true, nome: true },
  });
  if (!coop) {
    console.error('[ABORT] CoopereBR não encontrada — seed-data primeiro');
    process.exit(1);
  }

  let criados = 0;
  let skipped = 0;
  for (const a of ALIASES_COOPEREBR) {
    const aliasNorm = normalizar(a.alias);
    const existente = await prisma.aliasParceiroSisgd.findFirst({
      where: { cooperativaId: COOPEREBR_ID, alias: aliasNorm },
      select: { id: true },
    });
    if (existente) {
      skipped++;
      continue;
    }
    await prisma.aliasParceiroSisgd.create({
      data: {
        cooperativaId: COOPEREBR_ID,
        alias: aliasNorm,
        tipo: a.tipo,
        ativo: true,
      },
    });
    criados++;
  }

  console.log(`Aliases CoopereBR: ${criados} criados, ${skipped} já existiam.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
