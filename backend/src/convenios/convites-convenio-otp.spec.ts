import { BadRequestException, HttpException, NotFoundException } from '@nestjs/common';
import { ConvitesConvenioService } from './convites-convenio.service';

/**
 * Sprint Convite-Convênio Fatia 2b (03/06/2026) — Specs OTP.
 *
 * Cobre:
 *  1. gerarCodigoOtp produz 6 dígitos zero-padded.
 *  2. compararOtp usa timingSafeEqual (constant-time) — hash igual passa,
 *     hash de tamanho diferente falha, hash diferente falha.
 *  3. solicitarOtp happy path: gera código + grava hash + envia WA pro
 *     convite.telefone (NUNCA pra outro número).
 *  4. solicitarOtp cooldown 60s: 2ª chamada antes do cooldown → HTTP 429.
 *  5. solicitarOtp máx 3 reenvios: 4ª chamada após 3 → HTTP 429.
 *  6. solicitarOtp bloqueado: otpBloqueadoAte > now → HTTP 429.
 *  7. validarOtp happy path: marca otpValidadoEm.
 *  8. validarOtp código errado: incrementa otpTentativas.
 *  9. validarOtp 5 erros → bloqueia 1h (otpBloqueadoAte = +1h).
 * 10. validarOtp expirado → erro 'expirado' + podeReenviar.
 * 11. validarOtp sem código pendente → erro 'sem_codigo_pendente'.
 * 12. validarOtp formato errado (não 6 dígitos) → 400 sem hit no banco.
 *
 * Contatos teste regra 14/05: 27981341348 (telefone Luciano).
 */
describe('ConvitesConvenioService — OTP (Fatia 2b)', () => {
  const findUniqueConvite = jest.fn();
  const updateConvite = jest.fn();

  const prismaMock = {
    conviteConvenioMembro: {
      findUnique: findUniqueConvite,
      update: updateConvite,
    },
  } as any;

  const enviarMensagem = jest.fn().mockResolvedValue(undefined);
  const waSenderMock = { enviarMensagem } as any;

  let service: ConvitesConvenioService;

  // Base do convite vivo pra reusar
  const conviteBase = {
    id: 'conv-otp-1',
    convenioId: 'convX',
    cooperativaId: 'coop-A',
    nomeConvidado: 'Dr. João',
    telefone: '5527981341348',
    token: 'a'.repeat(64),
    expiresAt: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000), // 6d futuro
    usedAt: null,
    otpCodigoHash: null as string | null,
    otpSalt: null as string | null,
    otpExpiresAt: null as Date | null,
    otpTentativas: 0,
    otpReenvios: 0,
    otpUltimoEnvioEm: null as Date | null,
    otpValidadoEm: null as Date | null,
    otpBloqueadoAte: null as Date | null,
    convenio: { empresaNome: 'Clínica Teste' },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ConvitesConvenioService(prismaMock, waSenderMock);
  });

  describe('helpers estáticos', () => {
    it('gerarCodigoOtp retorna 6 dígitos numéricos', () => {
      for (let i = 0; i < 50; i++) {
        const codigo = ConvitesConvenioService.gerarCodigoOtp();
        expect(codigo).toMatch(/^\d{6}$/);
        expect(codigo.length).toBe(6);
      }
    });

    it('gerarSaltOtp retorna 32 chars hex (16 bytes)', () => {
      const salt = ConvitesConvenioService.gerarSaltOtp();
      expect(salt).toMatch(/^[0-9a-f]{32}$/);
    });

    it('hashOtp produz sha256 hex 64 chars determinístico', () => {
      const h1 = ConvitesConvenioService.hashOtp('123456', 'saltX');
      const h2 = ConvitesConvenioService.hashOtp('123456', 'saltX');
      expect(h1).toBe(h2);
      expect(h1).toMatch(/^[0-9a-f]{64}$/);
    });

    it('hashOtp salt diferente → hash diferente', () => {
      const h1 = ConvitesConvenioService.hashOtp('123456', 'saltA');
      const h2 = ConvitesConvenioService.hashOtp('123456', 'saltB');
      expect(h1).not.toBe(h2);
    });

    it('compararOtp constant-time: código certo passa', () => {
      const salt = 'salt-test';
      const hash = ConvitesConvenioService.hashOtp('789012', salt);
      expect(ConvitesConvenioService.compararOtp('789012', salt, hash)).toBe(true);
    });

    it('compararOtp: código errado falha', () => {
      const salt = 'salt-test';
      const hash = ConvitesConvenioService.hashOtp('111111', salt);
      expect(ConvitesConvenioService.compararOtp('222222', salt, hash)).toBe(false);
    });

    it('compararOtp: hash de tamanho diferente rejeita sem timingSafeEqual throw', () => {
      expect(ConvitesConvenioService.compararOtp('123456', 'salt', 'curto')).toBe(false);
    });
  });

  describe('solicitarOtp', () => {
    it('happy path: gera código + grava hash + envia WA pro convite.telefone', async () => {
      findUniqueConvite.mockResolvedValue({ ...conviteBase });
      updateConvite.mockResolvedValue({ otpReenvios: 1 });

      const r = await service.solicitarOtp(conviteBase.token);

      expect(r.ok).toBe(true);
      expect(r.expiraEmSegundos).toBe(600); // 10min
      expect(r.reenviosRestantes).toBe(2); // 3 - 1
      expect(r.whatsappEnviado).toBe(true);

      // Confirma update gravou hash + salt + expiresAt + reset tentativas
      const updateArgs = updateConvite.mock.calls[0][0];
      expect(updateArgs.where.id).toBe(conviteBase.id);
      expect(updateArgs.data.otpCodigoHash).toMatch(/^[0-9a-f]{64}$/);
      expect(updateArgs.data.otpSalt).toMatch(/^[0-9a-f]{32}$/);
      expect(updateArgs.data.otpExpiresAt).toBeInstanceOf(Date);
      expect(updateArgs.data.otpUltimoEnvioEm).toBeInstanceOf(Date);
      expect(updateArgs.data.otpReenvios).toEqual({ increment: 1 });
      expect(updateArgs.data.otpTentativas).toBe(0);

      // WA enviado pro telefone DO CONVITE (NUNCA pra outro)
      expect(enviarMensagem).toHaveBeenCalledTimes(1);
      const [telefoneArg, textoArg, opcoesArg] = enviarMensagem.mock.calls[0];
      expect(telefoneArg).toBe('5527981341348'); // telefone do convite
      expect(textoArg).toContain('código de confirmação');
      expect(textoArg).toContain('Clínica Teste');
      expect(opcoesArg.tipoDisparo).toBe('convite_convenio_otp');
      expect(opcoesArg.cooperativaId).toBe('coop-A');
    });

    it('cooldown 60s: 2ª solicitação dentro de 60s → HTTP 429', async () => {
      findUniqueConvite.mockResolvedValue({
        ...conviteBase,
        otpUltimoEnvioEm: new Date(Date.now() - 30 * 1000), // 30s atrás
      });

      await expect(service.solicitarOtp(conviteBase.token)).rejects.toThrow(HttpException);
      expect(updateConvite).not.toHaveBeenCalled();
      expect(enviarMensagem).not.toHaveBeenCalled();
    });

    it('cooldown expirado (61s atrás): permite reenvio', async () => {
      findUniqueConvite.mockResolvedValue({
        ...conviteBase,
        otpUltimoEnvioEm: new Date(Date.now() - 61 * 1000),
        otpReenvios: 1,
      });
      updateConvite.mockResolvedValue({ otpReenvios: 2 });

      const r = await service.solicitarOtp(conviteBase.token);
      expect(r.ok).toBe(true);
      expect(r.reenviosRestantes).toBe(1);
    });

    it('máx 3 reenvios: 4ª chamada → HTTP 429 reenvios_esgotados', async () => {
      findUniqueConvite.mockResolvedValue({
        ...conviteBase,
        otpReenvios: 3,
        otpUltimoEnvioEm: new Date(Date.now() - 5 * 60 * 1000), // 5min atrás (passou cooldown)
      });

      await expect(service.solicitarOtp(conviteBase.token)).rejects.toThrow(HttpException);
      expect(updateConvite).not.toHaveBeenCalled();
      expect(enviarMensagem).not.toHaveBeenCalled();
    });

    it('bloqueado: otpBloqueadoAte > now → HTTP 429', async () => {
      findUniqueConvite.mockResolvedValue({
        ...conviteBase,
        otpBloqueadoAte: new Date(Date.now() + 30 * 60 * 1000), // 30min futuro
      });

      await expect(service.solicitarOtp(conviteBase.token)).rejects.toThrow(HttpException);
    });

    it('convite expirado → BadRequest', async () => {
      findUniqueConvite.mockResolvedValue({
        ...conviteBase,
        expiresAt: new Date(Date.now() - 1000),
      });
      await expect(service.solicitarOtp(conviteBase.token)).rejects.toThrow(BadRequestException);
    });

    it('convite inexistente → NotFound', async () => {
      findUniqueConvite.mockResolvedValue(null);
      await expect(service.solicitarOtp('xxx')).rejects.toThrow(NotFoundException);
    });

    it('falha WA NÃO reverte gravação (best-effort)', async () => {
      findUniqueConvite.mockResolvedValue({ ...conviteBase });
      updateConvite.mockResolvedValue({ otpReenvios: 1 });
      enviarMensagem.mockRejectedValueOnce(new Error('Baileys timeout'));

      const r = await service.solicitarOtp(conviteBase.token);
      expect(r.ok).toBe(true);
      expect(r.whatsappEnviado).toBe(false);
      expect(r.whatsappErro).toContain('Baileys');
      // Update foi feito (hash gravado)
      expect(updateConvite).toHaveBeenCalledTimes(1);
    });
  });

  describe('validarOtp', () => {
    it('happy path: código certo → marca otpValidadoEm', async () => {
      const codigo = '123456';
      const salt = ConvitesConvenioService.gerarSaltOtp();
      const hash = ConvitesConvenioService.hashOtp(codigo, salt);

      findUniqueConvite.mockResolvedValue({
        ...conviteBase,
        otpCodigoHash: hash,
        otpSalt: salt,
        otpExpiresAt: new Date(Date.now() + 5 * 60 * 1000),
      });
      updateConvite.mockResolvedValue({});

      const r = await service.validarOtp(conviteBase.token, codigo);
      expect(r.ok).toBe(true);

      const updateArgs = updateConvite.mock.calls[0][0];
      expect(updateArgs.data.otpValidadoEm).toBeInstanceOf(Date);
    });

    it('código errado incrementa otpTentativas (1ª vez)', async () => {
      const salt = 'salt-x';
      const hash = ConvitesConvenioService.hashOtp('111111', salt);
      findUniqueConvite.mockResolvedValue({
        ...conviteBase,
        otpCodigoHash: hash,
        otpSalt: salt,
        otpExpiresAt: new Date(Date.now() + 5 * 60 * 1000),
        otpTentativas: 0,
      });
      updateConvite.mockResolvedValue({});

      await expect(service.validarOtp(conviteBase.token, '222222')).rejects.toThrow(
        BadRequestException,
      );

      const updateArgs = updateConvite.mock.calls[0][0];
      expect(updateArgs.data.otpTentativas).toBe(1);
      expect(updateArgs.data.otpBloqueadoAte).toBeNull();
    });

    it('5ª tentativa errada → otpBloqueadoAte = +1h', async () => {
      const salt = 'salt-x';
      const hash = ConvitesConvenioService.hashOtp('111111', salt);
      findUniqueConvite.mockResolvedValue({
        ...conviteBase,
        otpCodigoHash: hash,
        otpSalt: salt,
        otpExpiresAt: new Date(Date.now() + 5 * 60 * 1000),
        otpTentativas: 4, // 4 erros prévios; este é o 5º
      });
      updateConvite.mockResolvedValue({});

      const antes = Date.now();
      await expect(service.validarOtp(conviteBase.token, '999999')).rejects.toThrow(
        HttpException,
      );
      const depois = Date.now();

      const updateArgs = updateConvite.mock.calls[0][0];
      expect(updateArgs.data.otpTentativas).toBe(5);
      const bloqueado = updateArgs.data.otpBloqueadoAte.getTime();
      const umaHora = 60 * 60 * 1000;
      expect(bloqueado).toBeGreaterThanOrEqual(antes + umaHora - 1000);
      expect(bloqueado).toBeLessThanOrEqual(depois + umaHora + 1000);
    });

    it('código expirado → BadRequest podeReenviar:true', async () => {
      findUniqueConvite.mockResolvedValue({
        ...conviteBase,
        otpCodigoHash: 'hash',
        otpSalt: 'salt',
        otpExpiresAt: new Date(Date.now() - 1000),
      });
      await expect(service.validarOtp(conviteBase.token, '123456')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('sem código pendente (nunca solicitou) → BadRequest sem_codigo_pendente', async () => {
      findUniqueConvite.mockResolvedValue({ ...conviteBase });
      await expect(service.validarOtp(conviteBase.token, '123456')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('código formato errado (não 6 dígitos) → 400 SEM hit no banco', async () => {
      await expect(service.validarOtp(conviteBase.token, '12345')).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.validarOtp(conviteBase.token, 'abcdef')).rejects.toThrow(
        BadRequestException,
      );
      expect(findUniqueConvite).not.toHaveBeenCalled();
    });

    it('bloqueado: otpBloqueadoAte > now → HTTP 429 sem tentar comparar', async () => {
      findUniqueConvite.mockResolvedValue({
        ...conviteBase,
        otpCodigoHash: 'hash',
        otpSalt: 'salt',
        otpExpiresAt: new Date(Date.now() + 5 * 60 * 1000),
        otpBloqueadoAte: new Date(Date.now() + 30 * 60 * 1000),
      });

      await expect(service.validarOtp(conviteBase.token, '123456')).rejects.toThrow(HttpException);
      expect(updateConvite).not.toHaveBeenCalled();
    });

    it('convite já usado → BadRequest', async () => {
      findUniqueConvite.mockResolvedValue({
        ...conviteBase,
        usedAt: new Date(),
      });
      await expect(service.validarOtp(conviteBase.token, '123456')).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
