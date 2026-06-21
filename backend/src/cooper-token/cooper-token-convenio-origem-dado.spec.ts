/**
 * Sprint Convênio-Token-Cooperado (20/06/2026) — slice "origemConvenioId
 * no ledger" da compra Asaas (CooperTokenCompra).
 *
 * Cobre o wiring de `convenioId` em:
 *   - `comprarTokensCooperado` (cooper-token.service.ts:~4445):
 *     opcional; quando preenchido, valida MULTI-TENANT
 *     (cooperativaId == convenio.cooperativaId — defense in depth).
 *   - `CooperTokenCompra.create` grava `convenioId` quando informado.
 *
 * Cenários:
 *  1. compra SEM convenioId → cria CooperTokenCompra com convenioId=null
 *     (caminho default, legado preservado).
 *  2. compra COM convenioId válido do mesmo tenant → cria CooperTokenCompra
 *     com convenioId preenchido (rastreio Salvaguarda 4 parecer 19/06).
 *  3. compra COM convenioId INEXISTENTE → NotFoundException
 *     (defense in depth).
 *  4. compra COM convenioId de OUTRO tenant → NotFoundException
 *     (defense in depth multi-tenant — Prisma FK não filtra cross-tenant).
 *  5. validação acontece ANTES do create do CooperTokenCompra (não vaza
 *     compra órfã se convênio inválido).
 */
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { CooperTokenService } from './cooper-token.service';

const COOP_A = 'coop-A';
const COOP_B = 'coop-B';
const PJ_A = 'cooperado-pj-A';
const CONVENIO_A = 'conv-A-valido';
const CONVENIO_B = 'conv-B-outro-tenant';

interface SetupOpts {
  conveniosNoBanco?: Array<{ id: string; cooperativaId: string }>;
}

function setup(opts: SetupOpts = {}) {
  const convenios = opts.conveniosNoBanco ?? [];

  const cooperadoFindFirst = jest.fn().mockResolvedValue({
    id: PJ_A,
    tipoPessoa: 'PJ',
    status: 'ATIVO',
    nomeCompleto: 'Empresa Cooperada PJ',
  });

  const contratoConvenioFindFirst = jest.fn(async (args: any) => {
    const where = args.where ?? {};
    const found = convenios.find(
      (c) => c.id === where.id && c.cooperativaId === where.cooperativaId,
    );
    return found ? { id: found.id } : null;
  });

  const cooperTokenCompraCreate = jest.fn().mockImplementation((args: any) => ({
    id: 'compra-1',
    ...args.data,
  }));

  const asaasService = {
    emitirCobranca: jest.fn().mockResolvedValue({
      id: 'asaas-cob-1',
      pixCopiaECola: 'PIX-DUMMY',
      pixQrCodeBase64: null,
      pixVencimento: new Date(Date.now() + 86400000).toISOString(),
    }),
  };

  const prisma: any = {
    cooperado: { findFirst: cooperadoFindFirst },
    configCooperToken: {
      findUnique: jest.fn().mockResolvedValue({ valorTokenReais: 0.45 }),
    },
    contratoConvenio: { findFirst: contratoConvenioFindFirst },
    cooperTokenCompra: {
      create: cooperTokenCompraCreate,
      update: jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      findUnique: jest.fn().mockResolvedValue({ id: 'compra-1', convenioId: null }),
    },
  };

  const service = new CooperTokenService(
    prisma,
    { emit: jest.fn() } as any,
    asaasService as any,
  );

  return {
    service,
    prisma,
    cooperadoFindFirst,
    contratoConvenioFindFirst,
    cooperTokenCompraCreate,
    asaasService,
  };
}

describe('Sprint Convênio-Token-Cooperado — comprarTokensCooperado com convenioId', () => {
  it('1. compra SEM convenioId → cria CooperTokenCompra sem convenioId (default null)', async () => {
    const { service, cooperTokenCompraCreate, contratoConvenioFindFirst } = setup();
    await service.comprarTokensCooperado({
      compradorCooperadoId: PJ_A,
      cooperativaId: COOP_A,
      quantidade: 10,
      formaPagamento: 'PIX',
    });
    expect(contratoConvenioFindFirst).not.toHaveBeenCalled(); // sem validação
    const data = cooperTokenCompraCreate.mock.calls[0][0].data;
    expect(data.convenioId).toBeUndefined(); // não setado (default null no schema)
  });

  it('2. compra COM convenioId do MESMO tenant → grava convenioId no CooperTokenCompra', async () => {
    const { service, prisma, cooperTokenCompraCreate, contratoConvenioFindFirst } = setup({
      conveniosNoBanco: [{ id: CONVENIO_A, cooperativaId: COOP_A }],
    });
    // P3 review financeiro-token (20/06): mock findUnique pós-create reflete
    // o estado real do banco (convenioId persistido). Sem isso, log/lookup
    // downstream usaria valor null silenciosamente.
    prisma.cooperTokenCompra.findUnique.mockResolvedValueOnce({
      id: 'compra-1',
      convenioId: CONVENIO_A,
      compradorCooperadoId: PJ_A,
      cooperativaId: COOP_A,
    });
    await service.comprarTokensCooperado({
      compradorCooperadoId: PJ_A,
      cooperativaId: COOP_A,
      quantidade: 10,
      formaPagamento: 'PIX',
      convenioId: CONVENIO_A,
    });
    // Guard multi-tenant chamado com cooperativaId do JWT.
    expect(contratoConvenioFindFirst).toHaveBeenCalledWith({
      where: { id: CONVENIO_A, cooperativaId: COOP_A },
      select: { id: true },
    });
    const data = cooperTokenCompraCreate.mock.calls[0][0].data;
    expect(data.convenioId).toBe(CONVENIO_A);
  });

  it('3. compra COM convenioId INEXISTENTE → NotFoundException (sem criar CooperTokenCompra)', async () => {
    const { service, cooperTokenCompraCreate } = setup({
      conveniosNoBanco: [], // nada no banco
    });
    await expect(
      service.comprarTokensCooperado({
        compradorCooperadoId: PJ_A,
        cooperativaId: COOP_A,
        quantidade: 10,
        formaPagamento: 'PIX',
        convenioId: 'convenio-fantasma',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(cooperTokenCompraCreate).not.toHaveBeenCalled();
  });

  it('4. compra COM convenioId de OUTRO TENANT → NotFoundException (defense in depth multi-tenant)', async () => {
    const { service, cooperTokenCompraCreate, contratoConvenioFindFirst } = setup({
      conveniosNoBanco: [{ id: CONVENIO_B, cooperativaId: COOP_B }], // existe mas é COOP_B
    });
    await expect(
      service.comprarTokensCooperado({
        compradorCooperadoId: PJ_A,
        cooperativaId: COOP_A, // JWT é COOP_A
        quantidade: 10,
        formaPagamento: 'PIX',
        convenioId: CONVENIO_B,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    // Guard chamado com COOP_A (JWT), não COOP_B — anti-spoof.
    expect(contratoConvenioFindFirst).toHaveBeenCalledWith({
      where: { id: CONVENIO_B, cooperativaId: COOP_A },
      select: { id: true },
    });
    expect(cooperTokenCompraCreate).not.toHaveBeenCalled();
  });

  it('5. validação do convênio acontece ANTES do create (sem compra órfã)', async () => {
    // P3 review multitenant (20/06): padronizar com rejects.toBeInstanceOf
    // (igual specs 3 e 4) — try/catch vazio anterior podia mascarar throw
    // por motivo errado (ex: configCooperToken null antes do guard).
    // Também asserta que o guard FOI invocado (não foi short-circuit por
    // outra coisa).
    const { service, cooperTokenCompraCreate, contratoConvenioFindFirst } = setup({
      conveniosNoBanco: [], // convênio não existe
    });
    await expect(
      service.comprarTokensCooperado({
        compradorCooperadoId: PJ_A,
        cooperativaId: COOP_A,
        quantidade: 10,
        formaPagamento: 'PIX',
        convenioId: 'fantasma',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    // Guard de convênio FOI chamado antes do throw.
    expect(contratoConvenioFindFirst).toHaveBeenCalledWith({
      where: { id: 'fantasma', cooperativaId: COOP_A },
      select: { id: true },
    });
    // CooperTokenCompra NUNCA criado.
    expect(cooperTokenCompraCreate).not.toHaveBeenCalled();
  });

  it('6. compra rejeitada se cooperado não é PJ (defesa pré-existente preservada)', async () => {
    const { service, prisma, contratoConvenioFindFirst, cooperTokenCompraCreate } = setup({
      conveniosNoBanco: [{ id: CONVENIO_A, cooperativaId: COOP_A }],
    });
    // Sobrescreve cooperado como PF (não-PJ) — bloqueio antecipa guard de convênio.
    prisma.cooperado.findFirst.mockResolvedValueOnce({
      id: PJ_A,
      tipoPessoa: 'PF',
      status: 'ATIVO',
      nomeCompleto: 'Pessoa Física',
    });
    await expect(
      service.comprarTokensCooperado({
        compradorCooperadoId: PJ_A,
        cooperativaId: COOP_A,
        quantidade: 10,
        formaPagamento: 'PIX',
        convenioId: CONVENIO_A,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    // Guard PJ-only roda ANTES do guard de convênio → findFirst de convênio
    // NÃO foi chamado.
    expect(contratoConvenioFindFirst).not.toHaveBeenCalled();
    expect(cooperTokenCompraCreate).not.toHaveBeenCalled();
  });
});
