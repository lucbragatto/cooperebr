import { Injectable } from '@nestjs/common';
import { StatusCooperado } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { NotificacoesService } from '../notificacoes/notificacoes.service';

@Injectable()
export class CooperadosService {
  constructor(
    private prisma: PrismaService,
    private notificacoes: NotificacoesService,
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
    return this.prisma.cooperado.findUnique({
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
  }

  async create(data: {
    nomeCompleto: string;
    cpf: string;
    email: string;
    telefone?: string;
    preferenciaCobranca?: string;
    tipoCooperado?: string;
    termoAdesaoAceito?: boolean;
    termoAdesaoAceitoEm?: Date;
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
  }>) {
    const cooperado = await this.prisma.cooperado.update({
      where: { id },
      data,
    });

    // Ativação em cascata: ao ativar cooperado, contratos PENDENTE_ATIVACAO → ATIVO
    if (data.status === 'ATIVO') {
      const contratosAtivados = await this.prisma.contrato.updateMany({
        where: { cooperadoId: id, status: 'PENDENTE_ATIVACAO' },
        data: { status: 'ATIVO' },
      });

      if (contratosAtivados.count > 0) {
        // Calcular percentualUsina: soma de kwhContrato de TODOS os contratos ativos / capacidade da usina
        const contratos = await this.prisma.contrato.findMany({
          where: { cooperadoId: id, status: 'ATIVO' },
          include: { usina: true },
        });
        const totalKwh = contratos.reduce((acc, c) => acc + Number(c.kwhContrato ?? 0), 0);
        const usina = contratos.find(c => c.usina && Number(c.usina.capacidadeKwh ?? 0) > 0)?.usina;
        if (usina && Number(usina.capacidadeKwh ?? 0) > 0) {
          const percentual = (totalKwh / Number(usina.capacidadeKwh)) * 100;
          await this.prisma.cooperado.update({
            where: { id },
            data: { percentualUsina: Math.round(percentual * 10000) / 10000 },
          });
        }

        await this.notificacoes.criar({
          tipo: 'COOPERADO_ATIVADO',
          titulo: 'Cooperado ativado',
          mensagem: `${cooperado.nomeCompleto} foi ativado. ${contratosAtivados.count} contrato(s) passaram para ATIVO.`,
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
    return this.prisma.cooperado.delete({
      where: { id },
    });
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

  async checkProntoParaAtivar(cooperadoId: string) {
    const checklist = await this.getChecklist(cooperadoId);
    if (!checklist || !checklist.pronto || checklist.status !== 'PENDENTE') return;

    const cooperado = await this.prisma.cooperado.findUnique({
      where: { id: cooperadoId },
      select: { nomeCompleto: true },
    });

    await this.notificacoes.criar({
      tipo: 'COOPERADO_PRONTO',
      titulo: 'Cooperado pronto para ativação',
      mensagem: `${cooperado?.nomeCompleto} completou todos os requisitos. Clique para ativar.`,
      cooperadoId,
      link: `/dashboard/cooperados/${cooperadoId}`,
    });
  }
}
