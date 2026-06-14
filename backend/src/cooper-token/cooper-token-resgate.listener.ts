/**
 * Sprint Clube P1 — F6 Bloco C.4 P0-B (14/06/2026).
 *
 * Listener do evento `cooper-token-resgate.transfer` emitido pelo
 * `AsaasService.processarWebhook` quando recebe TRANSFER_DONE/CONFIRMED
 * ou TRANSFER_FAILED/CANCELLED do PIX-out disparado pela aprovação F6.
 *
 * Sem este listener, o resgate trava pra sempre em APROVADO_PIX_DISPARADO
 * em modo real (Asaas dispara webhook quando a operação fecha, e o
 * sistema precisa converter pra PAGO_RECIBO_EMITIDO ou FALHA_PIX).
 *
 * Roteamento via EventEmitter espelha o padrão Bloco 2 da compra-PJ
 * (cooper-token-compra-pj.listener.ts) — evita ciclo Asaas↔CooperToken
 * já que CooperTokenModule importa AsaasModule. Idempotência (REFORÇO 2
 * webhook) + compare-and-swap (REFORÇO 3) ficam no service —
 * `processarWebhookResgate` cuida.
 */
import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { CooperTokenService } from './cooper-token.service';

interface CooperTokenResgateTransferPayload {
  asaasTransferId: string;
  eventId: string;
  sucesso: boolean;
  motivoFalha?: string;
  cooperativaId: string;
}

@Injectable()
export class CooperTokenResgateListener {
  private readonly logger = new Logger(CooperTokenResgateListener.name);

  constructor(private readonly cooperTokenService: CooperTokenService) {}

  @OnEvent('cooper-token-resgate.transfer')
  async handleTransfer(payload: CooperTokenResgateTransferPayload): Promise<void> {
    try {
      // F6 C.4 re-review (14/06): passa cooperativaId pra service usar como
      // double-check (defesa em profundidade). asaas.service.ts já validou
      // tenant antes do emit (configCooperativaId === recibo.cooperativaId),
      // mas o service refaz o cruzamento — se outros módulos emitirem o
      // evento no futuro a defesa fica garantida no lugar certo.
      await this.cooperTokenService.processarWebhookResgate({
        asaasTransferId: payload.asaasTransferId,
        eventId: payload.eventId,
        sucesso: payload.sucesso,
        motivoFalha: payload.motivoFalha,
        cooperativaIdEsperada: payload.cooperativaId,
      });
    } catch (err) {
      // Erro NÃO pode quebrar webhook — Asaas re-tenta em backoff. Loga
      // pra investigação posterior; recibo permanece no status anterior
      // até o próximo retry do Asaas (ou cron de reconciliação futuro —
      // D-novo-F6-RECONCILIACAO-CRON P2 catalogado).
      this.logger.error(
        `[resgate.transfer] Falha ao processar transferId=${payload.asaasTransferId} eventId=${payload.eventId}: ${(err as Error).message}`,
      );
    }
  }
}
