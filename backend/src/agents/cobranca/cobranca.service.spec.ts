/**
 * CobrancaService — Testes TDD Prioridade E (Fase 1 Tool L0)
 *
 * Testes escritos PRIMEIRO (RED). Devem falhar até a implementação mínima
 * da primeira Tool L0 de auditoria de inconsistências de cobrança/faturamento.
 *
 * Foco inicial:
 * - Registro da Tool L0 no ToolRegistry
 * - Detecção de pagamento parcial não quitado (cenário de alto impacto financeiro)
 * - Validação de tenant + PolicyEngine (L0 permite real)
 *
 * Cobertura alvo: 80%+ (unit + cenários de borda)
 */

import { CobrancaService } from './cobranca.service';
import { ToolRegistryService } from '../common/tools/tool-registry.service';
import { PolicyEngineService } from '../common/policy/policy-engine.service';

describe('CobrancaService — Auditoria de Inconsistências (L0) — TDD', () => {
  let service: CobrancaService;
  let registry: ToolRegistryService;
  let policy: PolicyEngineService;
  let prismaMock: any;

  beforeEach(() => {
    prismaMock = {
      cobranca: {
        findMany: jest.fn(),
      },
      faturaProcessada: {
        findUnique: jest.fn(),
      },
      modeloCobrancaConfig: {
        findMany: jest.fn(),
      },
    };

    policy = new PolicyEngineService();
    registry = new ToolRegistryService(policy);
    service = new CobrancaService(prismaMock as any, registry);

    // Força registro das Tools (onModuleInit não executa em teste unitário isolado)
    (service as any).registerTools();
  });

  it('deve registrar a Tool cobranca.auditarInconsistenciasCobranca com nível L0', () => {
    const tools = registry.listAll();
    const tool = tools.find((t) => t.id === 'cobranca.auditarInconsistenciasCobranca');

    expect(tool).toBeDefined();
    expect(tool?.declaredRiskLevel).toBe('L0');
    expect(tool?.name).toContain('Inconsistências de Cobrança');
    expect(tool?.description).toContain('L0');
  });

  it('deve detectar pagamento parcial não quitado e retornar inconsistência com impacto financeiro', async () => {
    // Mock: uma cobrança PAGO com valorPago inferior ao líquido + multa
    prismaMock.cobranca.findMany.mockResolvedValueOnce([
      {
        id: 'cob-123',
        contratoId: 'ctr-1',
        mesReferencia: 5,
        anoReferencia: 2026,
        valorBruto: 1200,
        valorDesconto: 200,
        valorLiquido: 1000,
        status: 'PAGO',
        dataVencimento: new Date('2026-05-10'),
        dataPagamento: new Date('2026-05-12'),
        valorPago: 820,
        valorMulta: 50,
        valorJuros: 0,
        valorAtualizado: 1050,
        kwhCompensado: 850,
        fonteDados: 'FATURA_OCR',
        faturaProcessadaId: 'fat-456',
        modeloCobrancaUsado: 'FIXO_MENSAL',
        cooperativaId: 'coop-1',
      },
    ]);

    // Sem FaturaProcessada linkada (gap de dados comum)
    prismaMock.faturaProcessada.findUnique.mockResolvedValueOnce(null);

    // Config atual (para futura checagem de modelo divergente)
    prismaMock.modeloCobrancaConfig.findMany.mockResolvedValueOnce([]);

    const context = {
      cooperativaId: 'coop-1',
      usuarioId: 'user-admin-1',
      usuarioPerfil: 'ADMIN',
      executionMode: 'real' as const, // solicita modo real (L0 permite)
    };

    const result = await service.executarAuditarInconsistenciasCobranca(
      { mesReferencia: 5, anoReferencia: 2026 },
      context,
    );

    expect(result.success).toBe(true);
    expect(result.meta.level).toBe('L0');
    expect(result.meta.dryRun).toBe(false); // L0 + requested real → harness respeita

    const data = result.data;
    expect(data.totalCobrancasAnalisadas).toBe(1);
    expect(data.inconsistencias.length).toBeGreaterThanOrEqual(1);

    const parcial = data.inconsistencias.find(
      (i: any) => i.tipo === 'PAGAMENTO_PARCIAL_NAO_QUITADO',
    );
    expect(parcial).toBeDefined();
    expect(parcial.severidade).toBe('ALTA');
    expect(parcial.valorImpactoEstimado).toBeGreaterThan(100);
    expect(parcial.descricao).toContain('PAGO');
    expect(parcial.recomendacao).toContain('Verificar'); // casing real da mensagem gerada pela Tool
  });

  it('deve retornar lista vazia de inconsistências quando todos os dados estão consistentes', async () => {
    prismaMock.cobranca.findMany.mockResolvedValueOnce([
      {
        id: 'cob-999',
        contratoId: 'ctr-2',
        mesReferencia: 4,
        anoReferencia: 2026,
        valorBruto: 950,
        valorDesconto: 150,
        valorLiquido: 800,
        status: 'PAGO',
        valorPago: 800,
        valorMulta: 0,
        valorJuros: 0,
        kwhCompensado: 720,
        modeloCobrancaUsado: 'FIXO_MENSAL',
        cooperativaId: 'coop-1',
      },
    ]);

    prismaMock.faturaProcessada.findUnique.mockResolvedValueOnce(null);
    prismaMock.modeloCobrancaConfig.findMany.mockResolvedValueOnce([]);

    const context = {
      cooperativaId: 'coop-1',
      usuarioId: 'user-1',
      usuarioPerfil: 'ADMIN',
    };

    const result = await service.executarAuditarInconsistenciasCobranca({}, context);

    expect(result.success).toBe(true);
    expect(result.data.inconsistencias.length).toBe(0);
    expect(result.data.resumo.totalInconsistencias).toBe(0);
  });

  it('deve detectar DIVERGENCIA_VALOR_FATURA quando há diferença relevante entre Cobrança e FaturaProcessada', async () => {
    prismaMock.cobranca.findMany.mockResolvedValueOnce([
      {
        id: 'cob-456',
        contratoId: 'ctr-3',
        mesReferencia: 5,
        anoReferencia: 2026,
        valorBruto: 1100,
        valorDesconto: 180,
        valorLiquido: 920,
        status: 'PAGO',
        valorPago: 920,
        valorMulta: 0,
        valorJuros: 0,
        kwhCompensado: 800,
        fonteDados: 'FATURA_OCR',
        faturaProcessadaId: 'fat-789',
        modeloCobrancaUsado: 'FIXO_MENSAL',
        cooperativaId: 'coop-1',
      },
    ]);

    // FaturaProcessada com dados que indicam divergência (ex: kWh muito diferente ou status de revisão)
    prismaMock.faturaProcessada.findUnique.mockResolvedValueOnce({
      id: 'fat-789',
      mesReferencia: '2026-05',
      statusRevisao: 'PENDENTE_REVISAO',
      dadosExtraidos: { kwhCompensado: 650 }, // divergência clara
      valorCheioKwh: 1.12,
    });

    prismaMock.modeloCobrancaConfig.findMany.mockResolvedValueOnce([]);

    const context = {
      cooperativaId: 'coop-1',
      usuarioId: 'user-admin-1',
      usuarioPerfil: 'ADMIN',
    };

    const result = await service.executarAuditarInconsistenciasCobranca(
      { mesReferencia: 5, anoReferencia: 2026 },
      context,
    );

    expect(result.success).toBe(true);

    const divergencia = result.data.inconsistencias.find(
      (i: any) => i.tipo === 'DIVERGENCIA_VALOR_FATURA',
    );

    expect(divergencia).toBeDefined();
    expect(divergencia.severidade).toBe('MEDIA');
    expect(divergencia.descricao).toContain('FaturaProcessada');
  });

  it('não deve gerar DIVERGENCIA_VALOR_FATURA quando FaturaProcessada está aprovada', async () => {
    prismaMock.cobranca.findMany.mockResolvedValueOnce([
      {
        id: 'cob-777',
        contratoId: 'ctr-4',
        mesReferencia: 3,
        anoReferencia: 2026,
        valorLiquido: 750,
        status: 'PAGO',
        valorPago: 750,
        kwhCompensado: 600,
        faturaProcessadaId: 'fat-888',
        modeloCobrancaUsado: 'FIXO_MENSAL',
        cooperativaId: 'coop-1',
      },
    ]);

    prismaMock.faturaProcessada.findUnique.mockResolvedValueOnce({
      id: 'fat-888',
      statusRevisao: 'APROVADA',
      mesReferencia: '2026-03',
    });

    const context = { cooperativaId: 'coop-1', usuarioId: 'u1', usuarioPerfil: 'ADMIN' };

    const result = await service.executarAuditarInconsistenciasCobranca({}, context);

    const divergencias = result.data.inconsistencias.filter(
      (i: any) => i.tipo === 'DIVERGENCIA_VALOR_FATURA',
    );
    expect(divergencias.length).toBe(0);
  });

  it('deve analisar múltiplas cobranças e retornar resumo agregado correto', async () => {
    prismaMock.cobranca.findMany.mockResolvedValueOnce([
      {
        id: 'cob-p1',
        mesReferencia: 5,
        anoReferencia: 2026,
        valorLiquido: 1000,
        status: 'PAGO',
        valorPago: 700,
        modeloCobrancaUsado: 'FIXO_MENSAL',
        cooperativaId: 'coop-1',
      },
      {
        id: 'cob-p2',
        mesReferencia: 5,
        anoReferencia: 2026,
        valorLiquido: 800,
        status: 'PAGO',
        valorPago: 800,
        faturaProcessadaId: 'fat-pend',
        modeloCobrancaUsado: 'FIXO_MENSAL',
        cooperativaId: 'coop-1',
      },
    ]);

    prismaMock.faturaProcessada.findUnique.mockResolvedValueOnce({
      id: 'fat-pend',
      statusRevisao: 'PENDENTE_REVISAO',
    });

    const context = { cooperativaId: 'coop-1', usuarioId: 'u1', usuarioPerfil: 'ADMIN' };

    const result = await service.executarAuditarInconsistenciasCobranca({}, context);

    expect(result.data.totalCobrancasAnalisadas).toBe(2);
    expect(result.data.inconsistencias.length).toBe(2); // uma parcial + uma divergência de fatura
    expect(result.data.resumo.porTipo['PAGAMENTO_PARCIAL_NAO_QUITADO']).toBe(1);
    expect(result.data.resumo.porTipo['DIVERGENCIA_VALOR_FATURA']).toBe(1);
  });

  it('deve registrar a Tool L1 de simulação de modelos', () => {
    const tools = registry.listAll();
    const tool = tools.find((t) => t.id === 'cobranca.simularComparativoModelos');

    expect(tool).toBeDefined();
    expect(tool?.declaredRiskLevel).toBe('L1');
    expect(tool?.name).toContain('Comparativo dos 3 Modelos');
  });
});
