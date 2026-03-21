import { Module } from '@nestjs/common';
import { CobrancasController } from './cobrancas.controller';
import { CobrancasService } from './cobrancas.service';
import { PrismaService } from '../prisma.service';
import { ConfiguracaoCobrancaModule } from '../configuracao-cobranca/configuracao-cobranca.module';

@Module({
  imports: [ConfiguracaoCobrancaModule],
  controllers: [CobrancasController],
  providers: [CobrancasService, PrismaService],
  exports: [CobrancasService],
})
export class CobrancasModule {}
