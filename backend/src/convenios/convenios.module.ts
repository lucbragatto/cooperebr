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
import { GatewayPagamentoModule } from '../gateway-pagamento/gateway-pagamento.module';

@Module({
  // D-FISCAL-2.2: importa ContabilidadeTributariaModule pra ter
  // ContabilidadeTributariaService injetável no ConveniosController.
  // D-FISCAL-2.4.4a: ConveniosCusteioService NÃO injeta CobrancasService
  // (evita ciclo Convenios↔Cobrancas↔Whatsapp↔MotorProposta↔Convenios).
  // Em vez disso, chama prisma.cobranca.create direto + cria LancamentoCaixa
  // PREVISTO inline (mesma lógica de cobrancas.service:519-532).
  // D-FISCAL-2.4.4b: GatewayPagamentoModule é SEGURO importar (zero ciclo —
  // GatewayPagamentoModule → AsaasModule + BanestesModule → EncryptionModule).
  // Permite ConveniosCusteioService emitir cobrança consolidada no Asaas
  // após criar Cobranca. Best-effort (não bloqueia se falhar).
  imports: [ContabilidadeTributariaModule, GatewayPagamentoModule],
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
