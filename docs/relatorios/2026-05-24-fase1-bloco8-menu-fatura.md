# Fase 1 read-only — Bloco 8 (Menu Fatura / Inadimplente)

> 24/05/2026 — Sprint Bot Autoatendimento — última frente do sprint
> Decisão 23 ativa. Investigação read-only. Nada foi tocado.

## TL;DR (3 linhas)

1. **MENU_FATURA hardcoded existe e funciona; sub-opções são em sua maioria SIMPLES** (PIX/boleto/extrato vêm do cache `AsaasCobranca` — sem chamada síncrona ao gateway).
2. **MENU_INADIMPLENTE é dead code** — o método `iniciarFluxoInadimplente` em `whatsapp-bot.service.ts:2670` é **público sem chamadores**. O único cron de inadimplência real (`cronAbordarInadimplentes` em `whatsapp-cobranca.service.ts:217`) manda PIX/boleto direto e NÃO ativa MENU_INADIMPLENTE — o estado nunca é atingido em produção. **NEGOCIACAO_PARCELAMENTO** atual é placeholder (persiste string em `observacoesNegociacao`, não gera parcelas reais).
3. **Recomendação: (C) abordagem MISTA** — portar MENU_FATURA pro motor (sub-opções SIMPLES) + "já paguei" no modelo Bloco 5 (cria `SolicitacaoConfirmacaoPagamento` PENDENTE consistente com sprint). Deixar MENU_INADIMPLENTE + NEGOCIACAO_PARCELAMENTO como **débito catalogado** (regra de negócio de negociação real não está definida; portar hackish atual não agrega valor). Estimativa **5-7h** (vs 8-12h pra A "tudo" / 1-2h pra B "só ponto de entrada").

---

## Frente 1 — Handlers hardcoded (perguntas centrais)

### `handleMenuFatura` (`whatsapp-bot.service.ts:3457-3559`)

Entrada: **2 caminhos**
- (i) Palavra-chave global (`processarMensagem:390`): `fatura | faturas | boleto | 2a via | segunda via | pix | pagar` → força `estado = 'MENU_FATURA'` + chama `handleMenuFatura` direto. **Atalho** — funciona de qualquer estado não-bloqueante.
- (ii) Menu opção 2 do MENU_COOPERADO: **NÃO** entra em MENU_FATURA. `handleMenuCooperado:791-810` mostra inline "próxima fatura" usando `status: { in: ['PENDENTE', 'VENCIDO'] }` — **mas no banco real `PENDENTE` não existe** (D-novo-U catalogado). Hoje opção 2 só funciona quando motor dinâmico (`CONSULTAR_PROXIMA_FATURA` Bloco 3) intercepta — esse usa `['A_VENCER', 'VENCIDO']` correto.

Fluxo:
1. Busca cooperado por telefone (sem `cooperativaId` — **multi-tenant violation latente**).
2. Busca até 5 cobranças `status in ['A_VENCER','VENCIDO','PENDENTE']` `orderBy dataVencimento asc`, include `asaasCobrancas`.
3. Se nenhuma → "Está tudo em dia" + reseta.
4. Senão renderiza header + valor + vencimento + régua de urgência (vence em N dias / vencida há N) + **menu botões interativo** (PIX / Boleto / Portal).
5. Persiste `dadosTemp: { cobrancaId }` + estado `MENU_FATURA`.

### `handleRespostaMenuFatura` (`whatsapp-bot.service.ts:3563-3687`)

Trata as opções enviadas pelo cooperado:

| Opção | Match | Lógica | Complexidade |
|---|---|---|---|
| **PIX** | `pix` ou `1` | Lê `cobranca.asaasCobrancas[0].pixCopiaECola` (cache local). Fallback: link do portal. | **SIMPLES** |
| **Boleto** | `boleto/codigo/código/barra` ou `2` | Lê `asaasCobrancas[0].boletoUrl`. Fallback: portal. | **SIMPLES** |
| **Portal** | `portal/ver fatura` ou `3` | Envia `PORTAL_URL`. | **SIMPLES** |
| **Extrato** | `extrato` | Formata `valorLiquido/valorMulta/valorJuros/diasAtraso/valorAtualizado` (já no banco). | **SIMPLES** |
| **Comprovante** | `comprovante/paguei/já paguei` | Transiciona pra `AGUARDANDO_COMPROVANTE_PAGAMENTO` + pede foto/PDF. | **MÉDIA** (side-effect: muda estado) |
| **Outro** | qualquer | Reenvia menu botões com aviso. | trivial |

Após responder, reenvia menu de botões pra nova consulta (loop).

### `handleComprovantePagamento` (`whatsapp-bot.service.ts:3691-3738`)

1. Valida `tipo in ['imagem','documento']`.
2. Busca cooperado (sem `cooperativaId` — **multi-tenant violation**).
3. **Notifica SUPER_ADMIN via `process.env.SUPER_ADMIN_PHONE`** (NÃO usa `NotificacoesService` — divergência arquitetural com Blocos 4/5/6).
4. Confirma ao cooperado + reseta pra `INICIAL`.

### `iniciarFluxoInadimplente` (`whatsapp-bot.service.ts:2670-2713`) — DEAD CODE

Público, mas **`grep -rn` em todo o backend retorna 0 chamadores**. Foi escrita pensando em cron que nunca foi cabeado. O cron real é o `cronAbordarInadimplentes` (próximo item) — que manda mensagem direta SEM ativar estado de conversa.

### `handleMenuInadimplente` (`whatsapp-bot.service.ts:2715-2789`)

Roda só se `iniciarFluxoInadimplente` for chamado (nunca em prod). 3 opções:

| Opção | Match | Lógica | Complexidade |
|---|---|---|---|
| **Detalhes** | `1`/`detalhe` | Formata `dadosTemp` (valor/data/pix/link). | **SIMPLES** |
| **Negociar parcelamento** | `2`/`negoci`/`parcel` | Transiciona pra `NEGOCIACAO_PARCELAMENTO` + propõe 2x/3x sem juros. | **MÉDIA** |
| **Já paguei** | `3`/`paguei` | `finalizarConversa` + mensagem "verificaremos em 24h". | **SIMPLES** |

### `handleNegociacaoParcelamento` (`whatsapp-bot.service.ts:2791-2849`)

Confirmação do parcelamento:

| Opção | Match | Lógica |
|---|---|---|
| Sim, parcelar | `1`/`sim`/`parcel` | **Atualiza `Cobranca.observacoesNegociacao` com string `"Parcelamento 3x negociado via WhatsApp em DD/MM/YYYY"`. NÃO cria parcelas reais.** Manda confirmação ao cooperado: "Nossa equipe enviará os boletos das parcelas". `finalizarConversa`. |
| À vista | `2`/`vista`/`pagar` | Volta pra `MENU_INADIMPLENTE` com PIX/link. |

**Classificação geral**: o "parcelamento" hardcoded é **placeholder**, não cria parcelas reais (sem chamada Asaas, sem novas linhas em Cobranca). Equipe processa manualmente lendo `observacoesNegociacao` em cada fatura. **MÉDIA** complexidade no código, mas **regra de negócio real não definida**.

### `cronAbordarInadimplentes` (`whatsapp-cobranca.service.ts:217-334`)

ATIVO via `WA_INADIMPLENTES_HABILITADO=true` (gated env). Roda diário 9h:
- Busca `status: 'VENCIDO'` + já recebeu cobrança original
- Rate limit por `intervaloMinCobrancaHoras` da cooperativa
- Monta mensagem com PIX copia-e-cola + linha digitável + link Asaas
- **NÃO transiciona estado da conversa** — cooperado responde "Dúvidas? Responda esta mensagem" e cai em INICIAL/PRIMEIRO_ATENDIMENTO_AI
- Multi-tenant correto (`cooperativaId` propagado nas queries)

**Esse é o caminho real de inadimplência em produção.** `MENU_INADIMPLENTE` do bot é fluxo conversacional desconectado.

---

## Frente 2 — Etapas FluxoEtapa no banco

Diagnóstico read-only (`scripts/diag-bloco8-fase1.ts`):

| Estado | Existe? | Ativo? | Gatilhos | Modelo | acaoAutomatica | Tenant |
|---|---|---|---|---|---|---|
| `MENU_FATURA` | ✅ (`f-menu-fatura`) | **❌ false** | `[]` | null | null | GLOBAL |
| `MENU_INADIMPLENTE` | ✅ (`f-inadimplente`) | **❌ false** | `[]` | null | null | GLOBAL |
| `NEGOCIACAO_PARCELAMENTO` | ❌ não existe | — | — | — | — | — |
| `AGUARDANDO_COMPROVANTE_PAGAMENTO` | ❌ não existe | — | — | — | — | — |

**Esqueletos brutos do seed** (`prisma/seeds/seed-fluxos-bot.mjs:102,146`). Inativos + sem gatilhos. Motor dinâmico NÃO intercepta — tudo cai no hardcoded.

Modelos `menu_fatura` + `menu_inadimplente` no banco (Bloco 2 commit `1097f72`):

```
menu_fatura:
"📄 *Suas faturas, {{nome}}:*
1️⃣ Ver fatura atual
2️⃣ Pegar o Pix copia-e-cola
3️⃣ Histórico de pagamentos
4️⃣ Já paguei — quero avisar"

menu_inadimplente:
"Oi {{nome}}! Vi que sua fatura de {{mes}} está em aberto. 💛
1️⃣ Quero pagar agora (te envio o Pix)
2️⃣ Já paguei
3️⃣ Preciso negociar / mais prazo"
```

**Divergências importantes vs hardcoded**:
- `menu_fatura` BD tem **4 opções** (inclui "histórico"). Hardcoded tem **5 opções** via botões (PIX/Boleto/Portal/Extrato/Comprovante). **Histórico não existe no hardcoded.**
- `menu_inadimplente` BD ordem: 1 Pagar, 2 Já paguei, 3 Negociar. Hardcoded: 1 Detalhes, 2 Negociar, 3 Já paguei.
- Vars usadas: `{{nome}}`, `{{mes}}` — ambas precisam ser injetadas pela ação que abre o menu.

**Decisão de produto a antecipar**: alinhar modelo BD vs hardcoded — opções de PIX e BOLETO separadas (hardcoded) ou só "PIX copia-e-cola" (modelo BD)? "Histórico" é nova feature.

---

## Frente 3 — Ponto de entrada

**MENU_FATURA hoje**:
1. Palavra-chave em `processarMensagem:390` → atalho global (funciona até de fora do MENU_COOPERADO). Não passa pelo motor dinâmico.
2. Menu opção 2 do MENU_COOPERADO: **NÃO entra em MENU_FATURA** — vai direto pra ação `CONSULTAR_PROXIMA_FATURA` do motor (Bloco 3) que mostra fatura única + link Asaas sem entrar em sub-menu.

**MENU_INADIMPLENTE hoje**:
- Sem ponto de entrada ativo (cron `cronAbordarInadimplentes` envia mensagem direta sem transicionar estado).
- `iniciarFluxoInadimplente` órfão.

**Diferenciação cooperado em dia vs inadimplente no atendimento**: ZERO. O bot trata todos igual — MENU_FATURA é genérico. A "régua de urgência" (vencida há N dias) só muda o texto do header.

---

## Frente 4 — Detecção de inadimplência

Hoje **não há método público reusável** tipo `cooperadoService.estaInadimplente()`. Cada query usa critério próprio:

- `cronAbordarInadimplentes` → `status: 'VENCIDO' AND whatsappEnviadoEm != null` (já recebeu cobrança)
- `handleMenuFatura` → mostra cobranças `['A_VENCER', 'VENCIDO', 'PENDENTE']`
- `CONSULTAR_PROXIMA_FATURA` (motor) → `['A_VENCER', 'VENCIDO']`
- Métricas SaaS / Relatórios → cada uma faz query independente

**Sem campo `inadimplente: Boolean` no Cooperado**. Status é derivado do estado das Cobranças.

Pra Bloco 8 isso não bloqueia — a sub-opção "negociar" do MENU_INADIMPLENTE só faz sentido se houver cobrança VENCIDO, e essa decisão fica no escopo da ação no motor.

---

## Frente 5 — Integração Asaas / PIX

**Caminho atual** (hardcoded e motor Bloco 3 idênticos):

```typescript
cobranca.asaasCobrancas[0]?.pixCopiaECola   // já no banco
cobranca.asaasCobrancas[0]?.boletoUrl       // já no banco
cobranca.asaasCobrancas[0]?.linkPagamento   // já no banco
```

**Não chama Asaas síncrono** — usa o cache local na tabela `AsaasCobranca` (populada quando a cobrança foi gerada).

**Não usa `GatewayPagamentoService`** — `whatsapp-bot.service.ts` lê `asaasCobrancas` direto. `WhatsappCobrancaService` usa o gateway só pra cron de envio mensal e abordagem inadimplente.

**Implicação**: pra Bloco 8, ações de PIX/Boleto podem continuar lendo direto de `asaasCobrancas[0]` (pattern já estabelecido). Não precisa chamar gateway — preserva latência baixa. **Mas é débito latente**: viola adapter pattern do CLAUDE.md.

---

## Frente 6 — Multi-tenant

**Hardcoded MENU_FATURA — VIOLAÇÃO LATENTE**:

`handleMenuFatura:3462-3472` e `handleRespostaMenuFatura:3577-3593` buscam cooperado SOMENTE por telefone, sem `cooperativaId`. Cobranças também sem filtro de tenant.

Risco: se 2 cooperados em tenants distintos compartilharem o mesmo telefone (improvável mas não impossível em produção real com onboarding de Sinergia), o bot mistura tenants. Decisão 14/multi-tenant do CLAUDE.md violada.

**Motor Bloco 3** (`CONSULTAR_PROXIMA_FATURA`) já corrige — usa `conversa.cooperativaId` + `contratoFilter.cooperativaId`. Mais um motivo pra portar.

**Cron `cronAbordarInadimplentes` — OK**: query filtra por `cooperativaId` quando passado.

---

## Frente 7 — Recomendação A vs B fundamentada

### Cenário (A) PORTAR TUDO PRO MOTOR DINÂMICO

Escopo:
- MENU_FATURA + 5 sub-ações (`VER_FATURA_ATUAL`, `GERAR_PIX_FATURA`, `GERAR_BOLETO_FATURA`, `MOSTRAR_EXTRATO_FATURA`, `INICIAR_AVISO_PAGAMENTO`)
- MENU_INADIMPLENTE + 3 sub-ações (`VER_DETALHES_INADIMPLENCIA`, `INICIAR_NEGOCIACAO_PARCELAMENTO`, `MARCAR_PAGAMENTO_AVISADO`)
- NEGOCIACAO_PARCELAMENTO + 2 sub-ações (`CONFIRMAR_NEGOCIACAO_PARCELAMENTO`, `OPTAR_PAGAMENTO_AVISTA`)
- AGUARDANDO_COMPROVANTE_PAGAMENTO + 1 ação (`SALVAR_COMPROVANTE_PAGAMENTO`)
- Multi-tenant defense in depth completo
- Substituir `process.env.SUPER_ADMIN_PHONE` por `NotificacoesService.criar` (consistente Blocos 4/5/6)
- Tabela `SolicitacaoConfirmacaoPagamento` ou reuso do modelo Bloco 5 (`SolicitacaoAlteracaoContrato` não cabe — talvez `ConfirmacaoPagamentoPendente` novo)

**Estimativa: 8-12h Code** (similar Bloco 5, motor ganha 10-11 ações novas).

Prós:
- Sprint Bot Autoatendimento INTEIRAMENTE FECHADO com padrão consistente
- Multi-tenant garantido
- Modelos `menu_fatura` + `menu_inadimplente` finalmente usados (debt do Bloco 2 zerado)
- Equipe pode editar modelos sem deploy

Contras:
- **NEGOCIACAO_PARCELAMENTO atual é placeholder**: portar a versão hackish ("registra string em observacoesNegociacao") só replica o gambi. Negociação real exige regra de negócio (Luciano não definiu) + integração Asaas pra gerar parcelas. **Risco**: gastar 2-3h portando código que vai ser reescrito quando a regra real for definida.
- Esforço alto pra fechar bloco que poderia ser dividido.

### Cenário (B) MANTER HARDCODED + CABEAR PONTO DE ENTRADA

Escopo:
- Adicionar gatilho no MENU_COOPERADO ou usar palavra-chave existente — sem novas ações no motor
- Catalogar débito amplo: handler hardcoded continua, multi-tenant não corrigido, modelo BD não usado, "negociar parcelamento" placeholder

**Estimativa: 1-2h Code** (basicamente garantir que opção do menu/palavra-chave continua funcionando).

Prós:
- Fecha sprint rápido — Sprint Bot Autoatendimento "encerrado" em 1 sessão curta
- Não introduz risco de regressão (handlers em produção continuam intactos)

Contras:
- **Sprint Bot Autoatendimento fica simbolicamente fechado mas estruturalmente quebrado**: o objetivo do sprint era "ter motor dinâmico cobrindo o menu cooperado inteiro". Bloco 8 ficar hardcoded é admitir que o sprint não cumpriu o escopo.
- Multi-tenant violation latente persiste
- D-novo-U + débitos novos do hardcoded acumulam
- Equipe nunca poderá editar modelos `menu_fatura` / `menu_inadimplente` (debt do Bloco 2 vira lixo permanente)

### Cenário (C) MISTO — recomendação primária

Escopo:
- **PORTAR MENU_FATURA pro motor** (sub-opções SIMPLES: ver fatura / PIX / boleto / extrato): 5 ações novas no motor + 1 etapa MENU_FATURA cabeada com modelo
- **"Já paguei" como SolicitacaoConfirmacaoPagamento** (padrão Bloco 5 — cria registro PENDENTE + notifica equipe via NotificacoesService + tela admin pode ser dispensada se equipe usar AuditLog/lista de notificações existente, OU criar mini-painel admin simples): 2 ações novas (INICIAR + SALVAR comprovante)
- **NÃO portar MENU_INADIMPLENTE** — é dead code hoje, não trava nada. Catalogar como **D-novo-AC** + remover do bot.service quando confirmar inatividade.
- **NÃO portar NEGOCIACAO_PARCELAMENTO** — regra de negócio não definida. Catalogar como **D-novo-AD** + remover do bot.service por enquanto.
- Multi-tenant defense in depth completo nas 7 ações
- 1 ponto de entrada no MENU_COOPERADO opção 2 já existe (`VER_PROXIMA_FATURA` Bloco 3) — adicionar opção que entra em MENU_FATURA com mais sub-opções, OU manter palavra-chave + cabear etapa dinâmica

**Estimativa: 5-7h Code** (menor que A, suficientemente robusto pra fechar sprint legítimo).

Prós:
- Sprint Bot Autoatendimento fecha com padrão consistente (motor dinâmico em todas as opções do MENU_COOPERADO + atalho palavra-chave fatura)
- Multi-tenant garantido
- Modelos BD usados
- **"Já paguei" segue padrão Bloco 5** (Solicitação PENDENTE pra equipe processar) — coerência arquitetural
- Não desperdiça tempo portando código hackish (NEGOCIACAO_PARCELAMENTO)
- Débitos catalogados explicitamente: equipe sabe o que falta

Contras:
- Bloco 8 fica "parcial" — MENU_INADIMPLENTE e parcelamento real fora do sprint. **Mas** isso reflete realidade (regra de negociação real não foi definida).
- 2 novos débitos catalogados (D-novo-AC, D-novo-AD)

---

## Decisões de produto a levar pro Luciano

1. **A vs B vs C?** Recomendação: **C (mista)**.
2. **Modelo `menu_fatura` BD tem "Histórico de pagamentos" — implementar?** Se SIM, vira sub-ação `MOSTRAR_HISTORICO_FATURA` (cobranças PAGO últimos 6 meses, formato `data | valor | mes/ano`). +1-2h. Se NÃO, ajustar modelo pra remover essa opção e ficar com 3 (PIX/boleto/já paguei) ou 4 (PIX/boleto/portal/já paguei).
3. **"Já paguei" no motor — gerar entidade `SolicitacaoConfirmacaoPagamento` PENDENTE igual Bloco 5, OU manter padrão hardcoded (só notifica via env SUPER_ADMIN_PHONE)?** Recomendação: padrão Bloco 5 (consistência + multi-tenant + auditável). Implica novo model Prisma + endpoint REST simples ou reuso de Notificacoes.
4. **MENU_INADIMPLENTE: remover ou catalogar débito?** Recomendação: catalogar D-novo-AC (manter código mas inerte) + planejar sprint dedicado de "fluxo conversacional pós-cron de inadimplência" quando Luciano tiver regra de negociação real.
5. **NEGOCIACAO_PARCELAMENTO: regra de negócio real?** Hoje é placeholder. Possíveis: (i) link humano "fale com equipe", (ii) Asaas gera parcelas via API (parcelable), (iii) opção fixa 2x/3x sem juros via geração manual de cobranças. Depende do produto.
6. **Multi-tenant — substituir `SUPER_ADMIN_PHONE` global por NotificacoesService no comprovante?** Recomendação: SIM (já estabelecido Blocos 4/5/6).

## Proposta de desenho (Cenário C aprovado)

### Etapas FluxoEtapa novas
- `MENU_FATURA` (ATIVAR + cabear): modelo `menu_fatura`, gatilhos:
  - `1` → AGUARDANDO_RESPOSTA_MENU_FATURA + `VER_FATURA_ATUAL_BOT`
  - `2` → AGUARDANDO_RESPOSTA_MENU_FATURA + `GERAR_PIX_FATURA_BOT`
  - `3` → AGUARDANDO_RESPOSTA_MENU_FATURA + `MOSTRAR_HISTORICO_FATURA` (se Luciano OK)
  - `4` → AGUARDANDO_COMPROVANTE_PAGAMENTO + `INICIAR_AVISO_PAGAMENTO`
- `AGUARDANDO_COMPROVANTE_PAGAMENTO` (criar): wildcard `*` + `SALVAR_COMPROVANTE_PAGAMENTO` (aceita mídia — motor pós-Bloco 6)

### Ações motor novas (5-7)
- `VER_FATURA_ATUAL_BOT` — busca cobrança A_VENCER/VENCIDO mais antiga + formata header + PIX + boleto. Multi-tenant.
- `GERAR_PIX_FATURA_BOT` — busca `asaasCobrancas[0].pixCopiaECola` da cobrança ativa, envia direto.
- `GERAR_BOLETO_FATURA_BOT` (se SIMPLES: opcional ou unificado com VER_FATURA_ATUAL)
- `MOSTRAR_HISTORICO_FATURA` — cobranças PAGO últimas 6 meses (se decisão 2 = SIM)
- `INICIAR_AVISO_PAGAMENTO` — transiciona pra AGUARDANDO_COMPROVANTE_PAGAMENTO + pede foto/PDF
- `SALVAR_COMPROVANTE_PAGAMENTO` — recebe mídia, cria `SolicitacaoConfirmacaoPagamento` PENDENTE (novo model), notifica equipe via NotificacoesService, transiciona MENU_COOPERADO

### Schema Prisma (delta — se decisão 3 = padrão Bloco 5)
- `SolicitacaoConfirmacaoPagamento`: cooperadoId + cooperativaId + cobrancaId + telefoneRecebido + midiaBase64 (ou link) + mimeType + status (PENDENTE/CONFIRMADA/RECUSADA/CANCELADA) + processadaEm/Por + observacoesEquipe + timestamps
- 2 índices `(cooperativaId, status)` + `(cobrancaId)`

### Endpoint REST (opcional — se Luciano quiser painel admin)
- `GET /confirmacoes-pagamento?status=PENDENTE`
- `POST /confirmacoes-pagamento/:id/confirmar` — marca Cobranca como PAGA + status APLICADA
- `POST /confirmacoes-pagamento/:id/recusar` — observacoesEquipe obrigatório

Alternativa simplificada: NÃO criar endpoint REST nem tabela nova — usar `NotificacoesService.criar` com tipo `CONFIRMACAO_PAGAMENTO` apontando pra cobranca + admin processa via WA pessoal/UI de notificações existente.

### Tela admin (opcional)
- `/dashboard/super-admin/confirmacoes-pagamento` — padrão tela Bloco 5
- Pular se Luciano OK com fluxo via Notificacoes apenas

### Script idempotente
- `fix-bloco-8-menu-fatura-no-fluxo.ts` — ativa MENU_FATURA + cria etapas novas + cabea modelos + idempotente

### Débitos a catalogar
- **D-novo-AC** (P2 limpeza): `iniciarFluxoInadimplente` + `handleMenuInadimplente` + `MENU_INADIMPLENTE` etapa = dead code. Remover quando definir fluxo conversacional pós-cron.
- **D-novo-AD** (P1 lacuna produto): `handleNegociacaoParcelamento` é placeholder — regra de negócio de parcelamento real não definida. Sprint futuro dedicado.
- **D-novo-AE** (P2 limpeza pós-produção): handler hardcoded `handleMenuFatura`/`handleRespostaMenuFatura`/`handleComprovantePagamento` viola decisão B do Bloco 8 — remover pós-validação 1-2 sprints em produção. (mesmo padrão D-novo-AB do Bloco 5)

---

## Estimativa revisada

| Cenário | Esforço | Sprint fica fechado? | Sprint Bot Autoatend INTEIRAMENTE fechado? |
|---|---|---|---|
| **(A) Portar tudo** | 8-12h (1-2 sessões) | ✅ | ✅ (mas com NEGOCIACAO_PARCELAMENTO placeholder portado) |
| **(B) Manter hardcoded + cabear** | 1-2h (1 sessão curta) | ⚠️ tecnicamente | ❌ — bloco simbolicamente fechado, estruturalmente quebrado |
| **(C) Misto (recomendado)** | 5-7h (1-2 sessões) | ✅ | ✅ — MENU_FATURA portado, MENU_INADIMPLENTE catalogado como débito explícito |

**Recomendação final: Cenário (C).** Esperar decisão Luciano.

---

## Carry-overs em paralelo (não bloqueiam o bloco 8)

- D-novo-U (handler hardcoded ver fatura usa `PENDENTE` inexistente) — fix de 5 min em conjunto com a portabilidade
- Multi-tenant violation em `handleMenuFatura` + `handleComprovantePagamento` — corrigido naturalmente pela portabilidade
- Hardcoded `SUPER_ADMIN_PHONE` no comprovante — substituído por `NotificacoesService` na portabilidade

## Notas operacionais

- Backend online (pid 27424), PM2 estável
- 221/221 specs verdes no motor (estado pós-M23)
- Etapas MENU_FATURA + MENU_INADIMPLENTE no banco = ativo:false (seguro mudar)
- Modelos `menu_fatura` + `menu_inadimplente` já criados (Bloco 2) — só usar
- Cron `cronAbordarInadimplentes` é o disparo real de inadimplência hoje (não afetado pelo Bloco 8)
