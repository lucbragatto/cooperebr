/**
 * Sprint Funil M48 (22/06/2026) — Camada 1 Fatia B.
 *
 * Specs do RoteamentoCadastroService:
 *  - Cobertura dos 4 caminhos (C_NOVO, A_MIGRACAO, B_REDIRECT_PARCEIRO,
 *    AMBIGUO_ADMIN).
 *  - Multi-tenant: matcher cross-tenant retorna SÓ tenantAlvo + razao.
 *  - Cascata de sinais: jaRecebeCreditosGd > classificacaoScee >
 *    fornecedorGdAtual.
 *  - Match CNPJ direto e alias texto (substring nos 2 sentidos).
 *  - Edge cases: nulls, strings vazias, alias curto, MESMO tenant declarado.
 *  - Helpers: normalizarAlias + extrairCnpj.
 */
import {
  RoteamentoCadastroService,
  CAMINHOS_ROTEAMENTO,
  TIPOS_ALIAS_VALIDOS,
} from './roteamento-cadastro.service';

describe('RoteamentoCadastroService — Sprint Funil M48 Camada 1 Motor', () => {
  const cooperativaFindUnique = jest.fn();
  const aliasFindFirst = jest.fn();
  const aliasFindMany = jest.fn();

  const prismaMock = {
    cooperativa: { findUnique: cooperativaFindUnique },
    aliasParceiroSisgd: {
      findFirst: aliasFindFirst,
      findMany: aliasFindMany,
    },
  } as any;

  const service = new RoteamentoCadastroService(prismaMock);

  beforeEach(() => {
    jest.clearAllMocks();
    aliasFindFirst.mockResolvedValue(null);
    aliasFindMany.mockResolvedValue([]);
    cooperativaFindUnique.mockResolvedValue(null);
  });

  // ═══ Helpers estáticos ═════════════════════════════════════════════
  describe('normalizarAlias', () => {
    it('lowercase + sem acento + sem pontuação + trim + colapsa espaços', () => {
      expect(RoteamentoCadastroService.normalizarAlias('  CoopereBR  '))
        .toBe('cooperebr');
      expect(RoteamentoCadastroService.normalizarAlias('Coópêre-BR Ltda.'))
        .toBe('coopere br ltda');
      expect(RoteamentoCadastroService.normalizarAlias('ACME    Energia'))
        .toBe('acme energia');
    });
  });

  describe('extrairCnpj', () => {
    it('extrai CNPJ formatado em texto livre', () => {
      expect(RoteamentoCadastroService.extrairCnpj('Sou da ACME 12.345.678/0001-95'))
        .toBe('12345678000195');
    });
    it('H2 code-reviewer 22/06: NÃO aceita 14 dígitos puros (evita telefone como CNPJ)', () => {
      // Telefone +5527981341348 limpo = "5527981341348" (13 dig); +55 com DDD
      // pode ser 14 dig: "55279813413480". Sem estrutura visual de CNPJ → null.
      expect(RoteamentoCadastroService.extrairCnpj('5527981341348')).toBeNull();
      expect(RoteamentoCadastroService.extrairCnpj('55279813413480')).toBeNull();
    });
    it('retorna null se não tem CNPJ válido', () => {
      expect(RoteamentoCadastroService.extrairCnpj('CoopereBR Energia'))
        .toBeNull();
      expect(RoteamentoCadastroService.extrairCnpj('1234567')).toBeNull();
    });
  });

  // ═══ Caminhos ═════════════════════════════════════════════════════
  describe('decidirCaminho — Caminho C (lead novo)', () => {
    it('jaRecebeCreditosGd=false → C_NOVO + razão explícita', async () => {
      const r = await service.decidirCaminho({
        jaRecebeCreditosGd: false,
        cooperativaIdSugerida: 'tenant-A',
      });
      expect(r.caminho).toBe('C_NOVO');
      expect(r.razao).toContain('NÃO recebe');
      expect(r.tenantAlvo).toBeUndefined();
    });

    it('classificacaoScee=NAO_GD → C_NOVO mesmo sem autodeclaração', async () => {
      const r = await service.decidirCaminho({
        classificacaoScee: 'NAO_GD',
        cooperativaIdSugerida: 'tenant-A',
      });
      expect(r.caminho).toBe('C_NOVO');
    });

    it('todos sinais null → C_NOVO (default seguro)', async () => {
      const r = await service.decidirCaminho({
        cooperativaIdSugerida: 'tenant-A',
      });
      expect(r.caminho).toBe('C_NOVO');
      expect(r.razao).toContain('Sem sinal');
    });
  });

  describe('decidirCaminho — Caminho A (concorrente)', () => {
    it('jaRecebeCreditosGd=true + fornecedor que não bate → A_MIGRACAO', async () => {
      const r = await service.decidirCaminho({
        jaRecebeCreditosGd: true,
        fornecedorGdAtual: 'Soluna Energia Solar Ltda',
        cooperativaIdSugerida: 'tenant-A',
      });
      expect(r.caminho).toBe('A_MIGRACAO');
      expect(r.razao).toContain('não bate');
      expect(r.tenantAlvo).toBeUndefined();
    });

    it('classificacaoScee=GD_I + fornecedor sem match → A_MIGRACAO', async () => {
      const r = await service.decidirCaminho({
        classificacaoScee: 'GD_I',
        fornecedorGdAtual: 'Origo Energia',
        cooperativaIdSugerida: 'tenant-A',
      });
      expect(r.caminho).toBe('A_MIGRACAO');
    });
  });

  describe('decidirCaminho — Caminho B (parceiro SISGD)', () => {
    it('CNPJ válido bate com Cooperativa.cnpj de OUTRO tenant → B_REDIRECT_PARCEIRO', async () => {
      cooperativaFindUnique.mockResolvedValue({ id: 'tenant-B-real', ativo: true });
      const r = await service.decidirCaminho({
        jaRecebeCreditosGd: true,
        fornecedorGdAtual: 'ACME 12.345.678/0001-95',
        cooperativaIdSugerida: 'tenant-A',
      });
      expect(r.caminho).toBe('B_REDIRECT_PARCEIRO');
      expect(r.tenantAlvo).toBe('tenant-B-real');
      expect(r.razao).toContain('CNPJ');
      expect(r.razao).toContain('outro parceiro');
    });

    it('CNPJ bate com MESMO tenant do cadastro → C_NOVO (não é canibalização)', async () => {
      cooperativaFindUnique.mockResolvedValue({ id: 'tenant-A', ativo: true });
      const r = await service.decidirCaminho({
        jaRecebeCreditosGd: true,
        fornecedorGdAtual: 'CoopereBR 12.345.678/0001-95',
        cooperativaIdSugerida: 'tenant-A',
      });
      expect(r.caminho).toBe('C_NOVO');
      expect(r.razao).toContain('MESMO tenant');
    });

    it('CNPJ bate mas Cooperativa.ativo=false → A_MIGRACAO (P2 multitenant 22/06)', async () => {
      cooperativaFindUnique.mockResolvedValue({ id: 'tenant-suspenso', ativo: false });
      const r = await service.decidirCaminho({
        jaRecebeCreditosGd: true,
        fornecedorGdAtual: 'Suspenso 12.345.678/0001-95',
        cooperativaIdSugerida: 'tenant-A',
      });
      // Cooperativa inativa NÃO ativa caminho B; trata como concorrente A.
      expect(r.caminho).toBe('A_MIGRACAO');
    });

    it('alias texto bate com outro parceiro SISGD (cross-tenant lookup) → B_REDIRECT_PARCEIRO', async () => {
      aliasFindFirst.mockResolvedValue({
        cooperativaId: 'tenant-B-real',
        alias: 'CoopereBR',
      });
      const r = await service.decidirCaminho({
        jaRecebeCreditosGd: true,
        fornecedorGdAtual: 'CoopereBR',
        cooperativaIdSugerida: 'tenant-A',
      });
      expect(r.caminho).toBe('B_REDIRECT_PARCEIRO');
      expect(r.tenantAlvo).toBe('tenant-B-real');
      expect(r.razao).toContain('Alias');
    });

    it('alias do banco é substring do texto declarado → B via match inverso', async () => {
      // findFirst (substring fwd) miss; findMany (substring rev) hit
      aliasFindFirst.mockResolvedValue(null);
      aliasFindMany.mockResolvedValue([
        { cooperativaId: 'tenant-B-real', alias: 'CoopereBR' },
      ]);
      const r = await service.decidirCaminho({
        jaRecebeCreditosGd: true,
        fornecedorGdAtual: 'Sou cliente da CoopereBR Energia Solar',
        cooperativaIdSugerida: 'tenant-A',
      });
      expect(r.caminho).toBe('B_REDIRECT_PARCEIRO');
      expect(r.tenantAlvo).toBe('tenant-B-real');
    });
  });

  describe('decidirCaminho — Caminho AMBIGUO_ADMIN', () => {
    it('jaRecebeCreditosGd=true mas sem fornecedor → AMBIGUO_ADMIN', async () => {
      const r = await service.decidirCaminho({
        jaRecebeCreditosGd: true,
        cooperativaIdSugerida: 'tenant-A',
      });
      expect(r.caminho).toBe('AMBIGUO_ADMIN');
      expect(r.razao).toContain('NÃO declarou');
    });

    it('fornecedor vazio (apenas espaços) → AMBIGUO_ADMIN', async () => {
      const r = await service.decidirCaminho({
        jaRecebeCreditosGd: true,
        fornecedorGdAtual: '   ',
        cooperativaIdSugerida: 'tenant-A',
      });
      expect(r.caminho).toBe('AMBIGUO_ADMIN');
    });
  });

  // ═══ Multi-tenant nota ════════════════════════════════════════════
  describe('Multi-tenant — matcher cross-tenant', () => {
    it('Retorno em caminho B contém SÓ tenantAlvo + razao (sem vazar Cooperativa.nome/cnpj)', async () => {
      aliasFindFirst.mockResolvedValue({
        cooperativaId: 'tenant-B-real',
        alias: 'CoopereBR',
      });
      const r = await service.decidirCaminho({
        jaRecebeCreditosGd: true,
        fornecedorGdAtual: 'CoopereBR',
        cooperativaIdSugerida: 'tenant-A',
      });
      // Garante shape mínimo do retorno — não vaza dados sensíveis
      expect(Object.keys(r).sort()).toEqual(['caminho', 'razao', 'tenantAlvo'].sort());
    });
  });

  // ═══ Const arrays expostos ═══════════════════════════════════════
  describe('Constantes públicas', () => {
    it('CAMINHOS_ROTEAMENTO expõe os 4 valores', () => {
      expect(CAMINHOS_ROTEAMENTO).toEqual([
        'C_NOVO',
        'A_MIGRACAO',
        'B_REDIRECT_PARCEIRO',
        'AMBIGUO_ADMIN',
      ]);
    });
    // L2 code-reviewer 22/06.
    it('TIPOS_ALIAS_VALIDOS expõe os 4 tipos', () => {
      expect(TIPOS_ALIAS_VALIDOS).toEqual([
        'NOME_CURTO',
        'MARCA_COMERCIAL',
        'SLUG_HISTORICO',
        'CNPJ_SECUNDARIO',
      ]);
    });
  });
});
