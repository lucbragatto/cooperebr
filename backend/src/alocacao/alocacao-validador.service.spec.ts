/**
 * M14.A — specs do AlocacaoValidadorService.
 * Cobre os 4 validadores isolados (concentração 25%, distribuidora, classe GD, estabilidade).
 */
import { AlocacaoValidadorService } from './alocacao-validador.service';

type Any = any;

function buildPrisma() {
  return {
    usina: { findUnique: jest.fn() },
    uc: { findUnique: jest.fn() },
    contrato: { findUnique: jest.fn(), findMany: jest.fn() },
  };
}

function makeValidador() {
  const prisma = buildPrisma();
  const validador = new AlocacaoValidadorService(prisma as Any);
  return { validador, prisma };
}

describe('AlocacaoValidadorService', () => {
  describe('validarConcentracao25', () => {
    it('aceita quando alocação proposta fica abaixo de 25%', async () => {
      const { validador, prisma } = makeValidador();
      prisma.usina.findUnique.mockResolvedValue({ capacidadeKwh: 100_000 });
      prisma.contrato.findMany.mockResolvedValue([]);
      const r = await validador.validarConcentracao25({
        cooperadoId: 'c-1',
        usinaId: 'u-1',
        kwhProposto: 20_000, // 20%
      });
      expect(r.valido).toBe(true);
    });

    it('rejeita quando alocação proposta excede 25%', async () => {
      const { validador, prisma } = makeValidador();
      prisma.usina.findUnique.mockResolvedValue({ capacidadeKwh: 100_000 });
      prisma.contrato.findMany.mockResolvedValue([]);
      const r = await validador.validarConcentracao25({
        cooperadoId: 'c-1',
        usinaId: 'u-1',
        kwhProposto: 26_000, // 26%
      });
      expect(r.valido).toBe(false);
      expect(r.motivo).toMatch(/26\.00%/);
    });

    it('soma contratos existentes do mesmo cooperado (excluindo o que está sendo realocado)', async () => {
      const { validador, prisma } = makeValidador();
      prisma.usina.findUnique.mockResolvedValue({ capacidadeKwh: 100_000 });
      prisma.contrato.findMany.mockResolvedValue([{ kwhContrato: 15_000 }]); // outro contrato do cooperado
      const r = await validador.validarConcentracao25({
        cooperadoId: 'c-1',
        usinaId: 'u-1',
        kwhProposto: 11_000, // soma 26%
        contratoIdAtual: 'ctr-em-realocacao',
      });
      expect(r.valido).toBe(false);
      const findCall = prisma.contrato.findMany.mock.calls[0][0];
      expect(findCall.where.id).toEqual({ not: 'ctr-em-realocacao' });
    });

    it('rejeita quando usina sem capacidade', async () => {
      const { validador, prisma } = makeValidador();
      prisma.usina.findUnique.mockResolvedValue({ capacidadeKwh: null });
      const r = await validador.validarConcentracao25({
        cooperadoId: 'c-1',
        usinaId: 'u-1',
        kwhProposto: 5_000,
      });
      expect(r.valido).toBe(false);
    });
  });

  describe('validarDistribuidora', () => {
    it('aceita quando UC e usina têm mesma distribuidora', async () => {
      const { validador, prisma } = makeValidador();
      prisma.uc.findUnique.mockResolvedValue({ distribuidora: 'EDP_ES' });
      prisma.usina.findUnique.mockResolvedValue({ distribuidora: 'EDP_ES' });
      const r = await validador.validarDistribuidora('uc-1', 'u-1');
      expect(r.valido).toBe(true);
    });

    it('rejeita quando distribuidoras diferentes', async () => {
      const { validador, prisma } = makeValidador();
      prisma.uc.findUnique.mockResolvedValue({ distribuidora: 'EDP_ES' });
      prisma.usina.findUnique.mockResolvedValue({ distribuidora: 'CEMIG' });
      const r = await validador.validarDistribuidora('uc-1', 'u-1');
      expect(r.valido).toBe(false);
      expect(r.motivo).toMatch(/Distribuidoras diferentes/);
    });

    it('permissivo se qualquer distribuidora null (legado)', async () => {
      const { validador, prisma } = makeValidador();
      prisma.uc.findUnique.mockResolvedValue({ distribuidora: null });
      prisma.usina.findUnique.mockResolvedValue({ distribuidora: 'EDP_ES' });
      const r = await validador.validarDistribuidora('uc-1', 'u-1');
      expect(r.valido).toBe(true);
    });

    it('rejeita se UC não encontrada', async () => {
      const { validador, prisma } = makeValidador();
      prisma.uc.findUnique.mockResolvedValue(null);
      prisma.usina.findUnique.mockResolvedValue({ distribuidora: 'EDP_ES' });
      const r = await validador.validarDistribuidora('uc-x', 'u-1');
      expect(r.valido).toBe(false);
    });
  });

  describe('validarClasseGd', () => {
    it('valido + warn quando contrato.classeGdAplicada é null (Sprint 5a adiada)', async () => {
      const { validador, prisma } = makeValidador();
      prisma.contrato.findUnique.mockResolvedValue({ classeGdAplicada: null });
      prisma.usina.findUnique.mockResolvedValue({ classeGdAnotada: 'GD_II' });
      const r = await validador.validarClasseGd({ contratoId: 'c-1', usinaSugeridaId: 'u-1' });
      expect(r.valido).toBe(true);
      expect(r.warn).toBe(true);
    });

    it('valido + warn quando usina.classeGdAnotada é null', async () => {
      const { validador, prisma } = makeValidador();
      prisma.contrato.findUnique.mockResolvedValue({ classeGdAplicada: 'GD_I' });
      prisma.usina.findUnique.mockResolvedValue({ classeGdAnotada: null });
      const r = await validador.validarClasseGd({ contratoId: 'c-1', usinaSugeridaId: 'u-1' });
      expect(r.valido).toBe(true);
      expect(r.warn).toBe(true);
    });

    it('aceita quando classes coincidem', async () => {
      const { validador, prisma } = makeValidador();
      prisma.contrato.findUnique.mockResolvedValue({ classeGdAplicada: 'GD_I' });
      prisma.usina.findUnique.mockResolvedValue({ classeGdAnotada: 'GD_I' });
      const r = await validador.validarClasseGd({ contratoId: 'c-1', usinaSugeridaId: 'u-1' });
      expect(r.valido).toBe(true);
      expect(r.warn).toBeUndefined();
    });

    it('rejeita quando classes divergem — caso Exfishes preventivo (D-30B)', async () => {
      const { validador, prisma } = makeValidador();
      prisma.contrato.findUnique.mockResolvedValue({ classeGdAplicada: 'GD_I' });
      prisma.usina.findUnique.mockResolvedValue({ classeGdAnotada: 'GD_III' });
      const r = await validador.validarClasseGd({ contratoId: 'c-1', usinaSugeridaId: 'u-1' });
      expect(r.valido).toBe(false);
      expect(r.motivo).toMatch(/Mudança de classe GD/);
    });
  });

  describe('validarEstabilidade', () => {
    it('rejeita contrato com menos de 90 dias', async () => {
      const { validador, prisma } = makeValidador();
      const recente = new Date();
      recente.setDate(recente.getDate() - 30);
      prisma.contrato.findUnique.mockResolvedValue({ dataInicio: recente });
      const r = await validador.validarEstabilidade('c-1');
      expect(r.valido).toBe(false);
      expect(r.motivo).toMatch(/apenas \d+ dias/);
    });

    it('aceita contrato com mais de 90 dias', async () => {
      const { validador, prisma } = makeValidador();
      const antigo = new Date();
      antigo.setMonth(antigo.getMonth() - 6);
      prisma.contrato.findUnique.mockResolvedValue({ dataInicio: antigo });
      const r = await validador.validarEstabilidade('c-1');
      expect(r.valido).toBe(true);
    });

    it('rejeita se contrato não encontrado', async () => {
      const { validador, prisma } = makeValidador();
      prisma.contrato.findUnique.mockResolvedValue(null);
      const r = await validador.validarEstabilidade('c-x');
      expect(r.valido).toBe(false);
    });
  });
});
