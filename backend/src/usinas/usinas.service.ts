import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class UsinasService {
  constructor(private prisma: PrismaService) {}

  async findAll(distribuidora?: string, cooperativaId?: string) {
    const where: any = {};
    if (distribuidora) where.distribuidora = distribuidora;
    if (cooperativaId) where.cooperativaId = cooperativaId;
    return this.prisma.usina.findMany({
      where: Object.keys(where).length > 0 ? where : undefined,
      include: {
        proprietarioCooperado: { select: { id: true, nomeCompleto: true } },
        contratos: {
          where: { status: { in: ['ATIVO', 'APROVADO', 'PENDENTE_ATIVACAO'] } },
          select: { percentualUsina: true },
        },
      },
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

  async findOne(id: string, cooperativaId?: string) {
    const usina = await this.prisma.usina.findUnique({
      where: { id },
      include: { proprietarioCooperado: { select: { id: true, nomeCompleto: true } } },
    });
    if (!usina) throw new NotFoundException('Usina não encontrada');
    if (cooperativaId && usina.cooperativaId !== cooperativaId) {
      throw new NotFoundException('Usina não encontrada');
    }
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
    distribuidora?: string;
    cooperativaId?: string;
    proprietarioNome?: string;
    proprietarioCpfCnpj?: string;
    proprietarioTelefone?: string;
    proprietarioEmail?: string;
    proprietarioTipo?: string;
    proprietarioCooperadoId?: string;
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
    proprietarioNome: string | null;
    proprietarioCpfCnpj: string | null;
    proprietarioTelefone: string | null;
    proprietarioEmail: string | null;
    proprietarioTipo: string;
    proprietarioCooperadoId: string | null;
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

    // Proprietário
    const propFields = ['proprietarioNome', 'proprietarioCpfCnpj', 'proprietarioTelefone', 'proprietarioEmail', 'proprietarioTipo', 'proprietarioCooperadoId'] as const;
    for (const f of propFields) {
      if ((data as any)[f] !== undefined) updateData[f] = (data as any)[f];
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

  async verificarListaEspera(usinaId: string) {
    const usina = await this.prisma.usina.findUnique({ where: { id: usinaId } });
    if (!usina || !usina.capacidadeKwh) return { promovidos: [] };

    const capacidadeAnual = Number(usina.capacidadeKwh);

    // Calculate current usage
    const contratosAtivos = await this.prisma.contrato.findMany({
      where: { usinaId, status: { in: ['ATIVO', 'PENDENTE_ATIVACAO'] } },
      select: { kwhContratoAnual: true, kwhContrato: true, percentualUsina: true },
    });
    const somaPercentual = contratosAtivos.reduce((acc: number, c: any) => {
      if (c.percentualUsina) return acc + Number(c.percentualUsina);
      const anual = c.kwhContratoAnual ? Number(c.kwhContratoAnual) : Number(c.kwhContrato ?? 0) * 12;
      return acc + (capacidadeAnual > 0 ? (anual / capacidadeAnual) * 100 : 0);
    }, 0);
    const disponivel = 100 - somaPercentual;
    const kwhDisponivel = (disponivel / 100) * capacidadeAnual;

    // Check waiting list
    const espera = await this.prisma.listaEspera.findMany({
      where: { cooperativaId: usina.cooperativaId, status: { in: ['AGUARDANDO', 'PENDENTE'] } },
      include: { cooperado: { include: { ucs: { take: 1, select: { id: true } } } }, contrato: true },
      orderBy: { posicao: 'asc' },
    });

    const promovidos: string[] = [];
    let kwhRestante = kwhDisponivel;

    for (const item of espera) {
      const kwhNecessario = Number(item.kwhNecessario);
      if (kwhNecessario <= kwhRestante) {
        // Promote
        await this.prisma.listaEspera.update({
          where: { id: item.id },
          data: { status: 'PROMOVIDO' },
        });
        if (item.contratoId) {
          await this.prisma.contrato.update({
            where: { id: item.contratoId },
            data: { status: 'PENDENTE_ATIVACAO', usinaId },
          });
        } else {
          // Membro promovido sem contrato — criar contrato PENDENTE_ATIVACAO
          const ucId = item.cooperado.ucs?.[0]?.id;
          if (!ucId) continue; // Sem UC, não pode criar contrato
          const novoContrato = await this.prisma.contrato.create({
            data: {
              numero: `CTR-${Date.now()}-${item.cooperadoId.slice(-4)}`,
              cooperadoId: item.cooperadoId,
              ucId,
              usinaId,
              dataInicio: new Date(),
              percentualDesconto: 0,
              status: 'PENDENTE_ATIVACAO',
              kwhContrato: item.kwhNecessario,
              kwhContratoMensal: item.kwhNecessario,
              kwhContratoAnual: Number(item.kwhNecessario) * 12,
              cooperativaId: usina.cooperativaId,
            },
          });
          // Vincular contrato à lista de espera
          await this.prisma.listaEspera.update({
            where: { id: item.id },
            data: { contratoId: novoContrato.id },
          });
        }
        // Update cooperado status
        await this.prisma.cooperado.update({
          where: { id: item.cooperadoId },
          data: { status: 'AGUARDANDO_CONCESSIONARIA' },
        });
        // Create notification
        await this.prisma.notificacao.create({
          data: {
            tipo: 'LISTA_ESPERA_PROMOVIDO',
            titulo: 'Vaga disponível na usina',
            mensagem: `${item.cooperado.nomeCompleto} foi promovido da lista de espera para a usina ${usina.nome}.`,
            cooperadoId: item.cooperadoId,
            cooperativaId: usina.cooperativaId,
          },
        });
        promovidos.push(item.cooperado.nomeCompleto);
        kwhRestante -= kwhNecessario;
      } else {
        break; // FIFO — stop at first that doesn't fit
      }
    }

    return { promovidos, kwhDisponivel, kwhRestante };
  }

  async distribuicaoCreditos(usinaId: string) {
    const usina = await this.prisma.usina.findUnique({ where: { id: usinaId } });
    if (!usina) throw new NotFoundException('Usina não encontrada');

    const capacidadeTotal = Number(usina.capacidadeKwh ?? 0);

    const contratos = await this.prisma.contrato.findMany({
      where: { usinaId, status: { in: ['ATIVO', 'PENDENTE_ATIVACAO'] } },
      include: {
        cooperado: { select: { id: true, nomeCompleto: true, status: true, cpf: true } },
        uc: { select: { id: true, numero: true } },
      },
    });

    const cooperados = contratos.map((c) => {
      const kwhContratado = Number(c.kwhContrato ?? 0);
      const percentual = c.percentualUsina
        ? Number(c.percentualUsina)
        : capacidadeTotal > 0
          ? Math.round((kwhContratado / capacidadeTotal) * 10000) / 100
          : 0;
      return {
        cooperadoId: c.cooperado.id,
        nome: c.cooperado.nomeCompleto,
        cpf: c.cooperado.cpf,
        status: c.cooperado.status,
        ucNumero: c.uc?.numero ?? '',
        kwhContratado,
        percentual,
        contratoStatus: c.status,
      };
    });

    const totalAlocado = cooperados.reduce((acc, c) => acc + c.kwhContratado, 0);
    const saldoDisponivel = capacidadeTotal - totalAlocado;
    const percentualAlocado = capacidadeTotal > 0
      ? Math.round((totalAlocado / capacidadeTotal) * 10000) / 100
      : 0;
    const percentualDisponivel = Math.round((100 - percentualAlocado) * 100) / 100;

    // Alertas
    const alertas: { tipo: string; mensagem: string }[] = [];
    if (capacidadeTotal > 0 && saldoDisponivel > capacidadeTotal * 0.1) {
      alertas.push({
        tipo: 'SOBRA',
        mensagem: `Sobra de ${percentualDisponivel.toFixed(1)}% da capacidade (${saldoDisponivel.toFixed(0)} kWh). Considere vincular mais cooperados.`,
      });
    }
    if (saldoDisponivel < 0) {
      alertas.push({
        tipo: 'EXCESSO',
        mensagem: `Alocação excede a capacidade em ${Math.abs(saldoDisponivel).toFixed(0)} kWh. Revise os contratos.`,
      });
    }

    return {
      usina: {
        id: usina.id,
        nome: usina.nome,
        capacidadeKwh: capacidadeTotal,
        producaoMensalKwh: Number(usina.producaoMensalKwh ?? 0),
        statusHomologacao: usina.statusHomologacao,
      },
      capacidadeTotal,
      totalAlocado,
      saldoDisponivel,
      percentualAlocado,
      percentualDisponivel,
      cooperados,
      alertas,
    };
  }

  async gerarListaConcessionaria(usinaId: string) {
    const usina = await this.prisma.usina.findUnique({ where: { id: usinaId } });
    if (!usina) throw new NotFoundException('Usina não encontrada');

    const contratos = await this.prisma.contrato.findMany({
      where: { usinaId, status: { in: ['ATIVO', 'PENDENTE_ATIVACAO'] } },
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
          statusContrato: c.status,
        };
      }),
    };
  }
}
