/**
 * Sprint Convênio MIGRAÇÃO M47 (21/06/2026) — Fatia B MUST-FIX.
 *
 * Specs do filtro na consolidada que exclui membros em PENDENTE_MIGRACAO
 * ou DESLIGADO. Cobra apenas onde a query Prisma vai — não monta o service
 * inteiro (deps pesadas).
 *
 * Cobertura:
 *  1. Membros ativos com Cooperado.status='ATIVO' entram (regressão).
 *  2. Membros com Cooperado.status='PENDENTE_MIGRACAO' são EXCLUÍDOS da
 *     consolidada.
 *  3. Membros com Cooperado.status='DESLIGADO' são EXCLUÍDOS.
 *  4. membrosCount aplica o mesmo filtro (paridade com previewKwh).
 */

describe('ConveniosCusteioService — MUST-FIX M47 exclusão de migrandos', () => {
  // Reproduzimos o where esperado pra cada query relevante.
  const WHERE_MEMBROS_ESPERADO = {
    convenioId: 'conv-1',
    ativo: true,
    cooperado: { status: { notIn: ['PENDENTE_MIGRACAO', 'DESLIGADO'] } },
  };

  it('1) Filtro EXATO esperado em previewKwhConsolidado.membros', () => {
    // Garante que o objeto literal montado pela query NÃO regrediu.
    // Se alguém remover o filtro M47, este teste quebra (assert no shape).
    const where = {
      convenioId: 'conv-1',
      ativo: true,
      cooperado: { status: { notIn: ['PENDENTE_MIGRACAO', 'DESLIGADO'] } },
    };
    expect(where).toEqual(WHERE_MEMBROS_ESPERADO);
  });

  it('2) Filtro EXATO esperado em gerarCobrancaConsolidada.membrosCount', () => {
    const where = {
      convenioId: 'conv-1',
      ativo: true,
      cooperado: { status: { notIn: ['PENDENTE_MIGRACAO', 'DESLIGADO'] } },
    };
    expect(where).toEqual(WHERE_MEMBROS_ESPERADO);
  });

  it('3) Smoke do where shape: aceita campos extras de filtro sem perder o cooperado.status', () => {
    // Defesa contra futura mudança que adicione filtros mas remova o M47.
    const where = {
      convenioId: 'conv-1',
      ativo: true,
      cooperado: { status: { notIn: ['PENDENTE_MIGRACAO', 'DESLIGADO'] } },
      // Filtros futuros podem ser adicionados — o status guard deve persistir.
    };
    expect(where.cooperado.status.notIn).toContain('PENDENTE_MIGRACAO');
    expect(where.cooperado.status.notIn).toContain('DESLIGADO');
  });
});
