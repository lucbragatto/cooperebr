import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ConveniosController } from './convenios.controller';

/**
 * D-FISCAL-2.4.4b — Specs dos endpoints novos de cobrança consolidada custeio.
 *
 * Cobre validações que estão NO CONTROLLER (não delegadas ao service):
 *  - mesReferencia formato YYYY-MM obrigatório
 *  - mesReferencia <= mês corrente (proibido futuro)
 *  - cooperativaId no JWT obrigatório
 *  - delega corretamente pro custeioService
 *
 * Service já é coberto por 33 specs em convenios-custeio.service.spec.ts.
 */
describe('ConveniosController — D-FISCAL-2.4.4b endpoints', () => {
  const custeioMock = {
    gerarCobrancaConsolidada: jest.fn(),
    listarConsolidadasDoConvenio: jest.fn(),
  };
  const conveniosServiceMock = {} as any;
  const membrosServiceMock = {} as any;
  const progressaoServiceMock = {} as any;
  const contabilidadeMock = {} as any;

  let controller: ConveniosController;

  beforeEach(() => {
    jest.clearAllMocks();
    // Sprint Máscara (06/07/2026) — construtor ganhou ConvitesConvenio,
    // ConvenioAprovacao e FaturasCampanha nas sprints anteriores + nesta.
    // Stubs vazios são suficientes pra este spec (testa custeio).
    controller = new ConveniosController(
      conveniosServiceMock,
      membrosServiceMock,
      progressaoServiceMock,
      contabilidadeMock,
      custeioMock as any,
      {} as any, // ConvitesConvenioService
      {} as any, // ConvenioAprovacaoService
      {} as any, // FaturasCampanhaService (Sprint Máscara 06/07)
    );
  });

  describe('GET /convenios/:id/cobrancas-consolidadas', () => {
    it('sem cooperativaId no JWT → ForbiddenException', async () => {
      await expect(
        controller.listarCobrancasConsolidadas('conv-1', { user: {} }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(custeioMock.listarConsolidadasDoConvenio).not.toHaveBeenCalled();
    });

    it('delega pro service com tenant correto', async () => {
      custeioMock.listarConsolidadasDoConvenio.mockResolvedValueOnce([
        { id: 'cob-1', mesReferencia: 5, anoReferencia: 2026 },
      ]);
      const r = await controller.listarCobrancasConsolidadas('conv-1', {
        user: { cooperativaId: 'coop-A' },
      });
      expect(custeioMock.listarConsolidadasDoConvenio).toHaveBeenCalledWith('conv-1', 'coop-A');
      expect(r).toHaveLength(1);
    });
  });

  describe('POST /convenios/:id/cobrancas-consolidadas/gerar', () => {
    const req = { user: { cooperativaId: 'coop-A', id: 'usr-1' } };

    it('sem cooperativaId → ForbiddenException', async () => {
      await expect(
        controller.gerarCobrancaConsolidadaManual('conv-1', '2026-05', { user: {} }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('mesReferencia ausente → BadRequest', async () => {
      await expect(
        controller.gerarCobrancaConsolidadaManual('conv-1', '' as any, req),
      ).rejects.toThrow(/mesReferencia obrigatório/);
    });

    it('mesReferencia formato inválido (ex: "2026/05") → BadRequest', async () => {
      await expect(
        controller.gerarCobrancaConsolidadaManual('conv-1', '2026/05', req),
      ).rejects.toThrow(/formato YYYY-MM/);
    });

    it('mês 13 → BadRequest', async () => {
      await expect(
        controller.gerarCobrancaConsolidadaManual('conv-1', '2026-13', req),
      ).rejects.toThrow(/Mês inválido/);
    });

    it('mês futuro → BadRequest', async () => {
      // 2099-12 é claramente futuro independentemente da data corrente do teste
      await expect(
        controller.gerarCobrancaConsolidadaManual('conv-1', '2099-12', req),
      ).rejects.toThrow(/futuro/);
      expect(custeioMock.gerarCobrancaConsolidada).not.toHaveBeenCalled();
    });

    it('mês válido e passado → delega pro service com args corretos', async () => {
      custeioMock.gerarCobrancaConsolidada.mockResolvedValueOnce({
        status: 'CRIADA',
        cobrancaId: 'cob-novo',
        valorBruto: 947.17,
        valorLiquido: 947.17,
      });
      const r = await controller.gerarCobrancaConsolidadaManual('conv-1', '2026-01', req);
      expect(custeioMock.gerarCobrancaConsolidada).toHaveBeenCalledWith({
        convenioId: 'conv-1',
        mesReferencia: 1,
        anoReferencia: 2026,
        cooperativaId: 'coop-A',
      });
      expect((r as any).status).toBe('CRIADA');
    });

    it('mês corrente permitido (não rejeita)', async () => {
      const hoje = new Date();
      const mesCorrente = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
      custeioMock.gerarCobrancaConsolidada.mockResolvedValueOnce({
        status: 'CRIADA',
        cobrancaId: 'cob-corrente',
        valorBruto: 100,
        valorLiquido: 100,
      });
      await controller.gerarCobrancaConsolidadaManual('conv-1', mesCorrente, req);
      expect(custeioMock.gerarCobrancaConsolidada).toHaveBeenCalledTimes(1);
    });
  });
});
