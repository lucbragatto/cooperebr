import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CooperadosModule } from './cooperados/cooperados.module';
import { PrismaService } from './prisma.service';

@Module({
  imports: [CooperadosModule],
  controllers: [AppController],
  providers: [AppService, PrismaService],
})
export class AppModule {}