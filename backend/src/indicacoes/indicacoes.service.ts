import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class IndicacoesService {
  constructor(private prisma: PrismaService) {}

  // ─── Config ──────────────────────────────────────────────────────────────────

  async getConfig(cooperativaId: string) {
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
      link: `https://app.cooperebr.com.br/indicar?ref=${cooperado.codigoIndicacao}`,
    };
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

    // Nível 1: indicador direto
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

    // Subir na cadeia para níveis superiores
    let currentIndicadorId = indicador.cooperadoIndicadorId;
    let nivel = 2;

    while (currentIndicadorId && nivel <= config.maxNiveis) {
      const ancestral = await this.prisma.cooperado.findUnique({
        where: { id: currentIndicadorId },
        select: { id: true, cooperadoIndicadorId: true },
      });
      if (!ancestral) break;

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

      currentIndicadorId = ancestral.cooperadoIndicadorId;
      nivel++;
    }

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
        const percentual = nivelConfig.percentual || 0;
        if (percentual > 0) {
          const valorCalc = (valorFatura * percentual) / 100;
          beneficiosCriados.push(
            await this.prisma.beneficioIndicacao.create({
              data: {
                indicacaoId: indicacao.id,
                cooperadoId: indicacao.cooperadoIndicadorId,
                tipo: 'PERCENTUAL_FATURA',
                valorCalculado: new Decimal(valorCalc.toFixed(2)),
                saldoRestante: new Decimal(valorCalc.toFixed(2)),
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
          beneficiosCriados.push(
            await this.prisma.beneficioIndicacao.create({
              data: {
                indicacaoId: indicacao.id,
                cooperadoId: indicacao.cooperadoIndicadorId,
                tipo: 'REAIS_KWH',
                valorCalculado: new Decimal(reaisKwh.toFixed(2)),
                saldoRestante: new Decimal(reaisKwh.toFixed(2)),
                mesReferencia: mesRef,
                status: 'PENDENTE',
              },
            }),
          );
        }
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
    const beneficios = await this.prisma.beneficioIndicacao.findMany({
      where: {
        cooperadoId,
        status: { in: ['PENDENTE', 'PARCIAL'] },
      },
      orderBy: { createdAt: 'asc' },
    });

    let saldoDisponivel = valorFatura;
    let totalDesconto = 0;

    for (const beneficio of beneficios) {
      if (saldoDisponivel <= 0) break;

      const saldo = Number(beneficio.saldoRestante);
      const aplicar = Math.min(saldo, saldoDisponivel);

      const novoSaldo = saldo - aplicar;
      const novoAplicado = Number(beneficio.valorAplicado) + aplicar;

      await this.prisma.beneficioIndicacao.update({
        where: { id: beneficio.id },
        data: {
          valorAplicado: new Decimal(novoAplicado.toFixed(2)),
          saldoRestante: new Decimal(novoSaldo.toFixed(2)),
          status: novoSaldo <= 0 ? 'APLICADO' : 'PARCIAL',
          mesReferencia,
        },
      });

      saldoDisponivel -= aplicar;
      totalDesconto += aplicar;
    }

    return { totalDesconto, beneficiosProcessados: beneficios.length };
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
          indicacao: { cooperativaId },
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
