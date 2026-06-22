/**
 * Sprint Convênio FUNDAÇÃO (21/06/2026) — Fatia C + B + A.
 *
 * Specs do CooperTokenNotificacaoListener:
 * - RESGATADO → notificarAbateFatura (com lookup TokenTransacao)
 * - DISTRIBUIDO_CONVENIO → notificarDistribuicaoConvenio (direto do evento)
 * - Idempotência: skip se MensagemWhatsapp já ENVIADA (tipoDisparo + disparoId)
 * - Sem telefone: skip + log warn
 * - Cross-tenant: cooperado.findFirst com cooperativaId do evento
 */
import { CooperTokenNotificacaoListener } from './cooper-token-notificacao.listener';
import {
  CooperTokenResgatadoEvent,
  CooperTokenDistribuidoConvenioEvent,
  CooperTokenResgatadoFamiliarEvent,
} from './cooper-token.events';

describe('CooperTokenNotificacaoListener — Sprint Convênio FUNDAÇÃO (E8 wiring)', () => {
  const mensagemFindFirst = jest.fn();
  const tokenTxFindFirst = jest.fn();
  const cooperadoFindFirst = jest.fn();
  const notificarAbateFatura = jest.fn();
  const notificarDistribuicaoConvenio = jest.fn();
  const notificarAbateFaturaPagadorFamiliar = jest.fn();
  const notificarAbateFaturaTitularFamiliar = jest.fn();

  const prismaMock = {
    mensagemWhatsapp: { findFirst: mensagemFindFirst },
    tokenTransacao: { findFirst: tokenTxFindFirst },
    cooperado: { findFirst: cooperadoFindFirst },
  } as any;

  const notifMock = {
    notificarAbateFatura,
    notificarDistribuicaoConvenio,
    notificarAbateFaturaPagadorFamiliar,
    notificarAbateFaturaTitularFamiliar,
  } as any;

  const listener = new CooperTokenNotificacaoListener(prismaMock, notifMock);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ═══ RESGATADO (cooperado abateu fatura) ════════════════════════════
  describe('handleResgatado (cooper-token.resgatado)', () => {
    const evt = new CooperTokenResgatadoEvent(
      'tenant-A',
      'coop-1',
      'cobranca-1',
      100,
      45.0,
    );

    it('caminho feliz: notifica + multi-tenant + lookup TokenTransacao', async () => {
      tokenTxFindFirst.mockResolvedValue({ id: 'tx-abate-1' });
      mensagemFindFirst.mockResolvedValue(null);
      cooperadoFindFirst.mockResolvedValue({
        telefone: '5527999998888',
        nomeCompleto: 'Cooperado Teste',
      });

      await listener.handleResgatado(evt);

      expect(tokenTxFindFirst).toHaveBeenCalledWith({
        where: {
          pagadorCooperativaId: 'tenant-A',
          pagadorId: 'coop-1',
          tipoOperacao: 'USO_FATURA',
          referenciaExterna: 'cobranca-1',
        },
        orderBy: { createdAt: 'desc' },
        select: { id: true },
      });
      expect(cooperadoFindFirst).toHaveBeenCalledWith({
        where: { id: 'coop-1', cooperativaId: 'tenant-A' },
        select: { telefone: true, nomeCompleto: true },
      });
      expect(notificarAbateFatura).toHaveBeenCalledWith(
        expect.objectContaining({
          telefoneCooperado: '5527999998888',
          nomeCooperado: 'Cooperado Teste',
          cooperadoId: 'coop-1',
          cooperativaId: 'tenant-A',
          cobrancaId: 'cobranca-1',
          transacaoId: 'tx-abate-1',
        }),
      );
    });

    it('idempotência: skip se MensagemWhatsapp já ENVIADA (com filtro cooperativaId defense-in-depth)', async () => {
      tokenTxFindFirst.mockResolvedValue({ id: 'tx-abate-1' });
      mensagemFindFirst.mockResolvedValue({ id: 'msg-anterior' });

      await listener.handleResgatado(evt);

      // P1-B code-reviewer 21/06 — asserta filtro multi-tenant no dedup.
      expect(mensagemFindFirst).toHaveBeenCalledWith({
        where: {
          tipoDisparo: 'TOKEN_ABATE_FATURA',
          disparoId: 'tx-abate-1',
          status: 'ENVIADA',
          cooperativaId: 'tenant-A',
        },
        select: { id: true },
      });
      expect(cooperadoFindFirst).not.toHaveBeenCalled();
      expect(notificarAbateFatura).not.toHaveBeenCalled();
    });

    it('TokenTransacao não encontrada → skip silencioso', async () => {
      tokenTxFindFirst.mockResolvedValue(null);

      await listener.handleResgatado(evt);

      expect(mensagemFindFirst).not.toHaveBeenCalled();
      expect(notificarAbateFatura).not.toHaveBeenCalled();
    });

    it('cooperado sem telefone → skip + log warn (D-novo-NOTIF-EMAIL-FALLBACK)', async () => {
      tokenTxFindFirst.mockResolvedValue({ id: 'tx-abate-1' });
      mensagemFindFirst.mockResolvedValue(null);
      cooperadoFindFirst.mockResolvedValue({
        telefone: null,
        nomeCompleto: 'Sem Telefone',
      });

      await listener.handleResgatado(evt);

      expect(notificarAbateFatura).not.toHaveBeenCalled();
    });

    it('erro na busca não propaga (best-effort)', async () => {
      tokenTxFindFirst.mockRejectedValue(new Error('boom'));

      await expect(listener.handleResgatado(evt)).resolves.toBeUndefined();
    });
  });

  // ═══ DISTRIBUIDO_CONVENIO (empresa→funcionário) ═══════════════════
  describe('handleDistribuidoConvenio (cooper-token.distribuido-convenio)', () => {
    const evt = new CooperTokenDistribuidoConvenioEvent(
      'tenant-A',
      'empresa-pj-1',
      'ACME Ltda',
      'funcionario-1',
      'convenio-1',
      50,
      22.5,
      'tx-dist-1',
    );

    it('caminho feliz: notifica destinatário (multi-tenant + transacaoId direto do evento)', async () => {
      mensagemFindFirst.mockResolvedValue(null);
      cooperadoFindFirst.mockResolvedValue({
        telefone: '5527988887777',
        nomeCompleto: 'Funcionário Teste',
      });

      await listener.handleDistribuidoConvenio(evt);

      expect(mensagemFindFirst).toHaveBeenCalledWith({
        where: {
          tipoDisparo: 'TOKEN_DISTRIBUICAO_CONVENIO_RECEBIDA',
          disparoId: 'tx-dist-1',
          status: 'ENVIADA',
          cooperativaId: 'tenant-A',
        },
        select: { id: true },
      });
      expect(cooperadoFindFirst).toHaveBeenCalledWith({
        where: { id: 'funcionario-1', cooperativaId: 'tenant-A' },
        select: { telefone: true, nomeCompleto: true },
      });
      expect(notificarDistribuicaoConvenio).toHaveBeenCalledWith(
        expect.objectContaining({
          telefoneDestinatario: '5527988887777',
          nomeDestinatario: 'Funcionário Teste',
          destinatarioCooperadoId: 'funcionario-1',
          cooperativaId: 'tenant-A',
          nomeEmpresa: 'ACME Ltda',
          quantidadeTokens: 50,
          valorReais: 22.5,
          transacaoId: 'tx-dist-1',
        }),
      );
    });

    it('idempotência: skip se MensagemWhatsapp já ENVIADA', async () => {
      mensagemFindFirst.mockResolvedValue({ id: 'msg-anterior' });

      await listener.handleDistribuidoConvenio(evt);

      expect(cooperadoFindFirst).not.toHaveBeenCalled();
      expect(notificarDistribuicaoConvenio).not.toHaveBeenCalled();
    });

    it('destinatário sem telefone → skip + log warn', async () => {
      mensagemFindFirst.mockResolvedValue(null);
      cooperadoFindFirst.mockResolvedValue({
        telefone: null,
        nomeCompleto: 'Sem Telefone',
      });

      await listener.handleDistribuidoConvenio(evt);

      expect(notificarDistribuicaoConvenio).not.toHaveBeenCalled();
    });

    it('cross-tenant: cooperado.findFirst filtra cooperativaId do evento', async () => {
      mensagemFindFirst.mockResolvedValue(null);
      cooperadoFindFirst.mockResolvedValue(null); // outro tenant — não acha

      await listener.handleDistribuidoConvenio(evt);

      expect(cooperadoFindFirst).toHaveBeenCalledWith({
        where: { id: 'funcionario-1', cooperativaId: 'tenant-A' },
        select: { telefone: true, nomeCompleto: true },
      });
      expect(notificarDistribuicaoConvenio).not.toHaveBeenCalled();
    });

    it('erro na busca não propaga (best-effort)', async () => {
      mensagemFindFirst.mockRejectedValue(new Error('boom'));

      await expect(listener.handleDistribuidoConvenio(evt)).resolves.toBeUndefined();
    });
  });

  // ═══ RESGATADO_FAMILIAR (M49 — abate familiar 2 lados) ═════════════
  describe('handleResgatadoFamiliar (cooper-token.resgatado-familiar)', () => {
    const evtFamiliar = new CooperTokenResgatadoFamiliarEvent(
      'tenant-A',
      'coop-pagador',
      'coop-titular',
      'aut-1',
      'cobranca-1',
      100,
      45.0,
    );

    it('caminho feliz: notifica PAGADOR + TITULAR (2 envios separados)', async () => {
      tokenTxFindFirst.mockResolvedValue({ id: 'tx-abate-1' });
      mensagemFindFirst.mockResolvedValue(null); // nem pagador nem titular têm dedup hit
      // 2 chamadas Promise.all → pagador primeiro, titular depois
      cooperadoFindFirst
        .mockResolvedValueOnce({ telefone: '5527981341348', nomeCompleto: 'Pagadora' })
        .mockResolvedValueOnce({ telefone: '5527999998888', nomeCompleto: 'Titular' });

      await listener.handleResgatadoFamiliar(evtFamiliar);

      expect(notificarAbateFaturaPagadorFamiliar).toHaveBeenCalledWith(
        expect.objectContaining({
          telefonePagador: '5527981341348',
          nomePagador: 'Pagadora',
          cooperadoPagadorId: 'coop-pagador',
          cooperativaId: 'tenant-A',
          cobrancaId: 'cobranca-1',
          nomeTitular: 'Titular',
          quantidadeTokens: 100,
          valorReais: 45,
          transacaoId: 'tx-abate-1',
        }),
      );
      expect(notificarAbateFaturaTitularFamiliar).toHaveBeenCalledWith(
        expect.objectContaining({
          telefoneTitular: '5527999998888',
          nomeTitular: 'Titular',
          cooperadoTitularId: 'coop-titular',
          cooperativaId: 'tenant-A',
          nomePagador: 'Pagadora',
          transacaoId: 'tx-abate-1',
        }),
      );
    });

    it('idempotência separada por tipoDisparo (PAGADOR já enviada → só titular dispara)', async () => {
      tokenTxFindFirst.mockResolvedValue({ id: 'tx-abate-1' });
      // 1ª chamada (pagador): já enviada; 2ª (titular): null
      mensagemFindFirst
        .mockResolvedValueOnce({ id: 'msg-anterior' })
        .mockResolvedValueOnce(null);
      cooperadoFindFirst
        .mockResolvedValueOnce({ telefone: '5527981341348', nomeCompleto: 'Pagadora' })
        .mockResolvedValueOnce({ telefone: '5527999998888', nomeCompleto: 'Titular' });

      await listener.handleResgatadoFamiliar(evtFamiliar);

      expect(notificarAbateFaturaPagadorFamiliar).not.toHaveBeenCalled();
      expect(notificarAbateFaturaTitularFamiliar).toHaveBeenCalled();
    });

    it('TokenTransacao não encontrada → skip silencioso (sem chamada de WA)', async () => {
      tokenTxFindFirst.mockResolvedValue(null);

      await listener.handleResgatadoFamiliar(evtFamiliar);

      expect(notificarAbateFaturaPagadorFamiliar).not.toHaveBeenCalled();
      expect(notificarAbateFaturaTitularFamiliar).not.toHaveBeenCalled();
    });

    it('pagador sem telefone → só titular notifica + log warn', async () => {
      tokenTxFindFirst.mockResolvedValue({ id: 'tx-abate-1' });
      mensagemFindFirst.mockResolvedValue(null);
      cooperadoFindFirst
        .mockResolvedValueOnce({ telefone: null, nomeCompleto: 'Pagadora' })
        .mockResolvedValueOnce({ telefone: '5527999998888', nomeCompleto: 'Titular' });

      await listener.handleResgatadoFamiliar(evtFamiliar);

      expect(notificarAbateFaturaPagadorFamiliar).not.toHaveBeenCalled();
      expect(notificarAbateFaturaTitularFamiliar).toHaveBeenCalled();
    });

    it('titular sem telefone → só pagador notifica + log warn', async () => {
      tokenTxFindFirst.mockResolvedValue({ id: 'tx-abate-1' });
      mensagemFindFirst.mockResolvedValue(null);
      cooperadoFindFirst
        .mockResolvedValueOnce({ telefone: '5527981341348', nomeCompleto: 'Pagadora' })
        .mockResolvedValueOnce({ telefone: null, nomeCompleto: 'Titular' });

      await listener.handleResgatadoFamiliar(evtFamiliar);

      expect(notificarAbateFaturaPagadorFamiliar).toHaveBeenCalled();
      expect(notificarAbateFaturaTitularFamiliar).not.toHaveBeenCalled();
    });

    it('erro na busca TokenTransacao não propaga (best-effort)', async () => {
      tokenTxFindFirst.mockRejectedValue(new Error('boom'));

      await expect(listener.handleResgatadoFamiliar(evtFamiliar)).resolves.toBeUndefined();
    });

    it('lookup TokenTransacao usa pagadorCooperativaId + pagadorId (não titular)', async () => {
      tokenTxFindFirst.mockResolvedValue({ id: 'tx-abate-1' });
      mensagemFindFirst.mockResolvedValue(null);
      cooperadoFindFirst.mockResolvedValue({ telefone: null, nomeCompleto: 'X' });

      await listener.handleResgatadoFamiliar(evtFamiliar);

      expect(tokenTxFindFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            pagadorCooperativaId: 'tenant-A',
            pagadorId: 'coop-pagador',
            tipoOperacao: 'USO_FATURA',
            referenciaExterna: 'cobranca-1',
          }),
        }),
      );
    });
  });
});
