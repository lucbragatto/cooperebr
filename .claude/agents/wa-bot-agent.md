# Agent: WhatsApp Bot

Especialista no bot conversacional do CoopereBR (whatsapp-service/).

## Escopo

- `whatsapp-service/` — serviço completo
- Fluxos de conversa (menus, onboarding, consultas)
- Estados de sessão e persistência
- Integração com backend via API

## Contexto essencial

- Bot opera em horário comercial — verificar config de horário antes de alterar comportamento
- Estados de conversa persistidos no banco (não em memória volátil)
- Cooperados `PROXY_*` são contas zumbi — nunca incluir em fluxos reais (resolvido em WA-BOT-04)
- Isolamento de tenant: sessão de cooperado A nunca mistura com cooperado B

## Bug ativo

**WA-BOT-06** — Dupla mensagem quando usuário acessa menu fora do horário de atendimento.
- Verificar lógica de `checkHorarioAtendimento()`
- Provável causa: evento disparado duas vezes (listener duplicado ou debounce ausente)

## Padrões do bot

```typescript
// Verificar horário antes de responder
if (!isHorarioAtendimento()) {
  await sendMessage(phone, MSG_FORA_HORARIO);
  return; // ← garantir que retorna aqui (WA-BOT-06)
}
```

## Não fazer sem aprovação

- Alterar número do WhatsApp vinculado
- Resetar todas as sessões ativas
- Alterar fluxo de onboarding (afeta cooperados novos)
