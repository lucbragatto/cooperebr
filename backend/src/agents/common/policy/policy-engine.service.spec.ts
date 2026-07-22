/**
 * PolicyEngineService — Testes unitários (Fase 2 inicial)
 *
 * Foco: regras de níveis de risco L0-L4 e decisões de execução.
 */
import { PolicyEngineService } from './policy-engine.service';
import { PolicyContext } from '../types/policy.types';

describe('PolicyEngineService', () => {
  let engine: PolicyEngineService;

  const baseContext: PolicyContext = {
    cooperativaId: 'coop-123',
    usuarioId: 'user-456',
    usuarioPerfil: 'ADMIN',
  };

  beforeEach(() => {
    engine = new PolicyEngineService();
  });

  describe('evaluate()', () => {
    it('L0 (leitura) → permitido, suggestedMode=real, sem aprovação humana', () => {
      const decision = engine.evaluate('L0', baseContext);

      expect(decision.allowed).toBe(true);
      expect(decision.level).toBe('L0');
      expect(decision.requiresHumanApproval).toBe(false);
      expect(decision.suggestedMode).toBe('real');
    });

    it('L1 (simulação) → permitido, suggestedMode=dry-run por padrão', () => {
      const decision = engine.evaluate('L1', baseContext);

      expect(decision.allowed).toBe(true);
      expect(decision.level).toBe('L1');
      expect(decision.requiresHumanApproval).toBe(false);
      expect(decision.suggestedMode).toBe('dry-run');
    });

    it('L2 → permitido mas força dry-run na versão inicial', () => {
      const decision = engine.evaluate('L2', baseContext);

      expect(decision.allowed).toBe(true);
      expect(decision.level).toBe('L2');
      expect(decision.suggestedMode).toBe('dry-run');
    });

    it('L3 (financeiro/regulatório) → requer aprovação humana + força dry-run', () => {
      const decision = engine.evaluate('L3', baseContext);

      expect(decision.allowed).toBe(true);
      expect(decision.level).toBe('L3');
      expect(decision.requiresHumanApproval).toBe(true);
      expect(decision.suggestedMode).toBe('dry-run');
    });

    it('L4 → sempre bloqueado por design', () => {
      const decision = engine.evaluate('L4', baseContext);

      expect(decision.allowed).toBe(false);
      expect(decision.level).toBe('L4');
      expect(decision.reason).toContain('bloqueado por design');
    });
  });

  describe('validateTenantContext()', () => {
    it('retorna false quando falta cooperativaId', () => {
      const invalid = { ...baseContext, cooperativaId: '' };
      expect(engine.validateTenantContext(invalid)).toBe(false);
    });

    it('retorna false quando falta usuarioId', () => {
      const invalid = { ...baseContext, usuarioId: '' };
      expect(engine.validateTenantContext(invalid)).toBe(false);
    });

    it('retorna true com contexto mínimo válido', () => {
      expect(engine.validateTenantContext(baseContext)).toBe(true);
    });
  });

  describe('resolveExecutionMode()', () => {
    it('L3 sempre força dry-run mesmo se caller pedir real', () => {
      const decision = engine.evaluate('L3', baseContext);
      const mode = engine.resolveExecutionMode(decision, 'real');
      expect(mode).toBe('dry-run');
    });

    it('L0 permite real quando solicitado e policy permite', () => {
      const decision = engine.evaluate('L0', baseContext);
      const mode = engine.resolveExecutionMode(decision, 'real');
      expect(mode).toBe('real');
    });
  });
});
