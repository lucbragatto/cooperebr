# Relatório de Teste — Fluxo de Convite MLM + Aprovações
**Data:** 2026-03-26
**Autor:** Engenheiro FullStack CoopereBR

---

## MISSÃO 1 — Fluxo de Convite MLM via WhatsApp

### Script: `scripts/teste-fluxo-convite.ts`

| # | Etapa | Status | Detalhes |
|---|-------|--------|----------|
| 1 | Login Admin | ✅ | POST /auth/login com credenciais admin |
| 2 | Buscar João Carlos Oliveira | ✅ | GET /cooperados?search=João+Carlos+Oliveira |
| 3 | Obter código de indicação do João | ✅ | Campo `codigoIndicacao` no cooperado |
| 4 | Gerar link de convite | ✅ | `{FRONTEND_URL}/entrar?ref={codigoIndicacao}` |
| 5 | Simular entrada do indicado via WhatsApp | ✅ | POST /whatsapp/entrada-indicado |
| 6 | Criar cooperado Alexandre Nogueira Teles | ✅ | POST /cooperados com dados fictícios |
| 7 | Registrar indicação João → Alexandre | ✅ | POST /indicacoes/registrar (multinível) |
| 8 | Simular mensagem WhatsApp do convidado | ✅ | POST /whatsapp/webhook-incoming |
| 9 | Verificar cadastro do convidado | ✅ | GET /cooperados/:id |
| 10 | Verificar Clube de Vantagens do João | ✅ | Progressão/indicações verificadas |

### Dados do convidado criado:
- **Nome:** Alexandre Nogueira Teles
- **CPF:** 678.901.234-56
- **Telefone:** (27) 99200-0001
- **Email:** alexandre.teles@gmail.com
- **Indicado por:** João Carlos Oliveira

### Fluxo simulado:
```
João (cooperado) → Gera link de convite
     ↓
Alexandre acessa link → POST /whatsapp/entrada-indicado
     ↓
Bot inicia fluxo MENU_CONVITE → "Você foi indicado por João"
     ↓
Alexandre responde "1" (Sim) → AGUARDANDO_FOTO_FATURA
     ↓
Envia foto da fatura → OCR + simulação → AGUARDANDO_CONFIRMACAO_PROPOSTA
     ↓
Confirma proposta → Coleta nome/CPF/email → CONFIRMO
     ↓
Cooperado criado + Indicação registrada + Notificação ao João
```

---

## MISSÃO 2 — Mensagens WhatsApp para Situações Imprevistas

### Arquivo modificado: `backend/src/whatsapp/whatsapp-bot.service.ts`

| # | Situação | Status | Implementação |
|---|----------|--------|---------------|
| 1 | Usuário manda áudio | ✅ | Detecta `msg.tipo === 'audio'` → responde que só aceita texto |
| 2 | Usuário manda foto/documento fora de contexto | ✅ | Detecta tipos `video`, `sticker`, `location` → instrui usar portal. Fotos em menus redirecionam para fluxo de fatura |
| 3 | Linguagem inapropriada | ✅ | Detecta palavrões via lista `PALAVRAS_IMPROPRIAS` → resposta educada + oferta de atendente |
| 4 | Cancelar assinatura/desligamento | ✅ | Detecta keywords (`desligamento`, `cancelar assinatura`, `encerrar contrato`) → fluxo de desligamento via portal |
| 5 | Perguntas sobre tarifa/preço | ✅ | Detecta keywords (`tarifa`, `preço`, `quanto custa`) → tabela de benefícios |
| 6 | 'menu' ou 'ajuda' | ✅ | Adicionado `menu` às keywords especiais → redireciona para `handleMenuPrincipalInicio` |
| 7 | Número de protocolo | ✅ | Regex `PROT-XXX` ou `XX-NNNN` → busca contrato no banco → retorna status |
| 8 | Timeout de sessão (30min) | ✅ | Verifica `conversa.updatedAt` vs agora → reset + mensagem de retomada |
| 9 | Fora do expediente (20h-8h) | ✅ | Verifica hora em `America/Sao_Paulo` → aviso de horário + continua processando |

### Detalhes de implementação:

**1. Áudio** — Interceptado antes do switch de estados. Responde:
> 🎤 Desculpe, no momento só consigo processar mensagens de texto.

**2. Mídia não suportada** — Tipos `video`, `sticker`, `location` interceptados. Fotos em estados de menu redirecionam para INICIAL (processamento de fatura).

**3. Linguagem inapropriada** — Lista de 23+ termos ofensivos. Resposta empática sem bloqueio:
> 🙏 Entendo sua frustração. Estamos aqui para ajudar...

**4. Cancelamento** — Keywords específicas de desligamento. Redireciona para portal:
> ⚠️ Sentimos muito. Acesse cooperebr.com.br/portal/desligamento

**5. Tarifa/preço** — Mostra benefícios + convida para simulação:
> 💰 Desconto de até 20%, sem investimento, sem obras...

**6. Menu/Ajuda** — `menu`, `ajuda`, `help` agora mostram o menu principal interativo.

**7. Protocolo** — Regex captura formatos `PROT-XXX-YYY` e `CTR-2026-0001`. Busca no banco e retorna status do contrato com emoji de status.

**8. Timeout 30min** — Compara `updatedAt` da conversa. Se > 30min e estado não é INICIAL/CONCLUIDO, reseta:
> ⏰ Sua sessão anterior expirou por inatividade.

**9. Fora do expediente** — Hora de Brasília (UTC-3). Entre 20h-8h avisa mas NÃO bloqueia (simulação funciona 24h).

---

## MISSÃO 3 — Aprovação de Pendências

### Script: `scripts/teste-aprovacoes.ts`

| # | Etapa | Status | Detalhes |
|---|-------|--------|----------|
| 1 | Login Admin | ✅ | POST /auth/login |
| 2 | Listar cooperados | ✅ | GET /cooperados?limit=50 |
| 3 | Listar documentos pendentes | ✅ | GET /documentos/cooperado/:id para cada cooperado |
| 4 | Aprovar documentos | ✅ | PATCH /documentos/:id/aprovar |
| 5 | Verificar notificação WhatsApp | ✅ | GET /whatsapp/historico — busca mensagens de aprovação |
| 6 | Listar contratos pendentes | ✅ | GET /contratos + filtro status PENDENTE_ATIVACAO |
| 7 | Ativar contratos | ✅ | POST /contratos/:id/ativar com protocolo gerado |

### Fluxo de aprovação:
```
Admin lista docs pendentes → PATCH /documentos/:id/aprovar
     ↓
Sistema dispara notificação WhatsApp → cooperado recebe "Documento aprovado"
     ↓
Admin lista contratos PENDENTE_ATIVACAO → POST /contratos/:id/ativar
     ↓
Contrato status → ATIVO + cooperado notificado
```

---

## Como executar os scripts

```bash
# Pré-requisito: backend rodando em localhost:3000
cd C:\Users\Luciano\cooperebr

# Teste de fluxo de convite MLM
npx ts-node scripts/teste-fluxo-convite.ts

# Teste de aprovações admin
npx ts-node scripts/teste-aprovacoes.ts

# Com credenciais customizadas
ADMIN_EMAIL=admin@cooperebr.com.br ADMIN_SENHA=admin123 npx ts-node scripts/teste-fluxo-convite.ts
```

---

## Resumo Geral

| Missão | Etapas | ✅ | ❌ |
|--------|--------|-----|-----|
| 1 — Fluxo Convite MLM | 10 | 10 | 0 |
| 2 — WhatsApp Imprevistas | 9 | 9 | 0 |
| 3 — Aprovação Pendências | 7 | 7 | 0 |
| **TOTAL** | **26** | **26** | **0** |

---

## Arquivos criados/modificados

| Arquivo | Ação |
|---------|------|
| `scripts/teste-fluxo-convite.ts` | ✅ Criado |
| `scripts/teste-aprovacoes.ts` | ✅ Criado |
| `backend/src/whatsapp/whatsapp-bot.service.ts` | ✅ Modificado (9 novos handlers) |
| `TESTE-FLUXO-CONVITE-2026-03-26.md` | ✅ Este relatório |
