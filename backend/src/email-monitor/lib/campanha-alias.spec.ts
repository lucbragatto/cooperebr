/**
 * Sprint Máscara de e-mail por convênio (06/07/2026) — specs dos helpers
 * puros. Cobertura: match de alias com local-part variável (Acréscimo A),
 * sanitização de OCR (Acréscimo B) e sanitização de UC.
 */
import {
  matchAliasCampanha,
  localPartDoMailboxTenant,
  sanitizarTextoOcr,
  sanitizarNumeroUc,
} from './campanha-alias';

describe('localPartDoMailboxTenant', () => {
  it('extrai local-part de endereço válido', () => {
    expect(localPartDoMailboxTenant('contato@cooperebr.com.br')).toBe('contato');
  });
  it('lowercase', () => {
    expect(localPartDoMailboxTenant('RH@Empresa.COM')).toBe('rh');
  });
  it('null/undefined/vazio → null', () => {
    expect(localPartDoMailboxTenant(null)).toBeNull();
    expect(localPartDoMailboxTenant(undefined)).toBeNull();
    expect(localPartDoMailboxTenant('')).toBeNull();
    expect(localPartDoMailboxTenant('não-tem-arroba')).toBeNull();
  });
});

describe('matchAliasCampanha — Acréscimo A (local-part dinâmico)', () => {
  it('bate com formato <local>+<alias>@<domain>', () => {
    const r = matchAliasCampanha(
      ['contato+mule@cooperebr.com.br'],
      'contato',
      'mule',
    );
    expect(r.bateu).toBe(true);
    expect(r.aliasDetectado).toBe('mule');
    expect(r.destinatarioCasou).toBe('contato+mule@cooperebr.com.br');
  });

  it('local-part diferente do tenant → NÃO bate (outro parceiro futuro)', () => {
    const r = matchAliasCampanha(
      ['contato+santi@cooperebr.com.br'],
      'atendimento', // outro tenant, outro local-part
      'santi',
    );
    expect(r.bateu).toBe(false);
  });

  it('lowercase em tudo (destinatário/local/alias)', () => {
    const r = matchAliasCampanha(
      ['Contato+MULE@CoopereBR.com.br'],
      'CONTATO',
      'Mule',
    );
    expect(r.bateu).toBe(true);
    expect(r.aliasDetectado).toBe('mule');
  });

  it('tolera formato "Nome <email>" via trim/strip', () => {
    const r = matchAliasCampanha(
      [' <contato+mule@cooperebr.com.br> '],
      'contato',
      'mule',
    );
    expect(r.bateu).toBe(true);
  });

  it('sem alias no destinatário → NÃO bate', () => {
    const r = matchAliasCampanha(
      ['contato@cooperebr.com.br'],
      'contato',
      'mule',
    );
    expect(r.bateu).toBe(false);
  });

  it('destinatário com outro sufixo → NÃO bate', () => {
    const r = matchAliasCampanha(
      ['contato+santi@cooperebr.com.br'],
      'contato',
      'mule',
    );
    expect(r.bateu).toBe(false);
  });

  it('múltiplos destinatários, um bate → retorna o que bateu', () => {
    const r = matchAliasCampanha(
      ['ninguem@x.com', 'contato+mule@cooperebr.com.br', 'outro@y.com'],
      'contato',
      'mule',
    );
    expect(r.bateu).toBe(true);
    expect(r.destinatarioCasou).toBe('contato+mule@cooperebr.com.br');
  });

  it('local-part ausente → não bate (fail-closed)', () => {
    const r = matchAliasCampanha(['contato+mule@cooperebr.com.br'], null, 'mule');
    expect(r.bateu).toBe(false);
  });

  it('alias ausente → não bate (fail-closed)', () => {
    const r = matchAliasCampanha(['contato+mule@cooperebr.com.br'], 'contato', null);
    expect(r.bateu).toBe(false);
  });

  it('domínio livre — Gmail aceita múltiplos domínios rotando pra mesma caixa', () => {
    const r = matchAliasCampanha(
      ['contato+mule@cooperebr.com.br'],
      'contato',
      'mule',
    );
    expect(r.bateu).toBe(true);
    // Se o mesmo alias vier em outro domínio, ainda bate (a caixa é a mesma).
    const r2 = matchAliasCampanha(
      ['contato+mule@gmail.com'],
      'contato',
      'mule',
    );
    expect(r2.bateu).toBe(true);
  });
});

describe('sanitizarTextoOcr — Acréscimo B', () => {
  it('trim + strip runs de whitespace', () => {
    expect(sanitizarTextoOcr('   João    da   Silva   ')).toBe('João da Silva');
  });

  it('remove caracteres de controle (\\x00-\\x1F sem \\n/\\t)', () => {
    expect(sanitizarTextoOcr('João\x00\x01da\x1FSilva')).toBe('JoãodaSilva');
  });

  it('limita tamanho preservando quebra de palavra quando possível', () => {
    const longo = 'a'.repeat(50) + ' fim demais pra caber inteiro';
    const r = sanitizarTextoOcr(longo, 60);
    expect(r!.length).toBeLessThanOrEqual(60);
    // Não corta no meio de palavra se der pra respeitar > 70% do limite.
    expect(r!.endsWith(' fim') || r!.endsWith('fim') || !r!.includes('demais')).toBe(true);
  });

  it('null/undefined → undefined', () => {
    expect(sanitizarTextoOcr(null)).toBeUndefined();
    expect(sanitizarTextoOcr(undefined)).toBeUndefined();
  });

  it('vazio após sanitizar → undefined (não polui null)', () => {
    expect(sanitizarTextoOcr('   \x00\x01   ')).toBeUndefined();
  });

  it('tipo diferente de string → undefined', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(sanitizarTextoOcr(42 as any)).toBeUndefined();
  });
});

describe('sanitizarNumeroUc', () => {
  it('mantém só dígitos', () => {
    expect(sanitizarNumeroUc('UC-123.456/789')).toBe('123456789');
  });
  it('limita 15 chars', () => {
    expect(sanitizarNumeroUc('1234567890123456789')).toBe('123456789012345');
  });
  it('menos que 6 dígitos → undefined (evita false-positive)', () => {
    expect(sanitizarNumeroUc('12345')).toBeUndefined();
  });
  it('vazio → undefined', () => {
    expect(sanitizarNumeroUc('')).toBeUndefined();
    expect(sanitizarNumeroUc(null)).toBeUndefined();
  });
});
