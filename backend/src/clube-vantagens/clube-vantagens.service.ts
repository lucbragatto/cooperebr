import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { WhatsappCicloVidaService } from '../whatsapp/whatsapp-ciclo-vida.service';
import { WhatsappSenderService } from '../whatsapp/whatsapp-sender.service';
import { CooperTokenService } from '../cooper-token/cooper-token.service';
import { randomUUID } from 'crypto';

const NIVEL_ORDEM: Record<string, number> = {
  BRONZE: 0,
  PRATA: 1,
  OURO: 2,
  DIAMANTE: 3,
};

interface NivelConfig {
  nivel: string;
  kwhMinimo: number;
  kwhMaximo: number | null;
  beneficioPercentual: number;
  beneficioReaisKwh?: number;
}

@Injectable()
export class ClubeVantagensService {
  private readonly logger = new Logger(ClubeVantagensService.name);

  constructor(
    private prisma: PrismaService,
    private whatsappCicloVida: WhatsappCicloVidaService,
    private sender: WhatsappSenderService,
    private cooperTokenService: CooperTokenService,
  ) {}

  async criarOuObterProgressao(cooperadoId: string) {
    const existente = await this.prisma.progressaoClube.findUnique({
      where: { cooperadoId },
    });
    if (existente) return existente;

    return this.prisma.progressaoClube.create({
      data: {
        cooperadoId,
        nivelAtual: 'BRONZE',
      },
    });
  }

  async avaliarProgressao(cooperadoId: string) {
    const progressao = await this.prisma.progressaoClube.findUnique({
      where: { cooperadoId },
      include: { cooperado: { select: { cooperativaId: true } } },
    });
    if (!progressao) return { promovido: false, nivelAnterior: null, nivelNovo: null };

    const cooperativaId = progressao.cooperado.cooperativaId;
    if (!cooperativaId) return { promovido: false, nivelAnterior: null, nivelNovo: null };

    const config = await this.prisma.configClubeVantagens.findUnique({
      where: { cooperativaId },
    });
    if (!config || !config.ativo) return { promovido: false, nivelAnterior: null, nivelNovo: null };

    const niveisConfig = (config.niveisConfig as unknown as NivelConfig[]) || [];
    if (niveisConfig.length === 0) return { promovido: false, nivelAnterior: null, nivelNovo: null };

    // Determinar valor de comparação baseado no critério
    let valorAtual: number;
    switch (config.criterio) {
      case 'NUMERO_INDICADOS_ATIVOS':
        valorAtual = progressao.indicadosAtivos;
        break;
      case 'RECEITA_INDICADOS':
        valorAtual = progressao.receitaIndicados;
        break;
      case 'KWH_INDICADO_ACUMULADO':
      default:
        valorAtual = progressao.kwhIndicadoAcumulado;
        break;
    }

    // Encontrar o nível mais alto que o cooperado qualifica
    let melhorNivel: string = progressao.nivelAtual;
    let melhorBeneficio = progressao.beneficioPercentualAtual;
    let melhorBeneficioKwh = progressao.beneficioReaisKwhAtual;

    for (const nc of niveisConfig) {
      if (valorAtual >= nc.kwhMinimo && NIVEL_ORDEM[nc.nivel] > NIVEL_ORDEM[melhorNivel]) {
        melhorNivel = nc.nivel;
        melhorBeneficio = nc.beneficioPercentual ?? 0;
        melhorBeneficioKwh = nc.beneficioReaisKwh ?? 0;
      }
    }

    // Só promove, nunca rebaixa
    if (NIVEL_ORDEM[melhorNivel] <= NIVEL_ORDEM[progressao.nivelAtual]) {
      // Mesmo nível — atualiza data de avaliação
      await this.prisma.progressaoClube.update({
        where: { cooperadoId },
        data: { dataUltimaAvaliacao: new Date() },
      });
      return { promovido: false, nivelAnterior: progressao.nivelAtual, nivelNovo: progressao.nivelAtual };
    }

    // Promover
    const nivelAnterior = progressao.nivelAtual;
    await this.prisma.progressaoClube.update({
      where: { cooperadoId },
      data: {
        nivelAtual: melhorNivel as any,
        beneficioPercentualAtual: melhorBeneficio,
        beneficioReaisKwhAtual: melhorBeneficioKwh,
        dataUltimaPromocao: new Date(),
        dataUltimaAvaliacao: new Date(),
      },
    });

    // Registrar histórico
    await this.prisma.historicoProgressao.create({
      data: {
        progressaoId: progressao.id,
        nivelAnterior: nivelAnterior as any,
        nivelNovo: melhorNivel as any,
        kwhAcumulado: progressao.kwhIndicadoAcumulado,
        indicadosAtivos: progressao.indicadosAtivos,
        receitaAcumulada: progressao.receitaIndicados,
        motivo: `Promoção automática: ${nivelAnterior} → ${melhorNivel}`,
      },
    });

    this.logger.log(`Cooperado ${cooperadoId} promovido: ${nivelAnterior} → ${melhorNivel}`);

    // Notificar cooperado via WhatsApp sobre novo nível
    const cooperadoInfo = await this.prisma.cooperado.findUnique({
      where: { id: cooperadoId },
      select: { telefone: true },
    });
    if (cooperadoInfo?.telefone) {
      this.notificarNovoNivel(cooperadoInfo.telefone, melhorNivel).catch(() => {});
    }

    return { promovido: true, nivelAnterior, nivelNovo: melhorNivel };
  }

  async atualizarMetricas(cooperadoId: string, deltaKwh: number, deltaReceita: number) {
    // Garantir que existe progressão
    const progressao = await this.criarOuObterProgressao(cooperadoId);

    const agora = new Date();
    const mesAtual = agora.toISOString().slice(0, 7); // "2026-03"
    const anoAtual = String(agora.getFullYear());       // "2026"

    // Reset mensal/anual se mudou o período
    const resetMes = progressao.mesReferenciaKwh !== mesAtual;
    const resetAno = progressao.anoReferenciaKwh !== anoAtual;

    const updated = await this.prisma.progressaoClube.update({
      where: { cooperadoId },
      data: {
        kwhIndicadoAcumulado: { increment: deltaKwh },
        receitaIndicados: { increment: deltaReceita },
        kwhIndicadoMes: resetMes ? deltaKwh : { increment: deltaKwh },
        mesReferenciaKwh: mesAtual,
        kwhIndicadoAno: resetAno ? deltaKwh : { increment: deltaKwh },
        anoReferenciaKwh: anoAtual,
      },
    });

    // Notificar cooperado sobre pontos ganhos via WhatsApp
    if (deltaKwh > 0) {
      const cooperadoInfo = await this.prisma.cooperado.findUnique({
        where: { id: cooperadoId },
        select: { telefone: true },
      });
      if (cooperadoInfo?.telefone) {
        this.notificarPontosGanhos(cooperadoInfo.telefone, deltaKwh, updated.kwhIndicadoAcumulado).catch(() => {});
      }
    }

    return this.avaliarProgressao(cooperadoId);
  }

  async getProgressao(cooperadoId: string) {
    return this.prisma.progressaoClube.findUnique({
      where: { cooperadoId },
      include: { historico: { orderBy: { createdAt: 'desc' } } },
    });
  }

  async recalcularIndicadosAtivos(cooperadoId: string) {
    const count = await this.prisma.indicacao.count({
      where: {
        cooperadoIndicadorId: cooperadoId,
        nivel: 1,
        status: 'PRIMEIRA_FATURA_PAGA',
      },
    });

    await this.criarOuObterProgressao(cooperadoId);

    await this.prisma.progressaoClube.update({
      where: { cooperadoId },
      data: { indicadosAtivos: count },
    });

    return this.avaliarProgressao(cooperadoId);
  }

  async upsertConfig(cooperativaId: string, dto: {
    ativo: boolean;
    criterio?: string;
    niveisConfig: NivelConfig[];
    bonusAniversario?: number;
  }) {
    // CLB-02: Validar ranges individuais de cada nível
    if (dto.niveisConfig) {
      for (const nc of dto.niveisConfig) {
        // Normalizar kwhMinimo/kwhMaximo — null/undefined = 0 e null (sem teto)
        nc.kwhMinimo = nc.kwhMinimo ?? 0;
        // null significa "sem teto" (último tier) — Infinity não serializa em JSON
        if (nc.kwhMaximo === Infinity || nc.kwhMaximo === undefined) {
          nc.kwhMaximo = null as any;
        }

        if (nc.kwhMinimo < 0) {
          throw new BadRequestException(
            `Nível ${nc.nivel}: kwhMinimo deve ser >= 0 (recebido: ${nc.kwhMinimo})`,
          );
        }
        // kwhMaximo null = sem teto (último tier); se definido, deve ser > kwhMinimo
        if (nc.kwhMaximo != null && nc.kwhMaximo <= nc.kwhMinimo) {
          throw new BadRequestException(
            `Nível ${nc.nivel}: kwhMaximo (${nc.kwhMaximo}) deve ser maior que kwhMinimo (${nc.kwhMinimo})`,
          );
        }
        nc.beneficioPercentual = nc.beneficioPercentual ?? 0;
        if (nc.beneficioPercentual < 0 || nc.beneficioPercentual > 100) {
          throw new BadRequestException(
            `Nível ${nc.nivel}: beneficioPercentual deve estar entre 0 e 100 (recebido: ${nc.beneficioPercentual})`,
          );
        }
      }
    }

    // CLB-02: Validar sobreposição de ranges entre níveis (ignora Infinity no último tier)
    if (dto.niveisConfig && dto.niveisConfig.length > 1) {
      const sorted = [...dto.niveisConfig].sort((a, b) => a.kwhMinimo - b.kwhMinimo);
      for (let i = 0; i < sorted.length - 1; i++) {
        if (sorted[i].kwhMaximo != null && sorted[i].kwhMaximo! > sorted[i + 1].kwhMinimo) {
          throw new BadRequestException(
            `Sobreposição de faixas: ${sorted[i].nivel} (${sorted[i].kwhMinimo}-${sorted[i].kwhMaximo} kWh) ` +
            `sobrepõe ${sorted[i + 1].nivel} (${sorted[i + 1].kwhMinimo}-${sorted[i + 1].kwhMaximo} kWh). ` +
            `O kwhMaximo de ${sorted[i].nivel} deve ser <= kwhMinimo de ${sorted[i + 1].nivel}.`,
          );
        }
      }
    }

    return this.prisma.configClubeVantagens.upsert({
      where: { cooperativaId },
      update: {
        ativo: dto.ativo,
        criterio: (dto.criterio as any) ?? 'KWH_INDICADO_ACUMULADO',
        niveisConfig: dto.niveisConfig as any,
        bonusAniversario: dto.bonusAniversario ?? 0,
      },
      create: {
        cooperativaId,
        ativo: dto.ativo,
        criterio: (dto.criterio as any) ?? 'KWH_INDICADO_ACUMULADO',
        niveisConfig: dto.niveisConfig as any,
        bonusAniversario: dto.bonusAniversario ?? 0,
      },
    });
  }

  async getConfig(cooperativaId: string) {
    return this.prisma.configClubeVantagens.findUnique({
      where: { cooperativaId },
    });
  }

  async getRanking(cooperativaId?: string, cooperadoLogadoId?: string) {
    const where = cooperativaId ? { cooperado: { cooperativaId } } : {};
    const top10 = await this.prisma.progressaoClube.findMany({
      where,
      orderBy: { kwhIndicadoAcumulado: 'desc' },
      take: 10,
      include: {
        cooperado: { select: { id: true, nomeCompleto: true } },
      },
    });

    let posicaoLogado: number | null = null;
    let dadosLogado: any = null;

    if (cooperadoLogadoId) {
      const progressaoLogado = await this.prisma.progressaoClube.findUnique({
        where: { cooperadoId: cooperadoLogadoId },
        include: { cooperado: { select: { id: true, nomeCompleto: true } } },
      });
      if (progressaoLogado) {
        // Contar quantos estão à frente
        const aFrente = await this.prisma.progressaoClube.count({
          where: {
            ...where,
            kwhIndicadoAcumulado: { gt: progressaoLogado.kwhIndicadoAcumulado },
          },
        });
        posicaoLogado = aFrente + 1;
        dadosLogado = progressaoLogado;
      }
    }

    const maxKwh = top10.length > 0 ? top10[0].kwhIndicadoAcumulado : 1;

    return {
      top10: top10.map((p, i) => ({
        posicao: i + 1,
        cooperadoId: p.cooperado.id,
        nome: p.cooperado.nomeCompleto,
        nivelAtual: p.nivelAtual,
        kwhAcumulado: p.kwhIndicadoAcumulado,
        indicadosAtivos: p.indicadosAtivos,
        beneficioPercentual: p.beneficioPercentualAtual,
        progressoRelativo: maxKwh > 0 ? Math.round((p.kwhIndicadoAcumulado / maxKwh) * 100) : 0,
      })),
      cooperadoLogado: cooperadoLogadoId ? {
        posicao: posicaoLogado,
        ...dadosLogado ? {
          nivelAtual: dadosLogado.nivelAtual,
          kwhAcumulado: dadosLogado.kwhIndicadoAcumulado,
          indicadosAtivos: dadosLogado.indicadosAtivos,
          beneficioPercentual: dadosLogado.beneficioPercentualAtual,
          progressoRelativo: maxKwh > 0 ? Math.round((dadosLogado.kwhIndicadoAcumulado / maxKwh) * 100) : 0,
        } : {},
      } : null,
    };
  }

  async getAnalytics(cooperativaId?: string) {
    const where = cooperativaId ? { cooperado: { cooperativaId } } : {};

    const [totalMembros, aggregates, distribuicao, top10] = await Promise.all([
      this.prisma.progressaoClube.count({ where }),
      this.prisma.progressaoClube.aggregate({
        where,
        _sum: { indicadosAtivos: true, kwhIndicadoAcumulado: true, receitaIndicados: true },
      }),
      this.prisma.progressaoClube.groupBy({
        by: ['nivelAtual'],
        where,
        _count: true,
      }),
      this.prisma.progressaoClube.findMany({
        where,
        orderBy: { kwhIndicadoAcumulado: 'desc' },
        take: 10,
        include: { cooperado: { select: { id: true, nomeCompleto: true } } },
      }),
    ]);

    return {
      totalMembros,
      indicadosAtivosTotal: aggregates._sum.indicadosAtivos ?? 0,
      receitaGerada: aggregates._sum.receitaIndicados ?? 0,
      kwhIndicadoTotal: aggregates._sum.kwhIndicadoAcumulado ?? 0,
      distribuicaoPorNivel: distribuicao.map(d => ({
        nivel: d.nivelAtual,
        count: d._count,
      })),
      top10: top10.map((p, i) => ({
        posicao: i + 1,
        cooperadoId: p.cooperado.id,
        nome: p.cooperado.nomeCompleto,
        nivelAtual: p.nivelAtual,
        kwhAcumulado: p.kwhIndicadoAcumulado,
        indicadosAtivos: p.indicadosAtivos,
      })),
    };
  }

  /**
   * Ranking com filtro por período (mes / ano / total)
   */
  async getRankingPorPeriodo(
    cooperativaId?: string,
    cooperadoLogadoId?: string,
    periodo: 'mes' | 'ano' | 'total' = 'total',
  ) {
    // Para período mes/ano: filtramos pelo histórico de progressão
    // Para total: usamos kwhIndicadoAcumulado direto na progressão
    const where = cooperativaId ? { cooperado: { cooperativaId } } : {};

    if (periodo === 'total') {
      return this.getRanking(cooperativaId, cooperadoLogadoId);
    }

    const agora = new Date();
    const mesAtual = agora.toISOString().slice(0, 7);
    const anoAtual = String(agora.getFullYear());

    // Filtrar por quem tem dados no período corrente e ordenar pela métrica do período
    const isMes = periodo === 'mes';
    const campoKwh = isMes ? 'kwhIndicadoMes' : 'kwhIndicadoAno';
    const campoRef = isMes ? 'mesReferenciaKwh' : 'anoReferenciaKwh';
    const valorRef = isMes ? mesAtual : anoAtual;

    const top10 = await this.prisma.progressaoClube.findMany({
      where: {
        ...where,
        [campoRef]: valorRef,
        [campoKwh]: { gt: 0 },
      },
      orderBy: { [campoKwh]: 'desc' },
      take: 10,
      include: { cooperado: { select: { id: true, nomeCompleto: true } } },
    });

    const maxKwh = top10.length > 0 ? (top10[0] as any)[campoKwh] : 1;

    return {
      periodo,
      referencia: valorRef,
      top10: top10.map((p, i) => ({
        posicao: i + 1,
        cooperadoId: p.cooperado.id,
        nome: p.cooperado.nomeCompleto,
        nivelAtual: p.nivelAtual,
        kwhPeriodo: (p as any)[campoKwh],
        kwhAcumulado: p.kwhIndicadoAcumulado,
        indicadosAtivos: p.indicadosAtivos,
        beneficioPercentual: p.beneficioPercentualAtual,
        progressoRelativo: maxKwh > 0 ? Math.round(((p as any)[campoKwh] / maxKwh) * 100) : 0,
      })),
    };
  }

  /**
   * Evolução mensal de novos membros por nível (últimos N meses)
   */
  async getEvolucaoMensalNiveis(cooperativaId?: string, meses: number = 6) {
    const agora = new Date();
    const resultado: Array<{ mes: string; BRONZE: number; PRATA: number; OURO: number; DIAMANTE: number }> = [];

    for (let i = meses - 1; i >= 0; i--) {
      const data = new Date(agora.getFullYear(), agora.getMonth() - i, 1);
      const dataFim = new Date(agora.getFullYear(), agora.getMonth() - i + 1, 1);
      const mesLabel = data.toISOString().slice(0, 7); // YYYY-MM

      const promocoesNoMes = await this.prisma.historicoProgressao.findMany({
        where: {
          createdAt: { gte: data, lt: dataFim },
          progressao: cooperativaId ? { cooperado: { cooperativaId } } : {},
        },
        select: { nivelNovo: true },
      });

      const contagens = { BRONZE: 0, PRATA: 0, OURO: 0, DIAMANTE: 0 };
      for (const p of promocoesNoMes) {
        if (p.nivelNovo in contagens) {
          contagens[p.nivelNovo as keyof typeof contagens]++;
        }
      }

      resultado.push({ mes: mesLabel, ...contagens });
    }

    return resultado;
  }

  /**
   * Funil de conversão por etapa do processo de indicação
   */
  async getFunilConversao(cooperativaId?: string) {
    const whereCooperado: any = cooperativaId ? { cooperado: { cooperativaId } } : {};
    const whereIndicado: any = cooperativaId ? { cooperadoIndicado: { cooperativaId } } : {};

    const [
      totalIndicacoes,
      indicacoesCadastradas,
      indicacoesContratoAtivo,
      indicacoesPrimeiraFatura,
      membrosComClube,
    ] = await Promise.all([
      this.prisma.indicacao.count({ where: whereIndicado }),
      this.prisma.indicacao.count({
        where: { ...whereIndicado },
      }),
      this.prisma.indicacao.count({
        where: {
          ...whereIndicado,
          cooperadoIndicado: { contratos: { some: { status: 'ATIVO' as any } } },
        },
      }),
      this.prisma.indicacao.count({
        where: { ...whereIndicado, status: 'PRIMEIRA_FATURA_PAGA' as any },
      }),
      this.prisma.progressaoClube.count({ where: whereCooperado }),
    ]);

    const etapas = [
      { etapa: 'Indicações enviadas', valor: totalIndicacoes, percentual: 100 },
      {
        etapa: 'Cadastro concluído',
        valor: indicacoesCadastradas,
        percentual: totalIndicacoes > 0 ? Math.round((indicacoesCadastradas / totalIndicacoes) * 100) : 0,
      },
      {
        etapa: 'Contrato ativo',
        valor: indicacoesContratoAtivo,
        percentual: totalIndicacoes > 0 ? Math.round((indicacoesContratoAtivo / totalIndicacoes) * 100) : 0,
      },
      {
        etapa: '1ª fatura paga',
        valor: indicacoesPrimeiraFatura,
        percentual: totalIndicacoes > 0 ? Math.round((indicacoesPrimeiraFatura / totalIndicacoes) * 100) : 0,
      },
      {
        etapa: 'No Clube de Vantagens',
        valor: membrosComClube,
        percentual: totalIndicacoes > 0 ? Math.round((membrosComClube / totalIndicacoes) * 100) : 0,
      },
    ];

    return {
      funil: etapas,
      taxaConversaoGeral:
        totalIndicacoes > 0 ? Math.round((indicacoesPrimeiraFatura / totalIndicacoes) * 100) : 0,
    };
  }

  /**
   * Gera e envia via WhatsApp o resumo mensal do Clube de Vantagens
   * para um cooperado específico.
   */
  async gerarResumoMensalCooperado(cooperadoId: string): Promise<boolean> {
    const progressao = await this.prisma.progressaoClube.findUnique({
      where: { cooperadoId },
      include: {
        cooperado: {
          select: { id: true, nomeCompleto: true, telefone: true, cooperativaId: true, codigoIndicacao: true },
        },
      },
    });

    if (!progressao || !progressao.cooperado?.telefone) return false;

    const cooperado = progressao.cooperado;
    const mesAtual = new Date().toISOString().slice(0, 7);

    const [beneficiosMes, beneficiosTotal] = await Promise.all([
      this.prisma.beneficioIndicacao.aggregate({
        where: { cooperadoId: cooperado.id, mesReferencia: mesAtual, status: 'APLICADO' },
        _sum: { valorAplicado: true },
      }),
      this.prisma.beneficioIndicacao.aggregate({
        where: { cooperadoId: cooperado.id, status: 'APLICADO' },
        _sum: { valorAplicado: true },
      }),
    ]);

    const baseUrl = process.env.FRONTEND_URL ?? 'https://cooperebr.com.br';
    const linkIndicacao = `${baseUrl}/entrar?ref=${cooperado.codigoIndicacao ?? ''}`;

    await this.whatsappCicloVida.notificarResumoMensal(cooperado, {
      nivelAtual: progressao.nivelAtual,
      indicadosAtivos: progressao.indicadosAtivos,
      beneficioMes: Number(beneficiosMes._sum.valorAplicado ?? 0),
      beneficioTotal: Number(beneficiosTotal._sum.valorAplicado ?? 0),
      kwhAcumulado: progressao.kwhIndicadoAcumulado,
      linkIndicacao,
    });

    return true;
  }

  /**
   * Envia resumos mensais para todos os cooperados com indicados ativos.
   * Utilizado pelo ClubeVantagensJob (cron dia 1 de cada mês).
   */
  async enviarResumosMensaisLote(): Promise<{ enviados: number; erros: number; total: number }> {
    const progressoes = await this.prisma.progressaoClube.findMany({
      where: { indicadosAtivos: { gt: 0 } },
      select: { cooperadoId: true },
    });

    let enviados = 0;
    let erros = 0;

    for (const p of progressoes) {
      try {
        const ok = await this.gerarResumoMensalCooperado(p.cooperadoId);
        if (ok) enviados++;
      } catch (err) {
        this.logger.warn(`Erro ao enviar resumo para ${p.cooperadoId}: ${(err as Error).message}`);
        erros++;
      }
      // Delay anti-bloqueio WhatsApp
      await new Promise(r => setTimeout(r, 3000 + Math.random() * 2000));
    }

    return { enviados, erros, total: progressoes.length };
  }

  // ─── Notificações WhatsApp do Clube ──────────────────────────────

  /**
   * Notifica cooperado via WA quando ganha pontos (kWh acumulados).
   */
  async notificarPontosGanhos(
    telefone: string,
    pontosGanhos: number,
    totalAcumulado: number,
  ): Promise<void> {
    const texto = `Voce ganhou ${pontosGanhos} pontos no Clube CoopereBR! \u2B50 Total: ${totalAcumulado} pontos.`;
    await this.sender.enviarMensagem(telefone, texto, { tipoDisparo: 'CLUBE_VANTAGENS' }).catch((err) => {
      this.logger.warn(`Erro ao notificar pontos para ${telefone}: ${err.message}`);
    });
  }

  /**
   * Notifica cooperado via WA quando atinge novo nível.
   */
  async notificarNovoNivel(telefone: string, nivel: string): Promise<void> {
    const texto = `Parabens! Voce subiu para o nivel ${nivel} no Clube CoopereBR! \uD83C\uDF89`;
    await this.sender.enviarMensagem(telefone, texto, { tipoDisparo: 'CLUBE_VANTAGENS' }).catch((err) => {
      this.logger.warn(`Erro ao notificar nivel para ${telefone}: ${err.message}`);
    });
  }

  /**
   * Gera texto de resumo mensal de pontos para enviar junto com notificação de fatura.
   */
  async resumoMensalPontos(cooperadoId: string): Promise<string | null> {
    const progressao = await this.prisma.progressaoClube.findUnique({
      where: { cooperadoId },
    });
    if (!progressao) return null;

    const mesAtual = new Date().toISOString().slice(0, 7);
    const pontosGanhosMes = progressao.mesReferenciaKwh === mesAtual ? progressao.kwhIndicadoMes : 0;

    return [
      'Resumo do seu Clube este mes:',
      `Pontos ganhos: ${pontosGanhosMes}`,
      `Total acumulado: ${progressao.kwhIndicadoAcumulado}`,
      `Nivel atual: ${progressao.nivelAtual}`,
    ].join('\n');
  }

  // ─── Ofertas do Clube de Vantagens ──────────────────────────────

  async listarOfertas(cooperativaId: string) {
    return this.prisma.ofertaClube.findMany({
      where: {
        cooperativaId,
        ativo: true,
        OR: [
          { validadeAte: null },
          { validadeAte: { gte: new Date() } },
        ],
      },
      orderBy: { quantidadeTokens: 'asc' },
    });
  }

  async listarOfertasAdmin(cooperativaId: string) {
    return this.prisma.ofertaClube.findMany({
      where: { cooperativaId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async criarOferta(cooperativaId: string, dto: {
    titulo: string;
    descricao: string;
    quantidadeTokens: number;
    beneficio: string;
    validadeAte?: string | null;
    estoque?: number | null;
    emoji?: string;
  }) {
    if (dto.quantidadeTokens <= 0) {
      throw new BadRequestException('quantidadeTokens deve ser maior que zero');
    }

    return this.prisma.ofertaClube.create({
      data: {
        cooperativaId,
        titulo: dto.titulo,
        descricao: dto.descricao,
        quantidadeTokens: dto.quantidadeTokens,
        beneficio: dto.beneficio,
        validadeAte: dto.validadeAte ? new Date(dto.validadeAte) : null,
        estoque: dto.estoque ?? null,
        emoji: dto.emoji ?? '🎁',
      },
    });
  }

  async atualizarOferta(cooperativaId: string, ofertaId: string, dto: {
    titulo?: string;
    descricao?: string;
    quantidadeTokens?: number;
    beneficio?: string;
    ativo?: boolean;
    validadeAte?: string | null;
    estoque?: number | null;
    emoji?: string;
  }) {
    const oferta = await this.prisma.ofertaClube.findFirst({
      where: { id: ofertaId, cooperativaId },
    });
    if (!oferta) throw new NotFoundException('Oferta nao encontrada');

    return this.prisma.ofertaClube.update({
      where: { id: ofertaId },
      data: {
        ...(dto.titulo !== undefined && { titulo: dto.titulo }),
        ...(dto.descricao !== undefined && { descricao: dto.descricao }),
        ...(dto.quantidadeTokens !== undefined && { quantidadeTokens: dto.quantidadeTokens }),
        ...(dto.beneficio !== undefined && { beneficio: dto.beneficio }),
        ...(dto.ativo !== undefined && { ativo: dto.ativo }),
        ...(dto.validadeAte !== undefined && { validadeAte: dto.validadeAte ? new Date(dto.validadeAte) : null }),
        ...(dto.estoque !== undefined && { estoque: dto.estoque }),
        ...(dto.emoji !== undefined && { emoji: dto.emoji }),
      },
    });
  }

  // ─── Resgate de Ofertas ──────────────────────────────

  async resgatarOferta(cooperadoId: string, cooperativaId: string, ofertaId: string) {
    // Buscar oferta com validação tenant
    const oferta = await this.prisma.ofertaClube.findFirst({
      where: { id: ofertaId, cooperativaId, ativo: true },
    });
    if (!oferta) throw new NotFoundException('Oferta nao encontrada ou inativa');

    // Validar validade
    if (oferta.validadeAte && oferta.validadeAte < new Date()) {
      throw new BadRequestException('Oferta expirada');
    }

    // Validar estoque
    if (oferta.estoque != null && oferta.totalResgatado >= oferta.estoque) {
      throw new BadRequestException('Estoque esgotado para esta oferta');
    }

    const tokensNecessarios = oferta.quantidadeTokens;

    // Debitar tokens do cooperado
    await this.cooperTokenService.debitar({
      cooperadoId,
      cooperativaId,
      quantidade: tokensNecessarios,
      tipo: 'FLEX' as any,
      referenciaId: ofertaId,
      descricao: `Resgate Clube: ${oferta.titulo}`,
    });

    // Creditar tokens no saldo do parceiro
    await this.cooperTokenService.creditarSaldoParceiro(cooperativaId, tokensNecessarios);

    // Gerar código de resgate
    const codigoResgate = randomUUID();

    // Criar registro de resgate e incrementar totalResgatado
    const [resgate] = await this.prisma.$transaction([
      this.prisma.resgateClubeVantagens.create({
        data: {
          cooperadoId,
          ofertaId,
          cooperativaId,
          tokensUsados: tokensNecessarios,
          codigoResgate,
        },
      }),
      this.prisma.ofertaClube.update({
        where: { id: ofertaId },
        data: { totalResgatado: { increment: 1 } },
      }),
    ]);

    this.logger.log(
      `Cooperado ${cooperadoId} resgatou oferta "${oferta.titulo}" (${tokensNecessarios} tokens) - codigo: ${codigoResgate}`,
    );

    return {
      codigoResgate,
      ofertaTitulo: oferta.titulo,
      beneficio: oferta.beneficio,
      tokensUsados: tokensNecessarios,
    };
  }

  async validarResgate(cooperativaId: string, codigoResgate: string) {
    const resgate = await this.prisma.resgateClubeVantagens.findUnique({
      where: { codigoResgate },
      include: {
        cooperado: { select: { nomeCompleto: true } },
        oferta: { select: { titulo: true, beneficio: true } },
      },
    });

    if (!resgate) throw new NotFoundException('Codigo de resgate nao encontrado');
    if (resgate.cooperativaId !== cooperativaId) {
      throw new NotFoundException('Codigo de resgate nao encontrado');
    }

    if (resgate.validado) {
      return {
        jaValidado: true,
        validadoEm: resgate.validadoEm,
        cooperadoNome: resgate.cooperado.nomeCompleto,
        ofertaTitulo: resgate.oferta.titulo,
        beneficio: resgate.oferta.beneficio,
        tokensUsados: resgate.tokensUsados,
        criadoEm: resgate.createdAt,
      };
    }

    // Marcar como validado
    const atualizado = await this.prisma.resgateClubeVantagens.update({
      where: { codigoResgate },
      data: { validado: true, validadoEm: new Date() },
    });

    return {
      jaValidado: false,
      validadoEm: atualizado.validadoEm,
      cooperadoNome: resgate.cooperado.nomeCompleto,
      ofertaTitulo: resgate.oferta.titulo,
      beneficio: resgate.oferta.beneficio,
      tokensUsados: resgate.tokensUsados,
      criadoEm: resgate.createdAt,
    };
  }

  async meusResgates(cooperadoId: string) {
    return this.prisma.resgateClubeVantagens.findMany({
      where: { cooperadoId },
      include: { oferta: { select: { titulo: true, beneficio: true, emoji: true } } },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
  }
}
