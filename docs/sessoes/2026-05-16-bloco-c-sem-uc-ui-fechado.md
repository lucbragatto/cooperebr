# Sessão 2026-05-16 — Bloco C (Cadastro SEM_UC UI)

## TL;DR

Marco M6. SEM_UC tornado acessível pela UI (admin + público) sem refactor do wizard de 7 steps. Criadas 2 páginas dedicadas (`/dashboard/cooperados/novo-sem-uc` + `/cadastro/sem-uc`) + 1 endpoint público (`POST /publico/cadastro-sem-uc`) + badge SEM_UC na listagem + banner de redirect em ambos os wizards. Smoke E2E 6/6 PASS (admin via `POST /cooperados` + público via `POST /publico/cadastro-sem-uc`).

## Decisão arquitetural

Wizard `/dashboard/cooperados/novo` é stepper de 7 steps acoplados a Fatura/UC. Refactor profundo (4-6h) com branching condicional foi descartado em favor de **abordagem minimalista** (~2h efetivas): página dedicada SEM_UC + link de redirect no wizard atual. Mantém wizard intacto, separa fluxos por intenção do admin.

## Entregas

| Sub | Descrição | Arquivos |
|---|---|---|
| C.1 | Página admin SEM_UC | `web/app/dashboard/cooperados/novo-sem-uc/page.tsx` (245 linhas) |
| C.2 | Banner de redirect no wizard atual | `web/app/dashboard/cooperados/novo/page.tsx` (etapa 0) |
| C.3 | Badge SEM_UC na listagem | `web/app/dashboard/cooperados/page.tsx` — `<Badge>SEM_UC</Badge>` substituiu texto `(sem UC)` |
| C.4 | Cadastro público SEM_UC + endpoint backend | `backend/src/publico/publico.controller.ts` (`POST /publico/cadastro-sem-uc`) + `web/app/cadastro/sem-uc/page.tsx` + banner em `web/app/cadastro/page.tsx` step 0 |
| C.5 | Smoke E2E 6/6 PASS | `backend/scripts/smoke-bloco-c-sem-uc.ts` |

## Decisões de produto

- **Admin SEM_UC nasce com `status=ATIVO` + `modoRemuneracao=DESCONTO`** (default conservador admin).
- **Público SEM_UC nasce com `status=PENDENTE` + `modoRemuneracao=CLUBE`** (Indicador Puro tende a Clube/Tokens, admin valida depois).
- **Banner azul** "Sem unidade consumidora? → cadastro SEM_UC" aparece no step 0 dos 2 wizards (admin + público), não obstrui o fluxo COM_UC majoritário.

## Smoke E2E 6/6 PASS

```
1. Admin POST /cooperados → HTTP 201 → tipoCooperado=SEM_UC, status=ATIVO, 0 UCs, 0 contratos ✅
2. Público POST /publico/cadastro-sem-uc → HTTP 201 → tipoCooperado=SEM_UC, status=PENDENTE, 0 UCs, 0 contratos ✅
Validações: tipoCooperado correto × 2 + zero UCs × 2 + zero contratos × 2 = 6 PASS
Cleanup: 2 cooperados smoke removidos ✅
```

## Schema / DTOs — sem alteração

`enum TipoCooperado { COM_UC SEM_UC GERADOR CARREGADOR_VEICULAR USUARIO_CARREGADOR }` já existia desde sprints anteriores. `CreateCooperadoDto:25` já aceita `tipoCooperado` opcional. Bloco C apenas tornou a categoria SEM_UC visível pela UI — **zero migração**.

## Débitos resolvidos

- **Gap UI SEM_UC** (catalogado no inventário SISGD 13/05): banco pronto, service trata, mas UI nunca expôs → ✅ **RESOLVIDO**.

## Próximo passo

**Bloco D — 3 crons proativos** (8-12h Code). Quadro 3 txt Luciano: (a) cron lembrete documentos pendentes; (b) cron alerta admin cooperado parado; (c) cron email EDP solicitação fatura. Onboarding sem retrabalho admin.

Frase comandante canônica atualizada em `docs/CONTROLE-EXECUCAO.md`.
