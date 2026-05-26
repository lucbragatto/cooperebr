import { NotFoundException } from '@nestjs/common';
import { AdminProprietariosService } from './admin-proprietarios.service';

describe('AdminProprietariosService (F.5a)', () => {
  let service: AdminProprietariosService;
  let prismaMock: any;

  beforeEach(() => {
    prismaMock = {
      cooperativa: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
      },
      usina: { findMany: jest.fn() },
      conviteProprietario: { findMany: jest.fn().mockResolvedValue([]) },
      contrato: { groupBy: jest.fn().mockResolvedValue([]) },
      tarifaConcessionaria: {
        findMany: jest.fn().mockResolvedValue([
          { concessionaria: 'EDP ES', dataVigencia: new Date('2026-01-01'), tusdNova: 0.4, teNova: 0.4 },
        ]),
      },
    };
    service = new AdminProprietariosService(prismaMock);
  });

  // ─── listarCooperativasComProprietarios ──────────────────────────

  describe('listarCooperativasComProprietarios()', () => {
    it('retorna array vazio quando nao ha cooperativas ativas', async () => {
      prismaMock.cooperativa.findMany.mockResolvedValueOnce([]);
      const r = await service.listarCooperativasComProprietarios();
      expect(r).toEqual([]);
    });

    it('inclui cooperativas sem proprietarios (counts=0)', async () => {
      prismaMock.cooperativa.findMany.mockResolvedValueOnce([
        { id: 'c1', nome: 'CoopX', cnpj: '00.000.000/0001-00', tipoParceiro: 'COOPERATIVA', statusSaas: 'ATIVO', planoSaas: null },
      ]);
      prismaMock.usina.findMany.mockResolvedValueOnce([]); // nenhuma usina
      const r = await service.listarCooperativasComProprietarios();
      expect(r).toHaveLength(1);
      expect(r[0]).toMatchObject({
        cooperativaId: 'c1',
        nome: 'CoopX',
        usinasComProprietario: 0,
        usinasTotal: 0,
        proprietariosUnicos: 0,
        totalYtdAgregado: 0,
        capacidadeTotalKwp: 0,
        statusOk: 0,
        convitesPendentes: 0,
        contratosVencendo30d: 0,
      });
    });

    it('conta usinasComProprietario via proprietarioEmail OR proprietarioCooperadoId', async () => {
      prismaMock.cooperativa.findMany.mockResolvedValueOnce([
        { id: 'c1', nome: 'C1', cnpj: '1', tipoParceiro: 'COOPERATIVA', statusSaas: 'ATIVO', planoSaas: null },
      ]);
      prismaMock.usina.findMany.mockResolvedValueOnce([
        { id: 'u1', cooperativaId: 'c1', proprietarioEmail: 'a@b.com', proprietarioCooperadoId: null, statusOperacional: 'OPERANDO', potenciaKwp: 100, capacidadeKwh: 0, formaPagamentoDono: null, valorAluguelFixo: null, percentualGeracaoDono: null, valorKwhPadrao: null, distribuidora: null, geracoesMensais: [] },
          { id: 'u2', cooperativaId: 'c1', proprietarioEmail: null, proprietarioCooperadoId: 'coop-1', statusOperacional: 'OPERANDO', potenciaKwp: 50, capacidadeKwh: 0, formaPagamentoDono: null, valorAluguelFixo: null, percentualGeracaoDono: null, valorKwhPadrao: null, distribuidora: null, geracoesMensais: [] },
        { id: 'u3', cooperativaId: 'c1', proprietarioEmail: null, proprietarioCooperadoId: null, statusOperacional: 'OPERANDO', potenciaKwp: 20, capacidadeKwh: 0, formaPagamentoDono: null, valorAluguelFixo: null, percentualGeracaoDono: null, valorKwhPadrao: null, distribuidora: null, geracoesMensais: [] },
      ]);
      const r = await service.listarCooperativasComProprietarios();
      expect(r[0].usinasComProprietario).toBe(2);
      expect(r[0].usinasTotal).toBe(3);
      expect(r[0].proprietariosUnicos).toBe(2); // 1 via email + 1 via cooperadoId
      expect(r[0].capacidadeTotalKwp).toBe(170);
    });

    it('classifica statusOk/atencao/critico conforme statusOperacional', async () => {
      prismaMock.cooperativa.findMany.mockResolvedValueOnce([
        { id: 'c1', nome: 'C1', cnpj: '1', tipoParceiro: 'COOPERATIVA', statusSaas: 'ATIVO', planoSaas: null },
      ]);
      prismaMock.usina.findMany.mockResolvedValueOnce([
        { id: 'u1', cooperativaId: 'c1', proprietarioEmail: null, proprietarioCooperadoId: null, statusOperacional: 'OPERANDO', potenciaKwp: 0, capacidadeKwh: 0, formaPagamentoDono: null, valorAluguelFixo: null, percentualGeracaoDono: null, valorKwhPadrao: null, distribuidora: null, geracoesMensais: [] },
        { id: 'u2', cooperativaId: 'c1', proprietarioEmail: null, proprietarioCooperadoId: null, statusOperacional: 'MANUTENCAO_PLANEJADA', potenciaKwp: 0, capacidadeKwh: 0, formaPagamentoDono: null, valorAluguelFixo: null, percentualGeracaoDono: null, valorKwhPadrao: null, distribuidora: null, geracoesMensais: [] },
        { id: 'u3', cooperativaId: 'c1', proprietarioEmail: null, proprietarioCooperadoId: null, statusOperacional: 'OFFLINE', potenciaKwp: 0, capacidadeKwh: 0, formaPagamentoDono: null, valorAluguelFixo: null, percentualGeracaoDono: null, valorKwhPadrao: null, distribuidora: null, geracoesMensais: [] },
        { id: 'u4', cooperativaId: 'c1', proprietarioEmail: null, proprietarioCooperadoId: null, statusOperacional: 'DESLIGADA', potenciaKwp: 0, capacidadeKwh: 0, formaPagamentoDono: null, valorAluguelFixo: null, percentualGeracaoDono: null, valorKwhPadrao: null, distribuidora: null, geracoesMensais: [] },
      ]);
      const r = await service.listarCooperativasComProprietarios();
      expect(r[0].statusOk).toBe(1);
      expect(r[0].statusAtencao).toBe(1);
      expect(r[0].statusCritico).toBe(2); // OFFLINE + DESLIGADA
    });

    it('agrega totalYtdAgregado via calcularRepasse pra usinas FIXO com proprietario', async () => {
      prismaMock.cooperativa.findMany.mockResolvedValueOnce([
        { id: 'c1', nome: 'C1', cnpj: '1', tipoParceiro: 'COOPERATIVA', statusSaas: 'ATIVO', planoSaas: null },
      ]);
      prismaMock.usina.findMany.mockResolvedValueOnce([
        {
          id: 'u1', cooperativaId: 'c1',
          proprietarioEmail: 'dono@x.com', proprietarioCooperadoId: null,
          statusOperacional: 'OPERANDO', potenciaKwp: 100, capacidadeKwh: 0,
          formaPagamentoDono: 'FIXO', valorAluguelFixo: 1000,
          percentualGeracaoDono: null, valorKwhPadrao: null, distribuidora: null,
          geracoesMensais: [
            { competencia: new Date('2026-01-15'), kwhGerado: 5000 },
            { competencia: new Date('2026-02-15'), kwhGerado: 5000 },
            { competencia: new Date('2026-03-15'), kwhGerado: 5000 },
            { competencia: new Date('2026-04-15'), kwhGerado: 5000 },
          ],
        },
      ]);
      const r = await service.listarCooperativasComProprietarios();
      // FIXO = 1000/mes × 4 meses = 4000
      expect(r[0].totalYtdAgregado).toBe(4000);
    });

    it('conta convitesPendentes (usedAt null + expiresAt > now)', async () => {
      prismaMock.cooperativa.findMany.mockResolvedValueOnce([
        { id: 'c1', nome: 'C1', cnpj: '1', tipoParceiro: 'COOPERATIVA', statusSaas: 'ATIVO', planoSaas: null },
      ]);
      prismaMock.usina.findMany.mockResolvedValueOnce([]);
      prismaMock.conviteProprietario.findMany.mockResolvedValueOnce([
        { usina: { cooperativaId: 'c1' } },
        { usina: { cooperativaId: 'c1' } },
      ]);
      const r = await service.listarCooperativasComProprietarios();
      expect(r[0].convitesPendentes).toBe(2);
    });

    it('conta contratosVencendo30d via groupBy', async () => {
      prismaMock.cooperativa.findMany.mockResolvedValueOnce([
        { id: 'c1', nome: 'C1', cnpj: '1', tipoParceiro: 'COOPERATIVA', statusSaas: 'ATIVO', planoSaas: null },
      ]);
      prismaMock.usina.findMany.mockResolvedValueOnce([]);
      prismaMock.contrato.groupBy.mockResolvedValueOnce([
        { cooperativaId: 'c1', _count: { _all: 3 } },
      ]);
      const r = await service.listarCooperativasComProprietarios();
      expect(r[0].contratosVencendo30d).toBe(3);
    });
  });

  // ─── listarUsinasPorCooperativa ──────────────────────────────────

  describe('listarUsinasPorCooperativa()', () => {
    it('throw NotFoundException quando cooperativa nao existe', async () => {
      prismaMock.cooperativa.findUnique.mockResolvedValueOnce(null);
      await expect(
        service.listarUsinasPorCooperativa('fantasma'),
      ).rejects.toThrow(NotFoundException);
    });

    it('mascara email do proprietario (LGPD)', async () => {
      prismaMock.cooperativa.findUnique.mockResolvedValueOnce({ id: 'c1', nome: 'C1', tipoParceiro: 'COOPERATIVA' });
      prismaMock.usina.findMany.mockResolvedValueOnce([
        {
          id: 'u1', nome: 'X', apelidoInterno: 'x', statusOperacional: 'OPERANDO',
          statusHomologacao: 'EM_PRODUCAO', potenciaKwp: 0, capacidadeKwh: 0,
          proprietarioNome: 'João', proprietarioEmail: 'joao.silva@example.com',
          proprietarioCooperadoId: null, formaPagamentoDono: null,
          valorAluguelFixo: null, percentualGeracaoDono: null, valorKwhPadrao: null,
          distribuidora: null, geracoesMensais: [],
        },
      ]);
      const r = await service.listarUsinasPorCooperativa('c1');
      expect(r.usinas[0].proprietarioEmail).toBe('jo***@example.com');
      expect(r.usinas[0].proprietarioEmailRaw).toBe('joao.silva@example.com');
    });

    it('preenche conviteStatus PENDENTE pra usina com convite ativo nao usado', async () => {
      const futuro = new Date(Date.now() + 7 * 86400 * 1000);
      prismaMock.cooperativa.findUnique.mockResolvedValueOnce({ id: 'c1', nome: 'C1', tipoParceiro: 'COOPERATIVA' });
      prismaMock.usina.findMany.mockResolvedValueOnce([
        {
          id: 'u1', nome: 'X', apelidoInterno: null, statusOperacional: 'OPERANDO',
          statusHomologacao: 'EM_PRODUCAO', potenciaKwp: 0, capacidadeKwh: 0,
          proprietarioNome: null, proprietarioEmail: null,
          proprietarioCooperadoId: null, formaPagamentoDono: null,
          valorAluguelFixo: null, percentualGeracaoDono: null, valorKwhPadrao: null,
          distribuidora: null, geracoesMensais: [],
        },
      ]);
      prismaMock.conviteProprietario.findMany.mockResolvedValueOnce([
        { id: 'cv1', usinaId: 'u1', usedAt: null, expiresAt: futuro },
      ]);
      const r = await service.listarUsinasPorCooperativa('c1');
      expect(r.usinas[0].conviteStatus).toBe('PENDENTE');
    });

    it('preenche conviteStatus USADO quando convite tem usedAt', async () => {
      prismaMock.cooperativa.findUnique.mockResolvedValueOnce({ id: 'c1', nome: 'C1', tipoParceiro: 'COOPERATIVA' });
      prismaMock.usina.findMany.mockResolvedValueOnce([
        {
          id: 'u1', nome: 'X', apelidoInterno: null, statusOperacional: 'OPERANDO',
          statusHomologacao: 'EM_PRODUCAO', potenciaKwp: 0, capacidadeKwh: 0,
          proprietarioNome: null, proprietarioEmail: null,
          proprietarioCooperadoId: null, formaPagamentoDono: null,
          valorAluguelFixo: null, percentualGeracaoDono: null, valorKwhPadrao: null,
          distribuidora: null, geracoesMensais: [],
        },
      ]);
      prismaMock.conviteProprietario.findMany.mockResolvedValueOnce([
        { id: 'cv1', usinaId: 'u1', usedAt: new Date(), expiresAt: new Date() },
      ]);
      const r = await service.listarUsinasPorCooperativa('c1');
      expect(r.usinas[0].conviteStatus).toBe('USADO');
    });

    it('preenche conviteStatus EXPIRADO quando expiresAt passou e usedAt null', async () => {
      const passado = new Date(Date.now() - 86400 * 1000);
      prismaMock.cooperativa.findUnique.mockResolvedValueOnce({ id: 'c1', nome: 'C1', tipoParceiro: 'COOPERATIVA' });
      prismaMock.usina.findMany.mockResolvedValueOnce([
        {
          id: 'u1', nome: 'X', apelidoInterno: null, statusOperacional: 'OPERANDO',
          statusHomologacao: 'EM_PRODUCAO', potenciaKwp: 0, capacidadeKwh: 0,
          proprietarioNome: null, proprietarioEmail: null,
          proprietarioCooperadoId: null, formaPagamentoDono: null,
          valorAluguelFixo: null, percentualGeracaoDono: null, valorKwhPadrao: null,
          distribuidora: null, geracoesMensais: [],
        },
      ]);
      prismaMock.conviteProprietario.findMany.mockResolvedValueOnce([
        { id: 'cv1', usinaId: 'u1', usedAt: null, expiresAt: passado },
      ]);
      const r = await service.listarUsinasPorCooperativa('c1');
      expect(r.usinas[0].conviteStatus).toBe('EXPIRADO');
    });

    it('preenche conviteStatus NAO_CONVIDADO quando nao existe convite pra usina', async () => {
      prismaMock.cooperativa.findUnique.mockResolvedValueOnce({ id: 'c1', nome: 'C1', tipoParceiro: 'COOPERATIVA' });
      prismaMock.usina.findMany.mockResolvedValueOnce([
        {
          id: 'u1', nome: 'X', apelidoInterno: null, statusOperacional: 'OPERANDO',
          statusHomologacao: 'EM_PRODUCAO', potenciaKwp: 0, capacidadeKwh: 0,
          proprietarioNome: null, proprietarioEmail: null,
          proprietarioCooperadoId: null, formaPagamentoDono: null,
          valorAluguelFixo: null, percentualGeracaoDono: null, valorKwhPadrao: null,
          distribuidora: null, geracoesMensais: [],
        },
      ]);
      // conviteProprietario default mock = []
      const r = await service.listarUsinasPorCooperativa('c1');
      expect(r.usinas[0].conviteStatus).toBe('NAO_CONVIDADO');
    });

    it('formata contratoArrendamento conforme formaPagamentoDono', async () => {
      prismaMock.cooperativa.findUnique.mockResolvedValueOnce({ id: 'c1', nome: 'C1', tipoParceiro: 'COOPERATIVA' });
      prismaMock.usina.findMany.mockResolvedValueOnce([
        {
          id: 'u-fixo', nome: 'Fixo', apelidoInterno: null, statusOperacional: 'OPERANDO',
          statusHomologacao: 'EM_PRODUCAO', potenciaKwp: 0, capacidadeKwh: 0,
          proprietarioNome: null, proprietarioEmail: null,
          proprietarioCooperadoId: null, formaPagamentoDono: 'FIXO',
          valorAluguelFixo: 1500, percentualGeracaoDono: null, valorKwhPadrao: null,
          distribuidora: null, geracoesMensais: [],
        },
        {
          id: 'u-pct', nome: 'Pct', apelidoInterno: null, statusOperacional: 'OPERANDO',
          statusHomologacao: 'EM_PRODUCAO', potenciaKwp: 0, capacidadeKwh: 0,
          proprietarioNome: null, proprietarioEmail: null,
          proprietarioCooperadoId: null, formaPagamentoDono: 'PERCENTUAL',
          valorAluguelFixo: null, percentualGeracaoDono: 15, valorKwhPadrao: null,
          distribuidora: null, geracoesMensais: [],
        },
        {
          id: 'u-nao', nome: 'NaoConfig', apelidoInterno: null, statusOperacional: 'OPERANDO',
          statusHomologacao: 'EM_PRODUCAO', potenciaKwp: 0, capacidadeKwh: 0,
          proprietarioNome: null, proprietarioEmail: null,
          proprietarioCooperadoId: null, formaPagamentoDono: null,
          valorAluguelFixo: null, percentualGeracaoDono: null, valorKwhPadrao: null,
          distribuidora: null, geracoesMensais: [],
        },
      ]);
      const r = await service.listarUsinasPorCooperativa('c1');
      expect(r.usinas[0].contratoArrendamento).toContain('FIXO');
      expect(r.usinas[1].contratoArrendamento).toContain('PERCENTUAL');
      expect(r.usinas[1].contratoArrendamento).toContain('15');
      expect(r.usinas[2].contratoArrendamento).toBe('NAO_CONFIGURADO');
    });
  });
});
