# 🗺️ Mapa Mental — CoopereBR System Architecture
**Versão:** 1.0 | **Data:** 2026-03-31 | **Autor:** Assis 🤝

---

## VISÃO GERAL — CAMADAS DO SISTEMA

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            CANAIS DE ENTRADA                                │
│  [WhatsApp Bot] [Portal Web] [Dashboard Admin] [API REST] [Email] [SaaS]   │
└──────────────────────────────┬──────────────────────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────────────────────┐
│                         CAMADA DE AUTH                                       │
│         JWT Strategy ◄─── Auth Service ◄─── Roles Guard                    │
│              │                                                               │
│         Facial Auth ──► WhatsApp Auth                                        │
└──────────────────────────────┬──────────────────────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────────────────────┐
│                        NÚCLEO DO NEGÓCIO                                     │
│                                                                               │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐   ┌───────────────┐ │
│  │ Cooperados  │◄──►│  Contratos  │◄──►│   Usinas    │◄──│  Migracoes    │ │
│  │   + Job     │    │             │    │  + Analítico│   │   Usina       │ │
│  └──────┬──────┘    └──────┬──────┘    └──────┬──────┘   └───────────────┘ │
│         │                  │                  │                              │
│  ┌──────▼──────┐    ┌──────▼──────┐    ┌──────▼──────┐                     │
│  │    UCs      │    │   Planos    │    │  Monitoram. │                     │
│  │             │    │             │    │  Usinas     │                     │
│  └─────────────┘    └─────────────┘    └─────────────┘                     │
└──────────────────────────────┬──────────────────────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────────────────────┐
│                       MOTOR DE PROPOSTA                                       │
│                                                                               │
│  CalcularProposta ──► ConfiguraçãoMotor ──► TarifaConcessionária            │
│         │                                                                    │
│         ▼                                                                    │
│  AceitarProposta ──► CriarContrato ──► AlocarUsina ──► ListaEspera          │
│         │                                                                    │
│         ▼                                                                    │
│  PDF/Assinatura ──► NotificarCooperado (WA + Email)                         │
└──────────────────────────────┬──────────────────────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────────────────────┐
│                      MOTOR DE COBRANÇA                                        │
│                                                                               │
│  CobrançasJob ──► calcularMultaJuros ──► gerarCobrança ──► Asaas            │
│       │                                        │                            │
│       ▼                                        ▼                            │
│  RateLimit/Freq ──► notificarVencimento    darBaixa                         │
│       │                  │                    │                             │
│       ▼                  ▼                    ▼                             │
│  WhatsApp Bot       WhatsApp Bot         IntegBancária                      │
│                                          (BB/Sicoob)                        │
└──────────────────────────────┬──────────────────────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────────────────────┐
│                       MOTOR DE FATURAS                                        │
│                                                                               │
│  ProcessarFatura ──► calcular kWh gerado ──► crédito SCEE                   │
│         │                                        │                          │
│         ▼                                        ▼                          │
│  GeraçãoMensal                           [FUTURO: CooperTokenJob]           │
│  (dados de usina)                        creditar excedente em tokens       │
└──────────────────────────────┬──────────────────────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────────────────────┐
│                      MÓDULO FINANCEIRO                                        │
│                                                                               │
│  PlanoContas ──► Lançamentos ──► ContratosUso ──► Convênios                 │
│                                                                              │
│  PIXExcedente ──► Asaas (feature flag ASAAS_PIX_EXCEDENTE_ATIVO)           │
│                                                                              │
│  IntegraçãoBancária ──► BB Service ──► Sicoob Service ──► Cobranças        │
└──────────────────────────────┬──────────────────────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────────────────────┐
│                    MÓDULO WHATSAPP (Orquestrador de Comunicação)              │
│                                                                               │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                        WhatsApp Bot                                  │    │
│  │                                                                       │    │
│  │  processarMensagem                                                    │    │
│  │       │                                                               │    │
│  │       ├──► FluxoMotor (dinâmico) ──► fallback hardcoded             │    │
│  │       │                                                               │    │
│  │       ├──► handleFatura ──► FaturasService                          │    │
│  │       ├──► handleCobranca ──► CobrançasService                      │    │
│  │       ├──► handleCadastroProxy ──► CooperadosService                │    │
│  │       ├──► handleNegociacaoParcelamento ──► observacoesNegociacao   │    │
│  │       ├──► handleCancelamento ──► ContratosService                  │    │
│  │       └──► handleNPS ──► (agendado, 1h pós-cadastro)               │    │
│  │                                                                       │    │
│  │  WhatsappConversaJob (cron/hora) ──► reset sessões mortas >24h      │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                               │
│  WhatsApp Fatura ──► enviar 2ª via, extratos                                │
│  WhatsApp Cobrança ──► cobranças vencidas, rate limit                       │
│  WhatsApp MLM ──► indicações, ranking                                       │
│  WhatsApp Notificações ──► alertas gerais                                   │
│  WhatsApp Ciclo de Vida ──► onboarding, NPS, retenção                      │
│  ModelosMensagem ──► templates dinâmicos por cooperativa                    │
└──────────────────────────────┬──────────────────────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────────────────────┐
│                    CLUBE DE VANTAGENS + INDICAÇÕES (MLM)                      │
│                                                                               │
│  ClubJob ──► atualizarMetricas ──► reset mensal/anual                       │
│       │                                                                      │
│       ├──► getRankingPorPeriodo (kwhIndicadoMes / kwhIndicadoAno)           │
│       ├──► upsertConfig ──► validação de ranges (CLB-02 ✅)                 │
│       └──► benefícios ──► parceiros locais                                  │
│                                                                              │
│  IndicaçõesService ──► MLM kWh ──► WhatsApp Bot ──► Clube                  │
│                                                                              │
│  [FUTURO] CooperToken ──► Clube ──► TOKEN_DESCONTO / TOKEN_SOCIAL           │
└──────────────────────────────┬──────────────────────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────────────────────┐
│                         SAAS / MULTI-TENANT                                   │
│                                                                               │
│  CooperativaService ──► PlanoSaaS ──► FaturaSaas                            │
│         │                                                                    │
│         ▼                                                                    │
│  ConfigTenant ──► configs por cooperativa (minFaturável, tarifas, etc.)     │
│         │                                                                    │
│         ▼                                                                    │
│  [FUTURO] taxaTokenPerc ──► FaturaSaas ──► receita sobre CooperTokens       │
└──────────────────────────────┬──────────────────────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────────────────────┐
│                     NOTIFICAÇÕES & OBSERVABILIDADE                            │
│                                                                               │
│  NotificaçõesService ──► todos os módulos                                   │
│  ObservadorService ──► monitoramento em tempo real                          │
│  OcorrênciasService ──► registro de eventos críticos                        │
│  MonitoramentoUsinas ──► Sungrow API ──► dados de geração                   │
│  RelatoriosService ──► agregação cross-módulo                               │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## MAPA DE DEPENDÊNCIAS DETALHADO

### 🔴 Módulos de Alta Centralidade (muitas dependências entrantes)

```
WhatsApp ◄──── cobrancas, contratos, cooperados, documentos,
               indicacoes, migracoes-usina, motor-proposta,
               observador, publico, clube-vantagens, auth

Asaas ◄──────  cobrancas, financeiro, whatsapp, indicacoes

Notificações ◄─ contratos, cooperados, documentos, faturas,
                motor-proposta

CooperadoSvc ◄─ contratos, documentos, motor-proposta, whatsapp

ConfigTenant ◄─ cobrancas, faturas, motor-proposta, whatsapp
```

### 🟡 Fluxo de Vida de um Cooperado

```
1. CAPTAÇÃO
   Lead Expansão ──► score de lead ──► notificar distribuidora

2. CADASTRO
   WhatsApp Bot (proxy) ──► cadastroCompleto (tx serializable)
      ├── Cooperado
      ├── UC
      ├── Validação ANEEL (distribuidora)
      └── Contrato ──► Lista de Espera (se sem vaga)

3. PROPOSTA
   Motor Proposta ──► calcular (TUSD+TE, desconto, kWh)
      ├── outlier detection
      ├── PDF gerado
      └── assinatura digital (token JWT)

4. ATIVAÇÃO
   Contrato PENDENTE_ATIVACAO ──► cooperadoCheckProntoParaAtivar
      ├── documentos completos?
      ├── assinatura ok?
      └── ──► status ATIVO

5. CICLO MENSAL
   FaturasJob ──► processar fatura (kWh gerado)
      │
      ▼
   CobrançasJob ──► gerar cobrança
      ├── calcularMultaJuros (arredondado ✅)
      ├── notificar WhatsApp (rate limit ✅)
      └── gerar boleto Asaas
              │
              ▼
           darBaixa ──► IntegBancária (BB/Sicoob)

6. FIDELIZAÇÃO
   Clube de Vantagens ──► ranking indicações
   [FUTURO] CooperToken ──► desconto mensalidade

7. CHURNING / SAÍDA
   WhatsApp Bot (cancelamento) ──► suspender/encerrar contrato
      └── CooperadosJob ──► cleanup proxy expirados ✅
```

### 🟢 Fluxo de Dados Financeiros

```
Usinas (geração real)
    │
    ▼
GeraçãoMensal ──► FaturasService ──► Cobrança
                       │                  │
                       ▼                  ▼
                  kWh apurado        Asaas (boleto)
                       │                  │
                       ▼                  ▼
              [FUTURO: tokens]     IntegBancária
                                   (BB/Sicoob)
                                         │
                                         ▼
                                   PlanoContas
                                   Lançamentos
                                         │
                                         ▼
                                   FaturaSaas
                                   (receita CoopereBR)
```

### 🔵 Fluxo WhatsApp Bot (estados)

```
INICIAL / MENU_PRINCIPAL
    │
    ├──► FATURA ──► 2ª via, histórico, consumo
    ├──► COBRANCA ──► negociação, parcelamento (observacoesNegociacao ✅)
    ├──► CADASTRO_PROXY ──► indicar amigo ──► CPF fake + cleanup job ✅
    ├──► CANCELAMENTO ──► suspender / encerrar / ajustar kWh
    └──► NPS ──► 1h pós-cadastro (setTimeout — persistir no futuro)

Estados protegidos (ESTADOS_FLUXO_ATIVO):
    └── keywords não fazem bypass quando em fluxo ativo ✅

Sessão timeout: 30min inatividade ──► reset automático ✅
Conversas mortas: WhatsappConversaJob/hora ──► reset AGUARDANDO_* >24h ✅
```

---

## INTEGRAÇÕES EXTERNAS

```
CoopereBR Backend
    │
    ├── ASAAS ──────────► cobranças, PIX, cartão, boleto
    │                     feature flag PIX Excedente ✅
    │
    ├── SUNGROW API ────► dados de geração das usinas (MonitoramentoUsinas)
    │
    ├── BANCO DO BRASIL ► remessa/retorno de cobranças (IntegBancária)
    │
    ├── SICOOB ─────────► idem (IntegBancária)
    │
    ├── ANEEL (validação)► distribuidoras/UCs (contrato de validação interna)
    │
    └── EMAIL (SMTP) ───► notificações, documentos, relatórios
```

---

## PONTOS DE ATENÇÃO / GAPS IDENTIFICADOS

### ✅ Corrigidos neste ciclo
| ID | Módulo | Status |
|---|---|---|
| PC-05 | Portal / UCs | Gráfico filtra por ucId ✅ |
| CLB-02 | Clube | Validação de ranges ✅ |
| COB-Job-02 | Cobranças | Arredondamento valorMulta/Juros ✅ |
| WA-BOT-02 | WhatsApp | Parcelamento em campo correto ✅ |
| WA-BOT-04 | WhatsApp | Cleanup proxy expirados ✅ |
| PIX-01 | Financeiro | Feature flag + integração Asaas ✅ |

### ⚠️ Pendências conhecidas
| ID | Módulo | Impacto |
|---|---|---|
| WA-BOT-05 | WhatsApp | NPS setTimeout não persiste em restart |
| WZ-09 | Wizard | SUPER_ADMIN sem cooperativaId |
| MIG-04 | Migrações | Divergência arredondamento kWh anual/mensal |
| REL-03 | Relatórios | Tarifa R$0,80 hardcoded |
| FRONT-02 | Frontend | Filtros inadimplência sem auto-submit |
| LEAD-04/05 | Lead Expansão | Score sem decaimento temporal |

### 🔮 Módulos futuros planejados
| Módulo | Spec |
|---|---|
| CooperToken | SPEC-COOPERTOKEN-v1.md ✅ |
| Token Flex (Tarifa Branca) | Design antecipado na spec |
| Token Social (Pool) | Design antecipado na spec |
| Smart Meter API | Aguarda CP 001/2026 ANEEL |
| Demand Response WA Bot | Depende de smart meters |
| Prisma Migrations Baseline | Pendente execução |

---

## ESTRUTURA DE MÓDULOS NESTJS

```
AppModule
├── AuthModule ──────────────── JWT, Facial, WhatsApp auth
├── CooperadosModule ─────────── + CooperadosJob
├── UCsModule
├── UsinasModule ─────────────── + UsinasAnaliticoService
├── ContratosModule
├── PlanosModule
├── MotorPropostaModule ──────── + PropostaPDFService
├── CobrancasModule ─────────── + CobrancasJob + ConfiguracaoCobrancaModule
├── FaturasModule
├── GeracaoMensalModule
├── FinanceiroModule ─────────── PlanoContas, Lançamentos, PIX, Convênios
├── WhatsAppModule ───────────── Bot + Fatura + Cobrança + MLM + Notif + CicloVida + ConversaJob
├── ClubVantagensModule ──────── + ClubJob
├── IndicacoesModule
├── DocumentosModule
├── NotificacoesModule
├── RelatoriosModule
├── SaasModule
├── CooperativasModule
├── ConfigTenantModule
├── AsaasModule
├── IntegraçãoBancariaModule ─── BB + Sicoob
├── MonitoramentoUsinasModule ── Sungrow
├── LeadExpansaoModule
├── MigracoesUsinaModule
├── ObservadorModule
├── OcorrenciasModule
├── ModelosMensagemModule
├── FluxoEtapasModule
├── ModelosCobrancaModule
├── AdministradorasModule
├── CondominiosModule
├── PrestadoresModule
├── EmailModule
└── PublicoModule
```

---

## RESUMO DE CONECTIVIDADE

| Módulo | Dependências Saídas | Dependências Entradas | Centralidade |
|---|---|---|---|
| WhatsApp | 8+ módulos | 8+ módulos | 🔴 CRÍTICA |
| Asaas | 0 | 4 módulos | 🔴 CRÍTICA |
| Notificações | 0 | 5 módulos | 🔴 CRÍTICA |
| CooperadoSvc | 3 | 5 | 🟠 ALTA |
| ContratosService | 3 | 4 | 🟠 ALTA |
| ConfigTenant | 0 | 4 | 🟠 ALTA |
| Motor Proposta | 6 | 1 | 🟠 ALTA |
| Cobranças | 5 | 2 | 🟠 ALTA |
| Clube Vantagens | 1 | 3 | 🟡 MÉDIA |
| Faturas | 2 | 2 | 🟡 MÉDIA |
| Usinas | 0 | 4 | 🟡 MÉDIA |
| Planos | 0 | 2 | 🟢 BAIXA |
| Relatórios | 0 | 0 (lê direto) | 🟢 BAIXA |

---

*Documento gerado por Assis — assistente IA da CoopereBR*
*Baseado em análise estática dos módulos NestJS em 2026-03-31*
