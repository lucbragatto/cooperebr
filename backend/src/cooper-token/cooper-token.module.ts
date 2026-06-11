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
// Sprint Clube P1 — F4 Bloco A (12/06/2026): PinCooperadoService pra
// step-up de autorização em usarNaFatura (cooperado abate fatura via PIN).
// CooperadosModule exporta PinCooperadoService — sem ciclo direto (Cooperados
// importa Whatsapp via forwardRef; Whatsapp importa CooperToken via
// forwardRef abaixo — então o caminho fecha sem precisar de forwardRef aqui).
import { CooperadosModule } from '../cooperados/cooperados.module';

@Module({
  imports: [
    forwardRef(() => WhatsappModule),
    EmailModule,
    AsaasModule,
    CooperadosModule,
  ],
  controllers: [CooperTokenController, ContabilidadeClubeController],
  providers: [
    CooperTokenService,
    CooperTokenJob,
    LimiteTokenService,
    TokenNotificacaoService,
    PrismaService,
    CooperTokenCompraPjListener,
  ],
  exports: [CooperTokenService, LimiteTokenService, TokenNotificacaoService],
})
export class CooperTokenModule {}
