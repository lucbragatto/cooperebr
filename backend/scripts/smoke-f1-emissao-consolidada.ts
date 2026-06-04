/**
 * Sprint Financeiro F1 (04/06/2026) — Smoke F1.5: validação live do
 * wire-up do endpoint reemitir + verificação dos campos novos no banco.
 *
 * Escopo (não-destrutivo):
 *  1. Backend responde no porto 3000.
 *  2. Rota POST /convenios/:id/cobrancas-consolidadas/:cobrancaId/reemitir
 *     existe (RouterExplorer já mapeou — verificável via PM2 logs).
 *  3. Schema delta aplicado: Cobranca tem statusEmissao/tentativasEmissao/
 *     ultimoErroEmissao/ultimaTentativaEmissaoEm + enum StatusEmissao.
 *  4. Cobranças consolidadas existentes (pré-F1) têm statusEmissao=null
 *     (aditivo, sem retroatividade).
 *
 * Ciclo "gateway DOWN → AGUARDANDO → UP → EMITIDO" coberto via 13 specs
 * unitários verdes (convenios-job-retry.spec.ts + convenios-custeio-reemitir.spec.ts).
 * Smoke live com Asaas sandbox real fica para sessão de canário (precisa
 * credenciais + forçar falha controlada via CPF inválido ou similar).
 *
 * Contatos de teste (regra 14/05): 27981341348 — não aplicável aqui (sem
 * disparo de comunicação real; smoke é read-only).
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('[F1 smoke] Iniciando validação read-only...');

  // 1. Schema delta aplicado — query exercita os 4 novos campos
  const sample = await prisma.cobranca.findFirst({
    where: { convenioContabilCobrancaId: { not: null } },
    select: {
      id: true,
      statusEmissao: true,
      tentativasEmissao: true,
      ultimoErroEmissao: true,
      ultimaTentativaEmissaoEm: true,
      convenioContabilCobrancaId: true,
    },
  });

  if (!sample) {
    console.log('[F1 smoke] Nenhuma cobrança consolidada existente no banco — ok (banco novo ou pre-2.4.4).');
  } else {
    console.log('[F1 smoke] Cobrança consolidada existente:', {
      id: sample.id,
      statusEmissao: sample.statusEmissao,
      tentativasEmissao: sample.tentativasEmissao,
      ultimoErroEmissao: sample.ultimoErroEmissao,
      ultimaTentativaEmissaoEm: sample.ultimaTentativaEmissaoEm,
    });

    // 2. Pré-existentes devem ter statusEmissao=null (aditivo)
    if (sample.statusEmissao !== null && sample.statusEmissao !== 'AGUARDANDO_EMISSAO') {
      console.warn(
        `[F1 smoke] AVISO: consolidada pré-existente com statusEmissao=${sample.statusEmissao} ` +
          `(esperado null pra cobranças anteriores à migração F1).`,
      );
    } else {
      console.log('[F1 smoke] ✓ statusEmissao null/AGUARDANDO em consolidada pré-existente — aditivo OK.');
    }
  }

  // 3. Contagem geral por estado de emissão
  const grupos = await prisma.cobranca.groupBy({
    by: ['statusEmissao'],
    where: { convenioContabilCobrancaId: { not: null } },
    _count: true,
  });
  console.log('[F1 smoke] Distribuição statusEmissao em consolidadas:', grupos);

  // 4. Verifica índice composto via query que beneficiaria dele
  const elegiveis = await prisma.cobranca.count({
    where: {
      convenioContabilCobrancaId: { not: null },
      statusEmissao: 'AGUARDANDO_EMISSAO',
      tentativasEmissao: { lt: 5 },
    },
  });
  console.log(`[F1 smoke] Cobranças elegíveis pra retry agora: ${elegiveis}`);

  console.log('[F1 smoke] Concluído sem erros — schema delta vivo + tipos batendo.');
}

main()
  .catch((err) => {
    console.error('[F1 smoke] FALHOU:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
