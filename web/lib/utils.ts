import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Sprint Convite-Convênio Fatia 4 (03/06/2026) — extrai mensagem amigável
 * do erro do backend cobrindo os 3 shapes em uso no projeto:
 *
 *  A) string: { message: "Convite expirado.", statusCode: 400 }
 *  B) objeto: { message: { erro: 'cooldown', mensagem: 'Aguarde Xs', liberadoEm: '...' }, statusCode: 429 }
 *  C) array (class-validator): { message: ["codigo deve conter 6 dígitos"], statusCode: 400 }
 *
 * Retorna sempre uma string pra exibição na UI. Use junto com extrairDetalheErro
 * pra pegar metadados (tentativasRestantes, desbloqueadoEm) quando precisar.
 */
export function formatErroBackend(err: unknown): string {
  const e = err as { response?: { data?: { message?: unknown } } };
  const msg = e?.response?.data?.message;
  if (Array.isArray(msg)) return msg.filter((m) => typeof m === 'string').join(' · ');
  if (typeof msg === 'object' && msg !== null) {
    const obj = msg as Record<string, unknown>;
    if (typeof obj.mensagem === 'string') return obj.mensagem;
    if (typeof obj.message === 'string') return obj.message;
  }
  if (typeof msg === 'string') return msg;
  return 'Erro de comunicação com o servidor. Tente novamente em alguns segundos.';
}

/**
 * Sprint Convite-Convênio Fatia 4 (03/06/2026) — extrai detalhes estruturados
 * do erro do backend (objeto). Retorna `null` se não for o formato esperado.
 * Útil pra pegar `desbloqueadoEm` / `liberadoEm` / `tentativasRestantes` /
 * `reenviosRestantes` / `podeReenviar` pra mostrar countdown live ou orientar
 * o usuário.
 */
export function extrairDetalheErro(err: unknown): Record<string, unknown> | null {
  const e = err as { response?: { data?: { message?: unknown } } };
  const msg = e?.response?.data?.message;
  if (typeof msg === 'object' && msg !== null && !Array.isArray(msg)) {
    return msg as Record<string, unknown>;
  }
  return null;
}
