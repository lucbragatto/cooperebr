# SISTEMA — SISGD / CoopereBR

> Mapa técnico da plataforma. Stack, módulos, endpoints, schema, fluxos.
>
> Para visão humana do produto: [PRODUTO.md](PRODUTO.md).
> Para instruções operacionais Claude Code: [CLAUDE.md](../CLAUDE.md) (raiz).
> Para regulatório ANEEL/MME: [REGULATORIO-ANEEL.md](REGULATORIO-ANEEL.md).
>
> **Status:** Esqueleto criado em 2026-05-13 (Fatia H.1 do Plano Mestre).
> Preenchimento de cada seção em ETAPA 1 (H.2 SISTEMA.md base, 2-3 dias Code).
>
> **Dimensões atuais (validadas 13/05/2026):**
> - 45 módulos backend NestJS (`backend/src/*/`)
> - 80 models Prisma (`backend/prisma/schema.prisma`)
> - 152 telas frontend (90 dashboard + 31 parceiro + 15 portal + 4 proprietario + 2 agregador + 9 públicas)
> - 24 crons ativos (`@Cron` em services/jobs)

---

## Sumário

1. [Stack e arquitetura geral](#1-stack-e-arquitetura-geral)
2. [Modelo multi-tenant](#2-modelo-multi-tenant)
3. [Domínios e módulos backend](#3-domínios-e-módulos-backend-45)
4. [Schema Prisma — 80 models em categorias](#4-schema-prisma--80-models-em-categorias)
5. [Frontend — 5 super-rotas e 152 telas](#5-frontend--5-super-rotas-e-152-telas)
6. [Fluxos críticos end-to-end](#6-fluxos-críticos-end-to-end)
7. [Integrações externas](#7-integrações-externas)
8. [Crons agendados (24 ativos)](#8-crons-agendados-24-ativos)
9. [Autenticação, autorização e sessão](#9-autenticação-autorização-e-sessão)
10. [Observabilidade e auditoria](#10-observabilidade-e-auditoria)
11. [Decisões arquiteturais ativas](#11-decisões-arquiteturais-ativas)
12. [Variáveis de ambiente críticas](#12-variáveis-de-ambiente-críticas)
13. [Operação local](#13-operação-local)
14. [Estado de maturidade por componente](#14-estado-de-maturidade-por-componente)
15. [Referências cruzadas](#15-referências-cruzadas)

---

## 1. Stack e arquitetura geral

A preencher em H.2 com:
- **Backend:** NestJS 10+, TypeScript strict, Prisma ORM 6.19, PostgreSQL (Supabase). PM2 gerencia `cooperebr-backend` (porta 3000, build `dist/src/main.js`).
- **Frontend:** Next.js 16 App Router, React 19, Tailwind, Shadcn/UI. Terminal vivo `cd web ; npm run dev` (porta 3001). Não gerenciado por PM2.
- **WhatsApp Service:** módulo separado em `whatsapp-service/`. PM2 gerencia `cooperebr-whatsapp`.
- **OCR:** Claude AI (Anthropic SDK direto, sem MCP).
- **Email pipeline:** IMAP → detecção → OCR → FaturaProcessada (1 caso histórico real: João Santos 03/2026).
- **Pagamentos:** Asaas (PIX + boleto) com webhook HMAC-SHA256. Outros gateways previstos via adapter (BB, Sicoob, Itau).
- **Diagrama de alto nível:** preencher em H.2 (caixas: Frontend ↔ Backend ↔ Postgres + integrações laterais).

---

## 2. Modelo multi-tenant

A preencher em H.2 com:
- **Tabela legado `Cooperativa`** representa qualquer parceiro (COOPERATIVA / CONSORCIO / ASSOCIACAO / CONDOMINIO via `tipoParceiro`).
- **Vocabulário multi-tipo:** hook `useTipoParceiro()` em `web/hooks/`. Cooperado/Consorciado/Associado/Condômino.
- **Filtro obrigatório:** toda query Prisma filtra por `cooperativaId`. `SUPER_ADMIN` pode cross-tenant via guards específicos.
- **Schema de config por tenant:** 3 patterns coexistem — `ConfigGateway` (gateway de pagamento), `ConfigTenant` (key-value email + outros), campos diretos em `Cooperativa` (multa/juros/SaaS). `ConfigGatewayPlataforma` é singleton SISGD-global.
- **Asaas multi-tenant:** `asaas.service.ts:64` resolve `apiKey` por `cooperativaId`. UI super admin escreve em `ConfigGateway` desde 22/04/2026.
- **Modelo legado AsaasConfig:** mantido por compat com sandbox. Risco de dessincronia com `ConfigGateway` — a tratar em sub-fatia (ver B.3 do Plano Mestre).
- **3 cooperativas hoje no banco:** CoopereBR (produção), CoopereBR Teste, TESTE-FASE-B5.

---

## 3. Domínios e módulos backend (45)

A preencher em H.2 com tabela por domínio + linhas de código + cobertura de specs por módulo.

Estrutura atual (45 entradas em `backend/src/`):

**Núcleo de operação (8)**
- `cooperados`, `contratos`, `usinas`, `cobrancas`, `faturas`, `motor-proposta`, `ucs`, `propostas` (em cooperados/motor)

**Financeiro (8)**
- `financeiro`, `configuracao-cobranca`, `geracao-mensal`, `contas-pagar`, `asaas`, `gateway-pagamento`, `integracao-bancaria`, `bandeira-tarifaria`

**Comunicação (4)**
- `whatsapp` (6932 linhas, 0 specs), `notificacoes`, `email`, `email-monitor`

**Comercial / fidelidade (6)**
- `convenios`, `cooper-token` (2671 linhas, 0 specs — pré-req Sprint CT), `indicacoes`, `clube-vantagens`, `lead-expansao`, `convite-indicacao`

**Multi-tenant SaaS (3)**
- `cooperativas`, `saas` (FaturaSaas), `planos`

**Auth e segurança (1)**
- `auth` (JWT + facial)

**Operacional (8)**
- `relatorios`, `observador`, `migracoes-usina`, `publico` (cadastro público), `documentos`, `modelos-cobranca`, `modelos-mensagem`, `prestadores`

**Auxiliares (8)**
- `administradoras`, `common`, `condominios`, `config-tenant`, `conversao-credito`, `fluxo-etapas`, `monitoramento-usinas` (cron comentado!), `ocorrencias`

**Para cada módulo em H.2:**
- linhas de código
- specs (% cobertura)
- endpoints expostos
- crons internos
- dependências cross-module
- estado de maturidade (🔴/🟡/🟢)

---

## 4. Schema Prisma — 80 models em categorias

A preencher em H.2 com tabela de 80 models classificados.

**Categorias preliminares (a refinar em H.2):**

1. **Identidade e tenants (5):** Cooperativa, Usuario, Cooperado, Administradora, Condominio
2. **Geração e consumo (8):** Usina, Uc, GeracaoMensal, FaturaProcessada, Contrato, ContratoUso, BandeiraTarifaria, PoliticaBandeira
3. **Cobrança e financeiro (12):** Cobranca, AsaasCobranca, CobrancaGateway, CobrancaBancaria, LancamentoCaixa, FaturaSaas, ContaAPagar, TransferenciaPix, ConfiguracaoCobranca, ConfiguracaoNotificacaoCobranca, FormaPagamentoCooperado, ModeloCobrancaConfig
4. **Gateway de pagamento (5):** ConfigGateway, ConfigGatewayPlataforma, AsaasConfig (legado), AsaasCustomer, ConfiguracaoBancaria
5. **Motor de proposta (3):** PropostaCooperado, MotorConfiguracao, ConfiguracaoMotor
6. **Fidelidade / CooperToken (6):** CooperTokenLedger, CooperTokenSaldo, CooperTokenSaldoParceiro, ConfigCooperToken, OfertaClube, ResgateClubeVantagens, ConfigClubeVantagens, ProgressaoClube
7. **Indicações / convênios / convites (6):** Indicacao, ConviteIndicacao, BeneficioIndicacao, Convenio, ConvenioCooperado, ContratoConvenio, ConfigIndicacao
8. **Documentos e modelos (4):** DocumentoCooperado, ModeloDocumento, ModeloMensagem, MigracaoUsina
9. **SaaS / planos (3):** PlanoSaas, FaturaSaas, ModulosAtivos (campo em Cooperativa)
10. **Auditoria e logs (4):** AuditLog (inativo — D-30N), EmailLog, Notificacao, HistoricoStatusCooperado
11. **Multi-tenant key-value (1):** ConfigTenant
12. **Operacional (5):** Ocorrencia, Prestador, ObservacaoAtiva, ListaEspera, ConversaoCreditoSemUc
13. **Configurações pontuais (4):** ConfigCooperToken, UsinaMonitoramentoConfig, ConfigClubeVantagens, ConfigDesvalorizacao
14. **Unidades / condomínio (2):** UnidadeCondominio, RepresentanteLegal

**Para cada model em H.2:**
- tabela `@@map`
- chave primária + uniques
- relações principais
- filtros multi-tenant aplicáveis
- estado (em uso / vazio / legado a deprecar)

---

## 5. Frontend — 5 super-rotas e 152 telas

A preencher em H.2 com listagem por super-rota + estado de cada tela.

| Super-rota | Telas | Audiência | Estado |
|---|---|---|---|
| `/dashboard/*` | 90 | Admin parceiro + SUPER_ADMIN | 🟢 Núcleo, 🟡 polish residual |
| `/parceiro/*` | 31 | Admin parceiro (visão tenant) | 🟡 Crescendo |
| `/portal/*` | 15 | Cooperado/Consorciado/etc. | 🟢 Funcional após Fase C.3 |
| `/proprietario/*` | 4 | Proprietário de usina | 🔴 Pendente Sprint 4 |
| `/agregador/*` | 2 | Agregador (visão consolidada) | 🔴 Embrião |
| Públicas (raiz) | 9 | Sem login (`/cadastro`, `/login`, `/aprovar-proposta`, etc.) | 🟡 `/cadastro` 1553 linhas (anti-pattern) |

**Para cada tela em H.2:**
- caminho (`web/app/.../page.tsx`)
- componentes principais
- API endpoints consumidos
- estado (🔴/🟡/🟢)

Referência: Leitura Total 28/04 (`sessoes/2026-04-28-leitura-total-parte1.md` + `parte2.md`).

---

## 6. Fluxos críticos end-to-end

A preencher em H.2 com diagrama + sequência de cada fluxo.

**10 fluxos críticos identificados** (refinar em H.2 — base: `MAPA-INTEGRIDADE-SISTEMA.md`):

1. **Cadastro novo cooperado** (Caminho público `/cadastro` OU admin wizard 7 steps)
2. **Caminho A — OCR automático** (Email → OCR Claude → FaturaProcessada → Cobranca)
   - Estado real: 1 caso histórico (João Santos, mar/2026). 12 de 17 FaturaProcessada são seeds B.5.
3. **Caminho B — Cobrança manual + Asaas** (Admin lança → Asaas → Webhook → PAGA)
   - Estado real: 31 PAGAS no banco = 100% baixa manual (AsaasCobranca tabela = 0). Asaas E2E nunca exercitado.
4. **Aprovação de proposta** (Cooperado aceita → AGUARDANDO_CONCESSIONARIA → APROVADO → ATIVO)
   - UI etapa 11 entregue 11/05 (MARCIO MACIEL destravado).
5. **CooperToken — emissão e resgate** (modoRemuneracao=CLUBE → tokens → desconto futuro)
6. **MLM cascata** (indicador → indicado → bônus em N níveis) — D-30M ainda não validado E2E
7. **Cron geração mensal de cobrança** (`saas.service.ts:130` + `cobrancas.job.ts`)
8. **FaturaSaas Luciano → Parceiro** (cron mensal cria, mas ConfigGatewayPlataforma vazio = não envia)
9. **Convênio e link de membro** (D-30P/Q resolvidos 01/05)
10. **Auditoria regulatória ANEEL** (limite 25% + 5 flags) — Sprint 0/5 pendente

**Para cada fluxo em H.2:**
- diagrama de sequência (Telas → Endpoints → Services → Models)
- gatilhos (manual / cron / webhook)
- estado real (rodou ou não, com quantos casos)
- referências cruzadas a fluxos relacionados

---

## 7. Integrações externas

A preencher em H.2 com seção por integração.

| Integração | Propósito | Estado | Models / Services |
|---|---|---|---|
| **Asaas** | Cobrança (PIX + boleto + webhook) | 🟡 Sandbox CoopereBR configurado (apiKey 390 chars). E2E nunca exercitado | `AsaasConfig` (legado), `ConfigGateway`, `asaas.service.ts`, `asaas.adapter.ts` |
| **Banco do Brasil (BB)** | Boleto + conciliação | 🟡 Código em `integracao-bancaria/` (1339 linhas, 0 specs) | `ConfiguracaoBancaria`, `CobrancaBancaria` |
| **Sicoob** | Idem | 🟡 Idem BB | Idem |
| **Banestes** | Banco capixaba — a integrar | 🔴 Não iniciado (catalogado adendo 12/05) | A criar |
| **Claude AI (Anthropic)** | OCR + CoopereAI | 🟢 OCR funcional (16 endpoints em `faturas/`). CoopereAI conceitual + heartbeat | Direct SDK |
| **Email (IMAP + SMTP)** | Recebimento de faturas + envio de notificações | 🟡 Multi-tenant via `ConfigTenant` (CoopereBR com 11 chaves). Whitelist LGPD em dev (D-30X) | `email-monitor`, `email`, `ConfigTenantService` |
| **WhatsApp** | Bot + envios direcionados | 🟡 6932 linhas, 0 specs. Em produção. | `whatsapp/`, `whatsapp-service/` |
| **Assinafy** | Assinatura eletrônica (Sprint 3 refinado) | 🔴 Spec existe, integração não iniciada | A integrar |
| **ANEEL** | Bandeiras tarifárias | 🟢 Cron mensal sincroniza | `bandeira-tarifaria/` |
| **Supabase** | DB Postgres + Auth | 🟢 Em produção | Prisma client |

**Para cada integração em H.2:**
- credenciais (modelo + variáveis env)
- endpoints consumidos
- error handling
- monitoramento

---

## 8. Crons agendados (24 ativos)

A preencher em H.2 com tabela completa.

Referência completa: `docs/relatorios/2026-05-12-mapeamento-cadastros-e-financeiro.md` §0.10 (25 crons mapeados, sendo 1 comentado em `monitoramento-usinas`).

**Critérios pra H.2:**
- expressão cron + janela
- função
- side effects (escreve onde, envia o quê)
- spec coverage (zero em quase todos)

---

## 9. Autenticação, autorização e sessão

A preencher em H.2 com:
- JWT (gerado pelo `auth/`)
- Roles: `SUPER_ADMIN`, `ADMIN`, `OPERADOR`, `COOPERADO`, `AGREGADOR` (enum `PerfilUsuario`)
- Guards: `JwtAuthGuard`, `RolesGuard`
- Facial recognition (campo `Usuario.fotoFacialUrl`)
- Reset token (`Usuario.resetToken`)
- Token de assinatura remota (`Cooperado.tokenAssinatura` + expiry)
- Multi-tenant guard: cooperativaId sempre do JWT, não do body/query

---

## 10. Observabilidade e auditoria

A preencher em H.2 com:
- **AuditLog:** schema existe, interceptor inativo (D-30N P2). Sprint 5/6 ativa.
- **EmailLog:** 5 registros total no banco (3 ENVIADO). Pode estar sub-utilizado.
- **HistoricoStatusCooperado:** ativo, rastreia transições.
- **Observador (`observador/`):** modo leitura para cooperados (admin-spy + cooperado-leitura coexistem — B4 pendente).
- **PM2 logs:** `pm2 logs cooperebr-backend`. Sem agregação central ainda.

---

## 11. Decisões arquiteturais ativas

A preencher em H.2 com:
- Helper canônico `calcularTarifaContratual` em 5 caminhos (Fase B 03/05, decisão B33)
- `Contrato.valorCheioKwhAceite` snapshot no aceite (decisão B34)
- 4 valores de economia projetada uniformes nos 3 modelos (decisão B35)
- `BLOQUEIO_MODELOS_NAO_FIXO=true` em prod (a desativar pós-canário)
- 5 flags regulatórias ANEEL configuráveis por parceiro (decisão 30/04)
- Adapter pattern de gateways (`gateway-pagamento/`)
- Sprint 5 ponto 3: UI v1 só `KWH_CHEIO`/`SEM_TRIBUTO` (`@IsIn` no DTO)

---

## 12. Variáveis de ambiente críticas

A preencher em H.2 com:
- `DATABASE_URL` (Supabase)
- `ASAAS_PIX_EXCEDENTE_ATIVO` (não ativar em prod sem instrução explícita)
- `ASAAS_ENCRYPT_KEY` (criptografia futura, TODO no schema)
- `BLOQUEIO_MODELOS_NAO_FIXO`
- `EMAIL_*` (fallback global)
- `WHITELIST_ATIVA` (LGPD em dev — D-30X)
- `JWT_SECRET`
- Anthropic / Claude AI key (OCR + CoopereAI)
- Em H.2: tabela completa com defaults e onde cada uma é consumida

---

## 13. Operação local

Comandos canônicos (referência completa em [CLAUDE.md](../CLAUDE.md)):

```bash
# Backend (PM2)
pm2 list
pm2 start ecosystem.config.cjs --only cooperebr-backend
pm2 logs cooperebr-backend --lines 30
pm2 stop cooperebr-backend          # antes de prisma generate / db push

# Frontend (terminal vivo, NÃO PM2)
cd web ; npm run dev

# Prisma (sempre parar backend antes)
pm2 stop cooperebr-backend
cd backend ; npx prisma generate
cd backend ; npm run build          # PM2 roda dist/, não watch!
pm2 restart cooperebr-backend
```

**Regras inegociáveis:**
- NUNCA `npm run start:dev` direto — PM2 ressuscita zumbi
- SEMPRE rebuild após mudança em `backend/src/`
- `db push` apenas em dev local, nunca prod
- Migrations com auditoria prévia se afetarem dados (regra criada após incidente 26/04)

---

## 14. Estado de maturidade por componente

A preencher em H.2 com matriz consolidada.

**Resumo atual (validado 13/05):**

| Componente | Estado | Bloqueador |
|---|---|---|
| Caminho A OCR | 🔴 cru (1 caso histórico) | Canário Caminho A real (Fatia A) |
| Caminho B Asaas E2E | 🔴 nunca rodou (AsaasCobranca=0) | Auditoria dual-path AsaasConfig vs ConfigGateway |
| FaturaSaas Luciano→Parceiro | 🔴 ConfigGatewayPlataforma vazio | Luciano abrir conta Asaas produção + Fatia D3 |
| MLM cascata | 🔴 D-30M aberto | 1º indicado pagar |
| AuditLog interceptor | 🔴 inativo D-30N | Sprint 5/6 |
| CooperToken | 🟡 MVP funcional, 0 specs | Sprint CT Consolidado Etapa 1 |
| Multi-tenant queries | 🟢 cooperativaId em queries | — |
| Asaas multi-tenant | 🟢 técnico pronto (asaas.service.ts:64) | UI no painel parceiro pendente |
| Fase C.3 economia projetada | 🟢 entregue 11/05 (29 specs) | — |
| 5 flags regulatórias ANEEL | 🔴 não codificadas | Sprint 5 |

---

## 15. Referências cruzadas

| Tópico | Onde fica |
|---|---|
| Estado vivo (Onde paramos) | [CONTROLE-EXECUCAO.md](CONTROLE-EXECUCAO.md) |
| Débitos catalogados | [debitos-tecnicos.md](debitos-tecnicos.md) |
| Sprints pré-produção | [PLANO-ATE-PRODUCAO.md](PLANO-ATE-PRODUCAO.md) |
| Diagnóstico ponta a ponta | [MAPA-INTEGRIDADE-SISTEMA.md](MAPA-INTEGRIDADE-SISTEMA.md) |
| Spec CooperToken | [especificacao-clube-cooper-token.md](especificacao-clube-cooper-token.md) |
| Spec modelos cobrança | [especificacao-modelos-cobranca.md](especificacao-modelos-cobranca.md) |
| Regulatório ANEEL | [REGULATORIO-ANEEL.md](REGULATORIO-ANEEL.md) |
| Mapeamento cadastros+financeiro 12/05 | [relatorios/2026-05-12-mapeamento-cadastros-e-financeiro.md](relatorios/2026-05-12-mapeamento-cadastros-e-financeiro.md) |
| Leitura Total telas 28/04 | [sessoes/2026-04-28-leitura-total-parte1.md](sessoes/2026-04-28-leitura-total-parte1.md) + parte2 |
| Maratona 11/05 (9 commits) | [sessoes/2026-05-11-execucao-maratona.md](sessoes/2026-05-11-execucao-maratona.md) |
| Adapter de gateways | [arquitetura/gateways.md](arquitetura/gateways.md) |

---

*Esqueleto fechado em 2026-05-13 (Fatia H.1). Preenchimento das seções em ETAPA 1 (H.2 SISTEMA.md base, 2-3 dias Code).*
