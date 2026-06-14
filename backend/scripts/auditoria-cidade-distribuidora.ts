/**
 * AUDITORIA prévia — mapeia cidade → distribuidora pra UCs CoopereBR.
 *
 * Read-only. Roda DRY-RUN do que um UPDATE em massa faria.
 *
 * NÃO ALTERA o banco. Só relata.
 *
 * Saída:
 *   1. Lista de cidades únicas e quantas UCs cada uma tem
 *   2. Sugestão de distribuidora por cidade (EDP_ES, ELFSM ou ?)
 *   3. Quantas UCs seriam afetadas em cada bucket
 *   4. UCs sem cidade preenchida (precisam de tratamento manual)
 *
 * REGRA INEGOCIÁVEL (CLAUDE.md Sprint 11):
 *   Antes de qualquer UPDATE em massa, auditar dados afetados + pedir
 *   autorização explícita do Luciano.
 *
 * Executar:
 *   cd C:\Users\Luciano\cooperebr\backend
 *   npx ts-node scripts/auditoria-cidade-distribuidora.ts
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

/**
 * Mapeamento cidade → distribuidora correta.
 *
 * EDP_ES: atende maior parte do ES (área de concessão histórica EDP).
 * ELFSM:  atende região serrana sul (concessão histórica Luz e Força
 *         Santa Maria desde 1968). Cidades-cabeça: Santa Maria de Jetibá,
 *         Vargem Alta, Mimoso do Sul, etc.
 *
 * Fonte: ANEEL — mapa de áreas de concessão ES.
 *
 * Cidades não listadas aqui ficam como '?' e exigem revisão manual.
 */
const MAPA_CIDADE_DISTRIBUIDORA: Record<string, 'EDP_ES' | 'ELFSM'> = {
  // EDP_ES — Grande Vitória + litoral + norte ES (maioria)
  vitoria: 'EDP_ES',
  'vila velha': 'EDP_ES',
  serra: 'EDP_ES',
  cariacica: 'EDP_ES',
  viana: 'EDP_ES',
  guarapari: 'EDP_ES',
  linhares: 'EDP_ES',
  'sao mateus': 'EDP_ES',
  colatina: 'EDP_ES',
  cachoeiro: 'EDP_ES',
  'cachoeiro de itapemirim': 'EDP_ES',
  aracruz: 'EDP_ES',
  'jose de freitas': 'EDP_ES',
  'nova venecia': 'EDP_ES',
  marataizes: 'EDP_ES',
  anchieta: 'EDP_ES',
  itapemirim: 'EDP_ES',
  piuma: 'EDP_ES',
  iconha: 'EDP_ES',
  alegre: 'EDP_ES',
  baixo: 'EDP_ES',
  domingos: 'EDP_ES',
  fundao: 'EDP_ES',
  ibatiba: 'EDP_ES',
  iuna: 'EDP_ES',
  jaguare: 'EDP_ES',
  marilandia: 'EDP_ES',
  montanha: 'EDP_ES',
  mucurici: 'EDP_ES',
  pancas: 'EDP_ES',
  pedro: 'EDP_ES',
  pinheiros: 'EDP_ES',
  ponto: 'EDP_ES',
  presidente: 'EDP_ES',
  rio: 'EDP_ES',
  santa: 'EDP_ES',
  'santa teresa': 'EDP_ES',
  'sao gabriel': 'EDP_ES',
  vargem: 'EDP_ES',
  'venda nova': 'EDP_ES',

  // ELFSM — região atendida pela ELFSM (sul/serrana específica)
  'santa maria de jetiba': 'ELFSM',
  'mimoso do sul': 'ELFSM',
  'vargem alta': 'ELFSM',
  'apiaca': 'ELFSM',
  'jeronimo monteiro': 'ELFSM',
  'muqui': 'ELFSM',
  'sao jose do calcado': 'ELFSM',
};

function normalizarCidade(s: string | null | undefined): string {
  if (!s) return '';
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // remove acentos
    .trim();
}

function sugerirDistribuidora(cidade: string | null | undefined): 'EDP_ES' | 'ELFSM' | '?' {
  const norm = normalizarCidade(cidade);
  if (!norm) return '?';
  // Match exato primeiro
  if (MAPA_CIDADE_DISTRIBUIDORA[norm]) return MAPA_CIDADE_DISTRIBUIDORA[norm];
  // Match parcial (primeiro token bate)
  const primeiroToken = norm.split(/\s+/)[0];
  if (MAPA_CIDADE_DISTRIBUIDORA[primeiroToken]) return MAPA_CIDADE_DISTRIBUIDORA[primeiroToken];
  return '?';
}

async function main(): Promise<void> {
  const prisma = new PrismaClient();

  const candidatas = await prisma.cooperativa.findMany({
    where: { nome: { contains: 'CoopereBR', mode: 'insensitive' } },
    select: { id: true, nome: true, _count: { select: { cooperados: true } } },
  });
  const coop = candidatas.reduce((max, atual) =>
    atual._count.cooperados > max._count.cooperados ? atual : max,
  );
  console.log(`\nCooperativa: ${coop.nome} (id=${coop.id})\n`);

  // Pega TODAS as UCs de cooperados ATIVOS com distribuidora=OUTRAS
  const ucs = await prisma.uc.findMany({
    where: {
      cooperado: { cooperativaId: coop.id, status: 'ATIVO' as never },
      distribuidora: 'OUTRAS',
    },
    select: {
      id: true,
      cidade: true,
      estado: true,
      cep: true,
    },
  });

  console.log(`UCs com distribuidora=OUTRAS de cooperados ATIVOS: ${ucs.length}\n`);

  // Agrupa por cidade
  const porCidade = new Map<
    string,
    { qtd: number; estado: string | null; sugestao: 'EDP_ES' | 'ELFSM' | '?' }
  >();
  let semCidade = 0;
  let foraDoES = 0;

  for (const uc of ucs) {
    if (!uc.cidade || uc.cidade.trim() === '') {
      semCidade++;
      continue;
    }
    if (uc.estado && uc.estado.toUpperCase() !== 'ES') {
      foraDoES++;
      continue;
    }
    const chave = normalizarCidade(uc.cidade);
    const atual = porCidade.get(chave);
    if (atual) atual.qtd++;
    else
      porCidade.set(chave, {
        qtd: 1,
        estado: uc.estado,
        sugestao: sugerirDistribuidora(uc.cidade),
      });
  }

  console.log('=== Cidades ES (top 20 por volume) ===');
  const ranking = Array.from(porCidade.entries())
    .sort((a, b) => b[1].qtd - a[1].qtd)
    .slice(0, 20);
  for (const [cidade, dados] of ranking) {
    const tag =
      dados.sugestao === 'EDP_ES' ? '✅' : dados.sugestao === 'ELFSM' ? '⚡' : '❓';
    console.log(
      `  ${tag} ${cidade.padEnd(30)} ${String(dados.qtd).padStart(3)} UCs → ${dados.sugestao}`,
    );
  }

  // Totais por sugestão
  let totalEdpEs = 0;
  let totalElfsm = 0;
  let totalIndefinido = 0;
  for (const [, dados] of porCidade) {
    if (dados.sugestao === 'EDP_ES') totalEdpEs += dados.qtd;
    else if (dados.sugestao === 'ELFSM') totalElfsm += dados.qtd;
    else totalIndefinido += dados.qtd;
  }

  console.log('\n=== TOTAIS (cidades ES) ===');
  console.log(`  ✅ EDP_ES (atualizar):    ${totalEdpEs} UCs`);
  console.log(`  ⚡ ELFSM (atualizar):     ${totalElfsm} UCs`);
  console.log(`  ❓ Indefinido (manter):   ${totalIndefinido} UCs (cidade fora do mapa)`);
  console.log(`  📭 Sem cidade:            ${semCidade} UCs (tratamento manual)`);
  console.log(`  🌐 Fora do ES:            ${foraDoES} UCs (não tocar)`);
  console.log(`  TOTAL auditado:           ${ucs.length} UCs`);

  // Cidades indefinidas — listar pra revisão
  if (totalIndefinido > 0) {
    console.log('\n=== Cidades INDEFINIDAS (revisar manualmente) ===');
    const indefinidas = Array.from(porCidade.entries())
      .filter(([, d]) => d.sugestao === '?')
      .sort((a, b) => b[1].qtd - a[1].qtd);
    for (const [cidade, dados] of indefinidas) {
      console.log(`  "${cidade}" (${dados.estado ?? '?'}): ${dados.qtd} UCs`);
    }
  }

  console.log('\n=== PRÓXIMO PASSO ===');
  console.log('Se os números acima fizerem sentido, o UPDATE seria:');
  console.log('');
  console.log("  UPDATE ucs SET distribuidora = 'EDP_ES'");
  console.log(`  WHERE id IN (${totalEdpEs} ids específicos);  -- ${totalEdpEs} UCs`);
  console.log('');
  console.log("  UPDATE ucs SET distribuidora = 'ELFSM'");
  console.log(`  WHERE id IN (${totalElfsm} ids específicos);  -- ${totalElfsm} UCs`);
  console.log('');
  console.log('Cidades indefinidas + sem cidade + fora ES → permanecem OUTRAS.');
  console.log('Roda este script de novo se modificar o MAPA_CIDADE_DISTRIBUIDORA.\n');

  await prisma.$disconnect();
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
