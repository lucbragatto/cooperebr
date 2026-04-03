import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaService } from './prisma.service';
import { CooperadosModule } from './cooperados/cooperados.module';
import { UcsModule } from './ucs/ucs.module';
import { UsinasModule } from './usinas/usinas.module';
import { ContratosModule } from './contratos/contratos.module';
import { CobrancasModule } from './cobrancas/cobrancas.module';
import { OcorrenciasModule } from './ocorrencias/ocorrencias.module';
import { AuthModule } from './auth/auth.module';
import { FaturasModule } from './faturas/faturas.module';
import { PlanosModule } from './planos/planos.module';
import { DocumentosModule } from './documentos/documentos.module';
import { NotificacoesModule } from './notificacoes/notificacoes.module';
import { MotorPropostaModule } from './motor-proposta/motor-proposta.module';
import { ConfigTenantModule } from './config-tenant/config-tenant.module';
import { ModelosCobrancaModule } from './modelos-cobranca/modelos-cobranca.module';
import { ConfiguracaoCobrancaModule } from './configuracao-cobranca/configuracao-cobranca.module';
import { GeracaoMensalModule } from './geracao-mensal/geracao-mensal.module';
import { WhatsappModule } from './whatsapp/whatsapp.module';
import { PrestadoresModule } from './prestadores/prestadores.module';
import { MonitoramentoUsinasModule } from './monitoramento-usinas/monitoramento-usinas.module';
import { FinanceiroModule } from './financeiro/financeiro.module';
import { IntegracaoBancariaModule } from './integracao-bancaria/integracao-bancaria.module';
import { CooperativasModule } from './cooperativas/cooperativas.module';
import { AsaasModule } from './asaas/asaas.module';
import { SaasModule } from './saas/saas.module';
import { IndicacoesModule } from './indicacoes/indicacoes.module';
import { ModelosMensagemModule } from './modelos-mensagem/modelos-mensagem.module';
import { FluxoEtapasModule } from './fluxo-etapas/fluxo-etapas.module';
import { PublicoModule } from './publico/publico.module';
import { ClubeVantagensModule } from './clube-vantagens/clube-vantagens.module';
import { CondominiosModule } from './condominios/condominios.module';
import { AdministradorasModule } from './administradoras/administradoras.module';
import { ObservadorModule } from './observador/observador.module';
import { MigracoesUsinaModule } from './migracoes-usina/migracoes-usina.module';
import { EmailModule } from './email/email.module';
import { RelatoriosModule } from './relatorios/relatorios.module';
import { CooperTokenModule } from './cooper-token/cooper-token.module';
import { ConviteIndicacaoModule } from './convite-indicacao/convite-indicacao.module';
import { ConveniosModule } from './convenios/convenios.module';
import { ConversaoCreditoModule } from './conversao-credito/conversao-credito.module';
import { EmailMonitorModule } from './email-monitor/email-monitor.module';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { RolesGuard } from './auth/roles.guard';
import { ModuloGuard } from './auth/modulo.guard';

@Module({
  imports: [
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
    ScheduleModule.forRoot(),
    EventEmitterModule.forRoot(),
    CooperadosModule,
    UcsModule,
    UsinasModule,
    ContratosModule,
    CobrancasModule,
    OcorrenciasModule,
    AuthModule,
    FaturasModule,
    PlanosModule,
    DocumentosModule,
    NotificacoesModule,
    MotorPropostaModule,
    ConfigTenantModule,
    ModelosCobrancaModule,
    ConfiguracaoCobrancaModule,
    GeracaoMensalModule,
    WhatsappModule,
    PrestadoresModule,
    MonitoramentoUsinasModule,
    FinanceiroModule,
    IntegracaoBancariaModule,
    CooperativasModule,
    AsaasModule,
    SaasModule,
    IndicacoesModule,
    ModelosMensagemModule,
    FluxoEtapasModule,
    PublicoModule,
    ClubeVantagensModule,
    CondominiosModule,
    AdministradorasModule,
    ObservadorModule,
    MigracoesUsinaModule,
    EmailModule,
    RelatoriosModule,
    CooperTokenModule,
    ConviteIndicacaoModule,
    ConveniosModule,
    ConversaoCreditoModule,
    EmailMonitorModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    PrismaService,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: ModuloGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
