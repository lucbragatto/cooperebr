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
    return this.prisma.cooperado.findMany({
      orderBy: { createdAt: 'desc' },
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
    return this.prisma.cooperado.update({
      where: { id },
      data,
    });
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
      where: { cooperadoId, status: { in: ['ATIVO', 'LISTA_ESPERA'] } },
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
