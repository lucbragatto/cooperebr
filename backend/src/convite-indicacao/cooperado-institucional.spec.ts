/**
 * Fatia F-G1 (05/06/2026) — Specs do CooperadoInstitucionalService.
 *
 * Cobre:
 *  1. garantirInstitucional idempotente: reuso se já existe.
 *  2. garantirInstitucional cria novo com nome "{Coop} — Institucional",
 *     email institucional+<coopId>@sisgd.invalid, tipoCooperado=SEM_UC.
 *  3. ehInstitucional true pro fantasma, false pra cooperado comum.
 *  4. Cooperativa inexistente → NotFound.
 */
import { NotFoundException } from '@nestjs/common';
import { CooperadoInstitucionalService } from './cooperado-institucional.service';

describe('CooperadoInstitucionalService — Fatia F-G1', () => {
  const findUniqueCooperado = jest.fn();
  const findUniqueCooperativa = jest.fn();
  const createCooperado = jest.fn();

  const prisma: any = {
    cooperado: {
      findUnique: findUniqueCooperado,
      create: createCooperado,
    },
    cooperativa: { findUnique: findUniqueCooperativa },
  };

  let service: CooperadoInstitucionalService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new CooperadoInstitucionalService(prisma);
  });

  describe('garantirInstitucional', () => {
    it('idempotente: retorna existente sem chamar create', async () => {
      findUniqueCooperado.mockResolvedValueOnce({
        id: 'coop-inst-1',
        nomeCompleto: 'CoopereBR — Institucional',
        email: 'institucional+coop-A@sisgd.invalid',
        cooperativaId: 'coop-A',
      });
      const r = await service.garantirInstitucional('coop-A');
      expect(r.id).toBe('coop-inst-1');
      expect(r.isInstitucional).toBe(true);
      expect(createCooperado).not.toHaveBeenCalled();
    });

    it('cria fantasma com nome "{Coop} — Institucional", email .invalid, tipoCooperado=SEM_UC', async () => {
      findUniqueCooperado.mockResolvedValueOnce(null);
      findUniqueCooperativa.mockResolvedValueOnce({
        id: 'coop-A',
        nome: 'CoopereBR',
        cnpj: '12345678000190',
      });
      createCooperado.mockResolvedValueOnce({
        id: 'coop-inst-novo',
        nomeCompleto: 'CoopereBR — Institucional',
        email: 'institucional+coop-A@sisgd.invalid',
        cooperativaId: 'coop-A',
      });

      const r = await service.garantirInstitucional('coop-A');

      expect(createCooperado).toHaveBeenCalledWith({
        data: expect.objectContaining({
          nomeCompleto: 'CoopereBR — Institucional',
          email: 'institucional+coop-A@sisgd.invalid',
          cpf: '12345678000190',
          tipoCooperado: 'SEM_UC',
          status: 'ATIVO',
          cooperativaId: 'coop-A',
        }),
        select: expect.any(Object),
      });
      expect(r.isInstitucional).toBe(true);
    });

    it('cooperativa sem CNPJ → cpf fallback sintético', async () => {
      findUniqueCooperado.mockResolvedValueOnce(null);
      findUniqueCooperativa.mockResolvedValueOnce({
        id: 'coop-A',
        nome: 'Coop sem CNPJ',
        cnpj: null,
      });
      createCooperado.mockResolvedValueOnce({
        id: 'coop-inst-novo',
        nomeCompleto: 'Coop sem CNPJ — Institucional',
        email: 'institucional+coop-A@sisgd.invalid',
        cooperativaId: 'coop-A',
      });

      await service.garantirInstitucional('coop-A');
      const arg = createCooperado.mock.calls[0][0].data;
      expect(arg.cpf).toMatch(/^INST-/);
    });

    it('cooperativa inexistente → NotFoundException', async () => {
      findUniqueCooperado.mockResolvedValueOnce(null);
      findUniqueCooperativa.mockResolvedValueOnce(null);
      await expect(service.garantirInstitucional('coop-Z')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('ehInstitucional', () => {
    it('true pra email institucional+<coopId>@sisgd.invalid', async () => {
      findUniqueCooperado.mockResolvedValueOnce({
        email: 'institucional+coop-A@sisgd.invalid',
      });
      expect(await service.ehInstitucional('coop-inst-1')).toBe(true);
    });

    it('false pra cooperado comum', async () => {
      findUniqueCooperado.mockResolvedValueOnce({
        email: 'joao@gmail.com',
      });
      expect(await service.ehInstitucional('coop-real-1')).toBe(false);
    });

    it('false pra cooperado sem email', async () => {
      findUniqueCooperado.mockResolvedValueOnce({ email: null });
      expect(await service.ehInstitucional('coop-x')).toBe(false);
    });

    it('false pra cooperado inexistente', async () => {
      findUniqueCooperado.mockResolvedValueOnce(null);
      expect(await service.ehInstitucional('coop-fake')).toBe(false);
    });

    it('false pra email no domínio .invalid mas SEM prefix institucional+', async () => {
      findUniqueCooperado.mockResolvedValueOnce({
        email: '11111111110@teste.invalid', // padrão dado-teste B5 antigo
      });
      expect(await service.ehInstitucional('coop-teste-b5')).toBe(false);
    });
  });
});
