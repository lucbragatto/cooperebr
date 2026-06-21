import { Module, forwardRef } from '@nestjs/common';
import { CooperTokenController } from './cooper-token.controller';
import { ContabilidadeClubeController } from './contabilidade-clube.controller';
import { CooperTokenService } from './cooper-token.service';
import { CooperTokenJob } from './cooper-token.job';
import { PrismaService } from '../prisma.service';
// Sprint Token-WA Fase 2 F2.5 (07/06/2026) — limites 2 níveis cooperativa×cooperado.
import { LimiteTokenService } from './limite-token.service';
// Sprint Token-WA Fase 2 F2.6 (07/06/2026) — notificações 2 lados + OTP alto valor por email.
import { TokenNotificacaoService } from './token-notificacao.service';
import { WhatsappModule } from '../whatsapp/whatsapp.module';
import { EmailModule } from '../email/email.module';
// Sprint Clube P1 — Fase 2 Bloco 2 (11/06/2026): empresa-PJ-cooperada
// compra tokens via Asaas. Service emite cobranca usando emitirCobranca.
import { AsaasModule } from '../asaas/asaas.module';
// Sprint Clube P1 — Fase 2 Bloco 3 (11/06/2026): listener do webhook Asaas.
import { CooperTokenCompraPjListener } from './cooper-token-compra-pj.listener';
// Sprint Clube P1 — F6 Bloco C.4 P0-B (14/06/2026): listener TRANSFER_* do
// Asaas pra rota PIX-out → processarWebhookResgate.
import { CooperTokenResgateListener } from './cooper-token-resgate.listener';
// Sprint Convênio FUNDAÇÃO (21/06/2026) — E8 wiring: listener único que
// consome RESGATADO + DISTRIBUIDO_CONVENIO e dispara WA via
// TokenNotificacaoService. Idempotente via lookup em MensagemWhatsapp.
import { CooperTokenNotificacaoListener } from './cooper-token-notificacao.listener';
// Sprint Clube P1 — F4 Bloco A (12/06/2026): PinCooperadoService pra
// step-up de autorização em usarNaFatura (cooperado abate fatura via PIN).
// CooperadosModule exporta PinCooperadoService.
//
// F4 Bloco B (12/06/2026): forwardRef OBRIGATÓRIO. O caminho real é
// CooperToken → Cooperados → Whatsapp → Faturas (cadeia profunda),
// e há ramo Cooperados → ... → CooperToken no AppModule. Sem forwardRef,
// Nest captura `CooperadosModule` como undefined em runtime (erro
// UndefinedModuleException constatado no boot).
import { CooperadosModule } from '../cooperados/cooperados.module';
// Sprint Clube P1 — F6 Bloco B (12/06/2026): consumer do AsaasPixOutService
// pra resgate em R$ via PIX (estabelecimento → R$). FinanceiroModule exporta.
import { FinanceiroModule } from '../financeiro/financeiro.module';
// Sprint D2.1 v2 (16/06/2026) — disclaimer versionado no Guard 1.6.
import { DisclaimerSaqueModule } from '../disclaimer-saque/disclaimer-saque.module';

@Module({
  imports: [
    forwardRef(() => WhatsappModule),
    EmailModule,
    AsaasModule,
    forwardRef(() => CooperadosModule),
    FinanceiroModule,
    DisclaimerSaqueModule,
  ],
  controllers: [CooperTokenController, ContabilidadeClubeController],
  providers: [
    CooperTokenService,
    CooperTokenJob,
    LimiteTokenService,
    TokenNotificacaoService,
    PrismaService,
    CooperTokenCompraPjListener,
    CooperTokenResgateListener,
    CooperTokenNotificacaoListener,
  ],
  exports: [CooperTokenService, LimiteTokenService, TokenNotificacaoService],
})
export class CooperTokenModule {}
