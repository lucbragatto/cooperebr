import { BadRequestException, ForbiddenException } from '@nestjs/common';
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

  // ─── CREDITOS_COMPENSADOS — Fase B (Decisão B33) ─────────────────────
  // tarifaContratual é PÓS-DESCONTO; engine não aplica desconto novamente.
  // valorBruto/valorDesconto vêm do valorCheioKwh da fatura (ou tarifa apurada OCR como fallback).
  describe('CREDITOS_COMPENSADOS (Fase B — sem duplo desconto)', () => {
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

    it('contrato sem tarifaContratual snapshotada → BadRequest (não há mais fallback OCR)', async () => {
      // Fase B: removido fallback "tarifa apurada do OCR". Contratos sem snapshot
      // precisam de backfill antes de gerar cobrança COMPENSADOS.
      const contrato = comp({ tarifaContratual: null });
      const fatura = faturaBase({
        dadosExtraidos: { creditosRecebidosKwh: 100, consumoAtualKwh: 120, totalAPagar: 114 },
      });
      await expect(calc(contrato, fatura)).rejects.toThrow(BadRequestException);
    });

    it('tarifaContratual snapshot é aplicada SEM desconto extra (pós-desconto)', async () => {
      // Cenário: snapshot já foi calculado no aceite (KWH_CHEIO + 20%).
      // tarifaContratual = 0.80; 100 kWh compensado → cobrança 80,00 (sem aplicar 20% novamente).
      const contrato = comp({ tarifaContratual: 0.80, percentualDesconto: 20 });
      const fatura = faturaBase({
        valorCheioKwh: 1.00,
        dadosExtraidos: { creditosRecebidosKwh: 100, consumoAtualKwh: 120, totalAPagar: 120 },
      });
      const result = await calc(contrato, fatura);
      // valorLiquido = kwhCompensado × tarifaContratual = 100 × 0.80 = 80.00
      expect(result.valorLiquido).toBe(80.0);
      // valorBruto = kwhCompensado × valorCheioKwhDaFatura = 100 × 1.00 = 100.00
      expect(result.valorBruto).toBe(100.0);
      // valorDesconto = bruto - liquido = 20.00 (calculado pra dashboard de economia)
      expect(result.valorDesconto).toBe(20.0);
      expect(result.tarifaContratualAplicada).toBe(0.80);
      expect(result.modeloCobrancaUsado).toBe('CREDITOS_COMPENSADOS');
    });

    it('valorBruto cai em fallback OCR (totalAPagar/consumo) quando fatura não tem valorCheioKwh', async () => {
      // valorCheioKwh ausente → fallback usa tarifaApuradaOCR = 114/120 = 0.95.
      const contrato = comp({ tarifaContratual: 0.80, percentualDesconto: 20 });
      const fatura = faturaBase({
        dadosExtraidos: { creditosRecebidosKwh: 100, consumoAtualKwh: 120, totalAPagar: 114 },
      });
      const result = await calc(contrato, fatura);
      expect(result.valorLiquido).toBe(80.0); // tarifaContratual × kwhCompensado (sem mudar)
      expect(result.valorBruto).toBe(95.0); // 100 × 0.95 (fallback)
      expect(result.valorDesconto).toBe(15.0);
      expect(result.tarifaContratualAplicada).toBe(0.80);
    });
  });

  // ─── CREDITOS_DINAMICO — Fase B (Decisão B33) ─────────────────────
  // Recalcula tarifa todo mês usando valorCheioKwh + tarifaSemImpostos da fatura aprovada.
  describe('CREDITOS_DINAMICO (Fase B — implementado)', () => {
    const din = (overrides: any = {}) => contratoBase({
      plano: { modeloCobranca: 'CREDITOS_DINAMICO' },
      baseCalculoAplicado: 'KWH_CHEIO',
      ...overrides,
    });

    it('fatura sem valorCheioKwh/tarifaSemImpostos → BadRequest', async () => {
      const contrato = din({ percentualDesconto: 15 });
      const fatura = faturaBase({
        dadosExtraidos: { creditosRecebidosKwh: 500, consumoAtualKwh: 600, totalAPagar: 600 },
      });
      await expect(calc(contrato, fatura)).rejects.toThrow(BadRequestException);
    });

    it('KWH_CHEIO + 15% recalcula tarifa do mês: 1.02 × 0.85 = 0.867 × 500 = 433.50', async () => {
      const contrato = din({ percentualDesconto: 15, baseCalculoAplicado: 'KWH_CHEIO' });
      const fatura = faturaBase({
        valorCheioKwh: 1.02,
        tarifaSemImpostos: 0.78,
        dadosExtraidos: { creditosRecebidosKwh: 500, consumoAtualKwh: 600, totalAPagar: 612 },
      });
      const result = await calc(contrato, fatura);
      expect(result.valorLiquido).toBe(433.5);
      expect(result.valorBruto).toBe(510.0); // 500 × 1.02
      expect(result.valorDesconto).toBe(76.5);
      expect(result.tarifaContratualAplicada).toBe(0.867);
      expect(result.modeloCobrancaUsado).toBe('CREDITOS_DINAMICO');
    });

    it('SEM_TRIBUTO + 15%: 1.02 - 0.78×0.15 = 0.903 × 500 = 451.50', async () => {
      const contrato = din({ percentualDesconto: 15, baseCalculoAplicado: 'SEM_TRIBUTO' });
      const fatura = faturaBase({
        valorCheioKwh: 1.02,
        tarifaSemImpostos: 0.78,
        dadosExtraidos: { creditosRecebidosKwh: 500, consumoAtualKwh: 600, totalAPagar: 612 },
      });
      const result = await calc(contrato, fatura);
      expect(result.valorLiquido).toBe(451.5);
      expect(result.tarifaContratualAplicada).toBe(0.903);
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

    it('T8 (Fase B): COMPENSADOS usa tarifaContratualPromocional durante promoção, sem duplo desconto', async () => {
      // Fase B: tarifaContratual e tarifaContratualPromocional são PÓS-DESCONTO.
      // Engine não aplica desconto novamente. percentualDesconto pode ser qualquer
      // valor — não influencia o cálculo (era armadilha do bug antigo).
      const contrato = contratoBase({
        plano: { modeloCobranca: 'CREDITOS_COMPENSADOS' },
        numero: 'C-T8-COMP',
        tarifaContratual: 0.90,
        tarifaContratualPromocional: 0.60, // pós-desconto promocional, menor que normal
        dataInicio: new Date('2026-04-01'),
        mesesPromocaoAplicados: 3,
        percentualDesconto: 20, // não isola — não tem mais duplo desconto
      });
      const fatura = faturaBase({
        valorCheioKwh: 0.90,
        dadosExtraidos: {
          mesReferencia: '2026-05', // dentro da promoção (mês 1 de 3)
          creditosRecebidosKwh: 1000,
          consumoAtualKwh: 1000,
          totalAPagar: 900,
        },
      });

      const r = await calc(contrato, fatura);

      // valorLiquido = 1000 × 0.60 = 600.00 (tarifa promocional pós-desconto direta)
      expect(r.valorLiquido).toBe(600);
      // valorBruto = 1000 × valorCheioKwhDaFatura = 1000 × 0.90 = 900.00
      expect(r.valorBruto).toBe(900);
      expect(r.valorDesconto).toBe(300);
      expect(r.tarifaContratualAplicada).toBe(0.60);
    });
  });
});
