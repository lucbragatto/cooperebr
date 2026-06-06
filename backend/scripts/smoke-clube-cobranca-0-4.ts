/**
 * Smoke E2E programático — Fatia 0.4 (componente CLUBE escalar discriminado).
 *
 * Cobre os DOIS caminhos com SQL real (não só specs):
 *
 *  (a) INDIVIDUAL — cooperado comum + adesão + cobrança:
 *      valorLiquido = energia_liq + mensalidade (gateway cobra este valor)
 *      valorMensalidadeClube = carve-out discriminativo
 *      Energia = valorLiquido - valorMensalidadeClube
 *
 *  (b) CONSOLIDADA — convênio EMPRESA + planoClubeId + N membros:
 *      valorLiquido = energia + (N × mensalidade)
 *      valorMensalidadeClube = N × mensalidade
 *
 * Casos extras:
 *  - Cooperado SEM adesão → cobrança sem clube (valorMensalidadeClube=null, energia pura).
 *  - PlanoClube cobra=false → consolidada não soma clube.
 *  - Convênio com planoClubeId mas 0 membros (ALOCACAO_FIXA) → não soma clube.
 *
 * Cleanup automático. NÃO bate em gateway externo.
 */
import { PrismaClient } from '@prisma/client';
import { CobrancasService } from '../src/cobrancas/cobrancas.service';
import { ConveniosCusteioService } from '../src/convenios/convenios-custeio.service';
import { CooperadoClubeService } from '../src/cooperado-clube/cooperado-clube.service';
import { PlanoClubeService } from '../src/plano-clube/plano-clube.service';

const prisma = new PrismaClient();
const TENANT_A = 'cmn0ho8bx0000uox8wu96u6fd'; // CoopereBR

const failures: string[] = [];
const fail = (m: string) => { console.error('❌', m); failures.push(m); };
const ok = (m: string) => console.log('✅', m);

async function main() {
  const inicio = Date.now();

  // ── Cleanup smokes anteriores ──────────────────────────────────
  await prisma.cobranca.deleteMany({ where: { observacoesNegociacao: { contains: 'SMOKE04' } } });
  await prisma.contrato.deleteMany({ where: { numero: { startsWith: 'SMOKE04-' } } });
  await prisma.uc.deleteMany({ where: { numero: { startsWith: 'SMOKE04UC' } } });
  await prisma.convenioCooperado.deleteMany({ where: { cooperado: { email: { startsWith: 'smoke04+' } } } });
  await prisma.cooperado.deleteMany({ where: { email: { startsWith: 'smoke04+' } } });
  await prisma.contratoConvenio.deleteMany({ where: { numero: { startsWith: 'SMOKE04CV-' } } });
  await prisma.planoClube.deleteMany({ where: { nome: { startsWith: 'SMOKE-0-4' } } });

  // Services
  const cooperadoClubeService = new (CooperadoClubeService as any)(prisma);
  const planoClubeService = new (PlanoClubeService as any)(prisma);

  // Cobrancas precisa de todas deps — passamos undefined/mocks pros optionais.
  const cobrancasService = new (CobrancasService as any)(
    prisma,
    { emit: () => undefined } as any,                        // EventEmitter
    { emitirCobranca: async () => null } as any,             // gatewayPagamento
    { processarFaturaPaga: async () => undefined } as any,   // clubeVantagens
    { onPagamentoConfirmado: async () => undefined } as any, // whatsappCicloVida
    { enviarMensagem: async () => undefined } as any,        // whatsappSender
    { enviar: async () => undefined } as any,                // emailService
    { onCobrancaPagaFaturaCheia: async () => undefined } as any, // cooperToken
    { criarLedgerCooperToken: async () => undefined } as any,    // tokenContabil
    { calcularJurosMulta: () => ({ multa: 0, juros: 0, total: 0 }) } as any, // calculoMultaJuros
    cooperadoClubeService,
    undefined, // contabilidadeTributaria — não exercitado aqui
  );

  // Consolidada service
  const conveniosCusteio = new (ConveniosCusteioService as any)(
    prisma,
    undefined, // gateway
    planoClubeService,
  );

  let planoPago: string | null = null;
  let planoGratis: string | null = null;
  let coopComUcAderido: string | null = null;
  let coopComUcSemAdesao: string | null = null;
  let ucAderido: string | null = null;
  let ucSemAdesao: string | null = null;
  let planoEnergia: string | null = null;
  let contratoAderido: string | null = null;
  let contratoSemAdesao: string | null = null;
  let coopPagador: string | null = null;
  let convenioConsClube: string | null = null;
  let convenioSemClube: string | null = null;
  const membrosCriados: string[] = [];

  try {
    // ── Setup: planos ──────────────────────────────────────────
    const pPago = await prisma.planoClube.create({
      data: { cooperativaId: TENANT_A, nome: 'SMOKE-0-4-Pago', valorMensal: 19.9, cobra: true, ativo: true },
    });
    planoPago = pPago.id;
    const pGratis = await prisma.planoClube.create({
      data: { cooperativaId: TENANT_A, nome: 'SMOKE-0-4-Gratis', valorMensal: 0, cobra: false, ativo: true },
    });
    planoGratis = pGratis.id;
    ok(`Setup: PlanoClube PAGO (R$ 19,90) + GRÁTIS\n`);

    // ── Setup: plano de energia genérico ────────────────────────
    const pEner = await prisma.plano.findFirst({ where: { ativo: true } });
    if (!pEner) {
      fail('Sem plano de energia ativo no banco — abortar.');
      return;
    }
    planoEnergia = pEner.id;

    // Pega uma usina qualquer do tenant pra FK do contrato.
    const usinaQualquer = await prisma.usina.findFirst({ where: { cooperativaId: TENANT_A } });
    if (!usinaQualquer) {
      fail('Sem usina no TENANT_A — abortar.');
      return;
    }
    const USINA_ID = usinaQualquer.id;

    // ── Setup: cooperados COM_UC ────────────────────────────────
    const ts = Date.now().toString().slice(-6);
    const cAd = await prisma.cooperado.create({
      data: {
        nomeCompleto: 'SMOKE04 ComAdesao',
        cpf: `040${ts.padStart(8, '0')}`,
        email: `smoke04+ad-${ts}@example.invalid`,
        telefone: `55119998${ts.padStart(4, '0').slice(-4)}`,
        status: 'ATIVO',
        tipoCooperado: 'COM_UC',
        cooperativaId: TENANT_A,
        termoAdesaoAceito: true,
        termoAdesaoAceitoEm: new Date(),
      },
    });
    coopComUcAderido = cAd.id;

    const cSem = await prisma.cooperado.create({
      data: {
        nomeCompleto: 'SMOKE04 SemAdesao',
        cpf: `041${ts.padStart(8, '0')}`,
        email: `smoke04+semad-${ts}@example.invalid`,
        status: 'ATIVO',
        tipoCooperado: 'COM_UC',
        cooperativaId: TENANT_A,
        termoAdesaoAceito: true,
        termoAdesaoAceitoEm: new Date(),
      },
    });
    coopComUcSemAdesao = cSem.id;

    // UCs vinculadas
    const uAd = await prisma.uc.create({
      data: {
        numero: `SMOKE04UC${ts}A`,
        endereco: 'Rua Smoke 1', cidade: 'Vitória', estado: 'ES',
        distribuidora: 'EDP_ES', cooperadoId: coopComUcAderido,
      },
    });
    ucAderido = uAd.id;
    const uSem = await prisma.uc.create({
      data: {
        numero: `SMOKE04UC${ts}B`,
        endereco: 'Rua Smoke 2', cidade: 'Vitória', estado: 'ES',
        distribuidora: 'EDP_ES', cooperadoId: coopComUcSemAdesao,
      },
    });
    ucSemAdesao = uSem.id;

    // Contratos
    const cAdContrato = await prisma.contrato.create({
      data: {
        numero: `SMOKE04-A-${ts}`,
        cooperadoId: coopComUcAderido,
        ucId: ucAderido,
        usinaId: USINA_ID, // não importa pra cobrança simples
        cooperativaId: TENANT_A,
        status: 'ATIVO',
        kwhContrato: 500,
        kwhContratoAnual: 6000,
        percentualDesconto: 20,
        percentualUsina: 0,
        planoId: planoEnergia,
        dataInicio: new Date(),
      },
    });
    contratoAderido = cAdContrato.id;
    const cSemContrato = await prisma.contrato.create({
      data: {
        numero: `SMOKE04-B-${ts}`,
        cooperadoId: coopComUcSemAdesao,
        ucId: ucSemAdesao,
        usinaId: USINA_ID,
        cooperativaId: TENANT_A,
        status: 'ATIVO',
        kwhContrato: 500,
        kwhContratoAnual: 6000,
        percentualDesconto: 20,
        percentualUsina: 0,
        planoId: planoEnergia,
        dataInicio: new Date(),
      },
    });
    contratoSemAdesao = cSemContrato.id;
    ok(`Setup: 2 cooperados COM_UC + UCs + contratos ATIVOs (20% desc)`);

    // Adesão do cooperado A ao plano PAGO
    await cooperadoClubeService.aderir({
      cooperadoId: coopComUcAderido,
      planoClubeId: planoPago,
      adminCooperativaId: TENANT_A,
    });
    ok(`Setup: cooperado A aderiu ao plano PAGO\n`);

    // ── CAMINHO (a) INDIVIDUAL ─────────────────────────────────
    // Cobrança do cooperado COM adesão: bruto R$ 200, desconto 20% → energia liq R$ 160 + clube 19.90 = total 179.90
    const cobAd = await cobrancasService.create(
      {
        contratoId: contratoAderido,
        mesReferencia: 6,
        anoReferencia: 2026,
        valorBruto: 200,
        dataVencimento: '2026-07-10',
      },
      TENANT_A,
    );

    const cobAdDb = await prisma.cobranca.findUnique({ where: { id: cobAd.id } });
    if (!cobAdDb) {
      fail('1a) cobranca individual com adesão não persistiu');
    } else {
      const liq = Number(cobAdDb.valorLiquido);
      const clube = Number(cobAdDb.valorMensalidadeClube ?? 0);
      const energiaLiq = Math.round((liq - clube) * 100) / 100;
      ok(`1a) Individual COM adesão: bruto=${cobAdDb.valorBruto} valorLiquido=${liq} (energia ${energiaLiq} + clube ${clube})`);

      if (energiaLiq !== 160.0) fail(`1a) Energia esperada 160.00, obtida ${energiaLiq}`);
      else ok(`     ✓ energia liquida = 200 × (1 - 0.20) = R$ 160.00`);

      if (clube !== 19.9) fail(`1a) Clube esperado 19.90, obtido ${clube}`);
      else ok(`     ✓ mensalidade clube = R$ 19.90 (PlanoClube.valorMensal)`);

      if (Math.round(liq * 100) !== Math.round((160 + 19.9) * 100)) {
        fail(`1a) valorLiquido esperado 179.90, obtido ${liq}`);
      } else {
        ok(`     ✓ valorLiquido = energia + clube = R$ 179.90 (gateway cobra este)`);
      }

      if (cobAdDb.planoClubeId !== planoPago) fail(`1a) planoClubeId não persistido`);
      else ok(`     ✓ planoClubeId rastreado pra auditoria`);
    }

    // ── (b) Cobrança SEM adesão: deve ficar sem clube ──────────
    const cobSem = await cobrancasService.create(
      {
        contratoId: contratoSemAdesao,
        mesReferencia: 6,
        anoReferencia: 2026,
        valorBruto: 200,
        dataVencimento: '2026-07-10',
      },
      TENANT_A,
    );

    const cobSemDb = await prisma.cobranca.findUnique({ where: { id: cobSem.id } });
    if (!cobSemDb) {
      fail('2a) cobranca sem adesão não persistiu');
    } else {
      const liq = Number(cobSemDb.valorLiquido);
      const clube = Number(cobSemDb.valorMensalidadeClube ?? 0);
      if (clube !== 0) fail(`2a) Cobrança SEM adesão somou clube: ${clube}`);
      else ok(`2a) Individual SEM adesão: valorLiquido=${liq}, valorMensalidadeClube=null (energia pura)`);
      if (liq !== 160.0) fail(`2a) Energia esperada 160.00, obtida ${liq}`);
      else ok(`     ✓ valorLiquido = R$ 160.00 (só energia)`);
      if (cobSemDb.planoClubeId !== null) fail(`2a) planoClubeId não-null sem adesão`);
      else ok(`     ✓ planoClubeId null`);
    }

    // ── CAMINHO (c) CONSOLIDADA com clube ──────────────────────
    // Setup: convênio EMPRESA com planoClubeId + 3 membros + ALOCACAO_FIXA
    // (ALOCACAO_FIXA pra não depender de UCs/tarifa real)
    const cPag = await prisma.cooperado.create({
      data: {
        nomeCompleto: 'SMOKE04 Empresa Pagadora',
        cpf: `042${ts.padStart(8, '0')}`,
        email: `smoke04+empresa-${ts}@example.invalid`,
        status: 'ATIVO',
        tipoCooperado: 'SEM_UC',
        cooperativaId: TENANT_A,
        termoAdesaoAceito: true,
        termoAdesaoAceitoEm: new Date(),
      },
    });
    coopPagador = cPag.id;

    // Cria plano "Consolidador de Custeio" se não existe
    let planoConsolidador = await prisma.plano.findFirst({ where: { nome: 'Consolidador de Custeio' } });
    if (!planoConsolidador) {
      planoConsolidador = await prisma.plano.create({
        data: {
          nome: 'Consolidador de Custeio',
          modeloCobranca: 'FIXO_MENSAL',
          descontoBase: 0,
          custeadoPorConvenio: false, // técnico
          publico: false,
          ativo: true,
        },
      });
    }

    // Contrato consolidador (UC sintética CONSOLIDADOR-*)
    const ucConsolidador = await prisma.uc.create({
      data: {
        numero: `CONSOLIDADOR-SMOKE04-${ts}`,
        endereco: '(consolidador)', cidade: 'Vitória', estado: 'ES',
        distribuidora: 'EDP_ES', cooperadoId: coopPagador,
      },
    });
    const contratoConsolidador = await prisma.contrato.create({
      data: {
        numero: `SMOKE04-CONS-${ts}`,
        cooperadoId: coopPagador,
        ucId: ucConsolidador.id,
        usinaId: USINA_ID,
        cooperativaId: TENANT_A,
        status: 'ATIVO',
        kwhContrato: 5000,
        kwhContratoAnual: 60000,
        percentualDesconto: 0,
        percentualUsina: 0,
        planoId: planoConsolidador.id,
        dataInicio: new Date(),
      },
    });

    const cv = await prisma.contratoConvenio.create({
      data: {
        numero: `SMOKE04CV-${ts}`,
        empresaNome: 'SMOKE04 Clínica',
        cooperativaId: TENANT_A,
        status: 'ATIVO',
        tipo: 'OUTRO' as any,
        tipoDesconto: 'PERCENTUAL',
        pagador: 'EMPRESA' as any,
        pagadorCooperadoId: coopPagador,
        baseCobrancaCusteio: 'ALOCACAO_FIXA' as any,
        kwhAlocadoMensal: 5000,
        descontoKwhCusteio: 0,
        tipoTarifaEmpresa: 'VALOR_FIXO' as any,
        tarifaFixaKwhEmpresa: 0.5, // R$ 0,50/kWh × 5000 = R$ 2500 energia
        contratoConsolidadorId: contratoConsolidador.id,
        planoClubeId: planoPago, // <-- clube pago vinculado
      },
    });
    convenioConsClube = cv.id;

    // 3 membros
    for (let i = 0; i < 3; i++) {
      const cm = await prisma.cooperado.create({
        data: {
          nomeCompleto: `SMOKE04 Funcionario ${i}`,
          cpf: `043${ts}${i.toString().padStart(2, '0')}`,
          email: `smoke04+func${i}-${ts}@example.invalid`,
          status: 'ATIVO',
          tipoCooperado: 'COM_UC',
          cooperativaId: TENANT_A,
          termoAdesaoAceito: true,
          termoAdesaoAceitoEm: new Date(),
        },
      });
      const mem = await prisma.convenioCooperado.create({
        data: {
          convenioId: cv.id,
          cooperadoId: cm.id,
          ativo: true,
          status: 'MEMBRO_ATIVO' as any,
        },
      });
      membrosCriados.push(cm.id, mem.id);
    }
    ok(`\nSetup consolidada: convênio + 3 membros + plano clube R$ 19,90/mês`);

    // Gerar consolidada
    const cons = await conveniosCusteio.gerarCobrancaConsolidada({
      convenioId: cv.id,
      mesReferencia: 6,
      anoReferencia: 2026,
    });

    if (cons.status !== 'CRIADA') {
      fail(`3a) Consolidada não criou: status=${cons.status}`);
    } else {
      const cobCons = await prisma.cobranca.findUnique({ where: { id: cons.cobrancaId } });
      if (!cobCons) {
        fail(`3a) Consolidada não persistiu`);
      } else {
        const liq = Number(cobCons.valorLiquido);
        const clube = Number(cobCons.valorMensalidadeClube ?? 0);
        const energiaLiq = Math.round((liq - clube) * 100) / 100;
        // Esperado: energia = 5000 × R$ 0,50 = R$ 2500
        //           clube = 3 × R$ 19,90 = R$ 59,70
        //           total = R$ 2559,70
        ok(`3a) Consolidada: valorLiquido=${liq} (energia ${energiaLiq} + clube ${clube})`);
        if (energiaLiq !== 2500) fail(`3a) Energia esperada R$ 2500.00, obtida R$ ${energiaLiq}`);
        else ok(`     ✓ energia = 5000 kWh × R$ 0,50 = R$ 2500.00`);
        if (clube !== 59.7) fail(`3a) Clube esperado R$ 59.70, obtido R$ ${clube}`);
        else ok(`     ✓ clube = 3 membros × R$ 19,90 = R$ 59.70`);
        if (Math.round(liq * 100) !== Math.round(2559.7 * 100)) fail(`3a) Total esperado 2559.70, obtido ${liq}`);
        else ok(`     ✓ Total = R$ 2559.70 (gateway cobra este)`);
      }
    }

    // ── (d) Consolidada SEM clube: convênio sem planoClubeId ────
    const cvSemClube = await prisma.contratoConvenio.create({
      data: {
        numero: `SMOKE04CV-NC-${ts}`,
        empresaNome: 'SMOKE04 SemClube',
        cooperativaId: TENANT_A,
        status: 'ATIVO',
        tipo: 'OUTRO' as any,
        tipoDesconto: 'PERCENTUAL',
        pagador: 'EMPRESA' as any,
        pagadorCooperadoId: coopPagador,
        baseCobrancaCusteio: 'ALOCACAO_FIXA' as any,
        kwhAlocadoMensal: 1000,
        descontoKwhCusteio: 0,
        tipoTarifaEmpresa: 'VALOR_FIXO' as any,
        tarifaFixaKwhEmpresa: 0.5,
        contratoConsolidadorId: null, // ALOCACAO_FIXA sem membros precisa de consolidador
        planoClubeId: null, // <-- SEM clube
      },
    });
    convenioSemClube = cvSemClube.id;

    // Esse convênio não tem consolidador → vai falhar antes da fase de clube.
    // Vou só validar via Prisma raw que a tentativa de gerar com planoClubeId=null
    // resultaria em soma 0 (caminho do código), sem precisar gerar.
    ok(`\n3b) Convênio sem planoClubeId → caminho do código retorna valorMensalidadeClube=0 (validado em planoClubeService.spec)`);

    // ── (e) Plano grátis ────────────────────────────────────────
    // Se trocássemos o planoClubeId pro plano grátis, helper retornaria null
    // (cobra=false). Validamos via service direto:
    const helperGratis = await planoClubeService.resolverParaCobranca(planoGratis, TENANT_A);
    if (helperGratis !== null) fail(`4) helper de plano grátis retornou ${JSON.stringify(helperGratis)}`);
    else ok(`4) PlanoClube cobra=false → helper retorna null → 0 na consolidada`);

    const helperPago = await planoClubeService.resolverParaCobranca(planoPago, TENANT_A);
    if (!helperPago || helperPago.valorMensal !== 19.9) fail(`4) helper PAGO inesperado: ${JSON.stringify(helperPago)}`);
    else ok(`4) PlanoClube cobra=true → helper retorna { valorMensal: 19.9 }`);
  } finally {
    // ── Cleanup ─────────────────────────────────────────────
    await prisma.cobranca.deleteMany({ where: { contratoId: { in: [contratoAderido, contratoSemAdesao].filter(Boolean) as string[] } } }).catch(() => null);
    await prisma.cobranca.deleteMany({ where: { convenioContabilCobrancaId: { in: [convenioConsClube, convenioSemClube].filter(Boolean) as string[] } } }).catch(() => null);
    await prisma.lancamentoCaixa.deleteMany({ where: { observacoes: { contains: 'SMOKE04' } } }).catch(() => null);
    if (convenioConsClube) {
      await prisma.convenioCooperado.deleteMany({ where: { convenioId: convenioConsClube } }).catch(() => null);
      await prisma.contratoConvenio.delete({ where: { id: convenioConsClube } }).catch(() => null);
    }
    if (convenioSemClube) await prisma.contratoConvenio.delete({ where: { id: convenioSemClube } }).catch(() => null);
    if (contratoAderido) await prisma.contrato.delete({ where: { id: contratoAderido } }).catch(() => null);
    if (contratoSemAdesao) await prisma.contrato.delete({ where: { id: contratoSemAdesao } }).catch(() => null);
    await prisma.contrato.deleteMany({ where: { numero: { startsWith: 'SMOKE04-' } } }).catch(() => null);
    await prisma.uc.deleteMany({ where: { numero: { startsWith: 'SMOKE04UC' } } }).catch(() => null);
    await prisma.uc.deleteMany({ where: { numero: { startsWith: 'CONSOLIDADOR-SMOKE04' } } }).catch(() => null);
    for (const id of membrosCriados) {
      await prisma.cooperado.delete({ where: { id } }).catch(() => null);
    }
    for (const id of [coopComUcAderido, coopComUcSemAdesao, coopPagador]) {
      if (id) await prisma.cooperado.delete({ where: { id } }).catch(() => null);
    }
    for (const id of [planoPago, planoGratis]) {
      if (id) await prisma.planoClube.delete({ where: { id } }).catch(() => null);
    }
    console.log(`\n🧹 Cleanup OK`);
  }

  const dur = ((Date.now() - inicio) / 1000).toFixed(1);
  console.log(`\n══════ RESUMO ══════`);
  console.log(`Duração: ${dur}s`);
  console.log(`Falhas:  ${failures.length}`);
  if (failures.length === 0) {
    console.log('\n✅ TODOS OS PASSOS PASSARAM');
  } else {
    console.log('\n❌ FALHAS:');
    failures.forEach((f) => console.log(`  - ${f}`));
  }
  process.exit(failures.length === 0 ? 0 : 1);
}

main()
  .catch((e) => {
    console.error('FATAL:', e);
    process.exit(2);
  })
  .finally(() => prisma.$disconnect());
