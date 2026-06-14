/**
 * Sprint Clube P1 — F6 Bloco C.1 (13/06/2026).
 *
 * Specs do método `listarMeusResgates` — listagem dos resgates do PRÓPRIO
 * estabelecimento (não-admin).
 *
 * Foco:
 *  - Anti-IDOR: filtro fixo `cooperadoEstabelecimentoId` do JWT, NÃO do
 *    body/query (controller já força; service ratifica).
 *  - Multi-tenant: `cooperativaId` SEMPRE do JWT.
 *  - Filtros opcionais: status (sem default — diferente do listarResgates
 *    Pendentes do admin).
 *  - Paginação default page=1, limit=20.
 *  - Ordenação createdAt desc (mais recente em cima).
 */
import { CooperTokenService } from './cooper-token.service';

const COOP = 'coop-1';
const ESTAB = 'estab-1';

function setup() {
  const findMany = jest.fn().mockResolvedValue([]);
  const count = jest.fn().mockResolvedValue(0);
  const prisma: any = {
    resgateRecibo: { findMany, count },
  };
  // CooperTokenService precisa dos outros services no constructor; mockar
  // só o que listarMeusResgates toca.
  const sut = new CooperTokenService(
    prisma,
    { emit: jest.fn() } as any,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
  );
  return { sut, findMany, count };
}

describe('CooperTokenService.listarMeusResgates — F6 C.1', () => {
  it('filtra por cooperadoEstabelecimentoId + cooperativaId (anti-IDOR + multi-tenant)', async () => {
    const { sut, findMany } = setup();
    await sut.listarMeusResgates({
      estabelecimentoCooperadoId: ESTAB,
      cooperativaId: COOP,
    });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          cooperadoEstabelecimentoId: ESTAB,
          cooperativaId: COOP,
        },
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: 20,
      }),
    );
  });

  it('sem status default — não filtra por status (cooperado quer ver tudo dele)', async () => {
    const { sut, findMany } = setup();
    await sut.listarMeusResgates({
      estabelecimentoCooperadoId: ESTAB,
      cooperativaId: COOP,
    });
    const where = findMany.mock.calls[0][0].where;
    expect(where.status).toBeUndefined();
  });

  it('filtra por status quando passado (ex: PENDENTE_APROVACAO_COOP)', async () => {
    const { sut, findMany } = setup();
    await sut.listarMeusResgates({
      estabelecimentoCooperadoId: ESTAB,
      cooperativaId: COOP,
      status: 'PENDENTE_APROVACAO_COOP',
    });
    const where = findMany.mock.calls[0][0].where;
    expect(where.status).toBe('PENDENTE_APROVACAO_COOP');
  });

  it('paginação custom: page=2 + limit=5 → skip=5, take=5', async () => {
    const { sut, findMany } = setup();
    await sut.listarMeusResgates({
      estabelecimentoCooperadoId: ESTAB,
      cooperativaId: COOP,
      page: 2,
      limit: 5,
    });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 5, take: 5 }),
    );
  });

  it('retorna shape paginado (items + total + page + limit + pages, pixChave MASCARADA — F6 C.4 P2)', async () => {
    const { sut, findMany, count } = setup();
    findMany.mockResolvedValueOnce([
      { id: 'r1', status: 'PENDENTE_APROVACAO_COOP', numeroRecibo: 'RES-2026-00001', pixChave: '+5527981341348' },
      { id: 'r2', status: 'PAGO_RECIBO_EMITIDO', numeroRecibo: 'RES-2026-00002', pixChave: 'lucbragatto@gmail.com' },
    ]);
    count.mockResolvedValueOnce(7);
    const r = await sut.listarMeusResgates({
      estabelecimentoCooperadoId: ESTAB,
      cooperativaId: COOP,
      limit: 5,
    });
    // F6 C.4 P2 (14/06): pixChave MASCARADA na resposta (anti-PII).
    expect(r).toEqual({
      items: [
        { id: 'r1', status: 'PENDENTE_APROVACAO_COOP', numeroRecibo: 'RES-2026-00001', pixChave: '+55***48' },
        { id: 'r2', status: 'PAGO_RECIBO_EMITIDO', numeroRecibo: 'RES-2026-00002', pixChave: 'luc***om' },
      ],
      total: 7,
      page: 1,
      limit: 5,
      pages: 2,
    });
  });

  it('cooperado de outro tenant NÃO vê — filtro cooperativaId do JWT é a barreira', async () => {
    // O service só recebe os IDs do JWT; é responsabilidade do controller
    // injetar req.user.cooperativaId. Aqui a spec ratifica que o where
    // SEMPRE inclui cooperativaId — sem ele, vazaria entre tenants.
    const { sut, findMany } = setup();
    await sut.listarMeusResgates({
      estabelecimentoCooperadoId: ESTAB,
      cooperativaId: COOP,
    });
    const where = findMany.mock.calls[0][0].where;
    expect(where.cooperativaId).toBe(COOP);
    expect(where.cooperadoEstabelecimentoId).toBe(ESTAB);
  });
});
