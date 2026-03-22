import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { StatusCooperado } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { NotificacoesService } from '../notificacoes/notificacoes.service';
import { UsinasService } from '../usinas/usinas.service';
import { FaturaMensalDto } from './dto/fatura-mensal.dto';

@Injectable()
export class CooperadosService {
  constructor(
    private prisma: PrismaService,
    private notificacoes: NotificacoesService,
    private usinasService: UsinasService,
  ) {}

  async findAll() {
    const cooperados = await this.prisma.cooperado.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        contratos: {
          where: { status: { in: ['PENDENTE_ATIVACAO', 'ATIVO', 'LISTA_ESPERA'] } },
          include: { usina: { select: { nome: true } } },
          take: 1,
          orderBy: { createdAt: 'desc' },
        },
        _count: {
          select: {
            faturasProcessadas: true,
            contratos: { where: { status: { in: ['PENDENTE_ATIVACAO', 'ATIVO', 'LISTA_ESPERA'] } } },
          },
        },
      },
    });

    // Calcular checklist resumido para cada cooperado
    const ids = cooperados.map(c => c.id);
    const [docsAprovados, propostasAceitas] = await Promise.all([
      this.prisma.documentoCooperado.groupBy({
        by: ['cooperadoId'],
        where: { cooperadoId: { in: ids }, status: 'APROVADO' },
        _count: true,
      }),
      this.prisma.propostaCooperado.groupBy({
        by: ['cooperadoId'],
        where: { cooperadoId: { in: ids }, status: 'ACEITA' },
        _count: true,
      }),
    ]);

    const docsMap = new Map(docsAprovados.map(d => [d.cooperadoId, d._count]));
    const propMap = new Map(propostasAceitas.map(p => [p.cooperadoId, p._count]));

    return cooperados.map(c => {
      const contrato = c.contratos[0] ?? null;
      const isSemUC = c.tipoCooperado === 'SEM_UC';
      const faturaOk = c._count.faturasProcessadas > 0;
      const docOk = (docsMap.get(c.id) ?? 0) > 0;
      const contratoOk = c._count.contratos > 0;
      const propostaOk = (propMap.get(c.id) ?? 0) > 0;

      const checklistTotal = isSemUC ? 2 : 4;
      const checklistFeito = isSemUC
        ? (docOk ? 1 : 0) + (c.termoAdesaoAceito ? 1 : 0)
        : (faturaOk ? 1 : 0) + (docOk ? 1 : 0) + (contratoOk ? 1 : 0) + (propostaOk ? 1 : 0);

      return {
        id: c.id,
        nomeCompleto: c.nomeCompleto,
        cpf: c.cpf,
        email: c.email,
        telefone: c.telefone,
        status: c.status,
        tipoCooperado: c.tipoCooperado,
        cotaKwhMensal: c.cotaKwhMensal,
        usinaVinculada: contrato?.usina?.nome ?? null,
        statusContrato: contrato?.status ?? null,
        kwhContrato: contrato ? Number(contrato.kwhContrato ?? 0) : null,
        checklist: `${checklistFeito}/${checklistTotal}`,
        checklistPronto: checklistFeito === checklistTotal,
        createdAt: c.createdAt,
      };
    });
  }

  async findOne(id: string) {
    const cooperado = await this.prisma.cooperado.findUnique({
      where: { id },
      include: {
        ucs: true,
        contratos: {
          include: {
            plano: true,
            uc: true,
            usina: true,
            cobrancas: { orderBy: { mesReferencia: 'desc' }, take: 12 },
          },
        },
        documentos: { orderBy: { createdAt: 'desc' } },
        ocorrencias: { orderBy: { createdAt: 'desc' }, take: 20 },
      },
    });
    if (!cooperado) throw new NotFoundException(`Cooperado com id ${id} não encontrado`);
    return cooperado;
  }

  async create(data: {
    nomeCompleto: string;
    cpf: string;
    email: string;
    telefone?: string;
    status?: StatusCooperado;
    preferenciaCobranca?: string;
    tipoCooperado?: string;
    termoAdesaoAceito?: boolean;
    termoAdesaoAceitoEm?: Date;
    tipoPessoa?: string;
    representanteLegalNome?: string;
    representanteLegalCpf?: string;
    representanteLegalCargo?: string;
  }) {
    return this.prisma.cooperado.create({ data });
  }

  async update(id: string, data: Partial<{
    nomeCompleto: string;
    email: string;
    telefone: string;
    status: StatusCooperado;
    preferenciaCobranca: string;
    tipoCooperado: string;
    termoAdesaoAceito: boolean;
    termoAdesaoAceitoEm: Date;
    dataInicioCreditos: Date;
    protocoloConcessionaria: string;
    tipoPessoa: string;
    representanteLegalNome: string;
    representanteLegalCpf: string;
    representanteLegalCargo: string;
  }>) {
    // Buscar status anterior para lógica condicional
    const anterior = await this.prisma.cooperado.findUnique({
      where: { id },
      select: { status: true },
    });

    const cooperado = await this.prisma.cooperado.update({
      where: { id },
      data,
    });

    // Ativação em cascata: ao ativar cooperado, contratos PENDENTE_ATIVACAO e SUSPENSO → ATIVO
    if (data.status === 'ATIVO') {
      // Se vindo de AGUARDANDO_CONCESSIONARIA, contratos já devem ficar ATIVO diretamente
      // (concessionária efetivou a troca), não precisa ativar contratos — eles já estão PENDENTE_ATIVACAO
      const contratosAtivados = await this.prisma.contrato.updateMany({
        where: { cooperadoId: id, status: { in: ['PENDENTE_ATIVACAO', 'SUSPENSO'] } },
        data: { status: 'ATIVO' },
      });

      if (contratosAtivados.count > 0) {
        // Calcular percentualUsina por contrato (cada contrato tem sua usina)
        const contratos = await this.prisma.contrato.findMany({
          where: { cooperadoId: id, status: 'ATIVO' },
          include: { usina: true },
        });
        for (const c of contratos) {
          if (c.usina && Number(c.usina.capacidadeKwh ?? 0) > 0 && !c.percentualUsina) {
            const percentual = (Number(c.kwhContrato ?? 0) / Number(c.usina.capacidadeKwh)) * 100;
            await this.prisma.contrato.update({
              where: { id: c.id },
              data: { percentualUsina: Math.round(percentual * 10000) / 10000 },
            });
          }
        }

        await this.notificacoes.criar({
          tipo: 'COOPERADO_ATIVADO',
          titulo: 'Cooperado ativado',
          mensagem: anterior?.status === 'AGUARDANDO_CONCESSIONARIA'
            ? `${cooperado.nomeCompleto} foi ativado (concessionária efetivou). ${contratosAtivados.count} contrato(s) ativado(s).`
            : `${cooperado.nomeCompleto} foi ativado. ${contratosAtivados.count} contrato(s) passaram para ATIVO.`,
          cooperadoId: id,
          link: `/dashboard/cooperados/${id}`,
        });
      }
    }

    // Suspensão em cascata: ao suspender cooperado, contratos ATIVO → SUSPENSO
    if (data.status === 'SUSPENSO') {
      await this.prisma.contrato.updateMany({
        where: { cooperadoId: id, status: 'ATIVO' },
        data: { status: 'SUSPENSO' },
      });
    }

    return cooperado;
  }

  async remove(id: string) {
    const contratosAtivos = await this.prisma.contrato.count({
      where: { cooperadoId: id, status: { in: ['ATIVO', 'PENDENTE_ATIVACAO'] } },
    });
    if (contratosAtivos > 0) {
      throw new BadRequestException(
        'Cooperado possui contratos ativos. Encerre os contratos antes de remover.',
      );
    }

    const cobrancasPendentes = await this.prisma.cobranca.count({
      where: { contrato: { cooperadoId: id }, status: 'PENDENTE' },
    });
    if (cobrancasPendentes > 0) {
      throw new BadRequestException(
        'Cooperado possui cobranças pendentes. Quite as cobranças antes de remover.',
      );
    }

    return this.prisma.cooperado.delete({ where: { id } });
  }

  async getChecklist(cooperadoId: string) {
    const cooperado = await this.prisma.cooperado.findUnique({
      where: { id: cooperadoId },
      select: { tipoCooperado: true, termoAdesaoAceito: true, status: true },
    });
    if (!cooperado) return null;

    if (cooperado.tipoCooperado === 'SEM_UC') {
      const docAprovado = await this.prisma.documentoCooperado.count({
        where: { cooperadoId, status: 'APROVADO' },
      });
      return {
        tipo: 'SEM_UC',
        status: cooperado.status,
        items: [
          { label: 'Documento aprovado', ok: docAprovado > 0 },
          { label: 'Termo de adesão aceito', ok: cooperado.termoAdesaoAceito },
        ],
        pronto: docAprovado > 0 && cooperado.termoAdesaoAceito,
      };
    }

    // COM_UC
    const faturaProcessada = await this.prisma.faturaProcessada.count({
      where: { cooperadoId },
    });
    const docAprovado = await this.prisma.documentoCooperado.count({
      where: { cooperadoId, status: 'APROVADO' },
    });
    const contrato = await this.prisma.contrato.count({
      where: { cooperadoId, status: { in: ['PENDENTE_ATIVACAO', 'ATIVO', 'LISTA_ESPERA'] } },
    });
    const proposta = await this.prisma.propostaCooperado.count({
      where: { cooperadoId, status: 'ACEITA' },
    });

    return {
      tipo: 'COM_UC',
      status: cooperado.status,
      items: [
        { label: 'Fatura processada', ok: faturaProcessada > 0 },
        { label: 'Documento aprovado', ok: docAprovado > 0 },
        { label: 'Contrato criado', ok: contrato > 0 },
        { label: 'Proposta aceita', ok: proposta > 0 },
      ],
      pronto: faturaProcessada > 0 && docAprovado > 0 && contrato > 0 && proposta > 0,
    };
  }

  /**
   * FASE 1 → APROVADO: docs aprovados + fatura processada
   * FASE 2 → ATIVO: tem contrato ATIVO
   */
  async checkProntoParaAtivar(cooperadoId: string) {
    const cooperado = await this.prisma.cooperado.findUnique({
      where: { id: cooperadoId },
      select: { status: true, nomeCompleto: true, tipoCooperado: true },
    });
    if (!cooperado) return;

    // FASE 2: cooperado APROVADO com contrato ATIVO → status ATIVO
    if (cooperado.status === 'APROVADO') {
      const contratoAtivo = await this.prisma.contrato.count({
        where: { cooperadoId, status: 'ATIVO' },
      });
      if (contratoAtivo > 0) {
        await this.prisma.cooperado.update({
          where: { id: cooperadoId },
          data: { status: 'ATIVO' },
        });
        await this.notificacoes.criar({
          tipo: 'COOPERADO_ATIVADO',
          titulo: 'Cooperado ativado',
          mensagem: `${cooperado.nomeCompleto} possui contrato ativo e foi ativado automaticamente.`,
          cooperadoId,
          link: `/dashboard/cooperados/${cooperadoId}`,
        });
        return;
      }
    }

    // FASE 1: cooperado PENDENTE com docs + fatura OK → status APROVADO
    if (cooperado.status === 'PENDENTE') {
      const docAprovado = await this.prisma.documentoCooperado.count({
        where: { cooperadoId, status: 'APROVADO' },
      });
      const faturaProcessada = await this.prisma.faturaProcessada.count({
        where: { cooperadoId },
      });

      const fase1Completa = cooperado.tipoCooperado === 'SEM_UC'
        ? docAprovado > 0
        : docAprovado > 0 && faturaProcessada > 0;

      if (fase1Completa) {
        await this.prisma.cooperado.update({
          where: { id: cooperadoId },
          data: { status: 'APROVADO' },
        });
        await this.notificacoes.criar({
          tipo: 'COOPERADO_APROVADO',
          titulo: 'Cooperado aprovado — aguardando usina',
          mensagem: `${cooperado.nomeCompleto} completou a documentação e está na fila de espera.`,
          cooperadoId,
          link: `/dashboard/cooperados/${cooperadoId}`,
        });
      }
    }
  }

  /** Fila de espera: cooperados APROVADO sem contrato ATIVO (FIFO por updatedAt) */
  async filaEspera() {
    const cooperados = await this.prisma.cooperado.findMany({
      where: {
        status: 'APROVADO',
        contratos: { none: { status: 'ATIVO' } },
      },
      include: {
        ucs: { select: { id: true, numero: true, distribuidora: true } },
        faturasProcessadas: {
          select: { mediaKwhCalculada: true },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { updatedAt: 'asc' },
    });

    return cooperados.map(c => ({
      id: c.id,
      nomeCompleto: c.nomeCompleto,
      email: c.email,
      telefone: c.telefone,
      uc: c.ucs[0] ?? null,
      distribuidora: c.ucs[0]?.distribuidora ?? null,
      consumoMedioMensal: c.faturasProcessadas[0]
        ? Number(c.faturasProcessadas[0].mediaKwhCalculada)
        : null,
      dataAprovacao: c.updatedAt,
    }));
  }

  /** Aloca cooperado APROVADO a uma usina, validando regra ANEEL (mesma distribuidora) e capacidade */
  async alocarUsina(cooperadoId: string, usinaId: string) {
    const cooperado = await this.prisma.cooperado.findUnique({
      where: { id: cooperadoId },
      include: {
        ucs: { select: { id: true, numero: true, distribuidora: true } },
        contratos: { where: { status: 'ATIVO' }, select: { id: true } },
        faturasProcessadas: {
          select: { mediaKwhCalculada: true },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });
    if (!cooperado) throw new NotFoundException('Cooperado não encontrado');
    if (cooperado.status !== 'APROVADO') {
      throw new BadRequestException('Cooperado precisa estar com status APROVADO para alocação');
    }
    if (cooperado.contratos.length > 0) {
      throw new BadRequestException('Cooperado já possui contrato ativo');
    }

    const uc = cooperado.ucs[0];
    if (!uc) throw new BadRequestException('Cooperado não possui UC cadastrada');

    const usina = await this.prisma.usina.findUnique({ where: { id: usinaId } });
    if (!usina) throw new NotFoundException('Usina não encontrada');

    // Regra ANEEL: mesma distribuidora (validação centralizada)
    await this.usinasService.validarCompatibilidadeAneel(uc.id, usinaId);

    // Verificar capacidade disponível
    const capacidade = Number(usina.capacidadeKwh ?? 0);
    if (capacidade <= 0) {
      throw new BadRequestException('Usina sem capacidade kWh definida');
    }

    const contratosUsina = await this.prisma.contrato.aggregate({
      where: { usinaId, status: { in: ['ATIVO', 'PENDENTE_ATIVACAO'] } },
      _sum: { kwhContratoMensal: true },
    });
    const kwhOcupado = Number(contratosUsina._sum.kwhContratoMensal ?? 0);
    const percentualOcupado = (kwhOcupado / capacidade) * 100;

    if (percentualOcupado >= 100) {
      throw new BadRequestException(
        `Usina sem capacidade disponível (${percentualOcupado.toFixed(1)}% ocupada)`,
      );
    }

    const consumoMedio = cooperado.faturasProcessadas[0]
      ? Number(cooperado.faturasProcessadas[0].mediaKwhCalculada)
      : 0;
    const kwhDisponivel = capacidade - kwhOcupado;

    return {
      cooperado: {
        id: cooperado.id,
        nomeCompleto: cooperado.nomeCompleto,
        uc: uc,
        consumoMedioMensal: consumoMedio,
      },
      usina: {
        id: usina.id,
        nome: usina.nome,
        distribuidora: usina.distribuidora,
        capacidadeKwh: capacidade,
        kwhOcupado,
        kwhDisponivel,
        percentualOcupado: Math.round(percentualOcupado * 100) / 100,
      },
      alocacaoViavel: consumoMedio <= kwhDisponivel,
      mensagem: consumoMedio <= kwhDisponivel
        ? 'Alocação viável. Gere a proposta para prosseguir.'
        : `Consumo médio (${consumoMedio} kWh) excede disponível (${kwhDisponivel.toFixed(2)} kWh). Considere outra usina.`,
    };
  }

  /** Upload mensal de fatura — cooperado já existente */
  async registrarFaturaMensal(cooperadoId: string, dto: FaturaMensalDto) {
    const cooperado = await this.prisma.cooperado.findUnique({
      where: { id: cooperadoId },
    });
    if (!cooperado) throw new NotFoundException('Cooperado não encontrado');

    const dados = dto.dadosOcr as any;
    const historicoConsumo = Array.isArray(dados.historicoConsumo)
      ? dados.historicoConsumo
      : [];
    const consumoAtualKwh = Number(dados.consumoAtualKwh ?? 0);

    // Calcular média com descarte de meses atípicos (threshold padrão 50%)
    const media = this.calcularMediaConsumo(historicoConsumo, consumoAtualKwh);

    // Verificar duplicata (mesma competência)
    const existente = await this.prisma.faturaProcessada.findFirst({
      where: {
        cooperadoId,
        dadosExtraidos: { path: ['mesReferencia'], equals: `${String(dto.mesReferencia).padStart(2, '0')}/${dto.anoReferencia}` },
      },
    });
    if (existente) {
      throw new BadRequestException(
        `Já existe fatura processada para ${String(dto.mesReferencia).padStart(2, '0')}/${dto.anoReferencia}`,
      );
    }

    const fatura = await this.prisma.faturaProcessada.create({
      data: {
        cooperadoId,
        ucId: dto.ucId ?? null,
        arquivoUrl: dto.arquivoUrl ?? null,
        dadosExtraidos: dto.dadosOcr as object,
        historicoConsumo: historicoConsumo as object,
        mesesUtilizados: media.mesesUtilizados,
        mesesDescartados: media.mesesDescartados,
        mediaKwhCalculada: media.media,
        thresholdUtilizado: 50,
        status: 'APROVADA',
      },
    });

    // Atualizar cotaKwhMensal se a nova média for diferente
    if (media.media > 0 && media.media !== Number(cooperado.cotaKwhMensal ?? 0)) {
      await this.prisma.cooperado.update({
        where: { id: cooperadoId },
        data: { cotaKwhMensal: media.media },
      });
    }

    return {
      faturaId: fatura.id,
      mesReferencia: dto.mesReferencia,
      anoReferencia: dto.anoReferencia,
      mediaKwhCalculada: media.media,
      mesesUtilizados: media.mesesUtilizados,
      mesesDescartados: media.mesesDescartados,
      cotaAtualizada: media.media > 0 && media.media !== Number(cooperado.cotaKwhMensal ?? 0),
    };
  }

  private calcularMediaConsumo(
    historico: Array<{ mesAno: string; consumoKwh: number }>,
    consumoAtualKwh: number,
  ) {
    if (historico.length === 0) {
      return { media: consumoAtualKwh, mesesUtilizados: 0, mesesDescartados: 0 };
    }
    const threshold = 50;
    const mediaGeral =
      historico.reduce((acc, m) => acc + m.consumoKwh, 0) / historico.length;
    const limiteMinimo = mediaGeral * (threshold / 100);
    const filtrados = historico.filter((m) => m.consumoKwh >= limiteMinimo);
    if (filtrados.length === 0) {
      return { media: consumoAtualKwh, mesesUtilizados: 0, mesesDescartados: historico.length };
    }
    const media = filtrados.reduce((acc, m) => acc + m.consumoKwh, 0) / filtrados.length;
    return {
      media: Math.round(media * 100) / 100,
      mesesUtilizados: filtrados.length,
      mesesDescartados: historico.length - filtrados.length,
    };
  }
}
