import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { IntegracaoBancariaController } from './integracao-bancaria.controller';
import { IntegracaoBancariaService } from './integracao-bancaria.service';
import { BbService } from './bb.service';
import { SicoobService } from './sicoob.service';
import { PrismaService } from '../prisma.service';
import { CobrancasModule } from '../cobrancas/cobrancas.module';

@Module({
  imports: [
    HttpModule.register({ timeout: 30000 }),
    CobrancasModule,
  ],
  controllers: [IntegracaoBancariaController],
  providers: [
    IntegracaoBancariaService,
    BbService,
    SicoobService,
    PrismaService,
  ],
  exports: [IntegracaoBancariaService],
})
export class IntegracaoBancariaModule {}
