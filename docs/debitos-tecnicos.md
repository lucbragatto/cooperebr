# Débitos técnicos — SISGD

> Lista consolidada de pendências técnicas conhecidas. Cada item registra
> origem, impacto e prioridade. Atualizar quando débito é resolvido OU quando
> aparece novo durante uma sessão.

**Última atualização:** 2026-05-03 fechamento — **maratona de 4 fases concluídas** (A + B + B.5 + C.1) com 20 commits, validação E2E 48/48, e 8 débitos resolvidos (D-30R + duplo desconto + DINAMICO + snapshots T3/T4 + cross-tenant + B13 + FIXO economia zerada + spec T8). 3 débitos P3 catalogados como novos.

---

## P0 — Bloqueia produção real (descoberto sessão claude.ai 30/04)

### D-30A — Sistema permite alocação > 25% por cooperado-usina (concentração violando regulação)

**Severidade:** P0
**Detectado em:** 2026-04-30 (sessão claude.ai — caso Exfishes anonimizado)
**Impacto:** risco regulatório ATIVO em produção

Caso Exfishes (cooperado real, anonimizado) em abril/2026 ocupava **39,55% da Usina A (GD I)** — muito acima do limite 25% adotado por ANEEL/distribuidoras como referência de não-concentração de SCEE. **Sistema não bloqueou nem alertou.**

Investigação em sessão mostrou outras concentrações suspeitas hoje:
- **FIGATTA**: 35% na Usina GD II (55.000 kWh / 157.000 kWh)
- **CRIAR Centro de Saúde**: 16% na mesma Usina GD II (25.000 kWh)
- **Agregado FIGATTA + CRIAR**: 51% em apenas 2 cooperados

**Resolução:**
- **Sprint 0** (Auditoria Regulatória Emergencial — P0 urgente, paralelo a Doc-0): listar e regularizar.
- **Sprint 5** (Módulo Regulatório ANEEL): implementar validação automática via flag `concentracaoMaxPorCooperadoUsina` (default 25%), bloqueando aceite no Motor + alocarListaEspera quando ultrapassa.

**Status 2026-05-11 (Sprint 0 passos iniciais):**

Relatório de auditoria gerado em `docs/relatorios/2026-05-11-auditoria-concentracao-25-pct.md` cobrindo 62 contratos (ATIVO + PENDENTE_ATIVACAO com `percentualUsina`) em 3 cooperativas (CoopereBR 71 contratos / Teste 0 / TESTE-FASE-B5 6).

**Achados:**
- Casos > 25%: **0** ✅
- Casos limítrofes (20-25%): **0**
- Cross-check nominais:
  - ⚪ **FIGATTA** — limpo (não encontrado no banco atual)
  - ⚪ **CRIAR** — limpo
  - 🟢 **EXFISHES** — presente (`EXFISHES TERMINAL PESQUEIRO SPE LTDA` na CoopereBR / Usina Linhares) com **0,00%**

**Achado meta importante (Decisão 21):** distribuição por usina mostra valores irrealisticamente baixos — `Usina Linhares` da CoopereBR tem **61 cooperados** com `percentualUsina = 0,00%` cada. Soma da coluna `percentualUsina` ≈ 0%. Significa que o campo está populado mas não reflete a alocação real — provavelmente não foi calculado/atualizado depois da criação inicial dos contratos. **Vale catalogar como achado novo** em sessão futura (não bloqueia P0 estrutural, mas torna a auditoria visualmente "vazia" quando talvez houvesse concentração real escondida no `kwhContratoAnual`/`kwhContrato` × `usina.capacidadeKwh`).

**O risco P0 permanece estrutural:** sistema continua sem flag de proteção `concentracaoMaxPorCooperadoUsina`. Quando rodar em prod com centenas/milhares de contratos COM `percentualUsina` populado corretamente, probabilidade de surgir caso > 25% aumenta. Estrutura do relatório está pronta pra rodar em prod (mesma query agrupando por tenant).

**Próximos passos (continuação Sprint 0):** cron diário + dashboard `/dashboard/super-admin/auditoria-regulatoria` + investigação do achado meta (`percentualUsina` zerado em 61 contratos).

---

### D-30B — Mudança de classe GD na realocação não detectada — caso Exfishes (R$ 310k/ano)

**Severidade:** P0
**Detectado em:** 2026-04-30 (sessão claude.ai)
**Impacto:** R$ 310.000/ano de prejuízo ao cooperado por decisão cega do sistema

Em maio/2026, alguém (admin do parceiro) realizou **realocação cega** de Exfishes de Usina A (GD I) para Usina B (GD III). Sistema processou normalmente. Resultado:
- Fatura saltou de **~R$ 6.600/mês** (média histórica) para **R$ 32.486/mês** (mês imediato pós-realocação).
- Mudança implícita de **classe GD I → GD III** = mudança de % Fio B (isento → 60% em 2026) = explosão da tarifa efetiva.
- Sistema tratou a mudança como trivial (só `Contrato.usinaId` mudou no banco). Nenhum alerta, nenhuma simulação prévia.

**Status atual** (informado por Luciano em sessão): Exfishes está com 0,05% na Usina B "queimando saldo"; plano é mover 100% pra Usina A novamente.

**Resolução:**
- **Sprint 5** (Módulo Regulatório ANEEL): cálculo de classe GD efetiva via `Usina.classeGd` herdada pela UC; validação de mudança de classe no fluxo de realocação com simulação prévia obrigatória (mostrar "ao mover esse cooperado, a fatura projetada vai de X para Y").
- **Sprint 8** (Política + Engine de Otimização): Engine sugere realocações respeitando classe GD do cooperado; bloqueia realocações que mudam classe sem aprovação explícita.

---

## P1 — Bloqueia entrada de parceiro real

### D-30C — Schema 1:1 Contrato↔Usina bloqueia UC com créditos de múltiplas usinas

**Severidade:** P1
**Detectado em:** 2026-04-30 (sessão claude.ai)
**Onde:** `backend/prisma/schema.prisma` model `Contrato` (campo `usinaId String?`)

Schema atual obriga UC a estar atrelada a **uma única usina** via `Contrato.usinaId`. Decisão de produto (Sprint 5): permitir uma UC consumir de **múltiplas usinas** (split inteligente de créditos), controlado por flag `multipleUsinasPerUc`.

**Resolução:** **Sprint 5** — criar modelo de junção N:M (`UcUsinaRateio` ou similar) com `ucId` + `usinaId` + `percentualRateio`. Validação de soma = 100% por UC. Cobrança calculada por par (UC, Usina, mês).

---

### D-30D — Sem campo `dataProtocoloDistribuidora` na UC

**Severidade:** P1
**Detectado em:** 2026-04-30 (mapeamento regulatório — `docs/sessoes/2026-04-30-mapeamento-regulatorio-existente.md`)
**Onde:** `backend/prisma/schema.prisma` model `Uc`

Hoje schema tem `Usina.dataHomologacao` mas **não tem `Uc.dataProtocoloDistribuidora`** (data em que a UC foi protocolada para SCEE na distribuidora). Esse campo é insumo crítico pra:
- Determinar **classe GD da UC** com base na data de protocolo (não só na data de homologação da usina).
- Auditoria regulatória (Sprint 0).
- Validação Lei 14.300/2022 (cutoff 07/01/2023).

**Resolução:** **Sprint 5** (parte do escopo expandido).

---

### D-30E — Sem `RegrasFioB` cadastrado — tabela 2024-2029 inexistente no sistema

**Severidade:** P1
**Detectado em:** 2026-04-30 (mapeamento regulatório)
**Onde:** schema sem modelo dedicado

Tabela progressiva do Fio B (2023: 15% → 2029: 100%) **não existe** como dado estruturado no sistema. Spec do Assis (`docs/specs/PROPOSTA-GD1-GD2-FIOB-2026-03-26.md`) propunha `const PERCENTUAL_FIO_B = {...}` em código, mas isso é frágil (ano novo precisa deploy).

**Resolução:** **Sprint 5** — criar modelo `RegrasFioB` (`ano: Int`, `classeGd: ClasseGd`, `percentualFioB: Decimal`). Seed inicial com tabela 2022-2029. UI admin pra ajustar futuros (caso ANEEL revise).

---

### D-30H — Termo de adesão cita RN 482/2012 (defasada desde Lei 14.300/2022)

**Severidade:** P1
**Detectado em:** 2026-04-30 (mapeamento regulatório — commit `71dce8b`)
**Onde:** `web/app/assinar/page.tsx:33,59`

```tsx
// linha 33:
"...conforme regulamentação da ANEEL (Resolução Normativa nº 482/2012 e suas alterações)."

// linha 59:
"1. Representá-lo(a) perante a distribuidora de energia elétrica para fins de adesão ao sistema
   de compensação de energia elétrica, nos termos da Resolução Normativa ANEEL nº 482/2012
   e suas alterações;"
```

**Impacto:** clientes novos assinando termo legalmente desatualizado. Lei 14.300/2022 + RN 1.000/2021 substituíram a RN 482. Risco de questionamento jurídico.

**Resolução:** **Sprint 3** (Banco de Documentos / Assinafy) — atualizar termo para citar Lei 14.300 + RN 1.000/2021. Validar com advogado especializado em ANEEL antes de publicar.

---

### D-30I — Bot CoopereAI cita RN 482/2012 no system prompt

**Severidade:** P1 (mesmo problema D-30H)
**Detectado em:** 2026-04-30 (mapeamento regulatório)
**Onde:** `backend/src/whatsapp/coopere-ai.service.ts:25`

```ts
// linha 25:
A CoopereBR é uma cooperativa de energia solar que permite economizar na conta de luz
sem instalar nada em casa. Atuamos no modelo de Geração Distribuída (GD), regulamentado
pela ANEEL (Resolução Normativa nº 482/2012).
```

Bot responde para leads e cooperados citando regulação defasada. Mesmo risco do D-30H em escala maior (todo lead que conversa com bot).

**Resolução:** **Sprint 3** ou Sprint 0 (correção rápida do system prompt). Mudar para "Lei 14.300/2022 e Resolução Normativa ANEEL nº 1.000/2021".

---

### D-30J — Sem cláusula contratual de alocação dinâmica no Termo de Adesão

**Severidade:** P1
**Detectado em:** 2026-04-30 (sessão claude.ai — análise de planilha de cláusulas como referência)
**Onde:** Termo de Adesão atual

Termo de Adesão atual **não menciona** que cooperado pode ser realocado entre usinas (consequência: caso Exfishes, cooperado pode questionar mudança não-consentida). Lei 14.300 e práticas de mercado exigem cláusula explícita de "alocação dinâmica" autorizada.

**Resolução:** **Sprint 3** — incluir cláusula no template do Termo: "Cooperado autoriza Parceiro a realocar UC entre usinas geradoras vinculadas, respeitando regras da distribuidora local e Lei 14.300/2022. Mudanças que aumentem custo efetivo serão comunicadas com X dias de antecedência."

---

### D-30M — Validação E2E do bônus MLM cascata pendente

**Severidade:** ~~P1~~ → **P2** (reclassificado em 02/05 após validação prévia)
**Detectado em:** 2026-04-30 noite (E2E commit `f3a0434`)
**Reclassificado em:** 2026-05-02 manhã (investigação Code com leitura de código)

**Diagnóstico atualizado:** **NÃO É BUG.** Pipeline está correto e cabeado:
- `cobrancas.service.ts:519-528` emite evento `cobranca.primeira.paga` quando `totalPagas === 1`
- `indicacoes.service.ts:22` ouve com `@OnEvent('cobranca.primeira.paga')`
- `processarPrimeiraFaturaPaga()` cria `BeneficioIndicacao` na linha 286

`ConfigIndicacao` da CoopereBR está ativa:
- `ativo=true`
- `modalidade=PERCENTUAL_PRIMEIRA_FATURA`
- `maxNiveis=2`
- `niveisConfig=[{nivel:1, percentual:10%}, {nivel:2, percentual:2%}]`

**Por que 9 indicações estão `PRIMEIRA_FATURA_PAGA` com 0 `BeneficioIndicacao`:**

As 9 Indicações foram criadas por **seed histórico** (jun-ago/2025) com `primeiraFaturaPagaEm` já setado. Foram inseridas direto no banco — não passaram pelo fluxo real, por isso evento nunca disparou.

Cobranças PAGAS recentes (5 últimas, 23-27/04) são de cooperados **não indicados** — fluxo real ainda não foi exercitado em produção/sandbox em nenhuma combinação cooperado+indicação.

**Próximo passo:** quando primeiro cooperado indicado pagar via Caminho B (Asaas produção), validar E2E. Se gerar `BeneficioIndicacao` corretamente, **fechar D-30M definitivamente**.

**Não é bug. Não bloqueia produção.**

---

## P2 — Tem mitigação mas precisa resolver antes de produção pública

### D-30F — Sem cron de auditoria de concentração por usina

**Severidade:** P2
**Detectado em:** 2026-04-30 (sessão claude.ai)

Hoje não há cron ou job que rode diariamente/semanalmente verificando se alguma concentração ultrapassa o limite. Sistema é reativo (só valida no aceite/realocação). Caso Exfishes mostra que **mudanças de capacidade da usina ou de consumo do cooperado podem fazer a concentração crescer organicamente** sem qualquer ação explícita.

**Resolução:** **Sprint 5** — cron diário que recalcula `(kwhContrato / Usina.capacidade) × 100` por contrato ATIVO; alerta quando > flag `concentracaoMaxPorCooperadoUsina`.

---

### D-30G — Sem mecanismo de "queima de saldo" ativo (saldo > 2 meses parado)

**Severidade:** P2
**Detectado em:** 2026-04-30 (sessão claude.ai — caso Exfishes)

Caso Exfishes acumulou **118.153 kWh de saldo** (≈ 1,6 meses de consumo do próprio cooperado parado). ANEEL prevê validade de 60 meses do saldo, mas saldos grandes parados:
- Indicam **superdimensionamento de cota** (cooperado com cota maior que consumo real).
- Aumentam **risco de perda total** se cooperado sair antes de queimar.
- Sinal de alerta operacional para o admin.

**Resolução:** **Sprint 0** (auditoria) + **Sprint 5** — relatório de UCs com saldo > 2 meses; sugestão de redução de cota ou realocação.

---

### D-30L — Spec Fio B do Assis (26/03) nunca implementada — marcada como insumo histórico

**Severidade:** P2
**Detectado em:** 2026-04-30 (mapeamento regulatório)
**Onde:** `docs/specs/PROPOSTA-GD1-GD2-FIOB-2026-03-26.md`

Spec detalhada (188 linhas) do Assis (26/03/2026) com schema `tusdFioA`/`tusdFioB`/enum `ModalidadeGD` (`GD1_ATE_75KW`/`GD1_ACIMA_75KW`/`GD2_COMPARTILHADO`), tabela progressiva 2022-2029, refactor do motor de cobrança. **Nunca implementada** — schema atual não tem nenhum desses campos.

**Decisão sessão claude.ai 30/04:** marcar como **insumo histórico**. Arquitetura nova (Sprint 5) usa taxonomia diferente:
- Spec Assis: `GD1_ATE_75KW`/`GD1_ACIMA_75KW`/`GD2_COMPARTILHADO` (3 modalidades por potência+contexto).
- Decisão 30/04: **GD I/GD II/GD III** (3 classes por **data de homologação** com cutoff 07/01/2023 e 07/01/2024).

**Resolução:** **Sprint 5** — adotar nova taxonomia. Trechos reutilizáveis da spec (tabela de % Fio B 2022-2029, fórmula `tarifaEfetiva = tusdFioA + (tusdFioB × pct) + TE`) podem ser portados se compatíveis. Spec marcada com banner em REGULATORIO-ANEEL.md Seção 16, Caso C.

---

### D-30N — AuditLog interceptor não implementado (escopo revisado)

**Severidade:** P2 (mantida)
**Detectado em:** 2026-04-30 noite (E2E commit `f3a0434`)
**Revisado em:** 2026-05-02 manhã (validação prévia com leitura de código)

**Diagnóstico anterior:** "interceptor existe mas não foi ativado".

**Diagnóstico revisado:** **interceptor não existe.** Sprint 13a Dia 1 criou
APENAS o `model AuditLog` no `schema.prisma:1740`. Nenhum arquivo TypeScript
em `backend/src/` referencia `AuditLog` ou `auditLog` (`grep -rn` retorna 0).

Schema completo no Prisma (`usuarioId`, `acao`, `recurso`, `metadata`, `ip`,
índices criados) — pronto pra usar quando interceptor for criado.

**O que falta criar (não apenas ativar):**
- `AuditLogInterceptor` NestJS
- Decorator `@Auditavel({ acao: 'cooperativa.suspender' })`
- Helper `auditLog.gravar(acao, recurso, metadata)` pra usar em services
- `AuditModule` registrando provider + APP_INTERCEPTOR
- Aplicar decorator em endpoints sensíveis

**Resolução:** **Sprint 5** ou **Sprint 6** (auditoria geral) — escopo é
implementação completa, não ativação.

---

### D-30O — `FaturaProcessada.mesReferencia` null em todas

**Severidade:** P2 (mantida — bug real, fix simples)
**Detectado em:** 2026-04-30 noite (E2E commit `f3a0434`)
**Revisado em:** 2026-05-02 manhã (validação prévia com leitura de código)

Todas as 5 `FaturaProcessada` no banco têm `mesReferencia=null`. OCR Claude AI
extrai dado da fatura (`dadosExtraidos.mesReferencia` está populado) mas o pipeline
não copia esse campo pra coluna dedicada.

**Causa raiz precisa (validação prévia 02/05):** existem **2 caminhos** que chamam
`criarFaturaProcessada`:

- `faturas.service.ts:463` (caminho `upload-concessionaria`) — **passa**
  `mesReferencia: dto.mesReferencia` ✓ corretamente
- `faturas.service.ts:302` (caminho `extrair` — OCR direto via wizard admin
  ou `/cadastro` público) — **NÃO passa** `mesReferencia` ✗

Todas as 5 `FaturaProcessada` no banco vieram do caminho `:302` (caminho
`upload-concessionaria` nunca foi exercitado em produção).

**Fix simples:** ~3 linhas em `faturas.service.ts:302+`:
```ts
const fatura = await this.criarFaturaProcessada({
  cooperadoId: dto.cooperadoId,
  ucId: dto.ucId ?? null,
  mesReferencia: dadosExtraidos.mesReferencia ?? null,  // ← ADICIONAR
  ...
});
```

**Estimativa:** 5-10 min Code + 1-2 specs Jest. Pode ir antes do Sprint 2.

**Resolução:** **Sprint 2** (OCR-Integração) ou **fix antecipado** (qualquer momento).

---

### D-30P — Caminho público de convênio sem `indicacaoId` ✅ RESOLVIDO

**Severidade:** P2 → ✅ RESOLVIDO em 01/05/2026
**Detectado em:** investigação 01/05 (commit `5ee9351`)
**Resolvido em:** commit `fa9dc72` (chamada direta Prisma trocada por `adicionarMembro()`)

Sprint 9B criou caminho público (`/cadastro?ref=`) que vinculava cooperado a
convênio direto via Prisma, pulando service `adicionarMembro()`. Resultado:
`ConvenioCooperado.indicacaoId` ficava null em todos os 215 vínculos atuais
(seed) — quebraria rastreabilidade de cooperados reais quando entrarem.

Fix: caminho público agora usa `adicionarMembro()` que chama
`registrarIndicacaoConvenio()` se `convenio.registrarComoIndicacao=true`,
populando `indicacaoId`. 5 specs Jest cobrindo cenários verde.

---

### D-30Q — Caminho público de convênio sem `recalcularFaixa` ✅ RESOLVIDO

**Severidade:** P2 → ✅ RESOLVIDO em 01/05/2026
**Detectado em:** investigação 01/05 (commit `5ee9351`)
**Resolvido em:** commit `fa9dc72` (mesma correção do D-30P)

Mesmo caminho público pulava `recalcularFaixa()`, então faixa do convênio
só atualizava no cron diário 6h depois. Em produção isso significaria
descontos errados pro novo cooperado durante 6h após cadastro.

Fix: caminho público agora usa `adicionarMembro()` que chama
`progressaoService.recalcularFaixa(convenioId, 'NOVO_MEMBRO')`. Faixa atualiza
imediatamente no cadastro.

---

### D-30R — ✅ RESOLVIDO em 03/05/2026 (Fase B)

**Resolvido em:** commits `eb7f0ce` (helper) + `070c1ab` (5 caminhos) + `f5453b7` (engine) + `4c8e946` (specs).

**Decisão B33 aplicada:** `tarifaContratual` é semanticamente pós-desconto. Engine consumidora não aplica desconto novamente. Helper `calcularTarifaContratual` virou fonte única de verdade pra todos os 5 caminhos de criação de contrato + recálculo mensal DINAMICO.

**Fix expandido cobriu:**
- Snapshot populado em 4 caminhos (Motor.aceitar, contratos.service.create, cooperados.service, migracoes-usina). 5º caminho (usinas.service:promoverListaEspera) documentado como exceção #5 — contrato sem plano, snapshot deferido pra atribuição tardia.
- Duplo desconto eliminado em `faturas.service.ts:1840+`.
- DINAMICO `NotImplementedException` substituído por implementação real usando helper.
- OCR `criarFaturaProcessada` extrai `valorCheioKwh` + `tarifaSemImpostos` automaticamente.

**Forward-only:** 72 contratos legados não foram backfilled (decisão B33.5 — Caminho C). Continuam com `tarifaContratual=null`. Quando admin tentar cobrar COMPENSADOS sobre contrato legado, engine lança erro explícito ("Contrato sem snapshot — recrie ou backfill").

**Backfill dos 72 contratos legados — ADIADO INDEFINIDAMENTE (atualizado 2026-05-12):**

- **Razão:** provavelmente substituído por **re-cadastro/import correto** quando produção real subir via Caminho A (Fatia A canário). Backfill cego sobre dados fictícios é antitrabalho.
- **Não bloqueia nada operacional hoje:** `BLOQUEIO_MODELOS_NAO_FIXO=true` protege — engine COMPENSADOS/DINAMICO desativada em prod.
- **Reavaliar quando:** canário Caminho A validar 1 cooperado real em COMPENSADOS. Se re-cadastro virar caminho preferido, backfill é arquivado. Se persistir necessidade de migrar legados, abre nova sub-fatia em Fatia A.

**Pendente Fase B.5:** validação E2E manual com cooperados teste novos antes de desativar `BLOQUEIO_MODELOS_NAO_FIXO`.

---

### ~~D-30R [HISTÓRICO PRÉ-RESOLUÇÃO] — `Motor.aceitar()` não popula `Contrato.tarifaContratual` (snapshot ausente)~~

**Severidade:** P2
**Detectado em:** 2026-04-30 noite (E2E commit `f3a0434`)
**Validado em:** 2026-05-02 manhã (investigação Code com leitura de código)

**Causa raiz precisa:** `motor-proposta.service.ts:467+` (método `aceitar()`)
calcula:
- `valorContrato` (linha 733) — só pra FIXO_MENSAL
- `tarifaContratualPromocional` (linha 707) — só se há promoção
- `valorContratoPromocional` (linha 709) — só se há promoção + FIXO

**NÃO calcula `Contrato.tarifaContratual` "normal"** (não-promocional). Campo
fica `null` em todos os contratos COMPENSADOS criados via Motor.

**Confirmação no banco (snapshot 02/05):**
- **72 contratos** com `tarifaContratual=null` (100% dos contratos)
- **0 contratos** com `tarifaContratual` preenchida
- Maioria CREDITOS_COMPENSADOS (CTR-324704, CTR-652787, CTR-2026-0001, etc.)

**Impacto quando engine COMPENSADOS for ativada:**
- Cobrança cai em fallback `tarifaApurada = totalAPagar / consumoAtual` 
- Esse fallback é conceitualmente errado (totalAPagar já tem compensação aplicada)
- Cooperado pagaria valor errado

**Fix proposto** (~5-10 linhas em `motor-proposta.service.ts:680+`):

Adicionar antes de `tx.contrato.create`:
```ts
// Snapshot tarifa contratual normal (não-promocional)
// Necessário pra COMPENSADOS calcular valor correto.
const tarifaContratualNormal = Math.round(
  Number(r.kwhApuradoBase) * (1 - Number(r.descontoPercentual) / 100) * 100000
) / 100000;
```

E incluir no `data` do `tx.contrato.create`:
```ts
tarifaContratual: tarifaContratualNormal,
```

**Backfill necessário:** os 72 contratos existentes precisam ter `tarifaContratual`
populada retroativamente (script de migração one-shot ou cron de backfill).

**Estimativa:** 30 min Code (fix + spec) + 15 min script backfill.

**Resolução:** **Sprint 2** (OCR-Integração + COMPENSADOS) ou **fix antecipado**
(qualquer momento — bloqueia validação real do COMPENSADOS).

---

## P3 — Pequeno, não bloqueia mas é dívida técnica

### [NOVOS — sessão 03/05] Débitos P3 catalogados durante a maratona

#### D-FASE-A-1 — 3 specs DI pré-existentes falhando

**Severidade:** P3
**Detectado em:** 2026-05-03 (Fase B, suite Jest)
**Onde:** `cooperados.controller.spec.ts`, `cooperados.service.spec.ts`, `usinas.controller.spec.ts`

3 testes "should be defined" falham com `Nest can't resolve dependencies of CooperadosService (UsinasService at index [2])`. Confirmado **pré-existente** via `git stash` (falham mesmo no commit anterior à Fase A). Não impactam runtime — backend sobe limpo via PM2.

**Resolução:** ajustar `RootTestModule` dos 3 specs pra incluir `UsinasService` como provider. ~30 min Code, baixa prioridade.

#### D-FASE-B-1 — Snapshots na atribuição tardia de plano (caso usinas.service.ts:306)

**Severidade:** P3
**Detectado em:** 2026-05-03 (Fase B, exceção #5 dos 5 caminhos de criação de contrato)
**Onde:** `backend/src/usinas/usinas.service.ts:306`

Promoção da lista de espera cria contrato **sem plano** (status `PENDENTE_ATIVACAO`, `percentualDesconto: 0`). Snapshot de tarifa não pode ser populado nesse momento porque não há plano associado.

Quando admin **atribui plano depois** via UI (função `atribuirPlanoAoContrato()` ainda não existe), snapshot precisa ser populado via helper canônico `calcularTarifaContratual` lendo fatura mais recente do cooperado.

**Resolução:** criar função `atribuirPlanoAoContrato(contratoId, planoId)` em `contratos.service.ts` que popula `tarifaContratual` + `valorContrato` + `valorCheioKwhAceite` + `baseCalculoAplicado` + `tipoDescontoAplicado`. ~1h Code + UI.

#### D-FASE-A-2 — Whitelist `/cadastro` no interceptor `web/lib/api.ts`

**Severidade:** P3 (latente, não causa dano hoje)
**Detectado em:** 2026-05-03 (Fase A, observação durante validação multi-tenant)
**Onde:** `web/lib/api.ts:26-35`

Interceptor de resposta redireciona pra `/login` em caso de 401. Whitelist atual: `/login` e `/portal/login`. **`/cadastro` não está incluído.**

Se algum dia alguém adicionar `api.get('/planos')` numa página dentro de `/cadastro` (em vez de `fetch` direto), visitante anônimo seria redirecionado pra `/login` em vez de receber erro silencioso. Hoje **não acontece** — `/cadastro/page.tsx:200` usa `fetch()` direto e `/planos/ativos` é `@Public`.

**Resolução:** adicionar `/cadastro` na whitelist OU manter convenção "rotas públicas usam `fetch` direto". 5 min Code.

---

### D-30K — Conflito de namespace `/diagnostico` entre healthcheck atual e Sprint 9

**Severidade:** P3
**Detectado em:** 2026-04-30 (mapeamento regulatório)
**Onde:** `backend/src/faturas/faturas.controller.ts:139` — `@Get('diagnostico')`

Endpoint atual `GET /faturas/diagnostico` é **healthcheck técnico** (verifica config_tenant, faturas_processadas, bucket Supabase, campos novos cooperado). **Sprint 9** introduzirá **Motor de Diagnóstico Pré-Venda** que ocupará rota `/diagnostico` (frontend) + endpoints `/diagnostico/*` (backend). Risco de confusão semântica.

**Resolução:** **Sprint 9** — **renomear** endpoint atual `/faturas/diagnostico` para `/faturas/healthcheck`. Atualizar tela admin que consome (se houver) e documentação.

---



### [RESOLVIDO 03/05] Bugs cross-tenant em `/planos/` + lacuna B13 seed (Fase A)

**Detectado em:** 2026-05-02 (relatório Code item 1.6) + sessão 02/05 (lacuna B13)

**Severidade:** P1 (cross-tenant em CRUD admin) + P2 (seed incoerente)

**Status:** ✅ **RESOLVIDO em 03/05 (commits `69e2d6c`, `5f70ce2`, `7722ce3`)**

**Problemas encontrados:**

1. `findAll()` sem filtro multi-tenant — qualquer ADMIN via planos cross-tenant.
2. `findOne(id)` sem cross-tenant guard — ADMIN podia ler plano de outro parceiro pelo ID.
3. `create()` não populava `cooperativaId` — todo plano nascia global, mesmo o criado por ADMIN.
4. `remove()` count de contratos sem filtro de tenant — falso positivo cross-tenant podia bloquear delete.
5. Seed `onModuleInit` criava `Plano Básico` com `CREDITOS_COMPENSADOS` em ambiente bloqueado por `BLOQUEIO_MODELOS_NAO_FIXO=true` — primeiro plano do sistema era inutilizável (lacuna B13).

**Fix aplicado:**

- `findAll(reqUser?)`: SUPER_ADMIN sem filtro; ADMIN próprios + globais; sem reqUser = vitrine pública.
- `findOne(id, reqUser?)`: cross-tenant guard. ForbiddenException pra ADMIN tentando ler plano de outro parceiro.
- `create(dto, reqUser)`: SUPER_ADMIN escolhe escopo; ADMIN forçado pra próprio tenant (ignora `dto.cooperativaId`).
- `update(id, dto, reqUser)`: cross-tenant guard via findOne + bloqueio de mudança de `cooperativaId` por ADMIN.
- `remove(id, reqUser)`: cross-tenant guard + count de contratos filtrado por tenant em ADMIN.
- Seed muda pra `FIXO_MENSAL` (modelo ativo único hoje).
- DTOs `cooperativaId` opcional.

**UI condicional:** SUPER_ADMIN tem campo "Escopo do plano" (Global vs específico de parceiro X). ADMIN não vê campo (backend força próprio tenant).

**Cobertura:** 20 specs Jest verde (10 da Fase A + 10 robustez auxiliar).

**Lições:**
1. Disciplina multi-tenant precisa ser revisada em todos os módulos com CRUD admin — `lead-expansao` e `cooperativas` já tinham padrão; `planos` ficou de fora até Fase A.
2. Seeds em `onModuleInit` precisam respeitar flags de bloqueio do projeto. Recomendação genérica: seed cria estado mínimo viável no bloqueio mais conservador.

---

### [RESOLVIDO 28/04] IDOR multi-tenant em endpoints `/cooperativas/`

**Detectado em:** 2026-04-28 (Sprint 13a Dia 3, etapa 1 — audit prévio de segurança)

**Severidade na descoberta:** P0 (bloqueador onboarding Sinergia)

**Status:** ✅ **RESOLVIDO no mesmo dia** (Sprint 13a Dia 3, etapa 1.5)

**Vulnerabilidades encontradas:** 6 endpoints sem isolamento multi-tenant para perfil ADMIN — 4 de READ, 2 de WRITE críticos. ADMIN da Cooperativa A poderia ler/editar/sabotar dados da Cooperativa B (multa, juros, plano, ativo, dados cadastrais, link de convite).

Endpoints afetados:
- `GET /cooperativas/:id`
- `GET /cooperativas/:id/painel-parceiro`
- `GET /cooperativas/:id/qrcode`
- `GET /cooperativas/financeiro/:id`
- `PATCH /cooperativas/financeiro/:id` ← **WRITE crítico**
- `PUT /cooperativas/:id` ← **WRITE crítico**

**Como passou despercebido:** ambiente com 1 parceiro (CoopereBR) + 1 trial. IDOR multi-tenant é invisível sem segundo tenant real. Bug latente, exploração só começaria quando Sinergia (Consórcio) entrasse.

**Fix aplicado:** helper `assertSameTenantOrSuperAdmin(user, cooperativaIdAlvo)` em `backend/src/auth/tenant-guard.helper.ts`, aplicado nos 6 endpoints + novo endpoint `GET /saas/parceiros/:id/saude` (Sprint 13a Dia 3 etapa 3). Specs Jest (helper isolado + controller integrado): 16/16 passing.

**Lições:**
1. **Audit de segurança como etapa padrão** quando entrega tela ou endpoint que receba `cooperativaId` via parâmetro. Adicionar regra ao `CLAUDE.md`.
2. **Investigar antes de construir** — esta vulnerabilidade só apareceu porque investigamos as telas existentes ANTES de apontar o chevron (ETAPA 5 do prompt do Dia 2). Se tivéssemos só apontado, IDOR ficaria latente até Sinergia migrar.
3. Padrão único (helper) deve ser referência pra outros módulos com endpoints `:id` apontando pra cooperativaId — ver débito P2 derivado abaixo.

---

## P2 — Tem mitigação mas precisa resolver antes de produção pública

### D-29F — FaturaSaas sem integração Asaas + sem comunicação parceiro + sem fluxo de pagamento (Sprint 6 incompleto) — DECOMPOSTO EM 2026-05-12

**Status:** 🟡 **DECOMPOSTO em 12/05** em 3 sub-débitos (D-29F.1, D-29F.2, D-29F.3) — entrada original preservada abaixo como histórico/contexto. Apontar pros sub-débitos em qualquer trabalho novo.

**Detectado em:** 2026-04-29 (validação INVs 4-8 do Doc-0 Fatia 2)

**Severidade:** P1 — bloqueia receita real do SaaS (Luciano não cobra parceiros automaticamente)

**Onde:** `backend/src/saas/saas.service.ts`, `saas.controller.ts`

**Sintoma original (29/04):**
- Cron mensal `0 6 1 * *` cria FaturaSaas no banco. ✅
- **Sem boleto/PIX/QR code emitido via Asaas.** Parceiro não recebe meio de pagamento.
- **Sem email/WA enviado pro parceiro** avisando que tem fatura nova/vencendo.
- **Sem endpoint pra marcar PAGA** — precisaria UPDATE direto no banco.

**Cálculo atual lê apenas 2 componentes** (`mensalidadeBase + percentualReceita`). Outros 8 campos do `PlanoSaas` (taxaSetup, limiteMembros, taxaTokenPerc, limiteTokenMensal, cooperTokenHabilitado, modulosHabilitados, modalidadesModulos, ativo) existem como configuração mas não viram cobrança.

**Reframe 12/05:** sub-investigação confirmou 3 FaturaSaas PENDENTES no banco sem `asaasCobrancaId` populado + `ConfigGatewayPlataforma` vazio (0 registros). Estado real é mais granular — quebrado nos 3 sub-débitos abaixo (geração, envio, comunicação).

**Sub-débitos:**
- **D-29F.1** — Cron de geração mensal FaturaSaas (validar/criar)
- **D-29F.2** — Envio FaturaSaas via Asaas (ConfigGatewayPlataforma)
- **D-29F.3** — Comunicação D-7/D-3/D-1 pro parceiro

**Bloqueia:** entrada do primeiro parceiro real que pague Luciano. Hoje só funciona em modo "experimental contábil".

### D-29F.1 — Cron de geração mensal FaturaSaas

**Severidade:** **P1**

**Tema:** confirmar existência + completude do cron que gera `FaturaSaas` mensalmente para parceiros. Sprint 6 = T10 catalogou a criação, mas o estado real precisa ser validado (a sub-investigação 12/05 encontrou 3 FaturaSaas PENDENTES sem geração automática evidente).

**Persona:** Luciano cobrando parceiros (CoopereBR hoje, Sinergia futuro).

**Critério de pronto:**
1. Cron `@Cron` ativo e identificável em `saas.service.ts` (ou módulo equivalente).
2. Spec Jest cobrindo o cron (gera 1 FaturaSaas pra parceiro fictício, valida valores).
3. 1 FaturaSaas gerada automaticamente no banco de teste em ambiente local.

**Estimativa:** 2-4h Code (depende se cron existe e precisa só revisão, ou precisa criar do zero).

**Dependências:** nenhuma técnica.

**Origem:** decomposição D-29F em 12/05 + appendix da sub-investigação Code 12/05 noite confirmou 3 FaturaSaas PENDENTES no banco sem geração automática evidente.

### D-29F.2 — Envio FaturaSaas via Asaas (ConfigGatewayPlataforma)

**Severidade:** **P1**

**Tema:** `ConfigGatewayPlataforma` está **VAZIO no banco** (0 registros). FaturaSaas geradas (3 PENDENTES) não têm `asaasCobrancaId` populado. Falta integração de envio: FaturaSaas precisa virar Asaas Charge no momento da geração e expor link de pagamento pro parceiro.

**Persona:** Luciano cobrando parceiros via **Asaas DELE** (Asaas-SISGD, não via Asaas do parceiro — esse é o Asaas do parceiro pra cobrar membros).

**Critério de pronto:**
1. `ConfigGatewayPlataforma` populado com credenciais Asaas-SISGD produção.
2. FaturaSaas envia automaticamente Asaas Charge ao ser gerada (`asaasCobrancaId` populado).
3. Webhook dedicado FaturaSaas funcional (separado do webhook de cobrança de cooperado).

**Estimativa:** 1-2 semanas Code + dependência operacional (Luciano abrir conta Asaas dele em produção).

**Dependências:** Luciano-SISGD abrir conta Asaas produção.

**Bloqueia:** **M3 do Plano Mestre** (Fatia D3).

**Origem:** decomposição D-29F em 12/05 + sub-investigação Code 12/05 noite confirmou `ConfigGatewayPlataforma` vazio + 3 FaturaSaas sem `asaasCobrancaId`.

### D-29F.3 — Comunicação D-7/D-3/D-1 pro parceiro

**Severidade:** **P1**

**Tema:** parceiro precisa receber email/WhatsApp 7 dias / 3 dias / 1 dia antes do vencimento da FaturaSaas (lembrando de pagar o SaaS).

**Persona:** parceiro (CoopereBR admin) lembrado de pagar SaaS antes de vencer.

**Critério de pronto:**
1. 3 crons agendados (D-7, D-3, D-1) em `saas.service.ts` (ou módulo equivalente).
2. Templates email pros 3 momentos.
3. Templates WhatsApp pros 3 momentos.
4. Spec Jest cobrindo disparo correto baseado em vencimento da FaturaSaas.

**Estimativa:** 3-5 dias Code.

**Dependências:** **D-29F.1** (cron geração) + **D-29F.2** (envio Asaas) idealmente fechados primeiro — sem FaturaSaas válida no banco, comunicação não tem o que avisar.

**Pode rodar em paralelo:** sim, após D-29F.1 + D-29F.2 estarem entregues.

**Origem:** decomposição D-29F em 12/05.

### ContratoUso só implementa "aluguel fixo" — % lucro líquido não existe + sem cron mensal

**Detectado em:** 2026-04-29 (validação INVs 4-8)

**Severidade:** P2 — bloqueia Sprint Portal Proprietário

**Onde:** `backend/src/financeiro/contratos-uso.service.ts`

**Sintoma:**
- `ContratoUso.percentualRepasse` está no schema mas **nunca é consumido pelo código**.
- `gerarLancamentoMensal()` (linha 116-151) usa apenas `valorFixoMensal`.
- **Não há cron** que execute essa função todo mês — só roda uma vez quando contrato é criado (linha 81-83).
- 0 ContratoUso no banco hoje (não testado em produção).

**Fix sugerido:**
1. Definir fórmula de "% lucro líquido" (Sprint Portal Proprietário precisa de Luciano):
   - Receita da usina = soma de `Cobranca.valorLiquido` dos cooperados vinculados a `Contrato.usinaId = X`?
   - Despesas = `ContaAPagar` da mesma usina?
   - Lucro líquido = receita − despesas?
   - `valorRepasse = lucroLiquido × percentualRepasse / 100`?
2. Implementar cron mensal que roda `gerarLancamentoMensal` para todos `ContratoUso` ATIVO.
3. UI no portal proprietário mostrando o cálculo discriminado.

**Bloqueia:** Sprint Portal Proprietário. Não está no PLANO-ATE-PRODUCAO atual com escopo definido.

### Hardcode `valorTokenReais = 0.20` em CooperToken (com TODO)

**Detectado em:** 2026-04-29 (validação INV 6)

**Severidade:** P2

**Onde:** `backend/src/cooper-token/cooper-token.service.ts:258`

**Sintoma:**
```ts
const valorEstimado = Math.round(quantidade * 0.20 * 100) / 100; // TODO: ler valorTokenReais do plano
```

**Inconsistência adicional (P3):** outros pontos do mesmo service (linhas 451, 561, 670) usam fallback `0.45` quando `plano.valorTokenReais` não está setado. Ou seja, mesmo arquivo tem 2 defaults diferentes (0.20 e 0.45).

**Fix sugerido:** unificar leitura via helper `resolverValorToken(plano)` com fallback único (preferir 0.45 conforme uso majoritário). Tempo: 30 min.

### WhatsApp bot sem testes Jest

**Detectado em:** 2026-04-29 (validação INV 8)

**Severidade:** P3 alto (4051 linhas + 38+ estados sem rede de proteção)

**Onde:** `backend/src/whatsapp/`

**Sintoma:** `find backend/src/whatsapp -name "*.spec.ts"` retorna 0 arquivos. Bot é máquina de estado complexa (lista de 38+ estados em `whatsapp-bot.service.ts:372-385`) sem nenhuma cobertura.

**Fix sugerido:** sprint dedicado de TDD retroativo cobrindo pelo menos:
1. Roteador de estados (qual estado responde a qual mensagem)
2. Timeout de 30 min (`whatsapp-bot.service.ts:338`)
3. Branches de OCR (estados `AGUARDANDO_FOTO_FATURA` e `AGUARDANDO_PROPRIETARIO_FATURA`)
4. Cadastro express (4 estados `CADASTRO_EXPRESS_*`)

Estimativa: 3-5 dias para 60% de cobertura.

**Bloqueia:** alterações seguras no fluxo do bot. Hoje qualquer refactor é risco alto.

### Vocabulário hardcoded "Cooperado" em UI/templates (multi-tenant tipo-específico)

**Detectado em:** 2026-04-28 (investigação read-only pré-onboarding Sinergia)

**Severidade:** P2 — incômodo aceitável mas precisa antes de Sinergia (Consórcio) operar em produção

**Onde:**

- **Frontend:** 50 arquivos `.tsx` com label UI hardcoded ("Cooperado"/"Cooperados" entre tags ou em placeholders) — 106 ocorrências literais. Total de arquivos com qualquer menção: 98.
- **Backend:** 73 mensagens de exception (`NotFoundException('Cooperado não encontrado')`, `BadRequestException('Cooperado sem telefone cadastrado')`, etc) que viram resposta HTTP/UI. 129 arquivos com alguma menção.
- **WhatsApp:** `whatsapp-bot.service.ts` com 131 ocorrências (textos visíveis ao usuário tipo "Já sou cooperado", "Quero ser cooperado"). Outros services WA com 26-56 ocorrências.
- **Email/CoopereAI:** templates não auditados em detalhe, mas `coopere-ai.service.ts` referencia o termo.

**Contexto:** SISGD é multi-tipo (Cooperativa/Consórcio/Associação/Condomínio). Cada tipo tem nome próprio pra membro: cooperado, consorciado, associado, condômino. Hoje o frontend usa "Cooperado" hardcoded em 50 telas. Quando Consórcio Sinergia migrar pro SISGD, o admin dele vai ver "Cooperados" em vez de "Consorciados".

**Bom achado:** infraestrutura de parametrização **já existe e está em produção parcial**:

- Hook frontend `web/hooks/useTipoParceiro.ts` já implementado, com mapa `COOPERATIVA→Cooperado / CONSORCIO→Consorciado / ASSOCIACAO→Associado / CONDOMINIO→Condômino`. Respeita SUPER_ADMIN (mostra "Membro" genérico). Tem fallback pra labels enriquecidos do backend (`tipoMembro`/`tipoMembroPlural`).
- 21 telas **já adotaram o hook**: cobrancas, contratos, cooperados/novo, cooperados/[id], dashboard layout, motor-proposta, ocorrências, ucs, usinas/listas.

**Lacuna:** as outras ~50 telas com label hardcoded ainda não migraram. Backend não tem helper equivalente.

**Fix sugerido:**

1. **Frontend (3 dias):** importar `useTipoParceiro` nas 50 telas restantes, trocar string literal por `{tipoMembro}`/`{tipoMembroPlural}`. Trabalho mecânico, um arquivo por vez. Alta prioridade nas telas que admin Sinergia vai abrir mais (cooperados/page, dashboard/page, relatórios).
2. **Backend helper (0,5 dia):** criar `src/common/nome-membro.helper.ts` com `getNomeMembro(tipoParceiro)`. Injetar `tipoParceiro` via contexto da Cooperativa quando montar mensagem de exception ou template.
3. **Mensagens de erro (1 dia):** atualizar as 73 exceptions backend pra usar o helper. Padrão: trocar `'Cooperado não encontrado'` por `\`${nomeMembro} não encontrado\``.
4. **Templates WhatsApp (1 dia):** `whatsapp-bot.service.ts` é o mais sensível. Pode ficar pro fim — começar pelos que aparecem no fluxo de cadastro/cobrança (`whatsapp-cobranca`, `whatsapp-ciclo-vida`).
5. **CoopereAI prompt (~0,5 dia, sensível):** auditar prompts e referências a "cooperado". Deixar por último.

**Estimativa total:** 3-5 dias úteis. Pode ser feito **incrementalmente** — hook já está vivo, telas convertidas convivem com não-convertidas sem quebrar nada.

**Bloqueia:** onboarding produção de parceiros não-Cooperativa (Consórcio Sinergia, qualquer Associação ou Condomínio futuro). Sinergia consegue operar mesmo com termo errado, mas vai ser desconfortável e pouco profissional.

**NÃO bloqueia:** Sprint 13 (Painel Luciano super-admin), Sprint 12 (webhook Asaas em produção), nem qualquer fluxo da CoopereBR (que é Cooperativa, vê o termo correto).

### `numero` em saco de gato (326 UCs em 9 formatos)

**Origem:** auditoria Sprint 11 Dia 1 (`docs/sessoes/2026-04-26-auditoria-numeracao-dupla.md`).

**Impacto:** campo `Uc.numero` (`@unique`, NOT NULL) tem formatos heterogêneos
no banco — `001001`, `0.000.892.226.054-40`, `0450023484`, `PENDENTE-*`,
`UC-{ts}`, etc. Pipeline OCR mitiga via `comparaNumerosUc` (tolerância de
zeros à esquerda) mas listas B2B pra concessionária podem sair inconsistentes.

**Decisão pendente:** sessão arquitetural com Luciano pra decidir entre:
- (a) Manter (status quo + tolerância)
- (b) Virar identificador interno SISGD (`UC-AAAA-NNNNN`)
- (c) **Remover** — usar `id` + `numeroUC` + `numeroConcessionariaOriginal`

Recomendação preliminar: **(c) Remover**. Reforçada por evidência empírica
do E2E Sprint 11 Fase D (OCR real EDP só popula `numeroConcessionariaOriginal`).

**Confirmar quando primeiro parceiro real entrar.**

### 96 UCs com `distribuidora = OUTRAS`

**Origem:** incidente do Sprint 11 Bloco 1 (migration `String → DistribuidoraEnum` perdeu valores textuais sem auditoria prévia).

**Impacto:** queries por distribuidora retornam dados incompletos pra essas
96 UCs (eram 91 "EDP ES" + 5 variantes). Pipeline IMAP pode falhar match em
algumas UCs por causa do filtro `AND distribuidora`.

**Decisão (Luciano):** correção manual caso a caso quando admin precisar.
Não gerar script automático.

**Recuperação rápida disponível** (se mudar de ideia): heurística por
estado/cidade (ES → EDP_ES) recupera ~91 registros em 15 min.

### Auditoria de drift entre docs e código

**Detectado em:** 2026-04-28 (meta-discussão Sprint 13a Dia 2)

**Severidade:** P2

**Onde:** `docs/MAPA-INTEGRIDADE-SISTEMA.md`, `docs/PRODUTO.md` (substituiu SISGD-VISAO movido pra histórico), `docs/PLANO-ATE-PRODUCAO.md`, `CLAUDE.md`

**Contexto:** Documentos foram atualizados ao longo do tempo mas há suspeita de drift. Sintomas:

- MAPA com padrão de "anexar ao final" virando relatório cronológico em vez de bússola
- VISÃO-COMPLETA possivelmente sem revisão de decisões recentes (FATURA_CHEIA_TOKEN, vocabulário multi-tipo, Hangar caso real, Portal Proprietário)
- Features implementadas mas não documentadas
- Features documentadas mas incompletas

**Fix sugerido:** sessão dedicada — Code abre cada doc principal, cruza com código real, reporta drift com evidências (linhas exatas), classifica por severidade, reconciliação em fatias.

**Estimativa:** 60-90 min Code (auditoria) + 1-2 sessões pra reconciliar.

**Bloqueia:** qualidade do planejamento de Sprints futuros. Sem isso, risco de duplicar trabalho ou contradizer decisões anteriores.

### Auditoria geral de IDOR em outros módulos

**Detectado em:** 2026-04-28 (consequência do achado em `/cooperativas/` durante Sprint 13a Dia 3)

**Severidade:** P2 (bloqueia onboarding seguro de segundo parceiro — Sinergia/Consórcio)

**Onde:** todos os módulos backend que aceitam `:id` como parâmetro apontando pra recurso de cooperativa: `cooperados`, `contratos`, `cobrancas`, `usinas`, `ucs`, `faturas`, `motor-proposta`, `convenios`, `clube-vantagens`, `cooper-token`, `notificacoes`, `ocorrencias`, `whatsapp`, `email-monitor`, `relatorios`, `condominios`, `administradoras`, etc.

**Contexto:** o fix de IDOR em `/cooperativas/` revelou padrão. O Roles Guard isolado **não basta** — gating por perfil garante apenas que apenas SUPER_ADMIN/ADMIN cheguem ao método, mas não restringe ADMIN da Cooperativa A de operar sobre recursos da Cooperativa B. Outros módulos podem ter endpoints similares vulneráveis.

**Fix sugerido:** sprint dedicado de auditoria de segurança multi-tenant. Code abre cada controller, identifica endpoints com `:id` que apontam pra recurso de cooperativa, audita filtragem (no controller OU no service), aplica helper `assertSameTenantOrSuperAdmin` ou equivalente onde for necessário. Estimativa: 1-2 dias úteis.

**Bloqueia:** onboarding seguro de Sinergia (Consórcio). Hoje só CoopereBR é tenant real, então nenhuma exploração ativa — mas qualquer onboarding de segundo parceiro reabre risco em todos os módulos não-auditados.

**Prioridade:** alta. **Rodar antes de Sinergia migrar pro SISGD.**

### 130+ documentos `.md` no projeto sem fonte única

**Detectado em:** 2026-04-28 (Leitura Total Parte 1 — inventário completo do `docs/`)

**Severidade:** P2 (Doc-0 vai resolver)

**Onde:** `docs/` (raiz + 7 subpastas), repo root, `memory/` (raiz repo)

**Contexto:** Inventário Parte 1 revelou 130+ arquivos `.md`, **42.144 linhas total**. Quatro arquivos declaram-se "fonte única da verdade" simultaneamente:

- `docs/PRODUTO.md` (708 linhas, visão humana atual — substituiu SISGD-VISAO movido pra `docs/historico/SISGD-VISAO-COMPLETA-2026-04-26.md` em 03/05/2026)
- `docs/COOPEREBR-ALINHAMENTO.md` (473 linhas, "documento único definitivo", atualizado 2026-04-23)
- `docs/RAIO-X-PROJETO.md` (1.018 linhas, "snapshot do banco e sidebar", gerado 2026-04-20)
- `docs/MAPA-INTEGRIDADE-SISTEMA.md` (986 linhas, atualizado a cada sprint)

Sem hierarquia entre eles. Sobreposição massiva de conteúdo. Datas diferentes resultam em informações conflitantes (números do banco, sprint vigente, status de módulos).

Outros sintomas:
- `docs/qa/` tem 33 arquivos de relatórios diários de mar/abr (arqueologia)
- `docs/changelog/` tem 16 arquivos de correções pontuais
- `docs/sessoes/` mistura registros pós-fato com prompts pré-fato (PROMPT-CLAUDE-15H.md, etc.)
- `FORMULAS-COBRANCA.md` marcado "desatualizado" mas ainda referenciado em memória persistente

**Fix:** Doc-0 (já planejado) reescreve para 3 docs principais — provavelmente `CLAUDE.md` (instruções Code) / `PRODUTO.md` (visão humana SISGD) / `SISTEMA.md` (mapa técnico). Demais arquivos viram histórico em `docs/sessoes/` ou `docs/historico/` ou são apagados.

**Bloqueia:** qualidade do planejamento de sprints futuros + onboarding de novos colaboradores.

### Cobertura de testes baixa (17 specs / 80 models / 447 endpoints)

**Detectado em:** 2026-04-28 (Leitura Total Parte 1 — mapeamento backend)

**Severidade:** P2

**Onde:** `backend/src/**/*.spec.ts`

**Contexto:** apenas 17 specs Jest no projeto, distribuídos entre 13 dos 44 módulos backend. Cobertura proporcional **~2%** considerando 80 models no schema e 447 endpoints expostos.

Sprint 13a Dia 3 mostrou que specs evitam regressão: 8 do helper IDOR + 8 do controller IDOR pegaram bugs antes de produção. Falta de specs gera risco crescente conforme o sistema cresce.

Distribuição atual:
- `auth` (1), `cobrancas` (1), `contratos` (1), `convenios` (1), `cooperados` (3), `cooperativas` (1), `email` (1), `email-monitor` (1), `faturas` (3), `gateway-pagamento` (1), `motor-proposta` (2), `saas` (2), `ucs` (2), `usinas` (2)
- 31 dos 44 módulos sem nenhum spec

**Fix sugerido:** após Auditoria IDOR e antes de Sprint 14, sprint dedicado de "cobertura mínima" — 1 spec por endpoint crítico de cada módulo. Estimativa: 3-5 dias úteis. Foco inicial: módulos de cobrança (cobrancas, faturas, asaas), motor-proposta, cooperados, cooperativas, indicacoes (já tem MLM em produção).

**Bloqueia:** confiança em refactors futuros + onboarding de novos developers + segurança de endpoints menos visitados.

### MAPA-INTEGRIDADE-SISTEMA virou log cronológico

**Detectado em:** 2026-04-28 (Leitura Total Parte 1, confirma sintoma já levantado em débito P2 de drift)

**Severidade:** P2 (Doc-0 vai resolver)

**Onde:** `docs/MAPA-INTEGRIDADE-SISTEMA.md` (986 linhas)

**Contexto:** padrão observado nas últimas sessões — cada sessão **anexa nova seção ao final** em vez de reorganizar conteúdo. Resultado: arquivo virou histórico sequencial ("Sessão 2026-04-26 — ...", "Sessão 2026-04-27 — ...", "Sessão 2026-04-28 — ..."), não mapa estrutural.

Não serve mais como bússola de "onde está cada coisa" — funciona como log de sprints.

**Fix:** Doc-0 reescreve este arquivo (ou substitui por `SISTEMA.md`) com estrutura de bússola:
- Tabelas cruzadas: **Tela × Endpoint × Service × Model**
- Mapa funcional por área (cadastro, cobrança, comunicação, etc.)
- Estado em semáforo (✅🟡🔴) — sem narrativa cronológica
- Histórico de sprints fica em `docs/sessoes/` (já é o padrão pra registros de sessão)

**Bloqueia:** uso como referência rápida em planejamento de sprints futuros.

### Auditoria de drift entre docs e código (continuação)

**Achado adicional 28/04 — investigação focada Sprint 13a Dia 2:**

Existe rota `/parceiro/` (singular, 25 subpastas) paralela a `/dashboard/`, com layout próprio, sidebar própria e dashboard próprio. Consome endpoint `/cooperativas/meu-dashboard`. **Não está documentada em CLAUDE.md, MAPA-INTEGRIDADE-SISTEMA.md ou PRODUTO.md.** É portal admin do parceiro (visão "externa"), paralelo ao `/dashboard/` (visão "interna"). Drift estrutural, não só conteúdo desatualizado — auditoria de drift precisa mapear esta rota inteira.

Subpastas detectadas: agregadores, clube, clube-vantagens, cobrancas, condominios, configuracoes, contratos, convenios, convites, enviar-tokens, faturas, financeiro, indicacoes, membros, modelos-cobranca, motor-proposta, planos, receber-tokens, relatorios, tokens-recebidos, ucs, usinas, usuarios, whatsapp.

---

## P3 — Cosmético / quality-of-life

### Specs quebrados desde commit `4d70b19`

**Arquivos:**
- `backend/src/cooperados/cooperados.service.spec.ts`
- `backend/src/cooperados/cooperados.controller.spec.ts`

**Erro:** `Nest can't resolve dependencies of the CooperadosService (PrismaService, NotificacoesService, ?, WhatsappCicloVidaService, WhatsappSenderService, EmailService, FaturasService). UsinasService at index [2] is available in the RootTestModule module.`

**Origem:** commit `4d70b19` (sprint anterior, antes de qualquer trabalho meu) adicionou `UsinasService` ao construtor de `CooperadosService` mas não atualizou os 2 specs gerados pelo scaffold do NestJS CLI.

**Detectado:** durante regressão da Fase D do Sprint 11. **Não é regressão deste sprint.**

**Sintoma atual:** 2 falhas em `npx jest cooperados`. Demais testes (8/8 do guard-ativacao novo + 72/72 de email/faturas) passam normalmente.

**Fix sugerido (~10 min):** atualizar `Test.createTestingModule({ providers: [...] })` em ambos os specs incluindo `UsinasService`, `FaturasService`, `EmailService` e dependências transitivas. Ou marcar como `.skip()` se vão ser reescritos no futuro.

### Bug — Relatório de Inadimplência quebra com valor `undefined`

**Arquivo:** `web/app/dashboard/relatorios/inadimplencia/page.tsx:21` (função `formatarMoeda`).

**Origem:** detectado em 2026-04-27 quando Luciano abriu `/dashboard/relatorios/inadimplencia` enquanto preparava ambiente pro teste do webhook Asaas.

**Erro de runtime:**

```
Runtime TypeError: can't access property "toLocaleString", v is undefined
  formatarMoeda  page.tsx:21
  InadimplenciaPage  page.tsx:206
```

Código que quebra:

```typescript
function formatarMoeda(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
```

**Impacto:** página inteira do relatório de inadimplência não abre. Afeta o admin do parceiro (Marcos no fluxo Hangar; admin CoopereBR no teste). Outras telas não são afetadas.

**Causa provável:** backend retorna algum campo numérico (saldo devedor, multa, juros) como `null`/`undefined`. A função declara `v: number` mas não trata ausência do valor.

**Fix sugerido (~10-15 min):**

1. Adicionar guard em `formatarMoeda`:
   ```typescript
   function formatarMoeda(v: number | null | undefined): string {
     if (v === null || v === undefined || Number.isNaN(v)) return 'R$ 0,00';
     return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
   }
   ```
2. Investigar **por que** o backend retorna campo vazio. Conferir endpoint que alimenta o relatório (`relatorios.service.ts` ou similar).
3. Decidir contrato: backend deveria sempre retornar `0` em vez de `null`? Ou frontend é responsável pelo fallback? Aplicar regra consistente.
4. Buscar `formatarMoeda` em outros pages/components do frontend e aplicar a mesma proteção (alta probabilidade de existir mais ocorrências).

**Reproduzir:** abrir `localhost:3001/dashboard/relatorios/inadimplencia` autenticado como admin da CoopereBR — página explode no carregamento.

**Não-bloqueante para:** Sprint 12, Sprint 13, retomada de qualquer outro fluxo.

### PM2 sem monitoramento de crash loop

**Detectado em:** 2026-04-27 (descoberta acidental durante setup ngrok)

**Severidade:** P3 (ok pra dev, blocker pra Sprint 26 pré-produção)

**Sintoma observado:** backend PM2 acumulou **298 restarts** em 4 horas sem alerta. Porta 3000 estava ocupada por processo node órfão (PID 4396) de sessão antiga; PM2 spawnava novo processo, falhava com `EADDRINUSE`, restartava em loop infinito. Dashboard PM2 mostrava `online` enganosamente.

**Impacto em dev:** confundiu diagnóstico — webhooks 200 OK eram respondidos pelo backend órfão, não pelo PM2 novo. Quase fechei sessão sem perceber.

**Impacto em produção:** sintomas seriam lentidão intermitente, requisições com latência alta, status `online` falso no dashboard.

**Fix sugerido (~30 min):**
1. Configurar `pm2-logrotate` (já vem com PM2)
2. Hook `pm2 install pm2-server-monit` ou alerta customizado
3. Alerta quando restart_count subir > 5 em 1h (cron + curl pra Slack/email/WA)
4. `max_restarts: 10` no ecosystem.config — para o processo após N restarts em vez de loop infinito

**Não-bloqueante para:** Sprints 12-25 em dev. Obrigatório antes de Sprint 26 (pré-produção).

### 4.9 tokens emitidos por engano antes do conserto CLUBE

**Detectado em:** 2026-04-27 (durante validação contraprova do bug 3)

**Severidade:** P3 (registro do incidente; valores não estornados)

**Contexto:** antes do commit `16302e9` (conserto modo CLUBE), 2 cobranças de cooperados em modo CLUBE foram processadas com a regra antiga de dupla bonificação:

| Cooperado | Cobrança | Valor cobrado | Tokens emitidos errados |
|-----------|----------|---------------|--------------------------|
| TESTE E2E CLUBE SPRINT9 | `cmoh8z…` (04/2026) | R$ 8 (deveria ser R$ 10 cheio) | 1.96 FATURA_CHEIA |
| AGOSTINHO | `cmoh9n…` (04/2026) | R$ 12 (deveria ser R$ 15 cheio) | 2.94 FATURA_CHEIA |

Total: 4.9 tokens emitidos a maior + R$ 5 cobrados a menor. **Ambos cooperados são `ambienteTeste=true`** — nenhum impacto financeiro real.

**Decisão:** não estornar. Ambiente de teste, valor não material, registro pra auditoria histórica.

**Origem desconhecida da Cobrança `cmobdlysq0003va18sw9twwc3`** (AGOSTINHO 05/2026 R$ 600 cheio): criada em 23/04 via script de teste com `valorLiquido = valorBruto` hardcoded, contornando o bug do `percentualDesconto` (que só apareceu via UI). Ficou correta "por sorte". Mantida como referência.

**Não-bloqueante para:** nada.

### Script `teste-ocr-fatura-luciano.ts` com erros TS

**Arquivo:** `backend/scripts/teste-ocr-fatura-luciano.ts`

**Erro:** 4 erros TS de mailparser types (`readonly` vs `readOnly`, `parsed.attachments` undefined, etc.)

**Origem:** sprint anterior, débito conhecido.

**Mitigação:** adicionei `scripts/` ao `tsconfig.build.json:exclude` (commit `d784553`) — não bloqueia mais o `npm run build`. Scripts standalone rodam via `ts-node --transpile-only` que ignora erros de tipo.

**Fix sugerido (~15 min):** corrigir os 4 erros se for necessário rodar tsc estrito em scripts. Não urgente.

### Card MRR do Painel SISGD trunca variável estimado em viewports estreitos

**Detectado em:** 2026-04-28 (validação visual Sprint 13a Dia 1)

**Arquivo:** `web/app/dashboard/super-admin/page.tsx` (card MRR plataforma, ~linha 119-122)

**Sintoma:** o subtítulo do card mostra `R$ 9.999,00 fixo · R$ 266,67 estimado`. Em larguras menores o "estimado" trunca pra `R$ 266,6...`. Já tem `truncate` aplicado mas o texto não cabe na coluna do grid 4-col em viewports intermediários.

**Impacto:** apenas Luciano (SUPER_ADMIN) vê esta tela. Cosmético, não esconde número crítico (números principais estão em `text-2xl` separado).

**Fix sugerido (~10 min):** quebrar em 2 linhas (`fixo` em uma, `variável estimado` em outra) ou trocar `truncate` por `whitespace-normal break-words`. Ou mostrar tooltip com valores completos.

**Não-bloqueante para:** nada.

### N+1 latente em MetricasSaasService (MRR + detecção de incêndios)

**Detectado em:** 2026-04-28 (revisão pré-commit Sprint 13a Dia 1)

**Arquivo:** `backend/src/saas/metricas-saas.service.ts`

**Sintoma:**
- `calcularMRR()` faz 1 `aggregate` por parceiro com plano ATIVO (loop sequencial).
- `detectarIncendios()` faz 2 `count` por cooperativa ativa (loop sequencial, `Promise.all` é só dentro do par count/total — não paraleliza entre cooperativas).

**Impacto hoje:** irrelevante. 2 parceiros = 2 idas no MRR + 4 counts em incêndios. Tempo de resposta do `/saas/dashboard` continua < 500ms.

**Quando vira problema:** ~30 parceiros em diante. Loop sequencial de 30+ aggregates pode levar 2-5s e degradar a tela.

**Fix sugerido quando escalar:**
1. **Cache 5min** (já marcado como TODO no comentário do service): Redis ou cache em memória do NestJS (`@nestjs/cache-manager`).
2. **Batch query** com `groupBy` em vez de loop: `cobranca.groupBy({ by: ['cooperativaId'], where: { dataPagamento: { gte: inicioJanela }, status: 'PAGO' }, _sum: { valorPago: true } })` resolve MRR em 1 query.
3. **Materialized view** ou tabela `metricas_saas_cache` atualizada por cron horário pra dashboards mais pesados.

**Estimativa:** 1-2h pra refazer com `groupBy`. Cache é 0,5 dia.

**Não-bloqueante para:** Sprint 13b, 14, etc. Revisar quando totalParceiros > 30.

### PM2 `cooperebr-backend` sem `max_restarts` configurado

**Detectado em:** 2026-04-28 (segundo incidente em 2 dias — primeiro foi 2026-04-27 com 298 restarts por node órfão)

**Severidade:** P3 (ok pra dev) — **vira P1 antes de Sprint 14 (pré-produção)**

**Sintoma:** PM2 `cooperebr-backend` chegou a **331 restarts acumulados** sem nenhum alerta. Causas observadas:
- 2026-04-27: porta 3000 ocupada por node órfão de sessão antiga, PM2 spawnava novo processo, falhava com `EADDRINUSE`, restartava em loop infinito
- 2026-04-28: Luciano sem querer reaproveitou histórico do PowerShell ao reabrir VS Code e executou `pm2 stop`/`start` várias vezes, cada um adicionando ao contador

**Onde:** `ecosystem.config.js` na raiz do projeto (ou config inline do PM2 se não existir arquivo dedicado)

**Risco em produção:**
- Status `online` enganoso quando processo está em crash loop
- Webhooks 200 OK respondidos por processo zumbi (não pelo PM2 atual)
- Lentidão intermitente sem alerta

**Fix sugerido (~30 min):**
1. Criar/atualizar `ecosystem.config.js`:
   ```js
   module.exports = {
     apps: [{
       name: 'cooperebr-backend',
       script: 'dist/src/main.js',
       cwd: 'backend',
       max_restarts: 10,
       min_uptime: '10s',
       restart_delay: 3000,
       max_memory_restart: '1G',
       error_file: 'logs/pm2-error.log',
       out_file: 'logs/pm2-out.log',
       merge_logs: true,
     }],
   };
   ```
2. Pré-flight check no boot do main.ts: detectar `EADDRINUSE` ANTES de iniciar Nest e logar erro descritivo (já existe parcial — robustecer)
3. `pm2 install pm2-logrotate` pra evitar log file gigante
4. Cron horário (script + curl pra Slack/email/WA) que alerta se `restart_count` subir > 5 em 1h

**Bloqueia:** Sprint 14 (pré-produção, requer estabilidade PM2 + observabilidade básica).

### Sidebar do super-admin com ordem de itens não-otimizada

**Detectado em:** 2026-04-28 (validação visual Sprint 13a Dia 1)

**Onde:** `web/app/dashboard/layout.tsx` — função `getNavSections(perfil)` (linhas ~120-180)

**Sintoma:** itens "Projeção Receita", "Expansão / Investidores", "Portal Proprietário", "Asaas Pagamentos" estão misturados sem agrupamento claro. Quando Luciano abre o dashboard como SUPER_ADMIN, o link "Painel SISGD" novo competiu com itens herdados de outras épocas que poderiam estar em "Configurações" ou "Operacional".

**Impacto:** apenas Luciano (SUPER_ADMIN) usa esta densidade de menu. Cosmético, não bloqueia nada.

**Fix sugerido (~30-45 min):** revisar agrupamento de seções. Proposta:
- **Gestão Global** (SUPER_ADMIN): Painel SISGD, Parceiros, Planos SaaS, Faturas SaaS, Audit Logs (Sprint 13b)
- **Operacional**: Cobranças, Faturas, Cooperados, Contratos, UCs, Usinas
- **Comercial**: Convênios, Indicações, Clube/Token, Lead Expansão
- **Configurações**: Email, Asaas, Modelos Cobrança, WhatsApp Config

Idealmente fazer junto com Sprint 13a Dia 2 (lista de parceiros vai exigir ajuste de menu de qualquer jeito).

**Não-bloqueante para:** nada.

### Lista antiga `/dashboard/cooperativas` sem coluna Plano SaaS

**Detectado em:** 2026-04-28 (verificação visual Sprint 13a Dia 2)

**Severidade:** P3

**Onde:** `web/app/dashboard/cooperativas/page.tsx`

**Contexto:** Existem 2 listas de parceiros — antiga (Administração → "Parceiros SISGD") e nova (Gestão Global → "Parceiros"). Antiga sem coluna Plano, nova com. Confunde super-admin.

**Fix sugerido:** decidir após auditoria de drift se (a) adiciona coluna Plano na antiga, (b) marca antiga como deprecated, ou (c) faz redirect.

**Bloqueia:** UX de organização. Nada urgente.

### Inconsistência "Faturado este mês" entre Dashboard e Lista de Parceiros

**Detectado em:** 2026-04-28 (verificação visual Sprint 13a Dia 2)

**Severidade:** P3

**Onde:** `backend/src/saas/metricas-saas.service.ts`

**Contexto:** Dashboard (`getResumoGeral.calcularFaturamentoMesAtual`) mostra R$ 1.333,35 usando `dataPagamento >= inicioMes`. Lista (`getListaParceirosEnriquecida`) mostra R$ 1.180,00 pra CoopereBR usando `dataVencimento >= inicioMes`. Diferença R$ 153,35.

**Decisão técnica adotada:** alinhar com `dataPagamento` (visão contábil padrão — o que entrou no caixa neste mês).

**Fix sugerido:** uniformizar `getListaParceirosEnriquecida()` usando mesmo filtro de `calcularFaturamentoMesAtual()`. Pequeno ajuste, ~10 min Code. Pode entrar no Dia 3 ou em fix dedicado.

**Bloqueia:** clareza de relatório. Nada urgente.

### Portal do Proprietário de Usina — feature parcial

**Detectado em:** 2026-04-28 (verificação visual Sprint 13a Dia 2)

**Severidade:** P3

**Onde:** `/dashboard/proprietario`

**Contexto:** Tela destinada ao Proprietário de Usina (PF/PJ que arrenda usina pra cooperativa). Schema tem `Usina.proprietarioCooperadoId` + campos avulsos (`proprietarioNome` etc). Tela existe e gate de perfil funciona, mas sem fluxo de cadastro de Proprietário, sem dado real, sem lógica de "valores a arrecadar".

**Fix sugerido:** sprint dedicado a Arrendamentos/Repasses ao Proprietário. Não está no PLANO-ATE-PRODUCAO atual. Sugestão de inserção: após Sprint 14 (pré-produção), antes de Sprint 18.

**Bloqueia:** futuro. Mapeamento parcial sai da etapa 5.7 do prompt da sessão Sprint 13a Dia 2.

### Regra de processo: prompt mapeador antes de prompt construtivo

**Detectado em:** 2026-04-28 (meta-discussão Sprint 13a Dia 2)

**Severidade:** P3 (processo)

**Onde:** workflow Claude.ai + Claude Code

**Contexto:** Sprint 13a Dia 2 expôs falha — Claude.ai planejou lista de Parceiros sem mapear primeiro telas existentes (já havia `/dashboard/cooperativas/[id]` e talvez `/dashboard/parceiros/[id]`), gerando redundância e inconsistência numérica. Causa: docs de contexto não consultados proativamente.

**Fix:** adicionar regra ao `CLAUDE.md`:

> Antes de qualquer prompt construtivo, Code abre e lê (1) CLAUDE.md, (2) docs/PRODUTO.md (área), (3) docs/MAPA-INTEGRIDADE-SISTEMA.md (área), (4) docs/PLANO-ATE-PRODUCAO.md (sprint vigente). Retorna mapa específico antes de codar.

**Aplicação:** próxima sessão. Aplicar junto com auditoria de drift.

**Bloqueia:** qualidade dos próximos sprints.

---

### D-30S — Extrair "Jornadas de Usuário" do SISGD-VISAO histórico

**Severidade:** P3 — preserva conhecimento valioso

**Detectado em:** 02/05/2026 (investigação de propósito SISGD-VISAO — sessão 2 da tarde)

**Origem:** `docs/historico/SISGD-VISAO-COMPLETA-2026-04-26.md` Seção 2 "Três histórias completas" (linhas ~64-130)

**Tema:** extrair narrativas fim-a-fim de Ana (cooperada), Carlos (Hangar Academia) e Helena (síndica Moradas) pra `docs/JORNADAS-USUARIO.md` (novo arquivo Doc-0 ou apêndice em PRODUTO.md).

**Persona/caso de uso:** onboarding de novo time + pitch pra parceiro novo + audit operacional ("história de Ana ainda funciona em 2026?").

**Critério de pronto:**
- Arquivo `docs/JORNADAS-USUARIO.md` criado (ou apêndice E em PRODUTO.md)
- 3 histórias transcritas com formato passo-a-passo + status [OK/PARCIAL/FALTA]
- Contagem honesta atualizada com Sprint 13a + correções factuais Grupo B (juiz TJES removido, OpenClaw, classes GD)
- Header explicando origem (SISGD-VISAO histórico)

**Estimativa:** 1-1.5h Code

**Dependências:** Doc-0 Fatia 3 (SISTEMA.md) idealmente concluído antes — pra referenciar arquitetura técnica nas histórias.

**Resolução:** quando atacado, marcar D-30S como resolvido + atualizar referências em PRODUTO.md.

---

### D-30T — Extrair "Painéis por Papel" do SISGD-VISAO histórico

**Severidade:** P3 — insumo pra catalogar sprints futuros de UX

**Detectado em:** 02/05/2026 (investigação de propósito SISGD-VISAO)

**Origem:** `docs/historico/SISGD-VISAO-COMPLETA-2026-04-26.md` Seção 5 "Painéis necessários por papel"

**Tema:** extrair especificação operacional de 6 painéis (Luciano, Marcos, Ana, Carlos, Helena+Patrícia, Walter) pra `docs/PAINEIS-POR-PAPEL.md` (novo arquivo) ou Apêndice E em PRODUTO.md.

**Persona/caso de uso:** catalogar sprints futuros de UX/UI por persona. Cada painel não-implementado = sprint potencial.

**Critério de pronto:**
- Arquivo criado com 6 painéis especificados
- 5.1 Painel Luciano atualizado (Sprint 13a Dia 1 entregou `/dashboard/super-admin`)
- Cada painel marca sprints relacionados (já catalogados ou potenciais)
- Header explicando origem

**Estimativa:** 1-2h Code

**Dependências:** atualizar conforme Sprint 13a Dia 2/3 + Decisões 17-19.

**Resolução:** quando atacado, atualizar PRODUTO.md Apêndice A (Semáforo Executivo) com referências aos painéis.

---

### D-30U — Fórmula órfã em motor.dimensionarPropostaParaPlano (COM_ICMS/CUSTOM)

**Severidade:** P2

**Origem:** sessão 04/05/2026 (investigação read-only Fase C.1.1)

**Descrição:** `motor-proposta.service.ts:313-334` calcula COM_ICMS/CUSTOM com fórmula real, mas o helper canônico `calcular-tarifa-contratual.ts` (4 callers — contratos, cooperados, faturas, motor.aceitar) lança `NotImplementedException` pro mesmo input. Proposta calculada com fórmula → aceite explode.

**Hoje blindado por:** `@IsIn` no DTO impede criar/atualizar plano com essas bases via API (commit desta sessão). Fluxo via UI bloqueado por `<option disabled>`.

**Resolução:** (a) remover ramo COM_ICMS/CUSTOM do motor.dimensionar fazendo throw também, OU (b) consolidar 3 fontes numa só (ver D-30V).

**Gatilho:** independente de produto — é bug latente que vale resolver mesmo se UI v2 nunca expor as 4.

---

### D-30V — Unificar 3 fontes de verdade do cálculo de tarifa contratual

**Severidade:** P3

**Origem:** sessão 04/05/2026 (investigação read-only Fase C.1.1)

**Descrição:** Frontend (`simular-plano.ts`), motor.dimensionarPropostaParaPlano e helper canônico calculam (ou deixam de calcular) o mesmo input em 3 lugares, com comportamentos divergentes pra COM_ICMS/CUSTOM (return 0 silencioso / fórmula real / throw NotImplementedException).

**Resolução:** helper canônico vira fonte única; motor e frontend chamam ele.

**Gatilho:** quando produto reverter Sprint 5 ponto 3 (UI v2 expondo as 4) OU quando spec ANEEL Sprint 0/5 fechar com fórmulas validadas pra ICMS por estado/classe e componentes CUSTOM.

---

### D-30W — Aprovação admin do plano automatizada após Sprint 5+8

**Severidade:** P2 processual

**Origem:** sessão claude.ai 2026-05-11 respondendo D-J-2 (Decisão 22)

**Tema:** Hoje (fase de testes/amadurecimento) admin revisa cada aceite de proposta manualmente antes de virar contrato. Decisão de Luciano em 11/05/2026 (Decisão 22) é manter revisão manual nessa fase. Não é gap — é intencional.

**A fazer (quando):** quando Sprint 5 (5 flags ANEEL — limite 25% por cooperado/usina, mix de classes, concentração, transferência saldo, mistura classes mesma usina) e Sprint 8 (Engine de Otimização com Split + Sugestão default + guard-rails) estiverem prontos, transição admin → automática com validação por flags + sugestão da engine.

**Hoje blindado por:** processo manual do admin. Nenhum aceite vira contrato sem revisão humana.

**Severidade P2 processual:** não bloqueia produção, mas precisa ser revisitado quando os 2 sprints fecharem pra desbloquear escala (não dá pra escalar pra centenas de aceites/dia revisando manualmente).

**Complementa:** Decisão 22 em `CONTROLE-EXECUCAO.md`.

---

### D-30Y — ✅ RESOLVIDO em 2026-05-11 — Validação E2E manual /aprovar-proposta (4 valores Fase C.3)

**Severidade original:** P2 (gap de validação ponta-a-ponta)

**Origem:** Fase 5 / Commit 4 (`ecf39cd`) entregou `<EconomiaProjetada>` em 3 telas (cobrança / contrato / proposta). Cobrança Fase B.5 e contrato com `valorCheioKwhAceite` foram validados via curl, mas a tela cooperado-facing `/aprovar-proposta?token=...` (que renderiza no fluxo público) precisava validação visual manual pra fechar o ciclo C.3.

**Validação 2026-05-11 (esta sessão):**

- **Script ad-hoc** `backend/scripts/criar-proposta-teste-c3.ts` (artefato local, não commitado) gerou 2 propostas teste na CoopereBR Teste (TRIAL, cooperativaId `cmn7qygzg0000uoawdtfvokt5`), cenário canônico Fase B.5 #1: FIXO_MENSAL + KWH_CHEIO + 15% + 500 kWh/mês + valorCheio R$ 1,02/kWh.

- **Tokens usados:**
  - `3d79da21...` (1ª rodada, exercitada e depois aceita pelo Luciano em validação visual)
  - `2a817667...` (2ª rodada, mantida em PENDENTE durante o screenshot final)

- **Endpoint backend** `GET /motor-proposta/proposta-por-token/<token>` retornou JSON com `economia5Anos` e `economia15Anos` calculados on-the-fly (Commit 4, `motor-proposta.service.ts:1229-1239`):
  ```
  economiaMensal:    "76.5"   (Prisma Decimal, string)
  economiaAnual:     "918"
  economia5Anos:     4590     (mensal × 60, calculado no endpoint)
  economia15Anos:    13770    (mensal × 180)
  ```

- **Componente `<EconomiaProjetada>`** renderizou corretamente no card lateral "Projeção de economia":
  - Economia mensal:  R$ 76,50
  - 1 ano:            R$ 918,00
  - 5 anos:           R$ 4.590,00
  - 15 anos:          R$ 13.770,00

- **2 screenshots** confirmados visualmente pelo Luciano em janela anônima (incognito) — bloco verde renderizado abaixo do card destaque, sem regressão na UI pré-existente.

**Cleanup pós-validação:** Os 2 cooperados teste (`cmp19l9o80002vagglo64nag5` + `cmp19vejv0002vaucyl5auzsj`) foram deletados via cascata (proposta → UC → cooperado). Banco volta ao estado original — nenhum lixo de teste.

**Confirma matemática:** `mensal × 12 = anual` ✓, `mensal × 60 = economia5Anos` ✓, `mensal × 180 = economia15Anos` ✓. Backend retorna valores em formato Prisma Decimal (string) ou number direto — `<EconomiaProjetada>` coerce robustamente (testado em `web/scripts/test-economia-projetada.ts`, 29/29 verde).

**Resolução:** D-30Y FECHADO. Tela cooperado-facing valida ponta-a-ponta. Fase C.3 cooperado-facing 100% funcional.

---

### D-30X — Whitelist LGPD bypassada por `NODE_ENV=production` em PM2 dev

**Severidade:** P3 (operacional, não bloqueia produção mas pode vazar email em dev)

**Origem:** sessão Code 2026-05-11 — testes da Fase 3 (UI etapa 11) com cooperado real MARCIO MACIEL revelaram o problema.

**Tema:** `backend/src/common/safety/whitelist-teste.ts:28` faz curto-circuito quando `process.env.NODE_ENV === 'production'`:

```ts
export function podeEnviarEmDev(destino: string, tipo: 'WA' | 'EMAIL'): boolean {
  if (process.env.NODE_ENV === 'production') return true;
  // ... else aplica whitelist (lucbragatto@gmail.com / telefones Luciano)
}
```

Mas `ecosystem.config.cjs` do PM2 **local de dev** define `NODE_ENV: 'production'` em `cooperebr-backend` e `cooperebr-whatsapp`. Resultado: a whitelist NÃO filtra emails/WA no ambiente dev quando rodando via PM2 — qualquer destino (incluindo `@removido.invalid` ou número fake) entra no `transporter.sendMail`/sender WA.

**Confirmado em 11/05/2026:** durante teste da Fase 3, a chamada `enviarCadastroAprovado` pra MARCIO MACIEL (email `pipo-6qac20-removido@removido.invalid`) gerou log "E-mail enviado" (linha 68 de `email.service.ts`) — o nodemailer tentou enviar de fato. Falhou silenciosamente porque `.invalid` não tem MX, mas em emails reais com formato válido o envio aconteceria.

**Hoje blindado por:**
- Em modo `npm run start:dev` (sem PM2) — funciona certo, NODE_ENV não vira "production"
- Cooperados de teste em CoopereBR têm emails mascarados (LGPD). Domínios fake (`@removido.invalid`) não têm MX → silently fail no envio real
- Whitelist WA: telefones de teste são `+5511000000000` etc — números inválidos, não chega em ninguém

**Risco real:**
- Em dev local rodando via PM2, qualquer cooperado COM email/telefone reais (importação de produção, dado de cliente real em teste) faria envio real
- Sprint 1 (FaturaSaas Completo) e Sprint 6 (IDOR) podem trazer dados reais pra dev — risco aumenta

**A fazer (qualquer dos 3 caminhos):**
1. **Trocar NODE_ENV no ecosystem.config.cjs** pra `development` em PM2 dev. Production real continua `production` (variável de ambiente do servidor real, não do file commitado).
2. **OU criar `ENV_OVERRIDE_WHITELIST=true`** explícita que força whitelist independente de NODE_ENV. Padrão "false" em prod, "true" em dev local.
3. **OU mover whitelist** pra checar baseado em outro sinal (ex: hostname `localhost`, ou flag `WHITELIST_ATIVA=true` em `.env` local).

Estimativa: 30 min (caminho 1 ou 2), 1h (caminho 3 — mais limpo).

**Bloqueio:** Caminho 1 pode ter side effects (outros módulos podem usar `NODE_ENV=production` pra cache/optimização). Validar antes de aplicar.

**Origem específica do achado:** Commit 8853d97 (UI etapa 11) — teste com MARCIO MACIEL via curl mostrou log de envio pra `@removido.invalid` em PM2 dev. Confirma que whitelist não estava ativa.

---

### D-31 — 🟡 REFRAMED em 2026-05-12 — Guard preventivo `kwhAnual=null → percentualUsina=null` (sem backfill, dados fictícios)

**Status:** 🟡 REFRAMED. Escopo original (investigação ampla + backfill dos 61 contratos zerados) **descartado** — investigação 12/05 revelou que dados atuais são **fictícios** (import do sistema antigo, não cooperados reais operacionais). Backfill seria pintar zero sobre zero.

**Severidade nova:** **P2** (era P1 provisório). Sem dados reais em prod hoje, não há cobrança/alocação errada acontecendo. Guard preventivo evita que próximo cooperado real cadastrado (via Caminho A canário) caia no mesmo poço.

**Escopo redefinido (sub-fatia de Fatia G):**

1. **Guard no código:** ao gravar `Contrato`, se `kwhContratoAnual=null` então `percentualUsina=null` (não 0). Tentativa explícita de gravar `0` vira `null` silenciosamente. Valor real de `kwhContratoAnual` calcula `percentualUsina` on-the-fly via fórmula `kwhContratoAnual / Usina.capacidadeKwh × 100`.
2. **Spec Jest** cobrindo 3 cenários:
   - (a) `kwhContratoAnual=null` + `percentualUsina=null` → OK, persiste como está.
   - (b) `kwhContratoAnual=null` + tentativa de gravar `percentualUsina=0` → guard transforma em `null` silenciosamente (não lança).
   - (c) `kwhContratoAnual=valor real` → calcula `percentualUsina` on-the-fly e grava o valor correto.
3. **Cobrir 5 services** que tocam o campo (mapeados na Fase 0 da sessão 12/05):
   - `contratos.service.ts` (create/update)
   - `motor-proposta.service.ts` (`aceitar()`)
   - `cooperados.service.ts` (`alocarUsina`)
   - `migracoes-usina.service.ts`
   - seed paths (qualquer script de import)

**NÃO inclui backfill.** Dados atuais são fictícios — re-import correto via Caminho A canário substitui naturalmente. Backfill cego sobre dados fictícios é antitrabalho.

**Origem da reframe:** Luciano em 2026-05-12 noite revelou que os 61 contratos zerados são import do sistema antigo, não cooperados reais. Investigação original D-31 (Fase 8 da sessão maratona 11/05, commit `851a39e`) tratou os dados como reais — ficou inválida.

**Estimativa:** 30-45 min Code (guard + spec + smoke nos 5 services).

**Bloqueio:** **Não bloqueia nada operacional** — nenhum cooperado real cadastrado ainda. Bloqueia **canário Caminho A** (Fatia A) — guard precisa estar no código antes do primeiro cadastro real, senão D-31 ressuscita com dados reais.

**Auditoria de concentração ANEEL** (Sprint 5 — flag `concentracaoMaxPorCooperadoUsina`): passa a usar fórmula on-the-fly `kwhContratoAnual / Usina.capacidadeKwh × 100` direto, ignorando `percentualUsina` persistido. Cálculo fica correto sem depender do campo persistido estar populado.

---

### D-30Z — Migração `opcaoToken` → `modoRemuneracao` incompleta (85 cooperados)

**Severidade:** P3 documental

**Origem:** descoberto em 2026-05-11 durante validação Fase 7.1 dos 5 achados do adendo §11 da spec CooperToken.

**Tema:** 85 cooperados em estado intermediário entre o campo legado `Cooperado.opcaoToken` (schema.prisma:180, `@deprecated` na linha 179, default `"A"`) e o campo atual `Cooperado.modoRemuneracao` (schema.prisma:178, default `DESCONTO`).

**Números frescos do banco (11/05/2026):**

- 317 cooperados com `opcaoToken='A'`
- 232 cooperados com `modoRemuneracao='DESCONTO'`
- **Diferença: 85 cooperados** sem migração completa entre os 2 campos

**A fazer:**

1. Script SQL backfill que (a) audita cada um dos 85 cooperados via dry-run, (b) define para qual `modoRemuneracao` cada um migra baseado no `opcaoToken` legado (mapeamento `'A' → DESCONTO` presumido, mas conferir caso a caso por se houver `opcaoToken='B'` ou outros valores no estado intermediário), (c) executa com aprovação supervisionada, (d) após migração 100%, remover `@deprecated` ou mover `opcaoToken` para histórico.

**Severidade P3 documental:** não bloqueia desenvolvimento, mas relatórios/queries que filtram por `modoRemuneracao` (e ignoram `opcaoToken`) subestimam a base de cooperados em modo desconto em 85 registros (~26%).

**Risco real:** análises tipo "FATURA_CHEIA_TOKEN é o caminho menos popular" baseadas só em `modoRemuneracao` partem de número errado. Em produção, decisões de produto podem ser tomadas com dado subestimado.

**Hoje blindado por:** nada — qualquer query nova precisa cruzar os 2 campos OU rodar este backfill.

**Bloqueia:** nada imediatamente. Vale acompanhar quando Sprint CooperToken Consolidado fechar (Etapa 2 pode absorver naturalmente como parte do refator).

**Origem específica do achado:** Code rodou `SELECT COUNT(*) FROM cooperados WHERE opcao_token='A'` (317) e `SELECT COUNT(*) FROM cooperados WHERE modo_remuneracao='DESCONTO'` (232) durante validação do ACHADO 4 da spec — discrepância flagrada e elevada a débito pelo Luciano.

---

### D-32 — Migração `Contrato.kwhContrato` (legado) → `kwhContratoAnual` (novo) — incompleta

**Status:** **STANDBY** (aguardando produção real subir via Caminho A canário).

**Severidade:** **P1** — bloqueia entrada de produção real **CoopereBR** pra membros legados (61 contratos com `kwhContratoAnual=NULL`). Não bloqueia desenvolvimento nem teste (todos os contratos novos vão pro campo correto).

**Tema:** Schema tem dois campos coexistindo: `Contrato.kwhContrato` (legado, presumido mensal) e `Contrato.kwhContratoAnual` (novo, anual explícito). Migração ficou incompleta — 61 contratos legados permanecem com `kwhContratoAnual=NULL` apontando dados só em `kwhContrato`. Persona futuro engenheiro que ler somente `kwhContratoAnual` (campo "correto") vai assumir base de cooperados ATIVOS menor que a real.

**Impacto persona:** relatórios, dashboards, métricas SaaS e auditorias ANEEL que filtrem por `kwhContratoAnual NOT NULL` excluem silenciosamente os 61 legados. Nada quebra explicitamente — só dados subestimados.

**Critério de pronto:**

1. **Auditoria caso a caso** dos 61 contratos legados — listar cooperado, UC, valor de `kwhContrato`, data do contrato, fonte de dados.
2. **Decisão produto Luciano** sobre unidade do legado:
   - Hipótese A: `kwhContrato` era **mensal** → `kwhContratoAnual = kwhContrato × 12`.
   - Hipótese B: `kwhContrato` era **anual direto** → `kwhContratoAnual = kwhContrato` (rename só).
   - Hipótese C: **mistura** (alguns mensais, outros anuais) → migrar caso a caso com decisão manual.
3. **Script backfill supervisionado**: dry-run primeiro (mostra ANTES/DEPOIS de cada um dos 61), aguardar aprovação Luciano, executar.
4. **Validação pós-backfill**: relatório com 0 contratos ATIVOS com `kwhContratoAnual=NULL`.
5. **Limpar `kwhContrato`**: marcar `@deprecated` no schema ou remover após 30 dias de estabilidade.

**Dependências:**

- **Decisão produto Luciano** sobre unidade do legado (não dá pra inferir do schema sozinho).
- **Caminho A canário rodar** (Fatia A) — pode substituir backfill por **re-cadastro/import correto** quando produção real subir. Se canário valida o re-cadastro como caminho preferido, **D-32 vira "ADIADO indefinidamente"** como D-30R Forward-only.

**Estimativa:** 3-4h Code (auditoria + script + dry-run + execução supervisionada) + revisão Luciano por cooperado nos casos ambíguos.

**Status atual:** **AGUARDANDO** decisão de subir produção real. Enquanto banco for fictício/teste, débito fica catalogado mas inerte.

**Origem:** sessão Code 12/05 noite (investigação ampla Plano Mestre Opção 4) — Fase 0 mapeou os 5 services que tocam `kwhContratoAnual` e revelou os 61 contratos legados com NULL. Catalogado nesta sessão (B.1 da Fatia H).

---

### D-33 — Dual-path Asaas (dessincronia `AsaasConfig` vs `ConfigGateway`)

**Severidade:** **P1** — sandbox tolera (ambas tail diferentes mas testáveis), produção causa bug operacional (sistema pode usar credencial "errada" em runtime).

**Tema:** dois models de gateway pra Asaas coexistem no schema com credenciais diferentes:
- **`AsaasConfig`** (LEGADO, `schema.prisma:1346` com comentário "manter por compat sandbox"): 1 registro CoopereBR sandbox tail `dfe8`, criado 23/03, updated 27/04.
- **`ConfigGateway`** (ATUAL multi-tenant): 1 registro CoopereBR `ASAAS` sandbox tail `2776`, criado 22/04.
- **UI super admin** escreve em `ConfigGateway`.
- **`asaas.service.ts:65`** `getConfig()` lê de `AsaasConfig`.

Resultado: sistema pode usar credencial errada em runtime quando admin atualiza via UI mas service continua lendo do model legado.

**Persona:** cooperado real esperando cobrança gerada (precisa da credencial atualizada) vs admin que configurou credenciais via UI super admin (espera que valha).

**Critério de pronto:**
1. `asaas.service.ts:65` `getConfig()` refatorado pra ler de `ConfigGateway` via adapter (preferindo `ConfigGateway`, fallback `AsaasConfig` durante transição).
2. `AsaasConfig` deprecado no schema (campo `@deprecated` + comentário apontando pra `ConfigGateway`).
3. Spec Jest cobrindo cenário "ambas configs populadas, usa atual `ConfigGateway`".
4. 1 cobrança Asaas teste fim a fim usando credenciais lidas de `ConfigGateway`.

**Estimativa:** 1-2 dias Code (sub-fatia do **Plano Mestre B.3**).

**Dependências:** nenhuma técnica.

**Bloqueia:** **Fatia A canário** — recomendo fechar essa sub-fatia (consolidação dual-path) **antes** de exercitar E2E real com cooperado de produção, senão dessincronia pode causar erro só visível em prod.

**Origem:** investigação Code 13/05 manhã (item 7 do prompt refinado).

---

### D-34 — Discrepância UI `****MzY5` Asaas (encryption?)

**Severidade:** **P3** — não bloqueia operação, mas investigar pra confirmar segurança e documentar.

**Tema:** UI super admin (`/dashboard/configuracoes/asaas`) mostra "API Key: ****MzY5" como tail visível, mas **nenhum dos 2 registros no banco bate**:
- `AsaasConfig` tail `dfe8`
- `ConfigGateway` tail `2776`
- UI mostra tail `MzY5`

`apiKey` tem **390 caracteres** (vs ~180 esperado pra chave Asaas que começa com `$aact_`) — provavelmente encryption funcionando, e a UI mostra o valor **decifrado** (não o cifrado persistido).

**Persona:** Luciano + admin parceiro futuro que for configurar credenciais via UI super admin (precisa entender o que está vendo).

**Critério de pronto:**
1. Validar via inspeção de `web/app/dashboard/configuracoes/asaas/page.tsx` (e service de leitura no backend).
2. Confirmar `ASAAS_ENCRYPT_KEY` presente em `.env` + identificar algoritmo usado.
3. Documentar encryption no `SISTEMA.md` (Seção 12 env vars).

**Estimativa:** 30 min Code (investigação separada — leitura de 1-2 arquivos + grep da chave de env).

**Dependências:** nenhuma.

**Origem:** investigação Code 13/05 manhã (item 4 do prompt refinado).

---

## Como adicionar item

Quando aparecer débito novo durante sessão:
1. Anotar aqui na seção apropriada (P1/P2/P3) com origem, impacto, decisão
2. Referenciar a sessão/commit que detectou
3. Sugerir fix com tempo estimado
4. Fazer commit isolado: `docs(debitos): registra <descrição>` quando o débito for material; senão pode ir junto com commit de fechamento de sprint

## Como remover item

Quando débito for resolvido:
1. Remover da lista
2. Mencionar na mensagem de commit que fechou o débito
