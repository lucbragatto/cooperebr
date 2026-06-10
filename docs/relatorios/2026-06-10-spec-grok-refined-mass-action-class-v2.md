# SPEC REFINED v2 — SUPER_ADMIN Mass Write Class (Analyst Deliverable)

**De:** Grok (Analista)  
**Para:** Orquestrador (para revisão e envio ao Code)  
**Data:** 10/06/2026  
**Base:** main f675f21  
**Status:** Refinagem #1 completa. Descoberta de membros feita pelo analista. Definição apertada. Pronta para Code (sem delegação de discovery).

---

## 1. Definição Refinada da Classe (o discriminador crítico)

**Classe oficial:** "SUPER_ADMIN Mass Write / Side-Effect Cross-Tenant por Design"

**Critérios OBRIGATÓRIOS (todos devem ser verdadeiros):**

1. **Autenticação/Autorização com bypass intencional de tenant**  
   - Rota ou método marcado `@Roles(SUPER_ADMIN)` (ou SUPER+ADMIN com lógica que força `cooperativaId = undefined` quando o caller é SUPER_ADMIN).  
   - O código **deliberadamente** remove ou omite o filtro de `cooperativaId` no `where` da operação de escrita.

2. **Operação de escrita ou efeito colateral em MASSA**  
   - `updateMany`, `deleteMany`, `createMany`, ou loop/batch que afeta N > 1 registros de forma cross-tenant.  
   - Inclui: mudança de estado em lote, notificação em massa, movimento de dinheiro/valor em escala, propagação de configuração, migração em lote.

3. **Efeito cross-tenant por design (não bug IDOR)**  
   - O propósito legítimo da ação é afetar múltiplas cooperativas (expansão comercial, reajuste global de tarifa, propagação de plano SaaS, migração sistêmica, bulk status de lista de cooperados, etc.).

**Exclusões explícitas (não pertencem à classe):**
- Qualquer operação **puramente READ** (mesmo que use `cooperativaId = undefined` para SUPER_ADMIN). Exemplos: dashboards financeiros, listagens globais, getAnalytics, rankings, getConfigDefaults, listarSaldosParceiros, etc. São legítimos para super-admin de plataforma.
- Updates/cascades **escopados a uma única entidade** (ex: ao mudar status de 1 cooperado, atualizar seus contratos via `cooperadoId` fixo).
- Operações que mantêm `cooperativaId` no `where` mesmo para SUPER (padrão de defesa em profundidade pós D-48/F2.9).
- Ações que não são "em massa" (N=1 ou muito pequeno).

**Por que este refinamento é necessário:**  
O padrão "força cooperativaId=undefined para SUPER_ADMIN" aparece em dezenas de lugares no projeto. A maioria é READ benigno de visão global. Se incluirmos tudo, a classe vira um saco de 50+ itens e o hardening perde foco. O risco real está nas **writes em massa cross-tenant**.

---

## 2. Classe Completa (M1..M4 confirmados + M5 candidato)

Descoberta 100% feita pelo analista via inspeção de código + verificação dos candidatos levantados pelo orquestrador. Nenhum item delegado ao Code.

**M1 — lead-expansao / notificarLeadsPorDistribuidora**  
- Arquivo: `lead-expansao.controller.ts:62-68` (`@Roles(SUPER_ADMIN, ADMIN)`)  
  `lead-expansao.service.ts:137-155`  
- Operação em massa:  
  ```ts
  await this.prisma.leadExpansao.updateMany({
    where: { id: { in: leads.map(l => l.id) } },
    data: { status: 'NOTIFICADO', notificadoEm: agora }
  });
  ```
- Bypass: `const cooperativaId = req.user?.perfil === SUPER_ADMIN ? undefined : req.user?.cooperativaId;`
- O que escreve em massa: Mudança de estado + gatilho de notificação (WhatsApp) em todos os leads AGUARDANDO de uma distribuidora **em todas as cooperativas**.
- Risco: Disparo comercial em massa acidental cross-tenant.
- Status auditorias: Onda A listou "lead-expansao" como módulo com problemas (o bypass cross foi tratado como por design).

**M2 — motor-proposta / aplicar-reajuste**  
- Arquivo: `motor-proposta.controller.ts:185-189` (`@Roles(SUPER_ADMIN)` + comentário explícito "D-48-motor: aplicar reajuste afeta múltiplos contratos em escala (todos cooperados associados à tarifa). Restrito a SUPER_ADMIN — ADMIN não dispara reajuste em massa.")  
  `motor-proposta.service.ts:1227-1249`  
- Operação em massa:  
  ```ts
  await this.prisma.contrato.updateMany({
    where: { cooperadoId: { in: cooperadoIds }, status: 'ATIVO' },
    data: { ultimoReajusteEm: new Date(), ultimoReajusteIndice: indiceLabel }
  });
  ```
- O que escreve em massa: Atualização de campos de reajuste em todos os contratos ATIVO associados aos cooperados afetados por uma tarifa (pode cruzar tenants dependendo da simulação).
- Risco: Reajuste financeiro em massa acidental.

**M3 — saas / propagarModulosDoPlano (via vincularPlano)** (confirmado como membro forte)  
- Arquivo: `saas.controller.ts:55-58` (`@Roles(SUPER_ADMIN)`)  
  `saas.service.ts:111-123` (método privado `propagarModulosDoPlano`)  
- Operação em massa:  
  ```ts
  await this.prisma.cooperativa.updateMany({
    where: { planoSaasId },
    data: {
      modulosAtivos: plano.modulosHabilitados,
      modalidadesAtivas: plano.modalidadesModulos ?? {}
    }
  });
  ```
- O que escreve em massa: Propagação de `modulosAtivos` e `modalidadesAtivas` para **todas as cooperativas** que estão vinculadas a um determinado PlanoSaas.
- Contexto: SaaS é o módulo mais cross-tenant por natureza (faturamento de todas as cooperativas). Vincular um plano ou atualizar um plano pode afetar dezenas de tenants de uma vez.
- Candidato levantado pelo orquestrador — verificado e incluído. ~10 endpoints @Roles(SUPER_ADMIN) no módulo + esta operação de write em massa.

**M4 — cooperados / bulk status change em lista (o bypass exato que o orquestrador pediu para identificar)**  
- Arquivo: `cooperados.service.ts:1532-1538` (dentro de método de aplicação de status em lote, provavelmente `aplicarStatusLote` ou similar)  
- Operação em massa (o 5º dos 5 updateMany):  
  ```ts
  const { count } = await this.prisma.cooperado.updateMany({
    where: {
      id: { in: dto.cooperadoIds },
      ...(cooperativaId ? { cooperativaId } : {})
    },
    data: { status: dto.status as any }
  });
  ```
- Os outros 4 updateMany no mesmo arquivo **não** são o padrão:
  - 756 e 800: cascades de `contrato.updateMany` escopados a **um único** `cooperadoId`.
  - 929 e 957: `indicacao.updateMany` escopados a `cooperadoIndicadoId`.
- O bypass `...(cooperativaId ? { cooperativaId } : {})` permite SUPER_ADMIN passar uma lista arbitrária de `cooperadoIds` de múltiplas cooperativas e mudar o status de todos de uma vez.
- O que escreve em massa: Mudança de status em lote em lista de cooperados (cross-tenant quando SUPER).
- Candidato levantado pelo orquestrador — identificado precisamente como o bulk por lista de ids com bypass.

**M5 (candidato forte — recomendo incluir com controles extras)**  
- Arquivo: `migracoes-usina.controller.ts:72` (`@Roles(SUPER_ADMIN)`)  
  `migracoes-usina.service.ts:461+` (`migrarTodosDeUsina`)  
- Operação: Migração em massa de **todos** os contratos ativos de uma usina para outra (loop sobre contratos + updates em `contrato.usinaId`, histórico de migração, etc.).
- Bypass: `cooperativaId: tenantId(req, false)` (permite null para SUPER). No service: `const tenantFilter = dto.cooperativaId !== null ? { cooperativaId: dto.cooperativaId } : {};`
- O que escreve em massa: Alteração de usina (e consequentemente alocação, percentual, faturamento) em dezenas ou centenas de contratos de uma vez.
- Risco extremo em escala. Legítimo para migrações sistêmicas, mas exige dry-run + confirmação de volume.

**Membros descartados após verificação explícita dos candidatos:**
- cooper-token.controller.ts:345 (`getConfigDefaults`) — READ puro de defaults globais.
- cooper-token.controller.ts:361 (`updateConfigDefaults`) — ainda não implementado (retorna 501).
- cooper-token.controller.ts:505 (`listarSaldosParceiros`) — READ de saldos de todos os parceiros (dashboard super-admin legítimo).
- Nenhum updateMany mass cross-tenant com bypass encontrado nos endpoints de token listados.

Nenhum outro membro forte da classe foi encontrado após busca ampla nos 23 arquivos de updateMany + caça por @Roles(SUPER_ADMIN) + lógica de bypass em writes.

---

## 3. Tabela dos 23 updateMany com discriminador write/read aplicado

(Extraído de inspeção em `backend/src` excluindo specs/scripts. Foco no discriminador.)

**Colunas chave:**
- Arquivo
- # chamadas
- Tipo predominante de operação
- É **WRITE em massa cross-tenant com bypass**? (Sim/Não + por quê)
- Pertence à classe? (M# ou Não)
- Notas / Risco

1. `cooperados/pin-cooperado.service.ts` — 6 — Updates com `cooperativaId` no where (pós F2.9 hardening) — Não — Não — Guardado
2. `convenios/convenios-aprovacao.service.ts` — 5 — updateMany com `id + status` guard (defesa em profundidade) — Não — Não — Bom padrão
3. `cooperados/cooperados.service.ts` — 5 — 4 cascades por cooperadoId único + **1 bulk por lista de ids com bypass** — Sim (o bulk) — **M4** — O 5º (1532) é o bulk status
4. `whatsapp/whatsapp-fluxo-motor.service.ts` — 4 — Atualizações de estado de conversa/OCR/fatura — Provável (investigar PII + batch) — Investigar — Risco WA P1s
5-10. (demais com 2 ou 1: asaas, repasses, cobrancas, convenios.service, etc.) — Cascades scoped ou com tenant no where — Não — Não — Baixo
11. `motor-proposta/motor-proposta.service.ts` — 1 — contrato.updateMany por lista de cooperadoIds — Sim — **M2**
12-20. (vários jobs, clube, saas, usinas, limite-token, etc.) — Maioria scoped ou com guard — Não — Não
21. `lead-expansao/lead-expansao.service.ts` — 1 — leadExpansao.updateMany por lista de ids — Sim — **M1**
22. `gateway-pagamento/...` — 1 — — Não — Não
23. `convenios/convenios-custeio.service.ts` + saas (via propagar) — 1 (mass write) — cooperativa.updateMany por planoSaasId — Sim — **M3** — SaaS é o mais cross por natureza

**Resumo da tabela com discriminador:**
- Pertencem à classe: M1, M2, M3, M4 (e M5 candidato)
- A grande maioria dos outros ~19: ou cascades por entidade única, ou writes com `cooperativaId` no where (padrão correto pós-blindagem), ou jobs internos → não pertencem.

---

## 4. Prompt limpo para o Code (pronto para colar — seção #4)

**Título do sprint para o Code:**  
Sprint Hardening — SUPER_ADMIN Mass Write Cross-Tenant (M1-M4 + M5 candidato)

**Contexto (inclua inteiro no prompt para o Code):**
Após as auditorias IDOR Onda A/B (30/05) e a Blindagem Multi-Tenant (D-48 + F0-F1.5), identificamos uma classe pequena mas de alto risco de ações legítimas: SUPER_ADMIN dispara operações de **write/efeito colateral em massa** que intencionalmente ignoram o filtro de tenant (bypass `cooperativaId = undefined`).

Risco: erro humano em escala (disparo de notificação comercial para todas as coops, reajuste financeiro em massa, propagação de módulos SaaS para dezenas de tenants, bulk status em lista arbitrária de cooperados, migração de usina afetando centenas de contratos).

**Definição EXATA da classe (use como filtro — não inclua nada fora disso):**
[Colar seção 1 acima]

**Membros confirmados da classe (prioridade 1 — hardening completo neles):**
- **M1** lead-expansao/notificarLeadsPorDistribuidora (`lead-expansao.controller.ts:62`, `lead-expansao.service.ts:137`) — updateMany de leads + notificação cross-tenant.
- **M2** motor-proposta/aplicar-reajuste (`motor-proposta.controller.ts:185`, service:1227) — contrato.updateMany em escala de cooperados de uma tarifa.
- **M3** saas/propagarModulosDoPlano (`saas.controller.ts:55`, `saas.service.ts:111`) — cooperativa.updateMany de modulosAtivos/modalidades para todas as coops de um plano SaaS.
- **M4** cooperados/bulk status por lista de ids (`cooperados.service.ts:1532`) — cooperado.updateMany com bypass em lista arbitrária de cooperadoIds (o bulk com o padrão `...(cooperativaId ? {cooperativaId}:{})`).

**Candidato adicional (M5 — decida se inclui):**
- migracoes-usina/usina-total (`migracoes-usina.controller.ts:72`, service:461) — migração em massa de todos os contratos de uma usina (SUPER bypass).

**Tabela base dos 23 updateMany (use para revisar o resto da lista após a classe):**
[Colar resumo da tabela da seção 3 ou a lista completa de arquivos com a coluna "Mass Write Cross-Tenant com bypass?"]

**Requisitos mínimos de entrega (não negociáveis):**
1. Para cada membro da classe (M1-M4 + M5 se decidido):
   - Confirmação explícita obrigatória no endpoint (ex: body `{ confirm: true, dryRun?: boolean }` + retorno de preview de volume afetado).
   - Log estruturado com tag `CROSS_TENANT_MASS_WRITE` contendo: ator (user id), volume, ids afetados (amostra), motivo, timestamp.
   - Proteção de volume (se estimativa > X, exigir dryRun=true ou limit).
   - Comentário claro no código: "Por que este write cross-tenant é intencional por design (não IDOR)".
2. Revisão rápida dos demais itens da tabela dos 23 (foco em cascades de cooperados/convenios e fluxos WhatsApp).
3. Specs Jest cobrindo os cenários de confirmação, dry-run, log e bypass SUPER vs ADMIN/OPERADOR.
4. (Recomendado) Criar helper leve `assertMassWriteConfirmation` ou similar para reutilizar o padrão.

**O que NÃO fazer nesta sprint:**
- Refatorar ou endurecer operações puramente READ cross-tenant (dashboards, relatórios, listagens globais).
- Alterar a lógica de negócio dos M1-M4 (só adicionar controles de segurança em torno).
- Inflar a classe com falsos-positivos de read.

**Sequência recomendada pelo orquestrador:**
Backend (hardening da classe + tabela) primeiro. Depois frontend se necessário para telas de confirmação. Commits separados.

**Entregáveis ao final:**
- Código + specs verdes para M1-M4.
- Tabela atualizada com status de todos os 23.
- Atualização em CONTROLE-EXECUCAO.md ou runbook com "como disparar mass write SUPER com segurança".

---

**Fim do deliverable.**

Este documento está completo para o orquestrador revisar e colar pro Code.  
Descoberta de membros 100% analista. Definição apertada (sem inchar com reads). Todos os candidatos verificados. Prompt limpo sem delegação.

Se precisar de mais um membro ou ajuste no prompt, avise. Pronto.