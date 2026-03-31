import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

export interface InadimplenciaFiltros {
  cooperativaId: string; // obrigatório
  usinaId?: string;
  tipoCooperado?: string;
  periodoInicio?: Date;
  periodoFim?: Date;
}

export interface ProducaoVsCobrancaRow {
  cooperadoId: string;
  nome: string;
  kwhContrato: number;
  kwhEntregue: number;
  excedente: number;
  valorCobranca: number;
  status: 'SUPERAVITARIO' | 'DEFICITARIO' | 'ADEQUADO';
}

@Injectable()
export class RelatoriosQueryService {
  constructor(private prisma: PrismaService) {}

  async inadimplencia(filtros: InadimplenciaFiltros) {
    const where: any = { status: 'VENCIDO', cooperativaId: filtros.cooperativaId };
    if (filtros.usinaId) where.contrato = { usinaId: filtros.usinaId };
    if (filtros.periodoInicio || filtros.periodoFim) {
      where.dataVencimento = {};
      if (filtros.periodoInicio) where.dataVencimento.gte = filtros.periodoInicio;
      if (filtros.periodoFim) where.dataVencimento.lte = filtros.periodoFim;
    }
    const cobrancas = await this.prisma.cobranca.findMany({
      where,
      include: { contrato: { include: { usina: { select: { id: true, nome: true } }, cooperado: { select: { id: true, nomeCompleto: true, tipoCooperado: true } } } } },
      orderBy: { dataVencimento: 'asc' },
    });
    const resultado = filtros.tipoCooperado
      ? cobrancas.filter(c => c.contrato?.cooperado?.tipoCooperado === filtros.tipoCooperado)
      : cobrancas;
    return resultado;
  }

  async producaoVsCobranca(cooperativaId: string, competencia: string): Promise<ProducaoVsCobrancaRow[]> {
    const data = new Date(competencia);
    const inicioMes = new Date(data.getFullYear(), data.getMonth(), 1);
    const fimMes = new Date(data.getFullYear(), data.getMonth() + 1, 0);

    const contratos = await this.prisma.contrato.findMany({
      where: { status: 'ATIVO', cooperado: { cooperativaId } },
      include: {
        cooperado: { select: { id: true, nomeCompleto: true } },
        usina: true,
        cobrancas: { where: { createdAt: { gte: inicioMes, lte: fimMes } }, select: { valorLiquido: true } },
      },
    });

    return contratos.map(c => {
      const geracaoUsina = 0; // será preenchido pela view materializada quando disponível
      const kwhEntregue = c.percentualUsina ? Number(geracaoUsina) * (Number(c.percentualUsina) / 100) : 0;
      const kwhContrato = Number(c.kwhContrato ?? 0);
      const excedente = kwhEntregue - kwhContrato;
      const valorCobranca = c.cobrancas.reduce((acc, cb) => acc + Number(cb.valorLiquido), 0);
      const status: ProducaoVsCobrancaRow['status'] =
        kwhEntregue >= kwhContrato ? 'SUPERAVITARIO' :
        kwhEntregue >= kwhContrato * 0.8 ? 'ADEQUADO' : 'DEFICITARIO';

      return {
        cooperadoId: c.cooperado.id,
        nome: c.cooperado.nomeCompleto,
        kwhContrato,
        kwhEntregue,
        excedente,
        valorCobranca,
        status,
      };
    });
  }

  async geracaoPorUsina(usinaId: string, ano: number, cooperativaId: string) {
    return this.prisma.geracaoMensal.findMany({
      where: { usinaId, usina: { cooperativaId }, competencia: { gte: new Date(ano, 0, 1), lt: new Date(ano + 1, 0, 1) } },
      orderBy: { competencia: 'asc' },
      include: { usina: { select: { id: true, nome: true } } },
    });
  }
}
