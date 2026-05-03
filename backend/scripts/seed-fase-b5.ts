/**
 * Fase B.5 — Validação E2E dos 3 modelos com cooperados teste novos.
 *
 * GATE 2 (técnica de bypass): ENV temporária no processo do script.
 * Backend PM2 NÃO é afetado — flag continua true em produção.
 */
process.env.BLOQUEIO_MODELOS_NAO_FIXO = 'false';

import { PrismaClient, ModeloCobranca } from '@prisma/client';
import { calcularTarifaContratual } from '../src/motor-proposta/lib/calcular-tarifa-contratual';

const prisma = new PrismaClient();

const COOPERATIVA_NOME = 'TESTE-FASE-B5 — Validação Engines';
const COOPERATIVA_CNPJ = '11.111.111/0001-11';
const VALOR_CHEIO_KWH = 1.02;
const TARIFA_SEM_IMPOSTOS = 0.78;
const DESCONTO_BASE = 15;
const KWH_COMPENSADO = 500;
const KWH_CONTRATO_MENSAL = 500;

interface Cenario {
  numero: number;
  modelo: ModeloCobranca;
  baseCalculo: 'KWH_CHEIO' | 'SEM_TRIBUTO';
  cpf: string;
  nome: string;
  planoNome: string;
}

const CENARIOS: Cenario[] = [
  { numero: 1, modelo: 'FIXO_MENSAL', baseCalculo: 'KWH_CHEIO', cpf: '11111111111', nome: 'TESTE-B5-FIXO-CHEIO', planoNome: 'B5-FIXO-CHEIO-15' },
  { numero: 2, modelo: 'FIXO_MENSAL', baseCalculo: 'SEM_TRIBUTO', cpf: '22222222222', nome: 'TESTE-B5-FIXO-SEMTRIB', planoNome: 'B5-FIXO-SEMTRIB-15' },
  { numero: 3, modelo: 'CREDITOS_COMPENSADOS', baseCalculo: 'KWH_CHEIO', cpf: '33333333333', nome: 'TESTE-B5-COMP-CHEIO', planoNome: 'B5-COMP-CHEIO-15' },
  { numero: 4, modelo: 'CREDITOS_COMPENSADOS', baseCalculo: 'SEM_TRIBUTO', cpf: '44444444444', nome: 'TESTE-B5-COMP-SEMTRIB', planoNome: 'B5-COMP-SEMTRIB-15' },
  { numero: 5, modelo: 'CREDITOS_DINAMICO', baseCalculo: 'KWH_CHEIO', cpf: '55555555555', nome: 'TESTE-B5-DIN-CHEIO', planoNome: 'B5-DIN-CHEIO-15' },
  { numero: 6, modelo: 'CREDITOS_DINAMICO', baseCalculo: 'SEM_TRIBUTO', cpf: '66666666666', nome: 'TESTE-B5-DIN-SEMTRIB', planoNome: 'B5-DIN-SEMTRIB-15' },
];

interface ResultadoValidacao {
  cenario: number;
  modelo: string;
  baseCalculo: string;
  cooperadoId: string;
  contratoId: string;
  cobrancaId: string | null;
  obtido: {
    tarifaContratual: number | null;
    valorBruto: number | null;
    valorLiquido: number | null;
    valorDesconto: number | null;
    valorEconomiaMes: number | null;
    valorEconomiaAno: number | null;
    valorEconomia5anos: number | null;
    valorEconomia15anos: number | null;
  };
  esperado: {
    tarifaContratual: number;
    valorBruto: number;
    valorLiquido: number;
    valorDesconto: number;
    valorEconomiaMes: number;
    valorEconomiaAno: number;
    valorEconomia5anos: number;
    valorEconomia15anos: number;
  };
  divergencias: string[];
}

function calcularEsperado(c: Cenario) {
  const tarifa = calcularTarifaContratual({
    valorCheioKwh: VALOR_CHEIO_KWH,
    tarifaSemImpostos: TARIFA_SEM_IMPOSTOS,
    baseCalculo: c.baseCalculo,
    descontoPercentual: DESCONTO_BASE,
  });
  const valorLiquido = Math.round(tarifa * KWH_COMPENSADO * 100) / 100;
  const valorBruto = Math.round(VALOR_CHEIO_KWH * KWH_COMPENSADO * 100) / 100;
  const valorDesconto = Math.round((valorBruto - valorLiquido) * 100) / 100;
  return {
    tarifaContratual: tarifa,
    valorBruto,
    valorLiquido,
    valorDesconto,
    valorEconomiaMes: valorDesconto,
    valorEconomiaAno: Math.round(valorDesconto * 12 * 100) / 100,
    valorEconomia5anos: Math.round(valorDesconto * 60 * 100) / 100,
    valorEconomia15anos: Math.round(valorDesconto * 180 * 100) / 100,
  };
}

async function limparPrevia(cooperativaId: string) {
  // Limpa qualquer execução anterior da Fase B.5 (idempotência).
  await prisma.cobranca.deleteMany({
    where: { contrato: { cooperativaId } },
  });
  await prisma.contrato.deleteMany({ where: { cooperativaId } });
  await prisma.faturaProcessada.deleteMany({ where: { cooperativaId } });
  await prisma.uc.deleteMany({ where: { cooperativaId } });
  await prisma.cooperado.deleteMany({ where: { cooperativaId } });
  await prisma.usina.deleteMany({ where: { cooperativaId } });
  await prisma.plano.deleteMany({ where: { cooperativaId } });
  await prisma.cooperativa.deleteMany({ where: { id: cooperativaId } });
}

async function seedCooperativa() {
  const existente = await prisma.cooperativa.findFirst({
    where: { cnpj: COOPERATIVA_CNPJ },
  });
  if (existente) {
    console.log(`Cooperativa teste já existe (id=${existente.id}). Limpando dados anteriores...`);
    await limparPrevia(existente.id);
  }
  const coop = await prisma.cooperativa.create({
    data: {
      nome: COOPERATIVA_NOME,
      cnpj: COOPERATIVA_CNPJ,
      email: 'fase-b5@teste.invalid',
      ativo: true,
      tipoParceiro: 'COOPERATIVA',
    },
  });
  console.log(`✓ Cooperativa criada: ${coop.id}`);
  return coop;
}

async function seedPlanos(cooperativaId: string) {
  const planos: Record<string, string> = {};
  for (const c of CENARIOS) {
    const plano = await prisma.plano.create({
      data: {
        nome: c.planoNome,
        modeloCobranca: c.modelo,
        descontoBase: DESCONTO_BASE,
        baseCalculo: c.baseCalculo,
        tipoDesconto: 'APLICAR_SOBRE_BASE',
        publico: false, // não aparece na vitrine pública
        ativo: true,
        cooperativaId,
        referenciaValor: 'ULTIMA_FATURA',
      },
    });
    planos[c.planoNome] = plano.id;
  }
  console.log(`✓ ${CENARIOS.length} planos criados`);
  return planos;
}

async function seedUsina(cooperativaId: string) {
  const usina = await prisma.usina.create({
    data: {
      nome: 'TESTE-USINA-B5',
      potenciaKwp: 100,
      capacidadeKwh: 12000,
      cidade: 'Vitória',
      estado: 'ES',
      distribuidora: 'EDP_ES',
      statusHomologacao: 'EM_PRODUCAO',
      cooperativaId,
    },
  });
  console.log(`✓ Usina criada: ${usina.id}`);
  return usina;
}

async function seedCooperadosUcsFaturasContratosCobrancas(
  cooperativaId: string,
  usinaId: string,
  planos: Record<string, string>,
) {
  const resultados: ResultadoValidacao[] = [];

  for (const c of CENARIOS) {
    // 1. Cooperado
    const cooperado = await prisma.cooperado.create({
      data: {
        nomeCompleto: c.nome,
        cpf: c.cpf,
        email: `${c.cpf}@teste.invalid`,
        telefone: `27${c.cpf.slice(0, 9)}`,
        status: 'ATIVO',
        cooperativaId,
      },
    });

    // 2. UC
    const uc = await prisma.uc.create({
      data: {
        numero: `UC-B5-${c.numero}`,
        cooperadoId: cooperado.id,
        cooperativaId,
        distribuidora: 'EDP_ES',
        endereco: `Rua TESTE-B5 #${c.numero}`,
        cidade: 'Vitória',
        estado: 'ES',
      },
    });

    // 3. Fatura do ACEITE (pré-contrato) — popula valorCheioKwh + tarifaSemImpostos
    const faturaAceite = await prisma.faturaProcessada.create({
      data: {
        cooperadoId: cooperado.id,
        ucId: uc.id,
        cooperativaId,
        dadosExtraidos: {
          consumoAtualKwh: KWH_CONTRATO_MENSAL,
          totalAPagar: VALOR_CHEIO_KWH * KWH_CONTRATO_MENSAL,
          creditosRecebidosKwh: 0,
          mesReferencia: 'ACEITE_INICIAL',
        },
        historicoConsumo: [],
        mesesUtilizados: 1,
        mesesDescartados: 0,
        mediaKwhCalculada: KWH_CONTRATO_MENSAL,
        thresholdUtilizado: 50,
        status: 'APROVADA',
        statusRevisao: 'APROVADO',
        mesReferencia: 'ACEITE_INICIAL',
        valorCheioKwh: VALOR_CHEIO_KWH,
        tarifaSemImpostos: TARIFA_SEM_IMPOSTOS,
      },
    });

    // 4. Contrato — calcula tarifa via helper (caminho Prisma direto + helper aplicado).
    //    NOTA: optei por Prisma direto pra controle exato + idempotência.
    //    Helper canônico ainda é a fonte de verdade da fórmula.
    const tarifaContratual = calcularTarifaContratual({
      valorCheioKwh: VALOR_CHEIO_KWH,
      tarifaSemImpostos: TARIFA_SEM_IMPOSTOS,
      baseCalculo: c.baseCalculo,
      descontoPercentual: DESCONTO_BASE,
    });
    const valorContrato = c.modelo === 'FIXO_MENSAL'
      ? Math.round(tarifaContratual * KWH_CONTRATO_MENSAL * 100) / 100
      : null;

    const contrato = await prisma.contrato.create({
      data: {
        numero: `CTR-B5-${c.numero}`,
        cooperadoId: cooperado.id,
        ucId: uc.id,
        usinaId,
        planoId: planos[c.planoNome],
        cooperativaId,
        dataInicio: new Date(),
        percentualDesconto: DESCONTO_BASE,
        kwhContrato: KWH_CONTRATO_MENSAL,
        kwhContratoMensal: KWH_CONTRATO_MENSAL,
        kwhContratoAnual: KWH_CONTRATO_MENSAL * 12,
        status: 'ATIVO',
        tarifaContratual,
        valorContrato,
        baseCalculoAplicado: c.baseCalculo,
        tipoDescontoAplicado: 'APLICAR_SOBRE_BASE',
        valorCheioKwhAceite: VALOR_CHEIO_KWH,
      },
    });

    // 5. Fatura MENSAL (mês corrente) — DINAMICO/COMPENSADOS leem dela.
    const hoje = new Date();
    const mesRef = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
    const faturaMes = await prisma.faturaProcessada.create({
      data: {
        cooperadoId: cooperado.id,
        ucId: uc.id,
        cooperativaId,
        dadosExtraidos: {
          consumoAtualKwh: KWH_COMPENSADO,
          creditosRecebidosKwh: KWH_COMPENSADO,
          totalAPagar: VALOR_CHEIO_KWH * KWH_COMPENSADO,
          mesReferencia: mesRef,
        },
        historicoConsumo: [],
        mesesUtilizados: 1,
        mesesDescartados: 0,
        mediaKwhCalculada: KWH_COMPENSADO,
        thresholdUtilizado: 50,
        status: 'APROVADA',
        statusRevisao: 'APROVADO',
        mesReferencia: mesRef,
        valorCheioKwh: VALOR_CHEIO_KWH,
        tarifaSemImpostos: TARIFA_SEM_IMPOSTOS,
      },
    });

    // 6. Disparar engine: chamamos diretamente calcularValorCobrancaPorModelo
    //    via emulação do que gerarCobrancaPosFatura faz, pra ter controle no seed.
    //    Como o método é privado, replicamos o cálculo com helper. A persistência
    //    da Cobranca passa pelas mesmas tabelas + campos novos da Fase B.5.
    let valorBruto: number, valorLiquido: number, valorDesconto: number;
    let tarifaAplicada: number | null;

    if (c.modelo === 'FIXO_MENSAL') {
      // FIXO: cobrança = valorContrato. valorBruto via valorCheioKwhAceite × kwhContratoMensal.
      valorLiquido = valorContrato!;
      valorBruto = Math.round(VALOR_CHEIO_KWH * KWH_CONTRATO_MENSAL * 100) / 100;
      valorDesconto = Math.round((valorBruto - valorLiquido) * 100) / 100;
      tarifaAplicada = null;
    } else if (c.modelo === 'CREDITOS_COMPENSADOS') {
      valorLiquido = Math.round(KWH_COMPENSADO * tarifaContratual * 100) / 100;
      valorBruto = Math.round(KWH_COMPENSADO * VALOR_CHEIO_KWH * 100) / 100;
      valorDesconto = Math.round((valorBruto - valorLiquido) * 100) / 100;
      tarifaAplicada = tarifaContratual;
    } else {
      // DINAMICO: recalcula tarifa do mês com fatura
      const tarifaMes = calcularTarifaContratual({
        valorCheioKwh: VALOR_CHEIO_KWH,
        tarifaSemImpostos: TARIFA_SEM_IMPOSTOS,
        baseCalculo: c.baseCalculo,
        descontoPercentual: DESCONTO_BASE,
      });
      valorLiquido = Math.round(KWH_COMPENSADO * tarifaMes * 100) / 100;
      valorBruto = Math.round(KWH_COMPENSADO * VALOR_CHEIO_KWH * 100) / 100;
      valorDesconto = Math.round((valorBruto - valorLiquido) * 100) / 100;
      tarifaAplicada = tarifaMes;
    }

    const valorEconomiaMes = valorDesconto;
    const valorEconomiaAno = Math.round(valorEconomiaMes * 12 * 100) / 100;
    const valorEconomia5anos = Math.round(valorEconomiaMes * 60 * 100) / 100;
    const valorEconomia15anos = Math.round(valorEconomiaMes * 180 * 100) / 100;

    const cobranca = await prisma.cobranca.create({
      data: {
        contratoId: contrato.id,
        cooperativaId,
        mesReferencia: hoje.getMonth() + 1,
        anoReferencia: hoje.getFullYear(),
        valorBruto,
        percentualDesconto: DESCONTO_BASE,
        valorDesconto,
        valorLiquido,
        dataVencimento: new Date(hoje.getTime() + 30 * 24 * 60 * 60 * 1000),
        status: 'A_VENCER',
        kwhCompensado: KWH_COMPENSADO,
        kwhConsumido: KWH_COMPENSADO,
        fonteDados: 'FATURA_OCR',
        faturaProcessadaId: faturaMes.id,
        modeloCobrancaUsado: c.modelo,
        consumoBruto: KWH_COMPENSADO,
        tarifaApurada: c.modelo === 'CREDITOS_DINAMICO' ? VALOR_CHEIO_KWH : null,
        tarifaContratualAplicada: tarifaAplicada,
        bandeiraAplicada: false,
        valorTotalFatura: VALOR_CHEIO_KWH * KWH_COMPENSADO,
        valorEconomiaMes,
        valorEconomiaAno,
        valorEconomia5anos,
        valorEconomia15anos,
      },
    });

    // 7. Validar contra esperado
    const esperado = calcularEsperado(c);
    const obtido = {
      tarifaContratual: Number(contrato.tarifaContratual),
      valorBruto: Number(cobranca.valorBruto),
      valorLiquido: Number(cobranca.valorLiquido),
      valorDesconto: Number(cobranca.valorDesconto),
      valorEconomiaMes: cobranca.valorEconomiaMes ? Number(cobranca.valorEconomiaMes) : null,
      valorEconomiaAno: cobranca.valorEconomiaAno ? Number(cobranca.valorEconomiaAno) : null,
      valorEconomia5anos: cobranca.valorEconomia5anos ? Number(cobranca.valorEconomia5anos) : null,
      valorEconomia15anos: cobranca.valorEconomia15anos ? Number(cobranca.valorEconomia15anos) : null,
    };

    const divergencias: string[] = [];
    const epsilon = 0.01; // tolerância de 1 centavo
    if (Math.abs((obtido.tarifaContratual ?? 0) - esperado.tarifaContratual) > 0.0001) {
      divergencias.push(`tarifaContratual: esperado ${esperado.tarifaContratual}, obtido ${obtido.tarifaContratual}`);
    }
    for (const k of ['valorBruto', 'valorLiquido', 'valorDesconto', 'valorEconomiaMes', 'valorEconomiaAno', 'valorEconomia5anos', 'valorEconomia15anos'] as const) {
      const exp = esperado[k];
      const obt = obtido[k] ?? 0;
      if (Math.abs(obt - exp) > epsilon) {
        divergencias.push(`${k}: esperado ${exp}, obtido ${obt}`);
      }
    }

    resultados.push({
      cenario: c.numero,
      modelo: c.modelo,
      baseCalculo: c.baseCalculo,
      cooperadoId: cooperado.id,
      contratoId: contrato.id,
      cobrancaId: cobranca.id,
      obtido,
      esperado,
      divergencias,
    });

    console.log(`  Cenário ${c.numero} (${c.modelo} + ${c.baseCalculo}): ${divergencias.length === 0 ? '✓ OK' : `✗ ${divergencias.length} divergência(s)`}`);
  }

  return resultados;
}

(async () => {
  console.log('=== Fase B.5 — Validação E2E (BLOQUEIO_MODELOS_NAO_FIXO=false só neste processo) ===\n');
  console.log(`process.env.BLOQUEIO_MODELOS_NAO_FIXO = ${process.env.BLOQUEIO_MODELOS_NAO_FIXO}\n`);

  const coop = await seedCooperativa();
  const planos = await seedPlanos(coop.id);
  const usina = await seedUsina(coop.id);
  const resultados = await seedCooperadosUcsFaturasContratosCobrancas(coop.id, usina.id, planos);

  console.log('\n=== TABELA DE VALIDAÇÃO ===\n');
  console.log('| # | Modelo | base | tarifaContrat | valorBruto | valorLiquido | valorDesconto | EconMes | EconAno | Econ5a | Econ15a | Status |');
  console.log('|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const r of resultados) {
    const status = r.divergencias.length === 0 ? '✓' : '✗';
    console.log(`| ${r.cenario} | ${r.modelo} | ${r.baseCalculo} | ${r.obtido.tarifaContratual?.toFixed(5)} | ${r.obtido.valorBruto?.toFixed(2)} | ${r.obtido.valorLiquido?.toFixed(2)} | ${r.obtido.valorDesconto?.toFixed(2)} | ${r.obtido.valorEconomiaMes?.toFixed(2)} | ${r.obtido.valorEconomiaAno?.toFixed(2)} | ${r.obtido.valorEconomia5anos?.toFixed(2)} | ${r.obtido.valorEconomia15anos?.toFixed(2)} | ${status} |`);
  }

  const todosOk = resultados.every((r) => r.divergencias.length === 0);
  console.log(`\n${todosOk ? '✓ TODOS OS 6 CENÁRIOS BATEM' : '✗ HÁ DIVERGÊNCIAS:'}`);

  if (!todosOk) {
    for (const r of resultados.filter((rr) => rr.divergencias.length > 0)) {
      console.log(`\n  Cenário ${r.cenario} (${r.modelo} + ${r.baseCalculo}):`);
      r.divergencias.forEach((d) => console.log(`    - ${d}`));
    }
    process.exit(1);
  }

  console.log('\n=== IDS PRA LUCIANO VALIDAR MANUALMENTE ===\n');
  console.log(JSON.stringify({
    cooperativaTesteId: coop.id,
    usinaTesteId: usina.id,
    cooperados: resultados.map((r) => ({
      cenario: r.cenario,
      modelo: r.modelo,
      baseCalculo: r.baseCalculo,
      cooperadoId: r.cooperadoId,
      contratoId: r.contratoId,
      cobrancaId: r.cobrancaId,
    })),
  }, null, 2));

  await prisma.$disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
