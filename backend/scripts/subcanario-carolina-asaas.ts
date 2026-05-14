/* Sub-canário CAROLINA — Asaas sandbox + ngrok + WA + email E2E.
   Fase 4: substitui contatos (regra inegociável) + reverte cobrança.
   Fase 5: dispara emitirCobranca via GatewayPagamentoService.
   Fase 6: valida estado pós-disparo + lista notificações criadas. */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { GatewayPagamentoService } from '../src/gateway-pagamento/gateway-pagamento.service';
import { PrismaService } from '../src/prisma.service';

const COOPEREBR = 'cmn0ho8bx0000uox8wu96u6fd';
const CAROLINA_ID = 'cmp4ktvwm0006va3kq4h52kff';
const CTR_CAROLINA = 'cmp4ktx2p000fva3kd5t47u3q';
const COBRANCA_CAROLINA = 'cmp4ktyvi000lva3kzal4mcrt';

async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('Sub-canário CAROLINA Asaas+WA+email E2E (sandbox+ngrok)');
  console.log('═══════════════════════════════════════════════════════\n');

  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn', 'log'] });
  const prisma = app.get(PrismaService);
  const gateway = app.get(GatewayPagamentoService);

  // ─────────── FASE 4 — UPDATE contatos + reverter cobrança ───────────
  console.log('FASE 4 — Substituir contatos (regra inegociável) + reverter cobrança\n');

  const antes = await prisma.cooperado.findUnique({
    where: { id: CAROLINA_ID },
    select: { email: true, telefone: true, ambienteTeste: true, nomeCompleto: true, cpf: true },
  });
  console.log('Antes:', JSON.stringify(antes, null, 2));

  await prisma.$transaction([
    prisma.cooperado.update({
      where: { id: CAROLINA_ID },
      data: {
        // Refinamento 14/05: alias Gmail +suffix porque Luciano-cooperado
        // já ocupa lucbragatto@gmail.com (unique constraint).
        email: 'lucbragatto+carolina@gmail.com',
        telefone: '27981341348',
        ambienteTeste: false,
      },
    }),
    prisma.cobranca.updateMany({
      where: { id: COBRANCA_CAROLINA, status: 'PAGO' },
      data: { status: 'A_VENCER', dataPagamento: null, valorPago: null },
    }),
  ]);

  const depois = await prisma.cooperado.findUnique({
    where: { id: CAROLINA_ID },
    select: { email: true, telefone: true, ambienteTeste: true },
  });
  console.log('Depois:', JSON.stringify(depois, null, 2));

  const cobAntes = await prisma.cobranca.findUnique({
    where: { id: COBRANCA_CAROLINA },
    select: { id: true, status: true, valorLiquido: true, dataVencimento: true, modeloCobrancaUsado: true },
  });
  console.log('Cobrança CAROLINA pós-revert:', JSON.stringify(cobAntes, null, 2));

  // ─────────── FASE 5 — Disparar emitirCobranca ───────────
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('FASE 5 — emitirCobranca via GatewayPagamentoService');
  console.log('═══════════════════════════════════════════════════════\n');

  if (!cobAntes) throw new Error('Cobrança CAROLINA não encontrada');

  const venc = cobAntes.dataVencimento.toISOString().slice(0, 10);
  console.log(`Disparando cobrança ${COBRANCA_CAROLINA}:`);
  console.log(`  valor=R$ ${cobAntes.valorLiquido}`);
  console.log(`  vencimento=${venc}`);
  console.log(`  forma=BOLETO`);
  console.log(`  cooperadoId=${CAROLINA_ID} (CAROLINA LEMOS CRAVO)\n`);

  try {
    const resultado = await gateway.emitirCobranca(CAROLINA_ID, COOPEREBR, {
      valor: Number(cobAntes.valorLiquido),
      vencimento: venc,
      descricao: `Mensalidade SISGD ${String(new Date().getMonth() + 1).padStart(2, '0')}/${new Date().getFullYear()} - CTR-2026-0005`,
      formaPagamento: 'BOLETO',
      cobrancaId: COBRANCA_CAROLINA,
    });
    console.log('Resultado emitirCobranca:');
    console.log(JSON.stringify(resultado, null, 2));
  } catch (err: any) {
    console.error('\n🔴 EXCEÇÃO emitirCobranca:', err?.message ?? err);
    console.error(err?.stack ?? '');
    await app.close();
    process.exit(1);
  }

  // ─────────── FASE 6 — Validar estado pós-disparo ───────────
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('FASE 6 — Validação pós-disparo');
  console.log('═══════════════════════════════════════════════════════\n');

  // CobrancaGateway criado
  const cgs = await prisma.cobrancaGateway.findMany({
    where: { cobrancaId: COBRANCA_CAROLINA },
    select: { id: true, gateway: true, gatewayId: true, status: true, linkPagamento: true, boletoUrl: true, pixQrCode: true, formaPagamento: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
    take: 3,
  });
  console.log(`CobrancaGateway registros (${cgs.length}):`);
  cgs.forEach((c) => console.log(JSON.stringify({ ...c, pixQrCode: c.pixQrCode ? `<${c.pixQrCode.length}ch>` : null }, null, 2)));

  // AsaasCobranca criada
  const asaasCobs = await prisma.asaasCobranca.findMany({
    where: { cooperadoId: CAROLINA_ID },
    select: { id: true, asaasId: true, status: true, valor: true, formaPagamento: true, linkPagamento: true, pixQrCode: true, pixCopiaECola: true, createdAt: true, ultimoWebhookEventId: true },
    orderBy: { createdAt: 'desc' },
    take: 3,
  });
  console.log(`\nAsaasCobranca registros CAROLINA (${asaasCobs.length}):`);
  asaasCobs.forEach((a) => console.log(JSON.stringify({ ...a, pixQrCode: a.pixQrCode ? `<${a.pixQrCode.length}ch>` : null, pixCopiaECola: a.pixCopiaECola ? `<${a.pixCopiaECola.length}ch>` : null }, null, 2)));

  // Notificações criadas (últimos 10 min)
  const dezMin = new Date(Date.now() - 10 * 60 * 1000);
  const notifs = await prisma.notificacao.findMany({
    where: { cooperadoId: CAROLINA_ID, createdAt: { gte: dezMin } },
    select: { id: true, tipo: true, titulo: true, mensagem: true, link: true, lida: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  });
  console.log(`\nNotificações CAROLINA (${notifs.length}, últimos 10min):`);
  notifs.forEach((n) => console.log(`  - [${n.tipo}] ${n.titulo}: ${n.mensagem.slice(0, 80)}...`));

  // AsaasCustomer
  const customer = await prisma.asaasCustomer.findFirst({
    where: { cooperadoId: CAROLINA_ID },
    select: { id: true, asaasId: true, createdAt: true },
  });
  console.log(`\nAsaasCustomer:`, JSON.stringify(customer, null, 2));

  await app.close();
  console.log('\n✅ FASE 4+5+6 completas — aguardar logs PM2 pra WA/email + Luciano validar recebimento');
}

main().catch((e) => { console.error('ERRO TOP-LEVEL:', e); process.exit(1); });
