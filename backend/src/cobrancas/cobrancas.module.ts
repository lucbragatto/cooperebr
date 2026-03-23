import { Module } from '@nestjs/common';
import { CobrancasController } from './cobrancas.controller';
import { CobrancasService } from './cobrancas.service';
import { CobrancasJob } from './cobrancas.job';
import { PrismaService } from '../prisma.service';
import { ConfiguracaoCobrancaModule } from '../configuracao-cobranca/configuracao-cobranca.module';
import { AsaasModule } from '../asaas/asaas.module';

@Module({
  imports: [ConfiguracaoCobrancaModule, AsaasModule],
  controllers: [CobrancasController],
  providers: [CobrancasService, CobrancasJob, PrismaService],
  exports: [CobrancasService],
})
export class CobrancasModule {}
