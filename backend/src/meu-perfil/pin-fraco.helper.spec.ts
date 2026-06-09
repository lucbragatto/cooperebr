import { isPinFraco } from './pin-fraco.helper';

describe('isPinFraco', () => {
  it('formato invalido -> fraco', () => {
    expect(isPinFraco('')).toBe(true);
    expect(isPinFraco('12345')).toBe(true); // 5 digitos
    expect(isPinFraco('1234567')).toBe(true); // 7 digitos
    expect(isPinFraco('abcdef')).toBe(true); // nao numerico
    expect(isPinFraco('12a456')).toBe(true);
  });

  it('6 digitos iguais -> fraco', () => {
    expect(isPinFraco('000000')).toBe(true);
    expect(isPinFraco('111111')).toBe(true);
    expect(isPinFraco('555555')).toBe(true);
    expect(isPinFraco('999999')).toBe(true);
  });

  it('sequencia ascendente continua -> fraco', () => {
    expect(isPinFraco('012345')).toBe(true);
    expect(isPinFraco('123456')).toBe(true);
    expect(isPinFraco('234567')).toBe(true);
    expect(isPinFraco('345678')).toBe(true);
    expect(isPinFraco('456789')).toBe(true);
  });

  it('sequencia descendente continua -> fraco', () => {
    expect(isPinFraco('987654')).toBe(true);
    expect(isPinFraco('876543')).toBe(true);
    expect(isPinFraco('765432')).toBe(true);
    expect(isPinFraco('654321')).toBe(true);
    expect(isPinFraco('543210')).toBe(true);
  });

  it('PIN forte aceitavel', () => {
    expect(isPinFraco('273981')).toBe(false);
    expect(isPinFraco('407152')).toBe(false);
    expect(isPinFraco('195843')).toBe(false);
    expect(isPinFraco('608241')).toBe(false);
  });

  it('quase-sequencia mas com quebra -> forte', () => {
    expect(isPinFraco('123457')).toBe(false); // quase 123456
    expect(isPinFraco('987655')).toBe(false); // quase 987654
    expect(isPinFraco('012344')).toBe(false);
  });
});
