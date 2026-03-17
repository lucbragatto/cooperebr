import { Module } from '@nestjs/common';
import { MotorPropostaController } from './motor-proposta.controller';
import { MotorPropostaService } from './motor-proposta.service';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [MotorPropostaController],
  providers: [MotorPropostaService, PrismaService],
  exports: [MotorPropostaService],
})
export class MotorPropostaModule {}
