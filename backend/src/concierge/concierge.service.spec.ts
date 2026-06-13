import { ConciergeService } from './concierge.service';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { EdpEsFaturaAdapter } from './fatura-canonica/edp-es.adapter';
import { DetectoresRegistry } from './detectores/detectores.registry';
import { DetectorTema69Stricto } from './detectores/detector-tema69-stricto';
import { DetectorTese3PisCofinsSobreScee } from './detectores/detector-tese3-pis-sobre-scee';
import { DetectorTese2IcmsTusdGeracao } from './detectores/detector-tese2-icms-tusd-g';
import { DetectorTese6IcmsTusdTeSobreScee } from './detectores/detector-tese6-icms-scee';

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

  describe('previewDiagnostico - integracao real Tese 6 (EXFISHES ABR/2026)', () => {
    it('Tese 6 + Tese 3 aparecem no resultado consumido pelo controller', () => {
      const adapterRegistryReal = {
        obterAdapter: (d: string) => (d === 'EDP_ES' ? new EdpEsFaturaAdapter() : null),
      };
      const detectoresRegistryReal = new DetectoresRegistry(
        new DetectorTema69Stricto(),
        new DetectorTese3PisCofinsSobreScee(),
        new DetectorTese2IcmsTusdGeracao(),
        new DetectorTese6IcmsTusdTeSobreScee(),
      );
      const prismaMock: any = {
        cooperativa: { findUnique: jest.fn(), update: jest.fn(), findMany: jest.fn() },
        cooperado: { findMany: jest.fn() },
      };
      const service = new ConciergeService(prismaMock, adapterRegistryReal as any, detectoresRegistryReal);

      const r = service.previewDiagnostico(
        {
          metadados: {
            mesReferencia: '2026-04',
            classificacao: 'B - B3-COMERCIAL',
            valorTotalFatura: 32486.37,
            basePisCofinsDeclarada: 61151.94,
            aliquotaPisDeclarada: 0.0094,
            aliquotaCofinsDeclarada: 0.0432,
          },
          rubricas: [
            { descricao: 'TUSD - Energia Ativa Fornecida', valorTotalReais: 43743.61, baseCalculoIcms: 43743.61, aliquotaIcms: 0.17, valorIcms: 7436.41, valorPisCofins: 1909.76 },
            { descricao: 'TUSD - En. At. Inj. oUC oPT GDIII 03/2026', valorTotalReais: -17917.63, baseCalculoIcms: 0, aliquotaIcms: 0, valorIcms: 0, valorPisCofins: 0 },
            { descricao: 'TE - Energia Ativa Fornecida', valorTotalReais: 29933.42, baseCalculoIcms: 29933.42, aliquotaIcms: 0.17, valorIcms: 5088.68, valorPisCofins: 1306.83 },
            { descricao: 'TE - En. At. Inj. oUC oPT GDIII 03/2026', valorTotalReais: -23309.59, baseCalculoIcms: 0, aliquotaIcms: 0, valorIcms: 0, valorPisCofins: 0 },
          ],
        },
        'EDP_ES',
      );

      expect(r.erro).toBeUndefined();
      expect(r.resultado).not.toBeNull();
      const codigos = r.resultado!.padroes.map((p) => p.codigo);
      // Tese 6 (catalogada 12/06/2026) e Tese 3 devem aparecer
      expect(codigos).toContain('TESE_6_ICMS_TUSD_TE_SOBRE_SCEE');
      expect(codigos).toContain('TESE_3_PIS_COFINS_SOBRE_SCEE');
      // Tese 6 e a maior (ordenado desc por valorIndebitoMensal)
      expect(r.resultado!.padroes[0].codigo).toBe('TESE_6_ICMS_TUSD_TE_SOBRE_SCEE');
      expect(r.resultado!.padroes[0].valorIndebitoMensal).toBeGreaterThan(6500);
      // Combinado >= R$ 8.000/mes
      expect(r.resultado!.indebitoMensalTotal).toBeGreaterThan(8000);
    });
  });
});
