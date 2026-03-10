import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CooperadosModule } from './cooperados/cooperados.module';
import { PrismaService } from './prisma.service';
import { UcsModule } from './ucs/ucs.module';
import { UsinasModule } from './usinas/usinas.module';
import { ContratosModule } from './contratos/contratos.module';
import { CobrancasModule } from './cobrancas/cobrancas.module';
import { OcorrenciasModule } from './ocorrencias/ocorrencias.module';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [CooperadosModule, UcsModule, UsinasModule, ContratosModule, CobrancasModule, OcorrenciasModule, AuthModule],
  controllers: [AppController],
  providers: [AppService, PrismaService],
})
export class AppModule {}