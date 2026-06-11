# SPEC Sprint C8 — Concierge Captação via WhatsApp + Adesão + Procuração + Cobranças

> Documento **somente leitura**. Cowork autor 2026-06-11. Implementação fica pra próxima sessão Cowork (escopo `src/concierge/*` + novo módulo `src/lead-concierge/*` + 1 fluxo novo no bot WA) **após Code terminar M31 F4 + Hardening Mass-Write**.

## TL;DR

A pessoa fotografa a conta de luz pelo WhatsApp do CoopereBR, o bot identifica que ela é candidata a auditoria (não é cooperada ainda), roda o Concierge, devolve o diagnóstico de indébito, oferece adesão à cooperativa pra viabilizar a ação cooperativista, coleta RG/CNH pra gerar procuração, envia procuração + contrato pra assinatura, e emite 3 cobranças separadas (adesão + custas processuais + honorário advogado parceiro). Distribuída como link curto em redes sociais e WhatsApp Status.

**Bom ânimo**: ~80% da infra já existe (OCR, bot estados, ModeloDocumento, Asaas). Trabalho real é **orquestrar** e **adicionar 2-3 estados novos** no bot.

## Investigação — o que JÁ existe no SISGD

| Recurso | Onde está | Reuso pro Concierge |
|---|---|---|
| **OCR de fatura PDF/imagem** | `whatsapp-fatura.service.ts` → `faturasService.extrairOcr(arquivoBase64, tipoArquivo)` | ✅ Direto. Já aceita base64 + tipoArquivo='pdf'\|'imagem' |
| **Bot com state machine 30+ estados** | `whatsapp-bot.service.ts` (linhas 440-498+ tem 20+ cases) | ✅ Adiciona 4 estados novos pro fluxo Concierge |
| **Download de mídia WA Baileys** | `whatsapp-service/index.mjs:252,258` (`downloadMediaMessage` buffer) | ✅ Já trata `imageMessage` e `documentMessage` |
| **Envio de PDF pro cliente** | `whatsapp-sender.service.ts:219` `enviarPdfWhatsApp(tel, path, nome, caption)` | ✅ Direto pra enviar procuração+contrato |
| **Templates de documento** | `model ModeloDocumento { tipo "CONTRATO\|PROCURACAO", conteudo Text, variaveis String[] }` | ✅ Cria 2 modelos novos: PROCURACAO_AD_JUDICIA + CONTRATO_HONORARIOS |
| **Upload de RG/CNH** | `model DocumentoCooperado { tipo: TipoDocumento, url, status }` com enum RG_FRENTE, RG_VERSO, CNH_FRENTE | ✅ Reusa direto pra captura |
| **Cadastro público existente** | `/cadastro?conv=...` + `MotorPropostaService` | ⚠️ Reusa só o esqueleto. Não roda motor proposta nesse fluxo — substitui pelo Concierge |
| **Cobrança Asaas** | `asaas.service.ts:236` `emitirCobranca(...)` | ✅ Direto. Chama 3x pra adesão+custas+honorário |
| **Whitelist dev + LGPD** | `whitelist-teste.ts` + `ambienteTeste=true` | ✅ Aplica direto enquanto não estiver em produção |
| **3 detectores tributários** | `src/concierge/detectores/*` (entregue hoje) | ✅ Pronto pra rodar |
| **Adapters EDP-ES + ELFSM** | `src/concierge/fatura-canonica/*` (entregue hoje) | ✅ Cobre quase 100% das faturas do ES |

## O que NÃO existe ainda

### Gap 1 — Modelo `LeadConcierge`

Hoje uma pessoa que entra no WA é tratada como cooperado em potencial direto (vira `Cooperado` com status PENDENTE). Mas pro Concierge precisa de uma camada intermediária:

```prisma
model LeadConcierge {
  id                  String   @id @default(cuid())
  telefoneE164        String   @unique
  nomeDeclarado       String?
  origem              String?  // "WA_DIRETO" | "LANDING_AUDITE" | "INDICACAO"
  faturaUrl           String?  // S3/local da fatura recebida
  faturaConcessionaria String? // EDP_ES | ELFSM detectado
  diagnosticoId       String?  // FK pra DiagnosticoIndebito quando rodar
  diagnostico         DiagnosticoIndebito? @relation(fields: [diagnosticoId], references: [id])

  // Workflow comercial
  status              String   @default("AGUARDANDO_FATURA") // ver enum abaixo
  aceitouAdesao       Boolean  @default(false)
  rgFrenteUrl         String?
  rgVersoUrl          String?
  cnhUrl              String?
  procuracaoUrl       String?
  procuracaoAssinadaEm DateTime?
  contratoHonorariosUrl String?
  contratoAssinadoEm  DateTime?

  // Cobranças
  asaasAdesaoId       String?
  asaasCustasId       String?
  asaasHonorariosId   String?

  // Conversão
  cooperadoIdConvertido String?  // quando vira cooperado de fato
  cooperativaIdAlvo   String?    // qual cooperativa ele vai aderir

  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt

  @@index([telefoneE164])
  @@index([status])
  @@index([createdAt])
  @@map("leads_concierge")
}
```

Status do funil (enum no código):
```typescript
type StatusLeadConcierge =
  | 'AGUARDANDO_FATURA'           // bot pediu, espera foto/PDF
  | 'ANALISANDO_FATURA'           // OCR rodando
  | 'DIAGNOSTICO_PRONTO'          // detectores rodaram, resultado enviado
  | 'AGUARDANDO_DECISAO_ADESAO'   // mostrou indébito, esperando resposta
  | 'INTERESSE_CONFIRMADO'        // disse "quero"
  | 'AGUARDANDO_DADOS_PESSOAIS'   // bot perguntando nome/CPF/email
  | 'AGUARDANDO_RG_CNH'           // bot pediu foto do documento
  | 'AGUARDANDO_ASSINATURA'       // procuração + contrato enviados
  | 'AGUARDANDO_PAGAMENTO_ADESAO' // boleto adesão enviado
  | 'ATIVO_PROCESSO_INICIADO'     // virou cooperado, advogado vai ajuizar
  | 'DESISTIU'                    // não quis seguir
  | 'INELEGIVEL'                  // indébito muito pequeno OU concessionária não suportada
```

### Gap 2 — Estados WA novos no bot

Adicionar 4 cases no `whatsapp-bot.service.ts` switch (linha 440+):

```typescript
case 'CONCIERGE_AGUARDANDO_FATURA': ...
case 'CONCIERGE_AGUARDANDO_DECISAO_ADESAO': ...
case 'CONCIERGE_AGUARDANDO_RG_CNH': ...
case 'CONCIERGE_AGUARDANDO_ASSINATURA': ...
```

State machine pula entre eles + os existentes (`AGUARDANDO_NOME`, `AGUARDANDO_CPF`, `AGUARDANDO_COMPROVANTE_PAGAMENTO`).

### Gap 3 — Modelos de documento PROCURACAO + CONTRATO_HONORARIOS

Seed 2 templates novos em `ModeloDocumento`:

**PROCURACAO_AD_JUDICIA_TRIBUTARIO** com variáveis:
- `{{cooperado_nome}}`, `{{cooperado_cpf}}`, `{{cooperado_rg}}`, `{{cooperado_endereco}}`
- `{{cooperativa_razao_social}}`, `{{cooperativa_cnpj}}`
- `{{advogado_nome}}`, `{{advogado_oab}}`, `{{advogado_escritorio}}`
- `{{data_assinatura}}`

**CONTRATO_HONORARIOS_TRIBUTARIO** com variáveis:
- Acima +
- `{{indebito_60m_selic}}` (R$ XXX,XX)
- `{{percentual_exito}}` (ex: 30% sobre o êxito)
- `{{custas_estimadas}}`

Cooperativa pode customizar texto via `/dashboard/saas/modelos-documento`.

### Gap 4 — Pipeline geração + assinatura

**Gerar PDF**: substituir variáveis no template → gerar PDF (existe biblioteca tipo `pdf-lib` no projeto? Investigar. Se não, adicionar).

**Assinatura digital**: 3 opções:

- **Opção A — Confirmação por OTP via WA**: bot envia código 6 dígitos pro telefone, pessoa responde, sistema marca `procuracaoAssinadaEm`. Não tem validade jurídica forte mas serve pra MVP/piloto.
- **Opção B — Link DocuSign/Clicksign**: integração com plataforma de assinatura digital (custo por documento, validade jurídica garantida). Padrão pra processo judicial.
- **Opção C — Assinatura ICP-Brasil**: gov.br + e-CPF. Validade máxima mas exige certificado digital do cliente — limita público.

**Recomendação MVP**: Opção A (OTP) pra teste. Migrar pra Opção B (Clicksign) antes do primeiro caso real entrar pra Justiça. Adv parceiro provavelmente já tem conta em alguma plataforma.

### Gap 5 — OCR de RG/CNH

Hoje `DocumentoCooperado` só armazena URL + status. Pra preencher procuração automaticamente precisa **extrair** dados do documento: nome completo, RG, CPF, data nascimento, endereço.

**Opção**: usar mesmo OCR Claude do `extrairOcr()` mas com prompt diferente (`extrairDadosDocumentoIdentidade(arquivoBase64)` retorna `{nome, rg, cpf, dataNascimento, endereco}`).

Sugestão: catalogar como `D-novo-OCR-DOCUMENTO-IDENTIDADE` P1 e adicionar prompt + service novo `documento-identidade-ocr.service.ts` em `src/concierge/` ou `src/faturas/` (reusa cliente Anthropic).

### Gap 6 — Workflow comercial das 3 cobranças

Sequência sugerida (cada uma é um `Cobranca` Asaas separado):

| # | O que | Quando emite | Quem recebe |
|---|---|---|---|
| 1 | **Taxa de adesão CoopereBR** | Após procuração assinada | CoopereBR (já existe modelo de mensalidade) |
| 2 | **Custas iniciais do processo** | Quando advogado confirmar protocolo | CoopereBR (intermédia) ou direto adv |
| 3 | **Honorário sucumbencial advogado** | Só após êxito, % do indébito recuperado | Advogado parceiro direto |

(2) e (3) podem virar parcelado, condicional, etc — depende do contrato.

Quem decide cada R$? **Você** + advogado parceiro. Não engessa no código — vira **configuração por cooperativa** (campo `Cooperativa.taxaAdesaoConcierge`, `Cooperativa.modeloHonorariosConcierge` etc).

## Fluxo completo — 9 etapas

```
┌───────────────────────────────────────────────────────────────┐
│ ETAPA 0 — DIVULGAÇÃO                                          │
│ ─────────────────────────────                                  │
│ Posts redes sociais com link wa.me/55XXXXXXXXXX?text=AUDITAR   │
│ Status WhatsApp com print do diagnóstico exemplo              │
│ Card no portal CoopereBR com "Audite sua fatura grátis"       │
└───────────────────────────────────────────────────────────────┘
                            │
                            ↓
┌───────────────────────────────────────────────────────────────┐
│ ETAPA 1 — RECEBE FATURA                                       │
│ ─────────────────────────────                                  │
│ Bot identifica telefone NÃO cadastrado + palavra-chave         │
│ "AUDITAR" / "AUDITORIA" / "INDÉBITO" / fatura anexa.           │
│ Cria LeadConcierge(telefoneE164, status=AGUARDANDO_FATURA).    │
│ Se chegou texto → bot pede foto/PDF da fatura.                │
│ Se chegou mídia direto → vai pra ETAPA 2.                     │
└───────────────────────────────────────────────────────────────┘
                            │
                            ↓
┌───────────────────────────────────────────────────────────────┐
│ ETAPA 2 — OCR + DETECÇÃO                                      │
│ ─────────────────────────────                                  │
│ status=ANALISANDO_FATURA                                       │
│ • whatsapp-service salva mídia → base64                       │
│ • faturasService.extrairOcr(base64, tipoArquivo)              │
│ • Identifica concessionária pelo CNPJ extraído:                │
│   - CNPJ 28152650000171 → EDP_ES                              │
│   - CNPJ 27485069000109 → ELFSM                               │
│   - outro → status=INELEGIVEL, bot avisa "fora do MVP"        │
│ • Roda EdpEsFaturaAdapter ou ElfsmFaturaAdapter                │
│ • Roda DetectoresRegistry.detectarTodos(fatura)               │
│ • Cria DiagnosticoIndebito (cooperativaId=null, leadId=novo)  │
│ • LeadConcierge.diagnosticoId = ...                           │
└───────────────────────────────────────────────────────────────┘
                            │
                            ↓
┌───────────────────────────────────────────────────────────────┐
│ ETAPA 3 — DIAGNÓSTICO COMUNICADO                              │
│ ─────────────────────────────                                  │
│ status=DIAGNOSTICO_PRONTO                                      │
│ Bot envia:                                                     │
│   "Olá! Analisei sua fatura {{mes}} da {{concessionaria}}.    │
│    Identifiquei R$ {{indebito_mes}}/mês de imposto pago a     │
│    mais. Em 5 anos isso vira R$ {{indebito_60m_selic}}        │
│    corrigido pela SELIC.                                       │
│                                                                │
│    Fundamento: Tema 69 STF (RE 574.706) +                     │
│    Tema 986 STJ + Lei 14.300/2022.                             │
│                                                                │
│    Para recuperar esse valor na Justiça, você precisa:        │
│    1. Aderir à CoopereBR (R$ {{taxa_adesao}}/mês)             │
│    2. Outorgar procuração ao advogado parceiro                │
│    3. Pagar custas iniciais R$ {{custas_estimadas}}           │
│    4. Honorário só no êxito ({{percentual_exito}}%)           │
│                                                                │
│    Quer prosseguir? [SIM] [QUERO PENSAR] [+ DETALHES]"        │
└───────────────────────────────────────────────────────────────┘
                            │
                  ┌─────────┴─────────┐
                  │                   │
                 SIM             QUERO PENSAR
                  │                   │
                  ↓                   ↓
            (continua)         status=AGUARDANDO_DECISAO_ADESAO
                                bot agenda follow-up 24h
                            │
                            ↓
┌───────────────────────────────────────────────────────────────┐
│ ETAPA 4 — COLETA DADOS PESSOAIS                               │
│ ─────────────────────────────                                  │
│ status=AGUARDANDO_DADOS_PESSOAIS                              │
│ Reusa fluxo existente do bot: AGUARDANDO_NOME →               │
│ AGUARDANDO_CPF → AGUARDANDO_EMAIL → AGUARDANDO_CEP →          │
│ AGUARDANDO_ENDERECO.                                          │
│ Confirmações intermediárias antes de avançar.                 │
└───────────────────────────────────────────────────────────────┘
                            │
                            ↓
┌───────────────────────────────────────────────────────────────┐
│ ETAPA 5 — COLETA RG/CNH                                       │
│ ─────────────────────────────                                  │
│ status=AGUARDANDO_RG_CNH                                       │
│ Bot:                                                           │
│   "Agora preciso de uma foto do seu RG (frente e verso)       │
│    OU CNH para preparar a procuração. Pode enviar uma         │
│    foto bem nítida?"                                          │
│                                                                │
│ Recebe → salva em DocumentoCooperado (cooperado virtual)      │
│ → roda OCR documento-identidade-ocr.service                   │
│ → extrai {nome, rg, cpf, dataNasc, endereco}                  │
│ → atualiza LeadConcierge.rgFrenteUrl etc                      │
│                                                                │
│ Confirmação:                                                   │
│   "Confere? Nome: X / RG: Y / CPF: Z / Endereço: W"           │
│   [Sim] [Corrigir]                                            │
└───────────────────────────────────────────────────────────────┘
                            │
                            ↓
┌───────────────────────────────────────────────────────────────┐
│ ETAPA 6 — GERA PROCURAÇÃO + CONTRATO                          │
│ ─────────────────────────────                                  │
│ Service novo: leadConcierge.gerarDocumentosParaAssinatura(id) │
│ 1. Busca ModeloDocumento PROCURACAO_AD_JUDICIA_TRIBUTARIO      │
│ 2. Substitui variáveis → texto final                          │
│ 3. Gera PDF (pdf-lib ou puppeteer)                            │
│ 4. Salva em S3/local                                          │
│ 5. Mesmo p/ CONTRATO_HONORARIOS_TRIBUTARIO                    │
│ 6. LeadConcierge.procuracaoUrl + .contratoHonorariosUrl       │
└───────────────────────────────────────────────────────────────┘
                            │
                            ↓
┌───────────────────────────────────────────────────────────────┐
│ ETAPA 7 — ENVIO + ASSINATURA                                  │
│ ─────────────────────────────                                  │
│ status=AGUARDANDO_ASSINATURA                                   │
│ Bot:                                                           │
│   "Estou enviando 2 documentos para você revisar:             │
│    [PROCURACAO.pdf]   ← whatsapp-sender.enviarPdfWhatsApp()   │
│    [CONTRATO.pdf]                                              │
│                                                                │
│    Após ler, responda CONFIRMO PROCURACAO + CONTRATO.         │
│    Vou enviar um código por SMS para confirmar a              │
│    assinatura digital."                                       │
│                                                                │
│ → bot envia OTP 6 dígitos via SMS (provedor a definir, ou WA) │
│ → pessoa responde → marca procuracaoAssinadaEm + contratoAss. │
│                                                                │
│ (Opção B futura: link Clicksign em vez de OTP WA.)            │
└───────────────────────────────────────────────────────────────┘
                            │
                            ↓
┌───────────────────────────────────────────────────────────────┐
│ ETAPA 8 — EMITE COBRANÇAS                                     │
│ ─────────────────────────────                                  │
│ status=AGUARDANDO_PAGAMENTO_ADESAO                            │
│ Triplet de chamadas asaas.emitirCobranca(...):                │
│                                                                │
│ 1. ADESÃO CoopereBR — R$ {{taxa_adesao}} mensal recorrente   │
│ 2. CUSTAS — R$ {{custas_estimadas}} à vista                   │
│ 3. HONORÁRIOS — condicional (só após êxito) → não emite       │
│    boleto agora, registra como acordo                         │
│                                                                │
│ Bot envia 2 links PIX/boleto:                                 │
│   "Para finalizar, pague:                                     │
│    1. Adesão: [link Asaas]                                    │
│    2. Custas iniciais: [link Asaas]                           │
│                                                                │
│    Honorários do advogado só após você receber o valor."     │
└───────────────────────────────────────────────────────────────┘
                            │
                            ↓
┌───────────────────────────────────────────────────────────────┐
│ ETAPA 9 — CONVERSÃO LEAD → COOPERADO + INÍCIO PROCESSO        │
│ ─────────────────────────────                                  │
│ Quando webhook Asaas confirma adesão paga:                    │
│ • Cria Cooperado(nome, cpf, etc) com cooperativaId=CoopereBR  │
│ • Lead.cooperadoIdConvertido = cooperado.id                   │
│ • Lead.status=ATIVO_PROCESSO_INICIADO                         │
│ • Notifica advogado parceiro (email/WA): "Novo caso!          │
│   {{nome}}, indébito {{valor}}, procuração assinada, custas  │
│   pagas. Material em [link painel admin]."                    │
└───────────────────────────────────────────────────────────────┘
```

## Modelo comercial sugerido

| Item | Quem cobra | Valor sugerido | Recorrência |
|---|---|---|---|
| Adesão à CoopereBR | CoopereBR | R$ 50-100 setup + R$ 30-50/mês | Mensal recorrente |
| Custas judiciais | CoopereBR (intermédia) | R$ 500-1.500 (varia caso) | À vista |
| Honorário advogado | Advogado parceiro direto | 25-30% do êxito | Só no êxito |
| Comissão SISGD | SISGD | % sobre adesão da cooperativa (vira PlanoSaas com Concierge) | Já está no contrato Cooperativa-SISGD |

Você é dono do SISGD e da CoopereBR (parceiro 1). Outras cooperativas que assinem Plano OURO com Concierge podem ter o mesmo funil de captação (mudando só o `{{cooperativa_*}}` no template). Modelo replicável.

## Riscos identificados

### LGPD
- **Fatura tem CPF, endereço, consumo** — dado sensível. Termo de consentimento explícito antes do upload.
- **RG/CNH é dado sensível extra** — mais um termo, mais cuidado no armazenamento (criptografia at-rest, retenção curta).
- **Diagnóstico do Concierge é dado pessoal financeiro** — direito de exclusão garantido.
- **Mensagens WA passam pelo Meta** — adicionar disclaimer.

### Meta WhatsApp Business
- Hoje bot usa Baileys (WA não-oficial). Pra escala precisa migrar pra **WA Business API** oficial (Meta) — caso contrário Meta pode banir o número.
- Templates de mensagem com mídia precisam de **aprovação prévia** do Meta. Procuração+contrato como anexo passa fácil; mensagem comercial "Quer recuperar R$ X" precisa template aprovado.

### Validade jurídica da assinatura por OTP via WA
- **MVP/piloto OK.** Caso real grande, advogado vai exigir Clicksign/DocuSign/ICP-Brasil.
- Recomendo combinar com advogado parceiro qual plataforma de assinatura ele aceita.

### Vetor de fraude
- Pessoa pode mandar fatura de OUTRO consumidor. Bot deveria validar **nome do titular declarado** confere com nome do dono da fatura. Não é blindagem 100% mas filtra os óbvios.
- **CPF declarado** deveria bater com CPF da fatura (já vem no OCR EDP-ES).

### Limite de processamento
- OCR Claude tem custo por chamada. Se bombar de leads, cuidar de rate limit + fila.
- Detectores são determinísticos (custo zero). Sem problema.

## Componentes que CRIAR

1. **Schema delta**: model `LeadConcierge` (Gap 1)
2. **Backend**:
   - `src/lead-concierge/lead-concierge.module.ts`
   - `src/lead-concierge/lead-concierge.service.ts` (orquestrador do funil)
   - `src/lead-concierge/lead-concierge.controller.ts` (endpoints públicos + admin)
   - `src/concierge/documento-identidade-ocr.service.ts` (OCR RG/CNH)
   - `src/concierge/gerador-pdf.service.ts` (procuração + contrato via template)
3. **Bot WA**: 4 estados novos no switch do `whatsapp-bot.service.ts` (CONCIERGE_AGUARDANDO_*) + handler de entry pelo telefone novo
4. **Seeds**: 2 modelos novos em `ModeloDocumento`
5. **Frontend admin**: `/dashboard/concierge/leads` (lista de leads + funil + ações manuais)
6. **Frontend público**: `/audite-fatura` (landing alternativa pra quem não usa WA)
7. **Spec dos templates de procuração** — coordenar com advogado parceiro

## Estimativa real

| Etapa | Esforço Cowork |
|---|---|
| Schema LeadConcierge + migration | 30min |
| LeadConciergeService (orquestrador) + specs | 3h |
| Controller endpoints públicos + admin | 1h |
| OCR documento identidade (prompt + service) | 1h |
| Gerador PDF + 2 templates seed | 2h |
| 4 estados novos no bot WA + handler entry | 2h |
| Tela admin /leads + funil + métricas | 2h |
| Landing /audite-fatura | 1h |
| Triplet cobrança Asaas + webhook | 1h |
| Specs Jest cobrindo state machine + edge cases | 2h |
| Smoke E2E com fatura piloto Guilherme/Laurentino | 1h |
| **Total** | **~16h (2-3 sprints Cowork)** |

## Dependências críticas antes de implementar

1. **Code finalizar Sprint M31 F4** (cooper-token transferência funcionário) — pra não conflitar
2. **Code rodar Sprint Hardening Mass-Write** — pra `propagarModulosDoPlano` ficar seguro antes do Concierge entrar como módulo SaaS
3. **Decisão comercial**:
   - Quem é o advogado parceiro?
   - Valor da taxa de adesão / custas / % honorário?
   - Plataforma de assinatura digital aceita pelo adv?
4. **Conta WhatsApp Business API oficial Meta** (pra produção; piloto pode rodar com Baileys)
5. **Aprovação prévia dos 2 modelos de mensagem template no Meta** (caso vá pra WA Business API)

## Próximo passo recomendado

Antes de implementar, **agendar reunião com advogado parceiro** pra definir:
1. Template da procuração (texto exato que ele aceita)
2. Template do contrato de honorários
3. Plataforma de assinatura digital aceita
4. Modelo de honorários (% sucumbência ou misto)
5. Quem cobra custas (CoopereBR intermédia ou direto adv)
6. Caso piloto: pegar 1 cooperado já analisado (Luciano, Carolina, etc) + rodar fluxo manual primeiro pra calibrar texto antes de automatizar.

---

**Status**: spec read-only entregue 2026-06-11. Implementação Cowork enfileirada após Code terminar M31 F4 + Hardening + Sprint C7 (integração PlanoSaas). Aguarda decisões comerciais com advogado parceiro antes de iniciar.

## Carry-overs catalogados

- `D-novo-CONCIERGE-WA-CAPTACAO` P1 — esta spec inteira
- `D-novo-OCR-DOCUMENTO-IDENTIDADE` P1 — prompt + service novo
- `D-novo-PDF-GERADOR-VIA-TEMPLATE` P2 — gerador de PDF a partir de ModeloDocumento (pode reusar pra outros docs do sistema)
- `D-novo-ASSINATURA-DIGITAL-CLICKSIGN` P2 — integração com plataforma de assinatura quando piloto sair
- `D-novo-WA-BUSINESS-API-MIGRACAO` P2 — migrar Baileys → WA Business API oficial Meta antes de escalar
- `D-novo-CONCIERGE-CONFIGURACOES-COMERCIAIS` P1 — campos novos em Cooperativa pra `taxaAdesaoConcierge`, `percentualHonorarios`, etc
