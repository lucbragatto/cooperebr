# M19 — D-FISCAL-2.4.2 + 2.4.3 (Caso 1 custeio: plano + guards + selector + vínculo) — 01/06/2026

## TL;DR

Sessão noite 01/06 destravou estruturalmente o **Caso 1 do convênio consolidado** (empresa cooperada paga total — médico, clínica, padrão Hangar Acadêmica). Em 2 commits incrementais: (2.4.2) plano global "Custeado por convênio" via seed idempotente + 3 guards bloqueando geração de cobrança individual em todos os caminhos (Path A `gerarCobrancaPosFatura`, Path B `aprovarFatura` for-loop, manual `cobrancas.create`); (2.4.3) selector de empresa no cadastro admin (toggle Step3) e público (radio renderStep3 com select nativo), endpoint público `/publico/convenios-pagador-empresa?tenant=` minimalista, integração no `motor-proposta.aceitar` que força plano custeado + vincula `ConvenioCooperado` dentro da MESMA transação serializável do Contrato, ajuste em `adicionarMembro` aceitando `tx` opcional pra entrar na transação do aceite (pulando side effects MLM quando custeio). **Sem schema delta** (descoberta Fase 1: público aceita no mesmo request, `convenioCusteioId` viaja em memória). **Zero migração, zero risco DB.** 9 specs novos cobrindo guards + integração (3 cobrancas-custeio + 6 motor-proposta.aceitar-custeio), 24 specs ajustados pra nova assinatura. **141/141 specs verde** em motor-proposta + convenios + publico + cobrancas + planos. Smoke real: endpoint público responde, sem JWT bloqueia, plano global criado uma única vez (idempotência confirmada após 2 restarts PM2).

## Marco entregue

**M19** — D-FISCAL-2.4.2 + 2.4.3 (Caso 1 custeio: plano + guards + selector + vínculo)

## Commits do dia (2)

| Hash | Mensagem |
|---|---|
| `e265e63` | feat(D-FISCAL-2.4.2): plano custeado por convenio + guards suprimem cobranca individual + help |
| `07ae417` | feat(D-FISCAL-2.4.3): selector convenio no cadastro (admin+publico) + vinculo + auto-plano custeado + help |

## Entregas técnicas

### Backend

**D-FISCAL-2.4.2 — Plano custeado + guards:**
- `PlanosService.onModuleInit` chama `ensurePlanoCusteadoPorConvenio()` (idempotente): cria plano global `"Custeado por convênio"` (FIXO_MENSAL, descontoBase=0, publico=false, ativo=true, cooperativaId=null) se ainda não existir.
- `FaturasService.gerarCobrancaPosFatura` (Path A) linha ~602: guard checa `contrato.plano.custeadoPorConvenio`. Se true, marca fatura como `APROVADA + statusRevisao=AUTO_APROVADO_CUSTEIO_CONVENIO` e retorna `null` (caller já trata null sem erro).
- `FaturasService.aprovarFatura` for-loop (Path B) linha ~1061: mesmo guard com `continue` + aviso descritivo (segue processando demais contratos).
- `CobrancasService.create` linha ~166: GUARD #2 manual — `BadRequestException` com mensagem clara incluindo nome do plano + número do contrato.

**D-FISCAL-2.4.3 — Selector + integração:**
- `AceitarPropostaDto.convenioCusteioId` opcional + `MotorPropostaService.aceitar(dto, ...)`:
  - Validação ANTES da `$transaction`: NotFound (convênio inexistente), Forbidden (tenant errado), BadRequest (status≠ATIVO ou pagador≠EMPRESA ou plano custeado global ausente).
  - Override `planoIdResolvido = custeioContext.planoCusteadoId` (ignora `dto.planoId` e fallback de tenant).
  - Dentro do `$transaction(Serializable)`: chama `conveniosMembros.adicionarMembro(convenioId, cooperadoId, undefined, tx)`.
- `ConveniosMembrosService.adicionarMembro`: novo 4º param opcional `tx: Prisma.TransactionClient`. Usa `db = tx ?? this.prisma`. Quando tx presente, pula side effects MLM (`recalcularFaixa` + `registrarIndicacaoConvenio`) — não se aplicam ao Caso 1 (custeio puro).
- `MotorPropostaModule` importa `ConveniosModule` (zero ciclo — convenios não depende de motor-proposta).
- `ConveniosService.findAll` + controller: novo filtro `pagador` (`?pagador=EMPRESA`).
- `PublicoController`: novo endpoint público `GET /publico/convenios-pagador-empresa?tenant=X` retornando `[{id, empresaNome}]` (sem CNPJ/desconto/MLM). Valida tenant obrigatório.
- `cadastroWebV2` (publico) forwarda `body.convenioCusteioId` para `motorProposta.aceitar`.
- `PlanosService.findAtivos`: filtra `custeadoPorConvenio: false` (esconde plano global dos cards comerciais).

### Frontend

**Admin (`/dashboard/cooperados/novo`):**
- `Step3Simulacao.tsx`: toggle "Custeado por convênio (empresa paga)" no topo com HelpBox amarela (regra 19/05 — HELP obrigatório). Quando ON: esconde cards de plano + simulação + mostra `<select>` **NATIVO** das empresas pagador=EMPRESA. Sintetiza `resultadoMotor` mínimo a partir do consumo do Step1 (sem chamar `/motor-proposta/calcular`).
- `Step4Proposta.tsx`: banner amarelo explicativo quando custeio + envio WhatsApp/email/PDF escondidos. Passa `convenioCusteioId` no POST `/motor-proposta/aceitar`.
- `page.tsx` `validarEtapa()` case 2: branch custeio (só exige convênio escolhido + síntese pronta).
- `web/types/index.ts`: `Plano.custeadoPorConvenio?` (opcional, evita refactor de todos os usos).

**Público (`/cadastro`):**
- `renderStep3`: bloco "Tipo de cobrança" com radio **NATIVO** (Eu pago / Sou custeado) + `<select>` **NATIVO** quando custeado. Banner azul explicativo (regra 19/05).
- `handleSubmit`: bypassa validação de plano em modo CUSTEADA + envia `convenioCusteioId`. Esconde simulação de economia (4b) e cards de plano (4c).
- `useEffect` novo carrega `/publico/convenios-pagador-empresa` sem dados sensíveis.

### Testes (Jest)

- **NOVO** `backend/src/cobrancas/cobrancas-custeio-convenio.spec.ts` (3 casos): bloqueio em plano custeado, passagem em plano normal, passagem em contrato sem plano.
- **NOVO** `backend/src/motor-proposta/motor-proposta.service.aceitar-custeio.spec.ts` (6 casos): convênio válido (planoId override + adicionarMembro com tx), regressão sem convênio, NotFound, Forbidden cross-tenant, BadRequest pagador errado, BadRequest plano global ausente.
- Ajustes em `planos.service.spec.ts` (3 casos atualizados/novos pra mockar `findFirst`) + 4 specs do MotorPropostaService (11º arg `ConveniosMembrosService`).
- **Total: 141/141 specs verde** em motor-proposta + convenios + publico + cobrancas + planos.

### Scripts auxiliares (não-build)

- `backend/scripts/dfiscal242-check-plano.ts`: verifica plano custeado no banco + confirma idempotência (1 único registro global mesmo após N restarts).

## Bugs resolvidos / catalogados

| # | Severidade | Causa raiz | Fix | Status |
|---|---|---|---|---|
| Cobrança individual gerada em membro de convênio empresa-paga (Path A) | P1 estrutural | `gerarCobrancaPosFatura` não conhecia conceito de plano custeado | GUARD #1 marca fatura APROVADA + retorna null | **RESOLVIDO** (e265e63) |
| Cobrança individual gerada em membro de convênio empresa-paga (Path B `aprovarFatura`) | P1 estrutural | for-loop sobre contratos não conhecia plano custeado | GUARD com `continue` + aviso | **RESOLVIDO** (e265e63) |
| Admin pode criar cobrança manual em membro custeado (UI bypass) | P1 estrutural | `cobrancas.create` não conhecia plano custeado | GUARD #2 `BadRequestException` com mensagem clara | **RESOLVIDO** (e265e63) |
| Vínculo `ConvenioCooperado` desacoplado do Contrato pode gerar membro órfão (Contrato sem vínculo ou vínculo sem Contrato em caso de falha intermediária) | P2 atomicidade | `adicionarMembro` rodava fora da transação | tx opcional + chamada dentro de `$transaction(Serializable)` no aceite | **RESOLVIDO** (07ae417) |
| 15 erros TS pré-existentes em `agents/sentinela` + `agents/repasses-despesas` + `agents/cobranca` | P3 limpeza | Não tocados nesta sessão (carry-over antigo) | — | CATALOGADO (não-bloqueante; build prossegue, dist/ gerado) |

## Decisões estratégicas catalogadas

Sessão consumiu as seguintes decisões via investigação Fase 1:

1. **Schema delta DESNECESSÁRIO** — `convenioCusteioId` viaja em memória (público aceita no mesmo request). Reduz risco zero migração. Aprovado pelo Luciano antes de Fase 2.
2. **Sprint monolítica (sem split 2.4.3a/b)** — escopo cabe em commit coerente único.
3. **`adicionarMembro` aceita `tx` opcional** — quando presente, pula side effects MLM (recalcularFaixa + registrarIndicacaoConvenio). Caso 1 puro não tem MLM nem indicação. Backward-compat 100% (callers sem tx têm comportamento idêntico).
4. **Plano custeado escondido dos cards de plano comercial** — `findAtivos` filtra `custeadoPorConvenio=false`. Acesso só via toggle (admin) ou radio (público).
5. **Síntese de `resultadoMotor` no front em custeio** — evita chamar `/motor-proposta/calcular` pra plano sem economia. Kwh derivado do consumo da fatura, tudo zerado em descontos.

Nenhuma nova memória persistente em `~/.claude/projects/.../memory/` criada (decisões são contextuais à sprint D-FISCAL-2, ficam no doc-sessão + commits).

## Próximo passo

**D-FISCAL-2.4.4** — Motor de cobrança consolidada (varre membros custeados, soma kWh do mês, gera UMA `Cobrança` ou `ContaAPagar` pra empresa pagadora) + cron mensal + hook Design B (`Cobranca.convenioContabilCobrancaId` ↔ `ContratoConvenio`).

## Pré-requisitos leitura próxima sessão

- `docs/CONTROLE-EXECUCAO.md` — frase de retomada PASSO 0 + PASSO 1
- `docs/sessoes/2026-06-01-dfiscal-242-243-custeio-convenio.md` — esta sessão
- `backend/prisma/schema.prisma` — modelos `ContratoConvenio` (campo `pagadorCooperadoId` + `baseCobrancaCusteio` + `contratoConsolidadorId` adicionados em 2.4.1), `Cobranca.convenioContabilCobrancaId` (hook Design B já presente), `ConvenioCooperado`
- `backend/src/motor-proposta/motor-proposta.service.ts` linha ~530-580 (custeioContext) + ~830 (adicionarMembro tx)
- `backend/src/cobrancas/cobrancas.service.ts` linha ~166 (GUARD #2)
- `backend/src/faturas/faturas.service.ts` linhas ~602 (GUARD Path A) + ~1061 (GUARD Path B)
- `docs/especificacao-contabilidade-cooperativa-segregada.md` — spec contábil (referência pra 2.4.4 cobrança consolidada)
- Memória `~/.claude/projects/C--Users-Luciano-cooperebr/memory/decisao_modulo_contabilidade_tributaria_17_05.md`

## Carry-overs (não-bloqueantes)

- **15 erros TS pré-existentes** em `agents/sentinela` + `agents/repasses-despesas` + `agents/cobranca` (3 módulos). Não afetam build runtime (dist/ é gerado), não afetam D-FISCAL-2.4.x. Catalogado como débito P3 — limpar quando alguém tocar esses módulos.
- **Custeio plano: kWh sintético** vs **kWh medido real**. Hoje o Contrato custeado guarda `kwhContrato = consumo do Step1 (mês recente)`. Em 2.4.4 o motor consolidado usa o kWh real do mês (via `FaturaProcessada`), então `Contrato.kwhContrato` em custeio é só placeholder informacional. Documentar quando 2.4.4 ficar pronta.
- **Smoke E2E real ainda pendente:** banco hoje tem zero convênios com `pagador=EMPRESA` (os 2 vivos são CADA_MEMBRO legado). Pra smoke completo precisa criar um convênio teste com `pagador=EMPRESA` + cadastrar membro custeado pela UI (admin ou público). Aguarda 2.4.3 entrar em uso real ou Luciano fazer smoke manual.
- **Convenção MENSAL (Mini-Bloco H'.9 17/05) ainda não aplicada** ao custeio. O kWh sintético assume MENSAL, mas a planilha das 2 usinas em ANUAL precisa do refactor antes do 2.4.4 final.

## Regras aplicadas na sessão

- ✅ **Decisão 23 (validação prévia)**: Fase 1 read-only obrigatória antes de Fase 2 escrita. Aplicada cirurgicamente — descobertas (sem schema delta, sprint monolítica, tx opcional em adicionarMembro) reportadas e aprovadas ANTES de tocar código.
- ✅ **Decisão 24 (frase em local único)**: `CONTROLE-EXECUCAO.md` `## FRASE DE RETOMADA` atualizada nesta sessão; nenhuma duplicação.
- ✅ **Regra HELP obrigatório (19/05)**: HelpBox amarela admin Step3 + banner azul público renderStep3 + banner amarelo Step4 explicativo.
- ✅ **Regra selects NATIVOS (19/05)**: `<select>` puro em ambos (admin + público). Zero Shadcn dentro de dialog/wizard.
- ✅ **Regra fechamento bilateral inegociável (13/05)**: esta sessão sendo encerrada com os 5 itens canônicos.
- ✅ **Regra não trabalhar em paralelo com Code (17/05)**: claude.ai aguardou Code reportar Fase 1 antes de aprovar Fase 2.
- ✅ **Regra rebuild obrigatório após mudança backend**: `pm2 stop` → `npm run build` → `pm2 start` aplicado nas 2 sub-fatias.
- ✅ **Regra prisma transações serializáveis**: vínculo `ConvenioCooperado` no aceite roda dentro do `$transaction(Serializable)` do Contrato — atomicidade garantida.
- ✅ **Regra Math.round monetário** + **Regra multi-tenant**: respeitadas em todos os novos caminhos.

## Frase comandante

Apresentada no terminal (Etapa 5) e catalogada em `docs/CONTROLE-EXECUCAO.md` seção `## FRASE DE RETOMADA`.
