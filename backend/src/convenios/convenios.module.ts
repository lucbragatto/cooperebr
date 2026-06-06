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
// Sprint Onboarding Bloco 0 Fatia 0.4 (06/06/2026) — PlanoClubeService injetado
// em ConveniosCusteioService pra somar membros × mensalidade na consolidada.
import { PlanoClubeModule } from '../plano-clube/plano-clube.module';
// Sprint Onboarding Bloco 1 Fatia 1.3 (06/06/2026) — Helper que CONSTRÓI o membro
// no gate MEMBRO_ATIVO (motor.aceitar + matrícula clube + flip status + pendência).
import { MembroBuilderService } from './membro-builder.service';
import { MotorPropostaModule } from '../motor-proposta/motor-proposta.module';
import { ClubeVantagensModule } from '../clube-vantagens/clube-vantagens.module';

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
    PlanoClubeModule,
    // Fatia 1.3: forwardRef pra MotorProposta pois MotorPropostaModule importa
    // ConveniosModule (ciclo Convenios↔MotorProposta resolvido com lazy DI).
    // ClubeVantagensModule NÃO tem ciclo com Convenios — import direto.
    forwardRef(() => MotorPropostaModule),
    ClubeVantagensModule,
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
    MembroBuilderService,
    PrismaService,
  ],
  exports: [
    ConveniosService,
    ConveniosMembrosService,
    ConveniosProgressaoService,
    ConveniosCusteioService,
    ConvitesConvenioService,
    ConvenioAprovacaoService,
    MembroBuilderService,
  ],
})
export class ConveniosModule {}
