/**
 * D-novo-CT-CT.7 (01/06/2026) — Helper de download autenticado de PDF.
 *
 * Bug 31/05: botões usavam `window.open('/api/...')` que batia no frontend
 * 3001 (rota inexistente) e não levava JWT. Fix: axios GET com responseType=blob
 * → URL.createObjectURL → window.open(blobUrl).
 *
 * Uso:
 *   await abrirPdf('contabilidade-tributaria/relatorios/memorial-calculo-fiscal',
 *                  { ano: 2026, mes: 5 });
 *
 * Tratamento de erro retornado pra o caller (tela escolhe toast/inline).
 */

import api from './api';

export interface AbrirPdfOpts {
  /** Caminho relativo à baseURL do api (sem barra inicial). Ex: 'contabilidade-tributaria/relatorios/memorial-calculo-fiscal' */
  endpoint: string;
  /** Query params (ano, mes, etc) */
  params?: Record<string, string | number>;
  /** Tempo em ms até revogar o blob URL (default 60s) */
  revokeAfterMs?: number;
}

/**
 * Baixa o PDF via axios (com Authorization header) e abre numa nova aba via blob URL.
 * Retorna o blob URL pra caller poder cancelar/limpar se quiser.
 *
 * @throws Error com message do backend se request falhar
 */
export async function abrirPdf(opts: AbrirPdfOpts): Promise<string> {
  const { endpoint, params, revokeAfterMs = 60_000 } = opts;
  const resp = await api.get(endpoint, {
    params,
    responseType: 'blob',
  });

  // Defesa: se backend retornou JSON de erro (não PDF), Content-Type não bate
  const contentType = resp.headers?.['content-type'] ?? '';
  if (!contentType.includes('application/pdf')) {
    throw new Error('Backend não retornou PDF válido (content-type inesperado)');
  }

  const blobUrl = URL.createObjectURL(resp.data as Blob);
  window.open(blobUrl, '_blank');
  setTimeout(() => URL.revokeObjectURL(blobUrl), revokeAfterMs);
  return blobUrl;
}
