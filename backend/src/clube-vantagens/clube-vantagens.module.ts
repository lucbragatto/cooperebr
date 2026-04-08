import { Module, forwardRef } from '@nestjs/common';
import { ClubeVantagensController } from './clube-vantagens.controller';
import { ClubeVantagensService } from './clube-vantagens.service';
import { ClubeVantagensJob } from './clube-vantagens.job';
import { PrismaService } from '../prisma.service';
import { WhatsappModule } from '../whatsapp/whatsapp.module';
import { CooperTokenModule } from '../cooper-token/cooper-token.module';

@Module({
  imports: [forwardRef(() => WhatsappModule), CooperTokenModule],
  controllers: [ClubeVantagensController],
  providers: [ClubeVantagensService, ClubeVantagensJob, PrismaService],
  exports: [ClubeVantagensService],
})
export class ClubeVantagensModule {}
