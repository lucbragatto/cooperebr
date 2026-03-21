import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class UsinasService {
  constructor(private prisma: PrismaService) {}

  async findAll(distribuidora?: string) {
    return this.prisma.usina.findMany({
      where: distribuidora ? { distribuidora } : undefined,
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Retorna usinas da mesma distribuidora da UC informada, com capacidade disponível,
   * ordenadas por % de ocupação crescente.
   */
  async findDisponiveis(ucId: string) {
    const uc = await this.prisma.uc.findUnique({ where: { id: ucId } });
    if (!uc) throw new NotFoundException('UC não encontrada');

    const where: any = { capacidadeKwh: { not: null } };
    if (uc.distribuidora) {
      where.distribuidora = uc.distribuidora;
    }

    const usinas = await this.prisma.usina.findMany({
      where,
      include: {
        contratos: {
          where: { status: { in: ['ATIVO', 'PENDENTE_ATIVACAO'] } },
          select: { kwhContratoAnual: true, kwhContrato: true, percentualUsina: true },
        },
      },
    });

    const resultado = usinas.map((usina) => {
      const capacidade = Number(usina.capacidadeKwh);
      const somaPercentual = usina.contratos.reduce((acc, c) => {
        if (c.percentualUsina) return acc + Number(c.percentualUsina);
        const anual = c.kwhContratoAnual
          ? Number(c.kwhContratoAnual)
          : Number(c.kwhContrato ?? 0) * 12;
        return acc + (capacidade > 0 ? (anual / capacidade) * 100 : 0);
      }, 0);
      const percentualOcupado = Math.round(somaPercentual * 100) / 100;
      const percentualDisponivel = Math.round((100 - somaPercentual) * 100) / 100;

      const { contratos: _, ...usinaData } = usina;
      return {
        ...usinaData,
        percentualOcupado,
        percentualDisponivel,
      };
    });

    return resultado
      .filter((u) => u.percentualDisponivel > 0)
      .sort((a, b) => a.percentualOcupado - b.percentualOcupado);
  }

  /**
   * Validação centralizada ANEEL: UC e usina devem pertencer à mesma distribuidora.
   * Permissiva se qualquer distribuidora estiver null (dados legados).
   */
  async validarCompatibilidadeAneel(ucId: string, usinaId: string): Promise<void> {
    const uc = await this.prisma.uc.findUnique({
      where: { id: ucId },
      select: { distribuidora: true },
    });
    const usina = await this.prisma.usina.findUnique({
      where: { id: usinaId },
      select: { distribuidora: true },
    });

    if (!uc || !usina) return; // entidade não encontrada — outras validações cuidam disso
    if (!uc.distribuidora || !usina.distribuidora) return; // permissivo para dados legados

    if (uc.distribuidora !== usina.distribuidora) {
      throw new BadRequestException(
        `UC e usina pertencem a distribuidoras diferentes (${uc.distribuidora} x ${usina.distribuidora}). Regra ANEEL não permite vinculação.`,
      );
    }
  }

  async findOne(id: string) {
    const usina = await this.prisma.usina.findUnique({ where: { id } });
    if (!usina) throw new NotFoundException('Usina não encontrada');
    return usina;
  }

  async create(data: {
    nome: string;
    potenciaKwp: number;
    capacidadeKwh?: number;
    producaoMensalKwh?: number;
    cidade: string;
    estado: string;
    statusHomologacao?: string;
    observacoes?: string;
    modeloCobrancaOverride?: string | null;
  }) {
    return this.prisma.usina.create({ data: data as any });
  }

  async update(id: string, data: Partial<{
    nome: string;
    potenciaKwp: number;
    capacidadeKwh: number | null;
    producaoMensalKwh: number | null;
    cidade: string;
    estado: string;
    statusHomologacao: string;
    dataHomologacao: string;
    dataInicioProducao: string;
    observacoes: string;
    modeloCobrancaOverride: string | null;
  }>) {
    const usina = await this.prisma.usina.findUnique({ where: { id } });
    if (!usina) throw new NotFoundException('Usina não encontrada');

    // Sanitizar: aceitar somente campos válidos
    const updateData: Record<string, unknown> = {};
    if (data.nome !== undefined) updateData.nome = data.nome;
    if (data.cidade !== undefined) updateData.cidade = data.cidade;
    if (data.estado !== undefined) updateData.estado = data.estado;
    if (data.observacoes !== undefined) updateData.observacoes = data.observacoes;

    if (data.potenciaKwp !== undefined) {
      const val = Number(data.potenciaKwp);
      if (isNaN(val) || val < 0) throw new BadRequestException('Potência kWp inválida');
      updateData.potenciaKwp = val;
    }
    if (data.capacidadeKwh !== undefined) {
      if (data.capacidadeKwh === null) {
        updateData.capacidadeKwh = null;
      } else {
        const val = Number(data.capacidadeKwh);
        if (isNaN(val) || val < 0) throw new BadRequestException('Capacidade kWh inválida');
        updateData.capacidadeKwh = val;
      }
    }
    if (data.producaoMensalKwh !== undefined) {
      if (data.producaoMensalKwh === null) {
        updateData.producaoMensalKwh = null;
      } else {
        const val = Number(data.producaoMensalKwh);
        if (isNaN(val) || val < 0) throw new BadRequestException('Produção mensal kWh inválida');
        updateData.producaoMensalKwh = val;
      }
    }

    if (data.statusHomologacao !== undefined) {
      const statusValidos = ['CADASTRADA', 'AGUARDANDO_HOMOLOGACAO', 'HOMOLOGADA', 'EM_PRODUCAO', 'SUSPENSA'];
      if (!statusValidos.includes(data.statusHomologacao)) {
        throw new BadRequestException(`Status inválido. Valores aceitos: ${statusValidos.join(', ')}`);
      }
      updateData.statusHomologacao = data.statusHomologacao;

      // Auto-preencher datas ao mudar status
      if (data.statusHomologacao === 'HOMOLOGADA' && !usina.dataHomologacao) {
        updateData.dataHomologacao = new Date();
      }
      if (data.statusHomologacao === 'EM_PRODUCAO' && !usina.dataInicioProducao) {
        updateData.dataInicioProducao = new Date();
      }
    }

    if (data.dataHomologacao !== undefined) {
      updateData.dataHomologacao = new Date(data.dataHomologacao + 'T00:00:00.000Z');
    }
    if (data.dataInicioProducao !== undefined) {
      updateData.dataInicioProducao = new Date(data.dataInicioProducao + 'T00:00:00.000Z');
    }

    if (data.modeloCobrancaOverride !== undefined) {
      const modelos = ['FIXO_MENSAL', 'CREDITOS_COMPENSADOS', 'CREDITOS_DINAMICO'];
      if (data.modeloCobrancaOverride === null) {
        updateData.modeloCobrancaOverride = null;
      } else if (modelos.includes(data.modeloCobrancaOverride)) {
        updateData.modeloCobrancaOverride = data.modeloCobrancaOverride;
      } else {
        throw new BadRequestException(`Modelo de cobrança inválido. Valores aceitos: ${modelos.join(', ')} ou null`);
      }
    }

    return this.prisma.usina.update({ where: { id }, data: updateData });
  }

  async remove(id: string) {
    const contratos = await this.prisma.contrato.count({
      where: { usinaId: id, status: { in: ['ATIVO', 'PENDENTE_ATIVACAO'] } },
    });
    if (contratos > 0) {
      throw new BadRequestException(
        'Não é possível excluir usina com contratos ativos ou pendentes de ativação.',
      );
    }
    return this.prisma.usina.delete({ where: { id } });
  }

  async gerarListaConcessionaria(usinaId: string) {
    const usina = await this.prisma.usina.findUnique({ where: { id: usinaId } });
    if (!usina) throw new NotFoundException('Usina não encontrada');

    const contratos = await this.prisma.contrato.findMany({
      where: { usinaId, status: 'ATIVO' },
      include: {
        cooperado: true,
        uc: true,
      },
    });

    const capacidade = Number(usina.capacidadeKwh ?? 0);

    return {
      usina: {
        id: usina.id,
        nome: usina.nome,
        potenciaKwp: Number(usina.potenciaKwp),
        capacidadeKwh: capacidade,
        producaoMensalKwh: Number(usina.producaoMensalKwh ?? 0),
        statusHomologacao: usina.statusHomologacao,
        cidade: usina.cidade,
        estado: usina.estado,
      },
      cooperados: contratos.map((c) => {
        const kwh = Number(c.kwhContrato ?? 0);
        // Usar percentualUsina do contrato (novo) com fallback para cálculo
        const percentual = c.percentualUsina
          ? Number(c.percentualUsina)
          : (capacidade > 0 ? Math.round((kwh / capacidade) * 10000) / 100 : 0);
        return {
          nomeCompleto: c.cooperado.nomeCompleto,
          cpf: c.cooperado.cpf,
          numeroUC: c.uc?.numero ?? '',
          kwhContratado: kwh,
          percentualUsina: percentual,
          dataAdesao: c.dataInicio,
          distribuidora: (c.uc as any)?.distribuidora ?? '',
          contrato: c.numero,
        };
      }),
    };
  }
}
