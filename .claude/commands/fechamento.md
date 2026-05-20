---
description: Executa o ritual canônico de fechamento de sessão (doc-sessão + CONTROLE-EXECUCAO + commit + push)
---

# Ritual de Fechamento de Sessão — execução automática

Executar o ritual canônico de fechamento documentado em
`~/.claude/projects/C--Users-Luciano-cooperebr/memory/ritual_abertura_fechamento.md`
e na regra inegociável bilateral `regra_fechamento_sessao_inegociavel.md`.

## Checklist obrigatório (executar nesta ordem, todas as etapas)

### 1. Verificações de estado

- Rodar `git status --short` (diretriz inegociável 18/05). Se houver arquivos modificados não-meus desta sessão → PAUSAR + Decisão 23.
- Rodar `git log --oneline -10` pra confirmar commits da sessão.
- Identificar commits da sessão (do ponto que comecei até agora — usar `git log origin/main..HEAD --oneline` se tiver dúvida).

### 2. Doc-sessão consolidada

Criar `docs/sessoes/YYYY-MM-DD-<tema-curto>.md` com:
- Resumo executivo (3-5 linhas)
- Contexto de entrada (o que veio de antes)
- Entregas detalhadas (cada commit + o que fez)
- Validação (specs, builds, smoke)
- Decisões / Regras / Memórias afetadas
- Pendências carry-over pra próxima sessão
- Commits da sessão (tabela cronológica)
- Arquivos tocados (cumulativo)

Nome do arquivo: `YYYY-MM-DD-<periodo>-<tema-curto-em-kebab>.md` (ex: `2026-05-19-noite-d-novo-r-fix-motor.md`).

### 3. Atualizar `docs/CONTROLE-EXECUCAO.md`

- **Header (linha 4):** atualizar "Última atualização" com data + 1 frase do achado central da sessão.
- **Bloco "## ONDE PARAMOS — <data>":** INSERIR novo bloco no topo (acima do anterior). Não acumular cronologicamente — bloco anterior vira "ONDE PARAMOS — <data anterior>" abaixo.
- **Seção "### Última sessão":** mover conteúdo atual pra "### Sessão anterior" abaixo e preencher "Última sessão" com info desta sessão (Quando + Tipo + Resultado bullets + Commits + Próximo + Detalhe).
- **Seção "## FRASE DE RETOMADA — próxima sessão Code":** SUBSTITUIR completamente o conteúdo (Decisão 24 — local único). Frase COMANDANTE, não descritiva (`feedback_frase_retomada_direta.md`):
  - PASSO 0 — verificações operacionais (git status, pm2 list, subagent disponível)
  - PASSO 1 — instrução de leitura obrigatória (CONTROLE-EXECUCAO + doc-sessão de hoje + MEMORY.md)
  - PASSO 2+ — próxima ação concreta + estimativa
  - CARRY-OVERS catalogados
  - DIRETRIZES INEGOCIÁVEIS ATIVAS (lista curta)
- **Decisão 24 — grep amplo OBRIGATÓRIO antes de salvar:**
  ```
  grep -in "voltei\|frase de retomada\|como retomar" docs/CONTROLE-EXECUCAO.md
  ```
  Se aparecer mais de 1 frase divergente, consolidar pra 1 só + ponteiros nos outros.

### 4. Atualizar `docs/debitos-tecnicos.md` se houve débito novo

- Catalogar débitos novos detectados na sessão.
- Marcar débitos resolvidos como ✅ RESOLVIDO com referência ao commit.
- **Decisão 14 (reforçada 19/05 noite):** ANTES de catalogar débito novo com código D-novo-X ou D-WA-X, rodar:
  ```
  grep -rn "D-novo-X\|D-WA-X" docs/ ~/.claude/projects/C--Users-Luciano-cooperebr/memory/
  ```
  com X = letra alvo, pra confirmar que não está reservado.

### 5. Atualizar memória persistente se aplicável

`~/.claude/projects/C--Users-Luciano-cooperebr/memory/` — adicionar memórias novas (decisões processuais, regras inegociáveis, padrões técnicos, lições) detectadas na sessão.

### 6. Commit consolidado

Mensagem padrão:
```
docs(sessao+debitos+controle): fechamento <data> + <tema central>

<descrição: o que entregou na sessão, lições, próximo passo>
```

Staging: incluir doc-sessão + CONTROLE-EXECUCAO + debitos-tecnicos (se mudou) + memórias novas (se criadas).

### 7. Push pra origin/main

`git push origin main` — autorizado por default em fechamento (Luciano espera estar no remoto pra próxima sessão poder retomar).

### 8. Reportar saída pro Luciano (formato fixo)

```
═══════════════════════════════════════════════════════════════════
✅ SESSÃO <data> — FECHADA
═══════════════════════════════════════════════════════════════════

Commits da sessão (<N>):
  <hash> <título>
  ...

Pendências resolvidas hoje (<N>):
  ✓ <item>

Pendências restantes (<N>):
  □ <item>

Push: <hash..hash> origin/main  ✓

═══════════════════════════════════════════════════════════════════
PRÓXIMA SESSÃO
═══════════════════════════════════════════════════════════════════

Cola "/abertura" no Code quando voltar. Ritual de abertura roda automático.

OU se preferir colar manualmente:

> <frase comandante curta resumindo passo 1 da FRASE DE RETOMADA>

Bom descanso.
═══════════════════════════════════════════════════════════════════
```

## Quando NÃO executar (regra do ritual_abertura_fechamento.md)

- "Fatia X concluída" se Luciano ainda tem energia/janela pra próxima
- "Sprint Y terminou" como evento planejado da pilha
- Tarefas triviais (typo, lint) sem alterar estado de produto
- Quando Luciano explicitamente disser "pula o ritual"

Só executar quando NÃO for possível técnica ou fisicamente continuar (fim do dia, "boa noite", computador desligando, tarefa terminada sem próxima ação imediata).
