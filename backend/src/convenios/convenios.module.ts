import { Module, forwardRef } from '@nestjs/common';
import { ConveniosController } from './convenios.controller';
import { ConveniosPortalController } from './convenios-portal.controller';
import { ConveniosService } from './convenios.service';
import { ConveniosMembrosService } from './convenios-membros.service';
import { ConveniosProgressaoService } from './convenios-progressao.service';
import { ConveniosCusteioService } from './convenios-custeio.service';
import { ConveniosJob } from './convenios.job';
// Sprint Convite-Convênio Fatia 2a (03/06/2026)
import { ConvitesConvenioService } from './convites-convenio.service';
// Sprint Convite-Convênio Fatia 3 (03/06/2026)
import { ConvenioAprovacaoService } from './convenios-aprovacao.service';
import { PrismaService } from '../prisma.service';
import { ContabilidadeTributariaModule } from '../contabilidade-tributaria/contabilidade-tributaria.module';
import { GatewayPagamentoModule } from '../gateway-pagamento/gateway-pagamento.module';
import { WhatsappModule } from '../whatsapp/whatsapp.module';
import { NotificacoesModule } from '../notificacoes/notificacoes.module';

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
  // Sprint Convite-Convênio Fatia 2a: ConvitesConvenioService injeta
  // WhatsappSenderService (envia link do convite por WA). WhatsappModule via
  // forwardRef pra evitar potencial ciclo (CoopereAi → Convenios futuro).
  imports: [
    ContabilidadeTributariaModule,
    GatewayPagamentoModule,
    forwardRef(() => WhatsappModule),
    NotificacoesModule,
  ],
  controllers: [ConveniosPortalController, ConveniosController],
  providers: [
    ConveniosService,
    ConveniosMembrosService,
    ConveniosProgressaoService,
    ConveniosCusteioService,
    ConveniosJob,
    ConvitesConvenioService,
    ConvenioAprovacaoService,
    PrismaService,
  ],
  exports: [
    ConveniosService,
    ConveniosMembrosService,
    ConveniosProgressaoService,
    ConveniosCusteioService,
    ConvitesConvenioService,
    ConvenioAprovacaoService,
  ],
})
export class ConveniosModule {}
