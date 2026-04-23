/**
 * Teste E2E real — Sprint 9
 * Roda: cd backend && node scripts/teste-e2e-sprint9.js
 */
const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');
const axios = require('axios');

const p = new PrismaClient();
const COOPEREBR_ID = 'cmn0ho8bx0000uox8wu96u6fd';

function getEncryptKey() {
  return crypto.createHash('sha256').update(process.env.ASAAS_ENCRYPT_KEY).digest();
}
function decrypt(encrypted) {
  const parts = encrypted.split(':');
  if (parts.length !== 3) return encrypted;
  try {
    const d = crypto.createDecipheriv('aes-256-gcm', getEncryptKey(), Buffer.from(parts[0], 'hex'));
    d.setAuthTag(Buffer.from(parts[2], 'hex'));
    return d.update(Buffer.from(parts[1], 'hex')) + d.final('utf8');
  } catch { return encrypted; }
}

async function main() {
  console.log('=== TESTE E2E REAL — SPRINT 9 ===\n');

  // 1. Cooperado teste CLUBE
  console.log('--- PASSO 1: Cooperado teste ---');
  let testCoop = await p.cooperado.findFirst({
    where: { nomeCompleto: 'TESTE E2E CLUBE SPRINT9', cooperativaId: COOPEREBR_ID },
  });
  if (!testCoop) {
    testCoop = await p.cooperado.create({
      data: {
        nomeCompleto: 'TESTE E2E CLUBE SPRINT9',
        cpf: '52998224725',
        email: 'teste.e2e.clube@cooperebr.test',
        telefone: '27999998888',
        status: 'ATIVO',
        modoRemuneracao: 'CLUBE',
        cooperativaId: COOPEREBR_ID,
      },
    });
    console.log('Cooperado criado: ' + testCoop.id);
  } else {
    console.log('Cooperado existente: ' + testCoop.id);
  }

  // 2. UC + Contrato
  console.log('\n--- PASSO 2: UC + Contrato ---');
  let uc = await p.uc.findFirst({ where: { cooperadoId: testCoop.id } });
  if (!uc) {
    uc = await p.uc.create({
      data: {
        numero: 'UC-E2E-' + Date.now(),
        endereco: 'Rua Teste E2E 123',
        cidade: 'Vitória',
        estado: 'ES',
        cooperadoId: testCoop.id,
        cooperativaId: COOPEREBR_ID,
      },
    });
    console.log('UC criada: ' + uc.id);
  } else {
    console.log('UC existente: ' + uc.id);
  }

  let contrato = await p.contrato.findFirst({ where: { cooperadoId: testCoop.id, status: 'ATIVO' } });
  if (!contrato) {
    contrato = await p.contrato.create({
      data: {
        numero: 'CTR-E2E-' + Date.now(),
        cooperadoId: testCoop.id,
        cooperativaId: COOPEREBR_ID,
        ucId: uc.id,
        dataInicio: new Date(),
        percentualDesconto: 20,
        kwhContrato: 500,
        status: 'ATIVO',
      },
    });
    console.log('Contrato: ' + contrato.numero);
  } else {
    console.log('Contrato existente: ' + contrato.numero);
  }

  // 3. ATIVO_RECEBENDO_CREDITOS
  console.log('\n--- PASSO 3: Ativar créditos ---');
  await p.cooperado.update({
    where: { id: testCoop.id },
    data: { status: 'ATIVO_RECEBENDO_CREDITOS', dataInicioCreditos: new Date() },
  });
  console.log('Status → ATIVO_RECEBENDO_CREDITOS');

  // 4. AsaasCustomer
  console.log('\n--- PASSO 4: AsaasCustomer ---');
  const config = await p.configGateway.findFirst({ where: { cooperativaId: COOPEREBR_ID, ativo: true } });
  const apiKey = decrypt(config.credenciais.apiKey);

  let asaasCust = await p.asaasCustomer.findUnique({ where: { cooperadoId: testCoop.id } });
  if (!asaasCust) {
    const { data: newCust } = await axios.post('https://sandbox.asaas.com/api/v3/customers', {
      name: testCoop.nomeCompleto,
      cpfCnpj: testCoop.cpf,
      email: testCoop.email,
    }, { headers: { access_token: apiKey }, timeout: 15000 });
    asaasCust = await p.asaasCustomer.create({ data: { cooperadoId: testCoop.id, asaasId: newCust.id } });
    console.log('AsaasCustomer: ' + newCust.id);
  } else {
    console.log('AsaasCustomer existente: ' + asaasCust.asaasId);
  }

  // 5. FormaPagamento
  const fpExiste = await p.formaPagamentoCooperado.findUnique({ where: { cooperadoId: testCoop.id } });
  if (!fpExiste) {
    await p.formaPagamentoCooperado.create({ data: { cooperadoId: testCoop.id, tipo: 'PIX', recorrente: true, ativo: true } });
    console.log('FormaPagamento: PIX');
  }

  // 6. Cobrança
  console.log('\n--- PASSO 5: Cobrança ---');
  const vencimento = new Date();
  vencimento.setDate(vencimento.getDate() + 10);

  const cobranca = await p.cobranca.create({
    data: {
      contratoId: contrato.id,
      mesReferencia: 6,
      anoReferencia: 2026,
      valorBruto: 500,
      percentualDesconto: 20,
      valorDesconto: 100,
      valorLiquido: 500,
      dataVencimento: vencimento,
      status: 'A_VENCER',
      cooperativaId: COOPEREBR_ID,
    },
  });
  console.log('Cobrança: R$500 (CLUBE, desconto R$100 vira tokens)');

  // 7. Emitir no Asaas
  console.log('\n--- PASSO 6: Asaas ---');
  const { data: payment } = await axios.post('https://sandbox.asaas.com/api/v3/payments', {
    customer: asaasCust.asaasId,
    billingType: 'PIX',
    value: 500,
    dueDate: vencimento.toISOString().split('T')[0],
    description: 'E2E Sprint 9 — CLUBE',
  }, { headers: { access_token: apiKey }, timeout: 15000 });
  console.log('Asaas: ' + payment.id + ' | ' + payment.status);

  let pixQr = null, pixCopiaECola = null;
  try {
    const { data: pixData } = await axios.get('https://sandbox.asaas.com/api/v3/payments/' + payment.id + '/pixQrCode', {
      headers: { access_token: apiKey }, timeout: 15000,
    });
    pixQr = pixData.encodedImage;
    pixCopiaECola = pixData.payload;
    console.log('QR PIX: OK (' + pixQr.length + ' chars)');
  } catch { console.log('QR PIX: não disponível'); }

  // CobrancaGateway + AsaasCobranca
  await p.cobrancaGateway.create({
    data: {
      cobrancaId: cobranca.id, cooperadoId: testCoop.id, gateway: 'ASAAS',
      gatewayId: payment.id, status: payment.status, valor: 500,
      vencimento, linkPagamento: payment.invoiceUrl, pixQrCode: pixQr,
      pixCopiaECola, formaPagamento: 'PIX',
    },
  });
  await p.asaasCobranca.create({
    data: {
      cobrancaId: cobranca.id, cooperadoId: testCoop.id, asaasId: payment.id,
      status: 'PENDING', valor: 500, vencimento, linkPagamento: payment.invoiceUrl,
      pixQrCode: pixQr, pixCopiaECola, formaPagamento: 'PIX',
    },
  });
  console.log('CobrancaGateway + AsaasCobranca salvas');

  // 8. Simular webhook via backend local
  console.log('\n--- PASSO 7: Webhook via darBaixa local ---');

  // Chamar darBaixa via evento pagamento.confirmado no backend
  // Como não temos acesso ao EventEmitter diretamente, simular via HTTP
  try {
    // Tentar dar baixa manualmente via endpoint (se existir)
    const resp = await axios.post('http://localhost:3000/cobrancas/' + cobranca.id + '/dar-baixa', {
      dataPagamento: new Date().toISOString(),
      valorPago: 500,
      metodoPagamento: 'PIX_ASAAS',
    }, {
      headers: { 'Authorization': 'Bearer test' },
      timeout: 10000,
    });
    console.log('darBaixa: ' + JSON.stringify(resp.data).substring(0, 100));
  } catch (err) {
    console.log('darBaixa HTTP falhou: ' + (err.response?.status || err.message));
    console.log('Simulando no banco direto...');

    // Fallback: simular no banco
    await p.cobranca.update({
      where: { id: cobranca.id },
      data: { status: 'PAGO', dataPagamento: new Date(), valorPago: 500 },
    });
    console.log('Cobrança → PAGO (direto no banco)');

    await p.lancamentoCaixa.create({
      data: {
        tipo: 'RECEITA', descricao: 'E2E Sprint 9 CLUBE pagamento',
        valor: 500, competencia: '2026-06', dataPagamento: new Date(),
        status: 'REALIZADO', cooperativaId: COOPEREBR_ID, cooperadoId: testCoop.id,
      },
    });
    console.log('LancamentoCaixa REALIZADO criado');
  }

  // 9. Verificação
  console.log('\n--- PASSO 8: Verificação ---');
  const cobFinal = await p.cobranca.findUnique({ where: { id: cobranca.id } });
  console.log('Cobrança status: ' + cobFinal.status);

  const lancamentos = await p.lancamentoCaixa.count({ where: { cooperadoId: testCoop.id } });
  console.log('LancamentoCaixa: ' + lancamentos);

  const saldo = await p.cooperTokenSaldo.findUnique({ where: { cooperadoId: testCoop.id } });
  console.log('Token saldo: ' + (saldo ? 'disp=' + saldo.saldoDisponivel + ', pend=' + saldo.saldoPendente : '(nenhum)'));

  const totalPagas = await p.cobranca.count({
    where: { contrato: { cooperadoId: testCoop.id }, status: 'PAGO' },
  });
  console.log('Faturas pagas: ' + totalPagas);

  console.log('\n=== RESUMO E2E ===');
  console.log('Cooperado CLUBE: ' + testCoop.nomeCompleto);
  console.log('Status: ATIVO_RECEBENDO_CREDITOS');
  console.log('Asaas: ' + payment.id);
  console.log('Link: ' + payment.invoiceUrl);
  console.log('Cobrança: ' + cobFinal.status);
  console.log('LancamentoCaixa: ' + lancamentos);
  console.log('Tokens: ' + (saldo ? 'disp=' + saldo.saldoDisponivel + ', pend=' + saldo.saldoPendente : 'nenhum'));
  console.log('\nNOTA: tokens CLUBE emitidos quando darBaixa() roda via NestJS.');
  console.log('Sem tunnel pro webhook, simulação no banco é o fallback.');

  await p.$disconnect();
}

main().catch(err => { console.error(err.message); process.exit(1); });
