/**
 * Script ad-hoc Fase 6 (D-J resolver D-30Y) — cria proposta de teste com token ativo
 * pra exercitar /aprovar-proposta?token=... e validar os 4 valores de economia
 * projetada (Fase C.3).
 *
 * Não chama Motor.calcular() (que precisa de tarifa concessionária e config motor —
 * complexidade desnecessária pra teste). Em vez disso, usa o cenário canônico #1 da
 * Fase B.5 com valores fixos:
 *
 *   FIXO_MENSAL + KWH_CHEIO + 15% + 500 kWh/mês + valorCheio 1.02:
 *   valorBruto    = 510.00
 *   valorLiquido  = 433.50
 *   economiaMes   = 76.50
 *   economiaAnual = 918.00
 *   economia5Anos = 4590.00   (calculado on-the-fly pelo endpoint, Commit 4)
 *   economia15Anos = 13770.00 (idem)
 *
 * Cooperado teste é claramente sintético (CPF fake, email @removido.invalid).
 * Vive na CoopereBR Teste (cmn7qygzg0000uoawdtfvokt5) — não polui produção.
 *
 * Rodar: cd backend ; npx ts-node --transpile-only scripts/criar-proposta-teste-c3.ts
 *
 * Cleanup manual (após validação): deletar Cooperado teste pelo id impresso —
 * cascata limpa UC e Proposta.
 */
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();

const COOPERATIVA_TESTE_ID = 'cmn7qygzg0000uoawdtfvokt5'; // CoopereBR Teste

async function main() {
  const coop = await prisma.cooperativa.findUnique({
    where: { id: COOPERATIVA_TESTE_ID },
    select: { id: true, nome: true },
  });
  if (!coop) {
    console.error(`Cooperativa Teste ${COOPERATIVA_TESTE_ID} não encontrada`);
    process.exit(1);
  }
  console.log(`Cooperativa alvo: ${coop.nome} (${coop.id})`);

  // Plano da CoopereBR Teste ou global FIXO_MENSAL
  const plano = await prisma.plano.findFirst({
    where: {
      OR: [{ cooperativaId: COOPERATIVA_TESTE_ID }, { cooperativaId: null }],
      modeloCobranca: 'FIXO_MENSAL',
      ativo: true,
    },
    orderBy: { createdAt: 'asc' },
  });
  if (!plano) {
    console.error('Nenhum plano FIXO_MENSAL ativo encontrado pra CoopereBR Teste / global');
    process.exit(1);
  }
  console.log(`Plano alvo: ${plano.nome} (id=${plano.id}, ${plano.modeloCobranca})`);

  // Cooperado sintético
  const stamp = Date.now().toString().slice(-6);
  const emailFake = `teste-c3-${stamp}@removido.invalid`;
  const cpfFake = `${stamp}11111`.slice(0, 11); // 11 chars com timestamp → único
  const cooperadoNome = `Cooperado Teste C3 ${stamp}`;

  const cooperado = await prisma.cooperado.create({
    data: {
      nomeCompleto: cooperadoNome,
      cpf: cpfFake,
      email: emailFake,
      telefone: '+5511000000000',
      status: 'PENDENTE',
      cooperativaId: COOPERATIVA_TESTE_ID,
      tipoCooperado: 'COM_UC',
      tipoPessoa: 'PF',
      ambienteTeste: true,
    },
  });
  console.log(`Cooperado criado: id=${cooperado.id} nome="${cooperadoNome}"`);

  // UC mínima (não precisa pra proposta, mas mantém integridade pra eventual aceite)
  const uc = await prisma.uc.create({
    data: {
      numero: `TESTE-C3-${stamp}`,
      numeroUC: `999${stamp}`,
      cooperadoId: cooperado.id,
      endereco: 'Rua de Teste, 0',
      cidade: 'Vitoria',
      estado: 'ES',
      distribuidora: 'EDP_ES',
      cooperativaId: COOPERATIVA_TESTE_ID,
    },
  });
  console.log(`UC criada: id=${uc.id} numero=${uc.numero}`);

  // Proposta com cenário canônico Fase B.5 #1 (FIXO + KWH_CHEIO + 15%)
  // valorBruto 510, valorLiquido 433.50, economia 76.50/mês
  const economiaMensal = 76.5;
  const economiaAnual = 918.0;
  const tokenAprovacao = randomUUID();
  const validaAte = new Date();
  validaAte.setDate(validaAte.getDate() + 30);

  const proposta = await prisma.propostaCooperado.create({
    data: {
      cooperadoId: cooperado.id,
      cooperativaId: COOPERATIVA_TESTE_ID,
      mesReferencia: new Date().toISOString().slice(0, 7),
      kwhMesRecente: 500,
      valorMesRecente: 510,
      kwhMedio12m: 500,
      valorMedio12m: 510,
      outlierDetectado: false,
      tusdUtilizada: 0.46863,
      teUtilizada: 0.32068,
      tarifaUnitSemTrib: 0.78931,
      kwhApuradoBase: 500,
      baseUtilizada: 'MES_RECENTE',
      descontoPercentual: 15,
      descontoAbsoluto: 0.153,
      kwhContrato: 500,
      valorCooperado: 0.867, // 1.02 × (1 - 0.15)
      economiaAbsoluta: 76.5,
      economiaPercentual: 15,
      economiaMensal,
      economiaAnual,
      mesesEquivalentes: 0.85,
      mediaCooperativaKwh: 500,
      resultadoVsMedia: 0,
      opcaoEscolhida: 'MES_RECENTE',
      status: 'PENDENTE',
      planoId: plano.id,
      validaAte,
      tokenAprovacao,
    },
  });

  const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:3001';
  const linkAprovacao = `${frontendUrl}/aprovar-proposta?token=${tokenAprovacao}`;

  console.log('');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('PROPOSTA CRIADA — pronto pra validação visual Fase 6.3');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`Proposta id:       ${proposta.id}`);
  console.log(`Cooperado id:      ${cooperado.id}`);
  console.log(`UC id:             ${uc.id}`);
  console.log(`Cooperativa:       ${coop.nome}`);
  console.log(`Plano:             ${plano.nome}`);
  console.log(`Token completo:    ${tokenAprovacao}`);
  console.log('');
  console.log(`URL pronta (incognito):`);
  console.log(`  ${linkAprovacao}`);
  console.log('');
  console.log('Valores esperados na tela:');
  console.log(`  Economia mensal:  R$ 76,50`);
  console.log(`  1 ano:            R$ 918,00`);
  console.log(`  5 anos:           R$ 4.590,00`);
  console.log(`  15 anos:          R$ 13.770,00`);
  console.log('');
  console.log('Cleanup (após validação):');
  console.log(`  DELETE: cooperado=${cooperado.id} → cascata limpa UC + Proposta`);
  console.log('═══════════════════════════════════════════════════════════════');

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('ERRO:', err.message ?? err);
  process.exit(1);
});
