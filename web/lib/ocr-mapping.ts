/**
 * D-novo-OCR-UC-CANON (05/06/2026, revisado) — mapper puro do payload OCR
 * pros campos do step "Instalação" do wizard /cadastro.
 *
 * CONTEXTO SCEE-CRÍTICO (Sprint 11 Bloco 2 — auditoria 26/04 + E2E Fase D 26/04):
 *
 * UC tem 3 números INDEPENDENTES (não há derivação algorítmica entre eles):
 *
 * | Campo do form              | Campo no banco              | Semântica                                                |
 * |----------------------------|-----------------------------|----------------------------------------------------------|
 * | `numeroUC`                 | `Uc.numero`                 | ID INTERNO SISGD (canônico). Aceita formato EDP-ES atual |
 * |                            |                             | (15 díg) — guard backend normaliza pra 10 díg interno.   |
 * | `numeroUCLegado`           | `Uc.numeroUC`               | Número ANTIGO EDP (9 díg). Usado em GD/SCEE pra listas   |
 * |                            |                             | de compensação. CAPTURADO MANUAL pelo cooperado (carta   |
 * |                            |                             | da EDP). OCR NÃO PREENCHE. INVARIANTE SCEE.              |
 * | `numeroConcessionariaOrig` | `Uc.numeroConcessionaria…`  | String preservada com pontuação (`0.XXX.XXX.XXX.XXX-YY`).|
 * |                            |                             | OCR popula direto da fatura atual EDP-ES.                |
 *
 * Prioridade pro `numeroUC` do form (principal):
 *   1. `numero` (canônico OCR, 10 díg) — quando OCR retorna explícito.
 *   2. `numeroConcessionariaOriginal` (15 díg com pontos da fatura atual) —
 *      guard backend aceita esse formato direto e normaliza.
 *   3. `numeroUC` OCR (legado, raro em faturas atuais) — fallback.
 *   4. Vazio (usuário digita manual).
 *
 * REGRA INVARIANTE SCEE: este mapper NUNCA preenche `numeroUCLegado` a partir
 * de derivação dos 15 díg. O legado/antigo EDP é matematicamente DIFERENTE do
 * formato 15 díg (caso real UC Luciano: original=0.001.421.380.054-70, mas
 * numeroUC GD/SCEE=160085263 — sem relação derivável). Se OCR retornou
 * `numeroUC` explícito (raro), passa adiante; senão, fica vazio (cooperado
 * preenche manual no campo "Número antigo — se a EDP já te mandou").
 *
 * **Função pura** — sem React, sem DOM, sem efeitos.
 */

export interface OcrUcInput {
  numero?: string | null;
  numeroUC?: string | null;
  numeroConcessionariaOriginal?: string | null;
}

export interface OcrUcOutput {
  /**
   * Campo principal do form ("Número da instalação (UC) *").
   * Aceita formato canônico 6-11 díg OU formato EDP-ES atual 15 díg (com pontos).
   * Backend guard normaliza pro ID interno de 10 díg.
   */
  numeroUC: string;
  /**
   * Campo separado "Número antigo (se a EDP já te mandou)" — opcional.
   * SÓ preenchido quando OCR retorna explícito o legado 9 díg (raro).
   * **NUNCA derivado de original 15 díg.** Cooperado preenche manual quando tem.
   */
  numeroUCLegado: string;
  /**
   * String preservada como aparece na fatura (com pontos/hífens). Não normalizar.
   * Pré-preenchido direto do OCR — mostra ao cooperado que sistema leu a fatura.
   */
  numeroConcessionariaOriginal: string;
}

/**
 * Mapeia a resposta do `POST /publico/processar-fatura-ocr` (campo `dados`)
 * pra forma esperada pelo step "Instalação" do wizard.
 *
 * @example
 *   // Fatura EDP-ES atual — só tem o original com pontos (caso típico hoje).
 *   mapearOcrParaInstalacao({ numeroConcessionariaOriginal: '0.000.374.127.054-59' })
 *   // → {
 *   //     numeroUC: '0.000.374.127.054-59',  // campo principal pré-preenchido (15 díg);
 *   //                                        // guard backend normaliza pra '0374127054'
 *   //     numeroUCLegado: '',                // NÃO derivado — usuário preenche se tiver
 *   //     numeroConcessionariaOriginal: '0.000.374.127.054-59'
 *   //   }
 *
 *   // Fatura com canônico explícito (raro)
 *   mapearOcrParaInstalacao({ numero: '0400702214', numeroConcessionariaOriginal: '0.001.421.380.054-70' })
 *   // → {
 *   //     numeroUC: '0400702214',                            // canônico OCR wins
 *   //     numeroUCLegado: '',
 *   //     numeroConcessionariaOriginal: '0.001.421.380.054-70'
 *   //   }
 *
 *   // Fatura com legado 9 díg explícito (raro)
 *   mapearOcrParaInstalacao({ numeroUC: '160085263' })
 *   // → { numeroUC: '160085263', numeroUCLegado: '160085263', numeroConcessionariaOriginal: '' }
 *
 *   // Nenhuma forma → tudo vazio (usuário digita).
 *   mapearOcrParaInstalacao({})
 *   // → { numeroUC: '', numeroUCLegado: '', numeroConcessionariaOriginal: '' }
 */
export function mapearOcrParaInstalacao(d: OcrUcInput): OcrUcOutput {
  const canonico = (d.numero ?? '').replace(/\D/g, '');
  const legado = (d.numeroUC ?? '').replace(/\D/g, '');
  const original = (d.numeroConcessionariaOriginal ?? '').toString();

  // Prioridade pro campo principal:
  //   1. Canônico OCR (formato ideal, raro hoje em EDP-ES)
  //   2. Original com pontuação (15 díg fatura EDP-ES atual — guard backend aceita)
  //   3. Legado 9 díg do OCR (raro)
  //   4. Vazio (usuário digita)
  const numeroUC = canonico || original || legado;

  return {
    numeroUC,
    // INVARIANTE SCEE: NÃO derivar legado/antigo do original. Só passa adiante
    // quando OCR retornou explícito.
    numeroUCLegado: legado,
    numeroConcessionariaOriginal: original,
  };
}
