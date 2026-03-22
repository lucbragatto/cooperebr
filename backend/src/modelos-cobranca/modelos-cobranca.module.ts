import { Module } from '@nestjs/common';
import { ModelosCobrancaService } from './modelos-cobranca.service';
import { ModelosCobrancaController } from './modelos-cobranca.controller';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [ModelosCobrancaController],
  providers: [ModelosCobrancaService, PrismaService],
  exports: [ModelosCobrancaService],
})
export class ModelosCobrancaModule {}
