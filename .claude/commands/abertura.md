---
description: Executa o ritual canônico de abertura de sessão (lê estado consolidado e apresenta "Onde paramos + Pendências" antes de iniciar trabalho)
---

# Ritual de Abertura de Sessão — execução automática

Executar o ritual canônico de abertura documentado em
`~/.claude/projects/C--Users-Luciano-cooperebr/memory/ritual_abertura_fechamento.md`
+ `regra_validacao_previa_e_retomada.md` (Decisões 14, 15, 20).

## Checklist obrigatório (executar nesta ordem, antes de QUALQUER outra coisa)

### 1. Verificações operacionais

- `git status --short` — esperado working tree limpo, último commit é o de fechamento da sessão anterior. Se houver arquivos modificados não-meus → PAUSAR + Decisão 23.
- `git log --oneline -10` — confirmar último commit da sessão anterior.
- `pm2 list` — confirmar backend online (pid pode ter mudado, é OK).
- Verificar se subagent `cooperebr-qa-funcional` aparece na lista de agents disponíveis. Se não aparecer, parar e avisar.

### 2. Leitura OBRIGATÓRIA na ordem (Decisão 15 — validação prévia antes de retomada)

1. **`docs/CONTROLE-EXECUCAO.md`** — começar pela seção `## ONDE PARAMOS` no topo + `### Última sessão` + `## FRASE DE RETOMADA — próxima sessão Code`. ESSE arquivo tem instruções da sessão anterior pra mim aqui.
2. **`docs/sessoes/<arquivo-da-última-sessão>.md`** — referenciado em "Última sessão". Lê contexto completo do que foi entregue.
3. **`~/.claude/projects/C--Users-Luciano-cooperebr/memory/MEMORY.md`** — memórias ativas (regras inegociáveis, decisões processuais, débitos catalogados, padrões técnicos).

### 3. Cruzamento de validação (Decisão 14)

- `docs/CONTROLE-EXECUCAO.md` vs `git log -10` — bater commits da última sessão com os reportados no controle.
- `docs/PLANO-ATE-PRODUCAO.md` — confirmar se há sprints/marcos relevantes pendentes pra contexto.
- `docs/debitos-tecnicos.md` — confirmar débitos abertos.

Se houver divergência (commit no log que NÃO está no controle, ou vice-versa) → reportar como discrepância na saída.

### 4. Apresentar "Onde paramos + Pendências" pro Luciano (formato fixo)

```
═══════════════════════════════════════════════════════════════════
ONDE PARAMOS (<data da última sessão>)
═══════════════════════════════════════════════════════════════════

Última sessão: <tipo + data>
Resultado: <1-3 linhas do bullet "Resultado" da seção Última sessão>

Commits da última sessão (<N>):
  <hash> <título>
  ...

Estado atual do sistema:
  - <% prontidão produção / próximo marco esperado>

Pendências carry-over (<N>):
  □ <pendência 1 — prioridade>
  □ <pendência 2 — prioridade>
  ...

Diretrizes inegociáveis ativas:
  - <lista curta — só as relevantes pra próxima ação>

Discrepâncias detectadas: <0 ou lista>

═══════════════════════════════════════════════════════════════════
PERGUNTA DIRETA
═══════════════════════════════════════════════════════════════════

A frase de retomada COMANDANTE no CONTROLE-EXECUCAO sugere:
<resumo do PASSO 1+2 da frase canônica>

Você quer:
A. Seguir o que a frase comandante propõe
B. <opção alternativa óbvia da lista de pendências>
C. <opção alternativa óbvia>
D. Outro (você diz)

Sem instrução: NÃO proponho solução nem mexo em arquivos.
═══════════════════════════════════════════════════════════════════
```

### 5. Aguardar instrução — REGRA INEGOCIÁVEL

**Eu NÃO escolho próxima pendência sozinho** sem confirmação explícita.

**Exceção única:** quando Luciano disser literalmente "tu decide" ou "ataca o que for mais urgente" ou similar, aí sim escolho — sempre respeitando ordem P0 → P1 → P2 → P3 da Decisão 19.

**Pendências DEVEM ser apresentadas em ordem de prioridade:**
- **P0** crítico (bloqueia produção ou cliente)
- **P1** importante (débito que precisa resolver antes de produção)
- **P2** débito (resolver quando der)
- **P3** polish (melhora qualidade mas não bloqueia)
- **Estratégica/Processual** em categoria separada

### 6. Não escolher trabalho sozinho — Anti-pattern catalogado

Caso real registrado (01/05 tarde): Code escolheu pendência P2 (hardcode 0.20 sem origem) ignorando P1 (D-30M MLM cascata quebrado). Roteiro existe pra evitar essa armadilha.

## Por quê o ritual de abertura é INEGOCIÁVEL

Sem ritual de abertura:
- Contexto perdido entre dia X e dia Y
- Esquecimento de pendências (ex: D-30M ficou aberto 4 dias)
- Retrabalho ("já tínhamos decidido isso")
- Frustração ao retomar ("onde estávamos mesmo?")

Com ritual:
- Luciano abre VS Code, vê estado em <30s
- Decisão sobre próximo passo é consciente, não reativa
- Pendências têm visibilidade contínua
