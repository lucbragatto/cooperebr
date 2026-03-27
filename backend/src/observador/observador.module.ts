import { Module, forwardRef } from '@nestjs/common';
import { ObservadorController } from './observador.controller';
import { ObservadorService } from './observador.service';
import { PrismaService } from '../prisma.service';
import { WhatsappModule } from '../whatsapp/whatsapp.module';

@Module({
  imports: [forwardRef(() => WhatsappModule)],
  controllers: [ObservadorController],
  providers: [ObservadorService, PrismaService],
  exports: [ObservadorService],
})
export class ObservadorModule {}
