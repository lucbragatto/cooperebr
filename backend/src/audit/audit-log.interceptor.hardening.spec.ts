/**
 * Sprint Hardening Lateral (23/06/2026) — Bloco C.
 *
 * Fix D-novo-AUDITLOG-TENANT-ALVO-SA P1.
 *
 * Spec da função pura `resolveCooperativaIdAlvoAudit` (extraída do interceptor
 * pra testabilidade direta sem montar RxJS pipeline).
 */
import { resolveCooperativaIdAlvoAudit } from './audit-log.interceptor';

const META_BASE = { acao: 'a', recurso: 'R' };

describe('Hardening Lateral — resolveCooperativaIdAlvoAudit', () => {
  it('JWT presente: usa JWT mesmo se source declarado', () => {
    const result = resolveCooperativaIdAlvoAudit(
      { ...META_BASE, cooperativaIdSource: 'body:cooperativaId' },
      'jwt-tenant',
      { body: { cooperativaId: 'body-tenant' }, params: {}, query: {} },
      null,
    );
    expect(result).toBe('jwt-tenant');
  });

  it('JWT vazio + source body:cooperativaId → usa body', () => {
    const result = resolveCooperativaIdAlvoAudit(
      { ...META_BASE, cooperativaIdSource: 'body:cooperativaId' },
      null,
      { body: { cooperativaId: 'tenant-alvo' }, params: {}, query: {} },
      null,
    );
    expect(result).toBe('tenant-alvo');
  });

  it('JWT vazio + source query:tenant → usa query.tenant', () => {
    const result = resolveCooperativaIdAlvoAudit(
      { ...META_BASE, cooperativaIdSource: 'query:tenant' },
      null,
      { body: {}, params: {}, query: { tenant: 'tenant-query' } },
      null,
    );
    expect(result).toBe('tenant-query');
  });

  it('JWT vazio + source param:id → usa params.id', () => {
    const result = resolveCooperativaIdAlvoAudit(
      { ...META_BASE, cooperativaIdSource: 'param:id' },
      null,
      { body: {}, params: { id: 'tenant-via-param' }, query: {} },
      null,
    );
    expect(result).toBe('tenant-via-param');
  });

  it('JWT vazio + source response:cooperativaId → usa response.cooperativaId', () => {
    const result = resolveCooperativaIdAlvoAudit(
      { ...META_BASE, cooperativaIdSource: 'response:cooperativaId' },
      null,
      { body: {}, params: {}, query: {} },
      { cooperativaId: 'tenant-resp' },
    );
    expect(result).toBe('tenant-resp');
  });

  it('JWT vazio + sem source declarado → null (legado preservado)', () => {
    const result = resolveCooperativaIdAlvoAudit(
      { ...META_BASE },
      null,
      { body: { cooperativaId: 'ignorado' }, params: {}, query: {} },
      null,
    );
    expect(result).toBeNull();
  });

  it('JWT vazio + source malformado (sem :) → null', () => {
    const result = resolveCooperativaIdAlvoAudit(
      { ...META_BASE, cooperativaIdSource: 'malformado' },
      null,
      { body: { cooperativaId: 'ignorado' }, params: {}, query: {} },
      null,
    );
    expect(result).toBeNull();
  });

  it('JWT vazio + source aponta pra campo vazio → null (não retorna string vazia)', () => {
    const result = resolveCooperativaIdAlvoAudit(
      { ...META_BASE, cooperativaIdSource: 'body:cooperativaId' },
      null,
      { body: { cooperativaId: '' }, params: {}, query: {} },
      null,
    );
    expect(result).toBeNull();
  });

  it('JWT vazio + scope inválido → null', () => {
    const result = resolveCooperativaIdAlvoAudit(
      { ...META_BASE, cooperativaIdSource: 'headers:tenant' },
      null,
      { body: {}, params: {}, query: {} },
      null,
    );
    expect(result).toBeNull();
  });
});
