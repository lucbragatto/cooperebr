/* Sub-Fase A canário 14/05 — 4 cooperados-piloto FIXO_MENSAL E2E real.
   Roda Cooperado→UC→FaturaProcessada→Proposta→Contrato→Cobranca por ciclo.
   Para na primeira exceção e reporta — NÃO reverte automaticamente.
   Uso: cd backend && npx ts-node scripts/sub-fase-a-canario-4-fixo.ts */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma.service';
import { MotorPropostaService } from '../src/motor-proposta/motor-proposta.service';
import { FaturasService } from '../src/faturas/faturas.service';

const COOP_ID = 'cmn0ho8bx0000uox8wu96u6fd';
const PLANO_ID = 'cmn7ru9970004uokcfwydmqjm';
const DESCONTO_PCT = 18;
const TUSD = 0.46863;
const TE = 0.32068;
const TARIFA_SEM_TRIB = 0.78931;

type Piloto = {
  apelido: string;
  cooperado: {
    nomeCompleto: string;
    cpf: string;
    email: string;
    tipoPessoa: 'PF' | 'PJ';
    telefone?: string | null;
    representanteLegalNome?: string | null;
    cep: string;
    logradouro: string;
    bairro: string;
    cidade: string;
    estado: string;
  };
  uc: {
    numero: string;
    distribuidora: 'EDP_ES';
    classificacao: string;
    tipoFornecimento: string;
  };
  fatura: {
    mesReferencia: string;
    consumoKwh: number;
    valorTotal: number;
    valorCheioKwh: number;
    dataVencimento: Date;
    dataLeitura: Date;
    emissao: Date;
    bandeiraTarifaria: string;
  };
};

const PILOTOS: Piloto[] = [
  {
    apelido: 'DIEGO',
    cooperado: {
      nomeCompleto: 'DIEGO ALLAN CORREIA PEREIRA',
      cpf: '05375082799',
      email: 'piloto.diego.allan@cooperebr.invalid',
      tipoPessoa: 'PF',
      cep: '29101-335',
      logradouro: 'RUA PERNAMBUCO 120 AP 1503 ED VERANNO',
      bairro: 'PRAIA DA COSTA',
      cidade: 'VILA VELHA',
      estado: 'ES',
    },
    uc: {
      numero: '0.001.516.624.054-75',
      distribuidora: 'EDP_ES',
      classificacao: 'B1_RESIDENCIAL',
      tipoFornecimento: 'TRIFASICO',
    },
    fatura: {
      mesReferencia: '2026-01',
      consumoKwh: 490,
      valorTotal: 545.95,
      valorCheioKwh: 1.11418,
      dataVencimento: new Date('2026-01-15'),
      dataLeitura: new Date('2026-01-02'),
      emissao: new Date('2026-01-05'),
      bandeiraTarifaria: 'AMARELA',
    },
  },
  {
    apelido: 'CAROLINA',
    cooperado: {
      nomeCompleto: 'CAROLINA LEMOS CRAVO',
      cpf: '08649654789',
      email: 'piloto.carolina.lemos@cooperebr.invalid',
      tipoPessoa: 'PF',
      cep: '29101-022',
      logradouro: 'AV ANTONIO GIL VELOSO 1950 AP 706 ED OCEAN FLAT',
      bairro: 'PRAIA DA COSTA',
      cidade: 'VILA VELHA',
      estado: 'ES',
    },
    uc: {
      numero: '0.000.897.339.054-90',
      distribuidora: 'EDP_ES',
      classificacao: 'B3_COMERCIAL',
      tipoFornecimento: 'MONOFASICO',
    },
    fatura: {
      mesReferencia: '2026-01',
      consumoKwh: 146,
      valorTotal: 173.56,
      valorCheioKwh: 1.18877,
      dataVencimento: new Date('2026-01-15'),
      dataLeitura: new Date('2026-01-02'),
      emissao: new Date('2026-01-05'),
      bandeiraTarifaria: 'AMARELA',
    },
  },
  {
    apelido: 'ALMIR',
    cooperado: {
      nomeCompleto: 'ALMIR JOAO MUNIZ FREITAS',
      cpf: '68691157704',
      email: 'piloto.almir.muniz@cooperebr.invalid',
      tipoPessoa: 'PF',
      cep: '29122-280',
      logradouro: 'RUA AURORA 612 CX 02',
      bairro: 'GLORIA',
      cidade: 'VILA VELHA',
      estado: 'ES',
    },
    uc: {
      numero: '0160213718',
      distribuidora: 'EDP_ES',
      classificacao: 'B1_RESIDENCIAL',
      tipoFornecimento: 'TRIFASICO',
    },
    fatura: {
      mesReferencia: '2025-12',
      consumoKwh: 1061,
      valorTotal: 1147.47,
      valorCheioKwh: 1.0815,
      dataVencimento: new Date('2025-12-30'),
      dataLeitura: new Date('2025-12-15'),
      emissao: new Date('2025-12-16'),
      bandeiraTarifaria: 'VERMELHA_PTM1',
    },
  },
  {
    apelido: 'THEOMAX',
    cooperado: {
      nomeCompleto: 'THEOMAX COMERCIO DE CALCADOS E ACESSORIOS LTDA',
      cpf: '43896674000129',
      email: 'piloto.theomax@cooperebr.invalid',
      tipoPessoa: 'PJ',
      cep: '29060-290',
      logradouro: 'RUA FRANCISCO EUGENIO MUSSIELLO 750 LJ 12 ED SANTAREM',
      bairro: 'JARDIM DA PENHA',
      cidade: 'VITORIA',
      estado: 'ES',
    },
    uc: {
      numero: '0000652942',
      distribuidora: 'EDP_ES',
      classificacao: 'B1_RESIDENCIAL',
      tipoFornecimento: 'BIFASICO',
    },
    fatura: {
      mesReferencia: '2025-12',
      consumoKwh: 1143,
      valorTotal: 1233.33,
      valorCheioKwh: 1.07903,
      dataVencimento: new Date('2025-12-15'),
      dataLeitura: new Date('2025-12-02'),
      emissao: new Date('2025-12-03'),
      bandeiraTarifaria: 'VERMELHA_PTM1',
    },
  },
];

type Persisted = {
  apelido: string;
  cooperadoId: string;
  ucId: string;
  faturaId: string;
  propostaId: string | null;
  contratoId: string | null;
  cobrancaId: string | null;
};

function montarResultado(p: Piloto) {
  const valorMes = p.fatura.valorTotal;
  const kwhMes = p.fatura.consumoKwh;
  const valorCheioKwh = p.fatura.valorCheioKwh;
  // descontoAbsoluto incide sobre R$/kWh (valor por kWh, não sobre total)
  const descontoAbsoluto = Math.round(valorCheioKwh * (DESCONTO_PCT / 100) * 100000) / 100000;
  const economiaMensal = Math.round(valorMes * (DESCONTO_PCT / 100) * 100) / 100;
  const economiaAnual = Math.round(economiaMensal * 12 * 100) / 100;
  const valorCooperado = Math.round(valorMes * (1 - DESCONTO_PCT / 100) * 100) / 100;
  return {
    mesReferencia: p.fatura.mesReferencia,
    kwhMesRecente: kwhMes,
    valorMesRecente: valorMes,
    kwhMedio12m: kwhMes, // sem hist real, usa o do mês
    valorMedio12m: valorMes,
    outlierDetectado: false,
    tusdUtilizada: TUSD,
    teUtilizada: TE,
    tarifaUnitSemTrib: TARIFA_SEM_TRIB,
    kwhApuradoBase: valorCheioKwh,
    base: 'KWH_CHEIO',
    descontoPercentual: DESCONTO_PCT,
    descontoAbsoluto,
    kwhContrato: kwhMes,
    valorCooperado,
    economiaAbsoluta: descontoAbsoluto,
    economiaPercentual: DESCONTO_PCT,
    economiaMensal,
    economiaAnual,
    mesesEquivalentes: 0,
    mediaCooperativaKwh: 0,
    resultadoVsMedia: 0,
  };
}

async function processarPiloto(
  prisma: PrismaService,
  motor: MotorPropostaService,
  faturas: FaturasService,
  p: Piloto,
): Promise<Persisted> {
  const log = (msg: string) => console.log(`  [${p.apelido}] ${msg}`);
  const out: Persisted = {
    apelido: p.apelido,
    cooperadoId: '',
    ucId: '',
    faturaId: '',
    propostaId: null,
    contratoId: null,
    cobrancaId: null,
  };

  // 1. Cooperado
  log('1/6 criando Cooperado...');
  const coop = await prisma.cooperado.create({
    data: {
      nomeCompleto: p.cooperado.nomeCompleto,
      cpf: p.cooperado.cpf,
      email: p.cooperado.email,
      telefone: p.cooperado.telefone ?? null,
      status: 'ATIVO' as any,
      tipoCooperado: 'COM_UC' as any,
      tipoPessoa: p.cooperado.tipoPessoa,
      ambienteTeste: true,
      cooperativaId: COOP_ID,
      cep: p.cooperado.cep,
      logradouro: p.cooperado.logradouro,
      bairro: p.cooperado.bairro,
      cidade: p.cooperado.cidade,
      estado: p.cooperado.estado,
      termoAdesaoAceito: true,
      termoAdesaoAceitoEm: new Date(),
      ...(p.cooperado.tipoPessoa === 'PJ'
        ? { razaoSocial: p.cooperado.nomeCompleto }
        : {}),
    },
  });
  out.cooperadoId = coop.id;
  log(`    Cooperado.id=${coop.id}`);

  // 2. UC
  log('2/6 criando UC...');
  const uc = await prisma.uc.create({
    data: {
      numero: p.uc.numero,
      endereco: p.cooperado.logradouro,
      cidade: p.cooperado.cidade,
      estado: p.cooperado.estado,
      cep: p.cooperado.cep,
      bairro: p.cooperado.bairro,
      distribuidora: p.uc.distribuidora as any,
      classificacao: p.uc.classificacao,
      tipoFornecimento: p.uc.tipoFornecimento,
      cooperadoId: coop.id,
      cooperativaId: COOP_ID,
    },
  });
  out.ucId = uc.id;
  log(`    Uc.id=${uc.id} numero=${uc.numero}`);

  // 3. FaturaProcessada APROVADA com snapshots Fase B
  log('3/6 criando FaturaProcessada...');
  const dadosExtraidos: any = {
    consumoAtualKwh: p.fatura.consumoKwh,
    totalAPagar: p.fatura.valorTotal,
    valorCheioKwh: p.fatura.valorCheioKwh,
    tarifaSemImpostos: TARIFA_SEM_TRIB,
    tusd: TUSD,
    te: TE,
    bandeiraTarifaria: p.fatura.bandeiraTarifaria,
    dataLeitura: p.fatura.dataLeitura.toISOString(),
    dataVencimento: p.fatura.dataVencimento.toISOString(),
    emissao: p.fatura.emissao.toISOString(),
    numeroUC: p.uc.numero,
    distribuidora: 'EDP_ES',
    creditosRecebidosKwh: 0,
  };
  const fatura = await prisma.faturaProcessada.create({
    data: {
      cooperadoId: coop.id,
      ucId: uc.id,
      cooperativaId: COOP_ID,
      dadosExtraidos: dadosExtraidos as any,
      historicoConsumo: [] as any,
      mesesUtilizados: 1,
      mesesDescartados: 0,
      mediaKwhCalculada: p.fatura.consumoKwh,
      thresholdUtilizado: 1.5,
      status: 'APROVADA' as any,
      statusRevisao: 'APROVADO',
      mesReferencia: p.fatura.mesReferencia,
      valorCheioKwh: p.fatura.valorCheioKwh,
      tarifaSemImpostos: TARIFA_SEM_TRIB,
    },
  });
  out.faturaId = fatura.id;
  log(`    FaturaProcessada.id=${fatura.id} status=APROVADA`);

  // 4. motor-proposta.aceitar() → cria Proposta + Contrato
  log('4/6 motorProposta.aceitar()...');
  const resultado = montarResultado(p);
  const aceiteRes: any = await motor.aceitar(
    {
      cooperadoId: coop.id,
      resultado: resultado as any,
      mesReferencia: p.fatura.mesReferencia,
      planoId: PLANO_ID,
    },
    COOP_ID,
    undefined,
  );
  if (!aceiteRes || !aceiteRes.proposta || !aceiteRes.contrato) {
    throw new Error(`aceitar() não retornou {proposta, contrato}: ${JSON.stringify(aceiteRes)}`);
  }
  out.propostaId = aceiteRes.proposta.id;
  out.contratoId = aceiteRes.contrato.id;
  log(`    Proposta.id=${out.propostaId} Contrato.id=${out.contratoId} status=${aceiteRes.contrato.status}`);
  if (aceiteRes.emListaEspera) {
    throw new Error(`Contrato caiu em LISTA_ESPERA — provavelmente Usina sem capacidade ou distribuidora não casou`);
  }

  // 5. Promover Contrato PENDENTE_ATIVACAO → ATIVO
  log('5/6 promovendo Contrato → ATIVO...');
  const contratoAtivo = await prisma.contrato.update({
    where: { id: out.contratoId! },
    data: { status: 'ATIVO' as any },
  });
  log(`    Contrato.status=${contratoAtivo.status}`);

  // 6. Gerar 1ª Cobrança via engine FIXO_MENSAL
  log('6/6 faturas.gerarCobrancaPosFatura()...');
  const cobranca: any = await faturas.gerarCobrancaPosFatura(out.faturaId);
  if (!cobranca) {
    throw new Error(`gerarCobrancaPosFatura retornou null — sem contrato ATIVO localizado`);
  }
  out.cobrancaId = cobranca.id;
  log(`    Cobranca.id=${cobranca.id} modelo=${cobranca.modeloCobrancaUsado} liquido=${cobranca.valorLiquido} econMes=${cobranca.valorEconomiaMes}`);

  return out;
}

async function selectValidacaoCooperado(prisma: PrismaService, cpf: string) {
  const c = await prisma.cooperado.findFirst({
    where: { cpf },
    select: {
      id: true,
      nomeCompleto: true,
      ucs: { select: { id: true, numero: true } },
      contratos: { select: { id: true, status: true, valorContrato: true, valorCheioKwhAceite: true, baseCalculoAplicado: true, cobrancas: { select: { id: true, modeloCobrancaUsado: true, valorLiquido: true, valorEconomiaMes: true } } } },
      faturasProcessadas: { select: { id: true, status: true, mesReferencia: true } },
    },
  });
  return c;
}

async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('Sub-Fase A — 4 cooperados-piloto FIXO_MENSAL E2E real');
  console.log('═══════════════════════════════════════════════════════\n');

  // Sub-step 0 — UPDATE Usina Linhares.distribuidora
  console.log('Sub-step 0: validando Usina Linhares.distribuidora...');
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  const prisma = app.get(PrismaService);
  const motor = app.get(MotorPropostaService);
  const faturas = app.get(FaturasService);

  const usinaBefore = await prisma.usina.findUnique({
    where: { id: 'usina-linhares' },
    select: { id: true, nome: true, distribuidora: true },
  });
  console.log(`  Antes: ${JSON.stringify(usinaBefore)}`);
  if (!usinaBefore) {
    console.log('🔴 Usina Linhares não encontrada — abortando.');
    await app.close();
    return;
  }
  if (usinaBefore.distribuidora !== 'EDP_ES') {
    const updRes = await prisma.usina.update({
      where: { id: 'usina-linhares' },
      data: { distribuidora: 'EDP_ES' },
      select: { id: true, distribuidora: true },
    });
    console.log(`  Após: ${JSON.stringify(updRes)} ✅`);
  } else {
    console.log(`  Já era EDP_ES — sem alteração.`);
  }

  const persisted: Persisted[] = [];
  let falhou = false;
  let erroDetalhe: any = null;

  for (const piloto of PILOTOS) {
    console.log(`\n─────────────────────────────────────────────`);
    console.log(`Iniciando ciclo: ${piloto.apelido}`);
    console.log(`─────────────────────────────────────────────`);
    try {
      const out = await processarPiloto(prisma, motor, faturas, piloto);
      persisted.push(out);
      // SELECT confirmação
      const sel = await selectValidacaoCooperado(prisma, piloto.cooperado.cpf);
      console.log(`\n  [SELECT] ${piloto.apelido}:`);
      console.log(JSON.stringify(sel, null, 2));
    } catch (err: any) {
      console.error(`\n🔴 EXCEÇÃO em ${piloto.apelido}: ${err?.message ?? err}`);
      console.error(err?.stack ?? '');
      falhou = true;
      erroDetalhe = { apelido: piloto.apelido, mensagem: err?.message, stack: err?.stack };
      break;
    }
  }

  // Fase 4 — validação agregada
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('FASE 4 — Validação agregada');
  console.log('═══════════════════════════════════════════════════════');

  const cpfs = PILOTOS.map((p) => p.cooperado.cpf);

  const countCoop = await prisma.cooperado.count({
    where: { cooperativaId: COOP_ID, ambienteTeste: true, cpf: { in: cpfs } },
  });
  console.log(`Cooperados criados: ${countCoop} (esperado 4)`);

  const cooperadoIds = persisted.map((p) => p.cooperadoId).filter(Boolean);

  const contratosOk = await prisma.contrato.count({
    where: {
      status: 'ATIVO' as any,
      valorContrato: { not: null },
      valorCheioKwhAceite: { not: null },
      cooperadoId: { in: cooperadoIds.length > 0 ? cooperadoIds : ['_'] },
    },
  });
  console.log(`Contratos ATIVO com snapshots Fase B: ${contratosOk} (esperado 4)`);

  const contratoIds = persisted.map((p) => p.contratoId).filter((x): x is string => !!x);
  const cobAgg = await prisma.cobranca.aggregate({
    where: {
      modeloCobrancaUsado: 'FIXO_MENSAL' as any,
      valorEconomiaMes: { gt: 0 },
      contratoId: { in: contratoIds.length > 0 ? contratoIds : ['_'] },
    },
    _count: { _all: true },
    _sum: { valorLiquido: true, valorEconomiaMes: true },
  });
  console.log(`Cobranças FIXO_MENSAL com economia > 0: count=${cobAgg._count._all} sumLiquido=${cobAgg._sum.valorLiquido} sumEconMes=${cobAgg._sum.valorEconomiaMes}`);

  console.log('\n═══════════════════════════════════════════════════════');
  console.log('RESUMO');
  console.log('═══════════════════════════════════════════════════════');
  for (const p of persisted) console.log(JSON.stringify(p));
  if (falhou) console.log(`\n🔴 FALHOU em ${erroDetalhe?.apelido}: ${erroDetalhe?.mensagem}`);
  else if (countCoop === 4 && contratosOk === 4 && cobAgg._count._all === 4) {
    console.log('\n✅ 4/4/4 — Sub-Fase A FECHADA');
  } else {
    console.log(`\n🟠 PARCIAL: cooperados=${countCoop} contratos=${contratosOk} cobrancas=${cobAgg._count._all}`);
  }

  await app.close();
}

main().catch((e) => {
  console.error('ERRO TOP-LEVEL:', e);
  process.exit(1);
});
