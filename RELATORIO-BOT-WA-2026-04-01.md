# Relatório de Revisão — Bot WhatsApp CoopereBR

**Data:** 2026-04-01
**Escopo:** Templates de mensagens, fluxo do bot, qualidade de mensagens, URLs

---

## 1. Problemas Encontrados e Correções Aplicadas

### 1.1 URLs localhost:3001 em Produção (CRÍTICO)

| Arquivo | Linha | Problema | Correção |
|---------|-------|----------|----------|
| `motor-proposta.service.ts` | 723 | URL hardcoded `http://localhost:3001/aprovar-proposta` sem `process.env.FRONTEND_URL` | Adicionado `process.env.FRONTEND_URL ?? 'https://cooperebr.com.br'` |
| `motor-proposta.service.ts` | 793 | URL hardcoded `http://localhost:3001/assinar` sem `process.env.FRONTEND_URL` | Adicionado `process.env.FRONTEND_URL ?? 'https://cooperebr.com.br'` |
| `whatsapp-ciclo-vida.service.ts` | 8 | Fallback `http://localhost:3001` | Alterado para `https://cooperebr.com.br` |
| `whatsapp-mlm.service.ts` | 112 | Fallback `http://localhost:3001` | Alterado para `https://cooperebr.com.br` |
| `whatsapp-bot.service.ts` | 2372 | Fallback `http://localhost:3001` | Alterado para `https://cooperebr.com.br` |
| `clube-vantagens.job.ts` | 60 | Fallback `http://localhost:3001` | Alterado para `https://cooperebr.com.br` |
| `clube-vantagens.service.ts` | 529 | Fallback `http://localhost:3001` | Alterado para `https://cooperebr.com.br` |
| `indicacoes.service.ts` | 80, 103 | Fallback `http://localhost:3001` | Alterado para `https://cooperebr.com.br` |
| `email-templates.ts` | 52 | Fallback `http://localhost:3001` | Alterado para `https://cooperebr.com.br` |
| `auth.service.ts` | 143, 328, 366 | Fallback `http://localhost:3001` | Alterado para `https://cooperebr.com.br` |

**Impacto:** Os 2 bugs em `motor-proposta.service.ts` eram os mais graves — links de aprovação de proposta e assinatura digital enviados via WhatsApp apontavam para localhost em qualquer ambiente. Os demais tinham fallback que seria usado apenas se `FRONTEND_URL` não estivesse definida.

### 1.2 Mensagem Genérica MLM Avulso (MÉDIO)

| Arquivo | Linha | Problema | Correção |
|---------|-------|----------|----------|
| `whatsapp-mlm.service.ts` | 156-157 | Mensagem avulsa muito genérica: "economize até 20% na sua conta de luz" sem explicar como funciona | Reescrita com explicação do modelo cooperativa, energia solar, e CTA claro para enviar foto da fatura |

**Antes:**
> Olá! Conheça a CoopereBR e economize até 20% na sua conta de luz todos os meses, sem investimento. Para ver quanto você economizaria, mande uma foto da sua última conta de energia! 💡

**Depois:**
> Olá! 👋 A *CoopereBR* é uma cooperativa de energia solar que gera *economia real na sua conta de luz* — sem investimento, sem obras e sem fidelidade.
>
> ☀️ Como funciona: você recebe créditos de energia solar direto na sua fatura da distribuidora, pagando menos todo mês.
>
> 📸 Quer descobrir quanto pode economizar? Envie uma *foto da sua última conta de energia* e faço uma simulação gratuita na hora! 💡

### 1.3 Mensagem de Despedida sem Acentos (BAIXO)

| Arquivo | Linha | Problema | Correção |
|---------|-------|----------|----------|
| `whatsapp-bot.service.ts` | 414 | "Ate logo! Se precisar, e so chamar." (sem acentos) | "Até logo! Se precisar, é só chamar." |

---

## 2. Análise do Fluxo do Bot

### 2.1 Estrutura de Estados (OK)
O bot possui uma máquina de estados bem definida com ~40 estados. Transições estão corretas.

### 2.2 Pontos Positivos
- Rate limiting por cooperativa (`intervaloMinCobrancaHoras`)
- Delay aleatório entre mensagens (3-8s) para evitar bloqueio do WhatsApp
- Fallback texto quando lista interativa falha no Baileys
- Timeout de sessão (30min) com reset automático
- Detecção de linguagem inapropriada com resposta empática
- Filtro de horário comercial (20h-8h) com aviso
- Proteção contra disparo duplicado (flags `WA_*_HABILITADO`)

### 2.3 Potenciais Problemas de Fluxo
- **LID resolution:** O log mostra LID-to-phone mapping funcionando (`LID 238293526536210 → 5527981341348`), mas se o arquivo de mapeamento não existir, a mensagem é ignorada silenciosamente.
- **Session debug noise:** O log `wa-out.log` está poluído com dumps de SessionEntry do Baileys (chaves criptográficas). O logger do Baileys está em `warn` mas o Closing session vem do próprio Baileys. Não impacta funcionamento, mas dificulta debug.

---

## 3. Análise de Qualidade das Mensagens

### 3.1 Mensagens do Ciclo de Vida (`whatsapp-ciclo-vida.service.ts`) — BOM
- Boas-vindas: personalizada, próximos passos claros, link do portal
- Documento aprovado/reprovado: motivo incluso, prazo estimado
- Contrato gerado: link de assinatura, explicação do próximo passo
- Pagamento confirmado: valor, data/hora, link do histórico
- Indicação: notifica indicador com nome do indicado e benefício

### 3.2 Mensagens de Cobrança (`whatsapp-cobranca.service.ts`) — BOM
- Usa `ConfiguracaoNotificacaoService` para textos configuráveis por cooperativa
- Inclui PIX copia-e-cola, linha digitável e link de pagamento
- Alerta preventivo 3 dias antes do vencimento
- Abordagem de inadimplentes com cálculo de multa/juros

### 3.3 Mensagens do Bot (`whatsapp-bot.service.ts`) — BOM com ressalvas
- Menu principal claro com 4 opções
- Sub-menus contextuais para cooperado vs. novo cliente
- Guia passo-a-passo para baixar fatura por distribuidora (EDP, CEMIG, COPEL, LIGHT)

---

## 4. Sugestões de Melhoria

### 4.1 Mensagens
1. **Mensagem de tarifa/preço (bot line 256):** Diz "até 20% de desconto" — considerar buscar o desconto real do plano padrão via `ConfigTenant` para ser mais preciso
2. **Mensagem de desligamento (bot line 235):** Link `cooperebr.com.br/portal/desligamento` — verificar se essa rota existe no frontend
3. **Mensagem de créditos (ciclo-vida line 116):** Poderia incluir o valor estimado de economia mensal
4. **Mensagem de NPS:** Existe handler `NPS_AGUARDANDO_NOTA` — considerar implementar pesquisa de satisfação pós-pagamento

### 4.2 Fluxo do Bot
1. **Timeout de atendente:** Quando cooperado fica em `AGUARDANDO_ATENDENTE`, não há timeout para fechar o chamado se ninguém responder
2. **Contato compartilhado:** Interface `MensagemRecebida` tem `contatoNome/contatoTelefone` mas não há handler para tipo `contato` — poderia pré-popular dados de indicação
3. **Logs do Baileys:** Configurar o logger do Baileys para `silent` em vez de `warn` para reduzir ruído no log

### 4.3 Segurança
1. **Webhook secret exposto no log:** `wa-out.log` mostra a URL completa do webhook incluindo `?secret=cooperebr_wh_2026` — considerar não logar a URL completa

---

## 5. Arquivos Modificados

| Arquivo | Tipo de Correção |
|---------|-----------------|
| `backend/src/motor-proposta/motor-proposta.service.ts` | URL hardcoded → env var |
| `backend/src/whatsapp/whatsapp-ciclo-vida.service.ts` | Fallback localhost → produção |
| `backend/src/whatsapp/whatsapp-mlm.service.ts` | Fallback + mensagem genérica |
| `backend/src/whatsapp/whatsapp-bot.service.ts` | Fallback + acentuação |
| `backend/src/clube-vantagens/clube-vantagens.job.ts` | Fallback localhost → produção |
| `backend/src/clube-vantagens/clube-vantagens.service.ts` | Fallback localhost → produção |
| `backend/src/indicacoes/indicacoes.service.ts` | Fallback localhost → produção |
| `backend/src/email/email-templates.ts` | Fallback localhost → produção |
| `backend/src/auth/auth.service.ts` | Fallback localhost → produção |
