import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConveniosMembrosService } from './convenios-membros.service';

/**
 * Sprint Convite-Convênio Fatia 2 (03/06/2026) — Specs do param `origem`.
 *
 * Cobre:
 *  1. origem default ADMIN_MANUAL → MEMBRO_ATIVO + ativo=true (preserva legado).
 *  2. origem CONVITE_PUBLICO → PENDENTE_APROVACAO_EMPRESA + ativo=false.
 *  3. origem CONVITE_PUBLICO cria AprovacaoConvenioMembro NO MESMO `tx`
 *     (atomicidade — token 64 hex + expiresAt 7d).
 *  4. CONVITE_PUBLICO sem `tx` ainda funciona (cria membro pendente + magic link
 *     usando this.prisma direto).
 *  5. CONVITE_PUBLICO NÃO chama `recalcularFaixa` (faixa só conta ativos).
 *  6. CONVITE_PUBLICO sobre cooperado JÁ MEMBRO (ATIVO ou PENDENTE) rejeita
 *     com BadRequest (proteção dedup em camada).
 *  7. Reativação preserva `origem` informada (CONVITE_PUBLICO reativa em PENDENTE).
 *  8. CSV se comporta como ADMIN_MANUAL (entra ATIVO direto).
 */
describe('ConveniosMembrosService — origem (Fatia 2)', () => {
  const findUniqueConvenio = jest.fn();
  const findUniqueCooperado = jest.fn();
  const findFirstMembroOutro = jest.fn();
  const findUniqueMembro = jest.fn();
  const createMembro = jest.fn();
  const updateMembro = jest.fn();
  const createAprovacao = jest.fn();
  const recalcularFaixa = jest.fn();

  const prismaMock = {
    contratoConvenio: { findUnique: findUniqueConvenio },
    cooperado: { findUnique: findUniqueCooperado },
    convenioCooperado: {
      findFirst: findFirstMembroOutro,
      findUnique: findUniqueMembro,
      create: createMembro,
      update: updateMembro,
    },
    aprovacaoConvenioMembro: {
      create: createAprovacao,
    },
  } as any;

  const progressaoMock = { recalcularFaixa } as any;

  let service: ConveniosMembrosService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ConveniosMembrosService(prismaMock, progressaoMock);

    findUniqueConvenio.mockResolvedValue({
      id: 'conv1',
      status: 'ATIVO',
      cooperativaId: 'coop-A',
      registrarComoIndicacao: false,
      conveniadoId: null,
    });
    findUniqueCooperado.mockResolvedValue({
      id: 'coop1',
      cooperativaId: 'coop-A',
    });
    findFirstMembroOutro.mockResolvedValue(null);
    findUniqueMembro.mockResolvedValue(null);
  });

  describe('default ADMIN_MANUAL preserva comportamento legado', () => {
    it('SEM origem (default) → MEMBRO_ATIVO + ativo=true', async () => {
      createMembro.mockResolvedValue({ id: 'membro1', status: 'MEMBRO_ATIVO', ativo: true });

      await service.adicionarMembro('conv1', 'coop1', undefined);

      expect(createMembro).toHaveBeenCalledWith({
        data: expect.objectContaining({
          convenioId: 'conv1',
          cooperadoId: 'coop1',
          ativo: true,
          status: 'MEMBRO_ATIVO',
          origem: 'ADMIN_MANUAL',
        }),
      });
      // ADMIN_MANUAL sem tx → recalcularFaixa disparou (legado)
      expect(recalcularFaixa).toHaveBeenCalledTimes(1);
      // Nenhum magic link criado pra ADMIN_MANUAL
      expect(createAprovacao).not.toHaveBeenCalled();
    });

    it('origem CSV explícito → mesmo comportamento ADMIN_MANUAL (ATIVO direto)', async () => {
      createMembro.mockResolvedValue({ id: 'membro1', status: 'MEMBRO_ATIVO', ativo: true });

      await service.adicionarMembro('conv1', 'coop1', 'mat-CSV', undefined, 'CSV');

      expect(createMembro).toHaveBeenCalledWith({
        data: expect.objectContaining({
          ativo: true,
          status: 'MEMBRO_ATIVO',
          origem: 'CSV',
        }),
      });
      expect(createAprovacao).not.toHaveBeenCalled();
    });
  });

  describe('origem CONVITE_PUBLICO → PENDENTE + magic link', () => {
    it('membro NOVO nasce PENDENTE_APROVACAO_EMPRESA + ativo=false', async () => {
      createMembro.mockResolvedValue({
        id: 'membro1',
        status: 'PENDENTE_APROVACAO_EMPRESA',
        ativo: false,
      });
      createAprovacao.mockResolvedValue({ id: 'aprov1' });

      await service.adicionarMembro('conv1', 'coop1', undefined, undefined, 'CONVITE_PUBLICO');

      expect(createMembro).toHaveBeenCalledWith({
        data: expect.objectContaining({
          convenioId: 'conv1',
          cooperadoId: 'coop1',
          ativo: false,
          status: 'PENDENTE_APROVACAO_EMPRESA',
          origem: 'CONVITE_PUBLICO',
        }),
      });
    });

    it('cria AprovacaoConvenioMembro com token 64 hex + TTL 7d na mesma chamada', async () => {
      createMembro.mockResolvedValue({
        id: 'membro1',
        status: 'PENDENTE_APROVACAO_EMPRESA',
        ativo: false,
      });
      createAprovacao.mockResolvedValue({ id: 'aprov1' });

      const antes = Date.now();
      await service.adicionarMembro('conv1', 'coop1', undefined, undefined, 'CONVITE_PUBLICO');
      const depois = Date.now();

      expect(createAprovacao).toHaveBeenCalledTimes(1);
      const callArgs = createAprovacao.mock.calls[0][0];
      expect(callArgs.data.membroId).toBe('membro1');
      expect(callArgs.data.token).toMatch(/^[0-9a-f]{64}$/); // 32 bytes hex
      const expiraEm = callArgs.data.expiresAt.getTime();
      const seteDiasMs = 7 * 24 * 60 * 60 * 1000;
      // Tolerância: expiresAt está entre (antes + 7d) e (depois + 7d)
      expect(expiraEm).toBeGreaterThanOrEqual(antes + seteDiasMs - 1000);
      expect(expiraEm).toBeLessThanOrEqual(depois + seteDiasMs + 1000);
    });

    it('CONVITE_PUBLICO NÃO chama recalcularFaixa (sem tx → mas é convite público)', async () => {
      createMembro.mockResolvedValue({
        id: 'membro1',
        status: 'PENDENTE_APROVACAO_EMPRESA',
        ativo: false,
      });
      createAprovacao.mockResolvedValue({ id: 'aprov1' });

      // Sem tx mas origem=CONVITE_PUBLICO → não dispara MLM/faixa
      await service.adicionarMembro('conv1', 'coop1', undefined, undefined, 'CONVITE_PUBLICO');

      expect(recalcularFaixa).not.toHaveBeenCalled();
    });

    it('cooperado JÁ é membro ATIVO → BadRequest (dedup proteção camada)', async () => {
      findUniqueMembro.mockResolvedValue({
        id: 'membro1',
        ativo: true,
        status: 'MEMBRO_ATIVO',
      });

      await expect(
        service.adicionarMembro('conv1', 'coop1', undefined, undefined, 'CONVITE_PUBLICO'),
      ).rejects.toThrow(BadRequestException);

      expect(createMembro).not.toHaveBeenCalled();
      expect(createAprovacao).not.toHaveBeenCalled();
    });

    it('cooperado JÁ é membro PENDENTE_APROVACAO_EMPRESA → BadRequest', async () => {
      findUniqueMembro.mockResolvedValue({
        id: 'membro1',
        ativo: false,
        status: 'PENDENTE_APROVACAO_EMPRESA',
      });

      await expect(
        service.adicionarMembro('conv1', 'coop1', undefined, undefined, 'CONVITE_PUBLICO'),
      ).rejects.toThrow(BadRequestException);
    });

    it('reativação de membro DESLIGADO via CONVITE_PUBLICO → reativa em PENDENTE (não ATIVO)', async () => {
      findUniqueMembro.mockResolvedValue({
        id: 'membroAntigo',
        ativo: false,
        status: 'MEMBRO_DESLIGADO',
        matricula: 'mat-velha',
      });
      updateMembro.mockResolvedValue({
        id: 'membroAntigo',
        status: 'PENDENTE_APROVACAO_EMPRESA',
        ativo: false,
      });
      createAprovacao.mockResolvedValue({ id: 'aprov1' });

      await service.adicionarMembro('conv1', 'coop1', undefined, undefined, 'CONVITE_PUBLICO');

      expect(updateMembro).toHaveBeenCalledWith({
        where: { id: 'membroAntigo' },
        data: expect.objectContaining({
          ativo: false,
          status: 'PENDENTE_APROVACAO_EMPRESA',
          origem: 'CONVITE_PUBLICO',
        }),
      });
      // Magic link criado mesmo na reativação
      expect(createAprovacao).toHaveBeenCalledTimes(1);
    });
  });

  describe('Multi-tenant + integridade preservada', () => {
    it('cooperado de OUTRO tenant → BadRequest (mesmo com CONVITE_PUBLICO)', async () => {
      findUniqueCooperado.mockResolvedValue({ id: 'coop1', cooperativaId: 'coop-B' });

      await expect(
        service.adicionarMembro('conv1', 'coop1', undefined, undefined, 'CONVITE_PUBLICO'),
      ).rejects.toThrow(BadRequestException);

      expect(createMembro).not.toHaveBeenCalled();
      expect(createAprovacao).not.toHaveBeenCalled();
    });

    it('convênio INEXISTENTE → NotFound', async () => {
      findUniqueConvenio.mockResolvedValue(null);

      await expect(
        service.adicionarMembro('convX', 'coop1', undefined, undefined, 'CONVITE_PUBLICO'),
      ).rejects.toThrow(NotFoundException);
    });

    it('membro em OUTRO convênio ativo → BadRequest (regra 1:1)', async () => {
      findFirstMembroOutro.mockResolvedValue({ id: 'membroOutro', convenioId: 'conv2' });

      await expect(
        service.adicionarMembro('conv1', 'coop1', undefined, undefined, 'CONVITE_PUBLICO'),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
