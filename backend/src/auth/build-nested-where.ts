/**
 * D-novo-BR F1.1 (31/05/2026) — Helper puro pro TenantOwnershipGuard.
 *
 * Converte caminho dot-notation em where Prisma aninhado:
 *   buildNestedWhere('cooperativaId', 'X')                    → { cooperativaId: 'X' }
 *   buildNestedWhere('cooperado.cooperativaId', 'X')          → { cooperado: { cooperativaId: 'X' } }
 *   buildNestedWhere('contrato.usina.cooperativaId', 'X')     → { contrato: { usina: { cooperativaId: 'X' } } }
 *
 * Sem dependência. Idempotente. Aceita 1+ níveis.
 */
export function buildNestedWhere(path: string, value: unknown): Record<string, unknown> {
  if (!path || typeof path !== 'string') {
    throw new Error('buildNestedWhere: path deve ser string não-vazia');
  }
  const parts = path.split('.').filter((p) => p.length > 0);
  if (parts.length === 0) {
    throw new Error('buildNestedWhere: path inválido');
  }
  let result: Record<string, unknown> = { [parts[parts.length - 1]]: value };
  for (let i = parts.length - 2; i >= 0; i--) {
    result = { [parts[i]]: result };
  }
  return result;
}
