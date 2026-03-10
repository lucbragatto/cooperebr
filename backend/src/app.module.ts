import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CooperadosModule } from './cooperados/cooperados.module';
import { PrismaService } from './prisma.service';
import { UcsModule } from './ucs/ucs.module';
import { UsinasModule } from './usinas/usinas.module';

@Module({
  imports: [CooperadosModule, UcsModule, UsinasModule],
  controllers: [AppController],
  providers: [AppService, PrismaService],
})
export class AppModule {}