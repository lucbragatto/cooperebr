/**
 * Smoke AN.1 — RepassesProprietarioService no banco real.
 *
 * Cenários (6):
 *   1. criarPendente cria registro com snapshot de valores
 *   2. marcarPago transação atômica vincula despesa DESCONTO_NO_REPASSE existente
 *   3. Despesa abatida fica RESOLVIDA + repasseAbatidoId populado
 *   4. Race: 2ª marcarPago no mesmo repasse → 409
 *   5. Cancelar repasse PAGO → 409 (race guard)
 *   6. Unique constraint: criar 2º repasse no mesmo período → ConflictException
 *
 * Cleanup automático: deleta todos os registros criados.
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { RepassesProprietarioService } from '../src/repasses-proprietario/repasses-proprietario.service';
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
  console.log('═══ Smoke AN.1 — RepassesProprietarioService ═══\n');

  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['warn', 'error'] });
  const service = app.get(RepassesProprietarioService);

  // Setup: pega usina FIXO + cria despesa DESCONTO_NO_REPASSE PENDENTE no período-alvo
  const usina = await prisma.usina.findFirst({
    where: { formaPagamentoDono: { in: ['FIXO', 'PERCENTUAL', 'HIBRIDO'] }, cooperativaId: { not: null } },
    select: { id: true, nome: true, cooperativaId: true, valorAluguelFixo: true },
  });
  if (!usina) {
    console.log('❌ Sem usina elegível — abortado.');
    await app.close();
    await prisma.$disconnect();
    process.exit(1);
  }

  const admin = await prisma.usuario.findFirst({ where: { perfil: 'ADMIN', ativo: true }, select: { id: true } });
  if (!admin) {
    console.log('❌ Sem ADMIN — abortado.');
    process.exit(1);
  }

  // Período-alvo único pra evitar colisão com smokes anteriores
  const periodoInicio = new Date(2099, 0, 1);
  const periodoFim = new Date(2099, 0, 31, 23, 59, 59);
  console.log(`Usina-alvo: ${usina.nome} (${usina.id})`);
  console.log(`Período-alvo: ${periodoInicio.toISOString().slice(0, 10)} → ${periodoFim.toISOString().slice(0, 10)}\n`);

  // Despesa DESCONTO_NO_REPASSE fake no período
  const despFake = await prisma.contaAPagar.create({
    data: {
      cooperativaId: usina.cooperativaId!,
      usinaId: usina.id,
      descricao: 'SMOKE_AN1_DESPESA_FAKE — DELETAR',
      categoria: 'CUSD',
      valor: 250,
      dataVencimento: new Date(2099, 0, 15),
      dataOcorrencia: new Date(2099, 0, 15),
      statusAprovacao: 'APROVADA',
      statusResolucao: 'PENDENTE',
      tratamento: 'DESCONTO_NO_REPASSE',
      quemPagouTipo: 'PARCEIRO',
      responsavelPagamento: 'PARCEIRO',
    },
  });

  // ─── C1: criarPendente ─────────────────────────────────
  console.log('--- C1: criarPendente ---');
  const r1 = await service.criarPendente({
    cooperativaId: usina.cooperativaId!,
    usinaId: usina.id,
    periodoInicio,
    periodoFim,
    valorBruto: 1000,
    valorLiquido: 750, // 1000 - 250 (despesa fake)
    totalDespesasAbatidas: 250,
  });
  check('Criou PENDENTE', r1.status === 'PENDENTE', `id=${r1.id} valorBruto=${r1.valorBruto} valorLiquido=${r1.valorLiquido}`);

  // ─── C2: marcarPago transação atômica ──────────────────
  console.log('\n--- C2: marcarPago transação atômica ---');
  const r2 = await service.marcarPago(
    r1.id,
    { metodoPagamento: 'PIX' as any, dataPagamento: new Date().toISOString().slice(0, 10) },
    admin!.id,
    usina.cooperativaId!,
    'ADMIN',
  );
  check('Status PAGO', r2.status === 'PAGO', `metodo=${r2.metodoPagamento}`);
  check('registradoPorUsuarioId populado', r2.registradoPorUsuarioId === admin!.id);

  // ─── C3: Despesa abatida ───────────────────────────────
  console.log('\n--- C3: Despesa vinculada ao repasse ---');
  const despAtualizada = await prisma.contaAPagar.findUnique({
    where: { id: despFake.id },
    select: { statusResolucao: true, resolvidoEm: true, repasseAbatidoId: true },
  });
  check(
    'Despesa statusResolucao=RESOLVIDA',
    despAtualizada?.statusResolucao === 'RESOLVIDA',
    `repasseAbatidoId=${despAtualizada?.repasseAbatidoId}`,
  );
  check(
    'Despesa repasseAbatidoId aponta pro repasse',
    despAtualizada?.repasseAbatidoId === r1.id,
  );

  // ─── C4: Race condition ─────────────────────────────────
  console.log('\n--- C4: marcarPago 2x → 409 Conflict ---');
  try {
    await service.marcarPago(
      r1.id,
      { metodoPagamento: 'TED' as any, dataPagamento: new Date().toISOString().slice(0, 10) },
      admin!.id,
      usina.cooperativaId!,
      'ADMIN',
    );
    check('Race guard', false, 'deveria lançar Conflict');
  } catch (e: any) {
    check(
      '2ª marcarPago → ConflictException',
      e.name === 'ConflictException' || e.message?.includes('PENDENTE'),
      e.message,
    );
  }

  // ─── C5: Cancelar repasse PAGO → 409 ───────────────────
  console.log('\n--- C5: Cancelar PAGO → 409 ---');
  try {
    await service.cancelar(r1.id, { motivo: 'tarde demais' }, admin!.id, usina.cooperativaId!, 'ADMIN');
    check('Cancelar PAGO bloqueado', false, 'deveria lançar Conflict');
  } catch (e: any) {
    check(
      'Cancelar PAGO → ConflictException',
      e.name === 'ConflictException' || e.message?.includes('PENDENTE'),
      e.message,
    );
  }

  // ─── C6: Unique constraint ─────────────────────────────
  console.log('\n--- C6: Criar 2º repasse mesmo período → 409 ---');
  try {
    await service.criarPendente({
      cooperativaId: usina.cooperativaId!,
      usinaId: usina.id,
      periodoInicio,
      periodoFim,
      valorBruto: 999,
      valorLiquido: 999,
      totalDespesasAbatidas: 0,
    });
    check('Unique constraint', false, 'deveria lançar Conflict');
  } catch (e: any) {
    check(
      'Unique constraint → ConflictException',
      e.name === 'ConflictException' || e.message?.includes('já existe'),
      e.message,
    );
  }

  // ─── Cleanup ───────────────────────────────────────────
  console.log('\n--- Cleanup ---');
  await prisma.contaAPagar
    .update({
      where: { id: despFake.id },
      data: { repasseAbatidoId: null }, // desvincula antes de deletar repasse
    })
    .catch(() => undefined);
  await prisma.repasseProprietario.delete({ where: { id: r1.id } }).catch(() => undefined);
  await prisma.contaAPagar.delete({ where: { id: despFake.id } }).catch(() => undefined);
  console.log('  Cleanup: 1 repasse + 1 despesa removidos');

  console.log(`\n═══ Resultado: ${pass} ✅ / ${fail} ❌ ═══`);
  await app.close();
  await prisma.$disconnect();
  process.exit(fail > 0 ? 1 : 0);
}

main().catch(async (e) => {
  console.error('Smoke crashed:', e?.message ?? e);
  await prisma.$disconnect();
  process.exit(1);
});
