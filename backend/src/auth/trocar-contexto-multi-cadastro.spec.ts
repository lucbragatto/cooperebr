/**
 * Sprint "Qual cadastro?" Fix 3+4 (08/06/2026) — specs:
 *  - obterContextosUsuario: múltiplos cooperados → múltiplos contextos
 *  - trocarContexto: aceita cooperadoIdEscolhido + anti-IDOR
 */
import { AuthService } from './auth.service';
import { ForbiddenException } from '@nestjs/common';

describe('AuthService — "Qual cadastro?" (Fix 3+4)', () => {
  const findUniqueCooperativa = jest.fn();
  const findManyCooperativas = jest.fn();
  const findManyCooperado = jest.fn();
  const findManyUsina = jest.fn();
  const findManyConvenios = jest.fn();
  const jwtSign = jest.fn().mockReturnValue('jwt-token-mock');

  const prisma: any = {
    cooperativa: { findUnique: findUniqueCooperativa, findMany: findManyCooperativas },
    administradora: { findUnique: jest.fn() },
    cooperado: { findFirst: jest.fn(), findMany: findManyCooperado },
    usina: { findMany: findManyUsina },
    contratoConvenio: { findMany: findManyConvenios },
  };

  let svc: AuthService;

  beforeEach(() => {
    jest.clearAllMocks();
    svc = new AuthService(
      prisma,
      { sign: jwtSign } as any,
      {} as any,
      {} as any,
    );
    findManyUsina.mockResolvedValue([]);
    findManyCooperativas.mockResolvedValue([]);
    findManyConvenios.mockResolvedValue([]);
  });

  const usuario = {
    id: 'u-luciano',
    nome: 'Luciano',
    email: 'lucbragatto@gmail.com',
    cpf: '89089324704',
    telefone: '5527981341348',
    perfil: 'COOPERADO',
    cooperativaId: null,
    administradoraId: null,
  };

  describe('obterContextosUsuario — múltiplos cooperados', () => {
    it('1 cooperado → 1 contexto cooperado com label legado', async () => {
      findManyCooperado.mockResolvedValueOnce([{
        id: 'coop-pf',
        nomeCompleto: 'Luciano PF',
        razaoSocial: null,
        tipoPessoa: 'PF',
        cooperativaId: 'tenant-A',
        cooperativa: { id: 'tenant-A', nome: 'CoopereBR' },
      }]);

      const r = await svc.obterContextosUsuario(usuario);
      const coopCtxs = r.contextos.filter((c) => c.tipo === 'cooperado');
      expect(coopCtxs).toHaveLength(1);
      expect(coopCtxs[0].label).toBe('Cooperado — CoopereBR');
      expect(coopCtxs[0].id).toBe('coop-pf');
    });

    it('2 cooperados (PF + PJ) → 2 contextos diferenciados', async () => {
      findManyCooperado.mockResolvedValueOnce([
        {
          id: 'coop-pf',
          nomeCompleto: 'Luciano Bragatto',
          razaoSocial: null,
          tipoPessoa: 'PF',
          cooperativaId: 'tenant-A',
          cooperativa: { id: 'tenant-A', nome: 'CoopereBR' },
        },
        {
          id: 'coop-pj',
          nomeCompleto: 'SISGDSOLAR',
          razaoSocial: 'SISGDSOLAR SISTEMAS LTDA',
          tipoPessoa: 'PJ',
          cooperativaId: 'tenant-A',
          cooperativa: { id: 'tenant-A', nome: 'CoopereBR' },
        },
      ]);

      const r = await svc.obterContextosUsuario(usuario);
      const coopCtxs = r.contextos.filter((c) => c.tipo === 'cooperado');
      expect(coopCtxs).toHaveLength(2);
      expect(coopCtxs[0].label).toBe('Cooperado PF — Luciano Bragatto');
      expect(coopCtxs[0].id).toBe('coop-pf');
      expect(coopCtxs[1].label).toBe('Cooperado PJ — SISGDSOLAR SISTEMAS LTDA');
      expect(coopCtxs[1].id).toBe('coop-pj');
    });

    it('PJ sem razaoSocial cai pro nomeCompleto', async () => {
      findManyCooperado.mockResolvedValueOnce([
        { id: 'c-1', nomeCompleto: 'A', razaoSocial: null, tipoPessoa: 'PF', cooperativaId: 'T', cooperativa: { id: 'T', nome: 'X' } },
        { id: 'c-2', nomeCompleto: 'Empresa Y', razaoSocial: null, tipoPessoa: 'PJ', cooperativaId: 'T', cooperativa: { id: 'T', nome: 'X' } },
      ]);
      const r = await svc.obterContextosUsuario(usuario);
      const pj = r.contextos.filter((c) => c.tipo === 'cooperado')[1];
      expect(pj.label).toBe('Cooperado PJ — Empresa Y');
    });

    it('0 cooperados → 0 contextos cooperado', async () => {
      findManyCooperado.mockResolvedValueOnce([]);
      const r = await svc.obterContextosUsuario(usuario);
      expect(r.contextos.filter((c) => c.tipo === 'cooperado')).toHaveLength(0);
    });

    // Revisao multi-tenant 09/06/2026 — cadastro inativo nao pode virar contexto.
    it('Filtra cooperado por status IN STATUS_COOPERADO_ATIVOS', async () => {
      findManyCooperado.mockResolvedValueOnce([]);
      await svc.obterContextosUsuario(usuario);
      expect(findManyCooperado).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.any(Array),
            status: { in: expect.arrayContaining(['ATIVO']) },
          }),
        }),
      );
    });
  });

  describe('trocarContexto — anti-IDOR + multi-cooperado', () => {
    it('1 cooperado SEM cooperadoIdEscolhido → seleciona único automaticamente', async () => {
      findManyCooperado.mockResolvedValueOnce([{
        id: 'coop-pf', nomeCompleto: 'Luciano', razaoSocial: null, tipoPessoa: 'PF',
        cooperativaId: 'T-A', cooperativa: { id: 'T-A', nome: 'CoopereBR' },
      }]);
      const r = await svc.trocarContexto(usuario, 'cooperado');
      expect(r.cooperadoId).toBe('coop-pf');
      expect(r.cooperativaId).toBe('T-A');
    });

    it('2 cooperados + cooperadoIdEscolhido válido → seleciona o escolhido', async () => {
      findManyCooperado.mockResolvedValueOnce([
        { id: 'coop-pf', nomeCompleto: 'PF', razaoSocial: null, tipoPessoa: 'PF', cooperativaId: 'T', cooperativa: { id: 'T', nome: 'X' } },
        { id: 'coop-pj', nomeCompleto: 'PJ', razaoSocial: 'PJ Ltda', tipoPessoa: 'PJ', cooperativaId: 'T', cooperativa: { id: 'T', nome: 'X' } },
      ]);
      const r = await svc.trocarContexto(usuario, 'cooperado', undefined, 'coop-pj');
      expect(r.cooperadoId).toBe('coop-pj');
    });

    it('2 cooperados SEM cooperadoIdEscolhido → Forbidden (forçar escolha)', async () => {
      findManyCooperado.mockResolvedValueOnce([
        { id: 'coop-pf', nomeCompleto: 'PF', razaoSocial: null, tipoPessoa: 'PF', cooperativaId: 'T', cooperativa: { id: 'T', nome: 'X' } },
        { id: 'coop-pj', nomeCompleto: 'PJ', razaoSocial: null, tipoPessoa: 'PJ', cooperativaId: 'T', cooperativa: { id: 'T', nome: 'X' } },
      ]);
      await expect(svc.trocarContexto(usuario, 'cooperado')).rejects.toThrow(ForbiddenException);
    });

    it('ANTI-IDOR: cooperadoIdEscolhido NÃO pertencente ao usuário → Forbidden', async () => {
      // Usuário tem só coop-pf; tenta trocar pra coop-de-terceiro
      findManyCooperado.mockResolvedValueOnce([
        { id: 'coop-pf', nomeCompleto: 'PF', razaoSocial: null, tipoPessoa: 'PF', cooperativaId: 'T', cooperativa: { id: 'T', nome: 'X' } },
      ]);
      await expect(
        svc.trocarContexto(usuario, 'cooperado', undefined, 'coop-terceiro'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('ANTI-IDOR: cooperadoIdEscolhido de outro tenant mas mesmo Usuario → permitido (multi-tenant)', async () => {
      // Cenário real possível: Usuario com email casa em cooperado de tenant A E tenant B
      findManyCooperado.mockResolvedValueOnce([
        { id: 'coop-a', nomeCompleto: 'PF A', razaoSocial: null, tipoPessoa: 'PF', cooperativaId: 'T-A', cooperativa: { id: 'T-A', nome: 'A' } },
        { id: 'coop-b', nomeCompleto: 'PF B', razaoSocial: null, tipoPessoa: 'PF', cooperativaId: 'T-B', cooperativa: { id: 'T-B', nome: 'B' } },
      ]);
      const r = await svc.trocarContexto(usuario, 'cooperado', undefined, 'coop-b');
      expect(r.cooperadoId).toBe('coop-b');
      expect(r.cooperativaId).toBe('T-B');
    });

    it('ANTI-IDOR: Usuario sem cooperados → Forbidden em contexto cooperado', async () => {
      findManyCooperado.mockResolvedValueOnce([]);
      await expect(svc.trocarContexto(usuario, 'cooperado')).rejects.toThrow(ForbiddenException);
    });

    it('ANTI-IDOR: tentativa de trocar pra contexto.tipo inexistente → Forbidden', async () => {
      findManyCooperado.mockResolvedValueOnce([]);
      await expect(svc.trocarContexto(usuario, 'tipo_inexistente_X' as any)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  // ═════════════════════════════════════════════════════════════════════
  // BUG CRÍTICO FIX (14/06/2026 — blocker lançamento Santi).
  //
  // Antes do fix, trocarContexto não tinha branch pra contexto
  // 'empresa_conveniada' — JWT saía com cooperadoId+cooperativaId
  // undefined → todas as rotas /cooper-token/empresa/* (resgatar,
  // distribuir, meus-resgates) retornavam BadRequest "cooperado não
  // identificado no contexto".
  //
  // Fix: branch espelhando o caso 'cooperado' (contextoValido.id é o
  // Cooperado.id pagador; cooperativaId vem do convênio ATIVO em
  // obterContextosUsuario).
  // ═════════════════════════════════════════════════════════════════════
  describe('trocarContexto — empresa_conveniada (BUG CRÍTICO)', () => {
    it('contexto empresa_conveniada → JWT com cooperadoId + cooperativaId corretos', async () => {
      findManyCooperado.mockResolvedValueOnce([{
        id: 'coop-pj-pagador',
        nomeCompleto: 'Clinica Teste LTDA',
        razaoSocial: 'CLINICA TESTE LTDA',
        tipoPessoa: 'PJ',
        cooperativaId: 'tenant-A',
        cooperativa: { id: 'tenant-A', nome: 'CoopereBR' },
      }]);
      // Convênio ATIVO em que cooperado é pagador (dispara contexto).
      findManyConvenios.mockResolvedValueOnce([{
        id: 'conv-1',
        empresaNome: 'Clinica Teste',
        cooperativaId: 'tenant-A',
      }]);
      findUniqueCooperativa.mockResolvedValueOnce({ nome: 'CoopereBR' });

      const r = await svc.trocarContexto(usuario, 'empresa_conveniada');

      expect(r.cooperadoId).toBe('coop-pj-pagador');
      expect(r.cooperativaId).toBe('tenant-A');
      expect(r.contexto).toBe('empresa_conveniada');
      expect(r.token).toBe('jwt-token-mock');

      // Confirma payload assinado tem cooperadoId + cooperativaId.
      expect(jwtSign).toHaveBeenCalledWith(
        expect.objectContaining({
          sub: 'u-luciano',
          email: 'lucbragatto@gmail.com',
          perfil: 'COOPERADO',
          cooperadoId: 'coop-pj-pagador',
          cooperativaId: 'tenant-A',
        }),
      );
    });

    it('contexto empresa_conveniada SEM convênio ATIVO → Forbidden (contexto não disponível)', async () => {
      // Cooperado existe mas não é pagador de convênio ATIVO →
      // obterContextosUsuario NÃO emite empresa_conveniada → trocarContexto
      // falha no guard `if (!contextoValido)`.
      findManyCooperado.mockResolvedValueOnce([{
        id: 'coop-pj',
        nomeCompleto: 'PJ',
        razaoSocial: null,
        tipoPessoa: 'PJ',
        cooperativaId: 'tenant-A',
        cooperativa: { id: 'tenant-A', nome: 'CoopereBR' },
      }]);
      findManyConvenios.mockResolvedValueOnce([]); // NÃO é pagador
      await expect(
        svc.trocarContexto(usuario, 'empresa_conveniada'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('ANTI-SPOOFING: usuário sem cooperado match → Forbidden (não pode trocar pra empresa de outro)', async () => {
      // Usuario sem cooperado match (email não casa) → cooperados vazio
      // → obterContextosUsuario nunca emite empresa_conveniada → guard
      // bloqueia. Espelha proteção do caso 'cooperado'.
      findManyCooperado.mockResolvedValueOnce([]);
      findManyConvenios.mockResolvedValueOnce([]); // sem-effect (cooperado é null)
      await expect(
        svc.trocarContexto(usuario, 'empresa_conveniada'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('convênio SUSPENSO/RESCINDIDO → não emite contexto (filtro Prisma status:ATIVO)', async () => {
      // P3 review (14/06): tornar explícito que filtro Prisma `status:'ATIVO'`
      // exclui convênios suspensos. O mock simula a query já-filtrada
      // retornando vazio (refletindo o que o banco devolveria).
      findManyCooperado.mockResolvedValueOnce([{
        id: 'coop-pj',
        nomeCompleto: 'PJ',
        razaoSocial: null,
        tipoPessoa: 'PJ',
        cooperativaId: 'tenant-A',
        cooperativa: { id: 'tenant-A', nome: 'X' },
      }]);
      // Convênio existe no banco mas com status SUSPENSO — Prisma `where:
      // {status:'ATIVO'}` filtra antes de retornar. Mock representa o
      // resultado pós-filtro (vazio).
      findManyConvenios.mockResolvedValueOnce([]);
      await expect(
        svc.trocarContexto(usuario, 'empresa_conveniada'),
      ).rejects.toThrow(ForbiddenException);
      // Confirma que a query usa filtro de status:
      expect(findManyConvenios).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'ATIVO' }),
        }),
      );
    });

    // (Cenário multi-convênio é coberto em obter-contextos-empresa.spec.ts —
    // não duplicar aqui pra evitar state-leak de mocks entre testes
    // sequenciais. O fix do bug C.4 é a branch nova em trocarContexto, não
    // a lógica de obterContextosUsuario que já existia.)
  });

  // Revisao multi-tenant 09/06/2026 — impersonate dev nao pode resolver cadastro inativo.
  describe('assinarTokenImpersonate — filtro de status', () => {
    it('findFirst aplica status IN STATUS_COOPERADO_ATIVOS', async () => {
      prisma.cooperado.findFirst.mockResolvedValueOnce({ id: 'c-1', cooperativaId: 'T' });
      await svc.assinarTokenImpersonate({
        id: 'u-1',
        email: 'x@y.com',
        perfil: 'COOPERADO' as any,
        cooperativaId: null,
        administradoraId: null,
        cpf: '111',
      });
      expect(prisma.cooperado.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [{ email: 'x@y.com' }, { cpf: '111' }],
            status: { in: expect.arrayContaining(['ATIVO']) },
          }),
        }),
      );
    });
  });
});
