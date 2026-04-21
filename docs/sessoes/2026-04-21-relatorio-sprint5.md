# Relatório de Sessão — 21/04/2026 (Sprint 5)

> Sessão completa de execução das tarefas T2-T8 do Sprint 5.
> HEAD inicial: `1ed82de` (T2 já commitada na sessão anterior parcial).
> HEAD final: `7424e1b` (T8 Parte B).

---

## Tarefas executadas

### T2 — Motor calcula Tipo II (ABATER_DA_CHEIA)
**Commit:** `1ed82de`
**Arquivos modificados:**
- `backend/src/motor-proposta/motor-proposta.service.ts` — função `calcularComPlano()` (linhas ~282-450)
  - Select explícito no `findUnique` do Plano (7 campos)
  - Leitura de `plano.tipoDesconto` com fallback `?? 'APLICAR_SOBRE_BASE'`
  - Renomeação `kwhBaseCalculo` → `tarifaBase` (alias compat mantido no retorno)
  - Cálculo de `kwhCheio` sempre (independente de baseCalculo)
  - Ramificação Tipo I / Tipo II na `tarifaContratada`
  - Retorno expandido: `tarifaBase`, `kwhCheio`, `tarifaContratada`, `abatimentoPorKwh`, `tipoDescontoUsado`
- `backend/src/motor-proposta/motor-proposta.service.spec.ts` — 4 testes adicionados
  - Tipo I + KWH_CHEIO → 0,87424
  - Tipo II + KWH_CHEIO → 0,87424 (equivalência Seção 4.6)
  - Tipo II + SEM_TRIBUTO → 0,93494
  - tipoDesconto null → fallback APLICAR_SOBRE_BASE

### T3 — aceitar() persiste snapshots do plano no Contrato
**Commit:** `b90cf99`
**Arquivos modificados:**
- `backend/src/motor-proposta/motor-proposta.service.ts` — função `aceitar()` (linhas ~467-740)
  - Reorganização: plano carregado antes da transação (era dentro)
  - Resolução de `planoIdResolvido` com fallback tenant-aware (`cooperativaId`)
  - Bug fix oportunista: `findFirst` do fallback agora filtra por `cooperativaId`
  - `planoSnapshot` carregado com `modeloCobranca`, `nome`, `baseCalculo`, `tipoDesconto`
  - Bloco BLOQUEIO_MODELOS_NAO_FIXO reescrito pra usar `planoSnapshot`
  - Remoção da resolução de `planoId` dentro da transação (economiza 1 roundtrip)
  - `contrato.create` expandido com: `kwhContratoMensal`, `valorContrato` (só FIXO), `baseCalculoAplicado`, `tipoDescontoAplicado`
  - Notificação `PLANO_FALLBACK_APLICADO` pós-transação quando fallback é usado
**Arquivos criados:**
- `backend/src/motor-proposta/motor-proposta.service.aceitar.spec.ts` — 5 testes
  - FIXO + Tipo I + KWH_CHEIO → snapshots corretos
  - FIXO + Tipo II + SEM_TRIBUTO → snapshots refletem plano
  - Sem planoId → fallback + notificação PLANO_FALLBACK_APLICADO
  - COMPENSADOS + BLOQUEIO ligado → BadRequestException
  - kwhContratoMensal sanidade

### T4 — Promoção temporal via snapshots no Contrato
**Commit:** `67eae97`
**Arquivos modificados:**
- `backend/src/motor-proposta/motor-proposta.service.ts` — função `aceitar()`
  - Select do `planoSnapshot` expandido: `temPromocao`, `descontoPromocional`, `mesesPromocao`, `descontoBase`
  - Cálculo de snapshots promocionais: `descontoPromocionalAplicado`, `mesesPromocaoAplicados`, `valorContratoPromocional`, `tarifaContratualPromocional`
  - Spread condicional no `contrato.create` (só grava se promoção válida)
- `backend/src/faturas/faturas.service.ts` — função `calcularValorCobrancaPorModelo()`
  - Nova função `estaEmPeriodoPromocional()` (linhas ~1559-1593)
  - Case FIXO_MENSAL: usa `valorContratoPromocional` durante período promocional
  - Case CREDITOS_COMPENSADOS: usa `tarifaContratualPromocional` durante período
  - TODO T4b/Sprint7 marcado: valorBruto FIXO zerado em relatórios
- `backend/src/motor-proposta/motor-proposta.service.aceitar.spec.ts` — 2 testes adicionados
- `backend/src/faturas/faturas.service.calcular.spec.ts` — 2 testes adicionados

### T5 — Hotfix UC matching campo canônico `numero`
**Commit:** `84ad06f`
**Arquivos modificados:**
- `backend/src/email-monitor/email-monitor.service.ts` — 2 linhas (identificarPorOcr + identificarCooperado)
**Arquivos criados:**
- `backend/src/email-monitor/email-monitor.service.spec.ts` — 2 testes

### T6 — Anti-duplicação de cobrança por contrato+competência
**Commit:** `87b3679`
**Arquivos modificados:**
- `backend/prisma/schema.prisma` — `@@unique([contratoId, mesReferencia, anoReferencia])`
- `backend/src/cobrancas/cobrancas.service.ts` — guard `findFirst` antes do `create()`
**Arquivos criados:**
- `backend/src/cobrancas/cobrancas.service.spec.ts` — 3 testes

### T7 — UI tooltips + campo tipoDesconto em planos/novo
**Commit:** `ee97bfe`
**Arquivos modificados:**
- `web/app/dashboard/planos/novo/page.tsx` — +84 linhas
  - Componente `HelpIcon` (tooltip CSS puro Tailwind)
  - 5 tooltips: Modelo de Cobrança, Desconto Base, Base de Cálculo, Referência de Valor, Fator de Incremento
  - Campo `tipoDesconto` com 2 radios (APLICAR_SOBRE_BASE / ABATER_DA_CHEIA)
  - State `form.tipoDesconto` + envio no payload
- `backend/src/planos/dto/create-plano.dto.ts` — campo `tipoDesconto` com `@IsIn`
- `backend/src/planos/dto/update-plano.dto.ts` — idem
- `backend/src/planos/planos.service.ts` — `tipoDesconto` no create() e update()
**Validação visual:** 4 prints confirmando tooltips + radios funcionando

### T8 Parte A — Testes de integração cross-service
**Commit:** `e5dfb19`
**Arquivos modificados:**
- `backend/src/motor-proposta/motor-proposta.service.aceitar.spec.ts` — +4 testes
  - Fluxo completo cross-service (notificações, audit trail, marcarPendente)
  - LISTA_ESPERA (usina sem vaga)
  - Sem UC vinculada → aviso sem contrato
  - Integração T3+T4: 8 snapshots (base + promocionais)
- `backend/src/faturas/faturas.service.calcular.spec.ts` — +1 teste
  - COMPENSADOS usa tarifaContratualPromocional durante promoção

### T8 Parte B — Smoke test pipeline OCR com fatura real
**Commit:** `7424e1b`
**Arquivos criados:**
- `backend/scripts/smoke-pipeline-fatura.ts` — script manual (3 modos: híbrido/cached/update)
- `backend/test/fixtures/faturas/edp-carol.pdf` — fatura EDP real (movida de scripts/)
- `backend/test/fixtures/faturas/edp-carol-expected.json` — baseline OCR (48 campos)
- `backend/test/fixtures/faturas/README.md` — documentação de uso
**Validação:** OCR completou em 21.4s, modo cached OK

---

## Commits de documentação

| Commit | Descrição |
|---|---|
| `5022f27` | docs: estado pós-tarefa 1 + continuidade |
| `c5d01cd` | docs: tickets Sprint 7 (3 itens) |
| `7b03a3d` | docs: ticket 4 Sprint 7 — bug valorBruto FIXO |
| `71611ee` | docs: ticket 5 — infra E2E pra backlog |

---

## Contagem de testes

| Suite | Antes | Depois | Delta |
|---|---|---|---|
| motor-proposta.service.spec.ts | 14 | 18 | +4 (T2) |
| motor-proposta.service.aceitar.spec.ts | 0 | 11 | +11 (T3+T4+T8) |
| faturas.service.calcular.spec.ts | 22 | 25 | +3 (T4+T8) |
| email-monitor.service.spec.ts | 0 | 2 | +2 (T5) |
| cobrancas.service.spec.ts | 0 | 3 | +3 (T6) |
| **Total sprint** | **36** | **59** | **+23** |

Total geral do projeto (incluindo specs não tocados): **133 testes**

---

## Decisões tomadas

1. **T2:** `tipoDesconto` vem do Plano (não do DTO) — fallback `?? 'APLICAR_SOBRE_BASE'`
2. **T3 D1 (Opção A):** valorContrato só FIXO; não-FIXO fica null
3. **T3 D2 (Opção D):** fallback de plano gera notificação `PLANO_FALLBACK_APLICADO`
4. **T3 Bug fix:** findFirst do fallback filtra por `cooperativaId` (era cross-tenant)
5. **T4 P1=A:** admin edita `mesesPromocaoAplicados` via PUT /contratos/:id
6. **T4 P2=B:** mês de dataInicio conta como 1º mês promocional
7. **T4 P3=A:** promoção lê do contrato (snapshot), não do plano
8. **T6:** dupla camada — guard em código + constraint unique no banco
9. **T7 (Opção E):** tooltips + campo tipoDesconto visível, refactor completo Sprint 6
10. **T8 (B2):** testes com mocks Prisma; E2E real fica Sprint 7-8

## Tickets Sprint 7 abertos

1. Auditar tela `/dashboard/cooperados/[id]` após produção real
2. Bug `valorMensalEdp × 0.1` em `calcularComPlano()`
3. Refactor/remoção `calcular()` legado
4. Bug valorBruto FIXO_MENSAL zerado em relatórios
5. Infra de testes E2E front+back (Playwright)

---

## Estado ao final

- **Sprint 5:** 8/9 tarefas de código fechadas (T1-T8)
- **Pendente:** T9 (desligar `BLOQUEIO_MODELOS_NAO_FIXO` + smoke test)
- **Testes:** 78/78 motor-proposta+faturas, 133 total projeto
- **tsc:** zero erros
- **Banco:** sincronizado (constraint unique T6 criada, snapshots T1 aplicados)
- **Smoke OCR:** baseline gerada (48 campos, fatura EDP Carol)
- **UI T7:** validada visualmente (4 prints)
- **160+ commits ahead de origin**

---

## Prompt de retomada pra próxima sessão

Cole este bloco como primeira mensagem na nova sessão:

```
# Retomada de sessão — CoopereBR Sprint 5, 21/04/2026

## Contexto
Plataforma SaaS multi-tenant para cooperativas de energia solar (GD).
Sprint 5 = refatoração do motor de cobrança (Tipo I/II, snapshots,
promoção temporal, anti-dup, UI planos, pipeline email).

## Concluído (8 de 9 tarefas)

| # | Tarefa | Commit | Status |
|---|---|---|---|
| 0 | Doc canônico REGRAS-PLANOS-E-COBRANCA.md | e058f99 | ✅ |
| 1 | Schema: enum TipoDesconto + snapshots Contrato | 877d2b7 | ✅ |
| 2 | Motor: Tipo II (ABATER_DA_CHEIA) em calcularComPlano | 1ed82de | ✅ |
| 3 | aceitar() persiste snapshots por modelo | b90cf99 | ✅ |
| 4 | Promoção temporal (snapshots + estaEmPeriodoPromocional) | 67eae97 | ✅ |
| 5 | Hotfix email: uc.numeroUC → uc.numero | 84ad06f | ✅ |
| 6 | Anti-dup cobrança @@unique + guard | 87b3679 | ✅ |
| 7 | UI tooltips + tipoDesconto em planos/novo | ee97bfe | ✅ |
| 8 | Testes cross-service + smoke OCR | e5dfb19 + 7424e1b | ✅ |

## Estado verificado
- Branch: main
- Último commit: 7424e1b
- Testes: 133 total (78 nas suites do sprint), todos passando
- tsc: zero erros
- Working tree: limpo (exceto docs/sessoes não commitados)
- Banco: sincronizado

## Próxima tarefa: T9 — Desligar BLOQUEIO_MODELOS_NAO_FIXO

Escopo:
1. Trocar env var BLOQUEIO_MODELOS_NAO_FIXO para 'false' (ou remover o guard)
2. Smoke test end-to-end: criar plano COMPENSADOS, aceitar proposta, gerar cobrança
3. Validar que snapshots são persistidos corretamente para COMPENSADOS
4. Se tudo verde: remover o guard do código (dead code)

⚠️ ATENÇÃO: Não desligar em produção sem validar. T9 é pra ambiente dev.
O guard protege contra uso de COMPENSADOS/DINAMICO enquanto motor não estava pronto.
Motor está pronto desde T2-T4. T9 é a cerimônia de desbloqueio.

## Verificação inicial
```bash
git log --oneline -5
git rev-parse HEAD
# Esperado: 7424e1b
npx tsc --noEmit
npx jest src/motor-proposta/ src/faturas/ src/cobrancas/ src/email-monitor/
# Esperado: 78+ testes passando
```

## Arquivos de referência
1. docs/referencia/REGRAS-PLANOS-E-COBRANCA.md — fonte canônica (seções 2, 4, 8)
2. docs/sessoes/2026-04-21-relatorio-sprint5.md — este relatório
3. docs/sessoes/2026-04-21-tickets-sprint7.md — 5 tickets abertos pra sprint 7
4. backend/src/motor-proposta/motor-proposta.service.ts — funções calcularComPlano() e aceitar()
5. backend/src/faturas/faturas.service.ts — calcularValorCobrancaPorModelo() + estaEmPeriodoPromocional()

## Pontos de atenção
- ASAAS_PIX_EXCEDENTE_ATIVO: NÃO ativar em prod sem instrução de Luciano
- valorMensalEdp × 0.1: bug conhecido, ticket Sprint 7 #2
- calcular() legado: ainda usado por todos os callers, não remover
- 160+ commits ahead de origin: push acumulado, não bloqueia execução
```
