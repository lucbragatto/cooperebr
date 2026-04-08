import { Module, forwardRef } from '@nestjs/common';
import { CooperTokenController } from './cooper-token.controller';
import { CooperTokenService } from './cooper-token.service';
import { CooperTokenJob } from './cooper-token.job';
import { PrismaService } from '../prisma.service';
import { FinanceiroModule } from '../financeiro/financeiro.module';

@Module({
  imports: [forwardRef(() => FinanceiroModule)],
  controllers: [CooperTokenController],
  providers: [CooperTokenService, CooperTokenJob, PrismaService],
  exports: [CooperTokenService],
})
export class CooperTokenModule {}
