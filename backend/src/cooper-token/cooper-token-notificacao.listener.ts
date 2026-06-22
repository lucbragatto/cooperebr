/**
 * Sprint Convênio FUNDAÇÃO (21/06/2026) — E8 wiring.
 *
 * Listener único que consome 2 eventos do CooperToken e dispara
 * notificações WhatsApp ao cooperado/destinatário via TokenNotificacaoService.
 *
 *  - `cooper-token.resgatado` (RESGATADO): cooperado abateu fatura com tokens
 *    (`usarNaFatura`). Notifica o cooperado dono da fatura.
 *  - `cooper-token.distribuido-convenio` (DISTRIBUIDO_CONVENIO): empresa-PJ
 *    distribuiu N tokens pra funcionário via convênio (`distribuirTokens`).
 *    Notifica o destinatário.
 *
 * IDEMPOTÊNCIA (cuidado B do orquestrador 21/06):
 *  - Antes de cada envio, lookup em MensagemWhatsapp por (tipoDisparo,
 *    disparoId, status='ENVIADA', cooperativaId). Se já enviada, skip silencioso.
 *  - `disparoId` = `TokenTransacao.id` da transação (mesma chave no event).
 *  - `cooperativaId` adicionado pra defense-in-depth multi-tenant (P3-A
 *    multitenant review 21/06).
 *  - Garante que retry/replay do listener não duplica WA.
 *
 * BEST-EFFORT:
 *  - Falhas não derrubam o fluxo (transação já commitada).
 *  - Sem fila WA dedicada — sequencial por evento (cuidado throttle A do
 *    orquestrador). Catalogar débito se piloto Santi mostrar burst grande.
 *
 * Sem telefone (Cooperado.telefone null): skip + log warn. Catalogado
 * D-novo-NOTIF-EMAIL-FALLBACK P3 pra email fallback futuro.
 */
import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma.service';
import { TokenNotificacaoService } from './token-notificacao.service';
import {
  COOPER_TOKEN_EVENTS,
  CooperTokenResgatadoEvent,
  CooperTokenDistribuidoConvenioEvent,
  CooperTokenResgatadoFamiliarEvent,
} from './cooper-token.events';

@Injectable()
export class CooperTokenNotificacaoListener {
  private readonly logger = new Logger(CooperTokenNotificacaoListener.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notif: TokenNotificacaoService,
  ) {}

  /**
   * Verifica se a notificação (tipoDisparo + disparoId + cooperativaId) já
   * foi enviada com sucesso. Idempotente — retry/replay não duplica WA.
   * `cooperativaId` no where é defense-in-depth (P3-A multitenant review
   * 21/06) — `disparoId` é CUID global, então colisão estrutural é
   * impossível, mas o filtro mantém o pattern multi-tenant do projeto.
   */
  private async jaEnviada(
    tipoDisparo: string,
    disparoId: string,
    cooperativaId: string,
  ): Promise<boolean> {
    const existente = await this.prisma.mensagemWhatsapp.findFirst({
      where: { tipoDisparo, disparoId, status: 'ENVIADA', cooperativaId },
      select: { id: true },
    });
    return !!existente;
  }

  @OnEvent(COOPER_TOKEN_EVENTS.RESGATADO)
  async handleResgatado(evt: CooperTokenResgatadoEvent): Promise<void> {
    try {
      // Pode haver 2 transações com mesmo cobrancaId (raro, mas é o discriminador
      // mais estável). Dedup será por TokenTransacao.id via lookup posterior.
      const tokenTx = await this.prisma.tokenTransacao.findFirst({
        where: {
          pagadorCooperativaId: evt.cooperativaId,
          pagadorId: evt.cooperadoId,
          tipoOperacao: 'USO_FATURA',
          referenciaExterna: evt.cobrancaId,
        },
        orderBy: { createdAt: 'desc' },
        select: { id: true },
      });
      if (!tokenTx) {
        this.logger.warn(
          `[notif-listener] RESGATADO: TokenTransacao não encontrada cooperado=${evt.cooperadoId} cobranca=${evt.cobrancaId}`,
        );
        return;
      }
      if (await this.jaEnviada('TOKEN_ABATE_FATURA', tokenTx.id, evt.cooperativaId)) {
        this.logger.debug(
          `[notif-listener] RESGATADO: WA já enviada (idempotente) transacaoId=${tokenTx.id}`,
        );
        return;
      }
      const cooperado = await this.prisma.cooperado.findFirst({
        where: { id: evt.cooperadoId, cooperativaId: evt.cooperativaId },
        select: { telefone: true, nomeCompleto: true },
      });
      if (!cooperado?.telefone) {
        this.logger.warn(
          `[notif-listener] RESGATADO: cooperado sem telefone (D-novo-NOTIF-EMAIL-FALLBACK) cooperado=${evt.cooperadoId}`,
        );
        return;
      }
      await this.notif.notificarAbateFatura({
        telefoneCooperado: cooperado.telefone,
        nomeCooperado: cooperado.nomeCompleto,
        cooperadoId: evt.cooperadoId,
        cooperativaId: evt.cooperativaId,
        cobrancaId: evt.cobrancaId,
        quantidadeTokens: evt.quantidade,
        valorReais: evt.valorReais,
        transacaoId: tokenTx.id,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `[notif-listener] Erro ao processar RESGATADO cooperado=${evt.cooperadoId} cobranca=${evt.cobrancaId}: ${msg}`,
      );
    }
  }

  /**
   * Sprint Família M49 (22/06/2026) — abate familiar.
   *
   * 2 envios WA por evento (pagador + titular), com idempotência separada
   * por tipoDisparo (TOKEN_ABATE_FATURA_PAGADOR_FAMILIAR e
   * TOKEN_ABATE_FATURA_TITULAR_FAMILIAR). Sem telefone num dos lados:
   * envia só o outro + log warn. Best-effort — não derruba fluxo.
   */
  @OnEvent(COOPER_TOKEN_EVENTS.RESGATADO_FAMILIAR)
  async handleResgatadoFamiliar(evt: CooperTokenResgatadoFamiliarEvent): Promise<void> {
    try {
      const tokenTx = await this.prisma.tokenTransacao.findFirst({
        where: {
          pagadorCooperativaId: evt.cooperativaId,
          pagadorId: evt.cooperadoPagadorId,
          tipoOperacao: 'USO_FATURA',
          referenciaExterna: evt.cobrancaId,
        },
        orderBy: { createdAt: 'desc' },
        select: { id: true },
      });
      if (!tokenTx) {
        this.logger.warn(
          `[notif-listener] RESGATADO_FAMILIAR: TokenTransacao não encontrada pagador=${evt.cooperadoPagadorId} titular=${evt.cooperadoTitularId} cobranca=${evt.cobrancaId}`,
        );
        return;
      }

      const [pagador, titular] = await Promise.all([
        this.prisma.cooperado.findFirst({
          where: { id: evt.cooperadoPagadorId, cooperativaId: evt.cooperativaId },
          select: { telefone: true, nomeCompleto: true },
        }),
        this.prisma.cooperado.findFirst({
          where: { id: evt.cooperadoTitularId, cooperativaId: evt.cooperativaId },
          select: { telefone: true, nomeCompleto: true },
        }),
      ]);

      // PAGADOR
      if (
        !(await this.jaEnviada(
          'TOKEN_ABATE_FATURA_PAGADOR_FAMILIAR',
          tokenTx.id,
          evt.cooperativaId,
        ))
      ) {
        if (pagador?.telefone && titular) {
          await this.notif.notificarAbateFaturaPagadorFamiliar({
            telefonePagador: pagador.telefone,
            nomePagador: pagador.nomeCompleto,
            cooperadoPagadorId: evt.cooperadoPagadorId,
            cooperativaId: evt.cooperativaId,
            cobrancaId: evt.cobrancaId,
            nomeTitular: titular.nomeCompleto,
            quantidadeTokens: evt.quantidade,
            valorReais: evt.valorReais,
            transacaoId: tokenTx.id,
          });
        } else {
          this.logger.warn(
            `[notif-listener] RESGATADO_FAMILIAR: pagador sem telefone ou titular não encontrado pagador=${evt.cooperadoPagadorId}`,
          );
        }
      }

      // TITULAR
      if (
        !(await this.jaEnviada(
          'TOKEN_ABATE_FATURA_TITULAR_FAMILIAR',
          tokenTx.id,
          evt.cooperativaId,
        ))
      ) {
        if (titular?.telefone && pagador) {
          await this.notif.notificarAbateFaturaTitularFamiliar({
            telefoneTitular: titular.telefone,
            nomeTitular: titular.nomeCompleto,
            cooperadoTitularId: evt.cooperadoTitularId,
            cooperativaId: evt.cooperativaId,
            cobrancaId: evt.cobrancaId,
            nomePagador: pagador.nomeCompleto,
            quantidadeTokens: evt.quantidade,
            valorReais: evt.valorReais,
            transacaoId: tokenTx.id,
          });
        } else {
          this.logger.warn(
            `[notif-listener] RESGATADO_FAMILIAR: titular sem telefone ou pagador não encontrado titular=${evt.cooperadoTitularId}`,
          );
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `[notif-listener] Erro ao processar RESGATADO_FAMILIAR pagador=${evt.cooperadoPagadorId} titular=${evt.cooperadoTitularId} cobranca=${evt.cobrancaId}: ${msg}`,
      );
    }
  }

  @OnEvent(COOPER_TOKEN_EVENTS.DISTRIBUIDO_CONVENIO)
  async handleDistribuidoConvenio(evt: CooperTokenDistribuidoConvenioEvent): Promise<void> {
    try {
      if (await this.jaEnviada('TOKEN_DISTRIBUICAO_CONVENIO_RECEBIDA', evt.transacaoId, evt.cooperativaId)) {
        this.logger.debug(
          `[notif-listener] DISTRIBUIDO_CONVENIO: WA já enviada (idempotente) transacaoId=${evt.transacaoId}`,
        );
        return;
      }
      const destinatario = await this.prisma.cooperado.findFirst({
        where: { id: evt.destinatarioCooperadoId, cooperativaId: evt.cooperativaId },
        select: { telefone: true, nomeCompleto: true },
      });
      if (!destinatario?.telefone) {
        this.logger.warn(
          `[notif-listener] DISTRIBUIDO_CONVENIO: destinatário sem telefone (D-novo-NOTIF-EMAIL-FALLBACK) destinatario=${evt.destinatarioCooperadoId}`,
        );
        return;
      }
      await this.notif.notificarDistribuicaoConvenio({
        telefoneDestinatario: destinatario.telefone,
        nomeDestinatario: destinatario.nomeCompleto,
        destinatarioCooperadoId: evt.destinatarioCooperadoId,
        cooperativaId: evt.cooperativaId,
        nomeEmpresa: evt.empresaNome,
        quantidadeTokens: evt.quantidade,
        valorReais: evt.valorReais,
        transacaoId: evt.transacaoId,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `[notif-listener] Erro ao processar DISTRIBUIDO_CONVENIO destinatario=${evt.destinatarioCooperadoId} transacaoId=${evt.transacaoId}: ${msg}`,
      );
    }
  }
}
