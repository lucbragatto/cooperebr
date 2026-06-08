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
});
