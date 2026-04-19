# Botões Interativos + 3 Rotinas de Fluxo WhatsApp

**Data:** 2026-03-26
**Status:** Implementado e compilando sem erros

---

## PARTE 1 — Botões Interativos (Baileys)

### WhatsappSenderService — `enviarMenuComBotoes()`

**Arquivo:** `backend/src/whatsapp/whatsapp-sender.service.ts`

Novo método que envia menus interativos com **fallback gracioso**:

- **Até 3 opções** → usa `buttonsMessage` do Baileys (botões clicáveis)
- **4+ opções** → usa `listMessage` do Baileys (lista com seções)
- **Fallback** → se o envio interativo falhar (versão incompatível do Baileys ou do WhatsApp do destinatário), envia **mensagem de texto simples** com opções numeradas

Interfaces exportadas:
```typescript
OpcaoMenu { id: string; texto: string; descricao?: string }
MenuInterativo { titulo: string; corpo: string; rodape?: string; opcoes: OpcaoMenu[] }
```

Rota esperada no serviço Baileys: `POST /send-interactive` com payload `{ to, type: 'buttons'|'list', message }`.

### WhatsappBotService — Retrocompatibilidade

**Arquivo:** `backend/src/whatsapp/whatsapp-bot.service.ts`

- Campo `selectedButtonId` adicionado ao `MensagemRecebida` (passado pelo webhook)
- Método `respostaEfetiva(msg)` extrai: `selectedButtonId` (botão/lista) OU texto numérico
- **Todos os menus substituídos**: Menu Principal, Menu Cooperado (5 opções via lista), Menu Cliente, Menu Convite

### Webhook atualizado

**Arquivo:** `backend/src/whatsapp/whatsapp-fatura.controller.ts`

O endpoint `POST /whatsapp/webhook-incoming` agora aceita `selectedButtonId` opcional no body.

---

## PARTE 2 — 3 Rotinas de Fluxo

### Rotina 1: Cadastro via QR Code / Propaganda

**Estados:** `MENU_QR_PROPAGANDA` → `AGUARDANDO_VALOR_FATURA` → `RESULTADO_SIMULACAO_RAPIDA`

**Fluxo:**
1. Contato espontâneo (sem indicação) → `iniciarFluxoQrPropaganda(telefone)`
2. Boas-vindas com botões: **Conhecer a CoopereBR** | **Simular minha economia** | **Falar com consultor**
3. Se "Conhecer" → explica benefícios → oferece simular ou enviar fatura
4. Se "Simular" → pede valor da fatura → calcula com 20% de desconto
5. Resultado: `Com sua conta de R$ X, você economizaria R$ Y/mês (R$ Z/ano)!`
6. Botões: **Quero me cadastrar** | **Receber mais informações** | **Não tenho interesse**
7. "Cadastrar" → redireciona para fluxo de fatura (OCR completo)
8. "Mais informações" → texto com benefícios + link do portal

### Rotina 2: Cooperado Inadimplente

**Estados:** `MENU_INADIMPLENTE` → `NEGOCIACAO_PARCELAMENTO`

**Cron:** Diariamente às 9h (São Paulo), busca cobranças vencidas há 5+ dias com `notificadoVencimento = false`.

**Fluxo:**
1. `iniciarFluxoInadimplente(telefone, cobrancaId, nome, valor, vencimento, pix, link)`
2. Mensagem gentil + botões: **Ver detalhes** | **Negociar parcelamento** | **Já paguei**
3. "Ver detalhes" → mostra valor, vencimento, PIX copia-e-cola, link pagamento
4. "Negociar parcelamento" → oferece 2x ou 3x sem juros → confirma acordo
5. "Já paguei" → confirma verificação em 24h

**Endpoint manual:** `POST /whatsapp/abordar-inadimplentes` (SUPER_ADMIN/ADMIN)

**Arquivo do cron:** `backend/src/whatsapp/whatsapp-cobranca.service.ts` — método `abordarInadimplentes()`

### Rotina 3: Novo Membro Indicado (Convite Melhorado)

**Estados:** `MENU_CONVITE_INDICACAO` → `CADASTRO_EXPRESS_NOME` → `CADASTRO_EXPRESS_CPF` → `CADASTRO_EXPRESS_EMAIL` → `CADASTRO_EXPRESS_VALOR_FATURA`

**Fluxo:**
1. Detecta `codigoIndicacao` → `iniciarFluxoConviteIndicacao(telefone, indicadorNome, codigo)`
2. Boas-vindas personalizada: `Você foi indicado por [NOME] para conhecer a CoopereBR!`
3. Botões: **Conhecer os benefícios** | **Simular minha economia** | **Iniciar cadastro agora**
4. "Cadastro agora" → **Cadastro Express** (pede só: nome, CPF, email, valor da fatura)
5. Ao final: `Perfeito! Seu cadastro está em análise. [NOME] será notificado quando você for aprovado!`
6. Notifica indicador e admin da cooperativa automaticamente

**Integração:** `processarEntradaIndicado()` no MLM service agora usa o fluxo melhorado com botões.

---

## Arquivos Modificados

| Arquivo | Alteração |
|---------|-----------|
| `whatsapp-sender.service.ts` | `enviarMenuComBotoes()` + interfaces `OpcaoMenu`, `MenuInterativo` |
| `whatsapp-bot.service.ts` | `selectedButtonId`, `respostaEfetiva()`, 10 novos estados, 10 novos handlers, menus com botões |
| `whatsapp-cobranca.service.ts` | Cron `cronAbordagemInadimplentes()`, método `abordarInadimplentes()` |
| `whatsapp-mlm.service.ts` | `processarEntradaIndicado()` redireciona para fluxo melhorado |
| `whatsapp-fatura.controller.ts` | `selectedButtonId` no webhook, endpoint `abordar-inadimplentes` |

## Novos Estados da Máquina de Estados

| Estado | Rotina | Descrição |
|--------|--------|-----------|
| `MENU_QR_PROPAGANDA` | 1 | Menu inicial QR/propaganda |
| `AGUARDANDO_VALOR_FATURA` | 1 | Aguardando valor da conta de luz |
| `RESULTADO_SIMULACAO_RAPIDA` | 1 | Resultado da simulação rápida |
| `MENU_INADIMPLENTE` | 2 | Menu de abordagem inadimplente |
| `NEGOCIACAO_PARCELAMENTO` | 2 | Negociação de parcelamento |
| `MENU_CONVITE_INDICACAO` | 3 | Menu convite com botões |
| `CADASTRO_EXPRESS_NOME` | 3 | Coletando nome |
| `CADASTRO_EXPRESS_CPF` | 3 | Coletando CPF |
| `CADASTRO_EXPRESS_EMAIL` | 3 | Coletando email |
| `CADASTRO_EXPRESS_VALOR_FATURA` | 3 | Coletando valor da fatura |

## Compilação

```
npx tsc --noEmit → 0 erros
```
