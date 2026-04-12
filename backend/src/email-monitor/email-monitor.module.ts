import { Module } from '@nestjs/common';
import { EmailMonitorController } from './email-monitor.controller';
import { EmailMonitorService } from './email-monitor.service';
import { PrismaService } from '../prisma.service';
import { FaturasModule } from '../faturas/faturas.module';
import { WhatsappModule } from '../whatsapp/whatsapp.module';

@Module({
  imports: [FaturasModule, WhatsappModule],
  controllers: [EmailMonitorController],
  providers: [EmailMonitorService, PrismaService],
})
export class EmailMonitorModule {}
