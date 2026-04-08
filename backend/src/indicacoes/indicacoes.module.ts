import { Module, forwardRef } from '@nestjs/common';
import { IndicacoesController } from './indicacoes.controller';
import { IndicacoesService } from './indicacoes.service';
import { PrismaService } from '../prisma.service';
import { ClubeVantagensModule } from '../clube-vantagens/clube-vantagens.module';
import { WhatsappModule } from '../whatsapp/whatsapp.module';
import { ConviteIndicacaoModule } from '../convite-indicacao/convite-indicacao.module';
import { CooperTokenModule } from '../cooper-token/cooper-token.module';

@Module({
  imports: [ClubeVantagensModule, forwardRef(() => WhatsappModule), forwardRef(() => ConviteIndicacaoModule), CooperTokenModule],
  controllers: [IndicacoesController],
  providers: [IndicacoesService, PrismaService],
  exports: [IndicacoesService],
})
export class IndicacoesModule {}
