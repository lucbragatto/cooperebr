# Plano de execução — Curadoria sprint a sprint (Opção 2)

> **Modo:** plano em texto. Code NÃO executa reconciliação aqui.
> **Insumo:** mapeamento de numeração de sprints (commit `1be9b34`,
> `docs/sessoes/2026-05-01-mapeamento-numeracao-sprints.md`).
> **Insumo direto pra:** claude.ai montar prompts de decisão caso a caso pro Luciano.
> **Aplica regra de validação prévia + retomada** (memória `regra_validacao_previa_e_retomada.md`).

---

## Objetivo

Reconciliar **numeração antiga** (Sprints 1-26 com sub-sprints) com **numeração nova**
(Sprints 0-9, criada em 30/04 noite) **preservando** trabalho concluído (15 sprints com
133 commits git) e **endereçando** órfãos (6 temas da antiga sem equivalente na nova).

Resultado esperado: **uma única pilha reconciliada**, sem conflitos, com mapeamento
explícito antigo → novo, e zero órfãos.

---

## Fase 1 — Dados que precisam estar disponíveis pra Luciano decidir

### 1.1 — Sprints JÁ CONCLUÍDOS (15 — somente confirmar pra histórico)

Apresentar como **lista corrida** (não 1 prompt por sprint — Luciano só confirma):

| Sprint antigo | Quando concluído | Commits-chave | Tema |
|---|---|---|---|
| 1 | mar/2026 | `779631c` | Bootstrap inicial |
| 2 | mar/2026 | `3acb013` | Tickets T0-T2 |
| 2.5 | mar/2026 | `4ff48d2` | T3 |
| 3 | mar/2026 | `0b00d49` | T4-PRE + T4 |
| 5 | abr/2026 | `9174461` (congelamento) + 8 commits T1-T8 | Engine de cobrança refatorada (snapshots, MUC fix, anti-duplicação) |
| 6 | abr/2026 | `b5db585` (fechamento) + `fd35c0d` (cron FaturaSaas T10) | Tickets 6-11 |
| 7 | abr/2026 | `f1487d3` (fechamento) + `0c435cf`, `b0b231b`, `11a6390` | Gateway multi-tenant Asaas (Etapas 1-5) |
| 8a | abr/2026 | `8adf91b`, `7c2bbca`, `cb7b41b` | CooperToken modoRemuneracao + saldo |
| 8b | abr/2026 | `0cc28a7` (fechamento) + `7d34111`, `ec35e06`, `487e940` | CooperToken webhook + ativação tokens + WA/email |
| 9 | abr/2026 | `244819f`, `5d3bd82`, `f6caeee` | Contabilidade Clube + efeitoMudancaFaixa + E2E sandbox |
| 9b | abr/2026 | `22fe6b1`, `dc33c2e`, `2c5c742`, `f9f23a7` | Convenios + tokens + ofertas exclusivas |
| 10 | abr/2026 | `c075f05` (fechamento) + `c4f6ebf` (CADASTRO_V2) + `0b9a6ec` (lembretes 24h) | LGPD + CADASTRO_V2 + lembretes |
| 11 | abr/2026 | `ef59162` (Bloco 2 fechado) + `f36496f`, `559a87d`, `4619bf9` | Arquitetura UC consolidada (3 campos + distribuidora enum) |
| 12 | 27/04/2026 | `4d20086`, `16302e9` | Webhook Asaas sandbox + 3 bugs P1 corrigidos |
| 13a | 28/04/2026 | `7f29bd6` (D1) + `8c2f678` (D2) + `1569ca8` (D3 IDOR fix) | Painel SISGD super-admin + lista parceiros + cards saúde + IDOR fix |

**Pergunta a Luciano:** *"Confirma que esses 15 são histórico imutável? Sim/Não."*

**Se Sim** (esperado): apenas registrar na nova pilha como "Sprints históricos preservados".
**Se Não:** caso a caso — improvável.

### 1.2 — Sprints NÃO CONCLUÍDOS (15 antigos pendentes + 10 novos = 25 a decidir)

Para cada um, apresentar:

```
SPRINT A SER DECIDIDO: <ID antigo ou novo> — <Tema>

Estado: NÃO concluído
Documentado em: <arquivos>
Escopo: <descrição em 2-3 linhas>
Dependências: <depende de quais; bloqueia quais>
Estimativa: <tempo>
Severidade: <P0/P1/P2>

Já tem absorção parcial proposta?
- <Antigo> → <Novo> (se houver mapeamento em PLANO-ATE-PRODUCAO.md)

Opções:
(A) Manter como Sprint <X> na pilha reconciliada
(B) Fundir com Sprint <Y>
(C) Descartar — motivo: ___
(D) Adiar — motivo: ___

Recomendação Code: <opção + porquê>

Sua escolha?
```

### 1.3 — Lista completa dos 25 sprints a decidir

#### Pendências antigas (15) — agrupadas por tipo de decisão

**Já têm absorção proposta no PLANO-ATE-PRODUCAO.md** (8 — apenas confirmar):

| Antigo | Tema | Absorção proposta | Recomendação Code |
|---|---|---|---|
| 13b | AuditLog ativo + Impersonate | Sprint 5 + Sprint 6 novos | Confirmar |
| 13c | Edição plano SaaS + suspensão parceiro | Sprint 7 novo | Confirmar |
| 14 | Cron FaturaSaas pré-produção | Sprint 1 novo | Confirmar |
| 17 | Engine COMPENSADOS | Sprint 2 novo | Confirmar |
| 18 | Engine DINAMICO | Sprint 2 novo | Confirmar |
| 19 | DRE por parceiro | Sprint 7 novo | Confirmar |
| 20 | Conciliação CNAB | Sprint 7 novo | Confirmar |
| 22 | Audit Trail global | Sprint 6 novo | Confirmar |

**Sem absorção clara — ÓRFÃOS** (6 — Luciano decide caso a caso):

| Antigo | Tema | Recomendação Code |
|---|---|---|
| 15 | Cadastro Condomínio atomizado | Manter como Sprint novo (24+) |
| 16 | Painel Agregador (Hangar/Moradas) | Manter como Sprint novo (25+) |
| 21 | Painel Síndico detalhado | Manter como Sprint novo (26+) |
| 24 | Login facial | Avaliar — pode ser P3, adiável |
| 25 | Suite E2E Playwright | Manter — qualidade pré-produção |
| 26 | Pré-produção (load test + runbook) | Manter — última etapa antes de go-live |

**Absorção parcial — confirmar com cuidado** (1):

| Antigo | Tema | Absorção proposta | Recomendação Code |
|---|---|---|---|
| 23 | Templates por parceiro | Sprint 3 novo (Assinafy templates) | Confirmar — escopo pode crescer |

#### Pendências novas (10 — confirmar/renumerar)

| Novo | Tema | Recomendação Code |
|---|---|---|
| 0 | Auditoria Regulatória Emergencial | Manter como Sprint 14 (renumerado) |
| 1 | FaturaSaas Completo | Manter como Sprint 15 |
| 2 | OCR-Integração + DINAMICO atômico | Manter como Sprint 16 |
| 3 | Banco de Documentos Assinafy | Manter como Sprint 17 |
| 4 | Portal Proprietário ContratoUso | Manter como Sprint 18 |
| 5 | Módulo Regulatório ANEEL | Manter como Sprint 19 |
| 6 | Auditoria IDOR Geral | Manter como Sprint 20 |
| 7 | DRE + Conciliação + Fechamento | Manter como Sprint 21 |
| 8 | Política + Engine de Otimização | Manter como Sprint 22 |
| 9 | Motor de Diagnóstico Pré-Venda | Manter como Sprint 23 |

(Renumeração sugerida pela Opção 3 híbrida do mapeamento — Luciano pode rejeitar.)

---

## Fase 2 — Ordem de apresentação

Code recomenda **ordem por bloco lógico**, não numérica. Luciano vê em sequência
coerente, não saltando entre temas:

### Bloco 1 — Confirmações rápidas (15 minutos)
- 1.1 — Lista dos 15 sprints concluídos (1 confirmação geral)
- 1.2 — Lista dos 8 sprints antigos com absorção já proposta (1 confirmação geral OU caso a caso)

### Bloco 2 — Decisões dos 6 órfãos (30 minutos)
Mais delicado — Luciano define escopo e prioridade:
- Sprint 15 (Condomínio)
- Sprint 16 (Agregador)
- Sprint 21 (Síndico)
- Sprint 24 (Login facial)
- Sprint 25 (E2E)
- Sprint 26 (Pré-produção)

### Bloco 3 — Decisão de renumeração (5 minutos)
Aceita numeração nova como Sprints 14-23? Ou outra estratégia?

### Bloco 4 — Decisão de Sprint 23 (Templates por parceiro) (5 minutos)
Confirma absorção pelo Sprint 3 novo (Assinafy)? Ou desmembra?

**Total estimado de tempo de Luciano:** 50-60 minutos.

---

## Fase 3 — Decisões esperadas de Luciano

| # | Decisão | Tipo | Quantas opções |
|---|---|---|---|
| 1 | Confirmar 15 sprints concluídos como histórico | Sim/Não | 2 |
| 2 | Confirmar absorção 13b → Sprint 5+6 novos | Sim/Não | 2 |
| 3 | Confirmar absorção 13c → Sprint 7 novo | Sim/Não | 2 |
| 4 | Confirmar absorção 14 → Sprint 1 novo | Sim/Não | 2 |
| 5 | Confirmar absorção 17 → Sprint 2 novo | Sim/Não | 2 |
| 6 | Confirmar absorção 18 → Sprint 2 novo | Sim/Não | 2 |
| 7 | Confirmar absorção 19 → Sprint 7 novo | Sim/Não | 2 |
| 8 | Confirmar absorção 20 → Sprint 7 novo | Sim/Não | 2 |
| 9 | Confirmar absorção 22 → Sprint 6 novo | Sim/Não | 2 |
| 10 | Confirmar absorção 23 → Sprint 3 novo | Sim/Não/Desmembra | 3 |
| 11 | Sprint 15 (Condomínio): manter/descartar/adiar | A/B/C/D | 4 |
| 12 | Sprint 16 (Agregador): manter/descartar/adiar | A/B/C/D | 4 |
| 13 | Sprint 21 (Síndico): manter/descartar/adiar | A/B/C/D | 4 |
| 14 | Sprint 24 (Login facial): manter/descartar/adiar | A/B/C/D | 4 |
| 15 | Sprint 25 (E2E): manter/descartar/adiar | A/B/C/D | 4 |
| 16 | Sprint 26 (Pré-produção): manter/descartar/adiar | A/B/C/D | 4 |
| 17 | Renumeração: Sprints 0-9 novos viram Sprints 14-23? | Sim/Não/Outro | 3 |
| 18 | Ordem de execução final | livre | — |

**Total: 18 decisões** (6 binárias rápidas + 6 órfãos + outras).

---

## Fase 4 — Como aplicar decisões em arquivos

Após Luciano fechar todas as decisões, **um único prompt pro Code** aplica em batch.

### 4.1 — `docs/PLANO-ATE-PRODUCAO.md`

**Mudanças:**
- Renumerar Sprints 0-9 → Sprints 14-23 (ou outra renumeração decidida).
- Adicionar Sprints 24-29 (ou conforme decisão) cobrindo órfãos.
- Atualizar dependências (cada "Sprint X depende de Y" precisa ser revisado).
- Atualizar diagrama de ordem sugerida.
- Atualizar critérios pra ligar produção real.
- Adicionar seção "Histórico — sprints concluídos" listando os 15 antigos com commits.

### 4.2 — `docs/CONTROLE-EXECUCAO.md`

**Mudanças:**
- Atualizar tabela "Sprints pré-produção" (header + linhas).
- Adicionar Decisão 16 capturando reconciliação.
- Atualizar "PENDÊNCIAS PARA PRÓXIMA SESSÃO" com novos números.
- Atualizar "ESTADO REAL DO PRODUTO".

### 4.3 — `docs/PRODUTO.md` (Apêndice B)

**Mudanças:**
- Atualizar lista de 10 sprints pra refletir nova numeração.

### 4.4 — `docs/REGULATORIO-ANEEL.md` (Seção 14)

**Mudanças:**
- Atualizar Sprints 0/5/8/9 → novos números.

### 4.5 — `docs/sessoes/2026-04-30-decisoes-doc-0-fatia2.md`

**Mudanças:**
- Adicionar nota no topo: *"Numeração reconciliada em 01/05/2026 — sprints originais 0-9 referenciados aqui correspondem a Sprints 14-23 na pilha definitiva. Ver `2026-05-01-plano-curadoria-sprints.md`."*
- **Não reescrever** — manter como histórico da decisão original.

### 4.6 — Memória persistente

**Atualizar:**
- `MEMORY.md` (índice) — atualizar descrição de `project_doc0_fatia2_concluida.md` com nota da renumeração.
- Criar `project_pilha_reconciliada_2026_05_01.md` com pilha definitiva.

### 4.7 — Comentários em código (`backend/src/**/*.ts` + `web/app/**/*.tsx`)

**83 ocorrências em backend + 12 em web.** Mas como **todos** se referem a sprints
ANTIGOS já concluídos (Sprint 5, 6, 7, 9, 11, 12), e **a numeração antiga está
preservada como histórico**, **não precisam ser tocados**.

> **Decisão Code:** comentários históricos em código ficam como estão. Sprint 5
> antigo (engine cobrança) continua sendo referenciado como "Sprint 5" nos
> comentários — já está concluído e essas referências são archeologia válida.

### 4.8 — Sessões anteriores (`docs/sessoes/*.md`)

**60+ arquivos mencionam "Sprint X".** Como são históricos, **não tocar**.
Mesma lógica do código.

### 4.9 — `docs/MAPA-INTEGRIDADE-SISTEMA.md` (linhas 814-836)

**Mudança:** atualizar a seção "Plano consolidado — visão executiva" pra refletir
nova pilha reconciliada. Marcar a lista antiga (Sprints 12-26) como "histórica
— substituída por pilha reconciliada de 01/05/2026".

---

## Fase 5 — Validação final

Após aplicação:

### 5.1 — Checklist de coerência (Code roda):

```bash
# Sprint X tem 1 e apenas 1 significado em pilha definitiva
grep -E "Sprint [0-9]+" docs/PLANO-ATE-PRODUCAO.md docs/CONTROLE-EXECUCAO.md \
  docs/PRODUTO.md docs/REGULATORIO-ANEEL.md | sort -u

# Zero referências a numerações conflitantes
# (Sprints 14+ devem aparecer apenas como significado novo)
```

### 5.2 — Confirmação manual com Luciano

Code apresenta tabela final:

| Sprint | Tema | Severidade | Estimativa | Status |
|---|---|---|---|---|
| 14 | Auditoria Regulatória Emergencial | P0 | 1 sem | NÃO INICIADO |
| 15 | FaturaSaas Completo | P1 | 1-2 sem | NÃO INICIADO |
| ... | ... | ... | ... | ... |
| 29 (último órfão) | Pré-produção | P1 | 2-3 sem | NÃO INICIADO |

Luciano confirma "tudo bate".

### 5.3 — Atualização de memória persistente

Code atualiza `MEMORY.md` e `project_pilha_reconciliada_2026_05_01.md` como
**fonte canônica permanente** da pilha definitiva.

### 5.4 — Commit final

```
docs(curadoria): aplica reconciliacao de numeracao de sprints

Pilha definitiva (16 sprints futuros, Sprints 14-29):
- Sprint 14: <tema confirmado por Luciano>
- ...
- Sprint 29: <tema>

Mapeamento antigo → novo aplicado em PLANO-ATE-PRODUCAO, CONTROLE-EXECUCAO,
PRODUTO, REGULATORIO-ANEEL. Memória persistente atualizada.

Sprints concluídos (1-13a) preservados como historico imutavel — comentarios
em codigo nao tocados (referencias arqueologicas validas).

Insumos: docs/sessoes/2026-05-01-mapeamento-numeracao-sprints.md (1be9b34)
       + docs/sessoes/2026-05-01-plano-curadoria-sprints.md (este)
```

---

## Fase 6 — Estimativa total

| Etapa | Quem | Tempo |
|---|---|---|
| Tempo de claude.ai apresentar tudo a Luciano | claude.ai | 50-60 min |
| Tempo de Luciano decidir 18 itens | Luciano | 30-40 min |
| Tempo de Code aplicar reconciliação em ~6 arquivos | Code | 1-2 h |
| Tempo de Code rodar checklist e validação | Code | 15-20 min |
| **Total cronograma** | — | **3-4 horas** |

**Custo estimado total:** $20-30 (incluindo claude.ai + Code).

**Quantos prompts pro Code:** 1 prompt grande de aplicação + 1 prompt curto de validação = **2 prompts**.

---

## Modelo de prompt esperado pra claude.ai usar (rodada de decisão)

### Modelo 1 — Confirmação rápida em bloco

```
═══════════════════════════════════════════════════════════════════
BLOCO 1 — Confirmação de sprints concluídos (1 decisão)
═══════════════════════════════════════════════════════════════════

15 sprints já concluídos com 133 commits git. Tema histórico:

[lista compacta]

Decisão: confirmo que esses 15 são histórico imutável e ficam preservados?
(A) Sim, preservar todos como histórico
(B) Não, quero revisar caso a caso

Sua escolha?
```

### Modelo 2 — Decisão de órfão (1 prompt por sprint)

```
═══════════════════════════════════════════════════════════════════
BLOCO 2 — Decisão de órfão #X de 6
═══════════════════════════════════════════════════════════════════

SPRINT A SER DECIDIDO: Sprint 15 (numeração antiga) — Cadastro Condomínio atomizado

Estado: NÃO concluído (nunca iniciado)
Documentado em: docs/MAPA-INTEGRIDADE-SISTEMA.md linha 822
                docs/historico/COOPEREBR-ALINHAMENTO-2026-04-23.md (refs)

Escopo planejado: cadastro completo de Condomínio em 1 fluxo (síndico cria
condomínio → adiciona unidades → vincula condôminos → gera cobranças
agregadas). Hoje schema existe (Condominio + UnidadeCondominio = 1+10 registros
de teste) mas fluxo não está pronto.

Dependências: nenhuma técnica.
Bloqueia: Helena (síndica) virar usuária real do sistema.
Estimativa: 5-7 dias de Code.
Severidade: P1 se Luciano quer atender condomínios; P3 se foco é cooperativa pura.

Já tem absorção proposta? NÃO. É órfão da pilha nova.

Opções:
(A) Manter como Sprint 24 (próximo número após Sprints 14-23 da pilha nova renumerada)
(B) Fundir com outro sprint — qual?
(C) Descartar — motivo: ___
(D) Adiar — marcar como pendente sem prazo, fora da pilha pré-produção

Recomendação Code: (A) MANTER como Sprint 24. Justificativa:
- Helena já é persona documentada em PRODUTO.md (papel 8)
- Modelos `Condominio` + `UnidadeCondominio` já no schema (1+10 registros teste)
- Doc-0 Fatia 2 não absorveu este tema — descartá-lo agora seria perda
- Mas pode adiar se foco curto prazo é cooperativa pura

Sua escolha?
```

### Modelo 3 — Decisão de renumeração (1 prompt único)

```
═══════════════════════════════════════════════════════════════════
BLOCO 3 — Renumeração da pilha
═══════════════════════════════════════════════════════════════════

Pilha nova atual usa Sprints 0-9 (criada 30/04 noite). Conflita com
Sprints 5/6/7/8/9 antigos (todos concluídos).

Opções:
(A) Renumerar pilha nova como Sprints 14-23 (continua da antiga). 
    Sprints 14 = Sprint 0 atual, Sprint 15 = Sprint 1 atual, etc.
(B) Manter pilha nova como 0-9 e marcar antigos como "Sprint 5-antigo",
    "Sprint 5-novo" pra desambiguar
(C) Numeração temática (Sprint A1, A2... ou Sprint Reg1, Reg2...)
(D) Outra opção

Recomendação Code: (A). Continuidade git preservada, sem ambiguidade,
mais fácil de explicar.

Sua escolha?
```

---

## Exemplo concreto — 3 sprints reais aplicados ao formato

### Exemplo 1 — Sprint 13b (já tem absorção proposta)

```
═══════════════════════════════════════════════════════════════════
SPRINT A SER DECIDIDO: Sprint 13b (numeração antiga) — AuditLog ativo + Impersonate
═══════════════════════════════════════════════════════════════════

Estado: NÃO concluído (planejado mas não iniciado)
Documentado em: docs/historico/COOPEREBR-ALINHAMENTO-2026-04-23.md
                docs/MAPA-INTEGRIDADE-SISTEMA.md (refs)
                memory/project_sprint13a_concluido_e_proximas_etapas.md

Escopo planejado: ativar interceptor AuditLog (tabela já existe desde Sprint
13a Dia 1, schema OK, 0 registros). Adicionar Impersonate pra SUPER_ADMIN
poder "entrar como" admin parceiro com tudo logado.

Dependências: Sprint 13a (concluído).
Bloqueia: compliance LGPD.
Estimativa: 3-4 dias.
Severidade: P2.

Já tem absorção proposta?
- AuditLog interceptor → Sprint 5 novo (Módulo Regulatório, requer audit) +
  Sprint 6 novo (Auditoria IDOR Geral verifica audit)
- Impersonate → Sprint 7 novo (governança financeira) ou micro-sprint à parte

Opções:
(A) Confirmar absorção proposta (AuditLog em Sprint 5+6, Impersonate em Sprint 7)
(B) Reabrir como Sprint 13b independente
(C) Descartar Impersonate, manter só AuditLog

Recomendação Code: (A). Absorção faz sentido — AuditLog é pré-requisito
regulatório (Sprint 5) e de IDOR (Sprint 6), Impersonate é governança financeira
(Sprint 7). Não há valor em reabrir como sprint independente.

Sua escolha?
```

### Exemplo 2 — Sprint 25 (órfão sem absorção)

```
═══════════════════════════════════════════════════════════════════
SPRINT A SER DECIDIDO: Sprint 25 (numeração antiga) — Suite E2E Playwright
═══════════════════════════════════════════════════════════════════

Estado: NÃO concluído
Documentado em: docs/MAPA-INTEGRIDADE-SISTEMA.md linha 834

Escopo planejado: Suite completa de testes E2E em Playwright cobrindo fluxos
críticos (cadastro público, fluxo cobrança, login, portal cooperado, etc.)
antes de produção.

Dependências: estabilização do sistema (faz sentido após maioria dos sprints).
Bloqueia: confiança em ir pra produção real.
Estimativa: 7-10 dias.
Severidade: P2.

Já tem absorção proposta? NÃO. Pilha nova omite testes E2E completamente.

Opções:
(A) Manter como Sprint X (depois da pilha nova renumerada) — recomendado
(B) Descartar — motivo: ___
(C) Adiar — marcar como pendente sem prazo

Recomendação Code: (A) MANTER. Sistema com 0 specs E2E ir pra produção real
é arriscado. Sprint 13a Dia 3 já provou isso (3 bugs P1 corrigidos
porque caminho manual nunca tinha sido testado). Sprint dedicado a E2E
DEPOIS dos sprints estruturais (não junto) faz sentido.

Sua escolha?
```

### Exemplo 3 — Sprint 0 da pilha nova (renumeração)

```
═══════════════════════════════════════════════════════════════════
SPRINT A SER DECIDIDO: Sprint 0 (pilha nova) — Auditoria Regulatória Emergencial
═══════════════════════════════════════════════════════════════════

Estado: NÃO INICIADO (P0 urgente)
Documentado em: docs/PLANO-ATE-PRODUCAO.md linhas 75-95

Escopo planejado: listar UCs com classe GD declarada × real, concentrações
> 25%, saldos > 2 meses, UCs sem dataProtocoloDistribuidora. Relatório
executivo + plano corretivo (caso Exfishes regulariza, FIGATTA/CRIAR
investigados).

Dependências: nenhuma.
Bloqueia: Sprint 5 (Módulo Regulatório).
Estimativa: 1 semana.
Severidade: P0 urgente.

Renumeração proposta: Sprint 14 (continua Sprint 13a).

Opções:
(A) Renumerar como Sprint 14
(B) Manter Sprint 0 (Sprint zero faz sentido pra "antes de tudo")
(C) Outra numeração — qual?

Recomendação Code: (A). "Sprint 0" só faz sentido como narrativa marketing
("antes de tudo"); na realidade tem dependências e duração igual aos outros.
Sprint 14 dá continuidade git e elimina ambiguidade.

Sua escolha?
```

---

## Considerações finais (transparência)

### Decisões mais delicadas (sinalizadas pra atenção)

1. **Sprint 24 (Login facial) — pode ser P3 e adiável.** Schema atual tem
   `fotoFacialUrl` mas FaceMatch contra documento nunca rodou. Atender SISGD
   sem login facial é viável. Recomendação Code: marcar como "adiar — fora da
   pilha pré-produção".

2. **Sprint 15 (Condomínio) — depende de prioridade do mercado de condomínios.**
   Se Luciano quer foco em cooperativas/consórcios primeiro, condomínio pode
   adiar. Mas Helena (síndica) é persona documentada e Moradas da Enseada é
   caso real.

3. **Sprint 23 (Templates por parceiro) — absorção parcial pelo Sprint 3 (Assinafy).**
   Sprint 3 entrega 5 templates iniciais SISGD + biblioteca por parceiro.
   Mas Sprint 23 antigo era mais amplo (templates de comunicação WA/email,
   relatório, fatura). Pode precisar desmembrar.

4. **Renumeração pode quebrar referências futuras.** Se Luciano comunica o
   plano externamente (consultoria, sócio, futuro investidor), passar de
   "Sprint 0-9" pra "Sprint 14-23" precisa ser comunicado uma vez só.

### Risco de a curadoria virar planejamento novo

Se Luciano usar a curadoria pra repensar escopo de cada sprint (não só nome
e mapeamento), o tempo pode dobrar. **Sugestão Code:** focar curadoria em
**reconciliação** (numeração + status + absorção). Reescopo é outro projeto.

---

*Plano de execução read-only. Conduzido por Claude Code (Opus 4.7) em 2026-05-01.
Aplica regra de validação prévia + retomada (memória `regra_validacao_previa_e_retomada.md`).
NÃO executa reconciliação — apenas planeja.*
