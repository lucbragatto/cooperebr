import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CooperadosService } from '../cooperados/cooperados.service';

@Injectable()
export class ContratosService {
  constructor(
    private prisma: PrismaService,
    private cooperadosService: CooperadosService,
  ) {}

  async findAll() {
    return this.prisma.contrato.findMany({
      include: { cooperado: true, uc: true, usina: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    return this.prisma.contrato.findUnique({
      where: { id },
      include: { cooperado: true, uc: true, usina: true },
    });
  }

  async findByCooperado(cooperadoId: string) {
    return this.prisma.contrato.findMany({
      where: { cooperadoId },
      include: { uc: true, usina: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(data: {
    cooperadoId: string;
    ucId: string;
    usinaId?: string;
    planoId?: string;
    dataInicio: Date | string;
    dataFim?: Date | string;
    percentualDesconto: number;
    kwhContrato?: number;
    modeloCobrancaOverride?: string | null;
  }) {
    // Validar: não permitir contrato ativo/lista_espera para mesma UC
    const contratoExistente = await this.prisma.contrato.findFirst({
      where: {
        ucId: data.ucId,
        status: { in: ['PENDENTE_ATIVACAO', 'ATIVO', 'LISTA_ESPERA'] },
      },
    });
    if (contratoExistente) {
      throw new BadRequestException(
        `Já existe contrato ${contratoExistente.status === 'ATIVO' ? 'ativo' : 'em lista de espera'} (${contratoExistente.numero}) para esta unidade consumidora.`,
      );
    }

    const ano = new Date().getFullYear();
    const lastContrato = await this.prisma.contrato.findFirst({
      where: { numero: { startsWith: `CTR-${ano}-` } },
      orderBy: { numero: 'desc' },
    });
    const seq = lastContrato ? parseInt(lastContrato.numero.split('-')[2] ?? '0', 10) + 1 : 1;
    const numero = `CTR-${ano}-${String(seq).padStart(4, '0')}`;

    const dataInicio = typeof data.dataInicio === 'string'
      ? new Date(data.dataInicio + 'T00:00:00.000Z')
      : data.dataInicio;
    const dataFim = data.dataFim
      ? (typeof data.dataFim === 'string' ? new Date(data.dataFim + 'T00:00:00.000Z') : data.dataFim)
      : undefined;

    const contrato = await this.prisma.contrato.create({
      data: { ...data, numero, dataInicio, dataFim } as any,
      include: { uc: true, usina: true, plano: true, cobrancas: true },
    });

    await this.cooperadosService.checkProntoParaAtivar(data.cooperadoId);

    return contrato;
  }

  async update(id: string, data: Partial<{
    ucId: string;
    usinaId: string;
    planoId: string;
    dataInicio: Date;
    dataFim: Date;
    percentualDesconto: number;
    kwhContrato: number;
    status: 'ATIVO' | 'SUSPENSO' | 'ENCERRADO' | 'LISTA_ESPERA';
    modeloCobrancaOverride: string | null;
  }>) {
    if (data.modeloCobrancaOverride !== undefined) {
      const modelos = ['FIXO_MENSAL', 'CREDITOS_COMPENSADOS', 'CREDITOS_DINAMICO'];
      if (data.modeloCobrancaOverride !== null && !modelos.includes(data.modeloCobrancaOverride)) {
        throw new BadRequestException(`Modelo de cobrança inválido. Valores aceitos: ${modelos.join(', ')} ou null`);
      }
    }
    return this.prisma.contrato.update({ where: { id }, data: data as any });
  }

  async remove(id: string) {
    const cobrancas = await this.prisma.cobranca.count({ where: { contratoId: id } });
    if (cobrancas > 0) {
      throw new BadRequestException(
        `Não é possível excluir este contrato: existem ${cobrancas} cobrança(s) vinculada(s). Encerre o contrato ou exclua as cobranças primeiro.`,
      );
    }
    return this.prisma.contrato.delete({ where: { id } });
  }
}
