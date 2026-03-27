import { Module } from '@nestjs/common';
import { EmailService } from './email.service';
import { EmailRecebimentoService } from './email-recebimento.service';
import { EmailController } from './email.controller';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [EmailController],
  providers: [EmailService, EmailRecebimentoService, PrismaService],
  exports: [EmailService],
})
export class EmailModule {}
