import {
  buildWaMeConviteUrl,
  montarMensagemConvite,
} from './wa-me-builder';

describe('wa-me-builder — LOTE.5', () => {
  const baseParams = {
    telefoneDestinatario: '5527999990001',
    nomeDestinatario: 'Dra. Ana',
    empresaNome: 'Clínica X',
    linkConvite: 'https://sisgd.app/cadastro?conv=abc123',
  };

  it('CONVENIO_EMPRESA (default): mensagem cita empresa + link + validade', () => {
    const msg = montarMensagemConvite(baseParams);
    expect(msg).toContain('Olá, Dra. Ana');
    expect(msg).toContain('*Clínica X*');
    expect(msg).toContain('https://sisgd.app/cadastro?conv=abc123');
    expect(msg).toContain('Validade: 7 dias');
  });

  it('INDICACAO_COOPERADO: cita indicador e fala em economia', () => {
    const msg = montarMensagemConvite({
      ...baseParams,
      variante: 'INDICACAO_COOPERADO',
      nomeIndicador: 'Luciano Bragatto',
    });
    expect(msg).toContain('Luciano Bragatto convidou você');
    expect(msg).toContain('economizar na conta de luz');
    expect(msg).toContain('https://sisgd.app/cadastro?conv=abc123');
  });

  it('INDICACAO_COOPERADO sem nomeIndicador → fallback "um colega"', () => {
    const msg = montarMensagemConvite({
      ...baseParams,
      variante: 'INDICACAO_COOPERADO',
    });
    expect(msg).toContain('um colega convidou você');
  });

  it('buildWaMeConviteUrl: gera wa.me com encoding correto', () => {
    const r = buildWaMeConviteUrl(baseParams);
    expect(r.urlWa).toMatch(/^https:\/\/wa\.me\/5527999990001\?text=/);
    expect(r.telefoneNormalizado).toBe('5527999990001');
    // Decodifica e compara
    const url = new URL(r.urlWa);
    const decoded = decodeURIComponent(url.searchParams.get('text') ?? '');
    expect(decoded).toBe(r.mensagem);
    expect(decoded).toContain('Clínica X');
  });

  it('normalização: tira (, ), -, espaços, +', () => {
    const r = buildWaMeConviteUrl({
      ...baseParams,
      telefoneDestinatario: '+55 (27) 99999-0001',
    });
    expect(r.telefoneNormalizado).toBe('5527999990001');
  });

  it('telefone muito curto → throw', () => {
    expect(() =>
      buildWaMeConviteUrl({ ...baseParams, telefoneDestinatario: '123' }),
    ).toThrow(/Telefone inválido/);
  });

  it('caracteres especiais no nome (acentos, pontuação) encodam corretos', () => {
    const r = buildWaMeConviteUrl({
      ...baseParams,
      nomeDestinatario: 'Dra. María José',
    });
    expect(r.mensagem).toContain('María José');
    // O URL contém a versão encoded
    expect(r.urlWa).toContain(encodeURIComponent('María José'));
  });
});
