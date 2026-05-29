/**
 * Smoke BH.4 — Portal Proprietário + Flag Visibilidade.
 *
 * Cenários (8):
 *   1. Toggle flag=false na cooperativa → DB persiste false
 *   2. CooperativasService.findOne() retorna proprietarioVeDespesas=false
 *   3. ProprietarioService.meuParceiro(proprietario) retorna flag=false
 *   4. Toggle flag=true → DB persiste true
 *   5. ProprietarioService.meuParceiro retorna flag=true
 *   6. Proprietario com 0 usinas → meuParceiro retorna {nome:null,flag:false} (no throw)
 *   7. Multi-tenant: 2 cooperativas independentes (flags diferentes não vazam)
 *   8. ContasPagarService.proporDespesa(proprietario) cria status=PROPOSTA
 *
 * NÃO requer servidor HTTP rodando — usa AppModule direto.
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { CooperativasService } from '../src/cooperativas/cooperativas.service';
import { ProprietarioService } from '../src/proprietario/proprietario.service';
import { ContasPagarService } from '../src/contas-pagar/contas-pagar.service';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

let pass = 0;
let fail = 0;

function check(label: string, ok: boolean, detalhe = '') {
  if (ok) {
    console.log(`  ✅ ${label}${detalhe ? ' — ' + detalhe : ''}`);
    pass++;
  } else {
    console.log(`  ❌ ${label}${detalhe ? ' — ' + detalhe : ''}`);
    fail++;
  }
}

async function main() {
  console.log('═══ Smoke BH.4 — Portal Proprietário + Flag Visibilidade ═══\n');

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['warn', 'error'],
  });
  const cooperativas = app.get(CooperativasService);
  const proprietarioService = app.get(ProprietarioService);
  const contasPagar = app.get(ContasPagarService);

  // Acha uma cooperativa de teste com usina + proprietário
  const usinaComProp = await prisma.usina.findFirst({
    where: {
      OR: [
        { proprietarioCooperadoId: { not: null } },
        { proprietarioEmail: { not: null } },
      ],
    },
    select: {
      id: true,
      nome: true,
      cooperativaId: true,
      proprietarioEmail: true,
      proprietarioCooperadoId: true,
      cooperativa: { select: { id: true, nome: true, proprietarioVeDespesas: true } },
    },
  });

  if (!usinaComProp) {
    console.log('❌ Não há usina com proprietário no banco — smoke abortado.');
    await app.close();
    await prisma.$disconnect();
    process.exit(1);
  }

  const coopId = usinaComProp.cooperativaId!;
  const coopNome = usinaComProp.cooperativa!.nome;
  const flagOriginal = usinaComProp.cooperativa!.proprietarioVeDespesas ?? false;
  console.log(`Cooperativa-alvo: ${coopNome} (${coopId})`);
  console.log(`Usina-alvo: ${usinaComProp.nome} (${usinaComProp.id})`);
  console.log(`Flag original: ${flagOriginal}\n`);

  // Acha um Usuario real pra satisfazer FK ContaAPagar.propostoPorUsuarioId.
  const usuarioReal = await prisma.usuario.findFirst({
    where: { ativo: true },
    select: { id: true, email: true, perfil: true },
  });
  if (!usuarioReal) {
    console.log('❌ Sem Usuario ativo no banco — smoke abortado.');
    await app.close();
    await prisma.$disconnect();
    process.exit(1);
  }

  // Monta user mock pro proprietário
  const userProprietario: any = {
    perfil: 'PROPRIETARIO',
    email: usinaComProp.proprietarioEmail,
    cooperadoId: usinaComProp.proprietarioCooperadoId,
    userId: usuarioReal.id,
  };

  // ─── Cenário 1: toggle false ────────────────────────────
  console.log('--- Cenário 1: toggle flag=false ---');
  try {
    const r = await cooperativas.toggleProprietarioVeDespesas(coopId, false);
    check('Toggle retorna objeto', !!r, `flag=${r.proprietarioVeDespesas}`);
    const dbRow = await prisma.cooperativa.findUnique({
      where: { id: coopId },
      select: { proprietarioVeDespesas: true },
    });
    check('DB persistiu false', dbRow?.proprietarioVeDespesas === false);
  } catch (e: any) {
    check('Toggle false', false, e.message);
  }

  // ─── Cenário 2: findOne reflete false ──────────────────
  console.log('\n--- Cenário 2: findOne reflete flag=false ---');
  try {
    const c = await cooperativas.findOne(coopId);
    check('findOne retorna flag=false', (c as any).proprietarioVeDespesas === false);
  } catch (e: any) {
    check('findOne', false, e.message);
  }

  // ─── Cenário 3: meuParceiro reflete false ──────────────
  console.log('\n--- Cenário 3: meuParceiro reflete flag=false ---');
  try {
    const r = await proprietarioService.meuParceiro(userProprietario);
    check('meuParceiro retorna flag=false', r.proprietarioVeDespesas === false, `nome=${r.nome}`);
  } catch (e: any) {
    check('meuParceiro', false, e.message);
  }

  // ─── Cenário 4: toggle true ────────────────────────────
  console.log('\n--- Cenário 4: toggle flag=true ---');
  try {
    const r = await cooperativas.toggleProprietarioVeDespesas(coopId, true);
    check('Toggle retorna flag=true', r.proprietarioVeDespesas === true);
    const dbRow = await prisma.cooperativa.findUnique({
      where: { id: coopId },
      select: { proprietarioVeDespesas: true },
    });
    check('DB persistiu true', dbRow?.proprietarioVeDespesas === true);
  } catch (e: any) {
    check('Toggle true', false, e.message);
  }

  // ─── Cenário 5: meuParceiro reflete true ──────────────
  console.log('\n--- Cenário 5: meuParceiro reflete flag=true ---');
  try {
    const r = await proprietarioService.meuParceiro(userProprietario);
    check('meuParceiro retorna flag=true', r.proprietarioVeDespesas === true, `nome=${r.nome}`);
  } catch (e: any) {
    check('meuParceiro', false, e.message);
  }

  // ─── Cenário 6: proprietário sem usinas ────────────────
  console.log('\n--- Cenário 6: proprietário sem usinas ---');
  try {
    const userFake: any = {
      perfil: 'PROPRIETARIO',
      email: 'naoexiste-bh4-smoke@invalid.test',
      cooperadoId: null,
    };
    await proprietarioService.meuParceiro(userFake);
    check('meuParceiro sem usinas', false, 'Deveria lançar ForbiddenException');
  } catch (e: any) {
    check(
      'meuParceiro sem usinas lança ForbiddenException',
      e.name === 'ForbiddenException' || e.message?.includes('Nenhuma usina'),
      e.message,
    );
  }

  // ─── Cenário 7: multi-tenant isolation ─────────────────
  console.log('\n--- Cenário 7: multi-tenant isolation ---');
  const outraCoop = await prisma.cooperativa.findFirst({
    where: { id: { not: coopId } },
    select: { id: true, nome: true, proprietarioVeDespesas: true },
  });
  if (outraCoop) {
    try {
      // Toggla outra coop pra false, garante que coop atual ficou true
      await cooperativas.toggleProprietarioVeDespesas(outraCoop.id, false);
      const dbA = await prisma.cooperativa.findUnique({
        where: { id: coopId },
        select: { proprietarioVeDespesas: true },
      });
      const dbB = await prisma.cooperativa.findUnique({
        where: { id: outraCoop.id },
        select: { proprietarioVeDespesas: true },
      });
      check(
        'Flags independentes entre cooperativas',
        dbA?.proprietarioVeDespesas === true && dbB?.proprietarioVeDespesas === false,
        `${coopNome}=${dbA?.proprietarioVeDespesas}, ${outraCoop.nome}=${dbB?.proprietarioVeDespesas}`,
      );
      // restaura outra coop
      await cooperativas.toggleProprietarioVeDespesas(
        outraCoop.id,
        outraCoop.proprietarioVeDespesas ?? false,
      );
    } catch (e: any) {
      check('Multi-tenant isolation', false, e.message);
    }
  } else {
    check('Multi-tenant (skip)', true, 'Apenas 1 cooperativa no banco');
  }

  // ─── Cenário 8: proprietário propõe despesa → PROPOSTA ─
  console.log('\n--- Cenário 8: proprietário propõe despesa ---');
  try {
    const dto: any = {
      usinaId: usinaComProp.id,
      dataOcorrencia: new Date().toISOString().slice(0, 10),
      categoria: 'MANUTENCAO_PREVENTIVA',
      valor: 1234.56,
      descricao: 'Smoke BH.4 — proposta proprietário (DELETAR DEPOIS)',
      quemPagouTipo: 'PROPRIETARIO',
      tratamento: 'REEMBOLSO',
    };
    const proposta: any = await contasPagar.proporDespesa(
      dto,
      usuarioReal.id,
      'PROPRIETARIO',
      null, // cooperativaId — proprietário não tem no JWT
      { email: userProprietario.email, cooperadoId: userProprietario.cooperadoId },
    );
    check(
      'proporDespesa cria statusAprovacao=PROPOSTA',
      proposta.statusAprovacao === 'PROPOSTA',
      `id=${proposta.id} status=${proposta.statusAprovacao}`,
    );
    // cleanup
    await prisma.contaAPagar.delete({ where: { id: proposta.id } }).catch(() => undefined);
  } catch (e: any) {
    check('proporDespesa', false, e.message);
  }

  // ─── Cenário 9: PROPRIETÁRIO de outra usina → Forbidden ─
  console.log('\n--- Cenário 9: PROPRIETÁRIO alheio bloqueado (IDOR guard) ---');
  try {
    const dto: any = {
      usinaId: usinaComProp.id,
      dataOcorrencia: new Date().toISOString().slice(0, 10),
      categoria: 'MANUTENCAO_PREVENTIVA',
      valor: 99.99,
      descricao: 'Smoke BH.4 — tentativa IDOR (NÃO deveria criar)',
      quemPagouTipo: 'PROPRIETARIO',
      tratamento: 'REEMBOLSO',
    };
    await contasPagar.proporDespesa(
      dto,
      usuarioReal.id,
      'PROPRIETARIO',
      null,
      { email: 'attacker-naoexiste@invalid.test', cooperadoId: null },
    );
    check('IDOR guard', false, 'Deveria lançar ForbiddenException');
  } catch (e: any) {
    check(
      'PROPRIETÁRIO sem vínculo é bloqueado',
      e.name === 'ForbiddenException' || e.message?.includes('proprietário'),
      e.message,
    );
  }

  // restaura flag original
  await cooperativas
    .toggleProprietarioVeDespesas(coopId, flagOriginal)
    .catch(() => undefined);

  console.log(`\n═══ Resultado: ${pass} ✅ / ${fail} ❌ ═══`);
  await app.close();
  await prisma.$disconnect();
  process.exit(fail > 0 ? 1 : 0);
}

main().catch(async (err) => {
  console.error('Smoke crashed:', err);
  await prisma.$disconnect();
  process.exit(1);
});
