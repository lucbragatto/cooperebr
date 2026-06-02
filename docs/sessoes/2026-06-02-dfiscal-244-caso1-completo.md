# M20 — Sprint D-FISCAL-2.4 (Caso 1 custeio) 100% completa — 02/06/2026

## TL;DR

Sessão maratona 02/06 fechou estruturalmente o **Caso 1 do convênio consolidado** (empresa cooperada paga total pela energia dos membros + UC própria — padrão clínica médica). Em **8 commits incrementais** entregou: motor consolidado (2.4.4a) com UC sintética CONSOLIDADOR-* + plano técnico "Consolidador de Custeio" + helper compartilhado de tarifa; correção da UC própria da empresa entrando no total (2.4.4a.1); invariante custeado⟺consolidado eliminando double-bill (2.4.4a.2); cron mensal `@AsPlatform()` + endpoints REST + emissão Asaas com guard `isAmbienteReal()` (2.4.4b); hook `darBaixa` roteando consolidada paga pro `criarLancamentoConvenioContrato` com natureza configurável do convênio AUXILIAR/PRÓPRIO (2.4.4c); tela admin completa `/dashboard/convenios/[id]/cobrancas-consolidadas` + estorno com gate apuração FECHADA + HelpBox (2.4.4d); UI config no form do convênio com pagador/base/desconto/kwhAlocado + validação service-level (2.4.4e); fix do "Gerar agora" — ALOCACAO_FIXA gera sem membros + 3 banners de feedback claro (2.4.4f). **CASO 1 100% COMPLETO ponta-a-ponta** — UI cadastra convênio EMPRESA → cron gera consolidada mensal → empresa paga → contabilidade fiscal correta. **Smoke real CV-2026-0001 "Clinica teste" pronta pra Luciano testar**: ALOCACAO_FIXA 200000 kWh/mês desconto 20% → vai gerar consolidada de R$ 126.289,60 líquido. Backend 200/200 specs verde · `lint:tenant` zero novos · zero regressão · 2 débitos P3 catalogados (Dialog backdrop blur + tarifa-fallback genérico).

## Marco entregue

**M20** — Sprint D-FISCAL-2.4 Caso 1 custeio 100% completa (motor + UC + tarifa + cron + endpoints + gateway + hook fiscal + UI tela + config UI + fix membros/feedback)

## Commits do dia (8 trabalho + 1 fechamento)

| Hash | Sub-fatia | Mensagem |
|---|---|---|
| `80d3e75` | 2.4.4a | motor cobrança consolidada de custeio + plano consolidador + helper tarifa |
| `74858bb` | 2.4.4a.1 | inclui consumo da UC propria da empresa COM_UC no total consolidado |
| `f593917` | 2.4.4a.2 | invariante custeado⟺consolidado — elimina risco de double-bill |
| `b2e0cad` | 2.4.4b | cron mensal + endpoints + emissão gateway da cobrança consolidada |
| `3fa9a34` | 2.4.4c | hook darBaixa roteia consolidada paga pro lançamento do convênio (natureza configurável) |
| `9a201cb` | 2.4.4d | tela admin cobranças consolidadas + estorno + HelpBox — fecha Caso 1 |
| `a135934` | 2.4.4e | config UI do convênio Caso 1 (pagador empresa + parâmetros de custeio) |
| `14d0948` | 2.4.4f | ALOCACAO_FIXA gera sem membros + feedback claro do "Gerar agora" |

## Entregas técnicas

### Backend

**Motor consolidado (2.4.4a):**
- `ConveniosCusteioService` novo em `backend/src/convenios/convenios-custeio.service.ts`.
  - `gerarCobrancaConsolidada({convenioId, mes, ano, cooperativaId, skipIfExists?})` — entry point com 7 enforcements (CADA_MEMBRO bloqueia, status ≠ ATIVO, sem pagadorCooperadoId, multi-tenant, sem membros [SÓ CONSUMO_REAL após 2.4.4f], plano consolidador custeado=true defesa em profundidade, tarifa ausente).
  - `criarOuRecuperarContratoConsolidador` (lazy): cria UC sintética `CONSOLIDADOR-{convenioId}` + Contrato apontando pro `pagadorCooperado` + plano "Consolidador de Custeio". Vincula em `ContratoConvenio.contratoConsolidadorId` (@unique).
  - Suporta `CONSUMO_REAL` (soma kWh via `FaturaProcessada.dadosExtraidos.consumoAtualKwh`) e `ALOCACAO_FIXA` (usa `kwhAlocadoMensal` direto).
  - `$transaction(Serializable)` cria Cobranca + LancamentoCaixa PREVISTO atomicamente.
  - Idempotência soft via `@@unique([contratoId, mes, ano])` (já no schema).
- `backend/src/common/tarifa-helper.ts` novo: `buscarTarifaPorDistribuidora(prisma, distrib, {throwIfNotFound})` extraído da função privada de faturas.service.
- `PlanosService.ensurePlanoConsolidadorCusteio`: seed idempotente do plano global FIXO_MENSAL `custeadoPorConvenio=FALSE` (CRÍTICO — senão GUARDs 2.4.2 suprimem própria consolidada). Escondido em `findAtivos` por nome.

**UC própria da empresa (2.4.4a.1):**
- Coleta UCs reais do pagadorCooperado (`NOT startsWith 'CONSOLIDADOR-'`).
- Dedup defensivo via `Map<ucId>` evita double-count se empresa = membro.
- Distribuidora predominante: membros + pagador.
- Logger.warn quando pagador tem UC real ATIVA mas não é membro.

**Invariante custeado⟺consolidado (2.4.4a.2):**
- Novo FILTRO INVARIANTE via `prisma.contrato.findMany({where: { ucId: in candidatas, status: 'ATIVO', plano: { custeadoPorConvenio: true } }})`.
- Set de ucIds custeados — SOMENTE essas UCs entram no calc.
- Logger.log INFO listando UCs excluídas + orientação operacional.
- Erro explícito se ZERO UC custeada (evita consolidada vazia).
- **Garantia matemática:** UC nunca está em cobrança individual E consolidada simultaneamente.

**Cron + endpoints + gateway (2.4.4b):**
- `ConveniosJob.gerarConsolidadasMensalCusteio` `@Cron('0 4 * * *') @AsPlatform()` — varre `pagador=EMPRESA + ATIVO + diaEnvioRelatorio==hoje`, gera mês FECHADO anterior.
- `ConveniosCusteioService.cronGerarConsolidadasDoMesFechado(hoje?)`: retorna `{processados, criados, jaExistem, falhas}`. Erros por convênio isolados.
- `ConveniosCusteioService.listarConsolidadasDoConvenio`: cross-check tenant + filtra Cobranca por `convenioContabilCobrancaId + cooperativaId` (dupla camada).
- `ConveniosCusteioService.emitirNoGateway` (private): chamado FORA da tx após criar Cobranca. 3 guards: gateway nulo / `!isAmbienteReal()` (decisão Luciano explícita — em dev PULA totalmente) / sem formaPagamento. Erro = log warn.
- `GET /convenios/:id/cobrancas-consolidadas` `@Roles(SA,AD,OP) @TenantResource`.
- `POST /convenios/:id/cobrancas-consolidadas/gerar?mesReferencia=YYYY-MM` `@Roles(SA,AD) @TenantResource @AuditLog('convenio.consolidada.gerar_manual')` — valida formato + mês ≤ corrente.

**Hook darBaixa (2.4.4c):**
- `cobrancas.service.ts:550-606` substituiu hook CT.3 padrão por if/else:
  - `cobranca.convenioContabilCobrancaId != null` → `criarLancamentoConvenioContrato({contratoConvenioId, valor, dataMovimento, competencia, descricao, cooperativaId})` — natureza DO CONVÊNIO.
  - else → CT.3 legado (`criarLancamentoAutomatico` COBRANCA→PRÓPRIO).
- Substitui (não complementa) — evita 2 lançamentos fiscais.
- Best-effort `.catch(log.error)` — erro fiscal nunca reverte pagamento.
- Ajuste cirúrgico: descricao usa `cobranca.id` COMPLETO (não slice 8) — permite busca robusta no estorno.

**Estorno (2.4.4d):**
- `ConveniosCusteioService.estornarCobrancaConsolidada`: valida posse tenant + vínculo, gate apuração FECHADA via `prisma.apuracaoMensalSegregada.findFirst({cooperativaId, ano, mes})`.
- Transação Serializable:
  - PAGO → revert pra A_VENCER + zera dataPagamento/valorPago + deleta LancamentoCaixa OPERACIONAL + FISCAL CONVENIO.
  - A_VENCER/PENDENTE/VENCIDO → CANCELADO + motivo + cancela PREVISTO (preserva trilha).
- `POST /convenios/:id/cobrancas-consolidadas/:cobrancaId/estornar` `@AuditLog('convenio.consolidada.estornar')`.

**Config UI backend (2.4.4e):**
- `CreateConvenioDto + UpdateConvenioDto` aceitam 5 campos novos (`pagador, pagadorCooperadoId, baseCobrancaCusteio, kwhAlocadoMensal, descontoKwhCusteio`) + enums `PagadorConvenioDto + BaseCobrancaCusteioDto`.
- `ConveniosService.validarBlocoCusteio` (helper privado): pagador=EMPRESA exige pagadorCooperadoId (ATIVO + tenant correto) + baseCobrancaCusteio. ALOCACAO_FIXA exige kwh>0.
- Update parcial usa "pagador efetivo" (DTO || banco) pra validação coerente.

**Fix membros + feedback (2.4.4f):**
- Early-return `SEM_MEMBROS` movido PRA DENTRO do branch `if (base === 'CONSUMO_REAL')`. ALOCACAO_FIXA gera sem membros.
- Backend agora retorna sempre `{ status: 'CRIADA' | 'JA_EXISTE' | 'SEM_MEMBROS' }` claros.

### Frontend

**Tela admin (2.4.4d):** `web/app/dashboard/convenios/[id]/cobrancas-consolidadas/page.tsx`
- Tabela: competência (mês nome) · valor bruto · desconto · líquido · vencimento+pagamento · status badge colorido · ações.
- Dialog Tipo C "Gerar agora" com `<select>` NATIVO dos últimos 12 meses + corrente.
- Dialog Tipo C "Estornar" com textarea motivo + descrição contextual (PAGO=reverte vs A_VENCER=cancela).
- HelpBox topo (regra 19/05): geração auto/manual + estorno + gate FECHADA + natureza fiscal.
- Sem otimismo (é dinheiro): loading → recarrega; erro inline backend.
- Bloqueia se `convênio.pagador ≠ EMPRESA` → aviso amber.
- Link no header de `/dashboard/convenios/[id]` aparece SÓ para `pagador=EMPRESA`.

**Config UI (2.4.4e):** `web/components/convenios/ConvenioCusteioBloco.tsx` novo
- `<select>` NATIVO pagador (CADA_MEMBRO default | EMPRESA).
- EMPRESA revela: `<select>` cooperados ATIVOs (GET /cooperados) + `<select>` base + `kwhAlocadoMensal` (só ALOCACAO_FIXA) + `descontoKwhCusteio` (%).
- HelpBox explicando caso médico, CONSUMO_REAL vs ALOCACAO_FIXA, papel do desconto + aviso amber.
- Limpeza inteligente ao trocar EMPRESA→CADA_MEMBRO.
- Reusado em `/novo` + `/[id]/editar`.

**Feedback "Gerar agora" (2.4.4f):**
- 3 banners distintos:
  - `CRIADA` (verde, main page após dialog fechar): "Cobrança gerada — R$ X (líquido) · id=X" + botão fechar
  - `JA_EXISTE` (azul, DENTRO do dialog): "Cobrança já existia pra esse mês — não duplicou · id=X"
  - `SEM_MEMBROS` (amber, DENTRO do dialog): "Convênio sem membros ativos — nada gerado" + link Wizard + dica trocar pra ALOCACAO_FIXA
- Botão "Cancelar" vira "Fechar" quando há info pra ler.
- Dialog mantém-se ABERTO em JA_EXISTE/SEM_MEMBROS pra usuário ler.

### Testes (Jest)

- **NOVO** `backend/src/convenios/convenios-custeio.service.spec.ts` (40 casos): cobre gerar (CONSUMO_REAL/ALOCACAO_FIXA × desconto × idempotência × enforcements × tarifa × dedup empresa-membro × invariante custeado × ALOCACAO_FIXA sem membros 2.4.4f), listar (multi-tenant + filtro), cron (mês fechado, virada de ano, idempotência, isolamento de erros), emissão gateway (isAmbienteReal × formaPagamento × erro), estorno (PAGO+ABERTA, A_VENCER+ABERTA, gate FECHADA, apuração inexistente).
- **NOVO** `backend/src/convenios/convenios-custeio.controller.spec.ts` (9 casos): GET delega, POST validação formato/mês 13/futuro/corrente permitido/passado delega.
- **NOVO** `backend/src/convenios/convenios-custeio-config.spec.ts` (10 casos): CADA_MEMBRO ignora; EMPRESA sem pagadorCooperadoId/inexistente/INATIVO/sem base/sem kwh → BadRequest; happy paths CONSUMO_REAL + ALOCACAO_FIXA; UPDATE parcial reaproveita banco.
- **NOVO** `backend/src/cobrancas/cobrancas-darbaixa-roteamento.spec.ts` (4 casos): roteamento CONSOLIDADA → criarLancamentoConvenioContrato; NORMAL → CT.3 default; erro hook não reverte pagamento; sem cooperativaId não dispara nenhum hook.
- **AJUSTE** `backend/src/convenios/convenios.module.ts` import GatewayPagamentoModule (zero ciclo confirmado).
- **AJUSTE** `backend/src/convenios/convenios.controller.ts` 3 endpoints novos.
- **AJUSTE** `backend/src/convenios/convenios.job.ts` cron novo.
- **AJUSTE** `backend/src/convenios/convenios.dto.ts` enums + campos.
- **AJUSTE** `backend/src/convenios/convenios.service.ts` validação + persistência.
- **AJUSTE** `backend/src/cobrancas/cobrancas.service.ts` body aceita convenioContabilCobrancaId + roteamento hook + descricao cobrancaId completo.
- **AJUSTE** `backend/src/planos/planos.service.ts` seed Consolidador.
- **AJUSTE** `backend/src/planos/planos.service.spec.ts` mocks pro novo seed.
- **Total: 200/200 specs verde** em convenios + cobrancas + planos + motor-proposta.

### Scripts auxiliares

- `backend/scripts/dfiscal244a-check-plano-consolidador.ts`: verifica plano + idempotência.
- `backend/scripts/dfiscal244-diag-cv-2026-0001.ts`: diagnóstico read-only do convênio Clínica Teste.

## Bugs resolvidos / catalogados

| # | Severidade | Causa raiz | Fix | Status |
|---|---|---|---|---|
| Empresa COM_UC ficava fora do total consolidado | P1 estrutural | Query do calc só varria ConvenioCooperado → membership não incluía UC do pagador | UCs reais do pagador entram via busca explícita + dedup Map<ucId>; UC sintética excluída via `NOT startsWith 'CONSOLIDADOR-'` | **RESOLVIDO** (74858bb) |
| Risco de double-bill: UC do pagador podia entrar no consolidado + cobrança individual disparar | P1 estrutural | Caminho (b) defensivo da 2.4.4a.1 incluía UC sem garantir plano custeado → GUARD 2.4.2 não disparava | Filtro invariante: UC entra no consolidado ⟺ contrato ATIVO com `plano.custeadoPorConvenio=true` | **RESOLVIDO** (f593917) |
| Ciclo de módulos NestJS impedindo ConveniosCusteio injetar CobrancasService | P2 arquitetural | Convenios→Cobrancas→Whatsapp→MotorProposta→Convenios. forwardRef em ambos lados não resolveu | ConveniosCusteioService usa prisma.cobranca.create direto + inline LancamentoCaixa PREVISTO (subset reproduzido de cobrancas.service:519-532) | **RESOLVIDO** (80d3e75) |
| "Gerar agora" da consolidada CV-2026-0001 retornava 0 cobranças sem feedback | P1 funcional | Early-return SEM_MEMBROS antes do switch CONSUMO_REAL/ALOCACAO_FIXA + frontend tratava HTTP 201 como sucesso genérico | Early-return movido pra dentro do branch CONSUMO_REAL + 3 banners distintos no front | **RESOLVIDO** (14d0948) |
| Frontend stale após 2.4.4e (componente novo não aparecia) | P2 operacional | Confiança no HMR pra componente NOVO (lição BN reaberta) | `npm run build` + `pm2 restart cooperebr-frontend` aplicado | **RESOLVIDO** (build pos-2.4.4e) |
| Backend build cron tinha 17 erros vs 15 baseline | P3 transitório | Schema diff TS — `convenioContratoId` vs `convenioContabilId` + `cooperativaId_competencia` vs `findFirst` | Campos corrigidos no estorno service + spec ajustado | **RESOLVIDO** (durante 2.4.4d) |
| **D-novo-UX-Dialog-Backdrop** | P3 cosmético | `backdrop-blur-xs` + scroll-lock Radix faz taskbar Windows piscar | (não corrigido — débito P3) | CATALOGADO (debitos-tecnicos.md) |
| **D-novo-CT-TARIFA-ALOCACAO** | P3 menor | ALOCACAO_FIXA sem membros + sem UC pagador → distribuidoraUsada=null → fallback genérico mais recente | (não corrigido — débito P3 — hoje serve com EDP-ES único) | CATALOGADO (debitos-tecnicos.md) |

## Decisões estratégicas catalogadas

Sessão consumiu decisões via investigação Fase 1 (Decisão 23 — 7 vezes aplicada nesta sessão):

1. **UC sintética por convênio (decisão #1 Fase 1 D-FISCAL-2.4.4)** — `CONSOLIDADOR-{convenioId}` com pagador como dono, distribuidora=OUTRAS. Zero schema delta. Sintética nunca recebe fatura real → consumo=0 não soma.
2. **Plano "Consolidador de Custeio" SEPARADO** (decisão #2) — global, FIXO_MENSAL, `custeadoPorConvenio=FALSE`. Escondido em findAtivos. NÃO reaproveita "Plano Básico" pra separar visualmente.
3. **Tarifa ALOCACAO_FIXA = distribuidora predominante dos membros, fallback UC pagador** (decisão #3).
4. **Método novo dedicado** (decisão #4) — `convenios-custeio.service` em vez de adicionar lógica em `cobrancas.service`. Single-responsibility.
5. **Cron mês FECHADO anterior** (decisão #5) — corrente teria faturas faltando.
6. **Cron em `convenios.job.ts`** (decisão #6) — trabalho do domínio convênio, não cobrança genérica.
7. **`buscarTarifaPorDistribuidora` extraído pra helper compartilhado** (decisão #7) — `common/tarifa-helper.ts`.
8. **Botão "Gerar agora" valida mês ≤ corrente** (decisão #8).
9. **Tarifa ausente → throw explícito** (decisão Luciano explícita) — NUNCA fallback 0.5 silencioso no caminho consolidado.
10. **AuditLog inativo (D-30N)** → Logger por enquanto (decisão #10).
11. **Schema delta `PropostaCooperado.convenioCusteioId` DESCARTADO** (D-FISCAL-2.4.3 reuse) — convenioCusteioId viaja em memória.
12. **Ciclo de módulos: quebrar dep, não tentar forwardRef** — ConveniosCusteioService chama prisma direto em vez de CobrancasService.
13. **Estorno: gate apuração FECHADA via prisma direto** (não via ApuracaoService) — evita ciclo + busca por `findFirst(cooperativaId+ano+mes)` em vez de findUnique.
14. **Invariante custeado⟺consolidado (2.4.4a.2)** — único caminho que GARANTE zero double-bill matematicamente.
15. **emitirNoGateway: `isAmbienteReal()=false` PULA emissão** (regra contatos teste 14/05). NUNCA `NODE_ENV`. Default dev = fail-safe.
16. **ALOCACAO_FIXA gera sem membros (2.4.4f)** — pacote fixo é independente de membros vinculados. Convênio "pré-pago" funciona.
17. **Tela cobranças consolidadas = rota própria** (padrão UX 17/05 — gestão financeira séria, não cabe em Dialog).

Nenhuma nova memória persistente criada (decisões contextuais à sprint, ficam no doc-sessão + commits).

## Próximo passo

**3 caminhos válidos — Luciano decide:**

1. **Smoke E2E real CV-2026-0001** (~10min) — Luciano abre `/dashboard/convenios/cmpwof5h6000avaf8547cj3pb/cobrancas-consolidadas` → "Gerar agora" maio/2026 → confirma banner verde "R$ 126.289,60" + cobrança na lista. Valida ponta-a-ponta.
2. **D-FISCAL-2.5** — aposentar `/dashboard/contabilidade/convenios` + migrar 1 convênio CT existente (Convenio CT.2 → ContratoConvenio consolidado).
3. **D-FISCAL-2.6** — corrigir relatório `docs/relatorios/2026-05-31-conformidade-contabil-multi-regime.md` removendo exemplo Hangar errado.

Recomendação: começar por (1) pra fechar fé na entrega, depois (2) ou (3).

## Pré-requisitos leitura próxima sessão

- `docs/CONTROLE-EXECUCAO.md` — frase de retomada PASSO 0 + PASSO 1
- `docs/sessoes/2026-06-02-dfiscal-244-caso1-completo.md` — esta sessão
- `docs/sessoes/2026-06-01-dfiscal-242-243-custeio-convenio.md` — sessão anterior (M19)
- `backend/src/convenios/convenios-custeio.service.ts` — service consolidado (motor + lazy create + estorno + cron + listar + emitir)
- `backend/src/cobrancas/cobrancas.service.ts:443-606` — darBaixa com roteamento 2.4.4c
- `backend/src/convenios/convenios.controller.ts:285-380` — 3 endpoints novos (GET listar + POST gerar + POST estornar)
- `backend/src/convenios/convenios.job.ts:38-72` — cron `gerarConsolidadasMensalCusteio @AsPlatform`
- `web/app/dashboard/convenios/[id]/cobrancas-consolidadas/page.tsx` — tela admin
- `web/components/convenios/ConvenioCusteioBloco.tsx` — config no form
- `backend/scripts/dfiscal244-diag-cv-2026-0001.ts` — script de diag (útil pra qualquer convênio EMPRESA novo)
- `docs/debitos-tecnicos.md` D-FISCAL-2 (sprint em curso) + D-novo-UX-Dialog-Backdrop + D-novo-CT-TARIFA-ALOCACAO

## Carry-overs (não-bloqueantes)

- **15 erros TS pré-existentes** em `backend/src/agents/sentinela/*`, `agents/repasses-despesas/*`, `agents/cobranca/*` (P3 — dist/ é gerado, runtime OK).
- **Convenção MENSAL (Mini-Bloco H'.9 17/05) ainda não aplicada** — 2 usinas em ANUAL no banco.
- **Smoke E2E real ainda pendente**: CV-2026-0001 PRONTA pra Luciano testar via UI (todos os fixes aplicados).
- **D-novo-UX-Dialog-Backdrop P3** — backdrop-blur faz taskbar piscar.
- **D-novo-CT-TARIFA-ALOCACAO P3** — distribuidora null em ALOCACAO_FIXA sem membros cai no fallback genérico (acerta hoje com EDP-ES).
- **D-novo-CT-VALIDACAO-FISCAL P0** — bloqueia produção fiscal real (DCTF/SPED), não bloqueia D-FISCAL-2.5/2.6 dev.
- **D-novo-BM P0 BLOQUEADOR REMOÇÃO PRÉ-PROD** — painel credenciais teste.
- 43+ untracked scripts/relatorios — Sprint Housekeeping futuro.
- 256 legados allowlist `lint:tenant`.

## Regras aplicadas na sessão

- ✅ **Decisão 23 (Fase 1 read-only)**: aplicada **8 vezes** na sessão — toda sub-fatia abriu com leitura + report + OK Luciano antes de tocar código (incl. recuperação de stream interrompido em 2.4.4b).
- ✅ **Decisão 24 (frase em local único)**: `CONTROLE-EXECUCAO.md` atualizado uma vez; sem duplicação.
- ✅ **Regra HELP obrigatório (19/05)**: HelpBoxes em `/cobrancas-consolidadas/page` + `ConvenioCusteioBloco` + 3 banners de feedback (CRIADA verde / JA_EXISTE azul / SEM_MEMBROS amber).
- ✅ **Regra selects NATIVOS (19/05)**: `<select>` puro em Dialog "Gerar agora" + `ConvenioCusteioBloco` (pagador + cooperados + base).
- ✅ **Regra fechamento bilateral inegociável (13/05)**: esta sessão sendo encerrada com 5 itens canônicos.
- ✅ **Regra rebuild backend obrigatório**: `pm2 stop → npm run build → pm2 start` aplicado em todas as 8 sub-fatias.
- ✅ **Regra D-novo-AS/BN (frontend HMR não basta pra componente novo)**: lição reaplicada — `npm run build` + `pm2 restart cooperebr-frontend` em 2.4.4d (após criar página nova), 2.4.4e (após criar componente novo, exigiu correção operacional separada), 2.4.4f (banners novos).
- ✅ **Regra `isAmbienteReal()` (14/05)**: emitirNoGateway PULA emissão em dev. NUNCA `NODE_ENV`.
- ✅ **Regra transações Prisma Serializable**: cria Cobranca + LancamentoCaixa em $transaction(Serializable) atomicamente.
- ✅ **Regra Math.round monetário + multi-tenant**: respeitadas em todos os caminhos novos.
- ✅ **`@AsPlatform()` obrigatório em cron**: cron novo `gerarConsolidadasMensalCusteio` decorado.
- ✅ **`@TenantResource + @AuditLog` em endpoints novos**: 3 endpoints (listar + gerar + estornar) decorados — `lint:tenant` confirma zero novos sem decorator.
- ✅ **Regra ciclo de módulos: quebrar dep em vez de forçar forwardRef**: aprendido na 2.4.4a, aplicado em 2.4.4d (gate apuração via prisma direto).

## Frase comandante

Apresentada no terminal (Etapa 5) e catalogada em `docs/CONTROLE-EXECUCAO.md` seção `## FRASE DE RETOMADA`.
