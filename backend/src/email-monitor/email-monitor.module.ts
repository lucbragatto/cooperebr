import { Module } from '@nestjs/common';
import { EmailMonitorController } from './email-monitor.controller';
import { EmailMonitorService } from './email-monitor.service';
import { PrismaService } from '../prisma.service';
import { FaturasModule } from '../faturas/faturas.module';

@Module({
  imports: [FaturasModule],
  controllers: [EmailMonitorController],
  providers: [EmailMonitorService, PrismaService],
})
export class EmailMonitorModule {}
