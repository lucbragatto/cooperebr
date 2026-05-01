# Investigação — Fluxo de link de convite por convênio

**Data:** 01/05/2026
**Modo:** read-only.
**Aplica regra de validação prévia + retomada.**

---

## Verificação prévia aplicada

Cruzou:
- **Memória da sessão** (mapeamento sprints, validação Sprint 15+21).
- **Documentação histórica:**
  - `docs/specs/PLANO-CONVENIOS-2026-04-01.md` (51 KB, 1456 linhas)
  - `docs/sessoes/2026-04-24-investigacao-convenios.md` (Sprint 9b)
  - `docs/sessoes/2026-04-24-cadeia-hangar-distribuicao.md`
  - `docs/sessoes/2026-04-23-sprint9-teste-e2e.md`
  - `docs/sessoes/2026-04-29-validacao-invs-4-8.md` (INV 6)
- **Código real:** `publico.controller.ts`, `convenios-membros.service.ts`, `financeiro/convenios.service.ts`, frontend `/cadastro` + `/convite/[codigo]`.
- **Banco real** (snapshot 01/05).

---

## 1. Rotas públicas de cadastro

| Rota | Frontend | Backend | Aceita parâmetro de convênio? |
|---|---|---|---|
| `/cadastro` | `web/app/cadastro/page.tsx` (1400+ linhas) | `POST /publico/cadastro-web` | **Não direto** — aceita `?ref=CODIGO_DO_INDICADOR` (`searchParams.get('ref')` na linha 144). NÃO há `?convenio=ID`. |
| `/convite/[codigo]` | `web/app/convite/[codigo]/page.tsx` | `GET /publico/convite/:codigo` + `POST /publico/iniciar-cadastro` com `codigoRef` | **Não direto** — `codigo` da URL é `codigoIndicacao` do indicador, não convênio. |
| `/entrar` | (rota lead WhatsApp) | `POST /publico/iniciar-cadastro` | Não. |

**Conclusão:** **não existe `/cadastro?convenio=ID` ou `/convite-convenio/[token]` específico.** O sistema usa `codigoIndicacao` do indicador como ponte.

---

## 2. Lógica que cria ConvenioCooperado — 4 pontos no código

| # | Arquivo:linha | Quem chama | Cria com `indicacaoId`? |
|---|---|---|---|
| 1 | `convenios-membros.service.ts:59` | Admin via `POST /convenios/:id/membros` (UI dashboard) | **Sim** — chama `registrarIndicacaoConvenio()` se `convenio.registrarComoIndicacao=true` (linha 72-78) |
| 2 | `convenios-membros.service.ts:185` | Admin via importação CSV em massa | Sim (mesmo fluxo) |
| 3 | `financeiro/convenios.service.ts:93` | Service legado | (não auditado, provavelmente sem indicacaoId) |
| 4 | **`publico.controller.ts:464`** | **Fluxo público `/cadastro?ref=CODIGO`** | **Não** — cria direto via `prisma.convenioCooperado.create({convenioId, cooperadoId, ativo:true})` sem `indicacaoId` |

### Detalhe do ponto 4 (caminho público — Sprint 9B)

```ts
// publico.controller.ts:436-475
if (body.codigoRef) {
  await this.indicacoes.registrarIndicacao(cooperadoId, body.codigoRef);

  // Sprint 9B: vincular ao convênio se indicador é membro/conveniado
  const indicador = await this.prisma.cooperado.findUnique({
    where: { codigoIndicacao: body.codigoRef }, ...
  });
  if (indicador) {
    // Buscar convênio do indicador (como conveniado OU membro)
    const conveniado = await this.prisma.contratoConvenio.findFirst({
      where: { conveniadoId: indicador.id, status: 'ATIVO' }, ...
    });
    const membro = !conveniado ? await this.prisma.convenioCooperado.findFirst({
      where: { cooperadoId: indicador.id, ativo: true }, ...
    }) : null;
    const convenioId = conveniado?.id ?? membro?.convenioId;

    if (convenioId) {
      // Cria vínculo SEM indicacaoId
      await this.prisma.convenioCooperado.create({
        data: { convenioId, cooperadoId, ativo: true },
      });
    }
  }
}
```

**Comportamento real:**
- Cooperado se cadastra com `?ref=CODIGO_DE_CARLOS`
- Sistema **busca convênio do Carlos** (como conveniado ou membro)
- Vincula automaticamente o novo cooperado ao **mesmo convênio do Carlos**
- **Funciona com cascata** — se Carlos é membro de CV-HANGAR (não conveniado), funciona igual

---

## 3. Origem dos 215 ConvenioCooperado atuais

```
Total ConvenioCooperado:  215
  com indicacaoId:        0  ← TODOS sem FK pra Indicacao
  sem indicacaoId:        215

Distribuição por data:    215 todos em 2026-04-23 (Sprint 9b seed)
```

**Primeiros 3 registros (CV-HANGAR):**
- 2026-04-23 12:58 | Prof. Carol Silva | indicacaoId=— | adesão=23/04 | cooperado criado em 23/04
- 2026-04-23 12:58 | Prof. Marcos Oliveira | indicacaoId=— | mesma data
- 2026-04-23 12:58 | Prof. Patricia Santos | indicacaoId=— | mesma data

**Últimos 3 registros (CV-MORADAS):**
- 2026-04-23 13:00 | Morador Apto 1003-1005 | mesma data

**Conclusão:** **TODOS os 215 vêm do SEED do Sprint 9b** (commit `f9f23a7` "seed hangar e moradas da enseada com fixtures reais"). Nenhum cooperado real entrou via fluxo de cadastro público.

---

## 4. Fluxo MLM atual (`/cadastro?ref=`) cobre convênio?

**Resposta: SIM, com ressalvas.**

### O que funciona ✅

- Cooperado se cadastra via `?ref=CODIGO_DE_CARLOS`
- `Indicacao` criada (status PENDENTE → PRIMEIRA_FATURA_PAGA quando paga)
- **Sprint 9B (publico.controller.ts:464):** se Carlos é conveniado ou membro de algum convênio ativo, novo cooperado **automaticamente vira `ConvenioCooperado`** do mesmo convênio
- Ganha desconto da faixa atual do convênio

### O que NÃO funciona ⚠️

- **`indicacaoId` não é preenchido** no caminho público — quebra rastreabilidade (admin não consegue ver "este vínculo veio da indicação X")
- **Faixa NÃO é recalculada** automaticamente — `recalcularFaixa()` é chamado no `adicionarMembro()` do service de membros (linha 81), mas o caminho público pula essa chamada. Resultado: novo membro adicionado, mas faixa do convênio não atualiza até cron próximo
- **Sem notificação** ao conveniado (Carlos/Helena) de que membro novo entrou
- **Não diferencia** vínculo via convite explícito vs vínculo lateral por indicação

### Inconsistência de pipelines

| Caminho | indicacaoId? | recalcularFaixa? | Notificação WA/email? |
|---|---|---|---|
| Admin via `POST /convenios/:id/membros` | ✅ sim | ✅ sim | (depende de cron) |
| Admin via importação CSV em massa | ✅ sim | ✅ sim (1 vez no fim) | depende |
| Público via `/cadastro?ref=` | ❌ não | ❌ não | ❌ não |

**Confirmado em INV-6 (29/04):** "Não há cruzamento entre Convênios e Indicações no código" — mas isso era sobre **regra de exclusão** (não há regra "se está em convênio, MLM desativa"). O Sprint 9B implementou **vínculo paralelo** (cria ambos) mas com bug de rastreabilidade.

---

## 5. PLANO-CONVENIOS-2026-04-01.md — o que estava previsto

A spec (1456 linhas) prevê apenas vias **admin** (POST /convenios/:id/membros + importação CSV). Não há spec de:
- Endpoint público `/publico/convite-convenio/:token`
- Token específico de convênio (com `convenioId` embutido)
- Síndico/conveniado gerar link próprio (apenas usar `codigoIndicacao` pessoal)

**Spec linha 722:**
> "Se `registrarComoIndicacao=true` e conveniado é cooperado: registrar indicação via `IndicacoesService`"

Esse princípio só é aplicado no caminho admin. O caminho público implementa a versão "lateral" (Sprint 9B) que **não bate** com a spec.

---

## 6. Lacuna confirmada?

**SIM, há 4 lacunas reais:**

### Lacuna #1 — Sem token de convite específico de convênio
Síndico Helena hoje compartilha `https://sisgd.com/cadastro?ref=HELENA123` — depende do `codigoIndicacao` pessoal dela. Não há `?convenio=CV-MORADAS` ou token dedicado.

### Lacuna #2 — Caminho público não popula `indicacaoId`
`publico.controller.ts:464` cria `ConvenioCooperado` sem FK pra `Indicacao`. Quebra rastreabilidade.

### Lacuna #3 — Caminho público não recalcula faixa
Faixa de desconto progressivo só recalcula quando admin adiciona via UI (ou no cron diário). Cooperado novo via `?ref=` entra mas faixa não sobe na hora.

### Lacuna #4 — Sem notificação ao conveniado
Carlos/Helena não recebem WA/email quando membro novo entra via fluxo público. Spec planejou (Fase 9 do PLANO-CONVENIOS) mas não foi implementado.

---

## 7. Escopo estimado pra resolver

### Backend (4 tarefas)

1. Padronizar caminho público pra **chamar `convenios-membros.service.adicionarMembro()`** em vez de criar via Prisma direto — preencheria `indicacaoId`, recalcularFaixa e notificação automaticamente.
2. Adicionar endpoint público `GET /publico/convite-convenio/:codigo` que aceita código + retorna info do convênio (nome, faixa atual, # membros) pra mostrar landing personalizada.
3. Schema novo: `Indicacao.convenioId?` (FK opcional) pra diferenciar indicações de convênio.
4. Cron de recálculo de faixa quando vínculo público criado (já existe cron diário; só garantir que pega).

### Frontend (3 tarefas)

1. Página `/convite-convenio/[codigo]` com landing personalizada ("Você foi convidado por Helena pro convênio Moradas da Enseada").
2. Atualizar `/convite/[codigo]/page.tsx` pra detectar se o indicador é conveniado e exibir branding do convênio.
3. Tela admin `/dashboard/convenios/[id]/links` pra gerar/compartilhar links exclusivos.

### Estimativa total

- **3-5 dias** de Code dedicado se for incremento mínimo (lacunas #2, #3, #4 + landing simples).
- **7-10 dias** se incluir token dedicado de convênio (`?convenio=ID`) + tela de geração de links (lacunas 1-4).

---

## 8. Recomendação Code

**Não bloqueia produção real.** Sistema atual já vincula automaticamente cooperados a convênios via `?ref=`. Lacunas são de UX (sem landing personalizada) e auditoria (sem `indicacaoId`).

**Prioridade:**
- Lacuna #2 (popular `indicacaoId`) — fácil, P2 de auditoria. **Fix em 30 min.**
- Lacuna #3 (recalcularFaixa) — P2 importante. **Fix em 1h.**
- Lacuna #4 (notificação) — P3, depende de Sprint 1 (FaturaSaas Completo) ter Asaas/comunicação prontos.
- Lacuna #1 (token de convênio dedicado) — P3, deferir até pós-Asaas-produção.

**Sugestão:** abrir débito P2 isolado pra lacunas #2 + #3 (~1.5h Code). Lacuna #1 + #4 entram em "sugestões pendentes" (`sugestoes_pendentes.md`).

---

*Investigação read-only conduzida por Claude Code (Opus 4.7) em 2026-05-01.*
*Aplica regra de validação prévia + retomada.*
*Insumos: código real + banco real + 5 sessões anteriores + spec PLANO-CONVENIOS.*
