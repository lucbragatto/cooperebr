/**
 * Specs cooperado-matcher.helper — sprint "Qual cadastro?" (08/06/2026).
 */
import {
  variantesTelefone,
  acharCooperadosPorTelefone,
  acharCooperadosPorUsuario,
  formatarLabelCadastro,
} from './cooperado-matcher.helper';

function mkPrismaMock(findManyImpl: jest.Mock) {
  return { cooperado: { findMany: findManyImpl } } as any;
}

describe('variantesTelefone', () => {
  it('E.164 BR sem mascara -> 3 variantes', () => {
    expect(variantesTelefone('5527981341348').sort()).toEqual(
      ['27981341348', '5527981341348'].sort(),
    );
  });
  it('Mascarado "(27)98134-1348" -> dígitos puros', () => {
    expect(variantesTelefone('(27)98134-1348').sort()).toEqual(
      ['27981341348', '5527981341348'].sort(),
    );
  });
  it('Sem 55 -> adiciona 55 nas variantes', () => {
    expect(variantesTelefone('27981341348')).toContain('5527981341348');
  });
  it('String vazia -> array vazio', () => {
    expect(variantesTelefone('')).toEqual([]);
  });
  it('Só letras -> array vazio', () => {
    expect(variantesTelefone('abc')).toEqual([]);
  });
});

describe('acharCooperadosPorTelefone', () => {
  it('Retorna lista completa ordenada por createdAt asc', async () => {
    const findMany = jest.fn().mockResolvedValueOnce([
      { id: 'c1', nomeCompleto: 'Luciano', cooperativaId: 'A', tipoPessoa: 'PF', razaoSocial: null },
      { id: 'c2', nomeCompleto: 'SISGD', cooperativaId: 'A', tipoPessoa: 'PJ', razaoSocial: 'SISGDSOLAR' },
    ]);
    const r = await acharCooperadosPorTelefone(mkPrismaMock(findMany), '5527981341348');
    expect(r).toHaveLength(2);
    expect(findMany).toHaveBeenCalledWith({
      where: expect.objectContaining({
        telefone: { in: expect.arrayContaining(['5527981341348', '27981341348']) },
        status: { in: expect.any(Array) },
      }),
      select: expect.any(Object),
      orderBy: { createdAt: 'asc' },
    });
  });

  it('Telefone invalido -> array vazio (sem chamar DB)', async () => {
    const findMany = jest.fn();
    const r = await acharCooperadosPorTelefone(mkPrismaMock(findMany), '');
    expect(r).toEqual([]);
    expect(findMany).not.toHaveBeenCalled();
  });
});

describe('acharCooperadosPorUsuario', () => {
  it('Email + cpf -> OR com ambos', async () => {
    const findMany = jest.fn().mockResolvedValueOnce([]);
    await acharCooperadosPorUsuario(mkPrismaMock(findMany), { email: 'a@b.com', cpf: '123' });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { OR: [{ email: 'a@b.com' }, { cpf: '123' }] },
      }),
    );
  });

  it('Só email -> OR só com email', async () => {
    const findMany = jest.fn().mockResolvedValueOnce([]);
    await acharCooperadosPorUsuario(mkPrismaMock(findMany), { email: 'a@b.com' });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { OR: [{ email: 'a@b.com' }] } }),
    );
  });

  it('Sem email nem cpf -> array vazio sem chamar DB', async () => {
    const findMany = jest.fn();
    const r = await acharCooperadosPorUsuario(mkPrismaMock(findMany), {});
    expect(r).toEqual([]);
    expect(findMany).not.toHaveBeenCalled();
  });
});

describe('formatarLabelCadastro', () => {
  it('PF usa nomeCompleto', () => {
    expect(
      formatarLabelCadastro({
        id: 'c1', nomeCompleto: 'Luciano Bragatto', cooperativaId: 'A',
        tipoPessoa: 'PF', razaoSocial: null,
      }),
    ).toBe('Luciano Bragatto (PF)');
  });
  it('PJ usa razaoSocial quando presente', () => {
    expect(
      formatarLabelCadastro({
        id: 'c2', nomeCompleto: 'SISGD', cooperativaId: 'A',
        tipoPessoa: 'PJ', razaoSocial: 'SISGDSOLAR SISTEMAS LTDA',
      }),
    ).toBe('SISGDSOLAR SISTEMAS LTDA (PJ)');
  });
  it('PJ sem razaoSocial cai pro nomeCompleto', () => {
    expect(
      formatarLabelCadastro({
        id: 'c2', nomeCompleto: 'SISGD', cooperativaId: 'A',
        tipoPessoa: 'PJ', razaoSocial: null,
      }),
    ).toBe('SISGD (PJ)');
  });
  it('tipoPessoa null -> default PF', () => {
    expect(
      formatarLabelCadastro({
        id: 'c1', nomeCompleto: 'X', cooperativaId: 'A',
        tipoPessoa: null, razaoSocial: null,
      }),
    ).toBe('X (PF)');
  });
});
