import { Injectable, NotFoundException, BadRequestException, Logger, Inject, forwardRef } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma.service';
import { CooperTokenTipo } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { ClubeVantagensService } from '../clube-vantagens/clube-vantagens.service';
import { WhatsappCicloVidaService } from '../whatsapp/whatsapp-ciclo-vida.service';
import { ConviteIndicacaoService } from '../convite-indicacao/convite-indicacao.service';
import { CooperTokenService } from '../cooper-token/cooper-token.service';

@Injectable()
export class IndicacoesService {
  private readonly logger = new Logger(IndicacoesService.name);
  constructor(
    private prisma: PrismaService,
    private clubeVantagensService: ClubeVantagensService,
    @Inject(forwardRef(() => WhatsappCicloVidaService)) private whatsappCicloVida: WhatsappCicloVidaService,
    @Inject(forwardRef(() => ConviteIndicacaoService)) private conviteIndicacao: ConviteIndicacaoService,
    private cooperTokenService: CooperTokenService,
  ) {}

  @OnEvent('cobranca.primeira.paga')
  async handlePrimeiraFaturaPaga(payload: { cooperadoId: string; valorFatura: number }) {
    try {
      await this.processarPrimeiraFaturaPaga(payload.cooperadoId, payload.valorFatura);
    } catch (err) {
      this.logger.warn(`Falha ao processar primeira fatura paga via evento: ${err.message}`);
    }
  }

  // ─── Config ──────────────────────────────────────────────────────────────────

  async getConfig(cooperativaId: string) {
    if (!cooperativaId) return null;
    return this.prisma.configIndicacao.findUnique({
      where: { cooperativaId },
    });
  }

  async upsertConfig(cooperativaId: string, dto: {
    ativo: boolean;
    maxNiveis: number;
    modalidade: string;
    niveisConfig: { nivel: number; percentual: number; reaisKwh: number }[];
  }) {
    // Validar teto de percentual em cada nível
    for (const nivel of dto.niveisConfig) {
      if (nivel.percentual < 0 || nivel.percentual > 100) {
        throw new BadRequestException(`Percentual do nível ${nivel.nivel} deve estar entre 0 e 100`);
      }
      if (nivel.reaisKwh < 0) {
        throw new BadRequestException(`Valor R$/kWh do nível ${nivel.nivel} não pode ser negativo`);
      }
    }
    return this.prisma.configIndicacao.upsert({
      where: { cooperativaId },
      update: {
        ativo: dto.ativo,
        maxNiveis: dto.maxNiveis,
        modalidade: dto.modalidade,
        niveisConfig: dto.niveisConfig as any,
      },
      create: {
        cooperativaId,
        ativo: dto.ativo,
        maxNiveis: dto.maxNiveis,
        modalidade: dto.modalidade,
        niveisConfig: dto.niveisConfig as any,
      },
    });
  }

  // ─── Código de indicação ─────────────────────────────────────────────────────

  async getMeuCodigo(cooperadoId: string) {
    const cooperado = await this.prisma.cooperado.findUnique({
      where: { id: cooperadoId },
      select: { codigoIndicacao: true, nomeCompleto: true },
    });
    if (!cooperado) throw new NotFoundException('Cooperado não encontrado');
    return {
      codigo: cooperado.codigoIndicacao,
      link: `${process.env.FRONTEND_URL ?? 'https://cooperebr.com.br'}/cadastro?ref=${cooperado.codigoIndicacao}`,
    };
  }

  // ─── Meu Link (com contadores) ──────────────────────────────────────────────

  async getMeuLink(cooperadoId: string) {
    const cooperado = await this.prisma.cooperado.findUnique({
      where: { id: cooperadoId },
      select: { codigoIndicacao: true, nomeCompleto: true, id: true },
    });
    if (!cooperado) throw new NotFoundException('Cooperado não encontrado');

    // Garantir que tem código (gerar se não tiver)
    let codigo = cooperado.codigoIndicacao;
    if (!codigo) {
      codigo = this.gerarCodigo();
      await this.prisma.cooperado.update({
        where: { id: cooperadoId },
        data: { codigoIndicacao: codigo },
      });
    }

    const baseUrl = process.env.FRONTEND_URL ?? 'https://cooperebr.com.br';
    const link = `${baseUrl}/cadastro?ref=${codigo}`;

    const [totalIndicados, indicadosAtivos] = await Promise.all([
      this.prisma.indicacao.count({
        where: { cooperadoIndicadorId: cooperadoId, nivel: 1 },
      }),
      this.prisma.indicacao.count({
        where: { cooperadoIndicadorId: cooperadoId, nivel: 1, status: 'PRIMEIRA_FATURA_PAGA' },
      }),
    ]);

    return { codigoIndicacao: codigo, link, totalIndicados, indicadosAtivos };
  }

  private gerarCodigo(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  // ─── Registrar Indicação ─────────────────────────────────────────────────────

  async registrarIndicacao(cooperadoIndicadoId: string, codigoIndicador: string) {
    // Buscar indicador pelo código
    const indicador = await this.prisma.cooperado.findUnique({
      where: { codigoIndicacao: codigoIndicador },
    });
    if (!indicador) throw new NotFoundException('Código de indicação inválido');

    const indicado = await this.prisma.cooperado.findUnique({
      where: { id: cooperadoIndicadoId },
    });
    if (!indicado) throw new NotFoundException('Cooperado indicado não encontrado');

    if (indicador.id === cooperadoIndicadoId) {
      throw new BadRequestException('Não é possível se auto-indicar');
    }

    // Verificar se já existe indicação para este indicado
    const existente = await this.prisma.indicacao.findFirst({
      where: { cooperadoIndicadoId, nivel: 1 },
    });
    if (existente) throw new BadRequestException('Este membro já possui uma indicação registrada');

    const cooperativaId = indicador.cooperativaId || indicado.cooperativaId;
    if (!cooperativaId) throw new BadRequestException('Cooperativa não encontrada');

    // Buscar config
    const config = await this.prisma.configIndicacao.findUnique({
      where: { cooperativaId },
    });
    if (!config || !config.ativo) {
      throw new BadRequestException('Programa de indicações não está ativo');
    }

    // Marcar quem indicou o novo cooperado
    await this.prisma.cooperado.update({
      where: { id: cooperadoIndicadoId },
      data: { cooperadoIndicadorId: indicador.id },
    });

    const indicacoes: any[] = [];

    // Nível 1: indicador direto — verificar duplicação
    const jaExisteNivel1 = await this.prisma.indicacao.findFirst({
      where: { cooperadoIndicadorId: indicador.id, cooperadoIndicadoId, nivel: 1 },
    });
    if (jaExisteNivel1) {
      this.logger.warn(`Indicação nível 1 já existe para ${cooperadoIndicadoId} → ${indicador.id}`);
      return [jaExisteNivel1];
    }

    indicacoes.push(
      await this.prisma.indicacao.create({
        data: {
          cooperativaId,
          cooperadoIndicadorId: indicador.id,
          cooperadoIndicadoId,
          nivel: 1,
          status: 'PENDENTE',
        },
      }),
    );

    // Subir na cadeia para níveis superiores (com detecção de ciclo)
    let currentIndicadorId = indicador.cooperadoIndicadorId;
    let nivel = 2;
    const visitados = new Set<string>([cooperadoIndicadoId, indicador.id]);

    while (currentIndicadorId && nivel <= config.maxNiveis) {
      if (visitados.has(currentIndicadorId)) {
        this.logger.warn(`Referência circular detectada no MLM: ${currentIndicadorId} já visitado`);
        break;
      }
      visitados.add(currentIndicadorId);

      const ancestral = await this.prisma.cooperado.findUnique({
        where: { id: currentIndicadorId },
        select: { id: true, cooperadoIndicadorId: true },
      });
      if (!ancestral) break;

      // Verificar duplicação antes de criar cada nível
      const jaExiste = await this.prisma.indicacao.findFirst({
        where: { cooperadoIndicadorId: ancestral.id, cooperadoIndicadoId, nivel },
      });
      if (!jaExiste) {
        indicacoes.push(
          await this.prisma.indicacao.create({
            data: {
              cooperativaId,
              cooperadoIndicadorId: ancestral.id,
              cooperadoIndicadoId,
              nivel,
              status: 'PENDENTE',
            },
          }),
        );
      } else {
        indicacoes.push(jaExiste);
      }

      currentIndicadorId = ancestral.cooperadoIndicadorId;
      nivel++;
    }

    // Clube de Vantagens: criar progressão para o indicador e recalcular indicados
    try {
      await this.clubeVantagensService.criarOuObterProgressao(indicador.id);
      await this.clubeVantagensService.recalcularIndicadosAtivos(indicador.id);
    } catch (err) {
      this.logger.warn(`Falha ao inicializar Clube de Vantagens para indicador: ${err.message}`);
    }

    // Notificar indicador que indicado se cadastrou
    this.whatsappCicloVida.notificarIndicadoCadastrou(indicador, indicado.nomeCompleto).catch(() => {});

    return indicacoes;
  }

  // ─── Processar Primeira Fatura Paga ──────────────────────────────────────────

  async processarPrimeiraFaturaPaga(cooperadoId: string, valorFatura: number) {
    const indicacoes = await this.prisma.indicacao.findMany({
      where: { cooperadoIndicadoId: cooperadoId, status: 'PENDENTE' },
      include: { cooperadoIndicador: true },
    });

    if (indicacoes.length === 0) return [];

    const cooperativaId = indicacoes[0].cooperativaId;
    const config = await this.prisma.configIndicacao.findUnique({
      where: { cooperativaId },
    });
    if (!config) return [];

    const niveisConfig = config.niveisConfig as any[];
    const mesRef = new Date().toISOString().slice(0, 7); // '2026-03'
    const beneficiosCriados: any[] = [];

    for (const indicacao of indicacoes) {
      // Marcar como paga
      await this.prisma.indicacao.update({
        where: { id: indicacao.id },
        data: { status: 'PRIMEIRA_FATURA_PAGA', primeiraFaturaPagaEm: new Date() },
      });

      const nivelConfig = niveisConfig.find((n: any) => n.nivel === indicacao.nivel);
      if (!nivelConfig) continue;

      // PERCENTUAL_PRIMEIRA_FATURA ou AMBOS
      if (config.modalidade === 'PERCENTUAL_PRIMEIRA_FATURA' || config.modalidade === 'AMBOS') {
        const percentual = Math.min(nivelConfig.percentual || 0, 100);
        if (percentual > 0) {
          const valorCalc = new Decimal(valorFatura).mul(percentual).div(100).toDecimalPlaces(2);
          beneficiosCriados.push(
            await this.prisma.beneficioIndicacao.create({
              data: {
                indicacaoId: indicacao.id,
                cooperadoId: indicacao.cooperadoIndicadorId,
                tipo: 'PERCENTUAL_FATURA',
                valorCalculado: valorCalc,
                saldoRestante: valorCalc,
                mesReferencia: mesRef,
                status: 'PENDENTE',
              },
            }),
          );
        }
      }

      // REAIS_KWH_RECORRENTE ou AMBOS
      if (config.modalidade === 'REAIS_KWH_RECORRENTE' || config.modalidade === 'AMBOS') {
        const reaisKwh = nivelConfig.reaisKwh || 0;
        if (reaisKwh > 0) {
          // Buscar kWh do contrato do cooperado indicado para multiplicar pela taxa R$/kWh
          const contratoIndicado = await this.prisma.contrato.findFirst({
            where: { cooperadoId: indicacao.cooperadoIndicadoId, status: 'ATIVO' },
            select: { kwhContrato: true },
          });
          const kwhCooperado = Number(contratoIndicado?.kwhContrato ?? 0);
          const valorKwh = new Decimal(reaisKwh).mul(kwhCooperado).toDecimalPlaces(2);
          beneficiosCriados.push(
            await this.prisma.beneficioIndicacao.create({
              data: {
                indicacaoId: indicacao.id,
                cooperadoId: indicacao.cooperadoIndicadorId,
                tipo: 'REAIS_KWH',
                valorCalculado: valorKwh,
                saldoRestante: valorKwh,
                mesReferencia: mesRef,
                status: 'PENDENTE',
              },
            }),
          );
        }
      }
    }

    // CooperToken: creditar bônus de indicação ao indicador (uma vez por indicação)
    for (const indicacao of indicacoes) {
      try {
        // Verificar se já creditou tokens para esta indicação (idempotência)
        const jaCredidato = await this.prisma.cooperTokenLedger.findFirst({
          where: { referenciaId: indicacao.id, referenciaTabela: 'Indicacao' },
        });
        if (jaCredidato) {
          this.logger.log(`Token BONUS_INDICACAO já creditado para indicação ${indicacao.id}, pulando.`);
          continue;
        }

        // Buscar bonusIndicacao da config ou usar default 50
        const configToken = await this.prisma.configCooperToken.findUnique({
          where: { cooperativaId },
        });
        const bonusQtd = (configToken as any)?.bonusIndicacao ?? 50;

        await this.cooperTokenService.creditar({
          cooperadoId: indicacao.cooperadoIndicadorId,
          cooperativaId,
          tipo: CooperTokenTipo.BONUS_INDICACAO,
          quantidade: bonusQtd,
          referenciaId: indicacao.id,
          referenciaTabela: 'Indicacao',
        });
        this.logger.log(`Token BONUS_INDICACAO: ${bonusQtd} tokens creditados ao indicador ${indicacao.cooperadoIndicadorId} (indicação ${indicacao.id})`);
      } catch (err) {
        this.logger.warn(`Falha ao creditar token de indicação ${indicacao.id}: ${err.message}`);
      }
    }

    // ConviteIndicacao: marcar como CONVERTIDO
    for (const indicacao of indicacoes) {
      try {
        await this.conviteIndicacao.marcarConvertido(indicacao.id);
      } catch (err) {
        this.logger.warn(`Falha ao marcar convite convertido: ${err.message}`);
      }
    }

    // Clube de Vantagens: recalcular indicados ativos para cada indicador
    const indicadoresUnicos = [...new Set(indicacoes.map(i => i.cooperadoIndicadorId))];
    for (const indicadorId of indicadoresUnicos) {
      try {
        await this.clubeVantagensService.recalcularIndicadosAtivos(indicadorId);
      } catch (err) {
        this.logger.warn(`Falha ao recalcular indicados ativos no Clube: ${err.message}`);
      }
    }

    return beneficiosCriados;
  }

  // ─── Aplicar Benefícios no Fechamento ────────────────────────────────────────

  async aplicarBeneficiosNoFechamento(
    cooperadoId: string,
    mesReferencia: string,
    valorFatura: number,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const beneficios = await tx.beneficioIndicacao.findMany({
        where: {
          cooperadoId,
          status: { in: ['PENDENTE', 'PARCIAL'] },
        },
        orderBy: { createdAt: 'asc' },
      });

      let saldoDisponivel = new Decimal(valorFatura);
      let totalDesconto = new Decimal(0);

      for (const beneficio of beneficios) {
        if (saldoDisponivel.lte(0)) break;

        const saldo = new Decimal(beneficio.saldoRestante.toString());
        const aplicar = Decimal.min(saldo, saldoDisponivel);

        const novoSaldo = saldo.minus(aplicar);
        const novoAplicado = new Decimal(beneficio.valorAplicado?.toString() || '0').plus(aplicar);

        await tx.beneficioIndicacao.update({
          where: { id: beneficio.id },
          data: {
            valorAplicado: new Decimal(novoAplicado.toFixed(2)),
            saldoRestante: new Decimal(novoSaldo.toFixed(2)),
            status: novoSaldo.lte(0) ? 'APLICADO' : 'PARCIAL',
            mesReferencia,
          },
        });

        saldoDisponivel = saldoDisponivel.minus(aplicar);
        totalDesconto = totalDesconto.plus(aplicar);
      }

      return { totalDesconto: Number(totalDesconto.toFixed(2)), beneficiosProcessados: beneficios.length };
    });
  }

  // ─── Listagens ───────────────────────────────────────────────────────────────

  async findAll(cooperativaId?: string) {
    return this.prisma.indicacao.findMany({
      where: cooperativaId ? { cooperativaId } : undefined,
      include: {
        cooperadoIndicador: { select: { id: true, nomeCompleto: true, email: true } },
        cooperadoIndicado: { select: { id: true, nomeCompleto: true, email: true } },
        beneficios: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getArvore(cooperativaId: string) {
    if (!cooperativaId) return [];
    const indicacoes = await this.prisma.indicacao.findMany({
      where: { cooperativaId },
      include: {
        cooperadoIndicador: { select: { id: true, nomeCompleto: true, codigoIndicacao: true } },
        cooperadoIndicado: { select: { id: true, nomeCompleto: true, status: true } },
        beneficios: {
          select: { tipo: true, valorCalculado: true, valorAplicado: true, status: true },
        },
      },
      orderBy: [{ nivel: 'asc' }, { createdAt: 'desc' }],
    });

    // Agrupar por indicador
    const arvore: Record<string, any> = {};
    for (const ind of indicacoes) {
      const key = ind.cooperadoIndicadorId;
      if (!arvore[key]) {
        arvore[key] = {
          indicador: ind.cooperadoIndicador,
          indicados: [],
        };
      }
      arvore[key].indicados.push({
        indicado: ind.cooperadoIndicado,
        nivel: ind.nivel,
        status: ind.status,
        primeiraFaturaPagaEm: ind.primeiraFaturaPagaEm,
        beneficios: ind.beneficios,
      });
    }

    return Object.values(arvore);
  }

  async getMinhasIndicacoes(cooperadoId: string) {
    return this.prisma.indicacao.findMany({
      where: { cooperadoIndicadorId: cooperadoId, nivel: 1 },
      include: {
        cooperadoIndicado: { select: { nomeCompleto: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getBeneficios(cooperadoId: string) {
    return this.prisma.beneficioIndicacao.findMany({
      where: { cooperadoId },
      include: {
        indicacao: {
          include: {
            cooperadoIndicado: { select: { nomeCompleto: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getRelatorio(cooperativaId: string) {
    if (!cooperativaId) return { indicacoes: [], beneficios: [], resumo: {} };
    const [indicacoes, beneficios] = await Promise.all([
      this.prisma.indicacao.findMany({
        where: { cooperativaId },
        include: {
          cooperadoIndicador: { select: { nomeCompleto: true } },
          cooperadoIndicado: { select: { nomeCompleto: true } },
        },
      }),
      this.prisma.beneficioIndicacao.findMany({
        where: {
          cooperado: { cooperativaId },
        },
        include: {
          cooperado: { select: { nomeCompleto: true } },
          indicacao: {
            select: {
              cooperadoIndicado: { select: { nomeCompleto: true } },
              nivel: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const totalPago = beneficios
      .filter((b) => b.status === 'APLICADO')
      .reduce((sum, b) => sum + Number(b.valorAplicado), 0);

    const totalPendente = beneficios
      .filter((b) => b.status === 'PENDENTE' || b.status === 'PARCIAL')
      .reduce((sum, b) => sum + Number(b.saldoRestante), 0);

    return {
      totalIndicacoes: indicacoes.length,
      indicacoesAtivas: indicacoes.filter((i) => i.status === 'PRIMEIRA_FATURA_PAGA').length,
      indicacoesPendentes: indicacoes.filter((i) => i.status === 'PENDENTE').length,
      totalBeneficiosPago: totalPago,
      totalBeneficiosPendente: totalPendente,
      beneficios,
    };
  }
}
