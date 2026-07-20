/**
 * Sprint Clube P1 — Fase 1.5 Fixes pos-review (10/06/2026).
 *
 * Cobre as 3 correcoes apontadas pelos reviewers (financeiro-token +
 * multitenant) antes do push:
 *
 *   G2 — descricoes do ledger usam o valor real calculado (sem strings
 *        hardcoded "taxa 1%" / "taxa emissao 2%").
 *   G3 — `aplicarOxidacao` no service tem o mesmo gate juridico do cron
 *        (defesa em profundidade: chamador direto futuro tambem barrado).
 *   MT P2 — `upsertConfig` rejeita cooperativaId vazio/null/undefined com
 *        BadRequestException (evita where:{cooperativaId:undefined} no
 *        Prisma).
 */
import { BadRequestException } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import { CooperTokenService } from './cooper-token.service';
import { CooperTokenOperacao, CooperTokenTipo } from '@prisma/client';

const SECRET = 'F15-fixes-cooper-token-secret-com-mais-de-32-chars';

describe('F1.5 G2 — descricoes do ledger sem strings hardcoded', () => {
  describe('Emissao (creditar) — descricao usa ${taxaEmissao} real', () => {
    let txLedgerCreate: jest.Mock;
    let service: CooperTokenService;

    beforeEach(() => {
      txLedgerCreate = jest.fn().mockResolvedValue({});
      const tx: any = {
        cooperTokenSaldo: {
          findUnique: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockResolvedValue({}),
          update: jest.fn().mockResolvedValue({}),
        },
        cooperTokenLedger: { create: txLedgerCreate, findFirst: jest.fn().mockResolvedValue(null) },
      };
      const prisma: any = {
        cooperado: {
          findUnique: jest.fn().mockResolvedValue({ id: 'c1', status: 'ATIVO_RECEBENDO_CREDITOS', cooperativaId: 'coop-A' }),
        },
        cooperTokenLedger: { findFirst: jest.fn().mockResolvedValue(null) },
        configCooperToken: { findUnique: jest.fn() },
        $transaction: jest.fn((cb: any) => cb(tx)),
      };
      service = new CooperTokenService(prisma, { emit: jest.fn() } as any);
      // Config default (fallback no helper) — taxa 2%.
      (prisma.configCooperToken.findUnique as jest.Mock).mockResolvedValue(null);
    });

    it('descricao contem o valor real (2 num bruto de 100, fallback) — NUNCA "2%"', async () => {
      await service.creditar({
        cooperadoId: 'c1',
        cooperativaId: 'coop-A',
        tipo: CooperTokenTipo.GERACAO_EXCEDENTE,
        quantidade: 100,
      });
      const arg = txLedgerCreate.mock.calls[0][0];
      const descricao: string = arg.data.descricao;
      expect(descricao).toContain('taxa: 2');
      // Anti-regressao: NAO pode conter o hardcoded antigo
      expect(descricao).not.toContain('taxa emissão 2%');
      expect(descricao).not.toMatch(/taxa\s+emiss[aã]o\s+2%/i);
    });

    it('config custom taxaEmissaoPerc=3.5 → descricao mostra 3.5 (nao hardcoded)', async () => {
      // Override pra retornar config com taxa custom.
      (service as any).prisma.configCooperToken.findUnique.mockResolvedValue({
        taxaEmissaoPerc: 3.5,
        taxaEmissaoFixa: 0,
      });
      await service.creditar({
        cooperadoId: 'c1',
        cooperativaId: 'coop-A',
        tipo: CooperTokenTipo.GERACAO_EXCEDENTE,
        quantidade: 200,
      });
      const arg = txLedgerCreate.mock.calls[0][0];
      const descricao: string = arg.data.descricao;
      // 200 * 3.5 / 100 = 7
      expect(descricao).toContain('taxa: 7');
      expect(descricao).not.toContain('2%');
    });
  });

  describe('QR (processarPagamentoQr) — descricao usa ${taxa} real', () => {
    let txLedgerCreate: jest.Mock;
    let service: CooperTokenService;
    const ORIG_SECRET = process.env.COOPERTOKEN_QR_SECRET;

    beforeAll(() => {
      process.env.COOPERTOKEN_QR_SECRET = SECRET;
    });
    afterAll(() => {
      if (ORIG_SECRET === undefined) delete process.env.COOPERTOKEN_QR_SECRET;
      else process.env.COOPERTOKEN_QR_SECRET = ORIG_SECRET;
    });

    beforeEach(() => {
      txLedgerCreate = jest.fn().mockResolvedValue({});
      const tx: any = {
        cooperTokenSaldo: {
          findUnique: jest.fn(({ where }: any) => {
            // Saldo suficiente em qualquer cenario (testes usam ate 200 brutos).
            if (where.cooperadoId === 'pagador') return Promise.resolve({ saldoDisponivel: 10000 });
            return Promise.resolve(null);
          }),
          // F4 Bloco C.1 MT-5 — pagador via findFirst com cooperativaId.
          findFirst: jest.fn(({ where }: any) => {
            if (where.cooperadoId === 'pagador') return Promise.resolve({ saldoDisponivel: 10000 });
            return Promise.resolve(null);
          }),
          update: jest.fn().mockResolvedValue({}),
          create: jest.fn().mockResolvedValue({}),
        },
        cooperTokenLedger: { create: txLedgerCreate },
        // F4 Bloco C — processarPagamentoQr chama criarTokenTransacao
        // (guard cooperado + count + create). Mocks neutros — não interferem
        // nos asserts de descricao do ledger (G2).
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
            id: 'tt-f15',
            jti: 'jti-f15-fixes',
            tier: 'BAIXO',
            motivoStepUp: 'PRIMEIRO_USO',
            status: 'CONFIRMADA',
          }),
        },
      };
      const prisma: any = {
        // M52b F1 (24/06): gate dual MELT — meltAtivado=true pra exercitar
        // cobrança da taxa QR (config fallback 1%). Default false zeraria taxa.
        configCooperToken: { findUnique: jest.fn().mockResolvedValue({ meltAtivado: true }) },
        $transaction: jest.fn((cb: any) => cb(tx)),
      };
      service = new CooperTokenService(prisma, { emit: jest.fn() } as any);
    });

    it('descricao do recebimento QR contem o valor real (fallback 1) — NUNCA "taxa 1%"', async () => {
      const qrToken = jwt.sign(
        // Corretiva CooperToken 2026-07-20 — jti obrigatório.
        { pagadorId: 'pagador', cooperativaId: 'coop-A', quantidade: 100, tipo: 'COOPER_TOKEN_QR', jti: 'jti-f15-100' },
        SECRET,
      );
      await service.processarPagamentoQr({
        qrToken,
        recebedorId: 'recebedor',
        recebedorCooperativaId: 'coop-A',
      });
      // 2 entradas no ledger: debito pagador + credito recebedor. Pegamos o credito.
      const credito = txLedgerCreate.mock.calls.find(
        (c: any[]) => c[0].data.operacao === CooperTokenOperacao.CREDITO,
      );
      expect(credito).toBeDefined();
      const descricao: string = credito![0].data.descricao;
      expect(descricao).toContain('taxa: 1');
      expect(descricao).not.toMatch(/taxa\s+1%/);
    });

    it('config custom taxaQrPerc=0.5 → descricao mostra 0.5 (nao hardcoded)', async () => {
      (service as any).prisma.configCooperToken.findUnique.mockResolvedValue({
        taxaQrPerc: 0.5,
        taxaQrFixa: 0,
        meltAtivado: true, // M52b F1: gate ON pra exercitar cobrança da taxa
      });
      const qrToken = jwt.sign(
        // Corretiva CooperToken 2026-07-20 — jti obrigatório.
        { pagadorId: 'pagador', cooperativaId: 'coop-A', quantidade: 200, tipo: 'COOPER_TOKEN_QR', jti: 'jti-f15-200' },
        SECRET,
      );
      await service.processarPagamentoQr({
        qrToken,
        recebedorId: 'recebedor',
        recebedorCooperativaId: 'coop-A',
      });
      const credito = txLedgerCreate.mock.calls.find(
        (c: any[]) => c[0].data.operacao === CooperTokenOperacao.CREDITO,
      );
      const descricao: string = credito![0].data.descricao;
      // 200 * 0.5 / 100 = 1
      expect(descricao).toContain('taxa: 1');
      expect(descricao).not.toContain('taxa 1%');
    });
  });
});

describe('F1.5 G3 — gate juridico TAMBEM dentro de aplicarOxidacao()', () => {
  const ORIG_AMBIENTE = process.env.AMBIENTE_REAL;
  const ORIG_GATE = process.env.OXIDACAO_PRODUCAO_LIBERADA;

  afterEach(() => {
    if (ORIG_AMBIENTE === undefined) delete process.env.AMBIENTE_REAL;
    else process.env.AMBIENTE_REAL = ORIG_AMBIENTE;
    if (ORIG_GATE === undefined) delete process.env.OXIDACAO_PRODUCAO_LIBERADA;
    else process.env.OXIDACAO_PRODUCAO_LIBERADA = ORIG_GATE;
  });

  function buildService() {
    const prisma: any = {
      configCooperToken: {
        findUnique: jest.fn().mockResolvedValue({
          oxidacaoPercMes: 10,
          oxidacaoPeriodoGracaDias: 0,
          oxidacaoPiso: 0,
          oxidacaoAtivadaEm: new Date('2026-01-01'),
        }),
      },
      cooperTokenSaldo: { findMany: jest.fn().mockResolvedValue([
        { cooperadoId: 'c1', saldoDisponivel: 100 },
      ]) },
      cooperTokenLedger: {
        aggregate: jest.fn().mockResolvedValue({ _sum: { quantidade: 0 } }),
      },
      $transaction: jest.fn((cb: any) => cb({
        cooperTokenSaldo: { update: jest.fn() },
        cooperTokenLedger: { create: jest.fn() },
      })),
    };
    return new CooperTokenService(prisma, { emit: jest.fn() } as any);
  }

  it('producao real (AMBIENTE_REAL=true) SEM flag → service barra direto, NAO toca em saldo', async () => {
    process.env.AMBIENTE_REAL = 'true';
    delete process.env.OXIDACAO_PRODUCAO_LIBERADA;
    const service = buildService();
    const r = await service.aplicarOxidacao('coop-A');
    expect(r).toEqual({ cooperadosAfetados: 0, totalTokensReduzidos: 0 });
    // findUnique config NAO deve ser chamado (gate fica antes).
    expect((service as any).prisma.configCooperToken.findUnique).not.toHaveBeenCalled();
  });

  it('producao real (AMBIENTE_REAL=true) COM flag → executa normal', async () => {
    process.env.AMBIENTE_REAL = 'true';
    process.env.OXIDACAO_PRODUCAO_LIBERADA = 'true';
    const service = buildService();
    const r = await service.aplicarOxidacao('coop-A');
    // Vai chamar findUnique da config (passou do gate).
    expect((service as any).prisma.configCooperToken.findUnique).toHaveBeenCalled();
    expect(r.cooperadosAfetados).toBe(1);
    expect(r.totalTokensReduzidos).toBe(10);
  });

  it('DEV (AMBIENTE_REAL ausente) → roda normal SEM exigir a flag', async () => {
    delete process.env.AMBIENTE_REAL;
    delete process.env.OXIDACAO_PRODUCAO_LIBERADA;
    const service = buildService();
    const r = await service.aplicarOxidacao('coop-A');
    expect(r.cooperadosAfetados).toBe(1);
    expect(r.totalTokensReduzidos).toBe(10);
  });
});

describe('F1.5 MT P2 — upsertConfig rejeita cooperativaId vazio', () => {
  function buildService() {
    const prisma: any = {
      configCooperToken: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
      },
    };
    return new CooperTokenService(prisma, { emit: jest.fn() } as any);
  }

  it('cooperativaId="" → BadRequestException, NUNCA chama Prisma', async () => {
    const service = buildService();
    await expect(
      service.upsertConfig('', { taxaEmissaoPerc: 3 }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect((service as any).prisma.configCooperToken.upsert).not.toHaveBeenCalled();
    expect((service as any).prisma.configCooperToken.findUnique).not.toHaveBeenCalled();
  });

  it('cooperativaId=undefined → BadRequestException', async () => {
    const service = buildService();
    await expect(
      service.upsertConfig(undefined as any, { ativo: true }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('cooperativaId=null → BadRequestException', async () => {
    const service = buildService();
    await expect(
      service.upsertConfig(null as any, { ativo: true }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('cooperativaId valido → upsert chamado normalmente', async () => {
    const service = buildService();
    const upsertMock = (service as any).prisma.configCooperToken.upsert as jest.Mock;
    upsertMock.mockResolvedValue({});
    await service.upsertConfig('coop-A', { taxaEmissaoPerc: 3 });
    expect(upsertMock).toHaveBeenCalled();
    const call = upsertMock.mock.calls[0][0];
    expect(call.where.cooperativaId).toBe('coop-A');
  });
});
