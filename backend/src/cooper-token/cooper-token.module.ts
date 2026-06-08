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

@Module({
  imports: [forwardRef(() => WhatsappModule), EmailModule],
  controllers: [CooperTokenController, ContabilidadeClubeController],
  providers: [
    CooperTokenService,
    CooperTokenJob,
    LimiteTokenService,
    TokenNotificacaoService,
    PrismaService,
  ],
  exports: [CooperTokenService, LimiteTokenService, TokenNotificacaoService],
})
export class CooperTokenModule {}
