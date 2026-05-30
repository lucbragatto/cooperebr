import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ConfiguracaoCobrancaController } from './configuracao-cobranca.controller';

/**
 * D-novo-BQ.2 C5 + C6 (30/05/2026) — controller bloqueia body-injection
 * de cooperativaId pra ADMIN; SUPER_ADMIN pode usar body.cooperativaId.
 * Em C6 também valida que usinaId da rota pertence ao tenant.
 */
describe('ConfiguracaoCobrancaController — BQ.2 body-injection + posse usina', () => {
  const upsertCooperativa = jest.fn();
  const upsertUsina = jest.fn();
  const usinaFindFirst = jest.fn();

  const serviceMock = {
    upsertCooperativa,
    upsertUsina,
  } as any;

  const prismaMock = {
    usina: { findFirst: usinaFindFirst },
  } as any;

  let controller: ConfiguracaoCobrancaController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new ConfiguracaoCobrancaController(serviceMock, prismaMock);
    upsertCooperativa.mockResolvedValue({ id: 'cfg1' });
    upsertUsina.mockResolvedValue({ id: 'cfg2' });
  });

  // ============ C5 — upsertCooperativa ============
  describe('upsertCooperativa (C5)', () => {
    it('ADMIN tenta body.cooperativaId=B → service recebe coop-A (JWT), body ignorado', async () => {
      const req = { user: { perfil: 'ADMIN', cooperativaId: 'coop-A' } };
      await controller.upsertCooperativa(
        { descontoPadrao: 0, descontoMin: 0, descontoMax: 50, cooperativaId: 'coop-B' } as any,
        req as any,
      );
      expect(upsertCooperativa).toHaveBeenCalledWith('coop-A', expect.any(Object));
    });

    it('ADMIN sem cooperativaId no JWT → ForbiddenException', () => {
      const req = { user: { perfil: 'ADMIN' } };
      expect(() =>
        controller.upsertCooperativa(
          { descontoPadrao: 0, descontoMin: 0, descontoMax: 50 } as any,
          req as any,
        ),
      ).toThrow(ForbiddenException);
      expect(upsertCooperativa).not.toHaveBeenCalled();
    });

    it('SUPER_ADMIN com body.cooperativaId=B → service recebe B (bypass)', async () => {
      const req = { user: { perfil: 'SUPER_ADMIN', cooperativaId: 'coop-SA' } };
      await controller.upsertCooperativa(
        { descontoPadrao: 0, descontoMin: 0, descontoMax: 50, cooperativaId: 'coop-B' } as any,
        req as any,
      );
      expect(upsertCooperativa).toHaveBeenCalledWith('coop-B', expect.any(Object));
    });

    it('SUPER_ADMIN sem body.cooperativaId → cai no próprio JWT', async () => {
      const req = { user: { perfil: 'SUPER_ADMIN', cooperativaId: 'coop-SA' } };
      await controller.upsertCooperativa(
        { descontoPadrao: 0, descontoMin: 0, descontoMax: 50 } as any,
        req as any,
      );
      expect(upsertCooperativa).toHaveBeenCalledWith('coop-SA', expect.any(Object));
    });

    it('SUPER_ADMIN sem cooperativaId no JWT nem body → BadRequestException', () => {
      const req = { user: { perfil: 'SUPER_ADMIN' } };
      expect(() =>
        controller.upsertCooperativa(
          { descontoPadrao: 0, descontoMin: 0, descontoMax: 50 } as any,
          req as any,
        ),
      ).toThrow(BadRequestException);
    });
  });

  // ============ C6 — upsertUsina ============
  describe('upsertUsina (C6)', () => {
    it('ADMIN tenta body.cooperativaId=B + usinaId=B → ForbiddenException (usina não é do tenant A)', async () => {
      usinaFindFirst.mockResolvedValueOnce(null); // usina-do-B não é do coop-A
      const req = { user: { perfil: 'ADMIN', cooperativaId: 'coop-A' } };
      await expect(
        controller.upsertUsina(
          'usina-do-B',
          { descontoPadrao: 0, descontoMin: 0, descontoMax: 50, cooperativaId: 'coop-B' } as any,
          req as any,
        ),
      ).rejects.toThrow(ForbiddenException);
      expect(usinaFindFirst).toHaveBeenCalledWith({
        where: { id: 'usina-do-B', cooperativaId: 'coop-A' },
        select: { id: true },
      });
      expect(upsertUsina).not.toHaveBeenCalled();
    });

    it('ADMIN usinaId do próprio tenant → sucesso', async () => {
      usinaFindFirst.mockResolvedValueOnce({ id: 'usina-A' });
      const req = { user: { perfil: 'ADMIN', cooperativaId: 'coop-A' } };
      const r = await controller.upsertUsina(
        'usina-A',
        { descontoPadrao: 0, descontoMin: 0, descontoMax: 50 } as any,
        req as any,
      );
      expect(r.id).toBe('cfg2');
      expect(upsertUsina).toHaveBeenCalledWith('usina-A', 'coop-A', expect.any(Object));
    });

    it('SUPER_ADMIN com body.cooperativaId=B e usina realmente do B → sucesso', async () => {
      usinaFindFirst.mockResolvedValueOnce({ id: 'usina-B' });
      const req = { user: { perfil: 'SUPER_ADMIN', cooperativaId: 'coop-SA' } };
      const r = await controller.upsertUsina(
        'usina-B',
        { descontoPadrao: 0, descontoMin: 0, descontoMax: 50, cooperativaId: 'coop-B' } as any,
        req as any,
      );
      expect(r.id).toBe('cfg2');
      expect(usinaFindFirst).toHaveBeenCalledWith({
        where: { id: 'usina-B', cooperativaId: 'coop-B' },
        select: { id: true },
      });
      expect(upsertUsina).toHaveBeenCalledWith('usina-B', 'coop-B', expect.any(Object));
    });
  });
});
