import { avaliarQuery, whereTemFiltroTenant } from './tenant-leak-detector';

/**
 * D-novo-BR F1.3 — Specs da função heurística + decisor da extension.
 * Testa a lógica pura sem precisar instanciar Prisma.
 */
describe('whereTemFiltroTenant', () => {
  it('where vazio → false', () => {
    expect(whereTemFiltroTenant({})).toBe(false);
    expect(whereTemFiltroTenant(undefined)).toBe(false);
    expect(whereTemFiltroTenant(null)).toBe(false);
  });

  it('cooperativaId direto → true', () => {
    expect(whereTemFiltroTenant({ cooperativaId: 'A' })).toBe(true);
  });

  it('cooperativaId aninhado via relação → true', () => {
    expect(whereTemFiltroTenant({ cooperado: { cooperativaId: 'A' } })).toBe(true);
    expect(whereTemFiltroTenant({ contrato: { usina: { cooperativaId: 'A' } } })).toBe(true);
  });

  it('AND com pelo menos um branch tendo cooperativaId → true', () => {
    expect(whereTemFiltroTenant({ AND: [{ status: 'X' }, { cooperativaId: 'A' }] })).toBe(true);
  });

  it('OR onde TODAS as branches têm cooperativaId → true', () => {
    expect(whereTemFiltroTenant({ OR: [{ cooperativaId: 'A' }, { cooperativaId: 'B' }] })).toBe(true);
  });

  it('OR onde apenas algumas branches têm cooperativaId → false (insuficiente)', () => {
    expect(whereTemFiltroTenant({ OR: [{ cooperativaId: 'A' }, { status: 'X' }] })).toBe(false);
  });

  it('limite de profundidade 4 — não loop infinito', () => {
    const deep: any = { a: { b: { c: { d: { e: { cooperativaId: 'A' } } } } } };
    // 5 níveis: a, a.b, a.b.c, a.b.c.d, a.b.c.d.e — passa do depth 4
    expect(whereTemFiltroTenant(deep)).toBe(false);
  });
});

describe('avaliarQuery — F1.3 decisor', () => {
  const ctxAdmin = { cooperativaId: 'A', perfil: 'ADMIN', isPlatform: false };
  const ctxSA = { cooperativaId: null, perfil: 'SUPER_ADMIN', isPlatform: false };
  const ctxPlatform = { isPlatform: true };

  it('NÃO loga: operação sem where (create)', () => {
    expect(avaliarQuery({ model: 'Contrato', operation: 'create', args: { data: {} }, ctx: ctxAdmin })).toBeNull();
  });

  it('NÃO loga: model GLOBAL (Cooperativa)', () => {
    expect(avaliarQuery({ model: 'Cooperativa', operation: 'findMany', args: { where: {} }, ctx: ctxAdmin })).toBeNull();
  });

  it('NÃO loga: model GLOBAL (PlanoSaas)', () => {
    expect(avaliarQuery({ model: 'PlanoSaas', operation: 'findMany', args: { where: {} }, ctx: ctxAdmin })).toBeNull();
  });

  it('NÃO loga: contexto isPlatform=true (cron/listener)', () => {
    expect(avaliarQuery({ model: 'Contrato', operation: 'findMany', args: { where: {} }, ctx: ctxPlatform })).toBeNull();
  });

  it('NÃO loga: SUPER_ADMIN', () => {
    expect(avaliarQuery({ model: 'Contrato', operation: 'findMany', args: { where: {} }, ctx: ctxSA })).toBeNull();
  });

  it('NÃO loga: contexto vazio (script standalone)', () => {
    expect(avaliarQuery({ model: 'Contrato', operation: 'findMany', args: { where: {} }, ctx: undefined })).toBeNull();
  });

  it('NÃO loga: usuário sem cooperativaId (ex: ADMIN sem tenant)', () => {
    expect(avaliarQuery({
      model: 'Contrato',
      operation: 'findMany',
      args: { where: {} },
      ctx: { perfil: 'ADMIN', isPlatform: false },
    })).toBeNull();
  });

  it('NÃO loga: where TEM cooperativaId direto', () => {
    expect(avaliarQuery({
      model: 'Contrato',
      operation: 'findMany',
      args: { where: { cooperativaId: 'A' } },
      ctx: ctxAdmin,
    })).toBeNull();
  });

  it('NÃO loga: where TEM cooperativaId via relação aninhada', () => {
    expect(avaliarQuery({
      model: 'DocumentoCooperado',
      operation: 'findMany',
      args: { where: { cooperado: { cooperativaId: 'A' } } },
      ctx: ctxAdmin,
    })).toBeNull();
  });

  it('LOGA: model tenant-scoped sem filtro em contexto ADMIN', () => {
    const msg = avaliarQuery({
      model: 'Contrato',
      operation: 'findMany',
      args: { where: { status: 'ATIVO' } },
      ctx: ctxAdmin,
    });
    expect(msg).toContain('TENANT-LEAK-DETECT');
    expect(msg).toContain('model=Contrato');
    expect(msg).toContain('op=findMany');
    expect(msg).toContain('cooperativaId=A');
  });

  it('LOGA: model tenant-scoped sem args.where', () => {
    const msg = avaliarQuery({
      model: 'Contrato',
      operation: 'count',
      args: {},
      ctx: ctxAdmin,
    });
    expect(msg).toContain('TENANT-LEAK-DETECT');
  });

  it('LOGA: update sem where (deveria sempre ter, mas o decisor não bloqueia)', () => {
    // updateMany sem where é dangerous — pelo menos loga
    const msg = avaliarQuery({
      model: 'Contrato',
      operation: 'updateMany',
      args: { where: {}, data: { status: 'CANCELADO' } },
      ctx: ctxAdmin,
    });
    expect(msg).toContain('TENANT-LEAK-DETECT');
  });
});
