import { Module } from '@nestjs/common';
import { ConveniosController } from './convenios.controller';
import { ConveniosPortalController } from './convenios-portal.controller';
import { ConveniosService } from './convenios.service';
import { ConveniosMembrosService } from './convenios-membros.service';
import { ConveniosProgressaoService } from './convenios-progressao.service';
import { ConveniosJob } from './convenios.job';
import { PrismaService } from '../prisma.service';
import { ContabilidadeTributariaModule } from '../contabilidade-tributaria/contabilidade-tributaria.module';

@Module({
  // D-FISCAL-2.2: importa ContabilidadeTributariaModule pra ter
  // ContabilidadeTributariaService injetável no ConveniosController.
  imports: [ContabilidadeTributariaModule],
  controllers: [ConveniosPortalController, ConveniosController],
  providers: [
    ConveniosService,
    ConveniosMembrosService,
    ConveniosProgressaoService,
    ConveniosJob,
    PrismaService,
  ],
  exports: [ConveniosService, ConveniosMembrosService, ConveniosProgressaoService],
})
export class ConveniosModule {}
