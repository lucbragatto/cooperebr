import { Module, forwardRef } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { CooperadosController } from './cooperados.controller';
import { CooperadosService } from './cooperados.service';
import { CooperadosJob } from './cooperados.job';
// Sprint Token-WA Fase 2 F2.3 (07/06/2026) — PIN do cooperado pra
// autorização de transações CooperToken via WhatsApp.
import { PinCooperadoService } from './pin-cooperado.service';
// Sprint Token-WA Fase 2 F2.4 (07/06/2026) — vínculo persistente
// cooperado×WhatsApp (anti SIM-swap).
import { AparelhoVinculadoService } from './aparelho-vinculado.service';
import { OtpDesafioService } from '../common/security/otp-desafio.service';
import { PrismaService } from '../prisma.service';
import { NotificacoesService } from '../notificacoes/notificacoes.service';
import { UsinasModule } from '../usinas/usinas.module';
import { UcsModule } from '../ucs/ucs.module';
// Sprint M47 (21/06/2026): controller dos cooperados expõe /migrar/* que delega
// pro MigracaoExternaService exportado por MigracoesUsinaModule.
import { MigracoesUsinaModule } from '../migracoes-usina/migracoes-usina.module';
// Sprint Token-WA Fase 2 F2.8 (07/06/2026) — WhatsappModule importa CooperadosModule
// (PinCooperadoService no motor de fluxo), entao reverso vira forwardRef.
import { WhatsappModule } from '../whatsapp/whatsapp.module';
import { EmailModule } from '../email/email.module';
import { FaturasModule } from '../faturas/faturas.module';
import { MotorPropostaModule } from '../motor-proposta/motor-proposta.module';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const multerLib = require('multer') as { memoryStorage: () => object };

@Module({
  imports: [
    UsinasModule,
    UcsModule,
    forwardRef(() => WhatsappModule),
    EmailModule,
    FaturasModule,
    forwardRef(() => MotorPropostaModule),
    forwardRef(() => MigracoesUsinaModule),
    MulterModule.register({ storage: multerLib.memoryStorage() }),
  ],
  controllers: [CooperadosController],
  providers: [
    CooperadosService,
    CooperadosJob,
    PinCooperadoService,
    AparelhoVinculadoService,
    OtpDesafioService,
    PrismaService,
    NotificacoesService,
  ],
  exports: [
    CooperadosService,
    PinCooperadoService,
    AparelhoVinculadoService,
    OtpDesafioService,
  ],
})
export class CooperadosModule {}
