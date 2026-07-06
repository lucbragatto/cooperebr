import { Module, forwardRef } from '@nestjs/common';
import { EmailMonitorController } from './email-monitor.controller';
import { EmailMonitorService } from './email-monitor.service';
import { FaturasCampanhaService } from './faturas-campanha.service';
import { PrismaService } from '../prisma.service';
import { FaturasModule } from '../faturas/faturas.module';
import { WhatsappModule } from '../whatsapp/whatsapp.module';

@Module({
  imports: [FaturasModule, forwardRef(() => WhatsappModule)],
  controllers: [EmailMonitorController],
  providers: [EmailMonitorService, FaturasCampanhaService, PrismaService],
  // Sprint Máscara (06/07/2026) — FaturasCampanhaService também é usado pelo
  // convenios.controller (endpoints admin GET/PATCH faturas-campanha).
  exports: [FaturasCampanhaService],
})
export class EmailMonitorModule {}
