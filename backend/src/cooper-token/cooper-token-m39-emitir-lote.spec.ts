/**
 * M39 (16/06/2026) — Emissão Admin em Lote + Estorno.
 *
 * Specs do service `emitirLoteAdmin` e `estornarEmissaoLote`.
 *
 * Cobertura (20 specs):
 *
 *   emitirLoteAdmin — guards:
 *     - cooperativaId ausente → BadRequest (SUPER_ADMIN puro deve impersonar)
 *     - distribuicoes vazias → BadRequest
 *     - linha com quantidade ≤ 0 → BadRequest
 *     - clientRequestId ausente → BadRequest (via helper)
 *     - lote > cap (default 200) → BadRequest (via helper)
 *
 *   emitirLoteAdmin — anti-IDOR:
 *     - cooperado cross-tenant na lista → preview alerta MEMBROS_INVALIDOS bloqueante
 *     - cooperado INATIVO na lista → preview alerta MEMBROS_INVALIDOS bloqueante
 *
 *   emitirLoteAdmin — PREVIEW:
 *     - happy path → totalItens=N, resumo com soma/valor/tier
 *     - destinatários inválidos → alerta bloqueante (sem write)
 *
 *   emitirLoteAdmin — tier:
 *     - tier BAIXO (≤R$50) → CONFIRM segue sem OTP
 *     - tier ALTO (>R$50) sem OTP → BadRequest no CONFIRM
 *     - tier ALTO com OTP válido → CONFIRM segue
 *     - PREVIEW NÃO exige OTP mesmo tier ALTO
 *
 *   emitirLoteAdmin — CONFIRM:
 *     - happy path → cria N entries ledger com tipo BONIFICACAO_ADMIN +
 *       referenciaTabela='EMISSAO_ADMIN_LOTE' + referenciaId=clientRequestId;
 *       chama tokenContabil.lancarEmissaoAdminLote 1× agregado.
 *     - idempotência hit (clientRequestId já processado) → retorna
 *       idempotente:true SEM reprocessar SEM chamar contábil 2×.
 *
 *   estornarEmissaoLote:
 *     - motivo curto (< 10 chars) → BadRequest
 *     - confirmado=false → BadRequest com mensagem explícita
 *     - lote inexistente → NotFound
 *     - happy path → reverte saldo + cria entries ESTORNO_BONIFICACAO_ADMIN
 *       (quantidade NEGATIVA, NUNCA apaga original) + chama
 *       lancarEstornoEmissaoAdminLote.
 *     - idempotência: estornar 2× retorna idempotente:true.
 *     - saldo guard: cooperado já gastou parte → debita o que tem mas
 *       registra estorno completo no ledger (rastreabilidade).
 */
import {
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CooperTokenService } from './cooper-token.service';

interface SetupOpts {
  cooperadosValidos?: Array<{ id: string; nomeCompleto: string; status?: string }>;
  cooperadosInvalidos?: string[];
  saldosExistentes?: Map<string, number>;
  configValorTokenReais?: number;
  otpValido?: boolean;
  ledgerExistenteIdempotencia?: any;
  entriesOriginaisLote?: any[];
  estornoJaExiste?: boolean;
}

function setup(opts: SetupOpts = {}) {
  const COOP_ID = 'coop-A';
  const ADMIN_USER_ID = 'usuario-admin-1';
  const CLIENT_REQ = 'uuid-m39-test-12345678-9999-aaaabbbbcccc';

  const cooperadosValidos = opts.cooperadosValidos ?? [
    { id: 'func-1', nomeCompleto: 'Funcionario 1', status: 'ATIVO' },
    { id: 'func-2', nomeCompleto: 'Funcionario 2', status: 'ATIVO' },
  ];

  const txCreateLedger = jest.fn().mockImplementation((arg: any) =>
    Promise.resolve({ id: `ledger-${Math.random().toString(36).slice(2, 8)}`, ...arg.data }),
  );
  const txCreateSaldo = jest.fn().mockResolvedValue({});
  const txUpdateSaldo = jest.fn().mockResolvedValue({});

  const tx: any = {
    cooperTokenSaldo: {
      findUnique: jest.fn(({ where }: any) => {
        const valor = opts.saldosExistentes?.get(where.cooperadoId);
        return Promise.resolve(valor !== undefined ? { saldoDisponivel: valor, totalEmitido: 0 } : null);
      }),
      update: txUpdateSaldo,
      create: txCreateSaldo,
    },
    cooperTokenLedger: { create: txCreateLedger },
  };

  const transactionFn = jest.fn(async (cb: any, _opts?: any) => cb(tx));

  const prisma: any = {
    $transaction: transactionFn,
    cooperado: {
      findMany: jest.fn().mockResolvedValue(cooperadosValidos),
    },
    cooperTokenLedger: {
      findFirst: jest.fn().mockResolvedValue(opts.ledgerExistenteIdempotencia ?? null),
      findMany: jest.fn().mockResolvedValue(opts.entriesOriginaisLote ?? []),
      create: txCreateLedger,
    },
    configCooperToken: {
      findUnique: jest.fn().mockResolvedValue(
        opts.configValorTokenReais !== undefined
          ? { valorTokenReais: opts.configValorTokenReais }
          : null,
      ),
    },
    auditLog: { create: jest.fn().mockResolvedValue({}) },
  };

  // Pra estorno: mock que checa se já existe estorno antes
  if (opts.entriesOriginaisLote && opts.entriesOriginaisLote.length > 0) {
    (prisma.cooperTokenLedger.findFirst as jest.Mock)
      .mockImplementation(({ where }: any) => {
        if (where.referenciaTabela === 'ESTORNO_EMISSAO_ADMIN_LOTE') {
          return Promise.resolve(
            opts.estornoJaExiste
              ? { id: 'estorno-1', createdAt: new Date() }
              : null,
          );
        }
        return Promise.resolve(null);
      });
  }

  // Saldos atuais (pra estorno)
  if (opts.saldosExistentes) {
    (tx.cooperTokenSaldo.findUnique as jest.Mock)
      .mockImplementation(({ where }: any) => {
        const valor = opts.saldosExistentes?.get(where.cooperadoId);
        return Promise.resolve(valor !== undefined ? { saldoDisponivel: valor } : { saldoDisponivel: 0 });
      });
  }

  const otpDesafioService = {
    validarOuLancar: jest.fn().mockImplementation(() => {
      if (opts.otpValido === false) {
        throw new BadRequestException('OTP inválido');
      }
      return Promise.resolve();
    }),
  };

  const tokenContabilService = {
    lancarEmissaoAdminLote: jest.fn().mockResolvedValue({ debito: {}, credito: {} }),
    lancarEstornoEmissaoAdminLote: jest.fn().mockResolvedValue({ baixaPassivo: {}, reversaoDespesa: {} }),
  };

  const service = new CooperTokenService(
    prisma,
    { emit: jest.fn() } as any,
    undefined,
    undefined,
    otpDesafioService as any,
    undefined,
    undefined,
    tokenContabilService as any,
  );

  return {
    service,
    prisma,
    tx,
    transactionFn,
    txCreateLedger,
    txCreateSaldo,
    txUpdateSaldo,
    otpDesafioService,
    tokenContabilService,
    ids: { COOP_ID, ADMIN_USER_ID, CLIENT_REQ },
  };
}

const baseEmitir = (ids: any, overrides: any = {}) => ({
  cooperativaId: ids.COOP_ID,
  usuarioId: ids.ADMIN_USER_ID,
  distribuicoes: [
    { destinatarioCooperadoId: 'func-1', quantidade: 10 },
    { destinatarioCooperadoId: 'func-2', quantidade: 20 },
  ],
  clientRequestId: ids.CLIENT_REQ,
  modo: 'CONFIRM' as const,
  ...overrides,
});

const baseEstornar = (ids: any, overrides: any = {}) => ({
  cooperativaId: ids.COOP_ID,
  loteId: ids.CLIENT_REQ,
  usuarioId: ids.ADMIN_USER_ID,
  motivo: 'Erro operacional — colaboradores errados',
  confirmado: true,
  ...overrides,
});

// ════════════════════════════════════════════════════════════════════
// emitirLoteAdmin — guards universais
// ════════════════════════════════════════════════════════════════════

describe('M39 emitirLoteAdmin — guards', () => {
  it('cooperativaId ausente → BadRequest (SUPER_ADMIN puro deve impersonar)', async () => {
    const { service, ids } = setup();
    await expect(
      service.emitirLoteAdmin(baseEmitir(ids, { cooperativaId: '' })),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('distribuicoes vazias → BadRequest', async () => {
    const { service, ids } = setup();
    await expect(
      service.emitirLoteAdmin(baseEmitir(ids, { distribuicoes: [] })),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('linha com quantidade ≤ 0 → BadRequest', async () => {
    const { service, ids } = setup();
    await expect(
      service.emitirLoteAdmin(
        baseEmitir(ids, {
          distribuicoes: [
            { destinatarioCooperadoId: 'func-1', quantidade: 0 },
          ],
        }),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('clientRequestId ausente → BadRequest (via helper)', async () => {
    const { service, ids } = setup();
    await expect(
      service.emitirLoteAdmin(baseEmitir(ids, { clientRequestId: '' })),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('lote > cap default (200) → BadRequest (via helper)', async () => {
    const { service, ids } = setup({
      configValorTokenReais: 0.45,
      cooperadosValidos: Array.from({ length: 201 }, (_, i) => ({
        id: `func-${i}`,
        nomeCompleto: `Func ${i}`,
        status: 'ATIVO',
      })),
    });
    // Quantidade mínima por linha pra valor total ≤ R$50 (evita disparar
    // tier ALTO antes do cap-check — testa o cap puramente).
    // 201 × 0.001 × 0.45 = R$0.09.
    const distribuicoes = Array.from({ length: 201 }, (_, i) => ({
      destinatarioCooperadoId: `func-${i}`,
      quantidade: 0.001,
    }));
    await expect(
      service.emitirLoteAdmin(baseEmitir(ids, { distribuicoes })),
    ).rejects.toThrow(/cap/);
  });
});

// ════════════════════════════════════════════════════════════════════
// emitirLoteAdmin — anti-IDOR (revalidação server-side)
// ════════════════════════════════════════════════════════════════════

describe('M39 emitirLoteAdmin — anti-IDOR multi-tenant', () => {
  it('cooperado cross-tenant na lista → preview alerta MEMBROS_INVALIDOS bloqueante (CONFIRM falha)', async () => {
    const { service, ids } = setup({
      // findMany retorna SÓ func-1 (func-EVIL não é desta cooperativa)
      cooperadosValidos: [
        { id: 'func-1', nomeCompleto: 'Funcionario 1', status: 'ATIVO' },
      ],
    });
    await expect(
      service.emitirLoteAdmin(
        baseEmitir(ids, {
          distribuicoes: [
            { destinatarioCooperadoId: 'func-1', quantidade: 10 },
            { destinatarioCooperadoId: 'func-EVIL-outra-coop', quantidade: 10 },
          ],
        }),
      ),
    ).rejects.toThrow(/DESTINATARIOS_INVALIDOS|alerta/i);
  });

  it('cooperado INATIVO na lista → preview alerta MEMBROS_INVALIDOS bloqueante', async () => {
    const { service, ids } = setup({
      // findMany filtra por STATUS_PERMITIDOS_CREDITO; INATIVO não vem
      cooperadosValidos: [
        { id: 'func-1', nomeCompleto: 'Funcionario 1', status: 'ATIVO' },
      ],
    });
    await expect(
      service.emitirLoteAdmin(
        baseEmitir(ids, {
          distribuicoes: [
            { destinatarioCooperadoId: 'func-1', quantidade: 10 },
            { destinatarioCooperadoId: 'func-INATIVO', quantidade: 10 },
          ],
        }),
      ),
    ).rejects.toThrow(/DESTINATARIOS_INVALIDOS|alerta/i);
  });
});

// ════════════════════════════════════════════════════════════════════
// emitirLoteAdmin — PREVIEW
// ════════════════════════════════════════════════════════════════════

describe('M39 emitirLoteAdmin — modo PREVIEW', () => {
  it('happy path PREVIEW → retorna preview com resumo (soma + valor + tier)', async () => {
    const { service, ids } = setup({ configValorTokenReais: 0.45 });
    const r: any = await service.emitirLoteAdmin(
      baseEmitir(ids, { modo: 'PREVIEW' }),
    );
    expect(r.modo).toBe('PREVIEW');
    expect(r.preview.totalItens).toBe(2);
    expect(r.preview.resumo?.somaQuantidade).toBe(30);
    expect(r.preview.resumo?.valorTotalReais).toBe(13.5); // 30 * 0.45
    expect(r.preview.resumo?.tier).toBe('BAIXO'); // < R$50
    expect(r.preview.resumo?.destinatariosValidos).toBe(2);
    expect(r.preview.resumo?.destinatariosInvalidos).toBe(0);
  });

  it('PREVIEW NÃO exige OTP mesmo se tier ALTO', async () => {
    const { service, ids } = setup({ configValorTokenReais: 0.45 });
    const r: any = await service.emitirLoteAdmin(
      baseEmitir(ids, {
        modo: 'PREVIEW',
        distribuicoes: [
          { destinatarioCooperadoId: 'func-1', quantidade: 500 }, // R$225
        ],
      }),
    );
    expect(r.modo).toBe('PREVIEW');
    expect(r.preview.resumo?.tier).toBe('ALTO');
  });
});

// ════════════════════════════════════════════════════════════════════
// emitirLoteAdmin — tier ALTO + OTP
// ════════════════════════════════════════════════════════════════════

describe('M39 emitirLoteAdmin — tier ALTO + OTP', () => {
  it('CONFIRM tier ALTO sem OTP → BadRequest', async () => {
    const { service, ids } = setup({ configValorTokenReais: 0.45 });
    await expect(
      service.emitirLoteAdmin(
        baseEmitir(ids, {
          distribuicoes: [
            { destinatarioCooperadoId: 'func-1', quantidade: 500 },
          ],
        }),
      ),
    ).rejects.toThrow(/OTP obrigatório|tier ALTO/i);
  });

  it('CONFIRM tier ALTO com OTP válido → segue', async () => {
    const { service, ids, otpDesafioService } = setup({
      configValorTokenReais: 0.45,
      cooperadosValidos: [
        { id: 'func-1', nomeCompleto: 'Funcionario 1', status: 'ATIVO' },
      ],
    });
    const r: any = await service.emitirLoteAdmin(
      baseEmitir(ids, {
        distribuicoes: [
          { destinatarioCooperadoId: 'func-1', quantidade: 500 },
        ],
        otpDesafioId: 'desafio-1',
        otpCodigo: '123456',
      }),
    );
    expect(r.modo).toBe('CONFIRM');
    expect(otpDesafioService.validarOuLancar).toHaveBeenCalledTimes(1);
  });

  it('tier BAIXO → CONFIRM segue sem OTP', async () => {
    const { service, ids, otpDesafioService } = setup({ configValorTokenReais: 0.45 });
    const r: any = await service.emitirLoteAdmin(baseEmitir(ids));
    expect(r.modo).toBe('CONFIRM');
    expect(otpDesafioService.validarOuLancar).not.toHaveBeenCalled();
  });
});

// ════════════════════════════════════════════════════════════════════
// emitirLoteAdmin — CONFIRM (write + contábil)
// ════════════════════════════════════════════════════════════════════

describe('M39 emitirLoteAdmin — CONFIRM', () => {
  it('happy path → cria N entries ledger BONIFICACAO_ADMIN com tag + chama contábil 1× agregado', async () => {
    const { service, ids, txCreateLedger, tokenContabilService } = setup({
      configValorTokenReais: 0.45,
    });
    const r: any = await service.emitirLoteAdmin(baseEmitir(ids));
    expect(r.modo).toBe('CONFIRM');
    expect(r.resultado.totalEmitido).toBe(30);
    expect(r.resultado.destinatarios).toHaveLength(2);
    // 2 entries criados (1 por destinatário)
    expect(txCreateLedger).toHaveBeenCalledTimes(2);
    // Cada entry tem tag de reclassificação
    expect(txCreateLedger).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          referenciaTabela: 'EMISSAO_ADMIN_LOTE',
          referenciaId: ids.CLIENT_REQ,
          tipo: 'BONIFICACAO_ADMIN',
        }),
      }),
    );
    // Contábil chamado 1× agregado (não N×)
    expect(tokenContabilService.lancarEmissaoAdminLote).toHaveBeenCalledTimes(1);
    expect(tokenContabilService.lancarEmissaoAdminLote).toHaveBeenCalledWith(
      expect.objectContaining({
        loteId: ids.CLIENT_REQ,
        valor: 13.5, // 30 * 0.45
      }),
    );
  });

  it('idempotência hit → retorna idempotente:true SEM reprocessar SEM chamar contábil 2×', async () => {
    const { service, ids, transactionFn, tokenContabilService } = setup({
      configValorTokenReais: 0.45,
      ledgerExistenteIdempotencia: {
        id: 'ledger-original-1',
        referenciaId: 'uuid-m39-test-12345678-9999-aaaabbbbcccc',
        createdAt: new Date('2026-06-16T10:00:00Z'),
      },
    });
    const r: any = await service.emitirLoteAdmin(baseEmitir(ids));
    expect(r.modo).toBe('CONFIRM');
    expect(r.resultado.idempotente).toBe(true);
    expect(transactionFn).not.toHaveBeenCalled(); // nem entrou na tx
    expect(tokenContabilService.lancarEmissaoAdminLote).not.toHaveBeenCalled();
  });
});

// ════════════════════════════════════════════════════════════════════
// estornarEmissaoLote
// ════════════════════════════════════════════════════════════════════

describe('M39 estornarEmissaoLote — guards', () => {
  it('motivo curto (< 10 chars) → BadRequest', async () => {
    const { service, ids } = setup();
    await expect(
      service.estornarEmissaoLote(baseEstornar(ids, { motivo: 'curto' })),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('confirmado=false → BadRequest com mensagem explícita', async () => {
    const { service, ids } = setup();
    await expect(
      service.estornarEmissaoLote(baseEstornar(ids, { confirmado: false })),
    ).rejects.toThrow(/Confirmação explícita|UI deve apresentar/i);
  });

  it('lote inexistente → NotFound', async () => {
    const { service, ids } = setup({
      entriesOriginaisLote: [], // nenhuma entry pra esse loteId
    });
    await expect(
      service.estornarEmissaoLote(baseEstornar(ids)),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('idempotência: estornar 2× retorna idempotente:true', async () => {
    const { service, ids, transactionFn, tokenContabilService } = setup({
      configValorTokenReais: 0.45,
      entriesOriginaisLote: [
        { cooperadoId: 'func-1', quantidade: 10, cooperativaId: 'coop-A' },
        { cooperadoId: 'func-2', quantidade: 20, cooperativaId: 'coop-A' },
      ],
      estornoJaExiste: true,
    });
    const r: any = await service.estornarEmissaoLote(baseEstornar(ids));
    expect(r.idempotente).toBe(true);
    expect(transactionFn).not.toHaveBeenCalled();
    expect(tokenContabilService.lancarEstornoEmissaoAdminLote).not.toHaveBeenCalled();
  });
});

describe('M39 estornarEmissaoLote — happy path', () => {
  it('reverte saldo + cria entries ESTORNO_BONIFICACAO_ADMIN (quantidade NEGATIVA) + contábil reversão', async () => {
    const { service, ids, txCreateLedger, txUpdateSaldo, tokenContabilService } = setup({
      configValorTokenReais: 0.45,
      entriesOriginaisLote: [
        { cooperadoId: 'func-1', quantidade: 10, cooperativaId: 'coop-A' },
        { cooperadoId: 'func-2', quantidade: 20, cooperativaId: 'coop-A' },
      ],
      saldosExistentes: new Map([
        ['func-1', 10],
        ['func-2', 20],
      ]),
    });
    const r: any = await service.estornarEmissaoLote(baseEstornar(ids));
    expect(r.idempotente).toBe(false);
    expect(r.totalEstornado).toBe(30);
    expect(r.destinatarios).toHaveLength(2);
    // Saldos debitados completos
    expect(txUpdateSaldo).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { cooperadoId: 'func-1' },
        data: { saldoDisponivel: 0 },
      }),
    );
    // Entries ESTORNO criados com quantidade NEGATIVA (rastreabilidade)
    expect(txCreateLedger).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tipo: 'ESTORNO_BONIFICACAO_ADMIN',
          operacao: 'DEBITO',
          quantidade: -10,
          referenciaTabela: 'ESTORNO_EMISSAO_ADMIN_LOTE',
          referenciaId: ids.CLIENT_REQ,
        }),
      }),
    );
    // Contábil reversão chamado 1× agregado
    expect(tokenContabilService.lancarEstornoEmissaoAdminLote).toHaveBeenCalledTimes(1);
    expect(tokenContabilService.lancarEstornoEmissaoAdminLote).toHaveBeenCalledWith(
      expect.objectContaining({
        loteId: ids.CLIENT_REQ,
        valor: 13.5,
      }),
    );
  });

  it('saldo guard non-negativo: cooperado já gastou parte → debita o que tem, registra estorno completo', async () => {
    const { service, ids, txCreateLedger, txUpdateSaldo } = setup({
      configValorTokenReais: 0.45,
      entriesOriginaisLote: [
        { cooperadoId: 'func-1', quantidade: 10, cooperativaId: 'coop-A' },
      ],
      // Cooperado já gastou 7 dos 10 originalmente recebidos (saldo atual: 3)
      saldosExistentes: new Map([['func-1', 3]]),
    });
    const r: any = await service.estornarEmissaoLote(baseEstornar(ids));
    expect(r.destinatarios[0].quantidadeOriginal).toBe(10);
    expect(r.destinatarios[0].quantidadeDebitada).toBe(3); // só o que tinha
    expect(r.destinatarios[0].saldoFinal).toBe(0);
    // Saldo zerou
    expect(txUpdateSaldo).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { cooperadoId: 'func-1' },
        data: { saldoDisponivel: 0 },
      }),
    );
    // Mas ledger registra estorno completo de 10 (rastreabilidade)
    expect(txCreateLedger).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          quantidade: -10,
        }),
      }),
    );
  });
});
