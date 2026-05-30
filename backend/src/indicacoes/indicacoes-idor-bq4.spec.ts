import { NotFoundException, BadRequestException } from '@nestjs/common';
import { IndicacoesService } from './indicacoes.service';

/**
 * D-novo-BQ.4 M2 + M3 (30/05/2026).
 * M2 — registrarIndicacao filtra indicador + indicado por cooperativaId do JWT.
 * M3 — processarPrimeiraFaturaPaga filtra indicações pelo cooperativaId do JWT
 *      (registros de outro tenant não retornam → não cria benefícios/tokens cross-tenant).
 */
describe('IndicacoesService — BQ.4 M2 + M3 IDOR isolamento', () => {
  const coopFindFirst = jest.fn();
  const coopFindUnique = jest.fn();
  const coopUpdate = jest.fn();
  const indFindMany = jest.fn();
  const indFindFirst = jest.fn();
  const indCreate = jest.fn();
  const indUpdate = jest.fn();
  const configFindUnique = jest.fn();

  const prismaMock = {
    cooperado: {
      findFirst: coopFindFirst,
      findUnique: coopFindUnique,
      update: coopUpdate,
    },
    indicacao: {
      findMany: indFindMany,
      findFirst: indFindFirst,
      create: indCreate,
      update: indUpdate,
    },
    configIndicacao: { findUnique: configFindUnique },
    beneficioIndicacao: { create: jest.fn() },
    cooperTokenLedger: { findFirst: jest.fn().mockResolvedValue(null) },
    contrato: { findFirst: jest.fn().mockResolvedValue(null) },
  } as any;

  let service: IndicacoesService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new IndicacoesService(
      prismaMock,
      {} as any, {} as any, {} as any,
      { creditar: jest.fn() } as any,
    );
  });

  // ============ M2 — registrarIndicacao ============
  describe('registrarIndicacao (M2)', () => {
    it('JWT tenant A + código de indicador tenant B → NotFoundException (código inválido pra A)', async () => {
      coopFindFirst.mockResolvedValueOnce(null); // indicador não pertence ao tenant A
      await expect(
        service.registrarIndicacao('coop-indicado-A', 'CODIGO-B', 'coop-A'),
      ).rejects.toThrow(NotFoundException);
      expect(coopFindFirst).toHaveBeenCalledWith({
        where: { codigoIndicacao: 'CODIGO-B', cooperativaId: 'coop-A' },
      });
      expect(coopUpdate).not.toHaveBeenCalled();
    });

    it('JWT tenant A + indicado tenant B → NotFoundException (indicado não pertence a A)', async () => {
      coopFindFirst
        .mockResolvedValueOnce({ id: 'ind-A', cooperativaId: 'coop-A' }) // indicador OK
        .mockResolvedValueOnce(null); // indicado não é A
      await expect(
        service.registrarIndicacao('coop-indicado-B', 'CODIGO-A', 'coop-A'),
      ).rejects.toThrow(NotFoundException);
      expect(coopUpdate).not.toHaveBeenCalled();
    });

    it('Defesa em profundidade — sem JWT (legacy), indicador e indicado de tenants diferentes → BadRequest', async () => {
      coopFindUnique
        .mockResolvedValueOnce({ id: 'ind-A', cooperativaId: 'coop-A' })
        .mockResolvedValueOnce({ id: 'ido-B', cooperativaId: 'coop-B' });
      indFindFirst.mockResolvedValueOnce(null); // sem indicação prévia
      await expect(
        service.registrarIndicacao('ido-B', 'CODIGO-A', null),
      ).rejects.toThrow(BadRequestException);
      expect(coopUpdate).not.toHaveBeenCalled();
    });
  });

  // ============ M3 — processarPrimeiraFaturaPaga ============
  describe('processarPrimeiraFaturaPaga (M3)', () => {
    it('JWT tenant A processando indicação tenant B → findMany filtra → 0 resultados → não cria benefício', async () => {
      indFindMany.mockResolvedValueOnce([]); // filtro por cooperativaId='coop-A' não retorna registros do tenant B
      const r = await service.processarPrimeiraFaturaPaga('coop-indicado-B', 100, 'coop-A');
      expect(r).toEqual([]);
      expect(indFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            cooperadoIndicadoId: 'coop-indicado-B',
            cooperativaId: 'coop-A',
          }),
        }),
      );
      expect(indUpdate).not.toHaveBeenCalled();
    });

    it('Caller interno (OnEvent) — null cooperativaIdJwt → não filtra, comportamento legacy preservado', async () => {
      indFindMany.mockResolvedValueOnce([]); // sem indicação pendente
      await service.processarPrimeiraFaturaPaga('coop-x', 100, null);
      expect(indFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.not.objectContaining({ cooperativaId: expect.anything() }),
        }),
      );
    });
  });
});
