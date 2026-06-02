import { Module } from '@nestjs/common';
import { ConveniosController } from './convenios.controller';
import { ConveniosPortalController } from './convenios-portal.controller';
import { ConveniosService } from './convenios.service';
import { ConveniosMembrosService } from './convenios-membros.service';
import { ConveniosProgressaoService } from './convenios-progressao.service';
import { ConveniosCusteioService } from './convenios-custeio.service';
import { ConveniosJob } from './convenios.job';
import { PrismaService } from '../prisma.service';
import { ContabilidadeTributariaModule } from '../contabilidade-tributaria/contabilidade-tributaria.module';

@Module({
  // D-FISCAL-2.2: importa ContabilidadeTributariaModule pra ter
  // ContabilidadeTributariaService injetável no ConveniosController.
  // D-FISCAL-2.4.4a: ConveniosCusteioService NÃO injeta CobrancasService
  // (evita ciclo Convenios↔Cobrancas↔Whatsapp↔MotorProposta↔Convenios).
  // Em vez disso, chama prisma.cobranca.create direto + cria LancamentoCaixa
  // PREVISTO inline (mesma lógica de cobrancas.service:519-532).
  imports: [ContabilidadeTributariaModule],
  controllers: [ConveniosPortalController, ConveniosController],
  providers: [
    ConveniosService,
    ConveniosMembrosService,
    ConveniosProgressaoService,
    ConveniosCusteioService,
    ConveniosJob,
    PrismaService,
  ],
  exports: [
    ConveniosService,
    ConveniosMembrosService,
    ConveniosProgressaoService,
    ConveniosCusteioService,
  ],
})
export class ConveniosModule {}
