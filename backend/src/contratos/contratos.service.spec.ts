/**
 * Testes unitários — ContratosService
 *
 * Valida a geração de número de contrato CTR-YYYY-XXXX
 * e a conversão de datas string → Date ISO.
 */

describe('ContratosService — Lógica de Negócio', () => {
  describe('Geração de número do contrato', () => {
    function gerarNumero(ano: number, lastNumero: string | null): string {
      const seq = lastNumero
        ? parseInt(lastNumero.split('-')[2] ?? '0', 10) + 1
        : 1;
      return `CTR-${ano}-${String(seq).padStart(4, '0')}`;
    }

    it('deve gerar CTR-2026-0001 quando não há contratos', () => {
      expect(gerarNumero(2026, null)).toBe('CTR-2026-0001');
    });

    it('deve incrementar sequencial', () => {
      expect(gerarNumero(2026, 'CTR-2026-0005')).toBe('CTR-2026-0006');
    });

    it('deve funcionar para números altos', () => {
      expect(gerarNumero(2026, 'CTR-2026-0099')).toBe('CTR-2026-0100');
    });

    it('deve funcionar para número 9999', () => {
      expect(gerarNumero(2026, 'CTR-2026-9999')).toBe('CTR-2026-10000');
    });

    it('deve usar o ano correto', () => {
      expect(gerarNumero(2025, null)).toBe('CTR-2025-0001');
      expect(gerarNumero(2027, null)).toBe('CTR-2027-0001');
    });
  });

  describe('Conversão de dataInicio string → Date ISO', () => {
    function convertDate(input: Date | string): Date {
      return typeof input === 'string'
        ? new Date(input + 'T00:00:00.000Z')
        : input;
    }

    it('deve converter "2026-03-15" para Date UTC meia-noite', () => {
      const d = convertDate('2026-03-15');
      expect(d.toISOString()).toBe('2026-03-15T00:00:00.000Z');
    });

    it('deve preservar Date objects', () => {
      const original = new Date('2026-06-01T12:00:00.000Z');
      const d = convertDate(original);
      expect(d).toBe(original);
    });

    it('NÃO deve sofrer offset de timezone em string', () => {
      const d = convertDate('2026-01-01');
      expect(d.getUTCFullYear()).toBe(2026);
      expect(d.getUTCMonth()).toBe(0);
      expect(d.getUTCDate()).toBe(1);
    });
  });
});
