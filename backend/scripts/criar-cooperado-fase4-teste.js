/**
 * Smoke setup — Sub-Fase 1 Fase 4 (M12, 18/05/2026)
 *
 * Cria cooperado PJ teste em Cooperebr2 com contrato PENDENTE_ATIVACAO
 * pra validar o trigger ativação + WA/email cooperado homologado.
 *
 * Email/telefone do banco são DIFERENTES dos overrides do listener
 * pra que o smoke valide visivelmente o override (logs vão mostrar
 * original vs envio diferentes).
 *
 * Flag ambienteTeste=true (LGPD).
 */
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  const coop = await prisma.cooperativa.findFirst({
    where: { nome: { contains: 'CoopereBR', not: { contains: 'Teste' } } },
    select: { id: true, nome: true },
  });
  if (!coop) {
    throw new Error('Cooperativa CoopereBR não encontrada (não-Teste)');
  }
  console.log(`Cooperativa: ${coop.nome} (${coop.id})`);

  const usina = await prisma.usina.findFirst({
    where: { apelidoInterno: 'cooperebr2', cooperativaId: coop.id },
    select: { id: true, nome: true, apelidoInterno: true, capacidadeKwh: true },
  });
  if (!usina) {
    throw new Error('Usina Cooperebr2 não encontrada na CoopereBR');
  }
  console.log(`Usina: ${usina.nome} (${usina.id}) — ${usina.capacidadeKwh} kWh/mês`);

  // Idempotência: se já existe cooperado teste fase 4, reaproveita
  let cooperado = await prisma.cooperado.findUnique({
    where: { cpf: '99.999.999/0001-99' },
    select: { id: true, nomeCompleto: true, email: true, telefone: true },
  });
  if (cooperado) {
    console.log(`[idempotente] Cooperado já existe: ${cooperado.nomeCompleto} (${cooperado.id})`);
  } else {
    cooperado = await prisma.cooperado.create({
      data: {
        cooperativaId: coop.id,
        nomeCompleto: 'TESTE FASE 4 SCEE LTDA',
        cpf: '99.999.999/0001-99',
        email: 'lucbragatto+fase4banco@gmail.com',
        telefone: '+5511999990000',
        tipoPessoa: 'PJ',
        razaoSocial: 'TESTE FASE 4 SCEE LTDA',
        tipoCooperado: 'COM_UC',
        status: 'AGUARDANDO_CONCESSIONARIA',
        ambienteTeste: true,
      },
      select: { id: true, nomeCompleto: true, email: true, telefone: true },
    });
    console.log(`[criado] Cooperado: ${cooperado.nomeCompleto} (${cooperado.id})`);
  }

  // UC idempotente
  let uc = await prisma.uc.findUnique({
    where: { numero: 'UC-TESTE-FASE4-001' },
    select: { id: true, numero: true },
  });
  if (uc) {
    console.log(`[idempotente] UC já existe: ${uc.numero} (${uc.id})`);
  } else {
    uc = await prisma.uc.create({
      data: {
        numero: 'UC-TESTE-FASE4-001',
        endereco: 'Rua Teste Fase 4, 100',
        cidade: 'Linhares',
        estado: 'ES',
        distribuidora: 'EDP_ES',
        cooperadoId: cooperado.id,
        cooperativaId: coop.id,
      },
      select: { id: true, numero: true },
    });
    console.log(`[criado] UC: ${uc.numero} (${uc.id})`);
  }

  // Contrato — não tem unique por (cooperadoId, usinaId), número precisa ser único
  // Reusa se já existe contrato PENDENTE_ATIVACAO deste cooperado nesta usina
  let contrato = await prisma.contrato.findFirst({
    where: {
      cooperadoId: cooperado.id,
      usinaId: usina.id,
      status: { in: ['PENDENTE_ATIVACAO', 'ATIVO'] },
    },
    select: { id: true, numero: true, status: true, dataAtivacao: true },
  });
  if (contrato) {
    console.log(`[idempotente] Contrato já existe: ${contrato.numero} (${contrato.id}) status=${contrato.status} dataAtivacao=${contrato.dataAtivacao}`);
  } else {
    const numeroContrato = `CTR-FASE4-${Date.now().toString().slice(-7)}`;
    contrato = await prisma.contrato.create({
      data: {
        numero: numeroContrato,
        cooperadoId: cooperado.id,
        usinaId: usina.id,
        ucId: uc.id,
        cooperativaId: coop.id,
        status: 'PENDENTE_ATIVACAO',
        percentualUsina: 5,
        kwhContrato: 8350,
        kwhContratoAnual: 100200,
        kwhContratoMensal: 8350,
        percentualDesconto: 18,
        dataInicio: new Date(),
      },
      select: { id: true, numero: true, status: true },
    });
    console.log(`[criado] Contrato: ${contrato.numero} (${contrato.id}) status=${contrato.status}`);
  }

  console.log('\n========== IDs PARA SMOKE ==========');
  console.log(JSON.stringify({
    cooperativaId: coop.id,
    cooperativaNome: coop.nome,
    usinaId: usina.id,
    usinaNome: usina.nome,
    usinaApelido: usina.apelidoInterno,
    cooperadoId: cooperado.id,
    cooperadoNome: cooperado.nomeCompleto,
    cooperadoEmailBanco: cooperado.email,
    cooperadoTelefoneBanco: cooperado.telefone,
    ucId: uc.id,
    ucNumero: uc.numero,
    contratoId: contrato.id,
    contratoNumero: contrato.numero,
    contratoStatus: contrato.status,
  }, null, 2));
  console.log('\n========== OVERRIDES NO ENVIO (esperados nos logs) ==========');
  console.log('telefoneEnvio (override): 27981341348');
  console.log('emailEnvio (override): lucbragatto+fase4envio@gmail.com');
  console.log('motivo: TESTE_OVERRIDE_LUCIANO (NODE_ENV !== production)');

  await prisma.$disconnect();
})().catch(async (e) => {
  console.error('ERRO:', e);
  await prisma.$disconnect();
  process.exit(1);
});
