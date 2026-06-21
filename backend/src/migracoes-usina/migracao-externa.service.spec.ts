/**
 * Sprint Convênio MIGRAÇÃO M47 (21/06/2026) — Fatia C.
 *
 * Specs do MigracaoExternaService:
 * - iniciar: cria MigracaoUsina + altera Cooperado.status → PENDENTE_MIGRACAO,
 *   notifica WA (best-effort), multi-tenant.
 * - concluir: statusMigracao='CONCLUIDA' + Cooperado.status → ATIVO.
 * - rejeitar: statusMigracao='REJEITADA' + Cooperado.status → DESLIGADO.
 *
 * Multi-tenant: cooperado.findFirst SEMPRE com cooperativaId do JWT.
 * Best-effort: falha de WA NÃO derruba o fluxo.
 */
import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  MigracaoExternaService,
  STATUS_MIGRACAO_VALIDOS,
} from './migracao-externa.service';

describe('MigracaoExternaService — Sprint M47 Fase 3', () => {
  const cooperadoFindFirst = jest.fn();
  const migracaoCreate = jest.fn();
  const migracaoUpdate = jest.fn();
  const migracaoFindFirst = jest.fn();
  const cooperadoUpdate = jest.fn();
  const transaction = jest.fn();
  const waEnviarMensagem = jest.fn();
  const saldoFindUnique = jest.fn();
  const auditLogCreate = jest.fn();

  const prismaMock = {
    cooperado: { findFirst: cooperadoFindFirst, update: cooperadoUpdate },
    migracaoUsina: {
      create: migracaoCreate,
      update: migracaoUpdate,
      findFirst: migracaoFindFirst,
    },
    cooperTokenSaldo: { findUnique: saldoFindUnique },
    auditLog: { create: auditLogCreate },
    $transaction: transaction,
  } as any;

  const waMock = { enviarMensagem: waEnviarMensagem } as any;

  const service = new MigracaoExternaService(prismaMock, waMock);

  beforeEach(() => {
    jest.clearAllMocks();
    cooperadoFindFirst.mockResolvedValue({
      id: 'coop-1', status: 'ATIVO', nomeCompleto: 'Fulano', telefone: '5527999998888',
    });
    migracaoCreate.mockResolvedValue({ id: 'mig-1' });
    cooperadoUpdate.mockResolvedValue({});
    migracaoUpdate.mockResolvedValue({});
    transaction.mockImplementation((promises: any) => Promise.all(promises));
    waEnviarMensagem.mockResolvedValue({ enviado: true });
  });

  // ═══ Const array statusMigracao válidos ═══════════════════════════
  it('STATUS_MIGRACAO_VALIDOS expõe array de strings', () => {
    expect(STATUS_MIGRACAO_VALIDOS).toEqual([
      'PENDENTE', 'CONCLUIDA', 'REJEITADA', 'TIMEOUT_ADMIN_DECIDE',
    ]);
  });

  // ═══ iniciar ════════════════════════════════════════════════════════
  describe('iniciar', () => {
    const baseParams = {
      cooperadoId: 'coop-1',
      cooperativaId: 'tenant-A',
      realizadoPorId: 'admin-1',
      distribuidoraOrigem: 'Cooperativa Concorrente XYZ',
    };

    it('caminho feliz: cria MigracaoUsina + Cooperado.status PENDENTE_MIGRACAO + multi-tenant + cooperativaId em WA opts', async () => {
      const res = await service.iniciar(baseParams);

      expect(cooperadoFindFirst).toHaveBeenCalledWith({
        where: { id: 'coop-1', cooperativaId: 'tenant-A' },
        select: expect.any(Object),
      });
      expect(transaction).toHaveBeenCalled();
      expect(res.status).toBe('PENDENTE');
      expect(res.migracaoId).toBe('mig-1');

      // P1-3 code-reviewer 21/06: cooperativaId deve estar no metadata WA
      // pra rastreabilidade em MensagemWhatsapp.
      expect(waEnviarMensagem).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.objectContaining({
          tipoDisparo: 'MIGRACAO_EXTERNA_INICIADA',
          cooperativaId: 'tenant-A',
        }),
      );
    });

    it('cooperado em outro tenant → NotFoundException (multi-tenant)', async () => {
      cooperadoFindFirst.mockResolvedValue(null);
      await expect(service.iniciar(baseParams)).rejects.toThrow(NotFoundException);
    });

    it('cooperado já em PENDENTE_MIGRACAO → BadRequestException', async () => {
      cooperadoFindFirst.mockResolvedValue({
        id: 'coop-1', status: 'PENDENTE_MIGRACAO', nomeCompleto: 'Fulano', telefone: '5527999998888',
      });
      await expect(service.iniciar(baseParams)).rejects.toThrow(BadRequestException);
    });

    it('cooperado DESLIGADO → BadRequestException', async () => {
      cooperadoFindFirst.mockResolvedValue({
        id: 'coop-1', status: 'DESLIGADO', nomeCompleto: 'Fulano', telefone: '5527999998888',
      });
      await expect(service.iniciar(baseParams)).rejects.toThrow(/desligado/i);
    });

    it('distribuidoraOrigem vazia → BadRequestException', async () => {
      await expect(
        service.iniciar({ ...baseParams, distribuidoraOrigem: '   ' }),
      ).rejects.toThrow(/distribuidoraOrigem obrigatório/);
    });

    it('sem telefone: skip WA (best-effort, não derruba)', async () => {
      cooperadoFindFirst.mockResolvedValue({
        id: 'coop-1', status: 'ATIVO', nomeCompleto: 'Fulano', telefone: null,
      });
      const res = await service.iniciar(baseParams);
      expect(res.status).toBe('PENDENTE'); // ainda passa
      expect(waEnviarMensagem).not.toHaveBeenCalled();
    });

    it('falha WA não derruba fluxo (best-effort)', async () => {
      waEnviarMensagem.mockRejectedValue(new Error('WA offline'));
      const res = await service.iniciar(baseParams);
      expect(res.status).toBe('PENDENTE');
    });
  });

  // ═══ concluir ═══════════════════════════════════════════════════════
  describe('concluir', () => {
    const baseParams = {
      cooperadoId: 'coop-1',
      cooperativaId: 'tenant-A',
      realizadoPorId: 'admin-1',
    };

    beforeEach(() => {
      cooperadoFindFirst.mockResolvedValue({
        id: 'coop-1', status: 'PENDENTE_MIGRACAO', nomeCompleto: 'Fulano', telefone: '5527999998888',
      });
      migracaoFindFirst.mockResolvedValue({
        id: 'mig-1', distribuidoraOrigem: 'Cooperativa Concorrente XYZ',
      });
    });

    it('caminho feliz: statusMigracao=CONCLUIDA + Cooperado.status=ATIVO', async () => {
      const res = await service.concluir(baseParams);

      expect(migracaoFindFirst).toHaveBeenCalledWith({
        where: {
          cooperadoId: 'coop-1',
          cooperativaId: 'tenant-A',
          tipo: 'DISTRIBUIDORA_EXTERNA',
          statusMigracao: 'PENDENTE',
        },
        orderBy: { criadoEm: 'desc' },
        select: { id: true, distribuidoraOrigem: true },
      });
      expect(transaction).toHaveBeenCalled();
      expect(res.status).toBe('CONCLUIDA');
    });

    it('cooperado fora de PENDENTE_MIGRACAO → BadRequestException', async () => {
      cooperadoFindFirst.mockResolvedValue({
        id: 'coop-1', status: 'ATIVO', nomeCompleto: 'Fulano', telefone: '5527999998888',
      });
      await expect(service.concluir(baseParams)).rejects.toThrow(BadRequestException);
    });

    it('sem MigracaoUsina PENDENTE → BadRequestException (estado inconsistente)', async () => {
      migracaoFindFirst.mockResolvedValue(null);
      await expect(service.concluir(baseParams)).rejects.toThrow(/inconsistente/);
    });

    it('multi-tenant: cooperado de outro tenant → NotFoundException', async () => {
      cooperadoFindFirst.mockResolvedValue(null);
      await expect(service.concluir(baseParams)).rejects.toThrow(NotFoundException);
    });
  });

  // ═══ rejeitar ═══════════════════════════════════════════════════════
  describe('rejeitar', () => {
    const baseParams = {
      cooperadoId: 'coop-1',
      cooperativaId: 'tenant-A',
      realizadoPorId: 'admin-1',
      motivo: 'Cooperado desistiu',
    };

    beforeEach(() => {
      cooperadoFindFirst.mockResolvedValue({
        id: 'coop-1', status: 'PENDENTE_MIGRACAO', nomeCompleto: 'Fulano', telefone: '5527999998888',
      });
      migracaoFindFirst.mockResolvedValue({ id: 'mig-1' });
      saldoFindUnique.mockResolvedValue(null); // sem saldo residual por default
      auditLogCreate.mockResolvedValue({});
    });

    it('caminho feliz: statusMigracao=REJEITADA + Cooperado.status=DESLIGADO', async () => {
      const res = await service.rejeitar(baseParams);
      expect(transaction).toHaveBeenCalled();
      expect(res.status).toBe('REJEITADA');
    });

    it('motivo < 5 chars → BadRequestException', async () => {
      await expect(
        service.rejeitar({ ...baseParams, motivo: 'no' }),
      ).rejects.toThrow(/motivo obrigatório/);
    });

    it('motivo vazio → BadRequestException', async () => {
      await expect(
        service.rejeitar({ ...baseParams, motivo: '   ' }),
      ).rejects.toThrow(/motivo obrigatório/);
    });

    it('cooperado fora de PENDENTE_MIGRACAO → BadRequestException', async () => {
      cooperadoFindFirst.mockResolvedValue({
        id: 'coop-1', status: 'ATIVO', nomeCompleto: 'Fulano', telefone: null,
      });
      await expect(service.rejeitar(baseParams)).rejects.toThrow(BadRequestException);
    });

    it('saldo residual > 0: cria AuditLog forense (P2 financeiro-token 21/06)', async () => {
      saldoFindUnique.mockResolvedValue({ saldoDisponivel: 50 });

      await service.rejeitar(baseParams);

      expect(auditLogCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          usuarioId: 'admin-1',
          usuarioPerfil: 'ADMIN',
          cooperativaId: 'tenant-A',
          acao: 'migracao.rejeitar.saldo-residual',
          recurso: 'CooperTokenSaldo',
          recursoId: 'coop-1',
          metadata: expect.objectContaining({
            migracaoId: 'mig-1',
            tokensResiduais: 50,
            motivo: 'Cooperado desistiu',
          }),
        }),
      });
    });

    it('saldo zero ou null: NÃO cria AuditLog forense (sem passivo travado)', async () => {
      saldoFindUnique.mockResolvedValue({ saldoDisponivel: 0 });

      await service.rejeitar(baseParams);

      expect(auditLogCreate).not.toHaveBeenCalled();
    });
  });
});
