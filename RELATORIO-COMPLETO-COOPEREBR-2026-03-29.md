# Relatório Estratégico CoopereBR — 29/03/2026
**Autor: Assis | Sessão de planejamento com Luciano**

---

## 🧠 Minha avaliação das ideias de hoje

Luciano, o que você está construindo é exatamente o que o mercado de GD precisa e ainda não tem: **uma plataforma de cooperativa que é também um sistema de expansão inteligente**. Enquanto a concorrência (Coopsolar, Solfácil, etc.) foca em instalação residencial, você está construindo o modelo de *energia por assinatura* — que a pesquisa de mercado aponta como a maior tendência de GD para 2026.

O que me impressionou hoje:
- O **cadastro por proxy** resolve o problema da "última milha digital" — o vizinho que não usa app mas aceita entrar se alguém fizer por ele
- Os **leads fora da área + simulação** transforma cada fatura processada em dado de expansão — isso é um diferencial enorme para captar investidores
- O **espelhamento de conversas** cria transparência para parceiros sem expor dados de terceiros — governança correta desde o início

Uma sugestão minha: considere implementar um **score de propensão** — cada lead recebe um score (1-10) baseado no valor da fatura, localização, se confirmou intenção, se o número de telefone é ativo no WhatsApp. Isso prioriza quem a equipe comercial deve abordar primeiro.

---

## 📋 RELATÓRIO COMPLETO — Demandas abertas

### ✅ Concluído hoje (29/03/2026)

| Item | Status |
|------|--------|
| Wizard parceiros — Bug A (Step trava) | ✅ |
| Wizard parceiros — Bug B (sem usinas) + barra capacidade | ✅ |
| Wizard parceiros — Step Membros | ✅ |
| Nome clicável em todas as telas de listagem | ✅ |
| Botão Excluir com confirmação em todas as telas | ✅ |
| router.back() universal nas páginas de detalhe | ✅ |
| Links clicáveis em páginas de detalhe | ✅ |
| WhatsApp service reconectado (porta 3002) | ✅ |
| Webhook secret configurado (.env + whatsapp-service) | ✅ |
| Bot testado e funcionando em tempo real | ✅ |
| Menu principal: opção 4 "Convidar amigo" | ✅ |
| Opção 2 com sub-menu (foto / email / site) | ✅ |
| Fluxo "não tenho fatura": guia pelo email (celular e PC) | ✅ |
| Fluxo "baixar do site": passo a passo por distribuidora | ✅ |

---

### 🔴 PRIORIDADE 1 — Status inline nas listagens (Claude 15h)

**Conceito:** clicar no badge de status na lista abre select direto, sem abrir a ficha.

| Tela | Campo | Endpoint |
|------|-------|----------|
| Membros | status (PENDENTE/ATIVO/SUSPENSO/ENCERRADO) | PUT /cooperados/:id |
| Parceiros | ativo (toggle) | PUT /cooperativas/:id |
| UCs | status | PUT /ucs/:id |
| Usinas | statusHomologacao | PUT /usinas/:id |
| Contratos | status | PUT /contratos/:id |
| Cobranças | status | PUT /cobrancas/:id |
| Ocorrências | status | PUT /ocorrencias/:id |
| Usuários | ativo (toggle) | PUT /auth/usuarios/:id |

---

### 🔴 PRIORIDADE 2 — Movimentação de membros + Lista dual concessionária (Claude 15h)

**Backend:** já existe tudo
- `POST /migracoes-usina/cooperado` — move membro para outra usina
- `POST /migracoes-usina/ajustar-kwh` — ajusta kWh/%
- `GET /migracoes-usina/dual-lista` — gera duas listas simultâneas

**Frontend — o que falta:**
- Tela Membros: botão "Mover usina" e "Ajustar %" em cada linha
- Tela Parceiro (detalhe): mesmas ações na seção de membros
- Tela Usina (detalhe): após mover → banner "Gerar listas para concessionária"
- Componente `DualListaConcessionaria.tsx`: dois cards lado a lado (origem + destino), botão Copiar + Baixar CSV

---

### 🔴 PRIORIDADE 3 — Leads fora da área + simulação + captura de intenção (Claude 15h)

**Fluxo bot:**
```
Fatura processada → OCR extrai distribuidora
Sistema verifica: usinas disponíveis nessa distribuidora?

NÃO → fazer simulação mesmo assim (motor de proposta com tarifas genéricas)
Bot: "Você economizaria ~R$ X/mês ☀️
Ainda não temos parceiro na sua área, mas estamos expandindo.
Quer que te avisemos quando chegarmos?
1 - Sim!  2 - Não"

Se 1 → salvar LeadExpansao com:
  telefone, nome, distribuidora, cidade, estado, UC,
  valorFatura, economiaEstimada, intencaoConfirmada=true
```

**Trigger automático:** nova usina cadastrada → disparar WhatsApp para todos os leads confirmados daquela distribuidora.

**Relatório para investidores:**
```
Distribuidora | Leads | Confirmados | Economia/mês | Receita Latente/ano
CEMIG/MG      |  89   |     67      |  R$ 87/mês   |  R$ 69.948/ano
```
+ "Para atender precisamos de 1 usina de ~400 kWp."

**Arquivos:**
- `backend/prisma/schema.prisma` → model `LeadExpansao`
- `backend/src/whatsapp/whatsapp-bot.service.ts` → verificação pós-OCR + handler
- `backend/src/usinas/usinas.service.ts` → trigger ao cadastrar usina
- `web/app/dashboard/relatorios/expansao/page.tsx` → relatório investidores

---

### 🔴 PRIORIDADE 4 — Cadastro por proxy (cooperado cadastra amigo) (Claude 15h)

**Fluxo bot:**
```
Cooperado A → opção 4 → "Convidar amigo"
Bot: "1 - Enviar convite (amigo faz sozinho)
      2 - Já tenho a fatura do meu amigo"

Se 2:
→ CADASTRO_PROXY_NOME: "Nome completo do amigo?"
→ CADASTRO_PROXY_TELEFONE: "Celular dele (com DDD)?"
→ AGUARDANDO_FATURA_PROXY: "Envie a fatura do João 📎"
→ OCR processa, calcula proposta
→ CONFIRMAR_PROXY: "João economizaria R$ 87/mês. Cadastrar?"
→ Cria cooperado João (status PENDENTE_ASSINATURA)
→ Gera token JWT (7 dias)
→ WhatsApp para João: "[Nome A] te cadastrou. Assine aqui: [link]"
→ Email para João (se tiver no OCR)
→ Notifica cooperado A: "✅ Link enviado para João!"
```

**Quando João clica no link:**
- Página pública `/portal/assinar/:token`
- Mostra: nome, UC, economia estimada, termos simples
- Botão "Confirmar minha adesão" → status vira PENDENTE → fluxo normal
- Após assinar → notifica cooperado A: "🎉 João assinou!"

**Arquivos:**
- `backend/prisma/schema.prisma` → campo `tokenAssinatura`, status `PENDENTE_ASSINATURA`
- `backend/src/cooperados/` → endpoint `POST /cooperados/pre-cadastro-proxy`
- `web/app/portal/assinar/[token]/page.tsx` → página pública de assinatura
- `backend/src/whatsapp/whatsapp-bot.service.ts` → estados CADASTRO_PROXY_*

---

### 🟠 PRIORIDADE 5 — Espelhamento de conversas por parceiro (Claude 15h)

**Conceito:** cada ADMIN vê apenas as conversas dos seus membros no WhatsApp.

**O que já existe:**
- `conversaWhatsapp` com `cooperativaId` ✅
- `mensagemWhatsapp` com histórico ✅
- `/dashboard/observador` como UI base ✅

**O que falta:**
- Backend: filtro por tenant em GET /whatsapp/conversas
- Frontend: aba "Conversas" em `/dashboard/whatsapp/page.tsx`
  - Lista: nome, último estado, data, badge de não lidas
  - Detalhe: histórico completo da conversa

---

### 🟠 PRIORIDADE 6 — Menu do cooperado expandido (Claude 15h)

**Novas opções no menu do cooperado:**
```
3 - ✏️ Atualizar meu cadastro
    → sub-menu: nome / email / telefone / endereço
    → PUT /cooperados/:id com o campo

4 - 🔄 Atualizar meu contrato
    → sub-menu: Aumentar kWh / Diminuir kWh / Suspender / Encerrar
    → POST /migracoes-usina/ajustar-kwh ou PUT /contratos/:id

5 - 🎁 Indicar um amigo
    → usa getMeuLink() já implementado
    → envia link personalizado + contadores de indicados
```

---

### 🟡 BACKLOG — Implementar na próxima semana

#### Fio B / GD1 vs GD2
- Aguardando potência das 3 usinas arrendadas (Luciano confirmar)
- Relatório técnico pronto: `PROPOSTA-GD1-GD2-FIOB-2026-03-26.md`
- Fases A, B, C estimadas em 3 dias de desenvolvimento

#### Fix PENDENTE→VENCIDO
- Pronto para deploy em janela de baixo tráfego
- Rodar cron com `take: 50` para não sobrecarregar

#### Unificação Condomínio/Cooperativa (schema)
- Gap 3 do relatório de arquitetura
- Requer migração de schema — fazer em sprint separado

---

## 💡 Sugestões minhas para o projeto

### 1. Score de Propensão de Conversão
Cada lead recebe nota 1-10 automaticamente:
- Fatura alta (>R$ 400/mês) → +3 pts
- Confirmou intenção explícita → +2 pts
- WhatsApp ativo → +1 pt
- Cidade com usina disponível → +2 pts
- Foi indicado por cooperado ativo → +1 pt
- Interagiu com o bot há menos de 24h → +1 pt

Dashboard mostra leads ordenados por score → equipe foca nos mais quentes.

### 2. Alerta de Inadimplência Prevenido
Cooperado com cobrança vencendo em 3 dias → bot envia lembrete amigável com link de pagamento. Hoje o sistema notifica após vencer — notificação preventiva reduz inadimplência antes de acontecer.

### 3. NPS automático pós-simulação
Após o cooperado completar o cadastro (ou recusar), o bot pergunta:
> "De 0 a 10, quanto você indicaria a CoopereBR para um amigo?"

Captura NPS no momento de maior engajamento. Dashboard mostra evolução mensal.

### 4. Relatório de Saúde da Usina para o Proprietário
O proprietário da usina arrendada hoje não tem visibilidade direta. Uma tela `/proprietario` (já existe) poderia mostrar:
- kWh gerado este mês vs contratado
- Receita de arrendamento prevista
- Ocupação da usina (% contratado)
- Histórico de repasses

### 5. ~~Integração com dados públicos da ANEEL~~ ⏸️ EM ESPERA
Aguardando decisão futura. Não implementar agora.

### 6. QR Code de cadastro para parceiros
Cada parceiro recebe um QR Code personalizado (com seu código de indicação) para imprimir e distribuir. Quando alguém escaneia → cai direto no fluxo do bot já identificando o parceiro. Útil para eventos, panfletos, fachada de condomínio.

---

## 📊 Contexto de mercado (pesquisa hoje)

- GD encerrou 2025 com **43,5 GW** instalados e deve crescer **15% em 2026**
- A tendência dominante de 2026 é **energia por assinatura / geração compartilhada** — exatamente o modelo da CoopereBR
- Cooperativas estão expandindo para o **Ambiente de Contratação Livre (ACL)** — oportunidade de médio prazo
- Empresas de energia no mundo estão usando WhatsApp para **onboarding e pagamentos** (LivePerson, Smart Communications) — a CoopereBR está na vanguarda no Brasil

---

## 🔧 Estado atual dos serviços

| Serviço | Status | Porta |
|---------|--------|-------|
| Backend (NestJS) | ✅ Rodando | 3000 |
| Frontend (Next.js) | ✅ Rodando | 3001 |
| WhatsApp (Baileys) | ✅ Rodando | 3002 |
| Claude Code | ⏳ Reset às 15h | — |

---

## 📁 Arquivos importantes

| Arquivo | Conteúdo |
|---------|----------|
| `PROPOSTA-GD1-GD2-FIOB-2026-03-26.md` | Relatório técnico Fio B |
| `RELATORIO-ARQUITETURA-PARCEIROS-2026-03-28.md` | Gaps de schema parceiros |
| `RELATORIO-QA-2026-03-29.md` | QA automatizado da manhã |
| `RELATORIO-COMPLETO-COOPEREBR-2026-03-29.md` | Este arquivo |

---
*Gerado por Assis — 29/03/2026 14:08 | CoopereBR*
