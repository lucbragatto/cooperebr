import { NaturezaCooperativa } from '@prisma/client';
import { RegimeCooperativo } from './cooperativo.regime';

/**
 * D-novo-BR-CT CT.2 — Specs da tabela de classificação aprovada Luciano 31/05.
 * Cobre os 6 casos canônicos + edges.
 */
describe('RegimeCooperativo.classificarLancamento', () => {
  const regime = new RegimeCooperativo();

  describe('Cobranca', () => {
    it.each(['COM_UC', 'SEM_UC', 'GERADOR'])(
      'cooperado-associado tipoCooperado=%s → PROPRIO',
      (tipo) => {
        expect(
          regime.classificarLancamento({ tipo: 'COBRANCA', cooperadoTipoCooperado: tipo }),
        ).toBe(NaturezaCooperativa.PROPRIO);
      },
    );

    it.each(['CARREGADOR_VEICULAR', 'USUARIO_CARREGADOR'])(
      'terceiro tipoCooperado=%s → NAO_COOPERATIVO',
      (tipo) => {
        expect(
          regime.classificarLancamento({ tipo: 'COBRANCA', cooperadoTipoCooperado: tipo }),
        ).toBe(NaturezaCooperativa.NAO_COOPERATIVO);
      },
    );

    it('cooperadoTipoCooperado=null (deletado/desconhecido) → PROPRIO (default + flag Walter)', () => {
      expect(
        regime.classificarLancamento({ tipo: 'COBRANCA', cooperadoTipoCooperado: null }),
      ).toBe(NaturezaCooperativa.PROPRIO);
    });
  });

  describe('ContaAPagar', () => {
    it('despesa operacional usina → PROPRIO', () => {
      expect(regime.classificarLancamento({ tipo: 'CONTA_A_PAGAR' })).toBe(
        NaturezaCooperativa.PROPRIO,
      );
    });
  });

  describe('RepasseProprietario — P0-3 do parecer (caso crítico)', () => {
    it('Usina.formaAquisicao=ALUGUEL → NAO_COOPERATIVO (arrendamento externo)', () => {
      expect(
        regime.classificarLancamento({
          tipo: 'REPASSE_PROPRIETARIO',
          usinaFormaAquisicao: 'ALUGUEL',
        }),
      ).toBe(NaturezaCooperativa.NAO_COOPERATIVO);
    });

    it('Usina.formaAquisicao=CESSAO → PROPRIO (cooperado-proprietário cede)', () => {
      expect(
        regime.classificarLancamento({
          tipo: 'REPASSE_PROPRIETARIO',
          usinaFormaAquisicao: 'CESSAO',
        }),
      ).toBe(NaturezaCooperativa.PROPRIO);
    });

    it('Usina.formaAquisicao=PROPRIA → PROPRIO (usina própria)', () => {
      expect(
        regime.classificarLancamento({
          tipo: 'REPASSE_PROPRIETARIO',
          usinaFormaAquisicao: 'PROPRIA',
        }),
      ).toBe(NaturezaCooperativa.PROPRIO);
    });

    it('Usina.formaAquisicao=null (legado sem campo) → PROPRIO (default)', () => {
      expect(
        regime.classificarLancamento({
          tipo: 'REPASSE_PROPRIETARIO',
          usinaFormaAquisicao: null,
        }),
      ).toBe(NaturezaCooperativa.PROPRIO);
    });
  });

  describe('Convenio', () => {
    it('Art. 88 Lei 5.764/71 → AUXILIAR', () => {
      expect(regime.classificarLancamento({ tipo: 'CONVENIO' })).toBe(
        NaturezaCooperativa.AUXILIAR,
      );
    });
  });

  describe('Garantias de design', () => {
    it('nome do regime é COOPERATIVO', () => {
      expect(regime.nome).toBe('COOPERATIVO');
    });
  });
});
