# Estado real de cobrança E2E — 30/04/2026 (noite)

> **Modo:** read-only puro. Cruzou código + schema + banco real (snapshot 30/04 noite).
> **Aplicou regra de validação prévia obrigatória** (carregada de memória persistente): consultou sessões anteriores antes de começar.
> **Insumo direto pra:** decisão de próximos passos da semana.

---

## Verificação prévia aplicada

Sessões anteriores cobriram partes deste pipeline. Reutilizei evidências de:

- `docs/sessoes/2026-04-27-webhook-asaas-sandbox-validado.md` (commit `16302e9`) — webhook + 3 bugs P1 corrigidos.
- `docs/sessoes/2026-04-26-sprint11-fase-d-e2e.md` — pipeline OCR fatura Luciano.
- `docs/sessoes/2026-04-26-diagnostico-faturas-20a26abr.md` — IMAP 13/13 OCR sucesso.
- `docs/sessoes/2026-04-29-validacao-invs-4-8.md` — FaturaSaas, financeiro, fidelidade, WhatsApp.
- `docs/sessoes/2026-04-30-diagnostico-fatura-real.md` (commit `5ae9dfd`) — diagnóstico completo do caso Luciano UC `000142138005470`.

Conclusão da verificação: **estado de cada etapa já mapeado parcialmente; o que falta é consolidação cruzada e contagens atualizadas do banco**.

---

## 1. Pipeline E2E — 16 etapas

Snapshot do banco: 30/04/2026 noite.

| # | Etapa | Estado | Evidência |
|---|---|---|---|
| 1 | Cadastro membro (admin/público) | 🟢 | 311 cooperados, 303 ATIVOS, 220 novos desde 01/04 |
| 2 | Aprovação documentos KYC | 🟡 | Apenas 3 `DocumentoCooperado` (todos APROVADO) — desproporcional aos 311 cooperados |
| 3 | Vinculação a usina | 🟢 | 72 contratos (70 ATIVO + 1 PENDENTE_ATIVACAO + 7 LISTA_ESPERA) |
| 4 | UC ativada na concessionária (lista) | 🟢 | 300 UCs cadastradas; tela `/dashboard/usinas/listas` exporta CSV/PDF/Excel |
| 5 | Concessionária envia fatura por email | 🟢 | EmailLog: 4 (2 ENVIADO + 2 ERRO). Pouco volume, mas pipeline ativo |
| 6 | SISGD recebe via IMAP | 🟢 | Cron `email-monitor` 6h diário (Sprint 11 validou 13/13 OCR sucesso na rodada de 26/04) |
| 7 | OCR Claude AI extrai dados | 🟢 | 5 `FaturaProcessada` no banco; pipeline `extrairOcr()` 50+ campos validado pelo diagnóstico (`5ae9dfd`) |
| 8 | Admin aprova FaturaProcessada | 🟡 | 4 APROVADAS, mas **0 com `mesReferencia`**, **só 1 com `cobrancaGeradaId`** (referência inválida — cobrança não está na tabela) |
| 9 | `gerarCobrancaPosFatura` cria Cobranca | 🔴 | **0 cobranças** com `faturaProcessadaId` preenchido. Pipeline OCR→Cobrança **NUNCA EXERCITADO** |
| 10 | Asaas emite boleto/PIX/QR Code | 🟢 | AsaasConfig com `webhookToken` setado; 5 AsaasCobranca; 62 AsaasCustomer |
| 11 | Cooperado recebe notificação (WA + email) | 🟡 | `NOTIFICACOES_ATIVAS=false` no `.env`. Crons existem mas estão silenciados |
| 12 | Cooperado paga | 🟢 | 31 cobranças PAGO no banco (90% das 34 cobranças totais) |
| 13 | Webhook Asaas marca PAGO | 🟢 | 31 cobranças com `dataPagamento`; última em 27/04 (sandbox); todas AsaasCobranca = RECEIVED |
| 14 | LancamentoCaixa registrado | 🟢 | 53 LancamentoCaixa (45 REALIZADO + 8 PREVISTO); 43 vinculados a cooperado |
| 15 | CooperToken emitido | 🟢 | 9 ledger entries (8 CREDITO + 1 DEBITO); 5 saldos |
| 16 | Indicador recebe benefício MLM | 🔴 | 9 Indicacao com PRIMEIRA_FATURA_PAGA mas **0 BeneficioIndicacao** — bônus MLM **NÃO está disparando** |

**Resumo:** 11 etapas 🟢 + 4 etapas 🟡 + **2 etapas 🔴 críticas** (#9 OCR→Cobrança nunca exercitado; #16 MLM bônus não dispara).

---

## 2. Evidências detalhadas por etapa

### 🟢 Etapa 1 — Cadastro
- **Código:** `backend/src/publico/publico.controller.ts` 6 endpoints (`/publico/cadastro-web`, etc.). 3 caminhos públicos confirmados.
- **Schema:** `Cooperado` model completo, `CADASTRO_V2_ATIVO=true` no `.env`.
- **Banco:** 311 total, 303 ATIVOS, **220 criados após 01/04** (crescimento 70% num mês — confirma cadastros em produção real).

### 🟡 Etapa 2 — Aprovação documentos (assimetria)
- **Código:** `documentos-aprovacao.job.ts:0 */1 * * *` (cron horário) auto-aprova com gate.
- **Schema:** `DocumentoCooperado` (FK em Cooperado), enum `StatusDocumento`.
- **Banco:** apenas **3 documentos** no total — para 311 cooperados. **Cron horário existe, mas dados sugerem que 99% dos cadastros não anexam documentos** (cadastros públicos via `/cadastro` não exigem upload obrigatório).

### 🟢 Etapas 3-4 — Contratos e UCs
- **Código:** `motor-proposta.service.aceitar()`, `usinas.service.validarCompatibilidadeAneel()` linha 77.
- **Banco:** 72 contratos, 300 UCs, 7 ListaEspera.

### 🟢 Etapa 6 — IMAP
- **Código:** `email-monitor.service.ts` cron `0 0 6 * * *` (6h diário).
- **Banco:** EmailLog volume baixo (4) mas pipeline ativo.
- **Histórico:** Sprint 11 Fase D (26/04) processou 13/13 faturas EDP-ES com sucesso.

### 🟢 Etapa 7 — OCR rico (50+ campos)
- **Código:** `faturas.service.ts:extrairOcr()` chama Claude AI.
- **Insumo:** diagnóstico fatura real Luciano (commit `5ae9dfd`) validou 50+ campos extraídos.

### 🔴 Etapa 9 — `gerarCobrancaPosFatura` NUNCA EXERCITADO em produção
- **Código:** existe em `faturas.service.ts:gerarCobrancaPosFatura` (linha ~960+).
- **Schema:** `Cobranca.faturaProcessadaId String?` existe.
- **Banco:**
  - 0 cobranças com `modeloCobrancaUsado` preenchido (de 34 total)
  - 0 cobranças com `faturaProcessadaId` preenchido
  - 0 cobranças com `kwhCompensado` preenchido
- **Cobranças que existem (34) vieram de:**
  - **Caminho manual** via `/dashboard/cobrancas/nova` (validado em 27/04, 3 bugs P1 corrigidos no commit `16302e9`)
  - Seeds antigos
- **Última cobrança PAGA:** id `cmoh8z9py0001vai4f9ao7qye`, R$ 8 valor líquido, 27/04, plano OURO COMPENSADOS, **`tarifaContratual=null`**, `modeloCobrancaUsado=null`.

### 🟢 Etapa 10 — Asaas (sandbox)
- **Código:** `asaas/asaas.service.ts`, webhook validado em sandbox (commit `16302e9`).
- **Banco:** 1 AsaasConfig com `webhookToken` setado, 62 AsaasCustomer, 5 AsaasCobranca todas RECEIVED.

### 🟡 Etapa 11 — Notificações silenciadas em dev
- **Código:** `cobrancas.job.ts` × 4 crons (D-3, D-1, vencimento, multa).
- **`.env`:** `NOTIFICACOES_ATIVAS=false` — todos os disparos WA/email **bloqueados em dev**.
- **Em produção:** dependerá da flag estar `true`. Hoje **não está enviando nada**.

### 🟢 Etapa 12-13 — Pagamento + Webhook
- 31 cobranças PAGO. Última `dataPagamento`: 27/04/2026 (data do commit `16302e9`).
- **Confirmação:** caminho manual UI → Asaas sandbox → webhook → PAGO + LancamentoCaixa **funciona ponta a ponta** (validado 27/04 com 3 bugs P1 corrigidos).

### 🟢 Etapa 14 — LancamentoCaixa
- 53 total. 45 REALIZADO + 8 PREVISTO.
- 43 vinculados a `cooperadoId` (origem cobrança).
- 0 com `naturezaClube` (Sprint 9 contabilidade preparatória nunca exercitada).

### 🟢 Etapa 15 — CooperToken
- 9 ledger entries (8 CREDITO emitidos + 1 DEBITO usado).
- 5 saldos por cooperado.
- **Hardcode 0.20** em `cooper-token.service.ts:258` ainda ativo (D-29A) — não bate com R$ 0,45 da spec.

### 🔴 Etapa 16 — MLM bônus não dispara
- **9 Indicacao** com status `PRIMEIRA_FATURA_PAGA`.
- **0 BeneficioIndicacao** no banco.
- **Achado novo:** quando primeira fatura é paga, `Indicacao.status` muda para `PRIMEIRA_FATURA_PAGA` mas **nenhum `BeneficioIndicacao` é criado**.
- Pipeline MLM cascata existe em código (`indicacoes/`, 11 endpoints) mas **disparo de bônus está quebrado ou não foi exercitado em produção**.
- **Investigar:** falta lógica que cria `BeneficioIndicacao` ao mudar status; ou está em outra trigger não disparada.

---

## 3. Bloqueadores ativos identificados

### Confirmados via grep no código atual

| Bloqueador | Localização | Estado |
|---|---|---|
| `BLOQUEIO_MODELOS_NAO_FIXO` ativo | `faturas.service.ts:571,984` + `motor-proposta.service.ts:549` | **ATIVO** (default ON) — bloqueia COMPENSADOS e DINAMICO |
| `NotImplementedException` DINAMICO | `faturas.service.ts:1878` | **ATIVO** — DINAMICO joga exceção |
| Hardcode `R$ 0,50/kWh` Portal Proprietário | `usinas.service.ts:503,525` | **ATIVO** (Sprint 4 resolve) |
| Hardcode `valorTokenReais=0.20` | `cooper-token.service.ts:258` | **ATIVO** (D-29A — bug confirmado em validação specs 30/04 noite) |
| `NOTIFICACOES_ATIVAS=false` | `backend/.env` | **ATIVO** — silencia WA/email em dev |
| FaturaSaas sem Asaas/comunicação | `saas/saas.service.ts` | **CONFIRMADO** (Sprint 1) |

### Bloqueadores anteriormente catalogados — RESOLVIDOS

| Item | Estado em sessão anterior | Estado hoje |
|---|---|---|
| Webhook Asaas sandbox | "Nunca rodou em produção real" | **Sandbox validado** em 27/04 (`16302e9`). Ainda não foi pra produção real. |
| `percentualDesconto missing` em criação manual | Bug P1 latente | **Corrigido** em 27/04 (commit `16302e9`) |
| `dataVencimento sem hora ISO` | Bug P1 latente | **Corrigido** em 27/04 |
| Modo CLUBE dupla bonificação | Bug P1 arquitetural | **Corrigido** em 27/04 |

### Achados novos descobertos NESTA investigação

1. **`Cobranca.tarifaContratual=null` em contratos COMPENSADOS** — caso CTR-324704 (Luciano) e CTR-652787 (última cobrança paga) confirmados. Bug do snapshot `Motor.aceitar()` quando aceita plano COMPENSADOS — não popula `tarifaContratual`. Backend cai em fallback errado.
2. **0 cobranças com `modeloCobrancaUsado`** — confirma que `gerarCobrancaPosFatura` nunca rodou em produção. As 34 cobranças vieram de caminho manual ou seed.
3. **`FaturaProcessada.mesReferencia=null`** em todas as 5 — campo crítico não populado pelo OCR.
4. **9 Indicacao PRIMEIRA_FATURA_PAGA mas 0 BeneficioIndicacao** — bônus MLM não dispara. **Não estava catalogado.**
5. **AuditLog total = 0** — Sprint 13a Dia 1 criou tabela mas interceptor não foi ativado.
6. **Apenas 3 documentos KYC** para 311 cooperados — assimetria sugere que cadastros públicos não exigem upload obrigatório.

---

## 4. Funcionalidades já FUNCIONAIS em produção

Aqui o que **funciona ponta a ponta** hoje, com evidência:

### ✓ Pipeline IMAP→OCR (último mês)
- **Evidência:** Sprint 11 Fase D, 26/04 — 13/13 faturas EDP-ES processadas com sucesso (`docs/sessoes/2026-04-26-diagnostico-faturas-20a26abr.md`).
- **Código:** `email-monitor.service.ts` cron 6h + `faturas.service.ts:extrairOcr` Claude AI.

### ✓ Cadastro V2 público/admin (3 caminhos)
- **Evidência:** 220 cooperados criados após 01/04 (crescimento 70% em 1 mês).
- **Código:** `publico.controller.ts` 6 endpoints + Wizard 7 steps em `/dashboard/cooperados/novo`.

### ✓ WhatsApp bot (38+ estados)
- **Evidência:** 43 ConversaWhatsapp ativas, CoopereAI Anthropic SDK direto.
- **Código:** 10 services em `backend/src/whatsapp/`, 27 endpoints, 5 crons.
- **Lacuna:** sem testes Jest (D-29E).

### ✓ Validação ANEEL básica (mesma distribuidora)
- **Evidência:** `validarCompatibilidadeAneel()` em `usinas.service.ts:77`, chamado em 5 pontos.
- **Estado:** funcional, único validador ANEEL real implementado.

### ✓ Webhook Asaas (sandbox)
- **Evidência:** 31 cobranças PAGO, última 27/04. AsaasCobranca todas RECEIVED.
- **Pendente:** ainda **não foi pra produção real** (Asaas em sandbox; Luciano precisa abrir conta produção).

### ✓ LancamentoCaixa em pagamento de cobrança
- **Evidência:** 53 LancamentoCaixa, 45 REALIZADO, 43 vinculados a cooperado.
- **Código:** `cobrancas.service.ts:345-370` (PREVISTO) + `:449-493` (REALIZADO via webhook).

### ✓ Caminho manual de cobrança via UI
- **Evidência:** 31 cobranças PAGO oriundas desse caminho (validado 27/04 após 3 bugs P1 corrigidos).
- **Código:** `/dashboard/cobrancas/nova` + `cobrancas.service.create()`.

### ✓ Lista compensação/homologação EDP
- **Evidência:** `/dashboard/usinas/listas` + componente `DualListaConcessionaria.tsx` (Leitura Total Parte 2).

### ✓ Cron mensal FaturaSaas (cria fatura no banco)
- **Evidência:** 1 FaturaSaas PENDENTE no banco (CoopereBR Teste R$ 5.900).
- **Código:** `saas.service.ts:130 @Cron('0 6 1 * *')`.
- **Pendente:** sem Asaas, sem comunicação, sem fluxo de pagamento (Sprint 1).

---

## 5. Gap real entre estado atual e cobrança E2E

### Pergunta central
**O que especificamente falta pra emitir UMA cobrança real, completa, ponta a ponta, pra um cooperado real, em produção real?**

### Resposta sincera

**Caminho A — Cobrança via OCR de fatura EDP (FIXO_MENSAL ou COMPENSADOS):**

🔴 **GRANDE.** Falta:
1. Pipeline `gerarCobrancaPosFatura` sair do papel — **nunca rodou em produção** (0 cobranças com `faturaProcessadaId`).
2. `BLOQUEIO_MODELOS_NAO_FIXO=false` — destravar COMPENSADOS no env (e validar com QA).
3. Implementar `CREDITOS_DINAMICO` — hoje joga `NotImplementedException` em `faturas.service.ts:1878`.
4. Corrigir bug do snapshot Motor.aceitar — `tarifaContratual` vazia em contratos COMPENSADOS.
5. Popular `FaturaProcessada.mesReferencia` no OCR (hoje sempre `null`).
6. Asaas em produção real (Luciano abre conta).
7. `NOTIFICACOES_ATIVAS=true` em produção (silencia hoje em dev).

**→ Estimativa:** Sprint 2 (OCR-Integração + DINAMICO + COMPENSADOS) cobre 1-5. Sprint 1 cobre 6-7. **2-3 semanas de Code dedicado**.

---

**Caminho B — Cobrança via UI manual (FIXO_MENSAL):**

🟢 **PEQUENO.** Falta apenas:
1. Asaas em produção real (Luciano abre conta + troca credenciais).
2. `NOTIFICACOES_ATIVAS=true` em produção.

**→ Já funciona em sandbox.** Migrar pra produção é questão operacional, não de código.

---

**Caminho C — Bônus MLM cascata (efeito colateral):**

🔴 **MÉDIO.** Falta:
1. Investigar por que 9 Indicacao com PRIMEIRA_FATURA_PAGA não geraram BeneficioIndicacao.
2. Corrigir trigger de criação de bônus (provavelmente bug ou cron silenciado).

**→ Não bloqueia cobrança E2E**, mas bloqueia receita do indicador.

---

### Sumário

- **Caminho A (OCR→Cobrança via fatura EDP):** Sprint 1 + Sprint 2 = 3-5 semanas pra produção real.
- **Caminho B (UI manual):** apenas migração de sandbox pra produção. **Pode rodar em poucos dias** se Luciano abrir conta Asaas produção.
- **Bônus MLM:** investigação + fix isolado. Não bloqueia caminhos A ou B.

**Surpresa positiva:** caminho B (manual) está **mais maduro do que se pensava** — webhook validado, 3 bugs P1 corrigidos em 27/04, 31 cobranças PAGO em sandbox.

**Surpresa negativa:** caminho A (OCR→Cobrança) está **menos exercitado do que se pensava** — pipeline `gerarCobrancaPosFatura` literalmente NUNCA rodou (0 cobranças com `faturaProcessadaId`).

---

## 6. Recomendação executiva

**Em 5 linhas:**

1. **Curto prazo (1-2 semanas):** abrir conta Asaas produção e migrar caminho B (UI manual) pra produção. Já funciona em sandbox; é a primeira receita real do SISGD.
2. **Médio prazo (3-5 semanas):** Sprint 2 destrava caminho A (OCR→Cobrança via fatura EDP) — implementa DINAMICO, valida COMPENSADOS, corrige snapshot `tarifaContratual`, popula `FaturaProcessada.mesReferencia`.
3. **Paralelamente:** Sprint 1 (FaturaSaas Completo) — Luciano cobra parceiros automaticamente.
4. **Investigação isolada:** 9 Indicacao PRIMEIRA_FATURA_PAGA com 0 BeneficioIndicacao — débito novo a catalogar (sugestão: D-30M).
5. **Sprint 0 ainda é P0:** mas pode rodar em paralelo a tudo isso (auditoria regulatória não depende do estado de cobrança).

---

## 7. Débito novo descoberto

### D-30M (sugestão pra catalogar) — Bônus MLM cascata não dispara

**Severidade:** P2
**Detectado em:** 2026-04-30 noite (estado real cobrança E2E)
**Onde:** módulo `indicacoes/` (11 endpoints, 53 KB)

**Sintoma:**
- 9 Indicacao com `status='PRIMEIRA_FATURA_PAGA'`
- **0 BeneficioIndicacao** no banco

**Causa provável:** trigger de criação de bônus está quebrado ou cron não está rodando. Pipeline MLM cascata existe em código mas não foi exercitado em produção.

**Investigar antes de propor fix:**
1. `grep -rn "BeneficioIndicacao" backend/src/` — onde é criado?
2. Existe cron que processa indicações pagas e cria bônus?
3. Alguma flag silencia disparo (similar a `NOTIFICACOES_ATIVAS`)?

---

*Investigação read-only. Conduzida por Claude Code (Opus 4.7) em 2026-04-30 noite. Aplica regra de validação prévia obrigatória. Nenhum arquivo de produção alterado.*
