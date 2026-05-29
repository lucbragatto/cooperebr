/**
 * D-novo-AN AN.4 (M42, 2026-05-30) — Backfill RepasseProprietario histórico.
 *
 * Cria RepasseProprietario PENDENTE pra cada GeracaoMensal de usina elegível
 * (formaPagamentoDono em FIXO/PERCENTUAL/HIBRIDO) que ainda não tem repasse
 * persistido pro período.
 *
 * IDEMPOTÊNCIA forte: unique constraint @@unique(usinaId, periodoInicio,
 * periodoFim) do schema protege. Catch P2002 → SKIP sem erro.
 *
 * Uso:
 *   npx ts-node --transpile-only scripts/backfill-repasses-proprietario.ts          # dry-run (default)
 *   npx ts-node --transpile-only scripts/backfill-repasses-proprietario.ts --apply  # cria de verdade
 *
 * Dry-run NÃO faz INSERT — só lista o que seria criado.
 *
 * Resolve proprietarioUsuarioId via Caminho A (Cooperado→Usuario por
 * email/cpf) + fallback Caminho B (Usina.proprietarioEmail).
 *
 * Anti-escopo: NÃO marca nenhum como PAGO — todos nascem PENDENTE.
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { PrismaClient } from '@prisma/client';
import { calcularRepasseLiquido } from '../src/usinas/helpers/calcular-repasse-liquido';
import type { UsinaParaCalculo, TarifaResolver } from '../src/usinas/helpers/calcular-repasse';

const prisma = new PrismaClient();
const DRY_RUN = !process.argv.includes('--apply');

async function main() {
  console.log('═══ Backfill RepasseProprietario histórico ═══');
  console.log(`Modo: ${DRY_RUN ? 'DRY-RUN (sem INSERT)' : '*** APPLY (cria de verdade) ***'}\n`);

  await NestFactory.createApplicationContext(AppModule, { logger: ['warn', 'error'] }).then((a) =>
    a.close(),
  );

  // Tarifa resolver alinhado ao cron BH.5
  const tarifaResolver: TarifaResolver = async (distribuidora, _competencia) => {
    if (!distribuidora) return null;
    const tarifas = await prisma.tarifaConcessionaria.findMany({
      orderBy: { dataVigencia: 'desc' },
      take: 10,
    });
    const normD = distribuidora
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .trim();
    const match = tarifas.find((t) => {
      const normC = t.concessionaria
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .trim();
      return normC.includes(normD) || normD.includes(normC);
    });
    if (!match) return null;
    return Number(match.tusdNova) + Number(match.teNova);
  };

  const usinas = await prisma.usina.findMany({
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
      proprietarioCooperadoId: true,
      proprietarioEmail: true,
      geracoesMensais: {
        select: { competencia: true, kwhGerado: true },
        orderBy: { competencia: 'asc' },
      },
    },
  });

  let totalGeracoes = 0;
  let candidatos = 0;
  let criados = 0;
  let skipExistente = 0;
  let pulados = 0;
  let erros = 0;

  for (const usina of usinas) {
    for (const g of usina.geracoesMensais) {
      totalGeracoes++;
      const periodoInicio = new Date(g.competencia.getFullYear(), g.competencia.getMonth(), 1);
      const periodoFim = new Date(g.competencia.getFullYear(), g.competencia.getMonth() + 1, 1);
      const periodoFimInclusive = new Date(periodoFim.getTime() - 1);

      // Idempotência preventiva (rapida): unique constraint do banco protege em race
      const jaExiste = await prisma.repasseProprietario.findUnique({
        where: {
          usinaId_periodoInicio_periodoFim: {
            usinaId: usina.id,
            periodoInicio,
            periodoFim,
          },
        },
        select: { id: true },
      });
      if (jaExiste) {
        skipExistente++;
        console.log(
          `  SKIP ${usina.nome} ${periodoInicio.toISOString().slice(0, 7)} → repasse ${jaExiste.id} já existe`,
        );
        continue;
      }

      // Calcular bruto + abatido + líquido (helper BH.5 puro)
      const usinaCalc: UsinaParaCalculo = {
        formaPagamentoDono: usina.formaPagamentoDono,
        valorAluguelFixo: usina.valorAluguelFixo !== null ? Number(usina.valorAluguelFixo) : null,
        percentualGeracaoDono:
          usina.percentualGeracaoDono !== null ? Number(usina.percentualGeracaoDono) : null,
        valorKwhPadrao: usina.valorKwhPadrao !== null ? Number(usina.valorKwhPadrao) : null,
        distribuidora: usina.distribuidora,
      };

      let calc;
      try {
        calc = await calcularRepasseLiquido({
          usina: usinaCalc,
          usinaId: usina.id,
          cooperativaId: usina.cooperativaId!,
          geracaoMes: { kwhGerado: Number(g.kwhGerado), competencia: g.competencia },
          tarifaResolver,
          prisma,
          periodoInicio,
          periodoFim,
        });
      } catch (e: any) {
        erros++;
        console.log(`  ERRO calc ${usina.nome} ${periodoInicio.toISOString().slice(0, 7)}: ${e.message}`);
        continue;
      }

      if (calc.valorBruto === null || calc.valorBruto <= 0) {
        pulados++;
        console.log(
          `  PULA ${usina.nome} ${periodoInicio.toISOString().slice(0, 7)} (bruto=null/zero — falta config formaPagamentoDono ou tarifa)`,
        );
        continue;
      }

      candidatos++;

      // Resolver proprietarioUsuarioId (Caminho A→B)
      let proprietarioUsuarioId: string | null = null;
      if (usina.proprietarioCooperadoId) {
        const cooperado = await prisma.cooperado.findUnique({
          where: { id: usina.proprietarioCooperadoId },
          select: { email: true, cpf: true },
        });
        if (cooperado) {
          const u = await prisma.usuario.findFirst({
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
      if (!proprietarioUsuarioId && usina.proprietarioEmail) {
        const u = await prisma.usuario.findUnique({
          where: { email: usina.proprietarioEmail },
          select: { id: true },
        });
        proprietarioUsuarioId = u?.id ?? null;
      }

      const valorBruto = calc.valorBruto;
      const totalAbatido = calc.totalDespesasAbatidas;
      const valorLiquido = calc.valor ?? valorBruto;

      console.log(
        `  ${DRY_RUN ? 'WOULD-CREATE' : 'CRIA'} ${usina.nome} ${periodoInicio.toISOString().slice(0, 7)}: bruto=R$${valorBruto.toFixed(2)} abatido=R$${totalAbatido.toFixed(2)} líquido=R$${valorLiquido.toFixed(2)}${proprietarioUsuarioId ? ' propUsuario=' + proprietarioUsuarioId : ' propUsuario=null'}`,
      );

      if (!DRY_RUN) {
        try {
          await prisma.repasseProprietario.create({
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
          });
          criados++;
        } catch (e: any) {
          if (e?.code === 'P2002') {
            // Race com cron concorrente — idempotência forte do banco capturou.
            skipExistente++;
          } else {
            erros++;
            console.log(`  ERRO create ${usina.nome}: ${e.message}`);
          }
        }
      }
    }
  }

  console.log('\n═══ Resumo ═══');
  console.log(`  Geracoes Mensais analisadas: ${totalGeracoes}`);
  console.log(`  Candidatos elegíveis: ${candidatos}`);
  console.log(`  Já existia (SKIP): ${skipExistente}`);
  console.log(`  Pulados (bruto null/zero): ${pulados}`);
  console.log(`  Criados: ${DRY_RUN ? 'N/A (dry-run)' : criados}`);
  console.log(`  Erros: ${erros}`);

  if (DRY_RUN) {
    console.log('\n⚠️  DRY-RUN — nada foi escrito.');
    console.log('   Pra aplicar de verdade: npx ts-node --transpile-only scripts/backfill-repasses-proprietario.ts --apply');
  }

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error('Backfill crashou:', e?.message ?? e);
  await prisma.$disconnect();
  process.exit(1);
});
