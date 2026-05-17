import { Module } from '@nestjs/common';
import { EnvioListaConcessionariaController } from './envio-lista-concessionaria.controller';
import { EnvioListaConcessionariaService } from './envio-lista-concessionaria.service';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [EnvioListaConcessionariaController],
  providers: [EnvioListaConcessionariaService, PrismaService],
  exports: [EnvioListaConcessionariaService],
})
export class EnvioListaConcessionariaModule {}
