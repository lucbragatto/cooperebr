/**
 * Specs D-novo-BH (M37, 29/05/2026) — workflow despesas operacionais.
 */
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ContasPagarService } from './contas-pagar.service';

describe('ContasPagarService — D-novo-BH workflow', () => {
  let service: ContasPagarService;
  let prismaMock: any;

  let notificacoesMock: any;

  beforeEach(() => {
    prismaMock = {
      usina: { findUnique: jest.fn(), findMany: jest.fn() },
      contaAPagar: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      cooperativa: { findUnique: jest.fn() },
    };
    notificacoesMock = {
      notificarDespesaProposta: jest.fn().mockResolvedValue(undefined),
      notificarDespesaAprovada: jest.fn().mockResolvedValue(undefined),
      notificarDespesaRejeitada: jest.fn().mockResolvedValue(undefined),
    };
    service = new ContasPagarService(prismaMock, notificacoesMock);
  });

  // ─── proporDespesa ───────────────────────────────────────────────

  describe('proporDespesa()', () => {
    const dtoBase = {
      usinaId: 'u1',
      dataOcorrencia: '2026-05-29',
      categoria: 'CUSD' as any,
      valor: 1500,
      descricao: 'Conta CUSD maio/2026',
      quemPagouTipo: 'PARCEIRO' as any,
      tratamento: 'REEMBOLSO' as any,
    };

    it('PROPRIETARIO cria com statusAprovacao=PROPOSTA', async () => {
      prismaMock.usina.findUnique.mockResolvedValueOnce({
        id: 'u1',
        cooperativaId: 'coop1',
        responsabilidadeDespesas: {},
      });
      prismaMock.contaAPagar.create.mockResolvedValueOnce({ id: 'd1' });

      await service.proporDespesa(dtoBase as any, 'usr-prop', 'PROPRIETARIO', 'coop1');

      const args = prismaMock.contaAPagar.create.mock.calls[0][0];
      expect(args.data.statusAprovacao).toBe('PROPOSTA');
      expect(args.data.aprovadoPorUsuarioId).toBeUndefined();
      expect(args.data.aprovadoEm).toBeUndefined();
      expect(args.data.propostoPorUsuarioId).toBe('usr-prop');
    });

    // BH.3.2: workflow double-check universal — ADMIN também cria PROPOSTA
    it('ADMIN cria com statusAprovacao=PROPOSTA (BH.3.2 universal)', async () => {
      prismaMock.usina.findUnique.mockResolvedValueOnce({
        id: 'u1',
        cooperativaId: 'coop1',
        responsabilidadeDespesas: {},
      });
      prismaMock.contaAPagar.create.mockResolvedValueOnce({ id: 'd1', statusAprovacao: 'PROPOSTA' });

      await service.proporDespesa(dtoBase as any, 'usr-admin', 'ADMIN', 'coop1');

      const args = prismaMock.contaAPagar.create.mock.calls[0][0];
      expect(args.data.statusAprovacao).toBe('PROPOSTA');
      expect(args.data.aprovadoPorUsuarioId).toBeUndefined();
      expect(args.data.aprovadoEm).toBeUndefined();
      expect(args.data.propostoPorUsuarioId).toBe('usr-admin');
    });

    it('SUPER_ADMIN cria com statusAprovacao=PROPOSTA (BH.3.2 universal)', async () => {
      prismaMock.usina.findUnique.mockResolvedValueOnce({
        id: 'u1',
        cooperativaId: 'coop1',
        responsabilidadeDespesas: {},
      });
      prismaMock.contaAPagar.create.mockResolvedValueOnce({ id: 'd1', statusAprovacao: 'PROPOSTA' });

      await service.proporDespesa(dtoBase as any, 'usr-sa', 'SUPER_ADMIN', 'coop1');

      const args = prismaMock.contaAPagar.create.mock.calls[0][0];
      expect(args.data.statusAprovacao).toBe('PROPOSTA');
      expect(args.data.aprovadoPorUsuarioId).toBeUndefined();
    });

    it('pré-preenche responsavelPagamento da Camada 1 (M30)', async () => {
      prismaMock.usina.findUnique.mockResolvedValueOnce({
        id: 'u1',
        cooperativaId: 'coop1',
        responsabilidadeDespesas: { CUSD: 'PARCEIRO', MANUTENCAO: 'PROPRIETARIO' },
      });
      prismaMock.contaAPagar.create.mockResolvedValueOnce({ id: 'd1' });

      await service.proporDespesa(dtoBase as any, 'usr', 'ADMIN', 'coop1');

      const args = prismaMock.contaAPagar.create.mock.calls[0][0];
      expect(args.data.responsavelPagamento).toBe('PARCEIRO');
    });

    it('rejeita usina de outra cooperativa (multi-tenant + IDOR)', async () => {
      prismaMock.usina.findUnique.mockResolvedValueOnce({
        id: 'u1',
        cooperativaId: 'OUTRA-COOP',
        responsabilidadeDespesas: {},
      });

      await expect(
        service.proporDespesa(dtoBase as any, 'usr', 'ADMIN', 'coop1'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('NotFoundException quando usina não existe', async () => {
      prismaMock.usina.findUnique.mockResolvedValueOnce(null);
      await expect(
        service.proporDespesa(dtoBase as any, 'usr', 'ADMIN', 'coop1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─── aprovarDespesa ──────────────────────────────────────────────

  describe('aprovarDespesa()', () => {
    it('PROPOSTA → APROVADA com aprovadoEm (admin diferente do propositor)', async () => {
      prismaMock.contaAPagar.findUnique.mockResolvedValueOnce({
        id: 'd1',
        cooperativaId: 'coop1',
        statusAprovacao: 'PROPOSTA',
        propostoPorUsuarioId: 'usr-propos',
      });
      prismaMock.contaAPagar.update.mockResolvedValueOnce({ id: 'd1' });

      await service.aprovarDespesa('d1', 'admin-1', 'coop1');

      const args = prismaMock.contaAPagar.update.mock.calls[0][0];
      expect(args.data.statusAprovacao).toBe('APROVADA');
      expect(args.data.aprovadoPorUsuarioId).toBe('admin-1');
      expect(args.data.aprovadoEm).toBeInstanceOf(Date);
    });

    it('APROVADA (race condition) → ConflictException', async () => {
      prismaMock.contaAPagar.findUnique.mockResolvedValueOnce({
        id: 'd1',
        cooperativaId: 'coop1',
        statusAprovacao: 'APROVADA',
        propostoPorUsuarioId: 'usr-propos',
      });

      await expect(
        service.aprovarDespesa('d1', 'admin-1', 'coop1'),
      ).rejects.toThrow(ConflictException);
    });

    it('despesa de outra coop → ForbiddenException', async () => {
      prismaMock.contaAPagar.findUnique.mockResolvedValueOnce({
        id: 'd1',
        cooperativaId: 'OUTRA',
        statusAprovacao: 'PROPOSTA',
        propostoPorUsuarioId: 'usr-propos',
      });

      await expect(
        service.aprovarDespesa('d1', 'admin-1', 'coop1'),
      ).rejects.toThrow(ForbiddenException);
    });

    // BH.3.2 — Self-approval guard
    it('SELF-APPROVAL: propositor tenta aprovar a própria → ForbiddenException', async () => {
      prismaMock.contaAPagar.findUnique.mockResolvedValueOnce({
        id: 'd1',
        cooperativaId: 'coop1',
        statusAprovacao: 'PROPOSTA',
        propostoPorUsuarioId: 'usr-A',
      });

      await expect(
        service.aprovarDespesa('d1', 'usr-A', 'coop1'),
      ).rejects.toThrow(/você mesmo propôs/i);
      expect(prismaMock.contaAPagar.update).not.toHaveBeenCalled();
    });
  });

  // ─── rejeitarDespesa ─────────────────────────────────────────────

  describe('rejeitarDespesa()', () => {
    it('PROPOSTA + motivo → REJEITADA + motivo gravado (admin diferente)', async () => {
      prismaMock.contaAPagar.findUnique.mockResolvedValueOnce({
        id: 'd1',
        cooperativaId: 'coop1',
        statusAprovacao: 'PROPOSTA',
        propostoPorUsuarioId: 'usr-propos',
      });
      prismaMock.contaAPagar.update.mockResolvedValueOnce({ id: 'd1' });

      await service.rejeitarDespesa(
        'd1',
        { motivo: 'Faltou nota fiscal anexada.' } as any,
        'admin-1',
        'coop1',
      );

      const args = prismaMock.contaAPagar.update.mock.calls[0][0];
      expect(args.data.statusAprovacao).toBe('REJEITADA');
      expect(args.data.rejeitadoMotivo).toBe('Faltou nota fiscal anexada.');
    });

    // BH.3.2 — Self-rejection guard
    it('SELF-REJECTION: propositor tenta rejeitar a própria → ForbiddenException', async () => {
      prismaMock.contaAPagar.findUnique.mockResolvedValueOnce({
        id: 'd1',
        cooperativaId: 'coop1',
        statusAprovacao: 'PROPOSTA',
        propostoPorUsuarioId: 'usr-A',
      });

      await expect(
        service.rejeitarDespesa('d1', { motivo: 'X' } as any, 'usr-A', 'coop1'),
      ).rejects.toThrow(/você mesmo propôs/i);
      expect(prismaMock.contaAPagar.update).not.toHaveBeenCalled();
    });
  });

  // ─── resolverDespesa ─────────────────────────────────────────────

  describe('resolverDespesa()', () => {
    it('APROVADA + PENDENTE → RESOLVIDA com resolvidoEm', async () => {
      prismaMock.contaAPagar.findUnique.mockResolvedValueOnce({
        id: 'd1',
        cooperativaId: 'coop1',
        statusAprovacao: 'APROVADA',
        statusResolucao: 'PENDENTE',
      });
      prismaMock.contaAPagar.update.mockResolvedValueOnce({ id: 'd1' });

      await service.resolverDespesa('d1', {} as any, 'coop1');

      const args = prismaMock.contaAPagar.update.mock.calls[0][0];
      expect(args.data.statusResolucao).toBe('RESOLVIDA');
      expect(args.data.resolvidoEm).toBeInstanceOf(Date);
    });

    it('PROPOSTA (sem aprovar) → BadRequestException', async () => {
      prismaMock.contaAPagar.findUnique.mockResolvedValueOnce({
        id: 'd1',
        cooperativaId: 'coop1',
        statusAprovacao: 'PROPOSTA',
        statusResolucao: 'PENDENTE',
      });

      await expect(
        service.resolverDespesa('d1', {} as any, 'coop1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('já RESOLVIDA → ConflictException', async () => {
      prismaMock.contaAPagar.findUnique.mockResolvedValueOnce({
        id: 'd1',
        cooperativaId: 'coop1',
        statusAprovacao: 'APROVADA',
        statusResolucao: 'RESOLVIDA',
      });

      await expect(
        service.resolverDespesa('d1', {} as any, 'coop1'),
      ).rejects.toThrow(ConflictException);
    });
  });

  // ─── listarDespesasOperacionais ──────────────────────────────────

  describe('listarDespesasOperacionais()', () => {
    it('filtra por cooperativaId (multi-tenant)', async () => {
      prismaMock.contaAPagar.findMany.mockResolvedValueOnce([]);

      await service.listarDespesasOperacionais('coop1', {});

      const args = prismaMock.contaAPagar.findMany.mock.calls[0][0];
      expect(args.where.cooperativaId).toBe('coop1');
    });

    it('aplica filtro statusAprovacao quando passado', async () => {
      prismaMock.contaAPagar.findMany.mockResolvedValueOnce([]);

      await service.listarDespesasOperacionais('coop1', { statusAprovacao: 'PROPOSTA' });

      const args = prismaMock.contaAPagar.findMany.mock.calls[0][0];
      expect(args.where.statusAprovacao).toBe('PROPOSTA');
    });

    it('rejeita sem cooperativaId', async () => {
      await expect(
        service.listarDespesasOperacionais(null, {}),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ─── listarDespesasProprietario ──────────────────────────────────

  describe('listarDespesasProprietario()', () => {
    it('mostra APROVADAS de terceiros + PROPRIAS de qualquer status', async () => {
      prismaMock.usina.findMany.mockResolvedValueOnce([{ id: 'u1' }, { id: 'u2' }]);
      prismaMock.contaAPagar.findMany.mockResolvedValueOnce([]);

      await service.listarDespesasProprietario('usr-prop', 'dono@x.com', null);

      const args = prismaMock.contaAPagar.findMany.mock.calls[0][0];
      expect(args.where.usinaId).toEqual({ in: ['u1', 'u2'] });
      expect(args.where.OR).toEqual([
        { statusAprovacao: 'APROVADA' },
        { propostoPorUsuarioId: 'usr-prop' },
      ]);
    });

    it('retorna [] quando sem email nem cooperadoId', async () => {
      const r = await service.listarDespesasProprietario('usr', null, null);
      expect(r).toEqual([]);
    });

    it('retorna [] quando proprietário sem usinas vinculadas', async () => {
      prismaMock.usina.findMany.mockResolvedValueOnce([]);
      const r = await service.listarDespesasProprietario('usr', 'x@y.com', null);
      expect(r).toEqual([]);
    });

    // BH.2: flag visibilidade configurável
    it('respeita flag Cooperativa.proprietarioVeDespesas=false → retorna []', async () => {
      prismaMock.cooperativa.findUnique.mockResolvedValueOnce({ proprietarioVeDespesas: false });
      const r = await service.listarDespesasProprietario('usr', 'x@y.com', null, 'coop1');
      expect(r).toEqual([]);
      expect(prismaMock.usina.findMany).not.toHaveBeenCalled();
    });

    it('flag visibilidade true → executa fluxo normal', async () => {
      prismaMock.cooperativa.findUnique.mockResolvedValueOnce({ proprietarioVeDespesas: true });
      prismaMock.usina.findMany.mockResolvedValueOnce([{ id: 'u1' }]);
      prismaMock.contaAPagar.findMany.mockResolvedValueOnce([]);
      await service.listarDespesasProprietario('usr', 'x@y.com', null, 'coop1');
      expect(prismaMock.contaAPagar.findMany).toHaveBeenCalled();
    });
  });

  // ─── BH.2 — Disparos notificação async ───────────────────────────

  describe('Notificação async (BH.2 wireup)', () => {
    const dtoBase = {
      usinaId: 'u1', dataOcorrencia: '2026-05-29', categoria: 'CUSD' as any,
      valor: 100, descricao: 'X', quemPagouTipo: 'PROPRIETARIO' as any,
      tratamento: 'REEMBOLSO' as any,
    };

    it('proporDespesa PROPRIETARIO dispara notificarDespesaProposta', async () => {
      prismaMock.usina.findUnique.mockResolvedValueOnce({
        id: 'u1', cooperativaId: 'coop1', responsabilidadeDespesas: {},
      });
      prismaMock.contaAPagar.create.mockResolvedValueOnce({ id: 'd1', statusAprovacao: 'PROPOSTA' });

      await service.proporDespesa(dtoBase as any, 'usr-prop', 'PROPRIETARIO', 'coop1');

      expect(notificacoesMock.notificarDespesaProposta).toHaveBeenCalledWith('d1');
    });

    // BH.3.2: ADMIN agora TAMBÉM dispara notificarDespesaProposta (sempre PROPOSTA)
    it('proporDespesa ADMIN TAMBÉM dispara notificarDespesaProposta (BH.3.2 universal)', async () => {
      prismaMock.usina.findUnique.mockResolvedValueOnce({
        id: 'u1', cooperativaId: 'coop1', responsabilidadeDespesas: {},
      });
      prismaMock.contaAPagar.create.mockResolvedValueOnce({ id: 'd1', statusAprovacao: 'PROPOSTA' });

      await service.proporDespesa(dtoBase as any, 'usr-adm', 'ADMIN', 'coop1');

      expect(notificacoesMock.notificarDespesaProposta).toHaveBeenCalledWith('d1');
    });

    it('aprovarDespesa dispara notificarDespesaAprovada', async () => {
      prismaMock.contaAPagar.findUnique.mockResolvedValueOnce({
        id: 'd1', cooperativaId: 'coop1', statusAprovacao: 'PROPOSTA', propostoPorUsuarioId: 'usr-propos',
      });
      prismaMock.contaAPagar.update.mockResolvedValueOnce({ id: 'd1' });

      await service.aprovarDespesa('d1', 'admin-1', 'coop1');

      expect(notificacoesMock.notificarDespesaAprovada).toHaveBeenCalledWith('d1');
    });

    it('rejeitarDespesa dispara notificarDespesaRejeitada', async () => {
      prismaMock.contaAPagar.findUnique.mockResolvedValueOnce({
        id: 'd1', cooperativaId: 'coop1', statusAprovacao: 'PROPOSTA', propostoPorUsuarioId: 'usr-propos',
      });
      prismaMock.contaAPagar.update.mockResolvedValueOnce({ id: 'd1' });

      await service.rejeitarDespesa('d1', { motivo: 'X' } as any, 'admin-1', 'coop1');

      expect(notificacoesMock.notificarDespesaRejeitada).toHaveBeenCalledWith('d1');
    });
  });
});
