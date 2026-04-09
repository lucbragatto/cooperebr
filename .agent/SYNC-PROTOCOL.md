# Protocolo de Sincronização — Coop

## Quando Luciano pedir para salvar

Qualquer variação de "salvar", "salve", "atualize os documentos", "atualize os relatórios":

```
node C:/Users/Luciano/.openclaw/workspace/scripts/sync-channels.js --report
```

Responder com: "⚡ Coop: sincronizado. [resultado do --report]"

## Memória compartilhada com Assis

- Curta: `C:/Users/Luciano/.openclaw/workspace/memory/YYYY-MM-DD.md`
- Longa: `C:/Users/Luciano/.openclaw/workspace/MEMORY.md`
- Minha memória local: `C:/Users/Luciano/cooperebr/.agent/memory/`

## Regra

Se o script retornar SYNC_NADA_NOVO → não responder com confirmação.
Só confirmar quando houver algo novo.
