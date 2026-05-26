import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ProprietarioService } from './proprietario.service';

describe('ProprietarioService', () => {
  let service: ProprietarioService;
  let prismaMock: any;

  beforeEach(() => {
    prismaMock = {
      usina: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
      },
      tarifaConcessionaria: {
        findMany: jest.fn().mockResolvedValue([
          { concessionaria: 'EDP ES', dataVigencia: new Date('2026-01-01'), tusdNova: 0.40, teNova: 0.40 },
        ]),
      },
      contrato: {
        findMany: jest.fn(),
      },
      contaAPagar: {
        findMany: jest.fn(),
      },
    };
    service = new ProprietarioService(prismaMock);
  });

  // ─── resolverUsinasDoProprietario (via dashboard) ────────────────

  describe('multi-tenant guard', () => {
    it('throw ForbiddenException quando user nao autenticado', async () => {
      await expect(service.dashboard(null)).rejects.toThrow(ForbiddenException);
    });

    it('throw ForbiddenException quando user sem cooperadoId nem email', async () => {
      await expect(service.dashboard({ id: 'u1' })).rejects.toThrow(ForbiddenException);
    });

    it('throw ForbiddenException quando nenhuma usina vinculada', async () => {
      prismaMock.usina.findMany.mockResolvedValueOnce([]);
      await expect(
        service.dashboard({ cooperadoId: 'coop1', email: 'x@y.com' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('busca via proprietarioCooperadoId OU proprietarioEmail', async () => {
      // 1a chamada: resolverUsinasDoProprietario
      prismaMock.usina.findMany.mockResolvedValueOnce([{ id: 'u1' }]);
      // 2a chamada: dashboard com include
      prismaMock.usina.findMany.mockResolvedValueOnce([]);

      await service.dashboard({ cooperadoId: 'coop1', email: 'a@b.com' });

      const arg = prismaMock.usina.findMany.mock.calls[0][0];
      expect(arg.where.OR).toEqual([
        { proprietarioCooperadoId: 'coop1' },
        { proprietarioEmail: 'a@b.com' },
      ]);
    });
  });

  // ─── dashboard ───────────────────────────────────────────────────

  describe('dashboard()', () => {
    it('agrega KPIs e usinas com repasse calculado via helper', async () => {
      prismaMock.usina.findMany
        .mockResolvedValueOnce([{ id: 'u1' }]) // resolverUsinas
        .mockResolvedValueOnce([
          {
            id: 'u1',
            nome: 'Solar Test',
            apelidoInterno: 'st',
            cidade: 'Linhares',
            estado: 'ES',
            distribuidora: 'EDP_ES',
            statusHomologacao: 'EM_PRODUCAO',
            statusOperacional: 'OPERANDO',
            capacidadeKwh: 10000,
            potenciaKwp: 100,
            formaPagamentoDono: 'FIXO',
            valorAluguelFixo: 1500,
            percentualGeracaoDono: null,
            valorKwhPadrao: null,
            contratos: [
              { kwhContrato: 5000, percentualUsina: 50, dataFim: null },
            ],
            geracoesMensais: [
              { competencia: new Date(), kwhGerado: 8000 },
            ],
            alertas: [],
          },
        ]);

      const r = await service.dashboard({ cooperadoId: 'coop1', email: 'a@b.com' });

      expect(r.usinas).toHaveLength(1);
      expect(r.usinas[0].repasseMesAtual.valor).toBe(1500); // FIXO
      expect(r.kpisTop.receberEsseMes).toBe(1500);
      expect(r.kpisTop.usinasOk).toBe(1);
    });

    it('marca usina como critico quando statusOperacional=OFFLINE', async () => {
      prismaMock.usina.findMany
        .mockResolvedValueOnce([{ id: 'u1' }])
        .mockResolvedValueOnce([
          {
            id: 'u1', nome: 'X', apelidoInterno: 'x', cidade: 'Y', estado: 'ES',
            distribuidora: 'EDP_ES', statusHomologacao: 'EM_PRODUCAO',
            statusOperacional: 'OFFLINE',
            capacidadeKwh: 10000, potenciaKwp: 100,
            formaPagamentoDono: 'FIXO', valorAluguelFixo: 100,
            percentualGeracaoDono: null, valorKwhPadrao: null,
            contratos: [], geracoesMensais: [], alertas: [],
          },
        ]);

      const r = await service.dashboard({ cooperadoId: 'coop1' });
      expect(r.kpisTop.usinasCritico).toBe(1);
      expect(r.usinas[0].visualStatus).toBe('critico');
    });
  });

  // ─── detalheUsina ────────────────────────────────────────────────

  describe('detalheUsina()', () => {
    it('throw NotFoundException quando usinaId nao pertence ao proprietario', async () => {
      prismaMock.usina.findMany.mockResolvedValueOnce([{ id: 'u1' }]);
      await expect(
        service.detalheUsina({ cooperadoId: 'coop1' }, 'u-outra'),
      ).rejects.toThrow(NotFoundException);
    });

    it('retorna detalhe com cooperados anonimizados (#001, #002...)', async () => {
      prismaMock.usina.findMany.mockResolvedValueOnce([{ id: 'u1' }]);
      prismaMock.usina.findUnique.mockResolvedValueOnce({
        id: 'u1', nome: 'X', apelidoInterno: 'x', cidade: 'Y', estado: 'ES',
        distribuidora: 'EDP_ES', statusHomologacao: 'EM_PRODUCAO',
        statusOperacional: 'OPERANDO', classeGdAnotada: 'GD_I',
        formaAquisicao: 'ALUGUEL', formaPagamentoDono: 'FIXO',
        capacidadeKwh: 10000, potenciaKwp: 100,
        valorAluguelFixo: 500, percentualGeracaoDono: null, valorKwhPadrao: null,
        responsabilidadeDespesas: {},
        contratos: [
          { id: 'c1', cooperadoId: 'aaa', numero: '001', status: 'ATIVO', dataInicio: new Date(), dataFim: null, kwhContrato: 100, percentualUsina: 10, cooperado: { id: 'aaa' } },
          { id: 'c2', cooperadoId: 'bbb', numero: '002', status: 'ATIVO', dataInicio: new Date(), dataFim: null, kwhContrato: 200, percentualUsina: 20, cooperado: { id: 'bbb' } },
        ],
        geracoesMensais: [],
        alertas: [],
      });

      const r = await service.detalheUsina({ cooperadoId: 'coop1' }, 'u1');

      expect(r.cooperadosAnonimizados.total).toBe(2);
      expect(r.cooperadosAnonimizados.lista[0].apelido).toBe('Cooperado #001');
      expect(r.cooperadosAnonimizados.lista[1].apelido).toBe('Cooperado #002');
      // Nomes reais NAO aparecem
      const json = JSON.stringify(r);
      expect(json).not.toContain('aaa');
      expect(json).not.toContain('bbb');
    });
  });

  // ─── listarRepasses ──────────────────────────────────────────────

  describe('listarRepasses()', () => {
    it('throw NotFoundException com filtro usinaId fora do portfolio', async () => {
      prismaMock.usina.findMany.mockResolvedValueOnce([{ id: 'u1' }]);
      await expect(
        service.listarRepasses({ cooperadoId: 'coop1' }, { usinaId: 'u-outra' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('agrega totalYTD do ano corrente', async () => {
      const now = new Date();
      const inicioAno = new Date(now.getFullYear(), 0, 1);

      prismaMock.usina.findMany
        .mockResolvedValueOnce([{ id: 'u1' }])
        .mockResolvedValueOnce([
          {
            id: 'u1', nome: 'X',
            formaPagamentoDono: 'FIXO',
            valorAluguelFixo: 1000,
            percentualGeracaoDono: null, valorKwhPadrao: null,
            distribuidora: 'EDP_ES',
            geracoesMensais: [
              { competencia: new Date(inicioAno.getTime() + 30 * 24 * 60 * 60 * 1000), kwhGerado: 500 },
              { competencia: new Date(inicioAno.getTime() + 60 * 24 * 60 * 60 * 1000), kwhGerado: 600 },
            ],
          },
        ]);

      const r = await service.listarRepasses({ cooperadoId: 'coop1' }, {});
      expect(r.repasses).toHaveLength(2);
      // 2 meses x R$ 1000 FIXO = R$ 2000 YTD
      expect(r.totalYTD).toBe(2000);
    });
  });

  // ─── listarDespesas ──────────────────────────────────────────────

  describe('listarDespesas()', () => {
    it('filtra apenas despesas onde responsavelPagamento in [PROPRIETARIO, COMPARTILHADO]', async () => {
      prismaMock.usina.findMany.mockResolvedValueOnce([{ id: 'u1' }]);
      prismaMock.contaAPagar.findMany.mockResolvedValueOnce([
        {
          id: 'd1', descricao: 'Manutencao', categoria: 'MANUTENCAO_PREVENTIVA',
          valor: 500, dataVencimento: new Date(), dataPagamento: null,
          status: 'PENDENTE', responsavelPagamento: 'PROPRIETARIO',
          usina: { id: 'u1', nome: 'X', apelidoInterno: 'x' }, comprovante: null,
        },
      ]);

      const r = await service.listarDespesas({ cooperadoId: 'coop1' }, {});
      expect(prismaMock.contaAPagar.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            responsavelPagamento: { in: ['PROPRIETARIO', 'COMPARTILHADO'] },
          }),
        }),
      );
      expect(r).toHaveLength(1);
      expect(r[0].valor).toBe(500);
    });
  });
});
