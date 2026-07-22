/**
 * RepassesDespesasService — Testes iniciais (Prioridade B)
 */
import { RepassesDespesasService } from './repasses-despesas.service';
import { ToolRegistryService } from '../common/tools/tool-registry.service';
import { PolicyEngineService } from '../common/policy/policy-engine.service';

describe('RepassesDespesasService — Primeiras Tools (Prioridade B)', () => {
  let service: RepassesDespesasService;
  let registry: ToolRegistryService;
  let policy: PolicyEngineService;
  let prismaMock: any;

  beforeEach(() => {
    prismaMock = {
      repasseProprietario: {
        findMany: jest.fn(),
      },
      contaAPagar: {
        findMany: jest.fn(),
      },
    };

    policy = new PolicyEngineService();
    registry = new ToolRegistryService(policy);
    service = new RepassesDespesasService(prismaMock as any, registry);
    (service as any).registerTools();
  });

  it('deve registrar a Tool repasses.listarPendentesComAlertas', () => {
    const tools = registry.listAll();
    const tool = tools.find((t) => t.id === 'repasses.listarPendentesComAlertas');

    expect(tool).toBeDefined();
    expect(tool?.declaredRiskLevel).toBe('L0');
    expect(tool?.name).toContain('Repasses Pendentes com Alertas');
  });

  it('deve listar repasses pendentes e identificar atrasados', async () => {
    const dataAntiga = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000);

    prismaMock.repasseProprietario.findMany.mockResolvedValueOnce([
      {
        id: 'rp-1',
        usinaId: 'u-1',
        usina: { nome: 'Usina Teste' },
        periodoInicio: new Date('2026-03-01'),
        periodoFim: dataAntiga,
        valorBruto: 5000,
        totalDespesasAbatidas: 1200,
        valorLiquido: 3800,
        status: 'PENDENTE',
        comprovante: null,
      },
    ]);

    const context = {
      cooperativaId: 'coop-1',
      usuarioId: 'user-1',
      usuarioPerfil: 'ADMIN',
    };

    const result = await service.executarListarRepassesPendentes({}, context);

    expect(result.success).toBe(true);
    expect(result.data?.totalPendentes).toBe(1);
    expect(result.data?.totalAtrasados).toBe(1);
    expect(result.data?.repasses[0].atrasado).toBe(true);
    expect(result.data?.repasses[0].alertas).toContain('ATRASADO há 45 dias');
    expect(result.data?.repasses[0].alertas).toContain('Sem comprovante de pagamento registrado');
  });

  it('deve registrar e executar a Tool de despesas pendentes de desconto em repasse', async () => {
    prismaMock.contaAPagar = { findMany: jest.fn() };

    prismaMock.contaAPagar.findMany.mockResolvedValueOnce([
      {
        id: 'd-1',
        descricao: 'Manutenção inversor',
        categoria: 'MANUTENCAO_CORRETIVA',
        valor: 3200,
        dataVencimento: new Date(),
        usinaId: 'u-1',
        usina: { nome: 'Usina Alpha' },
        status: 'APROVADA',
        tratamento: 'DESCONTO_NO_REPASSE',
      },
    ]);

    const context = { cooperativaId: 'coop-1', usuarioId: 'u1', usuarioPerfil: 'ADMIN' };

    const result = await service.executarListarDespesasDesconto({}, context);

    expect(result.success).toBe(true);
    expect(result.data?.totalPendentesAbatimento).toBe(1);
    expect(result.data?.despesas[0].tratamento).toBe('DESCONTO_NO_REPASSE');
  });

  it('deve registrar a nova Tool de resumo financeiro de repasses pendentes', async () => {
    const tools = registry.listAll();
    const tool = tools.find(t => t.id === 'repasses.resumoFinanceiroPendentes');
    expect(tool).toBeDefined();
    expect(tool?.declaredRiskLevel).toBe('L0');
  });

  it('deve executar a Tool L1 de simulação de efeito de despesa', async () => {
    prismaMock.repasseProprietario.findMany.mockResolvedValueOnce([
      {
        id: 'rp-1',
        periodoInicio: new Date('2026-04-01'),
        periodoFim: new Date('2026-04-30'),
        valorBruto: 10000,
        totalDespesasAbatidas: 2000,
        valorLiquido: 8000,
      },
    ]);

    const context = { cooperativaId: 'coop-1', usuarioId: 'u1', usuarioPerfil: 'ADMIN' };

    const result = await service.executarSimularDespesa(
      { usinaId: 'u-1', valor: 1500 },
      context,
    );

    expect(result.success).toBe(true);
    expect(result.data?.valorDespesa).toBe(1500);
    expect(result.data?.totalAbatidoNosRepasses).toBe(1500);
    expect(result.data?.repassesAfetados.length).toBe(1);
    expect(result.data?.podeAbater).toBe(true);
  });

  it('deve retornar podeAbater=false quando não há repasses pendentes', async () => {
    prismaMock.repasseProprietario.findMany.mockResolvedValueOnce([]);

    const context = { cooperativaId: 'coop-1', usuarioId: 'u1', usuarioPerfil: 'ADMIN' };

    const result = await service.executarSimularDespesa(
      { usinaId: 'u-1', valor: 3000 },
      context,
    );

    expect(result.success).toBe(true);
    expect(result.data?.podeAbater).toBe(false);
    expect(result.data?.repassesAfetados.length).toBe(0);
  });

  it('deve registrar a nova Tool de resumo de despesas por usina', async () => {
    const tools = registry.listAll();
    const tool = tools.find(t => t.id === 'despesas.resumoPorUsina');
    expect(tool).toBeDefined();
    expect(tool?.declaredRiskLevel).toBe('L0');
  });
});
