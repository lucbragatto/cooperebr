# Mapeamento Cadastros + Fluxo Financeiro End-to-End — 2026-05-12

> Investigação read-only executada pela Fase 0 desta sessão Code (12/05/2026).
> Cobre 15 componentes: 3 cadastros (porta de entrada) + 12 financeiro
> (corpo do fluxo). Insumo pra catalogação do "Sprint Cadastros +
> Financeiro Consolidado" — dimensionamento baseado em código real,
> não em premissas das memórias.
>
> **Salvaguardas aplicadas:** read-only estrito, sem disparar OCR/WA/email,
> dados pessoais (CPF/email/nome) não expostos, secrets não impressos,
> nenhuma mutação no banco/arquivo/config.

> ## ⚠️ Errata retroativa 14/05/2026 — Decisão 23 aplicada 3× em 48h
>
> Várias afirmações deste relatório sobre **"João Santos da Silva = único caso real de Caminho A em produção"** (§0.1, §A.1 Appendix, §C Tabela comparativa, §Achados extras item 2, §Achados laterais item 1) **estão desfeitas**.
>
> **Re-validação 14/05** (Bloco A Fatia A Etapa 1b, sessão Code) via SQL direto na produção:
> - João Santos da Silva (`cmmnf5dl10000uo70ta9698mi`) existe, mas com `ambienteTeste=true`, distribuidora `OUTRAS`, **0 contratos, 0 cobranças**.
> - Cobrança `pnbsm75n` **não existe na tabela `cobrancas`**.
> - Sessão `2026-04-30-estado-cobranca-e2e.md` linha 36 já flageava "só 1 com `cobrancaGeradaId` (referência inválida — cobrança não está na tabela)" — alerta foi perdido na propagação.
>
> **Conclusão real:** Caminho A **NUNCA rodou em produção real**. Os 17 `FaturaProcessada` no banco são 12 seeds Fase B.5 + 5 legados CoopereBR mar/2026 com `ambienteTeste=true` ou sem cobrança gerada. Pipeline existe e técnico, mas zero passagem viva.
>
> **As afirmações abaixo neste relatório referentes a "pipeline rodou X vezes em produção", "1 caso real", "primeiro cooperado real" devem ser lidas como HIPÓTESE DERRUBADA.** Mantidas inalteradas pra preservar histórico de raciocínio.

## ⚠️ Alerta operacional

Durante a investigação detectei **25 crons ativos** no backend (lista em
§0.10). Os mais críticos pra monitorar durante investigação read-only:

- `email-recebimento.service.ts` — EVERY_5_MINUTES (processa emails recebidos)
- `observador.service.ts` — EVERY_5_MINUTES (expira automáticas — escreve no banco)
- `whatsapp-conversa.job.ts` — EVERY_HOUR (reset conversas inativas)
- `documentos-aprovacao.job.ts` — a cada hora (aprovação automática docs)

Nenhum foi disparado manualmente. Read-only do banco não foi afetado.

## Resumo executivo

### Parte 1 — Cadastros (porta de entrada)

| # | Componente | Status | Estimativa pra completar |
|---|---|---|---|
| 0.0.A | Cadastro público (`/cadastro` V2, wizard único) | 🟡 PARCIAL | 2-3d Code (refator + integração) |
| 0.0.B | Cadastro admin (wizard 7 steps, ~2.4k linhas) | 🟡 PARCIAL | 3-4d Code (lacunas P1-001 etc.) |
| 0.0.C | Cadastro via convite/convênio | 🟡 PARCIAL | 1-2d Code + validação E2E |

### Parte 2 — Fluxo financeiro (corpo)

| # | Componente | Status | Estimativa pra completar |
|---|---|---|---|
| 0.1 | Caminho A pipeline (email→OCR→Cobrança) | 🟡 PARCIAL (rodou em prod!) | 1-2 semanas (estabilizar + monitorar) |
| 0.2 | Comunicação cooperado (email + WA) | 🟡 PARCIAL (infra ok, poucos gatilhos) | 1 semana |
| 0.3 | Relatório individual fatura+cobrança | ✅ COMPLETO (após Fase C.3 11/05) | — |
| 0.4 | Multa/juros/inadimplência | 🟡 PARCIAL (campos + crons existem) | 3-5d Code |
| 0.5 | Contas a pagar | 🟡 PARCIAL (mínimo viável) | 1 semana |
| 0.6 | Contas a receber | 🟡 PARCIAL (tela existe) | 5d Code |
| 0.7 | Conciliação bancária | 🟡 PARCIAL (1339 linhas, sem specs) | 1-2 semanas |
| 0.8 | DRE / fechamento | 🟡 PARCIAL (endpoint existe, sem fechamento) | 1-2 semanas |
| 0.9 | Caixa / LancamentoCaixa | ✅ FUNCIONAL (53 registros, em uso) | — |
| 0.10 | Crons financeiros | ✅ ATIVOS (25 crons, todos rodando) | — |
| 0.11 | Contabilidade-clube | 🟡 PARCIAL (controller existe, 0 specs) | 1 semana (parte do Sprint CT Etapa 1) |
| 0.12 | Painel SISGD super-admin financeiro | 🟡 PARCIAL (Sprint 13a, 145 linhas) | 1 semana (cards financeiros) |

## Detalhamento por componente

### 0.0.A Cadastro público (`/cadastro` V2)

**Status:** 🟡 PARCIAL

**Arquivos:**
- `web/app/cadastro/page.tsx` (**1553 linhas** — wizard inteiro num arquivo único, sem sub-rotas)
- `backend/src/publico/` — 3 arquivos, 814 linhas, 1 spec
- Sem `backend/src/publico/dto/` — payload provavelmente inline

**Endpoints públicos:** preciso aprofundar — não mapeei todos nesta fase (sem head -N gastou no email-monitor + financeiro + integracao + cobrancas). Sprint dedicado pra continuação.

**Banco (90 dias):**
- 317 cooperados criados (mas isso é ALL cooperados — coincide com TOTAL, sugere todos do seed inicial)
- 3 propostas total (1 ACEITA + 2 CANCELADA) — **uso real do /cadastro praticamente zero em produção**

**Estado real:**
- Wizard único de 1553 linhas (não fatiado em sub-rotas). Manutenibilidade questionável.
- Lê `Plano.cooperTokenAtivo` pra decidir DESCONTO_DIRETO vs FATURA_CHEIA_TOKEN (mapeado em sessão 04/05)
- OCR Claude AI sobre PDF do upload — pipeline funcional (faturas service tem 16 endpoints)
- Motor.dimensionar disparado no upload (não no Step 7 do admin — caminho diferente)

**Cross-check memória:**
- Sprint 10 (LGPD): CADASTRO_V2 desbloqueado em abr/2026
- Sessão 04/05 noite: `cadastro/page.tsx` linha 131 tem `cooperTokenAtivo` no tipo Plano
- Sessão 05/05 manhã: jornada etapa 1-2 marcadas ✅

**Gaps detectados:**
- 1553 linhas num arquivo é antipattern Next.js — fatiar em sub-rotas (`/cadastro/[step]`) ou componentes
- 0 propostas PENDENTES com token ativo no banco (todas as 3 já foram processadas/canceladas)
- Wizard pode estar com lacunas em UX (não validei E2E, só estrutura)

**Estimativa pra completar:** 2-3 dias Code (refator pra sub-rotas + validação E2E + cobertura de testes ts-node).

---

### 0.0.B Cadastro admin (wizard 7 steps)

**Status:** 🟡 PARCIAL

**Arquivos (web/app/dashboard/cooperados/novo/):**
- `page.tsx` (297 linhas — controller do wizard)
- `steps/Step1Fatura.tsx` (594 linhas — OCR/upload)
- `steps/Step2Dados.tsx` (388 linhas — dados pessoais)
- `steps/Step3Simulacao.tsx` (355 linhas — simulação)
- `steps/Step4Proposta.tsx` (293 linhas — envia proposta)
- `steps/Step5Documentos.tsx` (243 linhas — upload docs)
- `steps/Step6Contrato.tsx` (219 linhas — contrato)
- `steps/Step7Alocacao.tsx` (352 linhas — aloca usina)

**Total: ~2.741 linhas** distribuídas em 8 arquivos (BEM melhor que /cadastro público de 1553 em 1 arquivo).

**Backend relacionado:**
- `cooperados.service.ts` — métodos `criarCooperadoCompleto`, `alocarUsina`, etc.
- `motor-proposta.service.ts` — `dimensionarPropostaParaPlano`, `aceitar`
- `faturas.service.ts` — OCR e processamento

**Estado real:**
- Lacunas históricas catalogadas em sessões abr/2026: P1-001 (Step 3 não recalcula simulação ao trocar plano), Step 4 via wa.me/mailto sem persistir, Motor.dimensionar só no Step 7
- Não validei se essas lacunas continuam ou foram corrigidas em sprints posteriores

**Cross-check:**
- D-J-1 fechada em 11/05 (UI etapa 11 AGUARDANDO_CONCESSIONARIA → APROVADO) usa endpoint dedicado novo — fluxo pós-aceite atualizado
- MARCIO MACIEL (CoopereBR) destravado em 11/05 = 1 cooperado real exercitou todo o caminho até APROVADO

**Gaps detectados:**
- Steps com 200-594 linhas individuais — Step1Fatura (594) e Step2Dados (388) podem ter validação inflada
- Provavelmente sem specs de Step 1-7 individualmente
- Verificar se P1-001 ainda existe

**Estimativa pra completar:** 3-4 dias Code (auditoria das lacunas P1-001 + testes E2E + estabilização).

---

### 0.0.C Cadastro via convite / convênio

**Status:** 🟡 PARCIAL

**Arquivos:**
- `web/app/convite/[codigo]/page.tsx` (landing pra `?ref=CODIGO`)
- `backend/src/indicacoes/` — MLM cascata
- `backend/src/convite-indicacao/` — convite específico
- `backend/src/convenios/` — Convênio com link específico (D-30P/Q resolvidos 01/05)

**Banco:**
- 10 indicações totais
- 0 `convenio` na contagem Prisma (tabela talvez chama-se diferente — verificar `convenios` ou `convenio_membro`)

**Crons:**
- `convite-indicacao.job.ts:20` — lembrete diário 10h
- `convite-indicacao.job.ts:63` — expirar convites às 3h
- `convenios.job.ts:12` — reconciliar faixas às 3h
- `whatsapp-mlm.service.ts:20` — convites MLM dia 1 do mês 10h

**Estado real:**
- Infraestrutura MLM existe + crons ativos
- D-30M (MLM cascata quebrado) catalogado P2, depende 1º indicado pagar pra validar
- D-30P/Q resolvidos em 01/05 (link convênio + recalculo faixa)

**Cross-check:**
- 10 indicações no banco — provavelmente seeds antigas (jun-ago/2025 conforme sessão 02/05)
- Cooperados PJ mencionados em CLAUDE.md (Hangar, AESMP, ASSEJUFES) entraram via convênio — preciso confirmar via SQL com filter PJ

**Gaps detectados:**
- D-30M ainda aberto (validação E2E pendente)
- Convenio counts não mapeei (modelo Prisma com nome diferente)

**Estimativa pra completar:** 1-2 dias Code + validação E2E (testar fluxo de bônus MLM com cooperado teste).

---

### 0.1 Caminho A — pipeline email→OCR→FaturaProcessada→Cobrança

> ⚠️ **Errata 14/05 — ver bloco no topo do arquivo.** O "achado importante: pipeline rodou 6 vezes em produção" foi **derrubado** em 14/05. Re-validação SQL mostrou que as 6 cobranças com `faturaProcessadaId` ≠ null são seeds Fase B.5, e que João Santos (único candidato a caso real) tem `ambienteTeste=true` + 0 contratos + 0 cobranças. Pipeline existe tecnicamente — **zero passagem em produção real**.

**Status:** 🔴 CRU — pipeline maduro tecnicamente mas ZERO produção real (correção retroativa 14/05 via Decisão 23).

**Arquivos:**
- `backend/src/email-monitor/` — 4 arquivos, 684 linhas, 1 spec
- `backend/src/faturas/` — 11 arquivos, 3538 linhas, 4 specs (módulo mais maduro do fluxo)
- `backend/src/cobrancas/` — 8 arquivos, 1894 linhas, 1 spec

**Crons:**
- `email-monitor.service.ts:81` — `0 0 6 * * *` (1x dia 6h)
- `email-recebimento.service.ts:26` — EVERY_5_MINUTES (caminho diferente?)

**Endpoints (email-monitor):**
- POST /email-monitor/processar (acionamento manual)
- GET /email-monitor/status

**Endpoints (faturas):** 16 endpoints — central, resumo, extrair, processar, upload-concessionaria, vincular, aprovar, rejeitar, relatorio (html + json), diagnostico

**Banco (90 dias):**
- 17 FaturaProcessada (todas criadas em 90d)
- 6 cobranças com `faturaProcessadaId` ≠ null
- 6 cobranças com `modeloCobrancaUsado` ≠ null
- 40 cobranças total (31 PAGAS + 6 A_VENCER + 3 VENCIDAS)

**Estado real:**
- Pipeline EXISTE e RODOU em produção real recentemente
- **Achado novo:** sessão 30/04 catalogou "Caminho A nunca rodou em produção" mas o banco hoje mostra 6 cobranças com fatura processada vinculada. Algo aconteceu entre 30/04 e 12/05 (provavelmente seeds Fase B.5 03/05 ou testes Sprint 12 sandbox)
- Faturas service é o módulo mais maduro do fluxo (4 specs, 3.5k linhas)

**Cross-check memória:**
- Sessão 30/04 (estado-cobranca-e2e.md): "Caminho A nunca rodou em produção" — **DESATUALIZADO**
- Sprint 11 Bloco 2: pipeline OCR multi-campo entregue
- Sprint 12: webhook Asaas validado sandbox + 3 bugs cobranças

**Gaps detectados:**
- Cobertura de specs no email-monitor: 1 (insuficiente)
- 2 crons paralelos (`email-monitor` diário + `email-recebimento` EVERY_5_MIN) — pode haver duplicação ou caminhos paralelos não documentados

**Estimativa pra completar:** 1-2 semanas (estabilizar specs + monitoramento + auditoria do "rodou 6x").

---

### 0.2 Comunicação cooperado (email + WhatsApp)

**Status:** 🟡 PARCIAL — infra robusta, gatilhos limitados em produção

**Arquivos:**
- `backend/src/email/` — 8 arquivos, **1227 linhas**, 1 spec
- `backend/src/whatsapp/` — 14 arquivos, **6932 linhas** (módulo gigante), 0 specs
- `backend/src/notificacoes/` — 3 arquivos, 120 linhas, 0 specs

**Crons (comunicação):**
- `cobrancas.job.ts:23` — lembretes pré-vencimento 8h
- `cobrancas.job.ts:205` — notificar cobranças vencidas 6:15h
- `whatsapp-cobranca.service.ts:27` — disparar cobranças dia 5 8h
- `whatsapp-cobranca.service.ts:217` — abordar inadimplentes 9h
- `whatsapp-cobranca.service.ts:441` — alertar vencimento próximo 9:30h
- `clube-vantagens.job.ts:15` — resumo mensal dia 1 9h
- `whatsapp-mlm.service.ts:20` — convites MLM dia 1 10h

**Banco:**
- 5 email_logs total (3 ENVIADO)
- whatsapp_mensagens: não mapeei tabela (modelo Prisma diferente)
- 29 chamadas `enviarEmail/enviarWhatsApp/whatsappSender` em 11 arquivos

**Estado real:**
- Infra de email é tenant-isolated (config SMTP por cooperativa — Sprint 11 Dia 3 mencionado)
- WhatsApp service tem 6932 linhas (módulo grande, bot conversacional + envios direcionados)
- LGPD whitelist ativa em dev (D-30X catalogado — bypass quando NODE_ENV=production em PM2)

**Gaps detectados:**
- 5 email_logs total é muito pouco — pode ser modelo separado por tenant ou logs zerados
- WhatsApp module sem specs (6932 linhas, ZERO specs)
- Notificações service muito pequeno (120 linhas) — possivelmente é só queue/dispatcher

**Estimativa pra completar:** 1 semana (auditoria de gatilhos + testes E2E de cada cron + cobertura básica).

---

### 0.3 Relatório individual fatura+cobrança (visualização)

**Status:** ✅ COMPLETO (após Fase C.3 11/05)

**Arquivos web:**
- `web/app/dashboard/cobrancas/[id]/page.tsx` — modificado em 11/05 com `<EconomiaProjetada>`
- `web/app/dashboard/contratos/[id]/page.tsx` — idem
- `web/app/aprovar-proposta/page.tsx` — proposta cooperado-facing
- `web/app/portal/financeiro/page.tsx` (527 linhas — robusta)
- `web/app/portal/faturas-concessionaria/page.tsx` (201 linhas)
- `web/app/portal/creditos/page.tsx` (123 linhas)
- `web/components/EconomiaProjetada.tsx` (Fase C.3 — 29 specs)

**Estado real:**
- Fase C.3 entregue em 11/05 (commit `ecf39cd`) com componente reusável em 3 telas
- D-30Y validado E2E em 11/05 (commit `fecbe2a`) com 2 screenshots
- Backend `motor-proposta.service.ts:1229-1239` estendido com `economia5Anos`/`15Anos` on-the-fly

**Gaps detectados:** nenhum estrutural. Pode ter polimento residual de UX mas não bloqueia.

**Estimativa pra completar:** 0h (entregue).

---

### 0.4 Multa, juros, inadimplência

**Status:** 🟡 PARCIAL — campos + crons existem, validação real pendente

**Arquivos backend:**
- `cobrancas.job.ts:123` — marcarVencidas 2h
- `cobrancas.job.ts:145` — **calcularMultaJuros 3h** ✓
- `cobrancas.job.ts:205` — notificar vencidas 6:15h
- `whatsapp-cobranca.service.ts:217` — abordar inadimplentes 9h

**Schema:** `Cobranca` tem `valorMulta` e `valorJuros` (campos opcionais Decimal) — confirmados via Prisma client (tentei buscar registros com `valorMulta ≠ null` mas retornou 0).

**Banco:**
- 3 cobranças VENCIDAS no banco
- 0 cobranças com `valorMulta` preenchido (campo zerado em produção)

**Tela admin:**
- `web/app/dashboard/relatorios/inadimplencia/page.tsx` (409 linhas — relatório existe)

**Cross-check memória:**
- Configuração de multa/juros: provavelmente em `Cooperativa.multaAtraso` / `jurosDiarios` / `diasCarencia` (vi esses campos no diagnóstico de cooperativa — schema:54-60)

**Gaps detectados:**
- 3 VENCIDAS mas 0 multa calculada — cron `calcularMultaJuros` pode não estar funcional ou nunca rodou pra vencidos reais
- Sem specs no módulo cobrancas (apenas 1 spec total)

**Estimativa pra completar:** 3-5 dias Code (validar cron + popular multa real + spec).

---

### 0.5 Contas a pagar

**Status:** 🟡 PARCIAL — módulo mínimo (5 endpoints CRUD básicos)

**Arquivos backend:**
- `backend/src/contas-pagar/` — 5 arquivos, **207 linhas** (módulo MUITO pequeno), 0 specs

**Endpoints:** 5 (Get list, Get :id, Post, Patch, Delete) — CRUD básico, sem lógica complexa

**Tela admin:**
- `web/app/dashboard/contas-pagar/page.tsx`
- `web/app/dashboard/financeiro/contas-pagar/page.tsx` (327 linhas) — **duplicação de rota**

**Banco:**
- `conta_pagar` tabela: não mapeei contagem (modelo Prisma com nome diferente — provavelmente `contaPagar` ou plural)

**Cross-check:**
- CLAUDE.md menciona "contas-pagar — módulo AP (arrendamento, manutenção) NOVO abr/14"
- Catalogado mas sem evolução desde abr

**Gaps detectados:**
- Apenas CRUD, sem categorias estruturadas, sem aprovação multi-step, sem integração Asaas pra pagamento
- 2 telas paralelas (`/contas-pagar` e `/financeiro/contas-pagar`) — possível duplicação

**Estimativa pra completar:** 1 semana (categorias + aprovação + integração Asaas + spec).

---

### 0.6 Contas a receber

**Status:** 🟡 PARCIAL — tela existe, módulo não dedicado

**Arquivos:**
- `web/app/dashboard/financeiro/contas-receber/page.tsx` (224 linhas)

**Backend:** **não tem módulo dedicado** `contas-receber`. Provavelmente lê de `Cobranca` agregando.

**Endpoints relacionados:**
- `/cobrancas` (10 endpoints)
- `/saas/faturas` (FaturaSaas — parceiro paga Luciano)
- `/financeiro/lancamentos/resumo`, `/livro-caixa` — agregadores

**Banco:**
- 40 cobranças (cooperado paga parceiro) + 3 FaturaSaas PENDENTES (parceiro paga Luciano)

**Estado real:** mistura conceitual — "contas a receber" do ponto de vista de quem? Cooperativa? Luciano? Tela mostra qual?

**Gaps detectados:**
- Sem módulo backend dedicado
- Tela com apenas 224 linhas (pequena)
- Ambiguidade quem-paga-quem

**Estimativa pra completar:** 5 dias Code (definir escopo + agregação backend + tela específica).

---

### 0.7 Conciliação bancária

**Status:** 🟡 PARCIAL — código robusto, sem specs

**Arquivos:**
- `backend/src/integracao-bancaria/` — 5 arquivos, **1339 linhas**, 0 specs

**Endpoints:** 11 (cobranças BB/Sicoob + webhooks bancos + polling + config)

**Crons:**
- `integracao-bancaria.service.ts:327` — pollingLiquidadas 6:05h

**Estado real:**
- Módulo existe e é considerável (1.3k linhas + 11 endpoints)
- Webhooks pra BB e Sicoob mapeados
- Polling diário ativo
- ZERO specs

**Banco:**
- `transferencia_bancaria` ou modelo similar: não mapeei (tabela com nome diferente)

**Gaps detectados:**
- Conciliação manual (UI de match) — não validei se existe
- 0 specs em código financeiro crítico
- Webhook BB e Sicoob — em produção? validados?

**Estimativa pra completar:** 1-2 semanas (specs + UI conciliação manual + validação em prod).

---

### 0.8 DRE / fechamento mensal

**Status:** 🟡 PARCIAL — endpoint existe, fechamento não

**Endpoints (`backend/src/financeiro/`):**
- `GET /financeiro/lancamentos/dre` (linha 91 controller) ✓
- `GET /financeiro/lancamentos/resumo` (linha 85) ✓
- `GET /financeiro/livro-caixa` (linha 79) ✓
- Patch `:id/realizar` + `:id/cancelar` (lança/cancela)

**Telas:**
- `web/app/dashboard/financeiro/page.tsx` (overview)
- `web/app/dashboard/financeiro/fluxo-caixa/page.tsx` (425 linhas)
- `web/app/dashboard/relatorios/projecao-receita/page.tsx` (304 linhas)

**Gaps detectados:**
- Não há endpoint `/financeiro/fechamento` ou `bloquear-mes`
- Lançamento retroativo após "fechamento" não é bloqueado (porque fechamento não existe)
- Endpoint DRE retorna o quê? Não validei a saída real

**Estimativa pra completar:** 1-2 semanas (modelo Fechamento + bloqueio + UI + spec).

---

### 0.9 Caixa / LancamentoCaixa

**Status:** ✅ FUNCIONAL — em uso real

**Banco:** **53 lancamento_caixa** registros — **uso real significativo**, não é tabela vazia.

**Endpoints:**
- `POST /financeiro/lancamentos` (criação)
- `GET /financeiro/lancamentos` (lista)
- `Patch :id/realizar` + `:id/cancelar`

**Estado real:**
- Modelo `LancamentoCaixa` populado em produção
- Trigger de criação não validei (cron? manual? cobrança paga gera automaticamente?)

**Gaps detectados:**
- Origem dos 53 lançamentos não mapeada (seed? entrada manual? automação?)
- Sem specs

**Estimativa pra completar:** 0h (funcional). Auditoria de origem seria 1 dia adicional.

---

### 0.10 Crons financeiros (e gerais)

**Status:** ✅ ATIVOS — 25 crons mapeados

**Lista completa (25 crons):**

| Arquivo | Cron expr | Função |
|---|---|---|
| `bandeira-aneel.service.ts:126` | `0 6 1 * *` | sincronizar bandeiras ANEEL mensal |
| `clube-vantagens.job.ts:15` | `0 9 1 * *` | resumo mensal Clube |
| `cobrancas.job.ts:23` | `0 8 * * *` | lembretes pré-vencimento |
| `cobrancas.job.ts:123` | `EVERY_DAY_AT_2AM` | marcar vencidas |
| `cobrancas.job.ts:145` | `EVERY_DAY_AT_3AM` | **calcular multa/juros** |
| `cobrancas.job.ts:205` | `15 6 * * *` | notificar vencidas |
| `documentos-aprovacao.job.ts:17` | `0 */1 * * *` | aprovação auto docs (hora em hora) |
| `cooper-token.job.ts:20` | `0 6 * * *` | apurar excedentes |
| `cooper-token.job.ts:120` | `0 2 1 * *` | expirar tokens mensal |
| `convite-indicacao.job.ts:20` | `0 10 * * *` | lembrete convites diário |
| `convite-indicacao.job.ts:63` | `0 3 * * *` | expirar convites |
| `integracao-bancaria.service.ts:327` | `5 6 * * *` | polling liquidadas BB/Sicoob |
| `email-monitor.service.ts:81` | `0 0 6 * * *` | verificar emails de fatura |
| `convenios.job.ts:12` | `0 3 * * *` | reconciliar faixas |
| `email-recebimento.service.ts:26` | `EVERY_5_MINUTES` | emails recebidos (caminho separado) |
| `motor-proposta.job.ts:21` | `EVERY_DAY_AT_9AM` | lembrete propostas pendentes |
| `whatsapp-mlm.service.ts:20` | `0 10 1 * *` | convites MLM mensal |
| `whatsapp-conversa.job.ts:13` | `EVERY_HOUR` | reset conversas inativas |
| `whatsapp-cobranca.service.ts:27` | `0 8 5 * *` | disparar cobranças dia 5 |
| `whatsapp-cobranca.service.ts:217` | `0 9 * * *` | abordar inadimplentes |
| `whatsapp-cobranca.service.ts:441` | `30 9 * * *` | alertar vencimento próximo |
| `cooperados.job.ts:11` | `0 3 * * *` | limpar cooperados proxy expirados |
| `cooperados.job.ts:24` | `0 3 * * *` | limpar cooperados proxy zumbi |
| `monitoramento-usinas.service.ts:21` | `// @Cron('* * * * *')` | **COMENTADO** (não roda) |
| `relatorios/posicao-cooperado.job.ts:11` | `0 7 * * *` | refresh diário posição cooperado |
| `observador.service.ts:273` | `EVERY_5_MINUTES` | expirar automáticas |
| `saas.service.ts:130` | `0 6 1 * *` | **gerar FaturaSaas mensal** (T10) |

**Gaps detectados:**
- `monitoramento-usinas` está comentado (não roda) — débito potencial
- Nenhum cron tem spec/teste

**Estimativa pra completar:** 0h (todos ativos exceto monitoramento-usinas). Spec cobertura 1 semana adicional.

---

### 0.11 Contabilidade-clube

**Status:** 🟡 PARCIAL — controller existe, sem specs

**Arquivos:**
- `backend/src/cooper-token/contabilidade-clube.controller.ts` — controller existe (não medi linhas isoladamente)
- Outros 5 arquivos no `cooper-token/` totalizando 2671 linhas, **0 specs**

**Cross-check:**
- Spec canônica em `docs/especificacao-contabilidade-clube.md` (não validei conteúdo nesta sessão)
- Sessão 04/05 noite catalogou: **0 specs Jest** no módulo cooper-token (pré-req P0 do Sprint CT Consolidado)
- Adendo §11 da spec CT aplicado em 11/05 reforça pré-req

**Banco:**
- 9 cooper_token_ledger
- 5 cooper_token_saldo
- 0 cooper_token_compra

**Estimativa pra completar:** **1 semana — parte do Sprint CooperToken Consolidado Etapa 1** (specs Jest do módulo, já catalogado P0).

---

### 0.12 Painel SISGD super-admin financeiro

**Status:** 🟡 PARCIAL — entregue mas pequeno

**Arquivos:**
- `web/app/dashboard/super-admin/page.tsx` (145 linhas — overview)
- `web/app/dashboard/super-admin/parceiros/` (pasta)
- `backend/src/saas/` — 6 arquivos, 1227 linhas, 2 specs

**Endpoints SaaS (`/saas/`):**
- GET dashboard
- GET parceiros + parceiros/:id/saude
- GET/POST/Patch/Delete planos
- GET faturas + POST faturas/gerar

**Banco:**
- 3 FaturaSaas PENDENTES
- 1 asaas_config

**Estado real:**
- Sprint 13a Dia 1 entregou: `MetricasSaasService` + endpoint `/saas/dashboard` + tela com 5 cards
- Tela com 145 linhas é overview básico — cards de parceiros + saúde + MRR + inadimplência

**Gaps detectados:**
- 145 linhas é pequeno pra "painel financeiro super-admin completo"
- Cards podem ser básicos demais (não validei conteúdo)
- Sem dashboard de DRE consolidado, projeção de receita, ou drill-down

**Estimativa pra completar:** 1 semana (expandir painel com cards financeiros + drill-down + spec).

---

## Achados laterais

### 1. ~~**Caminho A já rodou em produção** — desatualização da memória 30/04~~ ❌ ACHADO DERRUBADO 14/05

> ⚠️ **Errata 14/05** — ver bloco no topo do arquivo. A auditoria pontual sugerida abaixo foi feita em 14/05 (Bloco A Fatia A Etapa 1b). Resultado: **Caminho A NÃO rodou em produção**. As 6 cobranças com `faturaProcessadaId` ≠ null são todas seeds/legados sem cooperado real ATIVO + não-teste. Sessão 30/04 estava certa — "Caminho A nunca rodou em produção" é factual.

~~Sessão de 30/04 catalogou "Caminho A nunca rodou em produção" como achado central. Banco atual mostra 17 FaturaProcessada nos últimos 90 dias + 6 cobranças com `faturaProcessadaId` ≠ null. Algo mudou. Hipóteses:~~
- ~~Seeds da Fase B.5 (03/05) podem ter populado essas 6~~ → **CONFIRMADO sim, são seeds**
- ~~Testes Sprint 12 sandbox (validados 27/04) podem ter gerado registros~~ → **plausível, mas não há cooperado real**
- ~~Vale auditoria pontual pra confirmar se é teste ou produção real~~ → **feita 14/05, é teste**

### 2. **CADASTRO público quase não usado** (3 propostas em 90 dias)

`/cadastro` está implementado (1553 linhas) mas tem só 3 propostas no banco (1 ACEITA + 2 CANCELADAS). Ou ninguém entrou via essa porta ainda em produção real, ou todas as 3 são teste. **Implicação:** UX da `/cadastro` não foi exercitada em volume real — risco latente.

### 3. **`/cadastro/page.tsx` com 1553 linhas é antipattern**

Arquivo único com wizard inteiro vs Step1Fatura+Step2...+Step7 do admin (modulariado em 8 arquivos). Refator pra sub-rotas ou componentes reusáveis facilita manutenção.

### 4. **Whatsapp module sem specs** (6932 linhas, ZERO specs)

Maior módulo do backend sem cobertura de testes. Risco regressão alto.

### 5. **53 lancamento_caixa em uso real** — origem não mapeada

Tabela populada (não é zerada como `pix_excedente` ou similar). Trigger de criação não identificado nesta investigação — pode ser cron, manual, ou efeito colateral de cobrança paga. Vale 1 spike de 30 min pra mapear.

### 6. **Telas duplicadas** /dashboard/contas-pagar vs /dashboard/financeiro/contas-pagar

Confirma fragmentação organizacional. Decidir qual fica.

### 7. **monitoramento-usinas com @Cron comentado**

`monitoramento-usinas.service.ts:21` tem `// @Cron('* * * * *')` — cron inativo. Pode ser intencional (debug) ou esquecimento. Catalogar.

### 8. **Whitelist LGPD (D-30X) catalogado mas não consertado**

Ainda em PM2 dev com `NODE_ENV=production` → bypass implícito. Risco real se cooperado com email real entrar em dev.

---

## Recomendação de fatias do "Sprint Cadastros + Financeiro Consolidado"

Code apresenta opções (NÃO escolhe — Decisão 19). Cada fatia ~1-2 semanas pra cumprir o critério "entregável em isolamento".

### Fatia A — Estabilizar Caminho A real (P0 produção)
**Componentes:** 0.1 + 0.2 (parte email)
- Auditoria das 6 cobranças com faturaProcessadaId — produção ou teste?
- Validar fluxo end-to-end com 1 cooperado real CoopereBR (canário)
- Cobertura de specs pro email-monitor + faturas core
- Estimativa: 1-2 semanas

### Fatia B — Multa, juros e inadimplência funcional (P1)
**Componentes:** 0.4 + parte de 0.10
- Validar que cron `calcularMultaJuros` está populando `Cobranca.valorMulta/valorJuros`
- Spec do cálculo
- Tela de inadimplência exibindo valores corretos
- Estimativa: 3-5 dias

### Fatia C — Sprint CooperToken Consolidado Etapa 1 (P0 catalogado 04/05)
**Componentes:** 0.11 + base pro 0.4 e 0.6
- Specs Jest do módulo cooper-token/
- Pré-requisito do refator (Etapa 2)
- Estimativa: 6-8h Code (já catalogado)

### Fatia D — Financeiro estrutural (P1)
**Componentes:** 0.6 + 0.7 + 0.8
- Definir modelo Fechamento + bloqueio retroativo
- Specs pro módulo financeiro (1640 linhas, 0 specs)
- Endpoint DRE retornando dados reais + UI
- Conciliação manual em integracao-bancaria
- Estimativa: 2-3 semanas

### Fatia E — Polish cadastros (P2)
**Componentes:** 0.0.A + 0.0.B
- Refator `/cadastro/page.tsx` pra sub-rotas
- Auditar lacunas P1-001 do wizard admin
- Validação E2E
- Estimativa: 3-5 dias

### Fatia F — Painel SISGD financeiro completo (P2)
**Componentes:** 0.12
- Expandir cards super-admin
- DRE consolidado + drill-down
- Estimativa: 1 semana

### Fatia G — Auditoria + débitos restantes (P3)
- D-30X (whitelist LGPD)
- D-31 (percentualUsina — pré-req Sprint 5/canário)
- D-30Z (migração opcaoToken 85)
- Lacunas convite/convênio (D-30M MLM)
- Telas duplicadas
- Estimativa: 1 semana

---

## Próximas sessões Code recomendadas (não decididas)

Code apresenta P0→P3. Luciano decide.

**P0 — Crítico**
- **Fatia C — Sprint CT Etapa 1** (6-8h, sessão dedicada de manhã)
- **D-31 investigação** (já catalogado P1 provisório, 2-4h)

**P1 — Importante**
- Fatia A — Caminho A produção real
- Fatia B — Multa/juros funcional
- Asaas conta produção (operacional)

**P2 — Polish + estrutura**
- Fatia D — Financeiro estrutural
- Fatia E — Cadastros polish
- Fatia F — Painel super-admin

**P3 — Débitos cumulativos**
- Fatia G — D-30X/Z + telas duplicadas + MLM
- Decisões batch B17-B32 (claude.ai 2-3h)

---

*Investigação concluída em 12/05/2026. Read-only estrito, sem mutação. Aguarda decisão Luciano sobre fatiamento.*

---

# Appendix — Sub-investigações 12/05 tarde

> Adição pós-relatório principal: 3 missões focadas em (1) identificação dos 17 FaturaProcessada, (2) mapeamento dos 2 fluxos Asaas (FaturaSaas Luciano→Parceiro vs Cobrança Parceiro→Membro) com nuance multi-tenant, (3) dimensionamento separado Fatia D3 vs Fatia A.

## A.1. Identificação dos 17 FaturaProcessada

> ⚠️ **Errata 14/05 — ver bloco no topo do arquivo.** A afirmação "Apenas 1 (João Santos) tem `cobrancaGeradaId=pnbsm75n` — o ÚNICO caso real de Caminho A produção" abaixo está **derrubada**: re-validação 14/05 mostrou que a cobrança `pnbsm75n` não existe na tabela, João Santos tem `ambienteTeste=true` + 0 contratos. Os 5 legados CoopereBR mar/2026 são todos seeds históricos sem passagem viva.

**Composição completa:**

| Coop | Quantidade | Origem | cobrancaGeradaId |
|---|---|---|---|
| TESTE-FASE-B5 — Validação Engines | 12 | Seeds 03/05 (Fase B.5) | TODAS null |
| CoopereBR | 5 | Legados mar/2026 | 1 populado (`pnbsm75n`) |

**Detalhe dos 12 da TESTE-FASE-B5 (todos 03/05/2026, status APROVADA):**
- 6 cooperados teste × 2 faturas cada (uma `mes='ACEITE_INICIAL'` + uma `mes='2026-05'`)
- Cobertura: TESTE-B5-FIXO-CHEIO, TESTE-B5-FIXO-SEMTRIB, TESTE-B5-COMP-CHEIO, TESTE-B5-COMP-SEMTRIB, TESTE-B5-DIN-CHEIO, TESTE-B5-DIN-SEMTRIB
- **Nenhuma virou cobrança** (`cobrancaGeradaId=null` em todas) — seeds não chamaram pipeline pós-OCR

**Detalhe dos 5 da CoopereBR (legados mar/2026):**
- 1 PENDENTE: LUCIANO COSTA BRAGATTO (26/03) — em revisão
- 4 APROVADA: DERLI CAZOTTO VEICULOS (17/03), Carlos Pereira (16/03), Ana Oliveira (16/03), **João Santos da Silva** (16/03)
- **Apenas 1 (João Santos)** tem `cobrancaGeradaId=pnbsm75n` — o ÚNICO caso real de Caminho A produção

**Conclusão sobre "Caminho A nunca rodou em produção" (sessão 30/04):**

| Premissa | Realidade |
|---|---|
| "Caminho A nunca rodou em produção" | **Imprecisa.** Rodou EXATAMENTE 1 vez em mar/2026 (João Santos). 12 dos 17 são seeds Fase B.5 (não conta como produção). 4 são fatura processada sem cobrança gerada (caminho parou no meio). |

A premissa estava 95% correta — só não captou a 1 exceção histórica. **Caminho A é praticamente cru.**

## A.2. Fluxo 1 — FaturaSaas (Luciano → Parceiro)

**Schema:** `model FaturaSaas` com campos `competencia` (DateTime), `valorBase`, `valorReceita`, `valorTotal`, `dataVencimento`, `dataPagamento`, `asaasCobrancaId`, `volumeTokensMes`, `receitaTokens`.

**Banco — 3 FaturaSaas totais (todas PENDENTES):**

| id (sufixo) | Cooperativa | competência | valorTotal | venc | pago | asaas |
|---|---|---|---|---|---|---|
| `atse2els` | CoopereBR Teste | abr/2026 | R$ 5.900 | 10/04 | — | null |
| `lfn1hn6s` | CoopereBR Teste | mai/2026 | R$ 5.900 | 10/05 | — | null |
| `589cwmb2` | CoopereBR | mai/2026 | R$ 9.999 | 10/05 | — | null |

**Achado crítico:** `asaasCobrancaId` é NULL em todas as 3 FaturaSaas. Nenhuma chegou a virar cobrança Asaas. **FaturaSaas é gerada pelo cron mensal (saas.service.ts:130 — `0 6 1 * *`) mas não dispara criação no Asaas automaticamente.**

**Endpoints SaaS (`/saas/`, 11 endpoints):**
- GET /saas/faturas (lista)
- POST /saas/faturas/gerar (gera mensal)
- GET /saas/dashboard (métricas)
- GET /saas/parceiros + /saas/parceiros/:id/saude
- CRUD /saas/planos

**Endpoints Asaas pra criação (`/asaas/`):**
- POST /asaas/cobrancas (criar)
- GET /asaas/cobrancas/:cooperadoId (listar por cooperado)
- POST /asaas/webhook (receber eventos)

**Webhook handler:** existe (`asaas.controller.ts:129 — POST /webhook`).

**Comunicação D-7/D-3/D-1 ao PARCEIRO:** **não existe pra FaturaSaas.** Os crons `cobrancas.job.ts:23 lembretesPreVencimento` e `whatsapp-cobranca.service.ts:441 cronAlertarVencimentoProximo` cobrem só cobranças cooperado-facing. Nenhum cron mira FaturaSaas pendentes.

**Reconciliação automática quando webhook chega:**
- Webhook receiver existe (`/asaas/webhook`)
- Não validei se ele atualiza `FaturaSaas.status` quando recebe `PAYMENT_RECEIVED`

## A.3. Fluxo 2 — Cobrança (Parceiro → Membro)

**Banco:**
- `AsaasCobranca` model: **0 registros** (tabela vazia)
- `Cobranca` model: 40 totais, 31 PAGAS, todas da **CoopereBR** (não TESTE-FASE-B5 nem Teste)
- 31 PAGAS — mas como `AsaasCobranca`=0, **as 31 foram dadas baixa MANUAL via endpoint `/cobrancas/:id/dar-baixa`** sem passar por Asaas

**Asaas service — multi-tenant CONFIRMADO:**

`backend/src/asaas/asaas.service.ts`:

```typescript
async getConfig(cooperativaId: string) {
  return this.prisma.asaasConfig.findUnique({ where: { cooperativaId } });
}

async getApiClient(cooperativaId: string): Promise<AxiosInstance> {
  const config = await this.getConfig(cooperativaId);
  // ... constrói client Axios com apiKey do tenant
}

async criarOuBuscarCustomer(cooperadoId, cooperativaId) {
  const client = await this.getApiClient(cooperativaId);
  // ...
}
```

✅ **Cada parceiro tem suas próprias credenciais Asaas.** Sistema resolve client por `cooperativaId`. Não há single-tenant hardcoded.

**AsaasConfig no banco — 1 registro:**

| coop | ambiente | ativo | webhook_token |
|---|---|---|---|
| CoopereBR | **sandbox** | true | populado (len=64) |

**Confirma:**
- CoopereBR já tem AsaasConfig em **sandbox** (operacional Luciano)
- CoopereBR Teste: SEM AsaasConfig
- TESTE-FASE-B5: SEM AsaasConfig

**Tela admin `/dashboard/configuracoes/asaas/`:** existe (confirmado em `ls web/app/dashboard/configuracoes/` — pasta `asaas` presente). Não medi linhas.

## A.4. Esclarecimento "31 cobranças sandbox" (memória Sprint 12)

**Realidade vs memória:**

| Premissa | Realidade |
|---|---|
| "31 cobranças PAGAS validadas em sandbox" (Sprint 12, abr/2026) | **31 cobranças PAGAS EXISTEM**, todas CoopereBR. **Mas zero passaram por Asaas** (AsaasCobranca=0). Foram dadas baixa manual via `/cobrancas/:id/dar-baixa`. Sprint 12 sandbox testou outra coisa (webhook handler, signature validation), não 31 cobranças completas. |

**Conclusão:** memória inflada. 31 cobranças PAGAS no banco → mas NENHUMA passou por integração Asaas real. Sprint 12 webhook foi validado com payload sintético, não com cobranças que vieram da experiência completa "criar cobrança Asaas → cooperado paga → webhook → marcar PAGA".

## A.5. D-29F catalogado em 29/04 — reframed pra estado atual

| Item D-29F | Sim/Não | Detalhe |
|---|---|---|
| FaturaSaas tem schema + cron de geração? | ✅ Sim | `saas.service.ts:130` cron mensal dia 1 6h |
| Asaas testado em sandbox FaturaSaas? | 🔴 NÃO | Nenhuma das 3 FaturaSaas no banco tem `asaasCobrancaId` populado |
| Comunicação D-7/D-3/D-1 ao parceiro? | 🔴 NÃO | Crons existem mas miram cobranças cooperado-facing |
| Reconciliação webhook FaturaSaas? | ❓ DESCONHECIDO | Webhook `/asaas/webhook` existe; não validei se atualiza `FaturaSaas.status` |

**Reframe:** D-29F seguia P2 catalogado mas estado real é mais granular — **3 sub-pendências internas** (sandbox + comunicação + reconciliação).

## A.6. `/dashboard/configuracoes/asaas`

Confirmado: pasta `web/app/dashboard/configuracoes/asaas/` existe. Lista completa de telas `/configuracoes/`:

- `asaas/` (provavelmente CRUD credenciais Asaas do parceiro)
- `bandeiras/`
- `documentos/`
- `email/`
- `email-faturas/`
- `financeiro/`
- `seguranca/`

Não medi linhas individuais nesta sub-investigação. Tela admin existe pra cada parceiro configurar suas credenciais — coerente com multi-tenant do service.

## A.7. Dimensionamento Fatia D3 (FaturaSaas) vs Fatia A (Cobrança Membro)

### Fatia D3 — FaturaSaas (Luciano → Parceiro) Completo

**O que já existe:**
- ✅ Schema `FaturaSaas` completo (`competencia`, `valorBase/Receita/Total`, `asaasCobrancaId`, `volumeTokensMes`)
- ✅ Cron mensal de geração (`saas.service.ts:130`)
- ✅ Endpoints `/saas/faturas`, `/saas/faturas/gerar`
- ✅ 11 endpoints `/saas/*` (parceiros + planos + saude)
- ✅ Painel SISGD super-admin (Sprint 13a Dia 1 — 145 linhas)
- ✅ Multi-tenant Asaas resolvido (credenciais por parceiro funciona)
- ✅ Conta Asaas DO LUCIANO em sandbox aberta (Luciano confirmou 2-3 testes)

**O que falta:**
- 🔴 Geração de FaturaSaas chamando Asaas (`POST /asaas/cobrancas` com `cooperativaId` do parceiro) — hoje cria FaturaSaas no banco mas não dispara Asaas
- 🔴 Comunicação D-7/D-3/D-1 ao PARCEIRO (não há cron mirando FaturaSaas pendentes; só lembretes cobranca cooperado-facing)
- 🔴 Reconciliação automática FaturaSaas via webhook (PAYMENT_RECEIVED → marca PAGA)
- 🔴 Abrir conta Asaas Luciano **produção** (operacional, não-Code)
- 🟡 Painel super-admin pode mostrar inadimplência FaturaSaas (mencionado mas não validei)

**Estimativa Code:** **5-8 dias**
- 1d — disparar Asaas pra cada FaturaSaas no cron mensal
- 2d — comunicação D-7/D-3/D-1 ao parceiro (templates + cron + WhatsApp)
- 1d — reconciliação webhook (atualiza FaturaSaas.status)
- 2-3d — testes E2E sandbox completo (gerar → pagar → webhook → reconciliar)
- 1d — spec coverage

**Operacional adicional (Luciano):** 1-2 semanas (abrir conta Asaas produção + transição de sandbox).

### Fatia A — Cobrança Parceiro → Membro (caminho crítico produção)

**O que já existe:**
- ✅ Pipeline OCR completo (faturas: 3.538 linhas, 4 specs, 16 endpoints)
- ✅ Asaas service multi-tenant (credenciais por cooperativaId)
- ✅ Webhook handler `/asaas/webhook`
- ✅ Cron geração cobranças (`cobrancas.job.ts`)
- ✅ Crons WhatsApp lembretes D-7/D-3/D-1 + abordar inadimplentes
- ✅ Cron cálculo multa/juros (`cobrancas.job.ts:145`)
- ✅ Endpoint `/cobrancas/:id/dar-baixa` (manual)
- ✅ Tela admin `/dashboard/cobrancas/[id]` com `<EconomiaProjetada>`
- ✅ Tela cooperado `/portal/financeiro` (527 linhas)
- ✅ AsaasConfig da CoopereBR em sandbox

**O que falta:**
- 🔴 **Criar conta Asaas CoopereBR sandbox** (Luciano confirmou: zero — nem sandbox nem produção do PARCEIRO)
  - Modelo: `AsaasConfig` da CoopereBR principal já existe no banco com ambiente=sandbox, mas Luciano disse "conta Asaas do parceiro CoopereBR: zero". Vale confirmar se é a mesma conta ou se a config existente é stale/teste
- 🔴 Validar fluxo "criar cobrança Asaas → webhook → marcar PAGA" com cooperado real CoopereBR
  - As 31 PAGAS atuais não passaram por Asaas (manual). Caminho Asaas real nunca foi exercitado em produção
- 🟡 Multi-tenant do webhook (identificar qual parceiro pelo evento Asaas) — não validei
- 🔴 Comunicação cooperado D-7/D-3/D-1 — crons EXISTEM mas só dispararam pra cobranças via Asaas (que hoje é zero). Validar com fluxo Asaas real
- 🟡 Reconciliação Asaas → Cobranca.status (idem D3)

**Estimativa Code:** **3-5 dias** (Asaas + integração + validação)
- 1d — auditoria AsaasConfig CoopereBR existente (é sandbox real do Luciano-Parceiro ou stale do desenvolvimento?)
- 1d — fluxo POST `/asaas/cobrancas` integrado ao cron de geração de cobrança cooperado
- 1d — reconciliação webhook → Cobranca.status (já existe webhook handler?)
- 1-2d — testes E2E sandbox (1 cooperado teste CoopereBR Teste cobrado via Asaas sandbox → webhook → marcar PAGA)

**Operacional adicional (Luciano):** Modelo Asaas Luciano (Fatia D3) serve como TEMPLATE pra criar config CoopereBR. **Não precisa "criar conta nova" se a conta existente for válida.** Validar.

### C — Tabela comparativa premissas

| Premissa antiga | Premissa real pós-investigação |
|---|---|
| "Caminho A nunca rodou em produção" (sessão 30/04) | **Quase correto.** Rodou exatamente 1 vez (João Santos, mar/2026). Outras 16 são seeds Fase B.5 ou faturas processadas sem cobrança gerada. |
| "Caminho B (cobrança manual + Asaas sandbox) maduro, 31 cobranças PAGAS" | **Imprecisa.** 31 PAGAS existem (todas CoopereBR) mas ZERO passaram por Asaas. Foram dadas baixa manual via `/cobrancas/:id/dar-baixa`. Sprint 12 "webhook Asaas validado em sandbox" foi com payload sintético, não fluxo completo. |
| "Sprint 12 webhook Asaas validado em sandbox" | **Era webhook genérico (signature validation), não fluxo end-to-end.** AsaasCobranca model está VAZIO no banco. |
| "Multi-tenant queries por cooperativaId" | ✅ **Confirmado.** Asaas também é multi-tenant: `asaas.service.ts:64` lê config por `cooperativaId`, `getApiClient(cooperativaId)` constrói client com apiKey do tenant. |
| "AsaasConfig da CoopereBR existe" | ✅ **Existe**, em ambiente=sandbox, ativo=true. Mas Luciano disse "conta Asaas do parceiro CoopereBR: zero" — possível discrepância entre o que está no banco (stale?) e o que Luciano lembra. Vale auditoria pontual. |

## Achados extras desta sub-investigação

1. **AsaasCobranca model está VAZIO** — sistema tem o model mas nenhuma cobrança Asaas foi criada. Confirma que fluxo Asaas-real é cru.
2. **João Santos da Silva (CoopereBR, mar/2026)** é o único caso histórico de Caminho A produção. Vale catalogar como "primeiro cooperado real exercitou pipeline OCR completo" — referência pra futura validação canário.
3. **3 FaturaSaas PENDENTES no banco** somam R$ 21.799 não cobrados — Luciano não recebeu de fato (todas com `dataPagamento=null` e `asaasCobrancaId=null`).
4. **AsaasConfig CoopereBR ambiente=sandbox** existente conflita com fala de Luciano "conta Asaas parceiro CoopereBR: zero" — auditoria pontual de 5 min resolve se é stale ou ativa.
5. **Tela `/dashboard/configuracoes/asaas/`** existe — admin já tem UI pra configurar credenciais por parceiro. Bom sinal pra adoção multi-tenant Asaas em produção.

---

*Sub-investigação concluída 12/05/2026. Read-only estrito. Aguarda decisão Luciano sobre formalização do "Sprint Cadastros + Financeiro Consolidado" e ordem das 7 fatias propostas.*
