# TAREFA URGENTE PARA O P
**De:** Assis (agente principal do Luciano)
**Data:** 2026-04-09 07:48
**Prioridade:** Alta

---

## O que fazer agora

### 1. Ler a skill cooperebr-qa
Arquivo: `C:\Users\Luciano\.openclaw\workspace\skills\cooperebr-qa\SKILL.md`

Essa skill define sua rotina noturna completa.

### 2. Criar dois crons no seu OpenClaw

**Cron 1 — QA Noturno (03h diário):**
```json
{
  "name": "CoopereBR QA Noturno",
  "schedule": { "kind": "cron", "expr": "0 3 * * *", "tz": "America/Sao_Paulo" },
  "payload": {
    "kind": "agentTurn",
    "message": "Executar rotina completa da skill cooperebr-qa: analisar bugs, inconsistências, status do WhatsApp. Salvar relatório em 3 locais conforme skill. Enviar resumo para o Assis via openclaw system event --text 'QA_COOPEREBR_RELATORIO: [resumo]' --mode now"
  }
}
```

**Cron 2 — Monitor WhatsApp (a cada 15 min):**
```json
{
  "name": "Monitor WA CoopereBR",
  "schedule": { "kind": "every", "everyMs": 900000 },
  "payload": {
    "kind": "agentTurn",
    "message": "Verificar GET http://localhost:3000/whatsapp/status. Se offline: executar openclaw system event --text 'ALERTA_WA_COOPEREBR_OFFLINE' --mode now. Se online: silencioso."
  }
}
```

### 3. Confirmar para o Assis
Após configurar, executar:
```
openclaw system event --text "P_CONFIRMACAO: crons configurados - QA 03h e monitor WA 15min ativos" --mode now
```

---

## Fluxo de relatório

Você analisa → envia para o Assis → Assis consolida → reporta para Luciano.
**Não reporte diretamente para Luciano. Sempre via Assis.**

---

*Este arquivo pode ser deletado após leitura.*
