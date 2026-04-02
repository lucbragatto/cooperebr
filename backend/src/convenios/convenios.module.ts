import { Module } from '@nestjs/common';
import { ConveniosController } from './convenios.controller';
import { ConveniosPortalController } from './convenios-portal.controller';
import { ConveniosService } from './convenios.service';
import { ConveniosMembrosService } from './convenios-membros.service';
import { ConveniosProgressaoService } from './convenios-progressao.service';
import { ConveniosJob } from './convenios.job';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [ConveniosController, ConveniosPortalController],
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
