/**
 * Sprint Clube P1 — F4 Bloco D carona (12/06/2026).
 *
 * Helper único de formatação/normalização de telefone brasileiro.
 *
 * Consolidou 4 cópias quase-idênticas que existiam em:
 *  - web/app/cadastro/page.tsx
 *  - web/app/dashboard/indicacoes/page.tsx
 *  - web/app/entrar/page.tsx
 *  - web/components/convenios/GestaoConvitesSection.tsx
 *
 * Bug fixado nesta consolidação: nenhuma das 4 cópias removia o prefixo
 * `55` (código do país) quando o input vinha com 12-13 dígitos (ex.: copy-
 * paste de WhatsApp `+5527981341348` ou `5527981341348`). Resultado:
 * mascara virava `(55) 27981-3413` em vez de `(27) 98134-1348`.
 */

/** Tamanho máximo de telefone brasileiro sem DDI (11 dígitos: DDD + 9 + 8). */
const TAMANHO_NACIONAL = 11;

/**
 * Strip do prefixo `55` quando o input claramente tem código do país
 * (12 ou 13 dígitos). Mantém o resto intacto pra processamento normal.
 *
 * - 11 dígitos: já tá nacional → mantém.
 * - 12 dígitos começando com `55`: `552798134134` → `2798134134`.
 * - 13 dígitos começando com `55`: `5527981341348` → `27981341348`.
 * - 12-13 dígitos NÃO começando com `55`: mantém (improvável, mas defensivo).
 * - <= 11 dígitos: mantém (digitação parcial).
 *
 * Outros DDIs (1 USA, 351 Portugal, etc) não são tratados — usuário
 * brasileiro digitando `+1...` é caso edge e UI vai mostrar mascara estranha
 * (mas isso já era o comportamento anterior; este helper só endereça o
 * caso comum do `+55`).
 */
function stripDdi55(nums: string): string {
  if ((nums.length === 12 || nums.length === 13) && nums.startsWith('55')) {
    return nums.slice(2);
  }
  return nums;
}

/**
 * Mascara visual `(DD) XXXXX-XXXX` (com ou sem 9 inicial, conforme tamanho).
 * Usado em `onChange` de inputs de telefone.
 */
export function formatarTelefone(valor: string): string {
  const raw = valor.replace(/\D/g, '');
  const sem55 = stripDdi55(raw);
  const nums = sem55.slice(0, TAMANHO_NACIONAL);
  if (nums.length <= 2) return nums;
  if (nums.length <= 7) return `(${nums.slice(0, 2)}) ${nums.slice(2)}`;
  return `(${nums.slice(0, 2)}) ${nums.slice(2, 7)}-${nums.slice(7)}`;
}

/**
 * Retorna apenas os dígitos do telefone nacional (sem DDI, sem mascara).
 * Use antes de enviar pro backend — campos `cooperado.telefone` no schema
 * Prisma armazenam só os 11 dígitos.
 */
export function normalizarTelefone(valor: string): string {
  const raw = valor.replace(/\D/g, '');
  return stripDdi55(raw).slice(0, TAMANHO_NACIONAL);
}
