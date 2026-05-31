/**
 * D-novo-BR F1.4 (31/05/2026) — Lint anti-reincidência de decorators de tenant.
 *
 * Varre `src/**\/*.controller.ts`, extrai handlers HTTP de mutação
 * (@Post / @Put / @Patch / @Delete) e exige que cada um declare
 * EXPLICITAMENTE seu posicionamento sobre tenant:
 *   - @TenantResource({...}) → endpoint protegido pelo Guard sistêmico
 *   - @TenantExempt()        → endpoint sabidamente sem recurso por id
 *   - @Public()              → endpoint público (webhook, cadastro, etc)
 *
 * Sem nenhum desses → erro (exit 1).
 *
 * BASELINE: handlers legados conhecidos vão pra `tenant-lint-allowlist.json`.
 * Eles ficam como WARNING (não falham) até serem anotados incrementalmente.
 * NOVOS handlers sem decorator + NÃO na allowlist → falha hard.
 *
 * Estratégia ratchet: dívida só diminui, nunca cresce.
 *
 * Uso: `npm run lint:tenant`
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve, relative } from 'node:path';
import * as ts from 'typescript';
import { execSync } from 'node:child_process';

const BACKEND_ROOT = resolve(__dirname, '..');
const ALLOWLIST_PATH = resolve(__dirname, 'tenant-lint-allowlist.json');

const HTTP_MUTATION_DECORATORS = new Set(['Post', 'Put', 'Patch', 'Delete']);
const TENANT_DECLARING_DECORATORS = new Set([
  'TenantResource',
  'TenantExempt',
  'Public',
]);

interface Handler {
  controller: string;
  method: string;
  file: string; // relativo a backend/
  line: number;
  httpVerb: string;
  hasTenantDecl: boolean;
  decoratorsFound: string[];
}

function listarControllers(): string[] {
  try {
    const out = execSync('grep -rl "@Controller" src --include="*.controller.ts"', {
      cwd: BACKEND_ROOT,
      encoding: 'utf8',
    });
    return out
      .trim()
      .split('\n')
      .filter((f) => f.length > 0 && !f.includes('.spec.'))
      .map((f) => resolve(BACKEND_ROOT, f));
  } catch {
    return [];
  }
}

function extrairNomeDecorator(dec: ts.Decorator): string | null {
  // @Foo() ou @Foo(...) ou @Foo
  const expr = dec.expression;
  if (ts.isCallExpression(expr)) {
    const callee = expr.expression;
    if (ts.isIdentifier(callee)) return callee.text;
  } else if (ts.isIdentifier(expr)) {
    return expr.text;
  }
  return null;
}

function processarControlador(filePath: string): Handler[] {
  const source = readFileSync(filePath, 'utf8');
  const sf = ts.createSourceFile(filePath, source, ts.ScriptTarget.Latest, true);
  const handlers: Handler[] = [];
  const rel = relative(BACKEND_ROOT, filePath).replace(/\\/g, '/');

  function visit(node: ts.Node, controllerName: string) {
    if (ts.isClassDeclaration(node) && node.name) {
      const className = node.name.text;
      for (const member of node.members) {
        if (!ts.isMethodDeclaration(member) || !member.name) continue;
        const methodName = (member.name as ts.Identifier).text ?? String(member.name.getText());

        // ts.getDecorators ou (member as any).modifiers + filtro
        const decorators = ts.getDecorators
          ? ts.getDecorators(member)
          : ((member as any).decorators as ts.Decorator[] | undefined);
        if (!decorators || decorators.length === 0) continue;

        const names: string[] = [];
        let httpVerb: string | null = null;
        let hasTenantDecl = false;

        for (const dec of decorators) {
          const name = extrairNomeDecorator(dec);
          if (!name) continue;
          names.push(name);
          if (HTTP_MUTATION_DECORATORS.has(name)) httpVerb = name;
          if (TENANT_DECLARING_DECORATORS.has(name)) hasTenantDecl = true;
        }

        if (!httpVerb) continue; // não é handler de mutação

        const { line } = sf.getLineAndCharacterOfPosition(member.getStart());
        handlers.push({
          controller: className,
          method: methodName,
          file: rel,
          line: line + 1,
          httpVerb,
          hasTenantDecl,
          decoratorsFound: names,
        });
      }
    } else if (ts.isClassDeclaration(node) && !node.name) {
      // pula
    }
    node.forEachChild((c) => visit(c, controllerName));
  }

  visit(sf, '');
  return handlers;
}

function chaveHandler(h: { controller: string; method: string }): string {
  return `${h.controller}#${h.method}`;
}

function carregarAllowlist(): Set<string> {
  if (!existsSync(ALLOWLIST_PATH)) return new Set();
  const raw = readFileSync(ALLOWLIST_PATH, 'utf8');
  const json = JSON.parse(raw);
  return new Set<string>(json.entries ?? []);
}

function main() {
  const controllers = listarControllers();
  const allowlist = carregarAllowlist();

  const todos: Handler[] = [];
  for (const c of controllers) todos.push(...processarControlador(c));

  const semDecorator = todos.filter((h) => !h.hasTenantDecl);
  const novosSemDecorator = semDecorator.filter((h) => !allowlist.has(chaveHandler(h)));
  const legadosNaAllowlist = semDecorator.filter((h) => allowlist.has(chaveHandler(h)));
  const corrigidosNaAllowlist = todos.filter(
    (h) => h.hasTenantDecl && allowlist.has(chaveHandler(h)),
  );

  console.log(`\n=== Lint Tenant Decorators (D-novo-BR F1.4) ===\n`);
  console.log(`Controllers analisados: ${controllers.length}`);
  console.log(`Handlers de mutação encontrados: ${todos.length}`);
  console.log(`  com decorator de tenant: ${todos.length - semDecorator.length}`);
  console.log(`  sem decorator (total):   ${semDecorator.length}`);
  console.log(`    └ legados (allowlist): ${legadosNaAllowlist.length}`);
  console.log(`    └ NOVOS (falha):       ${novosSemDecorator.length}`);
  console.log(`Já anotados ainda na allowlist (esvaziar): ${corrigidosNaAllowlist.length}`);

  if (corrigidosNaAllowlist.length > 0) {
    console.log(`\n⚠ Entradas na allowlist que já receberam decorator — pode REMOVER:`);
    corrigidosNaAllowlist
      .slice(0, 10)
      .forEach((h) =>
        console.log(`  - ${chaveHandler(h)} (${h.file}:${h.line})`),
      );
    if (corrigidosNaAllowlist.length > 10) {
      console.log(`  ... +${corrigidosNaAllowlist.length - 10} (rode com VERBOSE=1 pra ver tudo)`);
    }
  }

  if (novosSemDecorator.length === 0) {
    console.log(`\n✅ OK — nenhum handler novo de mutação sem decorator de tenant.\n`);
    process.exit(0);
  }

  console.error(
    `\n❌ ${novosSemDecorator.length} handler(s) novo(s) de mutação SEM decorator de tenant:\n`,
  );
  for (const h of novosSemDecorator) {
    console.error(
      `  ${h.file}:${h.line}  @${h.httpVerb}  ${h.controller}#${h.method}`,
    );
  }
  console.error(`
Adicione UM destes ao handler (escolha conforme a natureza):
  @TenantResource({ model: '...', idParam?: '...', via?: '...', globalOnlySuperAdmin?: boolean })
  @TenantExempt()                            // rota dev/health/sem recurso por id
  @Public()                                  // webhook ou rota pública

Se for de fato um handler legado sem fix imediato possível,
adicione 'Controller#method' a scripts/tenant-lint-allowlist.json
(dívida explícita — esvaziar em F1.5+).
`);
  process.exit(1);
}

main();
