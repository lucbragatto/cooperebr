/**
 * Sub-Fase 1 Fase 5 (M13.A, 19/05/2026) — spec do EnvioListaConcessionariaService.
 *
 * Cobre os 11 métodos públicos com foco especial em `registrarHomologacao`
 * (trigger ativação Contrato PENDENTE_ATIVACAO → ATIVO + agregação de status
 * do envio + emit event pós-commit).
 *
 * Padrão de mock: Prisma manual + EventEmitter manual, sem TestingModule
 * NestJS (mantém spec rápido e focado em lógica).
 */
import { Prisma } from '@prisma/client';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { EnvioListaConcessionariaService } from './envio-lista-concessionaria.service';
import { CanalEnvio } from './dto/marcar-enviado.dto';
import { StatusHomologacaoInput } from './dto/registrar-homologacao.dto';
import { ENVIO_LISTA_EVENTS } from './envio-lista-concessionaria.events';

type Any = any;

function buildPrismaMock() {
  const envioListaConcessionaria = {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  };
  const envioListaCooperado = {
    findMany: jest.fn(),
    update: jest.fn(),
  };
  const contrato = {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
  };
  const usina = {
    findUnique: jest.fn(),
  };

  // $transaction: chama o callback com o tx (próprio prismaMock).
  // Aceita 2º arg (SERIALIZABLE_TX options) sem afetar.
  const $transaction = jest.fn(async (cb: Any, _opts?: Any) => cb({
    envioListaConcessionaria,
    envioListaCooperado,
    contrato,
    usina,
  }));

  return {
    envioListaConcessionaria,
    envioListaCooperado,
    contrato,
    usina,
    $transaction,
  };
}

function buildEventEmitterMock() {
  return {
    emit: jest.fn(),
  };
}

function makeService() {
  const prisma = buildPrismaMock();
  const eventEmitter = buildEventEmitterMock();
  const service = new EnvioListaConcessionariaService(prisma as Any, eventEmitter as Any);
  return { service, prisma, eventEmitter };
}

const TENANT = 'coop-tenant-A';
const OTHER_TENANT = 'coop-other-B';
const USINA_ID = 'usina-1';
const ENVIO_ID = 'envio-1';

describe('EnvioListaConcessionariaService', () => {
  // ─────────────────────────────────────────────────────────────────────────
  // 1. criarRascunho
  // ─────────────────────────────────────────────────────────────────────────

  describe('criarRascunho', () => {
    it('lança BadRequest se usinaId vazio', async () => {
      const { service } = makeService();
      await expect(
        service.criarRascunho({ usinaId: '', cooperativaId: TENANT, cooperadoIds: ['c-1'] }),
      ).rejects.toThrow(BadRequestException);
    });

    it('lança BadRequest se cooperadoIds vazio', async () => {
      const { service } = makeService();
      await expect(
        service.criarRascunho({ usinaId: USINA_ID, cooperativaId: TENANT, cooperadoIds: [] }),
      ).rejects.toThrow(/Selecione pelo menos 1 cooperado/);
    });

    it('lança NotFound se usina não existe', async () => {
      const { service, prisma } = makeService();
      prisma.usina.findUnique.mockResolvedValue(null);
      await expect(
        service.criarRascunho({ usinaId: USINA_ID, cooperativaId: TENANT, cooperadoIds: ['c-1'] }),
      ).rejects.toThrow(NotFoundException);
    });

    it('lança Forbidden se usina pertence a outro tenant', async () => {
      const { service, prisma } = makeService();
      prisma.usina.findUnique.mockResolvedValue({
        id: USINA_ID,
        cooperativaId: OTHER_TENANT,
        nome: 'Usina X',
        apelidoInterno: 'ux',
        capacidadeKwh: new Prisma.Decimal(50000),
      });
      await expect(
        service.criarRascunho({ usinaId: USINA_ID, cooperativaId: TENANT, cooperadoIds: ['c-1'] }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('lança BadRequest se nenhum cooperado tem contrato ATIVO/PENDENTE_ATIVACAO', async () => {
      const { service, prisma } = makeService();
      prisma.usina.findUnique.mockResolvedValue({
        id: USINA_ID,
        cooperativaId: TENANT,
        nome: 'U',
        apelidoInterno: 'u',
        capacidadeKwh: new Prisma.Decimal(50000),
      });
      prisma.contrato.findMany.mockResolvedValue([]);
      await expect(
        service.criarRascunho({ usinaId: USINA_ID, cooperativaId: TENANT, cooperadoIds: ['c-1'] }),
      ).rejects.toThrow(/Nenhum dos cooperados.*contrato ATIVO\/PENDENTE/);
    });

    it('lança Forbidden se cooperado pertence a outro tenant (defensivo)', async () => {
      const { service, prisma } = makeService();
      prisma.usina.findUnique.mockResolvedValue({
        id: USINA_ID,
        cooperativaId: TENANT,
        nome: 'U',
        apelidoInterno: 'u',
        capacidadeKwh: new Prisma.Decimal(50000),
      });
      prisma.contrato.findMany.mockResolvedValue([
        {
          id: 'ctr-1',
          cooperadoId: 'c-1',
          kwhContrato: new Prisma.Decimal(500),
          percentualUsina: new Prisma.Decimal(1),
          cooperado: { id: 'c-1', cooperativaId: OTHER_TENANT },
          uc: { numero: 'UC-001' },
        },
      ]);
      await expect(
        service.criarRascunho({ usinaId: USINA_ID, cooperativaId: TENANT, cooperadoIds: ['c-1'] }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('lança BadRequest listando cooperados ausentes', async () => {
      const { service, prisma } = makeService();
      prisma.usina.findUnique.mockResolvedValue({
        id: USINA_ID,
        cooperativaId: TENANT,
        nome: 'U',
        apelidoInterno: 'u',
        capacidadeKwh: new Prisma.Decimal(50000),
      });
      prisma.contrato.findMany.mockResolvedValue([
        {
          id: 'ctr-1',
          cooperadoId: 'c-1',
          kwhContrato: new Prisma.Decimal(500),
          percentualUsina: new Prisma.Decimal(1),
          cooperado: { id: 'c-1', cooperativaId: TENANT },
          uc: { numero: 'UC-001' },
        },
      ]);
      await expect(
        service.criarRascunho({
          usinaId: USINA_ID,
          cooperativaId: TENANT,
          cooperadoIds: ['c-1', 'c-2-ausente'],
        }),
      ).rejects.toThrow(/sem contrato ATIVO\/PENDENTE.*c-2-ausente/);
    });

    it('happy path: gera numeroInterno LIST-{apelido}-YYYYMM-001 quando primeiro do mês', async () => {
      const { service, prisma } = makeService();
      prisma.usina.findUnique.mockResolvedValue({
        id: USINA_ID,
        cooperativaId: TENANT,
        nome: 'Solar Vitória',
        apelidoInterno: 'SolarVix',
        capacidadeKwh: new Prisma.Decimal(50000),
      });
      prisma.contrato.findMany.mockResolvedValue([
        {
          id: 'ctr-1',
          cooperadoId: 'c-1',
          kwhContrato: new Prisma.Decimal(500),
          percentualUsina: new Prisma.Decimal(2),
          cooperado: { id: 'c-1', cooperativaId: TENANT },
          uc: { numero: 'UC-001' },
        },
      ]);
      prisma.envioListaConcessionaria.findFirst.mockResolvedValue(null);
      prisma.envioListaConcessionaria.create.mockImplementation((args: Any) => ({
        id: ENVIO_ID,
        ...args.data,
        cooperados: [],
        usina: { id: USINA_ID, nome: 'Solar Vitória', apelidoInterno: 'SolarVix' },
      }));

      const result = await service.criarRascunho({
        usinaId: USINA_ID,
        cooperativaId: TENANT,
        cooperadoIds: ['c-1'],
      });

      const yyyymm = `${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}`;
      expect(result.numeroInterno).toBe(`LIST-solarvix-${yyyymm}-001`);
      expect(prisma.envioListaConcessionaria.create).toHaveBeenCalledTimes(1);
      const createArgs = prisma.envioListaConcessionaria.create.mock.calls[0][0];
      expect(createArgs.data.cooperativaId).toBe(TENANT);
      expect(createArgs.data.status).toBe('RASCUNHO');
      expect(createArgs.data.cooperados.create).toHaveLength(1);
      expect(createArgs.data.cooperados.create[0].statusIndividual).toBe('PENDENTE');
    });

    it('numeroInterno: incrementa sequencial quando existe envio anterior do mês', async () => {
      const { service, prisma } = makeService();
      prisma.usina.findUnique.mockResolvedValue({
        id: USINA_ID,
        cooperativaId: TENANT,
        nome: 'U',
        apelidoInterno: 'ux',
        capacidadeKwh: new Prisma.Decimal(50000),
      });
      prisma.contrato.findMany.mockResolvedValue([
        {
          id: 'ctr-1',
          cooperadoId: 'c-1',
          kwhContrato: new Prisma.Decimal(500),
          percentualUsina: new Prisma.Decimal(2),
          cooperado: { id: 'c-1', cooperativaId: TENANT },
          uc: { numero: 'UC-001' },
        },
      ]);
      const yyyymm = `${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}`;
      prisma.envioListaConcessionaria.findFirst.mockResolvedValue({
        numeroInterno: `LIST-ux-${yyyymm}-007`,
      });
      prisma.envioListaConcessionaria.create.mockImplementation((args: Any) => ({
        id: ENVIO_ID,
        ...args.data,
        cooperados: [],
        usina: {},
      }));

      const result = await service.criarRascunho({
        usinaId: USINA_ID,
        cooperativaId: TENANT,
        cooperadoIds: ['c-1'],
      });

      expect(result.numeroInterno).toBe(`LIST-ux-${yyyymm}-008`);
    });

    it('numeroInterno: usa usina.id.slice(0,6) quando apelidoInterno ausente', async () => {
      const { service, prisma } = makeService();
      prisma.usina.findUnique.mockResolvedValue({
        id: 'abcdef1234-uuid-mais',
        cooperativaId: TENANT,
        nome: 'U',
        apelidoInterno: null,
        capacidadeKwh: new Prisma.Decimal(50000),
      });
      prisma.contrato.findMany.mockResolvedValue([
        {
          id: 'ctr-1',
          cooperadoId: 'c-1',
          kwhContrato: new Prisma.Decimal(500),
          percentualUsina: new Prisma.Decimal(2),
          cooperado: { id: 'c-1', cooperativaId: TENANT },
          uc: { numero: 'UC-001' },
        },
      ]);
      prisma.envioListaConcessionaria.findFirst.mockResolvedValue(null);
      prisma.envioListaConcessionaria.create.mockImplementation((args: Any) => ({
        id: ENVIO_ID,
        ...args.data,
        cooperados: [],
        usina: {},
      }));

      const result = await service.criarRascunho({
        usinaId: 'abcdef1234-uuid-mais',
        cooperativaId: TENANT,
        cooperadoIds: ['c-1'],
      });

      const yyyymm = `${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}`;
      expect(result.numeroInterno).toBe(`LIST-abcdef-${yyyymm}-001`);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 2. listarCooperadosElegiveis
  // ─────────────────────────────────────────────────────────────────────────

  describe('listarCooperadosElegiveis', () => {
    it('lança NotFound se usina não existe', async () => {
      const { service, prisma } = makeService();
      prisma.usina.findUnique.mockResolvedValue(null);
      await expect(service.listarCooperadosElegiveis(USINA_ID, TENANT)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('lança Forbidden se usina pertence a outro tenant', async () => {
      const { service, prisma } = makeService();
      prisma.usina.findUnique.mockResolvedValue({
        id: USINA_ID,
        cooperativaId: OTHER_TENANT,
        nome: 'U',
        apelidoInterno: 'u',
        capacidadeKwh: new Prisma.Decimal(50000),
      });
      await expect(service.listarCooperadosElegiveis(USINA_ID, TENANT)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('retorna cooperados elegíveis com histórico de envios anteriores', async () => {
      const { service, prisma } = makeService();
      prisma.usina.findUnique.mockResolvedValue({
        id: USINA_ID,
        cooperativaId: TENANT,
        nome: 'Solar Vix',
        apelidoInterno: 'svx',
        capacidadeKwh: new Prisma.Decimal(50000),
      });
      prisma.contrato.findMany.mockResolvedValue([
        {
          id: 'ctr-1',
          cooperadoId: 'c-1',
          status: 'ATIVO',
          kwhContrato: new Prisma.Decimal(500),
          percentualUsina: new Prisma.Decimal(2),
          cooperado: { id: 'c-1', nomeCompleto: 'João', cpf: '111' },
          uc: { numero: 'UC-001' },
        },
        {
          id: 'ctr-2',
          cooperadoId: 'c-2',
          status: 'PENDENTE_ATIVACAO',
          kwhContrato: new Prisma.Decimal(300),
          percentualUsina: new Prisma.Decimal(1),
          cooperado: { id: 'c-2', nomeCompleto: 'Maria', cpf: '222' },
          uc: { numero: 'UC-002' },
        },
      ]);
      // c-1 já foi homologado em envio anterior; c-2 nunca enviou.
      prisma.envioListaCooperado.findMany.mockResolvedValue([
        {
          cooperadoId: 'c-1',
          statusIndividual: 'HOMOLOGADO',
          envio: { id: 'env-prev', numeroInterno: 'LIST-svx-202604-001', status: 'HOMOLOGADO_TOTAL', geradaEm: new Date() },
          createdAt: new Date(),
        },
      ]);

      const result = await service.listarCooperadosElegiveis(USINA_ID, TENANT);

      expect(result.cooperados).toHaveLength(2);
      const joao = result.cooperados.find((c: Any) => c.cooperadoId === 'c-1');
      const maria = result.cooperados.find((c: Any) => c.cooperadoId === 'c-2');
      expect(joao?.jaEnviado).toBe(true);
      expect(joao?.homologado).toBe(true);
      expect(maria?.jaEnviado).toBe(false);
      expect(maria?.homologado).toBe(false);
    });

    it('ignora envios em status CANCELADA na busca de histórico', async () => {
      const { service, prisma } = makeService();
      prisma.usina.findUnique.mockResolvedValue({
        id: USINA_ID,
        cooperativaId: TENANT,
        nome: 'U',
        apelidoInterno: 'u',
        capacidadeKwh: new Prisma.Decimal(50000),
      });
      prisma.contrato.findMany.mockResolvedValue([
        {
          id: 'ctr-1',
          cooperadoId: 'c-1',
          status: 'ATIVO',
          kwhContrato: new Prisma.Decimal(500),
          percentualUsina: new Prisma.Decimal(2),
          cooperado: { id: 'c-1', nomeCompleto: 'João', cpf: '111' },
          uc: { numero: 'UC-001' },
        },
      ]);
      prisma.envioListaCooperado.findMany.mockResolvedValue([]);
      await service.listarCooperadosElegiveis(USINA_ID, TENANT);
      const call = prisma.envioListaCooperado.findMany.mock.calls[0][0];
      expect(call.where.envio.status.notIn).toContain('CANCELADA');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 3. validar
  // ─────────────────────────────────────────────────────────────────────────

  describe('validar', () => {
    it('happy path: RASCUNHO → VALIDADA + validadaEm + validadaPorId', async () => {
      const { service, prisma } = makeService();
      prisma.envioListaConcessionaria.findUnique.mockResolvedValue({
        id: ENVIO_ID,
        cooperativaId: TENANT,
        status: 'RASCUNHO',
        usina: {},
        cooperados: [],
      });
      prisma.envioListaConcessionaria.update.mockResolvedValue({ id: ENVIO_ID, status: 'VALIDADA' });

      const result = await service.validar(ENVIO_ID, 'user-admin', TENANT);
      expect(result.status).toBe('VALIDADA');
      const call = prisma.envioListaConcessionaria.update.mock.calls[0][0];
      expect(call.data.validadaPorId).toBe('user-admin');
      expect(call.data.validadaEm).toBeInstanceOf(Date);
    });

    it('bloqueia transição inválida ENVIADA → VALIDADA', async () => {
      const { service, prisma } = makeService();
      prisma.envioListaConcessionaria.findUnique.mockResolvedValue({
        id: ENVIO_ID,
        cooperativaId: TENANT,
        status: 'ENVIADA',
        usina: {},
        cooperados: [],
      });
      await expect(service.validar(ENVIO_ID, 'u', TENANT)).rejects.toThrow(/Transição inválida/);
    });

    it('lança Forbidden em envio de outro tenant', async () => {
      const { service, prisma } = makeService();
      prisma.envioListaConcessionaria.findUnique.mockResolvedValue({
        id: ENVIO_ID,
        cooperativaId: OTHER_TENANT,
        status: 'RASCUNHO',
        usina: {},
        cooperados: [],
      });
      await expect(service.validar(ENVIO_ID, 'u', TENANT)).rejects.toThrow(ForbiddenException);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 4. marcarProntoPraEnvio
  // ─────────────────────────────────────────────────────────────────────────

  describe('marcarProntoPraEnvio', () => {
    it('happy path: VALIDADA → PRONTA_PARA_ENVIO', async () => {
      const { service, prisma } = makeService();
      prisma.envioListaConcessionaria.findUnique.mockResolvedValue({
        id: ENVIO_ID,
        cooperativaId: TENANT,
        status: 'VALIDADA',
        usina: {},
        cooperados: [],
      });
      prisma.envioListaConcessionaria.update.mockResolvedValue({ status: 'PRONTA_PARA_ENVIO' });
      await service.marcarProntoPraEnvio(ENVIO_ID, TENANT);
      const call = prisma.envioListaConcessionaria.update.mock.calls[0][0];
      expect(call.data.status).toBe('PRONTA_PARA_ENVIO');
    });

    it('bloqueia transição inválida RASCUNHO → PRONTA_PARA_ENVIO', async () => {
      const { service, prisma } = makeService();
      prisma.envioListaConcessionaria.findUnique.mockResolvedValue({
        id: ENVIO_ID,
        cooperativaId: TENANT,
        status: 'RASCUNHO',
        usina: {},
        cooperados: [],
      });
      await expect(service.marcarProntoPraEnvio(ENVIO_ID, TENANT)).rejects.toThrow(BadRequestException);
    });

    it('lança Forbidden em envio de outro tenant', async () => {
      const { service, prisma } = makeService();
      prisma.envioListaConcessionaria.findUnique.mockResolvedValue({
        id: ENVIO_ID,
        cooperativaId: OTHER_TENANT,
        status: 'VALIDADA',
        usina: {},
        cooperados: [],
      });
      await expect(service.marcarProntoPraEnvio(ENVIO_ID, TENANT)).rejects.toThrow(ForbiddenException);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 5. marcarEnviado
  // ─────────────────────────────────────────────────────────────────────────

  describe('marcarEnviado', () => {
    it('happy path: PRONTA_PARA_ENVIO → ENVIADA com canalEnvio', async () => {
      const { service, prisma } = makeService();
      prisma.envioListaConcessionaria.findUnique.mockResolvedValue({
        id: ENVIO_ID,
        cooperativaId: TENANT,
        status: 'PRONTA_PARA_ENVIO',
        observacoes: null,
        usina: {},
        cooperados: [],
      });
      prisma.envioListaConcessionaria.update.mockResolvedValue({ status: 'ENVIADA' });
      await service.marcarEnviado(
        ENVIO_ID,
        { canalEnvio: CanalEnvio.email },
        'user-admin',
        TENANT,
      );
      const call = prisma.envioListaConcessionaria.update.mock.calls[0][0];
      expect(call.data.status).toBe('ENVIADA');
      expect(call.data.canalEnvio).toBe('email');
      expect(call.data.enviadaPorId).toBe('user-admin');
      expect(call.data.enviadaEm).toBeInstanceOf(Date);
    });

    it('observacoes: append e não substitui observacao prévia', async () => {
      const { service, prisma } = makeService();
      prisma.envioListaConcessionaria.findUnique.mockResolvedValue({
        id: ENVIO_ID,
        cooperativaId: TENANT,
        status: 'PRONTA_PARA_ENVIO',
        observacoes: 'Nota anterior',
        usina: {},
        cooperados: [],
      });
      prisma.envioListaConcessionaria.update.mockResolvedValue({});
      await service.marcarEnviado(
        ENVIO_ID,
        { canalEnvio: CanalEnvio.portal, observacoes: 'Enviado via portal EDP' },
        'u',
        TENANT,
      );
      const call = prisma.envioListaConcessionaria.update.mock.calls[0][0];
      expect(call.data.observacoes).toContain('Nota anterior');
      expect(call.data.observacoes).toContain('[envio] Enviado via portal EDP');
    });

    it('bloqueia transição inválida RASCUNHO → ENVIADA', async () => {
      const { service, prisma } = makeService();
      prisma.envioListaConcessionaria.findUnique.mockResolvedValue({
        id: ENVIO_ID,
        cooperativaId: TENANT,
        status: 'RASCUNHO',
        observacoes: null,
        usina: {},
        cooperados: [],
      });
      await expect(
        service.marcarEnviado(ENVIO_ID, { canalEnvio: CanalEnvio.email }, 'u', TENANT),
      ).rejects.toThrow(BadRequestException);
    });

    it('lança Forbidden em envio de outro tenant', async () => {
      const { service, prisma } = makeService();
      prisma.envioListaConcessionaria.findUnique.mockResolvedValue({
        id: ENVIO_ID,
        cooperativaId: OTHER_TENANT,
        status: 'PRONTA_PARA_ENVIO',
        observacoes: null,
        usina: {},
        cooperados: [],
      });
      await expect(
        service.marcarEnviado(ENVIO_ID, { canalEnvio: CanalEnvio.email }, 'u', TENANT),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 6. registrarProtocolo
  // ─────────────────────────────────────────────────────────────────────────

  describe('registrarProtocolo', () => {
    it('happy path: ENVIADA → PROTOCOLADA com numeroProtocolo + dataProtocolo informada', async () => {
      const { service, prisma } = makeService();
      prisma.envioListaConcessionaria.findUnique.mockResolvedValue({
        id: ENVIO_ID,
        cooperativaId: TENANT,
        status: 'ENVIADA',
        usina: {},
        cooperados: [],
      });
      prisma.envioListaConcessionaria.update.mockResolvedValue({ status: 'PROTOCOLADA' });
      await service.registrarProtocolo(
        ENVIO_ID,
        { numeroProtocoloConcessionaria: 'PROT-EDP-2026-001', dataProtocolo: '2026-05-15' },
        TENANT,
      );
      const call = prisma.envioListaConcessionaria.update.mock.calls[0][0];
      expect(call.data.status).toBe('PROTOCOLADA');
      expect(call.data.numeroProtocoloConcessionaria).toBe('PROT-EDP-2026-001');
      expect(call.data.protocoloEm).toEqual(new Date('2026-05-15'));
    });

    it('dataProtocolo opcional: usa new Date() (now) quando omitida', async () => {
      const { service, prisma } = makeService();
      prisma.envioListaConcessionaria.findUnique.mockResolvedValue({
        id: ENVIO_ID,
        cooperativaId: TENANT,
        status: 'ENVIADA',
        usina: {},
        cooperados: [],
      });
      prisma.envioListaConcessionaria.update.mockResolvedValue({});
      const before = Date.now();
      await service.registrarProtocolo(
        ENVIO_ID,
        { numeroProtocoloConcessionaria: 'PROT-X' },
        TENANT,
      );
      const call = prisma.envioListaConcessionaria.update.mock.calls[0][0];
      const proto = call.data.protocoloEm as Date;
      expect(proto.getTime()).toBeGreaterThanOrEqual(before);
      expect(proto.getTime()).toBeLessThanOrEqual(Date.now());
    });

    it('bloqueia transição inválida RASCUNHO → PROTOCOLADA', async () => {
      const { service, prisma } = makeService();
      prisma.envioListaConcessionaria.findUnique.mockResolvedValue({
        id: ENVIO_ID,
        cooperativaId: TENANT,
        status: 'RASCUNHO',
        usina: {},
        cooperados: [],
      });
      await expect(
        service.registrarProtocolo(ENVIO_ID, { numeroProtocoloConcessionaria: 'P' }, TENANT),
      ).rejects.toThrow(BadRequestException);
    });

    it('lança Forbidden em envio de outro tenant', async () => {
      const { service, prisma } = makeService();
      prisma.envioListaConcessionaria.findUnique.mockResolvedValue({
        id: ENVIO_ID,
        cooperativaId: OTHER_TENANT,
        status: 'ENVIADA',
        usina: {},
        cooperados: [],
      });
      await expect(
        service.registrarProtocolo(ENVIO_ID, { numeroProtocoloConcessionaria: 'P' }, TENANT),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 7. registrarHomologacao ⭐ TRIGGER ATIVAÇÃO + AGREGAÇÃO + EMIT
  // ─────────────────────────────────────────────────────────────────────────

  describe('registrarHomologacao', () => {
    /**
     * Helper pra montar envio em status PROTOCOLADA com N cooperados pendentes.
     */
    function setupEnvioProtocolado(prisma: Any, cooperados: Any[]) {
      prisma.envioListaConcessionaria.findUnique.mockResolvedValue({
        id: ENVIO_ID,
        cooperativaId: TENANT,
        usinaId: USINA_ID,
        numeroProtocoloConcessionaria: 'PROT-EDP-001',
        status: 'PROTOCOLADA',
        usina: {},
        cooperados,
      });
    }

    it('lança BadRequest se envio em status inválido (ex: RASCUNHO)', async () => {
      const { service, prisma } = makeService();
      prisma.envioListaConcessionaria.findUnique.mockResolvedValue({
        id: ENVIO_ID,
        cooperativaId: TENANT,
        usinaId: USINA_ID,
        status: 'RASCUNHO',
        usina: {},
        cooperados: [],
      });
      await expect(
        service.registrarHomologacao(
          ENVIO_ID,
          'c-1',
          { statusIndividual: StatusHomologacaoInput.HOMOLOGADO },
          TENANT,
        ),
      ).rejects.toThrow(/não aceita registro de homologação/);
    });

    it('lança NotFound se cooperadoId não está no snapshot do envio', async () => {
      const { service, prisma } = makeService();
      setupEnvioProtocolado(prisma, [
        { id: 'l-1', cooperadoId: 'c-OUTRO', contratoId: 'ctr-x' },
      ]);
      await expect(
        service.registrarHomologacao(
          ENVIO_ID,
          'c-NAO-EXISTE',
          { statusIndividual: StatusHomologacaoInput.HOMOLOGADO },
          TENANT,
        ),
      ).rejects.toThrow(/snapshot imutável/);
    });

    it('HOMOLOGADO single cooperado de N: status fica HOMOLOGADO_PARCIAL', async () => {
      const { service, prisma, eventEmitter } = makeService();
      setupEnvioProtocolado(prisma, [
        { id: 'l-1', cooperadoId: 'c-1', contratoId: 'ctr-1' },
        { id: 'l-2', cooperadoId: 'c-2', contratoId: 'ctr-2' },
      ]);
      prisma.envioListaCooperado.update.mockResolvedValue({});
      prisma.contrato.findUnique.mockResolvedValue({ id: 'ctr-1', status: 'PENDENTE_ATIVACAO' });
      prisma.contrato.update.mockResolvedValue({});
      prisma.envioListaCooperado.findMany.mockResolvedValue([
        { statusIndividual: 'HOMOLOGADO' },
        { statusIndividual: 'PENDENTE' },
      ]);
      prisma.envioListaConcessionaria.update.mockResolvedValue({
        id: ENVIO_ID,
        status: 'HOMOLOGADO_PARCIAL',
        cooperados: [],
      });

      const result = await service.registrarHomologacao(
        ENVIO_ID,
        'c-1',
        { statusIndividual: StatusHomologacaoInput.HOMOLOGADO },
        TENANT,
      );
      expect(result.agregado.status).toBe('HOMOLOGADO_PARCIAL');
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        ENVIO_LISTA_EVENTS.COOPERADO_HOMOLOGADO,
        expect.objectContaining({ cooperadoId: 'c-1', contratoAtivadoAgora: true }),
      );
    });

    it('todos HOMOLOGADO: status vira HOMOLOGADO_TOTAL + liberadaEm', async () => {
      const { service, prisma } = makeService();
      setupEnvioProtocolado(prisma, [
        { id: 'l-1', cooperadoId: 'c-1', contratoId: 'ctr-1' },
      ]);
      prisma.envioListaCooperado.update.mockResolvedValue({});
      prisma.contrato.findUnique.mockResolvedValue({ id: 'ctr-1', status: 'PENDENTE_ATIVACAO' });
      prisma.contrato.update.mockResolvedValue({});
      prisma.envioListaCooperado.findMany.mockResolvedValue([{ statusIndividual: 'HOMOLOGADO' }]);
      prisma.envioListaConcessionaria.update.mockResolvedValue({});

      const result = await service.registrarHomologacao(
        ENVIO_ID,
        'c-1',
        { statusIndividual: StatusHomologacaoInput.HOMOLOGADO },
        TENANT,
      );
      expect(result.agregado.status).toBe('HOMOLOGADO_TOTAL');
      const updateCall = prisma.envioListaConcessionaria.update.mock.calls[0][0];
      expect(updateCall.data.status).toBe('HOMOLOGADO_TOTAL');
      expect(updateCall.data.liberadaEm).toBeInstanceOf(Date);
    });

    it('todos REJEITADO (sem pendentes): status vira REJEITADA', async () => {
      const { service, prisma, eventEmitter } = makeService();
      setupEnvioProtocolado(prisma, [
        { id: 'l-1', cooperadoId: 'c-1', contratoId: 'ctr-1' },
      ]);
      prisma.envioListaCooperado.update.mockResolvedValue({});
      prisma.envioListaCooperado.findMany.mockResolvedValue([{ statusIndividual: 'REJEITADO' }]);
      prisma.envioListaConcessionaria.update.mockResolvedValue({});

      const result = await service.registrarHomologacao(
        ENVIO_ID,
        'c-1',
        { statusIndividual: StatusHomologacaoInput.REJEITADO },
        TENANT,
      );
      expect(result.agregado.status).toBe('REJEITADA');
      // REJEITADO não dispara emit
      expect(eventEmitter.emit).not.toHaveBeenCalled();
      // REJEITADO não busca contrato (trigger só dispara em HOMOLOGADO)
      expect(prisma.contrato.findUnique).not.toHaveBeenCalled();
    });

    it('trigger ativação: contrato PENDENTE_ATIVACAO → ATIVO + dataAtivacao + contratoAtivadoAgora=true', async () => {
      const { service, prisma, eventEmitter } = makeService();
      setupEnvioProtocolado(prisma, [
        { id: 'l-1', cooperadoId: 'c-1', contratoId: 'ctr-1' },
      ]);
      prisma.envioListaCooperado.update.mockResolvedValue({});
      prisma.contrato.findUnique.mockResolvedValue({ id: 'ctr-1', status: 'PENDENTE_ATIVACAO' });
      prisma.contrato.update.mockResolvedValue({});
      prisma.envioListaCooperado.findMany.mockResolvedValue([{ statusIndividual: 'HOMOLOGADO' }]);
      prisma.envioListaConcessionaria.update.mockResolvedValue({});

      const result = await service.registrarHomologacao(
        ENVIO_ID,
        'c-1',
        { statusIndividual: StatusHomologacaoInput.HOMOLOGADO },
        TENANT,
      );
      expect(result.contratoAtivadoAgora).toBe(true);
      const contratoCall = prisma.contrato.update.mock.calls[0][0];
      expect(contratoCall.data.status).toBe('ATIVO');
      expect(contratoCall.data.dataAtivacao).toBeInstanceOf(Date);
      expect(eventEmitter.emit).toHaveBeenCalled();
      const emitArgs = (eventEmitter.emit.mock.calls[0] as Any[]) ?? [];
      expect(emitArgs[1].contratoAtivadoAgora).toBe(true);
    });

    it('trigger NÃO dispara: contrato já ATIVO → contratoAtivadoAgora=false + emit ainda ocorre mas listener vai SKIPPED', async () => {
      const { service, prisma, eventEmitter } = makeService();
      setupEnvioProtocolado(prisma, [
        { id: 'l-1', cooperadoId: 'c-1', contratoId: 'ctr-1' },
      ]);
      prisma.envioListaCooperado.update.mockResolvedValue({});
      prisma.contrato.findUnique.mockResolvedValue({ id: 'ctr-1', status: 'ATIVO' });
      prisma.envioListaCooperado.findMany.mockResolvedValue([{ statusIndividual: 'HOMOLOGADO' }]);
      prisma.envioListaConcessionaria.update.mockResolvedValue({});

      const result = await service.registrarHomologacao(
        ENVIO_ID,
        'c-1',
        { statusIndividual: StatusHomologacaoInput.HOMOLOGADO },
        TENANT,
      );
      expect(result.contratoAtivadoAgora).toBe(false);
      expect(prisma.contrato.update).not.toHaveBeenCalled();
      const emitArgs = (eventEmitter.emit.mock.calls[0] as Any[]) ?? [];
      expect(emitArgs[1].contratoAtivadoAgora).toBe(false);
    });

    it('dataHomologacao informada: usa a data do DTO no payload do evento', async () => {
      const { service, prisma, eventEmitter } = makeService();
      setupEnvioProtocolado(prisma, [
        { id: 'l-1', cooperadoId: 'c-1', contratoId: 'ctr-1' },
      ]);
      prisma.envioListaCooperado.update.mockResolvedValue({});
      prisma.contrato.findUnique.mockResolvedValue({ id: 'ctr-1', status: 'PENDENTE_ATIVACAO' });
      prisma.contrato.update.mockResolvedValue({});
      prisma.envioListaCooperado.findMany.mockResolvedValue([{ statusIndividual: 'HOMOLOGADO' }]);
      prisma.envioListaConcessionaria.update.mockResolvedValue({});

      await service.registrarHomologacao(
        ENVIO_ID,
        'c-1',
        {
          statusIndividual: StatusHomologacaoInput.HOMOLOGADO,
          dataHomologacao: '2026-05-15',
        },
        TENANT,
      );
      const emitArgs = (eventEmitter.emit.mock.calls[0] as Any[]) ?? [];
      expect(emitArgs[1].dataHomologacao).toEqual(new Date('2026-05-15'));
    });

    it('payload do evento contém todos os campos necessários ao listener', async () => {
      const { service, prisma, eventEmitter } = makeService();
      setupEnvioProtocolado(prisma, [
        { id: 'l-1', cooperadoId: 'c-1', contratoId: 'ctr-1' },
      ]);
      prisma.envioListaCooperado.update.mockResolvedValue({});
      prisma.contrato.findUnique.mockResolvedValue({ id: 'ctr-1', status: 'PENDENTE_ATIVACAO' });
      prisma.contrato.update.mockResolvedValue({});
      prisma.envioListaCooperado.findMany.mockResolvedValue([{ statusIndividual: 'HOMOLOGADO' }]);
      prisma.envioListaConcessionaria.update.mockResolvedValue({});

      await service.registrarHomologacao(
        ENVIO_ID,
        'c-1',
        { statusIndividual: StatusHomologacaoInput.HOMOLOGADO },
        TENANT,
      );
      const [eventName, payload] = (eventEmitter.emit.mock.calls[0] as Any[]) ?? [];
      expect(eventName).toBe(ENVIO_LISTA_EVENTS.COOPERADO_HOMOLOGADO);
      expect(payload).toEqual({
        cooperativaId: TENANT,
        cooperadoId: 'c-1',
        contratoId: 'ctr-1',
        envioListaId: ENVIO_ID,
        envioListaCooperadoId: 'l-1',
        usinaId: USINA_ID,
        numeroProtocolo: 'PROT-EDP-001',
        dataHomologacao: expect.any(Date),
        contratoAtivadoAgora: true,
      });
    });

    it('emit acontece APÓS commit da tx (não dentro do callback)', async () => {
      const { service, prisma, eventEmitter } = makeService();
      setupEnvioProtocolado(prisma, [
        { id: 'l-1', cooperadoId: 'c-1', contratoId: 'ctr-1' },
      ]);
      prisma.envioListaCooperado.update.mockResolvedValue({});
      prisma.contrato.findUnique.mockResolvedValue({ id: 'ctr-1', status: 'PENDENTE_ATIVACAO' });
      prisma.contrato.update.mockResolvedValue({});
      prisma.envioListaCooperado.findMany.mockResolvedValue([{ statusIndividual: 'HOMOLOGADO' }]);
      prisma.envioListaConcessionaria.update.mockResolvedValue({});

      // Capturar ordem: $transaction termina antes de emit
      const ordem: string[] = [];
      prisma.$transaction.mockImplementationOnce(async (cb: Any) => {
        ordem.push('tx-start');
        const result = await cb(prisma);
        ordem.push('tx-commit');
        return result;
      });
      eventEmitter.emit.mockImplementation(() => {
        ordem.push('emit');
        return true;
      });

      await service.registrarHomologacao(
        ENVIO_ID,
        'c-1',
        { statusIndividual: StatusHomologacaoInput.HOMOLOGADO },
        TENANT,
      );
      const txCommitIdx = ordem.indexOf('tx-commit');
      const emitIdx = ordem.indexOf('emit');
      expect(txCommitIdx).toBeGreaterThan(-1);
      expect(emitIdx).toBeGreaterThan(txCommitIdx);
    });

    it('REJEITADO não emite evento (proteção contra notificação errada)', async () => {
      const { service, prisma, eventEmitter } = makeService();
      setupEnvioProtocolado(prisma, [
        { id: 'l-1', cooperadoId: 'c-1', contratoId: 'ctr-1' },
        { id: 'l-2', cooperadoId: 'c-2', contratoId: 'ctr-2' },
      ]);
      prisma.envioListaCooperado.update.mockResolvedValue({});
      prisma.envioListaCooperado.findMany.mockResolvedValue([
        { statusIndividual: 'REJEITADO' },
        { statusIndividual: 'PENDENTE' },
      ]);
      prisma.envioListaConcessionaria.update.mockResolvedValue({});

      await service.registrarHomologacao(
        ENVIO_ID,
        'c-1',
        { statusIndividual: StatusHomologacaoInput.REJEITADO },
        TENANT,
      );
      expect(eventEmitter.emit).not.toHaveBeenCalled();
    });

    it('aceita estado HOMOLOGADO_PARCIAL como entrada (reentrante)', async () => {
      const { service, prisma } = makeService();
      prisma.envioListaConcessionaria.findUnique.mockResolvedValue({
        id: ENVIO_ID,
        cooperativaId: TENANT,
        usinaId: USINA_ID,
        numeroProtocoloConcessionaria: 'PROT-X',
        status: 'HOMOLOGADO_PARCIAL',
        usina: {},
        cooperados: [
          { id: 'l-1', cooperadoId: 'c-1', contratoId: 'ctr-1' },
          { id: 'l-2', cooperadoId: 'c-2', contratoId: 'ctr-2' },
        ],
      });
      prisma.envioListaCooperado.update.mockResolvedValue({});
      prisma.contrato.findUnique.mockResolvedValue({ id: 'ctr-2', status: 'PENDENTE_ATIVACAO' });
      prisma.contrato.update.mockResolvedValue({});
      prisma.envioListaCooperado.findMany.mockResolvedValue([
        { statusIndividual: 'HOMOLOGADO' },
        { statusIndividual: 'HOMOLOGADO' },
      ]);
      prisma.envioListaConcessionaria.update.mockResolvedValue({});

      const result = await service.registrarHomologacao(
        ENVIO_ID,
        'c-2',
        { statusIndividual: StatusHomologacaoInput.HOMOLOGADO },
        TENANT,
      );
      expect(result.agregado.status).toBe('HOMOLOGADO_TOTAL');
    });

    it('contrato sem registro (deleção concorrente) não trava — apenas pula trigger', async () => {
      const { service, prisma, eventEmitter } = makeService();
      setupEnvioProtocolado(prisma, [
        { id: 'l-1', cooperadoId: 'c-1', contratoId: 'ctr-1' },
      ]);
      prisma.envioListaCooperado.update.mockResolvedValue({});
      prisma.contrato.findUnique.mockResolvedValue(null);
      prisma.envioListaCooperado.findMany.mockResolvedValue([{ statusIndividual: 'HOMOLOGADO' }]);
      prisma.envioListaConcessionaria.update.mockResolvedValue({});

      const result = await service.registrarHomologacao(
        ENVIO_ID,
        'c-1',
        { statusIndividual: StatusHomologacaoInput.HOMOLOGADO },
        TENANT,
      );
      expect(result.contratoAtivadoAgora).toBe(false);
      expect(prisma.contrato.update).not.toHaveBeenCalled();
      // Emit ainda ocorre, mas listener vai abortar pelo guard contratoAtivadoAgora=false
      expect(eventEmitter.emit).toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 8. cancelar
  // ─────────────────────────────────────────────────────────────────────────

  describe('cancelar', () => {
    it('happy path: RASCUNHO → CANCELADA', async () => {
      const { service, prisma } = makeService();
      prisma.envioListaConcessionaria.findUnique.mockResolvedValue({
        id: ENVIO_ID,
        cooperativaId: TENANT,
        status: 'RASCUNHO',
        observacoes: null,
        usina: {},
        cooperados: [],
      });
      prisma.envioListaConcessionaria.update.mockResolvedValue({ status: 'CANCELADA' });
      await service.cancelar(ENVIO_ID, undefined, TENANT);
      const call = prisma.envioListaConcessionaria.update.mock.calls[0][0];
      expect(call.data.status).toBe('CANCELADA');
    });

    it.each([['HOMOLOGADO_TOTAL'], ['REJEITADA'], ['CANCELADA']])(
      'bloqueia cancelamento em estado final %s',
      async (status) => {
        const { service, prisma } = makeService();
        prisma.envioListaConcessionaria.findUnique.mockResolvedValue({
          id: ENVIO_ID,
          cooperativaId: TENANT,
          status,
          observacoes: null,
          usina: {},
          cooperados: [],
        });
        await expect(service.cancelar(ENVIO_ID, 'motivo', TENANT)).rejects.toThrow(
          /é final e não pode ser cancelado/,
        );
      },
    );

    it('motivo: append nas observacoes preservando histórico', async () => {
      const { service, prisma } = makeService();
      prisma.envioListaConcessionaria.findUnique.mockResolvedValue({
        id: ENVIO_ID,
        cooperativaId: TENANT,
        status: 'VALIDADA',
        observacoes: 'Nota original',
        usina: {},
        cooperados: [],
      });
      prisma.envioListaConcessionaria.update.mockResolvedValue({});
      await service.cancelar(ENVIO_ID, 'Cooperado desistiu', TENANT);
      const call = prisma.envioListaConcessionaria.update.mock.calls[0][0];
      expect(call.data.observacoes).toContain('Nota original');
      expect(call.data.observacoes).toContain('[cancelamento] Cooperado desistiu');
    });

    it('lança Forbidden em envio de outro tenant', async () => {
      const { service, prisma } = makeService();
      prisma.envioListaConcessionaria.findUnique.mockResolvedValue({
        id: ENVIO_ID,
        cooperativaId: OTHER_TENANT,
        status: 'RASCUNHO',
        observacoes: null,
        usina: {},
        cooperados: [],
      });
      await expect(service.cancelar(ENVIO_ID, 'm', TENANT)).rejects.toThrow(ForbiddenException);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 9. gerarCsv
  // ─────────────────────────────────────────────────────────────────────────

  describe('gerarCsv', () => {
    it('gera CSV com header padrão + rows ordenados por nome', async () => {
      const { service, prisma } = makeService();
      prisma.envioListaConcessionaria.findUnique.mockResolvedValue({
        id: ENVIO_ID,
        cooperativaId: TENANT,
        numeroInterno: 'LIST-svx-202605-001',
        status: 'PRONTA_PARA_ENVIO',
        usina: {},
        cooperados: [],
      });
      prisma.envioListaCooperado.findMany.mockResolvedValue([
        {
          ucNumero: 'UC-001',
          kwhContratoSnapshot: new Prisma.Decimal(500),
          percentualUsinaSnapshot: new Prisma.Decimal(2),
          statusIndividual: 'PENDENTE',
          cooperado: { nomeCompleto: 'Alice', cpf: '111' },
          contrato: { numero: 'CTR-2026-0001', dataInicio: new Date('2026-04-01') },
        },
      ]);
      const { csv, filename, numeroInterno } = await service.gerarCsv(ENVIO_ID, TENANT);
      expect(csv.split('\n')[0]).toContain('Nome,CPF,Numero UC');
      expect(csv).toContain('"Alice"');
      expect(csv).toContain('"UC-001"');
      expect(numeroInterno).toBe('LIST-svx-202605-001');
      expect(filename).toMatch(/^LIST-svx-202605-001-\d{4}-\d{2}-\d{2}\.csv$/);
    });

    it('lança NotFound quando envio não existe', async () => {
      const { service, prisma } = makeService();
      prisma.envioListaConcessionaria.findUnique.mockResolvedValue(null);
      await expect(service.gerarCsv(ENVIO_ID, TENANT)).rejects.toThrow(NotFoundException);
    });

    it('lança Forbidden em envio de outro tenant', async () => {
      const { service, prisma } = makeService();
      prisma.envioListaConcessionaria.findUnique.mockResolvedValue({
        id: ENVIO_ID,
        cooperativaId: OTHER_TENANT,
        numeroInterno: 'LIST-x',
        status: 'PRONTA_PARA_ENVIO',
        usina: {},
        cooperados: [],
      });
      await expect(service.gerarCsv(ENVIO_ID, TENANT)).rejects.toThrow(ForbiddenException);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 10. listar
  // ─────────────────────────────────────────────────────────────────────────

  describe('listar', () => {
    it('happy path: aplica cooperativaId no where + paginação default', async () => {
      const { service, prisma } = makeService();
      prisma.envioListaConcessionaria.count.mockResolvedValue(0);
      prisma.envioListaConcessionaria.findMany.mockResolvedValue([]);
      const result = await service.listar(TENANT);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(25);
      const where = prisma.envioListaConcessionaria.findMany.mock.calls[0][0].where;
      expect(where.cooperativaId).toBe(TENANT);
    });

    it('SUPER_ADMIN (cooperativaId=null): não filtra por tenant', async () => {
      const { service, prisma } = makeService();
      prisma.envioListaConcessionaria.count.mockResolvedValue(0);
      prisma.envioListaConcessionaria.findMany.mockResolvedValue([]);
      await service.listar(null);
      const where = prisma.envioListaConcessionaria.findMany.mock.calls[0][0].where;
      expect(where.cooperativaId).toBeUndefined();
    });

    it('aceita filtro status array (notIn equivalente IN)', async () => {
      const { service, prisma } = makeService();
      prisma.envioListaConcessionaria.count.mockResolvedValue(0);
      prisma.envioListaConcessionaria.findMany.mockResolvedValue([]);
      await service.listar(TENANT, { status: ['RASCUNHO', 'VALIDADA'] as Any });
      const where = prisma.envioListaConcessionaria.findMany.mock.calls[0][0].where;
      expect(where.status).toEqual({ in: ['RASCUNHO', 'VALIDADA'] });
    });

    it('pageSize: max 100 (não permite override > 100)', async () => {
      const { service, prisma } = makeService();
      prisma.envioListaConcessionaria.count.mockResolvedValue(0);
      prisma.envioListaConcessionaria.findMany.mockResolvedValue([]);
      const result = await service.listar(TENANT, {}, { pageSize: 999 });
      expect(result.pageSize).toBe(100);
    });

    it('counts agregados por status individual nos registros retornados', async () => {
      const { service, prisma } = makeService();
      prisma.envioListaConcessionaria.count.mockResolvedValue(1);
      prisma.envioListaConcessionaria.findMany.mockResolvedValue([
        {
          id: ENVIO_ID,
          numeroInterno: 'L-1',
          status: 'HOMOLOGADO_PARCIAL',
          usina: { id: USINA_ID, nome: 'U', apelidoInterno: 'u' },
          geradaEm: new Date(),
          validadaEm: null,
          enviadaEm: null,
          canalEnvio: null,
          protocoloEm: null,
          numeroProtocoloConcessionaria: null,
          liberadaEm: null,
          cooperados: [
            { statusIndividual: 'HOMOLOGADO' },
            { statusIndividual: 'PENDENTE' },
            { statusIndividual: 'REJEITADO' },
          ],
        },
      ]);
      const result = await service.listar(TENANT);
      expect(result.registros[0].counts).toEqual({
        homologado: 1,
        pendente: 1,
        rejeitado: 1,
        total: 3,
      });
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 11. obterDetalhe
  // ─────────────────────────────────────────────────────────────────────────

  describe('obterDetalhe', () => {
    it('happy path retorna envio com relações', async () => {
      const { service, prisma } = makeService();
      prisma.envioListaConcessionaria.findUnique.mockResolvedValue({
        id: ENVIO_ID,
        cooperativaId: TENANT,
        status: 'PROTOCOLADA',
      });
      const result = await service.obterDetalhe(ENVIO_ID, TENANT);
      expect(result.id).toBe(ENVIO_ID);
    });

    it('lança NotFound quando envio não existe', async () => {
      const { service, prisma } = makeService();
      prisma.envioListaConcessionaria.findUnique.mockResolvedValue(null);
      await expect(service.obterDetalhe(ENVIO_ID, TENANT)).rejects.toThrow(NotFoundException);
    });

    it('lança Forbidden em envio de outro tenant', async () => {
      const { service, prisma } = makeService();
      prisma.envioListaConcessionaria.findUnique.mockResolvedValue({
        id: ENVIO_ID,
        cooperativaId: OTHER_TENANT,
        status: 'PROTOCOLADA',
      });
      await expect(service.obterDetalhe(ENVIO_ID, TENANT)).rejects.toThrow(ForbiddenException);
    });
  });
});
