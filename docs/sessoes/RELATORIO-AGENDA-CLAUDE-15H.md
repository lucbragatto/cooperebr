# Relatório de Agenda — Retomada Claude às 15h
**CoopereBR — 29/03/2026 | Autor: Assis**

---

## ✅ O que foi feito hoje (antes das 15h)

| Item | Status |
|------|--------|
| Wizard parceiros — Bug A (Step trava) | ✅ Concluído |
| Wizard parceiros — Bug B (sem usinas) | ✅ Concluído |
| Wizard parceiros — Step Membros | ✅ Concluído |
| Nome clicável em todas as telas de listagem | ✅ Concluído |
| Botão Excluir em todas as telas de listagem | ✅ Concluído |
| router.back() universal em páginas de detalhe | ✅ Concluído |
| Links clicáveis em páginas de detalhe (usina, membro, UC etc.) | ✅ Concluído |
| WhatsApp service reiniciado (porta 3002) | ✅ Online |

---

## 🔴 TAREFA PRINCIPAL — Status inline nas listagens

**Conceito:** O usuário não deve precisar abrir a ficha para alterar status simples. A lista deve permitir edição direta.

### Telas que precisam de status inline editável:

#### 1. Membros (`/dashboard/cooperados/page.tsx`)
A coluna `Status` mostra um `<Badge>` estático. Transformar em dropdown inline:
```tsx
// Padrão: clicar no badge abre um select inline
<select 
  value={membro.status}
  onChange={e => handleStatusChange(membro.id, e.target.value)}
  className="text-xs border rounded px-1 py-0.5"
>
  <option value="PENDENTE">Pendente</option>
  <option value="ATIVO">Ativo</option>
  <option value="ATIVO_RECEBENDO_CREDITOS">Ativo - Recebendo Créditos</option>
  <option value="SUSPENSO">Suspenso</option>
  <option value="ENCERRADO">Encerrado</option>
</select>
// PUT /cooperados/:id { status }
```

#### 2. Parceiros (`/dashboard/cooperativas/page.tsx`)
Coluna `Ativo` (boolean) → transformar em toggle inline:
- Clicar no badge Ativo/Inativo → toggle direto
- `PUT /cooperativas/:id { ativo: !atual }`

#### 3. UCs (`/dashboard/ucs/page.tsx`)
Verificar se tem coluna de status — se sim, mesmo padrão inline.

#### 4. Usinas (`/dashboard/usinas/page.tsx`)
Campo `statusHomologacao` → select inline:
- CADASTRADA / AGUARDANDO_HOMOLOGACAO / HOMOLOGADA / EM_PRODUCAO / SUSPENSA
- `PUT /usinas/:id { statusHomologacao }`

#### 5. Contratos (`/dashboard/contratos/page.tsx`)
Campo `status` → select inline:
- ATIVO / SUSPENSO / ENCERRADO / LISTA_ESPERA
- `PUT /contratos/:id { status }`

#### 6. Cobranças (`/dashboard/cobrancas/page.tsx`)
Campo `status` → select inline:
- PENDENTE / PAGO / VENCIDO / CANCELADO
- `PUT /cobrancas/:id { status }`

#### 7. Ocorrências (`/dashboard/ocorrencias/page.tsx`)
Campo `status` → select inline:
- ABERTA / EM_ANDAMENTO / RESOLVIDA / CANCELADA
- `PUT /ocorrencias/:id { status }`

#### 8. Usuários (`/dashboard/usuarios/page.tsx`)
Campo `ativo` → toggle inline (já tem checkbox no modal, trazer para a lista)
- `PUT /auth/usuarios/:id { ativo }`

---

## 🔴 TAREFA PRINCIPAL — Movimentação de membros (interrompida pelo limite do Claude)

O agente `tidy-shoal` foi interrompido pelo limite de uso. Retomar exatamente esta tarefa:

### Backend — JÁ EXISTE, não criar novamente:
- `POST /migracoes-usina/cooperado` — move membro para outra usina
- `POST /migracoes-usina/ajustar-kwh` — ajusta kWh/% sem trocar usina
- `GET /migracoes-usina/dual-lista?usinaOrigemId=X&usinaDestinoId=Y` — duas listas simultâneas
- `GET /usinas/:id/lista-concessionaria` — lista única da usina

### O que falta no frontend:

#### A) Tela Membros (`/dashboard/cooperados/page.tsx`)
No menu de ações (3 pontinhos) de cada membro, adicionar:
- **Mover para outra usina** → modal com: select usina destino, campo kWh/% novo, motivo → `POST /migracoes-usina/cooperado`
- **Ajustar % / kWh** → modal simples → `POST /migracoes-usina/ajustar-kwh`
- Após mover: banner "Migração concluída. Gerar listas para concessionária?" → abre DualListaConcessionaria

#### B) Tela Parceiro detalhe (`/dashboard/cooperativas/[id]/page.tsx`)
Na seção Membros: mesmas ações de Mover e Ajustar %

#### C) Tela Usina detalhe (`/dashboard/usinas/[id]/page.tsx`)
Já tem modais de migração. Verificar e adicionar:
- Após migração bem-sucedida → banner com botão "Gerar listas para concessionária"
- Botão editar % inline na lista de cooperados alocados → `POST /migracoes-usina/ajustar-kwh`

#### D) Componente reutilizável `web/components/DualListaConcessionaria.tsx`
```tsx
// Props: usinaOrigemId, usinaDestinoId, onClose
// GET /migracoes-usina/dual-lista
// Dois cards: Usina Origem (removidos/atualizados) | Usina Destino (adicionados)
// Botões: Copiar lista | Baixar CSV | (opcional) Enviar por WhatsApp
```

---

## 🟠 TAREFAS SECUNDÁRIAS (após as principais)

### Bots WhatsApp — DIAGNÓSTICO + PLANO DETALHADO

**O bot por estados JÁ FUNCIONA.** A simulação "disparou tudo de uma vez" porque foi chamada via API direto, não pelo WhatsApp real. No WhatsApp real, cada mensagem avança um estado e espera resposta.

**Templates `{{historico}}` não substituídos:** na simulação de teste não havia fatura real (OCR não rodou), então as variáveis ficaram literais. Com foto real de fatura, funciona.

**Menu do cooperado EXISTENTE:**
- `1` → Ver créditos
- `2` → Ver próxima fatura
- `3` → Simular
- `4` → Suporte
- `5` → Atendente

#### O QUE FALTA IMPLEMENTAR no `whatsapp-bot.service.ts`:

**A) Expandir menu do cooperado com 3 novas opções:**
```
✅ Olá, *[Nome]*! O que precisa?
1 - ⚡ Ver saldo de créditos
2 - 📄 Ver próxima fatura
3 - ✏️ Atualizar meu cadastro   ← NOVO
4 - 🔄 Atualizar meu contrato   ← NOVO (ajustar kWh / suspender / encerrar)
5 - 🎁 Indicar um amigo         ← NOVO (gera link de indicação)
6 - 🔧 Suporte / Ocorrência
7 - 👤 Falar com atendente
```

**B) Fluxo "Atualizar cadastro" (estado: ATUALIZACAO_CADASTRO):**
```
Bot: "O que deseja atualizar?"
1 - Nome
2 - Email
3 - Telefone
4 - Endereço
→ Cooperado responde → PUT /cooperados/:id com o campo
→ Bot confirma: "✅ Cadastro atualizado!"
```

**C) Fluxo "Atualizar contrato" (estado: ATUALIZACAO_CONTRATO):**
```
Bot: "O que deseja fazer?"
1 - Aumentar meus kWh
2 - Diminuir meus kWh
3 - Suspender temporariamente
4 - Encerrar contrato
→ Cada opção abre sub-fluxo ou notifica admin
→ Ações de kWh → POST /migracoes-usina/ajustar-kwh
→ Suspender/Encerrar → PUT /contratos/:id { status }
```

**D) Fluxo "Indicar amigo" — QUASE PRONTO, só falta expor no menu:**
- `indicacoes.service.ts` → `getMeuLink()` já gera `cooperebr.com.br/entrar?ref=CODIGO`
- `whatsapp-bot.service.ts` → já notifica o indicador quando indicado completa o cadastro ✅
- `iniciarFluxoConvite()` → já inicia conversa com o lead indicado ✅
- **O QUE FALTA:** adicionar opção `5 - Indicar amigo` no `handleMenuCooperado()`:
```typescript
if (corpo === '5' || corpo.toLowerCase().includes('indicar')) {
  const { link, totalIndicados, indicadosAtivos } = await this.indicacoes.getMeuLink(cooperadoId);
  await this.sender.enviarMensagem(telefone,
    `🎁 *Seu link de indicação:*\n\n${link}\n\n` +
    `📊 Total indicados: ${totalIndicados}\n` +
    `✅ Ativos (com benefício): ${indicadosAtivos}\n\n` +
    `_Compartilhe com amigos! Quando eles pagarem a primeira fatura, você ganha seu benefício automaticamente._`
  );
  return;
}
```
- Notificações de progresso do indicado (não só no cadastro, mas na ativação do contrato também)

**E) Captura de leads (já acontece parcialmente):**
- Toda pessoa que interage → salvar em tabela `lead_whatsapp` (telefone, nome se capturado, estado, data)
- Ver se completou cadastro; se não, agendar follow-up automático (3 dias depois)
- Endpoint para listar leads no painel admin

**F) Menu de BOAS-VINDAS para novo contato (estado INICIAL):**
```
Bot: "Olá! 👋 Bem-vindo à CoopereBR!
Você já é nosso cooperado?
1 - Sim, já sou cooperado
2 - Não, quero conhecer
3 - Fui indicado por alguém"
→ Se 1: verifica telefone no banco, abre MENU_COOPERADO
→ Se 2: fluxo de simulação (foto da fatura)
→ Se 3: pede código do indicador, associa ao lead
```

**G) Fluxo "Não tenho a fatura" — ONBOARDING ASSISTIDO (estado: SEM_FATURA)**

Quando usuário escolhe opção 2 (quero ser cooperado) e não tem a fatura, o bot NÃO deve simplesmente parar. Fluxo:

```
Bot: "Sem problemas! Como prefere obter sua fatura?"
1️⃣ Já tenho, vou enviar agora
2️⃣ Verificar no meu email
3️⃣ Baixar do site da distribuidora (vou te ajudar)
```

**Se escolher 3:**
```
Bot: "Qual é sua distribuidora?"
1 - EDP Espírito Santo
2 - CEMIG
3 - COPEL
4 - LIGHT
5 - Outra
```

**Após escolher distribuidora:**
```
Bot: "Acesse: [link direto do portal da distribuidora]

Passo a passo:
1️⃣ Clique em 'Área do Cliente'
2️⃣ Faça login com CPF e senha
3️⃣ Vá em 'Faturas' → 'Histórico'
4️⃣ Baixe a última fatura em PDF
5️⃣ Envie aqui para mim 📎

💡 Dica: Aproveite e cadastre nosso email 
(faturas@cooperebr.com.br) como 2º destinatário 
para receber automaticamente no futuro!

Precisa de ajuda ao vivo? Digite *AJUDA VIVO*"
```

**Se digitar AJUDA VIVO:**
- Bot salva estado `AGUARDANDO_COPILOT`
- Envia link do OpenClaw Copilot (extensão Chrome) para o usuário abrir
- Quando o Copilot detectar o acesso ao site da distribuidora:
  - Captura automaticamente: login, número da UC, nome, endereço
  - Envia para o backend via webhook
  - Bot responde: "Ótimo! Já peguei seus dados. Agora só me manda a fatura em PDF!"
- Estes dados pré-preenchem o cadastro no sistema

**Modelo de notificação de distribuidoras a criar:**
```typescript
const DISTRIBUIDORAS = {
  'EDP-ES': { nome: 'EDP Espírito Santo', link: 'https://www.edp.com.br/espirito-santo/para-voce', passos: [...] },
  'CEMIG': { nome: 'CEMIG', link: 'https://atende.cemig.com.br', passos: [...] },
  // etc.
}
```

**Dados a salvar quando usuário acessa distribuidora:**
- Login/senha (criptografado) → para futuro acesso programático à fatura mensal
- Número da UC
- Nome completo
- Endereço de instalação
- Email da distribuidora → solicitar adicionar faturas@cooperebr.com.br como CC

**Implementar em:**
- `backend/src/whatsapp/whatsapp-bot.service.ts` — estados: SEM_FATURA, AGUARDANDO_DISTRIBUIDORA, AGUARDANDO_COPILOT, INSTRUCOES_DISTRIBUIDORA
- `backend/prisma/schema.prisma` — campo `credenciaisDistribuidora` em Cooperado (criptografado)
- `web/app/dashboard/whatsapp-config/page.tsx` — cadastro dos links/passos por distribuidora

**H) Fluxo "Cadastro por Proxy" — NOVO (cooperado cadastra um amigo por ele)**

Contexto: pessoa convidada não usa o bot mas mandou a fatura para quem a convidou. O cooperado faz o cadastro do amigo pelo WhatsApp.

**Estados novos:**
```
CADASTRO_PROXY_NOME → CADASTRO_PROXY_TELEFONE → AGUARDANDO_FATURA_PROXY
→ CONFIRMAR_PROXY → [cadastro criado + link de assinatura enviado ao convidado]
```

**Fluxo no bot:**
```
Cooperado A escolhe opção 4 → "Convidar amigo"
Bot: "Quer:"
1 - Enviar convite (amigo faz sozinho)
2 - Já tenho a fatura do meu amigo (cadastrar por ele)

Se 2:
Bot: "Qual o nome completo do seu amigo?"
→ Cooperado A: "João da Silva"
Bot: "Qual o celular do João? (com DDD, ex: 27999991234)"
→ Cooperado A: "27999991234"
Bot: "Agora envie a foto ou PDF da conta de luz do João 📎"
→ Cooperado A envia fatura
[OCR processa]
Bot: "João economizaria R$ 87/mês. Confirma o cadastro?"
1 - Sim, cadastrar João
2 - Não por enquanto

Se confirmar:
- Cria cooperado João (status PENDENTE_ASSINATURA) vinculado ao indicador A
- Gera token de assinatura (JWT com 7 dias)
- Envia WhatsApp para João:
  "Olá, João! [Nome A] te cadastrou na CoopereBR ☀️
   Sua economia estimada é de R$ 87/mês na conta de luz.
   Para confirmar sua adesão, acesse:
   [link portal/assinar/:token]
   O link é válido por 7 dias."
- Envia email para João (se tiver email na fatura)
- Notifica cooperado A: "✅ Pronto! Enviei o link para João assinar. 
  Quando ele assinar, você receberá seu benefício!"
```

**Backend — o que criar:**
- `POST /cooperados/pre-cadastro-proxy` — cria cooperado com dados mínimos (nome, telefone, UC da fatura, cooperativaId do indicador), status `PENDENTE_ASSINATURA`, cooperadoIndicadorId preenchido
- `GET /portal/assinar/:token` — página pública, valida JWT, mostra proposta, botão "Assinar contrato"
- `POST /portal/assinar/:token/confirmar` — cooperado João confirma → status vira PENDENTE → fluxo normal de ativação
- Ao João assinar → notificar cooperado A via WhatsApp

**Frontend — o que criar:**
- `web/app/portal/assinar/[token]/page.tsx` — página de assinatura simples, sem login
  - Mostra: nome, UC, economia estimada, termos
  - Botão: "Confirmar minha adesão"
  - Após confirmar: "✅ Ótimo! Nossa equipe entrará em contato para finalizar."

**O que JÁ EXISTE e pode ser reaproveitado:**
- OCR de faturas (`/faturas/processar`) ✅
- Motor de proposta ✅
- Sistema de indicações (`registrarIndicacao`) ✅
- Envio WhatsApp + email ✅

#### ARQUIVOS A MODIFICAR:
- `backend/src/whatsapp/whatsapp-bot.service.ts` — adicionar novos estados e handlers
- `backend/src/cooperados/cooperados.controller.ts` + `service.ts` — endpoint pre-cadastro-proxy
- `backend/prisma/schema.prisma` — campo `tokenAssinatura String?` e `status PENDENTE_ASSINATURA` em Cooperado
- `web/app/portal/assinar/[token]/page.tsx` — página pública de assinatura
- `web/app/dashboard/whatsapp/page.tsx` — aba "Leads" para ver quem interagiu

### Revisão telas faltando página de detalhe
Telas que ainda não têm `[id]/page.tsx`:
- `/dashboard/contratos/page.tsx` → já tem `/contratos/[id]/page.tsx` ✅
- `/dashboard/cobrancas/page.tsx` → já tem `/cobrancas/[id]/page.tsx` ✅
- `/dashboard/ocorrencias/page.tsx` → já tem `/ocorrencias/[id]/page.tsx` ✅
- `/dashboard/planos/page.tsx` → já tem `/planos/[id]/page.tsx` ✅
- `/dashboard/condominios/page.tsx` → já tem `/condominios/[id]/page.tsx` ✅
- `/dashboard/parceiros/[id]/page.tsx` → existe mas pode estar vazia (verificar)

### Fio B / GD1/GD2
Aguardando potência das 3 usinas arrendadas de Luciano para implementar.

---

## 🔵 CONTEXTO TÉCNICO IMPORTANTE

### Dados "REMOVIDO" na lista de membros
- São cooperados de teste anonimizados pelo sistema de segurança
- Não é bug — é o fix `fix(whatsapp): anonimizar cooperados de teste`
- Dados reais aparecem normalmente (Diego Mendonça, Camila Ribeiro, etc.)

### Usina Solar Sul - Cariacica com zero membros
- ID: `cmn2yvfia0000uo3wlzkzzqpt`
- Genuinamente sem contratos no banco — é usina de dados de teste sem contratos vinculados
- "COOPERE BR - Usina Linhares" tem 62 contratos (ID legado: `"usina-linhares"`)

### WhatsApp
- Serviço: `C:\Users\Luciano\cooperebr\whatsapp-service\`
- Porta: 3002
- Para iniciar: `cd whatsapp-service && node index.mjs`
- Sessão salva em `auth_info/` — reconecta automaticamente sem QR code

### Stack
- Backend: NestJS + Prisma (porta 3000)
- Frontend: Next.js (porta 3001)
- WhatsApp: Baileys/Express (porta 3002)
- Shell: PowerShell (usar `;` não `&&`)
- Agente: Claude Code (`claude --permission-mode bypassPermissions --print`)

---

## 📋 ORDEM DE PRIORIDADE PARA AS 15H

1. **Status inline nas listagens** (todas as telas) — impacto imediato de usabilidade
2. **Movimentação de membros + Lista dual concessionária** — funcionalidade de negócio crítica
3. **Bots WhatsApp** — Luciano quer testar hoje
4. **Demais melhorias** conforme energia disponível

---

## 🔴 NOVA FUNCIONALIDADE — Inteligência de mercado: leads fora da área

### Contexto
Hoje o bot processa qualquer fatura via OCR mas não verifica se a distribuidora extraída tem usinas disponíveis na CoopereBR. Se não tiver, o bot simplesmente segue o fluxo (ou falha silenciosamente).

**O que deve acontecer:**
- Fatura de EDP-ES → tem usinas → fluxo normal ✅
- Fatura da CEMIG → **não tem usinas** → fluxo diferente + salva como lead de expansão

### Fluxo para fatura fora da área de atuação

```
OCR processa fatura → extrai distribuidora: "CEMIG"
Sistema consulta: existem usinas da CoopereBR na distribuidora "CEMIG"?
  → NÃO

Bot responde:
"☀️ Que ótimo interesse! 

Ainda não temos usinas na área da CEMIG, mas estamos 
expandindo e você está na nossa lista de prioridade!

Posso te avisar assim que tivermos disponibilidade 
na sua região?
1️⃣ Sim, me avise!
2️⃣ Não, obrigado"

Se 1:
- Salva o lead com: nome (do OCR), telefone, UC, distribuidora, cidade/estado, data
- Bot: "Perfeito! Assim que tivermos usinas na sua região, 
  você será um dos primeiros a saber. 💚"
```

### Valor estratégico
- Cada lead fora da área = **demanda mapeada** para justificar arrendar nova usina
- Dashboard admin mostra: "47 leads aguardando na CEMIG/MG" → decisão de expansão baseada em dados
- Quando nova usina for ativada naquela área → notificação automática para todos os leads da fila

### O que implementar

**Backend:**
```typescript
// Novo model Prisma:
model LeadExpansao {
  id            String   @id @default(cuid())
  telefone      String
  nomeCompleto  String?
  distribuidora String   // Ex: "CEMIG", "COPEL"
  cidade        String?
  estado        String?
  numeroUC      String?
  cooperativaId String?  // parceiro que captou o lead (se aplicável)
  status        String   @default("AGUARDANDO") // AGUARDANDO | NOTIFICADO | CONVERTIDO
  createdAt     DateTime @default(now())
  notificadoEm  DateTime?
}
```

**No bot** (`whatsapp-bot.service.ts`), após OCR extrair distribuidora:
```typescript
// Verificar se há usinas disponíveis
const usinasDisponiveis = await prisma.usina.count({
  where: { distribuidora: dadosExtraidos.distribuidora, status: 'EM_PRODUCAO' }
});

if (usinasDisponiveis === 0) {
  // Salvar lead de expansão + avisar usuário
  await handleLeadForaArea(telefone, dadosExtraidos);
  return;
}
// ... fluxo normal
```

**Frontend** — nova aba no painel `/dashboard/usinas` ou `/dashboard/relatorios`:
- Tabela de leads por distribuidora/estado
- Mapa de calor: onde há mais demanda reprimida
- Botão "Notificar todos desta distribuidora" (quando nova usina for cadastrada)

**Trigger automático:**
- Quando admin cadastra nova usina com `distribuidora: "CEMIG"` → sistema busca todos os `LeadExpansao` com aquela distribuidora e status `AGUARDANDO` → dispara WhatsApp para cada um:
  > *"🎉 Boas notícias! Chegamos na sua área! Temos vagas disponíveis na CEMIG. Quer garantir a sua? [link simulação]*"

### Arquivos a modificar
- `backend/prisma/schema.prisma` — adicionar model `LeadExpansao` com campos: telefone, nomeCompleto, distribuidora, cidade, estado, numeroUC, valorFatura, economiaEstimada, intencaoConfirmada (boolean), cooperativaId, status, createdAt
- `backend/src/whatsapp/whatsapp-bot.service.ts` — verificação pós-OCR + handler fora da área + FAZER SIMULAÇÃO MESMO SEM USINA (usar motor de proposta com tarifas genéricas) + capturar intenção (1=sim / 2=não)
- `backend/src/usinas/usinas.service.ts` — trigger ao cadastrar usina nova → notificar leads com intencaoConfirmada=true daquela distribuidora
- `web/app/dashboard/usinas/page.tsx` — aba "Leads de Expansão" com: tabela por distribuidora, economia total latente, botão "Notificar todos"
- `web/app/dashboard/relatorios/` — nova página "Potencial de Expansão" — relatório para investidores

### Relatório para investidores (gerar PDF/tela)
```
Distribuidora | Leads | Intenção Confirmada | Economia/mês | Receita Anual Latente
CEMIG/MG      |   89  |        67           |  R$ 87/mês   |    R$ 69.948/ano
COPEL/PR      |   34  |        28           |  R$ 91/mês   |    R$ 30.576/ano
LIGHT/RJ      |   21  |        15           |  R$ 79/mês   |    R$ 14.220/ano
```
Mensagem automática: "Para atender CEMIG/MG precisamos de 1 usina de ~400 kWp."

---

## 🔴 NOVA FUNCIONALIDADE — Espelhamento de conversas por parceiro (tenant isolation)

### Contexto
Hoje o Modo Observador (`/dashboard/observador`) é global — o SUPER_ADMIN vê todas as conversas. O ADMIN de um parceiro não consegue ver as conversas dos seus próprios membros.

### O que implementar

**Backend** — filtro por tenant já está no padrão do sistema, só aplicar:
```typescript
// ConversasController — GET /conversas
// ADMIN → where: { cooperativaId: req.user.cooperativaId }
// SUPER_ADMIN → sem filtro (vê tudo)
```

**Frontend** — nova aba em `/dashboard/whatsapp` chamada "Conversas":
- Lista de conversas com: foto, nome do membro, último status, data
- Ao clicar: abre histórico completo da conversa (entrada + saída)
- Filtros: por status (INICIAL, MENU_COOPERADO, CONCLUIDO, etc.), por data
- Badge de novas mensagens não lidas

**O que já existe:**
- `conversaWhatsapp` — model com estado, cooperativaId, cooperadoId ✅
- `mensagemWhatsapp` — histórico de mensagens enviadas/recebidas ✅
- `/dashboard/observador` — UI base para adaptar ✅

**Arquivos a modificar:**
- `backend/src/whatsapp/whatsapp-fatura.controller.ts` — endpoint GET /whatsapp/conversas com filtro tenant
- `web/app/dashboard/whatsapp/page.tsx` — nova aba "Conversas dos Membros"

---

## Ordem de prioridade atualizada para 15h

1. **Status inline nas listagens** — impacto imediato de usabilidade
2. **Movimentação de membros + Lista dual concessionária** — funcionalidade crítica
3. **Leads fora da área + simulação mesmo sem usina + captura de intenção** — inteligência de mercado + argumento para investidores
4. **Cadastro por proxy** — menor fricção para indicações
5. **Espelhamento de conversas por parceiro** — transparência para ADMINs
6. **Menu do cooperado expandido** (atualizar cadastro/contrato/indicar)

---
*Documento gerado por Assis — 29/03/2026 12:55 | Atualizado 14:05*
