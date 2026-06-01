# Sub-Sprint F — Portal Proprietário E-Solares — Fase 1 Read-Only

> Sessão: 26-27/05/2026. Decisão 23 ativa — nenhum arquivo editado nesta análise.
> Estimativa Fase 1: ~3-5h Code. Esgotada em sessão única.

## 0. TL;DR

**O Portal Proprietário NÃO é greenfield** — existe infraestrutura significativa criada em 25-29/03/2026 (project_multipapel + project_portal_fase2):

- ✅ Rota `/proprietario` root com layout próprio + 4 sub-páginas (Dashboard, Usinas, Repasses, Contratos)
- ✅ Multi-papel via `useContexto()` + `ContextoSwitcher` + tipo `proprietario_usina` em `/auth/me`
- ✅ Endpoint backend `GET /usinas/proprietario/dashboard` retornando usinas + repasses (simulados)
- ✅ Schema Usina já tem 5 campos `proprietario*` + `formaPagamentoDono` (FIXO/PERCENTUAL/HIBRIDO via Mini-Bloco H'.9) + `valorAluguelFixo` + `percentualGeracaoDono`

**Gap real:** o portal foi feito como **esqueleto funcional placeholder** (R$ 0,50/kWh hardcoded, sem auth dedicado, sem integração iSolar Cloud, repasses calculados em runtime). Pra E-Solares usar em produção, faltam **5 gaps críticos** + **3 gaps menores** mapeados abaixo.

**Estimativa revisada:** **8-14h Code em 4 fases** (versus 10-15h original — leve melhora). Não cresceu porque infraestrutura está pronta; não diminuiu mais porque há gap arquitetural em "Empresa como entidade separada" que precisa decisão de produto.

## 1. Tabela executiva — 8 frentes × status

| # | Frente | Status | Esforço pra produção E-Solares |
|---|---|---|---|
| 1 | Rota `/proprietario` + arquitetura multi-papel | ✅ PRONTO | 0h — funcional |
| 2 | Entidades dono da usina (Empresa vs campos embutidos) | 🟡 GAP MENOR | 0-6h (depende decisão Luciano §8) |
| 3 | Autenticação + onboarding proprietário | 🔴 GAP CRÍTICO | 2-3h (fluxo convite por email) |
| 4 | Dados que o proprietário vê | 🟡 PARCIAL | 3-5h (corrigir filtros + repasse real + cooperados) |
| 5 | UX/UI padrão portal existente | ✅ PRONTO | 0h — usa Shadcn + layout dedicado |
| 6 | Multi-tenant + segurança | 🔴 GAP CRÍTICO | 2-3h (endpoints proprietário-aware) |
| 7 | Comparativo legado SISGDSOLAR | 📋 MAPEADO | 0h — referência, não executável |
| 8 | Decisões de produto | ⏸️ AGUARDA | 30min Luciano (§8) |

## 2. Estado da rota `/proprietario` + arquitetura multi-papel

### 2.1 Duas árvores `proprietario` no frontend

| Rota | Propósito | Status |
|---|---|---|
| `/proprietario` (root) | **Portal real do proprietário** — onde E-Solares loga | ✅ Esqueleto pronto (layout + 4 sub-páginas) |
| `/dashboard/proprietario` | **View interna ADMIN** — preview pro admin ver o que o proprietário veria | ✅ Funcional (chama `GET /usinas/proprietario/dashboard`) |

Sidebar admin (`/dashboard/layout.tsx:152`): item "Portal Proprietário" aponta pra `/dashboard/proprietario` (view interna). Confusão de nomes mas separação intencional.

### 2.2 Multi-papel (project_multipapel.md, 25/03/2026)

- `GET /auth/me` retorna `contextos[]` com tipos: `super_admin`, `admin_parceiro`, `cooperado`, `proprietario_usina`, `admin_agregador`
- Frontend: `useContexto()` + `localStorage('contexto_ativo')` + `ContextoSwitcher` (header)
- `rotaPorContexto('proprietario_usina') → '/proprietario'` (`web/hooks/useContexto.ts:91`)
- Detecção do papel proprietário em `AuthService.obterContextosUsuario` (linhas 516-536):
  - **Caminho A:** `Usina.proprietarioCooperadoId === cooperado.id` (se o usuário também é cooperado)
  - **Caminho B (fallback):** `Usina.proprietarioEmail === usuario.email` (proprietário não-cooperado)
- Label automático: `"Proprietário — Solar X, Solar Y"` (concatena nomes das usinas)

### 2.3 Layout `/proprietario` (já implementado)

`web/app/proprietario/layout.tsx` — amber theme, sidebar com 4 itens:
- Dashboard (`/proprietario`)
- Minhas Usinas (`/proprietario/usinas`)
- Repasses (`/proprietario/repasses`)
- Contratos (`/proprietario/contratos`)

Header com `ContextoSwitcher` integrado (proprietário pode trocar pra outro papel se for cooperado+proprietário).

### 2.4 Roles backend

`PerfilUsuario` enum (`backend/src/auth/perfil.enum.ts`):
```
SUPER_ADMIN | ADMIN | OPERADOR | COOPERADO | AGREGADOR
```

**Não há role `PROPRIETARIO`.** O papel proprietário é **inferido dinamicamente** via relacionamento (FK ou email), não codificado como Perfil. Implicação: proprietário usa role `COOPERADO` (caminho A) ou um perfil específico (precisa definir caminho B — não está claro qual role o `Usuario` órfão de cooperado teria).

## 3. Entidades + relações — dono da usina

### 3.1 Estado atual (schema.prisma:352-396)

Proprietário é **embutido em Usina** via 6 campos:

```prisma
model Usina {
  // ...
  proprietarioNome        String?
  proprietarioCpfCnpj     String?
  proprietarioTelefone    String?
  proprietarioEmail       String?
  proprietarioTipo        String                @default("PF")  // PF | PJ
  proprietarioCooperadoId String?
  proprietarioCooperado   Cooperado?            @relation("UsinaProprietario", ...)
  // Bloco H' (16/05/2026):
  cnpjUsina               String?
  formaAquisicao          FormaAquisicao?       // CESSAO | ALUGUEL | PROPRIA
  formaPagamentoDono      FormaPagamentoDono?   // FIXO | PERCENTUAL | HIBRIDO
  valorAluguelFixo        Decimal?              @db.Decimal(10, 2)
  percentualGeracaoDono   Decimal?              @db.Decimal(5, 2)
  numeroContratoEdp       String?
  dataContratoEdp         DateTime?
}
```

**Modelo:** 1 usina ↔ 1 proprietário (denormalizado). Sem entidade `Empresa` ou `EmpresaUsina` separada.

**`ContratoConvenio` (linha 1153) com `empresaNome/Cnpj/Email/Telefone` — NÃO é pra dono de usina.** É pra convênios institucionais (escolas, condomínios). Vocabulário diferente, contexto diferente.

### 3.2 Legado SISGDSOLAR (descoberta 25/05)

| Legado SQL Server | Novo Prisma |
|---|---|
| `tbl_empresa_usina` (+ contrato_sistema) | **NÃO TEM** — embutido em Usina |
| `tbl_parametro_arrendamento` | **NÃO TEM** — só campos estáticos em Usina |
| `tbl_token_isolar` | **NÃO TEM** — telemetria iSolar Cloud ausente |
| `tbl_usina_energia_injetada_*_kwh` | `GeracaoMensal` (1 row/mês/usina) |

**Implicação:** legado tinha **Empresa como entidade separada** (provavelmente pra suportar 1 empresa → N usinas, ex: investidor com várias usinas). No novo, **uma empresa que tenha 2 usinas hoje precisa duplicar os campos `proprietario*` em cada Usina** (denormalização aceitável pra cooperebr1, problemática em escala).

### 3.3 Decisão a tomar (§8 abaixo)

**Manter denormalização** (rápido, suficiente pra cooperebr1) **vs Criar `Empresa` separada** (refator, suporta E-Solares com várias usinas no futuro). Recomendação: **manter denormalização agora** + catalogar débito pra Empresa separada quando 2ª usina E-Solares aparecer (YAGNI).

## 4. Autenticação + onboarding do proprietário

### 4.1 Estado atual

**Não há fluxo dedicado.** Reusa login geral (`/login` ou `/portal/login`).

Detecção do papel acontece **APÓS login**, em `AuthService.obterContextosUsuario`:
- Se o `Usuario` autenticado **tem cooperadoId** + algum `Usina.proprietarioCooperadoId === cooperadoId` → contexto `proprietario_usina` adicionado
- Senão (não é cooperado), se `Usuario.email === Usina.proprietarioEmail` → contexto adicionado

### 4.2 Gap pra E-Solares (proprietário não-cooperado de outra cooperativa)

E-Solares **não é cooperada da CoopereBR** (ela ARRENDA a usina pra CoopereBR). Logo:
- Não tem `Cooperado` row
- Email da E-Solares precisa estar cadastrado em `Usuario` (criado por admin) **E** em `Usina.proprietarioEmail` (cadastrado quando admin cria a usina)
- A role do `Usuario` E-Solares precisa ser uma das 5 do enum — **nenhuma é específica**, mais provável `COOPERADO` (apesar de não ser) ou criar role `PROPRIETARIO` (refator pequeno).

**Fluxo de convite NÃO existe.** Hoje o admin cadastra `Usuario` direto via painel admin (ou via API). Pra produção:

- 🔴 **GAP:** botão "Convidar proprietário" na tela de Usina (admin) que envia email com magic link → proprietário clica → cria conta → primeiro login pré-popula contexto `proprietario_usina`
- 🟡 **Alternativa:** admin cadastra `Usuario` manualmente (sem magic link) e envia credenciais por canal externo (chat, papel) — mais barato, fricção operacional

### 4.3 Esforço estimado

- 🔴 Magic link via email pra onboarding: **2-3h Code** (template email + endpoint `/proprietario/convite` + tela `/proprietario/aceitar-convite/:token` + token JWT de uso único)
- 🟡 Cadastro manual + senha temporária: **~30min Code** (só checklist operacional pra admin)

## 5. Dados que o proprietário deve ver

### 5.1 📊 Geração da usina

| Fonte | Status |
|---|---|
| `GeracaoMensal` (1 row/mês/usina, campo `kwhGerado`) | ✅ Existe |
| `UsinaLeitura` (telemetria real-time, vinculada a `UsinaMonitoramentoConfig`) | ✅ Existe (manual — sem integração iSolar Cloud) |
| `UsinaAlerta` (alertas BAIXA_GERACAO / OFFLINE) | ✅ Existe |
| Endpoint `GET /monitoramento-usinas/:usinaId/historico` | ✅ Existe MAS restrito a SUPER_ADMIN/ADMIN/OPERADOR |
| Integração iSolar Cloud automática | 🔴 **NÃO TEM** — legado tinha `tbl_token_isolar`, novo não portou |

**Gap pra produção:**
- **Expandir `@Roles` em `MonitoramentoUsinasController`** pra incluir `COOPERADO` (e proprietário-via-cooperado) com guard que valida `usinaId` pertence ao proprietário → **30min Code**
- **Integração iSolar Cloud automática:** **GRANDE** — fora do escopo F. Pra cooperebr1, geração pode ser inserida manualmente em `GeracaoMensal` pelo admin enquanto integração não existe.

### 5.2 👥 Cooperados alocados

`Contrato.usinaId` + `Contrato.cooperadoId` permitem listar cooperados alocados na usina.

`UsinasService.proprietarioDashboard` (linha 538) já calcula:
- `kwhContratadoTotal` (soma de `Contrato.kwhContrato` ativos da usina)
- `ocupacao` (% capacidade)
- **Não retorna nomes dos cooperados** — apenas agregados (ver §6.3 LGPD)

**Gap:** se Luciano quiser drill-down (proprietário ver lista de cooperados), precisa endpoint novo + decisão de anonimização (§8).

### 5.3 💰 Financeiro / Repasse

**Estado atual (`UsinasService.proprietarioDashboard:570, 592`):**
```typescript
// Estimativa simples: R$ 0,50/kWh como valor médio de crédito
const receitaPrevista = kwhGeradoMes * 0.50;
// ...
const valor = g.kwhGerado * 0.50;
```

🔴 **Hardcoded R$ 0,50/kWh** — não usa `Usina.formaPagamentoDono` nem `valorAluguelFixo` nem `percentualGeracaoDono`. Inútil em produção.

**Modelo de dados pra repasses reais:**
- **Não há tabela `Repasse` / `PagamentoProprietario`** no schema
- `geracoesMensais` + `Usina.valorAluguelFixo/percentualGeracaoDono` permitem **calcular** repasse, mas não **registrar** pagamento real (data, status PAGO/PENDENTE, comprovante)

**Gaps pra produção:**
- 🔴 Lógica de cálculo respeitando `formaPagamentoDono`: **1-2h Code** (helper `calcularRepasse(usina, geracao) → valor` + atualizar `proprietarioDashboard`)
- 🟡 Tabela `RepasseProprietario` pra registrar histórico real: **1-2h Code + migration** (mas pode esperar — proprietário pode ver "previsto" agora, registrar "pago" depois). Catalogar como débito pós-MVP.

### 5.4 📄 Documentos

`ContratoUso` (linha 1148) existe + `/proprietario/contratos/page.tsx` consome `GET /contratos` filtrado no client.

**Gaps:**
- 🔴 Filtrar no backend (não client) — endpoint dedicado `GET /contratos/proprietario` ou filtro `?usinaId=X`: **1h Code**
- 🟡 Upload de contrato de arrendamento E-Solares × CoopereBR (PDF Assinafy ou upload simples): fora do escopo F — depende Sub-Sprint E (Assinafy)

### 5.5 🔔 Alertas/notificações

`UsinaAlerta` + `notificacoes-proativas/` (Bloco D 17/05) — infraestrutura existe.

**Decisão de produto (§8):** alerta proativo de queda de geração pro proprietário? Hoje só admin recebe.

## 6. UX/UI — padrão de portal existente

### 6.1 Padrões reusáveis

- **`/portal/cooperado/*`** — blue theme, Shadcn (Card, Table, Badge, Button). Padrão de página própria por seção.
- **`/parceiro/*`** — blue theme similar (admin parceiro).
- **`/proprietario/*`** — amber theme já implementado (esqueleto).

### 6.2 Padrão UX dual (memória padrao_ux_edicao_inline_vs_pagina_propria_17_05)

- **Tipo B (página própria)** se aplica a `/proprietario/usinas`, `/proprietario/repasses`, `/proprietario/contratos` — URL distinta cada.
- **Tipo A (inline)** **NÃO se aplica** ao Portal Proprietário (sem edição — proprietário é só leitor).
- **Tipo C (dialog)** se for adicionar futuramente "abrir ocorrência" — fora do escopo F.

### 6.3 Help inline contextual (regra 19/05)

**TODA tela do portal precisa de help inline** (banner azul / tooltip / empty state com explicação). Proprietário pode não ser técnico — E-Solares é empresa de energia, mas a pessoa que vai consultar o portal pode ser do financeiro/contabilidade da E-Solares.

Specs sugeridas:
- **Dashboard:** banner azul "O que esses números significam? Geração = energia injetada na rede no mês. Capacidade = teto teórico mensal. Repasse = o que a CoopereBR vai te pagar conforme contrato."
- **Repasses:** explicar a regra atual (FIXO/PERCENTUAL/HIBRIDO) com texto humanizado puxando de `Usina.formaPagamentoDono`.
- **Contratos:** explicar diferença entre Contrato (cooperado × usina) e Contrato de Arrendamento (proprietário × cooperativa).

## 7. Multi-tenant + segurança

### 7.1 Gap crítico atual: filtragem no CLIENT

3 páginas do `/proprietario/` violam multi-tenant:

| Página | Endpoint atual | Risco |
|---|---|---|
| `/proprietario/usinas` | `GET /usinas` (lista TODAS da cooperativa) + filter no client | 🔴 Proprietário recebe lista de usinas alheias |
| `/proprietario/contratos` | `GET /contratos` (lista TODOS da cooperativa) + filter no client | 🔴 Proprietário recebe contratos alheios + dados de cooperados não-relacionados |
| `/proprietario/repasses` | `GET /financeiro/repasses?cooperadoId=X` | 🟡 Endpoint pode não existir (try/catch silencioso) + se existir, busca por cooperadoId mas proprietário pode não ser cooperado |

**Fix pra cada:**
- 🔴 Criar endpoint `GET /usinas?proprietario=me` (ou filtro guard-aware no findAll): **30min**
- 🔴 Criar endpoint `GET /contratos?proprietarioUsinaId=me` ou similar: **45min**
- 🔴 Endpoint `GET /repasses/proprietario` consumido só pelo portal: **inclui-se no §5.3 cálculo de repasse**

**Total fix multi-tenant:** **~2-3h Code** (3 endpoints novos com guard validando `Usina.proprietarioCooperadoId === req.user.cooperadoId` OU `Usina.proprietarioEmail === req.user.email`).

### 7.2 LGPD — dados de cooperados visíveis pro proprietário

Hoje `proprietarioDashboard` retorna **agregados** (totais, %), sem nome de cooperado. Se Luciano quiser drill-down "ver cooperados alocados", precisa:

- **Opção A (LGPD-safe):** mascarar nome → "Cooperado #042", kWh contratado, % usado
- **Opção B (LGPD-arriscado):** nome completo visível — precisa consentimento explícito do cooperado no termo de adesão

**Recomendação:** Opção A por padrão + toggle admin pra liberar Opção B se cooperativa tiver cláusula contratual. Decisão Luciano (§8).

## 8. Decisões de produto pro Luciano

| # | Pergunta | Opções | Recomendação |
|---|---|---|---|
| 1 | Vocabulário | "Proprietário" / "Dono" / "Investidor" / "Arrendador" | **"Proprietário"** (já usado em schema + UI) — manter |
| 2 | Multi-usina por proprietário | (a) Manter denormalização (5 campos repetidos em cada Usina) / (b) Criar entidade `Empresa` separada | **(a) agora**, catalogar débito pra (b) quando 2ª usina E-Solares aparecer (YAGNI) |
| 3 | Modelo de auth pro proprietário não-cooperado | (a) Criar role `PROPRIETARIO` no enum / (b) Reusar `COOPERADO` com FK órfã | **(a)** — clean role, evita gambiarra |
| 4 | Onboarding | (a) Magic link por email (admin convida) / (b) Cadastro manual + senha temporária | **(a)** se há orçamento, **(b)** se quer entregar rápido |
| 5 | Comissionamento mostrado | (a) Valor exato detalhado por geração mensal / (b) Saldo agregado do mês | **(a) detalhado** + breakdown por usina (clareza pro proprietário) |
| 6 | Anonimização cooperados | (a) Mascarar nome ("Cooperado #042") / (b) Nome completo visível | **(a) por padrão**, toggle admin (LGPD-first) |
| 7 | Notificações automáticas | (a) Email proativo se geração cair X% / (b) Só dashboard passivo | **(b) inicial**, (a) catalogar pós-MVP |
| 8 | Permissão de edição | Proprietário pode editar algo (dados de contato, conta bancária pra repasse)? | **Não editar nada** no MVP — leitura pura. Editar pós-MVP se Luciano quiser. |

## 9. Proposta de desenho do Portal Proprietário (Fase 2 — implementação)

### 9.1 Rotas frontend (estado proposto)

```
/proprietario                  Dashboard (KPIs + lista resumo usinas)
/proprietario/usinas           Lista das usinas com filtros + detalhe
/proprietario/usinas/[id]      NOVA: detalhe usina (geração mensal + cooperados anonimizados + alertas)
/proprietario/repasses         Histórico real de repasses (puxa de tabela RepasseProprietario futura)
/proprietario/contratos        Contratos de uso (de COOPERADOS, não confundir com contrato de arrendamento)
/proprietario/conta            NOVA (opcional): dados de contato + conta bancária pra repasse
/proprietario/aceitar-convite/[token]  NOVA: pós-onboarding magic link
```

### 9.2 Endpoints backend (estado proposto)

| Endpoint | Status atual | Mudança pra Fase 2 |
|---|---|---|
| `GET /usinas/proprietario/dashboard` | ✅ existe (placeholder R$ 0,50/kWh) | 🔴 corrigir cálculo respeitando `formaPagamentoDono` |
| `GET /usinas/proprietario` | ❌ não existe | 🆕 listar usinas do proprietário com guard |
| `GET /usinas/:id` | ✅ existe (multi-tenant ADMIN) | 🟡 expandir `@Roles` + guard proprietário-aware |
| `GET /contratos?usinaId=:id` | ✅ existe genérico | 🟡 guard proprietário-aware |
| `GET /monitoramento-usinas/:usinaId/historico` | ✅ existe (restrito admin) | 🟡 expandir `@Roles` + guard |
| `GET /repasses/proprietario` | ❌ não existe | 🆕 endpoint dedicado (calcula via `formaPagamentoDono`) |
| `POST /proprietario/convite` | ❌ não existe | 🆕 admin envia magic link |
| `GET /proprietario/aceitar-convite/:token` | ❌ não existe | 🆕 valida token + cria credenciais |

### 9.3 Schema (mudanças mínimas)

**Opção minimalista (recomendada):**
1. Adicionar `PROPRIETARIO` ao enum `PerfilUsuario` (1 linha)
2. Adicionar `ConviteProprietario` model: `id, usinaId, token, email, expiresAt, usedAt, createdBy, createdAt` — magic link de uso único
3. **NÃO criar** entidade Empresa por enquanto (YAGNI até 2ª usina E-Solares)
4. **NÃO criar** tabela `RepasseProprietario` por enquanto (cálculo em runtime via `geracoesMensais` + `Usina.*`)

**Migration aditiva pura.** Sem rewrite. ~30min schema + npx prisma migrate.

## 10. Estimativa total revisada

**8-14h Code em 4 fases** (cabe em 1 sessão longa OU 2 sessões médias):

| Fase | Escopo | Estimativa |
|---|---|---|
| **F.1** | Backend — endpoints proprietário-aware (`/usinas/proprietario`, `/contratos?usinaId`, repasse com `formaPagamentoDono` real) + role `PROPRIETARIO` no enum + guards | 3-4h |
| **F.2** | Frontend — corrigir 3 páginas (`/proprietario/usinas`, `/repasses`, `/contratos`) pra consumir endpoints novos + help inline em cada + breakdown por usina no Dashboard | 2-3h |
| **F.3** | Onboarding — `ConviteProprietario` model + `POST /proprietario/convite` + tela `/proprietario/aceitar-convite/[token]` + template email | 2-3h |
| **F.4** | Smoke + docs — testar pipeline E2E com Luciano simulando proprietário E-Solares + doc-sessão + atualizar inventário/débitos | 1h |
| **Total** | | **8-14h** |

**Sem dependências externas** — F2 do Sub-Sprint Gateways de Pagamento, Sub-Sprint B (script.sql), Sub-Sprint A (advogado), Sub-Sprint E (Assinafy) NÃO bloqueiam.

**Pré-requisito operacional:** Luciano cadastrar a usina cooperebr1 no banco com `proprietarioNome='E-Solares'`, `proprietarioCnpj=...`, `proprietarioEmail=...`, `proprietarioTipo='PJ'`, `formaPagamentoDono='?'` + valores. Pode ser feito agora (Sub-Sprint F não bloqueado por isso).

## 11. Riscos identificados

| ID | Risco | Severidade | Mitigação |
|---|---|---|---|
| R1 | Repasse calculado em runtime (sem histórico real) → proprietário pode ver valor "previsto" diferente do "efetivamente pago" | Média | Banner "Valores previstos com base em geração registrada. Pagamentos reais conforme contrato de arrendamento." + criar `RepasseProprietario` em sprint próprio quando houver fluxo de pagamento real |
| R2 | Integração iSolar Cloud automática NÃO implementada → geração precisa ser inserida manualmente em `GeracaoMensal` pelo admin | Média | Aceitar limitação no MVP — Luciano insere via UI admin. Catalogar débito "D-novo-AL: integrar iSolar Cloud" (~6-10h Code, sprint próprio futuro) |
| R3 | LGPD se Luciano escolher Opção B (cooperados nominais) sem consentimento contratual | Alta | Default Opção A. Toggle Opção B exige declaração explícita do admin "termos da cooperativa permitem" |
| R4 | E-Solares email cadastrado errado em `Usina.proprietarioEmail` → proprietário não consegue logar | Baixa | Tela admin de Usina mostra email cadastrado em destaque + botão "Reenviar convite" |
| R5 | Multi-tenant: SUPER_ADMIN pode ver Portal Proprietário de qualquer usina por troca de contexto — comportamento intencional mas precisa documentar | Baixa | Documentar em help inline "Você está vendo como SUPER_ADMIN — impersonando proprietário X" |
| R6 | Magic link expirado → proprietário não consegue ativar conta | Baixa | TTL 7 dias + botão "Reenviar" no painel admin |
| R7 | Refator futuro pra `Empresa` separada (2ª usina E-Solares) vai exigir migration dos 6 campos `proprietario*` → tabela nova | Baixa (longo prazo) | Catalogar débito "D-novo-AM: extrair Empresa pra entidade separada quando 2ª usina aparecer" |

## 12. Quebra em fases recomendada

Caso vire 2 sessões Code:

- **Sessão 1 (~5-7h):** F.1 (backend completo) + F.2 (frontend corrigido) — entrega Portal Proprietário funcional pra E-Solares logar com login manual + senha temporária (sem magic link ainda)
- **Sessão 2 (~3-7h):** F.3 (onboarding magic link) + F.4 (smoke + docs)

Sessão 1 sozinha já desbloqueia uso operacional (Luciano cria `Usuario` E-Solares com senha temporária, manda credenciais por chat, proprietário loga e vê dados).

## 13. Comparativo SISGDSOLAR legado

Da memória `2026-05-25-descoberta-legado-sisgdsolar-pivot-onboarding.md:25`:

> `tbl_empresa_usina` (+ `contrato_sistema`) → Dono da usina (E-Solares)

O legado tinha **Empresa como entidade separada** + contratos do sistema (`contrato_sistema` parece ser o equivalente ao nosso `Usina.numeroContratoEdp` + valor de arrendamento). NÃO encontrei evidência de portal dedicado pro proprietário no legado — provavelmente E-Solares recebia relatório por email ou planilha. **Greenfield no quesito UX/portal.**

Conexão SCEE / Compensação / Energia injetada (`tbl_usina_energia_injetada_*_kwh`) → nosso `GeracaoMensal`. Mapeamento direto.

Sub-Sprint B (ETL) quando rodar vai precisar **converter `tbl_empresa_usina` pros 6 campos `proprietario*` da Usina** (denormalização proposital). Pra cooperebr1, 1 row em `tbl_empresa_usina` → 1 Usina nova com os campos preenchidos.

## 14. Confirmações necessárias Luciano

Antes de Fase 2:

1. ✅ Aprovar **Opção 3** (denormalização agora, Empresa separada como débito futuro)
2. ✅ Aprovar **Opção 3.a** (criar role `PROPRIETARIO` no enum)
3. ✅ Aprovar **Onboarding magic link** OU "cadastro manual + senha temporária" pro MVP
4. ✅ Aprovar **Anonimização Opção A** padrão (cooperados como #042, #043 etc)
5. ✅ Aprovar **estimativa 8-14h em 4 fases** + topa quebrar em 2 sessões se preferir
6. ✅ Confirmar cadastro da usina cooperebr1 com dados E-Solares como pré-requisito operacional

## 15. Checklist pré-Fase 2

Antes de tocar código:

- [ ] Luciano OK nas 6 decisões §14
- [ ] Backup do banco antes de schema migration F2 (puramente aditiva, mas regra 6 CLAUDE.md aplica)
- [ ] Usina cooperebr1 cadastrada no banco com `proprietarioEmail`, `formaPagamentoDono`, `valorAluguelFixo`/`percentualGeracaoDono`
- [ ] Email cadastro `proprietarioEmail` E-Solares válido (recebe magic link)

---

**Fim Fase 1.** Aguardando OK Luciano nas 6 decisões §14 pra iniciar Fase 2.
