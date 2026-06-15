/**
 * QA Funcional 2026-05-18 — script read-only
 *
 * Consulta:
 * 1. AuditLog últimos 50 entries (D-30N status)
 * 2. ConfigTenant chaves do Bloco D (esperar 9)
 * 3. EnvioListaConcessionaria entries (estado Sub-Fase 1)
 * 4. Reprodução D-novo-I timezone (createdAt em UTC)
 * 5. Sanity Cooperebr2 (apelidoInterno único)
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('\n========================');
  console.log('1. AUDITLOG — últimos 50');
  console.log('========================');
  try {
    const logs = await prisma.$queryRawUnsafe<any[]>(
      `SELECT id, "userId", acao, recurso, "recursoId", "createdAt" FROM audit_log ORDER BY "createdAt" DESC LIMIT 50`,
    );
    console.log(`Total no recorte: ${logs.length}`);
    if (logs.length > 0) {
      console.log('Top 10:');
      logs.slice(0, 10).forEach((l, i) => {
        console.log(
          `  ${i + 1}. [${l.createdAt?.toISOString?.() ?? l.createdAt}] ${l.acao} | recurso=${l.recurso} | recursoId=${l.recursoId ?? '-'} | userId=${l.userId ?? '-'}`,
        );
      });
    } else {
      console.log('VAZIO. D-30N: tabela existe, interceptor pode estar inativo OU sistema ocioso.');
    }
  } catch (e: any) {
    console.log(`ERRO: ${e.message}`);
  }

  console.log('\n========================');
  console.log('2. CONFIG TENANT — chaves Bloco D');
  console.log('========================');
  try {
    const cfg = await prisma.$queryRawUnsafe<any[]>(
      `SELECT "cooperativaId", chave, valor FROM configuracoes_tenant WHERE chave LIKE 'cron.%' OR chave LIKE 'lembrete.%' ORDER BY "cooperativaId", chave`,
    );
    console.log(`Total: ${cfg.length}`);
    cfg.forEach((c) => {
      console.log(`  tenant=${c.cooperativaId} | ${c.chave} = ${JSON.stringify(c.valor)}`);
    });
    if (cfg.length !== 9 && cfg.length !== 18) {
      console.log(`⚠️ Esperado 9 (1 tenant) ou múltiplos de 9. Encontrado ${cfg.length}.`);
    }
  } catch (e: any) {
    console.log(`ERRO: ${e.message}`);
  }

  console.log('\n========================');
  console.log('3. ENVIO LISTA CONCESSIONARIA — entries');
  console.log('========================');
  try {
    const envios = await prisma.$queryRawUnsafe<any[]>(
      `SELECT id, "numeroInterno", status, "cooperativaId", "usinaId", "geradaEm", "validadaEm", "enviadaEm", "protocoloEm", "numeroProtocoloConcessionaria", "liberadaEm" FROM envios_lista_concessionaria ORDER BY "geradaEm" DESC LIMIT 20`,
    );
    console.log(`Total no recorte: ${envios.length}`);
    envios.forEach((e, i) => {
      console.log(
        `  ${i + 1}. ${e.numeroInterno} | status=${e.status} | tenant=${e.cooperativaId} | gerada=${e.geradaEm?.toISOString?.() ?? e.geradaEm} | protocolada=${e.protocoloEm?.toISOString?.() ?? e.protocoloEm}`,
      );
    });
  } catch (e: any) {
    console.log(`ERRO: ${e.message}`);
  }

  console.log('\n========================');
  console.log('4. D-NOVO-I — timezone check');
  console.log('========================');
  console.log('Verificar se datas armazenadas em UTC e renderizadas em pt-BR (BRT/BRST) batem.');
  console.log(`Process now: ${new Date().toISOString()} (UTC) | ${new Date().toString()} (local)`);
  console.log(
    `Offset Brasil: ${new Date().getTimezoneOffset()} min (deveria ser +180 = UTC-3 BRT)`,
  );
  try {
    const sample = await prisma.$queryRawUnsafe<any[]>(
      `SELECT id, "numeroInterno", "protocoloEm" FROM envios_lista_concessionaria WHERE "protocoloEm" IS NOT NULL LIMIT 3`,
    );
    sample.forEach((s) => {
      const utc = (s.protocoloEm as Date)?.toISOString?.();
      const localPtBr = (s.protocoloEm as Date)?.toLocaleString?.('pt-BR', {
        dateStyle: 'short',
        timeStyle: 'short',
        timeZone: 'America/Sao_Paulo',
      });
      const localPtBrSemTz = (s.protocoloEm as Date)?.toLocaleString?.('pt-BR', {
        dateStyle: 'short',
        timeStyle: 'short',
      });
      console.log(
        `  ${s.numeroInterno} | UTC armazenado: ${utc} | toLocaleString pt-BR (com TZ): ${localPtBr} | toLocaleString pt-BR (sem TZ explícito): ${localPtBrSemTz}`,
      );
    });
  } catch (e: any) {
    console.log(`ERRO: ${e.message}`);
  }

  console.log('\n========================');
  console.log('5. Sanity Cooperebr2 — apelidoInterno único');
  console.log('========================');
  try {
    const dupli = await prisma.$queryRawUnsafe<any[]>(
      `SELECT "apelidoInterno", COUNT(*) AS c FROM usinas WHERE "apelidoInterno" IS NOT NULL GROUP BY "apelidoInterno" HAVING COUNT(*) > 1`,
    );
    if (dupli.length === 0) {
      console.log('OK — nenhum apelidoInterno duplicado.');
    } else {
      console.log('⚠️ Duplicações:');
      dupli.forEach((d) => console.log(`  ${d.apelidoInterno}: ${d.c}`));
    }
  } catch (e: any) {
    console.log(`ERRO: ${e.message}`);
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
