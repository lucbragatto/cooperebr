import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class ContratosUsoService {
  private readonly logger = new Logger(ContratosUsoService.name);

  constructor(private prisma: PrismaService) {}

  async findAll(cooperativaId?: string) {
    return this.prisma.contratoUso.findMany({
      where: cooperativaId ? { cooperativaId } : undefined,
      include: {
        cooperado: { select: { id: true, nomeCompleto: true, cpf: true } },
        usina: { select: { id: true, nome: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const contrato = await this.prisma.contratoUso.findUnique({
      where: { id },
      include: {
        cooperado: { select: { id: true, nomeCompleto: true, cpf: true } },
        usina: { select: { id: true, nome: true } },
        lancamentos: { orderBy: { competencia: 'desc' }, take: 12 },
      },
    });
    if (!contrato) throw new NotFoundException(`Contrato de uso com id ${id} não encontrado`);
    return contrato;
  }

  private async gerarNumero(tx?: any): Promise<string> {
    const db = tx ?? this.prisma;
    const ano = new Date().getFullYear();
    const ultimo = await db.contratoUso.findFirst({
      where: { numero: { startsWith: `CU-${ano}-` } },
      orderBy: { createdAt: 'desc' },
    });
    const seq = ultimo
      ? parseInt(ultimo.numero.split('-')[2] ?? '0', 10) + 1
      : 1;
    return `CU-${ano}-${String(seq).padStart(4, '0')}`;
  }

  async create(data: {
    cooperadoId: string;
    tipoAtivo: string;
    descricaoAtivo: string;
    usinaId?: string;
    tipoContrato: string;
    valorFixoMensal?: number;
    valorPorUnidade?: number;
    percentualRepasse?: number;
    unidadeMedida?: string;
    diaVencimento?: number;
    dataInicio: Date | string;
    dataFim?: Date | string;
    observacoes?: string;
    cooperativaId?: string;
  }) {
    const numero = await this.gerarNumero();
    const dataInicio = new Date(data.dataInicio);
    const dataFim = data.dataFim ? new Date(data.dataFim) : undefined;

    const contrato = await this.prisma.contratoUso.create({
      data: {
        ...data,
        numero,
        dataInicio,
        dataFim,
      } as any,
      include: {
        cooperado: { select: { id: true, nomeCompleto: true } },
        usina: { select: { id: true, nome: true } },
      },
    });

    // Gerar lançamento automático para o primeiro mês se valor fixo definido
    if (data.valorFixoMensal && data.valorFixoMensal > 0) {
      await this.gerarLancamentoMensal(contrato.id, dataInicio);
    }

    return contrato;
  }

  async update(id: string, data: Partial<{
    tipoAtivo: string;
    descricaoAtivo: string;
    usinaId: string;
    tipoContrato: string;
    valorFixoMensal: number;
    valorPorUnidade: number;
    percentualRepasse: number;
    unidadeMedida: string;
    diaVencimento: number;
    dataFim: Date | string;
    status: string;
    observacoes: string;
  }>) {
    await this.findOne(id);
    const updateData: any = { ...data };
    if (data.dataFim) updateData.dataFim = new Date(data.dataFim);
    return this.prisma.contratoUso.update({
      where: { id },
      data: updateData,
      include: {
        cooperado: { select: { id: true, nomeCompleto: true } },
        usina: { select: { id: true, nome: true } },
      },
    });
  }

  /** Gera lançamento de despesa (pagamento ao cooperado) para uma competência */
  async gerarLancamentoMensal(contratoUsoId: string, referencia: Date) {
    const contrato = await this.prisma.contratoUso.findUnique({
      where: { id: contratoUsoId },
      include: { cooperado: { select: { nomeCompleto: true } } },
    });
    if (!contrato) throw new NotFoundException('Contrato de uso não encontrado');
    if (contrato.status !== 'ATIVO') return null;

    const competencia = `${referencia.getFullYear()}-${String(referencia.getMonth() + 1).padStart(2, '0')}`;

    // Verificar se já existe lançamento para esta competência
    const existente = await this.prisma.lancamentoCaixa.findFirst({
      where: { contratoUsoId, competencia },
    });
    if (existente) return existente;

    const valor = Number(contrato.valorFixoMensal ?? 0);
    if (valor <= 0) return null;

    const vencimento = new Date(referencia.getFullYear(), referencia.getMonth(), contrato.diaVencimento);

    return this.prisma.lancamentoCaixa.create({
      data: {
        tipo: 'DESPESA',
        descricao: `Aluguel/Cessão - ${contrato.cooperado.nomeCompleto} - ${contrato.numero}`,
        valor,
        competencia,
        dataVencimento: vencimento,
        status: 'PREVISTO',
        planoContasId: await this.buscarPlanoContasAluguel(),
        cooperadoId: contrato.cooperadoId,
        contratoUsoId: contrato.id,
        cooperativaId: contrato.cooperativaId,
      },
    });
  }

  private async buscarPlanoContasAluguel(): Promise<string | undefined> {
    const conta = await this.prisma.planoContas.findFirst({
      where: { codigo: '3.1.01' },
      select: { id: true },
    });
    return conta?.id;
  }
}
