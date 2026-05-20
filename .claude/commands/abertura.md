---
description: Atalho — invoca a skill canônica retomada-sessao (template inegociável de retomada/abertura)
---

# Atalho: invocar skill `retomada-sessao`

Esta é a skill canônica que governa abertura de sessão Code no projeto.

**Definição completa:** `.claude/skills/retomada-sessao/SKILL.md`

Quando o usuário invocar este slash command, **invocar imediatamente a skill `retomada-sessao`** via Skill tool. Não duplicar conteúdo aqui — a skill é a fonte única de verdade.

A skill cobre:
- PASSO 0 — verificações operacionais obrigatórias:
  - Verificação 1: nova conversa Code (subagent `cooperebr-qa-funcional` indexado?)
  - Verificação 2: working tree limpo + commits pushed
  - Verificação 3: PM2 e serviços de pé
- 4 etapas após PASSO 0:
  1. Leitura prévia obrigatória (9 docs em ordem fixa — Decisão 23)
  2. Apresentar estado consolidado padronizado pro Luciano
  3. Propor escopo do próximo bloco (Fase 1 read-only — feedback 17/05)
  4. Pausar aguardando OK Luciano (Decisão 23 — não tocar código antes de OK)
- Reporte final padronizado
- Anti-patterns explícitos

**Quando ESTE atalho dispara:**
- Usuário digita `/abertura` no terminal Code ao começar nova sessão
- (Sem atalho) usuário cola frase de retomada com PASSO 0 + PASSO 1 — eu invoco a skill automaticamente via `when_to_use` da própria skill (não precisa atalho)

**Por que mantém este arquivo curto:** Decisão 14 — fonte única de verdade. Conteúdo duplicado é vetor de divergência. A skill é versionada e atualizada com a regra real; este atalho só aponta.
