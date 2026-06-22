/**
 * Sprint Convênio FAMÍLIA M49 (22/06/2026) — Fatia C.
 */
import { Module, forwardRef } from '@nestjs/common';
import { AutorizacaoTokenFamiliarController } from './autorizacao-token-familiar.controller';
import { AutorizacaoTokenFamiliarService } from './autorizacao-token-familiar.service';
import { PrismaService } from '../prisma.service';
import { CooperadosModule } from '../cooperados/cooperados.module';
import { WhatsappModule } from '../whatsapp/whatsapp.module';

@Module({
  imports: [
    forwardRef(() => CooperadosModule),    // PinCooperadoService
    forwardRef(() => WhatsappModule),      // WhatsappSenderService
  ],
  controllers: [AutorizacaoTokenFamiliarController],
  providers: [AutorizacaoTokenFamiliarService, PrismaService],
  exports: [AutorizacaoTokenFamiliarService],
})
export class AutorizacaoTokenFamiliarModule {}
