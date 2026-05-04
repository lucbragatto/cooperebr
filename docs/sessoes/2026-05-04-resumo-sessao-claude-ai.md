# Sessão claude.ai 2026-05-04 — Housekeeping git + Sprint 5 ponto 3 atualizado

## 1. Sumário executivo

Sessão claude.ai (não Code) com 2 frentes distintas:
- **Manhã:** housekeeping git acumulado (3 commits sem impacto funcional)
- **Tarde/noite:** Sprint 5 ponto 3 honrado e atualizado pra refletir estado pós-Fase B (2 commits)

Total: **5 commits**, todos pushados pra `origin/main`. Validação manual Fase C.1.1 também foi confirmada nesta sessão (cálculo do helper `simular-plano.ts` está correto — falso alarme ao confundir plano com `descontoBase=18` com a premissa canônica de 15%).

## 2. Linha do tempo

```
Manhã   Housekeeping git
        df0de86 PM2 whatsapp-service carrega .env via node_args
        722914f .gitignore cobre configs locais Claude Code + backups/
        71ec415 script idempotente setar-webhook-token-asaas (multi-tenant safe)
        Push 856c4d8..71ec415 → origin/main ✓

Tarde   Validação manual Fase C.1.1 (Luciano)
        Detectou 5º problema: COM_ICMS/CUSTOM retornam R$ 0,00 com "100% economia real"
        Investigação read-only #1 — gap das 4 baseCalculo

Tarde   Reframe: não é bug, é Sprint 5 ponto 3 obsoleto desde Fase B
        - UI v1 deveria esconder COM_ICMS/CUSTOM (decisão original)
        - Helper canônico Fase B lança NotImplementedException (caminho via API morto)
        - Resultado: 3 fontes divergentes pro mesmo cálculo (frontend/motor/helper)

Noite   Aplicação Sprint 5 ponto 3 atualizado
        ca0c0af UI: <option disabled> + aviso V4 reescrito + HelpIcon corrigido + baseCalculoLabel sufixado
        e097b0a Backend: @IsIn no DTO + docstrings + D-30U + D-30V + nota datada Sprint 5
        Push origin/main ✓

Noite   Investigação read-only #2 — falso bug 0.87960 vs 0.90300
        Diagnóstico: helper correto, plano testado tem descontoBase=18 (não 15)
        Validação manual Fase C.1.1 → PASSOU
```

## 3. Decisões processuais novas

### Sprint 5 ponto 3 atualizado (Luciano, 04/05 noite)

Decisão original (sessão Sprint 5 em 20/04/2026): "UI v1 esconde COM_ICMS e CUSTOM. Admin que precisar configura via API. Ficam no schema e DTO."

**Atualização:** decisão obsoleta na prática desde Fase B (03/05), porque o helper canônico `calcular-tarifa-contratual.ts` lança `NotImplementedException` pra COM_ICMS/CUSTOM em 4 callers (contratos, cooperados, faturas, motor.aceitar). "Configura via API" virou letra morta — plano salvo com COM_ICMS/CUSTOM via API explode no aceite.

**Estado atual aplicado nesta sessão:**
- UI v1: `<option disabled>` em `/dashboard/planos/novo` e `/dashboard/planos/[id]`
- API v1: `@IsIn(['KWH_CHEIO', 'SEM_TRIBUTO'])` em `CreatePlanoDto` e `UpdatePlanoDto`
- COM_ICMS e CUSTOM ficam no schema/enum mas não podem ser criados/atualizados
- Reabertura depende de spec ANEEL (Sprint 0/5) + decisão de produto sobre UI v2

## 4. Bugs / problemas resolvidos

| Item | Origem | Como resolveu | Commits |
|---|---|---|---|
| `.claude/settings.local.json` trackeado por engano | acúmulo histórico | `git rm --cached` + `.gitignore` | `722914f` |
| `backups/` sem proteção (risco de commit de dados de cooperados) | descoberto na varredura | `.gitignore` | `722914f` |
| `whatsapp-service` não carrega `.env` automaticamente | acúmulo histórico | `node_args` no PM2 | `df0de86` |
| Setar webhook Asaas era manual | sprint anterior | script idempotente + multi-tenant safe + ID via env/argv | `71ec415` |
| Doc `decisoes-sprint5.md` duplicado em `backend/docs/` | line-ending CRLF vs LF | deletado o duplicado | (untracked, sem commit) |
| Sprint 5 ponto 3 obsoleto desde Fase B | Decisão B33+ | UI disable + DTO @IsIn + nota datada | `ca0c0af`, `e097b0a` |
| Falso bug "0.87960 vs 0.90300" no painel de simulação | confusão de premissa | descoberto que plano testado tem descontoBase=18, não 15 | (sem fix — helper correto) |

## 5. Bugs falsos diagnosticados (importante pra retomada)

**"100% economia real" em COM_ICMS/CUSTOM** — não era bug isolado, era sintoma de Sprint 5 ponto 3 não aplicada na UI. Resolvido via disable + DTO + nota datada.

**"0.87960 quando deveria ser 0.90300"** — não era bug. Plano específico testado (`cmn7ru9970004uokcfwydmqjm`) tem `descontoBase=18`, não os 15% da tabela canônica Fase B.5. Helper, motor backend e tabela canônica estão coerentes entre si.

## 6. Débitos catalogados

- **D-30U (P2)** — Fórmula órfã em `motor.dimensionarPropostaParaPlano:313-334`. Calcula COM_ICMS/CUSTOM com fórmula real, mas helper canônico no aceite throw. Hoje blindado por `@IsIn` no DTO + UI disabled. Resolução: remover ramo do motor OU consolidar 3 fontes (D-30V).
- **D-30V (P3)** — Unificar 3 fontes de verdade do cálculo de tarifa contratual (frontend / motor.dimensionar / helper canônico). Gatilho: revisão Sprint 5 ponto 3 OU spec ANEEL/CUSTOM fechada.

## 7. Validação manual Fase C.1.1 — PASSOU

Os 4 bugs UX corrigidos no Code de manhã 04/05 (commits `5062933`, `6c452fe`, `cb1ec43`, `f68c5c6`) foram validados manualmente nesta sessão claude.ai:
1. Trocar `tipoDesconto` na UI altera simulação ✓
2. Aviso V4 redundância em texto educativo ✓
3. Simulação na tela `/dashboard/planos/[id]` (visualização e edição) ✓
4. Dropdown desbloqueia COMPENSADOS/DINAMICO pra SUPER_ADMIN ✓

Achado adicional (5º problema = COM_ICMS/CUSTOM retornando zero) reframado como decisão arquitetural Sprint 5 ponto 3 e tratado nos commits `ca0c0af` + `e097b0a`.

**Conclusão:** Fase C.1.1 fechada. Liberado pra Fase C.2 quando Luciano decidir.

## 8. Arquivos tocados

- `ecosystem.config.cjs`
- `.gitignore`
- `backend/scripts/setar-webhook-token-asaas.ts` (criado)
- `backend/src/planos/dto/create-plano.dto.ts`
- `backend/src/planos/dto/update-plano.dto.ts`
- `web/app/dashboard/planos/novo/page.tsx`
- `web/app/dashboard/planos/[id]/page.tsx`
- `web/lib/simular-plano.ts`
- `docs/debitos-tecnicos.md`
- `docs/sessoes/2026-04-20-decisoes-sprint5.md`
- `docs/CONTROLE-EXECUCAO.md` (este fechamento)
- `docs/PLANO-ATE-PRODUCAO.md` (este fechamento)
- `docs/sessoes/2026-05-04-resumo-sessao-claude-ai.md` (este arquivo)

## 9. Aprendizados meta

- **Validação prévia em CADA resposta (Decisão 14/20) salvou pelo menos 3 vezes hoje:** primeiro ao puxar Sprint 5 ponto 3 da memória (que claude.ai tinha esquecido), depois ao identificar que `BadRequestException` no service violava a própria Sprint 5 ponto 3 que claude.ai estava tentando honrar, depois ao pedir confirmação do `descontoBase` antes de partir pra "fix" do falso bug 0.87960.
- **Reframe técnico vs decisão de produto** apareceu 2 vezes: COM_ICMS/CUSTOM zerados (decisão) e bug 0.87960 (premissa errada do operador). Ambos os casos, o instinto inicial foi "implementar/corrigir". Pausar pra reframar economizou trabalho desnecessário.
- **DTO + class-validator > guard inline no service** pra restrições de input. NestJS oferece o lugar certo, usa.
- **Catalogar 2 débitos separados (D-30U bug latente, D-30V dívida arquitetural condicional)** é melhor que 1 débito misto. D-30U vale resolver mesmo se UI v2 nunca acontecer; D-30V só faz sentido se UI v2 acontecer.

---

*Sessão fechada com aplicação do ritual Decisão 19. Aguarda retomada com Fase C.2 ou outra prioridade conforme Luciano.*

---

## Frase de retomada — próxima sessão

> Voltei. Lê `docs/CONTROLE-EXECUCAO.md` + `docs/sessoes/2026-05-04-resumo-sessao-claude-ai.md`.
>
> 04/05 fechou Sprint 5 ponto 3 atualizado + housekeeping git + Fase C.1.1 validada (5 commits). Próximo passo provável: Fase C.2 (UI plano avançada — promo defaults, vigência, CooperToken expandido, lista enriquecida, confirmação). ~3-4h Code. Mas apresenta P0→P1→P2→P3 (Decisão 19) antes de propor.

### Arquivos pra ler na retomada (ordem, ~10 min)

1. `docs/CONTROLE-EXECUCAO.md` — estado vivo (seção "ONDE PARAMOS" no topo)
2. `docs/sessoes/2026-05-04-resumo-sessao-claude-ai.md` (este arquivo) — fechamento de hoje
3. `docs/sessoes/2026-05-03-resumo-sessao-completa.md` — contexto Fase A+B+B.5+C.1 (substrato técnico ainda recente)
4. `docs/PLANO-ATE-PRODUCAO.md` — onde estamos no roadmap

Opcional (só se for atacar Fase C.2 direto):
5. `web/app/dashboard/planos/novo/page.tsx` — tela atual a estender
6. `web/components/PlanoSimulacao.tsx` + `web/components/CombinacaoAtual.tsx`
7. `web/lib/simular-plano.ts`
