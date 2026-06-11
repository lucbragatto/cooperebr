import { ConciergeService } from './concierge.service';
import { ForbiddenException, NotFoundException } from '@nestjs/common';

describe('ConciergeService', () => {
  function buildService(prismaOverrides: any = {}) {
    const prisma: any = {
      cooperativa: {
        findUnique: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
      },
      cooperado: { findMany: jest.fn() },
      ...prismaOverrides,
    };
    const adapterRegistry: any = { obterAdapter: jest.fn() };
    const detectoresRegistry: any = { detectarTodos: jest.fn() };
    return {
      service: new ConciergeService(prisma, adapterRegistry, detectoresRegistry),
      prisma,
      adapterRegistry,
      detectoresRegistry,
    };
  }

  describe('verificarModuloAtivo', () => {
    it('SUPER_ADMIN bypassa o gate e sempre retorna true', async () => {
      const { service, prisma } = buildService();
      const r = await service.verificarModuloAtivo('coop-1', true);
      expect(r).toBe(true);
      expect(prisma.cooperativa.findUnique).not.toHaveBeenCalled();
    });

    it('retorna true quando moduloConciergeAtivo=true', async () => {
      const { service, prisma } = buildService();
      prisma.cooperativa.findUnique.mockResolvedValue({ moduloConciergeAtivo: true });
      expect(await service.verificarModuloAtivo('coop-1')).toBe(true);
    });

    it('retorna false quando moduloConciergeAtivo=false', async () => {
      const { service, prisma } = buildService();
      prisma.cooperativa.findUnique.mockResolvedValue({ moduloConciergeAtivo: false });
      expect(await service.verificarModuloAtivo('coop-1')).toBe(false);
    });

    it('retorna false quando cooperativa nao encontrada', async () => {
      const { service, prisma } = buildService();
      prisma.cooperativa.findUnique.mockResolvedValue(null);
      expect(await service.verificarModuloAtivo('coop-inexistente')).toBe(false);
    });
  });

  describe('assertModuloAtivoOrThrow', () => {
    it('nao throw quando modulo ativo', async () => {
      const { service, prisma } = buildService();
      prisma.cooperativa.findUnique.mockResolvedValue({ moduloConciergeAtivo: true });
      await expect(service.assertModuloAtivoOrThrow('coop-1')).resolves.toBeUndefined();
    });

    it('throw ForbiddenException quando modulo inativo', async () => {
      const { service, prisma } = buildService();
      prisma.cooperativa.findUnique.mockResolvedValue({ moduloConciergeAtivo: false });
      await expect(service.assertModuloAtivoOrThrow('coop-1')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('alterarStatusModulo', () => {
    it('ativar seta moduloConciergeAtivo=true e conciergeAtivadoEm=now', async () => {
      const { service, prisma } = buildService();
      prisma.cooperativa.findUnique.mockResolvedValue({
        id: 'coop-1',
        moduloConciergeAtivo: false,
        conciergeAtivadoEm: null,
      });
      prisma.cooperativa.update.mockResolvedValue({
        id: 'coop-1',
        moduloConciergeAtivo: true,
        conciergeAtivadoEm: new Date(),
      });
      const r = await service.alterarStatusModulo('coop-1', true);
      expect(r.moduloConciergeAtivo).toBe(true);
      expect(prisma.cooperativa.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'coop-1' },
          data: expect.objectContaining({ moduloConciergeAtivo: true }),
        }),
      );
    });

    it('idempotente quando ja esta no estado desejado', async () => {
      const { service, prisma } = buildService();
      prisma.cooperativa.findUnique.mockResolvedValue({
        id: 'coop-1',
        moduloConciergeAtivo: true,
        conciergeAtivadoEm: new Date(),
      });
      await service.alterarStatusModulo('coop-1', true);
      expect(prisma.cooperativa.update).not.toHaveBeenCalled();
    });

    it('throw NotFoundException se cooperativa nao existe', async () => {
      const { service, prisma } = buildService();
      prisma.cooperativa.findUnique.mockResolvedValue(null);
      await expect(service.alterarStatusModulo('coop-x', true)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('previewDiagnostico', () => {
    it('retorna erro quando adapter desconhecido', () => {
      const { service, adapterRegistry } = buildService();
      adapterRegistry.obterAdapter.mockReturnValue(null);
      const r = service.previewDiagnostico(
        { rubricas: [], metadados: {} },
        'CEMIG',
      );
      expect(r.erro).toContain('Adapter nao encontrado');
      expect(r.fatura).toBeNull();
    });

    it('retorna erro quando adapter falha (RUBRICA_DESCONHECIDA)', () => {
      const { service, adapterRegistry } = buildService();
      adapterRegistry.obterAdapter.mockReturnValue({
        parsear: jest.fn().mockReturnValue({
          sucesso: false,
          motivo: 'RUBRICA_DESCONHECIDA',
          detalhe: 'XYZ',
        }),
      });
      const r = service.previewDiagnostico(
        { rubricas: [{ descricao: 'XYZ' }], metadados: {} },
        'EDP_ES',
      );
      expect(r.erro).toContain('RUBRICA_DESCONHECIDA');
    });

    it('roda detectores quando adapter parseia com sucesso', () => {
      const { service, adapterRegistry, detectoresRegistry } = buildService();
      adapterRegistry.obterAdapter.mockReturnValue({
        parsear: jest.fn().mockReturnValue({
          sucesso: true,
          fatura: { distribuidora: 'EDP_ES' },
        }),
      });
      detectoresRegistry.detectarTodos.mockReturnValue({
        padroes: [],
        indebitoMensalTotal: 0,
        indebito60mSelicTotal: 0,
      });
      const r = service.previewDiagnostico(
        { rubricas: [{ descricao: 'TUSD' }], metadados: {} },
        'EDP_ES',
      );
      expect(r.resultado).not.toBeNull();
      expect(r.erro).toBeUndefined();
      expect(detectoresRegistry.detectarTodos).toHaveBeenCalled();
    });
  });
});
