# Fase 1 read-only — Sprint Housekeeping: triagem dos 12 débitos D-novo-U a AF

> 25/05/2026 — escolhido como frente paralela enquanto `script.sql` do hb06a não chega (Sub-Sprint B pivot ETL bloqueado).
> Decisão 23 ativa. Investigação read-only. Nada foi tocado em código, schema, banco ou build.

## TL;DR (5 linhas)

Dos 12 débitos catalogados ao longo do Sprint Bot Autoatendimento (M17→M24), **6 são LIMPEZA PURA** que cabem confortavelmente em 1 sessão (~3-4h Code), **3 REQUEREM DECISÃO PRODUTO** do Luciano antes de fix, **2 são SCOPE MAIOR** (sprint próprio) e **1 fica BORDERLINE pós-validação produção**. Recomendo arrancar com os 6 de limpeza pura + 1 decisão produto rápida (D-novo-Y reuso ou delete) — **escopo realista 3-4h Code**. Risco colateral controlado: 4 specs do motor sobre `CONSULTAR_PROXIMA_FATURA` precisam ser ajustados/removidos se D-novo-AF for executado (impacta suite 234→230). Achado bônus: `cobrancas.job.ts` tem 3 queries Cobranca usando `PENDENTE` (escopo D-novo-U expandido — mas todos são DEFENSIVOS, não-bugs).

---

## Tabela executiva — 12 débitos classificados

| # | Débito | Severidade | Descrição curta | Arquivos | Tempo real | Classificação | Decisão produto? |
|---|---|---|---|---|---|---|---|
| 1 | **D-novo-U** | P2 | Handler hardcoded "ver fatura" usa `status: PENDENTE` (canônico é `A_VENCER`) | `whatsapp-bot.service.ts:793` | **5-10min** (1 linha) | 🟢 LIMPEZA PURA | Não |
| 2 | **D-novo-V** | P3 | Engine de template `{{#if}}/{{#unless}}` pros modelos saldo/fatura | motor + modelos BD | **8-12h** | 🔴 SCOPE MAIOR | Não (depende Iniciativa Fluxos D-novo-T) |
| 3 | **D-novo-W** | P3 | Divergência NPS: hardcoded → CONCLUIDO, motor → MENU_COOPERADO | `whatsapp-bot.service.ts:4033` | **5min** (1 linha) | 🟢 LIMPEZA PURA | Não |
| 4 | **D-novo-X** | P3 | `agendarNps()` dead code (zero callers) | `whatsapp-bot.service.ts:3990-4011` | **5-10min** | 🟢 LIMPEZA PURA | Não |
| 5 | **D-novo-Y** | P3 | Modelo `nps_trimestral` órfão no seed | `seed-fluxo-padrao.ts:140` | **5min** | 🟡 DECISÃO PRODUTO | **Sim — delete OU reservar?** |
| 6 | **D-novo-Z** | P3 | Divergência Cadastro Proxy hardcoded × motor (resetarConversa, economiaMensal) | `whatsapp-bot.service.ts:3370,3279` | **15-30min** (opção a) | 🟢 LIMPEZA PURA | Não (opção (a) — alinhar hardcoded) |
| 7 | **D-novo-AA** | P3 | Cooperado proxy fica com placeholders `PROXY_${ts}` eternos | cron novo + filtro UI | **2-3h** | 🟡 DECISÃO PRODUTO | **Sim — cron simples OU refator** |
| 8 | **D-novo-AB** | P2 | `handleAtualizacaoContrato` hardcoded viola decisão B do Bloco 5 | `whatsapp-bot.service.ts:3848` | **~30min** | 🟡 BORDERLINE (pós-prod) | Não (esperar 1-2 sprints de validação prod) |
| 9 | **D-novo-AC** | P2 | `MENU_INADIMPLENTE` + `iniciarFluxoInadimplente` dead code | bot + seed | **30-45min** | 🟢 LIMPEZA PURA | Não |
| 10 | **D-novo-AD** | P1 | `NEGOCIACAO_PARCELAMENTO` placeholder hackish, regra de negócio não definida | bot + Asaas | **12-20h** | 🔴 SCOPE MAIOR + DECISÃO PRODUTO | **Sim — qual regra?** (sprint próprio) |
| 11 | **D-novo-AE** | P2 | `handleMenuFatura` + `handleComprovantePagamento` hardcoded violam decisão C | bot + atalho palavra-chave | **45-60min** | 🟡 BORDERLINE (pós-prod) | Não (esperar 1-2 sprints) |
| 12 | **D-novo-AF** | P3 | Etapa `VER_PROXIMA_FATURA` + ação `CONSULTAR_PROXIMA_FATURA` órfãs pós-Bloco 8 | motor + seed + 4 specs | **20-30min** | 🟡 BORDERLINE (rollback fácil) | Não (esperar 1-2 sprints) |

### Resumo por classificação

| Tipo | Quantidade | Total tempo (faixa) |
|---|---|---|
| 🟢 **LIMPEZA PURA** (executável agora) | 6 (U, W, X, Z, AC, +Y se delete) | **~1h05-1h45** |
| 🟡 **DECISÃO PRODUTO RÁPIDA** (5min decisão + executa) | 2 (Y, AA) | +5min+2-3h |
| 🟡 **BORDERLINE pós-validação produção** (esperar 1-2 sprints) | 3 (AB, AE, AF) | (não executar agora) |
| 🔴 **SCOPE MAIOR** (sprint próprio) | 2 (V, AD) | 20-32h (futuro) |

---

## Validação read-only — confirmação contra o código atual

Cheguei nos arquivos e linhas mencionados em cada débito pra confirmar que ainda existem (nenhum foi resolvido por engano em outro commit). **Todos os 12 ainda estão presentes** no código:

| Débito | Confirmação | Linha atual |
|---|---|---|
| D-novo-U | ✅ Ainda existe | `whatsapp-bot.service.ts:793` `status: { in: ['PENDENTE', 'VENCIDO'] as any[] }` |
| D-novo-V | ✅ Lógica hardcoded ainda no motor | `whatsapp-fluxo-motor.service.ts` — `executarConsultarSaldoCreditos` + `executarConsultarProximaFatura` |
| D-novo-W | ✅ `finalizarConversa` chamado em `handleNpsNota` | `whatsapp-bot.service.ts:4033` |
| D-novo-X | ✅ `agendarNps` definido sem callers | `whatsapp-bot.service.ts:3990` |
| D-novo-Y | ✅ Modelo seed `nps_trimestral` presente | `prisma/seed-fluxo-padrao.ts:140` |
| D-novo-Z | ✅ `handleConfirmarProxy` chama `resetarConversa`; `handleAguardandoFaturaProxy` calcula proposta | `whatsapp-bot.service.ts:3279,3370` |
| D-novo-AA | ✅ Placeholders `PROXY_${ts}` + `proxy_${ts}@pendente.cooperebr` em uso pelo motor | motor + bot |
| D-novo-AB | ✅ `handleAtualizacaoContrato` ainda definido | `whatsapp-bot.service.ts:3848` |
| D-novo-AC | ✅ Tudo presente: `iniciarFluxoInadimplente:2670` + `handleMenuInadimplente:2715` + estados no switch | `whatsapp-bot.service.ts:537-541, 2670+` |
| D-novo-AD | ✅ `handleNegociacaoParcelamento` placeholder presente | `whatsapp-bot.service.ts:2791` |
| D-novo-AE | ✅ `handleMenuFatura:3457` + `handleRespostaMenuFatura:3563` + `handleComprovantePagamento:3691` + atalho `processarMensagem:390` | `whatsapp-bot.service.ts` |
| D-novo-AF | ✅ Etapa `f-ver-proxima-fatura` no seed + case `CONSULTAR_PROXIMA_FATURA:507` no motor + método `executarConsultarProximaFatura` no motor | motor + seed |

### Achado bônus — escopo D-novo-U pode expandir

O débito original menciona apenas `whatsapp-bot.service.ts:793`. Mas grep amplo encontrou **3 outras queries em `cobrancas.job.ts`** usando `status: PENDENTE` em Cobranca:

| Arquivo | Linha | Query | Análise |
|---|---|---|---|
| `cobrancas/cobrancas.job.ts` | 45 | `status: { in: ['A_VENCER', 'PENDENTE'] }` — cron lembrete D-3/D-1 | 🟢 DEFENSIVO (aceita ambos) — não-bug |
| `cobrancas/cobrancas.job.ts` | 130 | `status: { in: ['A_VENCER', 'PENDENTE'] }` — cron marcar VENCIDO | 🟢 DEFENSIVO — não-bug |
| `cobrancas/cobrancas.job.ts` | 216 | `status: { in: ['PENDENTE', 'A_VENCER', 'VENCIDO'] }` — cron notificar vencidas WA | 🟢 DEFENSIVO — não-bug |

Esses 3 usos **incluem A_VENCER + PENDENTE** (defensivos), não excluem como o `whatsapp-bot.service.ts:793` fazia. **Não são bugs**. Mas vale notar no fix: incluir comentário explicando por que mantém `PENDENTE` por defesa.

### Achado bônus — D-novo-AF tem dependência de specs

A suite do motor tem **4 referências a `CONSULTAR_PROXIMA_FATURA` / `VER_PROXIMA_FATURA`** (linhas 1789-1880 do spec). Se executar D-novo-AF (remover case do motor), preciso:

- Ou remover todo o `describe('executarAcao(CONSULTAR_PROXIMA_FATURA)') — via processarComFluxoDinamico`)` (~50 linhas, 4 specs)
- Ou manter a ação no motor mas remover do banco (etapa órfã sem callers)

**Trade-off:** remover specs = perde rede de proteção sobre essa ação se ela for re-usada futuramente. Recomendação: **NÃO executar D-novo-AF agora** — manter como rollback de emergência, esperar 1-2 sprints em produção.

---

## Detalhamento dos 6 candidatos a "executar nesta sessão"

### #1 — D-novo-U (5-10 min) — 🟢 LIMPEZA PURA

**Fix:** trocar `status: { in: ['PENDENTE', 'VENCIDO'] }` por `status: { in: ['A_VENCER', 'VENCIDO'] }` em `whatsapp-bot.service.ts:793`.

**Mitigação extra:** adicionar comentário `// D-novo-U fix 2026-05-25: A_VENCER é canônico em vez de PENDENTE`. Considerar `['A_VENCER', 'PENDENTE', 'VENCIDO']` se quiser defesa (igual aos crons de `cobrancas.job.ts`).

**Risco colateral:** baixo. Handler é fallback raro (motor dinâmico tem precedência via Bloco 3). Mas se algum tenant subir sem etapa dinâmica, esse handler volta a executar — fix evita regressão.

### #3 — D-novo-W (5 min) — 🟢 LIMPEZA PURA

**Fix:** trocar `await this.finalizarConversa(conversa.id)` por `await this.prisma.conversaWhatsapp.update({ where: { id: conversa.id }, data: { estado: 'MENU_COOPERADO' } })` no `handleNpsNota` (linha 4033).

**Risco colateral:** baixo. Motor já transiciona pra MENU_COOPERADO. Hardcoded fica consistente.

### #4 — D-novo-X (5-10 min) — 🟢 LIMPEZA PURA

**Fix:** deletar o método `agendarNps` (linhas 3990-4011). Verificar se há referência em outros arquivos (já confirmei: zero callers).

**Risco colateral:** zero. Dead code.

### #6 — D-novo-Z (15-30 min) — 🟢 LIMPEZA PURA (opção a)

**Fix opção (a):** trocar `resetarConversa(telefone)` por `update({estado: 'MENU_COOPERADO'})` no `handleConfirmarProxy` (linha 3440). Manter cálculo de proposta no hardcoded por enquanto (degradação aceitável vs motor sem proposta).

**Risco colateral:** baixo. Motor já transiciona pra MENU_COOPERADO. Cooperado fica disponível pra continuar.

### #9 — D-novo-AC (30-45 min) — 🟢 LIMPEZA PURA

**Fix:**
1. Remover `iniciarFluxoInadimplente` (linhas 2670-2713) — zero callers confirmados
2. Remover `handleMenuInadimplente` (linhas 2715-2789) + `handleNegociacaoParcelamento` (linhas 2791-2849)
3. Remover `case 'MENU_INADIMPLENTE'` + `case 'NEGOCIACAO_PARCELAMENTO'` do switch (linhas 537-541)
4. Remover `'NEGOCIACAO_PARCELAMENTO'` da whitelist `ESTADOS_FLUXO_ATIVO` (linha 384)
5. Remover `'MENU_INADIMPLENTE'` + `'NEGOCIACAO_PARCELAMENTO'` do seed `seed-fluxos-bot.mjs` (etapas `f-inadimplente` etc — confirmar nomes)

**⚠️ Atenção crítica — interação com D-novo-AD:**

D-novo-AC propõe remover `handleNegociacaoParcelamento` também — MAS D-novo-AD é P1 sobre essa mesma função (placeholder que precisa virar regra real). **Conflito potencial.**

**Decisão necessária pra D-novo-AC funcionar:**
- (i) Remover `handleNegociacaoParcelamento` AGORA junto com D-novo-AC. Quando D-novo-AD virar sprint, a equipe escreve a implementação real do zero. Workaround atual no motor (`SOLICITAR_NEGOCIACAO_HUMANA`) já cobre o fluxo.
- (ii) Manter `handleNegociacaoParcelamento` por enquanto. D-novo-AC remove só `MENU_INADIMPLENTE`/`iniciarFluxo`/`handleMenuInadimplente`. D-novo-AD ainda vai precisar mexer no `handleNegociacaoParcelamento` quando rodar.

**Recomendação:** opção (i). O motor já tem `SOLICITAR_NEGOCIACAO_HUMANA` cobrindo o fluxo conversacional. Dead code junto pra simplificar.

**Risco colateral:** muito baixo. `MENU_INADIMPLENTE` nunca executa em produção (confirmado Fase 1 Bloco 8).

### #5 — D-novo-Y (5 min) — 🟡 DECISÃO PRODUTO RÁPIDA

**Pergunta Luciano:** o modelo `nps_trimestral` no seed (`seed-fluxo-padrao.ts:140`) é **(a)** pra reservar pra um cron trimestral pós-cadastro que vai existir no futuro OU **(b)** simplesmente lixo a deletar?

**Análise técnica:**
- Se Luciano escolher (b) "lembrete NPS após 3 meses" como roadmap claro → vale manter. Mudar status pra comentário "// reservado pra cron trimestral pós-cadastro"
- Se Luciano não tem plano concreto → deletar (5 min).

**Recomendação:** apresentar a pergunta na abertura. **Se Luciano não souber, default = delete** (pode recriar quando precisar).

**Risco colateral:** zero em ambos os casos.

---

## Detalhamento dos 3 BORDERLINE / pós-validação produção

### D-novo-AB (~30 min) — Handler `handleAtualizacaoContrato` hardcoded

**Por que NÃO executar agora:** o motor dinâmico do Bloco 5 (M23) acabou de subir. Validação real em produção ainda não rodou (cooperebr1 não tem cooperados reais com contrato hoje além de Carolina canário). O hardcoded é **inalcançável** com etapa dinâmica ATIVA — fica como rollback de emergência caso algo quebre.

**Recomendação:** esperar 1-2 sprints em produção pós-onboarding cooperebr1. Quando Luciano confirmar que motor + tela admin funcionam estáveis com cooperados reais, executar.

### D-novo-AE (~45-60 min) — `handleMenuFatura` + atalho palavra-chave

**Por que NÃO executar agora:** mesmo motivo do AB — motor Bloco 8 acabou de subir (M24, ontem). Atalho palavra-chave `fatura/boleto/pix` ainda serve como fallback robusto pra cooperados que digitam termos fora do menu.

**Recomendação:** esperar 1-2 sprints. Junto com AB.

### D-novo-AF (~20-30 min) — Etapa `VER_PROXIMA_FATURA` órfã

**Por que NÃO executar agora:** 4 specs do motor ainda exercitam `CONSULTAR_PROXIMA_FATURA`. Remover ação + etapa quebra suíte (234 → 230 verdes). **Custo extra:** ajustar/remover 4 specs (~30 min extra).

Mais grave: a memória `D-novo-AF` indica "rollback de emergência" — manter a etapa permite reverter pra `2 → VER_PROXIMA_FATURA` rapidamente se cooperados se queixarem do menu novo Bloco 8.

**Recomendação:** esperar 1-2 sprints. Junto com AE.

---

## Detalhamento dos 2 SCOPE MAIOR (sprint próprio)

### D-novo-V — Engine de template `{{#if}}/{{#unless}}` (8-12h)

**Por que NÃO entra:** refator não-trivial, requer design + specs Jest + porte dos 2 modelos atuais + retrocompat. Faz mais sentido como Fase 1 da **Iniciativa Fluxos Customizáveis** (D-novo-T) — sub-componente "Biblioteca de Ações + Template Engine flexível".

**Recomendação:** sprint próprio quando Iniciativa Fluxos Customizáveis começar (longo prazo, 100-200h+).

### D-novo-AD — `NEGOCIACAO_PARCELAMENTO` regra real (12-20h)

**Por que NÃO entra:** P1 lacuna produto. Depende de **decisão de produto Luciano** sobre regra de negociação real (Asaas parcelable / geração manual N cobranças / link humano permanente). Sprint dedicado.

**Recomendação:** sprint próprio quando Luciano tiver política clara de parcelamento. **Workaround atual** `SOLICITAR_NEGOCIACAO_HUMANA` (link humano via Notificacoes) cobre o fluxo enquanto isso.

**Pergunta antecipada pro Luciano** (não bloqueia este sprint, mas é boa hora pra pensar):

> **Quando a equipe negociar parcelamento com um cooperado inadimplente, qual deve ser o fluxo no sistema?**
>
> Opções catalogadas:
>
> (A) **Link humano permanente** — bot só conecta com equipe (`SOLICITAR_NEGOCIACAO_HUMANA`). Equipe processa fora do sistema (planilha, WhatsApp pessoal, telefone). Cobrança permanece única. **Mais simples, sem código novo.**
>
> (B) **Geração manual de N cobranças filhas** no sistema — admin abre `/dashboard/cobrancas/<id>/parcelar`, escolhe N parcelas (2x/3x/Nx), sistema cria N registros `Cobranca` com `mesReferencia/anoReferencia` futuros. Cada parcela vira boleto Asaas separado. Cobrança original vira "PARCELADA". **Médio esforço, sem integração nova.**
>
> (C) **Asaas parcelable nativo** — usa `POST /payments` com `installmentCount: N` + `installmentValue: V`. Asaas gera as N cobranças e gerencia o ciclo. Sistema SISGD apenas registra que houve parcelamento. **Maior esforço, integração nova com Asaas, mas mais automatizado.**
>
> (D) **Híbrido** — bot oferece (A) link humano por default. Painel admin oferece (B) manual quando equipe decide ativar. (C) fica pra futuro.

---

## Ordem recomendada de limpeza (Sprint Housekeeping, 1 sessão)

### Sequência sugerida (do mais simples ao mais complexo, com dependências)

```
Etapa A — Validações 1-linha (15 min total):
  1. D-novo-U (5-10 min): bug PENDENTE → A_VENCER no bot.service:793
  2. D-novo-W (5 min): finalizarConversa → MENU_COOPERADO no handleNpsNota
  
Etapa B — Deletes seguros (45 min total):
  3. D-novo-X (5-10 min): delete agendarNps + verificar imports
  4. D-novo-AC (30-45 min): remove MENU_INADIMPLENTE + iniciarFluxoInadimplente +
     handleMenuInadimplente + handleNegociacaoParcelamento + estados switch +
     ESTADOS_FLUXO_ATIVO whitelist + seed fluxos. RESPONDE D-novo-AD
     antecipadamente (opção i — remove placeholder agora).
  
Etapa C — Alinhamento UX hardcoded (15-30 min):
  5. D-novo-Z (15-30 min): resetarConversa → MENU_COOPERADO no handleConfirmarProxy

Etapa D — Decisão produto rápida + execução (5-10 min):
  6. D-novo-Y (5 min após decisão Luciano): delete OU comentário reservado

Etapa E — Smoke regression + commits + fechamento (45-60 min):
  7. npx jest whatsapp-fluxo-motor.service.spec.ts (esperado 234/234)
  8. npm run build (esperado clean)
  9. Sequência commits pequenos (um por débito ou consolidado por etapa)
  10. Atualizar docs/debitos-tecnicos.md removendo os fechados
  11. Fechamento canônico (doc-sessão + frase retomada + push)
```

**Estimativa total realista:** **2h45 - 3h45** Code + **5 min decisão Luciano** (D-novo-Y).

### Decisão Luciano antecipada (Etapa Decisão Produto)

> **2 perguntas pra responder antes de eu arrancar a execução:**
>
> 1. **D-novo-Y** — `nps_trimestral` no seed: (a) delete (b) reservar pra cron futuro? **Recomendo (a) delete** se não tem plano concreto. Pode recriar quando virar sprint.
>
> 2. **D-novo-AD** — `handleNegociacaoParcelamento` placeholder: junto com D-novo-AC eu posso removê-lo agora (opção i — workaround SOLICITAR_NEGOCIACAO_HUMANA já cobre) OU manter pra futura implementação da regra real? **Recomendo remover agora** — reduz superfície de manutenção. Quando a regra real vier, escreve do zero.

---

## Riscos colaterais e mitigações

### Risco 1 — D-novo-AC remove `handleNegociacaoParcelamento` (depende decisão Luciano)

**Risco:** se Luciano quiser manter o placeholder enquanto pensa na regra de D-novo-AD, não pode remover.
**Mitigação:** decisão pendente acima (recomendação: opção (i) remove agora).

### Risco 2 — D-novo-AC quebra alguma referência em arquivos não-bot

**Risco:** outros arquivos podem importar/referenciar `iniciarFluxoInadimplente` ou estados `MENU_INADIMPLENTE`.
**Mitigação:** rodar grep amplo antes do delete:
```bash
grep -rn "iniciarFluxoInadimplente\|MENU_INADIMPLENTE\|NEGOCIACAO_PARCELAMENTO\|handleMenuInadimplente\|handleNegociacaoParcelamento" backend/src/
```
Esperado: só `whatsapp-bot.service.ts`. Se aparecer outro arquivo, investigar.

### Risco 3 — D-novo-Z opção (a) preserva divergência de proposta

**Risco:** após fix, hardcoded ainda calcula proposta (`economiaMensal`) e motor não. Cooperado tem UX ligeiramente diferente dependendo do caminho.
**Mitigação:** aceitar como degradação consciente (debt residual pequeno catalogado). Motor é o caminho oficial; hardcoded é fallback raro.

### Risco 4 — Build/specs após Etapa B (D-novo-AC)

**Risco:** se a remoção do switch case quebrar TypeScript exhaustiveness check ou alguma referência tipada.
**Mitigação:** rodar `npm run build` após cada etapa. Se quebrar, reverter etapa antes de continuar.

### Risco 5 — 11 falhas pré-existentes Jest (cooperados/usinas)

**Risco:** independente do Sprint Housekeeping. Já existiam M19+. Não relacionado a nada que vou tocar.
**Mitigação:** confirmar que continuam 11 (não-minhas, não-novas) no smoke final.

### Risco 6 — D-novo-U fix expõe outras queries com PENDENTE

**Já mapeado:** 3 queries em `cobrancas.job.ts` (linhas 45, 130, 216) — todas DEFENSIVAS (incluem A_VENCER + PENDENTE). Não-bug. Aceitar como está + adicionar comentário no fix do bot.

---

## Escopo viável em 1 sessão

### COMPROMETO entregar nesta sessão (3-4h Code)

✅ D-novo-U (P2 → resolvido)
✅ D-novo-W (P3 → resolvido)
✅ D-novo-X (P3 → resolvido)
✅ D-novo-Z opção a (P3 → resolvido)
✅ D-novo-AC (P2 → resolvido, c/ remoção opcional de D-novo-AD placeholder)
✅ D-novo-Y (P3 → resolvido — delete OU reservar conforme Luciano)

**Total: 6 débitos resolvidos. 1 sessão.**

### NÃO entram nesta sessão — recategorizados

🟡 D-novo-AB → esperar 1-2 sprints pós-onboarding cooperebr1
🟡 D-novo-AE → esperar 1-2 sprints pós-onboarding cooperebr1
🟡 D-novo-AF → esperar 1-2 sprints pós-onboarding cooperebr1
🟡 D-novo-AA → catalogado pra sprint próprio quando volume crescer (Sinergia)
🔴 D-novo-V → Iniciativa Fluxos Customizáveis Fase 1
🔴 D-novo-AD → sprint próprio quando Luciano definir regra

**Total: 6 débitos não-executados nesta sessão (4 esperam validação produção, 2 são sprints futuros).**

### Estado projetado pós-Sprint Housekeeping

| Métrica | Antes | Depois |
|---|---|---|
| Débitos D-novo-U a AF abertos | 12 | 6 (AA + AB + AE + AF pós-prod + V + AD futuros) |
| Linhas dead code em `whatsapp-bot.service.ts` | ~250 (handlers órfãos) | ~30 (3 handlers pós-prod) |
| Estados no switch principal | + MENU_INADIMPLENTE + NEGOCIACAO_PARCELAMENTO | sem esses 2 |
| Specs Jest motor | 234/234 verdes | 234/234 verdes (nenhum afetado nesta sessão) |
| Suite global | 11 falhas pré-existentes | 11 falhas pré-existentes (não-relacionadas) |
| `seed-fluxos-bot.mjs` | tem `f-inadimplente` + estados | sem esses |

---

## Decisões de produto pro Luciano (2, focadas)

### 1. D-novo-Y — modelo `nps_trimestral` no seed

> Está no seed mas nunca foi usado. **Tem plano de cron trimestral pós-cadastro que justifique manter?**
>
> - (a) Não tenho plano → **DELETE agora** (5 min). Reaprovo quando virar sprint.
> - (b) Tenho ideia pra cron trimestral pós-cadastro → **MANTER + comentário "// reservado pra cron trimestral"**.
>
> Recomendação: **(a) DELETE** — pode recriar a qualquer momento se virar prioridade.

### 2. D-novo-AC + D-novo-AD interação — `handleNegociacaoParcelamento`

> D-novo-AC vai remover dead code de inadimplência. `handleNegociacaoParcelamento` faz parte mas é alvo de D-novo-AD (P1, sem regra). **O que faço?**
>
> - (i) **Remover junto com D-novo-AC** agora. Workaround SOLICITAR_NEGOCIACAO_HUMANA cobre. Quando D-novo-AD virar sprint, escreve a implementação real do zero.
> - (ii) **Manter o placeholder** enquanto D-novo-AD não vira sprint. Não remove no Sprint Housekeeping.
>
> Recomendação: **(i) Remover agora** — reduz superfície de manutenção e dead code. Workaround link humano via Notificacoes já existe no motor (Bloco 8).

---

## Estimativa total revisada

| Cenário | Tempo Code | Comentário |
|---|---|---|
| **Realista** (6 débitos, decisões Luciano (a) + (i) pré-aprovadas) | **2h45 - 3h45** | Confirma "1 sessão" |
| **Conservador** (incluir D-novo-AB ou AE — 1 dos borderlines) | 3h30 - 4h45 | Estende mas ainda 1 sessão |
| **Agressivo** (todos os 6 + AF com ajuste de 4 specs) | 4h - 5h | Possível mas justo no limite |

**Recomendação final:** ir com o **cenário Realista**. 6 débitos resolvidos em 1 sessão, ~3h Code, 5 min decisão Luciano. Deixa AB/AE/AF/AA/V/AD pra sprints futuros conforme o roadmap natural (pós-produção / sprints próprios).

---

## Riscos críticos — nenhum

Diferente do Sub-Sprint A/B do onboarding cooperebr1, este Sprint Housekeeping não tem **riscos regulatórios ou bloqueadores externos**. Tudo é limpeza interna de código com mitigação conhecida. Decisões pendentes do Luciano são triviais (5 min total).

---

## Próximo passo

Aguardo seu **OK + respostas pras 2 decisões produto:**

1. **D-novo-Y:** (a) delete (recomendado) ou (b) reservar?
2. **D-novo-AC + AD interação:** (i) remove `handleNegociacaoParcelamento` junto (recomendado) ou (ii) mantém placeholder?

Com as 2 respostas em mãos, posso arrancar Fase 2 (execução) imediatamente.

**Não tocarei código antes do OK explícito.**

## Apêndice — Notas operacionais

- Backend online (pid 37084, 20h uptime), PM2 estável
- Working tree limpo (último commit `20617c5` — descoberta sistema legado SISGDSOLAR)
- 0 commits à frente de origin/main
- 234/234 specs verdes no motor (estado pós-M24)
- Frontend dev `:3001` ativo
