import { isEmpresaCooperada, isPessoaFisica } from './cooperado-tipo.helper';

describe('cooperado-tipo.helper', () => {
  it('tipoPessoa=PJ -> isEmpresaCooperada=true', () => {
    expect(isEmpresaCooperada({ tipoPessoa: 'PJ' })).toBe(true);
    expect(isPessoaFisica({ tipoPessoa: 'PJ' })).toBe(false);
  });

  it('tipoPessoa=PF -> isEmpresaCooperada=false', () => {
    expect(isEmpresaCooperada({ tipoPessoa: 'PF' })).toBe(false);
    expect(isPessoaFisica({ tipoPessoa: 'PF' })).toBe(true);
  });

  it('tipoPessoa=null -> default PF', () => {
    expect(isEmpresaCooperada({ tipoPessoa: null })).toBe(false);
    expect(isPessoaFisica({ tipoPessoa: null })).toBe(true);
  });

  it('tipoPessoa=undefined -> default PF', () => {
    expect(isEmpresaCooperada({})).toBe(false);
    expect(isPessoaFisica({})).toBe(true);
  });

  it('tipoPessoa lowercase "pj" -> reconhece PJ', () => {
    expect(isEmpresaCooperada({ tipoPessoa: 'pj' })).toBe(true);
  });
});
