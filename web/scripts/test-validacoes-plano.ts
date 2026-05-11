/**
 * Spec standalone ts-node de web/lib/validacoes-plano.ts (Fase C.2 Item 1+3).
 *
 * Como rodar:
 *   cd web ; npx ts-node -O '{"module":"commonjs","moduleResolution":"node"}' --transpile-only scripts/test-validacoes-plano.ts
 *
 * Sem dependência de Jest. Sem rede. Sem banco.
 */
import { validarPromo, validarVigencia, sugerirDefaultsPromo } from '../lib/validacoes-plano';

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

console.log('=== validarPromo ===');

let r = validarPromo(false, 15, 0, 0);
check('sem promo → ok', r.ok && r.tipo === 'ok');

r = validarPromo(true, 15, 10, 3);
check('promo menor que base → erro', !r.ok && r.tipo === 'erro');

r = validarPromo(true, 15, 15, 3);
check('promo igual à base → erro', !r.ok && r.tipo === 'erro');

r = validarPromo(true, 15, 20, 0);
check('promo válida mas meses=0 → erro', !r.ok && r.tipo === 'erro');

r = validarPromo(true, 15, 20, 3);
check('promo válida 20% por 3 meses → ok', r.ok && r.tipo === 'ok');
check('mensagem de ok inclui valores', r.mensagem?.includes('20%') === true && r.mensagem?.includes('3 meses') === true);

r = validarPromo(true, 15, 25, 1);
check('promo válida 25% por 1 mês → ok (singular)', r.ok && r.mensagem?.includes('1 mês') === true);

r = validarPromo(true, 15, 0, 3);
check('promo 0% explícito → erro', !r.ok);

console.log('\n=== validarVigencia ===');

r = validarVigencia('PADRAO', '', '');
check('PADRAO sem datas → ok', r.ok);

r = validarVigencia('CAMPANHA', '', '');
check('CAMPANHA sem datas → erro', !r.ok);

r = validarVigencia('CAMPANHA', '2026-06-01', '');
check('CAMPANHA com início mas sem fim → erro', !r.ok);

r = validarVigencia('CAMPANHA', '2026-06-01', '2026-05-01');
check('CAMPANHA fim antes do início → erro', !r.ok && r.tipo === 'erro');

r = validarVigencia('CAMPANHA', '2026-06-01', '2026-06-01');
check('CAMPANHA início == fim → erro', !r.ok);

r = validarVigencia('CAMPANHA', '2026-06-01', '2026-06-15');
check('CAMPANHA vigência 14d → aviso curta', r.ok && r.tipo === 'aviso');

r = validarVigencia('CAMPANHA', '2026-06-01', '2026-07-15');
check('CAMPANHA vigência 44d → ok', r.ok && r.tipo === 'ok');

console.log('\n=== sugerirDefaultsPromo ===');

let s = sugerirDefaultsPromo(15, 0, 0);
check('default sugere descontoBase+5', s.descontoPromocional === 20);
check('default sugere 3 meses', s.mesesPromocao === 3);

s = sugerirDefaultsPromo(15, 25, 0);
check('preserva descontoPromocional já preenchido', s.descontoPromocional === 25);

s = sugerirDefaultsPromo(15, 0, 6);
check('preserva mesesPromocao já preenchido', s.mesesPromocao === 6);

s = sugerirDefaultsPromo(99, 0, 0);
check('descontoBase=99 → sugere 100 (cap)', s.descontoPromocional === 100);

console.log(`\n${falhas === 0 ? '✓' : '✗'} ${total - falhas}/${total} testes OK`);
process.exit(falhas === 0 ? 0 : 1);
