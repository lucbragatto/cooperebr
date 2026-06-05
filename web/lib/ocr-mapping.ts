/**
 * D-novo-OCR-UC-PREFILL (05/06/2026) — mapper puro do payload OCR pros campos
 * do step "Instalação" do wizard /cadastro.
 *
 * Resolve a divergência de naming/forma entre OCR e form:
 * - OCR retorna 3 variantes (todas opcionais): `numero` (canônico 10 dig
 *   zero à esquerda, formato SISGD), `numeroUC` (legado 9 dig — comum em
 *   filename de PDFs EDP e em rótulo "Cliente Nº"), `numeroConcessionariaOriginal`
 *   (string EXATA preservada da fatura, com pontos/hífens, ex
 *   `0.000.374.127.054-59` — formato predominante das faturas EDP-ES atuais).
 * - Form tem 3 campos correspondentes:
 *     `numeroUC` (canônico — vai pro `Uc.numero` no backend após normalização),
 *     `numeroUCLegado` (vai pro `Uc.numeroUC` no backend),
 *     `numeroConcessionariaOriginal` (string com pontuação preservada).
 *
 * Prioridade pro campo principal `numeroUC` do form (que o guard backend
 * `validarENormalizarCadastro` valida como 6-11 dígitos e normaliza com
 * `.slice(-10).padStart(10, '0')`):
 *   1. `numero` (canônico OCR) — formato ideal pra `Uc.numero`
 *   2. `numeroUC` (legado OCR) — fallback quando fatura não tem canônico explícito
 *   3. Dígitos extraídos de `numeroConcessionariaOriginal` — último fallback
 *      (faturas EDP-ES atuais SEMPRE trazem essa forma; garante que o form
 *      pré-preenche mesmo quando OCR não conseguiu identificar canônico/legado)
 *
 * Sem essa prioridade (regra anterior, single field `numeroUC`), faturas
 * EDP atuais deixavam o form vazio → guard rejeitava com 400
 * "Número da UC vazio sem permiteSemUc". Bug do golden path do convite.
 *
 * **Função pura** — sem React, sem DOM, sem efeitos. Importável pelo
 * cadastro/page.tsx e testável em isolamento (futuro Jest no frontend).
 */

export interface OcrUcInput {
  numero?: string | null;
  numeroUC?: string | null;
  numeroConcessionariaOriginal?: string | null;
}

export interface OcrUcOutput {
  /** Campo principal do form. Só dígitos. Vai pro `Uc.numero` (canônico) no backend. */
  numeroUC: string;
  /** Campo legado opcional. Só dígitos. Vai pro `Uc.numeroUC` (9 dig EDP) no backend. */
  numeroUCLegado: string;
  /** String preservada como aparece na fatura (com pontos/hífens). Não normalizar. */
  numeroConcessionariaOriginal: string;
}

/**
 * Mapeia a resposta do `POST /publico/processar-fatura-ocr` (campo `dados`)
 * pra forma esperada pelo step "Instalação" do wizard.
 *
 * @example
 *   // Fatura EDP-ES atual — só tem o original com pontos
 *   mapearOcrParaInstalacao({ numeroConcessionariaOriginal: '0.000.374.127.054-59' })
 *   // → { numeroUC: '000037412705459', numeroUCLegado: '', numeroConcessionariaOriginal: '0.000.374.127.054-59' }
 *
 *   // Fatura EDP-ES com canônico + original
 *   mapearOcrParaInstalacao({ numero: '0400702214', numeroConcessionariaOriginal: '0.000.512.828.054-91' })
 *   // → { numeroUC: '0400702214', numeroUCLegado: '', numeroConcessionariaOriginal: '0.000.512.828.054-91' }
 *
 *   // Fatura com legado 9 dig
 *   mapearOcrParaInstalacao({ numeroUC: '160085263' })
 *   // → { numeroUC: '160085263', numeroUCLegado: '160085263', numeroConcessionariaOriginal: '' }
 *
 *   // Nenhuma forma → form vazio (não pré-preenche)
 *   mapearOcrParaInstalacao({})
 *   // → { numeroUC: '', numeroUCLegado: '', numeroConcessionariaOriginal: '' }
 */
export function mapearOcrParaInstalacao(d: OcrUcInput): OcrUcOutput {
  const canonico = (d.numero ?? '').replace(/\D/g, '');
  const legado = (d.numeroUC ?? '').replace(/\D/g, '');
  const original = (d.numeroConcessionariaOriginal ?? '').toString();
  const originalDigitos = original.replace(/\D/g, '');

  // Prioridade: canônico → legado → dígitos do original.
  // Garante que o form sempre é pré-preenchido quando QUALQUER variante existe.
  const numeroUC = canonico || legado || originalDigitos;

  return {
    numeroUC,
    numeroUCLegado: legado,
    numeroConcessionariaOriginal: original,
  };
}
