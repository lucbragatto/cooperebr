/**
 * Sprint Faxina Contábil do Token (22/06/2026) — classificação canônica.
 *
 * Mapeia cada `CooperTokenTipo` em uma das 3 categorias contábeis canônicas
 * do modelo voucher CPC 47 + ato cooperativo Lei 5.764/71:
 *
 *   1. INGRESSO_PAGO  — empresa cooperada pagou (entra caixa).
 *      → Evento INGRESSO_EMISSAO_PAGA → D Caixa / C Passivo 2.3.01
 *   2. BONIFICACAO_DESCONTO — cooperativa bonifica vinculando a desconto/crédito.
 *      → Evento EMITIDO → D 5.1.10 Custo Desconto Token / C Passivo
 *   3. BONIFICACAO_ADMIN — cooperativa bonifica admin/MLM/social (sem caixa).
 *      → Evento EMITIDO → D 5.1.03 Despesa Bonificação / C Passivo
 *   4. TRANSFERENCIA_INTERNA — só muda titular do passivo (sem caixa, sem
 *      despesa, sem receita). NÃO emite evento contábil.
 *   5. USO — débito do voucher (não é emissão; tem handlers próprios).
 *
 * **PROPOSTA pra `cooperebr-analista-conformidade` VALIDAR nos reviewers.**
 * Sem confirmação do analista, default tributação `PROPRIO` (cooperado
 * associado = ato cooperativo isento). Reviewers devem validar caso a caso.
 */
import type { CooperTokenTipo } from '@prisma/client';

export type CategoriaContabilToken =
  | 'INGRESSO_PAGO'
  | 'BONIFICACAO_DESCONTO'
  | 'BONIFICACAO_ADMIN'
  | 'TRANSFERENCIA_INTERNA'
  | 'USO';

interface ClassificacaoResult {
  categoria: CategoriaContabilToken;
  /** Default sugerido — analista-conformidade pode promover. */
  naturezaAtoSugerida: 'PROPRIO' | 'AUXILIAR' | 'NAO_COOPERATIVO';
  /** Justificativa pra audit log + reviewer. */
  motivo: string;
}

/**
 * Classifica um CooperTokenTipo CREDITO (emissão) pra decidir qual
 * lançamento contábil disparar.
 *
 * Tipos DEBITO (USO) — PAGAMENTO_QR, DESCONTO_FATURA, RESGATE_PIX,
 * OXIDACAO — retornam `USO` (handlers próprios).
 */
export function classificarTipo(tipo: CooperTokenTipo | string): ClassificacaoResult {
  switch (tipo) {
    // INGRESSO_PAGO — empresa cooperada paga ⇒ entra caixa
    case 'BENEFICIO_CONVENIO':
      return {
        categoria: 'INGRESSO_PAGO',
        naturezaAtoSugerida: 'AUXILIAR', // Art. 88 convênio; admin promove pra PROPRIO se documental
        motivo: 'Benefício de convênio: empresa cooperada paga por tokens. Ingresso de custeio (Art. 88 — Auxiliar default).',
      };
    case 'COMPRA_PJ_COOPERADA':
      return {
        categoria: 'INGRESSO_PAGO',
        naturezaAtoSugerida: 'PROPRIO', // empresa cooperada compra pra si própria; ato típico
        motivo: 'Compra direta por empresa cooperada PJ. Ato cooperativo típico (Art. 79 — Próprio).',
      };

    // BONIFICACAO_DESCONTO — desconto na fatura virou token (kWh excedente, FLEX, FATURA_CHEIA)
    case 'GERACAO_EXCEDENTE':
    case 'FATURA_CHEIA':
    case 'FLEX':
      return {
        categoria: 'BONIFICACAO_DESCONTO',
        naturezaAtoSugerida: 'PROPRIO',
        motivo: 'Desconto/crédito kWh virou token. Bonificação SEM caixa. Ato cooperativo típico (Art. 79).',
      };

    // BONIFICACAO_ADMIN — coop dá direto (sem caixa, sem vincular a desconto fatura)
    case 'BONUS_INDICACAO':
      return {
        categoria: 'BONIFICACAO_ADMIN',
        naturezaAtoSugerida: 'PROPRIO',
        motivo: 'Recompensa MLM. Coop bonifica indicador sem entrada de caixa. Ato cooperativo (Art. 79). Saque BLOQUEADO por fiscal.',
      };
    case 'SOCIAL':
      return {
        categoria: 'BONIFICACAO_ADMIN',
        naturezaAtoSugerida: 'PROPRIO',
        // P2 analista-conformidade 22/06: SOCIAL sem validação de destinatário
        // cooperado tem risco fiscal (premio social a NÃO-cooperado vira
        // NAO_COOPERATIVO Art. 86-87, tributação plena PIS/COFINS+IRPJ).
        // Default PROPRIO conservador; D-novo-FAXINA-SOCIAL-DESTINATARIO
        // catalogado pra restringir emissão (controller deveria checar
        // cooperado.status ATIVO antes ou exigir naturezaAto explícita).
        motivo: 'Bonificação social. Coop bonifica sem caixa. Ato cooperativo (Art. 79). RISCO se destinatário não-cooperado — confirmar pelo controller antes de emitir.',
      };
    case 'BONIFICACAO_ADMIN':
      return {
        categoria: 'BONIFICACAO_ADMIN',
        naturezaAtoSugerida: 'PROPRIO',
        motivo: 'Emissão admin em lote (M39). Coop bonifica destinatários sem caixa. lancarEmissaoAdminLote já é canônico.',
      };

    // TRANSFERENCIA_INTERNA — empresa PJ distribui pra funcionário; só muda holder
    case 'DISTRIBUICAO_CONVENIO':
      return {
        categoria: 'TRANSFERENCIA_INTERNA',
        naturezaAtoSugerida: 'PROPRIO',
        motivo: 'Empresa PJ distribui ao funcionário-cooperado. Passivo só muda titular (sem caixa, sem despesa). NÃO emitir evento contábil novo — passivo total da coop não muda.',
      };

    // USO (DEBITO) — não é emissão; tem handler próprio
    case 'DESCONTO_FATURA':
    case 'PAGAMENTO_QR':
    case 'RESGATE_PIX':
      return {
        categoria: 'USO',
        naturezaAtoSugerida: 'PROPRIO',
        motivo: 'Débito do voucher (uso/saída). Handler próprio (RESGATADO/RESGATE_PIX/QR).',
      };

    // Sprint Faxina Contábil (22/06/2026) — fix P1 code-reviewer.
    // Estornos são reversões de operações já contabilizadas → categoria USO
    // (handler próprio do estorno cuida da reversão D Passivo / C Despesa).
    // Sem este case, caíam no default BONIFICACAO_ADMIN — gerariam D 5.1.03
    // bonificação espelhando o estorno = passivo errado.
    case 'ESTORNO_RESGATE_PIX':
    case 'ESTORNO_BONIFICACAO_ADMIN':
      return {
        categoria: 'USO',
        naturezaAtoSugerida: 'PROPRIO',
        motivo: `Estorno (${tipo}) — reversão de operação já lançada. Handler próprio do estorno faz reversão espelhada.`,
      };

    default:
      // Conservador: trata como bonificação admin (mais comum) com aviso.
      return {
        categoria: 'BONIFICACAO_ADMIN',
        naturezaAtoSugerida: 'PROPRIO',
        motivo: `Tipo "${tipo}" não classificado explicitamente. Default BONIFICACAO_ADMIN/PROPRIO — reviewer-analista deve catalogar.`,
      };
  }
}
