import { MotorPropostaService } from './motor-proposta.service';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';

/**
 * D-FISCAL-2.4.3 (01/06/2026 noite) — Specs do branch de custeio em aceitar().
 *
 * Cobre:
 *  1. convenioCusteioId válido (pagador=EMPRESA, ATIVO, mesmo tenant) →
 *     - Contrato.planoId = plano custeado global (override do dto.planoId)
 *     - ConveniosMembrosService.adicionarMembro chamado com tx
 *  2. Sem convenioCusteioId → fluxo normal (REGRESSÃO — não chama membros)
 *  3. Convênio inexistente → NotFoundException (antes de tocar Proposta/Contrato)
 *  4. Convênio de outro tenant → ForbiddenException
 *  5. Convênio com pagador=CADA_MEMBRO → BadRequestException
 *  6. Plano global custeado não encontrado → BadRequestException
 */
describe('MotorPropostaService.aceitar — D-FISCAL-2.4.3 (custeio)', () => {
  const cooperadoFindUnique = jest.fn();
  const planoFindFirst = jest.fn();
  const planoFindUnique = jest.fn();
  const contratoCreate = jest.fn();
  const propostaCreate = jest.fn();
  const propostaFindMany = jest.fn();
  const propostaUpdate = jest.fn();
  const ucFindMany = jest.fn();
  const usinaFindMany = jest.fn();
  const listaEsperaCount = jest.fn();
  const listaEsperaCreate = jest.fn();
  const historicoCreate = jest.fn();
  const transactionMock = jest.fn();
  const contratoConvenioFindUnique = jest.fn();

  const prismaMock = {
    cooperado: { findUnique: cooperadoFindUnique },
    plano: { findFirst: planoFindFirst, findUnique: planoFindUnique },
    historicoStatusCooperado: { create: historicoCreate },
    contratoConvenio: { findUnique: contratoConvenioFindUnique },
    $transaction: transactionMock,
  } as any;

  const notificacoesMock = { criar: jest.fn().mockResolvedValue(undefined) } as any;
  const contratosMock = { gerarNumeroContrato: jest.fn().mockResolvedValue('C-0042') } as any;
  const cooperadosMock = {
    marcarPendenteDocumentos: jest.fn().mockResolvedValue(undefined),
    checkProntoParaAtivar: jest.fn().mockResolvedValue(undefined),
  } as any;

  const conveniosMembrosAdicionar = jest.fn().mockResolvedValue({ id: 'cc-vinculo-1' });
  const conveniosMembrosMock = { adicionarMembro: conveniosMembrosAdicionar } as any;

  const empty = {} as any;

  let service: MotorPropostaService;

  const resultado = {
    base: 'MES_RECENTE' as const,
    label: 'Mês recente',
    kwhApuradoBase: 0.93,
    tarifaUnitSemTrib: 0.78,
    tusdUtilizada: 0.46,
    teUtilizada: 0.32,
    descontoPercentual: 20,
    descontoAbsoluto: 0.18,
    kwhContrato: 1131,
    valorCooperado: 0.75,
    economiaAbsoluta: 0.18,
    economiaPercentual: 19.0,
    economiaMensal: 200,
    economiaAnual: 2400,
    mesesEquivalentes: 1.7,
    kwhMesRecente: 1131,
    valorMesRecente: 1235,
    kwhMedio12m: 1131,
    valorMedio12m: 1235,
    mediaCooperativaKwh: 1,
    resultadoVsMedia: 0,
    mesReferencia: '2026-05',
  };

  let createdContratoData: any;

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.BLOQUEIO_MODELOS_NAO_FIXO;
    createdContratoData = null;

    cooperadoFindUnique.mockImplementation(async ({ select }: any) => {
      if (select?.status) return { status: 'APROVADO', cooperativaId: 'coop-A' };
      return { cooperativaId: 'coop-A' };
    });

    // Plano custeado SEMPRE disponível (default — alguns testes vão sobrescrever)
    planoFindUnique.mockResolvedValue({
      modeloCobranca: 'FIXO_MENSAL',
      nome: 'Custeado por convênio',
      baseCalculo: 'KWH_CHEIO',
      tipoDesconto: 'APLICAR_SOBRE_BASE',
      temPromocao: false,
      descontoPromocional: null,
      mesesPromocao: null,
      descontoBase: 0,
    });

    transactionMock.mockImplementation(async (cb: any) => {
      const tx = {
        propostaCooperado: {
          findMany: propostaFindMany.mockResolvedValue([]),
          update: propostaUpdate,
          create: propostaCreate.mockResolvedValue({
            id: 'prop-1',
            cooperado: { nomeCompleto: 'Maria Custeada' },
          }),
        },
        uc: {
          findMany: ucFindMany.mockResolvedValue([
            { id: 'uc-1', distribuidora: 'EDP_ES', contratos: [] },
          ]),
        },
        usina: {
          findMany: usinaFindMany.mockResolvedValue([
            { id: 'usina-1', capacidadeKwh: 100000, contratos: [] },
          ]),
        },
        contrato: {
          create: contratoCreate.mockImplementation(async ({ data }: any) => {
            createdContratoData = data;
            return { id: 'contrato-1', numero: 'C-0042' };
          }),
        },
        listaEspera: {
          count: listaEsperaCount.mockResolvedValue(0),
          create: listaEsperaCreate,
        },
      };
      return cb(tx);
    });

    service = new MotorPropostaService(
      prismaMock,
      notificacoesMock,
      cooperadosMock,
      contratosMock,
      empty, empty, empty, empty, empty, empty,
      conveniosMembrosMock,
    );
  });

  it('convênio custeio válido → Contrato com plano custeado + adicionarMembro chamado com tx', async () => {
    contratoConvenioFindUnique.mockResolvedValueOnce({
      id: 'conv-1',
      cooperativaId: 'coop-A',
      status: 'ATIVO',
      pagador: 'EMPRESA',
      empresaNome: 'Clínica Médica X',
    });
    planoFindFirst.mockResolvedValueOnce({ id: 'plano-custeado-global' });

    await service.aceitar({
      cooperadoId: 'cooperado-1',
      resultado: resultado as any,
      mesReferencia: '2026-05',
      planoId: 'plano-qualquer-ignorado',
      convenioCusteioId: 'conv-1',
    });

    // Contrato deve usar o plano custeado global (NÃO o dto.planoId)
    expect(createdContratoData.planoId).toBe('plano-custeado-global');

    // adicionarMembro foi chamado com 4 args (4º = tx do $transaction)
    expect(conveniosMembrosAdicionar).toHaveBeenCalledTimes(1);
    const [convenioIdArg, cooperadoIdArg, matriculaArg, txArg] =
      conveniosMembrosAdicionar.mock.calls[0];
    expect(convenioIdArg).toBe('conv-1');
    expect(cooperadoIdArg).toBe('cooperado-1');
    expect(matriculaArg).toBeUndefined();
    expect(txArg).toBeDefined(); // tx do $transaction
  });

  it('SEM convenioCusteioId → fluxo normal (REGRESSÃO — adicionarMembro não chamado)', async () => {
    planoFindUnique.mockResolvedValueOnce({
      modeloCobranca: 'FIXO_MENSAL',
      nome: 'Plano Comum',
      baseCalculo: 'KWH_CHEIO',
      tipoDesconto: 'APLICAR_SOBRE_BASE',
      temPromocao: false,
      descontoPromocional: null,
      mesesPromocao: null,
      descontoBase: 20,
    });

    await service.aceitar({
      cooperadoId: 'cooperado-1',
      resultado: resultado as any,
      mesReferencia: '2026-05',
      planoId: 'plano-normal-id',
    });

    expect(createdContratoData.planoId).toBe('plano-normal-id');
    expect(conveniosMembrosAdicionar).not.toHaveBeenCalled();
    expect(contratoConvenioFindUnique).not.toHaveBeenCalled();
  });

  it('convênio inexistente → NotFoundException antes de tocar Proposta/Contrato', async () => {
    contratoConvenioFindUnique.mockResolvedValueOnce(null);

    await expect(
      service.aceitar({
        cooperadoId: 'cooperado-1',
        resultado: resultado as any,
        mesReferencia: '2026-05',
        convenioCusteioId: 'conv-inexistente',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(propostaCreate).not.toHaveBeenCalled();
    expect(contratoCreate).not.toHaveBeenCalled();
    expect(conveniosMembrosAdicionar).not.toHaveBeenCalled();
  });

  it('convênio de outro tenant → ForbiddenException', async () => {
    contratoConvenioFindUnique.mockResolvedValueOnce({
      id: 'conv-outra-coop',
      cooperativaId: 'coop-OUTRA',
      status: 'ATIVO',
      pagador: 'EMPRESA',
      empresaNome: 'Clínica Y',
    });

    await expect(
      service.aceitar({
        cooperadoId: 'cooperado-1',
        resultado: resultado as any,
        mesReferencia: '2026-05',
        convenioCusteioId: 'conv-outra-coop',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(contratoCreate).not.toHaveBeenCalled();
  });

  it('convênio com pagador=CADA_MEMBRO → BadRequestException (Caso 1 exige EMPRESA)', async () => {
    contratoConvenioFindUnique.mockResolvedValueOnce({
      id: 'conv-mlm',
      cooperativaId: 'coop-A',
      status: 'ATIVO',
      pagador: 'CADA_MEMBRO',
      empresaNome: 'AMAGES (MLM legado)',
    });

    await expect(
      service.aceitar({
        cooperadoId: 'cooperado-1',
        resultado: resultado as any,
        mesReferencia: '2026-05',
        convenioCusteioId: 'conv-mlm',
      }),
    ).rejects.toThrow(/pagador=EMPRESA/);

    expect(contratoCreate).not.toHaveBeenCalled();
  });

  // ============================================================
  // D-novo-CAD-CUSTEADO-FATURA (02/06/2026) — Modo teste sem UC
  // ============================================================

  it('D-novo-CAD-CUSTEADO-FATURA: custeio sem UC (modo teste) → vincula no convênio mesmo SEM contrato', async () => {
    contratoConvenioFindUnique.mockResolvedValueOnce({
      id: 'conv-teste',
      cooperativaId: 'coop-A',
      status: 'ATIVO',
      pagador: 'EMPRESA',
      empresaNome: 'Clínica Teste',
    });
    planoFindFirst.mockResolvedValueOnce({ id: 'plano-custeado-global' });
    // 0 UCs vinculadas ao cooperado (modo teste sem fatura)
    ucFindMany.mockResolvedValueOnce([]);

    const r = await service.aceitar({
      cooperadoId: 'cooperado-teste',
      resultado: resultado as any,
      mesReferencia: '2026-05',
      convenioCusteioId: 'conv-teste',
    });

    // Aceite NÃO cria contrato (sem UC) mas vincula no convênio
    expect(r.contrato).toBeNull();
    expect((r as any).aviso).toMatch(/membro vinculado ao convênio/i);
    // adicionarMembro foi chamado com tx ANTES do early-return 0 UCs
    expect(conveniosMembrosAdicionar).toHaveBeenCalledTimes(1);
    const [convArg, coopArg, , txArg] = conveniosMembrosAdicionar.mock.calls[0];
    expect(convArg).toBe('conv-teste');
    expect(coopArg).toBe('cooperado-teste');
    expect(txArg).toBeDefined();
    // contratoCreate NÃO foi chamado (sem UC = sem contrato)
    expect(contratoCreate).not.toHaveBeenCalled();
  });

  it('plano global custeado não encontrado → BadRequestException', async () => {
    contratoConvenioFindUnique.mockResolvedValueOnce({
      id: 'conv-1',
      cooperativaId: 'coop-A',
      status: 'ATIVO',
      pagador: 'EMPRESA',
      empresaNome: 'Clínica X',
    });
    planoFindFirst.mockResolvedValueOnce(null); // seed D-FISCAL-2.4.2 não rodou

    await expect(
      service.aceitar({
        cooperadoId: 'cooperado-1',
        resultado: resultado as any,
        mesReferencia: '2026-05',
        convenioCusteioId: 'conv-1',
      }),
    ).rejects.toThrow(/Custeado por convênio.*não encontrado/i);

    expect(contratoCreate).not.toHaveBeenCalled();
  });
});
