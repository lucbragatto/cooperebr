/**
 * Sub-Fase 1 Fase 5 (M13.A, 19/05/2026) — regression test do fix D-novo-N (18/05).
 *
 * Cobre:
 *   - `isAmbienteReal()` (Camada 1 — discriminador AMBIENTE_REAL, NÃO NODE_ENV)
 *   - `ehEmailFake` / `ehTelefoneFake` (Camada 3 — pattern detection)
 *   - `podeEnviarEmDev` (whitelist DEV + salvaguarda PROD)
 *
 * Origem do bug coberto: `falha_regra_contatos_teste_18_05.md` — PM2 força
 * NODE_ENV=production em dev local, invalidando TODO check `NODE_ENV !==
 * 'production'` do projeto. Fix: 3 camadas defense in depth.
 *
 * Conversão do script manual `backend/scripts/validar-safety-helpers.js` em
 * Jest spec para garantir regression test permanente no pipeline.
 */
import { isAmbienteReal } from './ambiente';
import { ehEmailFake, ehTelefoneFake, podeEnviarEmDev } from './whitelist-teste';

describe('safety helpers — Camada 1 + Camada 3 (D-novo-N regression)', () => {
  const envOriginal = process.env.AMBIENTE_REAL;

  afterEach(() => {
    if (envOriginal === undefined) {
      delete process.env.AMBIENTE_REAL;
    } else {
      process.env.AMBIENTE_REAL = envOriginal;
    }
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Camada 1 — isAmbienteReal()
  // ─────────────────────────────────────────────────────────────────────────

  describe('isAmbienteReal() — discriminador dev/prod', () => {
    it('AMBIENTE_REAL ausente → false (fail-safe dev)', () => {
      delete process.env.AMBIENTE_REAL;
      expect(isAmbienteReal()).toBe(false);
    });

    it("AMBIENTE_REAL='false' → false", () => {
      process.env.AMBIENTE_REAL = 'false';
      expect(isAmbienteReal()).toBe(false);
    });

    it("AMBIENTE_REAL='true' (string literal exata) → true", () => {
      process.env.AMBIENTE_REAL = 'true';
      expect(isAmbienteReal()).toBe(true);
    });

    it("AMBIENTE_REAL='TRUE' (case mismatch) → false (somente 'true' literal aceita)", () => {
      process.env.AMBIENTE_REAL = 'TRUE';
      expect(isAmbienteReal()).toBe(false);
    });

    it("AMBIENTE_REAL='1' (truthy comum não-string) → false (anti pegadinha)", () => {
      process.env.AMBIENTE_REAL = '1';
      expect(isAmbienteReal()).toBe(false);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Camada 3 — ehEmailFake
  // ─────────────────────────────────────────────────────────────────────────

  describe('ehEmailFake() — pattern detection email', () => {
    it.each([
      [null, true, 'null = fail-safe'],
      [undefined, true, 'undefined = fail-safe'],
      ['', true, 'string vazia = fail-safe'],
    ])('%p → %p (%s)', (input, expected) => {
      expect(ehEmailFake(input as string | null | undefined)).toBe(expected);
    });

    it.each([
      ['derli-m80uuy-removido@removido.invalid', 'triplo match: .invalid$ + @removido. + -removido@'],
      ['xyz@removido.com', '@removido.'],
      ['joao-removido@gmail.com', '-removido@'],
      ['user@test.com', '@test.'],
      ['user@example.com', '@example.'],
      ['test@gmail.com', '^test@'],
      ['fake@gmail.com', '^fake@'],
      ['noreply@cooperebr.com', '^noreply@'],
      ['no-reply@example.org', '^no-reply@'],
    ])('detecta fake: %s (%s)', (email) => {
      expect(ehEmailFake(email)).toBe(true);
    });

    it.each([
      ['lucbragatto@gmail.com', 'admin Luciano (whitelist)'],
      ['lucbragatto+homologado@gmail.com', 'alias +suffix Sub-Fase 1'],
      ['lucbragatto+carolina@gmail.com', 'alias +suffix sub-canário'],
      ['admin@cooperebr.com.br', 'email institucional real'],
      ['joao.silva@empresa.com.br', 'cooperado PJ típico'],
    ])('aceita real: %s (%s)', (email) => {
      expect(ehEmailFake(email)).toBe(false);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Camada 3 — ehTelefoneFake
  // ─────────────────────────────────────────────────────────────────────────

  describe('ehTelefoneFake() — pattern detection telefone', () => {
    it.each([
      [null, 'null = fail-safe'],
      [undefined, 'undefined = fail-safe'],
      ['', 'vazio = fail-safe'],
    ])('%p → true (%s)', (input) => {
      expect(ehTelefoneFake(input as string | null | undefined)).toBe(true);
    });

    it('telefone com prefixo INATIVO- → true', () => {
      expect(ehTelefoneFake('INATIVO-1234567890')).toBe(true);
    });

    it.each([
      ['+551112345', 'menos de 10 dígitos puros'],
      ['12345', 'só 5 dígitos'],
      ['1234567890', 'exatamente 10 dígitos mas começa com 1 (não cobre prefixos fake, passaria)'],
    ])('comprimento: %s (%s)', (input, descricao) => {
      // Os dois primeiros bloqueiam por length<10.
      // O terceiro (10 dígitos) passa por length, mas não tem padrão fake.
      if (descricao.includes('passaria')) {
        expect(ehTelefoneFake(input)).toBe(false);
      } else {
        expect(ehTelefoneFake(input)).toBe(true);
      }
    });

    it.each([
      ['+5511000000000', '6+ zeros consecutivos'],
      ['+5500000000000', '6+ zeros (DERLI real)'],
    ])('padrão zeros: %s (%s)', (input) => {
      expect(ehTelefoneFake(input)).toBe(true);
    });

    it.each([
      ['+5511999999999', '6+ noves consecutivos'],
      ['+5511999990000', '4+ noves + 4+ zeros até o fim (fase4 banco)'],
    ])('padrão noves: %s (%s)', (input) => {
      expect(ehTelefoneFake(input)).toBe(true);
    });

    it.each([
      ['+5511999881234', 'prefixo 551199988'],
      ['+5511999001234', 'prefixo 551199900'],
      ['+5511726201234', 'prefixo 551172620'],
      ['+5511754101234', 'prefixo 551175410'],
      ['+5511781101234', 'prefixo 551178110'],
    ])('prefixo fake conhecido: %s (%s)', (input) => {
      expect(ehTelefoneFake(input)).toBe(true);
    });

    it.each([
      ['+5527981341348', 'celular Luciano com DDI/+'],
      ['27981341348', 'celular Luciano sem DDI'],
      ['+5511987654321', 'celular real comum BR'],
      ['(27) 98134-1348', 'celular Luciano formato display'],
    ])('aceita real: %s (%s)', (input) => {
      expect(ehTelefoneFake(input)).toBe(false);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // podeEnviarEmDev — modo dev (AMBIENTE_REAL=false)
  // ─────────────────────────────────────────────────────────────────────────

  describe('podeEnviarEmDev() — modo DEV (AMBIENTE_REAL≠true)', () => {
    beforeEach(() => {
      delete process.env.AMBIENTE_REAL;
    });

    it('WA telefone na whitelist → true', () => {
      expect(podeEnviarEmDev('27981341348', 'WA')).toBe(true);
    });

    it('WA telefone Luciano com formato display → true (normalização)', () => {
      expect(podeEnviarEmDev('(27) 98134-1348', 'WA')).toBe(true);
    });

    it('WA telefone fake fora whitelist → false', () => {
      expect(podeEnviarEmDev('+5511999990000', 'WA')).toBe(false);
    });

    it('WA telefone real mas fora whitelist → false (DEV bloqueia desconhecidos)', () => {
      expect(podeEnviarEmDev('+5511987654321', 'WA')).toBe(false);
    });

    it('EMAIL Luciano (whitelist) → true', () => {
      expect(podeEnviarEmDev('lucbragatto@gmail.com', 'EMAIL')).toBe(true);
    });

    it('EMAIL alias +suffix whitelist → true (Gmail roteia pra mesma caixa)', () => {
      expect(podeEnviarEmDev('lucbragatto+homologado@gmail.com', 'EMAIL')).toBe(true);
    });

    it('EMAIL fora whitelist → false (DEV bloqueia desconhecidos, mesmo se válido)', () => {
      expect(podeEnviarEmDev('lucbragatto+fase4banco@gmail.com', 'EMAIL')).toBe(false);
    });

    it('destino vazio → false', () => {
      expect(podeEnviarEmDev('', 'WA')).toBe(false);
      expect(podeEnviarEmDev('', 'EMAIL')).toBe(false);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // podeEnviarEmDev — modo prod (AMBIENTE_REAL=true)
  // ─────────────────────────────────────────────────────────────────────────

  describe('podeEnviarEmDev() — modo PROD (AMBIENTE_REAL=true) com salvaguarda fake', () => {
    beforeEach(() => {
      process.env.AMBIENTE_REAL = 'true';
    });

    it('WA telefone real fora whitelist → true (em prod libera tudo que NÃO é fake)', () => {
      expect(podeEnviarEmDev('+5511987654321', 'WA')).toBe(true);
    });

    it('WA telefone com padrão fake → false (salvaguarda final pré-dispatch)', () => {
      expect(podeEnviarEmDev('+5511999990000', 'WA')).toBe(false);
    });

    it('WA telefone com prefixo fake conhecido → false (Camada 3 protege em prod)', () => {
      expect(podeEnviarEmDev('+5511999881234', 'WA')).toBe(false);
    });

    it('EMAIL real fora whitelist → true (em prod libera)', () => {
      expect(podeEnviarEmDev('cliente@empresa.com.br', 'EMAIL')).toBe(true);
    });

    it('EMAIL com padrão fake (.invalid) → false (Camada 3 protege em prod)', () => {
      expect(podeEnviarEmDev('xyz-removido@removido.invalid', 'EMAIL')).toBe(false);
    });

    it('EMAIL test@... → false (Camada 3 protege em prod)', () => {
      expect(podeEnviarEmDev('test@example.com', 'EMAIL')).toBe(false);
    });
  });
});
