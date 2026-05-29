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
 * AN.2 (M42, 2026-05-30) — Integração com RepasseProprietario.
 * Agora cria ambos em transação atômica:
 *   1. RepasseProprietario PENDENTE (com snapshot bruto+abatido+líquido)
 *   2. ContaAPagar ARRENDAMENTO_USINA APROVADA+RESOLVIDA+ASSUMIDO+PARCEIRO
 *      com `repasseAbatidoId = repasse.id` (auto-vinculado desde a criação)
 *
 * Idempotência forte: unique constraint @@unique([usinaId, periodoInicio,
 * periodoFim]) no RepasseProprietario quebra a transação inteira no 2º
 * trigger, e capturamos P2002 → pulamos a usina (puladas++).
 *
 * Decisão Luciano 28/05 (fechamento M36): aluguel mensal vira despesa
 * automática. Decisão Luciano AN Fase 1 (30/05): cron cria também o
 * RepasseProprietario PENDENTE pra rastrear pendência operacional desde o
 * dia 1, sem depender de admin lembrar de criar.
 *
 * Schedule: 03:00 do dia 1 de cada mês (timezone São Paulo).
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
        // 1. Idempotência primária (rápida): já existe RepasseProprietario no período?
        // A unique constraint do banco protege também — esta query evita o roundtrip.
        const repasseExistente = await this.prisma.repasseProprietario.findUnique({
          where: {
            usinaId_periodoInicio_periodoFim: {
              usinaId: usina.id,
              periodoInicio,
              periodoFim,
            },
          },
          select: { id: true },
        });
        if (repasseExistente) {
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

        // 3. Calcular repasse (bruto + abatimento + líquido) — snapshot pro repasse
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

        // 4. Resolver proprietarioUsuarioId (Caminho A→B via Usina)
        const usinaProp = await this.prisma.usina.findUnique({
          where: { id: usina.id },
          select: { proprietarioCooperadoId: true, proprietarioEmail: true },
        });
        let proprietarioUsuarioId: string | null = null;
        if (usinaProp?.proprietarioCooperadoId) {
          const cooperado = await this.prisma.cooperado.findUnique({
            where: { id: usinaProp.proprietarioCooperadoId },
            select: { email: true, cpf: true },
          });
          if (cooperado) {
            const u = await this.prisma.usuario.findFirst({
              where: {
                OR: [
                  ...(cooperado.email ? [{ email: cooperado.email }] : []),
                  ...(cooperado.cpf ? [{ cpf: cooperado.cpf }] : []),
                ],
              },
              select: { id: true },
            });
            proprietarioUsuarioId = u?.id ?? null;
          }
        }
        if (!proprietarioUsuarioId && usinaProp?.proprietarioEmail) {
          const u = await this.prisma.usuario.findUnique({
            where: { email: usinaProp.proprietarioEmail },
            select: { id: true },
          });
          proprietarioUsuarioId = u?.id ?? null;
        }

        // 5. Criar Repasse PENDENTE + ContaAPagar ARRENDAMENTO_USINA em TRANSAÇÃO ATÔMICA
        const mm = String(periodoInicio.getMonth() + 1).padStart(2, '0');
        const yyyy = periodoInicio.getFullYear();
        const valorLiquido = calc.valor ?? valorBruto;
        const totalAbatido = calc.totalDespesasAbatidas;

        const [repasseCriado] = await this.prisma.$transaction([
          this.prisma.repasseProprietario.create({
            data: {
              cooperativaId: usina.cooperativaId!,
              usinaId: usina.id,
              proprietarioUsuarioId,
              periodoInicio,
              periodoFim,
              valorBruto,
              totalDespesasAbatidas: totalAbatido,
              valorLiquido,
              status: 'PENDENTE',
            },
          }),
          // ContaAPagar ARRENDAMENTO_USINA reflete obrigação contratual (BH.5 original).
          // statusResolucao=RESOLVIDA porque a obrigação se materializa via Repasse —
          // não fica "pendurada" no fluxo de despesas operacionais.
          this.prisma.contaAPagar.create({
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
          }),
        ]);

        this.logger.log(
          `Usina ${usina.nome}: Repasse ${repasseCriado.id} PENDENTE (bruto=${valorBruto}, abatido=${totalAbatido}, líquido=${valorLiquido}) + Arrendamento criados.`,
        );
        criadas++;
      } catch (err: any) {
        // Captura P2002 (unique constraint da idempotência) — race entre Fase 1 e
        // transação, ou cron rodando concorrente. Tratamos como "pulada" sem erro.
        if (err?.code === 'P2002') {
          puladas++;
          continue;
        }
        erros++;
        this.logger.error(
          `Erro criando Repasse+Arrendamento pra usina ${usina.id} (${usina.nome}): ${err?.message ?? err}`,
        );
      }
    }

    this.logger.log(
      `Cron concluído: ${criadas} pares Repasse+Arrendamento criados / ${puladas} pulados (idempotência ou valor zero) / ${erros} erros`,
    );

    return { criadas, puladas, erros };
  }
}
