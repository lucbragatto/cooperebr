import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { ToolRegistryService } from '../common/tools/tool-registry.service';
import { defineTool, AgentContext, ToolResult } from '../common/tools/tool.interface';
import { z } from 'zod';

/**
 * RepassesDespesasService — Prioridade B do Módulo IAG
 *
 * Tools para análise, monitoramento e simulação de:
 * - Repasses a proprietários (RepasseProprietario)
 * - Despesas operacionais (ContaAPagar), especialmente o fluxo DESCONTO_NO_REPASSE
 *
 * Foco inicial: dar visibilidade e inteligência sobre o fluxo financeiro recente
 * (transações atômicas, abatimentos, pendências).
 */

const ListarRepassesPendentesInput = z.object({
  /** Filtrar por usina específica */
  usinaId: z.string().optional(),
  /** Incluir apenas repasses atrasados (> 30 dias) */
  apenasAtrasados: z.boolean().optional().default(false),
  /** Limitar quantidade de resultados */
  limit: z.number().int().min(1).max(100).optional().default(20),
});

type ListarRepassesInput = z.infer<typeof ListarRepassesPendentesInput>;

interface RepassePendenteComAlerta {
  id: string;
  usinaId: string;
  usinaNome: string | null;
  periodoInicio: Date;
  periodoFim: Date;
  valorBruto: number;
  totalDespesasAbatidas: number;
  valorLiquido: number;
  status: string;
  atrasado: boolean;
  diasAtraso: number | null;
  temComprovante: boolean;
  alertas: string[];
}

interface ListarRepassesOutput {
  totalPendentes: number;
  totalAtrasados: number;
  repasses: RepassePendenteComAlerta[];
  observacao: string;
}

@Injectable()
export class RepassesDespesasService implements OnModuleInit {
  private readonly logger = new Logger(RepassesDespesasService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly toolRegistry: ToolRegistryService,
  ) {}

  async onModuleInit() {
    this.registerTools();
  }

  private registerTools(): void {
    // ============================================================
    // Tool L0 — Listar Repasses Pendentes com Alertas Inteligentes
    // ============================================================
    const executeListarRepasses = async (input: ListarRepassesInput, context: AgentContext): Promise<ListarRepassesOutput> => {
      const where: any = {
        cooperativaId: context.cooperativaId,
        status: 'PENDENTE',
      };

      if (input.usinaId) {
        where.usinaId = input.usinaId;
      }

      const repasses = await this.prisma.repasseProprietario.findMany({
        where,
        include: {
          usina: { select: { nome: true } },
        },
        orderBy: { periodoFim: 'asc' },
        take: input.limit,
      });

      const agora = new Date();
      const trintaDiasAtras = new Date(agora.getTime() - 30 * 24 * 60 * 60 * 1000);

      const repassesComAlertas: RepassePendenteComAlerta[] = repasses.map((r) => {
        const periodoFim = new Date(r.periodoFim);
        const atrasado = periodoFim < trintaDiasAtras;
        const diasAtraso = atrasado
          ? Math.floor((agora.getTime() - periodoFim.getTime()) / (1000 * 3600 * 24))
          : null;

        const alertas: string[] = [];

        if (atrasado) {
          alertas.push(`ATRASADO há ${diasAtraso} dias`);
        }

        const percentualDespesas =
          r.valorBruto > 0 ? (Number(r.totalDespesasAbatidas) / Number(r.valorBruto)) * 100 : 0;

        if (percentualDespesas > 25) {
          alertas.push(`Alto abatimento de despesas: ${percentualDespesas.toFixed(1)}%`);
        }

        if (!r.comprovante) {
          alertas.push('Sem comprovante de pagamento registrado');
        }

        if (Number(r.valorLiquido) < 500 && Number(r.valorBruto) > 2000) {
          alertas.push('Valor líquido muito baixo em relação ao bruto');
        }

        return {
          id: r.id,
          usinaId: r.usinaId,
          usinaNome: r.usina?.nome ?? null,
          periodoInicio: r.periodoInicio,
          periodoFim: r.periodoFim,
          valorBruto: Number(r.valorBruto),
          totalDespesasAbatidas: Number(r.totalDespesasAbatidas),
          valorLiquido: Number(r.valorLiquido),
          status: r.status,
          atrasado,
          diasAtraso,
          temComprovante: !!r.comprovante,
          alertas,
        };
      });

      const totalPendentes = repassesComAlertas.length;
      const totalAtrasados = repassesComAlertas.filter((r) => r.atrasado).length;

      let observacao = `Existem ${totalPendentes} repasses pendentes.`;

      if (totalAtrasados > 0) {
        observacao += ` ${totalAtrasados} estão atrasados há mais de 30 dias.`;
      }

      if (totalPendentes > 0) {
        observacao +=
          ' Use esta informação para priorizar pagamentos e evitar acúmulo de passivo com proprietários.';
      }

      return {
        totalPendentes,
        totalAtrasados,
        repasses: repassesComAlertas,
        observacao,
      };
    };

    const listarRepassesPendentes = defineTool({
      id: 'repasses.listarPendentesComAlertas',
      name: 'Listar Repasses Pendentes com Alertas',
      description:
        'Lista Repasses a Proprietários (RepasseProprietario) com status PENDENTE. ' +
        'Inclui alertas automáticos: atrasado (>30 dias), alto abatimento de despesas, ausência de comprovante. ' +
        'Nível L0 (leitura). Muito útil para monitoramento financeiro e priorização de pagamentos.',
      declaredRiskLevel: 'L0',
      inputSchema: ListarRepassesPendentesInput,
      execute: executeListarRepasses,
    });

    this.toolRegistry.register(listarRepassesPendentes);
    this.logger.log('Tool registrada: repasses.listarPendentesComAlertas [L0]');

    // ============================================================
    // Tool L0 — Listar Despesas com Tratamento DESCONTO_NO_REPASSE pendentes de abatimento
    // ============================================================
    const ListarDespesasDescontoInput = z.object({
      usinaId: z.string().optional(),
      limit: z.number().int().min(1).max(50).optional().default(15),
    });

    type ListarDespesasInput = z.infer<typeof ListarDespesasDescontoInput>;

    const executeListarDespesasDesconto = async (input: ListarDespesasInput, context: AgentContext) => {
      const where: any = {
        cooperativaId: context.cooperativaId,
        tratamento: 'DESCONTO_NO_REPASSE',
        status: 'APROVADA',
        repasseAbatidoId: null, // ainda não foi abatida em nenhum repasse
      };

      if (input.usinaId) {
        where.usinaId = input.usinaId;
      }

      const despesas = await this.prisma.contaAPagar.findMany({
        where,
        include: {
          usina: { select: { nome: true } },
        },
        orderBy: { dataVencimento: 'asc' },
        take: input.limit,
      });

      const resultado = despesas.map((d) => ({
        id: d.id,
        descricao: d.descricao,
        categoria: d.categoria,
        valor: Number(d.valor),
        dataVencimento: d.dataVencimento,
        usinaId: d.usinaId,
        usinaNome: d.usina?.nome ?? null,
        status: d.status,
        tratamento: d.tratamento,
      }));

      return {
        totalPendentesAbatimento: resultado.length,
        despesas: resultado,
        observacao:
          resultado.length > 0
            ? `${resultado.length} despesas aprovadas com tratamento DESCONTO_NO_REPASSE ainda não foram abatidas em nenhum repasse.`
            : 'Nenhuma despesa pendente de abatimento via repasse neste momento.',
      };
    };

    const listarDespesasDesconto = defineTool({
      id: 'despesas.listarPendentesDescontoRepasse',
      name: 'Listar Despesas Pendentes de Abatimento via Repasse',
      description:
        'Lista despesas (ContaAPagar) com tratamento DESCONTO_NO_REPASSE que já foram aprovadas mas ainda não foram vinculadas a nenhum RepasseProprietario. ' +
        'Nível L0. Fundamental para acompanhar o fluxo de compensação de despesas operacionais.',
      declaredRiskLevel: 'L0',
      inputSchema: ListarDespesasDescontoInput,
      execute: executeListarDespesasDesconto,
    });

    this.toolRegistry.register(listarDespesasDesconto);
    this.logger.log('Tool registrada: despesas.listarPendentesDescontoRepasse [L0]');

    // ============================================================
    // Tool L0 — Resumo Financeiro de Repasses Pendentes (agregado)
    // ============================================================
    const ResumoFinanceiroInput = z.object({
      usinaId: z.string().optional(),
    });

    const executeResumoFinanceiro = async (input: any, context: AgentContext) => {
      const where: any = {
        cooperativaId: context.cooperativaId,
        status: 'PENDENTE',
      };
      if (input.usinaId) where.usinaId = input.usinaId;

      const repasses = await this.prisma.repasseProprietario.findMany({
        where,
        select: {
          valorBruto: true,
          totalDespesasAbatidas: true,
          valorLiquido: true,
        },
      });

      const totalBruto = repasses.reduce((sum, r) => sum + Number(r.valorBruto), 0);
      const totalDespesas = repasses.reduce((sum, r) => sum + Number(r.totalDespesasAbatidas), 0);
      const totalLiquido = repasses.reduce((sum, r) => sum + Number(r.valorLiquido), 0);
      const percentualMedioDespesas = totalBruto > 0 ? (totalDespesas / totalBruto) * 100 : 0;

      return {
        quantidadeRepassesPendentes: repasses.length,
        valorBrutoTotal: totalBruto,
        valorDespesasAbatidasTotal: totalDespesas,
        valorLiquidoTotal: totalLiquido,
        percentualMedioDespesas: Number(percentualMedioDespesas.toFixed(1)),
        observacao: repasses.length > 0 
          ? `Média de ${percentualMedioDespesas.toFixed(1)}% do valor bruto dos repasses pendentes está sendo abatido por despesas.`
          : 'Não há repasses pendentes no momento.',
      };
    };

    const resumoFinanceiro = defineTool({
      id: 'repasses.resumoFinanceiroPendentes',
      name: 'Resumo Financeiro de Repasses Pendentes',
      description: 'Agrega valor bruto, despesas abatidas e líquido de todos os repasses pendentes. Dá visão macro do impacto financeiro das despesas nos repasses ainda não pagos. Nível L0.',
      declaredRiskLevel: 'L0',
      inputSchema: ResumoFinanceiroInput,
      execute: executeResumoFinanceiro,
    });

    this.toolRegistry.register(resumoFinanceiro);
    this.logger.log('Tool registrada: repasses.resumoFinanceiroPendentes [L0]');

    // ============================================================
    // Tool L1 — Simular Efeito de uma Despesa nos Repasses Pendentes (simulação)
    // ============================================================
    const SimularDespesaInput = z.object({
      usinaId: z.string(),
      valor: z.number().positive(),
      categoria: z.string().optional(),
    });

    const executeSimularDespesa = async (input: any, context: AgentContext) => {
      // Busca repasses pendentes da usina, ordenados do mais antigo para o mais recente
      const repassesPendentes = await this.prisma.repasseProprietario.findMany({
        where: {
          cooperativaId: context.cooperativaId,
          usinaId: input.usinaId,
          status: 'PENDENTE',
        },
        orderBy: { periodoFim: 'asc' },
        select: {
          id: true,
          periodoInicio: true,
          periodoFim: true,
          valorBruto: true,
          totalDespesasAbatidas: true,
          valorLiquido: true,
        },
      });

      if (repassesPendentes.length === 0) {
        return {
          usinaId: input.usinaId,
          valorDespesa: input.valor,
          impacto: 'Nenhum repasse pendente encontrado para esta usina.',
          podeAbater: false,
          repassesAfetados: [],
        };
      }

      let valorRestante = input.valor;
      const afetados = [];
      let totalAbatido = 0;

      for (const rep of repassesPendentes) {
        if (valorRestante <= 0) break;

        const bruto = Number(rep.valorBruto);
        const jaAbatido = Number(rep.totalDespesasAbatidas);
        const espacoDisponivel = bruto - jaAbatido; // quanto ainda pode ser abatido

        if (espacoDisponivel <= 0) continue;

        const abatidoNeste = Math.min(valorRestante, espacoDisponivel);
        const novoLiquido = bruto - (jaAbatido + abatidoNeste);

        afetados.push({
          repasseId: rep.id,
          periodo: `${rep.periodoInicio.toISOString().slice(0,10)} a ${rep.periodoFim.toISOString().slice(0,10)}`,
          valorBruto: bruto,
          abatidoAntes: jaAbatido,
          abatidoComEstaDespesa: abatidoNeste,
          novoValorLiquido: Number(novoLiquido.toFixed(2)),
        });

        valorRestante -= abatidoNeste;
        totalAbatido += abatidoNeste;
      }

      return {
        usinaId: input.usinaId,
        valorDespesa: input.valor,
        totalAbatidoNosRepasses: Number(totalAbatido.toFixed(2)),
        valorNaoAbatido: Number(Math.max(0, valorRestante).toFixed(2)),
        repassesAfetados: afetados,
        podeAbater: afetados.length > 0,
        observacao: afetados.length > 0 
          ? `Esta despesa afetaria ${afetados.length} repasse(s) pendente(s).`
          : 'Não há espaço suficiente nos repasses pendentes para abater esta despesa.',
      };
    };

    const simularDespesa = defineTool({
      id: 'repasses.simularEfeitoDespesa',
      name: 'Simular Efeito de Despesa nos Repasses Pendentes',
      description: 'Tool L1 (simulação). Dado valor + usina, projeta como uma despesa seria abatida nos repasses pendentes atuais (via DESCONTO_NO_REPASSE). Mostra impacto no líquido de cada repasse afetado. Excelente para decisão antes de aprovar despesas.',
      declaredRiskLevel: 'L1',
      inputSchema: SimularDespesaInput,
      execute: executeSimularDespesa,
    });

    this.toolRegistry.register(simularDespesa);
    this.logger.log('Tool registrada: repasses.simularEfeitoDespesa [L1]');

    // ============================================================
    // Tool L0 — Resumo de Despesas DESCONTO_NO_REPASSE por Usina
    // ============================================================
    const ResumoDespesasPorUsinaInput = z.object({
      limit: z.number().int().min(1).max(30).optional().default(10),
    });

    const executeResumoDespesasPorUsina = async (input: any, context: AgentContext) => {
      const despesas = await this.prisma.contaAPagar.findMany({
        where: {
          cooperativaId: context.cooperativaId,
          tratamento: 'DESCONTO_NO_REPASSE',
          status: 'APROVADA',
          repasseAbatidoId: null,
        },
        include: {
          usina: { select: { nome: true } },
        },
      });

      // Agrupar por usina
      const porUsina = new Map<string, { usinaNome: string; total: number; quantidade: number }>();

      for (const d of despesas) {
        const key = d.usinaId;
        const nome = d.usina?.nome ?? 'Usina sem nome';
        const valor = Number(d.valor);

        if (!porUsina.has(key)) {
          porUsina.set(key, { usinaNome: nome, total: 0, quantidade: 0 });
        }
        const entry = porUsina.get(key)!;
        entry.total += valor;
        entry.quantidade += 1;
      }

      const resultado = Array.from(porUsina.entries())
        .map(([usinaId, data]) => ({
          usinaId,
          usinaNome: data.usinaNome,
          quantidade: data.quantidade,
          valorTotal: Number(data.total.toFixed(2)),
        }))
        .sort((a, b) => b.valorTotal - a.valorTotal)
        .slice(0, input.limit);

      return {
        totalUsinasAfetadas: porUsina.size,
        totalDespesasPendentes: despesas.length,
        valorTotalPendente: Number(despesas.reduce((s, d) => s + Number(d.valor), 0).toFixed(2)),
        porUsina: resultado,
        observacao: resultado.length > 0 
          ? `As ${resultado.length} usinas com maior volume de despesas pendentes de abatimento.`
          : 'Nenhuma despesa DESCONTO_NO_REPASSE pendente no momento.',
      };
    };

    const resumoDespesasPorUsina = defineTool({
      id: 'despesas.resumoPorUsina',
      name: 'Resumo de Despesas DESCONTO_NO_REPASSE por Usina',
      description: 'Tool L0. Mostra o volume total de despesas aprovadas com tratamento DESCONTO_NO_REPASSE que ainda não foram abatidas, agrupadas por usina. Permite priorizar onde o impacto financeiro é maior.',
      declaredRiskLevel: 'L0',
      inputSchema: ResumoDespesasPorUsinaInput,
      execute: executeResumoDespesasPorUsina,
    });

    this.toolRegistry.register(resumoDespesasPorUsina);
    this.logger.log('Tool registrada: despesas.resumoPorUsina [L0]');
  }

  async executarListarRepassesPendentes(
    input: ListarRepassesInput,
    context: AgentContext,
  ): Promise<ToolResult<ListarRepassesOutput>> {
    return this.toolRegistry.execute('repasses.listarPendentesComAlertas', input, context);
  }

  async executarListarDespesasDesconto(
    input: any,
    context: AgentContext,
  ): Promise<ToolResult<any>> {
    return this.toolRegistry.execute('despesas.listarPendentesDescontoRepasse', input, context);
  }

  async executarResumoFinanceiro(
    input: any,
    context: AgentContext,
  ): Promise<ToolResult<any>> {
    return this.toolRegistry.execute('repasses.resumoFinanceiroPendentes', input, context);
  }

  async executarSimularDespesa(
    input: any,
    context: AgentContext,
  ): Promise<ToolResult<any>> {
    return this.toolRegistry.execute('repasses.simularEfeitoDespesa', input, context);
  }

  async executarResumoDespesasPorUsina(
    input: any,
    context: AgentContext,
  ): Promise<ToolResult<any>> {
    return this.toolRegistry.execute('despesas.resumoPorUsina', input, context);
  }
}
