import { Module } from '@nestjs/common';
import { ConfiguracaoCobrancaService } from './configuracao-cobranca.service';
import { ConfiguracaoCobrancaController } from './configuracao-cobranca.controller';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [ConfiguracaoCobrancaController],
  providers: [ConfiguracaoCobrancaService, PrismaService],
  exports: [ConfiguracaoCobrancaService],
})
export class ConfiguracaoCobrancaModule {}
