/**
 * Spec standalone ts-node de web/components/EconomiaProjetada.tsx (Fase C.3).
 *
 * Como rodar:
 *   cd web ; npx ts-node -O '{"module":"commonjs","moduleResolution":"node"}' --transpile-only scripts/test-economia-projetada.ts
 *
 * Testa as 4 variantes de props mencionadas no Reforço 4 do Luciano (11/05):
 *   1. Todos 4 valores presentes
 *   2. Todos null (fallback "—")
 *   3. Mix (1 presente, 3 null)
 *   4. Valor negativo (mostra em vermelho + aviso defensivo)
 *
 * Não renderiza React DOM real — testa só as funções puras de formatação
 * e a lógica de detecção de negativo, replicadas aqui pra isolamento.
 */

// Replicar funções puras do componente (versão coerce string-or-number)
type V = number | string | null | undefined;
function toNum(v: V): number | null {
  if (v == null) return null;
  if (typeof v === 'string' && v.trim() === '') return null;
  const n = typeof v === 'string' ? Number(v) : v;
  return Number.isFinite(n) ? n : null;
}
function formatBRL(v: V): string {
  const n = toNum(v);
  if (n == null) return '—';
  return n.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    style: 'currency',
    currency: 'BRL',
  });
}

function corValor(v: V): string {
  const n = toNum(v);
  if (n == null) return 'text-gray-400';
  if (n < 0) return 'text-red-700';
  return 'text-gray-800';
}

function temNegativo(...valores: V[]): boolean {
  return valores.map(toNum).some((n) => n != null && n < 0);
}

let falhas = 0;
let total = 0;
function check(desc: string, cond: boolean, detalhe?: string) {
  total += 1;
  if (cond) {
    console.log(`✓ ${desc}`);
  } else {
    console.log(`✗ ${desc}${detalhe ? ` — ${detalhe}` : ''}`);
    falhas += 1;
  }
}

console.log('=== Variante 1: todos 4 valores presentes ===');
check('mensal 58.50 formatado', formatBRL(58.5).includes('58,50'));
check('mensal 58.50 cor cinza-escuro', corValor(58.5) === 'text-gray-800');
check('anual 702 formatado', formatBRL(702).includes('702,00'));
check('5anos 3510 cor cinza-escuro', corValor(3510) === 'text-gray-800');
check('15anos 10530 formatado', formatBRL(10530).includes('10.530,00'));
check('nenhum negativo', !temNegativo(58.5, 702, 3510, 10530));

console.log('\n=== Variante 2: todos null ===');
check('null formatado como —', formatBRL(null) === '—');
check('undefined formatado como —', formatBRL(undefined) === '—');
check('null cor cinza claro', corValor(null) === 'text-gray-400');
check('nenhum negativo (todos null)', !temNegativo(null, null, null, null));

console.log('\n=== Variante 3: mix (mês=58.50, outros null) ===');
check('mês formatado normal', formatBRL(58.5).includes('58,50'));
check('ano null → —', formatBRL(null) === '—');
check('mix sem negativos', !temNegativo(58.5, null, null, null));

console.log('\n=== Variante 4: valor negativo (defesa em profundidade) ===');
check('mês -10 formatado', formatBRL(-10).startsWith('-') || formatBRL(-10).includes('-'));
check('-10 cor vermelha', corValor(-10) === 'text-red-700');
check('-1 detectado como negativo', temNegativo(-1, 0, 0, 0));
check('zero não conta como negativo', !temNegativo(0, 0, 0, 0));
check('null com outros positivos não conta negativo', !temNegativo(null, 100, 200, 300));
check('um negativo no meio é detectado', temNegativo(100, -50, 300, 500));

console.log('\n=== Cenários canônicos da Fase B.5 ===');
// Cenário #2: SEM_TRIBUTO + ABATER + 15% = economia 58.50/mês
check('B.5 #2 mensal', formatBRL(58.5).includes('58,50'));
check('B.5 #2 anual = 702', formatBRL(702).includes('702,00'));
check('B.5 #2 5anos = 3510', formatBRL(3510).includes('3.510,00'));
check('B.5 #2 15anos = 10530', formatBRL(10530).includes('10.530,00'));

console.log('\n=== Coerce Prisma Decimal (string) — Fase C.3 fix ===');
check('"76.5" string vira number e formata', formatBRL('76.5').includes('76,50'));
check('"918" formata', formatBRL('918').includes('918,00'));
check('"13770" formata milhar', formatBRL('13770').includes('13.770,00'));
check('"" vazio → —', formatBRL('') === '—');
check('"abc" inválido → —', formatBRL('abc') === '—');
check('"-50" negativo string → vermelho', corValor('-50') === 'text-red-700');

console.log(`\n${falhas === 0 ? '✓' : '✗'} ${total - falhas}/${total} testes OK`);
process.exit(falhas === 0 ? 0 : 1);
