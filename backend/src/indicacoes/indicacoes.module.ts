import { Module, forwardRef } from '@nestjs/common';
import { IndicacoesController } from './indicacoes.controller';
import { IndicacoesService } from './indicacoes.service';
import { PrismaService } from '../prisma.service';
import { ClubeVantagensModule } from '../clube-vantagens/clube-vantagens.module';
import { WhatsappModule } from '../whatsapp/whatsapp.module';

@Module({
  imports: [ClubeVantagensModule, forwardRef(() => WhatsappModule)],
  controllers: [IndicacoesController],
  providers: [IndicacoesService, PrismaService],
  exports: [IndicacoesService],
})
export class IndicacoesModule {}
