/**
 * Sprint Máscara de e-mail por convênio (06/07/2026) — helpers puros do
 * ramo campanha. Zero I/O; unit-testáveis standalone.
 *
 * Escopo:
 *  - matchAliasCampanha: identifica se algum destinatário do e-mail bate
 *    com um alias `<local>+<sufixo>@<domain>` DA CAIXA MONITORADA DO TENANT.
 *    (Acréscimo A do orquestrador: local-part vem da config do monitor de
 *    cada tenant, não hardcoda "contato" — pronto pra qualquer parceiro
 *    futuro com caixa própria.)
 *  - sanitizarTextoOcr: trim + strip caracteres de controle + limite de
 *    tamanho pros campos extraídos do OCR (Acréscimo B — remetente/OCR
 *    são input NÃO-confiável; mesmo padrão do roteamento M48).
 */

/** Limite padrão de tamanho pra campos OCR expostos em notificação/UI. */
export const CAMPANHA_MAX_TEXTO = 120;

/**
 * Normaliza um endereço RFC 5322 pra `local@domain` lowercase, sem espaços
 * e sem `<>` do formato "Nome <email>". Retorna null se inválido.
 */
function normalizarEndereco(endereco: string): { local: string; domain: string } | null {
  if (!endereco || typeof endereco !== 'string') return null;
  const limpo = endereco.trim().replace(/^<|>$/g, '').toLowerCase();
  const at = limpo.indexOf('@');
  if (at <= 0 || at === limpo.length - 1) return null;
  const local = limpo.slice(0, at);
  const domain = limpo.slice(at + 1);
  if (!local || !domain) return null;
  return { local, domain };
}

/**
 * Deriva o local-part esperado da caixa do tenant a partir do usuário IMAP
 * configurado (ex: `contato@cooperebr.com.br` → `contato`).
 * Retorna null se a config estiver ausente ou malformada.
 */
export function localPartDoMailboxTenant(emailMonitorUser: string | null | undefined): string | null {
  if (!emailMonitorUser) return null;
  const parsed = normalizarEndereco(emailMonitorUser);
  if (!parsed) return null;
  return parsed.local;
}

export interface MatchAliasResult {
  bateu: boolean;
  /** Sufixo detectado (parte depois do `+` no endereço). */
  aliasDetectado?: string;
  /** Endereço completo do destinatário que casou (pra log/notif). */
  destinatarioCasou?: string;
}

/**
 * Retorna se algum dos destinatários do e-mail casa com o alias esperado
 * do tenant.
 *
 * Regras:
 *  - Match no formato `<local>+<aliasEsperado>@*` (domain livre — Gmail
 *    aceita múltiplos domínios roteando pra mesma caixa).
 *  - Caso-insensitivo (`.toLowerCase()` em tudo).
 *  - Se `localPartTenant` ou `aliasEsperado` vazios/malformados → `bateu:false`
 *    imediato (não vaza pro fluxo antigo por acaso).
 *  - Tolera espaços/`<>` do formato "Nome <email>".
 *
 * @param destinatarios lista de endereços do header To do e-mail parseado
 *   (`simpleParser(msg.source).to.value.map(v => v.address)`).
 * @param localPartTenant local-part da caixa monitorada do tenant, derivado
 *   via `localPartDoMailboxTenant(emailMonitorUser)`.
 * @param aliasEsperado sufixo do alias configurado no
 *   `ContratoConvenio.emailAliasCampanha`.
 */
export function matchAliasCampanha(
  destinatarios: readonly string[],
  localPartTenant: string | null | undefined,
  aliasEsperado: string | null | undefined,
): MatchAliasResult {
  if (!localPartTenant || !aliasEsperado) {
    return { bateu: false };
  }
  const localEsperado = localPartTenant.trim().toLowerCase();
  const aliasNorm = aliasEsperado.trim().toLowerCase();
  if (!localEsperado || !aliasNorm) return { bateu: false };
  const prefixoEsperado = `${localEsperado}+${aliasNorm}`;

  for (const dest of destinatarios ?? []) {
    const parsed = normalizarEndereco(dest);
    if (!parsed) continue;
    if (parsed.local === prefixoEsperado) {
      return {
        bateu: true,
        aliasDetectado: aliasNorm,
        destinatarioCasou: `${parsed.local}@${parsed.domain}`,
      };
    }
  }
  return { bateu: false };
}

/**
 * Sanitiza texto vindo de OCR/remetente antes de gravar OU expor em
 * notificação/UI. Acréscimo B do orquestrador — remetente e campos
 * extraídos do OCR são input NÃO-confiável.
 *
 * Aplica em ordem:
 *  1. Trim.
 *  2. Strip caracteres de controle (Cc/Cf) exceto `\n` e `\t`.
 *  3. Colapsa runs longos de whitespace em espaço único.
 *  4. Corta em `maxLen` chars, preservando limite de palavra quando possível.
 *
 * Retorna undefined se, após sanitizar, o texto ficar vazio (facilita o
 * `?? undefined` que o Prisma prefere pra colunas nullable).
 */
export function sanitizarTextoOcr(
  raw: string | null | undefined,
  maxLen: number = CAMPANHA_MAX_TEXTO,
): string | undefined {
  if (raw === null || raw === undefined) return undefined;
  if (typeof raw !== 'string') return undefined;
  // eslint-disable-next-line no-control-regex
  let t = raw.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  t = t.trim().replace(/\s+/g, ' ');
  if (!t) return undefined;
  if (t.length <= maxLen) return t;
  // Corta preservando quebra de palavra quando possível.
  const cortado = t.slice(0, maxLen);
  const ultimoEspaco = cortado.lastIndexOf(' ');
  return ultimoEspaco > maxLen * 0.7 ? cortado.slice(0, ultimoEspaco) : cortado;
}

/**
 * Sanitiza um numeroUC extraído pelo OCR: mantém só dígitos e limita a 15
 * caracteres (formato canônico + legado EDP). Retorna undefined se ficar
 * vazio — evita gravar '' que poluiria a dedupe.
 */
export function sanitizarNumeroUc(raw: string | null | undefined): string | undefined {
  if (raw === null || raw === undefined) return undefined;
  if (typeof raw !== 'string') return undefined;
  const digitos = raw.replace(/\D/g, '').slice(0, 15);
  return digitos.length >= 6 ? digitos : undefined;
}
