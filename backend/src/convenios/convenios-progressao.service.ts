import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

export interface Faixa {
  minMembros: number;
  maxMembros: number | null;
  descontoMembros: number;
  descontoConveniado: number;
}

export interface ConfigBeneficio {
  criterio?: string;
  efeitoMudancaFaixa?: string;
  maxAcumuloConveniado?: number;
  faixas?: Faixa[];
}

@Injectable()
export class ConveniosProgressaoService {
  private readonly logger = new Logger(ConveniosProgressaoService.name);

  constructor(private prisma: PrismaService) {}

  async recalcularFaixa(convenioId: string, motivo: string) {
    const convenio = await this.prisma.contratoConvenio.findUnique({
      where: { id: convenioId },
    });
    if (!convenio) return;

    const config = (convenio.configBeneficio ?? {}) as ConfigBeneficio;
    const faixas = config.faixas ?? [];

    if (faixas.length === 0) {
      // Sem faixas configuradas, zerar cache
      await this.prisma.contratoConvenio.update({
        where: { id: convenioId },
        data: {
          faixaAtualIndex: 0,
          membrosAtivosCache: 0,
          descontoMembrosAtual: 0,
          descontoConveniadoAtual: 0,
        },
      });
      return;
    }

    // Contar membros ativos
    const membrosAtivos = await this.prisma.convenioCooperado.count({
      where: { convenioId, ativo: true },
    });

    // Determinar faixa
    const faixaInfo = this.calcularFaixa(faixas, membrosAtivos);
    const novoIndex = faixaInfo.index;
    const novoDescontoMembros = faixaInfo.descontoMembros;
    const novoDescontoConveniado = faixaInfo.descontoConveniado;

    const faixaAnteriorIdx = convenio.faixaAtualIndex;
    const descontoAnterior = Number(convenio.descontoMembrosAtual);
    const descontoConveniadoAnterior = Number(convenio.descontoConveniadoAtual);

    // Atualizar cache no convênio
    await this.prisma.contratoConvenio.update({
      where: { id: convenioId },
      data: {
        faixaAtualIndex: novoIndex,
        membrosAtivosCache: membrosAtivos,
        descontoMembrosAtual: novoDescontoMembros,
        descontoConveniadoAtual: novoDescontoConveniado,
      },
    });

    // Se a faixa mudou, registrar histórico
    if (novoIndex !== faixaAnteriorIdx || novoDescontoMembros !== descontoAnterior) {
      await this.prisma.historicoFaixaConvenio.create({
        data: {
          convenioId,
          faixaAnteriorIdx,
          faixaNovaIdx: novoIndex,
          membrosAtivos,
          descontoAnterior,
          descontoNovo: novoDescontoMembros,
          descontoConveniadoAnterior,
          descontoConveniadoNovo: novoDescontoConveniado,
          motivo,
        },
      });

      this.logger.log(
        `Faixa convênio ${convenioId}: ${faixaAnteriorIdx}→${novoIndex} ` +
        `(${membrosAtivos} membros, desconto ${descontoAnterior}%→${novoDescontoMembros}%) [${motivo}]`,
      );
    }

    // Atualizar cache faixaAtual em cada membro ativo
    const label = `Faixa ${novoIndex + 1} (${novoDescontoMembros}%)`;
    await this.prisma.convenioCooperado.updateMany({
      where: { convenioId, ativo: true },
      data: { faixaAtual: label },
    });
  }

  calcularFaixa(faixas: Faixa[], membrosAtivos: number): { index: number; descontoMembros: number; descontoConveniado: number } {
    // Ordenar por minMembros crescente
    const sorted = [...faixas].sort((a, b) => a.minMembros - b.minMembros);

    // Procurar a faixa correspondente (a última onde membros >= minMembros)
    let faixaEscolhida = sorted[0];
    let faixaIndex = 0;

    for (let i = 0; i < sorted.length; i++) {
      if (membrosAtivos >= sorted[i].minMembros) {
        faixaEscolhida = sorted[i];
        faixaIndex = i;
      }
    }

    // Se não tem membros suficientes para a primeira faixa
    if (membrosAtivos < sorted[0].minMembros) {
      return { index: 0, descontoMembros: 0, descontoConveniado: 0 };
    }

    return {
      index: faixaIndex,
      descontoMembros: faixaEscolhida.descontoMembros,
      descontoConveniado: faixaEscolhida.descontoConveniado,
    };
  }

  async recalcularTodos() {
    const convenios = await this.prisma.contratoConvenio.findMany({
      where: { status: 'ATIVO' },
      select: { id: true },
    });

    let atualizados = 0;
    for (const conv of convenios) {
      try {
        await this.recalcularFaixa(conv.id, 'RECALCULO_CRON');
        atualizados++;
      } catch (err: any) {
        this.logger.error(`Erro recalcular faixa convênio ${conv.id}: ${err.message}`);
      }
    }

    this.logger.log(`Reconciliação: ${atualizados}/${convenios.length} convênios recalculados`);
    return atualizados;
  }

}
