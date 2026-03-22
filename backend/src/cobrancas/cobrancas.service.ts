import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { ConfiguracaoCobrancaService } from '../configuracao-cobranca/configuracao-cobranca.service';

export interface CobrancaCalculo {
  contratoId: string;
  competencia: Date;
  geracaoMensalId: string;
  kwhEntregue: number;
  kwhConsumido: number | null;
  kwhCompensado: number | null;
  kwhSaldo: number | null;
  descontoAplicado: number;
  baseCalculoUsada: string;
  fonteDesconto: string;
  valorBruto: number;
  valorDesconto: number;
  valorLiquido: number;
}

@Injectable()
export class CobrancasService {
  constructor(
    private prisma: PrismaService,
    private configuracaoCobrancaService: ConfiguracaoCobrancaService,
  ) {}

  async findAll() {
    return this.prisma.cobranca.findMany({
      include: { contrato: { include: { cooperado: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const cobranca = await this.prisma.cobranca.findUnique({
      where: { id },
      include: { contrato: { include: { cooperado: true } } },
    });
    if (!cobranca) throw new NotFoundException(`Cobrança com id ${id} não encontrada`);
    return cobranca;
  }

  async findByContrato(contratoId: string) {
    return this.prisma.cobranca.findMany({
      where: { contratoId },
      orderBy: [{ anoReferencia: 'desc' }, { mesReferencia: 'desc' }],
    });
  }

  async create(data: {
    contratoId: string;
    mesReferencia: number;
    anoReferencia: number;
    valorBruto: number;
    percentualDesconto: number;
    valorDesconto: number;
    valorLiquido: number;
    dataVencimento: Date;
    dataPagamento?: Date;
  }) {
    return this.prisma.cobranca.create({ data });
  }

  async update(id: string, data: Partial<{
    mesReferencia: number;
    anoReferencia: number;
    valorBruto: number;
    percentualDesconto: number;
    valorDesconto: number;
    valorLiquido: number;
    status: 'PENDENTE' | 'PAGO' | 'VENCIDO' | 'CANCELADO';
    dataVencimento: Date;
    dataPagamento: Date;
  }>) {
    return this.prisma.cobranca.update({ where: { id }, data });
  }

  async darBaixa(id: string, dataPagamento: string, valorPago: number) {
    const cobranca = await this.prisma.cobranca.findUnique({ where: { id } });
    if (!cobranca) throw new NotFoundException(`Cobrança com id ${id} não encontrada`);
    if (cobranca.status === 'PAGO') {
      throw new BadRequestException('Esta cobrança já foi paga');
    }
    if (cobranca.status === 'CANCELADO') {
      throw new BadRequestException('Não é possível dar baixa em cobrança cancelada');
    }
    return this.prisma.cobranca.update({
      where: { id },
      data: {
        status: 'PAGO',
        dataPagamento: new Date(dataPagamento),
        valorPago,
      },
    });
  }

  async cancelar(id: string, motivo: string) {
    const cobranca = await this.prisma.cobranca.findUnique({ where: { id } });
    if (!cobranca) throw new NotFoundException(`Cobrança com id ${id} não encontrada`);
    if (cobranca.status === 'CANCELADO') {
      throw new BadRequestException('Esta cobrança já está cancelada');
    }
    if (cobranca.status === 'PAGO') {
      throw new BadRequestException('Não é possível cancelar cobrança já paga');
    }
    return this.prisma.cobranca.update({
      where: { id },
      data: {
        status: 'CANCELADO',
        motivoCancelamento: motivo,
      },
    });
  }

  async remove(id: string) {
    return this.prisma.cobranca.delete({ where: { id } });
  }

  async calcularCobrancaMensal(contratoId: string, competencia: Date): Promise<CobrancaCalculo> {
    // 1. Buscar contrato com usina
    const contrato = await this.prisma.contrato.findUnique({
      where: { id: contratoId },
      include: { usina: true },
    });
    if (!contrato) throw new NotFoundException('Contrato não encontrado');
    if (!contrato.usinaId || !contrato.usina) {
      throw new BadRequestException('Contrato não possui usina vinculada');
    }
    if (contrato.percentualUsina == null) {
      throw new BadRequestException('Contrato não possui percentualUsina definido');
    }

    // 2. Buscar GeracaoMensal da usina para a competência
    const competenciaNormalizada = new Date(competencia.getFullYear(), competencia.getMonth(), 1);
    const geracao = await this.prisma.geracaoMensal.findUnique({
      where: {
        usinaId_competencia: {
          usinaId: contrato.usinaId,
          competencia: competenciaNormalizada,
        },
      },
    });
    if (!geracao) {
      throw new NotFoundException(
        `Geração mensal não encontrada para usina ${contrato.usina.nome} na competência ${competenciaNormalizada.toISOString().slice(0, 7)}`,
      );
    }

    // 3. Calcular kWh entregue ao cooperado
    const percentualUsina = Number(contrato.percentualUsina) / 100;
    const kwhEntregue = geracao.kwhGerado * percentualUsina;

    // 4. Resolver desconto via hierarquia (contrato → usina → cooperativa)
    const configDesconto = await this.configuracaoCobrancaService.resolverDesconto(contratoId);
    const descontoAplicado = configDesconto.desconto;
    const baseCalculoUsada = configDesconto.baseCalculo;
    const fonteDesconto = configDesconto.fonte;

    // 5. Calcular valor — por enquanto usando kwhEntregue como base
    // O valor bruto é o kWh entregue (valor em R$ será refinado quando houver tarifa)
    // Para TUSD_TE: usa tarifa TUSD+TE por kWh; para TOTAL_FATURA: usa valor total da fatura
    // Por agora, retornamos os kWh calculados e o desconto — valor monetário depende de tarifa/fatura
    const valorBruto = kwhEntregue; // placeholder: kWh entregue (será multiplicado por tarifa no item 6)
    const valorDesconto = valorBruto * (descontoAplicado / 100);
    const valorLiquido = valorBruto - valorDesconto;

    return {
      contratoId,
      competencia: competenciaNormalizada,
      geracaoMensalId: geracao.id,
      kwhEntregue,
      kwhConsumido: null, // será preenchido quando houver fatura do cooperado
      kwhCompensado: null,
      kwhSaldo: null,
      descontoAplicado,
      baseCalculoUsada,
      fonteDesconto,
      valorBruto,
      valorDesconto,
      valorLiquido,
    };
  }
}
