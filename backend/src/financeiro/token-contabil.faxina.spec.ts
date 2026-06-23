/**
 * Sprint Faxina Contábil do Token (22/06/2026) — Fase A/B.
 *
 * Specs do TokenContabilService pós-faxina. Cobertura:
 *  - garantirContas usa códigos novos (5.1.10, 5.1.03, 2.3.01, 1.2.02, 1.2.10/11/12)
 *  - lancarIngressoEmissaoPaga gera par {D Caixa (planoContasId=null), C Passivo 2.3.01}
 *  - lancarEmissaoFaturaCheia gera par {D 5.1.10, C 2.3.01} (NÃO mais 5.1.01)
 *  - lancarEmissaoAdminLote gera par {D 5.1.03, C 2.3.01}
 *  - lancarResgateFatura: half-entry D 2.3.01
 *  - lancarExpiracao: par {D 2.3.01, C 1.2.02 Receita Expirados}
 *  - naturezaAto repassado em todos os lançamentos
 *  - Default naturezaAto 'PROPRIO'
 *  - Aposentamento de lancarCompraParceiroPago (método não existe mais)
 */
import {
  TokenContabilService,
  CONTA_CUSTO_DESCONTO_TOKEN,
  CONTA_DESPESA_BONIFICACAO,
  CONTA_PASSIVO_TOKEN,
  CONTA_RECEITA_EXPIRADOS,
} from './token-contabil.service';

function setup() {
  // Mapa codigo -> id pra emular garantirContas idempotente
  const contasMap = new Map<string, { id: string; codigo: string; nome: string; tipo: string; grupo: string }>();
  const planoContasFindFirst = jest.fn().mockImplementation(async (args: any) => {
    const codigo = args.where?.codigo;
    return contasMap.get(codigo) ?? null;
  });
  const planoContasCreate = jest.fn().mockImplementation(async (args: any) => {
    const c = { id: 'pc-' + args.data.codigo, ...args.data };
    contasMap.set(c.codigo, c);
    return c;
  });
  const lancamentoCaixaCreate = jest.fn().mockImplementation(async (args: any) => ({
    id: 'lanc-' + Math.random().toString(36).slice(2, 8),
    ...args.data,
  }));
  const lancamentoCaixaFindFirst = jest.fn().mockResolvedValue(null);

  // Sprint M52a v2 (23/06/2026) — Bloco G migrou 5 métodos pra
  // `prisma.$transaction([...])` (batch). Mock devolve os resultados em
  // ordem, simulando o behavior do Prisma batch transaction.
  const $transaction = jest.fn().mockImplementation(async (operacoes: any[]) => {
    return Promise.all(operacoes);
  });

  const prisma = {
    planoContas: { findFirst: planoContasFindFirst, create: planoContasCreate },
    lancamentoCaixa: { create: lancamentoCaixaCreate, findFirst: lancamentoCaixaFindFirst },
    $transaction,
  } as any;

  const service = new TokenContabilService(prisma);
  return { service, prisma, contasMap, lancamentoCaixaCreate };
}

const TENANT = 'tenant-A';
const COOPERADO = 'coop-1';

describe('Faxina Contábil — TokenContabilService', () => {
  describe('garantirContas (códigos canônicos pós-faxina)', () => {
    it('cria 7 contas se nenhuma existe (5.1.10, 5.1.03, 2.3.01, 1.2.02, 1.2.10, 1.2.11, 1.2.12)', async () => {
      const { service, contasMap } = setup();
      await service.lancarEmissaoFaturaCheia({
        cooperativaId: TENANT,
        cooperadoId: COOPERADO,
        valor: 10,
        descricao: 'test',
      });
      const codigos = Array.from(contasMap.keys()).sort();
      expect(codigos).toEqual([
        '1.2.02', '1.2.10', '1.2.11', '1.2.12',
        '2.3.01',
        '5.1.03', '5.1.10',
      ]);
    });
  });

  describe('lancarIngressoEmissaoPaga (NOVO — D Caixa / C Passivo)', () => {
    it('cria par com planoContasId=null no caixa + 2.3.01 no passivo', async () => {
      const { service, lancamentoCaixaCreate, contasMap } = setup();
      await service.lancarIngressoEmissaoPaga({
        cooperativaId: TENANT,
        cooperadoId: COOPERADO,
        valor: 50,
        descricao: 'compra PJ',
      });
      expect(lancamentoCaixaCreate).toHaveBeenCalledTimes(2);
      const calls = lancamentoCaixaCreate.mock.calls.map((c) => c[0].data);
      const caixa = calls.find((d) => d.descricao.includes('D: Caixa'));
      const passivo = calls.find((d) => d.descricao.includes('C: Passivo'));
      expect(caixa).toBeDefined();
      expect(passivo).toBeDefined();
      expect(caixa.planoContasId).toBeNull();
      expect(passivo.planoContasId).toBe(contasMap.get(CONTA_PASSIVO_TOKEN)?.id);
    });

    it('repassa naturezaAto = AUXILIAR quando vindo do convênio', async () => {
      const { service, lancamentoCaixaCreate } = setup();
      await service.lancarIngressoEmissaoPaga({
        cooperativaId: TENANT,
        cooperadoId: COOPERADO,
        valor: 50,
        descricao: 'convênio',
        naturezaAto: 'AUXILIAR',
      });
      const calls = lancamentoCaixaCreate.mock.calls.map((c) => c[0].data);
      expect(calls[0].naturezaAto).toBe('AUXILIAR');
      expect(calls[1].naturezaAto).toBe('AUXILIAR');
    });

    it('default naturezaAto = PROPRIO quando ausente', async () => {
      const { service, lancamentoCaixaCreate } = setup();
      await service.lancarIngressoEmissaoPaga({
        cooperativaId: TENANT,
        cooperadoId: COOPERADO,
        valor: 50,
        descricao: 'self',
      });
      const calls = lancamentoCaixaCreate.mock.calls.map((c) => c[0].data);
      expect(calls[0].naturezaAto).toBe('PROPRIO');
      expect(calls[1].naturezaAto).toBe('PROPRIO');
    });

    it('arredondamento monetário 2 casas', async () => {
      const { service, lancamentoCaixaCreate } = setup();
      await service.lancarIngressoEmissaoPaga({
        cooperativaId: TENANT,
        cooperadoId: COOPERADO,
        valor: 12.345,
        descricao: 'teste arred',
      });
      const calls = lancamentoCaixaCreate.mock.calls.map((c) => c[0].data);
      expect(calls[0].valor).toBe(12.35);
      expect(calls[1].valor).toBe(12.35);
    });
  });

  describe('lancarEmissaoFaturaCheia (D 5.1.10 — NÃO mais 5.1.01)', () => {
    it('cria par D 5.1.10 Custo Desconto Token / C 2.3.01 Passivo', async () => {
      const { service, lancamentoCaixaCreate, contasMap } = setup();
      await service.lancarEmissaoFaturaCheia({
        cooperativaId: TENANT,
        cooperadoId: COOPERADO,
        valor: 5,
        descricao: 'kWh excedente',
      });
      const calls = lancamentoCaixaCreate.mock.calls.map((c) => c[0].data);
      const debito = calls.find((d) => d.descricao.includes('D: Custo Desconto'));
      const credito = calls.find((d) => d.descricao.includes('C: Passivo'));
      expect(debito.planoContasId).toBe(contasMap.get(CONTA_CUSTO_DESCONTO_TOKEN)?.id);
      expect(credito.planoContasId).toBe(contasMap.get(CONTA_PASSIVO_TOKEN)?.id);
    });

    it('NÃO usa código 5.1.01 (colisão Usina — Fase A migrou 9 lançamentos)', async () => {
      const { service, contasMap } = setup();
      await service.lancarEmissaoFaturaCheia({
        cooperativaId: TENANT,
        cooperadoId: COOPERADO,
        valor: 5,
        descricao: 'test',
      });
      // Nenhuma conta com código 5.1.01 deve ter sido criada/lida.
      expect(contasMap.get('5.1.01')).toBeUndefined();
    });
  });

  describe('lancarEmissaoAdminLote (D 5.1.03 / C 2.3.01)', () => {
    it('cria par D Despesa Bonificação / C Passivo', async () => {
      const { service, lancamentoCaixaCreate, contasMap } = setup();
      await service.lancarEmissaoAdminLote({
        cooperativaId: TENANT,
        cooperadoId: COOPERADO,
        valor: 20,
        descricao: 'admin lote',
        loteId: 'L1',
      });
      const calls = lancamentoCaixaCreate.mock.calls.map((c) => c[0].data);
      const debito = calls.find((d) => d.descricao.includes('D: Despesa de Bonificação'));
      const credito = calls.find((d) => d.descricao.includes('C: Passivo'));
      expect(debito.planoContasId).toBe(contasMap.get(CONTA_DESPESA_BONIFICACAO)?.id);
      expect(credito.planoContasId).toBe(contasMap.get(CONTA_PASSIVO_TOKEN)?.id);
    });
  });

  describe('lancarResgateFatura (D 2.3.01)', () => {
    it('half-entry D Passivo (baixa) com tipo DESPESA', async () => {
      const { service, lancamentoCaixaCreate, contasMap } = setup();
      await service.lancarResgateFatura({
        cooperativaId: TENANT,
        cooperadoId: COOPERADO,
        valor: 4.5,
        descricao: 'abate fatura',
      });
      expect(lancamentoCaixaCreate).toHaveBeenCalledTimes(1);
      const data = lancamentoCaixaCreate.mock.calls[0][0].data;
      expect(data.planoContasId).toBe(contasMap.get(CONTA_PASSIVO_TOKEN)?.id);
      expect(data.descricao).toMatch(/D: Baixa Passivo/);
      // M52a v2 (23/06/2026): movimento em conta de passivo NÃO é despesa.
      expect(data.tipo).toBe('MUTACAO_PASSIVO');
    });

    it('com origemId, grava origemTipo=COBRANCA_ABATE_FATURA (idempotência)', async () => {
      const { service, lancamentoCaixaCreate } = setup();
      await service.lancarResgateFatura({
        cooperativaId: TENANT,
        cooperadoId: COOPERADO,
        valor: 4.5,
        descricao: 'abate fatura',
        origemId: 'cobranca-123',
      });
      const data = lancamentoCaixaCreate.mock.calls[0][0].data;
      expect(data.origemTipo).toBe('COBRANCA_ABATE_FATURA');
      expect(data.origemId).toBe('cobranca-123');
    });
  });

  describe('lancarExpiracao (D 2.3.01 / C 1.2.02 Receita Expirados)', () => {
    it('cria par baixa passivo + receita', async () => {
      const { service, lancamentoCaixaCreate, contasMap } = setup();
      await service.lancarExpiracao({
        cooperativaId: TENANT,
        valor: 30,
        descricao: 'expirados',
      });
      const calls = lancamentoCaixaCreate.mock.calls.map((c) => c[0].data);
      const baixa = calls.find((d) => d.descricao.includes('D: Baixa Passivo (expiração)'));
      const receita = calls.find((d) => d.descricao.includes('C: Receita Tokens Expirados'));
      expect(baixa.planoContasId).toBe(contasMap.get(CONTA_PASSIVO_TOKEN)?.id);
      expect(receita.planoContasId).toBe(contasMap.get(CONTA_RECEITA_EXPIRADOS)?.id);
    });
  });

  describe('aposentamento de lancarCompraParceiroPago', () => {
    it('método não existe mais (substituído por lancarIngressoEmissaoPaga)', () => {
      const { service } = setup();
      expect((service as any).lancarCompraParceiroPago).toBeUndefined();
    });
  });
});
