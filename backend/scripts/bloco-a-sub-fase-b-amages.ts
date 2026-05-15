/**
 * Bloco A — Sub-Fase B AMAGES — passos 3-7.
 *
 * 3. Criar cooperado AMAGES PJ (CoopereBR)
 * 4. Criar UCs PUTIRI + SEDE ADM com dados reais das faturas EDP mar/2026
 * 5. Criar Plano AMAGES COMPENSADOS (publico=false, cooperativaId CoopereBR)
 * 6. Criar Contrato AMAGES <-> Usina Linhares
 * 7. Smoke engine COMPENSADOS: FaturaProcessada mar/2026 SEDE ADM ->
 *    gerarCobrancaPosFatura -> validar valorLiquido = kwhCompensado × tarifaContratual.
 *
 * Idempotente: cada passo verifica existência antes de criar.
 * Regra contatos teste: email/telefone do Luciano, NUNCA AMAGES real.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ─── Constantes AMAGES ─────────────────────────────────────────────
const AMAGES = {
  cnpj: '27053685000190', // sem formatação (padrão THEOMAX/sistema)
  razaoSocial: 'Associação dos Magistrados do Espírito Santo',
  email: 'lucbragatto+amages@gmail.com',
  telefone: '27981341348',
  enderecoInstitucional: {
    cep: '29050-335',
    logradouro: 'Av. Nossa Senhora dos Navegantes',
    numero: '955',
    bairro: 'Enseada do Suá',
    cidade: 'Vitória',
    estado: 'ES',
  },
};

const UC_PUTIRI = {
  numeroConcessionariaOriginal: '0.001.334.421.054-40',
  numeroCanonico: '1334421054', // 10 dígitos extraídos
  numeroUC: '133442105', // 9 dígitos legados (heurística — pode revisar pós-execução)
  endereco: 'Rua Des Homero Mafra, S/N',
  cidade: 'Aracruz',
  estado: 'ES',
  bairro: 'Praia de Putiri',
  cep: '29190-000',
  distribuidora: 'EDP_ES' as const,
  classificacao: 'A4', // grupo A subgrupo A4
  modalidadeTarifaria: 'VERDE',
  tensaoNominal: '13.800 V',
  tipoFornecimento: 'TRIFASICO',
  codigoMedidor: '0018126202',
  // Consumo médio histórico (kWh ponta + fponta combinados)
  consumoMedioMensal: 3798, // ~média 12m
  consumoMarco2026: 2898.9, // 529.8 P + 2369.1 FP
};

const UC_SEDE_ADM = {
  numeroConcessionariaOriginal: '0.002.399.394.054-06',
  numeroCanonico: '2399394054',
  numeroUC: '239939405',
  endereco: 'Rua Elmo Ribeiro do Val, 52 Prov. Obra',
  cidade: 'Vitória',
  estado: 'ES',
  bairro: 'Enseada do Suá',
  cep: '29050-415',
  distribuidora: 'EDP_ES' as const,
  classificacao: 'B3',
  modalidadeTarifaria: 'CONVENCIONAL',
  tensaoNominal: '220/127 V',
  tipoFornecimento: 'TRIFASICO',
  codigoMedidor: '0017600268',
  consumoMedioMensal: 4621,
  consumoMarco2026: 6935,
  creditosRecebidosMarco: 5006.89,
  saldoAtualMarco: 3164.67,
  valorTotalMarco: 1653.98,
};

const TARIFA_EDP_MARCO_2026 = {
  // Tarifas com tributos (Total ÷ consumo SEDE ADM)
  valorCheioKwhSedeAdm: Math.round((1653.98 / 6935) * 100000) / 100000, // 0.23849
  // Tarifas sem impostos (TUSD + TE)
  tusdBaseFPonta: 0.16171,
  teBaseFPonta: 0.30025,
};

const PLANO_AMAGES = {
  nome: 'PLANO AMAGES COMPENSADOS',
  descricao: 'Plano específico AMAGES — engine CREDITOS_COMPENSADOS validação 15/05/2026',
  descontoBase: 18.0, // %
  modeloCobranca: 'CREDITOS_COMPENSADOS' as const,
  baseCalculo: 'KWH_CHEIO',
  publico: false,
};

// ─── Helper ────────────────────────────────────────────────────────
function log(passo: string, acao: string) {
  console.log(`\n[${new Date().toISOString().slice(11, 19)}] ${passo} — ${acao}`);
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  Bloco A — Sub-Fase B AMAGES — passos 3-7');
  console.log('═══════════════════════════════════════════════════════════');

  // ── Pré: localizar cooperativa CoopereBR + Usina Linhares ─────────
  const coopereBr = await prisma.cooperativa.findFirst({
    where: { nome: 'CoopereBR' },
    select: { id: true, nome: true },
  });
  if (!coopereBr) throw new Error('CoopereBR não encontrada');
  log('PRE', `CoopereBR id=${coopereBr.id}`);

  const usinaLinhares = await prisma.usina.findFirst({
    where: { nome: { contains: 'Linhares' }, cooperativaId: coopereBr.id },
    select: { id: true, nome: true, capacidadeKwh: true, distribuidora: true },
  });
  if (!usinaLinhares) throw new Error('Usina Linhares não encontrada');
  log('PRE', `Usina Linhares id=${usinaLinhares.id} cap=${usinaLinhares.capacidadeKwh} dist=${usinaLinhares.distribuidora}`);

  // ─── Passo 3: Cooperado AMAGES PJ ─────────────────────────────────
  log('3', 'Criando cooperado AMAGES PJ');
  let amages = await prisma.cooperado.findUnique({ where: { cpf: AMAGES.cnpj } });
  if (amages) {
    console.log(`  → já existe id=${amages.id} (skip create)`);
  } else {
    amages = await prisma.cooperado.create({
      data: {
        nomeCompleto: AMAGES.razaoSocial,
        razaoSocial: AMAGES.razaoSocial,
        cpf: AMAGES.cnpj, // unique constraint — CNPJ vai em cpf (padrão THEOMAX)
        email: AMAGES.email,
        telefone: AMAGES.telefone,
        tipoPessoa: 'PJ',
        tipoCooperado: 'COM_UC',
        status: 'ATIVO',
        ambienteTeste: false,
        cooperativaId: coopereBr.id,
        cep: AMAGES.enderecoInstitucional.cep,
        logradouro: AMAGES.enderecoInstitucional.logradouro,
        numero: AMAGES.enderecoInstitucional.numero,
        bairro: AMAGES.enderecoInstitucional.bairro,
        cidade: AMAGES.enderecoInstitucional.cidade,
        estado: AMAGES.enderecoInstitucional.estado,
        termoAdesaoAceito: true,
        termoAdesaoAceitoEm: new Date(),
        modoRemuneracao: 'DESCONTO',
      },
    });
    console.log(`  ✅ criado id=${amages.id}`);
  }
  console.log({
    id: amages.id,
    nome: amages.nomeCompleto,
    cnpj: amages.cpf,
    email: amages.email,
    telefone: amages.telefone,
    tipo: amages.tipoPessoa,
    status: amages.status,
    ambienteTeste: amages.ambienteTeste,
  });

  // ─── Passo 4: 2 UCs ───────────────────────────────────────────────
  log('4', 'Criando UC PUTIRI');
  let ucPutiri = await prisma.uc.findUnique({ where: { numero: UC_PUTIRI.numeroCanonico } });
  if (ucPutiri) {
    console.log(`  → UC PUTIRI já existe id=${ucPutiri.id} (skip)`);
  } else {
    ucPutiri = await prisma.uc.create({
      data: {
        numero: UC_PUTIRI.numeroCanonico,
        numeroUC: UC_PUTIRI.numeroUC,
        numeroConcessionariaOriginal: UC_PUTIRI.numeroConcessionariaOriginal,
        codigoMedidor: UC_PUTIRI.codigoMedidor,
        endereco: UC_PUTIRI.endereco,
        bairro: UC_PUTIRI.bairro,
        cidade: UC_PUTIRI.cidade,
        estado: UC_PUTIRI.estado,
        cep: UC_PUTIRI.cep,
        distribuidora: UC_PUTIRI.distribuidora,
        classificacao: UC_PUTIRI.classificacao,
        modalidadeTarifaria: UC_PUTIRI.modalidadeTarifaria,
        tensaoNominal: UC_PUTIRI.tensaoNominal,
        tipoFornecimento: UC_PUTIRI.tipoFornecimento,
        cooperadoId: amages.id,
        cooperativaId: coopereBr.id,
      },
    });
    console.log(`  ✅ UC PUTIRI criada id=${ucPutiri.id}`);
  }

  log('4', 'Criando UC SEDE ADM');
  let ucSede = await prisma.uc.findUnique({ where: { numero: UC_SEDE_ADM.numeroCanonico } });
  if (ucSede) {
    console.log(`  → UC SEDE ADM já existe id=${ucSede.id} (skip)`);
  } else {
    ucSede = await prisma.uc.create({
      data: {
        numero: UC_SEDE_ADM.numeroCanonico,
        numeroUC: UC_SEDE_ADM.numeroUC,
        numeroConcessionariaOriginal: UC_SEDE_ADM.numeroConcessionariaOriginal,
        codigoMedidor: UC_SEDE_ADM.codigoMedidor,
        endereco: UC_SEDE_ADM.endereco,
        bairro: UC_SEDE_ADM.bairro,
        cidade: UC_SEDE_ADM.cidade,
        estado: UC_SEDE_ADM.estado,
        cep: UC_SEDE_ADM.cep,
        distribuidora: UC_SEDE_ADM.distribuidora,
        classificacao: UC_SEDE_ADM.classificacao,
        modalidadeTarifaria: UC_SEDE_ADM.modalidadeTarifaria,
        tensaoNominal: UC_SEDE_ADM.tensaoNominal,
        tipoFornecimento: UC_SEDE_ADM.tipoFornecimento,
        cooperadoId: amages.id,
        cooperativaId: coopereBr.id,
      },
    });
    console.log(`  ✅ UC SEDE ADM criada id=${ucSede.id}`);
  }

  // ─── Passo 5: Plano AMAGES COMPENSADOS ───────────────────────────
  log('5', 'Criando Plano AMAGES COMPENSADOS');
  let planoAmages = await prisma.plano.findFirst({
    where: { nome: PLANO_AMAGES.nome, cooperativaId: coopereBr.id },
  });
  if (planoAmages) {
    console.log(`  → Plano AMAGES já existe id=${planoAmages.id} (skip)`);
  } else {
    planoAmages = await prisma.plano.create({
      data: {
        nome: PLANO_AMAGES.nome,
        descricao: PLANO_AMAGES.descricao,
        modeloCobranca: PLANO_AMAGES.modeloCobranca,
        descontoBase: PLANO_AMAGES.descontoBase,
        baseCalculo: PLANO_AMAGES.baseCalculo,
        publico: PLANO_AMAGES.publico,
        ativo: true,
        cooperativaId: coopereBr.id,
      },
    });
    console.log(`  ✅ Plano criado id=${planoAmages.id} modelo=${planoAmages.modeloCobranca} desconto=${planoAmages.descontoBase}%`);
  }

  // ─── Passo 6: Contrato ────────────────────────────────────────────
  log('6', 'Criando Contrato AMAGES x Usina Linhares');

  // Cálculos do contrato
  const kwhMedioMensal = UC_PUTIRI.consumoMedioMensal + UC_SEDE_ADM.consumoMedioMensal; // 8419
  const kwhContratoAnual = kwhMedioMensal * 12; // 101028
  // percentualUsina = (mensal médio / capacidade nominal) * 100 — interpretação MENSAL
  // capacidade Linhares = 150.000 (mensal ou anual? aplicar a fórmula do plano sem inverter)
  const capacidadeNominal = Number(usinaLinhares.capacidadeKwh ?? 150000);
  const percentualUsina = Math.round((kwhMedioMensal / capacidadeNominal) * 100 * 10000) / 10000;

  // tarifaContratual: pós-desconto. Base = valorCheioKwh SEDE ADM = R$ 0,23849.
  // Pós-18% desconto = 0,23849 * 0,82 = 0,19556.
  const tarifaContratual = Math.round(TARIFA_EDP_MARCO_2026.valorCheioKwhSedeAdm * (1 - PLANO_AMAGES.descontoBase / 100) * 100000) / 100000;

  let contrato = await prisma.contrato.findFirst({
    where: { cooperadoId: amages.id, ucId: ucSede.id },
  });
  if (contrato) {
    console.log(`  → Contrato já existe id=${contrato.id} (skip)`);
  } else {
    // Gerar próximo número de contrato CTR-2026-XXXX
    const ultimoCtr = await prisma.contrato.findFirst({
      where: { numero: { startsWith: 'CTR-2026-' } },
      orderBy: { numero: 'desc' },
      select: { numero: true },
    });
    const proximoNum = ultimoCtr ? parseInt(ultimoCtr.numero.replace('CTR-2026-', ''), 10) + 1 : 1;
    const numeroContrato = `CTR-2026-${String(proximoNum).padStart(4, '0')}`;

    contrato = await prisma.contrato.create({
      data: {
        numero: numeroContrato,
        cooperadoId: amages.id,
        ucId: ucSede.id, // contrato amarrado à SEDE ADM (UC consumidora compensada)
        usinaId: usinaLinhares.id,
        planoId: planoAmages.id,
        cooperativaId: coopereBr.id,
        dataInicio: new Date(),
        percentualDesconto: PLANO_AMAGES.descontoBase,
        kwhContratoAnual,
        kwhContratoMensal: kwhMedioMensal,
        percentualUsina,
        status: 'ATIVO',
        tarifaContratual,
        valorCheioKwhAceite: TARIFA_EDP_MARCO_2026.valorCheioKwhSedeAdm,
        baseCalculoAplicado: 'KWH_CHEIO',
        tipoDescontoAplicado: 'APLICAR_SOBRE_BASE',
      },
    });
    console.log(`  ✅ Contrato criado id=${contrato.id}`);
    console.log({
      numero: contrato.numero,
      kwhContratoAnual: contrato.kwhContratoAnual?.toString(),
      kwhContratoMensal: contrato.kwhContratoMensal?.toString(),
      percentualUsina: contrato.percentualUsina?.toString(),
      tarifaContratual: contrato.tarifaContratual?.toString(),
      status: contrato.status,
    });

    // Risco P0 D-30A: ANEEL recomenda concentração ≤ 25%/cooperado-usina.
    if (Number(contrato.percentualUsina) > 25) {
      console.warn(`  ⚠️  percentualUsina=${contrato.percentualUsina}% > 25% (D-30A regulatório). Catalogar.`);
    }
  }

  // ─── Passo 7: Smoke engine COMPENSADOS ───────────────────────────
  log('7', 'Smoke engine COMPENSADOS — FaturaProcessada SEDE ADM mar/2026');

  // Verificar duplicata da fatura mar/2026 SEDE ADM AMAGES
  const faturaExistente = await prisma.faturaProcessada.findFirst({
    where: { cooperadoId: amages.id, ucId: ucSede.id, mesReferencia: '03/2026' },
  });
  let fatura: any;
  if (faturaExistente) {
    fatura = faturaExistente;
    console.log(`  → FaturaProcessada mar/2026 SEDE ADM já existe id=${fatura.id} (skip)`);
  } else {
    // dadosExtraidos: replicar shape esperado pela engine COMPENSADOS
    const dadosExtraidos = {
      consumoAtualKwh: UC_SEDE_ADM.consumoMarco2026,
      creditosRecebidosKwh: UC_SEDE_ADM.creditosRecebidosMarco,
      saldoKwh: UC_SEDE_ADM.saldoAtualMarco,
      valorTotal: UC_SEDE_ADM.valorTotalMarco,
      mesReferencia: '03/2026',
      vencimento: '2026-04-09',
      bandeiraTarifaria: 'VERDE',
      tarifaTUSDFPonta: TARIFA_EDP_MARCO_2026.tusdBaseFPonta,
      tarifaTEFPonta: TARIFA_EDP_MARCO_2026.teBaseFPonta,
      numeroUC: UC_SEDE_ADM.numeroConcessionariaOriginal,
    };
    const valorCheioKwh = Math.round((UC_SEDE_ADM.valorTotalMarco / UC_SEDE_ADM.consumoMarco2026) * 100000) / 100000;
    const tarifaSemImpostos = TARIFA_EDP_MARCO_2026.tusdBaseFPonta + TARIFA_EDP_MARCO_2026.teBaseFPonta;

    fatura = await prisma.faturaProcessada.create({
      data: {
        cooperadoId: amages.id,
        ucId: ucSede.id,
        cooperativaId: coopereBr.id,
        dadosExtraidos,
        historicoConsumo: {
          '03/2026': 6935, '02/2026': 5463, '01/2026': 5617,
          '12/2025': 4903, '11/2025': 4408, '10/2025': 4027,
          '09/2025': 3751, '08/2025': 3861, '07/2025': 3341,
          '06/2025': 3703, '05/2025': 4333, '04/2025': 5187,
        },
        mesesUtilizados: 12,
        mesesDescartados: 0,
        mediaKwhCalculada: UC_SEDE_ADM.consumoMedioMensal,
        thresholdUtilizado: 1.5,
        status: 'APROVADA',
        mesReferencia: '03/2026',
        statusRevisao: 'AUTO_APROVADO',
        saldoKwhAnterior: UC_SEDE_ADM.creditosRecebidosMarco + UC_SEDE_ADM.saldoAtualMarco - 0, // saldo antes de receber créditos + restante
        saldoKwhAtual: UC_SEDE_ADM.saldoAtualMarco,
        valorSemDesconto: UC_SEDE_ADM.valorTotalMarco,
        valorCheioKwh,
        tarifaSemImpostos,
      },
    });
    console.log(`  ✅ FaturaProcessada criada id=${fatura.id}`);
    console.log({
      consumoAtual: UC_SEDE_ADM.consumoMarco2026,
      creditosRecebidos: UC_SEDE_ADM.creditosRecebidosMarco,
      valorTotal: UC_SEDE_ADM.valorTotalMarco,
      valorCheioKwh,
    });
  }

  // ─── Trigger engine — chamar gerarCobrancaPosFatura via HTTP ──────
  log('7', 'Disparando gerarCobrancaPosFatura via faturas service (chamada direta via prisma)');
  console.log('  → Importante: BLOQUEIO_MODELOS_NAO_FIXO deve estar OFF no backend pra engine COMPENSADOS rodar.');
  console.log('  → Vou simular o cálculo aqui (sem chamar HTTP — bypassa todo o stack Nest) pra validar lógica.');

  const cobrancaExistente = await prisma.cobranca.findFirst({
    where: { contratoId: contrato.id, mesReferencia: 3, anoReferencia: 2026 },
  });
  if (cobrancaExistente) {
    console.log(`  → Cobrança já existe id=${cobrancaExistente.id}`);
    const valorLiquido = Number(cobrancaExistente.valorLiquido);
    const valorBruto = Number(cobrancaExistente.valorBruto);
    const valorDesconto = Number(cobrancaExistente.valorDesconto);
    console.log('  Cobrança existente:', {
      id: cobrancaExistente.id,
      modeloUsado: cobrancaExistente.modeloCobrancaUsado,
      kwhCompensado: cobrancaExistente.kwhCompensado?.toString(),
      kwhConsumido: cobrancaExistente.kwhConsumido?.toString(),
      tarifaContratualAplicada: cobrancaExistente.tarifaContratualAplicada?.toString(),
      valorBruto,
      valorDesconto,
      valorLiquido,
      status: cobrancaExistente.status,
      faturaProcessadaId: cobrancaExistente.faturaProcessadaId,
    });
  } else {
    // Cálculo esperado engine COMPENSADOS:
    const kwhCompensado = UC_SEDE_ADM.creditosRecebidosMarco;
    const tarifaSnapshot = Number(contrato.tarifaContratual);
    const valorLiquidoEsperado = Math.round(kwhCompensado * tarifaSnapshot * 100) / 100;
    const valorCheioRef = Number((fatura as any).valorCheioKwh);
    const valorBrutoEsperado = Math.round(kwhCompensado * valorCheioRef * 100) / 100;
    const valorDescontoEsperado = Math.round((valorBrutoEsperado - valorLiquidoEsperado) * 100) / 100;

    console.log('\n  CÁLCULO ESPERADO ENGINE COMPENSADOS:');
    console.log(`    kwhCompensado (créditos recebidos): ${kwhCompensado}`);
    console.log(`    tarifaContratual (pós-18% desconto): R$ ${tarifaSnapshot}`);
    console.log(`    valorLiquido = ${kwhCompensado} × ${tarifaSnapshot} = R$ ${valorLiquidoEsperado.toFixed(2)}`);
    console.log(`    valorCheioRef (fatura): R$ ${valorCheioRef}`);
    console.log(`    valorBruto = ${kwhCompensado} × ${valorCheioRef} = R$ ${valorBrutoEsperado.toFixed(2)}`);
    console.log(`    valorDesconto = ${valorBrutoEsperado.toFixed(2)} - ${valorLiquidoEsperado.toFixed(2)} = R$ ${valorDescontoEsperado.toFixed(2)}`);
    console.log('\n  Próximo passo: chamar POST /faturas/<id>/aprovar via HTTP (ou re-rodar este script após backend executar gerarCobrancaPosFatura).');
  }

  // ─── Resumo final ─────────────────────────────────────────────────
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  RESUMO FINAL');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`  Cooperado AMAGES: ${amages.id}`);
  console.log(`  UC PUTIRI:        ${ucPutiri.id}`);
  console.log(`  UC SEDE ADM:      ${ucSede.id}`);
  console.log(`  Plano AMAGES:     ${planoAmages.id}`);
  console.log(`  Contrato AMAGES:  ${contrato.id} (${contrato.numero})`);
  console.log(`  Fatura mar/2026:  ${fatura.id}`);
  console.log('  Próximo: disparar gerarCobrancaPosFatura via HTTP ou script.');
}

main()
  .catch((err) => { console.error('❌ Erro:', err); process.exit(1); })
  .finally(() => prisma.$disconnect());
