/**
 * Sprint Clube P1 — Fase 2 Bloco 3 (11/06/2026).
 *
 * Listener do evento `cooper-token-compra-pj.paga` emitido pelo
 * `AsaasService.processarWebhook` quando o pagamento de uma
 * `CooperTokenCompra` (asaasId match) eh confirmado/recebido.
 *
 * Roteamento via EventEmitter evita dependencia circular Asaas↔CooperToken
 * (CooperTokenModule importa AsaasModule no Bloco 2; o caminho reverso
 * usa evento). Idempotencia + creditar() ficam no service —
 * `processarPagamentoCompraPj` chama tudo.
 */
import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { CooperTokenService } from './cooper-token.service';

interface CooperTokenCompraPjPagaPayload {
  compraId: string;
  eventId: string;
  paymentId: string;
}

@Injectable()
export class CooperTokenCompraPjListener {
  private readonly logger = new Logger(CooperTokenCompraPjListener.name);

  constructor(private readonly cooperTokenService: CooperTokenService) {}

  @OnEvent('cooper-token-compra-pj.paga')
  async handlePaga(payload: CooperTokenCompraPjPagaPayload): Promise<void> {
    try {
      await this.cooperTokenService.processarPagamentoCompraPj(
        payload.compraId,
        payload.eventId,
      );
    } catch (err) {
      // Erro nao deve quebrar webhook — Asaas re-tenta em backoff. Loga.
      this.logger.error(
        `[compra-pj.paga] Falha ao processar compraId=${payload.compraId} eventId=${payload.eventId}: ${(err as Error).message}`,
      );
    }
  }
}
