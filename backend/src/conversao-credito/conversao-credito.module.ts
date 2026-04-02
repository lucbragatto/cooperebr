import { Module } from '@nestjs/common';
import { ConversaoCreditoController } from './conversao-credito.controller';
import { ConversaoCreditoService } from './conversao-credito.service';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [ConversaoCreditoController],
  providers: [ConversaoCreditoService, PrismaService],
  exports: [ConversaoCreditoService],
})
export class ConversaoCreditoModule {}
