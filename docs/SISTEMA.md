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

## 5. Frontend — 5 super-rotas + raiz pública = 152 telas

### 5.1 Contagem geral (validada 2026-05-13)

```
find web/app -name "page.tsx" -type f | wc -l → 152
find web/app -name "layout.tsx" -type f      → 6 (1 root + 5 super-rotas)
find web/app -maxdepth 1 -name "page.tsx"    → 1 (root web/app/page.tsx)
```

**Distribuição por super-rota / raiz** (validada via `awk -F'/' '{print $3}' | sort | uniq -c`):

| Super-rota / Raiz | Telas | Audiência | Layout | Estado |
|---|---:|---|---|---|
| `/dashboard/*` | **90** | Admin parceiro + SUPER_ADMIN | `dashboard/layout.tsx` (sidebar dinâmica por perfil) | 🟢 Núcleo, 🟡 polish residual |
| `/parceiro/*` | **31** | Admin parceiro (visão tenant — paralelo a `/dashboard`) | `parceiro/layout.tsx` (sidebar com filtro `useModulos`) | 🟡 Crescendo (Sinergia onboarding futuro) |
| `/portal/*` | **15** | Cooperado/Consorciado/Associado/Condômino | `portal/layout.tsx` (bottom-nav mobile-first) | 🟢 Funcional após Fase C.3 |
| `/proprietario/*` | **4** | Proprietário de usina | `proprietario/layout.tsx` (sidebar 4 itens) | 🔴 Pendente Sprint 4 |
| `/agregador/*` | **2** | Agregador (visão consolidada) | `agregador/layout.tsx` (sidebar 3 itens) | 🔴 Embrião |
| **Públicas (raiz)** | **10** | Sem login | `app/layout.tsx` (root) | 🟡 `/cadastro` é anti-pattern (1553 linhas, Fatia E) |
| **Total** | **152** | | | |

**Raiz pública (10 telas — listagem completa):**

| Caminho | Propósito | Estado |
|---|---|---|
| `web/app/page.tsx` | Landing root (redireciona pra login) | 🟢 |
| `web/app/login/page.tsx` | Login admin/operador | 🟢 |
| `web/app/entrar/page.tsx` | Login alternativo (a consolidar?) | 🟡 dupla entrada |
| `web/app/portal/login/page.tsx` (sob `/portal`) | Login cooperado | 🟢 (não conta na raiz) |
| `web/app/cadastro/page.tsx` | Cadastro público (1553 linhas — Fatia E) | 🟡 anti-pattern |
| `web/app/aprovar-proposta/page.tsx` | Cooperado aceita proposta (Fluxo 4) | 🟢 (Fase C.3 fechou) |
| `web/app/assinar/page.tsx` | Assinatura via Assinafy | 🔴 stub (Sprint 3 não iniciou) |
| `web/app/convite/[codigo]/page.tsx` | Aceitar convite MLM | 🟡 |
| `web/app/esqueci-senha/page.tsx` | Recuperação senha | 🟢 |
| `web/app/redefinir-senha/page.tsx` | Token reset senha | 🟢 |
| `web/app/selecionar-contexto/page.tsx` | Switch tenant (multi-papel) | 🟢 |

> **Discrepância 151 vs 152 (esqueleto H.1) — RESOLVIDA:** H.1 disse "Públicas (raiz) | 9". Real são **10** (esqueceu `web/app/page.tsx` raiz). Soma certa: 90+31+15+4+2+10 = **152 ✓**.

### 5.2 Estrutura de navegação (sidebars / bottom-nav)

**Padrão:** **sem abstração compartilhada.** Cada layout define array `navItems` / `navSections` inline. Não existe `web/lib/menu.ts`.

| Super-rota | Padrão | Itens em menu | Filtro de exibição |
|---|---|---:|---|
| `/dashboard` | `getNavSections()` por perfil (`COOPERADO`/`OPERADOR`/`ADMIN`/`SUPER_ADMIN`) | ~28 raízes | filtro por `PerfilUsuario` |
| `/parceiro` | `allNavSections` array | ~22 raízes | `useModulos()` (filtra por módulos ativos) |
| `/portal` | `navItems` array (5 itens) | 5 | nenhum (todos cooperados veem mesma nav) |
| `/proprietario` | `navItems` array (4 itens) | 4 | nenhum |
| `/agregador` | `navItems` array (3 itens) | 3 | nenhum |

**Hooks de contexto compartilhados:** `useContexto()` (cooperativa + módulos ativos), `useModulos()` (filtro nav), `useTipoParceiro()` (vocabulário multi-tipo — usado em **21 arquivos**).

### 5.3 Telas órfãs (acessíveis via URL direto, sem link em menu)

**11 telas sem linkagem no menu:**

| Caminho | Super-rota | Por que está órfã | Ação |
|---|---|---|---|
| `/portal/login` | portal | Login específico cooperado (separado do bottom-nav) | OK — entrada via redirect |
| `/portal/assinar/[token]` | portal | Acesso via token único | OK — link via email |
| `/portal/conta` | portal | Vinculada via header? Verificar | Auditar |
| `/portal/clube` | portal | CooperToken — referência cruzada via `/portal/tokens` | OK |
| `/portal/creditos` | portal | Créditos detalhados | Auditar |
| `/portal/desligamento` | portal | Solicitação saída | OK — fluxo lateral |
| `/portal/faturas-concessionaria` | portal | Histórico fatura distribuidora | Auditar |
| `/portal/ranking` | portal | Ranking comunidade | Auditar |
| `/portal/tokens` | portal | Wallet CooperToken | Auditar |
| `/dashboard/relatorios/conferencia-kwh` | dashboard | Relatório técnico | Vincular |
| `/dashboard/contabilidade-clube` | dashboard | Visão contábil tokens | Vincular |

> **Detalhamento de cada tela órfã** + decisão "vincular OU mover pra arquivo" fica para H.4 (revisão final). Não bloqueia H.2 base.

### 5.4 Padrão de consumo de API

**Cliente HTTP único:** `web/lib/api.ts` — instância Axios com:
- `baseURL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000'`
- Interceptor request: injeta `Authorization: Bearer <token>` (cookie) + `X-Cooperativa-Id` (localStorage)
- Interceptor response: 401 → redirect `/login`

```
grep -rE "api\.(get|post|put|patch|delete)\(" web/app web/components web/lib → 357 chamadas
endpoints únicos consumidos no frontend                                       → 208
endpoints HTTP no backend (controllers)                                       → 448
fetch() direto (não-api.ts)                                                   → 20 (assets/Next.js internals, sem URL hardcoded externa)
```

**Gap = 240 endpoints backend SEM consumo direto pelo frontend** (~54% dos 448). Distribuição esperada:
- **Webhooks** (Asaas, BB, Sicoob) — chamados por terceiros, não pela UI.
- **Endpoints internos** consumidos por outros services (não exposto pra UI).
- **Endpoints dead-code / em transição** — débito a auditar (catalogar em Fatia G débitos cumulativos).
- **CRUD admin não-implementado em UI** — ex.: alguns endpoints de `motor-proposta` (32 endpoints, ~10 em UI).

> **Auditoria detalhada de endpoints órfãos** fica pra Fatia G (débitos cumulativos). Não bloqueia H.2 base.

### 5.5 Telas sem chamadas API (27 estáticas)

`page.tsx` que NÃO chamam nenhum endpoint backend (renderização puramente estática ou via props/server):

- `/login`, `/page.tsx` (raiz), `/dashboard/cooperados/novo`, `/dashboard/cooperados/[id]/fatura`, `/dashboard/meu-convite` — formulários simples / placeholders.
- 11+ páginas em `/parceiro/*` — painel parceiro renderizado puro (delegação pra componentes filhos que fazem fetch).
- 2 páginas em `/dashboard/super-admin/` — agregam métricas via componentes específicos.

**Não significam órfãs:** páginas estáticas + páginas com data fetching delegado a componentes child.

### 5.6 Observação: vocabulário multi-tipo

- **21 arquivos** usam `useTipoParceiro` (validado `grep -lE "useTipoParceiro"`).
- **~131 telas** ainda têm "Cooperado/Cooperados" hardcoded — débito P2 catalogado em `debitos-tecnicos.md` (bloqueia onboarding Sinergia/Consórcio em produção).

### 5.7 Referência

Listagem completa por tela (caminho + componentes + endpoints consumidos + estado por tela) em **H.4 (revisão final)** — exige walkthrough manual de 152 arquivos. Esta seção entrega contagem agregada + estrutura macro.

Base anterior: Leitura Total 28/04 (`sessoes/2026-04-28-leitura-total-parte1.md` + `parte2.md`).

---

## 6. Fluxos críticos end-to-end (10 fluxos)

> Diagramas de sequência em texto. Estado real **validado via SQL** (Decisão 23). Referências cruzadas a outros fluxos no fim de cada bloco.

### Fluxo 1 — Cadastro novo cooperado

**Gatilho:** humano (público OU admin).

**2 caminhos coexistem:**

```
CAMINHO PÚBLICO (/cadastro)                CAMINHO ADMIN (wizard 7 steps)
──────────────────────────────              ─────────────────────────────
[Visitante anônimo]                         [Admin logado /dashboard]
       │                                           │
       ▼                                           ▼
web/app/cadastro/page.tsx                  web/app/dashboard/cooperados/novo/page.tsx
(1553 linhas — anti-pattern)               (7 steps wizard — padrão admin)
       │                                           │
       ▼                                           ▼
POST /publico/cadastro                     POST /cooperados (multi-step)
(publico.controller.ts)                    (cooperados.controller.ts)
       │                                           │
       └────────────────┬──────────────────────────┘
                        ▼
              CooperadosService.create()
                        │
                        ▼
         ┌──────────────┼──────────────┐
         ▼              ▼              ▼
      Cooperado      Uc (1+)      Contrato (provisório)
      status=        relação       Plano default
      PENDENTE       cooperadoId
                        │
                        ▼
              MotorPropostaService.simular()
                        │ retorna economia projetada (4 valores)
                        ▼
              [aguarda aceite cooperado → Fluxo 4]
```

**Estado real (validado SQL):**
```
SELECT status, COUNT(*) FROM cooperados GROUP BY status;
→ ATIVO 309 · PENDENTE 6 · APROVADO 1 · ATIVO_RECEBENDO_CREDITOS 1
```
Total 317 cooperados em 3 cooperativas. **6 PENDENTE** = cadastros em curso (aguardando aceite ou aprovação concessionária).

**Referências cruzadas:**
- → Fluxo 4 (Aprovação proposta — quando cooperado aceita)
- → Fluxo 9 (Convênio — se cadastro veio via convênio)
- ← Fluxo 6 (MLM — se cadastro veio com `convitecodigo`)

**Débitos:** Fatia E (refator `/cadastro` de 1553 linhas pra padrão 7 steps).

---

### Fluxo 2 — Caminho A: OCR automático de fatura

**Gatilho:** cron `email-monitor.service.ts:81` (1×/dia 06:00) OU disparo manual via `POST /email-monitor/processar`.

```
[IMAP server CoopereBR]
       │
       ▼
EmailMonitorService.processar()
  ├─ conecta IMAP via ConfigTenant chaves email.monitor.*
  ├─ filtra emails de distribuidoras (regex remetente)
  └─ baixa PDFs anexos
       │
       ▼
FaturasService.processarOcr(pdf)
       │
       ▼
Anthropic Claude SDK (OCR multi-campo)
  → extrai: numeroUC, kWh, tarifa, vencimento, fioB, ICMS, etc.
       │
       ▼
FaturaProcessada (PERSISTE)
  ├─ vincula a Uc.numero existente OU pendente
  └─ status = AGUARDANDO_CONCILIACAO
       │
       ▼
FaturasService.matchingComCobranca()
  → tenta vincular FaturaProcessada → Cobranca já existente
  → se vincula: atualiza Cobranca com valorCheioKwh, tarifaSemImpostos
```

**Estado real (validado SQL):**
```
SELECT COUNT(*) FROM faturas_processadas; → 17
```
- **1 caso histórico real:** João Santos (mar/2026, OCR funcional fim a fim).
- **12 de 17 são seeds** da Fase B.5 (validação E2E sintética).
- **4 de 17** são reprocessamentos / testes pontuais.

**Referências cruzadas:**
- → Fluxo 3 (matching com Cobranca existente)
- → Fluxo 7 (cron geração mensal usa OCR pra dimensionar próxima cobrança DINAMICO)

---

### Fluxo 3 — Caminho B: Cobrança manual + Asaas

**Gatilho:** humano (admin lança via UI) OU cron `cobrancas.job.ts:23` (geração diária 08:00).

```
[Admin /dashboard/cobrancas/nova]                [Cron cobrancas.job.ts]
              │                                            │
              └─────────────────┬──────────────────────────┘
                                ▼
                  CobrancasService.create()
                    ├─ calcula via helper canônico (FIXO/COMPENSADOS/DINAMICO)
                    ├─ aplica multa+juros se vencida (Fatia B futuro)
                    └─ persiste Cobranca status=A_VENCER
                                │
                                ▼ (se gateway Asaas configurado)
                  GatewayPagamentoService.emitirCobranca()
                    └─ AsaasAdapter (atual = AsaasService LEGADO — D-33)
                                │
                                ▼ POST Asaas API
                  Asaas API → cria Charge (PIX + boleto)
                    → retorna asaasId
                                │
                                ▼
                  AsaasCobranca (PERSISTE)
                    ├─ asaasId, valor, cobrancaId
                    └─ status = PENDING
                                │
                                ▼ (cooperado paga)
                  Asaas Webhook → POST /webhooks/asaas
                    ├─ valida HMAC-SHA256
                    └─ atualiza AsaasCobranca.status = RECEIVED
                                │
                                ▼
                  CobrancaService.marcarComoPaga()
                    └─ Cobranca.status = PAGO + dataPagamento
```

**Estado real (validado SQL):**
```
SELECT status, COUNT(*) FROM cobrancas GROUP BY status;
→ PAGO 31 · A_VENCER 6 · VENCIDO 3

SELECT COUNT(*) FROM asaas_cobrancas;        → 5 (todas RECEIVED)
SELECT COUNT(*) FROM asaas_customers;        → 62
SELECT COUNT(*) FROM cobranca_gateway;       → 7
```

**Distribuição real das 31 PAGAS:**
- **5 via Asaas sandbox** (16%) — `AsaasCobranca` criadas 23-27/04 durante Sprint 12 sandbox validation. Valores R$ 8/12/20/40/500. Cobrancas linkadas estão `PAGO`.
- **26 via baixa manual** (84%) — admin marcou pago direto na UI sem Asaas Charge.

> **Correção retroativa Decisão 23:** Sessão 12/05 noite e Dia 1 do H.2 (commit `382f40e` §4.4) afirmaram "AsaasCobranca = 0" e "31 PAGAS = 100% baixa manual". **Errado.** Re-validação 13/05 noite via SQL revelou os 5 registros sandbox. Memória estava inflada — Decisão 23 cumpre seu propósito ao re-validar.

**Bloqueios pra produção real (Fatia A canário):**
- D-33 (dual-path Asaas — `getConfig()` lê `AsaasConfig` legado em vez de `ConfigGateway` atual)
- Conta Asaas-CoopereBR em produção (sandbox já funciona — provado pelos 5 registros)

**Referências cruzadas:**
- ← Fluxo 2 (FaturaProcessada via OCR atualiza valorCheioKwh da Cobranca antes de emitir)
- → Fluxo 7 (cron geração mensal cria Cobranca via este caminho)
- → Fluxo 8 (FaturaSaas usa mesmo padrão Asaas, mas via ConfigGatewayPlataforma — vazio)

---

### Fluxo 4 — Aprovação de proposta + concessionária

**Gatilho:** cooperado aceita proposta via tela pública (Fase C.3 fechou em 11/05).

```
[Cooperado: /aprovar-proposta?token=...]
              │
              ▼
PUBLICO/cooperado-publico.controller.ts
   POST /publico/proposta/aceitar
              │
              ▼
MotorPropostaService.aceitar()
   ├─ valida token
   ├─ congela tarifa (helper calcular-tarifa-contratual.ts)
   ├─ cria/atualiza Contrato status=PENDENTE
   ├─ marca Cooperado.status = AGUARDANDO_CONCESSIONARIA
   └─ envia email "aguardando concessionária"
              │
              ▼
[Cooperado submete protocolo concessionária via /portal/conta]
              │
              ▼
[Admin: /dashboard/cooperados/[id] — etapa 11]
   POST /cooperados/:id/aprovar-concessionaria
              │
              ▼
CooperadosService.aprovarConcessionaria()
   ├─ valida protocoloConcessionaria @MinLength(3)
   ├─ multi-tenant (SUPER_ADMIN bypass)
   ├─ atualiza Cooperado.status = APROVADO
   └─ chama enviarCadastroAprovado() (email confirmação)
              │
              ▼
[Aguarda 1ª fatura concessionária OCR (Fluxo 2)]
              │
              ▼
Cooperado.status = ATIVO
   └─ Contrato.status = ATIVO
```

**Estado real (validado SQL):**
```
SELECT status, COUNT(*) FROM contratos GROUP BY status;
→ ATIVO 76 · PENDENTE_ATIVACAO 1 · ENCERRADO 1

SELECT status, COUNT(*) FROM cooperados GROUP BY status;
→ ATIVO 309 · PENDENTE 6 · APROVADO 1 · ATIVO_RECEBENDO_CREDITOS 1
```

**MARCIO MACIEL destravado** em 11/05 commit `8853d97` — primeiro caso real Caminho UI etapa 11.

**Referências cruzadas:**
- ← Fluxo 1 (cadastro precede aprovação)
- → Fluxo 7 (cron geração mensal só ativa pós Cooperado=ATIVO)

---

### Fluxo 5 — CooperToken: emissão e resgate

**Gatilho:** Cooperado com `modoRemuneracao=CLUBE` recebe tokens em vez de desconto direto na fatura.

```
[Mensalmente, ao gerar Cobranca]
              │
              ▼
CobrancasService.calcularEconomia()
   ├─ se modoRemuneracao=DESCONTO: aplica desconto direto
   └─ se modoRemuneracao=CLUBE:
              │
              ▼
   CooperTokenService.emitirTokens()
      ├─ valor = economia × valorTokenReais (hardcode 0.20 — D-29A)
      ├─ persiste em CooperTokenLedger (tipo=EMISSAO)
      └─ atualiza CooperTokenSaldo (cooperadoId)
              │
              ▼
[Cooperado: /portal/tokens — wallet]
              │
              ▼ (resgate via parceiro do clube)
   POST /cooper-token/resgatar
              │
              ▼
   CooperTokenService.resgatar()
      ├─ valida saldo
      ├─ persiste CooperTokenLedger (tipo=RESGATE, operacao=DEBITO)
      ├─ atualiza CooperTokenSaldo
      └─ vincula a OfertaClube ou ResgateClubeVantagens
```

**Estado real (validado SQL):**
```
SELECT COUNT(*) FROM cooper_token_ledger;        → 9 entradas
SELECT COUNT(*) FROM cooper_token_saldo;         → 5 saldos ativos
SELECT COUNT(*) FROM cooper_tokens_compras;      → registros teste
```

**Volume baixo** — módulo `cooper-token/` tem 2.671 LOC e **0 specs**. Pré-req P0 do Sprint CooperToken Consolidado (Fatia C — escrever specs antes de refator). 4.9 tokens emitidos por engano antes do conserto CLUBE (débito P3 catalogado).

**Modelo migracional incompleto:** 85 cooperados em estado intermediário entre `opcaoToken` (legado) e `modoRemuneracao` (novo) — D-30Z catalogado.

**Referências cruzadas:**
- → Fluxo 9 (resgate pode ser em parceiro do convênio)

---

### Fluxo 6 — MLM cascata (indicação)

**Gatilho:** cooperado A indica cooperado B; quando B paga 1ª cobrança, A recebe bônus.

```
[Cooperado A: /portal/indicacoes]
              │
              ▼
POST /indicacoes/criar-convite
              │
              ▼
   ConviteIndicacaoService.criar()
      ├─ gera codigo único
      ├─ persiste ConviteIndicacao status=PENDENTE
      └─ envia link via WhatsApp/email
              │
              ▼
[Cooperado B: /convite/[codigo] → /cadastro?conviteCodigo=...]
              │
              ▼
   PublicoController.cadastro({ conviteCodigo })
      ├─ cria Cooperado B
      ├─ persiste Indicacao { indicadorId: A, indicadoId: B }
      └─ marca ConviteIndicacao status=ACEITO
              │
              ▼ [Fluxo 1 + 4 — B vira ATIVO]
              ▼ [Fluxo 3 — B paga 1ª cobrança]
              │
              ▼ Event listener (cobranca.paga.first)
   IndicacaoService.aplicarBonus()
      ├─ identifica indicador A
      ├─ percorre cascata até N níveis (config)
      ├─ persiste BeneficioIndicacao { indicacaoId, valor }
      └─ aplica como crédito futuro pra A
```

**Estado real (validado SQL):**
```
SELECT COUNT(*) FROM indicacao;              → 10
SELECT COUNT(*) FROM beneficio_indicacao;    → 0
```

**D-30M aberto:** pipeline OK e cabeado (event emitter + listener + create) mas **0 BeneficioIndicacao** no banco. As 10 indicações vieram de seed/cadastro mas nenhum indicado pagou via Caminho B real ainda. Validação E2E pendente (catalogada P2).

**Referências cruzadas:**
- → Fluxo 3 (gatilho é pagamento via Caminho B)
- → Fluxo 1 (link convite leva ao cadastro)

---

### Fluxo 7 — Cron geração mensal de cobrança

**Gatilho:** cron `cobrancas.job.ts:23` (`@Cron('0 8 * * *')` — todo dia 08:00).

```
[Cron diário 08:00]
       │
       ▼
CobrancasJob.gerarCobrancasDoMes()
       │
       ▼
   Itera Cooperado.status=ATIVO em todos tenants
       │
       ▼ pra cada cooperado:
   ┌──────────────────────────────────────────────┐
   │ 1. Verifica se já existe Cobranca do mês     │
   │    (idempotência)                            │
   │ 2. Lê Contrato.modeloCobranca:               │
   │    - FIXO: usa valorContrato congelado       │
   │    - COMPENSADOS: dimensiona via FaturaProc. │
   │      mais recente da UC (Fluxo 2)            │
   │    - DINAMICO: lê valorCheioKwh on-the-fly   │
   │ 3. Aplica desconto / Fio B / bandeira        │
   │ 4. Chama CooperTokenService.emitir() se      │
   │    modoRemuneracao=CLUBE (Fluxo 5)           │
   │ 5. Persiste Cobranca status=A_VENCER         │
   │ 6. Se gateway Asaas: emite Charge (Fluxo 3)  │
   └──────────────────────────────────────────────┘
       │
       ▼
[Outros crons relacionados, mesma job:]
   - 02:00 retentativas (ressincroniza Asaas)
   - 03:00 atualiza status (vence A_VENCER pra VENCIDO)
   - 06:15 envia notificações (WA/email)
```

**Estado real:** 4 crons em `cobrancas.job.ts` ativos. Geração 100% manual hoje (admin faz via tela `/dashboard/cobrancas/nova`) porque **`BLOQUEIO_MODELOS_NAO_FIXO=true`** ainda ativa em prod. Quando desativar (canário Fatia A), cron passa a gerar automaticamente.

**Referências cruzadas:**
- → Fluxo 3 (caminho de cobrança)
- → Fluxo 5 (CooperToken)
- ← Fluxo 2 (OCR alimenta dimensionamento DINAMICO)

---

### Fluxo 8 — FaturaSaas Luciano → Parceiro

**Gatilho:** cron `saas.service.ts:130` (`@Cron('0 6 1 * *')` — dia 1 do mês 06:00).

```
[Cron mensal dia 1, 06:00]
       │
       ▼
SaasService.gerarFaturasDoMes()
       │
       ▼
   Itera Cooperativa.status=ATIVO
       │
       ▼ pra cada parceiro:
   ┌──────────────────────────────────────────┐
   │ Lê PlanoSaas vinculado                   │
   │ Calcula valor:                           │
   │   - mensalidadeBase (sempre)             │
   │   - + percentualReceita × receitaMes     │
   │ (ignora 8 outros campos PlanoSaas — D29F)│
   │ Persiste FaturaSaas status=PENDENTE      │
   └──────────────────────────────────────────┘
       │
       ▼ ❌ NÃO ACONTECE HOJE:
   GatewayPlataformaService.emitirAsaas(faturaSaas)
   └─ leria de ConfigGatewayPlataforma (count = 0!)
   └─ enviaria Asaas Charge pra cobrar parceiro via Asaas-Luciano
       │
       ▼ ❌ NÃO ACONTECE HOJE:
   Cron D-7/D-3/D-1 → email/WA pro parceiro lembrar
```

**Estado real (validado SQL):**
```
SELECT status, COUNT(*) FROM faturas_saas GROUP BY status;
→ PENDENTE 3 (todas sem asaasCobrancaId)

SELECT COUNT(*) FROM config_gateway_plataforma; → 0
```

**3 FaturaSaas PENDENTE no banco** (CoopereBR Teste R$ 5.900 vencida 10/04 + 2 outras). Nenhuma com `asaasCobrancaId` populado. Parceiro não recebe link de pagamento, sem email/WA pra lembrar, sem endpoint pra marcar paga via UI.

**Decomposto em 3 sub-débitos P1:**
- **D-29F.1** — cron de geração (validar/criar)
- **D-29F.2** — envio via Asaas (`ConfigGatewayPlataforma` vazio bloqueia)
- **D-29F.3** — comunicação D-7/D-3/D-1

**Bloqueio operacional:** Luciano abrir conta **Asaas-SISGD** em produção (Asaas dele, não do parceiro).

**Referências cruzadas:**
- ← Fluxo 3 (mesmo padrão Asaas, mas modelo gateway diferente — `ConfigGatewayPlataforma` em vez de `ConfigGateway`)

---

### Fluxo 9 — Convênio + link de membro público

**Gatilho:** organização institucional (ex.: Hangar Academia) gera link público; visitantes cadastram-se via link.

```
[Convênio configurado por admin /dashboard/convenios/[id]]
       │
       ▼
ContratoConvenio criado
   ├─ vincula Convenio (PJ) ↔ Cooperativa (parceiro SISGD)
   └─ define faixas de bonificação (% por volume de membros)
       │
       ▼
[Link público: /cadastro?convenioCodigo=...]
       │
       ▼
PublicoController.cadastro({ convenioCodigo })
   ├─ cria Cooperado normalmente (Fluxo 1)
   ├─ persiste ConvenioCooperado { cooperadoId, convenioId }
   ├─ vincula indicacaoId (se vier — D-30P fixou em 01/05)
   └─ chama recalcularFaixa() (D-30Q fixou em 01/05)
       │
       ▼
HistoricoFaixaConvenio (registra mudança de tier)
       │
       ▼
[Quando membro PJ paga primeira fatura:]
   Convênio sobe faixa → bonificação maior próximo mês
```

**Estado real (validado SQL):**
```
SELECT COUNT(*) FROM contrato_convenios;     → 2
SELECT COUNT(*) FROM convenio_cooperados;    → 215
```

**215 cooperados** vinculados a convênios (Hangar Academia, AESMP, ASSEJUFES — membros PJ da CoopereBR). 2 contratos de convênio ativos.

**D-30P + D-30Q resolvidos** em 01/05 (commit `fa9dc72`) — caminho público de convênio agora vincula `indicacaoId` corretamente e recalcula faixa.

**Referências cruzadas:**
- → Fluxo 1 (cadastro segue mesmo caminho)
- → Fluxo 6 (indicação pode vir junto via convênio)

---

### Fluxo 10 — Auditoria regulatória ANEEL

**Gatilho:** cron diário (planejado para Sprint 5 — não existe ainda).

```
[Cron 06:00 — A IMPLEMENTAR no Sprint 5]
       │
       ▼
AuditoriaRegulatoriaService.executar()
       │
       ▼
   Pra cada Usina:
       │
       ▼
   ┌──────────────────────────────────────────────┐
   │ 1. Limite 25%: percentualUsina × cooperados  │
   │    (D-31 reframed — usar fórmula on-the-fly  │
   │     kwhContratoAnual / Usina.capacidadeKwh)  │
   │ 2. Mix de classes (GD I/II/III) — Fio B      │
   │    (Sprint 5a)                               │
   │ 3. Concentração por cooperado-usina          │
   │ 4. Transferência de saldo (D-30G)            │
   │ 5. Mistura classes mesma usina (D-30B/G)     │
   └──────────────────────────────────────────────┘
       │
       ▼
   Se violação detectada:
       └─ persiste em AuditLog (D-30N — interceptor não impl.!)
       └─ alerta WhatsApp/email pro admin
       └─ flag bloqueio operacional (configurável por parceiro)
```

**Estado real:** **NÃO EXISTE em código** — Sprint 0 (Auditoria Regulatória Emergencial) e Sprint 5 (Módulo Regulatório ANEEL) ainda não iniciaram. Auditoria manual gerada como relatório one-shot em 11/05 (`docs/relatorios/2026-05-11-auditoria-concentracao-25-pct.md`) revelou 0 violações — mas com input fictício (D-31 reframed).

**Bloqueios:**
- **AuditLog inativo** (D-30N) — Sprint 5/6
- **Flags ANEEL** (`concentracaoMaxPorCooperadoUsina`, etc.) — Sprint 5
- **`RegrasFioB`** model não cadastrado — D-30E

**Referências cruzadas:**
- ← Fluxo 1 (cadastro pode ser bloqueado por flag)
- ← Fluxo 4 (aprovação admin do plano também — D-30W decisão 22)
- ← Fluxo 7 (cron de cobrança para com violação? a definir Sprint 5)

---

### 6.11 Resumo: estado real dos 10 fluxos

| # | Fluxo | Caminho real exercitado? | Estado |
|---:|---|---|---|
| 1 | Cadastro novo cooperado | Sim — 317 cooperados, 6 PENDENTE | 🟢 |
| 2 | Caminho A (OCR) | 1 caso real (João Santos), 12 seeds + 4 testes | 🟡 frágil |
| 3 | Caminho B (manual + Asaas) | 31 PAGAS — 5 via Asaas sandbox + 26 baixa manual | 🟡 sandbox OK, prod 🔴 |
| 4 | Aprovação proposta | MARCIO MACIEL destravado 11/05 (1 caso UI) | 🟢 |
| 5 | CooperToken emissão/resgate | 9 ledger entries, volume baixo | 🟡 |
| 6 | MLM cascata | 10 indicações, 0 benefícios — D-30M | 🟡 cabeado, sem E2E |
| 7 | Cron geração mensal | 4 crons ativos, mas geração manual hoje | 🟡 |
| 8 | FaturaSaas Luciano→Parceiro | Cron OK, 3 PENDENTE, sem envio Asaas — D-29F | 🔴 não envia |
| 9 | Convênio + link público | 215 cooperados via convênio, D-30P/Q OK | 🟢 |
| 10 | Auditoria ANEEL | NÃO EXISTE — Sprint 0/5 | 🔴 |

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
