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
} from './cooper-token.events';

describe('CooperTokenNotificacaoListener — Sprint Convênio FUNDAÇÃO (E8 wiring)', () => {
  const mensagemFindFirst = jest.fn();
  const tokenTxFindFirst = jest.fn();
  const cooperadoFindFirst = jest.fn();
  const notificarAbateFatura = jest.fn();
  const notificarDistribuicaoConvenio = jest.fn();

  const prismaMock = {
    mensagemWhatsapp: { findFirst: mensagemFindFirst },
    tokenTransacao: { findFirst: tokenTxFindFirst },
    cooperado: { findFirst: cooperadoFindFirst },
  } as any;

  const notifMock = {
    notificarAbateFatura,
    notificarDistribuicaoConvenio,
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
});
