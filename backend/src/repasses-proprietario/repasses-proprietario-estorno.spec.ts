import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { StatusRepasseProprietario } from '@prisma/client';
import { RepassesProprietarioService } from './repasses-proprietario.service';

/**
 * D-novo-BR-CT estorno (31/05/2026 noite) — Specs do ciclo de estorno.
 *
 * Cobre:
 *  - estornarRepasse: status→PENDENTE + lançamento deletado + despesas desvinculadas
 *  - Bloqueio se apuração FECHADA
 *  - Bloqueio se status != PAGO
 *  - Multi-tenant guard
 *  - Motivo obrigatório (≥ 10 chars)
 *  - Idempotência: repagar recria lançamento (origemId livre)
 *  - obterCicloRepasse retorna { repasse, lançamento, despesas[] }
 */
describe('RepassesProprietarioService — Estorno + Ciclo', () => {
  const findRepasse = jest.fn();
  const updateRepasse = jest.fn();
  const findApur = jest.fn();
  const deleteLanc = jest.fn();
  const updateContas = jest.fn();
  const findLanc = jest.fn();
  const findContas = jest.fn();
  const $transaction = jest.fn();

  const prismaMock = {
    repasseProprietario: { findUnique: findRepasse, update: updateRepasse },
    apuracaoMensalSegregada: { findUnique: findApur },
    lancamentoCaixa: { deleteMany: deleteLanc, findFirst: findLanc },
    contaAPagar: { updateMany: updateContas, findMany: findContas },
    $transaction,
  } as any;

  let service: RepassesProprietarioService;

  const repassePago = {
    id: 'rep1',
    cooperativaId: 'coop-A',
    usinaId: 'usina-A',
    status: StatusRepasseProprietario.PAGO,
    dataPagamento: new Date('2026-05-15'),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new RepassesProprietarioService(prismaMock as any);
    // Default: apuração ABERTA (não bloqueia)
    findApur.mockResolvedValue({ id: 'apur1', status: 'ABERTA' });
    // $transaction retorna o resultado dos N comandos — o primeiro é o updated repasse
    $transaction.mockImplementation(async (ops: any[]) => {
      const r = {
        ...repassePago,
        status: StatusRepasseProprietario.PENDENTE,
        dataPagamento: null,
        metodoPagamento: null,
        comprovante: null,
        observacao: null,
        estornadoEm: new Date(),
        estornadoPorUsuarioId: 'admin',
        motivoEstorno: 'qualquer',
        periodoInicio: new Date('2026-05-01'),
        periodoFim: new Date('2026-05-31'),
        valorBruto: 1000,
        totalDespesasAbatidas: 100,
        valorLiquido: 900,
        createdAt: new Date(),
        updatedAt: new Date(),
        usina: { nome: 'Usina A' },
        proprietarioUsuario: null,
        registradoPor: null,
      };
      return [r, { count: 1 }, { count: 2 }];
    });
  });

  // ============================================================
  // estornarRepasse — happy path
  // ============================================================

  describe('estornarRepasse', () => {
    it('PAGO + apuração ABERTA → status PENDENTE + reverte ciclo', async () => {
      findRepasse.mockResolvedValueOnce(repassePago);
      const r = await service.estornarRepasse(
        'rep1',
        'Erro de digitação na data de pagamento',
        'admin',
        'coop-A',
        'ADMIN',
      );
      expect(r.status).toBe(StatusRepasseProprietario.PENDENTE);
      expect($transaction).toHaveBeenCalled();
      // Confere que as 3 operações foram passadas pra transação
      const ops = ($transaction as jest.Mock).mock.calls[0][0];
      expect(ops).toHaveLength(3);
    });

    it('motivo < 10 chars → 400', async () => {
      await expect(
        service.estornarRepasse('rep1', 'curto', 'admin', 'coop-A', 'ADMIN'),
      ).rejects.toThrow(BadRequestException);
    });

    it('repasse inexistente → 404', async () => {
      findRepasse.mockResolvedValueOnce(null);
      await expect(
        service.estornarRepasse(
          'rep-X',
          'Erro detectado pelo financeiro hoje',
          'admin',
          'coop-A',
          'ADMIN',
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it.each([
      StatusRepasseProprietario.PENDENTE,
      StatusRepasseProprietario.CANCELADO,
    ])('status %s não pode ser estornado → 409', async (status) => {
      findRepasse.mockResolvedValueOnce({ ...repassePago, status });
      await expect(
        service.estornarRepasse(
          'rep1',
          'Erro detectado pelo financeiro hoje',
          'admin',
          'coop-A',
          'ADMIN',
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('cross-tenant ADMIN → 403', async () => {
      findRepasse.mockResolvedValueOnce(repassePago);
      await expect(
        service.estornarRepasse(
          'rep1',
          'Erro detectado pelo financeiro hoje',
          'admin',
          'coop-B',
          'ADMIN',
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('SUPER_ADMIN pode estornar qualquer tenant', async () => {
      findRepasse.mockResolvedValueOnce(repassePago);
      await expect(
        service.estornarRepasse(
          'rep1',
          'Erro detectado pelo financeiro hoje',
          'sa',
          null,
          'SUPER_ADMIN',
        ),
      ).resolves.toHaveProperty('status', StatusRepasseProprietario.PENDENTE);
    });

    // ─── Gate contábil: apuração FECHADA bloqueia ───
    it('apuração do período FECHADA → 409 com mensagem de reabertura', async () => {
      findRepasse.mockResolvedValueOnce(repassePago);
      findApur.mockResolvedValueOnce({ id: 'apur1', status: 'FECHADA' });
      await expect(
        service.estornarRepasse(
          'rep1',
          'Erro detectado pelo financeiro hoje',
          'admin',
          'coop-A',
          'ADMIN',
        ),
      ).rejects.toThrow(/Apuração de 05\/2026 fechada/);
    });

    it('apuração inexistente (mês sem snapshot) → não bloqueia', async () => {
      findRepasse.mockResolvedValueOnce(repassePago);
      findApur.mockResolvedValueOnce(null);
      const r = await service.estornarRepasse(
        'rep1',
        'Erro detectado pelo financeiro hoje',
        'admin',
        'coop-A',
        'ADMIN',
      );
      expect(r.status).toBe(StatusRepasseProprietario.PENDENTE);
    });

    it('PAGO sem dataPagamento → 409 (estado inconsistente)', async () => {
      findRepasse.mockResolvedValueOnce({ ...repassePago, dataPagamento: null });
      await expect(
        service.estornarRepasse(
          'rep1',
          'Erro detectado pelo financeiro hoje',
          'admin',
          'coop-A',
          'ADMIN',
        ),
      ).rejects.toThrow(/estado inconsistente/);
    });

    it('transação chama deleteMany lançamento + updateMany despesas', async () => {
      findRepasse.mockResolvedValueOnce(repassePago);
      await service.estornarRepasse(
        'rep1',
        'Erro detectado pelo financeiro hoje',
        'admin',
        'coop-A',
        'ADMIN',
      );
      const ops = ($transaction as jest.Mock).mock.calls[0][0];
      expect(ops).toHaveLength(3);
      // Confere que invocamos deleteMany no LancamentoCaixa
      expect(deleteLanc).toHaveBeenCalledWith({
        where: { origemTipo: 'REPASSE', origemId: 'rep1' },
      });
      // E updateMany no ContaAPagar pra desvincular
      expect(updateContas).toHaveBeenCalledWith({
        where: { repasseAbatidoId: 'rep1' },
        data: {
          repasseAbatidoId: null,
          statusResolucao: 'PENDENTE',
          resolvidoEm: null,
        },
      });
    });
  });

  // ============================================================
  // obterCicloRepasse
  // ============================================================

  describe('obterCicloRepasse', () => {
    const repasseDb = {
      ...repassePago,
      periodoInicio: new Date('2026-05-01'),
      periodoFim: new Date('2026-05-31'),
      valorBruto: 1000,
      totalDespesasAbatidas: 100,
      valorLiquido: 900,
      createdAt: new Date(),
      updatedAt: new Date(),
      usina: { nome: 'Usina A' },
      proprietarioUsuario: null,
      registradoPor: null,
    };

    it('retorna { repasse, lançamento, despesas[] }', async () => {
      findRepasse.mockResolvedValueOnce(repasseDb);
      findLanc.mockResolvedValueOnce({
        id: 'lanc1',
        tipo: 'DESPESA',
        descricao: '[CT] Repasse usina Usina A',
        valor: '900',
        naturezaAto: 'PROPRIO',
        status: 'REALIZADO',
        competencia: '2026-05',
        dataPagamento: new Date('2026-05-15'),
      });
      findContas.mockResolvedValueOnce([
        {
          id: 'c1',
          descricao: 'Manutenção painel',
          categoria: 'MANUTENCAO',
          valor: '100',
          dataOcorrencia: new Date('2026-05-10'),
        },
      ]);
      const r = await service.obterCicloRepasse('rep1', 'coop-A', 'ADMIN');
      expect(r.repasse.id).toBe('rep1');
      expect(r.lancamentoGerado?.naturezaAto).toBe('PROPRIO');
      expect(r.lancamentoGerado?.valor).toBe(900);
      expect(r.despesasAbatidas).toHaveLength(1);
      expect(r.despesasAbatidas[0].descricao).toBe('Manutenção painel');
    });

    it('repasse sem lançamento (PENDENTE/CANCELADO) → lancamentoGerado=null', async () => {
      findRepasse.mockResolvedValueOnce(repasseDb);
      findLanc.mockResolvedValueOnce(null);
      findContas.mockResolvedValueOnce([]);
      const r = await service.obterCicloRepasse('rep1', 'coop-A', 'ADMIN');
      expect(r.lancamentoGerado).toBeNull();
      expect(r.despesasAbatidas).toHaveLength(0);
    });

    it('repasse inexistente → 404', async () => {
      findRepasse.mockResolvedValueOnce(null);
      await expect(service.obterCicloRepasse('rep-X', 'coop-A', 'ADMIN')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('cross-tenant ADMIN → 403', async () => {
      findRepasse.mockResolvedValueOnce(repasseDb);
      await expect(service.obterCicloRepasse('rep1', 'coop-B', 'ADMIN')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  // ============================================================
  // Idempotência — repagar após estornar
  // ============================================================

  describe('idempotência estorno → re-pagamento', () => {
    it('estornar deleta lançamento (libera origemId); marcarPago pode recriar', async () => {
      findRepasse.mockResolvedValueOnce(repassePago);
      await service.estornarRepasse(
        'rep1',
        'Erro detectado pelo financeiro hoje',
        'admin',
        'coop-A',
        'ADMIN',
      );
      // O deleteMany filtra exatamente o origemId, garantindo que
      // criarLancamentoAutomatico (CT.3) possa recriar sem violar @@unique.
      expect(deleteLanc).toHaveBeenCalledWith({
        where: { origemTipo: 'REPASSE', origemId: 'rep1' },
      });
    });
  });
});
