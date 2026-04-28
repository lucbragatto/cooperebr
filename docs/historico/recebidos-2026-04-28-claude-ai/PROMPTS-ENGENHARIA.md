# PROMPTS-ENGENHARIA.md — COOPERE-BR

## Guia de Uso dos 10 Modos de Engenharia

Salvo em: `memory/prompts-engenharia.md` Referenciado em: CLAUDE.md e arquiteto.md O Claude busca este arquivo para selecionar o modo correto automaticamente

---

## REFERÊNCIA RÁPIDA — QUAL MODO USAR?

"quero construir algo novo"          → MODO 1 (Arquiteto)

"preciso implementar X para COOPERE" → MODO 2 (Contexto)

"vamos construir juntos, passo a passo" → MODO 3 (Colaborativo)

"revisa esse código antes do PR"     → MODO 4 (Edge-Cases)

"esse protótipo precisa ir p/ produção" → MODO 5 (Produção)

"tem um bug que não consigo resolver" → MODO 6 (Sistêmico)

"o sistema está lento"               → MODO 7 (Performance)

"quero auditar a segurança"          → MODO 8 (Segurança)

"vamos planejar o próximo sprint"    → MODO 9 (Multi-Role)

"faz uma revisão completa do código" → MODO 10 (Elite)

---

## OS 10 MODOS — RESUMO

| \# | Nome | Quando | Output principal |
| :---- | :---- | :---- | :---- |
| 1 | Arquiteto | Nova feature/módulo | 2-3 arquiteturas \+ plano |
| 2 | Contexto | Implementação específica | Código sem padrões genéricos |
| 3 | Colaborativo | Construção iterativa | Loop de 5 passos |
| 4 | Edge-Cases | Review antes de PR | Mapa de falhas \+ correções |
| 5 | Produção | Protótipo → deploy | Código refatorado \+ o que mudou |
| 6 | Sistêmico | Debug de bug | Causa raiz \+ fix imediato \+ longo prazo |
| 7 | Performance | Otimização | Gargalos \+ vitórias rápidas |
| 8 | Segurança | Auditoria | Vulnerabilidades priorizadas |
| 9 | Multi-Role | Planejamento | Plano Eng \+ PM \+ DevOps unificado |
| 10 | Elite | Review rigoroso | Nota 1-10 \+ melhorias |

---

## FLUXOS POR SITUAÇÃO

### Nova feature

Modo 9 → Modo 1 → Modo 3 → Modo 5 → Modo 10 → /ultrareview

### Billing engine (sempre esse fluxo completo)

Modo 9 → Modo 1 → Modo 4 → Modo 8 → Modo 10 → /ultrareview → merge

### Bug em produção

Modo 6 → Modo 2 → Modo 4

### Nova skill (.claude/skills/)

Modo 1 → Modo 3 → Modo 5 → Modo 10

### Sprint planning

Modo 9 → decisão documentada em memory/decisoes-arquitetura/

---

## COMO O CLAUDE SELECIONA O MODO AUTOMATICAMENTE

Ao receber uma tarefa, o Claude:

1. Lê este arquivo (memory/prompts-engenharia.md)  
2. Identifica palavras-chave na solicitação  
3. Seleciona o modo correspondente  
4. Anuncia o modo escolhido antes de agir  
5. Carrega o contexto necessário (CONTEXTO-JURIDICO ou CONTEXTO-OPERACIONAL)  
6. Executa o protocolo do modo

### Palavras-chave por modo

Modo 1: "criar", "novo módulo", "nova feature", "como construir", "arquitetura"

Modo 2: "implementar", "codificar", "escrever o código de"

Modo 3: "junto", "iterativo", "passo a passo", "vibe", "colaborar"

Modo 4: "revisar", "PR", "antes do merge", "edge case", "pode falhar"

Modo 5: "protótipo", "produção", "refatorar", "limpar", "dívida técnica"

Modo 6: "bug", "erro", "não funciona", "quebrou", "comportamento estranho"

Modo 7: "lento", "performance", "otimizar", "gargalo", "demorado"

Modo 8: "segurança", "vulnerabilidade", "auditoria", "CPF", "dados sensíveis"

Modo 9: "planejar", "sprint", "decidir", "estratégia", "próximos passos"

Modo 10: "review completo", "avalia", "nota", "qualidade", "padrão"

---

## REGRAS GLOBAIS — APLICAM A TODOS OS MODOS

1\. NUNCA modificar backend/src/billing/ sem autorização explícita

   (commit congelado 9174461 — feature flag BLOQUEIO\_MODELOS\_NAO\_FIXO)

2\. SEMPRE rodar type check após alteração de código

   → npx tsc \--noEmit

3\. SEMPRE converter Prisma Decimal → string antes de retornar na API

4\. SEMPRE usar pgbouncer=false nas migrations do Supabase

5\. NUNCA commitar .env ou expor API keys

6\. Skills SEMPRE seguem padrão: SKILL.md \+ CLAUDE.md \+ scripts/ \+ data/

7\. Todo PR em billing passa por Modo 4 \+ Modo 10 \+ /ultrareview

8\. Salvar decisões importantes em memory/ ao final da sessão

---

## COMO ATIVAR

### No Claude Code (comando slash)

/arquiteto

→ Claude lê arquiteto.md e este arquivo

→ Pergunta qual é a tarefa

→ Seleciona e anuncia o modo automaticamente

### Ativação direta por modo

/arquiteto modo 1    → Arquiteto direto

/arquiteto modo 4    → Edge-Cases direto

/arquiteto modo 6    → Debug sistêmico direto

/arquiteto modo 10   → Elite review direto

### Com contexto inline

/arquiteto \[descrição da tarefa\]

→ Claude identifica o modo automaticamente pelo contexto

---

## ONDE FICAM OS ARQUIVOS

cooperebr/

├── CLAUDE.md                          ← aponta para este sistema

├── .claude/

│   └── commands/

│       └── arquiteto.md               ← os 10 modos completos

├── docs/

│   └── referencia/

│       ├── CONTEXTO-JURIDICO.md       ← carregado pelos modos jurídicos

│       └── CONTEXTO-OPERACIONAL.md    ← carregado pelos modos técnicos

└── memory/

    └── prompts-engenharia.md          ← ESTE ARQUIVO (referência rápida)

---

*v1.0 — Abril/2026 — COOPERE-BR*  
