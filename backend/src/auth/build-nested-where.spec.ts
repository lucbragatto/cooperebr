import { buildNestedWhere } from './build-nested-where';

/**
 * D-novo-BR F1.1 — helper puro pro TenantOwnershipGuard.
 */
describe('buildNestedWhere', () => {
  it('caminho 1 nível → objeto plano', () => {
    expect(buildNestedWhere('cooperativaId', 'X')).toEqual({ cooperativaId: 'X' });
  });

  it('caminho 2 níveis → aninha um nível', () => {
    expect(buildNestedWhere('cooperado.cooperativaId', 'X')).toEqual({
      cooperado: { cooperativaId: 'X' },
    });
  });

  it('caminho 3 níveis → aninha dois níveis', () => {
    expect(buildNestedWhere('contrato.usina.cooperativaId', 'X')).toEqual({
      contrato: { usina: { cooperativaId: 'X' } },
    });
  });

  it('aceita value não-string (null, number, boolean)', () => {
    expect(buildNestedWhere('cooperativaId', null)).toEqual({ cooperativaId: null });
    expect(buildNestedWhere('foo.bar', 42)).toEqual({ foo: { bar: 42 } });
  });

  it('lança erro com path vazio', () => {
    expect(() => buildNestedWhere('', 'X')).toThrow();
  });

  it('lança erro com path não-string', () => {
    expect(() => buildNestedWhere(undefined as any, 'X')).toThrow();
    expect(() => buildNestedWhere(null as any, 'X')).toThrow();
  });

  it('ignora pontos extras no fim do path', () => {
    expect(buildNestedWhere('cooperado.cooperativaId.', 'X')).toEqual({
      cooperado: { cooperativaId: 'X' },
    });
  });
});
