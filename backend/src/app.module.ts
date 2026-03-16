import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaService } from './prisma.service';
import { CooperadosModule } from './cooperados/cooperados.module';
import { UcsModule } from './ucs/ucs.module';
import { UsinasModule } from './usinas/usinas.module';
import { ContratosModule } from './contratos/contratos.module';
import { CobrancasModule } from './cobrancas/cobrancas.module';
import { OcorrenciasModule } from './ocorrencias/ocorrencias.module';
import { AuthModule } from './auth/auth.module';
import { FaturasModule } from './faturas/faturas.module';
import { PlanosModule } from './planos/planos.module';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { RolesGuard } from './auth/roles.guard';

@Module({
  imports: [
    CooperadosModule,
    UcsModule,
    UsinasModule,
    ContratosModule,
    CobrancasModule,
    OcorrenciasModule,
    AuthModule,
    FaturasModule,
    PlanosModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    PrismaService,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
