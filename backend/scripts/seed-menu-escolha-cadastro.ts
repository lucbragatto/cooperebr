/**
 * Sprint "Qual cadastro?" Fix 2 (08/06/2026) — seed estado dinâmico
 * MENU_ESCOLHA_CADASTRO + gatilho wildcard que despacha pra ação
 * ESCOLHER_CADASTRO_COOPERADO. Idempotente.
 *
 * Fluxo:
 *   Visitante manda "1" no MENU_PRINCIPAL ("Já sou cooperado")
 *   → VERIFICAR_COOPERADO encontra 2+ cadastros
 *   → conversa.estado = MENU_ESCOLHA_CADASTRO
 *   → cooperado digita "1"/"2"/etc → gatilho wildcard → ESCOLHER_CADASTRO_COOPERADO
 *
 * MENU_ESCOLHA_CADASTRO NÃO tem modeloMensagem — a mensagem com as
 * opções é enviada inline pelo executarVerificarCooperado (texto
 * dinâmico com nomes dos cadastros).
 */
import { Prisma, PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

interface GatilhoNovo {
  resposta: string;
  proximoEstado: string;
  acao?: string;
}

async function main() {
  console.log('═══ Seed MENU_ESCOLHA_CADASTRO ═══\n');

  const estado = 'MENU_ESCOLHA_CADASTRO';
  const gatilhos: GatilhoNovo[] = [
    // Wildcard: qualquer entrada vai pra ação. Ação valida índice.
    { resposta: '*', proximoEstado: 'MENU_ESCOLHA_CADASTRO', acao: 'ESCOLHER_CADASTRO_COOPERADO' },
  ];

  const existente = await prisma.fluxoEtapa.findFirst({
    where: { estado, cooperativaId: null },
  });

  if (existente) {
    const precisaAtualizar =
      existente.acaoAutomatica !== null ||
      existente.modeloMensagemId !== null ||
      JSON.stringify(existente.gatilhos) !== JSON.stringify(gatilhos) ||
      existente.ativo !== true;
    if (precisaAtualizar) {
      await prisma.fluxoEtapa.update({
        where: { id: existente.id },
        data: {
          nome: 'Escolha de cadastro (telefone com 2+ cooperados)',
          ordem: 5,
          modeloMensagemId: null,
          gatilhos: gatilhos as unknown as Prisma.InputJsonValue,
          acaoAutomatica: null,
          ativo: true,
        },
      });
      console.log(`🔄 ATUALIZADA etapa "${estado}" id=${existente.id}`);
    } else {
      console.log(`⏭️  ja ok etapa "${estado}" id=${existente.id}`);
    }
  } else {
    const nova = await prisma.fluxoEtapa.create({
      data: {
        cooperativaId: null,
        nome: 'Escolha de cadastro (telefone com 2+ cooperados)',
        ordem: 5,
        estado,
        modeloMensagemId: null,
        gatilhos: gatilhos as unknown as Prisma.InputJsonValue,
        acaoAutomatica: null,
        ativo: true,
      },
    });
    console.log(`✅ CRIADA etapa "${estado}" id=${nova.id}`);
  }

  console.log('\n✅ Seed concluído. Reinicie o backend (PM2) pra recarregar cache.');
}

main().catch(console.error).finally(() => prisma.$disconnect());
