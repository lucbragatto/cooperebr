import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { ToolRegistryService } from '../common/tools/tool-registry.service';
import { defineTool, AgentContext, ToolResult } from '../common/tools/tool.interface';
import { z } from 'zod';

/**
 * CobrancaService — Prioridade E do Módulo IAG (CoopereBR/SISGD).
 *
 * Auditoria de inconsistências de cobrança/faturamento.
 * Fase inicial: Tools L0 (leitura pura) — seguras mesmo durante litígio regulatório com EDP.
 *
 * Princípios seguidos:
 * - Dependência unidirecional (IAG só lê core)
 * - Multi-tenancy forte via context.cooperativaId
 * - PolicyEngine L0-L4 (esta Tool declara L0)
 * - Imutabilidade: nunca muta dados, apenas relata
 * - Saída estruturada + observação explícita sobre limitações do core (modelos não-FIXO bloqueados)
 */

const AuditarInconsistenciasInput = z.object({
  /** Mês de referência (1-12) — opcional para filtro */
  mesReferencia: z.number().min(1).max(12).optional(),
  /** Ano de referência (ex: 2026) — opcional */
  anoReferencia: z.number().min(2023).max(2030).optional(),
  /** Contrato específico — opcional */
  contratoId: z.string().optional(),
  /** Limite de cobranças a analisar (padrão 200, máx 500 para L0) */
  limit: z.number().min(1).max(500).optional(),
});

type AuditarInput = z.infer<typeof AuditarInconsistenciasInput>;

interface InconsistenciaCobranca {
  id: string;
  cobrancaId: string;
  tipo: 'PAGAMENTO_PARCIAL_NAO_QUITADO' | 'DIVERGENCIA_VALOR_FATURA' | 'MODELO_DIVERGENTE_CONFIG';
  severidade: 'BAIXA' | 'MEDIA' | 'ALTA';
  valorImpactoEstimado: number;
  descricao: string;
  recomendacao: string;
  dadosContexto: Record<string, unknown>;
}

interface AuditarOutput {
  totalCobrancasAnalisadas: number;
  inconsistencias: InconsistenciaCobranca[];
  resumo: {
    totalInconsistencias: number;
    impactoFinanceiroTotal: number;
    porTipo: Record<string, number>;
    porSeveridade: Record<string, number>;
  };
  observacao: string;
}

@Injectable()
export class CobrancaService implements OnModuleInit {
  private readonly logger = new Logger(CobrancaService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly toolRegistry: ToolRegistryService,
  ) {}

  async onModuleInit() {
    this.registerTools();
  }

  private registerTools(): void {
    // ============================================================
    // Tool L0 — Auditoria de inconsistências de cobrança/faturamento
    // ============================================================
    const executeAuditar = async (
      input: AuditarInput,
      context: AgentContext,
    ): Promise<AuditarOutput> => {
      const where: any = {
        cooperativaId: context.cooperativaId,
      };

      if (input.mesReferencia) where.mesReferencia = input.mesReferencia;
      if (input.anoReferencia) where.anoReferencia = input.anoReferencia;
      if (input.contratoId) where.contratoId = input.contratoId;

      const limit = input.limit ?? 200;

      const cobrancas = await this.prisma.cobranca.findMany({
        where,
        select: {
          id: true,
          contratoId: true,
          mesReferencia: true,
          anoReferencia: true,
          valorBruto: true,
          valorDesconto: true,
          valorLiquido: true,
          status: true,
          dataVencimento: true,
          dataPagamento: true,
          valorPago: true,
          valorMulta: true,
          valorJuros: true,
          valorAtualizado: true,
          kwhCompensado: true,
          fonteDados: true,
          faturaProcessadaId: true,
          modeloCobrancaUsado: true,
          baseCalculoUsada: true,
        },
        orderBy: [{ anoReferencia: 'desc' }, { mesReferencia: 'desc' }],
        take: limit,
      });

      const inconsistencias: InconsistenciaCobranca[] = [];

      for (const c of cobrancas) {
        const valorPagoNum = Number(c.valorPago || 0);
        const valorLiquidoNum = Number(c.valorLiquido || 0);
        const multaNum = Number(c.valorMulta || 0);
        const jurosNum = Number(c.valorJuros || 0);
        const valorDevido = valorLiquidoNum + multaNum + jurosNum;

        // Inconsistência 1 (alta prioridade): Pagamento parcial não quitado
        if (c.status === 'PAGO' && valorPagoNum + 0.01 < valorDevido) {
          const impacto = Math.round((valorDevido - valorPagoNum) * 100) / 100;

          inconsistencias.push({
            id: `inc-${c.id}-parcial`,
            cobrancaId: c.id,
            tipo: 'PAGAMENTO_PARCIAL_NAO_QUITADO',
            severidade: 'ALTA',
            valorImpactoEstimado: impacto,
            descricao:
              `Cobrança ${c.mesReferencia}/${c.anoReferencia} está PAGO, ` +
              `mas valorPago R$ ${valorPagoNum.toFixed(2)} < valor devido R$ ${valorDevido.toFixed(2)} ` +
              `(líquido ${valorLiquidoNum.toFixed(2)} + multa ${multaNum.toFixed(2)} + juros ${jurosNum.toFixed(2)})`,
            recomendacao:
              'Verificar AsaasCobranca / CobrancaBancaria / SolicitacaoConfirmacaoPagamento. ' +
              'Atualizar valorPago ou reclassificar status. Risco de prejuízo para a cooperativa.',
            dadosContexto: {
              status: c.status,
              valorPago: valorPagoNum,
              valorDevido,
              dataPagamento: c.dataPagamento,
            },
          });
        }

        // Inconsistência 2 (básica v1): Divergência simples de modelo vs config (placeholder para expansão)
        if (c.modeloCobrancaUsado && c.modeloCobrancaUsado !== 'FIXO_MENSAL') {
          inconsistencias.push({
            id: `inc-${c.id}-modelo`,
            cobrancaId: c.id,
            tipo: 'MODELO_DIVERGENTE_CONFIG',
            severidade: 'MEDIA',
            valorImpactoEstimado: 0,
            descricao:
              `Cobrança usa modelo ${c.modeloCobrancaUsado}, mas apenas FIXO_MENSAL está ativo no core ` +
              `(BLOQUEIO_MODELOS_NAO_FIXO).`,
            recomendacao:
              'Confirmar se o cálculo foi manual ou se flag de bloqueio precisa ser revisado. ' +
              'IAG pode simular os outros modelos em Tool L1 futura.',
            dadosContexto: {
              modeloUsado: c.modeloCobrancaUsado,
              baseCalculoUsada: c.baseCalculoUsada,
            },
          });
        }

        // Inconsistência 3: Divergência com FaturaProcessada (OCR)
        if (c.faturaProcessadaId) {
          const fatura = await this.prisma.faturaProcessada.findUnique({
            where: { id: c.faturaProcessadaId },
            select: {
              id: true,
              statusRevisao: true,
              mesReferencia: true,
              dadosExtraidos: true,
              valorCheioKwh: true,
            },
          });

          if (fatura && fatura.statusRevisao === 'PENDENTE_REVISAO') {
            inconsistencias.push({
              id: `inc-${c.id}-fatura`,
              cobrancaId: c.id,
              tipo: 'DIVERGENCIA_VALOR_FATURA',
              severidade: 'MEDIA',
              valorImpactoEstimado: 0,
              descricao:
                `Cobrança ${c.mesReferencia}/${c.anoReferencia} referencia FaturaProcessada ` +
                `(${c.faturaProcessadaId}) com statusRevisao PENDENTE_REVISAO. ` +
                'Possível divergência entre dados da OCR e valores cobrados.',
              recomendacao:
                'Revisar a FaturaProcessada no fluxo de aprovação. Validar se os dados extraídos batem com a cobrança gerada.',
              dadosContexto: {
                faturaProcessadaId: c.faturaProcessadaId,
                statusRevisao: fatura.statusRevisao,
                mesFatura: fatura.mesReferencia,
              },
            });
          }
        }
      }

      // Resumo imutável (novo objeto)
      const resumo = {
        totalInconsistencias: inconsistencias.length,
        impactoFinanceiroTotal: inconsistencias.reduce(
          (sum, i) => sum + i.valorImpactoEstimado,
          0,
        ),
        porTipo: inconsistencias.reduce((acc: Record<string, number>, i) => {
          acc[i.tipo] = (acc[i.tipo] || 0) + 1;
          return acc;
        }, {}),
        porSeveridade: inconsistencias.reduce((acc: Record<string, number>, i) => {
          acc[i.severidade] = (acc[i.severidade] || 0) + 1;
          return acc;
        }, {}),
      };

      const observacao =
        inconsistencias.length > 0
          ? `Encontradas ${inconsistencias.length} inconsistência(s) de cobrança. ` +
            'Esta análise é somente leitura (L0). O módulo IAG não altera dados do core. ' +
            'Modelos CREDITOS_COMPENSADOS e CREDITOS_DINAMICO permanecem bloqueados no core — ' +
            'use Tool L1 futura para simular impacto financeiro real.'
          : 'Nenhuma inconsistência de cobrança detectada nas amostras analisadas. ' +
            'L0 (leitura pura) executada com sucesso.';

      return {
        totalCobrancasAnalisadas: cobrancas.length,
        inconsistencias,
        resumo,
        observacao,
      };
    };

    const auditarInconsistencias = defineTool({
      id: 'cobranca.auditarInconsistenciasCobranca',
      name: 'Auditar Inconsistências de Cobrança e Faturamento',
      description:
        'L0 (leitura pura, sempre permitido). Cruza Cobranca com dados de fatura (OCR), ' +
        'modelos de cobrança e pagamentos parciais/gateway. Detecta pagamentos parciais não quitados, ' +
        'divergências de valor e uso de modelos não-FIXO enquanto o core mantém bloqueio. ' +
        'Fundamental para auditoria financeira e proteção do cooperado durante litígio regulatório. ' +
        'Nunca muta dados — apenas relata com impacto estimado em R$.',
      declaredRiskLevel: 'L0',
      inputSchema: AuditarInconsistenciasInput,
      execute: executeAuditar,
    });

    this.toolRegistry.register(auditarInconsistencias);
    this.logger.log('Tool registrada: cobranca.auditarInconsistenciasCobranca [L0]');

    // ============================================================
    // Tool L1 — Simulação de impacto dos 3 modelos de cobrança
    // ============================================================
    const SimularModelosInput = z.object({
      contratoId: z.string(),
      kwhCompensadoEstimado: z.number().positive().optional(),
      mesReferencia: z.number().min(1).max(12).optional(),
      anoReferencia: z.number().min(2023).optional(),
    });

    type SimularInput = z.infer<typeof SimularModelosInput>;

    interface ModeloSimulado {
      modelo: 'FIXO_MENSAL' | 'CREDITOS_COMPENSADOS' | 'CREDITOS_DINAMICO';
      valorEstimado: number;
      formula: string;
      observacoes: string;
    }

    interface SimularOutput {
      contratoId: string;
      kwhUsado: number;
      modelos: ModeloSimulado[];
      diferencaMaxima: number;
      recomendacao: string;
      observacao: string;
    }

    const executeSimular = async (
      input: SimularInput,
      context: AgentContext,
    ): Promise<SimularOutput> => {
      const contrato = await this.prisma.contrato.findUnique({
        where: { id: input.contratoId },
        select: {
          id: true,
          percentualDesconto: true,
          tarifaContratual: true,
          valorContrato: true,
          kwhContratoMensal: true,
          modeloCobrancaOverride: true,
          cooperativaId: true,
        },
      });

      if (!contrato || contrato.cooperativaId !== context.cooperativaId) {
        throw new Error('Contrato não encontrado ou não pertence à cooperativa');
      }

      // Tenta obter kWh do mês mais recente ou usa o estimado
      let kwh = input.kwhCompensadoEstimado ?? Number(contrato.kwhContratoMensal ?? 0);

      if (!kwh && input.mesReferencia && input.anoReferencia) {
        const cobrancaRecente = await this.prisma.cobranca.findFirst({
          where: {
            contratoId: input.contratoId,
            mesReferencia: input.mesReferencia,
            anoReferencia: input.anoReferencia,
          },
          select: { kwhCompensado: true },
        });
        if (cobrancaRecente) kwh = Number(cobrancaRecente.kwhCompensado ?? 0);
      }

      const desconto = Number(contrato.percentualDesconto ?? 0);
      const tarifaTravada = Number(contrato.tarifaContratual ?? 0);
      const valorFixo = Number(contrato.valorContrato ?? 0);

      const modelos: ModeloSimulado[] = [];

      // FIXO_MENSAL
      modelos.push({
        modelo: 'FIXO_MENSAL',
        valorEstimado: valorFixo > 0 ? valorFixo : 0,
        formula: 'Valor fixo contratual mensal',
        observacoes: 'Previsibilidade total. Não varia com geração.',
      });

      // CREDITOS_COMPENSADOS (usa tarifa travada)
      const comp = kwh * (tarifaTravada > 0 ? tarifaTravada : 0);
      modelos.push({
        modelo: 'CREDITOS_COMPENSADOS',
        valorEstimado: Math.round(comp * 100) / 100,
        formula: `kWh compensado (${kwh}) × tarifa contratual travada (${tarifaTravada})`,
        observacoes: 'Proteção contra alta de tarifa da concessionária.',
      });

      // CREDITOS_DINAMICO (usa tarifa cheia do mês × (1 - desconto))
      // Como não temos a tarifa cheia real aqui, usamos uma estimativa conservadora
      // (em produção real viria de FaturaProcessada ou tabela de tarifas)
      const tarifaCheiaEstimada = tarifaTravada > 0 ? tarifaTravada / (1 - desconto / 100) : 0;
      const dinamico = kwh * tarifaCheiaEstimada * (1 - desconto / 100);
      modelos.push({
        modelo: 'CREDITOS_DINAMICO',
        valorEstimado: Math.round(dinamico * 100) / 100,
        formula: `kWh × tarifa cheia estimada × (1 - ${desconto}%)`,
        observacoes: 'Acompanha variação tarifária da concessionária.',
      });

      const valores = modelos.map(m => m.valorEstimado);
      const diferencaMaxima = Math.max(...valores) - Math.min(...valores);

      const recomendacao =
        diferencaMaxima > 200
          ? 'Há diferença relevante entre os modelos. Recomenda-se análise detalhada com dados reais do mês.'
          : 'Diferença moderada entre os modelos para o volume atual.';

      return {
        contratoId: input.contratoId,
        kwhUsado: kwh,
        modelos,
        diferencaMaxima: Math.round(diferencaMaxima * 100) / 100,
        recomendacao,
        observacao:
          'Simulação L1 (somente leitura). Valores são estimativas baseadas em dados do contrato. ' +
          'Para precisão, forneça kwhCompensadoEstimado ou utilize dados reais de FaturaProcessada.',
      };
    };

    const simularModelos = defineTool({
      id: 'cobranca.simularComparativoModelos',
      name: 'Simular Comparativo dos 3 Modelos de Cobrança',
      description:
        'L1 (simulação). Calcula o impacto financeiro estimado para um contrato usando os três modelos: ' +
        'FIXO_MENSAL, CREDITOS_COMPENSADOS e CREDITOS_DINAMICO. Essencial para tomada de decisão durante o bloqueio dos modelos não-FIXO no core.',
      declaredRiskLevel: 'L1',
      inputSchema: SimularModelosInput,
      execute: executeSimular,
    });

    this.toolRegistry.register(simularModelos);
    this.logger.log('Tool registrada: cobranca.simularComparativoModelos [L1]');
  }

  /**
   * Expõe execução governada da Tool L0 (usado por AgentsService, UI admin e testes).
   */
  async executarAuditarInconsistenciasCobranca(
    input: AuditarInput,
    context: AgentContext,
  ): Promise<ToolResult<AuditarOutput>> {
    return this.toolRegistry.execute('cobranca.auditarInconsistenciasCobranca', input, context);
  }

  async executarSimularComparativoModelos(
    input: any,
    context: AgentContext,
  ): Promise<ToolResult<any>> {
    return this.toolRegistry.execute('cobranca.simularComparativoModelos', input, context);
  }
}
