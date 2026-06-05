/**
 * Sprint Portal Empresa 9.0 (04/06/2026) — Spec do branch EMPRESA_CONVENIADA
 * em AuthService.obterContextosUsuario.
 *
 * Cobre:
 *  1. Usuário com email matching Cooperado PJ pagador de 1 convênio ATIVO
 *     → contexto 'empresa_conveniada' incluído.
 *  2. Usuário sem cooperado match (email não casa) → nenhum contexto empresa.
 *  3. Cooperado match mas NÃO é pagador de nenhum convênio → nenhum contexto.
 *  4. Múltiplos convênios → 1 contexto agregado com label "N convênios".
 *  5. Convênio INATIVO/SUSPENSO não conta.
 *
 * Não testa Supabase/JWT — só o branch lógico (mock prisma).
 */
import { AuthService } from './auth.service';

describe('AuthService.obterContextosUsuario — branch EMPRESA_CONVENIADA', () => {
  const findUniqueCooperativa = jest.fn();
  const findUniqueAdministradora = jest.fn();
  const findFirstCooperado = jest.fn();
  const findManyUsina = jest.fn();
  const findManyConvenios = jest.fn();
  const findManyCooperativas = jest.fn();

  const prisma: any = {
    cooperativa: { findUnique: findUniqueCooperativa, findMany: findManyCooperativas },
    administradora: { findUnique: findUniqueAdministradora },
    cooperado: { findFirst: findFirstCooperado },
    usina: { findMany: findManyUsina },
    contratoConvenio: { findMany: findManyConvenios },
  };

  let svc: AuthService;

  beforeEach(() => {
    jest.clearAllMocks();
    // AuthService construtor tem várias deps; só usamos o branch — mocks minimal
    svc = new AuthService(
      prisma,
      {} as any, // jwtService
      {} as any, // mailService
      {} as any, // whatsappSender
    );
    findManyUsina.mockResolvedValue([]);
    findManyCooperativas.mockResolvedValue([]);
  });

  const usuarioBase = {
    id: 'u-1',
    nome: 'Marina',
    email: 'lucbragatto+empresa-teste@gmail.com',
    cpf: null,
    telefone: null,
    // Opção A (Fatia F-G1 — 05/06/2026): empresa cooperada PJ tem perfil
    // COOPERADO (decisão COOPERADO-ONLY). Contexto empresa_conveniada é
    // derivado de match Cooperado pagador, não do perfil.
    perfil: 'COOPERADO',
    cooperativaId: null,
    administradoraId: null,
  };

  it('cooperado match + 1 convênio ATIVO como pagador → contexto empresa_conveniada incluído', async () => {
    findFirstCooperado.mockResolvedValueOnce({
      id: 'coop-1',
      nomeCompleto: 'Clinica Teste LTDA',
      cooperativaId: 'coop-A',
      cooperativa: { id: 'coop-A', nome: 'CoopereBR' },
    });
    findManyConvenios.mockResolvedValueOnce([
      {
        id: 'conv-1',
        empresaNome: 'Clinica teste',
        cooperativaId: 'coop-A',
        cooperativa: { id: 'coop-A', nome: 'CoopereBR' },
      },
    ]);

    const r = await svc.obterContextosUsuario(usuarioBase);
    const empresa = r.contextos.find((c) => c.tipo === 'empresa_conveniada');
    expect(empresa).toBeDefined();
    expect(empresa!.label).toBe('Empresa — Clinica teste');
    expect(empresa!.id).toBe('coop-1');
    expect(empresa!.cooperativaId).toBe('coop-A');
  });

  it('cooperado match mas SEM convênios como pagador → não inclui contexto empresa', async () => {
    findFirstCooperado.mockResolvedValueOnce({
      id: 'coop-1',
      nomeCompleto: 'João',
      cooperativaId: 'coop-A',
      cooperativa: { id: 'coop-A', nome: 'CoopereBR' },
    });
    findManyConvenios.mockResolvedValueOnce([]); // não é pagador

    const r = await svc.obterContextosUsuario(usuarioBase);
    expect(r.contextos.find((c) => c.tipo === 'empresa_conveniada')).toBeUndefined();
  });

  it('sem cooperado match (email não casa) → nenhum contexto empresa', async () => {
    findFirstCooperado.mockResolvedValueOnce(null);

    const r = await svc.obterContextosUsuario(usuarioBase);
    expect(r.contextos.find((c) => c.tipo === 'empresa_conveniada')).toBeUndefined();
    expect(findManyConvenios).not.toHaveBeenCalled();
  });

  it('múltiplos convênios → label agregado "N convênios"', async () => {
    findFirstCooperado.mockResolvedValueOnce({
      id: 'coop-1',
      nomeCompleto: 'Grupo Saude',
      cooperativaId: 'coop-A',
      cooperativa: { id: 'coop-A', nome: 'CoopereBR' },
    });
    findManyConvenios.mockResolvedValueOnce([
      { id: 'c-1', empresaNome: 'Clinica A', cooperativaId: 'coop-A', cooperativa: null },
      { id: 'c-2', empresaNome: 'Clinica B', cooperativaId: 'coop-A', cooperativa: null },
      { id: 'c-3', empresaNome: 'Clinica C', cooperativaId: 'coop-A', cooperativa: null },
    ]);

    const r = await svc.obterContextosUsuario(usuarioBase);
    const empresa = r.contextos.find((c) => c.tipo === 'empresa_conveniada');
    expect(empresa).toBeDefined();
    expect(empresa!.label).toBe('Empresa — 3 convênios');
  });

  it('filtra status=ATIVO via where Prisma (chamada inclui filtro)', async () => {
    findFirstCooperado.mockResolvedValueOnce({
      id: 'coop-1',
      nomeCompleto: 'X',
      cooperativaId: 'coop-A',
      cooperativa: null,
    });
    findManyConvenios.mockResolvedValueOnce([]);

    await svc.obterContextosUsuario(usuarioBase);

    expect(findManyConvenios).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          pagadorCooperadoId: 'coop-1',
          status: 'ATIVO',
        },
      }),
    );
  });
});
