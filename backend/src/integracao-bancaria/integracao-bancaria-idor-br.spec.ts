import { NotFoundException, BadRequestException } from '@nestjs/common';
import { IntegracaoBancariaService } from './integracao-bancaria.service';

/**
 * D-novo-BR F0.5 CRITICOS (31/05/2026):
 * - cancelarCobranca: posse antes de chamar API banco (BB/Sicoob irreversível)
 * - criarConfig: body-injection bloqueado (cooperativaId do JWT)
 * - atualizarConfig: posse antes do update
 *
 * NOTA: nenhuma chamada externa real (BB/Sicoob mockados).
 */
describe('IntegracaoBancariaService — F0.5 CRITICOS', () => {
  const cobFindFirst = jest.fn();
  const cobFindUnique = jest.fn();
  const cobUpdate = jest.fn();
  const cfgCreate = jest.fn();
  const cfgFindFirst = jest.fn();
  const cfgUpdate = jest.fn();
  const cfgFindMany = jest.fn();
  const bbCancelar = jest.fn();
  const sicoobCancelar = jest.fn();

  const prismaMock = {
    cobrancaBancaria: { findFirst: cobFindFirst, findUnique: cobFindUnique, update: cobUpdate },
    configuracaoBancaria: { create: cfgCreate, findFirst: cfgFindFirst, update: cfgUpdate, findMany: cfgFindMany },
  } as any;

  const bbMock = { cancelarBoleto: bbCancelar } as any;
  const sicoobMock = { cancelarBoleto: sicoobCancelar } as any;
  const cobrancasMock = {} as any;

  let service: IntegracaoBancariaService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new IntegracaoBancariaService(prismaMock, bbMock, sicoobMock, cobrancasMock);
    cobUpdate.mockResolvedValue({ id: 'c1' });
    cfgCreate.mockResolvedValue({ id: 'cfg1' });
    cfgUpdate.mockResolvedValue({ id: 'cfg1' });
  });

  describe('cancelarCobranca (CRITICO boleto)', () => {
    it('ADMIN tenant B tentando cancelar cobrança tenant A → NotFound ANTES da API banco', async () => {
      cobFindFirst.mockResolvedValueOnce(null);
      await expect(service.cancelarCobranca('c1', 'coop-B')).rejects.toThrow(NotFoundException);
      expect(bbCancelar).not.toHaveBeenCalled();
      expect(sicoobCancelar).not.toHaveBeenCalled();
      expect(cobUpdate).not.toHaveBeenCalled();
    });

    it('ADMIN tenant A cancelando própria PENDENTE → sucesso (sem call API banco)', async () => {
      cobFindFirst.mockResolvedValueOnce({
        id: 'c1', status: 'PENDENTE', tipo: 'BOLETO', configuracao: { banco: 'BB' },
      });
      await service.cancelarCobranca('c1', 'coop-A');
      expect(cobUpdate).toHaveBeenCalled();
      // API banco só chamada se status REGISTRADO
      expect(bbCancelar).not.toHaveBeenCalled();
    });

    it('SUPER_ADMIN (null) → bypass via findUnique', async () => {
      cobFindUnique.mockResolvedValueOnce({
        id: 'c1', status: 'PENDENTE', tipo: 'BOLETO', configuracao: { banco: 'BB' },
      });
      await service.cancelarCobranca('c1', null);
      expect(cobFindFirst).not.toHaveBeenCalled();
      expect(cobUpdate).toHaveBeenCalled();
    });
  });

  describe('criarConfig (CRITICO body-injection)', () => {
    it('cooperativaId vem como parâmetro obrigatório do controller (sempre injetado)', async () => {
      await service.criarConfig({
        banco: 'BB', clientId: 'x', clientSecret: 'y',
      }, 'coop-A');
      expect(cfgCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({ banco: 'BB', cooperativaId: 'coop-A' }),
      });
    });
  });

  describe('atualizarConfig (CRITICO)', () => {
    it('ADMIN tenant B → NotFound', async () => {
      cfgFindFirst.mockResolvedValueOnce(null);
      await expect(service.atualizarConfig('cfg1', { clientId: 'x' }, 'coop-B')).rejects.toThrow(NotFoundException);
      expect(cfgUpdate).not.toHaveBeenCalled();
    });
    it('SUPER_ADMIN (null) → bypass', async () => {
      await service.atualizarConfig('cfg1', { clientId: 'x' }, null);
      expect(cfgFindFirst).not.toHaveBeenCalled();
      expect(cfgUpdate).toHaveBeenCalled();
    });
  });

  describe('listarConfigs', () => {
    it('ADMIN tenant A → findMany filtrado por cooperativaId', async () => {
      cfgFindMany.mockResolvedValueOnce([]);
      await service.listarConfigs('coop-A');
      expect(cfgFindMany).toHaveBeenCalledWith(expect.objectContaining({ where: { cooperativaId: 'coop-A' } }));
    });
    it('SUPER_ADMIN (null) → vê todas', async () => {
      cfgFindMany.mockResolvedValueOnce([]);
      await service.listarConfigs(null);
      expect(cfgFindMany).toHaveBeenCalledWith(expect.objectContaining({ where: undefined }));
    });
  });
});
