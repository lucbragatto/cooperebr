import { Module } from '@nestjs/common';
import { GeracaoMensalController } from './geracao-mensal.controller';
import { GeracaoMensalService } from './geracao-mensal.service';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [GeracaoMensalController],
  providers: [GeracaoMensalService, PrismaService],
  exports: [GeracaoMensalService],
})
export class GeracaoMensalModule {}
