/**
 * Sprint Onboarding Bloco 0 Fatia 0.3 (06/06/2026) — specs CooperadoClubeService.
 *
 * Cobertura:
 *  - Multi-tenant: cooperado de outro tenant → 404
 *  - Cross-tenant em PlanoClube → 400
 *  - PlanoClube inativo → 400
 *  - INVARIANTE anti-cobrança-dupla: cooperado já em convênio com clube → 400
 *  - Aderir cooperado limpo → grava planoClubeId + adesaoClubeEm
 *  - Re-aderir (mesmo plano) → atualiza adesaoClubeEm
 *  - Cancelar → zera ambos
 *  - Cancelar 404 cross-tenant
 *  - resolverParaCobrancaIndividual: helper Fatia 0.4 (null/cobra=false/inativo)
 */
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CooperadoClubeService } from './cooperado-clube.service';

describe('CooperadoClubeService', () => {
  let service: CooperadoClubeService;
  let prismaMock: any;
  const TENANT_A = 'coop-a';

  beforeEach(() => {
    prismaMock = {
      cooperado: { findFirst: jest.fn(), update: jest.fn() },
      planoClube: { findFirst: jest.fn() },
      convenioCooperado: { findFirst: jest.fn() },
    };
    service = Object.create(CooperadoClubeService.prototype);
    (service as any).prisma = prismaMock;
    (service as any).logger = { log: jest.fn(), warn: jest.fn(), error: jest.fn() };
  });

  // ─── aderir ─────────────────────────────────────────────────────
  it('aderir — 404 cross-tenant (cooperado de outra coop)', async () => {
    prismaMock.cooperado.findFirst.mockResolvedValue(null);

    await expect(
      service.aderir({
        cooperadoId: 'coop-de-outra',
        planoClubeId: 'pln-1',
        adminCooperativaId: TENANT_A,
      }),
    ).rejects.toThrow(NotFoundException);
    expect(prismaMock.planoClube.findFirst).not.toHaveBeenCalled();
  });

  it('aderir — 400 quando planoClubeId não bate com tenant', async () => {
    prismaMock.cooperado.findFirst.mockResolvedValue({
      id: 'c1',
      cooperativaId: TENANT_A,
      nomeCompleto: 'Marina',
    });
    prismaMock.planoClube.findFirst.mockResolvedValue(null);

    await expect(
      service.aderir({
        cooperadoId: 'c1',
        planoClubeId: 'pln-de-outra',
        adminCooperativaId: TENANT_A,
      }),
    ).rejects.toThrow(/inválido ou pertence a outra cooperativa/);
  });

  it('aderir — 400 quando plano está INATIVO', async () => {
    prismaMock.cooperado.findFirst.mockResolvedValue({ id: 'c1', cooperativaId: TENANT_A });
    prismaMock.planoClube.findFirst.mockResolvedValue({
      id: 'pln-inat',
      nome: 'Inativo',
      ativo: false,
    });

    await expect(
      service.aderir({
        cooperadoId: 'c1',
        planoClubeId: 'pln-inat',
        adminCooperativaId: TENANT_A,
      }),
    ).rejects.toThrow(/inativo/);
  });

  it('INVARIANTE anti-cobrança-dupla: cooperado é membro ATIVO de convênio com clube → 400', async () => {
    prismaMock.cooperado.findFirst.mockResolvedValue({ id: 'c1', cooperativaId: TENANT_A });
    prismaMock.planoClube.findFirst.mockResolvedValue({ id: 'pln-1', ativo: true, nome: 'Ouro' });
    prismaMock.convenioCooperado.findFirst.mockResolvedValue({
      id: 'mem-1',
      convenio: { id: 'cv-1', empresaNome: 'Clínica Sigma', planoClubeId: 'pln-cv' },
    });

    await expect(
      service.aderir({
        cooperadoId: 'c1',
        planoClubeId: 'pln-1',
        adminCooperativaId: TENANT_A,
      }),
    ).rejects.toThrow(/cobrança dupla/);
    expect(prismaMock.cooperado.update).not.toHaveBeenCalled();
  });

  it('aderir — happy path: grava planoClubeId + adesaoClubeEm', async () => {
    prismaMock.cooperado.findFirst.mockResolvedValue({ id: 'c1', cooperativaId: TENANT_A });
    prismaMock.planoClube.findFirst.mockResolvedValue({ id: 'pln-1', ativo: true, nome: 'Ouro' });
    prismaMock.convenioCooperado.findFirst.mockResolvedValue(null); // sem conflito
    prismaMock.cooperado.update.mockResolvedValue({
      id: 'c1',
      nomeCompleto: 'Marina',
      planoClubeId: 'pln-1',
      adesaoClubeEm: new Date('2026-06-06T12:00:00Z'),
    });

    const r = await service.aderir({
      cooperadoId: 'c1',
      planoClubeId: 'pln-1',
      adminCooperativaId: TENANT_A,
    });

    expect(prismaMock.cooperado.update).toHaveBeenCalledWith({
      where: { id: 'c1' },
      data: { planoClubeId: 'pln-1', adesaoClubeEm: expect.any(Date) },
      select: expect.any(Object),
    });
    expect(r.planoClubeId).toBe('pln-1');
    expect(r.adesaoClubeEm).toBeInstanceOf(Date);
  });

  it('INVARIANTE: validador checa convênio ATIVO + planoClubeId != null (não bloqueia se convênio não tem clube)', async () => {
    prismaMock.cooperado.findFirst.mockResolvedValue({ id: 'c1', cooperativaId: TENANT_A });
    prismaMock.planoClube.findFirst.mockResolvedValue({ id: 'pln-1', ativo: true });
    prismaMock.convenioCooperado.findFirst.mockResolvedValue(null);
    prismaMock.cooperado.update.mockResolvedValue({ id: 'c1', planoClubeId: 'pln-1', adesaoClubeEm: new Date() });

    await service.aderir({
      cooperadoId: 'c1',
      planoClubeId: 'pln-1',
      adminCooperativaId: TENANT_A,
    });

    // Confirma que a query de conflito procura: convenio.planoClubeId NOT NULL + ativo=true
    expect(prismaMock.convenioCooperado.findFirst).toHaveBeenCalledWith({
      where: {
        cooperadoId: 'c1',
        ativo: true,
        convenio: { planoClubeId: { not: null } },
      },
      select: expect.any(Object),
    });
  });

  // ─── cancelar ─────────────────────────────────────────────────
  it('cancelar — zera planoClubeId e adesaoClubeEm', async () => {
    prismaMock.cooperado.findFirst.mockResolvedValue({
      id: 'c1',
      planoClubeId: 'pln-1',
      adesaoClubeEm: new Date(),
    });
    prismaMock.cooperado.update.mockResolvedValue({
      id: 'c1',
      nomeCompleto: 'Marina',
      planoClubeId: null,
      adesaoClubeEm: null,
    });

    const r = await service.cancelar({ cooperadoId: 'c1', adminCooperativaId: TENANT_A });

    expect(prismaMock.cooperado.update).toHaveBeenCalledWith({
      where: { id: 'c1' },
      data: { planoClubeId: null, adesaoClubeEm: null },
      select: expect.any(Object),
    });
    expect(r.planoClubeId).toBeNull();
    expect(r.adesaoClubeEm).toBeNull();
  });

  it('cancelar — 404 cross-tenant', async () => {
    prismaMock.cooperado.findFirst.mockResolvedValue(null);

    await expect(
      service.cancelar({ cooperadoId: 'c1', adminCooperativaId: TENANT_A }),
    ).rejects.toThrow(NotFoundException);
  });

  it('cancelar — idempotente: zera mesmo se já tava zerado', async () => {
    prismaMock.cooperado.findFirst.mockResolvedValue({
      id: 'c1',
      planoClubeId: null,
      adesaoClubeEm: null,
    });
    prismaMock.cooperado.update.mockResolvedValue({ id: 'c1', planoClubeId: null, adesaoClubeEm: null });

    await expect(
      service.cancelar({ cooperadoId: 'c1', adminCooperativaId: TENANT_A }),
    ).resolves.not.toThrow();
  });

  // ─── resolverParaCobrancaIndividual (helper Fatia 0.4) ──────────
  describe('resolverParaCobrancaIndividual', () => {
    it('cooperado sem adesão → null', async () => {
      prismaMock.cooperado.findFirst.mockResolvedValue({ planoClubeAdesao: null });

      const r = await service.resolverParaCobrancaIndividual('c1', TENANT_A);

      expect(r).toBeNull();
    });

    it('plano inativo → null (não soma na cobrança)', async () => {
      prismaMock.cooperado.findFirst.mockResolvedValue({
        planoClubeAdesao: { id: 'pln-1', valorMensal: '19.9', cobra: true, ativo: false, nome: 'X' },
      });

      const r = await service.resolverParaCobrancaIndividual('c1', TENANT_A);

      expect(r).toBeNull();
    });

    it('cobra=false (clube grátis) → null (sem linha de cobrança)', async () => {
      prismaMock.cooperado.findFirst.mockResolvedValue({
        planoClubeAdesao: { id: 'pln-1', valorMensal: '0', cobra: false, ativo: true, nome: 'Grátis' },
      });

      const r = await service.resolverParaCobrancaIndividual('c1', TENANT_A);

      expect(r).toBeNull();
    });

    it('plano ativo + cobra=true → snapshot pra Fatia 0.4', async () => {
      prismaMock.cooperado.findFirst.mockResolvedValue({
        planoClubeAdesao: { id: 'pln-1', valorMensal: '29.9', cobra: true, ativo: true, nome: 'Ouro' },
      });

      const r = await service.resolverParaCobrancaIndividual('c1', TENANT_A);

      expect(r).toEqual({ planoClubeId: 'pln-1', valorMensal: 29.9, nome: 'Ouro' });
    });

    it('cross-tenant (findFirst filtra por cooperativaId) → null', async () => {
      prismaMock.cooperado.findFirst.mockResolvedValue(null);

      const r = await service.resolverParaCobrancaIndividual('c1', TENANT_A);

      expect(r).toBeNull();
      expect(prismaMock.cooperado.findFirst).toHaveBeenCalledWith({
        where: { id: 'c1', cooperativaId: TENANT_A },
        select: expect.any(Object),
      });
    });
  });
});
