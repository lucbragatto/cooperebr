/**
 * Reconciliação de membros oco/parciais — Fatia 1.4 (06/06/2026).
 *
 * Resolve casos como LEONARDO (MEMBRO_ATIVO sem nada — sem contrato, sem clube,
 * status PENDENTE) que sobraram do legado antes das Fatias 1.1/1.2/1.3.
 *
 * Lista MEMBRO_ATIVO + parciais (qualquer combinação):
 *  - Cooperado.status != 'ATIVO' (PENDENTE/PENDENTE_DOCUMENTOS/...)
 *  - Sem contrato vigente (PENDENTE_ATIVACAO/ATIVO/LISTA_ESPERA)
 *  - Sem ProgressaoClube
 *  - Cooperado.pendenciaMotorMsg gravada
 *
 * Modo default = DRY-RUN: mostra ANTES vs DEPOIS proposto. Não toca nada.
 * Flag `--apply` invoca o helper `MembroBuilderService.construirMembroCompleto`
 * — idempotente PER-STEP: completa o que falta, no-op no que já está.
 *
 * USO:
 *   npx ts-node scripts/reconciliar-membros-oco.ts            # DRY-RUN
 *   npx ts-node scripts/reconciliar-membros-oco.ts --apply    # executa
 *   npx ts-node scripts/reconciliar-membros-oco.ts --tenant <coopId>
 *   npx ts-node scripts/reconciliar-membros-oco.ts --membro <id>
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma.service';
import { MembroBuilderService } from '../src/convenios/membro-builder.service';

interface Args {
  apply: boolean;
  tenantId?: string;
  membroId?: string;
}

function parseArgs(): Args {
  const args = process.argv.slice(2);
  const apply = args.includes('--apply');
  const tenantIdx = args.indexOf('--tenant');
  const membroIdx = args.indexOf('--membro');
  const tenantId = tenantIdx >= 0 ? args[tenantIdx + 1] : undefined;
  const membroId = membroIdx >= 0 ? args[membroIdx + 1] : undefined;
  return { apply, tenantId, membroId };
}

interface DiagnosticoMembro {
  membroId: string;
  cooperadoId: string;
  cooperadoNome: string;
  cooperadoCpfSufixo: string;
  convenioId: string;
  convenioNome: string;
  cooperativaId: string;
  statusCooperado: string;
  cotaKwhMensal: number | null;
  jaTemContrato: boolean;
  jaTemClube: boolean;
  temPendencia: boolean;
  pendenciaMsg: string | null;
  acoesPropostas: string[];
}

async function main() {
  const { apply, tenantId, membroId } = parseArgs();
  console.log(`\n═══ Reconciliação de membros oco — Fatia 1.4 ═══`);
  console.log(`Modo: ${apply ? '🔥 APPLY (executa helper)' : '🔍 DRY-RUN (somente lista)'}`);
  if (tenantId) console.log(`Filtro tenant: ${tenantId}`);
  if (membroId) console.log(`Filtro membro: ${membroId}`);
  console.log('');

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });
  const prisma = app.get(PrismaService);
  const builder = app.get(MembroBuilderService);

  try {
    // Carrega membros MEMBRO_ATIVO no escopo
    const membros = await prisma.convenioCooperado.findMany({
      where: {
        status: 'MEMBRO_ATIVO',
        ativo: true,
        ...(membroId ? { id: membroId } : {}),
        ...(tenantId ? { convenio: { cooperativaId: tenantId } } : {}),
      },
      include: {
        cooperado: {
          select: {
            id: true,
            nomeCompleto: true,
            cpf: true,
            cooperativaId: true,
            status: true,
            cotaKwhMensal: true,
            pendenciaMotorMsg: true,
            contratos: {
              where: {
                status: { in: ['PENDENTE_ATIVACAO', 'ATIVO', 'LISTA_ESPERA'] },
              },
              select: { id: true, status: true },
              take: 1,
            },
            progressaoClube: { select: { id: true, nivelAtual: true } },
          },
        },
        convenio: {
          select: { id: true, empresaNome: true, cooperativaId: true, pagador: true },
        },
      },
    });

    if (membros.length === 0) {
      console.log('Nenhum membro MEMBRO_ATIVO no escopo. Nada a fazer.');
      return;
    }

    const diagnosticos: DiagnosticoMembro[] = membros.map((m) => {
      const c = m.cooperado;
      const jaTemContrato = c.contratos.length > 0;
      const jaTemClube = c.progressaoClube !== null;
      const cota = Number(c.cotaKwhMensal ?? 0);

      const acoes: string[] = [];
      if (c.status !== 'ATIVO') {
        acoes.push(`flipar Cooperado.status ${c.status} → ATIVO`);
      }
      if (!jaTemContrato) {
        if (cota > 0 && m.convenio.pagador === 'EMPRESA') {
          acoes.push(`tentar motor.aceitar (cota=${cota}kWh) → contrato custeado`);
        } else if (cota <= 0) {
          acoes.push('gravar pendenciaMotorMsg "cota não capturada" (sem contrato)');
        } else {
          acoes.push(`motor pulado (pagador=${m.convenio.pagador} != EMPRESA)`);
        }
      }
      if (!jaTemClube) {
        acoes.push('matricular ProgressaoClube BRONZE (se ConfigClubeVantagens.ativo)');
      }
      if (c.pendenciaMotorMsg && jaTemContrato) {
        acoes.push('limpar pendenciaMotorMsg (já tem contrato)');
      }
      if (acoes.length === 0) {
        acoes.push('COMPLETO — no-op');
      }

      return {
        membroId: m.id,
        cooperadoId: c.id,
        cooperadoNome: c.nomeCompleto,
        cooperadoCpfSufixo: '...' + c.cpf.slice(-3),
        convenioId: m.convenio.id,
        convenioNome: m.convenio.empresaNome,
        cooperativaId: c.cooperativaId ?? '?',
        statusCooperado: c.status,
        cotaKwhMensal: c.cotaKwhMensal ? Number(c.cotaKwhMensal) : null,
        jaTemContrato,
        jaTemClube,
        temPendencia: c.pendenciaMotorMsg !== null,
        pendenciaMsg: c.pendenciaMotorMsg,
        acoesPropostas: acoes,
      };
    });

    const parciais = diagnosticos.filter(
      (d) => !d.acoesPropostas.every((a) => a.includes('COMPLETO')),
    );
    const completos = diagnosticos.length - parciais.length;

    console.log(`Total MEMBRO_ATIVO no escopo: ${diagnosticos.length}`);
    console.log(`Completos (no-op): ${completos}`);
    console.log(`Parciais (precisam reconciliar): ${parciais.length}\n`);

    if (parciais.length === 0) {
      console.log('✅ Todos os membros estão completos. Nada a fazer.');
      return;
    }

    console.log('─── ANTES vs DEPOIS proposto ─────────────────────────────');
    for (const d of parciais) {
      console.log(
        `\n• ${d.cooperadoNome} (${d.cooperadoCpfSufixo}) — convênio "${d.convenioNome}"`,
      );
      console.log(
        `  ANTES: status=${d.statusCooperado} cota=${d.cotaKwhMensal ?? 'null'} ` +
          `contrato=${d.jaTemContrato ? 'sim' : 'não'} clube=${d.jaTemClube ? 'sim' : 'não'} ` +
          `pendencia=${d.temPendencia ? 'sim' : 'não'}`,
      );
      if (d.pendenciaMsg) {
        console.log(`  Msg pendência: "${d.pendenciaMsg.slice(0, 100)}..."`);
      }
      console.log('  DEPOIS proposto:');
      for (const a of d.acoesPropostas) console.log(`    → ${a}`);
    }

    if (!apply) {
      console.log(
        `\n🔍 DRY-RUN — nada foi alterado. Rode com \`--apply\` pra executar.`,
      );
      return;
    }

    console.log('\n─── APLICANDO (helper PER-STEP idempotente) ──────────────');
    let sucessos = 0;
    let falhas = 0;
    const resultados: Array<{ membroId: string; nome: string; resultado: unknown; erro?: string }> = [];
    for (const d of parciais) {
      try {
        const r = await builder.construirMembroCompleto({
          cooperadoId: d.cooperadoId,
          convenioId: d.convenioId,
          cooperativaId: d.cooperativaId,
        });
        sucessos++;
        resultados.push({ membroId: d.membroId, nome: d.cooperadoNome, resultado: r });
        console.log(
          `  ✅ ${d.cooperadoNome}: ativado=${r.cooperadoAtivado} contratoCriado=${r.contratoCriado} ` +
            `clube=${r.clubeMatriculado} pendencia=${r.pendenciaMotor ? 'sim' : 'não'}`,
        );
      } catch (err: unknown) {
        falhas++;
        const msg = err instanceof Error ? err.message : 'erro';
        resultados.push({ membroId: d.membroId, nome: d.cooperadoNome, resultado: null, erro: msg });
        console.error(`  ❌ ${d.cooperadoNome}: ${msg}`);
      }
    }

    console.log(`\n═══ RESUMO ═══`);
    console.log(`Sucessos: ${sucessos}`);
    console.log(`Falhas: ${falhas}`);
  } finally {
    await app.close();
  }
}

main().catch((e) => {
  console.error('FATAL:', e);
  process.exit(1);
});
