import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConviteProprietarioService } from './convite-proprietario.service';

// Mock Supabase admin createUser
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn().mockReturnValue({
    auth: {
      admin: {
        createUser: jest.fn().mockResolvedValue({
          data: { user: { id: 'supabase-uid-fake' } },
          error: null,
        }),
      },
    },
  }),
}));

describe('ConviteProprietarioService', () => {
  let service: ConviteProprietarioService;
  let prismaMock: any;

  beforeEach(() => {
    prismaMock = {
      usina: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
      },
      conviteProprietario: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      usuario: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
    };
    service = new ConviteProprietarioService(prismaMock);
  });

  // ─── criarConvite ─────────────────────────────────────────────────

  describe('criarConvite', () => {
    const baseInput = {
      usinaId: 'u1',
      email: 'dono@esolares.com',
      criadoPorUserId: 'admin1',
      cooperativaId: 'coop-A',
    };

    it('rejeita email invalido', async () => {
      await expect(
        service.criarConvite({ ...baseInput, email: 'invalido' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejeita usinaId vazio', async () => {
      await expect(
        service.criarConvite({ ...baseInput, usinaId: '' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejeita cooperativaId vazio (multi-tenant guard)', async () => {
      await expect(
        service.criarConvite({ ...baseInput, cooperativaId: '' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throw NotFound se usina nao pertence ao tenant', async () => {
      prismaMock.usina.findFirst.mockResolvedValueOnce(null);
      await expect(service.criarConvite(baseInput)).rejects.toThrow(NotFoundException);
      expect(prismaMock.usina.findFirst).toHaveBeenCalledWith({
        where: { id: 'u1', cooperativaId: 'coop-A' },
        select: { id: true, nome: true },
      });
    });

    it('cria novo convite com token + expiresAt 7d + link', async () => {
      prismaMock.usina.findFirst.mockResolvedValueOnce({ id: 'u1', nome: 'Solar X' });
      prismaMock.conviteProprietario.findFirst.mockResolvedValueOnce(null);
      prismaMock.conviteProprietario.create.mockImplementation(({ data }: any) => ({
        ...data,
        id: 'conv1',
        createdAt: new Date(),
      }));

      const r = await service.criarConvite(baseInput);

      expect(r.id).toBe('conv1');
      expect(r.token).toMatch(/^[a-f0-9]{64}$/);
      expect(r.link).toContain('/proprietario/aceitar-convite/');
      expect(r.reused).toBe(false);
      const ttlMs = r.expiresAt.getTime() - Date.now();
      expect(ttlMs).toBeGreaterThan(6 * 24 * 60 * 60 * 1000);
      expect(ttlMs).toBeLessThan(7.1 * 24 * 60 * 60 * 1000);
    });

    it('REUSA convite pendente existente (idempotencia)', async () => {
      const futuro = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
      prismaMock.usina.findFirst.mockResolvedValueOnce({ id: 'u1', nome: 'Solar X' });
      prismaMock.conviteProprietario.findFirst.mockResolvedValueOnce({
        id: 'conv-pendente',
        token: 'a'.repeat(64),
        email: 'dono@esolares.com',
        usinaId: 'u1',
        expiresAt: futuro,
        usedAt: null,
      });

      const r = await service.criarConvite(baseInput);
      expect(r.id).toBe('conv-pendente');
      expect(r.reused).toBe(true);
      expect(prismaMock.conviteProprietario.create).not.toHaveBeenCalled();
    });
  });

  // ─── validarToken ─────────────────────────────────────────────────

  describe('validarToken', () => {
    it('token vazio → invalido', async () => {
      const r = await service.validarToken('');
      expect(r.valido).toBe(false);
      expect(r.motivo).toMatch(/ausente/i);
    });

    it('token nao encontrado → invalido', async () => {
      prismaMock.conviteProprietario.findUnique.mockResolvedValueOnce(null);
      const r = await service.validarToken('token-fake');
      expect(r.valido).toBe(false);
      expect(r.motivo).toMatch(/encontrado/i);
    });

    it('convite usado → invalido', async () => {
      prismaMock.conviteProprietario.findUnique.mockResolvedValueOnce({
        usedAt: new Date(),
        expiresAt: new Date(Date.now() + 86400000),
        usina: { nome: 'X' },
      });
      const r = await service.validarToken('t');
      expect(r.valido).toBe(false);
      expect(r.motivo).toMatch(/utilizado/i);
    });

    it('convite expirado → invalido', async () => {
      prismaMock.conviteProprietario.findUnique.mockResolvedValueOnce({
        usedAt: null,
        expiresAt: new Date(Date.now() - 1000),
        usina: { nome: 'X' },
      });
      const r = await service.validarToken('t');
      expect(r.valido).toBe(false);
      expect(r.motivo).toMatch(/expirado/i);
    });

    it('convite valido → retorna dados', async () => {
      prismaMock.conviteProprietario.findUnique.mockResolvedValueOnce({
        usedAt: null,
        expiresAt: new Date(Date.now() + 86400000),
        usinaId: 'u1',
        email: 'a@b.com',
        usina: { nome: 'Solar Y' },
      });
      const r = await service.validarToken('t');
      expect(r.valido).toBe(true);
      expect(r.dados?.usinaNome).toBe('Solar Y');
    });
  });

  // ─── aceitarConvite ──────────────────────────────────────────────

  describe('aceitarConvite', () => {
    function setupTokenValido() {
      prismaMock.conviteProprietario.findUnique.mockResolvedValue({
        id: 'conv1',
        usedAt: null,
        expiresAt: new Date(Date.now() + 86400000),
        usinaId: 'u1',
        email: 'dono@esolares.com',
        usina: { nome: 'Solar X' },
      });
      prismaMock.usina.findUnique.mockResolvedValue({ cooperativaId: 'coop-A' });
      prismaMock.usuario.findUnique.mockResolvedValue(null); // nao existe ainda
      prismaMock.usuario.create.mockResolvedValue({
        id: 'usr-novo',
        email: 'dono@esolares.com',
      });
      prismaMock.conviteProprietario.update.mockResolvedValue({});
    }

    it('rejeita senha curta (<8)', async () => {
      await expect(service.aceitarConvite('t', 'curta')).rejects.toThrow(BadRequestException);
    });

    it('rejeita senha sem letra', async () => {
      await expect(service.aceitarConvite('t', '12345678')).rejects.toThrow(BadRequestException);
    });

    it('rejeita senha sem numero', async () => {
      await expect(service.aceitarConvite('t', 'apenasletras')).rejects.toThrow(BadRequestException);
    });

    it('rejeita token invalido', async () => {
      prismaMock.conviteProprietario.findUnique.mockResolvedValueOnce(null);
      await expect(service.aceitarConvite('t', 'SenhaForte123')).rejects.toThrow(UnauthorizedException);
    });

    it('cria Usuario PROPRIETARIO + marca convite usado', async () => {
      setupTokenValido();
      const r = await service.aceitarConvite('t', 'SenhaForte123');
      expect(r.usuarioId).toBe('usr-novo');
      expect(r.usinaNome).toBe('Solar X');
      // Verifica que usuario.create foi chamado com perfil PROPRIETARIO
      const createArg = prismaMock.usuario.create.mock.calls[0][0];
      expect(createArg.data.perfil).toBe('PROPRIETARIO');
      expect(createArg.data.email).toBe('dono@esolares.com');
      expect(createArg.data.cooperativaId).toBe('coop-A');
      // Marca convite usado
      expect(prismaMock.conviteProprietario.update).toHaveBeenCalled();
    });

    it('throws e marca convite usado se Usuario com email ja existe', async () => {
      prismaMock.conviteProprietario.findUnique.mockResolvedValue({
        id: 'conv1',
        usedAt: null,
        expiresAt: new Date(Date.now() + 86400000),
        usinaId: 'u1',
        email: 'jaexiste@x.com',
        usina: { nome: 'Solar X' },
      });
      prismaMock.usuario.findUnique.mockResolvedValueOnce({ id: 'usr-existente' });
      prismaMock.conviteProprietario.update.mockResolvedValue({});

      await expect(service.aceitarConvite('t', 'SenhaForte123')).rejects.toThrow(BadRequestException);
      // Convite marcado como usado mesmo na exception (evita reuso)
      expect(prismaMock.conviteProprietario.update).toHaveBeenCalled();
    });
  });

  // ─── listarPorUsina ──────────────────────────────────────────────

  describe('listarPorUsina', () => {
    it('multi-tenant: rejeita usina fora do tenant', async () => {
      prismaMock.usina.findFirst.mockResolvedValueOnce(null);
      await expect(service.listarPorUsina('u1', 'coop-A')).rejects.toThrow(NotFoundException);
    });

    it('deriva status PENDENTE/USADO/EXPIRADO', async () => {
      const agora = new Date();
      prismaMock.usina.findFirst.mockResolvedValueOnce({ id: 'u1' });
      prismaMock.conviteProprietario.findMany.mockResolvedValueOnce([
        // PENDENTE
        { id: 'c1', email: 'a@x.com', token: 'a'.repeat(64), usedAt: null, expiresAt: new Date(agora.getTime() + 86400000), createdAt: agora, createdBy: 'admin1' },
        // USADO
        { id: 'c2', email: 'b@x.com', token: 'b'.repeat(64), usedAt: new Date(), expiresAt: new Date(agora.getTime() + 86400000), createdAt: agora, createdBy: 'admin1' },
        // EXPIRADO
        { id: 'c3', email: 'c@x.com', token: 'c'.repeat(64), usedAt: null, expiresAt: new Date(agora.getTime() - 1000), createdAt: agora, createdBy: 'admin1' },
      ]);

      const r = await service.listarPorUsina('u1', 'coop-A');
      expect(r).toHaveLength(3);
      expect(r[0].status).toBe('PENDENTE');
      expect(r[1].status).toBe('USADO');
      expect(r[2].status).toBe('EXPIRADO');
      // Token nao retornado integralmente (defesa em profundidade)
      expect((r[0] as any).token).toBeUndefined();
      expect(r[0].tokenSufixo).toMatch(/^\.\.\./);
    });
  });

  // ─── reenviar ────────────────────────────────────────────────────

  describe('reenviar', () => {
    it('throw NotFound se convite nao existe', async () => {
      prismaMock.conviteProprietario.findUnique.mockResolvedValueOnce(null);
      await expect(service.reenviar('conv1', 'coop-A')).rejects.toThrow(NotFoundException);
    });

    it('throw Forbidden se convite eh de outro tenant', async () => {
      prismaMock.conviteProprietario.findUnique.mockResolvedValueOnce({
        id: 'conv1',
        usedAt: null,
        usina: { cooperativaId: 'coop-OUTRA' },
      });
      await expect(service.reenviar('conv1', 'coop-A')).rejects.toThrow(ForbiddenException);
    });

    it('throw BadRequest se convite ja usado', async () => {
      prismaMock.conviteProprietario.findUnique.mockResolvedValueOnce({
        id: 'conv1',
        usedAt: new Date(),
        usina: { cooperativaId: 'coop-A' },
      });
      await expect(service.reenviar('conv1', 'coop-A')).rejects.toThrow(BadRequestException);
    });

    it('regenera token + estende expiresAt', async () => {
      prismaMock.conviteProprietario.findUnique.mockResolvedValueOnce({
        id: 'conv1',
        usedAt: null,
        usina: { cooperativaId: 'coop-A' },
      });
      prismaMock.conviteProprietario.update.mockResolvedValueOnce({
        id: 'conv1',
        token: 'novo-token-fake',
        expiresAt: new Date(Date.now() + 7 * 86400000),
      });
      const r = await service.reenviar('conv1', 'coop-A');
      expect(r.token).toBe('novo-token-fake');
      expect(prismaMock.conviteProprietario.update).toHaveBeenCalled();
    });
  });

  // ─── cancelar ────────────────────────────────────────────────────

  describe('cancelar', () => {
    it('throw NotFound se nao existe', async () => {
      prismaMock.conviteProprietario.findUnique.mockResolvedValueOnce(null);
      await expect(service.cancelar('c1', 'coop-A')).rejects.toThrow(NotFoundException);
    });

    it('throw Forbidden se tenant divergente', async () => {
      prismaMock.conviteProprietario.findUnique.mockResolvedValueOnce({
        usedAt: null,
        usina: { cooperativaId: 'coop-OUTRA' },
      });
      await expect(service.cancelar('c1', 'coop-A')).rejects.toThrow(ForbiddenException);
    });

    it('DELETE real do registro', async () => {
      prismaMock.conviteProprietario.findUnique.mockResolvedValueOnce({
        id: 'c1', usedAt: null, usina: { cooperativaId: 'coop-A' },
      });
      prismaMock.conviteProprietario.delete.mockResolvedValueOnce({});
      const r = await service.cancelar('c1', 'coop-A');
      expect(r.cancelado).toBe(true);
      expect(prismaMock.conviteProprietario.delete).toHaveBeenCalledWith({ where: { id: 'c1' } });
    });
  });

  // ─── cadastroManual ─────────────────────────────────────────────

  describe('cadastroManual', () => {
    const input = {
      nome: 'E-Solares',
      email: 'esolares@example.com',
      senhaTemp: 'TempSenha123',
      usinaId: 'u1',
      criadoPorUserId: 'admin1',
      cooperativaId: 'coop-A',
    };

    it('rejeita nome curto', async () => {
      await expect(service.cadastroManual({ ...input, nome: 'A' })).rejects.toThrow(BadRequestException);
    });

    it('rejeita senha < 8', async () => {
      await expect(service.cadastroManual({ ...input, senhaTemp: 'short' })).rejects.toThrow(BadRequestException);
    });

    it('multi-tenant: usina fora do tenant → NotFound', async () => {
      prismaMock.usina.findFirst.mockResolvedValueOnce(null);
      await expect(service.cadastroManual(input)).rejects.toThrow(NotFoundException);
    });

    it('cria Usuario + retorna credenciais', async () => {
      prismaMock.usina.findFirst.mockResolvedValueOnce({ id: 'u1', nome: 'Solar X' });
      prismaMock.usuario.findUnique.mockResolvedValueOnce(null);
      prismaMock.usuario.create.mockResolvedValueOnce({
        id: 'usr-novo',
        email: input.email,
      });
      const r = await service.cadastroManual(input);
      expect(r.usuarioId).toBe('usr-novo');
      expect(r.email).toBe(input.email);
      expect(r.senhaTemp).toBe(input.senhaTemp); // retornada uma vez pra admin copiar
      // Perfil PROPRIETARIO
      const createArg = prismaMock.usuario.create.mock.calls[0][0];
      expect(createArg.data.perfil).toBe('PROPRIETARIO');
      expect(createArg.data.cooperativaId).toBe('coop-A');
    });

    it('rejeita se email ja existe', async () => {
      prismaMock.usina.findFirst.mockResolvedValueOnce({ id: 'u1', nome: 'Solar X' });
      prismaMock.usuario.findUnique.mockResolvedValueOnce({ id: 'usr-existente' });
      await expect(service.cadastroManual(input)).rejects.toThrow(BadRequestException);
    });
  });
});
