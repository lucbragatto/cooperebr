import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { AdminProprietariosService } from './admin-proprietarios.service';

describe('AdminProprietariosService (F.5a + F.6a)', () => {
  let service: AdminProprietariosService;
  let prismaMock: any;

  beforeEach(() => {
    prismaMock = {
      cooperativa: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
      },
      usina: { findMany: jest.fn() },
      cooperado: { findMany: jest.fn().mockResolvedValue([]), findUnique: jest.fn() },
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

  // ─── listarCooperativasComProprietarios (F.5a — MANTIDO) ─────────

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
      prismaMock.usina.findMany.mockResolvedValueOnce([]);
      const r = await service.listarCooperativasComProprietarios();
      expect(r).toHaveLength(1);
      expect(r[0]).toMatchObject({
        cooperativaId: 'c1',
        usinasComProprietario: 0,
        proprietariosUnicos: 0,
        totalYtdAgregado: 0,
      });
    });
  });

  // ─── F.6a Endpoint N2 REFATORADO — listarProprietariosPorCooperativa ──

  describe('listarProprietariosPorCooperativa() — agregação cards', () => {
    it('NotFoundException quando cooperativa nao existe', async () => {
      prismaMock.cooperativa.findUnique.mockResolvedValueOnce(null);
      await expect(
        service.listarProprietariosPorCooperativa('fantasma'),
      ).rejects.toThrow(NotFoundException);
    });

    // Multi-tenant guard
    it('SUPER_ADMIN acessa qualquer cooperativaId', async () => {
      prismaMock.cooperativa.findUnique.mockResolvedValueOnce({ id: 'c1', nome: 'C', tipoParceiro: 'COOPERATIVA' });
      prismaMock.usina.findMany.mockResolvedValueOnce([]);
      const r = await service.listarProprietariosPorCooperativa('c1', {
        perfil: 'SUPER_ADMIN', cooperativaId: 'outra',
      });
      expect(r.cooperativa.id).toBe('c1');
      expect(r.proprietarios).toEqual([]);
    });

    it('ADMIN tentando coop alheia → 403', async () => {
      await expect(
        service.listarProprietariosPorCooperativa('c-alheia', {
          perfil: 'ADMIN', cooperativaId: 'c-minha',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('ADMIN sua propria coop → 200', async () => {
      prismaMock.cooperativa.findUnique.mockResolvedValueOnce({ id: 'c-minha', nome: 'C', tipoParceiro: 'COOPERATIVA' });
      prismaMock.usina.findMany.mockResolvedValueOnce([]);
      const r = await service.listarProprietariosPorCooperativa('c-minha', {
        perfil: 'ADMIN', cooperativaId: 'c-minha',
      });
      expect(r.cooperativa.id).toBe('c-minha');
    });

    // Agregação por chave de dedupe
    it('agrega 2 usinas mesmo proprietarioEmail (Caminho B) em 1 card', async () => {
      prismaMock.cooperativa.findUnique.mockResolvedValueOnce({ id: 'c1', nome: 'C', tipoParceiro: 'COOPERATIVA' });
      const usina = {
        statusOperacional: 'OPERANDO', statusHomologacao: 'EM_PRODUCAO',
        potenciaKwp: 100, capacidadeKwh: 0,
        formaPagamentoDono: null, valorAluguelFixo: null, percentualGeracaoDono: null,
        valorKwhPadrao: null, distribuidora: null,
        updatedAt: new Date(), geracoesMensais: [], alertas: [],
        apelidoInterno: null,
      };
      prismaMock.usina.findMany.mockResolvedValueOnce([
        { ...usina, id: 'u1', nome: 'A', proprietarioCooperadoId: null, proprietarioEmail: 'dono@x.com', proprietarioNome: 'Dono' },
        { ...usina, id: 'u2', nome: 'B', proprietarioCooperadoId: null, proprietarioEmail: 'dono@x.com', proprietarioNome: 'Dono' },
      ]);
      const r = await service.listarProprietariosPorCooperativa('c1');
      expect(r.proprietarios).toHaveLength(1);
      expect(r.proprietarios[0]).toMatchObject({
        proprietarioId: 'e-dono@x.com',
        numeroUsinas: 2,
        capacidadeTotalKwp: 200,
      });
    });

    it('agrupa proprietario por email CASE-INSENSITIVE', async () => {
      prismaMock.cooperativa.findUnique.mockResolvedValueOnce({ id: 'c1', nome: 'C', tipoParceiro: 'COOPERATIVA' });
      const base = {
        statusOperacional: 'OPERANDO', statusHomologacao: 'EM_PRODUCAO',
        potenciaKwp: 50, capacidadeKwh: 0,
        formaPagamentoDono: null, valorAluguelFixo: null, percentualGeracaoDono: null,
        valorKwhPadrao: null, distribuidora: null,
        updatedAt: new Date(), geracoesMensais: [], alertas: [], apelidoInterno: null,
        proprietarioCooperadoId: null, proprietarioNome: 'X',
      };
      prismaMock.usina.findMany.mockResolvedValueOnce([
        { ...base, id: 'u1', nome: 'A', proprietarioEmail: 'Dono@X.com' },
        { ...base, id: 'u2', nome: 'B', proprietarioEmail: 'dono@x.com' },
        { ...base, id: 'u3', nome: 'C', proprietarioEmail: 'DONO@X.COM' },
      ]);
      const r = await service.listarProprietariosPorCooperativa('c1');
      expect(r.proprietarios).toHaveLength(1);
      expect(r.proprietarios[0].numeroUsinas).toBe(3);
      expect(r.proprietarios[0].proprietarioId).toBe('e-dono@x.com');
    });

    it('SEM_PROPRIETARIO agrupa usinas com proprietarioEmail=null E proprietarioCooperadoId=null', async () => {
      prismaMock.cooperativa.findUnique.mockResolvedValueOnce({ id: 'c1', nome: 'C', tipoParceiro: 'COOPERATIVA' });
      const base = {
        statusOperacional: 'OPERANDO', statusHomologacao: 'EM_PRODUCAO',
        potenciaKwp: 0, capacidadeKwh: 0,
        formaPagamentoDono: null, valorAluguelFixo: null, percentualGeracaoDono: null,
        valorKwhPadrao: null, distribuidora: null,
        updatedAt: new Date(), geracoesMensais: [], alertas: [], apelidoInterno: null,
        proprietarioNome: null,
      };
      prismaMock.usina.findMany.mockResolvedValueOnce([
        { ...base, id: 'u1', nome: 'A', proprietarioEmail: null, proprietarioCooperadoId: null },
        { ...base, id: 'u2', nome: 'B', proprietarioEmail: null, proprietarioCooperadoId: null },
      ]);
      const r = await service.listarProprietariosPorCooperativa('c1');
      expect(r.proprietarios).toHaveLength(1);
      expect(r.proprietarios[0].proprietarioId).toBe('SEM_PROPRIETARIO');
      expect(r.proprietarios[0].nome).toBe('Sem proprietário cadastrado');
      expect(r.proprietarios[0].numeroUsinas).toBe(2);
    });

    it('nome divergente em mesmo email: pega da usina updatedAt mais recente', async () => {
      prismaMock.cooperativa.findUnique.mockResolvedValueOnce({ id: 'c1', nome: 'C', tipoParceiro: 'COOPERATIVA' });
      const base = {
        statusOperacional: 'OPERANDO', statusHomologacao: 'EM_PRODUCAO',
        potenciaKwp: 0, capacidadeKwh: 0,
        formaPagamentoDono: null, valorAluguelFixo: null, percentualGeracaoDono: null,
        valorKwhPadrao: null, distribuidora: null,
        geracoesMensais: [], alertas: [], apelidoInterno: null,
        proprietarioCooperadoId: null,
      };
      prismaMock.usina.findMany.mockResolvedValueOnce([
        { ...base, id: 'u1', nome: 'A', proprietarioEmail: 'x@y.com', proprietarioNome: 'Nome Antigo', updatedAt: new Date('2026-01-01') },
        { ...base, id: 'u2', nome: 'B', proprietarioEmail: 'x@y.com', proprietarioNome: 'Nome Novo', updatedAt: new Date('2026-05-01') },
      ]);
      const r = await service.listarProprietariosPorCooperativa('c1');
      expect(r.proprietarios[0].nome).toBe('Nome Novo');
    });

    it('sort alfabético com SEM_PROPRIETARIO sempre último', async () => {
      prismaMock.cooperativa.findUnique.mockResolvedValueOnce({ id: 'c1', nome: 'C', tipoParceiro: 'COOPERATIVA' });
      const base = {
        statusOperacional: 'OPERANDO', statusHomologacao: 'EM_PRODUCAO',
        potenciaKwp: 0, capacidadeKwh: 0,
        formaPagamentoDono: null, valorAluguelFixo: null, percentualGeracaoDono: null,
        valorKwhPadrao: null, distribuidora: null,
        updatedAt: new Date(), geracoesMensais: [], alertas: [], apelidoInterno: null,
        proprietarioCooperadoId: null,
      };
      prismaMock.usina.findMany.mockResolvedValueOnce([
        { ...base, id: 'u-orfa', nome: 'Orfa', proprietarioEmail: null, proprietarioNome: null },
        { ...base, id: 'u-zeca', nome: 'A', proprietarioEmail: 'zeca@x.com', proprietarioNome: 'Zeca' },
        { ...base, id: 'u-ana', nome: 'B', proprietarioEmail: 'ana@x.com', proprietarioNome: 'Ana' },
      ]);
      const r = await service.listarProprietariosPorCooperativa('c1');
      expect(r.proprietarios.map((p) => p.proprietarioId)).toEqual([
        'e-ana@x.com',
        'e-zeca@x.com',
        'SEM_PROPRIETARIO',
      ]);
    });

    it('Caminho A (proprietarioCooperadoId) usa Cooperado.nomeCompleto', async () => {
      prismaMock.cooperativa.findUnique.mockResolvedValueOnce({ id: 'c1', nome: 'C', tipoParceiro: 'COOPERATIVA' });
      prismaMock.usina.findMany.mockResolvedValueOnce([
        {
          id: 'u1', nome: 'X', apelidoInterno: null,
          statusOperacional: 'OPERANDO', statusHomologacao: 'EM_PRODUCAO',
          potenciaKwp: 0, capacidadeKwh: 0,
          proprietarioNome: 'Nome Diferente Errado', // ignorado pois caminho A
          proprietarioEmail: null,
          proprietarioCooperadoId: 'coop-luciano',
          formaPagamentoDono: null, valorAluguelFixo: null,
          percentualGeracaoDono: null, valorKwhPadrao: null,
          distribuidora: null, updatedAt: new Date(),
          geracoesMensais: [], alertas: [],
        },
      ]);
      prismaMock.cooperado.findMany.mockResolvedValueOnce([
        { id: 'coop-luciano', nomeCompleto: 'Luciano Bragatto' },
      ]);
      const r = await service.listarProprietariosPorCooperativa('c1');
      expect(r.proprietarios[0].nome).toBe('Luciano Bragatto');
      expect(r.proprietarios[0].proprietarioId).toBe('c-coop-luciano');
    });

    it('semáforo status: OPERANDO=ok, MANUTENCAO_PLANEJADA=atenção, demais=crítico', async () => {
      prismaMock.cooperativa.findUnique.mockResolvedValueOnce({ id: 'c1', nome: 'C', tipoParceiro: 'COOPERATIVA' });
      const base = {
        statusHomologacao: 'EM_PRODUCAO',
        potenciaKwp: 0, capacidadeKwh: 0,
        proprietarioEmail: 'x@y.com', proprietarioCooperadoId: null, proprietarioNome: 'X',
        formaPagamentoDono: null, valorAluguelFixo: null, percentualGeracaoDono: null,
        valorKwhPadrao: null, distribuidora: null,
        updatedAt: new Date(), geracoesMensais: [], alertas: [], apelidoInterno: null,
      };
      prismaMock.usina.findMany.mockResolvedValueOnce([
        { ...base, id: 'u1', nome: 'A', statusOperacional: 'OPERANDO' },
        { ...base, id: 'u2', nome: 'B', statusOperacional: 'MANUTENCAO_PLANEJADA' },
        { ...base, id: 'u3', nome: 'C', statusOperacional: 'OFFLINE' },
        { ...base, id: 'u4', nome: 'D', statusOperacional: 'DESLIGADA' },
      ]);
      const r = await service.listarProprietariosPorCooperativa('c1');
      expect(r.proprietarios[0].statusOk).toBe(1);
      expect(r.proprietarios[0].statusAtencao).toBe(1);
      expect(r.proprietarios[0].statusCritico).toBe(2);
    });

    it('conviteStatusAgregado=NA pra Caminho A (cooperado)', async () => {
      prismaMock.cooperativa.findUnique.mockResolvedValueOnce({ id: 'c1', nome: 'C', tipoParceiro: 'COOPERATIVA' });
      prismaMock.usina.findMany.mockResolvedValueOnce([
        {
          id: 'u1', nome: 'X', apelidoInterno: null,
          statusOperacional: 'OPERANDO', statusHomologacao: 'EM_PRODUCAO',
          potenciaKwp: 0, capacidadeKwh: 0,
          proprietarioNome: null, proprietarioEmail: null,
          proprietarioCooperadoId: 'coop-1',
          formaPagamentoDono: null, valorAluguelFixo: null,
          percentualGeracaoDono: null, valorKwhPadrao: null,
          distribuidora: null, updatedAt: new Date(),
          geracoesMensais: [], alertas: [],
        },
      ]);
      prismaMock.cooperado.findMany.mockResolvedValueOnce([
        { id: 'coop-1', nomeCompleto: 'Coop One' },
      ]);
      const r = await service.listarProprietariosPorCooperativa('c1');
      expect(r.proprietarios[0].conviteStatusAgregado).toBe('NA');
    });

    it('NÃO retorna mais o campo proprietarioEmailRaw (removido na F.6a)', async () => {
      prismaMock.cooperativa.findUnique.mockResolvedValueOnce({ id: 'c1', nome: 'C', tipoParceiro: 'COOPERATIVA' });
      prismaMock.usina.findMany.mockResolvedValueOnce([
        {
          id: 'u1', nome: 'X', apelidoInterno: null,
          statusOperacional: 'OPERANDO', statusHomologacao: 'EM_PRODUCAO',
          potenciaKwp: 0, capacidadeKwh: 0,
          proprietarioNome: 'X', proprietarioEmail: 'a@b.com',
          proprietarioCooperadoId: null,
          formaPagamentoDono: null, valorAluguelFixo: null,
          percentualGeracaoDono: null, valorKwhPadrao: null,
          distribuidora: null, updatedAt: new Date(),
          geracoesMensais: [], alertas: [],
        },
      ]);
      const r = await service.listarProprietariosPorCooperativa('c1');
      const json = JSON.stringify(r);
      expect(json).not.toContain('proprietarioEmailRaw');
    });
  });

  // ─── F.6a Endpoint N3 NOVO — listarUsinasDoProprietario ──────────

  describe('listarUsinasDoProprietario() — N3', () => {
    it('NotFoundException quando cooperativa nao existe', async () => {
      prismaMock.cooperativa.findUnique.mockResolvedValueOnce(null);
      await expect(
        service.listarUsinasDoProprietario('fantasma', 'e-x@y.com'),
      ).rejects.toThrow(NotFoundException);
    });

    it('BadRequestException pra propId inválido', async () => {
      prismaMock.cooperativa.findUnique.mockResolvedValueOnce({ id: 'c1', nome: 'C', tipoParceiro: 'COOPERATIVA' });
      await expect(
        service.listarUsinasDoProprietario('c1', 'formato-errado'),
      ).rejects.toThrow(BadRequestException);
    });

    it('Caminho EMAIL: filtra usinas por proprietarioEmail (case-insensitive)', async () => {
      prismaMock.cooperativa.findUnique.mockResolvedValueOnce({ id: 'c1', nome: 'C', tipoParceiro: 'COOPERATIVA' });
      const base = {
        statusOperacional: 'OPERANDO', statusHomologacao: 'EM_PRODUCAO',
        potenciaKwp: 0, capacidadeKwh: 0,
        formaPagamentoDono: null, valorAluguelFixo: null, percentualGeracaoDono: null,
        valorKwhPadrao: null, distribuidora: null,
        updatedAt: new Date(), geracoesMensais: [], alertas: [], apelidoInterno: null,
        proprietarioCooperadoId: null, proprietarioNome: 'X',
      };
      prismaMock.usina.findMany.mockResolvedValueOnce([
        { ...base, id: 'u1', nome: 'Match', proprietarioEmail: 'Match@X.com' },
        { ...base, id: 'u2', nome: 'NotMatch', proprietarioEmail: 'other@x.com' },
      ]);
      const r = await service.listarUsinasDoProprietario('c1', 'e-match@x.com');
      expect(r.usinas).toHaveLength(1);
      expect(r.usinas[0].usinaId).toBe('u1');
      expect(r.proprietario.caminho).toBe('EMAIL');
      expect(r.proprietario.emailMascarado).toBe('ma***@x.com');
    });

    it('Caminho COOPERADO: filtra por proprietarioCooperadoId', async () => {
      prismaMock.cooperativa.findUnique.mockResolvedValueOnce({ id: 'c1', nome: 'C', tipoParceiro: 'COOPERATIVA' });
      const base = {
        statusOperacional: 'OPERANDO', statusHomologacao: 'EM_PRODUCAO',
        potenciaKwp: 0, capacidadeKwh: 0,
        formaPagamentoDono: null, valorAluguelFixo: null, percentualGeracaoDono: null,
        valorKwhPadrao: null, distribuidora: null,
        updatedAt: new Date(), geracoesMensais: [], alertas: [], apelidoInterno: null,
        proprietarioEmail: null, proprietarioNome: null,
      };
      prismaMock.usina.findMany.mockResolvedValueOnce([
        { ...base, id: 'u1', nome: 'Match', proprietarioCooperadoId: 'coop-1' },
        { ...base, id: 'u2', nome: 'NotMatch', proprietarioCooperadoId: 'coop-2' },
      ]);
      prismaMock.cooperado.findUnique.mockResolvedValueOnce({ nomeCompleto: 'Luciano' });
      const r = await service.listarUsinasDoProprietario('c1', 'c-coop-1');
      expect(r.usinas).toHaveLength(1);
      expect(r.usinas[0].usinaId).toBe('u1');
      expect(r.proprietario.caminho).toBe('COOPERADO');
      expect(r.proprietario.nome).toBe('Luciano');
    });

    it('Caminho SEM_PROPRIETARIO: filtra orfas (ambos nulls)', async () => {
      prismaMock.cooperativa.findUnique.mockResolvedValueOnce({ id: 'c1', nome: 'C', tipoParceiro: 'COOPERATIVA' });
      const base = {
        statusOperacional: 'OPERANDO', statusHomologacao: 'EM_PRODUCAO',
        potenciaKwp: 0, capacidadeKwh: 0,
        formaPagamentoDono: null, valorAluguelFixo: null, percentualGeracaoDono: null,
        valorKwhPadrao: null, distribuidora: null,
        updatedAt: new Date(), geracoesMensais: [], alertas: [], apelidoInterno: null,
        proprietarioNome: null,
      };
      prismaMock.usina.findMany.mockResolvedValueOnce([
        { ...base, id: 'u-orfa', nome: 'Orfa', proprietarioEmail: null, proprietarioCooperadoId: null },
        { ...base, id: 'u-com', nome: 'ComDono', proprietarioEmail: 'x@y.com', proprietarioCooperadoId: null },
      ]);
      const r = await service.listarUsinasDoProprietario('c1', 'SEM_PROPRIETARIO');
      expect(r.usinas).toHaveLength(1);
      expect(r.usinas[0].usinaId).toBe('u-orfa');
      expect(r.proprietario.nome).toBe('Sem proprietário cadastrado');
      expect(r.proprietario.emailMascarado).toBeNull();
      expect(r.proprietario.tipo).toBe('INDEFINIDO');
    });

    // Multi-tenant
    it('ADMIN tentando coop alheia → 403', async () => {
      await expect(
        service.listarUsinasDoProprietario('c-alheia', 'e-x@y.com', {
          perfil: 'ADMIN', cooperativaId: 'c-minha',
        }),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
