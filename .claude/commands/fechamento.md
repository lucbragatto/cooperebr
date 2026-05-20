---
description: Atalho — invoca a skill canônica fechamento-sessao (template inegociável de fechamento)
---

# Atalho: invocar skill `fechamento-sessao`

Esta é a skill canônica que governa fechamento de sessão Code/claude.ai no projeto.

**Definição completa:** `.claude/skills/fechamento-sessao/SKILL.md`

Quando o usuário invocar este slash command, **invocar imediatamente a skill `fechamento-sessao`** via Skill tool. Não duplicar conteúdo aqui — a skill é a fonte única de verdade.

A skill cobre:
- Pré-validações Decisão 23 (working tree limpo, último commit esperado, todos pushed, marco identificado)
- 5 etapas obrigatórias em ordem fixa:
  1. Doc-sessão `docs/sessoes/YYYY-MM-DD-<escopo>.md`
  2. Atualizar `docs/CONTROLE-EXECUCAO.md` (ONDE PARAMOS + FRASE DE RETOMADA — Decisão 24 local único)
  3. Estruturar frase de retomada (PASSO 0 + PASSO 1 — padrão 18/05)
  4. Commit + push origin/main
  5. Apresentar frase no terminal (diretriz inegociável 18/05)
- Reporte final padronizado
- Anti-patterns explícitos

**Quando ESTE atalho dispara:**
- Usuário digita `/fechamento` no terminal Code
- (Sem atalho) usuário diz "fecha a sessão" / "boa noite" / "vou descansar" — eu invoco a skill automaticamente via `when_to_use` da própria skill (não precisa atalho)

**Por que mantém este arquivo curto:** Decisão 14 — fonte única de verdade. Conteúdo duplicado é vetor de divergência. A skill é versionada e atualizada com a regra real; este atalho só aponta.
