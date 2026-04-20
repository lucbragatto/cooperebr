## 2026-04-20 — QA nightly do Assis descontinuado

A rotina de QA automática do agente Assis (Openclaw) foi
desativada. Motivação: o Assis começou auxiliando no
desenvolvimento, depois ficou restrito ao QA diário, custo
desproporcional ao valor entregue agora que o desenvolvimento
é feito via Claude.ai diretamente.

Impacto:
- Raiz do repo não recebe mais RELATORIO-QA-*.md nem QA-HISTORICO.md
- docs/qa/ vira acervo histórico encerrado (46 MDs preservados)
- Skill ~/.openclaw/workspace/skills/cooperebr-qa renomeada
  para cooperebr-qa.disabled (reativável se necessário)
- Job "CoopereBR QA Noturno" desativado em ~/.openclaw/cron/jobs.json
  (enabled: false)
- Rotina em MEMORY.md marcada como DESATIVADO
- Trigger externo ao sistema operacional: reside em
  ~/.openclaw/cron/jobs.json (Openclaw cron engine)

Último relatório gerado: RELATORIO-QA-2026-04-20.md (score 8.7/10).
Bugs detectados no último ciclo (BUG-20-001, BUG-20-002) registrados
em docs/qa/QA-HISTORICO.md antes da desativação.
