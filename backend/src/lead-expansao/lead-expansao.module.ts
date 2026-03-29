import { Module } from '@nestjs/common';
import { LeadExpansaoController } from './lead-expansao.controller';
import { LeadExpansaoService } from './lead-expansao.service';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [LeadExpansaoController],
  providers: [LeadExpansaoService, PrismaService],
  exports: [LeadExpansaoService],
})
export class LeadExpansaoModule {}
