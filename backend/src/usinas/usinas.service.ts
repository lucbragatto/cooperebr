import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
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
    apelidoInterno?: string;
    potenciaKwp: number;
    capacidadeKwh?: number;
    producaoMensalKwh?: number;
    cidade: string;
    estado: string;
    enderecoLogradouro?: string;
    enderecoNumero?: string;
    enderecoBairro?: string;
    enderecoCep?: string;
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
    cnpjUsina?: string;
    formaAquisicao?: 'CESSAO' | 'ALUGUEL' | 'PROPRIA';
    formaPagamentoDono?: 'FIXO' | 'PERCENTUAL';
    valorAluguelFixo?: number;
    percentualGeracaoDono?: number;
    numeroContratoEdp?: string;
    dataContratoEdp?: string | Date;
  }) {
    const prismaData: any = { ...data };
    if (prismaData.dataContratoEdp && typeof prismaData.dataContratoEdp === 'string') {
      prismaData.dataContratoEdp = new Date(prismaData.dataContratoEdp);
    }
    const usina = await this.prisma.usina.create({ data: prismaData });

    // Notificar leads de expansão quando usina entra em produção na distribuidora
    if (data.distribuidora && data.statusHomologacao === 'EM_PRODUCAO') {
      try {
        await this.prisma.leadExpansao.updateMany({
          where: {
            distribuidora: { contains: data.distribuidora, mode: 'insensitive' },
            intencaoConfirmada: true,
            status: 'AGUARDANDO',
          },
          data: {
            status: 'NOTIFICADO',
            notificadoEm: new Date(),
          },
        });
      } catch {
        // Falha silenciosa — não impede criação da usina
      }
    }

    return usina;
  }

  async update(id: string, data: Partial<{
    nome: string;
    apelidoInterno: string | null;
    potenciaKwp: number;
    capacidadeKwh: number | null;
    producaoMensalKwh: number | null;
    cidade: string;
    estado: string;
    enderecoLogradouro: string | null;
    enderecoNumero: string | null;
    enderecoBairro: string | null;
    enderecoCep: string | null;
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
    cnpjUsina: string | null;
    formaAquisicao: 'CESSAO' | 'ALUGUEL' | 'PROPRIA' | null;
    formaPagamentoDono: 'FIXO' | 'PERCENTUAL' | null;
    valorAluguelFixo: number | null;
    percentualGeracaoDono: number | null;
    numeroContratoEdp: string | null;
    dataContratoEdp: string | null;
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

    // Bloco H' (16/05/2026) — campos novos
    const blocoHLinhaFields = [
      'apelidoInterno',
      'enderecoLogradouro', 'enderecoNumero', 'enderecoBairro', 'enderecoCep',
      'cnpjUsina', 'formaAquisicao', 'formaPagamentoDono',
      'valorAluguelFixo', 'percentualGeracaoDono',
      'numeroContratoEdp',
    ] as const;
    for (const f of blocoHLinhaFields) {
      if ((data as any)[f] !== undefined) updateData[f] = (data as any)[f];
    }
    if (data.dataContratoEdp !== undefined) {
      updateData.dataContratoEdp = data.dataContratoEdp
        ? new Date(data.dataContratoEdp + 'T00:00:00.000Z')
        : null;
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

  async verificarListaEspera(usinaId: string, cooperativaId?: string | null) {
    // D-48.7: isolamento multi-tenant — caller deve ser do mesmo tenant da usina.
    // cooperativaId null = SUPER_ADMIN bypass.
    const usina = await this.prisma.usina.findUnique({ where: { id: usinaId } });
    if (!usina || !usina.capacidadeKwh) return { promovidos: [] };
    if (cooperativaId && usina.cooperativaId !== cooperativaId) {
      throw new ForbiddenException('Usina não pertence à sua cooperativa.');
    }

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
          // Membro promovido sem contrato — criar contrato PENDENTE_ATIVACAO.
          //
          // ── EXCEÇÃO #5 do mapa de criação de contrato (Fase B, Decisão B33.5) ──
          // Este caminho cria contrato SEM plano, SEM percentualDesconto e SEM
          // snapshot de tarifa (tarifaContratual fica null). É intencional:
          // promoção da fila acontece quando há vaga na usina, antes de admin
          // atribuir plano comercial. Snapshot deve ser populado no momento da
          // ATRIBUIÇÃO DO PLANO (caminho separado, ainda não implementado).
          //
          // TODO Fase futura: catalogar como débito P3 — "snapshots na atribuição
          // tardia de plano". Função `atribuirPlanoAoContrato(contratoId, planoId)`
          // deve calcular tarifa via calcularTarifaContratual + popular snapshots.
          // Hoje, contrato fica em PENDENTE_ATIVACAO até admin atribuir plano via UI.
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

  async proprietarioDashboard(cooperadoId: string) {
    if (!cooperadoId) return { usinas: [], repasses: [] };

    const usinas = await this.prisma.usina.findMany({
      where: { proprietarioCooperadoId: cooperadoId },
      include: {
        contratos: {
          where: { status: { in: ['ATIVO', 'APROVADO'] } },
          select: { kwhContrato: true, percentualUsina: true },
        },
        geracoesMensais: {
          orderBy: { competencia: 'desc' },
          take: 6,
        },
      },
    });

    const now = new Date();
    const mesAtual = now.getMonth() + 1;
    const anoAtual = now.getFullYear();

    const usinasResumo = usinas.map((u) => {
      const capacidade = Number(u.capacidadeKwh ?? u.producaoMensalKwh ?? 0);
      const kwhContratadoTotal = u.contratos.reduce((s, c) => s + Number(c.kwhContrato ?? 0), 0);
      const ocupacao = capacidade > 0 ? Math.min(100, Math.round((kwhContratadoTotal / capacidade) * 100)) : 0;

      const geracaoMesAtual = u.geracoesMensais.find(
        (g) => new Date(g.competencia).getMonth() + 1 === mesAtual && new Date(g.competencia).getFullYear() === anoAtual,
      );
      const kwhGeradoMes = geracaoMesAtual?.kwhGerado ?? 0;

      // Estimativa simples: R$ 0,50/kWh como valor médio de crédito
      const receitaPrevista = kwhGeradoMes * 0.50;

      return {
        id: u.id,
        nome: u.nome,
        potenciaKwp: Number(u.potenciaKwp),
        capacidadeKwh: capacidade,
        kwhGeradoMes,
        kwhContratadoTotal,
        ocupacao,
        receitaPrevista,
        cidade: u.cidade,
        estado: u.estado,
      };
    });

    // Histórico de repasses (últimos 6 meses baseado em gerações mensais)
    const repasses: { mes: string; kwhGerado: number; valorRepassado: number; status: string }[] = [];
    for (const u of usinas) {
      for (const g of u.geracoesMensais) {
        const comp = new Date(g.competencia);
        const mesLabel = `${String(comp.getMonth() + 1).padStart(2, '0')}/${comp.getFullYear()}`;
        const valor = g.kwhGerado * 0.50;
        const isMesAtual = comp.getMonth() + 1 === mesAtual && comp.getFullYear() === anoAtual;
        repasses.push({
          mes: mesLabel,
          kwhGerado: g.kwhGerado,
          valorRepassado: Math.round(valor * 100) / 100,
          status: isMesAtual ? 'PREVISTO' : 'PAGO',
        });
      }
    }

    repasses.sort((a, b) => b.mes.localeCompare(a.mes));

    return { usinas: usinasResumo, repasses: repasses.slice(0, 6) };
  }
}
