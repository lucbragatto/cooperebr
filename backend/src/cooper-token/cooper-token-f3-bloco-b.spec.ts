/**
 * Sprint Clube P1 — F3 Bloco B (12/06/2026).
 *
 * Specs do service distribuirTokens. Cobertura:
 *
 *   Validação semântica das naturezas:
 *     - VOLUNTARIA sem empresaDeclaraTetoClt → BadRequest
 *     - PREMIACAO sem descricao (ou descricao curta) → BadRequest
 *     - ORIGEM_REGULAMENTO ignora os 2 → segue
 *
 *   Guards:
 *     - Empresa não-PJ (PF) → Forbidden
 *     - Empresa status inválido → Forbidden
 *     - Convênio não existe → NotFound
 *     - Convênio não-ATIVO → BadRequest
 *     - Empresa não é a conveniada (representante) → Forbidden
 *
 *   PIN:
 *     - PIN ausente/inválido → BadRequest
 *     - PIN_NAO_DEFINIDO → BadRequest com orientação
 *     - PIN_BLOQUEADO → Forbidden com desbloqueiaEm
 *     - PIN_INCORRETO → Forbidden
 *
 *   assertLimite sobre TOTAL (ajuste 2 Luciano):
 *     - somaValorReais > limiteTokenTransacao da empresa → BadRequest
 *
 *   Modo PREVIEW:
 *     - saldo insuficiente → alerta bloqueante SALDO_INSUFICIENTE; podeProsseguir=false
 *     - destinatários inválidos (não-MEMBRO_ATIVO) → alerta MEMBROS_INVALIDOS
 *     - happy path → podeProsseguir=true + resumo correto
 *
 *   Modo CONFIRM:
 *     - saldo OK + destinatários OK → grava em $transaction Serializable;
 *       N linhas: 2N ledger entries (DISTRIBUICAO_CONVENIO DEBITO + CREDITO)
 *       + N TokenTransacao com jti único + naturezaDistribuicao persistido
 *     - 1ª linha do ledger DEBITO grava referenciaId+referenciaTabela
 *       (idempotência); demais linhas ficam sem (mesma tx)
 *     - Idempotência hit: 2ª chamada com mesmo clientRequestId retorna
 *       resultado anterior sem reprocessar
 */
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CooperTokenService } from './cooper-token.service';

interface SetupOpts {
  empresa?: any;
  convenio?: any;
  pinResult?: any;
  limiteResult?: any;
  saldoEmpresaDisponivel?: number;
  membrosAtivos?: Array<{ cooperadoId: string; status?: string; cooperativaId?: string }>;
  ledgerExistenteIdempotencia?: any;
}

function setup(opts: SetupOpts = {}) {
  const EMPRESA_ID = 'empresa-pj-1';
  const COOPERATIVA = 'coop-A';
  const CONVENIO_ID = 'conv-1';
  const CLIENT_REQ = 'uuid-12345678-test-1234-9999-aaaabbbbcccc';

  const empresa = opts.empresa ?? {
    id: EMPRESA_ID,
    tipoPessoa: 'PJ',
    status: 'ATIVO',
    nomeCompleto: 'Santi Medicina',
  };

  const convenio = opts.convenio ?? {
    id: CONVENIO_ID,
    // Bug fix 15/06/2026 (blocker Santi) — guards do service agora usam
    // pagadorCooperadoId (D-FISCAL-2.4.1, Caso 1) em vez do conveniadoId
    // legado. Mock alinhado ao novo contrato.
    pagadorCooperadoId: EMPRESA_ID,
    status: 'ATIVO',
    empresaNome: 'Santi',
  };

  const membrosAtivos = opts.membrosAtivos ?? [
    { cooperadoId: 'func-1', status: 'ATIVO', cooperativaId: COOPERATIVA },
    { cooperadoId: 'func-2', status: 'ATIVO', cooperativaId: COOPERATIVA },
  ];

  const txCreateLedger = jest.fn().mockImplementation((arg: any) =>
    Promise.resolve({ id: `ledger-${Math.random()}`, ...arg.data }),
  );
  const txCreateTokenTransacao = jest.fn().mockResolvedValue({
    id: 'tt-1',
    jti: 'jti-test',
    tier: 'BAIXO',
    motivoStepUp: 'PRIMEIRO_USO',
    status: 'CONFIRMADA',
  });
  // F3 C.1 GAP — service agora usa updateMany (filtro pagadorCooperativaId).
  const txUpdateTokenTransacao = jest.fn().mockResolvedValue({ count: 1 });

  const tx: any = {
    cooperTokenSaldo: {
      findUnique: jest.fn(({ where }: any) => {
        if (where.cooperadoId === EMPRESA_ID) {
          return Promise.resolve({
            cooperadoId: EMPRESA_ID,
            saldoDisponivel: opts.saldoEmpresaDisponivel ?? 1000,
          });
        }
        return Promise.resolve(null);
      }),
      update: jest.fn().mockResolvedValue({}),
      create: jest.fn().mockResolvedValue({}),
    },
    cooperTokenLedger: { create: txCreateLedger },
    cooperado: {
      findUnique: jest.fn(({ where }: any) =>
        Promise.resolve({ id: where.id, cooperativaId: COOPERATIVA, status: 'ATIVO' }),
      ),
    },
    tokenTransacao: {
      count: jest.fn().mockResolvedValue(0),
      create: txCreateTokenTransacao,
      updateMany: txUpdateTokenTransacao,
    },
  };

  const transactionFn = jest.fn(async (cb: any, _o?: any) => cb(tx));

  const prisma: any = {
    $transaction: transactionFn,
    cooperado: {
      findFirst: jest.fn().mockResolvedValue(empresa),
    },
    contratoConvenio: {
      findFirst: jest.fn().mockResolvedValue(opts.convenio === null ? null : convenio),
    },
    cooperTokenSaldo: {
      findUnique: jest.fn(({ where }: any) => {
        if (where.cooperadoId === EMPRESA_ID) {
          return Promise.resolve({
            saldoDisponivel: opts.saldoEmpresaDisponivel ?? 1000,
          });
        }
        return Promise.resolve(null);
      }),
    },
    cooperTokenLedger: {
      findFirst: jest.fn().mockResolvedValue(opts.ledgerExistenteIdempotencia ?? null),
    },
    convenioCooperado: {
      findMany: jest.fn().mockResolvedValue(
        membrosAtivos.map((m) => ({
          cooperadoId: m.cooperadoId,
          cooperado: {
            status: m.status ?? 'ATIVO',
            cooperativaId: m.cooperativaId ?? COOPERATIVA,
            nomeCompleto: m.cooperadoId.toUpperCase(),
          },
        })),
      ),
    },
    configCooperToken: {
      findUnique: jest.fn().mockResolvedValue(null),
    },
    auditLog: { create: jest.fn().mockResolvedValue({}) },
  };

  const pinCooperadoService = {
    validarPinComLockout: jest
      .fn()
      .mockResolvedValue(opts.pinResult ?? { ok: true }),
  };
  const limiteTokenService = {
    verificarValor: jest
      .fn()
      .mockResolvedValue(opts.limiteResult ?? { ok: true, limiteEfetivo: 5000, gastoHoje: 0, saldoDisponivel: 5000 }),
  };

  const service = new CooperTokenService(
    prisma,
    { emit: jest.fn() } as any,
    undefined,
    pinCooperadoService as any,
    undefined,
    limiteTokenService as any,
  );

  return {
    service,
    prisma,
    tx,
    transactionFn,
    pinCooperadoService,
    limiteTokenService,
    txCreateLedger,
    txCreateTokenTransacao,
    txUpdateTokenTransacao,
    ids: { EMPRESA_ID, COOPERATIVA, CONVENIO_ID, CLIENT_REQ },
  };
}

const basePayload = (ids: any) => ({
  empresaCooperadoId: ids.EMPRESA_ID,
  cooperativaId: ids.COOPERATIVA,
  convenioId: ids.CONVENIO_ID,
  clientRequestId: ids.CLIENT_REQ,
  pin: '123456',
  modo: 'CONFIRM' as const,
  distribuicoes: [
    { destinatarioCooperadoId: 'func-1', quantidade: 50 },
    { destinatarioCooperadoId: 'func-2', quantidade: 30 },
  ],
  naturezaDistribuicao: 'ORIGEM_REGULAMENTO' as const,
});

describe('F3 Bloco B — distribuirTokens — validação semântica das naturezas', () => {
  it('VOLUNTARIA sem empresaDeclaraTetoClt → BadRequest CLT 458', async () => {
    const { service, ids } = setup();
    await expect(
      service.distribuirTokens({
        ...basePayload(ids),
        naturezaDistribuicao: 'VOLUNTARIA',
      }),
    ).rejects.toThrow(/VOLUNTARIA.*CLT 458/);
  });

  it('VOLUNTARIA com empresaDeclaraTetoClt=true → segue', async () => {
    const { service, ids } = setup();
    const r: any = await service.distribuirTokens({
      ...basePayload(ids),
      naturezaDistribuicao: 'VOLUNTARIA',
      empresaDeclaraTetoClt: true,
    });
    expect(r.modo).toBe('CONFIRM');
  });

  it('PREMIACAO sem descricao → BadRequest CLT 457', async () => {
    const { service, ids } = setup();
    await expect(
      service.distribuirTokens({
        ...basePayload(ids),
        naturezaDistribuicao: 'PREMIACAO',
      }),
    ).rejects.toThrow(/PREMIACAO.*CLT 457/);
  });

  it('PREMIACAO com descricao curta (<3 chars) → BadRequest', async () => {
    const { service, ids } = setup();
    await expect(
      service.distribuirTokens({
        ...basePayload(ids),
        naturezaDistribuicao: 'PREMIACAO',
        descricao: 'ab',
      }),
    ).rejects.toThrow(/PREMIACAO/);
  });

  it('PREMIACAO com descricao OK → segue', async () => {
    const { service, ids } = setup();
    const r: any = await service.distribuirTokens({
      ...basePayload(ids),
      naturezaDistribuicao: 'PREMIACAO',
      descricao: 'Meta vendas Q2 2026',
    });
    expect(r.modo).toBe('CONFIRM');
  });
});

describe('F3 Bloco B — guards', () => {
  it('Empresa PF (não-PJ) → Forbidden', async () => {
    const { service, ids } = setup({
      empresa: { id: 'empresa-pj-1', tipoPessoa: 'PF', status: 'ATIVO', nomeCompleto: 'X' },
    });
    await expect(
      service.distribuirTokens(basePayload(ids)),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('Empresa SUSPENSO → Forbidden', async () => {
    const { service, ids } = setup({
      empresa: { id: 'empresa-pj-1', tipoPessoa: 'PJ', status: 'SUSPENSO', nomeCompleto: 'X' },
    });
    await expect(
      service.distribuirTokens(basePayload(ids)),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('Convênio não existe → NotFound', async () => {
    const { service, prisma, ids } = setup();
    prisma.contratoConvenio.findFirst.mockResolvedValueOnce(null);
    await expect(
      service.distribuirTokens(basePayload(ids)),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('Convênio não-ATIVO → BadRequest', async () => {
    const { service, ids } = setup({
      convenio: { id: 'conv-1', pagadorCooperadoId: 'empresa-pj-1', status: 'INATIVO', empresaNome: 'X' },
    });
    await expect(
      service.distribuirTokens(basePayload(ids)),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  // Bug fix 15/06/2026 (blocker Santi) — isolamento entre empresas-pagadoras:
  // se o JWT da empresa A tenta distribuir num convênio cujo pagadorCooperadoId
  // é a empresa B, guard deve barrar com Forbidden. Reescrito (antes mockava
  // conveniadoId — campo legado errado).
  it('Empresa não é a pagadora do convênio (isolamento cross-empresa) → Forbidden', async () => {
    const { service, ids } = setup({
      convenio: { id: 'conv-1', pagadorCooperadoId: 'OUTRA-EMPRESA-PAGADORA', status: 'ATIVO', empresaNome: 'X' },
    });
    await expect(
      service.distribuirTokens(basePayload(ids)),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe('F3 Bloco B — PIN', () => {
  it('PIN ausente → BadRequest', async () => {
    const { service, ids } = setup();
    await expect(
      service.distribuirTokens({ ...basePayload(ids), pin: '' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('PIN_NAO_DEFINIDO → BadRequest com orientação', async () => {
    const { service, ids } = setup({
      pinResult: { ok: false, motivo: 'PIN_NAO_DEFINIDO' },
    });
    await expect(
      service.distribuirTokens(basePayload(ids)),
    ).rejects.toThrow(/PIN.*não foi definido/);
  });

  it('PIN_BLOQUEADO → Forbidden', async () => {
    const desbloqueiaEm = new Date('2030-01-01');
    const { service, ids } = setup({
      pinResult: { ok: false, motivo: 'PIN_BLOQUEADO', desbloqueiaEm },
    });
    await expect(
      service.distribuirTokens(basePayload(ids)),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('PIN_INCORRETO → Forbidden', async () => {
    const { service, ids } = setup({
      pinResult: { ok: false, motivo: 'PIN_INCORRETO' },
    });
    await expect(
      service.distribuirTokens(basePayload(ids)),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe('F3 Bloco B — assertLimite sobre TOTAL (ajuste 2 Luciano)', () => {
  it('somaValorReais > limite por transação → BadRequest', async () => {
    const { service, ids } = setup({
      limiteResult: { ok: false, motivo: 'EXCEDE_LIMITE_TRANSACAO', limite: 30 },
    });
    // soma = 50+30 = 80 tokens × 0.45 = R$ 36 > limite 30
    await expect(
      service.distribuirTokens(basePayload(ids)),
    ).rejects.toThrow(/excede o limite por transação/);
  });

  it('limiteTokenService.verificarValor chamado com soma total, NÃO por linha', async () => {
    const { service, limiteTokenService, ids } = setup();
    await service.distribuirTokens(basePayload(ids));
    expect(limiteTokenService.verificarValor).toHaveBeenCalledTimes(1);
    const call = limiteTokenService.verificarValor.mock.calls[0][0];
    // 50 + 30 = 80 tokens × R$ 0.45 (config null fallback) = R$ 36
    expect(call.valorReais).toBeCloseTo(36, 2);
  });
});

describe('F3 Bloco B — modo PREVIEW', () => {
  it('saldo insuficiente → alerta bloqueante SALDO_INSUFICIENTE, podeProsseguir=false', async () => {
    const { service, ids } = setup({ saldoEmpresaDisponivel: 50 });
    const r: any = await service.distribuirTokens({
      ...basePayload(ids),
      modo: 'PREVIEW',
    });
    expect(r.modo).toBe('PREVIEW');
    expect(r.podeProsseguir).toBe(false);
    expect(r.preview.alertas.find((a: any) => a.codigo === 'SALDO_INSUFICIENTE')).toBeDefined();
  });

  it('destinatário inválido (não-MEMBRO_ATIVO) → alerta MEMBROS_INVALIDOS', async () => {
    const { service, ids } = setup({
      membrosAtivos: [{ cooperadoId: 'func-1' }], // func-2 não está na lista
    });
    const r: any = await service.distribuirTokens({
      ...basePayload(ids),
      modo: 'PREVIEW',
    });
    const alerta = r.preview.alertas.find((a: any) => a.codigo === 'MEMBROS_INVALIDOS');
    expect(alerta).toBeDefined();
    expect(alerta.severidade).toBe('bloqueante');
  });

  it('happy path PREVIEW → podeProsseguir=true + resumo correto', async () => {
    const { service, ids } = setup();
    const r: any = await service.distribuirTokens({
      ...basePayload(ids),
      modo: 'PREVIEW',
    });
    expect(r.modo).toBe('PREVIEW');
    expect(r.podeProsseguir).toBe(true);
    expect(r.preview.resumo.somaQuantidade).toBe(80);
    expect(r.preview.resumo.saldoEmpresaAntes).toBe(1000);
    expect(r.preview.resumo.saldoEmpresaDepois).toBe(920);
  });

  it('PREVIEW NÃO grava nada no banco', async () => {
    const { service, tx, ids } = setup();
    await service.distribuirTokens({ ...basePayload(ids), modo: 'PREVIEW' });
    expect(tx.cooperTokenSaldo.update).not.toHaveBeenCalled();
    expect(tx.cooperTokenLedger.create).not.toHaveBeenCalled();
    expect(tx.tokenTransacao.create).not.toHaveBeenCalled();
  });
});

describe('F3 Bloco B — modo CONFIRM (grava + idempotência)', () => {
  it('happy path CONFIRM → grava 2N ledger entries + N TokenTransacao', async () => {
    const { service, tx, ids } = setup();
    const r: any = await service.distribuirTokens(basePayload(ids));
    expect(r.modo).toBe('CONFIRM');
    expect(r.resultado.distribuidos).toBe(2);
    // 2 destinatários → 4 ledger entries (2 DEBITO + 2 CREDITO)
    expect(tx.cooperTokenLedger.create).toHaveBeenCalledTimes(4);
    // 2 TokenTransacao
    expect(tx.tokenTransacao.create).toHaveBeenCalledTimes(2);
  });

  it('1ª linha do ledger DEBITO grava referenciaId + referenciaTabela; demais ficam sem', async () => {
    const { service, txCreateLedger, ids } = setup();
    await service.distribuirTokens(basePayload(ids));
    // Encontra TODOS os ledger entries criados, ordem da criação
    const calls = txCreateLedger.mock.calls.map((c: any) => c[0].data);
    const debitos = calls.filter((c: any) => c.operacao === 'DEBITO');
    expect(debitos.length).toBe(2);
    // 1ª linha DEBITO tem referenciaId+referenciaTabela
    expect(debitos[0].referenciaId).toBe(ids.CLIENT_REQ);
    expect(debitos[0].referenciaTabela).toBe('MASS_WRITE_DISTRIBUICAO');
    // 2ª linha DEBITO NÃO tem (mesma tx já garante atomicidade)
    expect(debitos[1].referenciaId).toBeUndefined();
  });

  it('ledger tipo = DISTRIBUICAO_CONVENIO (não DOACAO_*)', async () => {
    const { service, txCreateLedger, ids } = setup();
    await service.distribuirTokens(basePayload(ids));
    const calls = txCreateLedger.mock.calls.map((c: any) => c[0].data);
    calls.forEach((c: any) => {
      expect(c.tipo).toBe('DISTRIBUICAO_CONVENIO');
      expect(c.operacao).toMatch(/DEBITO|CREDITO/);
    });
  });

  it('TokenTransacao.update grava naturezaDistribuicao + empresaDeclaraTetoClt', async () => {
    const { service, txUpdateTokenTransacao, ids } = setup();
    await service.distribuirTokens({
      ...basePayload(ids),
      naturezaDistribuicao: 'VOLUNTARIA',
      empresaDeclaraTetoClt: true,
    });
    // 2 updates (1 por TokenTransacao)
    expect(txUpdateTokenTransacao).toHaveBeenCalledTimes(2);
    const data = txUpdateTokenTransacao.mock.calls[0][0].data;
    expect(data.naturezaDistribuicao).toBe('VOLUNTARIA');
    expect(data.empresaDeclaraTetoClt).toBe(true);
  });

  it('ORIGEM_REGULAMENTO → empresaDeclaraTetoClt persistido como null', async () => {
    const { service, txUpdateTokenTransacao, ids } = setup();
    await service.distribuirTokens({
      ...basePayload(ids),
      naturezaDistribuicao: 'ORIGEM_REGULAMENTO',
    });
    const data = txUpdateTokenTransacao.mock.calls[0][0].data;
    expect(data.empresaDeclaraTetoClt).toBeNull();
  });

  it('isolationLevel Serializable é passado ao $transaction', async () => {
    const { service, transactionFn, ids } = setup();
    await service.distribuirTokens(basePayload(ids));
    const txOpts = transactionFn.mock.calls[0][1];
    expect(txOpts).toEqual(
      expect.objectContaining({
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      }),
    );
  });

  it('idempotência hit: 2ª chamada retorna resultado anterior sem reprocessar', async () => {
    // Simula ledger existente com mesmo clientRequestId
    const { service, prisma, tx, ids } = setup({
      ledgerExistenteIdempotencia: {
        id: 'ledger-OLD',
        createdAt: new Date('2026-06-12T10:00:00Z'),
      },
    });
    const r: any = await service.distribuirTokens(basePayload(ids));
    expect(r.modo).toBe('CONFIRM');
    expect(r.idempotente).toBe(true);
    expect(r.resultado.primeiroLedgerId).toBe('ledger-OLD');
    // NÃO chamou commit (nenhum update/create de saldo)
    expect(tx.cooperTokenLedger.create).not.toHaveBeenCalled();
    expect(tx.tokenTransacao.create).not.toHaveBeenCalled();
  });

  it('saldo insuficiente DENTRO da tx (race tx) → BadRequest tudo-ou-nada', async () => {
    // Saldo OK no preview (fora da tx), mas insuficiente dentro (simulando race)
    const { service, tx, ids } = setup({ saldoEmpresaDisponivel: 1000 });
    // Override dentro da tx
    tx.cooperTokenSaldo.findUnique.mockResolvedValueOnce({ saldoDisponivel: 10 });
    await expect(
      service.distribuirTokens(basePayload(ids)),
    ).rejects.toThrow(/Saldo insuficiente DENTRO da tx/);
  });
});
