/**
 * Sprint Faxina Contábil do Token (22/06/2026) — Fase A/B.
 *
 * Specs da classificação canônica. Cobertura: cada CooperTokenTipo cai numa
 * das 5 categorias esperadas + naturezaAto sugerida.
 *
 * **PROPOSTA pra cooperebr-analista-conformidade VALIDAR.** Sem confirmação,
 * defaults conservadores (PROPRIO pra cooperado típico, AUXILIAR pra convênio).
 */
import { classificarTipo } from './classificacao-contabil.helper';

describe('Faxina Contábil — classificarTipo', () => {
  describe('INGRESSO_PAGO (entra caixa)', () => {
    it('BENEFICIO_CONVENIO → INGRESSO_PAGO + AUXILIAR (Art. 88 convênio)', () => {
      const r = classificarTipo('BENEFICIO_CONVENIO');
      expect(r.categoria).toBe('INGRESSO_PAGO');
      expect(r.naturezaAtoSugerida).toBe('AUXILIAR');
      expect(r.motivo).toMatch(/Art\. 88|convênio/i);
    });

    it('COMPRA_PJ_COOPERADA → INGRESSO_PAGO + PROPRIO (Art. 79 ato típico)', () => {
      const r = classificarTipo('COMPRA_PJ_COOPERADA');
      expect(r.categoria).toBe('INGRESSO_PAGO');
      expect(r.naturezaAtoSugerida).toBe('PROPRIO');
      expect(r.motivo).toMatch(/Art\. 79|próprio/i);
    });
  });

  describe('BONIFICACAO_DESCONTO (kWh/desconto → token, sem caixa)', () => {
    it.each(['GERACAO_EXCEDENTE', 'FATURA_CHEIA', 'FLEX'])(
      '%s → BONIFICACAO_DESCONTO + PROPRIO',
      (tipo) => {
        const r = classificarTipo(tipo);
        expect(r.categoria).toBe('BONIFICACAO_DESCONTO');
        expect(r.naturezaAtoSugerida).toBe('PROPRIO');
      },
    );
  });

  describe('BONIFICACAO_ADMIN (coop bonifica sem caixa)', () => {
    it('BONUS_INDICACAO → BONIFICACAO_ADMIN + PROPRIO + nota saque BLOQUEADO', () => {
      const r = classificarTipo('BONUS_INDICACAO');
      expect(r.categoria).toBe('BONIFICACAO_ADMIN');
      expect(r.naturezaAtoSugerida).toBe('PROPRIO');
      expect(r.motivo).toMatch(/BLOQUEADO/i);
    });

    it.each(['SOCIAL', 'BONIFICACAO_ADMIN'])(
      '%s → BONIFICACAO_ADMIN + PROPRIO',
      (tipo) => {
        const r = classificarTipo(tipo);
        expect(r.categoria).toBe('BONIFICACAO_ADMIN');
        expect(r.naturezaAtoSugerida).toBe('PROPRIO');
      },
    );
  });

  describe('TRANSFERENCIA_INTERNA (passivo só muda titular)', () => {
    it('DISTRIBUICAO_CONVENIO → TRANSFERENCIA_INTERNA + nota "NÃO emitir evento"', () => {
      const r = classificarTipo('DISTRIBUICAO_CONVENIO');
      expect(r.categoria).toBe('TRANSFERENCIA_INTERNA');
      expect(r.motivo).toMatch(/passivo só muda titular|NÃO emitir/i);
    });
  });

  describe('USO (handlers próprios)', () => {
    it.each(['DESCONTO_FATURA', 'PAGAMENTO_QR', 'RESGATE_PIX'])(
      '%s → USO',
      (tipo) => {
        const r = classificarTipo(tipo);
        expect(r.categoria).toBe('USO');
      },
    );

    // Fix P1 code-reviewer 22/06 — estornos NÃO podem cair no default
    // BONIFICACAO_ADMIN (geraria D Despesa Bonificação espelhada errada).
    it.each(['ESTORNO_RESGATE_PIX', 'ESTORNO_BONIFICACAO_ADMIN'])(
      '%s → USO (estornos têm handler próprio)',
      (tipo) => {
        const r = classificarTipo(tipo);
        expect(r.categoria).toBe('USO');
        expect(r.motivo).toMatch(/estorno|reversão/i);
      },
    );
  });

  describe('Tipo desconhecido', () => {
    it('default conservador BONIFICACAO_ADMIN/PROPRIO + nota reviewer', () => {
      const r = classificarTipo('TIPO_INVENTADO' as any);
      expect(r.categoria).toBe('BONIFICACAO_ADMIN');
      expect(r.naturezaAtoSugerida).toBe('PROPRIO');
      expect(r.motivo).toMatch(/reviewer|catalogar/i);
    });
  });
});
