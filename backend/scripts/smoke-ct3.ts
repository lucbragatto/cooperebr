/**
 * Smoke CT.3 runtime — hooks automáticos de lançamento classificado.
 *
 * Valida em runtime:
 *  1. criarLancamentoAutomatico cria LancamentoCaixa com naturezaAto correto
 *  2. Idempotência: chamar 2x com mesmo origemId → 1 só lançamento
 *  3. Classificação real:
 *     - Cobranca cooperado COM_UC → PROPRIO
 *     - Cobranca terceiro USUARIO_CARREGADOR → NAO_COOPERATIVO
 *     - Repasse usina ALUGUEL → NAO_COOPERATIVO
 *     - Repasse usina CESSAO → PROPRIO
 *     - ContaAPagar → PROPRIO
 *  4. Sem TENANT-LEAK warns (runAsPlatform interno)
 *  5. Cleanup
 *
 * Rodar: `npx ts-node scripts/smoke-ct3.ts`
 */
import { PrismaClient, Prisma, NaturezaCooperativa, OrigemLancamento } from '@prisma/client';
import { Logger } from '@nestjs/common';
import { ContabilidadeTributariaService } from '../src/contabilidade-tributaria/contabilidade-tributaria.service';
import { RegimeContabilFactory } from '../src/contabilidade-tributaria/regimes/regime.factory';

const prisma = new PrismaClient();

type Result = { name: string; ok: boolean; detail?: string };
const results: Result[] = [];
function assert(name: string, ok: boolean, detail?: string) {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'OK ' : 'XX '} ${name}${detail ? '  → ' + detail : ''}`);
}

async function main() {
  const ts = Date.now();
  console.log(`\n=== Smoke CT.3 hooks automáticos — ts ${ts} ===\n`);

  // Captura warns extension
  const warns: string[] = [];
  const origWarn = Logger.prototype.warn;
  Logger.prototype.warn = function (msg: any) {
    if (typeof msg === 'string' && msg.includes('TENANT-LEAK-DETECT')) warns.push(msg);
    return origWarn.apply(this, arguments as any);
  };

  // Setup tenant + recursos
  const coop = await prisma.cooperativa.create({
    data: { nome: `CT3 ${ts}`, cnpj: `ct3${ts}`.slice(0, 14), tipoParceiro: 'COOPERATIVA' },
  });

  const coopadoComUc = await prisma.cooperado.create({
    data: {
      nomeCompleto: 'CT3 ComUC',
      cpf: `ct3-comuc-${ts}`,
      email: `lucbragatto+ct3-comuc-${ts}@gmail.com`,
      telefone: '27981341348',
      cooperativaId: coop.id,
      tipoCooperado: 'COM_UC',
    },
  });

  const coopadoCarregador = await prisma.cooperado.create({
    data: {
      nomeCompleto: 'CT3 Carregador',
      cpf: `ct3-carr-${ts}`,
      email: `lucbragatto+ct3-carr-${ts}@gmail.com`,
      telefone: '27981341348',
      cooperativaId: coop.id,
      tipoCooperado: 'USUARIO_CARREGADOR',
    },
  });

  const usinaAluguel = await prisma.usina.create({
    data: {
      nome: `CT3 Aluguel`,
      apelidoInterno: `ct3-aluguel-${ts}`,
      potenciaKwp: new Prisma.Decimal(100),
      cidade: 'V',
      estado: 'ES',
      cooperativaId: coop.id,
      formaAquisicao: 'ALUGUEL',
    },
  });

  const usinaCessao = await prisma.usina.create({
    data: {
      nome: `CT3 Cessao`,
      apelidoInterno: `ct3-cessao-${ts}`,
      potenciaKwp: new Prisma.Decimal(100),
      cidade: 'V',
      estado: 'ES',
      cooperativaId: coop.id,
      formaAquisicao: 'CESSAO',
    },
  });

  console.log('Setup OK.\n');

  const factory = new RegimeContabilFactory();
  const service = new ContabilidadeTributariaService(prisma as any, factory);

  try {
    // 1. Cobranca cooperado COM_UC → PROPRIO
    const cob1 = await service.criarLancamentoAutomatico({
      cooperativaId: coop.id,
      origemTipo: OrigemLancamento.COBRANCA,
      origemId: `cob-comuc-${ts}`,
      fonte: { tipo: 'COBRANCA', cooperadoTipoCooperado: 'COM_UC' },
      tipo: 'RECEITA',
      descricao: 'Cobranca ComUC test',
      valor: 100,
      competencia: '2030-05',
      dataPagamento: new Date(),
      cooperadoId: coopadoComUc.id,
    });
    assert('Cobranca COM_UC → naturezaAto=PROPRIO', cob1.naturezaAto === NaturezaCooperativa.PROPRIO);
    assert('Cobranca COM_UC → lançamento criado (criado=true)', cob1.criado === true);

    // 2. Idempotência — mesma origem 2x
    const cob1_2 = await service.criarLancamentoAutomatico({
      cooperativaId: coop.id,
      origemTipo: OrigemLancamento.COBRANCA,
      origemId: `cob-comuc-${ts}`, // mesma!
      fonte: { tipo: 'COBRANCA', cooperadoTipoCooperado: 'COM_UC' },
      tipo: 'RECEITA',
      descricao: 'Cobranca ComUC test',
      valor: 100,
      competencia: '2030-05',
      dataPagamento: new Date(),
      cooperadoId: coopadoComUc.id,
    });
    assert('Idempotência: 2ª chamada retorna o mesmo id', cob1_2.id === cob1.id);
    assert('Idempotência: 2ª chamada criado=false (já existia)', cob1_2.criado === false);

    const totalCobranca = await prisma.lancamentoCaixa.count({
      where: { origemTipo: 'COBRANCA', origemId: `cob-comuc-${ts}` },
    });
    assert(`Idempotência: contagem no banco = 1 (encontrado ${totalCobranca})`, totalCobranca === 1);

    // 3. Cobranca terceiro USUARIO_CARREGADOR → NAO_COOPERATIVO
    const cob2 = await service.criarLancamentoAutomatico({
      cooperativaId: coop.id,
      origemTipo: OrigemLancamento.COBRANCA,
      origemId: `cob-carr-${ts}`,
      fonte: { tipo: 'COBRANCA', cooperadoTipoCooperado: 'USUARIO_CARREGADOR' },
      tipo: 'RECEITA',
      descricao: 'Cobranca Carregador test',
      valor: 50,
      competencia: '2030-05',
      dataPagamento: new Date(),
      cooperadoId: coopadoCarregador.id,
    });
    assert('Cobranca USUARIO_CARREGADOR → NAO_COOPERATIVO', cob2.naturezaAto === NaturezaCooperativa.NAO_COOPERATIVO);

    // 4. Repasse ALUGUEL → NAO_COOPERATIVO (via helper criarLancamentoRepasse)
    const rep1 = await service.criarLancamentoRepasse(
      `rep-aluguel-${ts}`,
      coop.id,
      usinaAluguel.id,
      new Prisma.Decimal(1000),
      new Date(),
    );
    assert('Repasse usina ALUGUEL → NAO_COOPERATIVO (P0-3 do parecer)', rep1.naturezaAto === NaturezaCooperativa.NAO_COOPERATIVO);

    // 5. Repasse CESSAO → PROPRIO
    const rep2 = await service.criarLancamentoRepasse(
      `rep-cessao-${ts}`,
      coop.id,
      usinaCessao.id,
      new Prisma.Decimal(500),
      new Date(),
    );
    assert('Repasse usina CESSAO → PROPRIO', rep2.naturezaAto === NaturezaCooperativa.PROPRIO);

    // 6. ContaAPagar → PROPRIO
    const cp = await service.criarLancamentoAutomatico({
      cooperativaId: coop.id,
      origemTipo: OrigemLancamento.CONTA_PAGAR,
      origemId: `cp-${ts}`,
      fonte: { tipo: 'CONTA_A_PAGAR' },
      tipo: 'DESPESA',
      descricao: 'Despesa op',
      valor: 200,
      competencia: '2030-05',
      dataPagamento: new Date(),
    });
    assert('ContaAPagar → PROPRIO', cp.naturezaAto === NaturezaCooperativa.PROPRIO);

    // 7. Sem TENANT-LEAK warns (hooks rodam em runAsPlatform)
    assert(`Extension F1.3 não loga TENANT-LEAK em hooks (warns capturados: ${warns.length})`, warns.length === 0);
  } finally {
    console.log('\nCleanup...');
    try { await prisma.lancamentoCaixa.deleteMany({ where: { cooperativaId: coop.id } }); } catch {}
    try { await prisma.usina.deleteMany({ where: { cooperativaId: coop.id } }); } catch {}
    try { await prisma.cooperado.deleteMany({ where: { cooperativaId: coop.id } }); } catch {}
    try { await prisma.cooperativa.delete({ where: { id: coop.id } }); } catch {}
    Logger.prototype.warn = origWarn;
    console.log('Cleanup OK.\n');
  }

  const fails = results.filter((r) => !r.ok);
  console.log(`\n=== Resumo: ${results.length - fails.length}/${results.length} OK ===`);
  if (fails.length > 0) {
    console.error('FALHAS:');
    fails.forEach((f) => console.error(` - ${f.name} ${f.detail ?? ''}`));
    process.exitCode = 1;
  } else {
    console.log('✅ CT.3 hooks runtime validados.\n');
  }
}

main()
  .catch((err) => { console.error('Erro fatal:', err); process.exitCode = 1; })
  .finally(async () => { await prisma.$disconnect(); });
