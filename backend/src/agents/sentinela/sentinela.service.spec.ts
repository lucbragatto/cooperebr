/**
 * SentinelaService — Testes iniciais (Fase 2)
 *
 * Foco: garantir que a primeira Tool L0 (mapearUsinasSemEnquadramento) está registrada
 * e responde corretamente em cenários básicos.
 */
import { SentinelaService } from './sentinela.service';
import { ToolRegistryService } from '../common/tools/tool-registry.service';
import { PolicyEngineService } from '../common/policy/policy-engine.service';

describe('SentinelaService — Primeiras Tools (L0)', () => {
  let service: SentinelaService;
  let registry: ToolRegistryService;
  let policy: PolicyEngineService;
  let prismaMock: any;

  beforeEach(() => {
    prismaMock = {
      usina: {
        findMany: jest.fn(),
      },
    };

    policy = new PolicyEngineService();
    registry = new ToolRegistryService(policy);
    service = new SentinelaService(prismaMock as any, registry);

    // Força registro das Tools (onModuleInit não roda em teste unitário puro)
    (service as any).registerTools();
  });

  it('deve registrar a Tool sentinela.mapearUsinasSemEnquadramento', () => {
    // Força o registro (normalmente feito em onModuleInit)
    (service as any).registerTools();

    const tools = registry.listAll();
    const tool = tools.find((t) => t.id === 'sentinela.mapearUsinasSemEnquadramento');

    expect(tool).toBeDefined();
    expect(tool?.declaredRiskLevel).toBe('L0');
    expect(tool?.name).toContain('Usinas sem Enquadramento');
  });

  it('deve retornar lista de usinas sem enquadramento corretamente', async () => {
    prismaMock.usina.findMany.mockResolvedValueOnce([
      {
        id: 'u1',
        nome: 'Usina Sem Classificação',
        cooperativaId: 'coop-1',
        classeGdAnotada: null,
        statusHomologacao: 'HOMOLOGADA',
        statusOperacional: 'OPERANDO',
        dataHomologacao: new Date('2025-01-10'),
        cidade: 'Vila Velha',
        estado: 'ES',
      },
      {
        id: 'u2',
        nome: 'Usina Classificada',
        cooperativaId: 'coop-1',
        classeGdAnotada: 'GD_II',
        statusHomologacao: 'HOMOLOGADA',
        statusOperacional: 'OPERANDO',
        dataHomologacao: new Date('2024-06-01'),
        cidade: 'Linhares',
        estado: 'ES',
      },
    ]);

    const context = {
      cooperativaId: 'coop-1',
      usuarioId: 'user-1',
      usuarioPerfil: 'ADMIN',
    };

    const result = await service.executarMapearUsinasSemEnquadramento({}, context);

    expect(result.success).toBe(true);
    expect(result.data?.totalUsinas).toBe(2);
    expect(result.data?.usinasSemEnquadramento).toBe(1);
    expect(result.data?.percentualSemEnquadramento).toBe(50);
    expect(result.data?.usinas[0].id).toBe('u1');
    expect(result.data?.observacao).toContain('risco alto');
  });
});

describe('SentinelaService — Tool L1 (Risco de Movimentação)', () => {
  let service: SentinelaService;
  let registry: ToolRegistryService;
  let policy: PolicyEngineService;
  let prismaMock: any;

  beforeEach(() => {
    prismaMock = {
      usina: {
        findUnique: jest.fn(),
      },
      contrato: {
        findUnique: jest.fn(),
      },
    };

    policy = new PolicyEngineService();
    registry = new ToolRegistryService(policy);
    service = new SentinelaService(prismaMock as any, registry);
    (service as any).registerTools();
  });

  it('deve registrar a Tool L1 de análise de risco', () => {
    const tools = registry.listAll();
    const tool = tools.find((t) => t.id === 'sentinela.analisarRiscoMovimentacaoEntreEnquadramentos');
    expect(tool).toBeDefined();
    expect(tool?.declaredRiskLevel).toBe('L1');
  });

  it('deve retornar CRITICAL quando uma das usinas não tem classificação', async () => {
    prismaMock.usina.findUnique
      .mockResolvedValueOnce({ id: 'u-origem', nome: 'Usina A', classeGdAnotada: 'GD_II', dataHomologacao: new Date(), cidade: 'VV', estado: 'ES' })
      .mockResolvedValueOnce({ id: 'u-destino', nome: 'Usina B', classeGdAnotada: null, dataHomologacao: null, cidade: 'LH', estado: 'ES' });

    const context = { cooperativaId: 'c1', usuarioId: 'u1', usuarioPerfil: 'ADMIN' };

    const result = await service.executarAnalisarRiscoMovimentacao(
      { usinaOrigemId: 'u-origem', usinaDestinoId: 'u-destino' },
      context,
    );

    expect(result.success).toBe(true);
    expect(result.data?.risco).toBe('CRITICAL');
    expect(result.data?.podeRecomendar).toBe(false);
    expect(result.data?.gapsDeDados).toContain('Usina de destino sem classeGdAnotada');
  });

  it('deve retornar HIGH quando as classes GD são diferentes', async () => {
    prismaMock.usina.findUnique
      .mockResolvedValueOnce({ id: 'u1', nome: 'Origem', classeGdAnotada: 'GD_II', dataHomologacao: new Date(), cidade: 'A', estado: 'ES' })
      .mockResolvedValueOnce({ id: 'u2', nome: 'Destino', classeGdAnotada: 'GD_III', dataHomologacao: new Date(), cidade: 'B', estado: 'ES' });

    const context = { cooperativaId: 'c1', usuarioId: 'u1', usuarioPerfil: 'ADMIN' };

    const result = await service.executarAnalisarRiscoMovimentacao(
      { usinaOrigemId: 'u1', usinaDestinoId: 'u2' },
      context,
    );

    expect(result.data?.risco).toBe('HIGH');
    expect(result.data?.explicacao).toContain('classes diferentes');
    expect(result.data?.podeRecomendar).toBe(false);
  });

  it('deve incluir dados do contrato quando contratoId é fornecido', async () => {
    prismaMock.usina.findUnique
      .mockResolvedValueOnce({ id: 'u-orig', nome: 'Usina Origem', classeGdAnotada: 'GD_II', dataHomologacao: new Date(), cidade: 'VV', estado: 'ES' })
      .mockResolvedValueOnce({ id: 'u-dest', nome: 'Usina Destino', classeGdAnotada: 'GD_II', dataHomologacao: new Date(), cidade: 'LH', estado: 'ES' });

    prismaMock.contrato.findUnique.mockResolvedValueOnce({
      id: 'c-123',
      usinaId: 'u-orig',
      percentualUsina: 18.5,
      kwhContratoAnual: 45000,
      classeGdAplicada: 'GD_II',
      cooperado: { nome: 'Cooperado Teste' },
    });

    const context = { cooperativaId: 'c1', usuarioId: 'u1', usuarioPerfil: 'ADMIN' };

    const result = await service.executarAnalisarRiscoMovimentacao(
      { contratoId: 'c-123', usinaOrigemId: 'u-orig', usinaDestinoId: 'u-dest' },
      context,
    );

    expect(result.data?.contratoAtual).toBeDefined();
    expect(result.data?.contratoAtual?.percentualUsina).toBe(18.5);
    expect(result.data?.contratoAtual?.cooperadoNome).toBe('Cooperado Teste');
    expect(result.data?.gapsDeDados).not.toContain('Contrato sem classeGdAplicada preenchida');
  });
});
