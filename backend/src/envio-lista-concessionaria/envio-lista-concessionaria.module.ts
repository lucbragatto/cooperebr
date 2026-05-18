import { Module } from '@nestjs/common';
import { EnvioListaConcessionariaController } from './envio-lista-concessionaria.controller';
import { EnvioListaConcessionariaService } from './envio-lista-concessionaria.service';
import { CooperadoHomologadoListener } from './cooperado-homologado.listener';
import { PrismaService } from '../prisma.service';
import { EmailModule } from '../email/email.module';
import { WhatsappModule } from '../whatsapp/whatsapp.module';

@Module({
  imports: [EmailModule, WhatsappModule],
  controllers: [EnvioListaConcessionariaController],
  providers: [EnvioListaConcessionariaService, CooperadoHomologadoListener, PrismaService],
  exports: [EnvioListaConcessionariaService],
})
export class EnvioListaConcessionariaModule {}
