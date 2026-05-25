import { BadRequestException } from '@nestjs/common';
import { GatewaysPagamentoConfigController } from './gateways-pagamento-config.controller';
import { PerfilUsuario } from '../auth/perfil.enum';

describe('GatewaysPagamentoConfigController', () => {
  let controller: GatewaysPagamentoConfigController;
  let serviceMock: any;

  const adminReq = (cooperativaId = 'coop-A') => ({
    user: { userId: 'u-admin', perfil: PerfilUsuario.ADMIN, cooperativaId },
  });

  const superAdminReq = () => ({
    user: { userId: 'u-super', perfil: PerfilUsuario.SUPER_ADMIN },
  });

  beforeEach(() => {
    serviceMock = {
      listarTiposSuportados: jest.fn(),
      listar: jest.fn(),
      buscarPorId: jest.fn(),
      buscarAtivoPorTipo: jest.fn(),
      criar: jest.fn(),
      atualizar: jest.fn(),
      remover: jest.fn(),
      testarConexao: jest.fn(),
    };
    controller = new GatewaysPagamentoConfigController(serviceMock);
  });

  describe('GET /suportados', () => {
    it('retorna lista pelo service', async () => {
      serviceMock.listarTiposSuportados.mockReturnValue([{ tipo: 'ASAAS' }, { tipo: 'BANESTES' }]);
      const r = await controller.listarSuportados();
      expect(r).toHaveLength(2);
      expect(serviceMock.listarTiposSuportados).toHaveBeenCalledTimes(1);
    });
  });

  describe('GET /', () => {
    it('ADMIN: usa cooperativaId do JWT', async () => {
      serviceMock.listar.mockResolvedValue([]);
      await controller.listar(adminReq('coop-A') as any);
      expect(serviceMock.listar).toHaveBeenCalledWith('coop-A');
    });

    it('ADMIN: rejeita query cooperativaId divergente do JWT', async () => {
      await expect(
        controller.listar(adminReq('coop-A') as any, 'coop-B'),
      ).rejects.toThrow(BadRequestException);
    });

    it('SUPER_ADMIN: usa cooperativaId da query', async () => {
      serviceMock.listar.mockResolvedValue([]);
      await controller.listar(superAdminReq() as any, 'coop-target');
      expect(serviceMock.listar).toHaveBeenCalledWith('coop-target');
    });

    it('SUPER_ADMIN sem query: throw', async () => {
      await expect(controller.listar(superAdminReq() as any)).rejects.toThrow(BadRequestException);
    });
  });

  describe('GET /me/ativo', () => {
    it('exige query param "tipo"', async () => {
      await expect(
        controller.buscarAtivoPorTipo(adminReq() as any, '' as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('delega pro service com cooperativaId do JWT', async () => {
      serviceMock.buscarAtivoPorTipo.mockResolvedValue(null);
      await controller.buscarAtivoPorTipo(adminReq('coop-A') as any, 'ASAAS');
      expect(serviceMock.buscarAtivoPorTipo).toHaveBeenCalledWith('coop-A', 'ASAAS');
    });
  });

  describe('GET /:id', () => {
    it('ADMIN: delega buscarPorId com cooperativaId do JWT', async () => {
      serviceMock.buscarPorId.mockResolvedValue({ id: 'g1' });
      await controller.buscar('g1', adminReq('coop-A') as any);
      expect(serviceMock.buscarPorId).toHaveBeenCalledWith('g1', 'coop-A');
    });

    it('SUPER_ADMIN: via query cooperativaId', async () => {
      serviceMock.buscarPorId.mockResolvedValue({ id: 'g1' });
      await controller.buscar('g1', superAdminReq() as any, 'coop-target');
      expect(serviceMock.buscarPorId).toHaveBeenCalledWith('g1', 'coop-target');
    });
  });

  describe('POST /', () => {
    const dtoValido: any = {
      tipo: 'ASAAS',
      ambiente: 'SANDBOX',
      credenciais: { apiKey: 'long-asaas-key-1234567890' },
    };

    it('ADMIN: encaminha cooperativaId do JWT, ehSuperAdmin=false', async () => {
      serviceMock.criar.mockResolvedValue({ id: 'g1' });
      await controller.criar(dtoValido, adminReq('coop-A') as any);
      expect(serviceMock.criar).toHaveBeenCalledWith(dtoValido, 'coop-A', false);
    });

    it('SUPER_ADMIN: encaminha undefined no JWT coop + ehSuperAdmin=true', async () => {
      serviceMock.criar.mockResolvedValue({ id: 'g1' });
      await controller.criar({ ...dtoValido, cooperativaId: 'coop-X' }, superAdminReq() as any);
      expect(serviceMock.criar).toHaveBeenCalledWith(
        { ...dtoValido, cooperativaId: 'coop-X' },
        undefined,
        true,
      );
    });
  });

  describe('PATCH /:id', () => {
    it('ADMIN: usa cooperativaId do JWT', async () => {
      serviceMock.atualizar.mockResolvedValue({ id: 'g1' });
      await controller.atualizar('g1', { ativo: false }, adminReq('coop-A') as any);
      expect(serviceMock.atualizar).toHaveBeenCalledWith('g1', { ativo: false }, 'coop-A');
    });

    it('SUPER_ADMIN: usa cooperativaId da query', async () => {
      serviceMock.atualizar.mockResolvedValue({ id: 'g1' });
      await controller.atualizar(
        'g1',
        { ativo: false },
        superAdminReq() as any,
        'coop-target',
      );
      expect(serviceMock.atualizar).toHaveBeenCalledWith('g1', { ativo: false }, 'coop-target');
    });
  });

  describe('DELETE /:id', () => {
    it('ADMIN: usa cooperativaId do JWT', async () => {
      serviceMock.remover.mockResolvedValue({ removido: true });
      await controller.remover('g1', adminReq('coop-A') as any);
      expect(serviceMock.remover).toHaveBeenCalledWith('g1', 'coop-A');
    });
  });

  describe('POST /:id/testar', () => {
    it('ADMIN: usa cooperativaId do JWT', async () => {
      serviceMock.testarConexao.mockResolvedValue({ ok: true });
      const r = await controller.testar('g1', adminReq('coop-A') as any);
      expect(serviceMock.testarConexao).toHaveBeenCalledWith('g1', 'coop-A');
      expect(r.ok).toBe(true);
    });

    it('SUPER_ADMIN sem query: throw', async () => {
      await expect(
        controller.testar('g1', superAdminReq() as any),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('resolverTenantQuery() — defesa multi-tenant', () => {
    it('ADMIN sem cooperativaId no JWT: throw', async () => {
      const reqSemCoop = { user: { perfil: PerfilUsuario.ADMIN } };
      await expect(controller.listar(reqSemCoop as any)).rejects.toThrow(BadRequestException);
    });

    it('SUPER_ADMIN sem cooperativaId no body/query: throw', async () => {
      await expect(controller.listar(superAdminReq() as any)).rejects.toThrow(BadRequestException);
    });
  });
});
