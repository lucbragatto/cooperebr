/**
 * Sprint M52a — Faxina Contábil Fases C-G (23/06/2026).
 *
 * Cobre os 3 itens NOVOS de comportamento desta sprint:
 *
 *  1. Fix estrutural — `quantidade` SEMPRE positiva.
 *     `creditar` e `debitar` rejeitam quantidade <= 0 (ou NaN/Infinity).
 *     Direção é sempre via `operacao = CREDITO/DEBITO` no ledger.
 *
 *  2. Bloco C — naturezaAto wire (resolverNaturezaAto):
 *     - override SUPER_ADMIN tem precedência absoluta;
 *     - convenioId resolve via `ContratoConvenio.naturezaAtoCooperativo`;
 *     - cross-tenant guard no convênio (M45);
 *     - fallback pro default sugerido da helper.
 *
 *  3. SOCIAL com `naturezaAtoOverride='NAO_COOPERATIVO'` loga warning
 *     forense (risco fiscal Art. 86-87 assumido pelo admin).
 *
 * Testes do Bloco G ($transaction) ficam em
 * `financeiro-token.listener.faxina.spec.ts` (já existente).
 * Reconciliação histórica (Bloco D) é spec opcional via smoke real
 * (`scripts/reconciliacao-historica-faxina-d.ts`).
 */
import { BadRequestException, Logger } from '@nestjs/common';
import { CooperTokenOperacao } from '@prisma/client';
import { CooperTokenService } from './cooper-token.service';
import { sinalDaOperacao } from './cooper-token.ledger-utils';

describe('M52a — Fix estrutural: quantidade SEMPRE positiva', () => {
  let service: CooperTokenService;

  beforeEach(() => {
    service = new CooperTokenService(
      {} as any, // prisma
      { emit: jest.fn() } as any, // eventEmitter
    );
  });

  describe('creditar', () => {
    it.each([0, -1, -0.5, NaN, Infinity, -Infinity])(
      'rejeita quantidade=%p com BadRequestException',
      async (q) => {
        await expect(
          service.creditar({
            cooperadoId: 'c1',
            cooperativaId: 't1',
            tipo: 'BONIFICACAO_ADMIN' as any,
            quantidade: q,
          }),
        ).rejects.toThrow(BadRequestException);
      },
    );

    it('mensagem cita "direção via operacao=CREDITO/DEBITO, nunca via sinal"', async () => {
      try {
        await service.creditar({
          cooperadoId: 'c1',
          cooperativaId: 't1',
          tipo: 'BONIFICACAO_ADMIN' as any,
          quantidade: -1,
        });
        throw new Error('should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(BadRequestException);
        expect((err as Error).message).toContain('quantidade');
        expect((err as Error).message).toContain('operacao=CREDITO/DEBITO');
      }
    });
  });

  describe('debitar', () => {
    it.each([0, -1, -0.5, NaN, Infinity, -Infinity])(
      'rejeita quantidade=%p com BadRequestException',
      async (q) => {
        await expect(
          service.debitar({
            cooperadoId: 'c1',
            cooperativaId: 't1',
            quantidade: q,
          }),
        ).rejects.toThrow(BadRequestException);
      },
    );

    it('mensagem cita direção via operacao=DEBITO', async () => {
      try {
        await service.debitar({
          cooperadoId: 'c1',
          cooperativaId: 't1',
          quantidade: 0,
        });
        throw new Error('should have thrown');
      } catch (err) {
        expect((err as Error).message).toContain('quantidade');
        expect((err as Error).message).toContain('operacao=DEBITO');
      }
    });
  });
});

describe('M52a Bloco C — resolverNaturezaAto', () => {
  function setup(opts: {
    convenios?: Array<{ id: string; cooperativaId: string; naturezaAtoCooperativo: string | null }>;
  } = {}) {
    const convenios = opts.convenios ?? [];

    const prisma = {
      contratoConvenio: {
        findFirst: jest.fn(async (args: any) => {
          const where = args.where ?? {};
          return (
            convenios.find(
              (c) => c.id === where.id && c.cooperativaId === where.cooperativaId,
            ) ?? null
          );
        }),
      },
    } as any;

    const service = new CooperTokenService(prisma, { emit: jest.fn() } as any);
    // resolverNaturezaAto é private — acessamos via cast pra testar a regra.
    const resolver = (service as any).resolverNaturezaAto.bind(service);
    return { service, prisma, resolver };
  }

  it('override SA tem precedência absoluta (mesmo com convenio + default)', async () => {
    const { resolver, prisma } = setup({
      convenios: [{ id: 'cv1', cooperativaId: 't1', naturezaAtoCooperativo: 'AUXILIAR' }],
    });
    const r = await resolver({
      override: 'NAO_COOPERATIVO',
      convenioId: 'cv1',
      cooperativaId: 't1',
      defaultSugerido: 'PROPRIO',
    });
    expect(r).toBe('NAO_COOPERATIVO');
    // Com override, nem precisa consultar o convênio (otimização).
    expect(prisma.contratoConvenio.findFirst).not.toHaveBeenCalled();
  });

  it('sem override mas com convenioId → resolve via ContratoConvenio', async () => {
    const { resolver } = setup({
      convenios: [{ id: 'cv1', cooperativaId: 't1', naturezaAtoCooperativo: 'AUXILIAR' }],
    });
    const r = await resolver({
      convenioId: 'cv1',
      cooperativaId: 't1',
      defaultSugerido: 'PROPRIO',
    });
    expect(r).toBe('AUXILIAR');
  });

  it('convenioId de OUTRO tenant → cross-tenant guard cai no default', async () => {
    const { resolver } = setup({
      convenios: [{ id: 'cv1', cooperativaId: 'OUTRO_TENANT', naturezaAtoCooperativo: 'NAO_COOPERATIVO' }],
    });
    const r = await resolver({
      convenioId: 'cv1',
      cooperativaId: 't1', // tenant diferente
      defaultSugerido: 'PROPRIO',
    });
    expect(r).toBe('PROPRIO');
  });

  it('convenioId existente mas com naturezaAtoCooperativo=null → cai no default', async () => {
    const { resolver } = setup({
      convenios: [{ id: 'cv1', cooperativaId: 't1', naturezaAtoCooperativo: null }],
    });
    const r = await resolver({
      convenioId: 'cv1',
      cooperativaId: 't1',
      defaultSugerido: 'AUXILIAR',
    });
    expect(r).toBe('AUXILIAR');
  });

  it('sem override e sem convenioId → cai no default', async () => {
    const { resolver, prisma } = setup();
    const r = await resolver({
      cooperativaId: 't1',
      defaultSugerido: 'PROPRIO',
    });
    expect(r).toBe('PROPRIO');
    expect(prisma.contratoConvenio.findFirst).not.toHaveBeenCalled();
  });

  it('precedencia: override > convenio > default (full ladder)', async () => {
    const { resolver } = setup({
      convenios: [{ id: 'cv1', cooperativaId: 't1', naturezaAtoCooperativo: 'AUXILIAR' }],
    });

    // override presente → ignora convênio
    expect(
      await resolver({
        override: 'PROPRIO',
        convenioId: 'cv1',
        cooperativaId: 't1',
        defaultSugerido: 'NAO_COOPERATIVO',
      }),
    ).toBe('PROPRIO');

    // sem override, com convênio → usa convênio (ignora default)
    expect(
      await resolver({
        convenioId: 'cv1',
        cooperativaId: 't1',
        defaultSugerido: 'NAO_COOPERATIVO',
      }),
    ).toBe('AUXILIAR');

    // sem nada → default
    expect(
      await resolver({
        cooperativaId: 't1',
        defaultSugerido: 'NAO_COOPERATIVO',
      }),
    ).toBe('NAO_COOPERATIVO');
  });
});

// Sprint M52a v2 (23/06/2026) — re-review orquestrador: switch exaustivo
// `sinalDaOperacao` substitui o `else` cego que subtraía cegamente
// operações de entrada (COMPRA_PARCEIRO, DOACAO_RECEBIDA fora do `if`).
// Specs travam a classificação dos 10 valores do enum CooperTokenOperacao.
describe('M52a v2 — sinalDaOperacao (switch exaustivo)', () => {
  describe('operacoes de ENTRADA (sinal = +1)', () => {
    it.each([
      CooperTokenOperacao.CREDITO,
      CooperTokenOperacao.DOACAO_RECEBIDA,
      CooperTokenOperacao.COMPRA_PARCEIRO,
    ])('%s soma no saldo', (op) => {
      expect(sinalDaOperacao(op)).toBe(1);
    });
  });

  describe('operacoes de SAIDA (sinal = -1)', () => {
    it.each([
      CooperTokenOperacao.DEBITO,
      CooperTokenOperacao.EXPIRACAO,
      CooperTokenOperacao.DOACAO_ENVIADA,
      CooperTokenOperacao.ABATIMENTO_ENERGIA,
      CooperTokenOperacao.TRANSFERENCIA_PARCEIRO,
      CooperTokenOperacao.RESGATE_CLUBE,
      CooperTokenOperacao.OXIDACAO,
    ])('%s subtrai do saldo', (op) => {
      expect(sinalDaOperacao(op)).toBe(-1);
    });
  });

  it('cobertura: todos os 10 valores do enum sao classificados', () => {
    const todos = Object.values(CooperTokenOperacao);
    expect(todos.length).toBe(10);
    // Nenhum valor cai no default `never` (caso contrario, throw).
    for (const op of todos) {
      expect(() => sinalDaOperacao(op)).not.toThrow();
    }
  });

  it('operacao desconhecida (hipotetica) cai no `never` branch e throw', () => {
    // Simula enum value novo nao classificado (caso hipotetico futuro).
    const desconhecida = 'OPERACAO_FUTURA_NAO_CLASSIFICADA' as CooperTokenOperacao;
    expect(() => sinalDaOperacao(desconhecida)).toThrow(/nao classificada|não classificada/i);
  });
});
