import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class UsinasAnaliticoService {
  constructor(private prisma: PrismaService) {}

  async saudeFinanceira(usinaId: string) {
    const usina = await this.prisma.usina.findUnique({ where: { id: usinaId } });
    if (!usina) throw new NotFoundException('Usina não encontrada');

    const now = new Date();
    const mes = now.getMonth() + 1;
    const ano = now.getFullYear();

    // kWh gerado no mês atual
    const geracaoMes = await this.prisma.geracaoMensal.findFirst({
      where: {
        usinaId,
        competencia: {
          gte: new Date(ano, mes - 1, 1),
          lt: new Date(ano, mes, 1),
        },
      },
    });

    // Contratos ativos
    const contratosAtivos = await this.prisma.contrato.count({
      where: { usinaId, status: 'ATIVO' },
    });

    // Cobranças do mês via contratos da usina
    const cobrancasMes = await this.prisma.cobranca.findMany({
      where: {
        contrato: { usinaId },
        mesReferencia: mes,
        anoReferencia: ano,
        status: { not: 'CANCELADO' },
      },
      include: {
        contrato: {
          include: {
            cooperado: { select: { id: true, nomeCompleto: true } },
          },
        },
      },
    });

    const totalCobrado = cobrancasMes.reduce((s, c) => s + Number(c.valorLiquido), 0);
    const totalRecebido = cobrancasMes
      .filter((c) => c.status === 'PAGO')
      .reduce((s, c) => s + Number(c.valorPago ?? c.valorLiquido), 0);
    const vencidos = cobrancasMes.filter((c) => c.status === 'VENCIDO');
    const totalInadimplente = vencidos.reduce((s, c) => s + Number(c.valorLiquido), 0);

    const inadimplentes = vencidos.map((c) => {
      const diasAtraso = Math.floor(
        (now.getTime() - new Date(c.dataVencimento).getTime()) / 86400000,
      );
      return {
        cooperadoId: c.contrato.cooperado.id,
        nome: c.contrato.cooperado.nomeCompleto,
        valor: Number(c.valorLiquido),
        diasAtraso,
        cobrancaId: c.id,
      };
    });

    return {
      usinaId,
      usinaNome: usina.nome,
      mesReferencia: mes,
      anoReferencia: ano,
      kwhGerado: geracaoMes?.kwhGerado ?? 0,
      contratosAtivos,
      totalCobrado: +totalCobrado.toFixed(2),
      totalRecebido: +totalRecebido.toFixed(2),
      totalInadimplente: +totalInadimplente.toFixed(2),
      inadimplentes: inadimplentes.sort((a, b) => b.valor - a.valor),
    };
  }

  async ocupacao(usinaId: string) {
    const usina = await this.prisma.usina.findUnique({
      where: { id: usinaId },
      include: {
        contratos: {
          where: { status: { in: ['ATIVO', 'PENDENTE_ATIVACAO'] } },
          include: {
            cooperativa: { select: { id: true, nome: true } },
          },
        },
      },
    });
    if (!usina) throw new NotFoundException('Usina não encontrada');

    const capacidadeKwh = Number(usina.capacidadeKwh ?? 0);

    // Soma percentualUsina de contratos ativos/pendentes
    const somaPercentual = usina.contratos.reduce(
      (acc, c) => acc + Number(c.percentualUsina ?? 0),
      0,
    );

    const kwhOcupado = capacidadeKwh > 0 ? (somaPercentual * capacidadeKwh) / 100 : 0;
    const kwhDisponivel = Math.max(0, capacidadeKwh - kwhOcupado);

    // Breakdown por cooperativa/parceiro
    const porParceiro: Record<
      string,
      { cooperativaId: string; cooperativaNome: string; percentual: number; kwhReservado: number; qtdContratos: number }
    > = {};

    for (const c of usina.contratos) {
      const key = c.cooperativaId ?? 'sem-parceiro';
      if (!porParceiro[key]) {
        porParceiro[key] = {
          cooperativaId: c.cooperativaId ?? '',
          cooperativaNome: c.cooperativa?.nome ?? 'Sem parceiro',
          percentual: 0,
          kwhReservado: 0,
          qtdContratos: 0,
        };
      }
      const pct = Number(c.percentualUsina ?? 0);
      porParceiro[key].percentual += pct;
      porParceiro[key].kwhReservado += capacidadeKwh > 0 ? (pct * capacidadeKwh) / 100 : 0;
      porParceiro[key].qtdContratos += 1;
    }

    return {
      usinaId,
      usinaNome: usina.nome,
      capacidadeKwh,
      percentualOcupado: +somaPercentual.toFixed(4),
      kwhOcupado: +kwhOcupado.toFixed(2),
      kwhDisponivel: +kwhDisponivel.toFixed(2),
      breakdown: Object.values(porParceiro).sort((a, b) => b.percentual - a.percentual),
    };
  }
}
