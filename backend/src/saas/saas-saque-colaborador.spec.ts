/**
 * Sprint D2 (16/06/2026) — Saque PIX Colaborador Comum.
 *
 * Specs do toggle SUPER_ADMIN-only no SaasService:
 *  - getSaqueColaboradorStatus
 *  - toggleSaqueColaborador (idempotente)
 */
import { NotFoundException } from '@nestjs/common';
import { SaasService } from './saas.service';

describe('SaasService — Saque PIX Colaborador (D2)', () => {
  const cooperativaFindUnique = jest.fn();
  const cooperativaUpdate = jest.fn();

  const prismaMock = {
    cooperativa: {
      findUnique: cooperativaFindUnique,
      update: cooperativaUpdate,
    },
  } as any;

  let service: SaasService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new SaasService(prismaMock);
  });

  const ENV_BACKUP = { ...process.env };
  afterEach(() => {
    process.env = { ...ENV_BACKUP };
  });

  // ───────────────────────── getSaqueColaboradorStatus ─────────────────────────

  describe('getSaqueColaboradorStatus', () => {
    it('cooperativa inexistente → NotFoundException', async () => {
      cooperativaFindUnique.mockResolvedValue(null);
      await expect(service.getSaqueColaboradorStatus('inexistente')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('dev (ambiente NÃO-real) → envProducaoLiberado=true + gate efetivo segue flag', async () => {
      delete process.env.AMBIENTE_REAL;
      cooperativaFindUnique.mockResolvedValue({
        id: 'coop-1',
        nome: 'CoopereBR',
        saqueColaboradorAtivo: true,
        saqueColaboradorAtivadoEm: new Date('2026-06-16T10:00:00Z'),
      });
      const r = await service.getSaqueColaboradorStatus('coop-1');
      expect(r.saqueColaboradorAtivo).toBe(true);
      expect(r.ambienteReal).toBe(false);
      expect(r.envProducaoLiberado).toBe(true);
      expect(r.gateProducaoEfetivo).toBe(true);
    });

    it('produção real + env OFF + flag ON → gateProducaoEfetivo=false (anti-disparo)', async () => {
      process.env.AMBIENTE_REAL = 'true';
      process.env.SAQUE_COLABORADOR_PRODUCAO_LIBERADO = 'false';
      cooperativaFindUnique.mockResolvedValue({
        id: 'coop-1',
        nome: 'CoopereBR',
        saqueColaboradorAtivo: true,
        saqueColaboradorAtivadoEm: new Date(),
      });
      const r = await service.getSaqueColaboradorStatus('coop-1');
      expect(r.ambienteReal).toBe(true);
      expect(r.envProducaoLiberado).toBe(false);
      expect(r.saqueColaboradorAtivo).toBe(true);
      expect(r.gateProducaoEfetivo).toBe(false);
    });

    it('produção real + env ON + flag ON → gateProducaoEfetivo=true', async () => {
      process.env.AMBIENTE_REAL = 'true';
      process.env.SAQUE_COLABORADOR_PRODUCAO_LIBERADO = 'true';
      cooperativaFindUnique.mockResolvedValue({
        id: 'coop-1',
        nome: 'CoopereBR',
        saqueColaboradorAtivo: true,
        saqueColaboradorAtivadoEm: new Date(),
      });
      const r = await service.getSaqueColaboradorStatus('coop-1');
      expect(r.gateProducaoEfetivo).toBe(true);
    });

    it('flag OFF + env qualquer → gateProducaoEfetivo=false', async () => {
      process.env.AMBIENTE_REAL = 'true';
      process.env.SAQUE_COLABORADOR_PRODUCAO_LIBERADO = 'true';
      cooperativaFindUnique.mockResolvedValue({
        id: 'coop-1',
        nome: 'CoopereBR',
        saqueColaboradorAtivo: false,
        saqueColaboradorAtivadoEm: null,
      });
      const r = await service.getSaqueColaboradorStatus('coop-1');
      expect(r.saqueColaboradorAtivo).toBe(false);
      expect(r.gateProducaoEfetivo).toBe(false);
    });
  });

  // ───────────────────────── toggleSaqueColaborador ─────────────────────────

  describe('toggleSaqueColaborador', () => {
    it('cooperativa inexistente → NotFoundException', async () => {
      cooperativaFindUnique.mockResolvedValue(null);
      await expect(service.toggleSaqueColaborador('x', true)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(cooperativaUpdate).not.toHaveBeenCalled();
    });

    it('liga (de OFF pra ON) → update + saqueColaboradorAtivadoEm setado', async () => {
      cooperativaFindUnique.mockResolvedValue({
        id: 'coop-1',
        saqueColaboradorAtivo: false,
        saqueColaboradorAtivadoEm: null,
      });
      cooperativaUpdate.mockResolvedValue({
        id: 'coop-1',
        saqueColaboradorAtivo: true,
        saqueColaboradorAtivadoEm: new Date('2026-06-16T12:00:00Z'),
      });
      const r = await service.toggleSaqueColaborador('coop-1', true);
      expect(r.alterado).toBe(true);
      expect(r.saqueColaboradorAtivo).toBe(true);
      expect(cooperativaUpdate).toHaveBeenCalledTimes(1);
      const callArgs = cooperativaUpdate.mock.calls[0][0];
      expect(callArgs.where.id).toBe('coop-1');
      expect(callArgs.data.saqueColaboradorAtivo).toBe(true);
      expect(callArgs.data.saqueColaboradorAtivadoEm).toBeInstanceOf(Date);
    });

    it('desliga (de ON pra OFF) → update + saqueColaboradorAtivadoEm=null', async () => {
      cooperativaFindUnique.mockResolvedValue({
        id: 'coop-1',
        saqueColaboradorAtivo: true,
        saqueColaboradorAtivadoEm: new Date(),
      });
      cooperativaUpdate.mockResolvedValue({
        id: 'coop-1',
        saqueColaboradorAtivo: false,
        saqueColaboradorAtivadoEm: null,
      });
      const r = await service.toggleSaqueColaborador('coop-1', false);
      expect(r.alterado).toBe(true);
      expect(r.saqueColaboradorAtivo).toBe(false);
      const callArgs = cooperativaUpdate.mock.calls[0][0];
      expect(callArgs.data.saqueColaboradorAtivadoEm).toBeNull();
    });

    it('idempotente: chamar com o mesmo valor já setado → no-op (alterado=false, sem update)', async () => {
      cooperativaFindUnique.mockResolvedValue({
        id: 'coop-1',
        saqueColaboradorAtivo: true,
        saqueColaboradorAtivadoEm: new Date(),
      });
      const r = await service.toggleSaqueColaborador('coop-1', true);
      expect(r.alterado).toBe(false);
      expect(r.saqueColaboradorAtivo).toBe(true);
      expect(cooperativaUpdate).not.toHaveBeenCalled();
    });
  });
});
