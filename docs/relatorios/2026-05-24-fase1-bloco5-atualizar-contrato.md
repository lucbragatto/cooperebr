# Fase 1 read-only — Sprint Bot Autoatendimento Bloco 5 (Atualizar Contrato)

Data: 2026-05-24
Autor: Code (Fase 1 read-only, Decisão 23)
Status: relatório de investigação — **zero edits, zero builds, zero schema/banco**

---

## TL;DR (linguagem humana)

A boa notícia: handlers hardcoded existem ponta a ponta + etapas no seed
pré-planejaram nomes de ação + `NotificacoesService` reusável + método
`contratosService.update` permite aplicar mudança quando equipe aprovar.

A má notícia: o **hardcoded atual VIOLA exatamente o que a decisão (B)
quer corrigir** — ele altera o contrato DIRETO sem validação humana, e a
"notificação à equipe" é só uma mensagem WhatsApp pra `SUPER_ADMIN_PHONE`
(env var) que não persiste em lugar nenhum. Sem painel pra ver/aprovar.

Não existe `SolicitacaoAlteracaoContrato`, `TipoAlteracaoContrato` nem
nenhum model relacionado. Painel admin pra solicitações também não
existe. 4 modelos de mensagem de banco precisam ser criados (eventos:
criada / aprovada / recusada / aplicada).

5 decisões de produto pra você bater o martelo. Estimativa: **5-7h sem
painel admin** (gerencia via Notificacoes existentes + endpoint REST de
aprovar/recusar). **7-10h com painel admin mínimo**. **+1-2h se bot
pre-validar** capacidade da usina + cobrança em aberto.

---

## 1. Handler hardcoded — funcional MAS viola decisão (B)

### 1.1 Switch case (`whatsapp-bot.service.ts:577-585`)

```typescript
case 'ATUALIZACAO_CONTRATO':         → handleAtualizacaoContrato
case 'AGUARDANDO_NOVO_KWH':          → handleAguardandoNovoKwh
case 'CONFIRMAR_ENCERRAMENTO':       → handleConfirmarEncerramento
```

Entrada: `handleMenuCooperado` linha 834 — gatilho '4' transiciona pra
ATUALIZACAO_CONTRATO + popula dadosTemp com `cooperadoId`.

### 1.2 `handleAtualizacaoContrato` (`whatsapp-bot.service.ts:3848-3921`)

- Busca `Contrato.findFirst` ATIVO do cooperado; sem contrato → erro + volta MENU.
- Opção '1' "aumentar" → AGUARDANDO_NOVO_KWH + `dadosTemp.acao = 'aumentar'`
- Opção '2' "diminuir" → AGUARDANDO_NOVO_KWH + `dadosTemp.acao = 'diminuir'`
- Opção '3' "suspender" → **ALTERA DIRETO** (`status: 'SUSPENSO'`) + notifica `SUPER_ADMIN_PHONE` via WA + volta MENU
- Opção '4' "encerrar" → CONFIRMAR_ENCERRAMENTO

### 1.3 `handleAguardandoNovoKwh` (3923-3953)

- `parseInt + replace /\D/g` + valida >= 50 (mínimo arbitrário)
- **ALTERA DIRETO** `prisma.contrato.update({data: { kwhContratoMensal: valor }})`
- Notifica `SUPER_ADMIN_PHONE` via WA
- Confirma cooperado + volta MENU

### 1.4 `handleConfirmarEncerramento` (3955-3986)

- '1' "sim" → **ALTERA DIRETO** `status: 'ENCERRADO'` + notifica SUPER_ADMIN + estado CONCLUIDO
- '2' "não" → volta MENU
- Fallback se outra resposta

### 1.5 Diagnóstico crítico

**Hardcoded ALTERA contrato direto em 3 dos 4 fluxos (suspender, aumentar/diminuir kWh, encerrar).** Notificação à equipe é só mensagem WA efêmera (`process.env.SUPER_ADMIN_PHONE` — variável de ambiente, não persiste, sem audit trail). Sem validação humana. Sem painel.

**É exatamente o cenário (A) que a decisão (B) está descontinuando.** O Bloco 5 dinâmico é a versão correta. Hardcoded vai virar débito catalogado (Sprint Housekeeping ou remoção pós-validação smoke do dinâmico).

### 1.6 Pré-validações inexistentes

- ❌ Não verifica capacidade da usina (aumentar pode exceder)
- ❌ Não verifica cobrança em aberto (suspender/encerrar pode quebrar fluxo financeiro)
- ❌ Não diferencia "aumentar" de "diminuir" no `handleAguardandoNovoKwh` — aceita qualquer valor >= 50 independente do `dadosTemp.acao`
- ❌ Não pede motivo (suspender/encerrar)

---

## 2. Etapas FluxoEtapa no banco — seed pré-planejou ações mas estado destino errado

`seed-fluxos-bot.mjs:114-119`:

```javascript
{ id: 'f-atualizar-contrato', nome: 'Atualizar Contrato', ordem: 19, estado: 'ATUALIZACAO_CONTRATO', gatilhos: [
  { resposta: '1', proximoEstado: 'MENU_COOPERADO', acao: 'SOLICITAR_AUMENTO_KWH' },
  { resposta: '2', proximoEstado: 'MENU_COOPERADO', acao: 'SOLICITAR_REDUCAO_KWH' },
  { resposta: '3', proximoEstado: 'MENU_COOPERADO', acao: 'SUSPENDER_CONTRATO' },
  { resposta: '4', proximoEstado: 'MENU_COOPERADO', acao: 'ENCERRAR_CONTRATO' },
]},
```

**⚠️ Problema do desenho atual:** `proximoEstado: MENU_COOPERADO` direto significa que motor transiciona logo + dispara ação SEM coletar dados (valor kWh, motivo, etc). Mas a ação precisa do **valor novo / motivo / período pra criar a solicitação**.

**Vai precisar reorganizar:**
- Aumentar/Diminuir: estado intermediário `AGUARDANDO_NOVO_KWH` (já existe no seed?) pra coletar valor
- Suspender: estado intermediário pra coletar período + motivo
- Encerrar: estado intermediário `CONFIRMAR_ENCERRAMENTO` + motivo opcional

**Etapas órfãs já no seed:**
- `AGUARDANDO_NOVO_KWH` está listada em `ESTADOS_FLUXO_ATIVO` do hardcoded (linha 380) mas **NÃO está como FluxoEtapa no seed-fluxos-bot.mjs** (procurei — só MENU_COOPERADO tem essa string).
- `CONFIRMAR_ENCERRAMENTO` mesmo caso — só no hardcoded.

**Modelos de mensagem do banco:** procurei `contrato_*` ou `atualizar_contrato_*` em `seed-mensagens.ts` — **não existem**. Os 11 do Bloco 2 não cobrem este fluxo.

### 2.1 Entrada do cooperado

`seed-fluxos-bot.mjs:25` — MENU_COOPERADO opção '4' → ATUALIZACAO_CONTRATO. ✅ Cabeada.

---

## 3. Schema `SolicitacaoAlteracaoContrato` — NÃO existe

Confirmado: zero matches em schema pra `Solicitacao`, `SolicitacaoContrato`, `SolicitacaoAlteracao`, `AlteracaoContrato`, `Ticket`, `tipoAlteracao`. **Precisa criar.**

### 3.1 Estrutura proposta (valide se faz sentido)

```prisma
enum TipoAlteracaoContrato {
  AUMENTAR_KWH
  DIMINUIR_KWH
  SUSPENDER
  ENCERRAR
}

enum StatusSolicitacaoContrato {
  PENDENTE
  APROVADA      // equipe aprovou, ainda nao aplicou
  APLICADA      // contrato foi atualizado de fato
  RECUSADA
  CANCELADA     // cooperado cancelou via bot (se permitir)
}

model SolicitacaoAlteracaoContrato {
  id                    String   @id @default(cuid())
  cooperadoId           String
  cooperado             Cooperado @relation(fields: [cooperadoId], references: [id])
  cooperativaId         String
  cooperativa           Cooperativa @relation(fields: [cooperativaId], references: [id])
  contratoId            String
  contrato              Contrato @relation(fields: [contratoId], references: [id])
  tipoAlteracao         TipoAlteracaoContrato
  // Campos por tipo (todos opcionais — só relevantes pro tipo)
  valorPropostoKwh      Int?     // AUMENTAR_KWH | DIMINUIR_KWH
  periodoSuspensaoMeses Int?     // SUSPENDER (null = indefinido)
  motivo                String?  // opcional pra todos; sugerido pra SUSPENDER/ENCERRAR
  // Workflow
  status                StatusSolicitacaoContrato @default(PENDENTE)
  createdAt             DateTime @default(now())
  processadaEm          DateTime?
  processadaPorId       String?  // FK opcional pra Usuario admin
  observacoesEquipe     String?
  aplicadaEm            DateTime?  // quando contrato foi de fato alterado

  @@map("solicitacoes_alteracao_contrato")
  @@index([cooperativaId, status])  // pra listar pendentes por tenant
  @@index([cooperadoId])             // pra histórico do cooperado
}
```

**Ajustes/perguntas:**

1. **Relação com Usuario admin** (`processadaPorId`): precisa adicionar `solicitacoesProcessadas Solicitacao...` no model Usuario? Ou deixar string solta (FK lógico)? Hardcoded de outros lugares (cooperados.service guard ativação) usa string solta — segue padrão.
2. **`@@index([cooperativaId, status])`** — recomendado pra performance da query de pendências por tenant.
3. **`observacoesEquipe`** — usado tanto pra justificativa de aprovação quanto recusa. Cooperado vê quando recusada (mensagem do bot).

---

## 4. Notificação à equipe — `NotificacoesService` reusa 100%

**EXISTE e é exatamente o que precisamos** (`backend/src/notificacoes/notificacoes.service.ts`):

```typescript
async criar(data: { tipo, titulo, mensagem, cooperadoId?, adminId?, link?, cooperativaId? }) {
  return this.prisma.notificacao.create({ data });
}
```

Já tem `findAll` (lista pra usuário), `countNaoLidas`, `marcarComoLida`,
`marcarTodasComoLidas`. Painel admin existente (que mostra Notificacoes
genéricas) já vai mostrar a notificação do tipo
`SOLICITACAO_ALTERACAO_CONTRATO` quando criada.

**Implementação Bloco 5:** ao criar `SolicitacaoAlteracaoContrato`, ação
do motor também chama `notificacoes.criar({ tipo:
'SOLICITACAO_ALTERACAO_CONTRATO', titulo: '...', mensagem: '...',
cooperativaId, link: '/dashboard/super-admin/solicitacoes/${id}' })`.

**Reuso máximo. Zero canal novo.**

---

## 5. Painel admin — NÃO existe

`/web/app/dashboard/super-admin/` tem apenas `page.tsx` (dashboard SaaS
geral) + `parceiros/`. **Não há tela específica de solicitações.**

### 5.1 Decisão de produto

3 opções, em ordem crescente de esforço:

| Opção | Como funciona | Prós | Contras | Custo |
|---|---|---|---|---|
| **(I) Gerencia via Notificacoes + REST** | Notificação aparece no painel atual (sino de notificações). Admin clica no link → endpoint REST `POST /solicitacoes/:id/aprovar` (com observacoes opcional) e `POST /solicitacoes/:id/recusar`. Tela formal fica pra depois. | Zero UI. Reusa painel de Notificacoes existente. Endpoint REST testável via Insomnia/curl. | Admin precisa usar Postman/curl pra aprovar — não é UX viável pra equipe não-técnica. | 0h (só REST) |
| **(II) Tela mínima** | Página `/dashboard/super-admin/solicitacoes` lista PENDENTES com botões Aprovar/Recusar + textarea observações. Sem filtros sofisticados. | Equipe consegue operar. Pequena. | Trabalho UI + roteamento + componente shadcn + integração. | +2-3h |
| **(III) Painel completo** | Tela com filtros (status, tipo, cooperativa, data), histórico do cooperado, drill-down. | UX completa pra ops em escala. | Sobre-engineering pra Bloco 5. | +5-7h |

**Recomendação:** **(II)** pra Bloco 5 — minimum viable admin. Sem (II), equipe não consegue aprovar/recusar. (III) catalogar como Sprint Painel Admin futuro.

**Se Luciano preferir (I):** OK, mas catalogar como débito **D-novo-AB** "Tela de aprovação de solicitações de contrato" pra Sprint Housekeeping próximo. Equipe usa endpoint REST por enquanto.

---

## 6. Aplicação quando aprovada — `contratosService.update` reusável

`backend/src/contratos/contratos.service.ts:336` `update(id, data: Partial<{ucId, usinaId, planoId, dataInicio, dataFim, percentualDesconto, kwhContratoAnual, kwhContrato, status, modeloCobrancaOverride}>, cooperativaId?)` aceita:

- `kwhContratoAnual` (ou `kwhContrato` mensal) — pra AUMENTAR/DIMINUIR
- `status: string` — pra SUSPENDER (status='SUSPENSO') / ENCERRAR (status='ENCERRADO') — confirmar enum
- `cooperativaId?` opcional pra multi-tenant guard

Validações inline já existentes:
- `kwhContrato > 0` (BUG-CARRY-002)
- Sprint 5 bloqueia modelos COMPENSADOS/DINAMICO (não aplica aqui)
- Mensal calculado automático de anual

**Aplicação Bloco 5:** quando admin aprova solicitação, endpoint
`POST /solicitacoes/:id/aprovar`:
1. Atualiza `SolicitacaoAlteracaoContrato` (status='APROVADA',
   processadaEm, processadaPorId, observacoesEquipe)
2. **Aplica** chamando `contratosService.update(contratoId, {...},
   cooperativaId)` conforme tipoAlteracao
3. Atualiza solicitacao.status='APLICADA' + aplicadaEm
4. Listener/job (futuro) ou ação inline chama
   `notificacoes.criar(...)` notificando cooperado
5. Bot envia WA pro cooperado: "Sua solicitação de aumentar kWh foi
   aprovada! Novo valor: 200 kWh/mês."

**Pergunta: aprovar = aplicar imediato, OU 2 etapas (APROVADA → admin
aplica num 2º clique)?**
- (i) **Aprovar = aplicar imediato** (recomendado) — simples, status
  APROVADA virou intermediário sem uso. Vai direto pra APLICADA.
- (ii) **Aprovar ≠ aplicar** — admin pode "aprovar mas adiar" (ex: aumentar kWh
  só vale na próxima fatura). Status APROVADA fica latente, cron ou
  comando manual aplica. Mais flexível, mais complexo.

Pra MVP do Bloco 5, sugiro (i). Estado APROVADA fica reservado pra (ii)
futuro.

---

## 7. Comunicação ao cooperado — 4 modelos novos pra criar

**Modelos `solicitacao_contrato_*` NÃO existem no banco.** Vou propor 4:

| Nome | Evento | Conteúdo proposto |
|---|---|---|
| `solicitacao_contrato_criada` | Bot acabou de criar | "✅ Recebemos sua solicitação de *{{tipo}}*. Nossa equipe vai analisar e te avisa em até 2 dias úteis." |
| `solicitacao_contrato_aprovada` | Admin aprovou + aplicou | "✅ Sua solicitação de *{{tipo}}* foi aprovada! {{detalhe}}" |
| `solicitacao_contrato_recusada` | Admin recusou | "⚠️ Sua solicitação de *{{tipo}}* não pôde ser atendida agora. Motivo: {{observacoes}}\n\nQualquer dúvida, fale com nossa equipe." |
| `solicitacao_contrato_aplicada` | (opcional, se decisão 6.ii) Admin aplicou após aprovação prévia | "✅ Sua solicitação de *{{tipo}}* foi aplicada. Novo valor vigente: {{detalhe}}" |

**Decisão produto:** criar os 4 agora OU 3 (pular `_aplicada` se decisão 6.i)?
Sugiro 3 (sem `_aplicada` — fica reservada se for decidir 6.ii futuro).

Vars `{{tipo}}` deve renderizar texto humano: "aumentar kWh", "diminuir kWh", "suspender contrato", "encerrar contrato".

---

## 8. Sub-fluxo das 4 opções

### 8.1 Aumentar / Diminuir kWh

**Coleta:**
1. ATUALIZACAO_CONTRATO opção '1' (aumentar) ou '2' (diminuir) → estado
   AGUARDANDO_NOVO_KWH + `dadosTemp.tipoAlteracao = 'AUMENTAR_KWH' | 'DIMINUIR_KWH'`
2. AGUARDANDO_NOVO_KWH gatilho wildcard `*` + acao `SALVAR_SOLICITACAO_KWH`:
   - `parseInt` + valida > 0
   - AUMENTAR: novo > contrato atual; DIMINUIR: novo < atual (ação consulta
     contrato via `dadosTemp.contratoId`)
   - **Pré-validação opcional (decisão produto):** capacidade da usina não
     excedida (somar `kwhContrato` ativos de todos cooperados da usina)
   - Cria SolicitacaoAlteracaoContrato + Notificacao + envia
     `solicitacao_contrato_criada` ao cooperado
   - Transiciona MENU_COOPERADO

### 8.2 Suspender

**Coleta (DECISÃO PRODUTO):**

| Opção | Como |
|---|---|
| **(A) Período definido** | 2 estados intermediários: AGUARDANDO_PERIODO_SUSPENSAO (X meses) + AGUARDANDO_MOTIVO_SUSPENSAO |
| **(B) Indefinido** | Só motivo (1 estado: AGUARDANDO_MOTIVO_SUSPENSAO). Cooperado pede reativação depois via outro fluxo. |
| **(C) Híbrido** | Sub-menu: "1 Por tempo determinado / 2 Por tempo indeterminado". Se 1, coleta período. |

Hardcoded atual: zero coleta — só suspende. Decisão de produto pendente.

Recomendação: **(B) indefinido + motivo** pro MVP. Equipe pode usar
`observacoesEquipe` pra registrar quando combinou reativação. Adiciona
sofisticação depois se cooperados pedirem.

### 8.3 Encerrar

**Coleta:**
1. ATUALIZACAO_CONTRATO opção '4' → CONFIRMAR_ENCERRAMENTO + envia
   mensagem "Tem certeza? Esta ação não pode ser desfeita."
2. CONFIRMAR_ENCERRAMENTO gatilhos:
   - '1' → estado intermediário AGUARDANDO_MOTIVO_ENCERRAMENTO (decisão
     produto: pede motivo OU vai direto pra criar solicitação)
   - '2' → volta MENU
3. AGUARDANDO_MOTIVO_ENCERRAMENTO gatilho wildcard + acao
   `CRIAR_SOLICITACAO_ENCERRAR`:
   - Cria solicitação + notifica + mensagem ao cooperado
   - Transiciona MENU_COOPERADO

**Sugerido:** pedir motivo. Útil pra equipe entender churn. Decisão
produto: tornar obrigatório ou opcional (cooperado pode digitar "PULAR").

### 8.4 Pré-validações que o bot pode fazer (decisão produto)

| Validação | Onde | Custo |
|---|---|---|
| Aumentar acima da capacidade da usina | SALVAR_SOLICITACAO_KWH consulta `Usina.capacidadeKwh` + soma `Contrato.kwhContrato` ATIVOS da mesma usina | +0.5-1h (query + lógica) |
| Cobrança em aberto bloqueia suspensão/encerramento | Consulta `Cobranca` status A_VENCER ou VENCIDO do cooperado | +0.5h |
| Aumentar > 100% do atual | Política de negócio — ex: aumentar >2x exige análise especial | +0.2h |

**Recomendação:** Bot pré-valida **capacidade da usina + cobrança em
aberto** (são duros — equipe vai recusar mesmo se cooperado conseguir
solicitar). UX melhor: cooperado entende a recusa antes vs depois.
Resto fica pra equipe analisar.

---

## 9. Mapa do que JÁ EXISTE vs FALTA

| Item | Status | Local |
|---|---|---|
| Handler hardcoded `handleAtualizacaoContrato` + sub-handlers | ✅ existe (mas viola decisão B — altera direto) | `whatsapp-bot.service.ts:3848-3986` |
| Switch case ATUALIZACAO_CONTRATO + AGUARDANDO_NOVO_KWH + CONFIRMAR_ENCERRAMENTO | ✅ ativo no hardcoded | linhas 577-585 |
| Entrada MENU_COOPERADO '4' → ATUALIZACAO_CONTRATO | ✅ no seed | `seed-fluxos-bot.mjs:25` |
| Etapa dinâmica ATUALIZACAO_CONTRATO no seed | ⚠️ existe com gatilhos pré-planejados MAS proximoEstado=MENU_COOPERADO direto (sem coleta intermediária) | `seed-fluxos-bot.mjs:114` |
| Etapas AGUARDANDO_NOVO_KWH, CONFIRMAR_ENCERRAMENTO, AGUARDANDO_PERIODO/MOTIVO | ❌ não existem como FluxoEtapa dinâmica | — |
| Model `SolicitacaoAlteracaoContrato` + enums | ❌ não existe | precisa criar |
| `NotificacoesService.criar()` | ✅ existe e reusa direto | `notificacoes/notificacoes.service.ts:20` |
| Painel admin de solicitações | ❌ não existe (`/dashboard/super-admin/` só tem dashboard SaaS + parceiros) | depende decisão produto |
| `contratosService.update()` pra aplicar mudança | ✅ existe (aceita kwh + status + cooperativaId) | `contratos/contratos.service.ts:336` |
| Endpoint REST `POST /solicitacoes/:id/aprovar` + `/recusar` | ❌ não existe | precisa criar |
| Modelos `solicitacao_contrato_*` (criada/aprovada/recusada) | ❌ não existem no banco | precisa criar 3-4 |
| Comunicação ao cooperado quando status muda | ❌ sem mecanismo | listener Prisma OU ação inline no endpoint admin |
| Pré-validação capacidade usina | ❌ não existe (nem no hardcoded) | depende decisão produto |
| Pré-validação cobrança em aberto bloqueia suspensão | ❌ não existe | depende decisão produto |

---

## 10. Decisões de produto pro Luciano (5)

### (1) Painel admin pra aprovar/recusar?

| Opção | Custo |
|---|---|
| **(I)** REST + painel Notificacoes existente (sem UI nova) | 0h |
| **(II)** Tela mínima `/dashboard/super-admin/solicitacoes` com Aprovar/Recusar inline | +2-3h |
| **(III)** Painel completo com filtros | +5-7h |

**Recomendação:** (II) — minimum viable pra equipe operar. (III) catalogar pra sprint futuro.

### (2) Suspender — período fixo, indefinido ou híbrido?

| Opção | UX | Sub-fluxo |
|---|---|---|
| **(A)** Período X meses obrigatório | Cooperado sabe quando reativa | 2 estados (período + motivo) |
| **(B)** Indefinido + motivo | Cooperado pede reativação depois | 1 estado (motivo) |
| **(C)** Híbrido (sub-menu) | UX mais rica, mais complexo | 3-4 estados |

**Recomendação:** (B) indefinido — MVP. Equipe usa `observacoesEquipe`
pra alinhar reativação. Adiciona (A)/(C) depois se demanda aparecer.

### (3) Aprovar = aplicar imediato?

| Opção | Como |
|---|---|
| **(i)** Aprovar = aplicar imediato (status vai direto pra APLICADA) | Recomendado MVP |
| **(ii)** Aprovar ≠ aplicar (status APROVADA, admin aplica num 2º clique ou cron aplica em data futura) | Mais flexível, mais complexo |

**Recomendação:** (i). Reserva STATUS APROVADA pra (ii) futuro.

### (4) Pré-validações que bot faz?

| Validação | Custo | Recomendação |
|---|---|---|
| Capacidade da usina (somar kWh ativos) | +0.5-1h | SIM — equipe recusaria mesmo |
| Cobrança em aberto bloqueia suspensão | +0.5h | SIM — protege fluxo financeiro |
| Aumentar > 100% do atual (política) | +0.2h | NÃO — equipe decide caso a caso |

**Recomendação:** as 2 primeiras SIM, terceira NÃO.

### (5) Encerrar — pedir motivo?

| Opção | UX | |
|---|---|---|
| **(A) Obrigatório** | Cooperado precisa explicar | melhor pra analytics de churn |
| **(B) Opcional** ("PULAR" pula) | Menos atrito | menos dados |
| **(C) Não pedir** | UX mais limpa | zero dado de churn |

**Recomendação:** (B) opcional. Cooperado que quer expressar, expressa; quem só quer sair, não trava.

---

## 11. Proposta de desenho do Bloco 5 (assumindo recomendações)

Decisões aceitas: (1.II) tela mínima + (2.B) indefinido+motivo + (3.i) aprovar=aplicar + (4) capacidade usina + cobrança aberto + (5.B) motivo opcional.

### 11.1 Schema delta — model + 2 enums + relação no Cooperado/Cooperativa/Contrato

`npx prisma db push` (aditivo, sem backfill — tabela vazia).

### 11.2 Motor — 4 ações novas

**Ação `INICIAR_SOLICITACAO_KWH`** (gatilho '1' ou '2' do ATUALIZACAO_CONTRATO):
- Busca Contrato ATIVO; sem contrato → mensagem + volta MENU
- Persiste `dadosTemp.{contratoId, tipoAlteracao}` (AUMENTAR ou DIMINUIR)
- Transiciona pra AGUARDANDO_NOVO_KWH + envia "Atual: X kWh. Digite o novo valor:"

**Ação `SALVAR_SOLICITACAO_KWH`** (gatilho wildcard em AGUARDANDO_NOVO_KWH):
- Valida parseInt > 0
- Compara com kwh atual (AUMENTAR: novo > atual; DIMINUIR: novo < atual)
- **Pré-valida capacidade da usina** (decisão 4): consulta `Usina.capacidadeKwh` + soma `Contrato.kwhContratoMensal` ativos da mesma usina; se novo + soma_outros > capacidade → recusa amigável "esse aumento excederia a usina X — pedir menos"
- Cria SolicitacaoAlteracaoContrato + Notificacao + envia `solicitacao_contrato_criada`
- Transiciona MENU_COOPERADO

**Ação `INICIAR_SOLICITACAO_SUSPENDER`** (gatilho '3'):
- Busca Contrato ATIVO
- **Pré-valida cobrança em aberto** (decisão 4): se há Cobranca A_VENCER ou VENCIDO → recusa "tem fatura em aberto — quite antes de suspender"
- Persiste dadosTemp + transiciona AGUARDANDO_MOTIVO_SUSPENSAO + envia "Por que deseja suspender? (texto livre ou PULAR)"

**Ação `SALVAR_SOLICITACAO_SUSPENDER`** (gatilho wildcard em AGUARDANDO_MOTIVO_SUSPENSAO):
- Pega motivo (ou null se "PULAR")
- Cria SolicitacaoAlteracaoContrato tipo SUSPENDER + Notificacao + WA `criada`
- Transiciona MENU_COOPERADO

**Ações análogas pra ENCERRAR** (`INICIAR_SOLICITACAO_ENCERRAR` + `CONFIRMAR_E_SALVAR_ENCERRAMENTO`):
- '4' → CONFIRMAR_ENCERRAMENTO (mensagem "tem certeza?")
- CONFIRMAR_ENCERRAMENTO gatilho '1' → AGUARDANDO_MOTIVO_ENCERRAMENTO
- wildcard motivo → cria solicitação tipo ENCERRAR + notifica + WA

**Total: ~5-6 ações novas no motor.**

### 11.3 Script idempotente — `fix-bloco-5-atualizar-contrato-no-fluxo.ts`

- UPDATE `f-atualizar-contrato`: gatilhos mudam `proximoEstado` pra
  estados intermediários (AGUARDANDO_NOVO_KWH / AGUARDANDO_MOTIVO_*)
- INSERT etapas novas: AGUARDANDO_NOVO_KWH, AGUARDANDO_MOTIVO_SUSPENSAO,
  CONFIRMAR_ENCERRAMENTO, AGUARDANDO_MOTIVO_ENCERRAMENTO
- INSERT 3 modelos de mensagem (`solicitacao_contrato_criada/aprovada/recusada`)
- Atualiza seed

### 11.4 Endpoint REST + tela admin mínima

**Backend:**
- `POST /solicitacoes-contrato/:id/aprovar` (body: { observacoesEquipe?: string })
- `POST /solicitacoes-contrato/:id/recusar` (body: { observacoesEquipe: string }) — observação obrigatória pra recusa
- `GET /solicitacoes-contrato?status=PENDENTE&cooperativaId=X` — lista pra tela admin
- Auth: SUPER_ADMIN ou ADMIN (depende decisão futura)

**Frontend (decisão 1.II):**
- `/dashboard/super-admin/solicitacoes/page.tsx`: tabela de pendentes com colunas (cooperado, tipo, detalhe, data) + botões Aprovar (verde) / Recusar (vermelho)
- Modal pra digitação de observações
- Toast de sucesso/erro

### 11.5 Comunicação ao cooperado quando status muda

Endpoint admin (aprovar/recusar) também chama `sender.enviarMensagem(cooperado.telefone, ...)` renderizando modelo apropriado.

**Detalhe operacional:** isAmbienteReal preserva safety pra contatos teste.

### 11.6 Hardcoded — preservar como fallback + débito

Os 3 handlers hardcoded (`handleAtualizacaoContrato`, `handleAguardandoNovoKwh`, `handleConfirmarEncerramento`) continuam atendendo cooperados que (por algum motivo) caírem no fallback. Mas: **eles ALTERAM contrato direto, violando a decisão (B)**.

**Catalogar D-novo-AB (próxima letra livre):** "Hardcoded handleAtualizacaoContrato altera contrato direto sem solicitação — violação da decisão B pós-Bloco 5. Fix: trocar `prisma.contrato.update` por criar SolicitacaoAlteracaoContrato no hardcoded também (consistência). Sprint Housekeeping ou remoção pós-validação smoke do dinâmico."

### 11.7 Specs TDD (~25-30 cenários)

- 4 ações × ~5-6 cenários cada (válido / inválido / pré-validação falha / multi-tenant / sucesso cria solicitação + notificação + envio)
- Endpoint REST (aprovar/recusar) ~6-8 cenários (sucesso, recusa sem motivo bloqueia, multi-tenant, status já não pendente, etc)
- Tela admin: testes mais leves (E2E ou snapshot, opcional MVP)

---

## 12. Estimativa revisada

| Item | Custo |
|---|---|
| Schema delta: model + 2 enums + relações + push + generate | 1h |
| 5-6 ações novas no motor (padrão Bloco 4/6/7) | 2.5-3h |
| Script idempotente cabea 5 etapas + modelos novos | 1h |
| 3 modelos de mensagem no banco + seed alinhado | 0.5h |
| Endpoint REST `/solicitacoes-contrato/{aprovar,recusar,GET}` | 1-1.5h |
| Tela admin mínima `/dashboard/super-admin/solicitacoes` (decisão 1.II) | 2-3h |
| Comunicação ao cooperado quando status muda (renderiza modelo + envia WA) | 0.5h |
| Pré-validação capacidade usina + cobrança aberto (decisão 4) | 1-1.5h |
| Specs TDD (~25-30 cenários motor + endpoint) | 2-2.5h |
| Catalogar débito D-novo-AB hardcoded + outros achados | 0.3h |
| Build + ritual PM2 + smoke real (com contatos teste) | 0.7h |
| **Total** | **12.5-15h** |

**A faixa 4-6h NÃO se confirma** — o desenho mais completo (com tela
admin + pré-validações) sobe pra **12-15h**. Cenário mais enxuto:

| Cenário enxuto | Horas |
|---|---|
| Sem tela admin (decisão 1.I — só REST) | -2-3h → **10-12h** |
| Sem pré-validações bot (decisão 4 = NÃO) | -1-1.5h → **8.5-10h** |
| Mínimo absoluto (1.I + 4=NÃO + sem capacidades de bot) | **8-10h** |

**Disconnect com faixa 4-6h:** o Bloco 5 é o **mais complexo do sprint**
porque envolve schema novo + endpoint REST + (possível) tela admin +
notificações persistentes + comunicação bidirecional cooperado/equipe.
Decisões produto (especialmente painel admin) afetam muito.

---

## 13. Decisões pendentes consolidadas pro Luciano

Pra eu fechar a Fase 1 e empacotar a Fase 2:

1. **Painel admin** — (I) REST only / **(II) tela mínima** / (III) painel completo. Recomendação: (II).
2. **Suspender** — (A) período fixo / **(B) indefinido + motivo** / (C) híbrido. Recomendação: (B).
3. **Aprovar = aplicar?** — **(i) sim, direto** / (ii) 2 etapas (APROVADA → APLICADA). Recomendação: (i).
4. **Bot pré-valida?** — SIM (capacidade usina + cobrança em aberto) / NÃO (só registra). Recomendação: SIM.
5. **Encerrar pede motivo?** — (A) obrigatório / **(B) opcional ("PULAR")** / (C) não pede. Recomendação: (B).

**Decisões de schema (mais técnicas, suas — confirmar):**

6. Enum `TipoAlteracaoContrato`: 4 valores (AUMENTAR_KWH, DIMINUIR_KWH, SUSPENDER, ENCERRAR) — OK?
7. Enum `StatusSolicitacaoContrato`: PENDENTE/APROVADA/APLICADA/RECUSADA/CANCELADA — OK manter APROVADA mesmo se decisão 3=i?

---

## 14. Diretrizes aplicadas

- ✅ **Decisão 23** — Fase 1 read-only OBRIGATÓRIA, zero edits.
- ✅ **Decisão 14** — grep amplo confirmou: zero `Solicitacao*` no schema, etapas dinâmicas órfãs, modelos de mensagem inexistentes.
- ✅ **Reuse** — desenho aproveita NotificacoesService (sem canal novo), contratosService.update (aplica mudança), padrão Bloco 4/6/7 (ação privada + multi-tenant + retry inline).
- ✅ **Sem suposições** — hardcoded alterando direto + notificação frágil via SUPER_ADMIN_PHONE foram confirmados na investigação.
- ✅ **NÃO trabalhar paralelo com claude.ai** — Code 100% direto.

---

## 15. Próximo passo

Aguardar OKs do Luciano nas 5+2 decisões do §13. Depois empacotar prompt
da Fase 2 (execução em 6 etapas TDD: schema + ações motor + script
banco + modelos mensagem + endpoint REST + tela admin) e implementar.
