/* Pós D-48 fix — Fases 4 a 8 do prompt 14/05.
   1) Saneamento CTR-2026-0004 (DIEGO) + CTR-2026-0003 (Luciana)
   2) Smoke test: motor.aceitar agora filtra por cooperativaId
   3) Gerar Cobrança DIEGO (passo 6/6 que faltou)
   4) Re-rodar CAROLINA, ALMIR, THEOMAX (3 ciclos completos)
   5) Validação agregada final
   Uso: cd backend && npx ts-node scripts/sub-fase-a-recuperacao-pos-d48.ts */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma.service';
import { MotorPropostaService } from '../src/motor-proposta/motor-proposta.service';
import { FaturasService } from '../src/faturas/faturas.service';

const COOP_ID = 'cmn0ho8bx0000uox8wu96u6fd';
const PLANO_ID = 'cmn7ru9970004uokcfwydmqjm';
const USINA_LINHARES = 'usina-linhares';
const DESCONTO_PCT = 18;
const TUSD = 0.46863;
const TE = 0.32068;
const TARIFA_SEM_TRIB = 0.78931;

const CTR_DIEGO = 'cmp4jpk2o000bvagcgxaai4t3';
const FATURA_DIEGO = 'cmp4jpj4x0007vagcdvqozdqw';
const CTR_LUCIANA = 'cmncg235l0001uowo72x7kx6k';

type Piloto = {
  apelido: string;
  cooperado: any;
  uc: any;
  fatura: any;
};

const PILOTOS_RESTANTES: Piloto[] = [
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

function montarResultado(p: Piloto) {
  const valorMes = p.fatura.valorTotal;
  const kwhMes = p.fatura.consumoKwh;
  const valorCheioKwh = p.fatura.valorCheioKwh;
  const descontoAbsoluto = Math.round(valorCheioKwh * (DESCONTO_PCT / 100) * 100000) / 100000;
  const economiaMensal = Math.round(valorMes * (DESCONTO_PCT / 100) * 100) / 100;
  const economiaAnual = Math.round(economiaMensal * 12 * 100) / 100;
  const valorCooperado = Math.round(valorMes * (1 - DESCONTO_PCT / 100) * 100) / 100;
  return {
    mesReferencia: p.fatura.mesReferencia,
    kwhMesRecente: kwhMes,
    valorMesRecente: valorMes,
    kwhMedio12m: kwhMes,
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

async function processarPiloto(prisma: PrismaService, motor: MotorPropostaService, faturas: FaturasService, p: Piloto) {
  const log = (m: string) => console.log(`  [${p.apelido}] ${m}`);
  const out: any = { apelido: p.apelido };

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
      ...(p.cooperado.tipoPessoa === 'PJ' ? { razaoSocial: p.cooperado.nomeCompleto } : {}),
    },
  });
  out.cooperadoId = coop.id;
  log(`    Cooperado.id=${coop.id}`);

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
  log(`    Uc.id=${uc.id}`);

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
  log(`    FaturaProcessada.id=${fatura.id}`);

  log('4/6 motorProposta.aceitar()...');
  const resultado = montarResultado(p);
  const aceiteRes: any = await motor.aceitar(
    { cooperadoId: coop.id, resultado: resultado as any, mesReferencia: p.fatura.mesReferencia, planoId: PLANO_ID },
    COOP_ID,
    undefined,
  );
  if (!aceiteRes?.proposta || !aceiteRes?.contrato) throw new Error(`aceitar() retorno inválido: ${JSON.stringify(aceiteRes)}`);
  out.propostaId = aceiteRes.proposta.id;
  out.contratoId = aceiteRes.contrato.id;
  log(`    Proposta.id=${out.propostaId} Contrato.id=${out.contratoId} status=${aceiteRes.contrato.status} usinaId=${aceiteRes.contrato.usinaId}`);
  if (aceiteRes.emListaEspera) throw new Error('Caiu em LISTA_ESPERA — usina não encontrada');
  if (aceiteRes.contrato.usinaId !== USINA_LINHARES) throw new Error(`usinaId=${aceiteRes.contrato.usinaId} ≠ ${USINA_LINHARES} (esperado pós D-48.1)`);

  log('5/6 promovendo Contrato → ATIVO...');
  await prisma.contrato.update({ where: { id: out.contratoId }, data: { status: 'ATIVO' as any } });

  log('6/6 faturas.gerarCobrancaPosFatura()...');
  const cobranca: any = await faturas.gerarCobrancaPosFatura(out.faturaId);
  if (!cobranca) throw new Error('gerarCobrancaPosFatura retornou null');
  out.cobrancaId = cobranca.id;
  log(`    Cobranca.id=${cobranca.id} modelo=${cobranca.modeloCobrancaUsado} liquido=${cobranca.valorLiquido} econMes=${cobranca.valorEconomiaMes}`);

  return out;
}

async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('Sub-Fase A — RECUPERAÇÃO pós D-48 (Fases 4-8)');
  console.log('═══════════════════════════════════════════════════════\n');

  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  const prisma = app.get(PrismaService);
  const motor = app.get(MotorPropostaService);
  const faturas = app.get(FaturasService);

  // FASE 5 — Saneamento dos 2 contratos divergentes
  console.log('FASE 5 — Saneamento SQL CTR-2026-0004 (DIEGO) + CTR-2026-0003 (Luciana)');
  // DIEGO: kwh=490/mês → kwhAnual=5880 → percentualUsina = 5880/150000 * 100 = 3.92%
  // Mas prompt diz 0.3267 — vou usar fórmula do prompt: 490/150000 * 100 = 0.3267
  const pctDiego = Math.round((490 / 150000) * 100 * 10000) / 10000;
  const pctLuciana = Math.round((1000 / 150000) * 100 * 10000) / 10000;

  const ctrDiego = await prisma.contrato.findUnique({ where: { id: CTR_DIEGO }, select: { id: true, numero: true, usinaId: true, percentualUsina: true } });
  console.log(`  DIEGO antes: ${JSON.stringify(ctrDiego)}`);
  const updDiego = await prisma.contrato.update({
    where: { id: CTR_DIEGO },
    data: { usinaId: USINA_LINHARES, percentualUsina: pctDiego },
  });
  console.log(`  DIEGO depois: usinaId=${updDiego.usinaId} percentualUsina=${updDiego.percentualUsina}`);

  const ctrLuciana = await prisma.contrato.findUnique({ where: { id: CTR_LUCIANA }, select: { id: true, numero: true, usinaId: true, percentualUsina: true } }).catch(() => null);
  if (ctrLuciana) {
    console.log(`  Luciana antes: ${JSON.stringify(ctrLuciana)}`);
    const updLuciana = await prisma.contrato.update({
      where: { id: CTR_LUCIANA },
      data: { usinaId: USINA_LINHARES, percentualUsina: pctLuciana },
    });
    console.log(`  Luciana depois: usinaId=${updLuciana.usinaId} percentualUsina=${updLuciana.percentualUsina}`);
  } else {
    console.log(`  Luciana (CTR-2026-0003 / ${CTR_LUCIANA}): NÃO encontrado — pulando.`);
  }

  // FASE 4 — Smoke test: rodar query do motor (simulado) pra confirmar Usina Linhares ganha
  console.log('\nFASE 4 — Smoke test D-48.1');
  const usinasMatch = await prisma.usina.findMany({
    where: { capacidadeKwh: { not: null }, cooperativaId: COOP_ID, distribuidora: 'EDP_ES' },
    select: { id: true, nome: true, cooperativaId: true },
  });
  console.log(`  Query whereUsina (D-48.1 fix): ${usinasMatch.length} usinas — esperado 1 (Usina Linhares CoopereBR)`);
  usinasMatch.forEach((u) => console.log(`    - ${u.nome} (${u.id}) coop=${u.cooperativaId}`));
  if (usinasMatch.length !== 1 || usinasMatch[0].id !== USINA_LINHARES) {
    throw new Error(`Smoke test falhou: motor encontraria ${usinasMatch.length} usina(s) — D-48.1 não está efetivo`);
  }
  console.log('  ✅ Smoke OK — motor agora pega apenas Usina Linhares pra CoopereBR.');

  // FASE 6 — Gerar Cobrança DIEGO (passo 6/6 que faltou)
  console.log('\nFASE 6 — Gerar Cobrança DIEGO (passo 6/6 ausente)');
  const cobDiegoExiste = await prisma.cobranca.findFirst({ where: { contratoId: CTR_DIEGO } });
  if (cobDiegoExiste) {
    console.log(`  Cobrança DIEGO já existia: ${cobDiegoExiste.id} — não duplicando.`);
  } else {
    const cob: any = await faturas.gerarCobrancaPosFatura(FATURA_DIEGO);
    if (!cob) throw new Error('gerarCobrancaPosFatura DIEGO retornou null');
    console.log(`  ✅ Cobranca.id=${cob.id} modelo=${cob.modeloCobrancaUsado} liquido=${cob.valorLiquido} econMes=${cob.valorEconomiaMes}`);
  }

  // FASE 7 — 3 cooperados restantes
  console.log('\nFASE 7 — CAROLINA, ALMIR, THEOMAX (3 ciclos)');
  const persisted: any[] = [];
  let falhou = false;
  let erro: any = null;
  for (const p of PILOTOS_RESTANTES) {
    console.log(`\n─────────── ${p.apelido} ───────────`);
    try {
      const out = await processarPiloto(prisma, motor, faturas, p);
      persisted.push(out);
    } catch (err: any) {
      console.error(`🔴 EXCEÇÃO em ${p.apelido}: ${err?.message ?? err}`);
      console.error(err?.stack ?? '');
      falhou = true;
      erro = { apelido: p.apelido, msg: err?.message };
      break;
    }
  }

  // FASE 8 — Validação agregada
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('FASE 8 — Validação agregada');
  console.log('═══════════════════════════════════════════════════════');

  const cpfs = ['05375082799', '08649654789', '68691157704', '43896674000129'];
  const cooperados = await prisma.cooperado.findMany({
    where: { cooperativaId: COOP_ID, ambienteTeste: true, cpf: { in: cpfs } },
    select: { id: true, nomeCompleto: true, cpf: true },
  });
  console.log(`Cooperados (esperado 4): ${cooperados.length}`);

  const cooperadoIds = cooperados.map((c) => c.id);
  const contratos = await prisma.contrato.findMany({
    where: {
      cooperadoId: { in: cooperadoIds },
      status: 'ATIVO' as any,
      valorContrato: { not: null },
      valorCheioKwhAceite: { not: null },
    },
    select: { id: true, numero: true, status: true, valorContrato: true, valorCheioKwhAceite: true, baseCalculoAplicado: true, usinaId: true, cooperadoId: true },
  });
  console.log(`Contratos ATIVO + snapshots Fase B (esperado 4): ${contratos.length}`);
  for (const c of contratos) console.log(`  - ${c.numero} usinaId=${c.usinaId} valorContrato=${c.valorContrato} valorCheio=${c.valorCheioKwhAceite}`);

  const contratoIds = contratos.map((c) => c.id);
  const cobAgg = await prisma.cobranca.aggregate({
    where: {
      modeloCobrancaUsado: 'FIXO_MENSAL' as any,
      valorEconomiaMes: { gt: 0 },
      contratoId: { in: contratoIds.length > 0 ? contratoIds : ['_'] },
    },
    _count: { _all: true },
    _sum: { valorLiquido: true, valorEconomiaMes: true },
  });
  console.log(`Cobranças FIXO_MENSAL econ > 0 (esperado 4): count=${cobAgg._count._all} sumLiquido=${cobAgg._sum.valorLiquido} sumEconMes=${cobAgg._sum.valorEconomiaMes}`);

  // Auditoria multi-tenant divergencias globais
  const divergencias = await prisma.$queryRawUnsafe<any[]>(
    `SELECT ct.id, ct.numero, ct."usinaId", u."cooperativaId" AS usina_coop, ct."cooperativaId" AS ct_coop
     FROM contratos ct
     LEFT JOIN usinas u ON u.id = ct."usinaId"
     WHERE ct."usinaId" IS NOT NULL
       AND u."cooperativaId" != ct."cooperativaId"`
  );
  console.log(`Auditoria multi-tenant — contratos com usina divergente (esperado 0): ${divergencias.length}`);
  for (const d of divergencias) console.log(`  - ${JSON.stringify(d)}`);

  console.log('\n═══════════════════════════════════════════════════════');
  console.log('RESUMO');
  console.log('═══════════════════════════════════════════════════════');
  for (const p of persisted) console.log(JSON.stringify(p));
  if (falhou) {
    console.log(`\n🔴 FALHOU em ${erro?.apelido}: ${erro?.msg}`);
  } else if (cooperados.length === 4 && contratos.length === 4 && cobAgg._count._all === 4 && divergencias.length === 0) {
    console.log('\n✅ 4/4/4/0 — Sub-Fase A FECHADA + auditoria multi-tenant LIMPA');
  } else {
    console.log(`\n🟠 PARCIAL: coop=${cooperados.length} ctr=${contratos.length} cob=${cobAgg._count._all} div=${divergencias.length}`);
  }

  await app.close();
}

main().catch((e) => {
  console.error('ERRO TOP-LEVEL:', e);
  process.exit(1);
});
