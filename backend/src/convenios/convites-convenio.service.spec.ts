import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ConvitesConvenioService } from './convites-convenio.service';

/**
 * Sprint Convite-Convênio Fatia 2a (03/06/2026) — Specs do service.
 *
 * Cobre:
 *  1. normalizarTelefoneBR: formatos aceitos/rejeitados.
 *  2. criarConvite: cria novo + retorna link.
 *  3. criarConvite reuse-if-alive: já existe vivo → reusa (mesmo token).
 *  4. criarConvite recreate: existente expirado/usado → deleta + recria.
 *  5. criarConvite multi-tenant: convênio de outro tenant → NotFound.
 *  6. criarConvite valida pagador=EMPRESA + status=ATIVO.
 *  7. validarToken: existente/usado/expirado/inexistente.
 *  8. cancelar bloqueia convite usado.
 *  9. reenviarConvite regenera token + estende TTL.
 *
 * Contatos teste regra 14/05: 27981341348 (telefone) + lucbragatto@gmail.com.
 */
describe('ConvitesConvenioService — Fatia 2a', () => {
  // Mocks Prisma
  const findFirstConvenio = jest.fn();
  const findUniqueConvite = jest.fn();
  const findManyConvites = jest.fn();
  const createConvite = jest.fn();
  const updateConvite = jest.fn();
  const deleteConvite = jest.fn();

  const prismaMock = {
    contratoConvenio: { findFirst: findFirstConvenio },
    conviteConvenioMembro: {
      findUnique: findUniqueConvite,
      findMany: findManyConvites,
      create: createConvite,
      update: updateConvite,
      delete: deleteConvite,
    },
  } as any;

  // Mock do WhatsappSender
  const enviarMensagem = jest.fn().mockResolvedValue(undefined);
  const waSenderMock = { enviarMensagem } as any;

  let service: ConvitesConvenioService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ConvitesConvenioService(prismaMock, waSenderMock);

    findFirstConvenio.mockResolvedValue({
      id: 'conv1',
      status: 'ATIVO',
      pagador: 'EMPRESA',
      empresaNome: 'Clínica Teste',
    });
    findUniqueConvite.mockResolvedValue(null); // sem convite existente por padrão
  });

  describe('normalizarTelefoneBR', () => {
    it('aceita "(27) 99876-5432" → "5527998765432"', () => {
      expect(ConvitesConvenioService.normalizarTelefoneBR('(27) 99876-5432'))
        .toBe('5527998765432');
    });

    it('aceita "27998765432" → "5527998765432" (sem país, com 9)', () => {
      expect(ConvitesConvenioService.normalizarTelefoneBR('27998765432'))
        .toBe('5527998765432');
    });

    it('aceita "2799876543" → "5527999876543" (10 dígitos sem 9 → adiciona)', () => {
      // DDD 27 + 8 dígitos = 10 → adiciona 9 da operadora após DDD
      // Mas só faz isso se "semPais.length === 10". Sem país (10 dig) + 55 = 12 → ok.
      const r = ConvitesConvenioService.normalizarTelefoneBR('2799876543');
      expect(r).toBe('5527999876543');
    });

    it('aceita "5527998765432" → "5527998765432" (já normalizado)', () => {
      expect(ConvitesConvenioService.normalizarTelefoneBR('5527998765432'))
        .toBe('5527998765432');
    });

    it('rejeita vazio', () => {
      expect(() => ConvitesConvenioService.normalizarTelefoneBR(''))
        .toThrow(BadRequestException);
    });

    it('rejeita comprimento errado pós-normalização (ex.: muito curto)', () => {
      expect(() => ConvitesConvenioService.normalizarTelefoneBR('1234'))
        .toThrow(BadRequestException);
    });

    it('regra contatos teste 14/05: 27981341348 normaliza corretamente', () => {
      expect(ConvitesConvenioService.normalizarTelefoneBR('27981341348'))
        .toBe('5527981341348');
    });
  });

  describe('criarConvite — caminho feliz', () => {
    it('cria convite novo + retorna token + link + expiresAt 7d', async () => {
      const conviteCriado = {
        id: 'conv-novo',
        token: 'a'.repeat(64),
        nomeConvidado: 'Dr. João',
        telefone: '5527981341348',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      };
      createConvite.mockResolvedValue(conviteCriado);

      const antes = Date.now();
      const r = await service.criarConvite({
        convenioId: 'conv1',
        nomeConvidado: 'Dr. João',
        telefone: '(27) 98134-1348',
        criadoPorUserId: 'user-admin',
        cooperativaId: 'coop-A',
      });
      const depois = Date.now();

      expect(r.id).toBe('conv-novo');
      expect(r.token).toBe('a'.repeat(64));
      expect(r.telefone).toBe('5527981341348');
      expect(r.empresaNome).toBe('Clínica Teste');
      expect(r.reused).toBe(false);
      expect(r.link).toContain('/convite/' + 'a'.repeat(64));

      // Confirma que normalizou + passou pra prisma o telefone normalizado
      const callArgs = createConvite.mock.calls[0][0];
      expect(callArgs.data.telefone).toBe('5527981341348');
      expect(callArgs.data.cooperativaId).toBe('coop-A');
      expect(callArgs.data.createdBy).toBe('user-admin');
      expect(callArgs.data.token).toMatch(/^[0-9a-f]{64}$/);
      const exp = callArgs.data.expiresAt.getTime();
      const seteDias = 7 * 24 * 60 * 60 * 1000;
      expect(exp).toBeGreaterThanOrEqual(antes + seteDias - 1000);
      expect(exp).toBeLessThanOrEqual(depois + seteDias + 1000);
    });
  });

  describe('criarConvite — reuse-if-alive', () => {
    it('convite existente vivo (não usado, não expirado) → REUSA mesmo token', async () => {
      const conviteExistente = {
        id: 'conv-velho',
        token: 'b'.repeat(64),
        nomeConvidado: 'Dr. João',
        telefone: '5527981341348',
        usedAt: null,
        expiresAt: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000), // ainda vivo
      };
      findUniqueConvite.mockResolvedValueOnce(conviteExistente);

      const r = await service.criarConvite({
        convenioId: 'conv1',
        nomeConvidado: 'Dr. João',
        telefone: '27981341348',
        criadoPorUserId: 'user-admin',
        cooperativaId: 'coop-A',
      });

      expect(r.reused).toBe(true);
      expect(r.id).toBe('conv-velho');
      expect(r.token).toBe('b'.repeat(64));
      // NÃO chamou create
      expect(createConvite).not.toHaveBeenCalled();
      expect(deleteConvite).not.toHaveBeenCalled();
    });

    it('convite existente USADO → deleta antigo + cria novo', async () => {
      const conviteExistente = {
        id: 'conv-velho',
        token: 'c'.repeat(64),
        usedAt: new Date(),
        expiresAt: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000),
      };
      findUniqueConvite.mockResolvedValueOnce(conviteExistente);
      createConvite.mockResolvedValue({
        id: 'conv-novo',
        token: 'd'.repeat(64),
        nomeConvidado: 'Dr. João',
        telefone: '5527981341348',
        expiresAt: new Date(),
      });

      const r = await service.criarConvite({
        convenioId: 'conv1',
        nomeConvidado: 'Dr. João',
        telefone: '27981341348',
        criadoPorUserId: 'user-admin',
        cooperativaId: 'coop-A',
      });

      expect(deleteConvite).toHaveBeenCalledWith({ where: { id: 'conv-velho' } });
      expect(createConvite).toHaveBeenCalledTimes(1);
      expect(r.reused).toBe(false);
      expect(r.id).toBe('conv-novo');
    });

    it('convite existente EXPIRADO → deleta antigo + cria novo', async () => {
      const conviteExistente = {
        id: 'conv-velho',
        token: 'e'.repeat(64),
        usedAt: null,
        expiresAt: new Date(Date.now() - 1000), // expirou
      };
      findUniqueConvite.mockResolvedValueOnce(conviteExistente);
      createConvite.mockResolvedValue({
        id: 'conv-novo',
        token: 'f'.repeat(64),
        nomeConvidado: 'Dr. João',
        telefone: '5527981341348',
        expiresAt: new Date(),
      });

      const r = await service.criarConvite({
        convenioId: 'conv1',
        nomeConvidado: 'Dr. João',
        telefone: '27981341348',
        criadoPorUserId: 'user-admin',
        cooperativaId: 'coop-A',
      });

      expect(deleteConvite).toHaveBeenCalledTimes(1);
      expect(r.reused).toBe(false);
    });
  });

  describe('criarConvite — validações', () => {
    it('convenio de outro tenant → NotFound', async () => {
      findFirstConvenio.mockResolvedValue(null);
      await expect(
        service.criarConvite({
          convenioId: 'conv1',
          nomeConvidado: 'Dr. João',
          telefone: '27981341348',
          criadoPorUserId: 'u1',
          cooperativaId: 'coop-B',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('convenio inativo → BadRequest', async () => {
      findFirstConvenio.mockResolvedValue({
        id: 'conv1',
        status: 'SUSPENSO',
        pagador: 'EMPRESA',
        empresaNome: 'X',
      });
      await expect(
        service.criarConvite({
          convenioId: 'conv1',
          nomeConvidado: 'Dr. João',
          telefone: '27981341348',
          criadoPorUserId: 'u1',
          cooperativaId: 'coop-A',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('pagador != EMPRESA → BadRequest (não é Caso 1 custeio)', async () => {
      findFirstConvenio.mockResolvedValue({
        id: 'conv1',
        status: 'ATIVO',
        pagador: 'CADA_MEMBRO',
        empresaNome: 'X',
      });
      await expect(
        service.criarConvite({
          convenioId: 'conv1',
          nomeConvidado: 'Dr. João',
          telefone: '27981341348',
          criadoPorUserId: 'u1',
          cooperativaId: 'coop-A',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('nomeConvidado < 2 chars → BadRequest', async () => {
      await expect(
        service.criarConvite({
          convenioId: 'conv1',
          nomeConvidado: 'X',
          telefone: '27981341348',
          criadoPorUserId: 'u1',
          cooperativaId: 'coop-A',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('validarToken', () => {
    it('token vivo → retorna dados (sufixo telefone, não integral)', async () => {
      findUniqueConvite.mockResolvedValue({
        id: 'conv1',
        token: 'a'.repeat(64),
        usedAt: null,
        expiresAt: new Date(Date.now() + 1000 * 60 * 60),
        telefone: '5527981341348',
        nomeConvidado: 'Dr. João',
        otpValidadoEm: null,
        convenio: { empresaNome: 'Clínica Teste' },
      });

      const r = await service.validarToken('a'.repeat(64));

      expect(r.valido).toBe(true);
      expect(r.dados?.empresaNome).toBe('Clínica Teste');
      expect(r.dados?.nomeConvidado).toBe('Dr. João');
      expect(r.dados?.telefoneSufixo).toBe('...1348');
      // Defesa LGPD: NÃO retorna telefone integral
      expect(JSON.stringify(r)).not.toContain('5527981341348');
    });

    it('token inexistente → inválido', async () => {
      findUniqueConvite.mockResolvedValue(null);
      const r = await service.validarToken('xxx');
      expect(r.valido).toBe(false);
      expect(r.motivo).toMatch(/não encontrado/i);
    });

    it('token usado → inválido', async () => {
      findUniqueConvite.mockResolvedValue({
        usedAt: new Date(),
        expiresAt: new Date(Date.now() + 10000),
        convenio: { empresaNome: 'X' },
      });
      const r = await service.validarToken('xxx');
      expect(r.valido).toBe(false);
      expect(r.motivo).toMatch(/utilizado/i);
    });

    it('token expirado → inválido', async () => {
      findUniqueConvite.mockResolvedValue({
        usedAt: null,
        expiresAt: new Date(Date.now() - 1000),
        convenio: { empresaNome: 'X' },
      });
      const r = await service.validarToken('xxx');
      expect(r.valido).toBe(false);
      expect(r.motivo).toMatch(/expirado/i);
    });

    it('token vazio → inválido sem hit no banco', async () => {
      const r = await service.validarToken('');
      expect(r.valido).toBe(false);
      expect(findUniqueConvite).not.toHaveBeenCalled();
    });
  });

  describe('cancelar', () => {
    it('convite vivo → deleta', async () => {
      findUniqueConvite.mockResolvedValue({
        id: 'c1',
        cooperativaId: 'coop-A',
        usedAt: null,
      });
      deleteConvite.mockResolvedValue({});

      const r = await service.cancelar('c1', 'coop-A');

      expect(r.cancelado).toBe(true);
      expect(deleteConvite).toHaveBeenCalledWith({ where: { id: 'c1' } });
    });

    it('convite USADO → BadRequest (não cancela)', async () => {
      findUniqueConvite.mockResolvedValue({
        id: 'c1',
        cooperativaId: 'coop-A',
        usedAt: new Date(),
      });
      await expect(service.cancelar('c1', 'coop-A')).rejects.toThrow(BadRequestException);
      expect(deleteConvite).not.toHaveBeenCalled();
    });

    it('convite de outro tenant → Forbidden', async () => {
      findUniqueConvite.mockResolvedValue({
        id: 'c1',
        cooperativaId: 'coop-B',
        usedAt: null,
      });
      await expect(service.cancelar('c1', 'coop-A')).rejects.toThrow(ForbiddenException);
    });
  });

  describe('reenviarConvite', () => {
    it('regenera token + estende TTL', async () => {
      findUniqueConvite.mockResolvedValue({
        id: 'c1',
        cooperativaId: 'coop-A',
        usedAt: null,
      });
      const tokenAntigo = 'a'.repeat(64);
      const tokenNovo = 'b'.repeat(64);
      updateConvite.mockResolvedValue({
        id: 'c1',
        token: tokenNovo,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

      const r = await service.reenviarConvite('c1', 'coop-A');

      expect(r.token).toBe(tokenNovo);
      expect(r.token).not.toBe(tokenAntigo);
      expect(updateConvite).toHaveBeenCalledWith({
        where: { id: 'c1' },
        data: expect.objectContaining({
          token: expect.stringMatching(/^[0-9a-f]{64}$/),
          expiresAt: expect.any(Date),
        }),
      });
    });

    it('convite USADO → BadRequest (não reenvia)', async () => {
      findUniqueConvite.mockResolvedValue({
        id: 'c1',
        cooperativaId: 'coop-A',
        usedAt: new Date(),
      });
      await expect(service.reenviarConvite('c1', 'coop-A')).rejects.toThrow(BadRequestException);
    });
  });
});
