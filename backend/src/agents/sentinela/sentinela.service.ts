import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { ToolRegistryService } from '../common/tools/tool-registry.service';
import { defineTool, AgentContext, ToolResult } from '../common/tools/tool.interface';
import { z } from 'zod';

/**
 * SentinelaService — Prioridade A do Módulo IAG.
 *
 * Camada de inteligência sobre o gap de classificação regulatória (Fio B / GD).
 *
 * Estratégia atual (segura e útil enquanto o core permanece neutro):
 * - Não exige dados perfeitos de enquadramento.
 * - Detecta e quantifica o problema (visibilidade).
 * - Permite simulações de risco de alocação entre diferentes tratamentos de Fio B.
 *
 * Esta service registra as Tools do Sentinela no ToolRegistry no bootstrap.
 */

const MapearUsinasSemEnquadramentoInput = z.object({
  /** Filtrar por uma usina específica (opcional) */
  usinaId: z.string().optional(),
  /** Retornar apenas usinas com status operacional específico */
  statusOperacional: z.enum(['OPERANDO', 'MANUTENCAO_PLANEJADA', 'MANUTENCAO_EMERGENCIAL', 'DESLIGADA', 'OFFLINE']).optional(),
});

type MapearInput = z.infer<typeof MapearUsinasSemEnquadramentoInput>;

interface UsinaSemEnquadramento {
  id: string;
  nome: string;
  cooperativaId: string;
  classeGdAnotada: string | null;
  statusHomologacao: string;
  statusOperacional: string;
  dataHomologacao: Date | null;
  cidade: string;
  estado: string;
}

interface MapearOutput {
  totalUsinas: number;
  usinasSemEnquadramento: number;
  percentualSemEnquadramento: number;
  usinas: UsinaSemEnquadramento[];
  observacao: string;
}

@Injectable()
export class SentinelaService implements OnModuleInit {
  private readonly logger = new Logger(SentinelaService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly toolRegistry: ToolRegistryService,
  ) {}

  async onModuleInit() {
    this.registerTools();
  }

  private registerTools(): void {
    // Tool 1 — L0: Mapear usinas sem enquadramento regulatório (GD / Fio B)
    // Usamos arrow function para preservar o 'this' do SentinelaService
    const executeMapear = async (input: MapearInput, context: AgentContext): Promise<MapearOutput> => {
      const where: any = {
        cooperativaId: context.cooperativaId,
      };

      if (input.usinaId) {
        where.id = input.usinaId;
      }
      if (input.statusOperacional) {
        where.statusOperacional = input.statusOperacional;
      }

      const usinas = await this.prisma.usina.findMany({
        where,
        select: {
          id: true,
          nome: true,
          cooperativaId: true,
          classeGdAnotada: true,
          statusHomologacao: true,
          statusOperacional: true,
          dataHomologacao: true,
          cidade: true,
          estado: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      const semEnquadramento = usinas.filter(
        (u) => !u.classeGdAnotada || u.classeGdAnotada.trim() === '',
      );

      const total = usinas.length;
      const sem = semEnquadramento.length;
      const percentual = total > 0 ? Math.round((sem / total) * 100) : 0;

      return {
        totalUsinas: total,
        usinasSemEnquadramento: sem,
        percentualSemEnquadramento: percentual,
        usinas: semEnquadramento.map((u) => ({
          id: u.id,
          nome: u.nome,
          cooperativaId: u.cooperativaId,
          classeGdAnotada: u.classeGdAnotada,
          statusHomologacao: u.statusHomologacao,
          statusOperacional: u.statusOperacional,
          dataHomologacao: u.dataHomologacao,
          cidade: u.cidade,
          estado: u.estado,
        })),
        observacao:
          sem > 0
            ? `Existem ${sem} usinas (${percentual}%) sem classificação de enquadramento regulatório (GD/Fio B). ` +
              'Movimentações e alocações para essas usinas carregam risco alto de impacto tarifário inesperado para o cooperado.'
            : 'Todas as usinas consultadas possuem classificação de enquadramento preenchida.',
      };
    };

    const mapearUsinasSemEnquadramento = defineTool({
      id: 'sentinela.mapearUsinasSemEnquadramento',
      name: 'Mapear Usinas sem Enquadramento Regulatório',
      description:
        'Lista usinas que não possuem classificação GD (classeGdAnotada) preenchida. ' +
        'Essencial para entender o tamanho do gap de tratamento de Fio B antes de qualquer sugestão de alocação ou movimentação. ' +
        'Nível L0 (leitura pura).',
      declaredRiskLevel: 'L0',
      inputSchema: MapearUsinasSemEnquadramentoInput,
      execute: executeMapear,
    });

    this.toolRegistry.register(mapearUsinasSemEnquadramento);
    this.logger.log('Tool registrada: sentinela.mapearUsinasSemEnquadramento [L0]');

    // ============================================================
    // Tool 2 — L1: Análise de risco de movimentação entre enquadramentos (Fio B / GD)
    // ============================================================
    const AnalisarRiscoMovimentacaoInput = z.object({
      /** ID do contrato que se pretende mover (recomendado) */
      contratoId: z.string().optional(),
      /** Usina de origem atual */
      usinaOrigemId: z.string(),
      /** Usina de destino pretendida */
      usinaDestinoId: z.string(),
      /** kWh anual aproximado que se pretende alocar/mover (para estimativa de impacto) */
      kwhAnualEstimado: z.number().optional(),
    });

    type RiscoInput = z.infer<typeof AnalisarRiscoMovimentacaoInput>;

    const executeAnalisarRisco = async (input: RiscoInput, context: AgentContext) => {
      const [origem, destino, contrato] = await Promise.all([
        this.prisma.usina.findUnique({
          where: { id: input.usinaOrigemId },
          select: {
            id: true,
            nome: true,
            classeGdAnotada: true,
            dataHomologacao: true,
            cidade: true,
            estado: true,
          },
        }),
        this.prisma.usina.findUnique({
          where: { id: input.usinaDestinoId },
          select: {
            id: true,
            nome: true,
            classeGdAnotada: true,
            dataHomologacao: true,
            cidade: true,
            estado: true,
          },
        }),
        input.contratoId
          ? this.prisma.contrato.findUnique({
              where: { id: input.contratoId },
              select: {
                id: true,
                usinaId: true,
                percentualUsina: true,
                kwhContratoAnual: true,
                classeGdAplicada: true,
                cooperado: { select: { nome: true } },
              },
            })
          : null,
      ]);

      if (!origem || !destino) {
        return {
          risco: 'CRITICAL',
          podeRecomendar: false,
          explicacao: 'Uma ou ambas as usinas não foram encontradas.',
          gapsDeDados: ['Usina origem ou destino inexistente'],
          recomendacao: 'Verifique os IDs das usinas.',
          origem: null,
          destino: null,
        };
      }

      const classeOrigem = origem.classeGdAnotada?.trim() || null;
      const classeDestino = destino.classeGdAnotada?.trim() || null;

      const temClassificacaoOrigem = !!classeOrigem;
      const temClassificacaoDestino = !!classeDestino;
      const classesDiferentes = temClassificacaoOrigem && temClassificacaoDestino && classeOrigem !== classeDestino;

      let risco: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | 'UNKNOWN' = 'UNKNOWN';
      let podeRecomendar = false;
      let explicacao = '';
      const gaps: string[] = [];

      if (!temClassificacaoOrigem) gaps.push('Usina de origem sem classeGdAnotada');
      if (!temClassificacaoDestino) gaps.push('Usina de destino sem classeGdAnotada');
      if (contrato && !contrato.classeGdAplicada) gaps.push('Contrato sem classeGdAplicada preenchida');

      if (!temClassificacaoOrigem || !temClassificacaoDestino) {
        risco = 'CRITICAL';
        explicacao =
          'Pelo menos uma das usinas não possui classificação regulatória (GD / tratamento de Fio B). ' +
          'Qualquer movimentação nesse cenário carrega risco muito alto de impacto tarifário imprevisível para o cooperado, ' +
          'especialmente em GD II e GD III com datas de homologação diferentes.';
        podeRecomendar = false;
      } else if (classesDiferentes) {
        risco = 'HIGH';
        explicacao =
          `Movimentação entre classes diferentes (${classeOrigem} → ${classeDestino}). ` +
          'Isso frequentemente altera o percentual de Fio B aplicável (transição Lei 14.300), podendo gerar aumento expressivo na fatura do cooperado ' +
          '(casos reais já observados com variação de 5x ou mais no valor da fatura).';
        podeRecomendar = false;
      } else {
        risco = 'MEDIUM';
        explicacao =
          `Ambas as usinas estão na mesma classe GD (${classeOrigem}). ` +
          'O risco é menor, mas ainda depende das datas exatas de homologação/ligação e das regras específicas da concessionária. ' +
          'Recomenda-se confirmar o enquadramento completo antes de efetivar.';
        podeRecomendar = true;
      }

      const recomendacao =
        risco === 'CRITICAL'
          ? 'NÃO mover até que ambas as usinas tenham classificação regulatória preenchida. Priorize o preenchimento de classeGdAnotada + dataHomologacao.'
          : risco === 'HIGH'
          ? 'Evitar movimentação. Se for inevitável, realizar simulação detalhada de fatura com dados reais da concessionária antes de qualquer decisão.'
          : 'Pode ser viável, mas valide as datas de homologação e realize simulação financeira antes de aprovar.';

      const contratoAtual = contrato
        ? {
            id: contrato.id,
            cooperadoNome: contrato.cooperado?.nome ?? null,
            usinaAtualId: contrato.usinaId,
            percentualUsina: contrato.percentualUsina ? Number(contrato.percentualUsina) : null,
            kwhContratoAnual: contrato.kwhContratoAnual ? Number(contrato.kwhContratoAnual) : null,
            classeGdAplicada: contrato.classeGdAplicada,
          }
        : null;

      return {
        risco,
        podeRecomendar,
        explicacao,
        gapsDeDados: gaps,
        recomendacao,
        origem: {
          id: origem.id,
          nome: origem.nome,
          classeGdAnotada: classeOrigem,
          dataHomologacao: origem.dataHomologacao,
          local: `${origem.cidade}/${origem.estado}`,
        },
        destino: {
          id: destino.id,
          nome: destino.nome,
          classeGdAnotada: classeDestino,
          dataHomologacao: destino.dataHomologacao,
          local: `${destino.cidade}/${destino.estado}`,
        },
        contratoAtual,
        observacao:
          'Esta análise é uma proxy inteligente enquanto o módulo completo de Classificação Regulatória GD / Fio B não estiver implementado no core. ' +
          'O Sentinela atua como camada de proteção para evitar prejuízos aos cooperados.',
      };
    };

    const analisarRiscoMovimentacao = defineTool({
      id: 'sentinela.analisarRiscoMovimentacaoEntreEnquadramentos',
      name: 'Analisar Risco de Movimentação entre Enquadramentos Regulatórios (Fio B)',
      description:
        'Simulação L1 (recomendação). Avalia o risco de mover alocação de uma usina para outra considerando o tratamento de Fio B / classe GD. ' +
        'Detecta quando origem ou destino estão sem classificação e alerta sobre mudanças entre classes diferentes. ' +
        'Fundamental para proteger cooperados de aumentos tarifários inesperados (ex: casos como Exfishes).',
      declaredRiskLevel: 'L1',
      inputSchema: AnalisarRiscoMovimentacaoInput,
      execute: executeAnalisarRisco,
    });

    this.toolRegistry.register(analisarRiscoMovimentacao);
    this.logger.log('Tool registrada: sentinela.analisarRiscoMovimentacaoEntreEnquadramentos [L1]');
  }

  /**
   * Expõe execução direta da Tool (útil para chamadas internas ou testes).
   */
  async executarMapearUsinasSemEnquadramento(
    input: MapearInput,
    context: AgentContext,
  ): Promise<ToolResult<MapearOutput>> {
    return this.toolRegistry.execute('sentinela.mapearUsinasSemEnquadramento', input, context);
  }

  async executarAnalisarRiscoMovimentacao(
    input: any,
    context: AgentContext,
  ): Promise<ToolResult<any>> {
    return this.toolRegistry.execute('sentinela.analisarRiscoMovimentacaoEntreEnquadramentos', input, context);
  }
}
