import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConveniosService } from './convenios.service';
import { CreateConvenioDto, UpdateConvenioDto, TipoConvenioDto, PagadorConvenioDto, BaseCobrancaCusteioDto } from './convenios.dto';

/**
 * D-FISCAL-2.4.4e — Specs da validação service-level do bloco custeio
 * (Caso 1: empresa paga total) na criação/edição de convênio.
 *
 * Cobre:
 *  1. CADA_MEMBRO (default) — ignora outros campos (backward-compat MLM).
 *  2. EMPRESA sem pagadorCooperadoId → BadRequest.
 *  3. EMPRESA com pagador inexistente/cross-tenant → BadRequest.
 *  4. EMPRESA com pagador INATIVO → BadRequest.
 *  5. EMPRESA sem baseCobrancaCusteio → BadRequest.
 *  6. EMPRESA + ALOCACAO_FIXA sem kwhAlocadoMensal → BadRequest.
 *  7. EMPRESA + tudo OK → persiste com flags corretas.
 *  8. UPDATE parcial — só pagador → reaproveita banco pra checar dependentes.
 */
describe('ConveniosService — D-FISCAL-2.4.4e (config custeio Caso 1)', () => {
  const findUniqueCondominio = jest.fn();
  const findUniqueAdmin = jest.fn();
  const findFirstConvenioCheck = jest.fn();
  const findUniqueCoop = jest.fn();
  const findFirstCoopValid = jest.fn();
  const createCoop = jest.fn();
  const createConvenio = jest.fn();
  const findFirstConvenioFindOne = jest.fn();
  const updateConvenio = jest.fn();
  const recalcularFaixa = jest.fn();

  const prismaMock = {
    condominio: { findUnique: findUniqueCondominio },
    administradora: { findUnique: findUniqueAdmin },
    contratoConvenio: {
      findFirst: jest.fn().mockImplementation((args: any) => {
        // findOne na update reusa findFirst; createValida usa findFirst pra condomínio dup
        if (args?.where?.condominioId) return findFirstConvenioCheck(args);
        return findFirstConvenioFindOne(args);
      }),
      create: createConvenio,
      update: updateConvenio,
      count: jest.fn(),
    },
    cooperado: {
      findUnique: findUniqueCoop,
      findFirst: findFirstCoopValid,
      create: createCoop,
    },
    convenioCooperado: { updateMany: jest.fn() },
  } as any;

  const progressaoServiceMock = { recalcularFaixa } as any;
  let service: ConveniosService;

  const baseDto: CreateConvenioDto = {
    nome: 'Clínica Médica X',
    tipo: TipoConvenioDto.EMPRESA,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ConveniosService(prismaMock, progressaoServiceMock);
    createConvenio.mockResolvedValue({ id: 'conv-novo' });
  });

  // ============================================================
  // CADA_MEMBRO (default) — ignora outros campos
  // ============================================================

  it('CADA_MEMBRO (default): cria sem exigir pagadorCooperadoId', async () => {
    await service.create('coop-A', { ...baseDto });
    expect(findFirstCoopValid).not.toHaveBeenCalled();
    expect(createConvenio).toHaveBeenCalledTimes(1);
    const data = createConvenio.mock.calls[0][0].data;
    expect(data.pagador).toBe('CADA_MEMBRO');
    expect(data.pagadorCooperadoId).toBeNull();
    expect(data.baseCobrancaCusteio).toBe('CONSUMO_REAL'); // default seguro
    expect(data.kwhAlocadoMensal).toBeNull();
    expect(data.descontoKwhCusteio).toBeNull();
  });

  // ============================================================
  // EMPRESA — enforcements
  // ============================================================

  it('EMPRESA sem pagadorCooperadoId → BadRequest', async () => {
    await expect(
      service.create('coop-A', {
        ...baseDto,
        pagador: PagadorConvenioDto.EMPRESA,
        baseCobrancaCusteio: BaseCobrancaCusteioDto.CONSUMO_REAL,
      }),
    ).rejects.toThrow(/pagadorCooperadoId/);
    expect(createConvenio).not.toHaveBeenCalled();
  });

  it('EMPRESA com pagador inexistente/cross-tenant → BadRequest', async () => {
    findFirstCoopValid.mockResolvedValueOnce(null); // não achou no tenant
    await expect(
      service.create('coop-A', {
        ...baseDto,
        pagador: PagadorConvenioDto.EMPRESA,
        pagadorCooperadoId: 'pagador-fake',
        baseCobrancaCusteio: BaseCobrancaCusteioDto.CONSUMO_REAL,
      }),
    ).rejects.toThrow(/não encontrado neste tenant/);
    expect(createConvenio).not.toHaveBeenCalled();
  });

  it('EMPRESA com pagador INATIVO → BadRequest', async () => {
    findFirstCoopValid.mockResolvedValueOnce({
      id: 'pagador-1',
      status: 'PENDENTE_DOCUMENTOS',
      nomeCompleto: 'Clínica X',
    });
    await expect(
      service.create('coop-A', {
        ...baseDto,
        pagador: PagadorConvenioDto.EMPRESA,
        pagadorCooperadoId: 'pagador-1',
        baseCobrancaCusteio: BaseCobrancaCusteioDto.CONSUMO_REAL,
      }),
    ).rejects.toThrow(/não está ATIVO/);
    expect(createConvenio).not.toHaveBeenCalled();
  });

  it('EMPRESA sem baseCobrancaCusteio → BadRequest', async () => {
    findFirstCoopValid.mockResolvedValueOnce({
      id: 'pagador-1',
      status: 'ATIVO',
      nomeCompleto: 'Clínica X',
    });
    await expect(
      service.create('coop-A', {
        ...baseDto,
        pagador: PagadorConvenioDto.EMPRESA,
        pagadorCooperadoId: 'pagador-1',
        // baseCobrancaCusteio: faltando
      } as any),
    ).rejects.toThrow(/baseCobrancaCusteio/);
    expect(createConvenio).not.toHaveBeenCalled();
  });

  it('EMPRESA + ALOCACAO_FIXA sem kwhAlocadoMensal → BadRequest', async () => {
    findFirstCoopValid.mockResolvedValueOnce({
      id: 'pagador-1',
      status: 'ATIVO',
      nomeCompleto: 'Clínica X',
    });
    await expect(
      service.create('coop-A', {
        ...baseDto,
        pagador: PagadorConvenioDto.EMPRESA,
        pagadorCooperadoId: 'pagador-1',
        baseCobrancaCusteio: BaseCobrancaCusteioDto.ALOCACAO_FIXA,
        // kwhAlocadoMensal: faltando
      }),
    ).rejects.toThrow(/kwhAlocadoMensal/);
    expect(createConvenio).not.toHaveBeenCalled();
  });

  it('EMPRESA + tudo OK (CONSUMO_REAL) → persiste com flags', async () => {
    findFirstCoopValid.mockResolvedValueOnce({
      id: 'pagador-1',
      status: 'ATIVO',
      nomeCompleto: 'Clínica X',
    });
    await service.create('coop-A', {
      ...baseDto,
      pagador: PagadorConvenioDto.EMPRESA,
      pagadorCooperadoId: 'pagador-1',
      baseCobrancaCusteio: BaseCobrancaCusteioDto.CONSUMO_REAL,
      descontoKwhCusteio: 20,
    });
    expect(createConvenio).toHaveBeenCalledTimes(1);
    const data = createConvenio.mock.calls[0][0].data;
    expect(data.pagador).toBe('EMPRESA');
    expect(data.pagadorCooperadoId).toBe('pagador-1');
    expect(data.baseCobrancaCusteio).toBe('CONSUMO_REAL');
    expect(data.kwhAlocadoMensal).toBeNull();
    expect(data.descontoKwhCusteio).toBe(20);
  });

  it('EMPRESA + ALOCACAO_FIXA + tudo OK → persiste kwhAlocadoMensal', async () => {
    findFirstCoopValid.mockResolvedValueOnce({
      id: 'pagador-1',
      status: 'ATIVO',
      nomeCompleto: 'Clínica X',
    });
    await service.create('coop-A', {
      ...baseDto,
      pagador: PagadorConvenioDto.EMPRESA,
      pagadorCooperadoId: 'pagador-1',
      baseCobrancaCusteio: BaseCobrancaCusteioDto.ALOCACAO_FIXA,
      kwhAlocadoMensal: 5000,
      descontoKwhCusteio: 30,
    });
    expect(createConvenio).toHaveBeenCalledTimes(1);
    const data = createConvenio.mock.calls[0][0].data;
    expect(data.baseCobrancaCusteio).toBe('ALOCACAO_FIXA');
    expect(data.kwhAlocadoMensal).toBe(5000);
    expect(data.descontoKwhCusteio).toBe(30);
  });

  // ============================================================
  // UPDATE parcial — reaproveita banco
  // ============================================================

  it('UPDATE parcial só pagador=EMPRESA + banco já tem pagadorCooperadoId → passa validação', async () => {
    findFirstConvenioFindOne.mockResolvedValueOnce({
      id: 'conv-1',
      cooperativaId: 'coop-A',
      pagador: 'CADA_MEMBRO',
      pagadorCooperadoId: 'pagador-X-existente',
      baseCobrancaCusteio: 'CONSUMO_REAL',
      kwhAlocadoMensal: null,
    });
    findFirstCoopValid.mockResolvedValueOnce({
      id: 'pagador-X-existente',
      status: 'ATIVO',
      nomeCompleto: 'Empresa existente',
    });
    updateConvenio.mockResolvedValueOnce({ id: 'conv-1' });

    await service.update('conv-1', { pagador: PagadorConvenioDto.EMPRESA });

    expect(updateConvenio).toHaveBeenCalledTimes(1);
    const data = updateConvenio.mock.calls[0][0].data;
    expect(data.pagador).toBe('EMPRESA');
  });

  it('UPDATE parcial muda pra EMPRESA mas banco não tem pagadorCooperadoId → BadRequest', async () => {
    findFirstConvenioFindOne.mockResolvedValueOnce({
      id: 'conv-1',
      cooperativaId: 'coop-A',
      pagador: 'CADA_MEMBRO',
      pagadorCooperadoId: null, // banco sem pagador
      baseCobrancaCusteio: 'CONSUMO_REAL',
      kwhAlocadoMensal: null,
    });

    await expect(
      service.update('conv-1', { pagador: PagadorConvenioDto.EMPRESA }),
    ).rejects.toThrow(/pagadorCooperadoId/);
    expect(updateConvenio).not.toHaveBeenCalled();
  });
});
