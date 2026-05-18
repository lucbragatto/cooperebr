/**
 * Sub-Fase 1 Fase 5 (M13.A, 19/05/2026) — spec do CooperadoHomologadoListener.
 *
 * Cobre as 3 camadas defense in depth do fix D-novo-N (18/05) integradas
 * no handler do evento `envio-lista.cooperado-homologado`:
 *
 *   Camada 1 — `isAmbienteReal()` (AMBIENTE_REAL=true) discrimina dev/prod.
 *   Camada 2 — `cooperado.ambienteTeste` força override mesmo em prod.
 *   Camada 3 — `ehEmailFake`/`ehTelefoneFake` bloqueia dispatch pós-override.
 *
 * Mock estratégia: dependências injetadas (Prisma + Email + WhatsappSender)
 * + manipulação de `process.env.AMBIENTE_REAL` em cada cenário.
 *
 * Origem do bug coberto: `falha_regra_contatos_teste_18_05.md`.
 */
import { Logger } from '@nestjs/common';
import { CooperadoHomologadoListener } from './cooperado-homologado.listener';
import type { CooperadoHomologadoEvent } from './envio-lista-concessionaria.events';

type Any = any;

function buildPrismaMock(overrides?: {
  cooperado?: Any;
  cooperativa?: Any;
  usina?: Any;
}) {
  // Distingue "ausente" de "explicitamente null" (precisa pra mockar
  // cenário onde findUnique retorna null intencionalmente).
  const cooperado = overrides && 'cooperado' in overrides
    ? overrides.cooperado
    : {
        id: 'coop-1',
        nomeCompleto: 'Maria SCEE',
        email: 'maria-banco@empresa-real.com.br',
        telefone: '+5511987654321',
        ambienteTeste: false,
      };
  const cooperativa = overrides && 'cooperativa' in overrides
    ? overrides.cooperativa
    : { id: 'tenant-1', nome: 'CoopereBR' };
  const usina = overrides && 'usina' in overrides
    ? overrides.usina
    : { id: 'usina-1', nome: 'Solar Vitória' };

  return {
    cooperado: { findUnique: jest.fn().mockResolvedValue(cooperado) },
    cooperativa: { findUnique: jest.fn().mockResolvedValue(cooperativa) },
    usina: { findUnique: jest.fn().mockResolvedValue(usina) },
  };
}

function buildEmailMock() {
  return {
    enviarCooperadoHomologado: jest.fn().mockResolvedValue(undefined),
  };
}

function buildWhatsappMock() {
  return {
    enviarMensagem: jest.fn().mockResolvedValue(undefined),
  };
}

function makeListener(prismaOverrides?: Parameters<typeof buildPrismaMock>[0]) {
  const prisma = buildPrismaMock(prismaOverrides);
  const email = buildEmailMock();
  const whatsapp = buildWhatsappMock();
  const listener = new CooperadoHomologadoListener(
    prisma as Any,
    email as Any,
    whatsapp as Any,
  );
  return { listener, prisma, email, whatsapp };
}

function buildEvent(overrides?: Partial<CooperadoHomologadoEvent>): CooperadoHomologadoEvent {
  return {
    cooperativaId: 'tenant-1',
    cooperadoId: 'coop-1',
    contratoId: 'ctr-1',
    envioListaId: 'env-1',
    envioListaCooperadoId: 'l-1',
    usinaId: 'usina-1',
    numeroProtocolo: 'PROT-EDP-001',
    dataHomologacao: new Date('2026-05-15T12:00:00Z'),
    contratoAtivadoAgora: true,
    ...overrides,
  };
}

describe('CooperadoHomologadoListener — 3 camadas defense in depth (D-novo-N)', () => {
  const envOriginal = process.env.AMBIENTE_REAL;

  afterEach(() => {
    if (envOriginal === undefined) {
      delete process.env.AMBIENTE_REAL;
    } else {
      process.env.AMBIENTE_REAL = envOriginal;
    }
    jest.restoreAllMocks();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Guard de idempotência
  // ─────────────────────────────────────────────────────────────────────────

  describe('guard contratoAtivadoAgora', () => {
    it('contratoAtivadoAgora=false → SKIPPED (sem buscar dados, sem dispatch)', async () => {
      const { listener, prisma, email, whatsapp } = makeListener();
      await listener.handleCooperadoHomologado(buildEvent({ contratoAtivadoAgora: false }));
      expect(prisma.cooperado.findUnique).not.toHaveBeenCalled();
      expect(prisma.cooperativa.findUnique).not.toHaveBeenCalled();
      expect(prisma.usina.findUnique).not.toHaveBeenCalled();
      expect(email.enviarCooperadoHomologado).not.toHaveBeenCalled();
      expect(whatsapp.enviarMensagem).not.toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Guard de dados ausentes
  // ─────────────────────────────────────────────────────────────────────────

  describe('guard dados ausentes', () => {
    it('cooperado null → aborta sem dispatch', async () => {
      const { listener, email, whatsapp } = makeListener({ cooperado: null });
      await listener.handleCooperadoHomologado(buildEvent());
      expect(email.enviarCooperadoHomologado).not.toHaveBeenCalled();
      expect(whatsapp.enviarMensagem).not.toHaveBeenCalled();
    });

    it('cooperativa null → aborta sem dispatch', async () => {
      const { listener, email, whatsapp } = makeListener({ cooperativa: null });
      await listener.handleCooperadoHomologado(buildEvent());
      expect(email.enviarCooperadoHomologado).not.toHaveBeenCalled();
      expect(whatsapp.enviarMensagem).not.toHaveBeenCalled();
    });

    it('usina null → aborta sem dispatch', async () => {
      const { listener, email, whatsapp } = makeListener({ usina: null });
      await listener.handleCooperadoHomologado(buildEvent());
      expect(email.enviarCooperadoHomologado).not.toHaveBeenCalled();
      expect(whatsapp.enviarMensagem).not.toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Camada 1 — isAmbienteReal()
  // ─────────────────────────────────────────────────────────────────────────

  describe('Camada 1 — isAmbienteReal()', () => {
    it('AMBIENTE_REAL≠true (dev): SEMPRE override pro contato Luciano', async () => {
      delete process.env.AMBIENTE_REAL;
      const { listener, email, whatsapp } = makeListener({
        cooperado: {
          id: 'coop-real',
          nomeCompleto: 'João Silva',
          email: 'joao@empresa-real.com.br',
          telefone: '+5511987654321',
          ambienteTeste: false,
        },
      });
      await listener.handleCooperadoHomologado(buildEvent());
      expect(whatsapp.enviarMensagem.mock.calls[0][0]).toBe('27981341348');
      expect(email.enviarCooperadoHomologado.mock.calls[0][0]).toBe('lucbragatto+homologado@gmail.com');
    });

    it('AMBIENTE_REAL=true + ambienteTeste=false: dispatch pro contato REAL', async () => {
      process.env.AMBIENTE_REAL = 'true';
      const { listener, email, whatsapp } = makeListener({
        cooperado: {
          id: 'coop-real',
          nomeCompleto: 'João Silva',
          email: 'joao@empresa-real.com.br',
          telefone: '+5511987654321',
          ambienteTeste: false,
        },
      });
      await listener.handleCooperadoHomologado(buildEvent());
      expect(whatsapp.enviarMensagem.mock.calls[0][0]).toBe('+5511987654321');
      expect(email.enviarCooperadoHomologado.mock.calls[0][0]).toBe('joao@empresa-real.com.br');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Camada 2 — cooperado.ambienteTeste
  // ─────────────────────────────────────────────────────────────────────────

  describe('Camada 2 — cooperado.ambienteTeste', () => {
    it('AMBIENTE_REAL=true + ambienteTeste=true: override mesmo em prod (proteção dados teste)', async () => {
      process.env.AMBIENTE_REAL = 'true';
      const { listener, email, whatsapp } = makeListener({
        cooperado: {
          id: 'coop-teste',
          nomeCompleto: 'Teste SCEE LTDA',
          email: 'teste-banco@empresa.com.br',
          telefone: '+5511987654321',
          ambienteTeste: true, // ← Camada 2 ativa
        },
      });
      await listener.handleCooperadoHomologado(buildEvent());
      expect(whatsapp.enviarMensagem.mock.calls[0][0]).toBe('27981341348');
      expect(email.enviarCooperadoHomologado.mock.calls[0][0]).toBe('lucbragatto+homologado@gmail.com');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Camada 3 — pattern detection pós-override
  // ─────────────────────────────────────────────────────────────────────────

  describe('Camada 3 — pattern detection pós-override (salvaguarda final)', () => {
    it('telefone com pattern fake bloqueia WA dispatch mesmo após override', async () => {
      // Cenário sintético: AMBIENTE_REAL=true + ambienteTeste=false +
      // cooperado tem telefone com pattern fake (cadastro herdado/sintético).
      process.env.AMBIENTE_REAL = 'true';
      const { listener, email, whatsapp } = makeListener({
        cooperado: {
          id: 'coop-1',
          nomeCompleto: 'João',
          email: 'joao@empresa-real.com.br',
          telefone: '+5511000000000', // pattern: 6+ zeros
          ambienteTeste: false,
        },
      });
      await listener.handleCooperadoHomologado(buildEvent());
      expect(whatsapp.enviarMensagem).not.toHaveBeenCalled();
      // Email permite (Camada 3 só bloqueou WA)
      expect(email.enviarCooperadoHomologado).toHaveBeenCalled();
    });

    it('email com pattern fake bloqueia Email dispatch mesmo após override', async () => {
      process.env.AMBIENTE_REAL = 'true';
      const { listener, email, whatsapp } = makeListener({
        cooperado: {
          id: 'coop-1',
          nomeCompleto: 'João',
          email: 'derli-removido@removido.invalid', // triplo pattern fake
          telefone: '+5511987654321',
          ambienteTeste: false,
        },
      });
      await listener.handleCooperadoHomologado(buildEvent());
      expect(email.enviarCooperadoHomologado).not.toHaveBeenCalled();
      // WA permite (Camada 3 só bloqueou email)
      expect(whatsapp.enviarMensagem).toHaveBeenCalled();
    });

    it('ambos contatos fake bloqueia ambos dispatches', async () => {
      process.env.AMBIENTE_REAL = 'true';
      const { listener, email, whatsapp } = makeListener({
        cooperado: {
          id: 'coop-1',
          nomeCompleto: 'João',
          email: 'noreply@cooperebr.com',
          telefone: '+5511999990000',
          ambienteTeste: false,
        },
      });
      await listener.handleCooperadoHomologado(buildEvent());
      expect(email.enviarCooperadoHomologado).not.toHaveBeenCalled();
      expect(whatsapp.enviarMensagem).not.toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Dispatch best-effort
  // ─────────────────────────────────────────────────────────────────────────

  describe('dispatch best-effort (falha de um não bloqueia o outro)', () => {
    it('falha WhatsApp: email ainda é enviado', async () => {
      delete process.env.AMBIENTE_REAL;
      const { listener, email, whatsapp } = makeListener();
      whatsapp.enviarMensagem.mockRejectedValueOnce(new Error('WA fora do ar'));
      await listener.handleCooperadoHomologado(buildEvent());
      expect(whatsapp.enviarMensagem).toHaveBeenCalled();
      expect(email.enviarCooperadoHomologado).toHaveBeenCalled();
    });

    it('falha Email: WhatsApp já tinha sido enviado', async () => {
      delete process.env.AMBIENTE_REAL;
      const { listener, email, whatsapp } = makeListener();
      email.enviarCooperadoHomologado.mockRejectedValueOnce(new Error('SMTP fora do ar'));
      await listener.handleCooperadoHomologado(buildEvent());
      expect(whatsapp.enviarMensagem).toHaveBeenCalled();
      expect(email.enviarCooperadoHomologado).toHaveBeenCalled();
    });

    it('payload do email carrega nome/cooperativa/usina/data/protocolo', async () => {
      delete process.env.AMBIENTE_REAL;
      const { listener, email } = makeListener({
        cooperado: {
          id: 'coop-1',
          nomeCompleto: 'Maria SCEE',
          email: 'maria@x.com',
          telefone: '+5511987654321',
          ambienteTeste: false,
        },
      });
      await listener.handleCooperadoHomologado(
        buildEvent({
          numeroProtocolo: 'PROT-EDP-007',
          dataHomologacao: new Date('2026-05-10T00:00:00Z'),
        }),
      );
      const [destinatario, dados, cooperativaId] = email.enviarCooperadoHomologado.mock.calls[0];
      expect(destinatario).toBe('lucbragatto+homologado@gmail.com');
      expect(dados).toEqual({
        nomeCooperado: 'Maria SCEE',
        nomeCooperativa: 'CoopereBR',
        nomeUsina: 'Solar Vitória',
        dataHomologacao: new Date('2026-05-10T00:00:00Z'),
        numeroProtocolo: 'PROT-EDP-007',
      });
      expect(cooperativaId).toBe('tenant-1');
    });

    it('options do WhatsApp incluem tipoDisparo + disparoId + cooperadoId + cooperativaId', async () => {
      delete process.env.AMBIENTE_REAL;
      const { listener, whatsapp } = makeListener();
      await listener.handleCooperadoHomologado(buildEvent());
      const opts = whatsapp.enviarMensagem.mock.calls[0][2];
      expect(opts).toEqual({
        tipoDisparo: 'cooperado_homologado',
        disparoId: 'l-1',
        cooperadoId: 'coop-1',
        cooperativaId: 'tenant-1',
      });
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Sem contato
  // ─────────────────────────────────────────────────────────────────────────

  describe('cooperado sem contato', () => {
    it('AMBIENTE_REAL=true + ambienteTeste=false + telefone null → WA SKIPPED', async () => {
      // Em prod, sem override, telefone null permanece null e não dispara.
      process.env.AMBIENTE_REAL = 'true';
      const { listener, email, whatsapp } = makeListener({
        cooperado: {
          id: 'coop-1',
          nomeCompleto: 'João',
          email: 'joao@empresa.com.br',
          telefone: null,
          ambienteTeste: false,
        },
      });
      await listener.handleCooperadoHomologado(buildEvent());
      expect(whatsapp.enviarMensagem).not.toHaveBeenCalled();
      // Email com contato real ainda dispara
      expect(email.enviarCooperadoHomologado).toHaveBeenCalledWith(
        'joao@empresa.com.br',
        expect.any(Object),
        'tenant-1',
      );
    });

    it('AMBIENTE_REAL=true + ambienteTeste=false + email null → Email SKIPPED', async () => {
      process.env.AMBIENTE_REAL = 'true';
      const { listener, email, whatsapp } = makeListener({
        cooperado: {
          id: 'coop-1',
          nomeCompleto: 'João',
          email: null,
          telefone: '+5511987654321',
          ambienteTeste: false,
        },
      });
      await listener.handleCooperadoHomologado(buildEvent());
      expect(email.enviarCooperadoHomologado).not.toHaveBeenCalled();
      expect(whatsapp.enviarMensagem).toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Log auditável
  // ─────────────────────────────────────────────────────────────────────────

  describe('log auditável', () => {
    it('em dev (override): log contém contatoOriginal ≠ contatoEnvio + motivo DEV_AMBIENTE', async () => {
      delete process.env.AMBIENTE_REAL;
      const logSpy = jest
        .spyOn(Logger.prototype as Any, 'log')
        .mockImplementation(() => undefined);
      const { listener } = makeListener({
        cooperado: {
          id: 'coop-1',
          nomeCompleto: 'João',
          email: 'joao-banco@empresa.com.br',
          telefone: '+5511987654321',
          ambienteTeste: false,
        },
      });
      await listener.handleCooperadoHomologado(buildEvent());
      const auditableCall = logSpy.mock.calls.find((args) =>
        String(args[0]).includes('[cooperado-homologado]') && String(args[0]).includes('motivo'),
      );
      expect(auditableCall).toBeDefined();
      const payload = String(auditableCall![0]);
      expect(payload).toContain('"motivo":"DEV_AMBIENTE"');
      expect(payload).toContain('"contatoOriginal"');
      expect(payload).toContain('joao-banco@empresa.com.br');
      expect(payload).toContain('lucbragatto+homologado@gmail.com');
    });

    it('em prod + ambienteTeste=true: motivo COOPERADO_TESTE_FLAG', async () => {
      process.env.AMBIENTE_REAL = 'true';
      const logSpy = jest
        .spyOn(Logger.prototype as Any, 'log')
        .mockImplementation(() => undefined);
      const { listener } = makeListener({
        cooperado: {
          id: 'coop-teste',
          nomeCompleto: 'Teste',
          email: 'teste@banco.com',
          telefone: '+5511987654321',
          ambienteTeste: true,
        },
      });
      await listener.handleCooperadoHomologado(buildEvent());
      const auditableCall = logSpy.mock.calls.find((args) =>
        String(args[0]).includes('"motivo":"COOPERADO_TESTE_FLAG"'),
      );
      expect(auditableCall).toBeDefined();
    });

    it('em prod + ambienteTeste=false (contato real): motivo PROD_REAL', async () => {
      process.env.AMBIENTE_REAL = 'true';
      const logSpy = jest
        .spyOn(Logger.prototype as Any, 'log')
        .mockImplementation(() => undefined);
      const { listener } = makeListener({
        cooperado: {
          id: 'coop-real',
          nomeCompleto: 'Real',
          email: 'real@empresa.com.br',
          telefone: '+5511987654321',
          ambienteTeste: false,
        },
      });
      await listener.handleCooperadoHomologado(buildEvent());
      const auditableCall = logSpy.mock.calls.find((args) =>
        String(args[0]).includes('"motivo":"PROD_REAL"'),
      );
      expect(auditableCall).toBeDefined();
    });
  });
});
