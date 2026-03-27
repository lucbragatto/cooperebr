# Proposta Técnica: Modo Observador (Shadow Mode)
**CoopereBR — Módulo de Monitoramento em Tempo Real**
**Data:** 26/03/2026 | **Autor:** Assis

---

## 1. Visão Geral

O Modo Observador permite que usuários com permissão (Super Admin, Admin, Parceiro) **ativem o espelhamento de conversas e ações em tempo real** de outros usuários do sistema — sejam cooperados, leads, operadores ou parceiros — recebendo cópias das mensagens WhatsApp enviadas/recebidas e notificações de ações realizadas na plataforma.

### Casos de uso principais

| Cenário | Quem observa | Quem é observado | Para quê |
|--------|-------------|-----------------|----------|
| Lead acessou link de convite e está no WhatsApp | Admin ou indicador | Lead/Convidado | Intervir se travado |
| Operador cadastrando novo membro | Admin | Operador | Garantir qualidade |
| Parceiro adicionando novo condômino | Admin | Parceiro | Treinamento/auditoria |
| Cooperado com cobrança vencida sendo abordado pelo bot | Admin | Cooperado inadimplente | Intervir com proposta |
| Super Admin monitorando múltiplos admins | Super Admin | Todos os admins | Visão global |

---

## 2. Arquitetura Proposta

### 2.1 Modelo de dados (Prisma)

```prisma
model ObservacaoAtiva {
  id              String   @id @default(uuid())
  observadorId    String   // quem está observando
  observadoId     String?  // cooperado/usuário sendo observado (null = todos)
  observadoTelefone String? // número WhatsApp sendo monitorado
  observadorTelefone String // para onde espelhar
  ativo           Boolean  @default(true)
  escopo          EscopoObservacao
  criadoEm        DateTime @default(now())
  expiresAt       DateTime? // expiração automática (ex: 24h)
  cooperativaId   String
  
  observador  Usuario    @relation(...)
  cooperativa Cooperativa @relation(...)
}

enum EscopoObservacao {
  WHATSAPP_ENVIADO     // mensagens saindo do sistema para o observado
  WHATSAPP_RECEBIDO    // mensagens do observado para o sistema
  WHATSAPP_TOTAL       // ambos
  ACOES_PLATAFORMA     // ações do operador/parceiro na plataforma
  TUDO                 // WhatsApp + ações
}
```

### 2.2 Fluxo de ativação

```
Admin acessa /dashboard/observador
→ Seleciona usuário/telefone a monitorar
→ Define escopo (WhatsApp / Ações / Tudo)
→ Define expiração (1h, 4h, 24h, permanente)
→ Define destino (próprio WhatsApp ou de outro admin)
→ Ativa → sistema começa espelhar imediatamente
```

### 2.3 Integração no código

O `WhatsappSenderService.enviarMensagem()` e o handler de mensagens recebidas verificam, a cada disparo, se existe uma `ObservacaoAtiva` para aquele telefone/usuário e reencaminham a cópia.

Exemplo de espelho recebido pelo observador:
```
📋 [OBSERVADOR] Mensagem RECEBIDA de 27999222333 (João Oliveira)
─────────────────────────────
"Quero saber sobre meu saldo de créditos"
─────────────────────────────
🕐 15:42 | Bot respondeu automaticamente
```

```
📋 [OBSERVADOR] Mensagem ENVIADA → 27999222333 (João Oliveira)
─────────────────────────────
"Seu saldo atual é de 450 kWh (R$ 310,50).
Vencimento da próxima fatura: 05/04/2026"
─────────────────────────────
🕐 15:42
```

---

## 3. Funcionalidades por perfil

### Super Admin
- Pode observar qualquer usuário de qualquer cooperativa
- Pode ativar/desativar observação de outros admins
- Painel global: lista todas as observações ativas no sistema
- Sem limite de observações simultâneas

### Admin da Cooperativa
- Pode observar cooperados, operadores e parceiros da sua cooperativa
- Pode ativar observação de leads (números sem cadastro)
- Máximo de 10 observações simultâneas (configurável)
- Log de todas as observações ativas/encerradas

### Parceiro
- Pode observar apenas seus próprios condôminos/indicados
- Não vê cooperados de outros parceiros
- Máximo de 3 observações simultâneas

### Operador
- Sem acesso ao Modo Observador

---

## 4. Recursos avançados

### 4.1 Intervenção no chat
Além de observar, o Admin pode **injetar uma mensagem** na conversa do bot com um cooperado:
- "Assumir conversa" temporariamente (desativa o bot por N minutos)
- "Inserir mensagem como sistema" (sem desativar o bot)

### 4.2 Alertas inteligentes
Configurar alertas automáticos para ativar observação sem precisar ligar manualmente:
- "Avise-me quando o lead X abrir o link de convite"
- "Ative observação quando cooperado inadimplente responder o bot"
- "Notifique quando operador criar novo membro com dados incompletos"

### 4.3 Modo auditoria (sem espelho em tempo real)
Para fins de conformidade: gravar todas as interações de um período sem enviar espelhos em tempo real — acessar depois pelo painel como replay.

### 4.4 Expiração automática
Toda observação tem expiração configurável (padrão: 4h). Ao expirar:
- Observador recebe mensagem: "⏰ Observação de João Oliveira encerrada (4h)"
- Pode renovar com um toque

---

## 5. Interface (telas propostas)

### `/dashboard/observador` — Painel do Observador
- Lista de observações ativas com status (online/offline/digitando)
- Botão "Observar usuário" com busca por nome/CPF/telefone
- Botão "Intervir" para assumir conversa
- Histórico das últimas 24h

### `/dashboard/observador/[id]` — Detalhes da observação
- Timeline de mensagens em tempo real (estilo chat)
- Ações realizadas pelo usuário na plataforma (cadastro, uploads, etc.)
- Botão "Encerrar observação"

### Modal de ativação rápida
- Acessível de qualquer tela via ícone de câmera ao lado do nome do usuário
- Ativa observação em 1 clique (destino padrão = WhatsApp do admin logado)

---

## 6. Segurança e privacidade

- Toda observação ativada é **registrada em log imutável** com: quem ativou, quando, quem observou, motivo (opcional)
- Cooperado pode ser notificado de que está sendo monitorado (configurável por cooperativa — recomendado para conformidade LGPD)
- Super Admin pode auditar quem ativou observações e por quanto tempo
- Dados de observação nunca são enviados para fora da cooperativa (isolamento de tenant)

---

## 7. Cronograma estimado de implementação

| Fase | Escopo | Estimativa |
|------|--------|-----------|
| Fase A | Schema + API básica (CRUD ObservacaoAtiva) + espelho WhatsApp | 1 dia |
| Fase B | Painel frontend + ativação por perfil + expiração automática | 1-2 dias |
| Fase C | Intervir no chat + alertas inteligentes + modal rápido | 2-3 dias |
| Fase D | Modo auditoria + replay + log imutável + LGPD | 2-3 dias |

**Total estimado:** 6-9 dias de desenvolvimento

---

## 8. Conclusão

É totalmente viável, muito útil e alinha com o que o mercado de cooperativas precisa: **visibilidade em tempo real do ciclo de adesão**. A maior parte da infraestrutura (WhatsappSender, perfis de acesso, isolamento de tenant) já existe — a implementação é incremental.

**Recomendação:** Implementar Fase A + B como prioridade após estabilização atual do sistema. Fases C e D podem aguardar validação com usuários reais.

---
*Documento gerado por Assis — aguardando aprovação para execução*
