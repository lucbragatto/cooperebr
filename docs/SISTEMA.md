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

### 1.1 Versões (validadas via `package.json` em 2026-05-13)

| Camada | Tecnologia | Versão |
|---|---|---|
| Backend framework | NestJS (`@nestjs/core`, `@nestjs/common`) | **11.0.1** |
| Backend scheduler | `@nestjs/schedule` (decorator `@Cron`) | **6.1.1** |
| Backend ORM | Prisma + `@prisma/client` (engine `query_engine_bg.wasm`) | **6.19.2** |
| TypeScript | `typescript` strict | **5.7.3** |
| OCR / agente | `@anthropic-ai/sdk` (Claude direto, sem MCP) | **0.86.1** |
| Frontend framework | Next.js (App Router) | **16.1.6** |
| React | `react` | **19.2.3** |
| Estilo | Tailwind CSS | **4.x** |
| Componentes | Shadcn/UI (Radix por baixo) | — (sem versão fixa, gerados) |
| DB | PostgreSQL via **Supabase** | — (managed) |
| Process manager | PM2 (apenas backend + whatsapp-service) | — |

### 1.2 Diagrama de alto nível

```
                     ┌──────────────────────────────────────┐
                     │           NAVEGADOR (cliente)        │
                     │   /dashboard /parceiro /portal /...  │
                     └──────────────────┬───────────────────┘
                                        │ HTTPS (cookies + JWT)
                                        ▼
            ┌────────────────────────────────────────────────────┐
            │     FRONTEND Next.js 16 App Router (porta 3001)    │
            │   web/app/* (Server + Client Components)           │
            │   Terminal vivo `npm run dev` — NÃO está em PM2    │
            └─────────┬───────────────────┬──────────────────────┘
                      │ fetch / api.ts    │
                      ▼                   │
   ┌────────────────────────────────┐     │
   │  BACKEND NestJS 11 (porta 3000)│     │
   │  45 módulos · 448 endpoints    │     │
   │  PM2 `cooperebr-backend`       │     │
   │  build dist/src/main.js        │     │
   └─┬────────┬───────────┬─────────┘     │
     │        │           │               │
     ▼        ▼           ▼               │
   ┌────┐ ┌──────┐  ┌───────────┐         │
   │ DB │ │ Cron │  │ Webhooks  │◀────────┘ (Asaas → /webhooks/asaas)
   │ pg │ │ 26   │  │ HMAC-SHA  │
   │via │ │ jobs │  │           │
   │Pri │ │ ativos │  └───────────┘
   │sma │ └──────┘
   └─┬──┘
     │  Supabase (managed PostgreSQL)
     │
     ▼
   ┌─────────────────────────────────────────────────────┐
   │          80 models · prisma/schema.prisma           │
   └─────────────────────────────────────────────────────┘

   Integrações laterais (saídas do backend):
   ├── Anthropic Claude SDK   → OCR fatura · CoopereAI conceitual
   ├── Asaas API + Webhook    → PIX/boleto multi-tenant (sandbox CoopereBR)
   ├── BB / Sicoob / Banestes → Boletos + conciliação (BB+Sicoob 1339 LOC, Banestes 🔴 não iniciado)
   ├── IMAP (recebimento)     → email-monitor → OCR → FaturaProcessada (1 caso real)
   ├── SMTP (envio)           → email-config.service multi-tenant via ConfigTenant
   ├── WhatsApp Service       → módulo separado whatsapp-service/ (PM2 cooperebr-whatsapp)
   ├── ANEEL bandeiras        → cron mensal puxa cor da bandeira
   └── Assinafy               → 🔴 não iniciado (Sprint 3 catalogado)
```

### 1.3 Notas operacionais

- **PM2 gerencia 2 processos:** `cooperebr-backend` (porta 3000, build compilado) e `cooperebr-whatsapp`. Frontend Next.js dev é terminal vivo (não-PM2).
- **Engine Prisma:** v6 usa `query_engine_bg.wasm` (não mais `.dll.node`). Lock no `.wasm` exige `pm2 stop` antes de `prisma generate`/`db push` (regra em `CLAUDE.md`).
- **Build:** `scripts/` está excluído de `tsconfig.build.json` — utilitários standalone via `ts-node`, não vão pro `dist/`.
- **Caminho A (OCR automático):** 1 único caso real histórico (João Santos, 03/2026). 12 dos 17 `FaturaProcessada` no banco são seeds B.5.
- **Caminho B (cobrança manual + Asaas):** 31 cobranças PAGAS no banco — **5 via Asaas sandbox** (16% — registros `AsaasCobranca` criados Sprint 12 entre 23-27/04, status `RECEIVED`) e **26 via baixa manual** (84%). E2E Asaas em sandbox CoopereBR funcionou; produção real ainda não exercitada.

---

## 2. Modelo multi-tenant

### 2.1 Tabela raiz e tipo de parceiro

- **`Cooperativa`** (tabela `cooperativas`) é a entidade-tenant raiz. Herdou nome do legado mas representa **qualquer parceiro** via campo `tipoParceiro: String` (default `"COOPERATIVA"`, valores aceitos: `COOPERATIVA | CONSORCIO | ASSOCIACAO | CONDOMINIO`).
- **Estado real do banco hoje (validado 2026-05-13 via SQL — Decisão 23):**
  ```
  SELECT "tipoParceiro" as tipo, COUNT(*) FROM cooperativas GROUP BY "tipoParceiro";
  → [{ tipo: "COOPERATIVA", n: 3 }]
  ```
  3 cooperativas, todas tipo `COOPERATIVA`. Onboarding de Sinergia (CONSORCIO), Associação ou Condomínio ainda **não exercitado** em prod.
- **Vocabulário multi-tipo:** hook `useTipoParceiro()` em `web/hooks/useTipoParceiro.ts` mapeia `tipoParceiro` → `{ tipoMembro, tipoMembroPlural }` (Cooperado/Consorciado/Associado/Condômino). Adotado em ~21 telas; ainda há ~50 telas + 73 exceptions backend com termo hardcoded (débito P2 catalogado em `debitos-tecnicos.md`).

### 2.2 Filtro obrigatório por tenant

- **Toda query Prisma filtra por `cooperativaId`** — guard de tenant aplicado via `tenant-guard.helper.ts` (1 spec).
- **`SUPER_ADMIN`** (definido em `PerfilUsuario` enum) pode atravessar tenants via bypass explícito em endpoints específicos (ex.: `cooperados.service.ts:aprovar-concessionaria` permite SUPER_ADMIN cross-tenant — coberto por spec).
- **JWT carrega `cooperativaId`** — nunca é lido do body/query da requisição.

### 2.3 Patterns de configuração por tenant (3 coexistem)

| Pattern | Onde | Quando usar | Estado banco hoje |
|---|---|---|---|
| **Campos diretos em `Cooperativa`** | `cooperativas` table (multa, juros, percentualCotaSaas, etc.) | Configs estruturais herdadas (1 valor por tenant, sempre presente) | 3 registros |
| **`ConfigTenant`** (key-value) | `config_tenant` table (chave/valor por `cooperativaId`) | Email SMTP/IMAP, mínimos faturáveis, parâmetros tarifa MMGD | **19 registros** (15 chaves email + `minimo_*` + `mmgd_percentuais_fev2026` + `geracao_historico` + `threshold_meses_atipicos` + `modeloCobranca_*`) |
| **`ConfigGateway`** (multi-tenant atual) | `config_gateways` table — campo `credenciais: Json` carrega `{apiKey: ...}` | Gateway de pagamento por tenant (Asaas hoje; previsto BB/Sicoob via adapter) | 1 registro (CoopereBR ASAAS sandbox, ativo) |

### 2.4 Configs SISGD-globais (singletons fora do tenant)

- **`ConfigGatewayPlataforma`** — singleton SISGD para `Asaas-Luciano` (cobra parceiros via SaaS).
  ```
  SELECT COUNT(*) FROM config_gateway_plataforma; → 0
  ```
  **Vazio confirmado** — bloqueia D-29F.2 (envio FaturaSaas via Asaas). Fatia D3 do Plano Mestre.

### 2.5 Asaas multi-tenant — dual-path ativo (D-33)

`asaas.service.ts:65` `getConfig(cooperativaId)` resolve credenciais por tenant. **2 models coexistem com risco de dessincronia:**

| Model | Status | Forma das credenciais | Tail visível | Origem |
|---|---|---|---|---|
| **`AsaasConfig`** (LEGADO) | `@@map("asaas_configs")` — comentário "manter por compat sandbox" | `apiKey: String` direto (390 chars — encryption visível, D-34) | `dfe8` | criado 23/03 (Sprint 7/8 antigo) |
| **`ConfigGateway`** (ATUAL multi-tenant) | escrito pela UI super admin desde 22/04 | `credenciais: Json` (formato `{ apiKey: "..." }`) | (não calculado nesta validação) | criado 22/04 |

**Risco:** UI escreve em `ConfigGateway`; service `asaas.service.ts:65` lê de `AsaasConfig` legado. Em runtime, sistema pode usar credencial errada quando admin atualizar via UI. Catalogado **D-33 (P1)** — sub-fatia pré-Fatia A do Plano Mestre.

### 2.6 Cooperativas hoje no banco (3 registros)

- **CoopereBR** — produção, plano OURO, 307 cooperados (299 ATIVOS).
- **CoopereBR Teste** — TRIAL, plano PRATA, 4 ATIVOS, 1 FaturaSaas PENDENTE.
- **TESTE-FASE-B5** — sintética (validação E2E B.5 de 03/05).

### 2.7 Hierarquia de papéis (`PerfilUsuario`)

Lista canônica em `prisma/schema.prisma` enum `PerfilUsuario`. Detalhar tabela `papel × permissão × escopo` em **H.3 (ligações cross-módulo)** — fora do escopo Dia 1.

---

## 3. Domínios e módulos backend (45)

### 3.1 Contagem geral (validada 2026-05-13)

```
find backend/src -maxdepth 2 -name "*.module.ts" → 45
find backend/src -name "*.spec.ts"               → 28 specs files
grep "@(Get|Post|Put|Patch|Delete)" *.controller.ts → 448 endpoints
grep "^\s*@Cron\("                               → 26 ativos + 1 comentado
```

**Distribuição por categoria** (44 módulos categorizados + `app.module.ts` raiz = 45):

| Categoria | N | Módulos |
|---|---|---|
| Núcleo de operação | 7 | `cooperados`, `contratos`, `usinas`, `cobrancas`, `faturas`, `motor-proposta`, `ucs` |
| Financeiro | 8 | `financeiro`, `configuracao-cobranca`, `geracao-mensal`, `contas-pagar`, `asaas`, `gateway-pagamento`, `integracao-bancaria`, `bandeira-tarifaria` |
| Comunicação | 4 | `whatsapp`, `notificacoes`, `email`, `email-monitor` |
| Comercial / fidelidade | 6 | `convenios`, `cooper-token`, `indicacoes`, `clube-vantagens`, `lead-expansao`, `convite-indicacao` |
| Multi-tenant SaaS | 3 | `cooperativas`, `saas`, `planos` |
| Auth e segurança | 1 | `auth` |
| Operacional | 8 | `relatorios`, `observador`, `migracoes-usina`, `publico`, `documentos`, `modelos-cobranca`, `modelos-mensagem`, `prestadores` |
| Auxiliares | 7 | `administradoras`, `condominios`, `config-tenant`, `conversao-credito`, `fluxo-etapas`, `monitoramento-usinas`, `ocorrencias` |
| **Soma** | **44** | + `app.module.ts` raiz = **45** ✓ |

> **Correção vs esqueleto H.1 (Decisão 23):** H.1 dizia "Núcleo (8)" listando `propostas` como 8º item. `propostas` **não é módulo standalone** — vive dentro de `cooperados/` e `motor-proposta/`. H.1 também dizia "Auxiliares (8)" incluindo `common` — `common/` é pasta de utilities (sem `.module.ts`), não conta. Categorias corrigidas: Núcleo 8→7, Auxiliares 8→7. Soma fecha 44+root=45.

### 3.2 Tabela detalhada por módulo (LOC + specs + endpoints + crons)

LOC = linhas de `.ts` excluindo `.spec.ts`. Endpoints = decorators `@Get/Post/Put/Patch/Delete` em `*.controller.ts`. Crons = `@Cron` ativos (não-comentados).

#### Núcleo de operação (7)

| Módulo | LOC | Specs | Endpoints | Crons | Notas |
|---|---:|---:|---:|---:|---|
| `cooperados` | 2.435 | 4 | 34 | 2 | Maior módulo do núcleo. Specs cobrem `aprovar-concessionaria`, `guard-ativacao`, controller, service. |
| `motor-proposta` | 2.614 | 3 | 32 | 1 | Engine de cálculo (FIXO/COMPENSADOS/DINAMICO). Specs cobrem `aceitar`, helper `calcular-tarifa-contratual`, base. |
| `faturas` | 2.713 | 4 | 16 | 0 | OCR Claude + matching. Specs cobrem `calcular`, `d30o`, `factory`, `matching`. |
| `cobrancas` | 1.604 | 1 | 10 | 4 | Núcleo de receita. Crons em `cobrancas.job.ts` (geração + retentativas). |
| `usinas` | 791 | 2 | 12 | 0 | Cadastro + alocação. Specs em controller + service. |
| `contratos` | 679 | 1 | 7 | 0 | Spec do service. |
| `ucs` | 293 | 2 | 6 | 0 | Specs em controller + service. |

#### Financeiro (8)

| Módulo | LOC | Specs | Endpoints | Crons | Notas |
|---|---:|---:|---:|---:|---|
| `financeiro` | 1.640 | 0 | 30 | 0 | Contábil (PlanoContas, LancamentoCaixa, ContratoUso). Sem specs. |
| `integracao-bancaria` | 1.339 | 0 | 11 | 1 | BB + Sicoob. Sem specs (débito P3 catalogado). |
| `asaas` | 612 | 0 | 9 | 0 | Adapter + Customer. **`asaas.service.ts:65` ainda lê `AsaasConfig` legado** (D-33 P1). |
| `gateway-pagamento` | 430 | 1 | 0 | 0 | Adapter pattern. 0 endpoints (consumido por outros módulos). |
| `bandeira-tarifaria` | 351 | 0 | 7 | 1 | Cron mensal sincroniza ANEEL. |
| `configuracao-cobranca` | 217 | 0 | 5 | 0 | Regras desconto por usina/cooperativa. |
| `contas-pagar` | 207 | 0 | 5 | 0 | AP (arrendamento, manutenção). |
| `geracao-mensal` | 164 | 0 | 5 | 0 | kWh gerado por usina/mês. |

#### Comunicação (4)

| Módulo | LOC | Specs | Endpoints | Crons | Notas |
|---|---:|---:|---:|---:|---|
| `whatsapp` | **6.932** | 0 | 27 | 5 | **Maior módulo do projeto.** 0 specs (débito P3 catalogado). 5 crons (cobranças + conversa + MLM). |
| `email` | 1.007 | 1 | 8 | 1 | Spec em `email-config.service`. Cron de envio. |
| `email-monitor` | 610 | 1 | 2 | 1 | IMAP → OCR. Cron 1×/dia 06:00. |
| `notificacoes` | 120 | 0 | 4 | 0 | Multi-canal (WS + WA + email). |

#### Comercial / fidelidade (6)

| Módulo | LOC | Specs | Endpoints | Crons | Notas |
|---|---:|---:|---:|---:|---|
| `cooper-token` | **2.671** | **0** | 28 | 2 | **Pré-req P0 do Sprint CT Consolidado** (Fatia C do Plano Mestre — escrever specs antes de refator). |
| `convenios` | 1.416 | 1 | 18 | 1 | Spec de progressão. Cron diário 03:00. |
| `clube-vantagens` | 1.147 | 0 | 15 | 1 | Cron mensal dia 1 09:00. |
| `convite-indicacao` | 724 | 0 | 8 | 2 | 2 crons (envio + cleanup). |
| `indicacoes` | 683 | 0 | 11 | 0 | MLM cascata (D-30M aguarda E2E real). |
| `lead-expansao` | 240 | 0 | 4 | 0 | Leads de vendas. |

#### Multi-tenant SaaS (3)

| Módulo | LOC | Specs | Endpoints | Crons | Notas |
|---|---:|---:|---:|---:|---|
| `saas` | 788 | 2 | 11 | 1 | Cron `0 6 1 * *` (`saas.service.ts:130`) gera `FaturaSaas` mensal — **D-29F.1 valida**. Specs em `metricas-saas` + `saas.service`. |
| `planos` | 671 | 1 | 6 | 0 | Spec do service. |
| `cooperativas` | 433 | 1 | 12 | 0 | Spec do controller. |

#### Auth e segurança (1)

| Módulo | LOC | Specs | Endpoints | Crons | Notas |
|---|---:|---:|---:|---:|---|
| `auth` | 1.392 | 1 | 19 | 0 | JWT + facial. Spec do `tenant-guard.helper`. |

#### Operacional (8)

| Módulo | LOC | Specs | Endpoints | Crons | Notas |
|---|---:|---:|---:|---:|---|
| `migracoes-usina` | 746 | 0 | 7 | 0 | Migração entre plantas. |
| `publico` | 698 | 1 | 6 | 0 | Cadastro público. Spec do controller (convênio). |
| `relatorios` | 668 | 0 | 5 | 1 | Cron `posicao-cooperado` 07:00. |
| `observador` | 408 | 0 | 5 | 1 | Modo leitura. Cron a cada 5 min. |
| `documentos` | 350 | 0 | 5 | 1 | Cron horário (aprovação). |
| `modelos-mensagem` | 112 | 0 | 5 | 0 | — |
| `prestadores` | 110 | 0 | 5 | 0 | — |
| `modelos-cobranca` | 91 | 0 | 4 | 0 | — |

#### Auxiliares (7)

| Módulo | LOC | Specs | Endpoints | Crons | Notas |
|---|---:|---:|---:|---:|---|
| `monitoramento-usinas` | 453 | 0 | 7 | 0 | **`@Cron` está comentado** no service:21 (`// @Cron('* * * * *')`). Não dispara. |
| `ocorrencias` | 128 | 0 | 6 | 0 | — |
| `condominios` | 254 | 0 | 8 | 0 | Multi-tipo (CONDOMINIO). |
| `config-tenant` | 205 | 0 | 7 | 0 | Key-value email + outros. |
| `fluxo-etapas` | 152 | 0 | 5 | 0 | — |
| `conversao-credito` | 151 | 0 | 5 | 0 | Crédito sem UC. |
| `administradoras` | 107 | 0 | 5 | 0 | — |

### 3.3 Concentração e maturidade

**Top 5 maiores módulos por LOC:**
1. `whatsapp` (6.932) — **0 specs**
2. `faturas` (2.713) — 4 specs
3. `cooper-token` (2.671) — **0 specs** (pré-req Fatia C)
4. `motor-proposta` (2.614) — 3 specs
5. `cooperados` (2.435) — 4 specs

**Módulos sem specs (29 de 45 — 64%):** débito de cobertura. Núcleo crítico cobre ~30% (5 dos 7 módulos do núcleo têm spec).

**Estado de maturidade** (🟢 produção / 🟡 funcional com débito / 🔴 não-iniciado): a refinar em H.4 (fluxos end-to-end). Candidatos 🔴 hoje: nenhum dos 45 módulos é "não-iniciado" (todos têm código). 🟡 maioria. 🟢 quem passou validação E2E real (cooperados, contratos, usinas, faturas via João Santos).

**Dependências cross-module** detalhadas em **H.3** (fora do escopo Dia 1).

---

## 4. Schema Prisma — 80 models em 18 categorias

### 4.1 Contagem geral

```
grep -c "^model " backend/prisma/schema.prisma → 80 models
```

### 4.2 Erros do esqueleto H.1 corrigidos (Decisão 23 — validação SQL/grep)

H.1 listou **6 entidades inexistentes** no schema (gap "14 cats somam 68" se explicava parcialmente assim) + 3 duplicações:

| Listado em H.1 | Realidade no schema | Correção |
|---|---|---|
| `MotorConfiguracao` | só existe `ConfiguracaoMotor` | mantida 1 entrada apenas |
| `PoliticaBandeira` | é **enum**, não model | removida da contagem |
| `Convenio` (standalone) | só existem `ContratoConvenio` + `ConvenioCooperado` | removida |
| `ModulosAtivos` | é **campo** em `Cooperativa`, não model | removida |
| `RepresentanteLegal` | não existe no schema | removida |
| `ConfigDesvalorizacao` | não existe no schema | removida |
| `FaturaSaas` (duplicada em "Cobrança" + "SaaS") | 1 model | mantida só em SaaS |
| `ConfigCooperToken` (duplicada em "Fidelidade" + "Configurações pontuais") | 1 model | mantida só em CooperToken |
| `ConfigClubeVantagens` (duplicada em "Fidelidade" + "Configurações pontuais") | 1 model | mantida só em Clube Vantagens |

### 4.3 Categorização refinada — 18 categorias somando 80

> **Soma valida 80** (3+10+3+4+4+5+9+2+4+4+5+5+3+7+4+2+4+2 = 80). Para o detalhamento de cada model (uniques, relações, estado em uso/vazio/legado), ver **H.2 Dia 3** (revisão final) e **H.3** (ligações cross-módulo).

| # | Categoria | N | Models |
|---:|---|---:|---|
| 1 | **Tenant + Auth + Segurança** | 3 | `Cooperativa`, `Usuario`, `AuditLog` |
| 2 | **Núcleo — Cadastro & Contratos** | 10 | `Cooperado`, `DocumentoCooperado`, `Uc`, `Usina`, `Contrato`, `Plano`, `PropostaCooperado`, `ListaEspera`, `MigracaoUsina`, `HistoricoStatusCooperado` |
| 3 | **Núcleo — Monitoramento Usina** | 3 | `UsinaMonitoramentoConfig`, `UsinaLeitura`, `UsinaAlerta` |
| 4 | **Núcleo — Cobrança & Fatura** | 4 | `Cobranca`, `FaturaProcessada`, `GeracaoMensal`, `BandeiraTarifaria` |
| 5 | **Regulatório / Tarifas** | 4 | `TarifaConcessionaria`, `HistoricoReajuste`, `HistoricoReajusteTarifa`, `ConfiguracaoMotor` |
| 6 | **Financeiro — Contábil** | 5 | `PlanoContas`, `LancamentoCaixa`, `ContratoUso`, `ContaAPagar`, `TransferenciaPix` |
| 7 | **Financeiro — Pagamentos & Gateways** | 9 | `FormaPagamentoCooperado`, `ConfiguracaoBancaria`, `CobrancaBancaria`, `ConfigGateway`, `ConfigGatewayPlataforma`, `CobrancaGateway`, `AsaasConfig` (LEGADO — D-33), `AsaasCustomer`, `AsaasCobranca` (count=0 hoje — Decisão 23) |
| 8 | **SaaS multi-tenant** | 2 | `PlanoSaas`, `FaturaSaas` |
| 9 | **Comercial — Convênios** | 4 | `ContratoConvenio`, `ConvenioCooperado`, `HistoricoFaixaConvenio`, `ConversaoCreditoSemUc` |
| 10 | **Comercial — MLM / Indicação** | 4 | `ConfigIndicacao`, `Indicacao`, `BeneficioIndicacao`, `ConviteIndicacao` |
| 11 | **Comercial — CooperToken** | 5 | `CooperTokenLedger`, `CooperTokenSaldo`, `ConfigCooperToken`, `CooperTokenSaldoParceiro`, `CooperTokenCompra` |
| 12 | **Comercial — Clube Vantagens** | 5 | `ConfigClubeVantagens`, `ProgressaoClube`, `HistoricoProgressao`, `OfertaClube`, `ResgateClubeVantagens` |
| 13 | **Comercial — Leads / Feedback** | 3 | `LeadExpansao`, `LeadWhatsapp`, `NpsResposta` |
| 14 | **Comunicação** | 7 | `Notificacao`, `ConfiguracaoNotificacaoCobranca`, `ConversaWhatsapp`, `MensagemWhatsapp`, `ModeloMensagem`, `ListaContatos`, `EmailLog` |
| 15 | **Operacional — Docs & Configurações** | 4 | `ModeloDocumento`, `ModeloCobrancaConfig`, `ConfiguracaoCobranca`, `FluxoEtapa` |
| 16 | **Observador (modo leitura)** | 2 | `ObservacaoAtiva`, `LogObservacao` |
| 17 | **Estruturas externas** | 4 | `Prestador`, `Administradora`, `Condominio`, `UnidadeCondominio` |
| 18 | **Config genérica + Ocorrências** | 2 | `ConfigTenant`, `Ocorrencia` |
| **Total** | | **80** | ✓ |

### 4.4 Models notáveis (estado banco hoje — Decisão 23 aplicada)

| Model | Count | Observação |
|---|---:|---|
| `Cooperativa` | 3 | Todas tipo `COOPERATIVA` (Sinergia/Consórcio futuro) |
| `Cooperado` | 311 | 299 ATIVOS na CoopereBR + 4 na CoopereBR Teste + outros |
| `Contrato` | 72 | 100% `tarifaContratual=null` (forward-only após Fase B — D-30R adiado) |
| `AsaasConfig` | 1 | LEGADO sandbox CoopereBR (`apiKey` 390 chars enc. — D-34) |
| `ConfigGateway` | 1 | ATUAL CoopereBR ASAAS sandbox (apiKey dentro `credenciais` JSON) |
| `ConfigGatewayPlataforma` | **0** | Vazio — bloqueia D-29F.2 envio FaturaSaas |
| `ConfigTenant` | 19 | 15 chaves email (smtp + monitor) + tarifas mínimas + parâmetros MMGD |
| `AsaasCobranca` | **5** | Sandbox CoopereBR (criadas 23-27/04 durante Sprint 12 validation). Status `RECEIVED`, valores R$ 8/12/20/40/500. Cobrancas linkadas estão `PAGO`. Detalhe completo em §6 fluxo Caminho B. |
| `AsaasCustomer` | 62 | Customers Asaas registrados (sandbox) |
| `CobrancaGateway` | 7 | Camada de adapter (não mais usada — `asaas.service.ts` ainda lê de `AsaasConfig` legado, D-33) |
| `FaturaProcessada` | 17 | 12 são seeds B.5; 1 caso real OCR (João Santos 03/2026) |
| `FaturaSaas` | 3 | PENDENTES, sem `asaasCobrancaId` populado |
| `AuditLog` | 0 | Inativo — D-30N (interceptor não implementado) |
| `EmailLog` | 1+ | Primeiro envio SMTP funcional pós Sprint 10 |

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
