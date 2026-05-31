/**
 * D-novo-BR F1.3 (31/05/2026) — script utilitário (one-shot) que anota
 * `@AsPlatform()` em todos os métodos decorados com `@Cron` ou `@OnEvent`
 * nos arquivos do backend.
 *
 * Idempotente: se `@AsPlatform()` já está presente após o decorator alvo,
 * pula. Adiciona import quando necessário.
 *
 * Rodar UMA VEZ via: `npx ts-node scripts/wrap-jobs-as-platform.ts`
 * Reportar quais arquivos foram modificados.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { resolve } from 'node:path';

const DECORATORS_ALVO = /^(\s*)@(Cron|OnEvent)\(/gm;
const IMPORT_REGEX = /from '(\.{1,2}\/)+common\/tenant-context'/;

function processarArquivo(path: string): { modificado: boolean; mudancas: number } {
  let content = readFileSync(path, 'utf8');
  const original = content;
  let mudancas = 0;

  // Encontra todas as ocorrências de @Cron ou @OnEvent
  const matches = [...content.matchAll(DECORATORS_ALVO)];
  if (matches.length === 0) return { modificado: false, mudancas: 0 };

  // Processa de trás pra frente pra não invalidar offsets
  for (let i = matches.length - 1; i >= 0; i--) {
    const match = matches[i];
    const indent = match[1];
    const decoratorName = match[2];
    const startOfLine = match.index!;
    const endOfLine = content.indexOf('\n', startOfLine);
    if (endOfLine === -1) continue;

    // Procura a próxima linha não vazia (esperando o método ou outro decorator)
    let cursor = endOfLine + 1;
    while (cursor < content.length) {
      const lineEnd = content.indexOf('\n', cursor);
      const line = content.slice(cursor, lineEnd === -1 ? content.length : lineEnd);
      const trimmed = line.trim();
      if (trimmed === '') {
        cursor = lineEnd + 1;
        continue;
      }
      // Se já tem @AsPlatform aqui, pula esse @Cron/@OnEvent (idempotência)
      if (trimmed.startsWith('@AsPlatform(')) break;
      // Se é outro decorator não-@AsPlatform, pula (preserva ordem)
      if (trimmed.startsWith('@')) {
        cursor = lineEnd + 1;
        continue;
      }
      // Esperado: linha do método (async X() {...) ou (X(...) {...})
      // Inserir @AsPlatform() ANTES do método (mesma indentação do @Cron)
      content =
        content.slice(0, cursor) +
        `${indent}@AsPlatform()\n` +
        content.slice(cursor);
      mudancas++;
      break;
    }
  }

  if (mudancas === 0) return { modificado: false, mudancas: 0 };

  // Adicionar import se faltar
  if (!IMPORT_REGEX.test(content)) {
    // Descobrir profundidade do path pra ../common
    const rel = path.replace(/\\/g, '/');
    const srcIdx = rel.indexOf('/src/');
    const depthAfterSrc = rel.slice(srcIdx + 5).split('/').length - 1; // -1 pra excluir o arquivo
    const prefix = '../'.repeat(depthAfterSrc);
    const importStmt = `import { AsPlatform } from '${prefix}common/tenant-context';\n`;

    // Inserir após o último import existente
    const lastImportMatch = [...content.matchAll(/^import .+;$/gm)].pop();
    if (lastImportMatch) {
      const insertAt = lastImportMatch.index! + lastImportMatch[0].length + 1; // após o \n
      content = content.slice(0, insertAt) + importStmt + content.slice(insertAt);
    } else {
      content = importStmt + content;
    }
  }

  if (content !== original) {
    writeFileSync(path, content, 'utf8');
    return { modificado: true, mudancas };
  }
  return { modificado: false, mudancas: 0 };
}

function listarArquivos(): string[] {
  // Usa grep ripgrep-like via execSync
  try {
    const out = execSync(
      'grep -rl "@Cron\\|@OnEvent" src --include="*.ts"',
      { cwd: resolve(__dirname, '..'), encoding: 'utf8' },
    );
    return out
      .trim()
      .split('\n')
      .filter((f) => !f.includes('.spec.') && !f.includes('tenant-context'))
      .map((f) => resolve(__dirname, '..', f));
  } catch {
    return [];
  }
}

function main() {
  const arquivos = listarArquivos();
  console.log(`Encontrados ${arquivos.length} arquivos com @Cron ou @OnEvent.\n`);

  let totalModificados = 0;
  let totalMudancas = 0;

  for (const path of arquivos) {
    const { modificado, mudancas } = processarArquivo(path);
    if (modificado) {
      totalModificados++;
      totalMudancas += mudancas;
      console.log(`  ✓ ${path.replace(/\\/g, '/').split('/src/')[1]} — ${mudancas} método(s) anotado(s)`);
    }
  }

  console.log(`\nTotal: ${totalModificados} arquivos modificados, ${totalMudancas} métodos anotados com @AsPlatform()`);
}

main();
