# Relatório completo — Banco de Mensagens + Fluxo do Bot WhatsApp

**Data:** 2026-05-20
**Tipo:** read-only (zero alteração no banco/código)
**Tenant analisado:** CoopereBR (`cmn0ho8bx0000uox8wu96u6fd`)
**Estado após:** R2 (hardcodes), R3 (etapaIdForcado), R4 (avisoTransicao), R5 (Convidar amigo), R1 (limpeza duplicatas), R6 (reativar órfãs) — todos aplicados localmente nesta sessão (commits ainda sem push).

---

## SEÇÃO 1 — BANCO DE MENSAGENS

29 modelos no banco. Todos GLOBAL (servem pra qualquer parceiro). Todos `ativo=true`. Categorias:

- **BOT** (25): mensagens do fluxo conversacional
- **COBRANCA** (3): cobrança, lembrete, pagamento confirmado
- **MLM** (1): convite pelo programa de indicação

### Modelos do BOT — usados no fluxo conversacional

| Nome | Ativo | Escopo | Usos | `{{parceiro}}` | "CoopereBR" hardcoded | URL fixa | Resumo (1 linha) | # etapas usando |
|---|---|---|---|---|---|---|---|---|
| `boas_vindas` | sim | global | 15 | **sim** ✅ | não | não | "👋 Olá! Sou o assistente da {{parceiro}}..." | **2** ⚠️ |
| `menu_principal` | sim | global | 0 | **sim** ✅ | não | não | "Como posso ajudar? 1 Já sou cooperado / 2 Quero ser / 3 Atendente / 4 Convidar amigo" | **2** ⚠️ |
| `menu_cooperado` | sim | global | 14 | não | não | não | "Olá {{nome}}! 1 Ver créditos / 2 Ver fatura / 3 Atualizar / 4 Contrato / 5 Indicar / 6 Suporte / 7 Atendente" | 1 |
| `menu_sem_fatura` | sim | global | 1 | não | não | não | "1 Já tenho fatura / 2 Está no email / 3 Baixar do site" | 1 |
| `confirmacao_dados` | sim | global | 4 | não | não | não | "📊 Dados extraídos: {{historico}} — Tudo certo? Responda OK" | 1 |
| `simulacao_resultado` | sim | global | 4 | **sim** ✅ | não | não | "🌱 Sua simulação {{parceiro}}: Economia R$ {{economiaMensal}}/mês..." | 1 |
| `confirmacao_cadastro` | sim | global | 6 | não | não | não | "👤 {{titular}} / 📍 {{endereco}} / 🔌 UC: {{uc}} — Responda CONFIRMO" | 1 |
| `cadastro_sucesso` | sim | global | 7 | não | não | não | "🎉 Pré-cadastro criado! Nossa equipe entrará em contato em breve." | 1 |
| `aguardando_distribuidora` | sim | global | 0 | não | não | não | "Qual sua distribuidora? EDP-ES / CEMIG / COPEL / LIGHT / OUTRA" | 1 |
| `aguardando_dispositivo_email` *(novo R6)* | sim | global | 0 | não | não | não | "📧 Em qual dispositivo da {{distribuidora}}? 1 Celular / 2 Computador" | 1 |
| `aguardando_foto_fatura` | sim | global | 2 | não | não | não | "📎 Envie a foto ou PDF da sua conta de energia." | 1 |
| `aguardando_atendente` | sim | global | 1 | não | não | não | "👤 Encaminhando para atendente humano... Seg–Sex 8h–18h." | 1 |
| `menu_atualizar_cadastro` | sim | global | 0 | não | não | não | "1 Nome / 2 Email / 3 Telefone / 4 Endereço" | 1 (etapa inativa) |
| `menu_atualizar_contrato` | sim | global | 0 | não | não | não | "1 Aumentar kWh / 2 Diminuir / 3 Suspender / 4 Encerrar" | 1 |
| `lead_fora_area` | sim | global | 0 | não | não | não | "Ainda não temos parceiro na área da {{distribuidora}}..." | 1 (etapa inativa) |
| `nps_aguardando_nota` | sim | global | 0 | **sim** ✅ | não | não | "De 0 a 10, quanto você indicaria a {{parceiro}}?" | 1 (etapa inativa) |
| `convite_indicacao` *(novo R5)* | sim | global | 0 | não | não | não | "🎁 Beleza! Vou te enviar seu link de indicação 👇" | 1 |
| `proposta_pdf` | sim | global | 0 | **sim** ✅ | não | não | "📋 PROPOSTA {{parceiro}} / {{titular}} / {{endereco}}..." | **0** |
| `processando_fatura` | sim | global | 6 | não | não | não | "📄 Recebi sua fatura! Analisando..." | **0** |
| `ajuda` | sim | global | 0 | não | não | não | "Para falar com nossa equipe, acesse: {{site}}" | **0** |
| `cancelar` | sim | global | 0 | não | não | não | "Tudo bem! Se quiser começar novamente..." | **0** |
| `geracao_baixa_mes` | sim | global | 0 | **sim** ✅ | não | não | "📉 Oi {{nome}}, transparência total: neste mês ({{mes}})..." | **0** |
| `onboarding_30d` | sim | global | 0 | **sim** ✅ | não | não | "🎓 Olá {{nome}}, parabéns pelos 30 dias na {{parceiro}}!" | **0** |
| `reengajamento_60d` | sim | global | 0 | **sim** ✅ | não | não | "Oi {{nome}}, sentimos sua falta!" | **0** |
| `nps_trimestral` | sim | global | 0 | **sim** ✅ | não | não | "Oi {{nome}}! Faz 3 meses que você é {{tipo_membro}}..." | **0** |

### Modelos de COBRANÇA

| Nome | Ativo | Usos | `{{parceiro}}` | Resumo | # etapas |
|---|---|---|---|---|---|
| `cobranca_mensal` | sim | 0 | sim | "Sua fatura {{parceiro}} de {{mes}} disponível" | 0 (usado por job) |
| `lembrete_vencimento_d3` | sim | 0 | sim | "Lembrete: sua fatura vence em 3 dias" | 0 (usado por job) |
| `pagamento_confirmado` | sim | 0 | sim | "✅ Pagamento recebido, {{nome}}!" | 0 (usado por job) |

### Modelos MLM

| Nome | Ativo | Usos | `{{parceiro}}` | Resumo | # etapas |
|---|---|---|---|---|---|
| `convite_mlm` | sim | 3 | sim | "Você sabia que pode ganhar {{percentual}}% indicando amigos?" | 0 (job de waves) |

**Achados gerais da Seção 1:**
- ✅ ZERO hardcode "CoopereBR" sobrevivente (todos foram trocados por `{{parceiro}}` no R2)
- ✅ ZERO URL hardcoded (a "cooperebr.com.br" sumiu, agora `ajuda` usa `{{site}}` — variável que **hoje retorna vazio**, sub-débito).
- ⚠️ **2 modelos compartilhados por 2 etapas cada** (`boas_vindas` e `menu_principal`) — isso reforça as duplicações da Seção 2.
- 12 modelos com **0 etapas** apontando — mas NÃO são lixo: são usados por jobs (cobrança, NPS, onboarding, OCR, MLM) e por palavras-chave do bot hardcoded (ajuda/cancelar). Tudo OK.

---

## SEÇÃO 2 — FLUXO DO BOT

25 etapas no banco (visíveis ao tenant CoopereBR). **13 ATIVAS**, **12 inativas**.

### Etapas ATIVAS (13)

| Ordem | Nome | Estado | Escopo | Modelo | Ação automática | Gatilhos |
|---|---|---|---|---|---|---|
| 1 | Menu Principal | `MENU_PRINCIPAL` | global | menu_principal | — | "1"→MENU_COOPERADO / "2"→MENU_SEM_FATURA / "3"→AGUARDANDO_ATENDENTE / "4"→ENVIAR_CONVITE |
| 1 | **Receber fatura** ⚠️ | `INICIAL` | global | boas_vindas | — | (sem gatilhos) |
| 2 | **Boas-vindas / Menu Principal** ⚠️ | `INICIAL` | global | boas_vindas | MOSTRAR_MENU_PRINCIPAL | (sem gatilhos) |
| 2 | Confirmar dados extraídos | `AGUARDANDO_CONFIRMACAO_DADOS` | global | confirmacao_dados | GERAR_PROPOSTA | "OK"→AGUARDANDO_CONFIRMACAO_PROPOSTA |
| 3 | Confirmar proposta | `AGUARDANDO_CONFIRMACAO_PROPOSTA` | global | simulacao_resultado | — | "SIM"→AGUARDANDO_CONFIRMACAO_CADASTRO |
| 3 | Menu do Cooperado | `MENU_COOPERADO` | global | menu_cooperado | — | "1","2","5"→MENU_COOPERADO (loop) / "3"→AGUARDANDO_FOTO_FATURA / "4"→ATUALIZACAO_CONTRATO / "6","7"→AGUARDANDO_ATENDENTE |
| 4 | Confirmar cadastro | `AGUARDANDO_CONFIRMACAO_CADASTRO` | global | confirmacao_cadastro | CRIAR_LEAD | "CONFIRMO"→CONCLUIDO |
| 4 | Sem Fatura — Opções | `MENU_SEM_FATURA` | global | menu_sem_fatura | — | "1"→AGUARDANDO_FOTO_FATURA / "2"→AGUARDANDO_DISPOSITIVO_EMAIL / "3"→AGUARDANDO_DISTRIBUIDORA |
| 5 | Fluxo concluído | `CONCLUIDO` | global | cadastro_sucesso | NOTIFICAR_EQUIPE | (sem gatilhos — terminal) |
| 5 | Dispositivo para buscar email | `AGUARDANDO_DISPOSITIVO_EMAIL` | global | aguardando_dispositivo_email | — | "CEL","PC"→AGUARDANDO_FOTO_FATURA |
| 6 | Escolher Distribuidora | `AGUARDANDO_DISTRIBUIDORA` | global | aguardando_distribuidora | — | "EDP-ES","CEMIG","COPEL","LIGHT","OUTRA"→AGUARDANDO_FOTO_FATURA |
| 7 | Aguardando Foto/PDF da Fatura | `AGUARDANDO_FOTO_FATURA` | global | aguardando_foto_fatura | PROCESSAR_OCR | (sem gatilhos — espera imagem) |
| 19 | Atualizar Contrato | `ATUALIZACAO_CONTRATO` | global | menu_atualizar_contrato | — | "1","2","3","4"→MENU_COOPERADO (todos voltam) |
| 20 | Aguardando Atendente Humano | `AGUARDANDO_ATENDENTE` | global | aguardando_atendente | — | (sem gatilhos) |
| 23 | Enviar link de indicacao | `ENVIAR_CONVITE` | global | convite_indicacao | ENVIAR_LINK_INDICACAO | (sem gatilhos — terminal) |
| 28 | **Entrada Dinâmica** ⭐ | `INICIAL` | **do parceiro** | menu_principal | — | "1"→MENU_COOPERADO / "2"→MENU_SEM_FATURA / "3"→AGUARDANDO_ATENDENTE / "4"→ENVIAR_CONVITE |

⭐ = a "Entrada Dinâmica" do CoopereBR vence sempre as 2 globais do INICIAL (prioridade tenant>global, fix D-novo-R 19/05).

### Etapas INATIVAS (12)

| Ordem | Nome | Estado | Modelo | Gatilhos |
|---|---|---|---|---|
| 12 | Lead Fora da Área de Atuação | `LEAD_FORA_AREA` | lead_fora_area | "1","2"→CONCLUIDO |
| 13 | Cadastro por Proxy — Nome do Amigo | `CADASTRO_PROXY_NOME` | **— (sem modelo)** | (vazio) |
| 14 | Cadastro por Proxy — Telefone do Amigo | `CADASTRO_PROXY_TELEFONE` | **— (sem modelo)** | (vazio) |
| 15 | Cadastro por Proxy — Fatura do Amigo | `AGUARDANDO_FATURA_PROXY` | **— (sem modelo)** | (vazio) |
| 16 | Cadastro por Proxy — Confirmar | `CONFIRMAR_PROXY` | **— (sem modelo)** | "1","2"→CONCLUIDO |
| 17 | Menu de Cobranças/Faturas | `MENU_FATURA` | **— (sem modelo)** | (vazio) |
| 18 | Atualizar Cadastro | `ATUALIZACAO_CADASTRO` | menu_atualizar_cadastro | "1"→AGUARDANDO_NOVO_NOME / "2"→AGUARDANDO_NOVO_EMAIL / "3"→AGUARDANDO_NOVO_TELEFONE / "4"→AGUARDANDO_NOVO_CEP |
| 21 | NPS — Aguardando Nota | `NPS_AGUARDANDO_NOTA` | nps_aguardando_nota | (vazio) |
| 22 | Menu Inadimplente | `MENU_INADIMPLENTE` | **— (sem modelo)** | (vazio) |

---

## SEÇÃO 3 — O MAPA DA CONVERSA

Desenho do fluxo, partindo do `INICIAL` (Entrada Dinâmica do CoopereBR — a que vence):

```
INICIAL "Entrada Dinâmica" ⭐
 │
 ├─ "1" → MENU_COOPERADO ✅
 │        │
 │        ├─ "1" → MENU_COOPERADO  ⚠️ loop (promete "Ver saldo de créditos" mas só volta pro menu)
 │        ├─ "2" → MENU_COOPERADO  ⚠️ loop (promete "Ver próxima fatura" mas só volta pro menu)
 │        ├─ "3" → AGUARDANDO_FOTO_FATURA ✅
 │        │        └─ (recebe imagem) → ação PROCESSAR_OCR → bot hardcoded assume daqui
 │        ├─ "4" → ATUALIZACAO_CONTRATO ✅
 │        │        ├─ "1" Aumentar kWh   → MENU_COOPERADO  ⚠️ promete mas só volta
 │        │        ├─ "2" Diminuir kWh   → MENU_COOPERADO  ⚠️ promete mas só volta
 │        │        ├─ "3" Suspender      → MENU_COOPERADO  ⚠️ promete mas só volta
 │        │        └─ "4" Encerrar       → MENU_COOPERADO  ⚠️ promete mas só volta
 │        ├─ "5" → MENU_COOPERADO  ⚠️ loop (promete "Indicar amigo" mas só volta — INCONSISTENTE com "4" do INICIAL)
 │        ├─ "6" → AGUARDANDO_ATENDENTE ✅
 │        └─ "7" → AGUARDANDO_ATENDENTE ✅
 │
 ├─ "2" → MENU_SEM_FATURA ✅
 │        │
 │        ├─ "1" → AGUARDANDO_FOTO_FATURA ✅
 │        │        └─ (recebe imagem) → PROCESSAR_OCR → bot hardcoded segue
 │        │              └─ AGUARDANDO_CONFIRMACAO_DADOS ✅
 │        │                    └─ "OK" → AGUARDANDO_CONFIRMACAO_PROPOSTA ✅
 │        │                              └─ "SIM" → AGUARDANDO_CONFIRMACAO_CADASTRO ✅
 │        │                                          └─ "CONFIRMO" → CONCLUIDO ✅ (fim)
 │        ├─ "2" → AGUARDANDO_DISPOSITIVO_EMAIL ✅
 │        │        ├─ "CEL" → AGUARDANDO_FOTO_FATURA ✅
 │        │        └─ "PC"  → AGUARDANDO_FOTO_FATURA ✅
 │        └─ "3" → AGUARDANDO_DISTRIBUIDORA ✅
 │                 ├─ "EDP-ES","CEMIG","COPEL","LIGHT","OUTRA" → AGUARDANDO_FOTO_FATURA ✅
 │
 ├─ "3" → AGUARDANDO_ATENDENTE ✅
 │        └─ (sem gatilhos — bot mostra "Encaminhando..." e fica aguardando humano)
 │
 └─ "4" → ENVIAR_CONVITE ✅
          └─ ação ENVIAR_LINK_INDICACAO no bot real
                  → cooperado recebe modelo "Beleza! Vou te enviar seu link 👇"
                  → depois recebe link `/entrar?ref=CODIGO`
                  → fim (terminal)
```

**Status visual:**
- ✅ = etapa existe ATIVA, fluxo continua
- ⚠️ = transição existe mas leva a loop sem ação real (funcionalidade prometida no texto, não entregue no fluxo)
- ❌ = SEM etapa ativa (bot trava ou cai no hardcoded) — **ZERO ocorrências após R6** ✅

**Não há ❌ no mapa.** Todos os destinos têm etapa ativa. Resta o problema "⚠️" — promessas no texto que viram loop.

---

## SEÇÃO 4 — O QUE ESTÁ FALTANDO

### 4.1 Becos no fluxo (estados-destino órfãos)

✅ **Zero becos.** Todas as 11 transições do mapa levam a estados com etapa ativa. (Antes do R6, eram 5 becos.)

### 4.2 Jornadas incompletas (começam e não terminam ou prometem e não cumprem)

**"Ver saldo de créditos" (menu cooperado, opção 1)** — o texto diz "⚡ Ver saldo de créditos" mas o gatilho 1 volta pra `MENU_COOPERADO`. O campo `acao: VER_CREDITOS` no gatilho **não é processado pelo motor** (motor só usa `proximoEstado` e a `acaoAutomatica` da etapa-destino).

**"Ver próxima fatura" (menu cooperado, opção 2)** — idem ao acima. `acao: VER_FATURA` no gatilho, mas não é executada.

**"Indicar amigo" (menu cooperado, opção 5)** — mesma situação. `acao: GERAR_LINK_INDICACAO` no gatilho, mas o motor não processa esse campo. **Pior:** existe um caminho funcional para isso (gatilho "4" do INICIAL → `ENVIAR_CONVITE`), mas só está cabeado no menu de entrada, não no menu do cooperado. **Inconsistência:** quem clica em "4" do INICIAL recebe o link; quem clica em "5" do MENU_COOPERADO fica no loop.

**"Atualizar Contrato" (4 opções) — todas voltam ao menu:** Aumentar/Diminuir/Suspender/Encerrar kWh. Promete ação real, entrega só retorno.

**"Atualizar Cadastro" (4 opções) — etapas-destino não existem:**
- "1 Nome" → `AGUARDANDO_NOVO_NOME` (sem etapa)
- "2 Email" → `AGUARDANDO_NOVO_EMAIL` (sem etapa)
- "3 Telefone" → `AGUARDANDO_NOVO_TELEFONE` (sem etapa)
- "4 Endereço" → `AGUARDANDO_NOVO_CEP` (sem etapa)
- A etapa origem (`ATUALIZACAO_CADASTRO`) está **inativa** — não chega nela hoje. Mas se ativar, vai dar em beco.

**"Cadastro por Proxy" (4 etapas inativas):**
- `CADASTRO_PROXY_NOME` / `CADASTRO_PROXY_TELEFONE` / `AGUARDANDO_FATURA_PROXY` / `CONFIRMAR_PROXY`
- Todas sem modelo de mensagem, todas inativas. Promessa do bot hardcoded mas não cabeada no dinâmico.

**"NPS" (estado=NPS_AGUARDANDO_NOTA inativa):**
- Modelo existe (`nps_aguardando_nota`), mas etapa inativa e sem gatilhos para receber notas 0-10.

**"Menu de Cobranças/Faturas" (MENU_FATURA inativa, sem modelo):**
- Estado existe, etapa inativa, sem modelo. Provavelmente referenciado por código que ainda não foi cabeado.

**"Menu Inadimplente" (MENU_INADIMPLENTE inativa, sem modelo):**
- Idem — sem modelo, sem implementação.

**"Lead Fora da Área" (LEAD_FORA_AREA inativa):**
- Etapa inativa, mas o bot hardcoded (`whatsapp-bot.service.ts`) ainda implementa esse fluxo via código. Duplicação de implementação.

### 4.3 Modelos referenciados que não existem no banco

✅ Zero. Todos os modelos referenciados por etapas existem.

### 4.4 Variáveis prometidas pelos modelos que não chegam a ser populadas

**`{{site}}`** — usado pelo modelo `ajuda` ("Para falar com nossa equipe, acesse: {{site}}"). No `extrairVariaveis()` do motor, `site: ''` — sempre retorna string vazia. Resultado: cooperado vê "acesse: ". Sub-débito mínimo.

**`{{mes}}`, `{{historico}}`, `{{valorFatura}}`, `{{mesesGratis}}`** — populados só quando o bot processa fatura real via OCR (não vão aparecer no simulador a menos que `dadosTemp` seja passado). OK porque o fluxo as alimenta no momento certo.

---

## SEÇÃO 5 — O QUE ESTÁ REPETIDO

### 5.1 Modelos com nome ou conteúdo idêntico

✅ **Zero.** Nenhum modelo duplicado por nome ou conteúdo. (O "duplicado" do relatório anterior era falso positivo — eram etapas distintas referenciando o mesmo modelo.)

### 5.2 Modelos compartilhados por 2 etapas (compartilhamento, não duplicação)

| Modelo | Etapas que usam | Comentário |
|---|---|---|
| `boas_vindas` | "Receber fatura" (INICIAL ordem=1) + "Boas-vindas / Menu Principal" (INICIAL ordem=2) | Duas etapas ATIVAS no mesmo estado — duplicação de etapa, não de modelo |
| `menu_principal` | "Menu Principal" (MENU_PRINCIPAL ordem=1) + "Entrada Dinâmica" (INICIAL ordem=28, TENANT) | OK — uma cobre o estado `MENU_PRINCIPAL`, outra cobre `INICIAL`. Não é duplicação |

### 5.3 Etapas com mesmo estado (duplicação real)

**1 par identificado** (única duplicação ativa remanescente):

```
estado=INICIAL (2 etapas ATIVAS globais):
  ordem=1 "Receber fatura"           modelo=boas_vindas  gatilhos=0  ação=null
  ordem=2 "Boas-vindas / Menu Principal" modelo=boas_vindas gatilhos=0 ação=MOSTRAR_MENU_PRINCIPAL
```

Ambas têm 0 gatilhos. Como a "Entrada Dinâmica" do CoopereBR (TENANT, ordem=28) vence sempre, essas 2 globais nunca são usadas pelo CoopereBR. Mas:
- Para um tenant NOVO sem etapa própria do `INICIAL`, o motor pegaria "Receber fatura" (ordem=1) — e ela tem 0 gatilhos, então o bot do tenant novo travaria.
- "Boas-vindas / Menu Principal" tem `acaoAutomatica: MOSTRAR_MENU_PRINCIPAL` (ação não implementada no motor — não está no executarAcao()).

### 5.4 Modelos sem etapa apontando (12 "soltos")

Não são lixo — são usados em outros pontos do código:
- `ajuda`, `cancelar` — disparados por palavras-chave do bot hardcoded
- `processando_fatura` — disparado durante upload de imagem
- `proposta_pdf` — gerado após simulação
- `geracao_baixa_mes`, `onboarding_30d`, `reengajamento_60d`, `nps_trimestral` — jobs de engajamento periódicos
- `cobranca_mensal`, `lembrete_vencimento_d3`, `pagamento_confirmado` — jobs do módulo cobranças
- `convite_mlm` — job de convites por waves

---

## SEÇÃO 6 — SUGESTÕES (não implementar)

### 6.1 CRIAR — etapas/modelos faltantes

#### Cadastro por Proxy (4 modelos novos + ativar 4 etapas)
**Tipo:** dado + decisão de produto.
- O bot hardcoded já implementa esse fluxo. Cabear no dinâmico exige decidir se é prioridade.
- Criar 4 modelos: `proxy_pedindo_nome`, `proxy_pedindo_telefone`, `proxy_pedindo_fatura`, `proxy_confirmar`.
- Conteúdos sugeridos:
  - `proxy_pedindo_nome`: "Qual o *nome completo* do seu amigo?"
  - `proxy_pedindo_telefone`: "E o *telefone* dele (com DDD)? Vou usar pra contato."
  - `proxy_pedindo_fatura`: "Perfeito! Agora me envie *foto ou PDF* da conta de luz dele 📸"
  - `proxy_confirmar`: "Vou cadastrar este amigo:\n👤 {{titular}}\n📞 {{telefone}}\n\n1️⃣ Confirmo\n2️⃣ Cancelar"
- Ativar 4 etapas com `acaoAutomatica` correspondente (precisa implementar `CADASTRAR_AMIGO_POR_PROXY` no motor — código).

#### Modelos `aguardando_novo_nome / email / telefone / cep` (4 modelos novos + 4 etapas novas + ativar `ATUALIZACAO_CADASTRO`)
**Tipo:** dado + código (ações).
- Sem essas 4 etapas, "Atualizar Cadastro" não funciona mesmo se ativar.
- Conteúdos sugeridos:
  - `aguardando_novo_nome`: "Beleza! Qual o seu nome completo atualizado?"
  - `aguardando_novo_email`: "Qual o seu email atualizado?"
  - `aguardando_novo_telefone`: "Qual o seu telefone atualizado (com DDD)?"
  - `aguardando_novo_cep`: "Qual o seu CEP atualizado? (formato 00000-000)"
- Cada uma com gatilho `"*" → MENU_COOPERADO` (recebe qualquer texto) e ação `ATUALIZAR_<CAMPO>_COOPERADO` no motor — precisa implementar.

#### Modelo `menu_inadimplente` (+ ativar etapa)
**Tipo:** decisão de produto.
- Estado existe (`MENU_INADIMPLENTE`), etapa inativa, sem modelo. Decidir: bot dinâmico deve abordar inadimplência? Ou é melhor manter no bot hardcoded por causa de regras de negociação que mudam?
- Se sim: modelo curto tipo "Vi que sua fatura {{mes}} está em aberto. Quer negociar agora?\n\n1️⃣ Sim, falar com o time\n2️⃣ Já paguei\n3️⃣ Não agora"

#### Modelo `menu_fatura` (+ ativar etapa)
**Tipo:** decisão de produto.
- Estado existe (`MENU_FATURA`), etapa inativa, sem modelo. Decidir: oferecer 2ª via / link pagamento no fluxo dinâmico? Ou continuar via comandos do bot hardcoded?
- Conteúdo sugerido: "📄 Sua fatura:\n\n1️⃣ Ver 2ª via\n2️⃣ Pix copia-e-cola\n3️⃣ Já paguei"

#### Encadeamento NPS (gatilhos 0-10 na etapa NPS_AGUARDANDO_NOTA)
**Tipo:** dado + decisão.
- Modelo existe e usa `{{parceiro}}`. Etapa existe inativa.
- Sugestão: gatilhos `"0".."10"` → `NPS_RECEBIDO`, criar nova etapa terminal `NPS_RECEBIDO` com modelo de agradecimento.

### 6.2 APAGAR — item a item com porquê

| Item | Tipo | Porquê |
|---|---|---|
| Etapa "Receber fatura" `INICIAL` ordem=1 GLOBAL | decisão Luciano | Duplicada com "Boas-vindas / Menu Principal" (mesmo estado, mesmo modelo, ambas com 0 gatilhos). Como a "Entrada Dinâmica" TENANT vence pro CoopereBR, ambas estão "mortas" pra ele — mas continuam visíveis e podem confundir admins de outros parceiros. Sugestão: **desativar** (não deletar) — mantém histórico, evita atrito. |
| Modelo `ajuda` com `{{site}}` vazio | código (mínimo) | Variável `site` não está populada no `extrairVariaveis()`. Solução: ou popular `site` com `cooperativa.site` se houver campo, ou substituir `{{site}}` no texto pelo número de WhatsApp do parceiro. Não é lixo — é bug de variável. |

**Nada mais a apagar.** As 12 etapas inativas remanescentes (Cadastro Proxy, Atualizar Cadastro, NPS, MENU_FATURA, MENU_INADIMPLENTE, LEAD_FORA_AREA) representam funcionalidades **a implementar** ou **decisões pendentes**, não lixo.

### 6.3 UNIFICAR — redundância eliminável

| O que | Como | Tipo |
|---|---|---|
| "Indicar amigo" (gatilho 5 do MENU_COOPERADO) + "Convidar amigo" (gatilho 4 do INICIAL/MENU_PRINCIPAL) | Apontar o gatilho 5 do MENU_COOPERADO para `ENVIAR_CONVITE` (em vez de loop pro MENU_COOPERADO). Texto do menu_cooperado já diz "Indicar amigo" — só falta cabear. | dado (1 linha de UPDATE) |
| Atualizar Contrato (gatilhos 1-4 voltam pro menu) | Decidir: cada opção vira ação real (envia formulário/notifica equipe) ou consolidar todos os 4 num único `AGUARDANDO_ATENDENTE_CONTRATO` que encaminha pro humano. | código + decisão Luciano |
| Menu Cooperado opções 1 e 2 ("Ver créditos" / "Ver próxima fatura") | Implementar como ações reais no motor (consultar saldo de tokens / próxima cobrança no banco) ou redirecionar pra atendente | código (~4-6h por opção) |
| Variável `{{site}}` no modelo `ajuda` | Decidir se é o site da cooperativa (`cooperativa.site` no banco — campo já existe?) ou o número de WhatsApp do parceiro | código + decisão |

---

## Síntese final

O fluxo do bot dinâmico **funciona ponta a ponta pro caminho principal** (cooperado novo: INICIAL → menu → simulação → confirmação → cadastro). Após R1-R6 desta sessão, não há mais becos: **zero estados-destino órfãos**, **zero hardcodes "CoopereBR"**, **zero modelos duplicados**. O que falta pra "funcionar 100%" é (1) cabear as **funcionalidades que o texto promete mas voltam pro menu** — Ver créditos / Ver fatura / Indicar amigo no menu cooperado (precisam virar ações reais ou redirect) + Atualizar Contrato (4 opções precisam de ação real ou consolidar no atendente humano); (2) **completar 3 fluxos inativos** se forem prioridade — Cadastro por Proxy (4 etapas sem modelo), Atualizar Cadastro (4 sub-estados não existem), NPS (gatilhos 0-10 ausentes); (3) decidir o **destino das etapas inativas restantes** — MENU_FATURA, MENU_INADIMPLENTE (decisão de produto se ficam no dinâmico ou seguem no hardcoded). Resumindo: o esqueleto está limpo e consistente, falta carne em algumas extremidades — todas conhecidas, todas catalogáveis como sub-débitos pra próxima sprint.
