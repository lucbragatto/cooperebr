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
import { ContabilidadeTributariaModule } from './contabilidade-tributaria/contabilidade-tributaria.module';
import { IntegracaoBancariaModule } from './integracao-bancaria/integracao-bancaria.module';
import { CooperativasModule } from './cooperativas/cooperativas.module';
import { AsaasModule } from './asaas/asaas.module';
import { SaasModule } from './saas/saas.module';
import { ConciergeModule } from './concierge/concierge.module';
import { DisclaimerSaqueModule } from './disclaimer-saque/disclaimer-saque.module';
import { IndicacoesModule } from './indicacoes/indicacoes.module';
import { ModelosMensagemModule } from './modelos-mensagem/modelos-mensagem.module';
import { FluxoEtapasModule } from './fluxo-etapas/fluxo-etapas.module';
import { PublicoModule } from './publico/publico.module';
import { ClubeVantagensModule } from './clube-vantagens/clube-vantagens.module';
import { CondominiosModule } from './condominios/condominios.module';
import { AdministradorasModule } from './administradoras/administradoras.module';
import { ObservadorModule } from './observador/observador.module';
import { MigracoesUsinaModule } from './migracoes-usina/migracoes-usina.module';
import { EnvioListaConcessionariaModule } from './envio-lista-concessionaria/envio-lista-concessionaria.module';
import { AlocacaoModule } from './alocacao/alocacao.module';
import { EmailModule } from './email/email.module';
import { RelatoriosModule } from './relatorios/relatorios.module';
import { CooperTokenModule } from './cooper-token/cooper-token.module';
import { ConviteIndicacaoModule } from './convite-indicacao/convite-indicacao.module';
import { ConveniosModule } from './convenios/convenios.module';
// Sprint Onboarding Bloco 0 Fatia 0.1 (06/06/2026) — Planos do Clube com mensalidade.
import { PlanoClubeModule } from './plano-clube/plano-clube.module';
// Sprint Onboarding Bloco 0 Fatia 0.3 (06/06/2026) — Adesão opt-in do Cooperado ao Clube.
import { CooperadoClubeModule } from './cooperado-clube/cooperado-clube.module';
// Sprint Portal Empresa 9.0 (04/06/2026)
import { PortalEmpresaModule } from './convenios/portal-empresa/portal-empresa.module';
import { ConversaoCreditoModule } from './conversao-credito/conversao-credito.module';
import { EmailMonitorModule } from './email-monitor/email-monitor.module';
import { LeadExpansaoModule } from './lead-expansao/lead-expansao.module';
import { ContasPagarModule } from './contas-pagar/contas-pagar.module';
import { RepassesProprietarioModule } from './repasses-proprietario/repasses-proprietario.module';
import { BandeiraTarifariaModule } from './bandeira-tarifaria/bandeira-tarifaria.module';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { RolesGuard } from './auth/roles.guard';
import { ModuloGuard } from './auth/modulo.guard';
import { TenantOwnershipGuard } from './auth/tenant-ownership.guard';
// Sprint Portal Empresa 9.0 (04/06/2026) — guard exclusivo do portal da empresa.
import { PagadorCooperadoGuard } from './auth/pagador-cooperado.guard';
import { AuditModule } from './audit/audit.module';
import { NotificacoesProativasModule } from './notificacoes-proativas/notificacoes-proativas.module';
import { SolicitacoesContratoModule } from './solicitacoes-contrato/solicitacoes-contrato.module';
import { SolicitacoesConfirmacaoPagamentoModule } from './solicitacoes-confirmacao-pagamento/solicitacoes-confirmacao-pagamento.module';
import { GatewaysPagamentoConfigModule } from './gateways-pagamento-config/gateways-pagamento-config.module';
import { ProprietarioModule } from './proprietario/proprietario.module';
import { AdminProprietariosModule } from './admin/proprietarios/admin-proprietarios.module';
// F1 (09/06/2026) — Recursos "meu" do cooperado autenticado (PIN inicial).
import { MeuPerfilModule } from './meu-perfil/meu-perfil.module';

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
    ContabilidadeTributariaModule,
    IntegracaoBancariaModule,
    CooperativasModule,
    AsaasModule,
    SaasModule,
    ConciergeModule,
    DisclaimerSaqueModule,
    IndicacoesModule,
    ModelosMensagemModule,
    FluxoEtapasModule,
    PublicoModule,
    ClubeVantagensModule,
    CondominiosModule,
    AdministradorasModule,
    ObservadorModule,
    MigracoesUsinaModule,
    EnvioListaConcessionariaModule,
    AlocacaoModule,
    EmailModule,
    RelatoriosModule,
    CooperTokenModule,
    ConviteIndicacaoModule,
    ConveniosModule,
    PlanoClubeModule,
    CooperadoClubeModule,
    PortalEmpresaModule,
    ConversaoCreditoModule,
    EmailMonitorModule,
    LeadExpansaoModule,
    ContasPagarModule,
    RepassesProprietarioModule,
    BandeiraTarifariaModule,
    AuditModule,
    NotificacoesProativasModule,
    SolicitacoesContratoModule,
    SolicitacoesConfirmacaoPagamentoModule,
    GatewaysPagamentoConfigModule,
    ProprietarioModule,
    AdminProprietariosModule,
    MeuPerfilModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    PrismaService,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: ModuloGuard },
    // D-novo-BR F1.1 (31/05/2026) — Guard sistêmico de posse multi-tenant.
    // Opt-in via @TenantResource; sem decorator → passa direto (não-quebrante).
    { provide: APP_GUARD, useClass: TenantOwnershipGuard },
    // Sprint Portal Empresa 9.0 (04/06/2026) — opt-in via @PagadorCooperadoOnly().
    // Sem o decorator → passa direto (não-quebrante).
    { provide: APP_GUARD, useClass: PagadorCooperadoGuard },
  ],
})
export class AppModule {}
