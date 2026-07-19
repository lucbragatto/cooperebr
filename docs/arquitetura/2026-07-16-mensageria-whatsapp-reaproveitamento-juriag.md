# Mensageria WhatsApp do SISGD — inventário, ficha técnica e viabilidade de reaproveitamento no JurIAG

> **Data:** 2026-07-16 · **Natureza:** investigação read-only (nada implementado, nada enviado, nenhum webhook alterado)
> **Objetivo:** inventariar como o SISGD valida identidade de usuário por WhatsApp, para avaliar reaproveitamento no
> **Portal do Destinatário do JurIAG** (intimação / ciência verificada) — inclusive a hipótese de **máscara** sobre o
> robô existente (mesmo número servindo dois sistemas).
> **Norma:** todo achado com path citado · nenhuma credencial exposta (só localização e formato) · telefones mascarados.
> **Vizinho:** [`2026-06-11-levantamento-tecnico-bot-whatsapp.md`](./2026-06-11-levantamento-tecnico-bot-whatsapp.md)

---

## Sumário executivo

1. **Existe um fluxo de OTP por WhatsApp real, maduro e genérico** — `backend/src/common/security/otp-desafio.service.ts`.
   É reaproveitável **como está**, a esforço P: o campo `motivo` é string livre, então um `JURIAG_CIENCIA` entra **sem migration**.
2. **O molde a copiar é o fluxo `PIN_DEFINIR`** (`whatsapp-fluxo-motor.service.ts:1702-1829`): o OTP nasce e é validado
   *dentro* da conversa de WhatsApp, exigindo **código + prova de conhecimento** (últimos 4 dígitos do CPF).
   É o análogo mais próximo de "ciência verificada" que existe na casa.
3. **O canal é Baileys 7.0.0-rc.9 — biblioteca NÃO-OFICIAL** (WhatsApp Web reverso), sobre uma conta
   **WhatsApp Business (app)** pareada por QR. Sem Meta Cloud API, sem BSP, sem contrato, sem SLA.
4. **A sessão é exclusiva** — dois sistemas **não** conectam em paralelo no mesmo número. Teriam que compartilhar
   um único processo, com roteador na frente.
5. **Recomendação: canal próprio para o JurIAG, reaproveitando o software.** O ativo valioso é o **software**
   (o OTP service), não o **canal** — e o software se reaproveita sem máscara nenhuma.

---

## Bloco 1 — Inventário da mensageria

### Transporte (Node standalone, PM2, porta 3002)

| Path | Tamanho | Função |
|---|---|---|
| `whatsapp-service/index.mjs` | 564 l | **Único ponto de contato com o WhatsApp.** Socket Baileys + API Express (`/status`, `/send-message`, `/send-list`, `/send-buttons`, `/send-interactive`, `/send-document`, `/reconnect`); recebe `messages.upsert` e repassa ao backend via webhook |
| `whatsapp-service/auth_info/` | ~4,8 MB, ~1.533 entradas | **Sessão Baileys em disco** (`creds.json`, `app-state-sync-*`, `device-list-*`, `lid-mapping-*`) |
| `whatsapp-service/package.json` | 15 l | Deps do bot |
| `whatsapp-service/.env` | 4 vars | `PORT`, `WHATSAPP_WEBHOOK_SECRET`, `BACKEND_WEBHOOK_URL`, `COOPERE_AI_URL` |

Pontos-chave do `index.mjs`: `:1-10` imports Baileys · `:128-139` `makeWASocket` + `useMultiFileAuthState` ·
`:143-188` connection.update / QR / reconexão · `:191-286` inbound → webhook · `:323-343` `/send-message`.

### Backend — módulo `backend/src/whatsapp/` (~11.000 linhas, 14 services)

O backend **não fala WhatsApp direto**: fala HTTP com o `:3002`.

| Path | Tamanho | Função |
|---|---|---|
| `whatsapp-sender.service.ts` | 278 l | **Fachada única de envio** — whitelist dev, bloqueio de número protegido, registro em `MensagemWhatsapp`, espelho super-admin |
| `whatsapp-fluxo-motor.service.ts` | 4.409 l | Máquina de estados do fluxo conversacional |
| `whatsapp-bot.service.ts` | 3.964 l | Processa mensagem recebida, roteia intenções/menus |
| `whatsapp-fatura.controller.ts` | 620 l | `POST /whatsapp/webhook-incoming` (auth por secret), leads públicos, disparos |
| `whatsapp-cobranca.service.ts` | 543 l | Disparos de cobrança/inadimplentes/alerta vencimento, com anti-ban |
| `whatsapp-ciclo-vida.service.ts` | 307 l | Mensagens de ciclo de vida do cooperado |
| `coopere-ai.service.ts` | 289 l | Fallback de IA para respostas livres |
| `whatsapp-mlm.service.ts` | 221 l | Disparo de convites MLM |
| `whatsapp-fatura.service.ts` | 191 l | OCR/parse de fatura recebida |
| `whatsapp-simulacao.controller.ts` | 163 l | Simula conversa sem enviar |
| `whatsapp-conversa.job.ts` | 140 l | Cron de follow-up/timeout de conversa |
| `modelo-mensagem.service.ts` | 123 l | Templates com `{{variáveis}}` |
| `whatsapp-notificacoes.service.ts` | 116 l | Notificações via WA |
| `whatsapp.module.ts` | 64 l | Wiring; exporta `WhatsappSenderService` |

`backend/src/notificacoes/` **não toca WhatsApp** — é 100% in-app (`prisma.notificacao`).

### OTP (o ativo reaproveitável)

| Path | Função |
|---|---|
| `backend/src/common/security/otp-desafio.service.ts` | Service genérico de desafio OTP, **envio-agnóstico** (doc nas linhas 16-17) |
| `backend/src/common/security/otp-helper.ts` | Geração (`crypto.randomInt`), hash (`sha256+salt`), comparação (`timingSafeEqual`) |
| `backend/prisma/schema.prisma:4153-4183` | Model `OtpDesafio` |

### Alcance

**~30 arquivos de produção** injetam `WhatsappSenderService`: `convenios/` (convites, membros, aprovação) ·
`cobrancas/` · `cooper-token/token-notificacao` · `convite-indicacao/` · `autorizacao-token-familiar/` ·
`migracoes-usina/` · `motor-proposta/` · `cooperados/` · `auth/` · `publico/` · `clube-vantagens/` ·
`observador/` · `notificacoes-proativas/` · `solicitacoes-contrato/` · `solicitacoes-confirmacao-pagamento/` ·
`envio-lista-concessionaria/` · `email-monitor/` · `modelos-mensagem/`.

### Models Prisma

| Model | Linha | Papel |
|---|---|---|
| `ConversaWhatsapp` | 2412 | Estado de conversa por telefone (`estado`, `dadosTemp`) — **`telefone` é `@unique`** (:2414) |
| `MensagemWhatsapp` | 2427 | Log de mensagens (`direcao`, `status`, `tipoDisparo`, `conteudo`) |
| `ModeloMensagem` | ~2450 | Templates |
| `FluxoEtapa` | 2462 | Etapas/gatilhos/timeout do fluxo (state machine dirigida por banco) |
| `ConfiguracaoNotificacaoCobranca` | 2480 | Config de disparo por cooperativa |
| `OtpDesafio` | 4153 | Desafios OTP (hash+salt) |

**Não há tabela de sessão** — a sessão é 100% em disco.

### Dependências de mensageria

- **whatsapp-service** (`package.json:10-13`): `baileys` **^7.0.0-rc.9** · `express` ^4.21.2 · `pino` ^9.6.0 · `qrcode-terminal` ^0.12.0
- **backend**: **nenhuma dependência de WhatsApp**. Só `axios`, `nodemailer` (e-mail), `qrcode`.
- **Nenhum** Twilio / Z-API / Evolution / 360dialog / wppconnect / venom em nenhum `package.json`.

### Processo

`ecosystem.config.cjs` — PM2, 3 apps: `cooperebr-whatsapp` (`:4-21`, porta 3002, `max_restarts: 20`) ·
`cooperebr-backend` (`:22-47`, 3000) · `cooperebr-frontend` (`:49-66`, 3001).

Feature flags (`backend/.env`, checadas com `!== 'true'`): `WA_COBRANCA_HABILITADO` · `WA_INADIMPLENTES_HABILITADO` ·
`WA_ALERTA_VENCIMENTO_HABILITADO` · `WA_MLM_CONVITES_HABILITADO`.

---

## Bloco 2 — Anatomia do fluxo de validação (o que copiar)

**Existe e é genérico por design.** Há **duas** implementações paralelas (débito registrado no fim deste bloco).

### (a) Gatilhos

O `OtpDesafioService` **cria** desafios em 4 lugares, mas **só 2 enviam por WhatsApp**:

| # | Gatilho | Path | Envia WA? |
|---|---|---|---|
| 1 | **Convite de convênio** | `publico.controller.ts:492` → `convites-convenio.service.ts:1118` (`solicitarOtp`) | **Sim** (`:1217`) |
| 2 | **Definir PIN pelo bot** | `whatsapp-fluxo-motor.service.ts:1702` (`executarIniciarDefinirPin`) | **Sim** (`:1721`) |
| 3 | Ativação de aparelho | `cooperados/aparelho-vinculado.service.ts:111` (`iniciarAtivacao`) | Não — retorna código, sem caller que envie |
| 4 | Step-up de transação alta | `cooper-token/cooper-token.service.ts:1462` (`criarDesafioStepUp`) | Não — só e-mail hoje |
| 5 | `PIN_RESET` | `otp-desafio.service.ts:41` | Declarado, **sem chamador** |

**Não há OTP de login** e **não há magic link por WhatsApp** (o magic link existente é por **e-mail**,
para aprovação de empresa no convênio — `publico.controller.ts:512-514`).

### (b) Geração e política

Tudo em `otp-helper.ts`:

- **Formato:** 6 dígitos numéricos, zero-padded (`:24-27`)
- **Sorteio:** `crypto.randomInt(0, 1_000_000)` — **CSPRNG**, não `Math.random` (`:25`)
- **Armazenamento:** **hasheado**, `sha256(codigo + salt)`, salt rotativo de 16 bytes por emissão (`:34-44`).
  O schema reforça: `/// sha256(codigo + salt). NUNCA armazenar plain.` (`schema.prisma:4167`)
- **Comparação:** `crypto.timingSafeEqual` — constant-time (`:53-60`)
- **Persistência:** tabela `OtpDesafio` — **banco**, não memória/cache

| Parâmetro | Valor | Onde |
|---|---|---|
| TTL | **10 minutos** | `otp-desafio.service.ts:34` |
| Tentativas | **5** | `:35` |
| Lockout | **15 minutos** | `:36` |

Política divergente na impl. legada (`convites-convenio.service.ts:54-58`): TTL 10min, 5 tentativas,
mas **3 reenvios máx**, **cooldown 60s** e **bloqueio de 1h**. Rate limit HTTP por IP:
5/min no solicitar, 10/min no validar (`publico.controller.ts:490, 502`).

O código plain **nunca é logado** (`otp-desafio.service.ts:112-114`).

### (c) Cadeia até o envio

```
criarDesafio()                       common/security/otp-desafio.service.ts:85
  └─ retorna { codigo } em memória — NÃO envia (service é envio-agnóstico)
WhatsappSenderService.enviarMensagem()   whatsapp/whatsapp-sender.service.ts:94
  ├─ guard isNumeroProtegido()            :85-92
  ├─ guard podeEnviarEmDev() [whitelist]  common/safety/whitelist-teste.ts
  ├─ HTTP POST → ${WHATSAPP_SERVICE_URL}/send-message   :109-113
  ├─ registrarMensagem() → MensagemWhatsapp             :123
  └─ espelho p/ SUPER_ADMIN_PHONE                       :133-145
whatsapp-service/index.mjs:323  app.post('/send-message')
  → sock.sendMessage(jid, { text })      :337   ← envio efetivo
```

### (d) Como a confirmação volta — **os dois modelos existem**

**Modelo 1 — usuário digita numa tela web** (convite, device bind, step-up):
`POST /publico/convites/:token/validar-otp` → `publico.controller.ts:504-510` → `convites-convenio.service.ts:1259`.
Front do PIN: `web/components/ui/pin-input.tsx`.

**Modelo 2 — usuário responde no próprio WhatsApp** (**o padrão a copiar**):
- Entrada por **webhook HTTP**, não polling. Baileys escuta `sock.ev.on('messages.upsert')` (`index.mjs:191`)
  e faz `fetch` para `BACKEND_WEBHOOK_URL` (`:277-281`)
- Receptor: `POST /whatsapp/webhook-incoming` — `whatsapp-fatura.controller.ts:53-84`.
  Auth por `?secret=` comparado com `timingSafeEqual` (`:74`), throttle 600/min (`:52`)
- Dispatch: `:79` → `WhatsappBotService.processarMensagem()` (`whatsapp-bot.service.ts:151`) → motor de fluxo
- Validação do código digitado no chat: `whatsapp-fluxo-motor.service.ts:1794`

**Detalhe de design notável:** o modelo 2 exige **OTP + prova de conhecimento** (últimos 4 dígitos do CPF) na
mesma mensagem, e confere o dado pessoal **antes** de gastar tentativa do OTP, com mensagem neutra
anti-enumeração (`:1765-1781`).

### (e) Sucesso e falha

**Sucesso:** `validadoEm = now` + `validadoPorIp` (`otp-desafio.service.ts:184-190`). Idempotente (`JA_VALIDADO`).
Device bind revoga o aparelho anterior em transação. PIN via WA transiciona pra `DEFINIR_PIN_AGUARDANDO_PIN`.

**Falha/expiração** (`:194-213`): código errado → `tentativas++`; ao atingir 5 → `bloqueadoAte = now + 15min`.
Expirado → `DESAFIO_EXPIRADO`, **sem reenvio automático**. Hardening multi-tenant: `cooperativaId` que não bate
(**ou é null**) → `DESAFIO_NAO_ENCONTRADO`, mascarando a existência (`:158-165`).

### (f) Templates (texto literal)

**OTP de convite** — `convites-convenio.service.ts:1207-1212`:
```
Olá, ${nomeConvidado}!

Seu código de confirmação CoopereBR (convênio *${empresaNome}*):

*${codigo}*

Válido por ${OTP_TTL_MIN} minutos.

Se você não solicitou, ignore esta mensagem.
```

**OTP + CPF para definir PIN (dentro do bot)** — `whatsapp-fluxo-motor.service.ts:1723`:
```
🔐 *Cadastrar PIN*

Seu código: *${desafio.codigo}*

Pra confirmar que é você mesmo, digite o código + os *últimos 4 dígitos do CPF* cadastrado, separados por espaço.

Exemplo: `${desafio.codigo} 1234`

O código expira em 10 minutos.
```

**Falha de formato / dados** — `:1759, :1775`:
```
❌ Formato inválido. Digite o código de 6 dígitos + os últimos 4 do CPF, separados por espaço.
Exemplo: `123456 1234`
Ou *0* pra cancelar.
```
```
❌ Dados não conferem. Confira o código e os últimos 4 dígitos do CPF cadastrado, ou digite *0* pra cancelar.
```

**Sucesso** — `:1824`:
```
✅ Tudo certo!

Agora *escolha seu PIN* de 6 dígitos. Não use sequências (123456, 987654) nem dígitos iguais (111111).

Digite só os 6 dígitos:
```

> **Débito:** a impl. do convite (`convites-convenio.service.ts:1188-1204`) **não** usa `OtpDesafioService` —
> duplica geração/validação inline com política divergente (bloqueio 1h × 15min), apesar de `otp-helper.ts:5-9`
> dizer que a extração foi feita para unificar. **Se o JurIAG entrar, entra pela implementação genérica.**

---

## Bloco 3 — Ficha técnica do canal

| Item | Achado | Path |
|---|---|---|
| **Tecnologia** | **Baileys 7.0.0-rc.9 — biblioteca NÃO-OFICIAL** (WhatsApp Web reverso, com **spoof de browser** `['Chrome','Chrome','145.0.0']`) | `whatsapp-service/package.json:10`; `index.mjs:2-8, 131-139` |
| **Tipo de conta** | **WhatsApp Business (app)** — `platform: 'smbi'` (*Small/Medium Business iOS*) no `creds.json`. **Não é** Business API | `whatsapp-service/auth_info/creds.json` |
| **Número** | `5527•••••4391` (padrão de **linha fixa**) — definido pelo **pareamento**, não por env | `auth_info/creds.json` (`me.id`) |
| **BSP/gateway** | **Nenhum.** `backend → :3002 → Baileys → WhatsApp` | — |
| **Custo/msg** | **Não identificável — e coerente com zero.** Não há contador, quota, billing ou tarifação. O que existe é **anti-ban, não anti-custo** | `whatsapp-cobranca.service.ts:539` |
| **Credencial do canal** | **A pasta `auth_info/`** — JSONs em **texto claro no disco**, ~4,8 MB. Quem copiar, assume a sessão | `index.mjs:20` (`AUTH_DIR`) |
| **Secret do webhook** | env `WHATSAPP_WEBHOOK_SECRET` (nos dois `.env`, precisam bater) — trafega **na query string** | `index.mjs:19`; `whatsapp-fatura.controller.ts:66-76` |
| **URL do bot** | env `WHATSAPP_SERVICE_URL` (default `http://localhost:3002`) | `backend/.env` |
| **Telefone super admin** | env `SUPER_ADMIN_PHONE` (não setada hoje) | `whatsapp-sender.service.ts:79` |
| **Whitelist dev** | `5527•••••1348`, `5527•••••9097` — **hardcoded no código-fonte** | `common/safety/whitelist-teste.ts:15-30` |
| **Pareamento** | **QR code no terminal** (`qrcode-terminal`), exposto em `GET /status` e renderizado no dashboard. Sem token, sem pairing code | `index.mjs:146-151, 301`; `web/app/dashboard/whatsapp/page.tsx:139` |
| **Reconexão** | Backoff exponencial com jitter (base 1s, teto 60s, `MAX_RECONNECT=5`) | `index.mjs:36-42, 29` |
| **Logout (401)** | **Apaga `auth_info/` recursivamente** (`fs.rmSync`) e exige **novo QR manual** | `index.mjs:170-176` |
| **Buffer anti-perda** | 200 msgs, TTL 5 min, flush ao reconectar — só no `/send-message`; os demais endpoints retornam 503 seco | `index.mjs:31-72, 331-334` |

**Não há token/apikey de provedor porque não há provedor.** Não há contrato, não há SLA.

### Prova negativa

Nenhuma ocorrência de `graph.facebook.com`, Meta Business token ou webhook de verificação Meta no código.
O próprio código admite a limitação: *"Baileys interactive list/button messages são instáveis
(WhatsApp restringe ao Business API)"* — `whatsapp-sender.service.ts:156-158`.

---

## Bloco 4 — Viabilidade da máscara (mesmo número, dois sistemas)

> **Zero referências a JurIAG / intimação / ciência no código.** Tudo abaixo é avaliação de viabilidade
> sobre o desenho atual, não descrição de algo existente.
> *(A "Sprint Máscara" em `docs/sessoes/2026-07-14-*` é **máscara de e-mail por convênio** — assunto distinto.)*

### (a) Roteamento por contexto — **SIM, extensível**

State machine **dirigida por banco**, não if/else hardcoded:

- Model `FluxoEtapa` (`schema.prisma:2462-2478`): `cooperativaId String?` (**null = template global**),
  `estado`, `gatilhos Json`, `acaoAutomatica`, `modeloMensagemId`
- Motor: `buscarEtapa(estado, cooperativaId)` (`whatsapp-fluxo-motor.service.ts:114`, `:477-490`),
  com regra **tenant vence global**
- Precedência por mensagem (`:101-196`): comandos universais (`INICIO`/`SAIR`/`MENU`/`TROCAR CADASTRO`)
  → `buscarEtapa` → `executarAcao()` → transição/render → fallback hardcoded → IA
- **Estado persistido em BANCO** (`ConversaWhatsapp.estado` + `dadosTemp Json?`) — sobrevive a restart do PM2

**Pontos de extensão, do menos ao mais invasivo:**
1. Inserir linhas em `FluxoEtapa` com `estado` próprio (ex.: `JURIAG_*`) — **zero código**, mas só navegação/mensagem
2. **Novo `case` no `switch` de `executarAcao()`** (`~:646`, onde vive `case 'VERIFICAR_COOPERADO'`) — **ponto canônico**
3. Comando universal novo em `detectarComandoUniversal()` (`:209-244`)

**Ressalva:** `estado` é o discriminador único e `FluxoEtapa.estado` **não tem namespace de sistema**.
O risco não é técnico, é de convenção.

### (b) Webhook — **não despacha para dois**

```
WhatsApp ──Baileys MD──► whatsapp-service/index.mjs
                          sock.ev.on('messages.upsert')      :191
                          (filtra fromMe :193, ignora grupos :198, resolve @lid :203-216)
                               │ fetch POST, destino ÚNICO
                               ▼
                          BACKEND_WEBHOOK_URL                :18-19, :277
                               ▼
                          POST /whatsapp/webhook-incoming    whatsapp-fatura.controller.ts:53
                               ▼
                          WhatsappBotService.processarMensagem()  whatsapp-bot.service.ts:151
```

`BACKEND_WEBHOOK_URL` é **string única** (`:18-19`); o `fetch` de `:277` é destino único,
**sem fan-out, sem retry, sem DLQ** (o `catch` de `:282` só loga).

**Três desenhos possíveis:**

| Desenho | Avaliação |
|---|---|
| **1. Fan-out no `index.mjs`** | Os dois backends responderiam à mesma mensagem → **resposta duplicada**. Frágil |
| **2. Roteador na frente** | **Recomendado se houver máscara.** Concentra a decisão; custo: novo componente + store de roteamento |
| **3. JurIAG como módulo dentro do SISGD** | Menor esforço técnico; **pior isolamento de domínio** |

**A favor de qualquer desenho:** o `whatsapp-service` **já é agnóstico de domínio** — só resolve JID,
baixa mídia e faz POST. O acoplamento todo está no backend.

### (c) Risco de colisão — **o ponto crítico**

**Ponto exato da ambiguidade** — `backend/src/cooperados/cooperado-matcher.helper.ts:64-77`:
```ts
const rows = await prisma.cooperado.findMany({
  where: {
    telefone: { in: variantes },
    status: { in: STATUS_COOPERADO_ATIVOS },
  },
  orderBy: { createdAt: 'asc' },
});
```
**Não há filtro de `cooperativaId`** — e é **deliberado**, documentado em `:8-10`:
*"filtros NÃO aplicam cooperativaId aqui porque visitante WA não tem tenant"*.
**O telefone é a única chave de identidade na porta de entrada.**

Resolução em `whatsapp-fluxo-motor.service.ts:1242-1272`: 0 cadastros → "não encontrei" ·
1 → entra no menu · **>1 → `MENU_ESCOLHA_CADASTRO`** ("qual você quer usar agora?"), com anti-IDOR
(`executarEscolherCadastroCooperado` re-lê do banco, nunca confia no payload — `:1282-1332`).

**A boa notícia:** o sistema **já resolveu a ambiguidade de identidade múltipla por telefone**.
O Sprint "Qual cadastro?" (08/06/2026) existe porque o Luciano é PF e a PJ tem o mesmo telefone
(`cooperado-matcher.helper.ts:5-6`). Há `TROCAR CADASTRO` como comando universal e **bloqueio de troca
em estados sensíveis** (`:324-339`). **Um segundo sistema é, conceitualmente, mais um "cadastro"
candidato do mesmo telefone** — o andaime existe.

**Os 3 pontos de colisão concretos:**

1. **`ConversaWhatsapp.telefone` é `@unique`** (`schema.prisma:2414`; upsert em `whatsapp-bot.service.ts:184-188`).
   **Existe no máximo UMA conversa e UM estado por telefone, globalmente.** Pessoa no meio de um fluxo SISGD
   + intimação chegando = os dois fluxos **disputam o campo `estado`**. Um sobrescreve o outro.
   **É limitação de schema, não de código.**
2. **`acharCooperadosPorTelefone` é cego ao JurIAG** — consulta só a tabela `Cooperado`. Um destinatário
   que não seja cooperado retorna 0 → o bot responde *"Não encontrei seu cadastro ATIVO… digite 2
   (Quero ser cooperado)"* (`:1198-1200`). **Um intimado receberia oferta de adesão a cooperativa de energia.**
3. **Pessoa cooperada E destinatária** → acha ≥1 cooperado → entra no menu **SISGD** e nunca considera o
   contexto JurIAG. **A intimação não dá erro — some em silêncio.** Pior de detectar.

**Caminho de menor risco:** generalizar `MENU_ESCOLHA_CADASTRO` de *"qual cooperado?"* para *"qual contexto?"*,
e trocar `dadosTemp.candidatosCadastro` por candidatos tipados com sistema de origem.

### (d) Multi-tenant — ajuda, com uma assimetria cara

O bot **é** multi-tenant por `cooperativaId` propagado (`ConversaWhatsapp.cooperativaId`, `schema.prisma:2417`):
`FluxoEtapa` resolve tenant sobre global · `ModeloMensagem` filtra por tenant · `OtpDesafio` **exige match,
rejeitando até null** (`otp-desafio.service.ts:158-165`) · `AparelhoVinculado` filtra em toda query ·
rodapé por tenant (`whatsapp-sender.service.ts:60-71`).

**O padrão serve** — "um discriminador propagado por toda a stack, com template global + override por tenant"
é exatamente o que um 2º sistema precisa. **Mas o discriminador é `cooperativaId`** — semanticamente
*"cooperativa"*, **não** *"sistema"*. Fazer o JurIAG virar uma `Cooperativa` fake **envenenaria o modelo de
domínio inteiro** (FKs em `AparelhoVinculado`, `OtpDesafio`, `FluxoEtapa`, `ConfiguracaoNotificacaoCobranca`…).
O correto seria um discriminador **acima** de `cooperativaId` (ex.: `sistemaOrigem`) — tocando
`ConversaWhatsapp` e o motor. **É a peça de refactor mais cara da máscara.**

### (e) Limitações do canal — gargalo compartilhado

| Camada | Mecanismo | Path |
|---|---|---|
| HTTP entrada | Throttler global 100/min; tier `webhook` 600/min | `app.module.ts:94-96`; `whatsapp-fatura.controller.ts:51-52` |
| OTP público | 5/min solicitar, 10/min validar (por IP) | `publico.controller.ts:490, 502` |
| Convite em lote | `LOTE_THROTTLE_MS = 2000` | `convites-convenio.service.ts:414, 590` |
| Cobrança em massa | `delayAleatorio()` = **3s a 8s** aleatório (anti-ban) | `whatsapp-cobranca.service.ts:539-542` |
| Cobrança | teto de **30 envios** por rodada | `:95-97` |
| Buffer reconexão | 200 msgs, TTL 5min, 500ms entre flushes | `index.mjs:32-34, 44-72` |

**Não existe fila real** (sem Bull/Redis/BullMQ) — só `setTimeout` sequencial. **Sem DLQ.**

**Teto prático:** com 3–8s por mensagem, **~450–1.200 msgs/hora no total, somando os dois sistemas**.
Um lote de intimações competiria com as crons de cobrança (8h, 9h, 9h30 — `whatsapp-cobranca.service.ts:28, 220, 446`).
**E o risco é assimétrico: um ban da Meta derrubaria os dois sistemas juntos.**

### (f) Sessão única — **a restrição decisiva**

- `index.mjs:25` — `let sock = null`: **singleton** de socket
- `index.mjs:20, 129` — `AUTH_DIR = './auth_info'`, caminho **fixo e único**
- `ecosystem.config.cjs` — app roda em fork mode, **sem `instances`**
- `index.mjs:170-176` — em `loggedOut`, `fs.rmSync(AUTH_DIR)` e reinicia do zero

Baileys 7 implementa o protocolo **Multi-Device**: uma conta suporta múltiplos *linked devices*, então dois
processos *poderiam*, em tese, parear slots distintos. **Mas isso não resolve — piora:**

1. **Broadcast, não load-balance:** no MD, **todo linked device recebe todas as mensagens** → os dois backends
   responderiam → **resposta duplicada**. Não há particionamento nativo por contexto
2. **O `auth_info` atual é exclusivo:** dois processos no mesmo diretório corromperiam o signal key store
   (`makeCacheableSignalKeyStore`, `:134`)
3. **A limpeza é destrutiva e global:** `fs.rmSync(AUTH_DIR)` derrubaria a sessão dos dois de uma vez

**Conclusão:** *tecnicamente talvez, arquiteturalmente não*. O desenho viável é
**um transporte, um roteador, dois consumidores**.

---

## Bloco 5 — Honestidade regulatória (registro, sem julgamento)

**Fato, com prova:** o canal é **biblioteca não-oficial** (`baileys ^7.0.0-rc.9`) sobre uma conta
**WhatsApp Business (app)** pareada por QR.

O que isso significa **para uso judicial** (intimação / ciência verificada):

- Opera **fora dos termos de uso** da Meta. O número pode ser **banido sem aviso** — e o ban derrubaria
  **os dois sistemas juntos**
- **Sem contrato e sem SLA.** Um logout apaga a sessão e o canal fica fora **até alguém escanear um QR
  manualmente** (`index.mjs:170-176`) — sem failover, sem segundo número, sem alerta automatizado
- **Cadeia de custódia frágil:** o log (`MensagemWhatsapp`) é registro **próprio**, não prova atestável por
  terceiro. Não há comprovante de entrega emitido por autoridade ou provedor
- O **remetente é um número de energia** (`5527•••••4391`), não um canal identificável como judicial

> **Esta avaliação é insumo da decisão do titular, não veredito desta investigação.**
> O que se registra é: o ponto onde o canal é mais frágil (defensabilidade, disponibilidade, identidade do
> remetente) é exatamente o ponto que o uso judicial mais exige.

⚠️ **STF Tema 536** e demais pendências regulatórias do projeto são assunto separado — ver
`docs/REGULATORIO-ANEEL.md` e os pareceres do subagent `cooperebr-analista-conformidade`.

---

## Bloco 6 — Tabela de reaproveitamento e recomendação

| Peça | O que faz | Reaproveitável no JurIAG | Esforço |
|---|---|---|---|
| `otp-desafio.service.ts` + `otp-helper.ts` + `OtpDesafio` | OTP genérico: CSPRNG, hash+salt, timingSafeEqual, TTL/tentativas/lockout | **Como está** — `motivo` é string livre → `JURIAG_CIENCIA` **sem migration** | **P** |
| Fluxo `PIN_DEFINIR` (`:1702-1829`) | OTP nasce/valida **dentro do chat** + prova de conhecimento | **Referência (molde)** — copiar o padrão, não o código | **M** |
| `whatsapp-service/index.mjs` | Transporte Baileys, **domain-agnostic** | **Como está** — mas exige roteador na frente | **M** |
| `whatsapp-sender.service.ts` | Fachada única de envio | **Com ajuste** — discriminador de sistema | **M** |
| `MENU_ESCOLHA_CADASTRO` / `TROCAR CADASTRO` | Desambigua múltiplos cadastros no mesmo telefone, anti-IDOR | **Referência excelente** — generalizar p/ "qual contexto?" | **M** |
| `FluxoEtapa` (state machine em banco) | Fluxo dirigido por dados | **Com ajuste** — namespace de estados | **M** |
| `ConversaWhatsapp` (`telefone @unique`) | Estado da conversa | **Com ajuste GRANDE** — 1 estado por telefone no mundo | **G** |
| `cooperado-matcher.helper.ts` | Identidade pelo telefone | **Com ajuste** — só olha `Cooperado` | **M** |
| Multi-tenant por `cooperativaId` | Discriminador na stack | **Referência** — o padrão serve, o campo não | **G** |
| `MensagemWhatsapp` (log) | Trilha de mensagens | **Como está** — mas **não é prova jurídica** | **P** |
| Anti-ban (delays/limites) | Protege o número | Herdado — **teto passa a ser compartilhado** | **P** |
| **Canal Baileys / conta Business app** | O canal em si | **Decisão do titular** — ver Bloco 5 | — |

### Recomendação: **canal próprio para o JurIAG, reaproveitando o software — não máscara**

**A distinção que sustenta isso: o ativo valioso é o software, não o canal.** O `OtpDesafioService` é
reaproveitável a esforço **P** *independente de qual número envia*. **A máscara não é necessária para colher
o que há de melhor aqui.**

**Contra a máscara:**
- **Raio de explosão:** um ban da Meta derruba **os dois**. O sistema jurídico herdaria o risco do robô de
  cobrança — e tem tolerância a downtime menor
- **Custo real ≠ custo aparente:** parece "só plugar um fluxo", mas esbarra em `telefone @unique` (**G**) e no
  discriminador `cooperativaId` que não comporta "sistema" (**G**) — refactors de schema no coração de um bot
  em produção
- **Colisão silenciosa:** cooperado+destinatário → intimação **some sem erro**. Em ciência processual, falha
  silenciosa é a pior classe de falha
- **Identidade do remetente:** intimação chegando do número da cooperativa de energia, na mesma thread do
  "sua fatura venceu", é frágil juridicamente
- **Vazão:** intimações em lote competindo com a janela de cobrança, num teto de ~450–1.200/h **somado**

**A favor da máscara (honestamente):** aproveita motor, sender, OTP e state machine inteiros; zero infra nova;
e o precedente *"Qual cadastro?"* prova que a casa sabe desambiguar telefone.
**Se o JurIAG fosse um sistema comercial de baixo risco, a máscara seria a recomendação.**

**A favor do canal próprio:**
- Isola o risco de ban e de logout
- Permite escolher **canal oficial** (Cloud API via BSP) — onde mora a defensabilidade judicial: contrato,
  SLA, comprovante de entrega, templates aprovados, remetente verificado
- **Evita inteiramente** o refactor `sistemaOrigem` — cada sistema dono da sua `ConversaWhatsapp`
- Reaproveita a joia da coroa (OTP, **P**) e o molde `PIN_DEFINIR` (**M**) do mesmo jeito

**Custo:** segundo número + segunda sessão/processo; a pessoa fala com dois números.
**Para uso judicial, dois números é provavelmente o desenho certo, não um efeito colateral.**

**Meio-termo descartado:** JurIAG como módulo dentro do SISGD é o de menor esforço técnico, mas mistura
domínio jurídico com cooperativa de energia (segregação de dados, LGPD, auditoria) — problema maior que o
que resolve.

---

## Consequência: 7 achados de segurança

Esta investigação **não era** de segurança, mas produziu 4 achados de imediato — e a corretiva deles produziu
mais 3, os mais graves. Todos corrigidos ou pendentes na sessão de 16/07/2026:

| # | Achado | Estado |
|---|---|---|
| 2 | Sucesso falso em `faturas.service.ts:995` (endpoint inexistente, 404 sem lançar, log de sucesso) | ✅ fechado |
| 1 | Espelho de mensagens vazava OTP pro `SUPER_ADMIN_PHONE` (dormente) | ✅ fechado |
| 5 | **OTP persistido em claro** em `mensagens_whatsapp.conteudo`, legível no painel admin | ✅ fechado |
| 6 | **PIN e OTP+CPF em claro** no inbound (`whatsapp-bot.service.ts:151-168`) | ✅ fechado |
| 7 | **PIN cru em `ConversaWhatsapp.dadosTemp`**, exposto via `getConversas` sem `select` | ✅ fechado |
| 3 | Secret do webhook na query string | ⏳ pendente |
| 4 | Sessão Baileys em texto claro (`auth_info/`) | ⏳ pendente |

**Nenhum cooperado foi exposto** — as três contagens preventivas deram zero.
Detalhes, provas e registro de auditoria: [`docs/sessoes/2026-07-16-corretiva-seguranca-mensageria-wa.md`](../sessoes/2026-07-16-corretiva-seguranca-mensageria-wa.md).

> **Lição de método:** os 3 achados mais graves (5, 6, 7) **não** vieram da auditoria original — vieram de
> perguntar *"onde mais esse dado vai parar?"* depois de cada correção. E o `findMany` sem `select` foi
> catalogado como *"P2 over-fetching cosmético"* quando era **o canal de entrega do PIN pro browser**:
> uma classificação errada de débito escondeu um vazamento ativo por dois commits.
> **Regra derivada:** todo achado de vazamento aciona varredura de propagação
> (visível + trabalho + logs + payload + histórico).

---

## Débitos identificados nesta investigação

| Item | Onde | Nota |
|---|---|---|
| **OTP duplicado** | `convites-convenio.service.ts:1188-1204` | Não usa `OtpDesafioService`; política divergente (bloqueio 1h × 15min) |
| **`PIN_RESET` órfão** | `otp-desafio.service.ts:41` | Declarado, sem chamador |
| **`WHATSAPP_NUMEROS_IGNORADOS` órfã** | `backend/.env` | **Blocklist que não bloqueia nada** — sem referência em `backend/src`. A lista real está hardcoded em `whatsapp-sender.service.ts:90` |
| **Sem fila/DLQ** | `index.mjs:282` | O `catch` só loga; mensagem morre |
| **Frontend fala com `:3002`** | `web/app/dashboard/whatsapp/page.tsx:22, 139` | Browser consulta o serviço interno direto (leitura de status/QR) |
| **Sem failover de canal** | — | Logout apaga `auth_info/` e derruba tudo até alguém escanear QR |
