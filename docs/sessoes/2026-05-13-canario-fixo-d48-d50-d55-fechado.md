# Sessão 2026-05-13 — Canário FIXO_MENSAL fechado + D-48 + D-50..D-55

## TL;DR

- **Sub-Fase A canário FECHADA**: 4 cooperados-piloto reais (DIEGO, CAROLINA, ALMIR, THEOMAX) gerando cobranças FIXO_MENSAL via Caminho A E2E. Total R$ 2.542,26 em cobranças + R$ 558,05 economia mensal calculada. **M2 do roadmap entregue.**
- **D-48 P1 SEGURANÇA fechado**: 7 patches multi-tenant em `motor-proposta`, `cooperados`, `migracoes-usina`, `contratos`, `usinas`. Saneou 2 contratos divergentes em produção (DIEGO + Luciana seed).
- **D-50 + D-50.2 + D-51 + D-52 + D-53 + D-55** todos fechados (round 1 + round 2 polimento UI cobranças). **D-54 catalogado** (LancamentoCaixa faltante em `gerarCobrancaPosFatura` — fix sessão dedicada).
- **D-45 (wizard cooperados), D-46 (12 divergências spec↔Plano), D-47 (OURO/PRATA nomes)** catalogados como débitos abertos.
- **Sugestões #5 (orquestrador), #6 (script HTML auto), #7 (observabilidade total)** catalogadas em memória persistente claude.ai.
- HTML profissional `docs/diagramas/jornada-membro.html` v1.0 criada, atualizada pra v1.1 com mudanças do dia.
- **Decisão 23 aplicada 5× em 48h** (memória inflada). Catalogada.

## Commits do dia (cronológico — 10 commits)

| SHA | Mensagem |
|---|---|
| `32f1d37` | docs(sistema+relatorio+plano): corrigir memoria inflada Joao Santos — 3 docs (Decisao 23 3x em 48h) |
| `0448f9b` | fix(parceiros-wizard): Step5Cobranca usa enum ModeloCobranca correto |
| `e2cd14e` | docs(debitos): D-48 P1 SEGURANCA - 6 sites isolamento multi-tenant ausente |
| `74c05e3` | fix(security): D-48 isolamento multi-tenant em 6 sites usina.find* |
| `323d66d` | fix(data): saneamento CTR-2026-0004 + CTR-2026-0003 pos-D-48 |
| `bded89d` | feat(canario): 4 cooperados-piloto FIXO_MENSAL E2E real + closes Sub-Fase A 14/05 |
| `309389e` | docs(jornada): cria mapa visual v1.0 - jornada do membro 14/05 |
| `c7256e8` | fix(cobrancas): D-50 popular cooperativaId no gerarCobrancaPosFatura |
| `102640e` | fix(cobrancas): polimento pos-canario - D-50.2 + D-51 + D-52 + D-53 + catalog D-54 |
| `78b2285` | fix(cobrancas): polimento UI round 2 - D-51 detalhe + D-53 completo + D-55 |

## Entregas técnicas

### Sub-Fase A canário fechada

- 4 cooperados criados na cooperativa real CoopereBR (`cmn0ho8bx0000uox8wu96u6fd`)
- IDs:
  - DIEGO `cmp4jpirx0002vagcs9bhhk2b`
  - CAROLINA `cmp4ktvwm0006va3kq4h52kff`
  - ALMIR `cmp4ktz8i000qva3ktjn8b6l1`
  - THEOMAX `cmp4ku2ci001ava3ko1o84pwp`
- Contratos `CTR-2026-0004` a `CTR-2026-0007` ATIVO com snapshots Fase B preenchidos
- 4 cobranças FIXO_MENSAL com `modeloCobrancaUsado` correto, valores matematicamente validados
- `ambienteTeste=true` em todos (blindagem SMTP/WA)
- Plano `Individual Residencial` 18% desconto `KWH_CHEIO` `APLICAR_SOBRE_BASE`
- Usina Linhares (capacidade 150.000 kWh/ano)

### D-48 P1 SEGURANÇA — 7 sites multi-tenant

- **D-48.1** `motor-proposta.service.ts:639` (`whereUsina` ganha `cooperativaId: dono.cooperativaId`)
- **D-48.2** `motor-proposta.service.ts:1152` (`findUnique` ganha `cooperativaId` opcional)
- **D-48.3** `cooperados.service.ts:498,523` (`cadastroCompleto` 2× filtro tenant)
- **D-48.4** `cooperados.service.ts:1279` `alocarUsina` usa `cooperado.cooperativaId`
- **D-48.5** `migracoes-usina.service.ts:110,440,448` (bypass SUPER_ADMIN)
- **D-48.6** `contratos.service.ts:68` + `controller.ts` `@Req()` (mudança de assinatura `create`/`update`/`validarCapacidadeUsina`)
- **D-48.7** `usinas.service.ts:261` + `controller.ts` (parâmetro `cooperativaId` + guard `ForbiddenException`)

### Saneamento — 2 contratos divergentes

- **CTR-2026-0004 DIEGO**: usinaId TESTE-USINA-B5 → Usina Linhares (pct 4,0833 → 0,3267)
- **CTR-2026-0003 Luciana seed**: usinaId Solar Serra → Usina Linhares (pct 0,025 → 0,6667)
- Auditoria pós-fix: **0 contratos cross-tenant** em produção

### Polimento UI cobranças

- **D-50** (commit `c7256e8`): `gerarCobrancaPosFatura` popular `cooperativaId` na criação da `Cobranca` (`faturas.service.ts:664`) — 4 cobranças piloto ficavam invisíveis no `/dashboard/cobrancas` porque `cooperativaId` ficava null
- **D-50.2**: `gerarCobrancasLote` (`faturas.service.ts:1057`) — mesmo padrão, bug-gêmeo previne futuras cobranças órfãs
- **D-51 listagem**: badge `A_VENCER` 'A vencer' azul em `web/app/dashboard/cobrancas/page.tsx:21-34`
- **D-51 detalhe**: replicar `statusLabel` + `statusClasses` na tela `/dashboard/cobrancas/[id]/page.tsx` + fallback no Badge + campo Status
- **D-52**: `normalizarData()` no `update` do service (`cobrancas.service.ts:387`) — resolve `PUT /cobrancas/:id` 500 em Dar Baixa quando frontend envia string `YYYY-MM-DD`
- **D-53**: `overflow-x-auto` no `<CardContent>` direto (`page.tsx:84`) — tabela responsiva em viewport estreito (fix anterior em `<div>` interno não scrollava porque Card pai expandia)
- **D-55**: `update` retorna com `include: { contrato: { include: { cooperado: true } } }` — preserva relations pós Dar Baixa na tela detalhe

## Débitos novos catalogados

| ID | Severidade | Status |
|---|---|---|
| **D-45** | P2 | wizard cooperados 4 erros — Aberto, sessão dedicada futura |
| **D-46** | P2 | chapéu spec↔Plano 12 sub-itens — Aberto |
| **D-47** | P3 | nomes OURO/PRATA confusão Plano vs PlanoSaas — Aberto |
| **D-54** | P1 latente | `LancamentoCaixa` PREVISTO faltante em `gerarCobrancaPosFatura` — Aberto, sessão dedicada |

## Sugestões catalogadas (memória persistente)

- **#5**: Agente orquestrador project-specific (`.claude/agents/`) + sub-agentes especialistas (Fase 2)
- **#6**: Script auto-regenerar HTML jornada do banco
- **#7**: Observabilidade total `AuditLog` + heurísticas (D-30N expandido). Luciano pediu "lembre de me lembrar" — trigger automática ao fechar Sub-Fase B + sub-canário.

## Aprendizados de processo

- **Decisão 23 aplicada 5× em 48h** — memória do projeto sistemicamente desatualizada. Reforço do hábito Fase 1 read-only obrigatória.
- **claude.ai virou reativo a screenshots** em vez de proativo coordenador. Reforço do padrão "claude.ai coordena, Code executa".
- **Sessão maratona acumulou 10 commits sem doc-sessão** — originou regra inegociável bilateral de fechamento (commit anterior `CLAUDE.md`).

## Pendências abertas

1. **Validação visual round 2** (D-51 detalhe, D-53 completo, D-55): Luciano valida após Ctrl+F5
2. **txt/HTML diagrama**: Luciano enviou descrição em `OneDrive/descricao diagrama claude.txt` com expansões importantes (cadastro sem UC, opção tokens, fluxo doc+assinatura, realocação inteligente entre usinas, protocolos concessionária). **Decidir Caminho A (refazer v1.0) ou Caminho B (v1.1 expandido).**
3. **Sub-Fase B AMAGES**: cadastrar AMAGES 2 UCs em `CREDITOS_COMPENSADOS` + desligar `BLOQUEIO_MODELOS_NAO_FIXO` (mitigação D-46.SEED antes: `UPDATE publico=false` nos 3 planos legados)
4. **Sub-canário CAROLINA Asaas+WA real**: tirar `ambienteTeste`, gerar boleto/PIX real, WA notifica
5. **Cadastro de Usinas** — HTML separado (pedido Luciano)
6. **D-45 wizard cadastro** (4-6h Code)
7. **D-46 ALTAS** (8-12h Code distribuídas)
8. **D-54 LancamentoCaixa** (1-2h Code com saneamento retroativo)

## Próximo passo único

**Decidir Caminho A vs B do txt/HTML diagrama** com base em `OneDrive/Documentos/descricao diagrama claude.txt`. Depois Sub-Fase B AMAGES OU sub-canário CAROLINA.
