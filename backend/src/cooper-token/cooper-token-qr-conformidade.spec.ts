/**
 * F0 (09/06/2026) — Conformidade do circuito CooperToken por QR.
 *
 * Cobre 2 bugs P0 confirmados em Fase 1 read-only da sessao M27 e corrigidos
 * na Fase 2 desta sessao:
 *
 *  (a) Cessao peer-to-peer (cooperado A paga cooperado B por QR) NAO emite
 *      saldo novo pra cooperativa — tokens circulam, nao nascem. Antes do fix,
 *      processarPagamentoQr chamava creditarSaldoParceiroTx em cima da
 *      quantidadeLiquida, inflando CooperTokenSaldoParceiro.saldoDisponivel.
 *
 *  (b) TAXA_QR aplicada UMA UNICA VEZ sobre o bruto dentro de
 *      processarPagamentoQr. Antes do fix, processarQrParceiro reaplicava
 *      TAXA_QR sobre resultado.quantidadeLiquida (que ja vinha liquido),
 *      resultando em taxa efetiva ~1,99% (parceiro recebia 98,01 num bruto
 *      de 100 em vez de 99).
 */
import * as jwt from 'jsonwebtoken';
import { CooperTokenService } from './cooper-token.service';

const SECRET = 'F0-cooper-token-secret-com-mais-de-32-chars';

const buildPrisma = (opts) => {
  const tx = {
    cooperTokenSaldo: {
      findUnique: jest.fn(({ where }) => {
        if (where.cooperadoId === 'pagador') {
          return Promise.resolve({ saldoDisponivel: opts.saldoPagador });
        }
        if (where.cooperadoId === 'recebedor') {
          return opts.saldoRecebedorExiste
            ? Promise.resolve({
                cooperadoId: 'recebedor',
                saldoDisponivel: 0,
                totalEmitido: 0,
              })
            : Promise.resolve(null);
        }
        return Promise.resolve(null);
      }),
      // F4 Bloco C.1 MT-5 — saldo do pagador agora via findFirst com filtro
      // cooperativaId (defesa em profundidade).
      findFirst: jest.fn(({ where }: any) => {
        if (where.cooperadoId === 'pagador') {
          return Promise.resolve({ saldoDisponivel: opts.saldoPagador });
        }
        return Promise.resolve(null);
      }),
      update: jest.fn().mockResolvedValue({}),
      create: jest.fn().mockResolvedValue({
        cooperadoId: 'recebedor',
        saldoDisponivel: 0,
        totalEmitido: 0,
      }),
    },
    cooperTokenLedger: {
      create: jest.fn().mockResolvedValue({}),
    },
    cooperTokenSaldoParceiro: {
      findUnique: jest.fn().mockResolvedValue(
        opts.saldoParceiroExiste
          ? { cooperativaId: 'coop-A', saldoDisponivel: 0, totalRecebido: 0 }
          : null,
      ),
      update: jest.fn().mockResolvedValue({}),
      create: jest.fn().mockResolvedValue({
        cooperativaId: 'coop-A',
        saldoDisponivel: 0,
      }),
    },
    // F4 Bloco C (12/06/2026) — processarPagamentoQr chama
    // criarTokenTransacao(tx, ...) que requer tx.cooperado.findUnique +
    // tx.tokenTransacao.count/create. Mocks neutros: tier=BAIXO,
    // motivo=PRIMEIRO_USO, jti deterministico — não afeta conformidade F0
    // (que valida taxa+valor, não jti).
    cooperado: {
      findUnique: jest.fn(({ where }: any) => {
        if (where.id === 'pagador') return Promise.resolve({ id: 'pagador', cooperativaId: 'coop-A' });
        if (where.id === 'recebedor') return Promise.resolve({ id: 'recebedor', cooperativaId: 'coop-A' });
        return Promise.resolve(null);
      }),
    },
    tokenTransacao: {
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn().mockResolvedValue({
        id: 'tt-qr',
        jti: 'jti-qr-conformidade',
        tier: 'BAIXO',
        motivoStepUp: 'PRIMEIRO_USO',
        status: 'CONFIRMADA',
      }),
    },
  };

  const prisma = {
    $transaction: jest.fn((cb) => cb(tx)),
    // F1.5 Bloco 2 (10/06/2026) — processarPagamentoQr agora le ConfigCooperToken
    // pra extrair taxaQrPerc/taxaQrFixa. Spec mocka findUnique → null pra
    // disparar o fallback do helper calcularTaxa (default 1% = TAXA_QR antigo).
    // F0 conformidade segue valendo: bruto 100 → taxa 1 → liquido 99.
    configCooperToken: {
      findUnique: jest.fn().mockResolvedValue(opts.config ?? null),
    },
  };

  return { prisma, tx };
};

const buildService = (prismaMock) => {
  const eventMock = { emit: jest.fn() };
  return new CooperTokenService(prismaMock, eventMock);
};

const gerarQrToken = (quantidade, cooperativaId = 'coop-A') =>
  jwt.sign(
    {
      pagadorId: 'pagador',
      cooperativaId,
      quantidade,
      tipo: 'COOPER_TOKEN_QR',
    },
    SECRET,
  );

describe('CooperTokenService — F0 conformidade QR (peer + parceiro)', () => {
  const ORIG_SECRET = process.env.COOPERTOKEN_QR_SECRET;

  beforeAll(() => {
    process.env.COOPERTOKEN_QR_SECRET = SECRET;
  });

  afterAll(() => {
    if (ORIG_SECRET === undefined) {
      delete process.env.COOPERTOKEN_QR_SECRET;
    } else {
      process.env.COOPERTOKEN_QR_SECRET = ORIG_SECRET;
    }
  });

  // ──────────────────────────────────────────────────────────────
  // (a) QR cooperado→cooperado NÃO altera CooperTokenSaldoParceiro
  // ──────────────────────────────────────────────────────────────
  it('(a) QR coop→coop NAO chama tx.cooperTokenSaldoParceiro.update/create', async () => {
    const { prisma, tx } = buildPrisma({
      saldoPagador: 100,
      saldoRecebedorExiste: false,
    });
    const service = buildService(prisma);

    await service.processarPagamentoQr({
      qrToken: gerarQrToken(100),
      recebedorId: 'recebedor',
      recebedorCooperativaId: 'coop-A',
    });

    expect(tx.cooperTokenSaldoParceiro.update).not.toHaveBeenCalled();
    expect(tx.cooperTokenSaldoParceiro.create).not.toHaveBeenCalled();
    // Ledger do parceiro tambem nao eh tocado (so 2 entradas: debito pagador
    // + credito recebedor — sem 3a linha de credito ao parceiro)
    expect(tx.cooperTokenLedger.create).toHaveBeenCalledTimes(2);
  });

  // ──────────────────────────────────────────────────────────────
  // (b) Taxa QR contada EXATAMENTE 1× sobre o bruto
  // ──────────────────────────────────────────────────────────────
  it('(b) processarPagamentoQr cobra taxa 1× sobre o BRUTO (bruto 100 → taxa 1 → liquido 99)', async () => {
    // M52b F1 (24/06): gate dual MELT controla cobrança. Pra simular gate ON,
    // passar `config.meltAtivado=true`. Sem config (default null), gate OFF
    // força líquido=bruto (taxa=0) — mata o leak ativo do taxaQrPerc=1.
    const { prisma } = buildPrisma({
      saldoPagador: 100,
      saldoRecebedorExiste: false,
      config: { meltAtivado: true },
    });
    const service = buildService(prisma);

    const r = await service.processarPagamentoQr({
      qrToken: gerarQrToken(100),
      recebedorId: 'recebedor',
      recebedorCooperativaId: 'coop-A',
    });

    expect(r.quantidadeBruta).toBe(100);
    expect(r.taxa).toBe(1);
    expect(r.quantidadeLiquida).toBe(99);
    // Invariante matematica: taxa = bruto * TAXA_QR, liquido = bruto - taxa
    expect(r.quantidadeBruta - r.taxa).toBe(r.quantidadeLiquida);
  });

  // ──────────────────────────────────────────────────────────────
  // (c) processarQrParceiro: parceiro creditado EXATAMENTE resultado.quantidadeLiquida
  //     e taxa retornada === resultado.taxa (sem reaplicar TAXA_QR)
  // ──────────────────────────────────────────────────────────────
  it('(c) processarQrParceiro credita parceiro = resultado.quantidadeLiquida (taxa NAO eh reaplicada)', async () => {
    // M52b F1 — gate ON via config.meltAtivado pra exercitar taxa>0.
    const { prisma, tx } = buildPrisma({
      saldoPagador: 100,
      saldoRecebedorExiste: false,
      saldoParceiroExiste: false,
      config: { meltAtivado: true },
    });
    const service = buildService(prisma);

    const r = await service.processarQrParceiro({
      qrToken: gerarQrToken(100),
      parceiroCooperativaId: 'coop-A',
      recebedorId: 'recebedor',
    });

    // Antes do fix: liquidoParceiro = 99 - 0,99 = 98,01 (taxa efetiva ~1,99%).
    // Depois do fix: liquidoParceiro = quantidadeLiquida = 99 (taxa 1%).
    expect(r.liquidoParceiro).toBe(99);
    expect(r.taxaCooperativaMae).toBe(1);
    expect(r.quantidadeLiquida).toBe(99);
    // Soma fechada: bruto = liquidoParceiro + taxa (1x cobrada, em nenhum lugar mais).
    expect(r.quantidadeBruta).toBe(r.liquidoParceiro + r.taxaCooperativaMae);

    // tx.cooperTokenSaldoParceiro.create foi chamado UMA VEZ (saldo inexistente,
    // criou) com saldoDisponivel === resultado.quantidadeLiquida.
    expect(tx.cooperTokenSaldoParceiro.create).toHaveBeenCalledTimes(1);
    const createArg = tx.cooperTokenSaldoParceiro.create.mock.calls[0][0];
    expect(createArg.data.saldoDisponivel).toBe(99);
    expect(createArg.data.totalRecebido).toBe(99);
  });

  // ──────────────────────────────────────────────────────────────
  // (d) Arredondamento Math.round(x*100)/100 — valores propagados sem ruido float
  // ──────────────────────────────────────────────────────────────
  it('(d) Valores derivados arredondam corretamente (Math.round(x*100)/100) e nao acumulam ruido float', async () => {
    // bruto 33 — produz taxa 0,33 e liquido 32,67. Sem rounding, 33 * 0.01
    // gera 0.33000000000000007 em JS (ruido float). O codigo usa
    // Math.round(... * 10000) / 10000 — tokens com 4 casas.
    // M52b F1 — gate ON via config.meltAtivado pra exercitar taxa>0.
    const { prisma } = buildPrisma({
      saldoPagador: 33,
      saldoRecebedorExiste: false,
      config: { meltAtivado: true },
    });
    const service = buildService(prisma);

    const r = await service.processarQrParceiro({
      qrToken: gerarQrToken(33),
      parceiroCooperativaId: 'coop-A',
      recebedorId: 'recebedor',
    });

    expect(r.quantidadeBruta).toBe(33);
    expect(r.taxa).toBe(0.33); // sem ruido float
    expect(r.quantidadeLiquida).toBe(32.67);
    expect(r.liquidoParceiro).toBe(32.67);
    expect(r.taxaCooperativaMae).toBe(0.33);
    // Math.round(x*100)/100 em valor monetario: arredondar pra 2 casas funciona
    // identico ja que liquido tem 2 casas decimais aqui.
    expect(Math.round(r.liquidoParceiro * 100) / 100).toBe(32.67);
    expect(Math.round(r.taxaCooperativaMae * 100) / 100).toBe(0.33);
  });
});
