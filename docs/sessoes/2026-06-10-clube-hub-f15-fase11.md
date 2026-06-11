# M30 — Sprint Clube Unificado P1 (Fases 1 + 1.5 + 1.1) · Hub + Economia + Polimento MLM

## TL;DR

Sessão Code maratona entregou **3 marcos** do Sprint Clube Unificado P1 num único arco contínuo após o M29 (Santi): (1) **Fase 1 HUB** — `/dashboard/clube` com grid de cards reunindo CooperToken, Vantagens, Planos do Clube, Ranking, Tokens Recebidos, Financeiro Tokens, aglutinando 6 itens espalhados do menu lateral (rotas antigas preservadas vivas); (2) **Fase 1.5 ECONOMIA DO TOKEN** em 4 blocos sequenciais — schema delta aditivo com 11 colunas (8 taxas per-operação + 3 oxidação + marco temporal `oxidacaoAtivadaEm`), helper puro `calcularTaxa` substituindo as constantes chumbadas `TAXA_EMISSAO=0.02`/`TAXA_QR=0.01` por leitura da `ConfigCooperToken` com fallback preservando 2%/1%, lógica de oxidação DECAY_CONTINUO prospectiva com cron mensal `@Cron('0 3 1 * *')` + gate técnico `OXIDACAO_PRODUCAO_LIBERADA=true` em produção real, controller + DTO formal com class-validator + UI dedicada `/dashboard/cooper-token/config` (3 seções, banner âmbar de gate jurídico, guard de UX antes de ligar oxidação) + link único em `/parceiro/configuracoes` (eliminou edição duplicada); 5º commit aplicou 3 fixes pós-review aprovados pelos reviewers pesados (G2 strings hardcoded no ledger, G3 gate duplicado dentro do service, MT P2 cooperativaId obrigatório no PUT) + catalogou 3 débitos novos; (3) **Fase 1.1 POLIMENTO HUB** — MLM entra no Clube com 3 cards novos (Indicações, Convites de Indicação, Meu Convite) removidos do menu flat ADMIN/SUPER_ADMIN + botão "← Voltar ao Clube" consistente nas 3 telas que estavam sem (cooper-token, cooper-token-parceiro, cooper-token-financeiro). **7 commits trabalho pushed** (`52d0d62..ed33ffb`) + Hub pré-existente (`e4d0976`) = 8 marcos visíveis no arco. **85/85 specs Jest verde** na suite cooper-token completa (7 suites: taxa-helper + qr-conformidade + oxidacao + f15-fixes + idor-bq2 + limite-token + token-notificacao). TSC web exit 0. PM2 rebuild backend (3×) + frontend (3×) durante a sessão; estado final backend pid 35172 + frontend pid 9040 + whatsapp pid 30648.

## Marco entregue

**M30 — Sprint Clube Unificado P1: Fases 1 + 1.5 (Economia) + 1.1 (Polimento)**

## Commits do dia (8 trabalho)

| Hash | Tipo | Marco |
|---|---|---|
| `e4d0976` | feat | **Fase 1 HUB** — `/dashboard/clube` com 6 cards + menu lateral consolidado + "Planos (Comercial)" desambiguado |
| `52d0d62` | feat | **F1.5 Bloco 1** — schema delta `ConfigCooperToken` + 11 campos (8 taxas + 3 oxidação + marco) |
| `c539036` | feat | **F1.5 Bloco 2** — helper puro `calcularTaxa(operacao, bruto, config\|null)` + substitui `TAXA_EMISSAO`/`TAXA_QR` chumbadas nos 2 usos (`:103` creditar + `:988` processarPagamentoQr); F0 preservado |
| `8655d0c` | feat | **F1.5 Bloco 3** — `aplicarOxidacao` prospectivo (3 invariantes: marco + graça + piso) + cron `@Cron('0 3 1 * *')` + gate `OXIDACAO_PRODUCAO_LIBERADA` em prod |
| `b64f42b` | feat | **F1.5 Bloco 4** — DTO formal `UpsertCooperTokenConfigDto` + PUT/admin/config ampliado + UI dedicada `/dashboard/cooper-token/config` + card "Configuração da Economia" no hub + link em `/parceiro/configuracoes` (fonte única) |
| `951e95c` | fix | **F1.5 fixes pós-review** — G2 (descrição ledger com valor real, sem "2%"/"1%"), G3 (gate duplicado dentro de `aplicarOxidacao`), MT P2 (`cooperativaId` obrigatório no PUT + service) + 11 specs |
| `065216d` | docs | atualização do prompt Sprint Clube (orquestrador): Hub ✅ + Fase 1.1 + F1.5 detalhada |
| `ed33ffb` | feat | **Fase 1.1 POLIMENTO** — MLM entra no Clube (3 cards novos: Indicações + Convites + Meu Convite) + botão "← Voltar ao Clube" em cooper-token / cooper-token-parceiro / cooper-token-financeiro |
| `<próximo>` | docs | fechamento M30 (esta sessão) |

## Entregas técnicas

### Fase 1 — HUB do Clube (`e4d0976`)

Criou `/dashboard/clube/page.tsx` com grid responsivo de **6 cards** apontando pras rotas existentes (CooperToken, Clube de Vantagens, Planos do Clube, Ranking, Tokens Recebidos, Financeiro Tokens). Página-hub com help inline azul. Menu lateral (`layout.tsx`) substituiu os 6 itens flat por **1 item "Clube"** → `/dashboard/clube`; rótulo "Planos" renomeado pra "Planos (Comercial)" desambiguando dos outros 2 ("Planos do Clube" no hub + "Planos SaaS" na Gestão Global). Import órfão `Coins` removido. **Não tocou backend.** Rotas antigas preservadas (deep-link em `ConvenioCusteioBloco.tsx:404` continua funcionando).

### Fase 1.5 — Configuração da Economia do Token (4 blocos)

#### Bloco 1 — Schema delta (`52d0d62`)

Adicionou 11 colunas aditivas à `ConfigCooperToken`:
- **Taxa de Operação** per-operação: `taxaEmissaoPerc`/`Fixa` default 2/0; `taxaQrPerc`/`Fixa` default 1/0; `taxaTransferenciaPerc`/`Fixa` default 0/0; `taxaResgatePerc`/`Fixa` default 0/0.
- **Oxidação DECAY_CONTINUO**: `oxidacaoPercMes` default 0 (desligada); `oxidacaoPeriodoGracaDias` default 0; `oxidacaoPiso` default 0; `oxidacaoAtivadaEm` nullable (marco prospectivo).

Auditoria pré (script `audit-config-cooper-token.ts`): **0 linhas em `ConfigCooperToken`** → 4 cooperativas operam com defaults implícitos + constantes chumbadas → backfill trivial. Auditoria pós (script `audit-config-cooper-token-post.ts`): 24 colunas confirmadas via `information_schema`. `prisma db push` puro aditivo (zero `--accept-data-loss`).

#### Bloco 2 — Helper `calcularTaxa` + substitui constantes (`c539036`)

Novo `backend/src/cooper-token/taxa-helper.ts` — função pura `calcularTaxa(operacao, bruto, config | null) → { taxa, liquido, perc, fixa }` sem dependência NestJS/Prisma. Aceita Decimal|number|null no config. Fórmula `taxa = round(bruto * perc / 100, 4) + round(fixa, 4); liquido = bruto - taxa`. Clamps defensivos (bruto ≤ 0 retorna 0; taxa nunca > bruto; NaN cai no default). **Fallback preserva 100% do comportamento antigo** (emissão 2%, QR 1%, demais 0).

Substituiu nos 2 usos em `cooper-token.service.ts`:
- `:103` (`creditar`) → `getConfig(cooperativaId)` + `calcularTaxa('emissao', quantidade, config)`.
- `:988` (`processarPagamentoQr`) → `getConfig(recebedorCooperativaId)` + `calcularTaxa('qr', decoded.quantidade, config)`.

**F0 preservado** — `processarQrParceiro:1338-1339` continua reusando `resultado.taxa`/`resultado.quantidadeLiquida` do `processarPagamentoQr` (taxa QR cobrada UMA ÚNICA VEZ sobre o bruto).

Specs `taxa-helper.spec.ts` — 24 novos (fallback × 4 operações + custom perc + custom fixa + Math.round sem ruído float + edge cases + Decimal-like + isolamento entre operações). Spec F0 `cooper-token-qr-conformidade.spec.ts` ganhou mock `configCooperToken.findUnique → null` pra disparar fallback (1%) — continua validando bruto 100 → taxa 1 → líquido 99.

#### Bloco 3 — Oxidação prospectiva + cron + gate jurídico (`8655d0c`)

Schema: enum `CooperTokenOperacao` ganhou `OXIDACAO` (aditivo, 10 valores agora).

`upsertConfig` ampliado com 11 novos campos + **carimbo automático de `oxidacaoAtivadaEm`**: ligar (0→>0) carimba `new Date()`; desligar (>0→0) limpa null; alterar perc sem zerar preserva marco original.

`aplicarOxidacao(cooperativaId)` novo — **fórmula conservadora**:
```
preservados   = sum(CREDITO pre-marco) + sum(CREDITO em graça)
saldoElegivel = max(0, saldoAtual - preservados)
decaimento    = round(saldoElegivel * percMes / 100, 4)
novoSaldo     = max(saldoAtual - decaimento, piso)
reducaoReal   = saldoAtual - novoSaldo
```

Garante as **3 invariantes inegociáveis** matematicamente: PROSPECTIVIDADE (tokens com `createdAt < oxidacaoAtivadaEm` nunca oxidam) + PERÍODO DE GRAÇA (tokens emitidos a menos de `oxidacaoPeriodoGracaDias` nunca oxidam) + PISO (`saldoDisponivel` nunca cai abaixo de `oxidacaoPiso`). Audit trail via `CooperTokenLedger(OXIDACAO)` por cooperado.

Cron `@Cron('0 3 1 * *')` `aplicarOxidacaoMensal()` no `cooper-token.job.ts` — mensal dia 1 às 3h (1h depois do `expirarTokensVencidos` pra não competir por locks). **Gate técnico**: em `isAmbienteReal()=true`, exige `process.env.OXIDACAO_PRODUCAO_LIBERADA === 'true'` — sem flag → WARN + skip. **Em DEV roda normal.**

Specs `cooper-token-oxidacao.spec.ts` — 15 novos (desligada × 3 + prospectividade × 2 + graça × 2 + piso × 2 + multi-cooperado + Math.round 33→0.33 + carimbo upsert × 4).

#### Bloco 4 — Controller/DTO + UI dedicada + card no hub (`b64f42b`)

**DTO formal** `dto/upsert-cooper-token-config.dto.ts` (`UpsertCooperTokenConfigDto`) com class-validator (`@IsOptional` + `@Min(0)` + `@Max(100)` nos %). Cobre 19 campos editáveis (8 antigos + 8 taxas + 3 oxidação). `oxidacaoAtivadaEm` ausente do DTO — service carimba automaticamente.

Controller:
- `PUT /admin/config` usa DTO formal (substitui body inline com 8 campos).
- `GET /superadmin/config-defaults` retorna 19 defaults espelhando schema.

**UI dedicada** `web/app/dashboard/cooper-token/config/page.tsx` — padrão UX Tipo B (entidade inteira = página própria):
- 3 cards seção: **Geral** (8 campos) / **Taxa de Operação** (4 pares perc+fixa em componente reusável `TaxaPar`) / **Oxidação** (3 campos + banner âmbar de dupla consequência financeira + gate jurídico + display do marco `oxidacaoAtivadaEm` quando ativo).
- Help inline azul (regra UX 19/05).
- **Guard de UX**: ligar oxidação (`oxidacaoPercMes` 0→>0) abre `window.confirm` com checklist regulatório (política de quebra + auditoria + comunicação aos cooperados).
- Botão "← Voltar ao Clube" no topo.

Card "**Configuração da Economia**" → `/dashboard/cooper-token/config` no hub (7 cards).

`/parceiro/configuracoes` simplificado — seção CooperToken editável (8 campos duplicados) **removida**; vira link "Abrir configuração completa →" pra UI dedicada (**fonte única**). State `TokenConfig`/handler `handleSalvarToken` removidos (código órfão).

### Fixes pós-review reviewers pesados (`951e95c`)

Aprovado por `cooperebr-financeiro-token-reviewer` + `cooperebr-multitenant-reviewer` (zero P0/P1), com 3 fixes P2 code-only:

| Fix | Local | Mudança |
|---|---|---|
| **G2** | `cooper-token.service.ts:172` + `:1274` | `taxa emissão 2%`/`taxa 1%` hardcoded → `taxa: ${taxaEmissao}`/`taxa: ${taxa}` (valor real calculado, anti-mentira pós-config customizada) |
| **G3** | `aplicarOxidacao` no service | Gate `isAmbienteReal() && !OXIDACAO_PRODUCAO_LIBERADA` duplicado na entrada do método — defense in depth (chamador direto futuro também barrado) |
| **MT P2** | `cooper-token.controller.ts:upsertConfig` + service | `cooperativaId` obrigatório (BadRequestException). Controller lança 400 + service defesa em profundidade. Sem mais `where: { cooperativaId: undefined }` no Prisma |

Specs `cooper-token-f15-fixes.spec.ts` — 11 novos (G2 emissão + QR × custom; G3 prod sem flag → não chama findUnique, prod com flag → roda, DEV → roda; MT P2 cooperativaId vazio/null/undefined → BadRequest, válido → upsert normal).

### Edição do prompt do orquestrador (`065216d`)

Versionou edição não-commitada feita pelo orquestrador (claude.ai) no `docs/relatorios/2026-06-10-prompt-sprint-clube-unificado-cooper-token.md`: subtítulo atualizado, FASE 1 marcada como ✅ entregue, FASE 1.1 NOVA inserida (polimento Hub: MLM + voltar), FASE 2 (F1.5) detalhada com MAPA DE IMPACTO completo e plano de implementação em 4 blocos.

### Fase 1.1 — Polimento Hub (`ed33ffb`)

**MLM entra no Clube** — 3 cards novos:
- Indicações → `/dashboard/indicacoes` (Users, fuchsia)
- Convites de Indicação → `/dashboard/convites` (Mail, violet)
- Meu Convite → `/dashboard/meu-convite` (UserPlus, purple)

Justificativa: MLM é parte do Clube — o card Ranking já era "progressão MLM"; indicação premia com tokens; convites alimentam a cadeia. `/dashboard/convites` confirmado SÓ indicação MLM (inspeção: `ConviteRow { nomeConvidado, telefoneConvidado, dataConvite }`) — não convênio/proprietário (esses ficam nas telas de convênio/usina e NÃO entram no Clube). Hub agora tem **10 cards**.

Menu lateral (`layout.tsx`): 3 itens flat (Indicações + Meu Convite + Convites) **removidos só da seção ADMIN/SUPER_ADMIN**. **COOPERADO e OPERADOR mantêm os atalhos diretos no menu** — eles ainda não têm item Clube no menu, perderiam acesso direto às telas MLM se a remoção fosse universal. Rotas antigas preservadas vivas em todos perfis.

**Botão "← Voltar ao Clube"** consistente nas 3 telas que estavam sem (cooper-token, cooper-token-parceiro, cooper-token-financeiro) — padrão idêntico ao já usado em `/dashboard/cooper-token/config`. Telas `clube-vantagens` e `clube/planos` mantêm modelo próprio (já tinham navegação).

## Bugs resolvidos / catalogados nesta sessão

| # | Severidade | Origem | Fix | Status |
|---|---|---|---|---|
| Constantes monetárias chumbadas no service (`TAXA_EMISSAO`/`TAXA_QR`) | P1 | F1.5 mapa orquestrador | Helper `calcularTaxa` + leitura de `ConfigCooperToken` | RESOLVIDO `c539036` |
| Lógica de oxidação DECAY_CONTINUO ausente (campo era só rótulo) | P1 | F1.5 mapa orquestrador | `aplicarOxidacao` prospectivo + cron + gate | RESOLVIDO `8655d0c` |
| Edição duplicada da config CooperToken em `/parceiro/configuracoes` | P2 | F1.5 read-only | UI dedicada `/dashboard/cooper-token/config` + link em parceiro | RESOLVIDO `b64f42b` |
| Strings "taxa 2%"/"taxa 1%" hardcoded nas descrições do ledger | P2 | Reviewer financeiro-token | Valor real calculado (G2) | RESOLVIDO `951e95c` |
| Gate jurídico só no cron, não no service (chamador direto futuro vazaria) | P2 | Reviewer financeiro-token | Gate duplicado em `aplicarOxidacao` (G3) | RESOLVIDO `951e95c` |
| `PUT /admin/config` passava `undefined` ao Prisma se SUPER_ADMIN sem cooperativaId | P2 | Reviewer multitenant | 400 + defesa em profundidade no service (MT P2) | RESOLVIDO `951e95c` |
| 6 itens espalhados do menu lateral (CooperToken + Vantagens + Ranking + Planos + Tokens + Financeiro) | P3 UX | Sprint Clube P1 plano | Hub `/dashboard/clube` + menu único | RESOLVIDO `e4d0976` |
| 3 "Planos" indistinguíveis (Comercial / Clube / SaaS) | P3 UX | Sprint Clube P1 plano | "Planos" → "Planos (Comercial)"; outros 2 já desambiguados | RESOLVIDO `e4d0976` |
| 3 itens MLM espalhados no menu (Indicações + Meu Convite + Convites) | P3 UX | Fase 1.1 | Cards no hub + remoção do menu ADMIN/SUPER_ADMIN | RESOLVIDO `ed33ffb` |
| Telas cooper-token / cooper-token-parceiro / cooper-token-financeiro sem botão voltar | P3 UX | Fase 1.1 | Botão "← Voltar ao Clube" padrão consistente | RESOLVIDO `ed33ffb` |

## Débitos novos catalogados em `docs/debitos-tecnicos.md`

Reviewers pesados (financeiro-token + multitenant) catalogaram 3 P2/P3 + 1 já existia do M29:

| ID | Sev | Resumo |
|---|---|---|
| **D-novo-OXIDACAO-LEDGER-TIPO** | **P2** | Criar enum `OXIDACAO` em `CooperTokenTipo` + visibilidade no caixa. **Pré-requisito de ligar oxidação em produção real** (junto da política de quebra escrita+aprovada). Hoje usa cast `'DESCONTO_FATURA' as CooperTokenTipo` — fica misturada com descontos normais no extrato. |
| **D-novo-OXIDACAO-PRESERVADOS-DUPLA-CONTAGEM** | P3 | Modelo conservador pode subestimar decay se CREDITO for pré-marco E em graça simultaneamente — é contado 2× em `preservados`. Invariante intacta (oxida MENOS, nunca MAIS) mas pode confundir contador. |
| **D-novo-OXIDACAO-SPECS** | P3 | Cobertura extra: spec cron `aplicarOxidacaoMensal`, edge case `perc=100`, edge case "religar oxidação" (novo marco), filtro `cooperativaId` direto no `cooperTokenSaldo`. ~1-2h Code futuras. |

## Decisões catalogadas

Nenhuma memória persistente nova criada — todas decisões couberam nos commits, doc-sessão e débitos catalogados. **Decisões importantes registradas narrativamente:**

1. **8 colunas vs 1 JSON `taxasOperacao`** — escolhido **8 colunas dedicadas**. Razões: defaults `@default(2)` e `@default(1)` preservam comportamento sem migração de dados, validação por class-validator é trivial, queries futuras filtram/ordenam sem JSON parsing, editar 1 campo no admin sem ler/reescrever blob.
2. **UI dedicada vs estender `/parceiro/configuracoes`** — escolhido **página própria** `/dashboard/cooper-token/config` (padrão UX Tipo B). Razões: `/parceiro/configuracoes` mistura cadastrais + telefone + SMTP + multa + juros, não é o lugar natural pra Taxa de Operação + Oxidação detalhada; nova página descoberta via card no hub; fonte única elimina edição duplicada.
3. **Gate operacional de oxidação em prod** — flag env `OXIDACAO_PRODUCAO_LIBERADA=true` exigida pra cron rodar em `isAmbienteReal()=true`. DEV roda normal. Trava técnica enquanto Luciano não tem política de quebra escrita+aprovada + auditoria do que seria oxidado.
4. **`oxidacaoAtivadaEm` carimba marco prospectivo** automaticamente em `upsertConfig` — ligar (0→>0) carimba `new Date()`; desligar (>0→0) limpa null; alterar perc sem zerar preserva marco original. Garante que tokens pré-marco NUNCA oxidem (invariante 1 inegociável).
5. **MLM faz parte do Clube** — confirmado pela natureza dos cards (Ranking já era "progressão MLM"; indicação premia com tokens; convites alimentam a cadeia). 3 cards novos no hub.
6. **Remoção do menu lateral apenas em ADMIN/SUPER_ADMIN** — COOPERADO/OPERADOR mantêm atalhos diretos pois ainda não têm item "Clube" no menu (perderiam acesso). Decisão pragmática + reversível quando hub for adicionado pros outros perfis.

## Pendências abertas pra próxima sessão

**Próximo passo único e claro:** **F2 — empresa-PJ-cooperada compra tokens no nível COOPERADO**. Hoje só existe `parceiro/comprar` (credita `saldoParceiro=tenant`); falta empresa-cooperada PJ comprar creditando `cooperadoId` (CooperTokenSaldo + ledger via `creditar()`/`CooperTokenCompra`/Asaas). Aplicar Taxa de Operação (F1.5 já preparada) na emissão. Multi-tenant + idempotência (jti). Specs. Reviewers dinheiro+tenant ao fim.

**Pré-requisitos leitura** (Decisão 23 — Fase 1 read-only obrigatória antes de codar):
- Prompt empacotado: `docs/relatorios/2026-06-10-prompt-sprint-clube-unificado-cooper-token.md` **FASE 3**.
- Regra de Coerência Sistêmica: `~/.claude/projects/C--Users-Luciano-cooperebr/memory/regra_coerencia_sistemica_mapa_impacto_10_06.md` (MAPA DE IMPACTO em 5 dimensões obrigatório antes de implementar).
- Modelo fundacional: `~/.claude/projects/C--Users-Luciano-cooperebr/memory/decisao_modelo_token_voucher_sobra_resgate_2026_06_04.md` (voucher/sobra/resgate; dois rios kWh×token).
- Esta doc-sessão (M30).

**Carry-overs desta sessão (não-bloqueantes):**
- 3 débitos novos catalogados (LEDGER-TIPO P2 + PRESERVADOS-DUPLA-CONTAGEM P3 + SPECS P3).
- D-novo-OXIDACAO-LEDGER-TIPO bloqueia ligar oxidação em produção real (pre-requisito do checklist regulatório junto da política de quebra).

**Carry-overs M28/M29 ainda vivos:**
- D-novo-WA-PHONE-NORMALIZE P2 (matcher telefone amplo).
- 3 ações WA declaradas sem implementação (`PROCESSAR_OCR`, `MOSTRAR_MENU_PRINCIPAL`).
- 17 modelos BOT órfãos.
- `empresa_conveniada` / `proprietario_usina` iterando só `cooperados[0]`.
- Fase 3 Token-WA — pausa explícita; retomada DEPOIS do Clube fechar.
- Untracked acumulados em `backend/scripts/`, `backend/src/agents/`, `docs/RECOMENDACAO-ARQUITETURA-FINAL.md`, etc — Sprint Housekeeping futuro.
- 218 membros parciais (segmentação pendente — M24/M25).
- 2 convites de smoke no convênio Santi (loteId `6a84832d13679547071f6964`) — `ambienteTeste=true`, mantidos.
- A-1 + C-2 P3 catalogados (M29 reviewers).

## Estado de fila pós-M30

| Ordem | Bloco | Status |
|---|---|---|
| 1 | **F2 — Empresa-PJ-cooperada compra** (cooperadoId, idempotência jti, Taxa de Operação) | **PRÓXIMO** |
| 2 | F4 — Funcionário usa/transfere (PIN/OTP + Serializable + jti + Taxa de Operação) | Aguarda |
| 3 | F3 — Empresa distribui em LOTE/INDIVIDUAL (mass-write reusa controles do Hardening; CLT 458) | Aguarda |
| 4 | F6 — Estabelecimento resgata token→R$/PIX (recibo, NÃO recompra; flag `Cooperado.ehEstabelecimento` + backfill) | Aguarda |
| 5 | Fatia A — Nomenclatura (CTK→CooperToken; dois rios kWh×token; verbo usar/aplicar/resgatar) | Aguarda |
| 6 | Sprint Hardening Mass-Write SUPER_ADMIN **P2** | Aguarda fim do Clube |
| 7 | Sprint Housekeeping (cleanup smokes Santi + scripts órfãos + worktrees) | Slot oportunístico |

## Regras aplicadas na sessão

- **Decisão 23** (validação prévia rigorosa) + **Regra de Coerência Sistêmica** (MAPA DE IMPACTO em 5 dimensões antes de implementar) aplicada explicitamente na Fase 1.5 — auditoria pré-schema com SELECT confirmando 0 rows, grep amplo de consumidores das constantes `TAXA_EMISSAO`/`TAXA_QR` (1 uso cada após F0), mapeamento de UI editável (`/parceiro/configuracoes` é o lugar, não `/dashboard/cooper-token/page.tsx`), pausa pro OK antes de implementar.
- **Multi-tenant**: `cooperativaId` SEMPRE do JWT em `PUT /admin/config` (MT P2 fix); `aplicarOxidacao(cooperativaId)` recebe tenant explícito; `getConfig(cooperativaId)` filtra `@unique`.
- **`isAmbienteReal()`** (não `NODE_ENV`) — gate técnico de oxidação usa o helper correto.
- **Arredondamento monetário**: `Math.round(x*10000)/10000` (4 casas, formato tokens) em `calcularTaxa` + `aplicarOxidacao` + `upsertConfig`.
- **Specs verdes obrigatórias**: 85/85 cooper-token verde + TSC web exit 0. Zero regressão verificada após cada bloco.
- **Rebuild PM2 backend** (stop → build → restart) aplicado 3× durante a sessão (Bloco 1 + Bloco 2 + Bloco 3+fixes). Frontend rebuild 3× (Hub + Bloco 4 + Fase 1.1).
- **Decisão 24** (frase de retomada em local único): CONTROLE-EXECUCAO + esta doc.
- **Regra não-paralelo com Code**: orquestrador editou prompt do Sprint Clube fora dos commits do Code; Code versionou no commit `065216d` (padrão: orquestrador edita docs, Code commita).
- **Cadência de review** combinada com Luciano: reviewers pesados (financeiro-token + multitenant) UMA VEZ no fim sobre a lógica completa (Blocos 2+3+4); fixes P2 entraram como 5º commit antes do push final. Bloco 1 (schema) e Fase 1.1 (frontend) passaram em check inline sem reviewer pesado.

## Pré-requisitos leitura próxima sessão

1. `docs/CONTROLE-EXECUCAO.md` (## ONDE PARAMOS topo — M30 + ## FRASE DE RETOMADA).
2. `docs/sessoes/2026-06-10-clube-hub-f15-fase11.md` (M30 — esta sessão).
3. `docs/relatorios/2026-06-10-prompt-sprint-clube-unificado-cooper-token.md` (PROMPT EMPACOTADO — seguir **FASE 3** que é F2 da nossa fila).
4. `~/.claude/projects/C--Users-Luciano-cooperebr/memory/regra_coerencia_sistemica_mapa_impacto_10_06.md` (MAPA DE IMPACTO inegociável em CADA Fase 1).
5. `~/.claude/projects/C--Users-Luciano-cooperebr/memory/sprint_clube_unificado_cooper_token_10_06.md`.
6. `~/.claude/projects/C--Users-Luciano-cooperebr/memory/decisao_modelo_token_voucher_sobra_resgate_2026_06_04.md` (modelo fundacional voucher/sobra/resgate).
7. `backend/src/cooper-token/cooper-token.service.ts:creditar` (entry point que F2 vai usar).
8. `backend/src/cooper-token/cooper-token.service.ts:upsertConfig` (Taxa de Operação F1.5 já preparada — vai aplicar na emissão F2).
9. CLAUDE.md + .claude/CLAUDE.md.

## Doc-sessão M30

`docs/sessoes/2026-06-10-clube-hub-f15-fase11.md`

## FRASE COMANDANTE — próxima sessão Code (Sprint Clube P1, FASE 2 — F2 empresa-PJ-cooperada compra)

PASSO 0 — Verificações operacionais OBRIGATÓRIAS antes de qualquer leitura:

1. Confirmar que esta é NOVA conversa Code (não continuação de janela anterior). Verificar que subagent `cooperebr-qa-funcional` aparece na lista de agents. Se não aparecer, parar e avisar.

2. Rodar `git status --short` (diretriz inegociável 18/05). Esperado pós-fechamento M30: working tree limpo (untracked carry-overs catalogados pra Sprint Housekeeping futuro); último commit é o de fechamento M30.

3. Rodar `pm2 list`. Esperado: `cooperebr-backend` + `cooperebr-frontend` + `cooperebr-whatsapp` online (3000/3001/3002 LISTENING) — M30 deixou stack em runtime após F1.5 + Fase 1.1. Toda mudança em `web/` exige rebuild (`next start` sob PM2, sem HMR).

PASSO 1 — Frase comandante (arrancar Sprint Clube Unificado P1, FASE 2 — F2 empresa-PJ-cooperada compra):

Sessão 10/06 entregou M30 em 8 commits (`e4d0976..ed33ffb`): Sprint Clube Unificado P1 completou Fase 1 HUB + Fase 1.5 ECONOMIA em 4 blocos + 5º commit fixes pós-review reviewers pesados + Fase 1.1 POLIMENTO MLM. Estrutura nova entregue: ConfigCooperToken expandida com 11 campos aditivos (8 taxas per-operação + 3 oxidação + marco temporal oxidacaoAtivadaEm), helper puro calcularTaxa substituiu constantes chumbadas preservando 2%/1% via fallback, oxidação DECAY_CONTINUO prospectiva com 3 invariantes matemáticas + cron mensal + gate técnico OXIDACAO_PRODUCAO_LIBERADA pra produção, UI dedicada /dashboard/cooper-token/config com banner âmbar de gate jurídico + guard de UX antes de ligar, hub /dashboard/clube agora com 10 cards (6 originais + Configuração + 3 MLM), botão "Voltar ao Clube" consistente nas 3 telas que estavam sem. 85/85 specs Jest verde (7 suites). TSC web exit 0. Reviewers `cooperebr-financeiro-token-reviewer` + `cooperebr-multitenant-reviewer` aprovaram zero P0/P1 sobre Blocos 2+3+4 da lógica de dinheiro; 3 fixes P2 catalogados (G2 + G3 + MT P2) entraram no 5º commit. 3 débitos novos: D-novo-OXIDACAO-LEDGER-TIPO P2 (pre-requisito de ligar oxidação em prod), D-novo-OXIDACAO-PRESERVADOS-DUPLA-CONTAGEM P3 (conservador), D-novo-OXIDACAO-SPECS P3.

ARRANCAR: **Sprint Clube Unificado P1 — FASE 2 (F2 empresa-PJ-cooperada compra)** conforme prompt empacotado em `docs/relatorios/2026-06-10-prompt-sprint-clube-unificado-cooper-token.md` FASE 3 (numeração do prompt — corresponde ao F2 da nossa fila pós-Fase 1.5).

Escopo F2: empresa cooperada PJ compra tokens creditando `cooperadoId` (CooperTokenSaldo + ledger via `creditar()`/`CooperTokenCompra`/Asaas). Hoje só existe `parceiro/comprar` que credita `saldoParceiro=tenant` — falta o caminho cooperado. Aplicar Taxa de Operação (F1.5 já preparada — `taxaEmissaoPerc`/`taxaEmissaoFixa` via `calcularTaxa('emissao')` já está no `creditar:103`). Multi-tenant: `cooperativaId` SEMPRE do JWT. Idempotência: `jti` único pra prevenir cobrança dupla via Asaas. Specs cobrindo: empresa-PJ valida (`isEmpresaCooperada`), valor > 0, taxa aplicada, ledger entrada CREDITO + COMPRA_PARCEIRO ou similar, Asaas webhook valida HMAC, dupla compra com mesmo jti retorna idempotente.

Cada fase começa com Fase 1 read-only + MAPA DE IMPACTO 5 dimensões (Consumidores grep / Dados Existentes SELECT / Propagação DTO+types+queries+telas+relatórios+jobs+extrato / Navegação sem deep-link órfão / Re-Teste fluxos listados) → PAUSAR pro OK → implementar → specs verdes.

DIRETRIZES INEGOCIÁVEIS preservar (área dinheiro/token):
- Token = VOUCHER de circuito fechado; cooperativa = emissora única.
- Saída de valor: estabelecimento = RESGATE/liquidação (recibo, SEM NF); cooperado = SOBRA. PROIBIDO token→sobra.
- Multi-tenant: `cooperativaId` SEMPRE do JWT; toda query Prisma filtra `cooperativaId`.
- Transferência/uso/compra de token: idempotência via jti + `$transaction Serializable` quando aplicável.
- Monetário: `Math.round(x*100)/100` em R$ + `Math.round(x*10000)/10000` em tokens.
- Disparo real (WA/email): SÓ whitelisted (`5527981341348` / `lucbragatto+sufixo@gmail.com`) + `ambienteTeste=true`.
- Reportar ao orquestrador ao fim da fase F2 → reviewers `cooperebr-financeiro-token-reviewer` + `cooperebr-multitenant-reviewer` antes do push.

PRÉ-REQUISITOS LEITURA (mapear, NÃO codar):
1. docs/CONTROLE-EXECUCAO.md (## ONDE PARAMOS topo — M30).
2. docs/sessoes/2026-06-10-clube-hub-f15-fase11.md (M30 — esta sessão).
3. docs/relatorios/2026-06-10-prompt-sprint-clube-unificado-cooper-token.md (PROMPT FASE 3 = F2).
4. ~/.claude/projects/C--Users-Luciano-cooperebr/memory/regra_coerencia_sistemica_mapa_impacto_10_06.md.
5. ~/.claude/projects/C--Users-Luciano-cooperebr/memory/decisao_modelo_token_voucher_sobra_resgate_2026_06_04.md.
6. backend/src/cooper-token/cooper-token.service.ts:creditar (entry point que F2 vai usar).
7. backend/src/cooper-token/cooper-token.service.ts:upsertConfig (Taxa de Operação F1.5 já aplicada).
8. backend/src/cooper-token/cooper-token.controller.ts (entradas existentes parceiro/comprar — espelhar shape).
9. CLAUDE.md + .claude/CLAUDE.md.

ESTADO DE FILA (Decisão 24):
- M30 ✅ entregue.
- PRÓXIMO: F2 Empresa-PJ-cooperada compra.
- F4 Funcionário usa/transfere (PIN/OTP + Serializable + jti).
- F3 Empresa distribui em LOTE/INDIVIDUAL (mass-write reusa controles do Hardening; CLT 458).
- F6 Estabelecimento resgata (recibo, NÃO recompra; flag Cooperado.ehEstabelecimento).
- Fatia A Nomenclatura (CTK→CooperToken, dois rios kWh×token).
- Sprint Hardening Mass-Write SUPER_ADMIN P2 (rebaixado, aguarda fim do Clube).
- Sprint Housekeeping (cleanup smokes Santi + scripts órfãos + worktrees) — slot oportunístico.

CARRY-OVERS M28/M29/M30 AINDA VIVOS (não-bloqueantes):
- D-novo-OXIDACAO-LEDGER-TIPO P2 (pre-requisito de ligar oxidação em prod).
- D-novo-OXIDACAO-PRESERVADOS-DUPLA-CONTAGEM P3.
- D-novo-OXIDACAO-SPECS P3.
- D-novo-WA-PHONE-NORMALIZE P2.
- 3 ações WA declaradas sem implementação (PROCESSAR_OCR, MOSTRAR_MENU_PRINCIPAL).
- 17 modelos BOT órfãos.
- empresa_conveniada / proprietario_usina iterando só cooperados[0].
- Fase 3 Token-WA — pausa explícita.
- Untracked acumulados pra Sprint Housekeeping.
- 218 membros parciais (segmentação).
- 2 convites de smoke no convênio Santi (loteId 6a84832d13679547071f6964) — ambienteTeste=true, mantidos.

DOC-SESSÃO 10/06 M30:
docs/sessoes/2026-06-10-clube-hub-f15-fase11.md
