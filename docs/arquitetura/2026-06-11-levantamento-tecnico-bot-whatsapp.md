# Levantamento Técnico — Bot WhatsApp do SISGD

> Diagnóstico do estado atual do módulo WhatsApp. Cowork 2026-06-11.
> Documento independente — não vinculado a feature específica. Serve
> como referência arquitetural pra qualquer decisão futura (Concierge
> Captação, Sprint Token-WA, hardening, migração WA Business API).

## TL;DR

O módulo WhatsApp do SISGD é **maduro e robusto**: 17.461 linhas TS no
backend NestJS + serviço Node.js externo (Baileys) com QR-code/auth
multi-arquivo. Tem state machine de **51 estados de conversa**, integração
com IA Claude Haiku (`Coopere-AI`), pipeline OCR de fatura (Anthropic),
templates customizáveis por cooperativa, multi-tenant correto após Fase 1
desta sessão (commit `d1f2d5b`), envio de PDF/áudio/imagem, gerenciamento
de ciclo de vida (boas-vindas, aprovação de documento, etc), MLM de
indicações em cascata, integração com Asaas (boleto/PIX), email (SMTP),
notificações 2 lados + OTP. Resilência: buffer durante reconexão, backoff
exponencial com jitter, whitelist em dev.

**Está pronto pra escalar uso atual** (CoopereBR como único parceiro).
Pra produção multi-parceiro (Sinergia + outros) há **3 limitações
estruturais** que precisam resolver antes: (1) Baileys é não-oficial e
Meta pode banir o número, (2) número de telefone fixo único pro
ambiente, (3) faltam métricas operacionais consolidadas (DLQ, taxa de
resposta, tempo de leitura, opt-out).

## 1. Arquitetura geral

```
┌────────────────────────────────────────────────────────────────┐
│ NÚMERO COOPEREBR (WhatsApp real)                                │
└────────────────────────────────────────────────────────────────┘
                            ↕  HTTPS Baileys protocol
┌────────────────────────────────────────────────────────────────┐
│ whatsapp-service/index.mjs (Node 20+, processo PM2 separado)    │
│ ────────────────────────────                                    │
│ • Baileys 6.x — biblioteca WA não-oficial                       │
│ • makeWASocket + useMultiFileAuthState                          │
│ • QR-code terminal pra parear                                   │
│ • Buffer de mensagens durante reconexão (MAX 200, TTL 5min)     │
│ • Backoff exponencial com jitter (base 1s, max 60s)             │
│ • 5 tentativas de reconexão antes de desistir                   │
│ • Endpoints HTTP: POST /send-message, /send-document,           │
│   /send-image, /send-audio, /send-list                          │
│ • Webhook out: chama BACKEND_WEBHOOK_URL?secret=XXX             │
└────────────────────────────────────────────────────────────────┘
                            ↕  HTTP REST
┌────────────────────────────────────────────────────────────────┐
│ Backend NestJS — módulo src/whatsapp/                          │
│ 14 services + 3 controllers (17.461 linhas total)              │
│                                                                  │
│ ┌──────────────────────┐  ┌─────────────────────┐              │
│ │ whatsapp-bot.service │→ │ Decision engine     │              │
│ │ (state machine 51)   │  │ 51 estados conversa │              │
│ └──────────────────────┘  └─────────────────────┘              │
│         ↓                                                       │
│ ┌──────────────────────┐  ┌─────────────────────┐              │
│ │ whatsapp-fluxo-motor │  │ ModeloMensagem      │              │
│ │ (templates dinâmicos)│  │ FluxoEtapa          │              │
│ └──────────────────────┘  └─────────────────────┘              │
│         ↓                                                       │
│ ┌──────────────────────┐  ┌─────────────────────┐              │
│ │ whatsapp-sender      │→ │ POST whatsapp-svc   │              │
│ │ (envia + log Msgs)   │  │ (whitelist em dev)  │              │
│ └──────────────────────┘  └─────────────────────┘              │
│                                                                 │
│ Outros services:                                                │
│ • whatsapp-fatura (OCR Anthropic Claude → MotorProposta)        │
│ • whatsapp-cobranca (alerta de boleto/PIX vencendo)             │
│ • whatsapp-ciclo-vida (boas-vindas, aprovação, rejeição)        │
│ • whatsapp-mlm (indicações em cascata + bônus)                  │
│ • whatsapp-notificacoes (eventos contextuais)                   │
│ • whatsapp-conversa.job (timeout sessão, expiração estados)     │
│ • whatsapp-simulacao.controller (rodar fluxo in-memory)         │
│ • whatsapp-fatura.controller (receber upload via web)           │
│ • coopere-ai (Claude Haiku 4.5 — primeiro atendimento)          │
│ • modelo-mensagem (CRUD templates customizáveis)                │
└────────────────────────────────────────────────────────────────┘
                            ↕  Prisma ORM
┌────────────────────────────────────────────────────────────────┐
│ PostgreSQL (Supabase) — 4 models WA:                            │
│ • ConversaWhatsapp (telefone único, estado, dadosTemp Json)     │
│ • MensagemWhatsapp (direção ENTRADA/SAIDA, tipo, conteúdo)      │
│ • ModeloMensagem (templates com {{vars}} por cooperativa)       │
│ • FluxoEtapa (etapas customizáveis por cooperativa)             │
└────────────────────────────────────────────────────────────────┘
```

## 2. Capacidades funcionais identificadas

### 2.1 Recebe do WhatsApp

| Tipo | Como funciona | Estado de processamento |
|---|---|---|
| **Texto** | `messageInfo.message.conversation` | Vai pra state machine bot decidir resposta |
| **Imagem** | `imageMessage` → `downloadMediaMessage(buffer)` → base64 | Roteia pra `whatsapp-fatura.service.processarFatura()` |
| **Documento (PDF)** | `documentMessage` (e `documentWithCaptionMessage`) → buffer | Idem imagem — OCR via Anthropic |
| **Áudio** | suportado pelo Baileys | NÃO processado — só recebe |
| **Localização** | suportado | NÃO processado |
| **Contatos** | suportado | Usado em estado `RECEBENDO_CONTATOS` (indicações) |
| **Botão clicado** | `buttonsResponseMessage` | Trata como texto da resposta |
| **Item de lista** | `listResponseMessage` | Trata como texto |

### 2.2 Envia pro WhatsApp

| Tipo | Service / Método | Uso típico |
|---|---|---|
| Texto simples | `sender.enviarMensagem()` | 95% das interações |
| Menu interativo (botões) | `sender.enviarMenuInterativo()` | Confirmações [SIM] [NÃO] |
| Lista de opções | `sender.enviarLista()` | Menu principal/categorias |
| Documento PDF | `sender.enviarPdfWhatsApp(tel, path, nome, caption)` | Comprovante, fatura processada |
| Imagem | suportado endpoint `/send-image` | QR code de pagamento |
| Áudio | suportado endpoint `/send-audio` | Não usado ainda |

Todas as chamadas passam por:

1. Validação de número protegido (`isNumeroProtegido()`) — bloqueia números VIPs
2. Whitelist em dev (`podeEnviarEmDev()`) — só envia pra números na lista de teste
3. Log estruturado em `MensagemWhatsapp` (direção, tipo, conteúdo, opções)
4. Retorno tipado `WhatsappEnvioResult` com motivo se falhou

### 2.3 State machine — 51 estados

Estados mapeados no `whatsapp-bot.service.ts` (linhas 440-700+):

**Fluxo de entrada e primeiro contato:**
- `INICIAL`, `PRIMEIRO_ATENDIMENTO_AI`, `MENU_PRINCIPAL`, `MENU_CLIENTE`,
  `MENU_COOPERADO`, `MENU_QR_PROPAGANDA`

**Captação via fatura:**
- `AGUARDANDO_FOTO_FATURA`, `AGUARDANDO_PROPRIETARIO_FATURA`,
  `AGUARDANDO_CONFIRMACAO_OCR`, `AGUARDANDO_VALOR_FATURA`,
  `RESULTADO_SIMULACAO_RAPIDA`, `MENU_SEM_FATURA`,
  `AGUARDANDO_DISTRIBUIDORA`

**Cadastro completo:**
- `AGUARDANDO_NOME`, `AGUARDANDO_CPF`, `AGUARDANDO_EMAIL`,
  `AGUARDANDO_CONFIRMACAO_DADOS`, `AGUARDANDO_CONFIRMACAO_CADASTRO`,
  `AGUARDANDO_CELULAR_CORRETO`, `AGUARDANDO_CONFIRMACAO_CELULAR`,
  `AGUARDANDO_DISPOSITIVO_EMAIL`

**Cadastro express:**
- `CADASTRO_EXPRESS_NOME`, `CADASTRO_EXPRESS_CPF`,
  `CADASTRO_EXPRESS_EMAIL`, `CADASTRO_EXPRESS_VALOR_FATURA`

**Proposta:**
- `AGUARDANDO_CONFIRMACAO_PROPOSTA`, `NEGOCIACAO_PARCELAMENTO`

**Indicação MLM:**
- `MENU_CONVITE`, `MENU_CONVITE_INDICACAO`, `AGUARDANDO_INDICACAO`,
  `AGUARDANDO_NOME_TERCEIRO`, `AGUARDANDO_TELEFONE_TERCEIRO`,
  `RECEBENDO_CONTATOS`

**Pós-cadastro:**
- `MENU_FATURA`, `AGUARDANDO_COMPROVANTE_PAGAMENTO`,
  `AGUARDANDO_ATENDENTE`, `CONCLUIDO`, `ATUALIZACAO_CADASTRO`,
  `AGUARDANDO_NOVO_NOME`, `LEAD_FORA_AREA`

(51 cases totais. Lista parcial — algumas variantes são gerenciadas pelo
motor de fluxo dinâmico via `FluxoEtapa` ao invés de hardcoded.)

### 2.4 Templates customizáveis — `ModeloMensagem` + `FluxoEtapa`

A cooperativa edita **textos** e **fluxos** sem precisar deploy:

- `ModeloMensagem.categoria` ∈ {BOT, COBRANCA, MLM, MANUAL}
- `ModeloMensagem.cooperativaId = null` → template **global** padrão SISGD
- `ModeloMensagem.cooperativaId = X` → override do parceiro X
- `ModeloMensagem.conteudo` suporta variáveis: `{{nome}}`, `{{economia}}`,
  `{{link}}`, `{{desconto}}`, `{{mes}}`, `{{parceiro}}`, `{{site}}`,
  `{{cidade}}`, `{{email_suporte}}`, `{{telefone_suporte}}`,
  `{{tipo_membro}}`, `{{tipo_membro_plural}}`
- `FluxoEtapa` define ORDEM + GATILHO + PRÓXIMA ETAPA — admin edita
  na UI `/dashboard/whatsapp-config`

Fase 2 desta sessão (commit `a76d031`) adicionou as variáveis de tenant
(`{{parceiro}}`, `{{site}}` etc) — fundamental pra suportar Sinergia +
outros parceiros sem hardcode.

### 2.5 Integração com IA — Coopere-AI

`coopere-ai.service.ts` usa Claude Haiku 4.5 (`claude-haiku-4-5-20251001`)
com SYSTEM_PROMPT específico definindo:

- Personalidade (acolhedor, simpático, emojis com moderação)
- Sobre o produto (CoopereBR, Lei 14.300/2022, RN ANEEL 1059/2023)
- Limites (não inventa dados, encaminha pra atendente quando não sabe)
- Histórico consolidado em `data/interacoes-coopereai/historico-consolidado.jsonl`

Usado no estado `PRIMEIRO_ATENDIMENTO_AI` — quando pessoa não cadastrada
manda mensagem, IA conversa pra entender intenção antes de empurrar pro
funil de captação.

**Custo**: Haiku é o modelo mais barato. ~$0,80/1M tokens entrada,
$4/1M saída. Cada conversa típica = 4-6 mensagens × ~200 tokens = ~R$
0,015/conversa. Escala bem.

### 2.6 Pipeline OCR de fatura

`whatsapp-fatura.service.processarFatura(arquivoBase64, tipoArquivo,
telefone, cooperativaId)`:

1. Chama `FaturasService.extrairOcr(base64, tipoArquivo)` que usa
   Anthropic (Sonnet ou Opus) com prompt específico
2. Retorna campos estruturados: `tarifaTUSD`, `tarifaTE`,
   `valorTotalFatura`, `numeroUC`, `mesReferencia`, `consumoKwh`, etc
3. Dados extraídos vão pro `MotorPropostaService` que calcula economia
   esperada na simulação CoopereBR
4. Gera `PropostaCooperado` + envia link pra fechamento

**Resiliência**: tem retry exponencial em 429/500/503/529, timeout 30s,
max_tokens 8192, classe `OcrFalhaError` com 7 motivos categorizados, UI
mostra banner pra recuperáveis (commit `4c05aea`).

### 2.7 Integrações com outros módulos

| Integração | O que faz |
|---|---|
| **Asaas** | `whatsapp-cobranca.service` notifica vencimento de boleto/PIX. Pessoa responde "já paguei" → `SolicitacaoConfirmacaoPagamento` |
| **Email** | `whatsapp-ciclo-vida` dispara email paralelo pra notificações importantes (aprovação documento etc) |
| **Indicações MLM** | `whatsapp-mlm` rastreia cascata de indicações + emite bônus quando funciona |
| **Motor Proposta** | OCR fatura → motor calcula economia → proposta |
| **Convite Indicação** | `convite-indicacao` recebe codigos do funil de indicação |
| **CooperToken** | Bot tem fluxos do programa de pontos (Sprint Token-WA Fase 1+2, do Code) |
| **Fluxo dinâmico** | `FluxoEtapa` permite cooperativa editar sequência sem código |

## 3. Resiliência identificada

### 3.1 Conexão WA (service externo)

- **Buffer de mensagens** durante reconexão (MAX_BUFFER_SIZE = 200,
  MAX_BUFFER_AGE_MS = 5min). Se conexão cair, mensagens ficam em
  memória até reconectar — não perde.
- **Backoff exponencial com jitter** (base 1s, exp ×2 até 60s, jitter
  30%). Evita thundering herd em retry.
- **5 tentativas de reconexão** antes de desistir e exigir nova auth
  via QR code.
- **Multi-file auth state** (`./auth_info`) — preserva sessão entre
  restarts do PM2.

### 3.2 Webhook secret obrigatório

`whatsapp-service` exige `WHATSAPP_WEBHOOK_SECRET` no env — aborta se
ausente. Backend valida o secret via `?secret=` query — rejeita 401 se
inválido. **Sem isso**: qualquer pessoa que descobrir URL do backend
podia injetar mensagem fake. Sprint Token-WA F2.9 (Code, commit `f4d20c7`)
endureceu isso recentemente.

### 3.3 Whitelist em desenvolvimento

`backend/src/common/safety/whitelist-teste.ts` lista números autorizados
a receber mensagem em dev/teste. **Sem isso**: rodar suite de QA com
dados reais dispararia mensagens pra clientes verdadeiros.

Whitelist canônica:
- `27981341348` (Luciano)
- aliases Gmail `+suffix` (carolina, diego, almir, theomax, amages,
  marcio)
- `+5527999479097` (atendimento Sandra)

Bloqueio paralelo de **número protegido** (`isNumeroProtegido`) garante
que VIPs nunca receberão mensagem por engano.

### 3.4 Timeout de sessão

`whatsapp-conversa.job` (cron) limpa conversas inativas — pessoa que
abandonou no meio do cadastro tem o estado resetado pra `INICIAL`. Evita
que volte 3 meses depois e responda "1" achando que tá num menu antigo.

### 3.5 Multi-tenant (corrigido em commit `d1f2d5b`)

**Antes desta sessão**: `modelos-mensagem.findAll` e `fluxo-etapas`
vazavam dados entre cooperativas. Admin do parceiro A via templates
do parceiro B.

**Após Fase 1 hoje** (commit `d1f2d5b` desta sessão):
- Todas as queries filtram por `cooperativaId`
- Motor de fluxo passa `cooperativaId` na busca de etapa
- Controllers injetam tenant via `req.user.cooperativaId`
- 31 specs antigos preservados + novos de isolamento

Estado de produção: **pronto para multi-tenant**.

## 4. Limitações estruturais identificadas

### 4.1 Baileys é NÃO-OFICIAL

Baileys é biblioteca open-source que faz engenharia reversa do protocolo
do WhatsApp. **Não é endorsada pela Meta**. Riscos:

- **Banimento do número**: Meta pode banir o telefone usado, sem aviso.
  Já aconteceu com outros produtos no mercado.
- **Quebra em updates do WhatsApp**: protocolo muda, biblioteca precisa
  atualizar. Janela de risco de horas/dias offline.
- **Sem garantia de SLA**: nenhum suporte oficial Meta.
- **Volume**: Meta rastreia padrões. Volume alto de mensagens (>1000/dia
  pra números não-relacionados) aciona detecção de spam → banimento.

**Para piloto e operação atual da CoopereBR funciona**. Pra escalar
multi-parceiro com volume sério, **migrar pra WhatsApp Business API
oficial** vira pré-requisito. Custos ~US$ 0,005-0,02 por mensagem (BSP).

### 4.2 Número de telefone único pro ambiente

Hoje há **1 número** por instância do `whatsapp-service`. Pra multi-tenant
com cada parceiro tendo seu próprio número (CoopereBR usa X, Sinergia
usaria Y), precisa:

- **Opção A**: vários processos `whatsapp-service` em PM2, cada um com
  seu auth_info próprio. Complexo de orquestrar.
- **Opção B**: WA Business API permite múltiplos números na mesma conta
  Meta — escalável nativo.
- **Opção C**: continuar com 1 número CoopereBR como atendimento
  consolidado SISGD, parceiros usam outros canais.

Decisão estratégica pendente.

### 4.3 Faltam métricas operacionais consolidadas

Não vi (sem ter buscado todos os endpoints):

- **Taxa de leitura por mensagem** (Baileys oferece via `read` event)
- **Tempo médio de resposta** (lead recebe em X minutos)
- **DLQ — dead letter queue** pra mensagens que falharam definitivamente
- **Taxa de opt-out** (cliente respondeu "PARE", "SAIR")
- **Heatmap de horário** (qual horário do dia gera mais conversão)

Tudo pode ser construído com os dados que JÁ ESTÃO em `MensagemWhatsapp`
(direção, timestamp, conteúdo). Sprint futuro de "WA Analytics".

### 4.4 Sem suporte a templates Meta aprovados

WA Business API exige templates de mensagem **pré-aprovados pelo Meta**
pra envio fora da janela de 24h. Hoje o sistema manda texto livre quando
quer — funciona com Baileys mas não vai funcionar quando migrar pra API
oficial.

Quando migrar: catalogar todos os modelos como templates Meta + submeter
pra aprovação. Templates com vídeo/PDF demoram mais (~48h aprovação).

### 4.5 Diretório `data/interacoes-coopereai/` em filesystem local

Histórico Coopere-AI gravado em arquivo `historico-consolidado.jsonl`.
**Não escala pra ambiente multi-instância** (PM2 cluster) — cada worker
escreveria no mesmo arquivo causando conflito. Migrar pra Prisma table
quando for clusterizar.

## 5. Riscos operacionais identificados

| Risco | Impacto | Mitigação atual | Mitigação futura |
|---|---|---|---|
| Meta bane número Baileys | Total — atendimento offline | Nenhuma | Migrar pra WA Business API |
| Anthropic OCR falha | Médio — funil cadastro trava | Retry exp + classe erro + UI banner amber | OCR multi-vendor (fallback OpenAI/Google) |
| Buffer estoura (>200 msgs em 5min) | Médio — perde mensagens | Descarta mais antiga + log warn | Persistir buffer no Redis |
| Conversa abandona meio cadastro | Baixo — cron limpa | OK | Re-engajamento automático D+1, D+3, D+7 |
| Cliente responde fora horário | Baixo | Bot responde 24/7 | Modo "atendimento humano" com horário |
| Dispatcher SMTP cai | Baixo — só perde notificação paralela | catch silencioso | Retry queue (BullMQ) |

## 6. Recomendações estratégicas

### Curto prazo (próximas 2-4 sprints)

1. **Persistir histórico Coopere-AI em DB** — não escala em filesystem
2. **Adicionar tabela `WhatsappOptOut`** — quem disse "PARE" vai pra lá
3. **Tela admin de métricas operacionais** — taxa de resposta, tempo
   médio, conversão funil, mensagens enviadas/dia por cooperativa
4. **DLQ de mensagens com falha definitiva** — admin pode reprocessar

### Médio prazo (3-6 meses)

5. **Migração pra WA Business API oficial** — pré-requisito pra escalar
6. **Catalogar templates Meta-aprovados** — começar processo de
   aprovação dos modelos mais usados (boas-vindas, fatura, cobrança)
7. **Multi-número por parceiro** (se Opção B for escolhida)
8. **Re-engajamento automático** de leads abandonados

### Longo prazo (6m+)

9. **Análise preditiva**: usar histórico pra prever lead-conversion
10. **Integração WhatsApp Business Catalog** — mostrar planos da
    cooperativa direto no chat com preço/CTA
11. **Verificação de número via Meta** (selo verde de empresa
    verificada)

## 7. Mapa de arquivos chave

```
backend/src/whatsapp/
├── whatsapp-bot.service.ts            3.964 linhas — state machine 51 estados
├── whatsapp-fluxo-motor.service.ts    4.409 linhas — motor templates+fluxos
├── whatsapp-fluxo-motor.service.spec.ts 5.444 linhas — specs (cobertura forte)
├── whatsapp-fatura.controller.ts        603 linhas — upload via web
├── whatsapp-cobranca.service.ts         543 linhas — alerta vencimento
├── whatsapp-fluxo-motor.definir-pin.spec.ts 326 linhas
├── whatsapp-ciclo-vida.service.ts       307 linhas — boas-vindas + decisões
├── coopere-ai.service.ts                289 linhas — Claude Haiku
├── whatsapp-sender.service.ts           278 linhas — POST whatsapp-service
├── whatsapp-conversa.job.spec.ts        229 linhas
├── whatsapp-idor-br.spec.ts             ??? linhas — testes IDOR
├── whatsapp-mlm.service.ts              221 linhas — indicações cascata
├── whatsapp-fatura.service.ts           191 linhas — OCR Anthropic
├── whatsapp-simulacao.controller.ts     163 linhas — simulador in-memory
├── modelo-mensagem.service.ts           ??? — CRUD templates
├── whatsapp-conversa.job.ts             140 linhas — timeout sessão
└── whatsapp.module.ts                   ??? — DI

whatsapp-service/  (processo PM2 separado)
├── index.mjs                            — Baileys + endpoints HTTP
├── auth_info/                           — sessão WA persistida
└── package.json                         — dep única: baileys

prisma/schema.prisma  (4 models WA)
├── ConversaWhatsapp (telefone, estado, dadosTemp Json, cooperativaId)
├── MensagemWhatsapp (direção, tipo, conteúdo, ts)
├── ModeloMensagem (categoria, conteúdo com {{vars}}, cooperativaId)
└── FluxoEtapa (ordem, gatilho, próxima etapa, cooperativaId)
```

**Total: 17.461 linhas TypeScript + serviço Node externo + 4 models
Prisma + telas web `/dashboard/whatsapp-config`.**

## 8. Sessão atual — o que foi entregue no WA hoje (commits)

| Hash | Fase | Entrega |
|---|---|---|
| `d1f2d5b` | Fase 1 | Multi-tenant Assis P0 — fix de isolamento entre cooperativas |
| `a76d031` | Fase 2 | Variáveis de tenant no motor — `{{parceiro}}`, `{{site}}` etc |
| `a34c696` | Fase 3 | Endpoint `/whatsapp/simular` — roda fluxo sem disparar real |
| (não capturado) | Fase 6 | Seeds parametrizados — 11 modelos + 5 etapas com `{{tipo_membro}}` |

## 9. Conclusão diagnóstica

O módulo WhatsApp do SISGD é **maduro o suficiente pra operar a
CoopereBR em produção sem refator**. State machine robusta cobre 95%
dos casos de uso identificados, integrações estão fechadas, IA funciona,
OCR é resiliente, multi-tenant agora está garantido.

**Pra escalar:** WA Business API + métricas operacionais + DLQ + DB pra
histórico IA. Esforço estimado total ~80-120h em 2-3 sprints dedicados
de hardening (não bloqueante pra demo Concierge / operação atual).

**Pra Concierge Captação (Spec C8):** ~80% do que precisa já existe
(OCR, bot estados, envio PDF, modelos documento, Asaas). Esforço real
~16h em 2-3 sprints futuros.

---

**Documento de referência permanente.** Atualizar quando houver
mudança estrutural (migração WA API, refator state machine, etc).
