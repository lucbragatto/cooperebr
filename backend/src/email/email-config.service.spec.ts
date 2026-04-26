import { EmailConfigService } from './email-config.service';

describe('EmailConfigService', () => {
  let service: EmailConfigService;
  let mockGet: jest.Mock;
  let mockSet: jest.Mock;
  let configTenant: any;

  const ORIGINAL_ENV = { ...process.env };

  beforeEach(() => {
    mockGet = jest.fn();
    mockSet = jest.fn().mockResolvedValue({});
    configTenant = { get: mockGet, set: mockSet };
    service = new EmailConfigService(configTenant);
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  describe('getSmtpConfig', () => {
    it('sem cooperativaId → fallback .env (fonte=env)', async () => {
      process.env.EMAIL_HOST = 'smtp.test.com';
      process.env.EMAIL_PORT = '465';
      process.env.EMAIL_USER = 'env@test.com';
      process.env.EMAIL_PASS = 'envpass';
      process.env.EMAIL_FROM = 'Test <env@test.com>';

      const cfg = await service.getSmtpConfig();
      expect(cfg.fonte).toBe('env');
      expect(cfg.host).toBe('smtp.test.com');
      expect(cfg.user).toBe('env@test.com');
      expect(cfg.pass).toBe('envpass');
      expect(mockGet).not.toHaveBeenCalled();
    });

    it('cooperativaId com configs completas no banco → fonte=tenant + decodifica base64', async () => {
      const passEnTexto = 'app-password-real';
      const passB64 = Buffer.from(passEnTexto, 'utf-8').toString('base64');
      mockGet.mockImplementation((chave) => {
        const map: Record<string, string> = {
          'email.smtp.host': 'smtp.parceiro.com',
          'email.smtp.port': '465',
          'email.smtp.secure': 'true',
          'email.smtp.user': 'parceiro@parceiro.com',
          'email.smtp.pass': passB64,
          'email.smtp.from': 'Parceiro <parceiro@parceiro.com>',
        };
        return Promise.resolve(map[chave] ?? null);
      });

      const cfg = await service.getSmtpConfig('coop-1');
      expect(cfg.fonte).toBe('tenant');
      expect(cfg.host).toBe('smtp.parceiro.com');
      expect(cfg.user).toBe('parceiro@parceiro.com');
      expect(cfg.pass).toBe(passEnTexto);  // decodificado
      expect(cfg.secure).toBe(true);
    });

    it('cooperativaId sem configs no banco → fallback .env', async () => {
      mockGet.mockResolvedValue(null);
      process.env.EMAIL_HOST = 'fallback.com';
      process.env.EMAIL_USER = 'fallback@test.com';
      process.env.EMAIL_PASS = 'fallpass';

      const cfg = await service.getSmtpConfig('coop-sem-config');
      expect(cfg.fonte).toBe('env');
      expect(cfg.host).toBe('fallback.com');
    });

    it('tenant tem só host (sem user nem pass) → fallback .env', async () => {
      mockGet.mockImplementation((chave) =>
        Promise.resolve(chave === 'email.smtp.host' ? 'parcial.com' : null),
      );
      process.env.EMAIL_HOST = 'fallback.com';
      process.env.EMAIL_USER = 'fb@test.com';
      process.env.EMAIL_PASS = 'fbpass';

      const cfg = await service.getSmtpConfig('coop-1');
      expect(cfg.fonte).toBe('env');
      expect(cfg.host).toBe('fallback.com');
    });

    it('pass não-base64 → mantém como está (sem decode)', async () => {
      mockGet.mockImplementation((chave) => {
        const map: Record<string, string> = {
          'email.smtp.host': 'smtp.x.com',
          'email.smtp.user': 'u@x.com',
          'email.smtp.pass': 'plain text password com espaco',  // não é base64 válido
          'email.smtp.from': 'X <u@x.com>',
        };
        return Promise.resolve(map[chave] ?? null);
      });

      const cfg = await service.getSmtpConfig('coop-1');
      expect(cfg.pass).toBe('plain text password com espaco');
    });
  });

  describe('getImapConfig', () => {
    it('cooperativaId com configs → fonte=tenant', async () => {
      const passB64 = Buffer.from('imappass', 'utf-8').toString('base64');
      mockGet.mockImplementation((chave) => {
        const map: Record<string, string> = {
          'email.monitor.host': 'imap.parceiro.com',
          'email.monitor.port': '993',
          'email.monitor.user': 'parceiro@parceiro.com',
          'email.monitor.pass': passB64,
          'email.monitor.ativo': 'true',
        };
        return Promise.resolve(map[chave] ?? null);
      });

      const cfg = await service.getImapConfig('coop-1');
      expect(cfg.fonte).toBe('tenant');
      expect(cfg.pass).toBe('imappass');
      expect(cfg.ativo).toBe(true);
    });

    it('sem configs → fallback .env', async () => {
      mockGet.mockResolvedValue(null);
      process.env.EMAIL_IMAP_HOST = 'imap.env.com';
      process.env.EMAIL_IMAP_USER = 'env@test.com';
      process.env.EMAIL_IMAP_PASS = 'envpass';
      process.env.EMAIL_IMAP_ATIVO = 'true';

      const cfg = await service.getImapConfig('coop-sem');
      expect(cfg.fonte).toBe('env');
      expect(cfg.host).toBe('imap.env.com');
      expect(cfg.ativo).toBe(true);
    });
  });

  describe('setSmtpConfig', () => {
    it('pass salvo em base64', async () => {
      await service.setSmtpConfig('coop-1', { pass: 'minha-senha' });
      const calls = mockSet.mock.calls;
      const passCall = calls.find((c) => c[0] === 'email.smtp.pass');
      expect(passCall).toBeDefined();
      const expectedB64 = Buffer.from('minha-senha', 'utf-8').toString('base64');
      expect(passCall![1]).toBe(expectedB64);
    });

    it('pass vazio → não salva (mantém atual)', async () => {
      await service.setSmtpConfig('coop-1', { host: 'novo.com', pass: '' });
      const calls = mockSet.mock.calls;
      expect(calls.some((c) => c[0] === 'email.smtp.host')).toBe(true);
      expect(calls.some((c) => c[0] === 'email.smtp.pass')).toBe(false);
    });

    it('só host → só set de host', async () => {
      await service.setSmtpConfig('coop-1', { host: 'apenas-host.com' });
      expect(mockSet).toHaveBeenCalledWith('email.smtp.host', 'apenas-host.com', 'coop-1');
      // Nenhum outro campo
      const chaves = mockSet.mock.calls.map((c) => c[0]);
      expect(chaves).toEqual(['email.smtp.host']);
    });

    it('todos os campos enviados', async () => {
      await service.setSmtpConfig('coop-1', {
        host: 'h.com', port: 465, secure: true, user: 'u@h.com', pass: 'p', from: 'X <u@h.com>',
      });
      const chaves = mockSet.mock.calls.map((c) => c[0]).sort();
      expect(chaves).toEqual([
        'email.smtp.from',
        'email.smtp.host',
        'email.smtp.pass',
        'email.smtp.port',
        'email.smtp.secure',
        'email.smtp.user',
      ]);
    });
  });

  describe('getConfigSeguro', () => {
    it('não retorna senhas, mas indica passDefinida', async () => {
      const passB64 = Buffer.from('s', 'utf-8').toString('base64');
      mockGet.mockImplementation((chave) => {
        const map: Record<string, string> = {
          'email.smtp.host': 's.com',
          'email.smtp.user': 'u@s.com',
          'email.smtp.pass': passB64,
          'email.monitor.host': 'i.com',
          'email.monitor.user': 'u@i.com',
          'email.monitor.pass': passB64,
        };
        return Promise.resolve(map[chave] ?? null);
      });

      const seguro = await service.getConfigSeguro('coop-1');
      expect((seguro.smtp as any).pass).toBeUndefined();
      expect((seguro.imap as any).pass).toBeUndefined();
      expect(seguro.smtp.passDefinida).toBe(true);
      expect(seguro.imap.passDefinida).toBe(true);
    });

    it('passDefinida=false quando .env não tem senha', async () => {
      mockGet.mockResolvedValue(null);
      delete process.env.EMAIL_PASS;
      delete process.env.EMAIL_IMAP_PASS;

      const seguro = await service.getConfigSeguro('coop-1');
      expect(seguro.smtp.passDefinida).toBe(false);
      expect(seguro.imap.passDefinida).toBe(false);
    });
  });

  describe('isolamento entre tenants', () => {
    it('chamadas com cooperativaIds diferentes consultam separadamente', async () => {
      mockGet.mockResolvedValue(null);
      await service.getSmtpConfig('coop-A');
      await service.getSmtpConfig('coop-B');

      // Validar que cada call passa cooperativaId correto
      const coopsConsultadas = new Set(mockGet.mock.calls.map((c) => c[1]));
      expect(coopsConsultadas).toEqual(new Set(['coop-A', 'coop-B']));
    });
  });
});
