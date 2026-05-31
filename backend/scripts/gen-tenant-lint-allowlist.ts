/**
 * D-novo-BR F1.4 (31/05/2026) — Gera baseline da allowlist do lint
 * de decorators de tenant.
 *
 * Roda 1× pra criar `tenant-lint-allowlist.json` com TODOS os handlers
 * de mutação que HOJE não declaram @TenantResource/@TenantExempt/@Public.
 *
 * A partir daí o lint trata-os como dívida legada (warning). Novos
 * handlers sem decorator são erro hard.
 *
 * NÃO rodar de novo sem motivo — re-gerar a baseline esconde regressões.
 *
 * Uso: `npx ts-node scripts/gen-tenant-lint-allowlist.ts`
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, relative } from 'node:path';
import * as ts from 'typescript';
import { execSync } from 'node:child_process';

const BACKEND_ROOT = resolve(__dirname, '..');
const OUTPUT = resolve(__dirname, 'tenant-lint-allowlist.json');

const HTTP_MUTATION_DECORATORS = new Set(['Post', 'Put', 'Patch', 'Delete']);
const TENANT_DECLARING_DECORATORS = new Set([
  'TenantResource',
  'TenantExempt',
  'Public',
]);

function listarControllers(): string[] {
  const out = execSync('grep -rl "@Controller" src --include="*.controller.ts"', {
    cwd: BACKEND_ROOT,
    encoding: 'utf8',
  });
  return out
    .trim()
    .split('\n')
    .filter((f) => f.length > 0 && !f.includes('.spec.'))
    .map((f) => resolve(BACKEND_ROOT, f));
}

function nomeDecorator(dec: ts.Decorator): string | null {
  const expr = dec.expression;
  if (ts.isCallExpression(expr)) {
    const callee = expr.expression;
    if (ts.isIdentifier(callee)) return callee.text;
  } else if (ts.isIdentifier(expr)) {
    return expr.text;
  }
  return null;
}

function coletar(filePath: string): { key: string; file: string; line: number }[] {
  const src = readFileSync(filePath, 'utf8');
  const sf = ts.createSourceFile(filePath, src, ts.ScriptTarget.Latest, true);
  const found: { key: string; file: string; line: number }[] = [];
  const rel = relative(BACKEND_ROOT, filePath).replace(/\\/g, '/');

  function visit(node: ts.Node) {
    if (ts.isClassDeclaration(node) && node.name) {
      for (const m of node.members) {
        if (!ts.isMethodDeclaration(m) || !m.name) continue;
        const decorators = ts.getDecorators ? ts.getDecorators(m) : ((m as any).decorators as ts.Decorator[] | undefined);
        if (!decorators) continue;
        let isMut = false;
        let hasTenant = false;
        for (const d of decorators) {
          const n = nomeDecorator(d);
          if (!n) continue;
          if (HTTP_MUTATION_DECORATORS.has(n)) isMut = true;
          if (TENANT_DECLARING_DECORATORS.has(n)) hasTenant = true;
        }
        if (isMut && !hasTenant) {
          const className = node.name!.text;
          const methodName = (m.name as ts.Identifier).text;
          const { line } = sf.getLineAndCharacterOfPosition(m.getStart());
          found.push({ key: `${className}#${methodName}`, file: rel, line: line + 1 });
        }
      }
    }
    node.forEachChild(visit);
  }
  visit(sf);
  return found;
}

const controllers = listarControllers();
const todos: { key: string; file: string; line: number }[] = [];
for (const c of controllers) todos.push(...coletar(c));

todos.sort((a, b) => a.key.localeCompare(b.key));

const json = {
  _comment:
    'D-novo-BR F1.4 (31/05/2026) — Allowlist baseline de dívida legada IDOR. ' +
    'Handlers HTTP de mutação que ainda NÃO declaram @TenantResource/@TenantExempt/@Public. ' +
    'NÃO adicionar entradas novas — todo handler novo deve declarar decorator. ' +
    'Esvaziar incrementalmente (anotando os legados) até zerar.',
  _generated: new Date().toISOString(),
  _total: todos.length,
  entries: todos.map((t) => t.key),
  _references: todos.reduce<Record<string, string>>((acc, t) => {
    acc[t.key] = `${t.file}:${t.line}`;
    return acc;
  }, {}),
};

writeFileSync(OUTPUT, JSON.stringify(json, null, 2), 'utf8');
console.log(`Allowlist gerada com ${todos.length} entradas em ${OUTPUT}`);
