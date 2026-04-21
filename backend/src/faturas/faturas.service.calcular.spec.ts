import { BadRequestException, ForbiddenException, NotImplementedException } from '@nestjs/common';
import { FaturasService } from './faturas.service';

describe('FaturasService — núcleo de cálculo', () => {
  let service: FaturasService;

  beforeEach(() => {
    service = Object.create(FaturasService.prototype);
    (service as any).logger = { warn: jest.fn(), error: jest.fn() };
    // Mock resolverModeloCobranca — extrai modelo do contrato sem I/O
    (service as any).resolverModeloCobranca = jest.fn()
      .mockImplementation(async (contrato: any) =>
        contrato.modeloCobrancaOverride ?? contrato.plano?.modeloCobranca ?? 'FIXO_MENSAL',
      );
  });

  // ─── Factories ────────────────────────────────────────────────────
  const contratoBase = (overrides: any = {}) => ({
    numero: 'TEST-001',
    cooperativaId: 'coop-1',
    cooperado: { cooperativaId: 'coop-1' },
    usina: { cooperativaId: 'coop-1', politicaBandeira: null },
    cooperativa: { politicaBandeira: 'DECIDIR_MENSAL' },
    percentualDesconto: 20,
    descontoOverride: null,
    valorContrato: null,
    tarifaContratual: null,
    plano: { modeloCobranca: 'FIXO_MENSAL' },
    modeloCobrancaOverride: null,
    ...overrides,
  });

  const faturaBase = (overrides: any = {}) => ({
    id: 'fat-1',
    cooperativaId: 'coop-1',
    dadosExtraidos: {
      creditosRecebidosKwh: 100,
      consumoAtualKwh: 120,
      totalAPagar: 114.00,
    },
    ...overrides,
  });

  const competencia = new Date('2026-04-01');

  const calc = (contrato: any, fatura?: any) =>
    (service as any).calcularValorCobrancaPorModelo({
      contrato,
      fatura: fatura ?? faturaBase(),
      cooperativaId: 'coop-1',
    });

  // ─── BLINDAGEM MULTI-TENANT ────────────────────────────────────────
  describe('blindagem multi-tenant', () => {
    it('contrato sem cooperativaId → BadRequest', async () => {
      const contrato = contratoBase({ cooperativaId: null });
      await expect(calc(contrato)).rejects.toThrow(BadRequestException);
    });

    it('cooperado com cooperativaId diferente → Forbidden', async () => {
      const contrato = contratoBase({ cooperado: { cooperativaId: 'coop-2' } });
      await expect(calc(contrato)).rejects.toThrow(ForbiddenException);
    });

    it('usina com cooperativaId diferente → Forbidden', async () => {
      const contrato = contratoBase({
        usina: { cooperativaId: 'coop-2', politicaBandeira: null },
      });
      await expect(calc(contrato)).rejects.toThrow(ForbiddenException);
    });

    it('fatura com cooperativaId diferente → Forbidden', async () => {
      const contrato = contratoBase({ valorContrato: 500 });
      const fatura = faturaBase({ cooperativaId: 'coop-2' });
      await expect(calc(contrato, fatura)).rejects.toThrow(ForbiddenException);
    });

    it('todos coerentes → prossegue', async () => {
      const contrato = contratoBase({ valorContrato: 500 });
      await expect(calc(contrato)).resolves.toBeDefined();
    });
  });

  // ─── FIXO_MENSAL ──────────────────────────────────────────────────
  describe('FIXO_MENSAL', () => {
    it('valorContrato NULL → BadRequest', async () => {
      await expect(calc(contratoBase())).rejects.toThrow(BadRequestException);
    });

    it('valorContrato = 0 → BadRequest', async () => {
      await expect(calc(contratoBase({ valorContrato: 0 }))).rejects.toThrow(BadRequestException);
    });

    it('valorContrato negativo → BadRequest', async () => {
      await expect(calc(contratoBase({ valorContrato: -100 }))).rejects.toThrow(BadRequestException);
    });

    it('valorContrato válido → bruto=liquido=valor, desconto=0', async () => {
      const result = await calc(contratoBase({ valorContrato: 450.5 }));
      expect(result.valorBruto).toBe(450.5);
      expect(result.valorLiquido).toBe(450.5);
      expect(result.valorDesconto).toBe(0);
      expect(result.modeloCobrancaUsado).toBe('FIXO_MENSAL');
      expect(result.bandeiraAplicada).toBe(false);
      expect(result.tarifaApurada).toBeNull();
      expect(result.tarifaContratualAplicada).toBeNull();
    });
  });

  // ─── CREDITOS_COMPENSADOS ─────────────────────────────────────────
  describe('CREDITOS_COMPENSADOS', () => {
    const comp = (overrides: any = {}) => contratoBase({
      plano: { modeloCobranca: 'CREDITOS_COMPENSADOS' },
      ...overrides,
    });

    it('kwhCompensado do OCR ausente → BadRequest', async () => {
      const contrato = comp({ tarifaContratual: 0.90 });
      const fatura = faturaBase({
        dadosExtraidos: { creditosRecebidosKwh: 0, consumoAtualKwh: 0, totalAPagar: 0 },
      });
      await expect(calc(contrato, fatura)).rejects.toThrow(BadRequestException);
    });

    it('sem tarifaContratual e sem dados OCR pra calcular tarifa → BadRequest', async () => {
      const contrato = comp({ tarifaContratual: null });
      const fatura = faturaBase({
        dadosExtraidos: { creditosRecebidosKwh: 100, consumoAtualKwh: 0, totalAPagar: 0 },
      });
      await expect(calc(contrato, fatura)).rejects.toThrow(BadRequestException);
    });

    it('tarifaContratual prevalece sobre tarifa apurada do OCR', async () => {
      const contrato = comp({ tarifaContratual: 0.80, percentualDesconto: 20 });
      const fatura = faturaBase({
        dadosExtraidos: { creditosRecebidosKwh: 100, consumoAtualKwh: 120, totalAPagar: 114 },
      });
      const result = await calc(contrato, fatura);
      // 100 × 0.80 = 80.00 bruto; 80 × 0.20 = 16.00 desconto; 80 - 16 = 64.00 líquido
      expect(result.valorBruto).toBe(80.0);
      expect(result.valorDesconto).toBe(16.0);
      expect(result.valorLiquido).toBe(64.0);
      expect(result.tarifaContratualAplicada).toBe(0.80);
      expect(result.modeloCobrancaUsado).toBe('CREDITOS_COMPENSADOS');
    });

    it('sem tarifaContratual → usa tarifa apurada do OCR (valorTotal/consumo)', async () => {
      const contrato = comp({ tarifaContratual: null, percentualDesconto: 20 });
      const fatura = faturaBase({
        dadosExtraidos: { creditosRecebidosKwh: 100, consumoAtualKwh: 120, totalAPagar: 114 },
      });
      const result = await calc(contrato, fatura);
      // tarifa apurada = 114/120 = 0.95
      // 100 × 0.95 = 95.00 bruto; 95 × 0.20 = 19.00 desconto; 95 - 19 = 76.00 líquido
      expect(result.valorBruto).toBe(95.0);
      expect(result.valorDesconto).toBe(19.0);
      expect(result.valorLiquido).toBe(76.0);
      expect(result.tarifaContratualAplicada).toBeNull();
    });

    it('descontoOverride prevalece sobre percentualDesconto', async () => {
      const contrato = comp({
        tarifaContratual: 1.0,
        percentualDesconto: 20,
        descontoOverride: 30,
      });
      const fatura = faturaBase({
        dadosExtraidos: { creditosRecebidosKwh: 100, consumoAtualKwh: 0, totalAPagar: 0 },
      });
      const result = await calc(contrato, fatura);
      // 100 × 1.0 = 100 bruto; 100 × 0.30 = 30 desconto; 100 - 30 = 70 líquido
      expect(result.valorBruto).toBe(100.0);
      expect(result.valorDesconto).toBe(30.0);
      expect(result.valorLiquido).toBe(70.0);
    });
  });

  // ─── CREDITOS_DINAMICO ────────────────────────────────────────────
  describe('CREDITOS_DINAMICO', () => {
    it('sempre → NotImplementedException', async () => {
      const contrato = contratoBase({
        plano: { modeloCobranca: 'CREDITOS_DINAMICO' },
        valorContrato: 500,
      });
      await expect(calc(contrato)).rejects.toThrow(NotImplementedException);
    });
  });

  // ─── HELPER resolverPoliticaBandeira ──────────────────────────────
  describe('resolverPoliticaBandeira', () => {
    const resolverBandeira = (contrato: any) =>
      (service as any).resolverPoliticaBandeira(contrato);

    it('usina APLICAR → true', () => {
      expect(resolverBandeira(contratoBase({
        usina: { cooperativaId: 'coop-1', politicaBandeira: 'APLICAR' },
      }))).toBe(true);
    });

    it('usina NAO_APLICAR → false mesmo se cooperativa APLICAR', () => {
      expect(resolverBandeira(contratoBase({
        usina: { cooperativaId: 'coop-1', politicaBandeira: 'NAO_APLICAR' },
        cooperativa: { politicaBandeira: 'APLICAR' },
      }))).toBe(false);
    });

    it('usina null → herda da cooperativa APLICAR', () => {
      expect(resolverBandeira(contratoBase({
        usina: { cooperativaId: 'coop-1', politicaBandeira: null },
        cooperativa: { politicaBandeira: 'APLICAR' },
      }))).toBe(true);
    });

    it('nada definido → DECIDIR_MENSAL → false', () => {
      expect(resolverBandeira(contratoBase({
        usina: { cooperativaId: 'coop-1', politicaBandeira: null },
        cooperativa: { politicaBandeira: null },
      }))).toBe(false);
    });
  });

  // ─── HELPER resolverDescontoContrato ──────────────────────────────
  describe('resolverDescontoContrato', () => {
    const resolverDesconto = (contrato: any) =>
      (service as any).resolverDescontoContrato(contrato);

    it('usa percentualDesconto quando descontoOverride é null', () => {
      expect(resolverDesconto({ percentualDesconto: 20, descontoOverride: null })).toBe(0.20);
    });

    it('descontoOverride prevalece', () => {
      expect(resolverDesconto({ percentualDesconto: 20, descontoOverride: 30 })).toBe(0.30);
    });

    it('ambos null → 0', () => {
      expect(resolverDesconto({ percentualDesconto: null, descontoOverride: null })).toBe(0);
    });
  });

  // ─── T4: PROMOÇÃO TEMPORAL ──────────────────────────────────────────
  describe('T4: promoção temporal', () => {
    it('usa valorContratoPromocional durante período promocional', async () => {
      // Contrato assinado em abril/2026 com 3 meses de promoção.
      // Fatura competência abril → deve ser promocional (mês 0 de 3).
      const contrato = contratoBase({
        numero: 'C-T4-01',
        valorContrato: 1000,
        valorContratoPromocional: 700,
        dataInicio: new Date('2026-04-10'),
        mesesPromocaoAplicados: 3,
      });
      const fatura = faturaBase({
        dadosExtraidos: { mesReferencia: '2026-04', consumoAtualKwh: 500 },
      });

      const r = await calc(contrato, fatura);

      expect(r.valorLiquido).toBe(700);
      expect(r.modeloCobrancaUsado).toBe('FIXO_MENSAL');
    });

    it('usa valorContrato normal após fim do período promocional', async () => {
      // Contrato assinado em abril/2026 com 3 meses. Fatura competência julho
      // (mês 3, fora da promoção: regra é mesesDecorridos < mesesPromocaoAplicados).
      const contrato = contratoBase({
        numero: 'C-T4-02',
        valorContrato: 1000,
        valorContratoPromocional: 700,
        dataInicio: new Date('2026-04-10'),
        mesesPromocaoAplicados: 3,
      });
      const fatura = faturaBase({
        dadosExtraidos: { mesReferencia: '2026-07', consumoAtualKwh: 500 },
      });

      const r = await calc(contrato, fatura);

      expect(r.valorLiquido).toBe(1000);
    });

    it('T8: COMPENSADOS usa tarifaContratualPromocional durante promoção', async () => {
      const contrato = contratoBase({
        plano: { modeloCobranca: 'CREDITOS_COMPENSADOS' },
        numero: 'C-T8-COMP',
        tarifaContratual: 0.90,
        tarifaContratualPromocional: 0.60, // promocional menor
        dataInicio: new Date('2026-04-01'),
        mesesPromocaoAplicados: 3,
        percentualDesconto: 0, // isola o efeito da tarifa
      });
      const fatura = faturaBase({
        dadosExtraidos: {
          mesReferencia: '2026-05', // dentro da promoção (mês 1 de 3)
          creditosRecebidosKwh: 1000,
          consumoAtualKwh: 1000,
          totalAPagar: 900,
        },
      });

      const r = await calc(contrato, fatura);

      // 1000 × 0.60 = 600 (usando tarifa promocional, não normal)
      expect(r.valorBruto).toBe(600);
      expect(r.tarifaContratualAplicada).toBe(0.60);
    });
  });
});
