# Revisão sistemática etapa-por-etapa — fluxo do bot WhatsApp

**Data:** 2026-05-21
**Tipo:** read-only (após Bloco 0 + correção rodapé)
**Tenant analisado:** CoopereBR (`cmn0ho8bx0000uox8wu96u6fd`)
**Total:** 16 etapas ATIVAS

Cada etapa foi simulada via `simular()` com `etapaIdForcado` para inspecionar renderização e gatilhos independentemente.

## Tabela consolidada

| # | Etapa | Estado | Renderiza? | Variável vazia? | Gatilhos (úteis / loop / volta-menu / órfão) | Redundante? |
|---|---|---|---|---|---|---|
| 1 | Entrada Dinâmica ⭐ | `INICIAL` | ✅ | não | 4 / 0 / 0 / 0 — todos úteis | **SIM** (3 etapas no INICIAL) |
| 2 | Receber fatura | `INICIAL` | ✅ | não | 0 (terminal-like, sem ação) | **SIM** (3 etapas no INICIAL) |
| 3 | Menu Principal | `MENU_PRINCIPAL` | ✅ | não | 4 / 0 / 0 / 0 — todos úteis | não |
| 4 | Boas-vindas / Menu Principal | `INICIAL` | ✅ | não | 0 (mas tem ação `MOSTRAR_MENU_PRINCIPAL` placeholder) | **SIM** (3 etapas no INICIAL) |
| 5 | Confirmar dados extraídos | `AGUARDANDO_CONFIRMACAO_DADOS` | ✅ | **⚠️ {{historico}}** | 1 útil (`OK→AGUARDANDO_CONFIRMACAO_PROPOSTA`) | não |
| 6 | Menu do Cooperado | `MENU_COOPERADO` | ✅ | ⚠️ `{{nome}}` no preview | 7 (5 úteis / **2 LOOP**) | não |
| 7 | Confirmar proposta | `AGUARDANDO_CONFIRMACAO_PROPOSTA` | ✅ | **⚠️ várias R$/% sem valor** | 1 útil (`SIM→AGUARDANDO_CONFIRMACAO_CADASTRO`) | não |
| 8 | Sem Fatura — Opções | `MENU_SEM_FATURA` | ✅ | não | 3 úteis | não |
| 9 | Confirmar cadastro | `AGUARDANDO_CONFIRMACAO_CADASTRO` | ✅ | **⚠️ {{titular}}/{{endereco}}/{{uc}}** | 1 útil (`CONFIRMO→CONCLUIDO`) | não |
| 10 | Dispositivo p/ buscar email | `AGUARDANDO_DISPOSITIVO_EMAIL` | ✅ | **⚠️ {{distribuidora}}** | 2 úteis | não |
| 11 | Fluxo concluído | `CONCLUIDO` | ✅ | não | 0 (terminal — ação `NOTIFICAR_EQUIPE`) | não |
| 12 | Escolher Distribuidora | `AGUARDANDO_DISTRIBUIDORA` | ✅ | não | 5 úteis | não |
| 13 | Aguardando Foto/PDF | `AGUARDANDO_FOTO_FATURA` | ✅ | não | 0 (terminal — ação `PROCESSAR_OCR`, espera imagem) | não |
| 14 | Atualizar Contrato | `ATUALIZACAO_CONTRATO` | ✅ | não | 4 todos voltam para `MENU_COOPERADO` (sem ação real) | não |
| 15 | Aguardando Atendente Humano | `AGUARDANDO_ATENDENTE` | ✅ | não | 0 (terminal — aguarda humano) | não |
| 16 | Enviar link de indicação | `ENVIAR_CONVITE` | ✅ | não | 0 (terminal — ação `ENVIAR_LINK_INDICACAO`) | não |

⭐ = "Entrada Dinâmica" TENANT vence sempre no INICIAL após fix D-novo-R (19/05).

## Esclarecimentos para o Luciano (pontos da validação visual)

### 1. "Receber fatura" (INICIAL) parece vazia — não é bug

- A etapa renderiza corretamente o modelo `boas_vindas`: "👋 Olá! Sou o assistente da *CoopereBR*..."
- "CoopereBR" aparece porque o `{{parceiro}}` é resolvido para o nome da cooperativa logada — para o CoopereBR, a string fica literalmente "CoopereBR". Para Sinergia futura, seria "Sinergia". **Não é hardcode** — é resolução correta.
- A etapa tem **0 gatilhos** e nenhuma ação real. Espera **imagem** (foto/PDF da fatura). O OCR é disparado pela etapa seguinte (`AGUARDANDO_FOTO_FATURA` com ação `PROCESSAR_OCR`).
- **No simulador parece "vazia" porque o simulador não envia imagem** — só texto. Quem dispara o OCR é o handler de upload no bot real (`whatsapp-bot.service.ts`).
- Conclusão: não é bug; é o ponto de chegada de uma imagem, não de uma resposta textual.

### 2. "Confirmar dados extraídos" dá resposta com `{{historico}}` vazio

> **CORREÇÃO 21/05 (Bloco 0 v2):** a PARTE 4 (anexada mais abaixo) provou que `{{historico}}` era **órfã REAL** — o `extrairVariaveis()` do motor NUNCA populava essa variável. O texto saía literal pro cooperado em qualquer cenário em que o modelo dinâmico fosse renderizado. **Fix aplicado no Bloco 0 v2:** adicionado `formatarHistoricoConsumo()` em `extrairVariaveis()` lendo de `dadosTemp.historicoConsumo` (mesma fonte que o bot hardcoded usa em `whatsapp-bot.service.ts:1543-1550`).
>
> **Em produção HOJE:** o bot hardcoded (`handleConfirmacaoDados`) curto-circuita esse estado e monta o texto manualmente — não usava o modelo dinâmico. Mas o motor já está alinhado pro caso de outro tenant cabear via fluxo dinâmico no futuro, e o simulador agora renderiza corretamente quando `historicoConsumo` é passado em `dadosTemp`.

- Modelo: `"📊 *Dados extraídos da sua fatura:* {{historico}} _Algum dado incorreto?..._ _Tudo certo? Responda *OK*_"`
- Pós-fix: `{{historico}}` é populado por `extrairVariaveis()` a partir de `dadosTemp.historicoConsumo`. Formato por linha: `"MM/AA: NNN kWh - R$ X,XX"` (ou `"MM/AA: NNN kWh"` se valorRS=0). Sem o dado, retorna string vazia.

### 3. Três etapas ATIVAS no estado `INICIAL` — decisão pendente

| Etapa | id | Modelo | Ação | Gatilhos | Observação |
|---|---|---|---|---|---|
| **Entrada Dinâmica** (TENANT) | `cmpd7ez3g0000vafo19lpu1nv` | `menu_principal` | — | **4** úteis (1/2/3/4) | ⭐ vence sempre pro CoopereBR (regra tenant>global) |
| Receber fatura (GLOBAL) | `fluxo-inicial` | `boas_vindas` | — | 0 | Texto pede foto, mas sem gatilhos não consegue avançar via texto |
| Boas-vindas / Menu Principal (GLOBAL) | `f-inicial` | `boas_vindas` | `MOSTRAR_MENU_PRINCIPAL` | 0 | Tem ação placeholder não processada pelo motor |

**Decisão Luciano:** qual desativar?
- **Recomendação técnica:** desativar `Receber fatura` (id=`fluxo-inicial`) — é a mais nua (sem ação, sem gatilho). Manter "Boas-vindas / Menu Principal" como segunda alternativa enquanto a `MOSTRAR_MENU_PRINCIPAL` não vira ação real.
- **Não foi feito nesta tarefa** — regra "não desativar etapas ativas sem decisão de produto".

### 4. Menu Cooperado opções 1 e 2 viram loop — confirmado, catalogado pro Bloco 3

- "1 Ver saldo de créditos" → `MENU_COOPERADO` (loop puro)
- "2 Ver próxima fatura" → `MENU_COOPERADO` (loop puro)
- **Causa:** o gatilho tem campo `acao` (`VER_CREDITOS` e `VER_FATURA`) mas o motor NÃO processa esse campo (apenas `proximoEstado` do gatilho + `acaoAutomatica` da etapa-destino).
- **Não corrigido nesta tarefa** — exige ação real no motor (consultar `cooper-token` para créditos / `cobrancas` para próxima fatura). Catalogado como **Bloco 3 do Sprint Bot Autoatendimento** (~6-9h Code).

### 5. Atualizar Contrato — 4 gatilhos voltam ao menu (mesma natureza dos itens 1/2 acima)

- "1 Aumentar kWh" / "2 Diminuir" / "3 Suspender" / "4 Encerrar" → todos `MENU_COOPERADO`
- Tecnicamente NÃO é loop (estado-destino diferente), mas é "promessa não cumprida" pra UX — cooperado escolhe e o bot volta pro menu sem confirmar a solicitação.
- Catalogado como **Bloco 5 do Sprint Bot Autoatendimento** (~4-6h). Decisão de produto pendente: ação automática OU registra solicitação + notifica equipe?

### 6. Outras variáveis vazias detectadas (esperado / sub-débito)

- **"Confirmar cadastro"** (`AGUARDANDO_CONFIRMACAO_CADASTRO`): `{{titular}}`, `{{endereco}}`, `{{uc}}` vazios no simulador porque `dadosTemp` não foi populado pelo OCR. Em produção é populado. **OK no simulador, OK em produção.**
- **"Confirmar proposta"** (`AGUARDANDO_CONFIRMACAO_PROPOSTA`): `{{valorFaturaMedia}}`, `{{economiaMensal}}`, `{{economiaAnual}}`, `{{desconto}}` vazios — preenchidos pelo motor-proposta após gerar simulação. **OK.**
- **"Dispositivo para buscar email"** (`AGUARDANDO_DISPOSITIVO_EMAIL`): `{{distribuidora}}` vazio porque ainda não foi escolhida — chega aqui ANTES da etapa "Escolher Distribuidora" no caminho `MENU_SEM_FATURA → 2`. **Ordem do fluxo invertida** — variável fica vazia. **Sub-débito menor:** ou reescrever o modelo sem `{{distribuidora}}` (genérico tipo "Em qual dispositivo está seu email?"), ou ajustar o caminho pra passar pela escolha de distribuidora primeiro. Não bloqueia, mas dá UX confusa.
- **"Menu do Cooperado"** (`MENU_COOPERADO`): `{{nome}}` vazio no simulador (sem `dadosTemp.titular`). Em produção é populado pelo cooperado logado. **OK.**

## Resumo executivo

**Estado pós-Bloco 0 + correção rodapé (21/05):**
- ✅ 16/16 etapas renderizam corretamente
- ✅ 0 estados-destino órfãos (gatilhos não apontam pra estados sem etapa ativa)
- ✅ Rodapé universal `_A qualquer momento: digite MENU, INÍCIO ou SAIR._` em todas as etapas
- ✅ Gatilho 5 do MENU_COOPERADO ("Indicar amigo") agora vai pra ENVIAR_CONVITE
- ✅ Modelo `ajuda` sem `{{site}}` vazio
- ⚠️ 3 etapas ATIVAS no INICIAL — pendente decisão Luciano (desativar 1)
- ⚠️ Menu Cooperado opções 1, 2: loops — Bloco 3 (ação real)
- ⚠️ Atualizar Contrato: 4 opções voltam ao menu — Bloco 5 (decisão produto)
- ⚠️ AGUARDANDO_DISPOSITIVO_EMAIL com `{{distribuidora}}` vazio quando chega pelo caminho "2 Email" — sub-débito menor

**Catalogado para sprints futuros (NÃO corrigido nesta tarefa):**

| Item | Bloco | Estimativa | Decisão pendente? |
|---|---|---|---|
| Ver saldo de créditos (opção 1) | Bloco 3 | ~6-9h | não |
| Ver próxima fatura (opção 2) | Bloco 3 | ~6-9h | não |
| Atualizar Contrato (4 opções) | Bloco 5 | ~4-6h | **SIM** (automática vs humano) |
| Desativar 1 etapa duplicada INICIAL | Bloco 0 v2 | 5min | **SIM** (qual) |
| `{{distribuidora}}` vazio em AGUARDANDO_DISPOSITIVO_EMAIL | sub-débito | ~15min | **SIM** (reescrever modelo ou ajustar caminho) |

---

# Revisão das mensagens (PARTE 4 — anexada 21/05)

Revisão de todos os ModeloMensagem usados no **fluxo conversacional** do bot — modelos referenciados por `FluxoEtapa` (ATIVAS + INATIVAS) + `ajuda` + `cancelar` (disparados por palavra-chave no `whatsapp-bot.service.ts`).

**Excluídos da revisão** (são de job/cron/trigger, não fluxo conversacional): `cobranca_mensal`, `lembrete_vencimento_d3`, `pagamento_confirmado`, `convite_mlm`, `nps_trimestral`, `onboarding_30d`, `reengajamento_60d`, `geracao_baixa_mes`, `proposta_pdf`, `processando_fatura`.

**Total revisado:** 19 modelos.

## Critério de classificação das variáveis

Cruzado com o que `WhatsappFluxoMotorService.extrairVariaveis()` realmente popula (`backend/src/whatsapp/whatsapp-fluxo-motor.service.ts:321-363`):

- **Sempre populada (tenant):** vem da entidade `Cooperativa` — preenchida sempre que `cooperativaId` está conhecido. Inclui `{{parceiro}}`, `{{cooperativa}}`, `{{cidade}}`, `{{estado_parceiro}}`, `{{email_suporte}}`, `{{telefone_suporte}}`, `{{tipo_parceiro}}`, `{{tipo_membro}}`, `{{tipo_membro_plural}}`.
- **Populada em produção:** depende de `dadosTemp` (preenchido pelo handler do bot real conforme avança o fluxo) ou `resultado` (saída do motor-proposta após simulação). Inclui `{{nome}}`, `{{titular}}`, `{{endereco}}`, `{{uc}}`, `{{distribuidora}}`, `{{valorFaturaMedia}}`, `{{valorComDesconto}}`, `{{mes}}`, `{{economia}}`, `{{economiaMensal}}`, `{{economiaAnual}}`, `{{desconto}}`, `{{kwhContrato}}`. Fica vazio só no simulador (esperado).
- **Constante vazia:** `{{link}}`, `{{link_pagamento}}`, `{{percentual}}`, `{{site}}` — declaradas como `''` no `extrairVariaveis()`. Sempre vazias. Sub-débitos.
- **ÓRFÃ REAL:** variável que aparece no texto mas **NÃO existe** em `extrairVariaveis()`. Motor nunca popula. **É bug latente** — texto vai sair com `{{x}}` literal pro cooperado.

## Tabela das mensagens

| # | Mensagem | Variáveis no texto | Órfãs REAIS | Populadas em produção | Sempre populadas | Coerência | Obs |
|---|---|---|---|---|---|---|---|
| 1 | `aguardando_atendente` | — | — | — | — | ✅ texto OK | Hardcoda "Seg–Sex 8h–18h" — pode ser invalido para Sinergia futura |
| 2 | `aguardando_dispositivo_email` | `{{distribuidora}}` | — | `{{distribuidora}}` | — | ⚠️ chega vazia | Caminho via MENU_SEM_FATURA→2 ocorre antes de Escolher Distribuidora — chega `{{distribuidora}}` vazia. Sub-débito |
| 3 | `aguardando_distribuidora` | — | — | — | — | ✅ texto OK | — |
| 4 | `aguardando_foto_fatura` | — | — | — | — | ✅ texto OK | — |
| 5 | `ajuda` | `{{parceiro}}`, `{{telefone_suporte}}` | — | — | ambos | ✅ texto OK | Corrigido no Bloco 0 (era `{{site}}` vazio) |
| 6 | `boas_vindas` | `{{parceiro}}` | — | — | `{{parceiro}}` | ✅ texto OK | Compartilhado por 2 etapas ativas INICIAL (Receber fatura + Boas-vindas / Menu Principal) |
| 7 | `cadastro_sucesso` | — | — | — | — | ✅ texto OK | — |
| 8 | `cancelar` | — | — | — | — | ✅ texto OK | Hardcoded (palavra-chave do bot) |
| 9 | `confirmacao_cadastro` | `{{titular}}`, `{{endereco}}`, `{{uc}}` | — | todas 3 | — | ✅ esperado | Variáveis populadas via OCR/wizard |
| 10 | `confirmacao_dados` | `{{historico}}` | **`{{historico}}`** | — | — | ⚠️ **órfã real** | Motor NUNCA popula `{{historico}}`. Texto sai com `{{historico}}` literal em produção. Bug latente |
| 11 | `convite_indicacao` | — | — | — | — | ✅ texto OK | Refeito no R5 OBS 2 — modelo curto + ação envia link |
| 12 | `lead_fora_area` | `{{valorFatura}}`, `{{economia}}`, `{{distribuidora}}` | **`{{valorFatura}}`** | `{{economia}}`, `{{distribuidora}}` | — | ⚠️ **bug naming** | Motor popula `valorFaturaMedia` (com "Media"), modelo usa `valorFatura` (sem) |
| 13 | `menu_atualizar_cadastro` | — | — | — | — | ⚠️ **promessa quebrada** | Lista 4 opções (Nome/Email/Telefone/Endereço) mas as 4 etapas-destino (AGUARDANDO_NOVO_NOME/EMAIL/TELEFONE/CEP) **não existem** — etapa origem está inativa, ativá-la cai em órfão |
| 14 | `menu_atualizar_contrato` | — | — | — | — | ⚠️ **promessa quebrada** | 4 opções voltam ao menu sem ação real (Bloco 5) |
| 15 | `menu_cooperado` | `{{nome}}` | — | `{{nome}}` | — | ⚠️ **promessas parciais** | 7 opções, mas 1/2 viram loop (Bloco 3), 4 volta ao menu (Bloco 5). Opções 3, 5, 6, 7 funcionam |
| 16 | `menu_principal` | `{{parceiro}}` | — | — | `{{parceiro}}` | ✅ texto OK | Compartilhado por 2 etapas (Menu Principal MENU_PRINCIPAL + Entrada Dinâmica INICIAL) |
| 17 | `menu_sem_fatura` | — | — | — | — | ✅ texto OK | — |
| 18 | `nps_aguardando_nota` | `{{parceiro}}` | — | — | `{{parceiro}}` | ⚠️ **promessa quebrada** | Pede nota 0-10 mas a etapa não tem gatilhos pra capturar — gatilhos ausentes (Bloco 7) |
| 19 | `simulacao_resultado` | `{{parceiro}}`, `{{valorFaturaMedia}}`, `{{valorComDesconto}}`, `{{desconto}}`, `{{economiaMensal}}`, `{{economiaAnual}}`, `{{mesesGratis}}` | **`{{mesesGratis}}`** | `{{valorFaturaMedia}}`, `{{valorComDesconto}}`, `{{desconto}}`, `{{economiaMensal}}`, `{{economiaAnual}}` | `{{parceiro}}` | ⚠️ **órfã real** | `{{mesesGratis}}` não populado pelo motor — pode ser feature do motor-proposta nunca implementada |

## Órfãs REAIS identificadas (3 bugs latentes)

| Variável | Modelo | Impacto | Recomendação |
|---|---|---|---|
| `{{historico}}` | `confirmacao_dados` | Cooperado vê literal "📊 Dados extraídos: `{{historico}}` Algum dado incorreto?" — bot vira robô idiota | (a) popular `{{historico}}` em `extrairVariaveis()` a partir de `dadosTemp.historico` que o OCR já preenche; OU (b) reescrever modelo pra usar variáveis individuais (`{{kwhConsumido}}`, `{{mesReferencia}}`) |
| `{{valorFatura}}` | `lead_fora_area` | Idem — sai literal "Fatura atual: R$ `{{valorFatura}}`" | Trocar pra `{{valorFaturaMedia}}` (já populado) — fix trivial |
| `{{mesesGratis}}` | `simulacao_resultado` | Linha extra no texto sai como `{{mesesGratis}}` literal | (a) popular em `extrairVariaveis()` a partir de `resultado.mesesGratis`; OU (b) remover a linha do modelo (se feature nunca implementada) |

## Promessas quebradas no texto (catalogadas pra Sprint Bot Autoatendimento)

| Modelo | Promessa | Realidade | Bloco do sprint |
|---|---|---|---|
| `menu_cooperado` | "1 Ver saldo de créditos" / "2 Ver próxima fatura" | Volta ao menu (loop) | **Bloco 3** |
| `menu_cooperado` | "3 Atualizar meu cadastro" | Estado-destino existe inativa + sub-estados não existem | **Bloco 4** |
| `menu_atualizar_contrato` | 4 opções (Aumentar/Diminuir/Suspender/Encerrar) | Voltam ao menu sem ação real | **Bloco 5** |
| `menu_atualizar_cadastro` | 4 opções (Nome/Email/Telefone/Endereço) | Etapa origem inativa + sub-estados não existem | **Bloco 4** |
| `nps_aguardando_nota` | "Digite apenas o número 0-10" | Etapa não tem gatilhos pra capturar nota | **Bloco 7** |

## Variáveis "constante vazia" (sub-débitos menores)

`{{link}}`, `{{link_pagamento}}`, `{{percentual}}` declaradas como `''` no `extrairVariaveis()`. Hoje **nenhuma mensagem do fluxo conversacional usa elas** — só na lista de variáveis sugeridas do `ModalMensagem` da UI (`web/app/dashboard/whatsapp-config/page.tsx:76-99`). Se admin criar modelo com elas, sairá vazia. **Não é bug imediato**, mas confunde — UI promete variáveis que não são populadas. Catalogar como sub-débito UX da tela do admin (~30min: remover da lista ou popular de algum lugar).

## Duplicação de conteúdo

✅ **Zero modelos com conteúdo idêntico**. O `boas_vindas` (compartilhado por 2 etapas INICIAL) e o `menu_principal` (compartilhado por Menu Principal + Entrada Dinâmica) são o **mesmo modelo** referenciado de 2 lugares — não duplicação real.

## Coerência / tom

- **Tom consistente** entre os 19 modelos: linguagem informal-cordial, uso de emojis no início, opções numeradas 1️⃣2️⃣3️⃣, formatação `*negrito*` e `_itálico_` (markdown WhatsApp).
- **Horário hardcoded em `aguardando_atendente`** ("Seg–Sex 8h–18h") — pode não bater com Sinergia futura. Sub-débito de produto: parametrizar via `{{horario_atendimento}}` (variável nova) ou propor que cada parceiro edite o modelo via UI.
- **Promessas no texto** alinhadas com gatilhos: ✅ `menu_principal`, `menu_sem_fatura`, `aguardando_distribuidora`, `aguardando_dispositivo_email`. ⚠️ `menu_cooperado`, `menu_atualizar_cadastro`, `menu_atualizar_contrato` (catalogadas acima).
- **Português**: revisão visual rápida não detectou erros gramaticais. Todos os modelos têm acentuação correta + emojis renderizando OK no terminal.

## Recomendações pra catalogar (NÃO implementado nesta tarefa)

| # | Item | Prioridade | Estimativa | Bloco / decisão |
|---|---|---|---|---|
| R1 | Trocar `{{valorFatura}}` → `{{valorFaturaMedia}}` em `lead_fora_area` | P2 (bug latente, etapa inativa hoje) | 5min | Quick fix |
| R2 | Resolver `{{historico}}` em `confirmacao_dados` (popular ou reescrever) | **P1 (bug ativo)** | 30-60min | Bloco 0 v2 ou novo quick |
| R3 | Resolver `{{mesesGratis}}` em `simulacao_resultado` (popular ou remover linha) | P2 (etapa ativa, sai feio se chegar lá) | 30min | Quick fix |
| R4 | `{{distribuidora}}` em `aguardando_dispositivo_email` (reescrever modelo ou ajustar caminho) | P2 (UX confusa) | 15min | **Decisão produto** |
| R5 | Parametrizar horário de atendimento em `aguardando_atendente` (`{{horario_atendimento}}`) | P3 (pré-onboarding Sinergia) | 30min | **Decisão produto** |
| R6 | Limpar variáveis vazias da lista da UI `ModalMensagem` (link, link_pagamento, percentual) | P3 (UX admin) | 30min | Quick UX |

**Os 3 órfãs reais (R1, R2, R3) somam ~1.5h** — pode entrar como **Bloco 0 v2** ou ser executado antes do Bloco 2.

## Síntese da revisão

19 modelos do fluxo, **3 órfãs reais** (variáveis que o motor nunca popula — bug latente que sai literal pro cooperado quando atingir essas etapas em produção), **5 promessas quebradas** já catalogadas nos blocos do sprint, **zero duplicação de conteúdo** e **tom consistente** em todos. As correções das 3 órfãs (~1.5h) podem ser priorizadas antes do Bloco 2 — são bugs reais com fix simples. As demais decisões (`{{distribuidora}}` em DISPOSITIVO_EMAIL, horário hardcoded, lista de variáveis da UI) ficam pra Luciano avaliar.

