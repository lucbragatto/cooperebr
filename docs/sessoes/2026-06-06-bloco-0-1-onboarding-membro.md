# Sprint Onboarding Completo do Membro — Bloco 0 (Plano de Clube) + Bloco 1 (Aprovação constrói o membro) — 06/06/2026

## TL;DR

Sessão Code maratona que entregou os dois primeiros blocos do Sprint Onboarding Completo do Membro em 8 fatias incrementais. **Bloco 0** introduz o conceito de Plano de Clube pago (mensalidade) com 3 caminhos não-colidentes (admin CRUD, vínculo no convênio, adesão opt-in individual) + componente CLUBE escalar nas duas cobranças (individual e consolidada). **Bloco 1** desloca a construção do membro do momento do cadastro pro gate de aprovação MEMBRO_ATIVO via helper único `construirMembroCompleto` (idempotente, com degradação graciosa quando o motor falha). Caso LEONARDO PIZZOL VIGNA — membro oco PENDENTE sem contrato e sem clube — virou diagnóstico canônico do bug arquitetural antigo que essa sessão fechou. Smoke E2E programático rodou 25/25 passos verdes nos 3 cenários do Bloco 1 + 8/8 da integração de cobrança da Fatia 1.4 (guard `custeadoPorConvenio` bloqueia double-bill + consolidada ALOCACAO_FIXA pega kWh). Achado operacional: 218 membros parciais detectados no tenant CoopereBR pelo DRY-RUN — exige segmentação cuidadosa antes de reconciliar em massa (oco genuíno × SEM_UC legítimo × lista de espera × teste). Catalogado como tarefa P2 separada pra próxima sessão.

## Marco entregue

**M24 — Sprint Onboarding Completo do Membro Bloco 0 + Bloco 1**

## Commits do dia (8 trabalho + 1 fechamento)

| Hash | Mensagem |
|---|---|
| `a9794a8` | feat(plano-clube): Fatia 0.1 — model + CRUD + tela admin (Bloco 0 Sprint Onboarding) |
| `6584aec` | feat(plano-clube): Fatia 0.2 — planoClubeId no ContratoConvenio (Bloco 0) |
| `29999c6` | feat(plano-clube): Fatia 0.3 — adesão opt-in Cooperado.planoClubeId (Bloco 0) |
| `34a66c8` | feat(plano-clube): Fatia 0.4 — componente CLUBE escalar discriminado nas 2 cobranças (Bloco 0 COMPLETO) |
| `d18e7f6` | feat(convite-convenio): Fatia 1.1 — repasse convenioId + permiteSemUc na validação (Bloco 1) |
| `cfc6421` | feat(cadastro-web): Fatia 1.2 — persistir cota + pendencia visivel + stash consumo (Bloco 1) |
| `412b2da` | feat(aprovacao-convenio): Fatia 1.3 — helper construirMembroCompleto no gate MEMBRO_ATIVO (Bloco 1) |
| `8e47737` | feat(reconciliacao): Fatia 1.4 — clube config-dependente + DRY-RUN reconciliação + fix LISTA-ESPERA tenant (Bloco 1 COMPLETO) |
| _(este)_ | docs(sessao): fechamento M24 — Bloco 0 + Bloco 1 Sprint Onboarding Membro |

## Entregas técnicas

### Backend — Bloco 0 (Plano de Clube como mensalidade paga)

**Schema (aditivo, zero migração de perda)**:
- Novo model `PlanoClube` com `nome`, `valorMensal` (Decimal), `cobra` (Boolean), `descricao`, `cooperativaId`, `ativo` (soft-delete).
- `ContratoConvenio.planoClubeId` (FK nullable) — vínculo do plano com convênio do tipo EMPRESA paga.
- `Cooperado.planoClubeId` + `Cooperado.adesaoClubeEm` — adesão opt-in INDIVIDUAL. **Regra dura:** NÃO setar nos dois lugares (gera cobrança DUPLA).
- `Cobranca.valorMensalidadeClube` (Decimal) + `Cobranca.planoClubeId` (FK) — componente escalar discriminado quando aplica.

**Services**:
- `PlanoClubeService` (Fatia 0.1) — CRUD multi-tenant com 404 cross-tenant + soft-delete + `resolverParaCobranca(planoClubeId, cooperativaId)` retorna null quando `cobra=false` OU `valorMensal=0` (defesa em profundidade).
- `CooperadoClubeService` (Fatia 0.3) — `aderir()` com INVARIANTE anti-cobrança-dupla: bloqueia adesão individual quando cooperado é membro ATIVO de convênio com `planoClubeId` não-nulo. `cancelar()` idempotente. Helper `resolverParaCobrancaIndividual()` pra Fatia 0.4.

**Integração nas cobranças (Fatia 0.4)**:
- `CobrancasService.create()` (individual) — após cálculo de energia: chama resolver opt-in → soma valor no `valLiq` + grava `valorMensalidadeClube` + `planoClubeId`.
- `CobrancasService.darBaixa()` — subtrai `valorMensalidadeClube` de `valorFinal` ANTES do hook contábil (não infla energia SCEE).
- `ConveniosCusteioService` (consolidada) — antes de `tx.cobranca.create`: se `snap.cobra && snap.valorMensal > 0 && membros.length > 0`, soma `membros.length × snap.valorMensal` na consolidada. Aditivo ao componente energia.

**UI admin**:
- `/dashboard/parceiros/[id]/planos-clube` — CRUD de planos de clube (Sheet/Drawer no padrão atual; refator UX inline futuro).
- Help texts explicando 3 caminhos (admin/conveniada/individual).

### Backend — Bloco 1 (Aprovação constrói o membro)

**Schema (aditivo)**:
- `Cooperado.pendenciaMotorMsg` + `Cooperado.pendenciaMotorEm` (Fatia 1.2) — pendência visível quando motor falha no cadastro.
- `Cooperado.consumoStashOcr` (Json) — stash leve do consumo capturado no cadastro pra reconciliação futura sem reupload de fatura.

**Fatia 1.1 — Validação de convite propaga contexto**:
- `ConvitesConvenioService.validarToken` agora seleciona `convenioId` + `convenio.empresaNome` + `permiteSemUc`.
- `PublicoController.validarConviteConvenio` propaga essas 2 chaves novas na resposta.

**Fatia 1.2 — Persistência de cota + pendência + stash**:
- Helper exportado `derivarCotaKwhMensal({consumoMedioKwh, historicoConsumo})` — fórmula `consumoMedioKwh ?? média(historicoConsumo)`, arredondamento 2 casas, 11 specs cobrindo edge cases (zero, NaN, histórico só zeros, fatura EDP real do Luciano).
- `PublicoController.cadastroWebV2` — `cotaKwhMensal` gravada na tx do Cooperado quando >0; `pendenciaMotorMsg` best-effort no catch do motor; `consumoStashOcr` populado pós-tx com snapshot completo.
- `CooperadosService.findAll()` retorna `pendenciaMotorMsg + pendenciaMotorEm` pra UI badge.
- `/dashboard/cooperados` (page.tsx) — badge "⚠️ Cadastro incompleto" amarela + tooltip com motivo completo + sub-linha truncada.

**Fatia 1.3 — Helper `construirMembroCompleto` no gate MEMBRO_ATIVO**:
- Novo `MembroBuilderService` em `backend/src/convenios/membro-builder.service.ts`.
- Resolução de ciclo DI: `forwardRef(() => MotorPropostaModule)` (MotorPropostaModule já importa ConveniosModule por D-FISCAL-2.4.3). `ClubeVantagensModule` sem ciclo.
- Inputs idempotentes: `{ cooperadoId, convenioId, cooperativaId }`.
- **Etapas (ordem importa)**:
  1. Validação anti-spoof — `cooperativaId` do Cooperado E do Convênio precisa bater.
  2. Flip `Cooperado.status` PENDENTE/PENDENTE_VALIDACAO → ATIVO **ANTES** do motor (motor.aceitar chama `marcarPendenteDocumentos` que flipa PENDENTE→PENDENTE_DOCUMENTOS — se rodasse depois, atropelaria).
  3. Motor.aceitar com `planoId` direto do plano custeado global (`cooperativaId=null + custeadoPorConvenio=true`). **NÃO passa `convenioCusteioId`** — o membro JÁ está MEMBRO_ATIVO pós-flip, e `adicionarMembro` estouraria "Cooperado já vinculado".
  4. Persistir pendência conforme resultado (limpa em sucesso; grava mensagem informativa quando cota=0 ou motor estourou).
  5. Matricular clube (no Bloco 1.3 ainda incondicional — refinado na Fatia 1.4 pra config-dependente).
- Wire em `ConvenioAprovacaoService.aprovarPorAdmin` DEPOIS do tx Serializable que flipa MEMBRO_ATIVO. `try/catch` externo — **NUNCA propaga** (aprovação já foi efetivada; falha aqui vira reconciliação manual).
- 10 specs Jest no helper + atualização dos 2 specs antigos (constructor ganhou 4º arg).
- Smoke E2E `smoke-fatia-1-3-construir-membro.ts` cobrindo 3 cenários: (a) cota>0 → contrato custeado + clube + pendência limpa, (b) sem cota (LEONARDO-like) → ATIVO + clube + pendência informativa (aprovação NÃO falha), (c) idempotência (2ª chamada bloqueada pelo guard estrito).

**Fatia 1.4 — Refinamentos + reconciliação + fix tenant**:
- Helper etapa 4 (matrícula clube) agora consulta `ConfigClubeVantagens.ativo` da cooperativa. Sem config OU `ativo=false` → pula sem falha. Razão: nem toda cooperativa oferece clube.
- `motor-proposta.service.ts:875` — D-novo-LISTA-ESPERA-TENANT fix inline: `tx.listaEspera.create` passa `cooperativaId: dono.cooperativaId` + `count()` da posição também filtra por tenant. Antes: fila global cross-tenant.
- `scripts/reconciliar-membros-oco.ts` — DRY-RUN reconciliação idempotente PER-STEP:
  - Lista MEMBRO_ATIVO + parciais (status ≠ ATIVO / sem contrato / sem clube / com pendência).
  - DRY-RUN default imprime ANTES vs DEPOIS proposto por membro.
  - Flag `--apply` invoca o helper (completa o que falta, no-op no que já está).
  - Filtros opcionais: `--tenant <coopId>`, `--membro <id>`.
- `scripts/smoke-fatia-1-4-integracao-cobranca.ts` — fecha o ciclo de cobrança end-to-end: (1) cadastro convite custeio + aprovação 2 portas → membro completo, (2) POST `/cobrancas` com `contratoId` do plano custeado → 400 com guard `custeadoPorConvenio` (cobrancas.service.ts:179), (3) ativa contrato manualmente + gera consolidada da Clinica Teste → `valorBruto=R$200000`, `valorLiquido=R$200000` (ALOCACAO_FIXA × R$1/kWh).

## Bugs resolvidos / catalogados

| # | Severidade | Causa raiz | Fix | Status |
|---|---|---|---|---|
| 1 | P1 multi-tenant | `motor-proposta.service.ts:875` criava ListaEspera sem `cooperativaId` → fila global cross-tenant (schema já tinha o campo nullable; só faltava popular) | Fix inline + `count()` da posição filtrado por tenant | ✅ RESOLVIDO `8e47737` (D-novo-LISTA-ESPERA-TENANT) |
| 2 | P1 arquitetural | Aprovação só flipava status — não construía o membro (sem contrato, sem clube). LEONARDO PIZZOL VIGNA estava com `status=PENDENTE` + `cotaKwhMensal=null` + sem contrato + sem progressão | Helper `construirMembroCompleto` no gate MEMBRO_ATIVO + reconciliação script-driven | ✅ RESOLVIDO `412b2da` + `8e47737` |
| 3 | P1 dados perdidos | Cadastro descartava `consumoMedioKwh` quando vinha por convite (motor falhava por `valorCooperado negativo` e o erro era engolido em log) | `cotaKwhMensal` persistida na tx + `pendenciaMotorMsg` best-effort + `consumoStashOcr` snapshot | ✅ RESOLVIDO `cfc6421` |
| 4 | P1 contexto perdido | `validarToken` do convite não retornava `convenioId` nem `permiteSemUc` → wizard tinha que confiar em params da URL (vetor de spoof) | Validação propaga ambos com anti-spoof do model | ✅ RESOLVIDO `d18e7f6` |
| 5 | P0 sistêmico (descoberto) | 218 membros MEMBRO_ATIVO parciais no tenant CoopereBR (Hangar + Condomínio Moradas + Clínica Teste + ...) — legado de antes das Fatias 1.1-1.4 | **Catalogado como tarefa P2 separada** — exige segmentação antes de `--apply` em massa (oco genuíno × SEM_UC legítimo × lista de espera × teste) | 📋 CATALOGADO (segmentação na próxima sessão) |
| 6 | P3 fiscal | Componente CLUBE entra como linha única em `Cobranca.valorMensalidadeClube` — sem detalhamento de natureza fiscal própria (mensalidade vs serviço) | Catalogado `D-novo-CLUBE-LANCAMENTO-FISCAL` P3 — refinar quando o sprint Contabilidade Tributária ativar | 📋 CATALOGADO |
| 7 | P3 UX fiscal | Cobrança individual com componente CLUBE não discrimina visualmente na fatura PDF | Catalogado `D-novo-FATURA-SEGREGADA-ITENS` P3 — refinar com Polimento UX | 📋 CATALOGADO |
| 8 | P3 housekeeping | Cadastro-web stash o consumo em `Cooperado.consumoStashOcr` (Json livre) em vez de criar `FaturaProcessada` completa (28 campos + pipeline OCR) | Catalogado `D-novo-CADWEB-FATURA-PROCESSADA` P3 — quando pipeline OCR estabilizar, considerar criar fatura sintética | 📋 CATALOGADO |

## Achados operacionais

- **Membro oco era sistêmico — 218 parciais detectados.** O DRY-RUN expôs que o bug arquitetural fechado pela Fatia 1.3 estava presente há semanas. Hangar (cooperados sintéticos com sufixo `Costa <n>`/`Ferreira <n>`/`Pereira <n>`) e Condomínio Moradas (sufixo `Apto <n>`) dominam. Reconciliar em massa SEM segmentar é arriscado: pode promover cooperado sintético a status real ou matricular no clube quem nunca deveria estar. **Decisão Luciano: segmentar primeiro, reconciliar depois.**
- **Ordem flip → motor importa.** Motor.aceitar chama `marcarPendenteDocumentos` que tem guard `PENDENTE/PENDENTE_VALIDACAO → PENDENTE_DOCUMENTOS`. Se o flip ATIVO viesse depois, o cooperado ficaria preso em PENDENTE_DOCUMENTOS. Invertendo a ordem: flip ATIVO primeiro → motor.aceitar vê ATIVO → marcarPendenteDocumentos é no-op idempotente.
- **`planoId` direto vs `convenioCusteioId`.** Passar `convenioCusteioId` no motor.aceitar aciona `adicionarMembro` — mas o membro JÁ está MEMBRO_ATIVO pós-flip da aprovação, então `adicionarMembro` estoura "Cooperado já vinculado". Solução: passar `planoId` direto do plano custeado global (mesma fonte que motor.aceitar usaria via custeioContext) — contrato sai custeado, vínculo de convênio NÃO é tocado (já existe).
- **forwardRef em ciclo DI Convenios↔MotorProposta.** ConveniosModule precisava importar MotorPropostaModule, mas MotorPropostaModule já importa ConveniosModule (D-FISCAL-2.4.3 — ConveniosMembrosService no `adicionarMembro` dentro da tx do motor). `forwardRef(() => MotorPropostaModule)` resolveu.
- **Smoke E2E programático com cleanup automático destrava confiança.** 25/25 passos em 32s no smoke 1.3 + 8/8 em 16s no smoke 1.4 sem precisar de Playwright/browser. LEONARDO-like (cenário b) confirma degradação graciosa em código real.

## Decisões estratégicas catalogadas

- **Plano de Clube é mensalidade PAGA** — não confundir com `ProgressaoClube` (tier BRONZE→PRATA→OURO→DIAMANTE) que é benefício gamificado. Plano de Clube tem `valorMensal` que entra em cobrança como componente escalar.
- **Matrícula no clube é CONFIG-DEPENDENTE.** Só matricula `ProgressaoClube BRONZE` quando `ConfigClubeVantagens.ativo === true` na cooperativa. Sem config → pula. Cooperativa não oferece clube → respeitado.
- **Cobrança como componente escalar discriminado** — `valorMensalidadeClube` somado ao `valorLiquido` (cobrado pelo gateway) MAS subtraído antes do hook contábil (não infla energia SCEE). Padrão simétrico nas 2 cobranças (individual e consolidada).
- **Aprovação CONSTRÓI o membro.** Princípio arquitetural duro: NÃO alocar recurso (contrato/vaga em usina/contábil) pra membro NÃO-APROVADO. Membro é construído no gate final que vira MEMBRO_ATIVO, não no cadastro.
- **Degradação graciosa total.** Motor estoura → catch + pendência visível, NUNCA propaga. Aprovação MEMBRO_ATIVO já foi efetivada; falha aqui vira reconciliação manual via script.
- **`construirMembroCompleto` é ÚNICO ponto de entrada.** Mesma função usada na aprovação (Fatia 1.3) E na reconciliação manual (Fatia 1.4). Idempotente PER-STEP: completa o que falta, no-op no que já está. Reconciliação invoca o helper DIRETO (não via HTTP) — não cai no guard estrito do `aprovarPorAdmin`.
- **218 membros parciais → tarefa P2 segmentar antes de reconciliar.** NÃO usar `--apply` em lote sem categorizar: oco genuíno (LEONARDO) × SEM_UC legítimo × lista de espera × cooperado sintético de teste. Promover sintético a ATIVO + matriculá-lo no clube é bug de dados.

## Próximo passo

**Bloco 2 do Sprint Onboarding Completo do Membro** — empresa pagadora visualiza o total de kWh consumido pelos funcionários (membros custeados) no portal da empresa conveniada. Fase 1 read-only obrigatória (mapear `web/app/conveniada/`, `backend/src/convenios/portal-empresa/`, fluxo de agregação de UCs por convênio, padrão de breakdown vs total).

## Pré-requisitos leitura próxima sessão (ordem fixa)

1. `docs/CONTROLE-EXECUCAO.md` (## ONDE PARAMOS topo + ## FRASE DE RETOMADA)
2. `~/.claude/projects/C--Users-Luciano-cooperebr/memory/MEMORY.md`
3. `docs/sessoes/2026-06-06-bloco-0-1-onboarding-membro.md` (esta)
4. `docs/sessoes/2026-06-05-hardening-golden-path-conv-ref.md` (sessão anterior — M23)
5. `docs/especificacao-circuito-cooper-token-convenio.md` (Bloco 2 + Fatias C/D/E/G futuras)
6. `backend/src/convenios/portal-empresa/` (portal da empresa conveniada atual)
7. `web/app/conveniada/convenio/[id]/page.tsx` (dashboard empresa)
8. `backend/src/convenios/convenios-membros.service.ts` (membros do convênio)
9. `CLAUDE.md` + `.claude/CLAUDE.md`
10. `git log --oneline -15`

## Carry-overs (não-bloqueantes)

- **⚠️ ACHADO PRA PRÓXIMA SESSÃO:** 218 membros parciais detectados no tenant CoopereBR pelo DRY-RUN. **NÃO** aplicar `--apply` em massa sem SEGMENTAÇÃO (oco genuíno × SEM_UC legítimo × lista de espera × teste sintético). Catalogado como tarefa P2 separada.
- **LEONARDO PIZZOL VIGNA reconciliado nesta sessão** (PASSO 2 do prompt Luciano) — ATIVO + clube BRONZE + pendência de consumo visível. Contrato dele NÃO foi forçado (cota perdida pré-Fatia 1.2). Próximo: reprocessar a fatura dele pra fechar o contrato (tarefa separada).
- 3 débitos novos catalogados (todos P3, sem urgência): `D-novo-FATURA-SEGREGADA-ITENS` (discriminação visual do componente CLUBE na fatura PDF) · `D-novo-CLUBE-LANCAMENTO-FISCAL` (natureza fiscal própria do CLUBE quando Contabilidade Tributária ativar) · `D-novo-CADWEB-FATURA-PROCESSADA` (criar FaturaProcessada completa em vez de stash Json — quando pipeline OCR estabilizar).
- 1 débito resolvido: `D-novo-LISTA-ESPERA-TENANT` P1 (fila multi-tenant fechada com fix inline + sem necessidade de backfill — fila atual era sintética).
- Carry-overs anteriores preservados: 6 débitos abertos da M23 (`D-novo-OTP-429-UX` P3 · `D-novo-OTP-DEV-RELAX` P3 · `D-novo-AUTO-INSCREVER-DEPRECATION` P3 · `D-novo-CAD-CONSUMO-MENSAL` P2 · `D-novo-CONVITE-MENUS-UX` P3 · `D-novo-TESTS-MOCK-PRISMA` P2) · `D-novo-CT-VALIDACAO-FISCAL` P0 (gate fiscal) · `D-novo-CT-MULTI-REGIME-CLASSIFICACAO` P1 · `D-novo-BM` P0 BLOQUEADOR REMOÇÃO PRÉ-PROD · 256 legados allowlist `lint:tenant`.

## Regras aplicadas na sessão

- **Decisão 23** — Fase 1 read-only obrigatória aplicada antes de cada Fatia (Bloco 0 mapeou as 3 tabelas afetadas; Bloco 1 mapeou LEONARDO real + motor.aceitar + cobrancas guard custeado).
- **Padrão anti-spoof multi-tenant** — `cooperativaId` validado em ambas as extremidades (Cooperado E Convênio). Anti-enumeração nos tokens inválidos (Fatia 1.1).
- **INVARIANTE anti-cobrança-dupla na fonte** — não em filtro frágil. `CooperadoClubeService.aderir` bloqueia opt-in individual quando cooperado é membro de convênio com `planoClubeId` não-nulo.
- **Atomicidade total via `$transaction Serializable`** — mantida em todos os caminhos críticos.
- **Degradação graciosa em integração externa** — motor.aceitar pode falhar (cota=null, sem usina). Catch + pendência visível + NUNCA propaga.
- **Idempotência PER-STEP** — helper completa o que falta, no-op no que já está. Reconciliação invoca o helper direto.
- **Smoke E2E programático versionado** — 25/25 + 8/8 sem precisar de Playwright/browser. Cleanup automático.
- **Regra commit SCOPED** — nenhum `git add .` ou `-A`; arquivos listados explicitamente. 8 commits SCOPED no dia.
- **Regra 18/05 `isAmbienteReal()`** — nenhum uso de `NODE_ENV` direto.
- **Regra 14/05 contatos teste** — smoke usa telefones whitelisted (`5511999988*`, `5511999977*`, `5511999966*`) — não dispara WA real.
- **Regra DTO strict** — DTOs Zod nos endpoints públicos novos; specs antes de commit (12/12 do helper + 234/234 do módulo convenios verdes).
- **Catalogação preventiva** — bugs descobertos sem fix imediato viram débitos (3 novos P3) com escopo + estimativa + status.

## Frase comandante

Ver `docs/CONTROLE-EXECUCAO.md` seção `## FRASE DE RETOMADA — próxima sessão Code` (Decisão 24 — local único).
