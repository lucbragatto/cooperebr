import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma.service';
import { calcularRepasseLiquido } from '../usinas/helpers/calcular-repasse-liquido';
import type { UsinaParaCalculo, TarifaResolver } from '../usinas/helpers/calcular-repasse';

/**
 * BH.5 (M41, 2026-05-30) — Cron mensal que cria despesa ARRENDAMENTO_USINA
 * automática (status APROVADA + RESOLVIDA + ASSUMIDO + PARCEIRO) pra cada usina
 * com `formaPagamentoDono` definido, refletindo o repasse BRUTO calculado pro
 * mês anterior. Idempotente (não cria duplicada se já existir no período).
 *
 * Decisão Luciano 28/05 (fechamento M36): aluguel mensal do parceiro pro
 * proprietário vira despesa automática quando repasse roda — não só
 * "eventos ad-hoc" (manutenção). Permite que o sistema rastreie a obrigação
 * contratual recorrente sem depender de cadastro manual.
 *
 * Schedule: 03:00 do dia 1 de cada mês — janela de baixa carga.
 * Idempotência: filtro `categoria=ARRENDAMENTO_USINA` + `dataOcorrencia` no mês
 * anterior. Re-execução manual via endpoint dev fica protegida pela mesma checagem.
 */
@Injectable()
export class RepasseMensalCron {
  private readonly logger = new Logger(RepasseMensalCron.name);

  constructor(private prisma: PrismaService) {}

  @Cron('0 3 1 * *', { timeZone: 'America/Sao_Paulo' })
  async criarDespesasAluguelMensal(): Promise<{ criadas: number; puladas: number; erros: number }> {
    const ref = new Date();
    const periodoInicio = new Date(ref.getFullYear(), ref.getMonth() - 1, 1);
    const periodoFim = new Date(ref.getFullYear(), ref.getMonth(), 1); // exclusivo (lt)
    const periodoFimInclusive = new Date(periodoFim.getTime() - 1); // referência da dataOcorrencia

    this.logger.log(
      `Iniciando criação de despesas ARRENDAMENTO_USINA pro mês ${
        periodoInicio.getMonth() + 1
      }/${periodoInicio.getFullYear()}`,
    );

    const usinas = await this.prisma.usina.findMany({
      where: {
        cooperativaId: { not: null },
        formaPagamentoDono: { in: ['FIXO', 'PERCENTUAL', 'HIBRIDO'] },
      },
      select: {
        id: true,
        nome: true,
        cooperativaId: true,
        formaPagamentoDono: true,
        valorAluguelFixo: true,
        percentualGeracaoDono: true,
        valorKwhPadrao: true,
        distribuidora: true,
      },
    });

    let criadas = 0;
    let puladas = 0;
    let erros = 0;

    const tarifaResolver: TarifaResolver = async (distribuidora, _competencia) => {
      if (!distribuidora) return null;
      const tarifas = await this.prisma.tarifaConcessionaria.findMany({
        orderBy: { dataVigencia: 'desc' },
        take: 10,
      });
      const normD = distribuidora.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
      const match = tarifas.find((t) => {
        const normC = t.concessionaria.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
        return normC.includes(normD) || normD.includes(normC);
      });
      if (!match) return null;
      return Number(match.tusdNova) + Number(match.teNova);
    };

    for (const usina of usinas) {
      try {
        // 1. Idempotência: já existe despesa ARRENDAMENTO_USINA no período?
        const jaExiste = await this.prisma.contaAPagar.findFirst({
          where: {
            usinaId: usina.id,
            categoria: 'ARRENDAMENTO_USINA',
            dataOcorrencia: { gte: periodoInicio, lt: periodoFim },
          },
          select: { id: true },
        });
        if (jaExiste) {
          puladas++;
          continue;
        }

        // 2. Buscar geração do mês anterior
        const geracao = await this.prisma.geracaoMensal.findFirst({
          where: {
            usinaId: usina.id,
            competencia: { gte: periodoInicio, lt: periodoFim },
          },
          select: { kwhGerado: true, competencia: true },
        });

        // 3. Calcular repasse BRUTO (queremos o valor cheio — abatimento é separado, não vira despesa negativa)
        const usinaCalc: UsinaParaCalculo = {
          formaPagamentoDono: usina.formaPagamentoDono,
          valorAluguelFixo: usina.valorAluguelFixo !== null ? Number(usina.valorAluguelFixo) : null,
          percentualGeracaoDono:
            usina.percentualGeracaoDono !== null ? Number(usina.percentualGeracaoDono) : null,
          valorKwhPadrao: usina.valorKwhPadrao !== null ? Number(usina.valorKwhPadrao) : null,
          distribuidora: usina.distribuidora,
        };

        const calc = await calcularRepasseLiquido({
          usina: usinaCalc,
          usinaId: usina.id,
          cooperativaId: usina.cooperativaId!,
          geracaoMes: geracao
            ? { kwhGerado: Number(geracao.kwhGerado), competencia: geracao.competencia }
            : null,
          tarifaResolver,
          prisma: this.prisma,
          periodoInicio,
          periodoFim,
        });

        const valorBruto = calc.valorBruto;
        if (valorBruto === null || valorBruto <= 0) {
          puladas++;
          continue;
        }

        // 4. Criar despesa automática — já APROVADA + RESOLVIDA + ASSUMIDO + PARCEIRO
        const mm = String(periodoInicio.getMonth() + 1).padStart(2, '0');
        const yyyy = periodoInicio.getFullYear();
        await this.prisma.contaAPagar.create({
          data: {
            cooperativaId: usina.cooperativaId!,
            usinaId: usina.id,
            descricao: `Aluguel/repasse automático ${mm}/${yyyy} (gerado pelo sistema)`,
            categoria: 'ARRENDAMENTO_USINA',
            valor: valorBruto,
            dataVencimento: periodoFimInclusive,
            dataOcorrencia: periodoFimInclusive,
            quemPagouTipo: 'PARCEIRO',
            responsavelPagamento: 'PARCEIRO',
            tratamento: 'ASSUMIDO',
            statusAprovacao: 'APROVADA',
            statusResolucao: 'RESOLVIDA',
            aprovadoEm: new Date(),
            resolvidoEm: new Date(),
            // propostoPorUsuarioId / aprovadoPorUsuarioId ficam null — sistema gerou
          },
        });
        criadas++;
      } catch (err: any) {
        erros++;
        this.logger.error(
          `Erro criando despesa ARRENDAMENTO_USINA pra usina ${usina.id} (${usina.nome}): ${err?.message ?? err}`,
        );
      }
    }

    this.logger.log(
      `Cron concluído: ${criadas} criadas / ${puladas} puladas (já existia ou valor zero) / ${erros} erros`,
    );

    return { criadas, puladas, erros };
  }
}
