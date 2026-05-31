import { TipoRegimeContabil } from '@prisma/client';
import { RegimeContabilFactory } from './regime.factory';
import { RegimeNaoImplementadoException } from './regime-contabil.interface';

/**
 * D-novo-BR-CT CT.2 — Factory resolve impl correta sem fallback silencioso.
 * P0-1 do parecer subagent: NUNCA herdar isenção cooperativa em outros regimes.
 */
describe('RegimeContabilFactory', () => {
  const factory = new RegimeContabilFactory();

  it('COOPERATIVO → RegimeCooperativo implementado', () => {
    const r = factory.resolve(TipoRegimeContabil.COOPERATIVO);
    expect(r.nome).toBe('COOPERATIVO');
    // Sanity: classifica sem throw
    expect(() =>
      r.classificarLancamento({ tipo: 'COBRANCA', cooperadoTipoCooperado: 'COM_UC' }),
    ).not.toThrow();
  });

  it.each([
    [TipoRegimeContabil.CONSORCIO_PROPORCIONAL, 'CONSORCIO_PROPORCIONAL'],
    [TipoRegimeContabil.ASSOCIACAO_SEM_FINS_LUCRATIVOS, 'ASSOCIACAO_SEM_FINS_LUCRATIVOS'],
    [TipoRegimeContabil.CONDOMINIO_EDILICIO, 'CONDOMINIO_EDILICIO'],
  ])('%s = STUB → lança RegimeNaoImplementadoException ao classificar', (regime, nome) => {
    const r = factory.resolve(regime);
    expect(r.nome).toBe(nome);
    expect(() =>
      r.classificarLancamento({ tipo: 'COBRANCA', cooperadoTipoCooperado: 'COM_UC' }),
    ).toThrow(RegimeNaoImplementadoException);
  });

  it('mensagem da exception cita o regime + risco P0-1', () => {
    const r = factory.resolve(TipoRegimeContabil.CONSORCIO_PROPORCIONAL);
    try {
      r.classificarLancamento({ tipo: 'CONVENIO' });
      fail('deveria ter lançado');
    } catch (err: any) {
      expect(err).toBeInstanceOf(RegimeNaoImplementadoException);
      expect(err.message).toContain('CONSORCIO_PROPORCIONAL');
      expect(err.message).toContain('P0-1');
      expect(err.message).toContain('isenção fiscal');
    }
  });
});
