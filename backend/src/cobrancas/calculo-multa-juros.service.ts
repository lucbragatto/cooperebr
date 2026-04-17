import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

export interface ResultadoMultaJuros {
  diasAtraso: number;
  diasEfetivos: number;
  multa: number;
  juros: number;
  valorAtualizado: number;
}

@Injectable()
export class CalculoMultaJurosService {
  constructor(private prisma: PrismaService) {}

  /**
   * Calcula multa e juros sobre valorLiquido de cobrança vencida.
   * Fórmula padrão (base = valorLiquido):
   *   multa = base × (multaAtraso% / 100)  — fixa, uma vez
   *   juros = base × (jurosDiarios% / 100) × diasEfetivos  — diário simples
   *   valorAtualizado = base + multa + juros
   * Arredondamento: 2 casas decimais (Math.round × 100 / 100).
   */
  async calcular(
    valorLiquido: number,
    dataVencimento: Date,
    cooperativaId: string,
    dataCalculo: Date = new Date(),
  ): Promise<ResultadoMultaJuros> {
    const config = await this.prisma.cooperativa.findUnique({
      where: { id: cooperativaId },
      select: { multaAtraso: true, jurosDiarios: true, diasCarencia: true },
    });

    const vencimento = new Date(dataVencimento);
    vencimento.setHours(0, 0, 0, 0);
    const ref = new Date(dataCalculo);
    ref.setHours(0, 0, 0, 0);

    const diasAtraso = Math.max(0, Math.floor(
      (ref.getTime() - vencimento.getTime()) / (1000 * 60 * 60 * 24),
    ));
    const diasCarencia = config?.diasCarencia ?? 0;
    const diasEfetivos = Math.max(0, diasAtraso - diasCarencia);

    if (diasEfetivos <= 0 || !config) {
      return { diasAtraso, diasEfetivos: 0, multa: 0, juros: 0, valorAtualizado: valorLiquido };
    }

    const multa = Math.round(valorLiquido * (Number(config.multaAtraso) / 100) * 100) / 100;
    const juros = Math.round(valorLiquido * (Number(config.jurosDiarios) / 100) * diasEfetivos * 100) / 100;
    const valorAtualizado = Math.round((valorLiquido + multa + juros) * 100) / 100;

    return { diasAtraso, diasEfetivos, multa, juros, valorAtualizado };
  }
}
