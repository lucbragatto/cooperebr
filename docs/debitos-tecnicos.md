# Débitos técnicos — SISGD

> Lista consolidada de pendências técnicas conhecidas. Cada item registra
> origem, impacto e prioridade. Atualizar quando débito é resolvido OU quando
> aparece novo durante uma sessão.

**Última atualização:** 2026-05-15 — **Bloco A Sub-Fase B AMAGES fechado** (commits `ccde5ec` + `a09a66e`). Marco M4 redefinido: 1ª validação engine COMPENSADOS em ambiente real (cooperado AMAGES PJ + 2 UCs + Plano + Contrato CTR-2026-0008 + cobrança R$ 979,20 calculada pela engine via PATCH /faturas/aprovar). **D-46.SEED RESOLVIDO** (5 planos publico=false permanente). LancamentoCaixa PREVISTO criado automaticamente (D-54 não ressurgiu).

---

## P0 — Bloqueia produção real (descoberto sessão claude.ai 30/04)

### D-novo-CT-VALIDACAO-FISCAL — Gate de validação fiscal (contabilidade) bloqueia uso fiscal real da estrutura CT (P0 bloqueador produção contábil)

**Severidade:** P0 — bloqueia produção fiscal real (DCTF / SPED / declaração)
**Detectado em:** 2026-05-31 — Sprint CT.4 (concepção do gate) + CT.6 (estrutura completa entregue 31/05)
**Impacto:** estrutura técnica do Sprint Contabilidade Tributária (CT.1→CT.6) está 100% pronta, **mas os números calculados pelo motor NÃO podem virar valor fiscal real** até o validação interna (Luciano + orquestrador) validar.

**O que Luciano + orquestrador precisa validar antes de produção contábil:**

1. **Alíquotas/presunção em `ConfiguracaoTributaria`** (defaults Lucro Presumido — `irpjPercentualPresuncao=0.32` + `csllPercentualPresuncao=0.32` são chute conservador genérico; SCEE/energia pode ter % diferente). Luciano + orquestrador ajustam via UI `/dashboard/contabilidade` (futuro com Polimento UX) ou direto via endpoint.
2. **Classificação dos repasses por `formaAquisicao`** — regra "ALUGUEL=NAO_COOPERATIVO / CESSAO=PROPRIO / PROPRIA=PROPRIO" está hardcoded em `regimes/cooperativo.regime.ts`. Confirmar coerência com parecer contábil real.
3. **10 contas seed do plano de contas segregado** — `naturezaContabil` + `naturezaCooperativa` + `fundamentoLegal` em cada conta. Luciano + orquestrador confirma se classificação está correta pra atividade real da CoopereBR.
4. **10 lançamentos amostrais com flag `validadoContador=false`** — Luciano + orquestrador passa em cima dos primeiros lançamentos reais que vão entrar em produção, confirma classificação e marca como validados via endpoint `PUT /apuracao/:id/validar`.
5. **Flag `Cooperativa.isencaoPisCofinsAtiva`** — STF Tema 536 em julgamento mai/jun 2026. Luciano + orquestrador decide se mantém `true` (PIS/COFINS sobre próprio = isento, posição STF atual) ou `false` (calcula PIS/COFINS sobre próprio caso STF reverta). **Advogado também acompanha o tema.**

**Onde está catalogado tecnicamente:**

- Todos os snapshots `ApuracaoMensalSegregada` nascem com `validadoContador=false`
- Todos os PDFs (Demonstrativo Não-Lucratividade + Memorial Cálculo Fiscal + Demonstrativo Repasses) saem com watermark "PENDENTE VALIDAÇÃO FISCAL" + banner em destaque
- DREs (4 visões) retornam `avisoValidacao` destacado enquanto não validados
- `ConfiguracaoTributaria` tem flag própria `validadoContador` (Luciano + orquestrador validam defaults antes de virar valor fiscal real)

**Como destravar:**

1. validação interna (Luciano + orquestrador) faz reunião dedicada de revisão dos pontos 1-5 acima
2. Luciano + orquestrador validam via endpoint `PUT /contabilidade-tributaria/apuracao/:id/validar` (ADMIN+SA + AuditLog)
3. Snapshot vira oficial — DREs/PDFs trocam badge "PENDENTE" → "VALIDADO INTERNAMENTE <data>"
4. Aí pode usar pra DCTF / SPED / declaração fiscal real

**Estimativa Code (uma vez Luciano + orquestrador validamr):** 0h — código já pronto, é só clicar.

**Estimativa Luciano + orquestrador:** sessão dedicada 2-4h dele + 1-2h Code com ele pra UX (Polimento UX já vai cobrir).

**Status:** 📋 Catalogado em 2026-05-31. Aguarda agendamento Luciano + orquestrador.

---

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
**Status 18/05 noite:** 🟡 **AVANÇO PARCIAL** — Sprint 8 / Bloco E (M14.A — commit `2ffed62`) entregou `AlocacaoValidadorService.validarClasseGd` que bloqueia mudança de classe quando `Contrato.classeGdAplicada` (Caminho B, novo campo) está populado E `Usina.classeGdAnotada` da usina destino diverge. Engine de otimização proativa não sugere movimentações que violem. **Bloqueio completo aguarda:** (a) Sprint 5a Neutro (entrega UI pra admin popular `classeGdAplicada` por contrato) + (b) backfill manual de `Usina.classeGdAnotada` por usina. Hoje validador retorna `warn` (não bloqueia) quando qualquer dos dois campos é null.
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

### D-30N — AuditLog interceptor ✅ RESOLVIDO (Fase 2F Hardening, 14/05/2026)

**Severidade:** P2 (resolvido)
**Detectado em:** 2026-04-30 noite (E2E commit `f3a0434`)
**Revisado em:** 2026-05-02 manhã (validação prévia com leitura de código)
**Resolvido em:** 2026-05-14 noite (Fase 2F Hardening, commit `26836ab`)

**Diagnóstico anterior:** "interceptor existe mas não foi ativado".

**Diagnóstico revisado:** **interceptor não existe.** Sprint 13a Dia 1 criou
APENAS o `model AuditLog` no `schema.prisma:1740`. Nenhum arquivo TypeScript
em `backend/src/` referencia `AuditLog` ou `auditLog` (`grep -rn` retorna 0).

Schema completo no Prisma (`usuarioId`, `acao`, `recurso`, `metadata`, `ip`,
índices criados) — pronto pra usar quando interceptor for criado.

**Solução entregue (Fase 2F):**
- `backend/src/audit/audit.service.ts` — persiste entradas, falha silenciosa.
- `backend/src/audit/audit-log.decorator.ts` — `@AuditLog({acao, recurso, recursoIdParam?})`.
- `backend/src/audit/audit-log.interceptor.ts` — APP_INTERCEPTOR global, dispara em `tap` após sucesso.
- `backend/src/audit/audit.module.ts` — @Global, registrado em `app.module.ts`.
- 18 endpoints sensíveis decorados: cooperados (criar/atualizar/modo-remuneracao/aprovar-concessionaria/cadastro-completo/deletar/lote-status), contratos (criar/atualizar/ativar/deletar), cobrancas (criar/atualizar/dar-baixa/cancelar/deletar), asaas (config.salvar/cobranca.cancelar), cooperativas (criar/atualizar/plano.vincular/deletar), saas (plano CRUD/fatura.gerar).
- Captura impersonate preparada (`impersonating`, `cooperativaImpersonadaId`) pra Sprint 13b.

**Smoke validado:** PUT /cooperados/:id → HTTP 200 → +1 entrada AuditLog com `usuarioId`, `perfil`, `acao='cooperado.atualizar'`, `recursoId`, `cooperativaId`, IP, UA, metadata.

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

### D-novo-UX-Dialog-Backdrop — backdrop-blur do Dialog faz a taskbar do Windows piscar

**Arquivo:** `web/components/ui/dialog.tsx:34`

`DialogOverlay` = `fixed inset-0 isolate z-50 bg-black/10 supports-backdrop-filter:backdrop-blur-xs`.
Combinado com scroll-lock do Radix no body, faz o browser recalcular viewport e
"piscar" a taskbar transparente do Windows ao abrir/fechar Dialogs.

**Fix proposto:** trocar `backdrop-blur-xs` por `bg-black/30` sólido (sem blur) OU
remover o `backdrop-blur` totalmente (mantém só o `bg-black/10`).

**Severidade:** P3 (cosmético — não afeta funcionalidade).
**Catalogado:** 02/06/2026 (D-FISCAL-2.4.4f diagnóstico — Luciano relatou "barra do
Windows some" ao clicar "Gerar agora" da consolidada custeio).

---

### D-novo-CT-TARIFA-ALOCACAO — ALOCACAO_FIXA sem membros + sem UC do pagador cai no fallback genérico de tarifa

**Arquivo:** `backend/src/convenios/convenios-custeio.service.ts:307-317` +
`backend/src/common/tarifa-helper.ts:42-50`.

Quando o convênio é `ALOCACAO_FIXA` + `pagador=EMPRESA` SEM_UC + zero membros (caso
real "pacote pré-pago"), `distribuidoraUsada` resolve `null` (não há UCs
predominantes nem do pagador). O helper `buscarTarifaPorDistribuidora` cai no
fallback `findFirst orderBy dataVigencia desc` — pega a TarifaConcessionaria mais
recente do banco INDEPENDENTE da distribuidora.

**Hoje serve:** SISGD opera EDP-ES como única tarifa relevante — o fallback acerta.
Mas com tenant multi-distribuidora ou múltiplas tarifas vigentes simultâneas,
pode pegar tarifa errada silenciosamente.

**Fix proposto:** adicionar campo opcional `ContratoConvenio.distribuidoraReferenciaTarifa`
(enum DistribuidoraEnum) — se setado, força a busca por essa distribuidora; senão
cai no fallback atual.

**Severidade:** P3 (não-bloqueante — fallback acerta no contexto atual).
**Catalogado:** 02/06/2026 (D-FISCAL-2.4.4f).

---

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

**Tema:** extrair especificação operacional de 6 painéis (Luciano, Marcos, Ana, Carlos, Helena+Patrícia, Luciano + orquestrador) pra `docs/PAINEIS-POR-PAPEL.md` (novo arquivo) ou Apêndice E em PRODUTO.md.

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

### D-33 — Dual-path Asaas — 🟡 P2 LATENTE / DOCUMENTADO (reframed 13/05 noite)

**Status:** 🟡 **P2 LATENTE / DOCUMENTADO** — risco existe mas não está dispando hoje. NÃO marcar como RESOLVIDO. Reavaliar quando Fatia L (UI parceiro auto-config Asaas) começar.

**Severidade:** **P2** (era P1 no catálogo original 13/05 manhã). Reduzida porque não há dessincronia ATIVA — apenas LATENTE.

**Tema original (13/05 manhã — premissa parcialmente errada):** dois models de gateway pra Asaas coexistem no schema com credenciais diferentes:
- **`AsaasConfig`** (LEGADO, `schema.prisma:1348` — corrigido linha): 1 registro CoopereBR sandbox tail `dfe8`, criado 23/03, updated 27/04.
- **`ConfigGateway`** (ATUAL multi-tenant): 1 registro CoopereBR `ASAAS` sandbox tail `2776`, criado 22/04.
- ~~**UI super admin** escreve em `ConfigGateway`.~~ **ERRADO** — ver Reframe abaixo.
- **`asaas.service.ts:65`** `getConfig()` lê de `AsaasConfig`.

### Reframe Fase 1 (13/05 noite) — investigação read-only revelou:

**UI super admin NÃO escreve em `ConfigGateway`.** O caminho real:
- `/dashboard/configuracoes/asaas` → `POST /asaas/config` → `AsaasController.salvarConfig:38` → `AsaasService.salvarConfig:81` → `prisma.asaasConfig.upsert(...)` → escreve em **`AsaasConfig` (legado)**.
- `AsaasService.getConfig:65` lê de `AsaasConfig`.
- `AsaasService.processarWebhook:349` lê de `AsaasConfig`.
- `GatewayPagamentoService.resolverAdapter:35,70` lê de `ConfigGateway` apenas pra resolver qual adapter usar; depois delega pro `AsaasAdapter` que delega pro `AsaasService` que lê de novo `AsaasConfig`.

**Conclusão:** UI + service + webhook **consistentes em `AsaasConfig`**. **Zero dessincronia ATIVA hoje.** Os 5 `AsaasCobranca` validados em Sprint 12 (sandbox CoopereBR) provam que o caminho funciona end-to-end.

**Risco real:** **LATENTE** — futura UI parceiro (Fatia L do Plano Mestre — UI auto-config Asaas no painel `/parceiro/`) precisa migrar leitura junto se decidir escrever em `ConfigGateway`. Sem isso, dispara dessincronia.

### Decisão 13/05 noite — Caminho B aprovado

Optado pelo **Caminho B (docs only)** ao invés de **Caminho A (refator 1-2d Code)** porque:
1. Operação atual funciona (5 cobranças sandbox provadas).
2. Refator de `getConfig` pra ler `ConfigGateway` tem risco de encryption não-validada (`ConfigGateway.credenciais` populado via seed/script — não validei se cifrado no mesmo formato `iv:enc:tag` AES-256-GCM).
3. Próxima cobrança real (Fatia A canário) usa mesmo caminho consistente que UI — sem regressão esperada.

**Reavaliar quando:** Fatia L começar — provavelmente absorvido lá como sub-tarefa "migrar leitura junto com escrita".

### Bloqueio (atualizado)

~~**Bloqueia Fatia A canário**~~ → **NÃO bloqueia mais.** Fatia A pode rodar sem D-33 fechar. Caminho consistente atual (UI escreve `AsaasConfig`, service lê `AsaasConfig`) é o mesmo que canário usaria.

### Persona (atualizada)

**Persona:** futuro engenheiro implementando **Fatia L** que assumir "service lê de `ConfigGateway`" e escrever só em `ConfigGateway` (sem migrar leitura) — quebra silenciosamente. Risco de regressão Fatia L → Fatia A.

### Critério de pronto (revisado)

D-33 **fica aberto como sentinela** (não fechar). Critério de pronto vira:
1. **Fatia L incluir migração de leitura junto com escrita ConfigGateway** (sub-tarefa do escopo Fatia L).
2. OU **decisão explícita** de manter `AsaasConfig` legado indefinidamente (`ConfigGateway` vira só metadata pra `GatewayPagamentoService` resolver adapter).
3. Spec Jest dual-path quando refator acontecer (Fatia L ou outra).

### Estimativa atual

- **Caminho B (já entregue 13/05):** 45 min docs (Reframe em SISTEMA.md + debitos + plano + controle).
- **Caminho A (não escolhido):** 1-2 dias Code se vier a ser necessário.
- **Caminho C (não escolhido):** 3-5 dias Code se decidir consolidar de vez.

**Origem:** investigação Code 13/05 manhã (item 7 do prompt refinado) catalogou D-33. **Reframe** Fase 1 D-33 noite 13/05 (Caminho B).

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

### D-48 — 🚨 SEGURANÇA P1 — Isolamento multi-tenant ausente em 6 sites de leitura/criação de Contrato↔Usina ✅ RESOLVIDO

**Severidade:** P1 SEGURANÇA (chapéu, 6 sub-itens — todos resolvidos)
**Resolvido em:** 2026-05-14 noite (Fase 2 Hardening A-I completa, commits `3106e6d` 2A + `fef024a` 2B + Fase 2C-2E + `26836ab` 2F + `8fd28dc` 2H + bonus IDOR fix em `cooperados.service.update/remove`)

**Origem:** sessão 14/05/2026 tarde (continuação) — Sub-Fase A canário travou no DIEGO 6/6 com `ForbiddenException: Violação multi-tenant no contrato CTR-2026-0004`. Investigação revelou bug NÃO é só motor-proposta — é padrão sistêmico em **6 caminhos** que leem `Usina` no fluxo de criação/atualização de Contrato.

**Manifestações já em produção:**
- `CTR-2026-0003` (Luciana Meireles, cooperado seed ambienteTeste=true): Contrato CoopereBR vinculado a Usina **Solar Serra** que pertence a **CoopereBR Teste**. Status ATIVO há 6 semanas. 1 cobrança VENCIDO gerada. Criado via caminho não-motor-proposta (`propostaId=null` — provavelmente `contratos.controller POST /contratos` direto).
- `CTR-2026-0004` (DIEGO, sessão 14/05): mesmo padrão — Contrato CoopereBR vinculado a TESTE-USINA-B5 de TESTE-FASE-B5. Foi este que disparou a investigação.

**Princípio violado:** Defense-in-depth multi-tenant. Hoje a defesa depende exclusivamente do frontend disciplinado enviar IDs corretos. Atacante passando `usinaId` válido de outro tenant via API teria sucesso na criação de contrato cross-tenant — e só seria pego depois, na geração de cobrança (`faturas.service.ts:1844`).

#### Sub-itens (6 sites com bug)

**D-48.1 — `motor-proposta.service.ts:639`** — `tx.usina.findMany({ where: { capacidadeKwh, distribuidora } })` no `aceitar()`. **Fix cirúrgico:** adicionar `cooperativaId: dono.cooperativaId` (já no escopo, linhas 480-489). Mesmo padrão já existe na linha 526 (Plano findFirst). **1 linha.**

**D-48.2 — `motor-proposta.service.ts:1152`** — `tx.usina.findUnique({ where: { id: usinaId } })` no recálculo de % na ativação de contrato. **Fix:** adicionar `cooperativaId: contrato.cooperativaId` no `where`. Severidade baixa (usinaId já vem de contrato existente — mas leitura cruza tenant).

**D-48.3 — `cooperados.service.ts:498, 523` (`cadastroCompleto`)** — 2 chamadas `tx.usina.findUnique({ where: { id: usinaId } })` em validação ANEEL + capacidade. **Fix:** adicionar `cooperativaId: dto.cooperativaId ?? cooperativaId` (disponível no escopo linhas 447/464).

**D-48.4 — `cooperados.service.ts:1279` (`alocarUsina`)** — `prisma.usina.findUnique({ where: { id: usinaId } })`. Método **NÃO recebe `cooperativaId` na assinatura**. `cooperado.cooperativaId` está disponível via cooperado carregado (linhas 1256-1267) mas não é usado. **Fix:** propagar `cooperado.cooperativaId` para o `where` da query. Alternativa mais segura: mudar assinatura pra receber `cooperativaId` explícito.

**D-48.5 — `migracoes-usina.service.ts:110, 435, 442`** — 3 chamadas `findUnique({ id })` em `migrarCooperado` e `migrarTodosDeUsina`. `dto.cooperativaId` disponível (validado em SEC-07 linhas 73-84) mas não propagado pra query de Usina. **Fix:** adicionar `cooperativaId: dto.cooperativaId` (com bypass SUPER_ADMIN se `null`).

**D-48.6 — `contratos.service.ts:68` (`validarCapacidadeUsina`) — CRÍTICO** — helper usado tanto em `create` quanto `update` de Contrato via HTTP. NEM o DTO NEM o controller (`contratos.controller.ts:41,47`) injetam `cooperativaId` do usuário autenticado. Defesa atual depende exclusivamente do frontend mandar IDs corretos. **Fix exige:**
- Adicionar parâmetro `cooperativaId` na assinatura de `validarCapacidadeUsina`, `create`, `update`
- Injetar `@CurrentUser() user` (ou similar) em `contratos.controller`
- Atualizar callers internos (se houver fora do controller)
- Atualizar specs Jest que testam `create`/`update` sem `cooperativaId`

**D-48.7 — `usinas.service.ts:261` (`verificarListaEspera`) — médio** — método "trust the caller" cria Contrato (linha 318) herdando `usina.cooperativaId` como tenant do novo contrato. Validação de quem pode chamar fica 100% no controller. **Fix conceitual:** adicionar guard que valida `req.user.cooperativaId === usina.cooperativaId` (ou bypass SUPER_ADMIN).

#### Fix completo (escopo B2 — escolhido em 14/05 tarde)

**Estimativa:** 6-8h Code distribuídas:
- 2-3h patches 6 sites + alterações de assinatura
- 1-2h injetar `@CurrentUser` em `contratos.controller` + revisão callers
- 1-2h specs Jest (provavelmente 8-12 specs afetadas)
- 1h build + rebuild + restart PM2 + smoke test
- 30min auditoria SQL pré e pós (contratos divergentes)

#### Saneamento de casos manifestados (junto com fix)

**SQL UPDATE pra corrigir os 2 contratos divergentes já existentes:**

```sql
-- CTR-2026-0004 (DIEGO) — recuperar pra usina-linhares
UPDATE contratos
SET usina_id = 'usina-linhares', 
    percentual_usina = ROUND((490::numeric / 150000) * 100 * 10000) / 10000
WHERE id = 'cmp4jpk2o000bvagcgxaai4t3';

-- CTR-2026-0003 (Luciana seed ambienteTeste=true) — saneamento
UPDATE contratos
SET usina_id = 'usina-linhares',
    percentual_usina = ROUND((1000::numeric / 150000) * 100 * 10000) / 10000
WHERE id = 'cmncg235l0001uowo72x7kx6k';
```

#### Risco do fix

**Médio-alto.** Mudança de assinatura em `contratos.service`/`controller` exige atualizar TODOS os callers. Specs Jest existentes podem precisar refator. Mitigação: rodar `npm test` (suite Jest) entre cada patch + smoke E2E após rebuild.

#### Bloqueio

**Sub-Fase A canário 14/05 BLOQUEADA** até D-48.1 (motor-proposta:639) resolver — DIEGO travou exatamente nele.

Demais 5 sub-itens não bloqueiam Sub-Fase A, mas representam **risco de segurança ativo** em produção (CTR-2026-0003 é evidência).

#### Recomendação cronológica

1. **D-48.1** primeiro (1 linha) — destrava Sub-Fase A
2. Recuperar DIEGO + CTR-2026-0003 via SQL UPDATE
3. Re-rodar Sub-Fase A pros 3 cooperados restantes
4. **D-48.2 a D-48.7** em sequência — patches + specs Jest
5. Smoke test completo via API HTTP (criar Contrato com `usinaId` errado deve retornar 403/404)
6. Commit isolado por sub-item ou commit consolidado D-48-fix (decidir conforme custo)

---

### D-50 — `gerarCobrancaPosFatura` cria `Cobranca` sem `cooperativaId` ✅ RESOLVIDO

**Severidade:** P1 (afeta listagem operacional)

**Origem:** sessão 14/05/2026 tarde-noite. Detectado por Luciano em validação visual `/dashboard/cobrancas` (4 cobranças piloto invisíveis). Diagnóstico read-only do Code confirmou causa.

**Causa raiz:** `faturas.service.ts:662-690` (método `gerarCobrancaPosFatura`) criava `Cobranca` sem passar `cooperativaId` no objeto `data`. Schema permite nullable (`Cobranca.cooperativaId String?`), ficava `null`. `GET /cobrancas` filtra por `cooperativaId = user.cooperativaId`, excluindo registros `null`.

**Bug LATENTE desde commit `b0e0345` (Fase B.5, 03/05/2026), NÃO regressão.** Manifestou-se em 14/05 porque foi o primeiro uso E2E real de `gerarCobrancaPosFatura` com cooperado real CoopereBR (Sub-Fase A canário). 17 `FaturaProcessada` anteriores eram 12 seeds Fase B.5 (não chamavam pipeline pós-OCR) + 5 legados sem cobrança gerada.

**Fix:** adicionar `cooperativaId: contrato.cooperativaId` ao `data` do `prisma.cobranca.create`. Padrão já existia em `cobrancas.service.ts:191`.

**Saneamento:** 4 cobranças piloto existentes atualizadas via script `backend/scripts/saneamento-d50-cooperativa-id.ts`. Validação pós-fix: 38 cobranças CoopereBR + 0 cobranças com `cooperativaId` null.

**Manifestação adjacente fora do escopo D-50:** `faturas.service.ts:1054` (gerarCobrancasLote) tem o mesmo padrão de criação sem `cooperativaId`. **Corrigida posteriormente como D-50.2** (commit consolidado pós-canário 14/05 noite).

**Status:** ✅ RESOLVIDO (commit final desta sessão).

---

### D-50.2 — `gerarCobrancasLote` cria `Cobranca` sem `cooperativaId` ✅ RESOLVIDO

**Severidade:** P1 latente (mesmo padrão D-50, bug-gêmeo)

**Origem:** sessão 14/05/2026 tarde-noite. Manifestação adjacente reportada durante D-50 — fora do escopo cirúrgico daquele commit, catalogada e corrigida no commit consolidado pós-canário.

**Causa raiz:** `faturas.service.ts:1054` (método `gerarCobrancasLote`) tinha o mesmo padrão de criação que `gerarCobrancaPosFatura` — não passava `cooperativaId` no objeto `data`. Bomba-relógio: o próximo lote teria gerado novas cobranças órfãs.

**Fix:** adicionar `cooperativaId: contrato.cooperativaId` ao `data` do `prisma.cobranca.create`. Identico ao D-50.

**Status:** ✅ RESOLVIDO (commit consolidado D-50.2 + D-51 + D-52 + D-53 + catalog D-54).

---

### D-51 — Frontend `/dashboard/cobrancas` sem label/cor para status `A_VENCER` ✅ RESOLVIDO

**Severidade:** P3 UX

**Origem:** sessão 14/05/2026 tarde-noite. Após validação visual pós Sub-Fase A, as 4 cobranças piloto apareciam com **badge sem texto** (só cor padrão) porque `statusLabel` e `statusClasses` em `web/app/dashboard/cobrancas/page.tsx:21-33` não tinham entrada `A_VENCER`. Cobranças criadas via `gerarCobrancaPosFatura` ficam com `status='A_VENCER'` (faturas.service.ts:672), enum válido no schema mas órfão no frontend.

**Fix:** adicionar entrada `A_VENCER: 'A vencer'` (rótulo) e `A_VENCER: 'bg-blue-100 text-blue-800 border-blue-200'` (cor) em ambos os Records, mais opção no `<select>` de mudança de status (linhas 152-156).

**Status:** ✅ RESOLVIDO (commit consolidado).

---

### D-53 — Tabela `/dashboard/cobrancas` sem scroll horizontal ✅ RESOLVIDO

**Severidade:** P3 UX

**Origem:** sessão 14/05/2026 tarde-noite. Validação visual mostrou que a tabela tem 9 colunas (Cooperado, Contrato, Mês/Ano, Bruto, Desconto, Líquido, Vencimento, Status, Ações) e em telas comuns (1366px) só cabe reduzindo zoom. Sem `overflow-x:auto` no container.

**Fix:** envolver `<Table>` em `<div className="overflow-x-auto">` dentro do `<CardContent>`. Container ganha scroll horizontal sem afetar layout.

**Status:** ✅ RESOLVIDO (commit consolidado).

---

### D-54 — `LancamentoCaixa` PREVISTO faltante em `gerarCobrancaPosFatura` ✅ RESOLVIDO

**Severidade:** P1 latente

**Origem:** sessão 14/05/2026 tarde-noite, durante diagnóstico D-52 (read-only). Code reportou que `gerarCobrancaPosFatura` NÃO cria `LancamentoCaixa` PREVISTO. Só o Caminho B (`cobrancas.service.create` manual) cria.

**Causa raiz:** `faturas.service.ts:662-700` (gerarCobrancaPosFatura) omite criação de `LancamentoCaixa` PREVISTO. Memória do projeto + `MAPA-INTEGRIDADE-SISTEMA` diziam que `LancamentoCaixa` PREVISTO é criado na geração da cobrança — mas isso só é verdade pro Caminho B.

**Manifestação:** as 4 cobranças piloto Sub-Fase A (commit `bded89d`) não têm `LancamentoCaixa` PREVISTO associado. SELECT `lancamentos_caixa WHERE cobrancaId IN (4 ids piloto)` retorna **0 registros** (confirmado em 14/05 noite).

**Impacto:** afeta relatórios financeiros (receita prevista sub-reportada) + fluxo de FaturaSaas SISGD (cobrança do parceiro calculada com base em previsto).

**Bug LATENTE desde commit `b0e0345` (Fase B.5, 03/05/2026), não regressão.** Mesma situação do D-50 (gap manifesta agora com primeiro uso E2E real).

**Fix proposto (sessão dedicada futura):**
- Replicar lógica de criação de `LancamentoCaixa` PREVISTO de `cobrancas.service.ts:272-298` dentro de `gerarCobrancaPosFatura`
- Saneamento retroativo: criar `LancamentoCaixa` PREVISTO pras 4 cobranças piloto existentes
- Mesma verificação em `gerarCobrancasLote` (provavelmente tem o mesmo gap)

**Estimativa fix:** 1-2h Code (decisão saneamento + patch + spec + rebuild + verificação).

**Bloqueio:** não bloqueia Sub-Fase A canário completo (cobranças existem, cobrável). Bloqueia fidelidade dos relatórios financeiros.

**Status:** ✅ RESOLVIDO 14/05/2026. Patch em `faturas.service.ts` aplicou padrão idêntico de `cobrancas.service.ts:345-371` em ambos `gerarCobrancaPosFatura` E `gerarCobrancasLote` (bug-gêmeo). Saneamento retroativo via `backend/scripts/saneamento-d54-lancamento-previsto.ts` criou 4 LancamentoCaixa PREVISTO pras 4 cobranças piloto Sub-Fase A (DIEGO R$ 447,68 / CAROLINA R$ 142,32 / ALMIR R$ 940,93 / THEOMAX R$ 1.011,33).

---

### D-52 — PUT `/cobrancas/:id` retorna 500 em `dataPagamento` string ✅ RESOLVIDO

**Severidade:** P1 bloqueante (impede dar baixa via UI)

**Origem:** sessão 14/05/2026 tarde-noite. Luciano clicou "Dar Baixa" em cobrança DIEGO no dashboard e recebeu 500. Logs PM2 mostraram `PrismaClientValidationError: Invalid value for argument 'dataPagamento': premature end of input. Expected ISO-8601 DateTime.`. UI envia `"2026-05-13"` do `<input type="date">`, Prisma rejeita.

**Causa raiz:** `cobrancas.service.ts:387` (método `update`) passava `body` direto pro `prisma.cobranca.update` sem normalizar `dataPagamento`/`dataVencimento`. Função helper `normalizarData()` já existia no mesmo arquivo (linha 38, usada no `create`) mas não era chamada no `update`.

**Fix:** adicionar 4 linhas no início do `update` chamando `normalizarData()` em `data.dataPagamento` e `data.dataVencimento` quando `typeof === 'string'`. Mesmo padrão do `create` (linhas 170-181). Tipos da assinatura ampliados pra `Date | string`.

**Manifestação adjacente:** caminho UI "Dar Baixa" deveria idealmente usar `PATCH /:id/dar-baixa` (já existe em `cobrancas.controller.ts:66`) em vez de PUT genérico. Migração UI fica como sugestão futura (sem débito formal pra não inflar).

**Status:** ✅ RESOLVIDO (commit consolidado).

---

### D-35 — Vocabulário CooperToken não consolidado (5 vocabulários coexistindo)

**Severidade:** P2

**Origem:** sessão 04/05/2026 noite (investigação CooperToken ampla) + relatório `docs/relatorios/2026-05-14-mapeamento-coopertoken-amplo.md`.

**Descrição:** 5 vocabulários coexistem no sistema descrevendo a mesma escolha binária do cooperado entre receber desconto ou acumular tokens:
1. "Caminho DESCONTO / Caminho CLUBE" (`docs/especificacao-clube-cooper-token.md`)
2. "Opção A / Opção B" (`docs/specs/COOPERTOKEN-FUNDAMENTOS.md`)
3. "Plano DESCONTO / Plano Token" (`docs/specs/ESTRATEGIA-COOPERTOKEN-COMPLETA.md`)
4. `modoRemuneracao` enum `DESCONTO`/`CLUBE` (schema Cooperado)
5. `modoToken` String `DESCONTO_DIRETO`/`FATURA_CHEIA_TOKEN`/`AMBAS` (schema Plano)
+ campo legado `opcaoToken` `"A"`/`"B"` `@deprecated` (schema Cooperado)

**Manifestação:** specs divergem entre si. Code novo precisa ler 5 specs pra entender o mesmo conceito. Decisão produto pendente antes do Sprint CooperToken Consolidado Etapa 2 (refator 4 services).

**Fix proposto:** sessão claude.ai dedicada (~2-3h) escolhendo 1 vocabulário canônico (recomendação: `modoRemuneracao` no Cooperado + retirar `modoToken` do Plano) + atualizar 5 specs + migration de dados (campo legado `opcaoToken` ainda popula 317 cooperados, só 232 migrados pra `modoRemuneracao`).

**Estimativa:** 2-3h decisão + 4-6h Code (migration + atualizar specs + UI).

**Bloqueio:** bloqueia Sprint CooperToken Consolidado Etapa 2.

---

### D-36 — FCFS (Fundo Cooperativo de Fomento Solar) catalogado em spec, zero implementação

**Severidade:** P2 estratégico

**Origem:** `docs/specs/COOPERTOKEN-FUNDAMENTOS.md` (02/04, aprovado por Luciano + Assis) detalha FCFS como conceito estruturante.

**Descrição:** FCFS captura spread entre token vendido e token recebido pra financiar novas usinas + EV. Spec detalhada, 0% código.

**Fix proposto:** Sprint dedicado pós-canário AMAGES. Schema novo (`FCFSLedger`, `FCFSEvento`) + service de aporte/saída + integração com `LancamentoCaixa` + relatório.

**Estimativa:** 1-2 sprints (depende escopo).

**Bloqueio:** não bloqueia operação. Bloqueia capitalização estruturada.

---

### D-37 — Eletroposto/EV catalogado em 2 specs, zero implementação

**Severidade:** P2 estratégico

**Origem:** `docs/specs/ESTRATEGIA-INOVACAO-2026.md` + `docs/specs/SPEC-COOPERTOKEN-v1.md` detalham EV/Eletroposto como drenagem de 600k kWh + monetização tokens.

**Descrição:** Token aceito em eletroposto cooperativo. Motorista compra via MST. Spec detalhada, 0% código.

**Fix proposto:** Sprint dedicado pós-Tarifa Branca + smart meters. Schema novo (`Eletroposto`, `Carregamento`, `TokenTransacaoEV`) + integração OCPP + UI motorista.

**Estimativa:** 2-3 sprints (depende parceria externa).

**Bloqueio:** não bloqueia operação. Janela competitiva 2026-2028.

---

### D-38 — Token x Convênio gap maior (NENHUMA spec aborda)

**Severidade:** P1 estrutural

**Origem:** Luciano apontou em 13/05/2026 noite. `docs/specs/PLANO-CONVENIOS-2026-04-01.md` (1457 linhas) **não menciona token nenhuma vez**.

**Descrição:** 3 conexões possíveis não documentadas:
1. Benefício do convênio em tokens (alternativa ao % desconto)
2. Indicação via convênio paga BONUS_INDICACAO automático
3. Conveniado recebe tokens proporcional ao tamanho do convênio

**Fix proposto:** Spec dedicada `docs/especificacao-token-convenio.md` (~4-6h spec) + decisão produto qual conexão priorizar + implementação escolhida (2-3 dias Code).

**Estimativa:** spec 4-6h + implementação 2-3 dias depende decisão.

**Bloqueio:** convênios existentes (215 ConvenioCooperado em CoopereBR) operam sem token hoje, sem prejuízo imediato.

---

### D-39 — Splits 2% hardcoded em `creditar()`

**Severidade:** P2

**Origem:** mapeamento CooperToken 14/05/2026.

**Descrição:** `cooper-token.service.ts:258` tem `0.20` hardcoded com TODO mas não foi tratado. Schema permite configurar splits 50/30/20 (cedente/SISGD/cooperativa) via `ConfigCooperToken` mas código ignora.

**Fix proposto:** ler split de `ConfigCooperToken` em vez de constante. Migration pra popular valores default.

**Estimativa:** 30min Code.

---

### D-40 — Decay HARDCODED 10/20/26/29 dias

**Severidade:** P2

**Origem:** mapeamento CooperToken 14/05.

**Descrição:** `cooper-token.service.ts:282,322` aplicam decay temporal com dias fixos 10/20/26/29. Spec `especificacao-clube-cooper-token.md` define decay configurável via `ConfigCooperToken`.

**Fix proposto:** ler campos de decay de `ConfigCooperToken` (`prazoExpiracaoMeses`, `periodoGracaDias`, `taxaDesvalorizacao`, `pisoValor`). Migration pra popular default 10/20/26/29 se não configurado.

**Estimativa:** 1h Code.

---

### D-41 — 600k kWh saldo escritural não tokenizado

**Severidade:** P2 estratégico

**Origem:** `docs/specs/COOPERTOKEN-FUNDAMENTOS.md` + `docs/specs/SPEC-COOPERTOKEN-v1.md`.

**Descrição:** Spec define que 600k kWh do saldo escritural da CoopereBR seriam estoque inicial pra emissão de tokens lastreados. Hoje 0 tokens emitidos com lastro real (só emissão via BONUS_INDICACAO + GERACAO_EXCEDENTE event-driven).

**Fix proposto:** Sprint Token Genesis — emitir tokens lastreados em saldo escritural + atualizar UI Plano com opção "comprar tokens" + integração MST (D-44).

**Estimativa:** 1 sprint dedicado.

---

### D-42 — Contabilidade Clube sem ponte `LancamentoCaixa`

**Severidade:** P2

**Origem:** `docs/especificacao-contabilidade-clube.md` prevê 4 eventos contábeis + 3 categorias novas no plano de contas.

**Descrição:** `contabilidade-clube.controller.ts` (71 linhas) tem só 1 endpoint `GET /relatorio` read-only. Sem classificação automática + sem ponte com `LancamentoCaixa`.

**Fix proposto:** integrar `CooperTokenLedger` eventos com `LancamentoCaixa` PREVISTO/REALIZADO + criar 3 categorias no plano de contas via seed + classificação Sprint 11 preparatório.

**Estimativa:** 4-6h Code.

---

### D-43 — VPP (Virtual Power Plant) catalogado em spec, zero implementação

**Severidade:** P2 estratégico (tese guia)

**Origem:** `docs/specs/ESTRATEGIA-INOVACAO-2026.md` define VPP como tese central do CoopereBR. Adendo 14/05/2026 noite (memória persistente `project_leitura_noturna_coopertoken_14_05.md`).

**Descrição:** CoopereBR em transição de cooperativa de GD pra Virtual Power Plant — usina virtual que agrega recursos distribuídos e os opera coordenadamente. Token = camada de inteligência da VPP. Spec detalhada, 0% código dedicado.

**Implicação técnica imediata:** decisões arquiteturais devem considerar tese VPP mesmo sem implementar Flex/Social agora.

**Fix proposto:** quando Tarifa Branca + smart meters chegarem (2027+). Sprint Token Flex + Token Social.

**Estimativa:** projeto multi-sprint (1+ ano).

**Bloqueio:** janela competitiva 2026-2028 ES residencial.

---

### D-44 — MST (Mercado Secundário de Tokens) — VPP embrionária proposta

**Severidade:** P1 estratégica

**Origem:** Luciano em 14/05/2026 madrugada. Memória persistente `project_mst_vpp_embrionario_14_05.md`.

**Descrição:** Mercado interno cooperativo onde tokens próximos da expiração circulam entre cooperados via oferta onerosa com desconto. Sistema detecta deficitário via OCR fatura. SISGD oferta ao parceiro que oferta ao cooperado. Cedente recebe % do valor.

**Modo recomendado MVP:** E + F híbrido (cooperado deficitário prioritário + cooperativa intermedia clearing).

**Fix proposto:** Sprint dedicado 5 fases (8-13d Code total):
- Fase 1 (2-3d): MVP marketplace manual — schema + endpoints + tela admin simples
- Fase 2 (1-2d): Cron Modo F — cooperativa compra automático 7 dias antes da expiração
- Fase 3 (2-3d): Detecção deficitário via OCR + notificação proativa Modo E
- Fase 4 (2-3d): Marketplace P2P portal cooperado
- Fase 5 (1-2d): Splits configuráveis + FCFS + relatórios

**Estimativa:** 8-13 dias Code + 1 sprint produto (10 regras críticas + 7 riscos catalogados).

**Bloqueio:** depende vocabulário CT (D-35) consolidado. Pode virar Etapa 3 do Sprint CT Consolidado.

---

### D-45 — Wizard `/dashboard/cooperados/novo` com 4 erros encadeados ✅ PARCIALMENTE RESOLVIDO (3/4)

**Severidade:** P2

**Origem:** sessão 13/05/2026 tarde. Luciano explorando UI. 4 erros visíveis no Console DevTools.

**Descrição dos 4 erros:**
1. `POST /cooperados` 409 Conflict — esperado quando CPF/email dup, mas UI poderia consultar antes via findByCpf
2. `POST /motor-proposta/calcular` 400 Bad Request — `Step3Simulacao.tsx:95-99` dispara auto-cálculo no mount sem `planoId` setado. DTO `dto/calcular-proposta.dto.ts:41-43` exige `@IsNotEmpty() planoId`
3. `POST /propostas/enviar-email` 404 Not Found — endpoint NÃO EXISTE no backend (só existe `/motor-proposta`). Frontend `Step4Proposta.tsx:67` chama URL órfã, resíduo de refactor antigo
4. `POST /motor-proposta/aceitar` 400 Bad Request — controller usa `@Body() body: any` sem class-validator no DTO. Validação acontece dentro do service e retorna erros genéricos

**Manifestação:** Cooperado-piloto MARCIO MACIEL (sessão 11/05) ficou em estado intermediário. Bloqueia cadastro via UI — hoje funciona só via Prisma direto.

**Fix proposto:**
- Bloquear useEffect auto-cálculo no Step3Simulacao sem planoId
- Criar endpoint `POST /motor-proposta/proposta/:id/enviar-email` no controller OU redirecionar Step4Proposta pra ele
- Tipar `AceitarPropostaDto` com class-validator
- Step2Dados: consultar findByCpf antes de POST (evita 409)

**Estimativa:** 4-6h Code (3-4h investigação + tipagem + 1-2h fixes + verificação).

**Bloqueio:** não bloqueia canário via Prisma direto. **BLOQUEIA se canário for via UI** ou se Luciano abrir cadastro pra ADMIN parceiro.

**Status (14/05/2026):** Sub-fixes 1, 2 e 3 RESOLVIDOS. Sub-fix 4 (Step2Dados findByCpf opcional) deixado fora desta sessão (prioridade baixa, UX). Mudanças aplicadas:
- Sub-fix 1: `Step3Simulacao.tsx:95-99` bloqueia auto-cálculo até `planoSelecionadoId` setado.
- Sub-fix 2: `Step4Proposta.tsx:64-87` removeu chamada órfã `POST /propostas/enviar-email` 404. Usa mailto: direto.
- Sub-fix 3: criado `motor-proposta/dto/aceitar-proposta.dto.ts` + controller tipado.
- Sub-fix 4: pendente futura sessão UX.

---

### D-46 — Divergências spec↔Plano/engine (chapéu, 12 sub-itens)

**Severidade:** P2 (com sub-itens P1 internos)

**Origem:** sessão 13/05/2026 tarde-noite — sub-agente claude.ai investigação focada. 13 divergências catalogadas. 1 resolvida em commit `0448f9b` (D-46.W).

**Resumo dos 12 sub-itens abertos:**

#### Sub-itens ALTOS

**D-46.1** — `baseCalculo` triplamente inconsistente. TS type aceita 4 valores, DTO `@IsIn` bloqueia 2 em runtime, helper canônico lança `NotImplementedException`.

**D-46.2** — `tipoDesconto` gravado em 3 lugares, NUNCA lido pelo engine de cobrança recorrente. UX engana cliente.

**D-46.5** — Engine emite token via `tokenPorKwhExcedente > 0`, ignora `cooperTokenAtivo`. Estado inconsistente possível.

**D-46.7** — 5 campos token (`tokenPorKwhExcedente`, `valorTokenReais`, `tokenSocialAtivo`, `tokenFlexAtivo`, `modoToken`) ausentes do DTO + UI. Defaults forever.

#### Sub-itens MÉDIOS

**D-46.3** — `referenciaValor`/`fatorIncremento`/`mostrarDiscriminado` só usados no aceite, engine cobrança ignora.

**D-46.4** — Promoção temporal NÃO funciona em CREDITOS_DINAMICO.

**D-46.6** — 5 vocabulários CooperToken (reforça D-35).

**D-46.SEED** ✅ RESOLVIDO (15/05/2026, commit `ccde5ec`) — 5 planos COMPENSADOS globais marcados `publico=false` **PERMANENTE** (decisão Luciano não religar). Eram: `Plano Residencial 15%`, `Campanha Lançamento 20%`, `PLANO OURO`, `PLANO PRATA`, `CONSUMO DE CREDITOS DE KWH`. Sem `tarifaContratual` snapshot, engine COMPENSADOS não consegue calcular — esses planos seriam armadilha se vazassem em vitrine pública. Script reusável: `backend/scripts/mitigacao-d46-seed.ts`.

#### Sub-itens BAIXOS

**D-46.O1** — `tipoCampanha` sem efeito runtime.
**D-46.O2** — `dataInicioVigencia`/`dataFimVigencia` sem enforcement.
**D-46.8** — `modoToken` via cast `as any` em `cobrancas.service.ts:203`.
**D-46.SPEC** — `especificacao-modelos-cobranca.md` não cruza Modelo x baseCalculo.

**Estimativa fix conjunto:** 16-24h Code distribuídas. ALTAS 8-12h + MÉDIAS 6-9h + BAIXAS 2-3h.

**Bloqueio:** D-46.SEED ✅ RESOLVIDO 15/05 (mitigação permanente). Demais sub-itens não bloqueiam canário. **Sub-Fase B AMAGES já rodou** (commit `a09a66e`) e validou engine COMPENSADOS E2E real (CTR-2026-0008, valorLiquido R$ 979,20).

---

### D-47 — Nomes idênticos OURO/PRATA em 2 tabelas diferentes (Plano membro ↔ PlanoSaas parceiro)

**Severidade:** P3

**Origem:** sessão 13/05/2026 tarde — Luciano apontou tela `/dashboard/saas/planos`.

**Descrição:** `seed.ts:194-220` cria registros na tabela `Plano` com nomes `'PLANO OURO'` e `'PLANO PRATA'`. Já existem registros na tabela `PlanoSaas` com nomes `'OURO'` e `'PRATA'` (mensalidade R$ 9999/R$ 5900).

**Risco:** admin lê doc/print e confunde "Plano OURO" (membro 20% desconto vs parceiro R$ 9999). Investigação técnica fica ambígua.

**Fix proposto (Opção A recomendada):** renomear seed `Plano` membro pra `'CoopereBR Premium 20%'` e `'CoopereBR Standard 15%'`. SQL `UPDATE planos SET nome = ... WHERE id IN ('plano-ouro', 'plano-prata')` + atualizar seed.

**Estimativa fix:** 30min Code (5min seed + 5min SQL + 10min testes Jest + 10min commit/doc).

**Bloqueio:** não bloqueia operação. Bloqueia clareza técnica.

---

### D-novo-A — Conta Asaas sandbox no nome PF Luciano (bloqueia ativação produção real)

**Severidade:** P2 (infra comercial)
**Detectado em:** 2026-05-14 (sub-canário CAROLINA — validação visual boleto sandbox)
**Categoria:** infraestrutura comercial (não código)

**Estado atual:**
- Receiver name: "Luciano Costa Bragatto"
- CPF: 890.893.247-04 (PF Luciano)
- Email: lucbragatto@gmail.com
- Telefone: (XX) XXXXX-1348

**Esperado em produção real:**
- Receiver name: "CoopereBR" (razão social PJ completa)
- CNPJ (não CPF) — CoopereBR como cooperativa
- Email institucional `contato@cooperebr.com.br`
- Telefone institucional CoopereBR

**Impacto:**
- Sandbox: zero (é teste)
- Produção real: cooperado vê "Luciano Costa Bragatto" recebendo o dinheiro — confusão de marca + risco de desconfiança.

**Fix proposto:** abrir conta Asaas produção com PJ CoopereBR (CNPJ) + reconfigurar `AsaasConfig.cooperativaId` apontando pra conta PJ correta.

**Bloqueio:** ativação Asaas produção real bloqueada até resolver.

---

### D-novo-E — Reflexos sistêmicos pós-reforma estatutária CoopereBR (AGE 17/06/2026)

**Severidade:** P2
**Detectado em:** 2026-05-16 (sessão maratona — preparação reforma estatutária)
**Estimativa:** 8-12h Code

A reforma estatutária da CoopereBR (AGE 17/06/2026) implementará:
- Estatuto reformado v3 (preserva Lei 5.764/71 ato cooperativo)
- Edital + Ata AGE/AGE 2026-06-17
- Requisitos funcionais módulo Compliance (catalogados em `docs/templates-documentos/06-institucional-parceiros/coopere-br/`)

**Reflexos no SISGD após reforma aprovada:**
- Atualizar Termo de Adesão atual com cláusulas pós-reforma (ato cooperativo, alocação dinâmica, audit trail obrigatório)
- Atualizar `web/app/assinar/page.tsx:33,59` (D-30H já catalogado — RN 482/2012 → Lei 14.300/2022 + estatuto v3)
- Validar bot CoopereAI prompt sobre regime cooperativo atualizado (D-30I já parcialmente resolvido)
- Implementar requisitos do módulo Compliance (catalogado como sprint dedicado 108h — `requisitos-funcionais-modulo-compliance.md`)

**Bloqueio:** depende AGE 17/06/2026 acontecer + ata aprovada. Não bloqueia desenvolvimento técnico nem outros blocos. Sprint pode rodar em paralelo a B/D/E/F/G após AGE.

---

### D-novo-D — Definir formaPagamentoDono + valor concreto para usinas existentes (Bloco H')

**Severidade:** P3 (UI permite ajuste a qualquer tempo)
**Detectado em:** 2026-05-16 (Bloco H' Cadastro Usina expandido — decisão Luciano flexibilizou pagamento dono)
**Atualizado em:** 2026-05-17 (mini-bloco H'.9 — opção HIBRIDO aprovada por Luciano após visita à tela `/dashboard/usinas/nova`)

Schema Usina aceita `formaPagamentoDono` (FIXO/PERCENTUAL/**HIBRIDO**/null) + `valorAluguelFixo` (se FIXO ou HIBRIDO) + `percentualGeracaoDono` (se PERCENTUAL ou HIBRIDO), mas:
- Cooperebr1 (Linhares 1): `formaAquisicao=ALUGUEL`, `formaPagamentoDono=null`, valores null.
- Cooperebr2 (Linhares 2): `formaAquisicao=ALUGUEL`, `formaPagamentoDono=null`, valores null.

**Fix:** após acordo formal entre parceiro (CoopereBR) e dono de cada usina, preencher via UI `/dashboard/usinas/[id]` ou script:
- Escolher `FIXO` (com `valorAluguelFixo > 0`) OU `PERCENTUAL` (com `0,01 ≤ percentualGeracaoDono ≤ 100`) OU **`HIBRIDO`** (com **AMBOS** preenchidos — valorAluguelFixo > 0 E 0,01 ≤ percentualGeracaoDono ≤ 100).
- Replicar pras demais usinas (Solar Norte, Sul, Palmeiras, Guarapari, Serra).

**Bloqueio:** nada operacional — apenas relatórios financeiros completos sobre custo de arrendamento ficam incompletos.

**Sub-débito relacionado D-novo-D.1 — opção HIBRIDO faltante no enum (resolvido 2026-05-17):**
- Tela `/dashboard/usinas/nova` mostrava só "Fixo mensal" e "Percentual sobre geração" — sem opção combinada.
- Schema tinha `valorAluguelFixo` e `percentualGeracaoDono` separados (ambos opcionais), mas enum `FormaPagamentoDono` só tinha 2 valores.
- Mini-bloco H'.9 adicionou `HIBRIDO` ao enum + DTO class-validator + UI lógica condicional (1-1.5h Code).
- 100% das 10 usinas com `formaPagamentoDono=null` na data — migração puramente aditiva, sem `--accept-data-loss`.

---

### D-novo-B — Descrição da cobrança Asaas confusa ("Mensalidade SISGD")

**Severidade:** P3 (UX/branding)
**Detectado em:** 2026-05-14 (sub-canário CAROLINA — validação visual boleto sandbox)
**Categoria:** código (string template)

**Estado atual:** `"Mensalidade SISGD 05/2026 - CTR-2026-0005"`

**Análise:**
- "SISGD" é a plataforma (Luciano dono) — cooperado paga a CoopereBR, não SISGD.
- "05/2026" = competência (mês corrente).
- Cobrança é referente a fatura `mesReferencia=01/2026` (consumo JAN/2026).
- "CTR-2026-0005" = id do contrato (OK).

**Esperado:** `"CoopereBR — Fatura 01/2026 (CTR-2026-0005)"` ou `"Cobrança CoopereBR mês referência 01/2026"`.

**Impacto:**
- Cooperado lê "Mensalidade SISGD" e não entende o que está pagando.
- Confunde competência (05/2026) com referência da fatura (01/2026).
- Onboarding novos parceiros (Sinergia): vocabulário interno "SISGD" exposto.

**Fix proposto:**
- Localizar template em `backend/src/gateway-pagamento/gateway-pagamento.service.ts` OU `backend/src/asaas/asaas.service.ts`.
- Trocar pra usar nome da cooperativa + `mesReferencia` da fatura (não competência).

**Estimativa:** 1-2h Code (1 string template + ajuste 2-3 callers + smoke).

---

### D-55 — Sprint Compliance Fiscal (SPED/NF3e/eSocial/e-Financeira) — futuro

**Severidade:** P3 (estratégico, não bloqueia operação atual)
**Origem:** Sessão 17/05/2026 — decisão Luciano de **separar** integrações fiscais externas do Sprint Contabilidade Tributária Segregada (que entra na posição #8 do roadmap A→H).

**Contexto:**
- Sprint Contabilidade Tributária Segregada (61h Code, posição #8) cobre: segregação Ato Cooperativo Próprio × Auxiliar × Não Cooperativo + DRE segregada + apuração tributária + demonstrativos fiscais defensáveis (Memorial de Cálculo).
- **NÃO cobre:** geração/transmissão de SPED Fiscal, SPED Contribuições, SPED ECF, SPED ECD, NF3e (Nota Fiscal de Energia Elétrica Eletrônica), eSocial, e-Financeira.
- Esses módulos vão para Sprint Compliance Fiscal SEPARADO.

**Por quê separado:**
- Cada integração fiscal externa é complexa (~10-15h Code) — somar tudo no sprint #8 estouraria 100h+.
- Trigger de prioridade pode ser diferente (auditoria Receita Federal vs reforma estatutária CoopereBR).
- Requer biblioteca de validação fiscal externa (sped-validator, nfe3e-emit) ou homologação direta com Receita/SEFAZ.

**Escopo (não detalhado ainda):**
- SPED Fiscal (EFD-ICMS/IPI) — escrituração fiscal digital
- SPED Contribuições (PIS/COFINS)
- SPED ECF (Escrituração Contábil Fiscal — anual, substitui DIPJ)
- SPED ECD (Escrituração Contábil Digital — substitui Livro Diário e Razão)
- NF3e — Nota Fiscal de Energia Elétrica Eletrônica (cooperativas geradoras precisam emitir)
- eSocial — folha de pagamento + tributos previdenciários
- e-Financeira — declaração de movimentação financeira (Receita Federal)

**Estimativa:** 40-60h Code (a detalhar quando chegar a vez).

**Posição no roadmap:** #12 (após Sprint Contabilidade Tributária Segregada #8, após Sprint G Assinafy #9, após Sprint Módulo Documentos #10, após Sprint Módulo Compliance #11).

**Pré-requisitos:**
- Sprint Contabilidade Tributária Segregada (#8) concluído — fornece a NaturezaContabil + DRE segregada que alimentam SPED
- Definição de regime tributário da CoopereBR (Lucro Presumido / Simples Nacional / Lucro Real) — alguns SPEDs variam por regime
- Cadastro de tributos por município (ICMS varia por estado, ISS por município) — ainda não modelado no schema

**Status:** 📋 Catalogado em 17/05/2026, aguarda Sprint Contabilidade Tributária Segregada (#8) concluir para começar refinamento.

---

### D-novo-H — Refator técnico convenção `capacidadeKwh` MENSAL (P1 estratégico — DADOS RESOLVIDOS, código pendente)

**Severidade:** P1 estratégico (não bloqueia operação atual; afeta `ajustarKwh`/`migrarCooperado` e cadastros de 2 usinas legado)
**Detectado em:** 2026-05-17 noite (Mini-Sprint Bugs Usinas — Fase 4.5 read-only ampliada)
**Decisão produto:** ✅ RESOLVIDA 2026-05-17 noite — convenção **MENSAL** oficial (memória `decisao_convencao_mensal_oficial_17_05.md`)
**Status 18/05 noite:** 🟡 **SANEAMENTO DE DADOS APLICADO** dentro do Sprint 8 (M14.A — commit `39ef190`). Solar Guarapari 600.000 → 50.000 kWh/mês + Solar Serra 480.000 → 40.000 kWh/mês via `backend/scripts/sanear-usinas-anual-sprint8.ts` (0 cooperados afetados em ambas — risco zero). Refator de código continua aberto (contratos.service.ts, migracoes-usina.service.ts, UI labels).

**Contexto:** sistema tinha convenção polissêmica simultânea:
- `usinas.service.ts:418-451` (`distribuicaoCreditos` + `gerarListaConcessionaria`) + 4 usinas reais (Linhares 1/2 CoopereBR, Solar Norte/Sul) seguem **MENSAL**
- `contratos.service.ts:60-63` (comentário literal "anual") + `migracoes-usina.service.ts` (`ajustarKwh` + `migrarCooperado`) + 2 usinas legado (Solar Guarapari 600k, Solar Serra 480k) tratavam como **ANUAL**
- `motor-proposta` + `cobrancas` não usam `capacidadeKwh` direto — neutros

**Decisão Luciano:** oficializar MENSAL como universal (cadastros captam mensal, faturas concessionária mensais, SCEE mensal, operação cooperativa mensal).

**Escopo Sprint D-novo-H (~6-8h Code, decisão produto pré-aprovada economiza 2-3h):**
1. **Auditoria (1h):** SQL detectando `capacidadeKwh ≈ producaoMensalKwh × 12` (suspeitas ANUAL); dry-run UPDATE
2. **Migração dados (1h):** `UPDATE usinas SET capacidadeKwh = capacidadeKwh / 12` nas usinas detectadas (Solar Guarapari 600k → 50k; Solar Serra 480k → 40k); validar pós-migração
3. **Refator backend (3-4h):**
   - `contratos.service.ts:60-63`: comentário "anual" → "mensal"; renomear `capacidadeAnual` → `capacidadeMensal` (linhas 87, 532)
   - `migracoes-usina.service.ts:ajustarKwh`: `kwhContratoAnual = (percentualNovo/100) × cap × 12`
   - `migracoes-usina.service.ts:migrarCooperado`: mesmo fix
   - `usinas-analitico.service.ts:97-128`: clarificar comentários/labels
4. **UI labels (0.5h):** `web/app/dashboard/usinas/{nova,[id]}/page.tsx` — "Capacidade (kWh/mês)" + "Produção Mensal (kWh/mês)" explícito
5. **Smoke E2E (1h):** cadastrar nova usina, ajustar % cooperado, verificar `kwh` bate com 22% × cap mensal
6. **Docs + commits (0.5h):** atualizar CLAUDE.md regra "MENSAL é convenção oficial" + CONTROLE-EXECUCAO

**Bloqueio:** nada operacional — sistema funciona com workaround mental do admin (ajustarKwh entrega 1/12 do esperado).

**Conexões:** Sprint Usinas+Listas Sub-Fase 1 (próximo após mini-sprint) pode aproveitar oportunisticamente pra UI labels se barato.

**Status:** 📋 Catalogado em 2026-05-17 noite, aguarda agenda Code (P1 mas sem urgência operacional).

**Não confundir com:**
- Sprint Contabilidade Tributária Segregada (#8) — segregação cooperativa
- Sprint 7 (DRE+Conciliação+Fechamento Mensal genérico) — base operacional financeira

**Ver também:** `docs/especificacao-contabilidade-cooperativa-segregada.md`, memória `decisao_modulo_contabilidade_tributaria_17_05.md`.

---

### D-novo-J — 8 testes `guard-ativacao.spec.ts` falham pós-fix IDOR Fase 2I (P2)

**Severidade:** P2 (testes — não bloqueia produção; mascara regressão futura)
**Detectado em:** 2026-05-18 (Ronda QA `cooperebr-qa-funcional` — relatório `docs/relatorios/qa-2026-05-18.md` commit `c10f153`)

**Contexto:** Fase 2I do Hardening (14/05) trocou `findUnique` por `findFirst` em `cooperados.service.ts:867` (`canAtivar`) para conseguir aplicar filtro `cooperativaId` no mesmo where (IDOR fix). Spec `cooperados.service.guard-ativacao.spec.ts:43-44` mock continua só com `findUnique`.

**Sintoma:** `npm test` reporta `TypeError: findFirst is not a function` em 8/8 cenários da suite.

**Fix sugerido (~15min, ~10 linhas):**
```ts
// cooperados.service.guard-ativacao.spec.ts mock
cooperado: {
  findUnique: jest.fn(),
  findFirst: jest.fn(),   // ← adicionar
  update: jest.fn(),
}
```
+ ajustar `mockResolvedValue` nos 8 casos do `findFirst`.

**Conexão:** Bloco B Etapa 1 Fase 2 (escrita de 13 specs Jest cooper-token, pausada em 17/05) reabrirá essa área de specs — **fix consolidado lá** evita 2 commits no mesmo arquivo.

**Status:** 📋 Catalogado em 2026-05-18, aguarda retomada Bloco B Etapa 1 Fase 2.

---

### D-novo-K — 2 controller specs sem providers ausentes (P2)

**Severidade:** P2 (testes — não bloqueia produção; mascara regressão futura)
**Detectado em:** 2026-05-18 (Ronda QA `cooperebr-qa-funcional`)

**Sintoma:** `npm test` reporta `Nest can't resolve dependencies of the X (...)` em:
- `usinas.controller.spec.ts:12` — falta `UsinasAnaliticoService` no `TestingModule.providers`
- `cooperados.controller.spec.ts:14` — falta `UsinasService` no `TestingModule.providers`

**Causa:** services foram adicionados como dependência do controller (commits da maratona 17/05 ou anteriores) sem atualizar os specs.

**Fix sugerido (~15min, ~10 linhas cada):**
```ts
const moduleRef = await Test.createTestingModule({
  controllers: [XController],
  providers: [
    XService,
    { provide: UsinasAnaliticoService, useValue: { /* mock mínimo */ } },
    { provide: UsinasService, useValue: { /* mock mínimo */ } },
  ],
}).compile();
```

**Status:** 📋 Catalogado em 2026-05-18 — independente, pode fixar a qualquer momento (não amarrado a sprint).

---

### D-novo-L — Divergência doc-sessão Bloco D: "9 chaves" vs banco 7×2=14 (P3)

**Severidade:** P3 (documentação imprecisa, sem impacto funcional)
**Detectado em:** 2026-05-18 (Ronda QA `cooperebr-qa-funcional`); já apontado no QA piloto 17/05 (achado #2)

**Sintoma:** Doc `docs/sessoes/2026-05-17-bloco-d-3-crons-proativos.md` afirma "9 ConfigTenant chaves seedadas". Banco tem 7 chaves distintas × 2 cooperativas (CoopereBR + CoopereBR Teste) = 14 entries.

**Causa provável:** redação imprecisa — contagem original confundiu chaves semânticas (categorias) com chaves técnicas distintas.

**Fix:** atualizar doc-sessão 17/05 (linha que cita "9 chaves") para "7 chaves cron/lembrete × 2 cooperativas = 14 entries efetivas".

**Status:** 📋 Catalogado em 2026-05-18 — minor doc-only, fazer junto com próxima atualização da doc-sessão Bloco D ou no fechamento da Fase 4 Sub-Fase 1.

---

### D-novo-N — Falha sistêmica regra contatos teste (P0 RESOLVIDO 18/05/2026)

**Severidade:** P0 (segurança/LGPD — sistema disparava comunicação real pra contatos do banco em dev)
**Status:** ✅ **RESOLVIDO** em 18/05/2026 noite (commits do dia)
**Detectado em:** 2026-05-18 (smoke Sub-Fase 1 Fase 4 — Luciano recebeu email no `+fase4banco` em vez do `+fase4envio` override)

**Sintoma:** Durante smoke do trigger ativação cooperado homologado, sistema enviou email REAL pra `lucbragatto+fase4banco@gmail.com` (banco) em vez do override `+fase4envio`. Em PROD real com cooperado real, teria sido SPAM real pra cooperado que NÃO autorizou contato.

**Causa raiz:** `ecosystem.config.cjs:36` força `env: { NODE_ENV: 'production' }` no PM2 (intencional — Nest roda `dist/` compilado). Resultado: `NODE_ENV='production'` SEMPRE, em dev local E prod real. TODO check `process.env.NODE_ENV !== 'production'` no projeto estava estruturalmente quebrado:
- `whitelist-teste.ts:podeEnviarEmDev` retornava `true` sempre (bypassed)
- `whatsapp-sender.service.ts:80` guard nativo WA bypassed
- `email.service.ts:65` guard nativo Email bypassed (por isso email foi enviado)
- `cooperado-homologado.listener.ts:80` (Fase 4 novo) override sempre PRODUCAO_REAL

**Fix aplicado — defense in depth 3 camadas:**

1. **Camada 1** — `backend/src/common/safety/ambiente.ts` (NOVO) — `isAmbienteReal()` lê `AMBIENTE_REAL === 'true'` (opt-in produção, default ausente = dev). `ecosystem.config.cjs` propaga via `AMBIENTE_REAL: process.env.AMBIENTE_REAL || 'false'`. `.env.example` documenta.
2. **Camada 2** — listener respeita `cooperado.ambienteTeste` (`@default(false)` no schema). Cooperado teste SEMPRE override, mesmo em prod real.
3. **Camada 3** — `ehEmailFake`/`ehTelefoneFake` em `whitelist-teste.ts` detectam padrões fake (`.invalid`, `@removido`, `0{6,}`, `9{6,}`, `9{4,}\d{0,4}0{4,}$`, prefixos `551199988/551199900/551172620/551175410/551178110`, < 10 dígitos, `INATIVO-`). Validação pré-dispatch + reescrita do `podeEnviarEmDev`.

**Smoke re-executado 18/05 noite:** ✅ confirmado Luciano — email recebido em `lucbragatto+homologado@gmail.com`, WhatsApp em `27981341348`, log mostra `motivo: 'DEV_AMBIENTE'`, `contatoOriginal ≠ contatoEnvio`.

**Reforço regra:** TODO listener/service de comunicação DEVE ter as 3 camadas. NUNCA usar `NODE_ENV` pra discriminar dev/prod. Catalogado postmortem em `~/.claude/projects/.../memory/falha_regra_contatos_teste_18_05.md` + atualização `regra_contato_teste_impreterivel.md`.

---

### D-novo-M — IMAP self-signed certificate ERROR diário 06:00 (P3 pré-existente)

**Severidade:** P3 (ERROR no log diário — pipeline IMAP cai 1×/dia, retoma na próxima tentativa)
**Detectado em:** 2026-05-18 (Ronda QA `cooperebr-qa-funcional`); pré-existente desde data não-determinada

**Sintoma:** `pm2 logs cooperebr-backend` mostra ERROR `self-signed certificate` em `email-monitor.service.ts:90` (cron das 06:00).

**Causa provável:** servidor IMAP configurado em `.env` (`EMAIL_MONITOR_HOST` etc.) usa certificado auto-assinado; ImapFlow rejeita por default.

**Fix sugerido (~1 linha):**
```ts
// email-monitor.service.ts ImapFlow config
new ImapFlow({
  ...
  tls: { rejectUnauthorized: false },  // ← se certificado autoassinado é esperado
})
```

**Decisão pendente Luciano:**
- (a) Aceitar autoassinado (`rejectUnauthorized: false`) — fix 1 linha, risco baixo (servidor IMAP é interno controlado)
- (b) Trocar pra certificado válido (Let's Encrypt) no servidor IMAP — fix infra, mais robusto mas exige toque no provedor de email

**Status:** 📋 Catalogado em 2026-05-18 — Luciano decide (a) ou (b) em sessão futura. Não bloqueia operação (cron retoma).

---

### D-WA-01 — Revisão de tom dos templates WA + variantes _padrao e _neutro por categoria de parceiro (P3)

**Severidade:** P3 (ajuste cosmético/branding por tipo de parceiro)
**Detectado em:** 2026-05-19 (Cowork — refator WhatsApp Fases 1-6)

**Sintoma:** templates atuais do bot Assis usam emojis pesados ("🌞", "💰", "✅", "🎉") adequados pra cooperativas de energia solar (CoopereBR), mas podem soar fora de tom em associações profissionais (AESMP — Ministério Público / ASSEJUFES — Justiça Federal) que têm cultura institucional mais sóbria.

**Fix sugerido:**
- Criar variantes `_padrao` (com emojis, default pra cooperativas de energia) e `_neutro` (sem emojis, default pra associações profissionais) de cada template
- Adicionar campo `Cooperativa.tomComunicacao` (enum `PADRAO` / `NEUTRO`) ou inferir via `tipoParceiro` + categoria de negócio
- Renderizar variante correta em runtime via `extrairVariaveis` (mesmo motor da Fase 2)
- Convenção `cooperativaId=null` mantém ambos os pares globais

**Estimativa:** 4-6h Code (duplicar 17 templates do seed + 1 campo schema + lógica de seleção runtime)

**Status:** 📋 Catalogado em 2026-05-19 — não bloqueia onboarding CoopereBR (já usa _padrao). Resolver antes de onboarding 1ª associação profissional.

---

### D-WA-02 — Campo `site` no schema Cooperativa para `{{site}}` em templates WA (P2)

**Severidade:** P2 (variável de template renderiza vazio silenciosamente)
**Detectado em:** 2026-05-19 (Cowork — refator WhatsApp Fase 2)

**Sintoma:** templates WhatsApp já usam variável `{{site}}` (esperando URL do parceiro), mas campo `site` **não existe no schema `Cooperativa`** atual. Em runtime, `extrairVariaveis` retorna string vazia → texto renderizado fica com lacuna visível ("Acesse  para mais info" em vez de "Acesse https://cooperebr.com.br para mais info").

**Fix sugerido:**
- Migration aditiva pura: `ALTER TABLE cooperativas ADD COLUMN site TEXT;`
- Atualizar `carregarContextoCooperativa()` em `whatsapp-fluxo-motor.service.ts` pra incluir `site` no select
- Popular manualmente CoopereBR + CoopereBR Teste com URLs reais
- UI de edição de cooperativa ganha campo `site` (validação URL simples)

**Estimativa:** 1-2h Code (migration + select + UI + seed)

**Status:** 📋 Catalogado em 2026-05-19 — sem risco (aditiva). Resolver junto com próximo touchpoint em `Cooperativa` ou em sprint dedicado.

---

### D-WA-03 — `seed-mensagens.ts` redundante com `seed-fluxo-padrao.ts` (P2)

**Severidade:** P2 (risco operacional — quem roda por último ganha)
**Detectado em:** 2026-05-19 (Cowork — refator WhatsApp Fase 6)

**Sintoma:** `backend/prisma/seed-mensagens.ts` (antigo) e `backend/prisma/seed-fluxo-padrao.ts` (refatorado Fase 6) tocam os **mesmos IDs de `ModeloMensagem`** com **conteúdos divergentes**:
- `seed-mensagens.ts`: hardcoded "CoopereBR" antigo (pré-Fase 6, sem variáveis multi-tenant)
- `seed-fluxo-padrao.ts`: templates parametrizados com `{{parceiro}}`/`{{tipo_parceiro}}`/etc

Se alguém rodar `seed-mensagens.ts` depois do refator, **sobrescreve o trabalho da Fase 6** e quebra multi-tenant silenciosamente. Conversa de tenant A passa a renderizar hardcode CoopereBR.

**Fix sugerido:**
- (a) **Deletar `seed-mensagens.ts`** (preferido — código deprecado)
- (b) Renomear pra `seed-mensagens.deprecated.ts` + adicionar header com aviso big-red e `throw new Error('Use seed-fluxo-padrao.ts')` ao topo

**Estimativa:** 15min Code

**Status:** 📋 Catalogado em 2026-05-19 — não bloqueia produção (script só roda manualmente), mas é armadilha aguardando alguém pisar. Resolver no Sprint Housekeeping ou junto com próxima sessão WA.

---

### D-WA-04 — Bug do harness Cowork: Edit/Write trunca arquivos acima de ~10KB (P3)

**Severidade:** P3 (afeta produtividade Cowork, não impacta produção CoopereBR)
**Detectado em:** 2026-05-19 (Cowork — refator WhatsApp Fases 1-6)

**Sintoma:** durante a sessão maratona do Cowork, ferramentas `Edit`/`Write` do harness Cowork (Anthropic) truncaram silenciosamente arquivos acima de ~10KB. Exigiu **4 regravações via `cat` heredoc** durante a sessão pra contornar.

**Fix sugerido:**
- Reportar ao time Anthropic (não é nosso bug)
- Workaround Cowork: usar `cat > arquivo.ts <<'EOF' ... EOF` pra arquivos grandes em vez de `Write`/`Edit`

**Estimativa:** N/A (fora do nosso escopo — bug do harness)

**Status:** 📋 Catalogado em 2026-05-19 — apenas registro. Não impacta produção CoopereBR. Não impacta Claude Code (harness diferente — `Write` foi usado nesta sessão pra arquivos de até 26KB sem problema, ex: `docs/workflows/QA-FUNCIONAL-FASEADO.md` com 694 linhas / 25KB).

---

### D-novo-P — Handoff Assis → wizard `/cadastro` (Fase 9 do roteiro WhatsApp, P2)

**Severidade:** P2 (operacionalmente lead conversa com Assis e nunca vira Cooperado — funil quebrado)
**Detectado em:** 2026-05-19 (Cowork — análise completa Fase 9 do roteiro WA)

**Sintoma:** quando lead confirma interesse no Assis (bot WhatsApp), **nenhum handoff acontece pro wizard `/cadastro`**. 5 gaps mapeados pelo Cowork:

1. **Lead nunca vira Cooperado.** Conversa WhatsApp permanece como `LeadWhatsapp` / `ConversaWhatsapp` solto; admin precisa recadastrar manualmente.
2. **Dados OCR perdidos no caminho.** Lead sobe foto da fatura no Assis → OCR Claude extrai → mas dados ficam só na conversa, não chegam no wizard.
3. **Cálculo de 20% economia hardcoded** no Assis vs motor real (`motor-proposta.service.ts`). Lead recebe simulação que difere da proposta final → fricção/desconfiança.
4. **Documentos não pedidos pelo Assis.** Lead chega no wizard sem CNH/comprovante/etc. — wizard pede do zero, lead desiste.
5. **Assinatura eletrônica sem ponte WA.** Termo de Adesão + Procuração assinados no wizard, mas lead não recebe link de volta no WhatsApp pra acompanhar status.

**Fix sugerido (Cowork — "tudo já existe, é costura"):**
- 1 endpoint novo `POST /whatsapp/handoff-wizard` em `whatsapp-fluxo-motor` que recebe `conversaId` + `cooperativaId`, gera token JWT temporário + payload `dadosPreCadastro` (incluindo OCR extraído) e retorna URL pro wizard
- 1 campo/tabela nova pra carregar OCR cross-channel (provavelmente `DadosPreCadastro` model novo OU campo JSON em `LeadWhatsapp`/`ConversaWhatsapp`)
- 1 leitura no wizard `/cadastro` que aceita `?handoff=<token>` e popula campos via `dadosPreCadastro`
- 1 step opcional "email concessionária" pro Assis pedir antes do handoff (resolve gap 4 parcialmente)

**Estimativa:** 2-3 dias Code (engloba 4 módulos: whatsapp, motor-proposta, cooperados/service, web/app/cadastro)

**Status:** 📋 Catalogado em 2026-05-19 — desenho visual do fluxo entregue pelo Cowork na sessão. Encaixa em sprint dedicado WA Fase 9 após Sprint 5a Neutro Fio B + Sprint Conformidade.

---

### D-novo-R — `buscarEtapa()` priorizava etapa global sobre tenant em runtime (P1 produção — RESOLVIDO 2026-05-19 noite)

> **⚠️ Nota de catalogação (19/05 noite):** este débito foi inicialmente registrado como D-novo-Q no commit `a0e0f06` por falha de validação prévia (Decisão 14). O código D-novo-Q estava reservado desde 19/05 tarde pra "Contatos Teste persistentes" (memória `debito_d_novo_q_contatos_teste_persistentes_19_05.md`). Renomeado pra D-novo-R em 19/05 noite — a entrada D-novo-Q (contatos teste) está preservada logo abaixo. Commit `a0e0f06` permanece com referência antiga; trate como D-novo-R.

**Severidade:** P1 PRODUÇÃO (bug silencioso afetou TODO o motor dinâmico desde a implementação)
**Detectado em:** 2026-05-19 noite (investigação simulador celular — Luciano reportou que "Entrada Dinâmica" do CoopereBR nunca respondia)

**Sintoma:** quando havia uma etapa do tenant E uma etapa global ativas para o mesmo `estado`, o motor escolhia a global se ela tivesse `ordem` menor. Em produção:
- "Receber fatura" (global, `cooperativaId=null`, ordem baixa, **0 gatilhos**, ativa)
- "Entrada Dinâmica" (CoopereBR, `cooperativaId=cmn0ho8bx...`, ordem 28, **3 gatilhos**, ativa)

A query `findFirst { OR: [{ cooperativaId: tenant }, { cooperativaId: null }] } orderBy: { ordem: asc }` pegava a global (ordem menor) → 0 gatilhos → fallback hardcoded sempre. **Cooperado nunca usou nenhuma personalização criada pela UI do parceiro desde a implementação do motor dinâmico.**

**Impacto em produção:** todo cooperado do CoopereBR que mandou mensagem ao Assis depois que "Entrada Dinâmica" foi criada via UI caiu no fluxo hardcoded — nunca experimentou a customização do tenant. Bug silencioso (sem erro), só visível observando que personalizações não funcionavam.

**Causa raiz:** `buscarEtapa()` em `backend/src/whatsapp/whatsapp-fluxo-motor.service.ts` usava `OR + orderBy ordem asc` — assumia que `ordem` numérica seria suficiente pra resolver prioridade. Não era: ordem é controlada pela UI por usuário e não tem garantia de tenant < global.

**Fix aplicado:** refator pra 2 queries explícitas:
1. Primeiro busca tenant exato (`cooperativaId: tenant`). Se achar, retorna.
2. Fallback: busca global (`cooperativaId: null`).

Tenant SEMPRE vence se existir, independente de ordem. Comportamento explícito na semântica.

**Cobertura:**
- 1 spec novo de regressão: `REGRESSION D-novo-Q: tenant com ordem alta vence global com ordem baixa`
- 1 spec novo: `Quando tenant NAO tem etapa para o estado, fallback global ativa`
- 2 specs antigos refeitos pra refletir nova semântica (2 queries)
- Total: 30/30 specs verdes em `whatsapp-fluxo-motor.service.spec.ts`

**Estimativa real:** 45min Code (investigação + fix + 4 specs + commit)

**Status:** ✅ RESOLVIDO em 2026-05-19 noite. Commit cobrindo fix do motor + ajustes de specs + catalogação aqui.

**Lição:** quando duas linhas de defesa (tenant + global) precisam de prioridade explícita, NÃO confiar em ordem numérica controlada por usuário. Usar queries separadas com semântica clara.

---

### D-novo-Q — Contatos Teste persistentes em banco + tela SUPER_ADMIN (P2 — aprovado, aguarda janela)

**Severidade:** P2 (operacional — hoje funciona pra Luciano via hardcoded, mas não escala pra Sinergia / Luciano + orquestrador contador / QA externo)
**Detectado em:** 2026-05-19 tarde (Luciano aprovou escopo completo)
**Memória detalhada:** `~/.claude/projects/C--Users-Luciano-cooperebr/memory/debito_d_novo_q_contatos_teste_persistentes_19_05.md`

**Problema atual:**
Hardcoded em `backend/src/common/safety/whitelist-teste.ts` desde fix D-novo-N (18/05): telefone `27981341348` + email `lucbragatto+homologado@gmail.com`. Funciona pra Luciano, mas:
- Não escala (Sinergia futura, Luciano + orquestrador contador, QA externo)
- Mudança de número exige rebuild + deploy
- Não auditável (quem usou contato teste quando?)
- Não permite múltiplos canais de QA simultâneos

**Decisões aprovadas Luciano 19/05 tarde:**
1. **Escopo:** Global SISGD (apenas SUPER_ADMIN edita)
2. **Quantidade:** Lista com flag `ativo` (permite 5-10+ contatos)
3. **Canais fase 1:** WhatsApp + Email (SMS/Push/Asaas fase 2)
4. **Modo:** Override fixo (primeiro contato teste ativo da lista vence)
5. **3 camadas defense in depth preservadas:** apenas troca fonte (hardcoded → banco). Hardcoded vira fallback last-resort.
6. **Seed inicial:** popula os 2 valores atuais do Luciano

**Escopo técnico:**
- Schema novo `ContatoTeste { id, canal: WHATSAPP|EMAIL, valor, nome, ativo, observacao, criadoPor, criadoEm, atualizadoEm }` (memória tem prisma completo)
- Módulo `backend/src/contatos-teste/` (service + controller + DTO + spec, todos gated SUPER_ADMIN)
- 4 endpoints `/super-admin/contatos-teste` (GET/POST/PATCH/DELETE soft)
- Refator `whitelist-teste.ts` consulta `ContatosTesteService.obterPrimeiroAtivo(canal)` em vez de retornar hardcoded
- Frontend `web/app/dashboard/super-admin/contatos-teste/page.tsx` (tabela 2 abas WA/Email com toggle ativo inline padrão Tipo A + dialog criar/editar Tipo C)
- Seed inicial popula Luciano

**Estimativa:** 6-8h Code distribuídas (memória tem breakdown por bloco)

**Posicionamento:** NÃO é prioridade imediata. Slots possíveis:
- (a) Entre Sprint 5a Fio B (M15) e Sprint #8 Contabilidade — sprint próprio ~1 dia
- (b) **Recomendado:** dentro do Sprint Housekeeping (bundle com stash reformat + scripts órfãos + `.gitattributes` CRLF)
- (c) Antes do onboarding 2º parceiro (Sinergia) — momento natural

**Status:** 📋 Catalogado em 2026-05-19. Aprovado, escopo completo na memória, prompt Code pronto. Aguarda Luciano definir janela.

---

### D-novo-S — Sprint Bot Autoatendimento WhatsApp (P2 estratégico — aprovado 20/05, aguarda janela pós-M15)

**Severidade:** P2 estratégico (não bloqueia produção real — fallback hardcoded ainda cobre, mas Menu do Cooperado tem 5 buracos de 7 opções que corroem confiança)
**Detectado em:** 2026-05-20 — relatório completo do bot revelou que metade autoatendimento está oca
**Memória detalhada:** `~/.claude/projects/C--Users-Luciano-cooperebr/memory/sprint_bot_autoatendimento_20_05.md` (escopo dos 8 blocos + 11 mensagens redigidas)
**Catalogado em PLANO:** `docs/PLANO-ATE-PRODUCAO.md` Seção 3b — "Sprint Bot Autoatendimento WhatsApp — APROVADO 20/05/2026"

**Problema atual:**
O Menu do Cooperado lista 7 opções (1 Ver créditos / 2 Ver fatura / 3 Enviar fatura / 4 Atualizar contrato / 5 Indicar amigo / 6 Suporte / 7 Atendente). **Só funcionam 2 (3 e 7).** Outras 5 prometem no texto e devolvem o menu via gatilho-loop ou caem em estados sem etapa. Adicionalmente:
- Cadastro por Proxy (4 etapas inativas sem modelo)
- Atualizar Cadastro (4 estados-destino inexistentes)
- NPS sem gatilhos 0-10
- MENU_FATURA / MENU_INADIMPLENTE sem modelo
- Variável `{{site}}` vazia
- 2 etapas duplicadas no INICIAL

**Escopo aprovado (8 blocos, ~37-55h Code):**
- Bloco 0 (~2h) — Quick wins (gatilho 5 cabeado, `{{site}}`, desativar 1 etapa duplicada)
- Bloco 1 (~7-10h) — Navegação Universal FUNDACIONAL (INÍCIO/SAIR/MENU/ME CHAME DEPOIS no motor antes de `avaliarGatilhos`)
- Bloco 2 (~1-1.5h) — Inserir 11 modelos novos + alinhar seed
- Bloco 3 (~6-9h) — Ver saldo de créditos + Ver próxima fatura (ações reais)
- Bloco 4 (~6-8h) — Atualizar Cadastro (4 etapas novas + ações persistentes + validação)
- Bloco 5 (~4-6h) — Atualizar Contrato (decisão produto: ação automática vs solicitação + humano)
- Bloco 6 (~6-8h) — Cadastro por Proxy (portar lógica do hardcoded)
- Bloco 7 (~2-3h) — NPS no fluxo (gatilhos 0-10 + etapa NPS_RECEBIDO)
- Bloco 8 (~4-6h OPCIONAL) — Menu Fatura / Menu Inadimplente (decisão produto)

**Decisão de arquitetura central:**
Motor `executarAcao()` hoje tem placeholders + `ENVIAR_LINK_INDICACAO` (R5, 20/05). Sprint expande pra ações de CONSULTA + ESCRITA reais. O campo `Gatilho.acao` existe no dado mas o motor IGNORA — decisão: NÃO passar a processar `Gatilho.acao`; cada opção vira transição pra estado com `acaoAutomatica` (padrão atual do motor).

**Decisões de produto pendentes:**
1. Bloco 5 Atualizar Contrato: ação automática OU solicitação + humano?
2. Bloco 8 Menu Fatura / Menu Inadimplente: dinâmico OU mantém hardcoded?
3. Bloco 7 NPS: existe tabela de registro pra conectar?

**Posicionamento:** 🔁 **REPRIORIZADO 2026-05-21 — VEM ANTES DO M15 Fio B.** Originalmente "depois do M15"; Luciano repriorizou em 21/05. Justificativa: bot oco em produção corrói confiança hoje; Fio B regulatório tem cobertura de fallback hardcoded por curto prazo. Sprint começa pelo Bloco 1.a (Navegação Universal fundacional). Pode ser fatiado (Bloco 0+1 quick — ~10h / Blocos 2-7 médio — ~25-35h / Bloco 8 opcional).

**Status:** 📋 Catalogado em 2026-05-21. Aprovado por Luciano 20/05, repriorizado 21/05, escopo completo na memória, 11 mensagens redigidas. Em curso — Bloco 1.a Navegação Universal sendo implementado nesta sessão (21/05).

---

### D-novo-T — Iniciativa Fluxos Customizáveis do Bot WhatsApp (P3 estratégico — visão longo prazo, 100-200h+ em 3 fases)

**Severidade:** P3 estratégico (não bloqueia nada hoje; impacto futuro se ficar postergado indefinidamente e Sinergia/futuros parceiros pedirem personalização)
**Detectado em:** 2026-05-20 — sessão claude.ai pós-fechamento M16 (Luciano mapeou visão após o relatório do bot)
**Memória detalhada:** `~/.claude/projects/C--Users-Luciano-cooperebr/memory/iniciativa_fluxos_customizaveis_20_05.md`
**Catalogado em PLANO:** `docs/PLANO-ATE-PRODUCAO.md` Seção 3b — "Iniciativa Fluxos Customizáveis do Bot WhatsApp — VISÃO 20/05/2026 (LONGO PRAZO)"

**Visão:**
Bot WhatsApp hoje tem 1 fluxo fixo (conjunto único de `FluxoEtapa` por tenant). Transformar em **plataforma de fluxos configuráveis** — admin/superadmin monta jornadas sob demanda. Exemplos: fluxo de Ocorrências, fluxo replicando Wizard de cadastro, fluxo do Portal do Proprietário (desempenho usina, saldo, fluxo de caixa) no WhatsApp.

**3 padrões de fluxo:**
- **COLETA** (bot pergunta → cria registro): Ocorrências, Wizard cadastro
- **CONSULTA** (usuário pergunta → bot responde): Saldo, desempenho usina, fluxo de caixa
- **NOTIFICAÇÃO PROATIVA** (bot avisa sozinho): notícia de queda de geração — NÃO é fluxo conversacional, vive em `notificacoes-proativas`

**Arquitetura — 6 peças:**
1. Entidade `Fluxo` (agrupador) — `FluxoEtapa` ganha `fluxoId`
2. Roteador de entrada (palavra-chave / perfil / menu)
3. Biblioteca de Ações (paleta de blocos pré-programados pelo dev)
4. Construtor visual UI (flow builder)
5. Elegibilidade/perfil
6. Multi-tenant (fluxo do parceiro vs global)

**Insight central:** admin monta a CONVERSA; dev fornece os BLOCOS de ação. Admin é montador, não programador.

**Faseamento:**
- **Fase 1** (~1 sprint) — entidade Fluxo + roteador; fluxos criados pelo DEV via script
- **Fase 2** (contínuo) — biblioteca de ações expandida sob demanda
- **Fase 3** (grande — produto dentro do produto) — construtor visual UI, admin monta sozinho

**Estimativa total:** ~100-200h+ distribuídas. Fase 3 é a mais cara.

**Dependências:**
- D-novo-S Sprint Bot Autoatendimento — completa o fluxo único atual ANTES de virar plataforma
- Decisão de produto: priorizar fluxos novos (Ocorrências, Portal Proprietário) vs polir existente

**Posicionamento:** NÃO é sprint imediato. Começa pela Fase 1 (entidade Fluxo) depois que D-novo-S estiver fechado.

---

### D-novo-U — Handler hardcoded "Ver próxima fatura" usa status `PENDENTE` (que nunca existe) — bot mente sobre faturas (P2)

**Severidade:** P2 (UX produção — cooperado pergunta "ver fatura" e recebe "Você não tem faturas pendentes" mesmo quando tem fatura `A_VENCER`)
**Detectado em:** 2026-05-21 (Fase 1 Bloco 3 Sprint Bot Autoatendimento — auditoria do handler hardcoded vs distribuição real de status no banco)
**Arquivo afetado:** `backend/src/whatsapp/whatsapp-bot.service.ts:791-794`

**Problema:**
O handler hardcoded da opção "2 Ver próxima fatura" do MENU_COOPERADO usa:

```typescript
const cobranca = await this.prisma.cobranca.findFirst({
  where: { contrato: { cooperadoId }, status: { in: ['PENDENTE', 'VENCIDO'] as any[] } },
  orderBy: { dataVencimento: 'asc' },
});
```

Mas o enum `StatusCobranca` tem `PENDENTE | A_VENCER | PAGO | VENCIDO | CANCELADO`, e **a distribuição real no banco DEV é:** A_VENCER=7, VENCIDO=3, PAGO=35, PENDENTE=0. Cobranças do sistema vão pra `A_VENCER` (não `PENDENTE`).

**Resultado:** o handler responde "✅ Você não tem faturas pendentes no momento!" mesmo quando o cooperado tem cobrança `A_VENCER` (ou várias). Bot mente sobre faturas. Considerando que `A_VENCER` é o status canônico das cobranças que vencerão (≥ 99% do volume), o handler hardcoded está quebrado pra quase TODOS os cooperados.

**Por que latente até agora:**
1. Handler só roda quando o motor dinâmico NÃO tem etapa pra MENU_COOPERADO (estado caía no fallback hardcoded) OU quando o gatilho não bate. Com o motor dinâmico cobrindo MENU_COOPERADO em produção, o handler ficou no caminho hardcoded de fallback.
2. Bloco 3 (21/05) substituiu o caminho hardcoded da opção "2" por `CONSULTAR_PROXIMA_FATURA` no motor (que usa `['A_VENCER', 'VENCIDO']` corretamente) — então o bug hoje só dispara se a etapa dinâmica `VER_PROXIMA_FATURA` deixar de existir (fallback).

**Severidade real:** P2 (não P1) porque o caminho do Bloco 3 já corrige no motor dinâmico — o handler hardcoded só roda em fallback raro. Mas é dívida latente: se em algum momento alguém desativar a etapa dinâmica VER_PROXIMA_FATURA ou um tenant novo subir sem ela, volta a quebrar.

**Fix proposto (1-2h Code):**
Trocar em `whatsapp-bot.service.ts:792`:

```typescript
// ANTES
status: { in: ['PENDENTE', 'VENCIDO'] as any[] },
// DEPOIS
status: { in: ['A_VENCER', 'VENCIDO'] as any[] },
```

Aproveitar pra:
- Auditar outros usos de `status: 'PENDENTE'` em queries Cobranca (provavelmente latentes)
- Considerar incluir `PENDENTE` também por defesa (caso algum fluxo gere com esse status), mas confirmar que enum não está sendo aposentado
- Spec novo em `whatsapp-bot.service.spec.ts` (se existir) cobrindo handler com cobrança A_VENCER

**Posicionamento:** Sprint Housekeeping (junto com D-novo-Q e outros itens de polimento). Não bloqueia nada hoje porque caminho dinâmico do Bloco 3 já corrige.

**Status:** ✅ **RESOLVIDO em 2026-05-25** (Sprint Housekeeping M25, commit `2aeb4ed`). Fix aplicado em `whatsapp-bot.service.ts:793` — query passou pra `status: { in: ['A_VENCER', 'PENDENTE', 'VENCIDO'] }` (defense in depth alinhada com `cobrancas.job.ts:45/130/216`). Auditoria adicional: 3 queries em `cobrancas.job.ts` usam `PENDENTE` mas são DEFENSIVAS (aceitam ambos), não-bugs. Comentário inline preservado referenciando o débito resolvido.

---

### D-novo-V — Modelos `saldo_creditos_resultado` e `proxima_fatura_resultado` com lógica condicional NO CÓDIGO (não no template) — admin não consegue editar partes (P3 melhoria)

**Severidade:** P3 (melhoria — não bloqueia nada; produto funciona corretamente hoje, mas o admin do Banco de Mensagens não consegue editar TODAS as partes do texto pelo painel)
**Detectado em:** 2026-05-21 noite (revisão pós-implementação do Bloco 3)
**Arquivos afetados:**
- `backend/src/whatsapp/whatsapp-fluxo-motor.service.ts:executarConsultarSaldoCreditos()` (~linhas 460-540)
- `backend/src/whatsapp/whatsapp-fluxo-motor.service.ts:executarConsultarProximaFatura()` (~linhas 555-630)
- Modelos `saldo_creditos_resultado` + `proxima_fatura_resultado` no banco (categoria BOT, GLOBAL)

**Problema:**
O Bloco 3 (21/05) introduziu 2 modelos no Banco de Mensagens — `saldo_creditos_resultado` e `proxima_fatura_resultado` — mas o conteúdo deles é só ESQUELETO com placeholders:

```
saldo_creditos_resultado:
  ⚡ *Seu plano e créditos:*
  📋 Plano contratado: {{kwhContratoMensal}} kWh/mês
  {{linha_saldo}}{{linha_validade}}{{linha_ultima_fatura}}
  _Pra atualizar seu saldo, envie sua fatura mais recente..._

proxima_fatura_resultado:
  📄 *Sua próxima fatura:*
  {{bloco_fatura}}{{link_pagamento}}
```

Os trechos que importam (texto das linhas condicionais, formato do bloco de fatura, frase do link de pagamento, mensagem quando não tem cobrança, CTA quando não tem fatura processada) estão **HARDCODED nos métodos do motor** (`executarConsultarSaldoCreditos` / `executarConsultarProximaFatura`):

- `'💡 Saldo na distribuidora: ${saldo} kWh\n'`
- `'📅 Validade dos créditos: ${data}\n'`
- `'📊 Última fatura registrada: ${mesRef}'`
- `'📊 Nenhuma fatura registrada ainda — envie a sua pelo bot pra calcular seu saldo.'`
- `'💰 Valor: R$ ${valor}\n📅 Vencimento: ${data}\n📊 Status: ${label}'`
- `'\n🔗 Pague aqui: ${link}'`
- `'✅ Voce nao tem faturas em aberto no momento!'`

**Consequência:** o admin do Banco de Mensagens não consegue editar essas frases pelo painel. Pra mudar "💡 Saldo na distribuidora" pra "🔋 Créditos disponíveis", precisa de release de código. Sob a regra de produto **"admin monta a CONVERSA; dev fornece os BLOCOS de ação"** (memória `iniciativa_fluxos_customizaveis_20_05.md`), isso fere o princípio — admin atualmente não tem controle total.

**Por que aceito agora:**
- Implementar engine de template com lógica condicional (`{{#if saldoKwhAtual}}...{{/if}}`) é refator não-trivial (~8-12h)
- Bloco 3 priorizou cabeamento funcional (cooperado vê saldo / fatura) sobre flexibilidade admin
- Padrão usado é mesmo do `executarEnviarLinkIndicacao` (texto inline na ação)

**Solução futura proposta (~8-12h Code):**
Implementar mini-engine de template com:
- `{{#if var}}...{{/if}}` (linha some quando var é falsy/empty)
- `{{#unless var}}...{{/unless}}` (linha some quando var é truthy)
- `{{#case status}}A_VENCER => "A vencer", VENCIDO => "Vencida"{{/case}}` (substitui o `formatarStatusCobranca` hardcoded)

Modelo `saldo_creditos_resultado` viraria:

```
⚡ *Seu plano e créditos:*

📋 Plano contratado: {{kwhContratoMensal}} kWh/mês
{{#if saldoKwhAtual}}💡 Saldo na distribuidora: {{saldoKwhAtual}} kWh{{/if}}
{{#if validadeCreditos}}📅 Validade dos créditos: {{validadeCreditos}}{{/if}}
{{#if mesUltimaFatura}}📊 Última fatura registrada: {{mesUltimaFatura}}{{/if}}
{{#unless mesUltimaFatura}}📊 Nenhuma fatura registrada ainda — envie a sua pelo bot pra calcular seu saldo.{{/unless}}

_Pra atualizar seu saldo, envie sua fatura mais recente (opção 3 do menu)._
```

Aí o admin edita tudo no Banco de Mensagens. Substituiria também o `extrairVariaveis()` por algo mais flexível pra ações injetarem suas vars sem hardcode.

**Vínculo estratégico:** este débito é parte da **Iniciativa Fluxos Customizáveis (D-novo-T)** — sub-componente "Biblioteca de Ações + Template Engine flexível". Não precisa virar sprint próprio; pode ser fatia da Fase 1 da iniciativa quando começar.

**Posicionamento:** NÃO é prioridade. Slots possíveis:
- (a) Junto com Iniciativa Fluxos Customizáveis Fase 1 (D-novo-T) — natural
- (b) Sprint Housekeeping se virar bloqueio operacional (admin pedir muita mudança nesses 2 modelos antes de Sinergia)

**Status:** 📋 Catalogado em 2026-05-21 noite. Aceito como dívida consciente durante o Bloco 3. Decisão 14 aplicada: D-novo-V escolhido após grep amplo (D-novo-U foi o último usado nesta sessão; D-novo-V até Z livres).

---

### D-novo-W — Divergência de comportamento NPS: hardcoded transiciona pra CONCLUIDO, motor dinâmico pra MENU_COOPERADO (P3 polimento)

**Origem:** Bloco 7 do Sprint Bot Autoatendimento, Fase 2 (23/05/2026).

**Contexto:** Antes do Bloco 7, o NPS era atendido APENAS pelo handler hardcoded `handleNpsNota` em `whatsapp-bot.service.ts:4013-4034`, que ao registrar a nota chama `finalizarConversa(conversa.id)` → transiciona estado pra `CONCLUIDO`. Bloco 7 ligou o motor dinâmico via gatilho wildcard + ação `REGISTRAR_NPS` que, ao final, transiciona pra `MENU_COOPERADO` (decisão Luciano 23/05 #4 X — consistente com Blocos 4 e 1.b). Hardcoded preservado como fallback.

**Resultado prático:**
- Cooperado que cair em `NPS_AGUARDANDO_NOTA` pelo caminho dinâmico (gatilho `AVALIAR` no MENU_COOPERADO ou cron futuro) → após responder nota, volta pro MENU_COOPERADO (continua disponível pra interagir).
- Cooperado que cair em `NPS_AGUARDANDO_NOTA` por algum gatilho legado/dead code que ainda escape ao motor → cai no hardcoded → vai pro CONCLUIDO (encerra sessão).

**Impacto:** baixo hoje. O motor dinâmico já cobre o caminho oficial (gatilho `AVALIAR` cabeado em MENU_COOPERADO). O hardcoded fica como fallback raro. Mas é divergência semântica — duas pessoas mesmo NPS em momentos diferentes podem ter UX diferente.

**Fix proposto (Sprint Housekeeping):**
- Trocar `finalizarConversa` por `prisma.conversaWhatsapp.update({estado: 'MENU_COOPERADO'})` no `handleNpsNota` hardcoded. Cooperado fica disponível pra continuar conversa. Consistente com decisão 23/05.

**Custo estimado:** 5 min (1 linha) + smoke.

**Posicionamento:** Sprint Housekeeping (com demais débitos P3 acumulados). Não bloqueia nada hoje.

**Status:** ✅ **RESOLVIDO em 2026-05-25** (Sprint Housekeeping M25, commit `2aeb4ed`). Fix aplicado em `whatsapp-bot.service.ts:4037` — `handleNpsNota` agora transiciona pra `MENU_COOPERADO` via `prisma.conversaWhatsapp.update` em vez de `finalizarConversa` (CONCLUIDO). Hardcoded alinhado com motor dinâmico Bloco 7 (M21). Comentário inline preservado referenciando o débito resolvido.

---

### D-novo-X — `agendarNps()` em whatsapp-bot.service.ts é dead code (P3 limpeza)

**Origem:** Fase 1 Bloco 7 do Sprint Bot Autoatendimento (22/05/2026), confirmado na Fase 2 (23/05/2026).

**Contexto:** `whatsapp-bot.service.ts:3990-4011` define `private agendarNps(telefone, conversaId)` — `setTimeout` de 1 hora que muda estado pra `NPS_AGUARDANDO_NOTA` e envia pergunta hardcoded. **Grep amplo do backend confirmou ZERO callers.** Função existe mas nunca foi invocada.

**Problemas adicionais (além de ser dead code):**
1. Texto da pergunta hardcoded `"CoopereBR"` (não usa `{{parceiro}}`) — NÃO multi-tenant.
2. `setTimeout` no processo Node é FRÁGIL: se backend reiniciar dentro da hora, o NPS agendado é perdido. PM2 restart sumi com o timer.
3. Acopla "adesão recebida" (texto da pergunta sugere fluxo de cadastro) com NPS genérico.

**Fix proposto (Sprint Housekeeping):**
- Remover a função `agendarNps` inteira. Quando Luciano decidir disparo automático do NPS (Bloco 7 escolheu opção (a)+(e) — só infra + comando manual), o caminho será listener event-based ou cron persistente (decisões (c)/(d) da Fase 1), NÃO reativar `agendarNps`.

**Custo estimado:** 5 min (delete + ajustar imports se houver).

**Posicionamento:** Sprint Housekeeping.

**Status:** ✅ **RESOLVIDO em 2026-05-25** (Sprint Housekeeping M25, commit `6945813`). Método `agendarNps` (22 linhas) removido de `whatsapp-bot.service.ts:3994-4015`. Zero callers confirmados via grep amplo. Comentário inline (~7 linhas) preservado referenciando o débito resolvido + redirecionando pra Sprint NPS Trimestral futuro (event-based ou cron persistente, NÃO reativar setTimeout).

---

### D-novo-Y — Modelo `nps_trimestral` reservado pra Sprint NPS Trimestral futuro (RECATEGORIZADO)

**Origem:** Fase 1 Bloco 7 do Sprint Bot Autoatendimento (22/05/2026). **Recategorizado em 26/05/2026 (Sprint Housekeeping M25).**

**Contexto:** `backend/prisma/seed-fluxo-padrao.ts:138-144` define modelo de mensagem `nps_trimestral` (pergunta NPS após 3 meses de adesão):

```javascript
{
  id: 'msg-nps-trimestral',
  nome: 'nps_trimestral',
  categoria: 'BOT',
  conteudo:
    '📊 Oi {{nome}}!\n\nFaz 3 meses que você é {{tipo_membro}} da {{parceiro}}. ' +
    'De *0 a 10*, qual a chance de você nos indicar pra um amigo?\n\n' +
    'Responda apenas com o número. Sua opinião nos ajuda muito! 🙏',
}
```

Modelo seedado mas SEM caller no código. Era catalogado como "órfão a apagar OU reusar".

**Recategorização (decisão Luciano 2026-05-26):** modelo PERMANECE no seed como **reservado pra Sprint NPS Trimestral futuro**. Luciano confirmou intenção de implementar cron trimestral pós-cadastro num sprint dedicado (~2-4h estimado), reaproveitando este modelo. Sprint catalogado em memória do orquestrador (claude.ai) e usará pattern do Bloco 1.b (cron `@nestjs/schedule` + filtro de elegibilidade + reuso de WhatsappSenderService + decoração com `cooperativaId` do cooperado).

**Reframe do escopo:**
- ANTES: "órfão sem caller — limpeza pendente"
- AGORA: "modelo de mensagem ATIVO, reservado pra cron trimestral futuro"

**Não é débito de limpeza.** É reuso futuro. Mantido aqui como pointer pro Sprint NPS Trimestral quando entrar.

**Sprint dependente:** Sprint NPS Trimestral (futuro, ~2-4h Code, pós-onboarding cooperebr1).

**Status:** ✅ **RECATEGORIZADO em 2026-05-26** (Sprint Housekeeping M25). Modelo preservado no seed. Sprint NPS Trimestral catalogado pra futura execução.

---

### D-novo-Z — Divergência funcional Cadastro Proxy: hardcoded chama resetarConversa, motor transiciona pra MENU_COOPERADO; hardcoded calcula proposta com economiaMensal, motor não (P3 polimento)

**Origem:** Bloco 6 Etapa C do Sprint Bot Autoatendimento (23/05/2026).

**Contexto:** O Bloco 6 portou o fluxo Cadastro Proxy pro motor dinâmico, preservando o hardcoded `handleCadastroProxy*` como fallback. 2 divergências de comportamento aparecem entre os 2 caminhos:

**Divergência 1 — Estado final pós-confirmação:**
- Hardcoded `handleConfirmarProxy:3440` chama `await this.resetarConversa(telefone)` — provavelmente reseta estado pra `INICIAL` (ou apaga dadosTemp).
- Motor `executarCriarCooperadoProxy` transiciona pra `MENU_COOPERADO` (decisão consistente com Blocos 4/1.b/7).

**Divergência 2 — Cálculo de proposta na fatura OCR:**
- Hardcoded `handleAguardandoFaturaProxy:3320-3367` calcula proposta via `motorProposta.calcular(...)` e mostra "*{nome}* economizaria *R$ X/mês* 🌞" na confirmação.
- Motor `executarProcessarOcrProxy` simplificou: NÃO chama motorProposta, apenas valida `consumoAtualKwh > 0` e renderiza modelo `proxy_confirmar` do banco com vars `{{titular}}/{{telefone}}` (sem economia).

**Impacto:** baixo hoje — caminhos paralelos. Motor é o oficial pós-Bloco 6. Hardcoded fica como fallback raro. Cooperado pode ter UX ligeiramente diferente dependendo do caminho.

**Fix proposto (Sprint Housekeeping ou pós-validação smoke):**
- **(a) Alinhar hardcoded ao motor:** trocar `resetarConversa` por `update({estado: 'MENU_COOPERADO'})` no `handleConfirmarProxy`. Remover cálculo de proposta do `handleAguardandoFaturaProxy` (consistência) OU manter no hardcoded como degradação aceitável.
- **(b) Adicionar proposta no motor:** injetar `MotorPropostaService` no construtor + chamar `calcular(...)` em `executarProcessarOcrProxy` + estender modelo `proxy_confirmar` com `{{economiaMensal}}`. Mais trabalho, melhor UX.
- **(c) Remover hardcoded inteiro:** após smoke real validar motor end-to-end. Reduz superfície de manutenção.

**Custo estimado:** (a) 15 min / (b) 1-1.5h + modelo + spec / (c) 30 min após validação.

**Posicionamento:** Sprint Housekeeping ou sprint Iniciativa Fluxos Customizáveis (D-novo-T).

**Status:** ✅ **PARCIAL RESOLVIDO em 2026-05-25** (Sprint Housekeeping M25, commit `a6c6e5c`). **Divergência 1 (estado final pós-confirmação) RESOLVIDA** — `handleConfirmarProxy` agora transiciona pra `MENU_COOPERADO` via `prisma.conversaWhatsapp.update` em vez de `resetarConversa` (em ambos os caminhos: sucesso e recusa). Alinha hardcoded com motor dinâmico Bloco 6 (M22). **Divergência 2 (cálculo de proposta) PRESERVADA como degradação consciente** — hardcoded ainda calcula `economiaMensal`, motor não. Motor é o caminho oficial; hardcoded é fallback raro. Catalogar como sub-débito menor se virar bloqueio operacional. Comentários inline preservados referenciando o débito resolvido.

---

### D-novo-AA — Cooperado proxy nunca confirma assinatura: placeholders eternos `cpf=PROXY_${ts}` + `email=proxy_${ts}@pendente.cooperebr` (P3 limpeza)

**Origem:** Bloco 6 Etapa C do Sprint Bot Autoatendimento (23/05/2026) — débito preexistente do hardcoded `handleConfirmarProxy:3389-3390`, replicado fielmente no motor `executarCriarCooperadoProxy` (decisão de produto: preservar comportamento).

**Contexto:** Quando cooperado-indicador cadastra um amigo proxy via WhatsApp, o sistema cria `Cooperado` novo com placeholders únicos:
```typescript
cpf: `PROXY_${Date.now()}`,            // ex: PROXY_1716470000000
email: `proxy_${Date.now()}@pendente.cooperebr`,  // ex: proxy_1716470000000@pendente.cooperebr
```

Esses placeholders são únicos (timestamp evita colisão no `@unique`), permitindo criar Cooperado sem CPF/email reais. Quando o amigo recebe o link `/portal/assinar/{token}` e confirma adesão, o portal **deveria** pedir CPF/email reais e atualizar via `cooperado.update`.

**Problema:** se o amigo NUNCA confirma (link expira, ignora, etc), o Cooperado fica eterno com placeholders. Após N tentativas de cadastros proxy não confirmados, tabela enche de registros lixo. Multi-tenant em escala (Sinergia + outros) pode acumular centenas.

**Adicional:** registros placeholders aparecem em queries genéricas de Cooperado (relatórios, busca, etc) — UX ruim pro admin que vê "PROXY_1716470000000" como CPF.

**Fix proposto (Sprint Housekeeping):**
1. **Cron de cleanup** diário/semanal: deleta Cooperado com `cpf LIKE 'PROXY_%' AND createdAt < now() - 30 days AND status = 'PENDENTE_ASSINATURA' AND tokenAssinaturaExp < now()`. Junto deleta `Indicacao` relacionada (cascade ou explícito).
2. **Filtro nas queries de UI**: lista de cooperados oculta registros com `cpf LIKE 'PROXY_%' AND status = 'PENDENTE_ASSINATURA'` por padrão (admin pode opt-in pra ver).
3. **OU** repensar a estrutura: criar tabela separada `CadastroProxyPendente` em vez de criar Cooperado prematuramente.

**Custo estimado:** opção 1+2 ~2-3h (cron job + ajuste UI), opção 3 ~6-8h (refator + migração).

**Posicionamento:** Sprint Housekeeping ou bloco dedicado pós-onboarding Sinergia (quando volume de cadastros proxy aumentar).

**Status:** 📋 Catalogado em 2026-05-23. Decisão 14: D-novo-AA confirmado livre.

---

### D-novo-AB — Handler hardcoded `handleAtualizacaoContrato` viola decisão (B) do Bloco 5 — altera Contrato direto sem passar por SolicitacaoAlteracaoContrato (P2 limpeza pós-validação produção)

**Origem:** Bloco 5 Etapas A→E do Sprint Bot Autoatendimento (2026-05-24).

**Contexto:** A decisão arquitetural do Bloco 5 (modelo B, locked 24/05) é que o bot **NUNCA** altera contrato direto. Toda alteração via WhatsApp passa por `SolicitacaoAlteracaoContrato` PENDENTE; equipe aprova via painel admin `/dashboard/super-admin/solicitacoes`; só então a aplicação acontece.

O motor dinâmico já foi convertido (Etapas A+B+C+D+E desta sessão M23) — `ATUALIZACAO_CONTRATO` no banco agora aponta pras novas ações `INICIAR_SOLICITACAO_*` + `SALVAR_SOLICITACAO_*` que criam solicitação PENDENTE em vez de aplicar.

**Mas** `whatsapp-bot.service.ts` ainda tem o handler hardcoded antigo (`handleAtualizacaoContrato` ou nome equivalente) que processa o menu '1/2/3/4' do estado `ATUALIZACAO_CONTRATO` chamando `contratosService.update` direto. Esse caminho hardcoded:

- **Não cria** `SolicitacaoAlteracaoContrato` — pula a aprovação humana
- **Não passa por painel admin** — equipe não vê a mudança até consultar o contrato
- **Não dispara notificação interna** pra equipe via `NotificacoesService`
- **Não pré-valida cobrança em aberto** (decisão 4) — fluxo dinâmico bloqueia, hardcoded não
- **Não pré-valida capacidade da usina** (decisão 4) — idem

Hardcoded **só dispara** se a etapa global `ATUALIZACAO_CONTRATO` for desativada (`ativo=false`) ou removida do banco. Hoje a etapa está ATIVA + GLOBAL (`cooperativaId=null`), então motor dinâmico vence o fallback (`handleAtualizacaoContrato` fica inalcançável). Mas o código continua lá — vetor de regressão futura.

**Risco:** se alguém desativa a etapa por engano (admin, migração, refator), o fallback hardcoded volta a executar e burla a decisão (B) silenciosamente.

**Fix:**
1. Após validação em produção do fluxo dinâmico Bloco 5 estabilizado (1-2 sprints), **remover** o método `handleAtualizacaoContrato` de `whatsapp-bot.service.ts`.
2. Trocar `case 'ATUALIZACAO_CONTRATO'` no switch de estados por uma mensagem genérica de erro (ex: "Funcionalidade indisponível, fale com a equipe") — o motor dinâmico nunca chega no hardcoded se a etapa estiver ATIVA, então essa branch só executa em fallback de emergência.
3. Catalogar a remoção em sessão futura `docs/sessoes/YYYY-MM-DD-bloco-5-cleanup-hardcoded.md`.

**Custo estimado:** ~30min (remoção mecânica + smoke test).

**Posicionamento:** Sprint Housekeeping pós-onboarding Sinergia OU 2 semanas após Bloco 5 entrar em produção com Luciano usando o WhatsApp real e a tela admin funcionando.

**Status:** 📋 Catalogado em 2026-05-24. Decisão 14: D-novo-AB confirmado livre após D-novo-AA. Não bloqueia M23 — motor dinâmico tem precedência via gatilho `acao` + etapa ATIVA + GLOBAL.

---

### D-novo-AC — `MENU_INADIMPLENTE` + `iniciarFluxoInadimplente` + `handleMenuInadimplente` são dead code (P2 limpeza)

**Origem:** Bloco 8 Fase 1 read-only do Sprint Bot Autoatendimento (2026-05-24). Confirmado pela investigação `docs/relatorios/2026-05-24-fase1-bloco8-menu-fatura.md`.

**Contexto:** O método público `iniciarFluxoInadimplente` em `backend/src/whatsapp/whatsapp-bot.service.ts:2670-2713` foi escrito pra ser chamado por um cron de cobrança vencida. `grep -rn iniciarFluxoInadimplente backend/src/` retorna **zero chamadores** — nunca foi cabeado.

O cron real de inadimplência (`cronAbordarInadimplentes` em `whatsapp-cobranca.service.ts:217-334`) faz outro caminho: envia mensagem direta com PIX/boleto sem transicionar estado de conversa. O `MENU_INADIMPLENTE` (state) e o `handleMenuInadimplente` (handler) nunca executam em produção.

**Por que não foi portado no Bloco 8:** decisão Luciano (C) MISTO 24/05 — bot tem cron de aviso de inadimplência mas não fluxo conversacional ativo. Portar código morto não agrega. Decisão arquitetural: criar `SOLICITAR_NEGOCIACAO_HUMANA` no motor (Bloco 8) como porta de saída universal pra negociar — independente de estar em dia ou inadimplente.

**Fix (Sprint Housekeeping):**
1. Remover `iniciarFluxoInadimplente` de `whatsapp-bot.service.ts`
2. Remover `handleMenuInadimplente` + `handleNegociacaoParcelamento` (ver D-novo-AD) + estados `MENU_INADIMPLENTE` + `NEGOCIACAO_PARCELAMENTO` do `ESTADOS_FLUXO_ATIVO` whitelist + do switch principal
3. Remover etapas `MENU_INADIMPLENTE` + `NEGOCIACAO_PARCELAMENTO` do seed `prisma/seeds/seed-fluxos-bot.mjs` (já estão `ativo: false` no banco)
4. Quando Luciano definir uma regra real de fluxo conversacional pós-cron de inadimplência, abrir sprint dedicado

**Custo estimado:** ~30-45min (limpeza mecânica + smoke test).

**Posicionamento:** Sprint Housekeeping. Não bloqueia produção.

**Status:** ✅ **PARCIAL RESOLVIDO em 2026-05-25** (Sprint Housekeeping M25, commit `2ec0364`). **Removidos:** `iniciarFluxoInadimplente` (53 linhas) + `handleMenuInadimplente` (75 linhas) + `case 'MENU_INADIMPLENTE'` do switch principal. Total: 128 linhas dead code removidas, 20 linhas comentário adicionadas (~108 linhas líquido, bot.service.ts 4051→3943). **PRESERVADO (decisão Luciano 26/05):** `handleNegociacaoParcelamento` + `case 'NEGOCIACAO_PARCELAMENTO'` + `'NEGOCIACAO_PARCELAMENTO'` no `ESTADOS_FLUXO_ATIVO`. Aguarda Sprint Regra Parcelamento (D-novo-AD) quando regra de negócio for definida. Workaround atual: motor `SOLICITAR_NEGOCIACAO_HUMANA` (Bloco 8 M24). Comentários inline preservados.

---

### D-novo-AD — `NEGOCIACAO_PARCELAMENTO` é placeholder hackish — regra de negócio real não definida (P1 lacuna produto)

**Origem:** Bloco 8 Fase 1 read-only do Sprint Bot Autoatendimento (2026-05-24). `whatsapp-bot.service.ts:2791-2849`.

**Contexto:** O handler `handleNegociacaoParcelamento` hoje **não gera parcelas reais** — apenas persiste uma string em `Cobranca.observacoesNegociacao` ("Parcelamento 3x negociado via WhatsApp em DD/MM/YYYY") + envia confirmação ao cooperado prometendo "Nossa equipe enviará os boletos das parcelas". A equipe precisa processar manualmente lendo essa string em cada fatura.

Não há:
- Geração programática de cobranças filhas (parcelas N de M)
- Integração com Asaas pra gerar parcelas via API (Asaas suporta `installmentCount` no body do POST `/payments`)
- Regra clara: 2x/3x/Nx? Sem juros? Com juros? Quem aprova?
- Tracking de inadimplência das parcelas

**Por que P1 (lacuna produto):** se Luciano ou equipe ativar `WA_INADIMPLENTES_HABILITADO=true` em produção, o cooperado vai poder "negociar" com o bot e sair achando que tem um parcelamento garantido. Risco reputacional + atrito quando a parcela não vier no boleto seguinte.

**Fix:** depende de decisão de produto Luciano (regra de negociação). Possíveis caminhos:
1. **Asaas parcelable** (recomendado): API `POST /payments` com `installmentCount: N` + `installmentValue: V`. Cria N cobranças. Multi-tenant ok via API key da cooperativa.
2. **Geração manual de N cobranças filhas**: criar registros Cobranca com `mesReferencia/anoReferencia` futuros + link Asaas pra cada uma.
3. **Link humano** (já implementado no Bloco 8): cooperado clica "Negociar" → mensagem "vou te conectar com a equipe" + `NotificacoesService.criar` tipo NEGOCIACAO_HUMANA. Equipe processa fora do bot.

**Hoje (M24):** o caminho 3 está disponível via ação motor `SOLICITAR_NEGOCIACAO_HUMANA` (gatilho 4 do MENU_FATURA). Cobre a função enquanto Luciano não define regra real.

**Custo estimado da implementação futura:** 12-20h (depende da regra escolhida + integração Asaas).

**Posicionamento:** sprint dedicado pós-onboarding Sinergia, quando Luciano tiver política de negociação clara.

**Status:** 📋 Catalogado em 2026-05-24. Decisão 14: D-novo-AD confirmado livre após D-novo-AC. Workaround disponível via `SOLICITAR_NEGOCIACAO_HUMANA` (link humano).

---

### D-novo-AE — Handler hardcoded `handleMenuFatura` + `handleComprovantePagamento` violam decisão (C) do Bloco 8 — limpeza pós-validação produção (P2)

**Origem:** Bloco 8 Etapa B-E do Sprint Bot Autoatendimento (2026-05-24).

**Contexto:** Após Bloco 8, o motor dinâmico cobre o fluxo MENU_FATURA inteiro (Ver fatura / Histórico / Já paguei / Negociar humano). Mas `whatsapp-bot.service.ts` ainda tem:

- `handleMenuFatura` (linha 3457-3559)
- `handleRespostaMenuFatura` (linha 3563-3687) — sub-opções PIX/boleto/portal/extrato/comprovante via menu interativo de botões
- `handleComprovantePagamento` (linha 3691-3738) — recebe mídia + notifica `process.env.SUPER_ADMIN_PHONE` (NÃO usa `NotificacoesService`)

E ainda existe o atalho via palavra-chave em `processarMensagem:390` (`fatura | faturas | boleto | 2a via | segunda via | pix | pagar`) que força `estado = 'MENU_FATURA'` + chama `handleMenuFatura` direto, **bypassando o motor**.

**Hoje (M24):** o motor tem precedência via gatilho `acao` na etapa MENU_FATURA (ativada nesta sessão). Mas:
- Se cooperado digita palavra-chave de outro estado não-bloqueante → cai no atalho hardcoded (bypassa motor)
- `AGUARDANDO_COMPROVANTE_PAGAMENTO` (estado hardcoded) ainda existe mas inalcançável via motor (substituído por `AGUARDANDO_FORMA_PAGAMENTO`)
- `handleComprovantePagamento` usa `SUPER_ADMIN_PHONE` global em vez de `NotificacoesService` multi-tenant

**Riscos:**
1. Multi-tenant violation latente no atalho hardcoded (Fase 1 confirmou: busca cooperado SEM `cooperativaId`)
2. Cooperado pode receber UX inconsistente dependendo se entrou pelo menu '2' (motor) ou por palavra-chave (hardcoded)
3. D-novo-U (status `PENDENTE` inexistente) ainda no atalho

**Fix:**
1. Remover atalho palavra-chave de `processarMensagem:369-406` (deixar motor lidar via gatilho MENU_FATURA + sinônimos no banco se Luciano quiser)
2. Remover `handleMenuFatura` + `handleRespostaMenuFatura` + `handleComprovantePagamento` do switch + métodos privados
3. Remover estado `AGUARDANDO_COMPROVANTE_PAGAMENTO` do `ESTADOS_FLUXO_ATIVO` whitelist (substituído por `AGUARDANDO_FORMA_PAGAMENTO`)
4. Catalogar remoção em `docs/sessoes/YYYY-MM-DD-bloco-8-cleanup-hardcoded.md`

**Custo estimado:** ~45-60min (remoção mecânica + smoke test do fluxo via motor).

**Posicionamento:** Sprint Housekeeping pós-onboarding Sinergia OU 2 semanas após Bloco 8 entrar em produção. Mesmo padrão dos débitos D-novo-AB (Bloco 5) e Z (Bloco 6) e antecedentes.

**Status:** 📋 Catalogado em 2026-05-24. Decisão 14: D-novo-AE confirmado livre após D-novo-AD. Não bloqueia M24 — motor dinâmico tem precedência via gatilho `2 → MENU_FATURA` + etapa ATIVA + GLOBAL.

---

### D-novo-AF — Etapa `VER_PROXIMA_FATURA` + ação `CONSULTAR_PROXIMA_FATURA` ficam órfãs após Bloco 8 (P3 limpeza)

**Origem:** Bloco 8 Etapa E do Sprint Bot Autoatendimento (2026-05-24).

**Contexto:** Até o Bloco 3 (21/05), a opção '2' do MENU_COOPERADO ia pra etapa `VER_PROXIMA_FATURA` que tinha `acaoAutomatica: CONSULTAR_PROXIMA_FATURA`. Ação simples — mostrava a próxima fatura + link Asaas + retorno ao MENU_COOPERADO automaticamente.

No Bloco 8, o gatilho '2' do MENU_COOPERADO passou a ir pra `MENU_FATURA` (menu completo com 4 sub-opções). A etapa `VER_PROXIMA_FATURA` continua existindo no banco + a ação `CONSULTAR_PROXIMA_FATURA` continua no `switch` do motor — mas nada mais aponta pra esse caminho.

**Por que não foi removida imediatamente:** Decisão 23 — não tocar mais do que o necessário. Se Luciano testar o bot em produção e quiser reverter, é só apontar `2 → VER_PROXIMA_FATURA` de novo no script idempotente. Manter código como rollback de emergência por 1-2 sprints.

**Fix (Sprint Housekeeping):**
1. Após confirmar que MENU_FATURA está estável em produção (1-2 sprints), remover:
   - Etapa `VER_PROXIMA_FATURA` do seed + banco (`f-ver-saldo-creditos` já tem padrão similar — `f-ver-proxima-fatura`)
   - `case 'CONSULTAR_PROXIMA_FATURA'` do switch do motor + método `executarConsultarProximaFatura` (linha 789-906)
2. Mensagem do modelo `proxima_fatura_resultado` pode ser preservada (talvez reusada num cenário futuro de relatório) ou deletada se confirmar inutilidade

**Custo estimado:** ~20-30min.

**Posicionamento:** Sprint Housekeeping, pode ir junto com D-novo-AE.

**Status:** 📋 Catalogado em 2026-05-24. Decisão 14: D-novo-AF confirmado livre após D-novo-AE. Estado intencional (rollback fácil) por 1-2 sprints.

---

### D-novo-AG — `.pfx` Banestes em disco do servidor (migrar pra Azure Key Vault quando Sinergia entrar) (P2)

**Origem:** Adapter Banestes Etapa A do Cenário Mínimo (M26, 2026-05-26).

**Contexto:** O `BanestesConfigService` (`backend/src/gateway-pagamento/banestes/banestes-config.service.ts`) carrega o certificado `.pfx` Banestes do path em disco (`BANESTES_PFX_PATH` env var). Senha em texto puro em outra env (`BANESTES_PFX_SENHA`).

Decisão M26 (Luciano): aceitável pra CoopereBR única tenant em SANDBOX e em PRODUÇÃO no início. **Quando Sinergia entrar como 2º tenant em produção, cada parceiro precisa do próprio `.pfx`** — gerenciamento em disco escala mal (rotações, permissões por instância, backup).

**Problemas atuais:**
- `.pfx` em disco precisa de backup separado (não vai no `git`)
- Rotação manual (ops Luciano + redeploy)
- Senha em env file (`.env` no servidor) — pessoas com acesso SSH leem
- Multi-tenant: cada tenant precisa de `.pfx` + senha próprios — env vars começam a explodir (BANESTES_<TENANT>_PFX_PATH)

**Fix proposto (sprint dedicado pós-Sinergia, ~6-10h Code):**
1. Migrar `.pfx` pra Azure Key Vault (binary secret) — Azure SDK Node native
2. Senha do `.pfx` no Key Vault também
3. `BanestesConfigService` carrega `.pfx` em runtime via `@azure/keyvault-secrets`
4. Cache em memória continua igual (Agent singleton por tenant)
5. Migração transparente: env var `BANESTES_VAULT_URL` define vault; quando ausente, fallback pra disco (compat)
6. Rotação fica via Azure Portal ou az-cli — sem redeploy

**Custo estimado:** ~6-10h Code + 2-3h operacional Luciano (criar vault Azure, configurar identidade do App Service / VM, migrar `.pfx` + senha do disco pro vault).

**Posicionamento:** Sprint próprio quando Sinergia entrar em produção. Catálogo aceito como dívida consciente do M26.

**Status:** 📋 Catalogado em 2026-05-26. Decisão 14: D-novo-AG confirmado livre após D-novo-AF. Decisão M26 #4 (Luciano): aceitar disco no Cenário Mínimo.

---

### D-novo-AH — Webhook Banestes pendente — baixa de pagamento manual via painel admin Bloco 8 (P2)

**Origem:** Adapter Banestes Etapa B do Cenário Mínimo (M26, 2026-05-26).

**Contexto:** O `BanestesAdapter.processarWebhook` no Cenário Mínimo lança `NotImplementedException` deliberadamente. **Não há controller HTTP recebendo callback PIX do Banestes** no novo sistema (apesar do legado Java ter `Webhook_Cooperado_Banestes` em `/webhook/cooperativa`).

**Por que aceito agora:**
- Volume baixo no Cenário Mínimo (canário Carolina + alguns testes)
- Equipe consegue marcar pagamento manualmente via painel admin Bloco 8 (`POST /solicitacoes-confirmacao-pagamento/:id/confirmar` com `marcarPago: true`) ou direto na Cobranca via Prisma
- Webhook Banestes do legado tinha **gap de segurança** (sem validação de origem, `@CrossOrigin("*")`) — precisamos desenhar do zero com segurança

**Fluxo workaround manual:**
1. Cooperado paga PIX → cai na conta Banestes
2. Equipe consulta extrato Banestes (`POST /gateway-pagamento/banestes/testar-conexao` mostra listagem)
3. Equipe abre tela Bloco 8 `/dashboard/super-admin/confirmacoes-pagamento` ou similar
4. Marca cobrança como PAGA manualmente

**Fix proposto (Cenário Completo Banestes, ~6-8h Code):**
1. `BanestesWebhookController` em rota nova (NÃO `/webhook/cooperativa` do legado, que é endpoint público sem auth)
2. Validação: token compartilhado (env `BANESTES_WEBHOOK_TOKEN_SHARED`) + opcionalmente IP whitelist se Banestes publicar faixa
3. Re-consulta no `GET /cob/{txid}` pra confirmar status CONCLUIDA (legado fazia isso — boa prática)
4. Emit evento `pagamento.confirmado` (já existe — `financeiro-token.listener.ts` + cascata MLM cuidam)
5. Persiste em `GatewayWebhookLog` genérico (tabela nova, multi-gateway)
6. Cadastrar URL `https://app.cooperebr.com.br/gateway-pagamento/banestes/webhook` no painel Banestes

**Custo estimado:** ~6-8h Code (controller + validação + log + spec) + 1h operacional Luciano (cadastrar URL no painel Banestes).

**Posicionamento:** Cenário Completo Banestes pós-Carolina pagar canário. Não bloqueia produção real do canário.

**Status:** 📋 Catalogado em 2026-05-26. Decisão 14: D-novo-AH confirmado livre após D-novo-AG. Decisão M26 (Luciano): adiar pra Cenário Completo, baixa manual cobre.

---

### D-novo-AJ — Revisão periódica do inventário de secrets (P3 manutenção preventiva)

**Origem:** 2026-05-26, criação da `GATEWAY_ENCRYPT_KEY` + inventário inicial (`docs/seguranca/inventario-secrets.md`).

**Cadência:** trimestral — a cada 3 meses, revisitar `docs/seguranca/inventario-secrets.md`.

**Próxima revisão:** 2026-08-26.

**Escopo da revisão trimestral:**
- Confirmar que cada secret listado ainda existe / está em uso
- Confirmar que owner ainda mantém **2 backups offline** (perguntar explicitamente — não inferir)
- Identificar secrets novos que apareceram e não foram catalogados
- Identificar secrets aposentados (gateways removidos, contas desativadas, etc) que devem sair do inventário
- Marcar próximas rotações que vencem nos próximos 3 meses
- Atualizar "Última auditoria completa" no inventário

**Triggers ad-hoc (fora da cadência trimestral):**
- Suspeita de exposição → rotação imediata + auditoria
- Saída de membro do time → revisar quais secrets ele conhecia
- Onboarding de novo parceiro real (Sinergia etc) → revisar policy de backup com ele
- Vazamento detectado em repo público / chat / log → rotação imediata

**Status:** 📋 Catalogado em 2026-05-26. Sem trabalho ativo até 2026-08-26.

---

### D-novo-AJ.1 — Auditar `ASAAS_ENCRYPT_KEY` legado ✅ RESOLVIDO (2026-05-26)

**Origem:** Auditoria inicial do inventário de secrets (2026-05-26 manhã).

**Achado original:** valor antigo de `ASAAS_ENCRYPT_KEY` no `.env` tinha **31 chars com sufixo `_key`** — placeholder textual, NÃO chave AES-256 de 32 bytes. Passava por `crypto.createHash('sha256').update(key).digest()` em `AsaasService.getEncryptKey` (linha 24-30), então funcionalmente rodava, mas **a entropia real era a do texto curto**, não 256 bits.

**Resolução (mesma sessão 2026-05-26 — F2 expandida Etapa E):**

1. ✅ Backup completo do banco antes (`~/backups/sisgd-pre-f2-20260525-163223.sql.gz`, 220KB gzipped, 347 objetos SQL)
2. ✅ Script `__rotate-asaas-encrypt-key.ts` (temporário, removido pós-uso):
   - Leu chave antiga do `.env` em variável temp
   - Gerou chave nova via `openssl rand -base64 32` (44 chars base64 validados)
   - Decrypt + encrypt de 1 registro `AsaasConfig.apiKey` (CoopereBR)
   - UPDATE em transação Prisma atômica
   - Atualizou `.env` substituindo a linha `ASAAS_ENCRYPT_KEY=`
3. ✅ Cipher novo no banco: 390 chars formato `iv:cipher:tag` hex
4. ✅ apiKey REAL preservada: sufixo `****MzY5` (valor Asaas não muda)
5. ✅ 2 papeis offline pelo Luciano (locais DIFERENTES dos papeis da `GATEWAY_ENCRYPT_KEY` — defesa em profundidade)
6. ✅ PM2 restartado pid 40264 (sem erro de decryption no startup)
7. ✅ Smoke E2E pós-rotação: `AsaasService.decrypt` → apiKey real `****MzY5` (consistente)
8. ✅ Inventário atualizado: `ASAAS_ENCRYPT_KEY` movida de 🟡 pra 🟢

**Refs:**
- Doc-sessão: `docs/sessoes/2026-05-26-m29-sub-sprint-gateways-pagamento-f2-expandida.md`
- Inventário: `docs/seguranca/inventario-secrets.md`

**Status:** ✅ RESOLVIDO 2026-05-26. Próxima rotação: 2027-05-26 (12 meses).

---

### D-novo-AK — Instalar gerenciador de senhas pessoal do owner (P3 boa prática operacional)

**Severidade:** P3 (boa prática operacional, não bloqueia produção)
**Owner:** Luciano
**Estimativa:** 15-30 min do Luciano (instalação + criar conta) + 10 min por entrada migrada

**Contexto:** 26/05/2026 — ao gerar `GATEWAY_ENCRYPT_KEY`, descobrimos que o Luciano não tem nenhum gerenciador de senhas instalado (Bitwarden, 1Password, KeePassXC, etc). Recorreu a **2 cópias em PAPEL em locais físicos distintos** como mitigação imediata pra desbloquear Sub-Sprint Gateways Fatia F2.

**Escopo:**

1. Instalar gerenciador de senhas:
   - **Recomendado:** Bitwarden Desktop (gratuito, multiplataforma, sincronização nativa, opção self-hosted no futuro)
   - **Alternativa:** KeePassXC (100% offline, sem conta na nuvem — escolher se prefere zero dependência externa)
2. Criar conta + senha master forte (4+ palavras aleatórias) + 2FA se disponível
3. Migrar entradas atuais (todas hoje em papel):
   - `GATEWAY_ENCRYPT_KEY` (criada 26/05/2026, vive em `backend/.env`)
   - [futuras] `ASAAS_ENCRYPT_KEY` após rotação prevista no D-novo-AJ.1
   - [futuras] `BANESTES_PFX_SENHA` quando configurar sandbox
   - [futuras] outros secrets que aparecerem no inventário
4. Manter pelo menos 1 cópia em PAPEL como redundância adicional (defesa em profundidade — papel não falha por bug de software)
5. Atualizar `docs/seguranca/inventario-secrets.md` coluna "Backups offline" pra refletir "papel + gerenciador" após a migração

**Por que P3 e não maior:** as 2 cópias em PAPEL já cobrem o cenário R2 (perda do `.env`). O gerenciador adiciona conveniência (busca, copiar/colar sem digitar, sincronização entre máquinas) mas não muda a robustez do backup.

**Por que vale fazer logo:** o número de secrets vai crescer rápido (`ASAAS_ENCRYPT_KEY` quando rotacionar, `BANESTES_PFX_SENHA` sandbox + produção, Sicoob futuro, etc). Gerenciar 10+ entradas em papel não escala — risco de inconsistência entre as 2 cópias quando atualizar entries.

**Recomendação:** fazer dentro de 1-2 semanas. Não bloqueia nada agora.

**Refs:**
- `docs/seguranca/regra-secrets-nao-memorizar.md`
- `docs/seguranca/inventario-secrets.md`

**Status:** 📋 Catalogado em 2026-05-26. Aguardando Luciano agendar.

---

### D-novo-AR — Dashboard Portal Proprietário com KPIs zerados (P1)

**Severidade:** P1 (bloqueador funcional do portal — Sub-Sprint F MVP+ inutilizável até resolver)
**Origem:** demo 27/05/2026 noite — Luciano testou `/proprietario` logado como `demo-esolares@example.com` (Usuario PROPRIETARIO criado pra demo Sub-Sprint F)

**Sintoma:** todos KPIs do Dashboard `/proprietario` mostram zero (Usinas: 0, Produção: 0, Capacidade: 0, Repasse: R$ 0,00) mesmo com:
- `Usina.usina-linhares` cadastrada com `proprietarioEmail=demo-esolares@example.com`
- `formaPagamentoDono=FIXO` + `valorAluguelFixo=1000`
- 4 `GeracaoMensal` placeholder Fev-Mai/2026 (45.800 / 51.200 / 48.500 / 42.000 kWh)
- `proprietarioCooperadoId=null` (Caminho A inaplicável — Usuario E-Solares não tem `Cooperado` real, é só Usuario PROPRIETARIO)

**Hipóteses a investigar (Fase 1 read-only obrigatória):**

1. `AuthService.obterContextosUsuario` não retorna contexto `proprietario_usina` pra Usuario PROPRIETARIO sem `cooperadoId` (Caminho B `proprietarioEmail` falhou)
2. Endpoint `/usinas/proprietario/dashboard` não casa `Usina.proprietarioEmail` com `Usuario.email` (case-sensitivity, trim, `mode: 'insensitive'` ausente)
3. Multi-tenant guard filtra `cooperativaId` errado — Usuario PROPRIETARIO criado via Supabase admin não tem `cooperativaId` claro
4. Frontend não envia header `X-Contexto-Ativo` ou similar — request chega ao backend sem contexto resolvido
5. Query agregada SUM/AVG GeracaoMensal retorna 0 erroneamente (JOIN errado, filtro de ano/mes)
6. `calcularRepasse` retorna 0 mesmo com `formaPagamentoDono=FIXO` definido

**Plano:** Fase 1 read-only de:
- `backend/src/auth/auth.service.ts` (método `obterContextosUsuario`)
- `backend/src/usinas/usinas.service.ts` (método `proprietarioDashboard` ou equivalente)
- `backend/src/usinas/usinas.controller.ts` (rota `/proprietario/dashboard`)
- Frontend `web/app/proprietario/page.tsx` + `useContexto` hook
- Banco: SELECT `Usuario` demo + SELECT `Usina` usina-linhares (confirmar match exato proprietarioEmail × email)
- `pm2 logs cooperebr-backend --lines 100` durante request `/proprietario`

**Estimativa:** 1-2h investigação + fix (depende da causa raiz)

**Status:** ✅ **RESOLVIDO em 2026-05-27 noite (sessão Code).** Causa raiz NÃO foi nenhuma das 6 hipóteses iniciais — foi **build estático stale**: `cooperebr-frontend` no PM2 roda `next start -p 3001` (modo produção, não dev), e a build em `web/.next` era anterior ao M30. As mudanças de label/KPIs do Sub-Sprint F MVP+ nunca chegaram ao browser. Rebuild falhou inicialmente por **3 erros TS que `tsc --noEmit` deixou passar mas `next build` (Turbopack) pegou** — catalogados como D-novo-AS abaixo. Fix aplicado:
- 2× `<DialogTrigger asChild>` → `<DialogTrigger render={<Button .../>} />` em `web/app/dashboard/usinas/[id]/proprietario/page.tsx:317-339` (Base UI não tem `asChild` igual Radix — usa `render` prop)
- 1× Tooltip Recharts `formatter={(v: number) => ...}` → `formatter={(v) => Number(v ?? 0)...}` em `web/app/proprietario/usinas/[id]/page.tsx:188` (Formatter aceita `ValueType | undefined`)
- `npm run build` OK (140 páginas, 6.4s compile)
- PM2 frontend online novo PID, porta 3001 LISTENING, HTTP 200 raiz + 307 redirect /proprietario (auth gate normal)

---

### D-novo-AQ — Sidebar Portal Proprietário mostra label genérico (P2)

**Severidade:** P2 (UX — não bloqueia funcionalidade)
**Origem:** demo 27/05/2026 noite

**Sintoma:** sidebar do `/proprietario` mostra label estático "Proprietário de Usina" embaixo de "SISGD" em vez do nome cadastrado em `Usina.proprietarioNome` ou `Usuario.nome` ("E-Solares Demo" esperado).

**Localização suspeita:** `web/app/proprietario/layout.tsx` linhas 47-52 — header sidebar com texto hardcoded:

```tsx
<p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
  <Sun className="w-3 h-3" />
  Proprietário de Usina
</p>
```

**Fix sugerido:** puxar nome do contexto auth via `useContexto()` ou `usuario.nome` direto. Pattern já existe no `/parceiro/layout.tsx` (mostra nome da cooperativa) — replicar.

**Plano:** Fase 1 read-only de:
- `web/app/proprietario/layout.tsx` (header sidebar)
- `web/app/parceiro/layout.tsx` (referência pattern)
- `web/hooks/useContexto.ts` (verificar shape do `contextoAtivo`)

**Estimativa:** 15-30 min (fix curtíssimo se hook já expõe nome)

**Status:** ✅ **RESOLVIDO em 2026-05-27 noite.** Fix em `web/app/proprietario/layout.tsx:51` — `usuario?.nome ?? 'Proprietário'` com fallback. Aplicado ao bundle em rebuild do D-novo-AR.

---

### D-novo-AS — Gap entre `tsc --noEmit` e `next build` no pipeline de validação Code (P2)

**Severidade:** P2 (qualidade de pipeline, gera incidentes pós-deploy se ignorado)
**Origem:** 27/05/2026 noite — investigação D-novo-AR revelou que 3 erros TS estavam latentes em arquivos do M30/M31 (`web/app/dashboard/usinas/[id]/proprietario/page.tsx` × 2 + `web/app/proprietario/usinas/[id]/page.tsx`). Passavam `tsc --noEmit` (que Code usava como gate de validação dos sub-sprints F.3 Etapa E/F) mas falhavam `next build` (Turbopack faz type-check mais agressivo).

**Sintoma:** Sub-Sprint F MVP+ (M30 + M31) foi entregue com `tsc --noEmit ✅` reportado nas doc-sessões, MAS o frontend em produção local jamais rebuildou desde antes do M30 — bundle servido ao browser ficou velho por 3 dias, escondendo a falha. Bug só apareceu na demo (27/05) como "KPIs zerados" enganando Luciano e Code por horas até descobrir a real causa raiz.

**Lacuna:** Code não roda `next build` antes de fechar marcos que tocam `web/`. Erros que Turbopack pega (mas tsc deixa passar) viram débito invisível até alguém rebuildar.

**Erros TS típicos no gap:**
- Componentes `@base-ui/react` (sem `asChild`) confundidos com Radix
- Tipos de libs externas (Recharts `Formatter` com union `| undefined`)
- Props que tsc valida com `--strict false` mas Turbopack com strict

**Fix sugerido (proposta):**

1. **Curto prazo:** quando marco fecha tocando `web/`, Code OBRIGATORIAMENTE roda `cd web && npm run build` (~6-10s) antes de declarar "✅ build validado". `tsc --noEmit` deixa de ser suficiente.
2. **Médio prazo (D-novo-AS.1):** PostToolUse hook que dispara `next build` em background quando arquivo `web/app/**` é editado. Reporta erro se falhar.
3. **Longo prazo (D-novo-AS.2):** CI mínimo local (lint + tsc + next build) rodando no fechamento de cada marco — pode ser script `npm run validate-marco` no root.

**Estimativa:** decisão diretiva curtíssima (regra Code: roda `next build`). Hook PostToolUse 30-60min implementar.

**Refs:**
- `docs/sessoes/2026-05-27-noite-*` (sessão demo + bugs)
- D-novo-AR (incidente que gerou esse aprendizado)

**Status:** 📋 Catalogado em 2026-05-27 noite. Aplicar regra Code IMEDIATAMENTE; hook PostToolUse fica como melhoria futura.

---

### Complemento D-novo-AS (lição D-novo-BN — 30/05/2026)

**Sintoma novo descoberto na sessão BH.4:** rodar `npm run build` no `web/` **sem reiniciar o PM2 frontend imediatamente** deixa o processo Node em runtime com referências em memória aos chunks antigos do `.next/` (que foram sobrescritos). Frontend "fica de pé" mas começa a lançar `ChunkLoadError` em runtime depois de N minutos, quando alguma rota tenta carregar um chunk SSR que não existe mais no disco (típico em `_global-error/page.js`).

**Cronologia do incidente (D-novo-BN):**
- `12:07:15` — PM2 carrega frontend com chunks pré-BH.4.
- `12:41:43` — `npm run build` da sessão BH.4 regenera `.next/BUILD_ID` SEM restart imediato.
- `12:54:04` — primeiro `ChunkLoadError: Failed to load chunk cooperebr_web_d9a3a872._.js` (chunk inexistente no disco).
- `13:22:06` — bug persiste em requests novas.
- Fix conservador (15min): `pm2 stop frontend + rm -rf web/.next + npm run build + pm2 start frontend`. **Resolveu 100%.**

**Regra dura nova (catalogada como D-novo-AS sub-item, vincula a D-novo-AS.2):**

Toda vez que Code rodar `npm run build` em `web/`, **OBRIGATORIAMENTE seguir com `pm2 restart cooperebr-frontend` imediato**. Sem exceção. Sem espera. Não deixar processo Node rodando com `.next/` regenerado mas memória antiga.

**Hook futuro D-novo-AS.2 (proposta refinada):** PostToolUse que após qualquer `npm run build` em `web/` dispara automaticamente `pm2 restart cooperebr-frontend`. Estimativa: 30-60min implementar. Não-bloqueador, mas remove o erro humano.

**Aplicação retroativa nesta sessão:** Sprint D-novo-BH teve 4 ciclos de build web (BH.3, BH.4, BM, BH.5) — a regra foi aplicada em todos os 4 sem regressão. Validado que funciona.

**Refs:**
- Doc-sessão `docs/sessoes/2026-05-30-sub-sprint-bh-despesas-camada-2-completo.md` seção "Lições".
- Commit fix `03f49fc` (D-novo-BN RESOLVIDO).

---

### D-novo-BD — Tabela /dashboard/proprietario/[cooperativaId] estourando horizontal (P2)

**Severidade:** P2 (UX, frustração de leitura em viewport médio)
**Origem:** 27/05/2026 noite — smoke visual do F.5b. Luciano relatou que a tabela com 7 colunas (Usina/Status/Proprietário/Contrato/YTD/Convite/Ação) estourava lateralmente em viewport ~1280-1366px (largura comum desktop), forçando scroll horizontal no browser inteiro.

**Fix aplicado:** envolver `<Table>` com `<div className="overflow-x-auto">` + `<Table className="min-w-[900px]">` em `web/app/dashboard/proprietario/[cooperativaId]/page.tsx`. Scroll horizontal fica isolado ao container da tabela, não afeta layout da página.

**Status:** ✅ **RESOLVIDO em 2026-05-27 noite (M33 Etapa A).**

---

### D-novo-AZ — Campo Classe GD (GD_I/GD_II/GD_III) na tela /dashboard/usinas/nova (P1)

**Severidade:** P1 (lacuna de cadastro — campo necessário pro Sub-Sprint Fio B real)
**Origem:** 27/05/2026 noite — exploração das telas de usinas pela equipe orquestradora pré-fechamento M33.

**Sintoma:** schema Prisma tem `Usina.classeGdAnotada` (campo opcional já existente), MAS tela `/dashboard/usinas/nova` não tem input pra preencher. Sem o campo, sistema não consegue diferenciar GD_I (≤ 75kW, isento Fio B) vs GD_II/GD_III (> 75kW, sujeitos a Fio B progressivo).

**Fix sugerido (escopo):**

1. Adicionar `<Select>` ou `<RadioGroup>` na tela `/dashboard/usinas/nova` com 3 opções: GD_I, GD_II, GD_III + opção "Não classificado"
2. Tooltip/help inline explicando cada tipo (referência REN 1.000/2021 + REN 1.059/2023)
3. Salvar em `Usina.classeGdAnotada` (campo já existe no schema)
4. Adicionar mesma opção na tela `/dashboard/usinas/[id]/editar` (depende de D-novo-BB+BC primeiro)

**⚠️ IMPORTANTE — SÓ REGISTRO, ZERO LÓGICA FIO B AGORA.** Este débito catalogou APENAS o input/persistência do campo. Quando Sub-Sprint Fio B real (futuro, não agendado) for executado, ELE consome `classeGdAnotada` pra aplicar regras Fio B progressivas nas usinas marcadas GD_II/GD_III. Hoje sistema permanece neutro (decisão estratégica enquanto litígio CoopereBR×EDP corre — vide nota schema.prisma:378-380).

**Estimativa:** 30-45min (formulário simples + label/help + persistência).

**Status:** 📋 Catalogado em 2026-05-27 noite. Vai pro Sub-Sprint Refinamento Telas Usinas.

---

### D-novo-BA — Auditar usinas existentes pra preencher classeGdAnotada (P2)

**Severidade:** P2 (correção de dado faltante após D-novo-AZ implementar)
**Origem:** mesma exploração 27/05/2026 noite.

**Sintoma:** após D-novo-AZ adicionar o campo, todas as ~10 usinas existentes (4 Linhares + outras) ficam com `classeGdAnotada=null`. Precisa auditar uma a uma e preencher (depende de informação real da homologação ANEEL/EDP).

**Fix sugerido:**

1. Script `backend/scripts/auditoria-classe-gd.ts` listando todas usinas com `classeGdAnotada=null` + `potenciaKwp` + dados de homologação
2. Luciano (ou empresa adjacente) preenche planilha manual com a classe correta de cada usina
3. Script update bulk em produção (com Decisão 23 — review SQL gerado primeiro)

**Estimativa:** 30min Code (script) + ~1h Luciano operacional (preencher planilha).

**Status:** 📋 Catalogado em 2026-05-27 noite. Depende D-novo-AZ. Vai pro Sub-Sprint Refinamento Telas Usinas.

---

### D-novo-BB — Tela edição usina abre como drawer — VIOLA Padrão UX Dual 17/05 (P1)

**Severidade:** P1 (arquitetural — padrão diretivo violado)
**Origem:** exploração 27/05/2026 noite.

**Sintoma:** click em editar usina abre Sheet/drawer lateral. Padrão UX Dual aprovado 17/05/2026 (memória `padrao_ux_edicao_inline_vs_pagina_propria_17_05.md`) determinou: edição de **entidade completa** (Tipo B) = página própria `/dashboard/X/[id]/editar` (não Sheet/drawer). URL distinta evita confusão tipo Cooperebr2 duplicada.

**Fix sugerido:**

1. Criar `web/app/dashboard/usinas/[id]/editar/page.tsx` (rota dedicada)
2. Migrar formulário do drawer atual pro componente full-page
3. Substituir trigger "Editar" da listagem por `<Link href="/dashboard/usinas/[id]/editar">`
4. Remover Sheet/drawer

**Pre-requisito:** decisão D-novo-BC (paridade de campos) — refator faz sentido de fazer junto, OR D-novo-BB resolvido primeiro mantendo campos atuais.

**Estimativa:** 1.5-2h (refator UX + reaproveitar form fields existentes).

**Status:** 📋 Catalogado em 2026-05-27 noite. Vai pro Sub-Sprint Refinamento Telas Usinas.

---

### D-novo-BG — Anomalia classificação GD Linhares cooperebr1 (P3)

**Severidade:** P3 (não bloqueia operação, mas precisa decisão antes do módulo Fio B)
**Origem:** Fase 1 read-only Sub-Sprint Refinamento Telas Usinas F.7a (28/05/2026)

Usina "COOPERE BR - Usina Linhares" (apelido `cooperebr1`) está marcada como `classeGdAnotada='GD_I'` no banco, populada via seed `backend/scripts/seed-classegd-usinas-coopereBR.ts`. Porém potência declarada é **1.250 kWp** — pela REN ANEEL 1.000/2021 isso seria GD_II (75 kW – 1 MW) ou GD_III (1 MW – 5 MW).

**Confirmação Luciano (28/05):** "se está marcada assim foi intencional para tratamento no futuro". Não tocar agora. Revisar com advogado/contador antes de qualquer correção. Pode ter classificação tributária diferenciada que justifique manter `GD_I` ou ser legacy fix do seed inicial.

**Bloqueia:** módulo Fio B futuro (lógica precisa decidir como tratar essa divergência: assumir REN strict, respeitar classeGdAnotada manual, ou pedir override por usina). Documentar decisão antes de implementar.

**Refs:**
- Relatório `docs/relatorios/<data>-auditoria-classe-gd.md` gerado por `scripts/auditoria-classe-gd.ts`
- Seed inicial `backend/scripts/seed-classegd-usinas-coopereBR.ts`

**Status:** 📋 Catalogado em 2026-05-28 noite. Decisão produto pendente — aguardar Fio B.

---

### D-novo-BH — Módulo Despesas Operacionais da Usina (Camada 2) (P1)

**Severidade:** P1 — sprint dedicado, ~10-15h estimativa original.

**Origem:** decisão Luciano 28/05/2026 durante refinamento telas usinas (F.7a Fase 1).

**Status:** ✅ **IMPLEMENTADO 100% em 2026-05-30** — Sprint D-novo-BH concluído em 7 fatias canônicas + 3 bugs/débitos bônus resolvidos. Substitui em vez de criar `DespesaOperacionalUsina` — reusa tabela `ContaAPagar` existente estendida com workflow (BH.1 schema delta).

**Implementação (7 fatias, 10 commits bb838ec..77eeb24):**

| Fatia | Commit | Entrega |
|---|---|---|
| BH.1 | `bb838ec` | Schema delta workflow PROPOSTA→APROVADA→REJEITADA + tratamento (REEMBOLSO/DESCONTO_NO_REPASSE/ASSUMIDO) + visibilidade proprietário via `responsavelPagamento` |
| BH.2 | `62eddde` | Endpoints REST `/contas-pagar/{operacionais,proprietario,propor,upload-comprovante,:id/{aprovar,rejeitar,resolver}}` + notificação proativa (email+WA whitelist LGPD) |
| BH.3 | `8d045af` | Tela admin `/dashboard/usinas/[id]/despesas` (4 KPIs + 3 TabsCustom + tabela 7 colunas) |
| BH.3.1 | `44f5e53` | Refator UX página própria `/nova` (Padrão Dual Tipo B 17/05) + `DespesaForm` reusável + `UploadComprovante` drag-drop 5MB |
| BH.3.2 | `543a835` | Workflow double-check UNIVERSAL (TODOS perfis criam PROPOSTA) + self-approval guard backend |
| BH.4 | `9858c45` | Portal Proprietário `/proprietario/despesas` + `/proprietario/despesas/nova` + flag `Cooperativa.proprietarioVeDespesas` (default false) + GET `/proprietario/meu-parceiro` + PUT `/cooperativas/:id/proprietario-ve-despesas` + tela admin `/dashboard/configuracoes/portal-proprietario` + Super Admin bypass tenant + IDOR guard PROPRIETARIO |
| BH.5 | `77eeb24` | Helper `calcularRepasseLiquido` (envelope sobre `calcularRepasse` puro — intacto) + 7 consumidores migrados + cron `@Cron('0 3 1 * *', tz São Paulo)` cria ARRENDAMENTO_USINA APROVADA+RESOLVIDA+ASSUMIDO+PARCEIRO idempotente + endpoint manual trigger DEV-only |

**Bugs bônus resolvidos inline durante sprint:**
- **D-novo-BL** ✅ RESOLVIDO em BH.4 — Super Admin sem cooperativaId fixa.
- **D-novo-BN** ✅ RESOLVIDO em `03f49fc` — ChunkLoadError Turbopack stale.

**Débitos catalogados durante sprint:**
- **D-novo-BM** ✅ IMPLEMENTADO em `1cdb9cb` (Painel Credenciais Teste Opção B) — **BLOQUEADOR REMOÇÃO PRÉ-PROD** com checklist 9 passos.

**Validações:**
- 55 specs Jest verdes (30 contas-pagar + 11 cooperativas + 7 auth-dev + 13 BH.5 + 1 IDOR PROPRIETARIO).
- 3 smokes programáticos: 8/8 BH.4 + 8/8 BM + 8/8 BH.5 = **24/24 ✅**.
- Build web Turbopack clean em 4 ciclos.

**Refs:**
- Doc-sessão consolidada: `docs/sessoes/2026-05-30-sub-sprint-bh-despesas-camada-2-completo.md`
- Helper repasse puro mantido: `backend/src/usinas/helpers/calcular-repasse.ts`
- Helper líquido novo: `backend/src/usinas/helpers/calcular-repasse-liquido.ts`
- Cron mensal: `backend/src/contas-pagar/repasse-mensal.cron.ts`

**Próximo bloco vinculado:** D-novo-AN (RepasseProprietario tabela) — campo `ContaAPagar.repasseAbatidoId` ficou nullable pronto pra popular quando AN entregar.

---

### D-novo-BF — Bug N3 frontend: header vazio + tab Usinas vazia (P1)

**Severidade:** P1 (UX bloqueador — fluxo principal F.6 hierárquico quebrado pós-F.6b)
**Origem:** 28/05/2026 — smoke visual F.6b Luciano. Click no card de proprietário (N2) navega pra N3 mas vem quebrada: header com nome vazio, email truncado em "***m", help inline com placeholder `${proprietario.nome}` não substituído ("Usinas que — administra"), tab Usinas dizendo "Este proprietário não tem usinas registradas".

**Sintoma reproduzível:** acontece tanto com SUPER_ADMIN como ADMIN_PARCEIRO. Portal proprietário logado direto (M30 `/proprietario/usinas/[id]`) NÃO afetado.

**Smoke F.6a backend passou via curl 6/6** (incluindo N3 E-Solares com propId `e-demo-esolares%40example.com` → 200 com 1 usina FIXO R$ 1.000). Backend OK no curl direto.

**Causa raiz (confirmada via diag 3 cenários):** Next.js 16 `useParams` retorna params **RAW encoded** (mantém `%40`, `%2F` etc — NÃO decoda automaticamente como assumi inicialmente). Frontend N3 fazia `encodeURIComponent(proprietarioId)` re-aplicado → duplo encode → URL backend recebia `%2540` → Express decoda 1x → `propId='e-demo-esolares%40example.com'` → `parsePropId` extraía email com `%40` literal → não casava com email real `'demo-esolares@example.com'` → response vazia.

**Fix aplicado (1 linha):** `web/app/dashboard/proprietario/[cooperativaId]/[proprietarioId]/page.tsx:141` — removido `encodeURIComponent` do propIdParaUrl. Comentários `:107` e `:137` atualizados pra refletir comportamento real do Next.js 16 (RAW encoded, não decoded). axios envia URL no estado original → Express decoda 1x → backend recebe `@` correto.

**Validação pós-fix:**
- Smoke 2/2 com JWT real: Caminho B EMAIL `e-contato%40energiaverde.com.br` → 200 "Energia Verde Ltda" 1 usina ✅; SEM_PROPRIETARIO → 200 4 órfãs ✅
- npm run build OK (140 páginas, 7.5s)

**Status:** ✅ **RESOLVIDO em 2026-05-28 (M34 fix).** Aguardando smoke visual Luciano antes do fechamento canônico M34.

---

### D-novo-BJ — URL assinada com expiração pra comprovantes (P2 LGPD)

**Severidade:** P2 (LGPD, não-bloqueante MVP)
**Origem:** 29/05/2026 — BH.3.1 ampliada do sprint D-novo-BH. Upload nativo de comprovantes JPG/PNG/PDF foi implementado com storage local em `backend/uploads/comprovantes/<coopId>/<ano>/<mês>/` servido via rota estática pública `/uploads/`. Sem auth gate nem expiração.

**Risco:** URL é previsível (path com timestamp + 8 chars hex random). Se alguém tem o link → acessa sem token. Anexos podem conter NF com CPF/CNPJ de prestador, dados pessoais — vazamento LGPD se URL leakar.

**Mitigação MVP atual:** path com timestamp ms (13 dígitos) + 4 bytes random (8 hex chars) = ~4.3 bilhões de combinações por timestamp. Brute-force inviável mas não impossível.

**Fix sugerido (futuro):**
- Endpoint `GET /uploads/:cooperativaId/:caminho` com `@UseGuards(JwtAuthGuard)` + check multi-tenant
- URL pré-assinada tipo Supabase Storage signed URL (expira em 1h)
- OU servir via stream do controller (auth + audit + LGPD compliance)

**Estimativa:** 2-3h (refator backend + atualiza frontend `UploadComprovante` pra fazer fetch via API ao invés de `<img src="/uploads/...">` direto).

**Status:** 📋 Catalogado em 2026-05-29 BH.3.1. MVP aceita risco LGPD; resolver antes de produção real.

---

### D-novo-BK — Migrar storage de uploads pra Supabase Storage / S3 (P3)

**Severidade:** P3 (escalabilidade/portabilidade, não-bloqueante MVP)
**Origem:** 29/05/2026 — BH.3.1. Storage hoje é local em `backend/uploads/` (disco do servidor PM2).

**Limitações:**
- Não escala horizontalmente (cada nó PM2 teria seu próprio disco)
- Não tem backup automático (PM2 morre → arquivos somem se não houver disk snapshot)
- Acoplado ao filesystem do container/VM
- Se Code/Luciano migrarem deployment pra Vercel/serverless, storage local falha

**Fix sugerido:**
- Adapter pattern: `StorageService` com implementação `LocalDiskStorage` (atual) e `SupabaseStorage` futuro
- Variável env `STORAGE_PROVIDER=local|supabase|s3`
- Migration de arquivos existentes (script `migrar-uploads-pra-supabase.ts`)

**Estimativa:** 4-6h (adapter + impl Supabase + script migração + smoke).

**Dependência:** Supabase já é usado pra DB/Auth — bucket de storage é incremento natural.

**Status:** 📋 Catalogado em 2026-05-29 BH.3.1. Resolver quando primeiro parceiro real entrar (ou quando precisar escalar).

---

### D-novo-BE — Validação cadastro proprietário: nome divergente em mesmo email (P3)

**Severidade:** P3 (qualidade de dado, não-bloqueante — solução já existe pra cards F.6a)
**Origem:** 28/05/2026 — execução F.6a backend. Hierarquia de cards N2 agrupa usinas por chave de dedupe (email lowercase em Caminho B). Surge edge case: mesma chave (mesmo email) pode ter `proprietarioNome` divergente em usinas distintas (cadastro inconsistente — copy/paste, erro de digitação, ou uma usina criada antes do nome ser padronizado).

**Solução atual F.6a:** pegar o nome da usina mais recente (`updatedAt desc`) — funciona, mas é workaround.

**Solução ideal futura:**

1. **Curto prazo:** validar no form de cadastro/edição da usina — se `proprietarioEmail` já existe em outra usina da mesma cooperativa, sugerir auto-preencher `proprietarioNome` igual (com aviso "este email já está vinculado a `<nome>` em N usinas").
2. **Médio prazo:** extrair entidade `Proprietario` separada (mencionado em D-novo-AM YAGNI). Quando 2ª usina E-Solares aparecer (ou o pattern se repetir), criar `Proprietario` como tabela própria com FK em `Usina`. Resolve o single source of truth.

**Estimativa:** 30-60min validação form (curto prazo) ou 4-6h migração entidade Proprietario (médio prazo, parte do D-novo-AM).

**Status:** 📋 Catalogado em 2026-05-28. Não bloqueia — F.6a já resolve com workaround `updatedAt desc`.

---

### D-novo-BC — Tela edição usina sem paridade de campos com /nova (P2)

**Severidade:** P2 (lacuna funcional)
**Origem:** exploração 27/05/2026 noite.

**Sintoma:** form de edição (drawer atual OU futura página) NÃO tem paridade com o de cadastro `/nova`. Campos ausentes no edit que existem no schema + cadastro:

- Contrato distribuidora (`numeroContratoEdp`, `dataContratoEdp`)
- Forma de aquisição (`formaAquisicao`: CESSAO/ALUGUEL/PROPRIA)
- Forma pagamento dono (`formaPagamentoDono`: FIXO/PERCENTUAL/HIBRIDO)
- Proprietário completo (`proprietarioNome`, `proprietarioCpfCnpj`, `proprietarioTelefone`, `proprietarioEmail`, `proprietarioTipo`)
- Bloco H' endereço completo (`enderecoLogradouro/Numero/Bairro/Cep`)
- Apelido interno (`apelidoInterno`)
- Distribuidora (`distribuidora`)
- Modelo cobrança override + política bandeira

**Fix sugerido:** após D-novo-BB ter a página dedicada `/editar` criada, replicar TODOS os campos do schema (com `optional: true` quando aplicável). Bloquear apenas campos imutáveis (id, createdAt).

**Estimativa:** 1.5-2h (formulário ampliado + validações + DTOs backend já cobrem maioria dos campos).

**Status:** 📋 Catalogado em 2026-05-27 noite. Vai pro Sub-Sprint Refinamento Telas Usinas (após D-novo-BB).

---

### D-novo-BN — Bug 500 rota /dashboard/usinas/[id]/despesas pós-BH.4 (P0 BLOQUEADOR)

**Severidade:** P0 BLOQUEADOR — tela admin de despesas operacionais inacessível.

**Origem:** 2026-05-29 noite — detectado por Luciano em smoke visual após commit BH.4 (`9858c45`). Reprodução em Chrome anônimo + Edge; **não é cache de browser**.

**Sintomas:**

- GET `/dashboard/usinas/usina-linhares/despesas` retorna **500 Internal Server Error**.
- 3 chunks Turbopack `/next/static/chunks/*.js` → 500 / `ERR_ABORTED`.
- Console do browser: `"Application error: a client-side exception has occurred while loading localhost"` + `ChunkLoadError`.

**Triagem aplicada (sem fix):**

PM2 logs `cooperebr-frontend` em 12:54:04 mostram a stack:

```
ChunkLoadError: Failed to load chunk server/chunks/ssr/cooperebr_web_d9a3a872._.js
  from module 674823
  digest: '2760986192'
  [cause]: Error: Cannot find module
    'C:\Users\Luciano\cooperebr\web\.next\server\chunks\ssr\cooperebr_web_d9a3a872._.js'
  Require stack:
    - .next\server\chunks\ssr\[turbopack]_runtime.js
    - .next\server\app\_global-error\page.js
```

Backend `cooperebr-backend` subiu OK em 12:47:04 e mapeou **todas** as rotas BH.4 (incluindo `/proprietario/meu-parceiro`, `PUT /cooperativas/:id/proprietario-ve-despesas`). **Não há erro 500 backend correlato** — bug é puramente frontend.

**Hipótese:** NÃO é regressão de código fonte do BH.4. É **cache Turbopack `.next/` corrupto** — referência stale a chunk `cooperebr_web_d9a3a872._.js` que não existe mais no disco. Frontend rodou OK por ~47min depois do `pm2 restart cooperebr-frontend` (12:07:15), começou a falhar em 12:54:04 — comportamento consistente com rebuild incremental Turbopack que limpou um chunk físico mantendo a referência em runtime do `_global-error`.

**Arquivos suspeitos:**

- `web/.next/server/chunks/ssr/cooperebr_web_d9a3a872._.js` — inexistente no disco
- `web/.next/server/app/_global-error/page.js` — referencia chunk faltante
- `web/.next/server/chunks/ssr/[turbopack]_runtime.js:683` — linha que lança `ChunkLoadError`

**Fix sugerido (a aplicar na próxima sessão):**

1. `pm2 stop cooperebr-frontend`
2. `rm -rf web/.next`
3. `cd web && npm run build`
4. `pm2 start cooperebr-frontend`
5. Repro Chrome anônimo + Edge — esperar 200.

Se isso não resolver, hipótese B é regressão real BH.4 — investigar `web/app/proprietario/layout.tsx` (refator do `navItems` condicional com fetch `/proprietario/meu-parceiro`) e qualquer componente compartilhado com `/dashboard/usinas/[id]/despesas`. Se fix custar >1h, **rollback `9858c45`** (BH.4) é alternativa aceitável — BH.4 mexeu em 14 arquivos, mas reverter é cirúrgico (preservando D-novo-BL resolvido inline).

**Estimativa:** 15-30min se for cache Turbopack (hipótese principal). 1-3h se for regressão real.

**Status:** ✅ **RESOLVIDO em 2026-05-29 noite** (sessão pós-fechamento parcial, ~10min). **Root cause confirmado:** cache Turbopack `.next/` stale após rebuild incremental durante runtime PM2. Cronologia: PM2 carregou frontend em `12:07:15` (chunks pré-BH.4); `npm run build` da sessão BH.4 regenerou `.next/BUILD_ID` em `12:41:43` SOBRESCREVENDO os chunks ANTES do PM2 ser reiniciado; processo Node continuou em memória com referências aos chunks antigos e passou a tentar carregar chunks novos (`cooperebr_web_d9a3a872._.js`) gerados em outras rotas. Resultado: ChunkLoadError reincidente em `_global-error/page.js`.

**Fix aplicado:** sequência conservadora padrão CLAUDE.md PM2:

1. `pm2 stop cooperebr-frontend`
2. `rm -rf web/.next`
3. `cd web && npm run build` (Turbopack regenerou bundle limpo)
4. `pm2 start cooperebr-frontend` (pid 35208, Ready in 615ms)

**Validação:**

- `find -name "*d9a3a872*"` em Fase 1: VAZIO (chunk não existia no disco) — evidência forte da hipótese.
- BUILD_ID regenerado: `SWghHLsUGBLgOCk_vwFsH` (`16:18:23`, era `XL8nZ91OkDidlczwuwhx5` de `12:41:43`).
- Smoke HTTP 3 rotas pós-fix: `/dashboard/usinas/usina-linhares/despesas` → **307**, `/proprietario/despesas` → **307**, `/dashboard/configuracoes/portal-proprietario` → **307**. Nenhum 500.
- PM2 frontend online sem restart loop. Logs limpos (apenas warning benigno pré-existente sobre 2 `package-lock.json`).

**Aprendizado / prevenção:** o `D-novo-AS` (regra de rodar `npm run build` antes de commit web) precisa ser complementado com `pm2 restart cooperebr-frontend` IMEDIATAMENTE após build, em vez de deixar o processo Node rodando com `.next/` antigo em memória. Em qualquer sessão futura: build web → restart frontend, na mesma etapa. **Sugestão futura D-novo-BN.1 (não bloqueador):** hook PostToolUse que após `npm run build` em `web/` dispare `pm2 restart cooperebr-frontend` automaticamente, evitando esse vetor.

---

### D-novo-BM — Painel de credenciais de teste (Opção B login rápido) (P0 BLOQUEADOR REMOÇÃO PRÉ-PROD)

**Severidade:** P0 BLOQUEADOR REMOÇÃO PRÉ-PROD (foi P3 funcional → eleva-se a P0 segurança no momento em que primeiro parceiro real entra em produção).

**Origem:** 2026-05-29 — Luciano pediu durante a sessão BH.4. Decisão Luciano: **Opção B** (login rápido sem expor senha, via endpoint dev impersonate) em vez da Opção A original (lista com senha em texto).

**Status:** ✅ **IMPLEMENTADO em 2026-05-30** — feature funcional + multi-camada de defesa contra vazamento em produção.

**Implementação aplicada:**

Backend (`backend/src/auth/`):

- `auth-dev.controller.ts` (NOVO): 2 endpoints `GET /auth/dev/usuarios-teste` e `POST /auth/dev/impersonate`.
- `auth.service.ts`: novo helper público `assinarTokenImpersonate(target)` — gera JWT com TTL **1h** (não 7d padrão), resolve `cooperadoId` por email/CPF, espelha lógica do `login()` mas sem checar senha.
- `auth.module.ts`: registra `AuthDevController`.
- `auth-dev.controller.spec.ts`: **7 specs verdes** (4 do prompt + 3 adicionais: userId inexistente, alvo inativo, body sem userId).

Frontend (`web/`):

- `app/dashboard/dev/credenciais-teste/page.tsx` (NOVO): painel com banner vermelho gigante, agrupado por Super Admins / Cooperativa / Outros, cards de usuário com botão "Logar como X" + redireciona pra `/dashboard` (admin), `/portal` (cooperado) ou `/proprietario` (dono usina).
- `app/dashboard/layout.tsx`: probe ao `/auth/dev/usuarios-teste` no mount (só SUPER_ADMIN) → se 200 mostra item sidebar "Credenciais teste"; se 403 esconde. Item adicionado em seção "DEV" só pra SUPER_ADMIN.
- `lib/auth.ts`: helper `aplicarSessaoImpersonate(token, usuario)` — seta cookies + limpa `contexto_ativo`.

**Defesa em camadas (4 níveis):**

1. **Runtime guard:** `isAmbienteReal()` em CADA endpoint (helper inegociável 18/05, `backend/src/common/safety/ambiente.ts` usa `AMBIENTE_REAL=true` opt-in produção).
2. **Auth guard:** `@Roles(SUPER_ADMIN)` — `RolesGuard` global bloqueia outros perfis.
3. **Audit:** `@AuditLog({ acao: 'auth.dev.impersonate', recurso: 'Usuario', recursoIdParam: 'userId' })` registra TODA tentativa em produção (caso o admin esqueça de setar `AMBIENTE_REAL`, qualquer uso aparece no audit log).
4. **TTL curto:** JWT impersonado expira em **1h** (não 7d), forçando re-impersonate periódico.

**Smoke programático 8/8 ✅:** GET usuarios-teste SA+DEV → 200 + 10 usuários listados; POST impersonate ADMIN → 200 + JWT válido; decode JWT confirma perfil=ADMIN + cooperativaId; TTL=3600s exato; ADMIN tentando impersonate → 403; sem auth → 401; userId inexistente → 404.

**Smoke HTTP rota frontend:** `/dashboard/dev/credenciais-teste` → 307 (auth gate normal).

**🚨 OBRIGAÇÃO DE REMOÇÃO antes do primeiro parceiro real entrar em produção 🚨**

1. Setar `AMBIENTE_REAL=true` no `.env` de produção (já bloqueia automaticamente endpoint + esconde item sidebar — defesa #1).
2. **DELETAR** `backend/src/auth/auth-dev.controller.ts`
3. **DELETAR** `backend/src/auth/auth-dev.controller.spec.ts`
4. **DELETAR** rota `web/app/dashboard/dev/credenciais-teste/page.tsx` (e remover pasta `web/app/dashboard/dev/` se vazia)
5. **REMOVER** item sidebar "DEV → Credenciais teste" em `web/app/dashboard/layout.tsx` (bloco marcado `D-novo-BM`) + probe `useEffect` que chama `/auth/dev/usuarios-teste`
6. **REMOVER** método público `assinarTokenImpersonate` em `auth.service.ts`
7. **REMOVER** helper `aplicarSessaoImpersonate` em `web/lib/auth.ts`
8. **REMOVER** registro `AuthDevController` em `auth.module.ts`
9. Commit: `chore(security): remove D-novo-BM painel credenciais teste pré-produção`

**Como saber que está pronto pra remover:** quando Luciano disser "vamos colocar primeiro parceiro em produção real" / fechar onboarding Sinergia / qualquer evento que mude o `AMBIENTE_REAL` pra `true`.

**Implementação em commit `1cdb9cb`** (D-novo-BM Painel Credenciais Teste Opção B).

**Reparo funcional posterior:** `3a8a90e` (AN.3.1, 30/05/2026) — TTL impersonate 1h→8h + interceptor allowlist self-recovery. O status BLOQUEADOR REMOÇÃO PRÉ-PROD permanece — o reparo só ajustou usabilidade DEV.

---

### D-novo-AN — RepasseProprietario (tabela de pagamentos do parceiro pro proprietário) (P1)

**Severidade:** P1 — sprint dedicado.

**Origem:** decisão Luciano 30/05/2026 durante fechamento Sprint D-novo-BH. BH.5 implementou apenas a obrigação (ARRENDAMENTO_USINA via ContaAPagar) sem trackear pagamento real (data, método, comprovante, status).

**Status:** ✅ **IMPLEMENTADO 100% em 2026-05-30** — Sprint D-novo-AN concluído em 5 fatias canônicas + 1 bug bônus reparado.

**Implementação (5 fatias, 5 commits `37f7af0..2f6fb29`):**

| Fatia | Commit | Entrega |
|---|---|---|
| AN.1 | `37f7af0` | Schema delta aditivo (model `RepasseProprietario` + 2 enums + `@@unique([usinaId, periodoInicio, periodoFim])` + 4 índices + back-ref `ContaAPagar.repasseAbatido` + back-refs Cooperativa/Usina/Usuario com names explícitos) + service workflow (criarPendente/marcarPago transação atômica/cancelar/listar 3 variantes) + 4 DTOs class-validator + 19 specs verdes. Migration aplicada via ritual PM2 CLAUDE.md (pm2 stop → porta livre → prisma generate → db push → restart). |
| AN.2 | `2f36470` | Controller REST 6 endpoints (`GET /repasses`, `GET /repasses/proprietario`, `GET /repasses/:id`, `PUT marcar-pago`, `PUT cancelar`, `POST upload-comprovante`) + integração nativa cron BH.5 (`prisma.$transaction([createRepasse PENDENTE, createArrendamento])`) + resolução Caminho A/B do `proprietarioUsuarioId` + refator endpoint `/proprietario/repasses` consumindo tabela com fallback `'PREVISTO_FALLBACK'` + 13 specs (controller + cron AN.2-aware) + smoke E2E HTTP 12/12. |
| AN.3 | `a3b351a` | 2 telas admin (`/dashboard/usinas/[id]/repasses` Tipo B por usina + `/dashboard/repasses` Tipo B global cross-usinas) + componentes compartilhados `web/components/repasses/{types,DialogMarcarPago,DialogCancelar}` (Tipo C) + refator portal `/proprietario/repasses` (3 KPIs novos + tipo REAL/FALLBACK + colunas pagamento) + sidebar item "Repasses" Operacional (ícone Wallet) + card cruzado em `/dashboard/usinas/[id]/page.tsx` + `UploadComprovante` parametrizado (prop opcional `endpoint`). |
| AN.3.1 | `3a8a90e` | Fix `D-novo-BM` painel credenciais voltava pro `/login` em uso real (causa: token impersonate TTL 1h expirado → `useContexto.GET /auth/me` → interceptor global redirect). Fix duplo: TTL backend 1h→8h + interceptor frontend allowlist self-recovery (`/dashboard/dev/credenciais-teste`, `/selecionar-contexto`) com UI inline de re-login. Trigger manual cron criou 1 RepasseProprietario PENDENTE pro Luciano testar via UI. Investigação read-only `/parceiro` vs `/dashboard` (30 páginas vivas em `/parceiro` mas sidebar já encaminha entidades complexas pra `/dashboard/*` — recomendação opção b acatada em AN.4). |
| AN.4 | `2f6fb29` | Fix cards parceiro (sidebar `/parceiro/layout.tsx:54` href Usinas → `/dashboard/usinas`; `/parceiro/usinas/page.tsx` vira redirect protegendo bookmarks) + backfill histórico idempotente (`scripts/backfill-repasses-proprietario.ts` com dry-run default e --apply, executou criando 3 PENDENTE preservando 04/2026 do trigger AN.3.1) + notificarRepassePago em NotificacoesProativasService (email + WA com fallback Caminho A/B + whitelist LGPD dev + proteção status PAGO) + wireup fire-and-forget no marcarPago + PDF relatório mensal com seção "Status do Repasse" (PAGO verde / CANCELADO cinza / PENDENTE amarelo / sem registro neutro) removendo heurística fake "mês passado = PAGO automático". |

**Bugs/débitos bônus resolvidos durante sprint:**
- **D-novo-BM** ✅ funcionalmente reparado em AN.3.1 (mantém status P0 BLOQUEADOR REMOÇÃO PRÉ-PROD — reparo só ajustou usabilidade DEV).

**Débitos novos catalogados durante sprint:**
- **D-novo-BP** P3 (NOVO) — Convergência portal `/parceiro` vs `/dashboard` (próxima entrada).

**Validações:**
- 36 specs Jest verdes (21 service AN.1+AN.4 + 10 controller AN.2 + 5 notificação AN.4).
- 3 smokes programáticos: 8/8 service AN.1 + 12/12 endpoints AN.2 + script backfill (3 criados + 2ª execução idempotente).
- Smoke HTTP AN.3: 4/4 rotas → 307.
- Build web Turbopack clean em 4 ciclos.

**Estado banco pós-sprint:**
- 4 `RepasseProprietario` PENDENTE (02/03/04/05 2026) — 1 do trigger AN.3.1 + 3 do backfill.
- `ContaAPagar.repasseAbatidoId` populado quando admin marca PAGO (transação atômica vincula despesas DESCONTO_NO_REPASSE pendentes do período).

**Refs:**
- Doc-sessão consolidada: `docs/sessoes/2026-05-30-sub-sprint-an-repasse-proprietario-completo.md`
- Schema: `backend/prisma/schema.prisma model RepasseProprietario` + `ContaAPagar.repasseAbatido`
- Service novo: `backend/src/repasses-proprietario/repasses-proprietario.service.ts`
- Cron integrado: `backend/src/contas-pagar/repasse-mensal.cron.ts`
- Backfill: `backend/scripts/backfill-repasses-proprietario.ts`

---

### D-novo-BR — Sprint Blindagem Multi-Tenant Sistêmica (P0)

**Severidade:** P0 — terceira fase do tratamento IDOR, complementa D-novo-BQ. Auditoria expandida (Onda A + Onda B) revelou 50 IDORs adicionais (19 + 31), totalizando 68 IDORs sistêmicos. Decisão arquitetural: solução **híbrida faseada** em vez de só fix manual endpoint-por-endpoint.

**Origem:** auditorias Onda A (Dynamic Workflow, 25 sub-agentes, 31/05/2026) + Onda B (45 sub-agentes) + análise architect read-only. Relatórios:
- `docs/relatorios/2026-05-30-auditoria-idor-onda-a.md` (19 IDORs em 20 módulos secundários)
- `docs/relatorios/2026-05-30-auditoria-idor-onda-b.md` (31 IDORs em whatsapp/notificacoes/asaas/bancário/infra)
- `docs/arquitetura/blindagem-multi-tenant-sistemica.md` (decisão híbrida 5 fases)

**Mapa do terreno:**
- Prisma 6.16.2 (suporta Client Extensions `$extends`); zero extensions hoje.
- Schema ~95 models: ~52 com `cooperativaId` direto · ~18 tenant-via-relação · ~25 globais.
- Auth: 4 guards globais — nenhum faz isolamento de tenant. SUPER_ADMIN = `cooperativaId null` (bypass intencional).

**Fatiamento:**

| Fase | Escopo | Estimativa | Status |
|---|---|---|---|
| F0 | Fix manual 26 IDORs críticos (19 Onda A + 7 CRÍTICOS Onda B) — padrão BQ.1-BQ.4 | 2-3h | ✅ **IMPLEMENTADO 31/05/2026** |
| F1.1 | Infra Guard sistêmico — `@TenantResource` decorator + `TenantOwnershipGuard` + `buildNestedWhere` helper + APP_GUARD wiring | 4-6h | ✅ **IMPLEMENTADO 31/05/2026** (commit `4d933c4`) |
| F1.2 | Anotar 15 endpoints cobríveis (13 cat 1 + 2 cat 2 com fix service) | 3-5h | ✅ **IMPLEMENTADO 31/05/2026** (commit `0c81afd`) |
| F1.3 | Camada 3 defensiva — AsyncLocalStorage + `@AsPlatform()` decorator + Prisma Extension log-only `tenantLeakDetector` + wirar em 45 métodos de cron/listener | 4-5h | ✅ **IMPLEMENTADO 31/05/2026** (commit `7fa60b3`) |
| F1.4 | Lint anti-reincidência baseline+ratchet — `npm run lint:tenant` + allowlist 256 legados | 1-2h | ✅ **IMPLEMENTADO 31/05/2026** (commit `1b1971f`) |
| F1.5 | 9 residuais cat 3 + EmailLog schema cooperativaId + M8 fallback ENV removido | 3-4h | ✅ **IMPLEMENTADO 31/05/2026** (esta sessão) |
| F2 (futuro) | Prisma Client Extension de INJEÇÃO automática nos ~52 models | 2-3 dias | 📋 **OPCIONAL** — Guard+lint+log já cobrem detecção pre-merge + runtime. Reavaliar SE volume de novos endpoints justificar |
| F4 (futuro) | Teste de regressão multi-tenant cross-tenant abrangente E2E | 1-2 dias | 📋 Catalogado |

**Armadilhas catalogadas (doc arquitetura §D):**
1. Crons + webhooks rodam SEM request HTTP — Extension cega quebraria silenciosamente. `runAsPlatform()` é pré-requisito, não opcional.
2. Não migrar os 18+26 já corrigidos manualmente pra confiar na Extension — defesa em profundidade.
3. Body-injection (~8 casos) nenhuma camada de query resolve — fix no controller/DTO obrigatório.
4. Performance — Extension roda em TODA query; bug aqui afeta o sistema inteiro.

**F0 implementação (31/05/2026):**

5 sub-fatias atômicas, 26 IDORs corrigidos no padrão D-novo-BQ (posse via findFirst + SUPER_ADMIN bypass):

- **F0.1 administradoras (CA1+CA2+AA1) + modelos-cobranca (AA9+AA10+AA11)** — administradoras: posse no update/remove, body-injection no create bloqueado (helper resolverTenant). modelos-cobranca: modelo GLOBAL (cooperativaId=null) só pode ser alterado por SUPER_ADMIN (impacto sistêmico — modelo usado por todos os tenants).
- **F0.2 documentos (AA2+AA3+AA4+MA1)** — posse via cooperado.cooperativaId (helper carregarComPosse). Aprovar/reprovar/delete não dispara WhatsApp pro cooperado alheio. uploadAdmin verifica cooperado pertence ao tenant antes do upload.
- **F0.3 ocorrencias (AA5+AA6+MA2) + prestadores (AA7+AA8+MA3)** — posse padrão. DTOs sanitizados (cooperativaId REMOVIDO de CreatePrestadorDto/UpdatePrestadorDto). MA2 ocorrencias.create valida cooperadoId pertence ao tenant.
- **F0.4 condominios (MA4+BA1) + observador (AA12)** — body-injection bloqueado em condominios.create. calcularRateio filtrado por tenant (não vaza nomes/cotas cross-tenant). observador.encerrar valida posse. lead-expansao @Public OUT-OF-SCOPE (sem JWT — exige guard diferente, anotado pra futuro).
- **F0.5 críticos Onda B (7)** — notificacoes.marcarComoLida com posse via buildWhere existente (no-op silencioso pra evitar leak de existência). asaas.cancelarCobranca posse via cooperado.cooperativaId + SA descobre tenant da cobrança pra getApiClient. integracao-bancaria 3 fixes: cancelarCobranca posse antes da API banco (boleto BB/Sicoob irreversível), criarConfig body-injection bloqueado, atualizarConfig posse. whatsapp 2 fixes: DELETE modelos com regra global SA-only + tenant-scoped só dono; POST disparar-cobrancas bloqueia parceiroId ≠ JWT pra ADMIN.

**Padrão consolidado expandido (4 categorias):**
1. **Posse direta** (`findFirst({where: {id, cooperativaId}})` + null bypass): F0.1 admins, F0.3 ocorrencias/prestadores, F0.5 integracao-bancaria.
2. **Posse via relação** (`findFirst({where: {id, <rel>: {cooperativaId}}})`): F0.2 documentos (cooperado), F0.5 asaas (cooperado).
3. **Body-injection → JWT** (helper resolverTenant, ADMIN sempre JWT, SA pode body): F0.1 administradoras.create, F0.4 condominios.create, F0.5 integracao-bancaria.criarConfig.
4. **Global-only-SA** (cooperativaId null = recurso compartilhado, só SUPER_ADMIN pode alterar): F0.1 modelos-cobranca.ativar/desativar, F0.5 whatsapp DELETE modelos.

**Specs F0:** 11 arquivos `*-idor-br.spec.ts` com 55 cenários verdes (14+6+10+6+19 = 55). Backwards-compat 100% preservada.

**Smoke runtime F0:** `scripts/smoke-br-f0-idor.ts` — 23/23 cenários cross-tenant validados contra Postgres real. Asserções: administradora B intacta após ataque; cobrança bancária B continua PENDENTE; modelo whatsapp B/global NÃO deletados por ADMIN; notificação B NÃO marcada como lida cross-tenant; config bancária B clientId NÃO substituído.

**Total IDOR specs sistema após F0:** 111 verdes (56 D-novo-BQ + 55 D-novo-BR F0).

**Carry-over F0 (TODOS RESOLVIDOS EM F1.2 + F1.5):**
- lead-expansao POST `@Public` — requer guard diferente (rate-limit), defer
- EmailLog schema sem `cooperativaId` — ✅ **RESOLVIDO F1.5** (schema add + populate + filtro)
- 24 IDORs ALTO+MÉDIO Onda B — ✅ **TODOS RESOLVIDOS EM F1.2 (15) + F1.5 (9)**

**F1.5 implementação (31/05/2026) — 9 residuais cat 3 + EmailLog + M8:**

| ID | Fix |
|---|---|
| A10 | `integracao-bancaria.listarConfigs(cooperativaId?)` — filtro por tenant (já F0.5, re-validado) |
| A11 | `integracao-bancaria.emitirCobranca({...cooperativaId})` — config + cooperado por tenant |
| A12 | `/whatsapp/historico` — `where.cooperativaId` quando perfil ≠ SA |
| A13 | `/whatsapp/historico/:telefone` — valida telefone pertence a cooperado do tenant |
| A14 | `/whatsapp/disparar-convites-indicacao` — body.parceiroId ≠ JWT exige SA |
| A15 | `/whatsapp/cooperados-para-disparo` — query.parceiroId só vale pra SA |
| A16 | `monitoramento-usinas.getStatusAtual(cooperativaId?)` — filtra via `usina:{cooperativaId}` |
| M7 | `EmailLog` schema add `cooperativaId String?` + `@@index([cooperativaId,criadoEm])`. Migration aplicada via ritual PM2. `registrarLog` popula. `buscarLogs` filtra. Removido da whitelist `MODELS_GLOBAIS`. |
| M8 | `email-monitor` — fallback ENV REMOVIDO; throw se credenciais do tenant ausentes. Controller bloqueia cooperativaId undefined. |

**Specs F1.5:** `email-idor-f15.spec.ts` (3 verdes): ADMIN A filtra coop-A; ADMIN B não vê A; SA vê tudo.

**Smoke F1.5:** `scripts/smoke-f15-residuais.ts` — 9/9 cross-tenant validados em runtime.

**PLACAR FINAL D-novo-BR (31/05/2026):**
- **68/68 IDORs corrigidos** (18 BQ + 26 F0 + 15 F1.2 + 9 F1.5)
- **Defesa em profundidade ativa:**
  - **Camada 1** — fix manual ponto-a-ponto (D-48 + Fase2A-E + BQ + F0 + F1.2 + F1.5)
  - **Camada 2** — `TenantOwnershipGuard` opt-in via `@TenantResource` (F1.1)
  - **Camada 3** — `tenantLeakExtension` log-only Prisma Extension (F1.3)
  - **Camada 4** — Lint baseline+ratchet `npm run lint:tenant` (F1.4) — bloqueia 69º vulnerável em pre-merge

**Total specs IDOR+Guard sistema:** 164 verdes (135 D-novo-BQ+BR F0 + 24 Guard F1.1 + 7 ALS F1.3 + 19 LeakDetector F1.3 + 3 EmailLog F1.5)
**Total smokes cross-tenant runtime:** 6 programáticos — 91 cenários validados

**Recomendação arquitetural (doc arquitetura §C):** Não esperar F1+F2+F3 (~7 dias) com críticos sangrando. F0 resolveu o sangramento em 1 sessão. Próximas fases previnem reincidência via Extension (~52 models cobertos automaticamente; endpoint novo nasce protegido) + escape hatch pra crons/webhooks.

**Refs:**
- Decisão arquitetural: `docs/arquitetura/blindagem-multi-tenant-sistemica.md`
- Relatório Onda A: `docs/relatorios/2026-05-30-auditoria-idor-onda-a.md`
- Relatório Onda B: `docs/relatorios/2026-05-30-auditoria-idor-onda-b.md`
- Padrão D-novo-BQ (BQ.1-BQ.4 fix manual): seção D-novo-BQ abaixo
- Doc-sessão F0: `docs/sessoes/2026-05-31-sprint-blindagem-multi-tenant-fase0.md`

---

### D-novo-BQ — Sprint Segurança IDOR (18 vulnerabilidades multi-tenant) (P0)

**Severidade:** P0 — bloqueador absoluto de onboarding Sinergia (2º parceiro). Com 1 tenant real hoje (CoopereBR) o risco não está materializado, mas isolamento multi-tenant é pré-requisito não-negociável pra produção plural.

**Origem:** auditoria Dynamic Workflow 30/05/2026 (Claude Code, Opus 4.8 — 28 subagentes, 1.437.072 tokens, 4 min). Relatório completo: `docs/relatorios/2026-05-30-auditoria-idor-workflow.md`.

**Padrão da falha:** controller não passa `req.user.cooperativaId` ao service, OU service faz `findUnique({ where: { id } })` sem `cooperativaId`. ADMIN/OPERADOR de tenant A modifica/apaga/lê recurso de tenant B passando o UUID.

**Padrão do fix:** verificação prévia de posse (`findFirst({ where: { id, cooperativaId } })` → NotFound se null) + `SUPER_ADMIN` bypass (`cooperativaId = null` ignora o guard). Mecânico e repetível — D-48 contratos `remove()` já tem esse padrão.

**Auditoria cobriu** 5 grupos núcleo (~13 módulos) — restam ~50 services não auditados. Ampliar auditoria antes de declarar IDOR-free.

**Distribuição:** 18 IDORs CONFIRMADOS = 7 CRÍTICOS + 8 ALTOS + 3 MÉDIOS.

**Fatiamento:**

| Fatia | Escopo | Status |
|---|---|---|
| BQ.1 | CRÍTICOS entidades núcleo — contratos.update (C1) + usinas.update/remove (C2/A3) + ucs.update/remove (C3/A4) + geracao-mensal.update/remove (C4/A5) | ✅ **IMPLEMENTADO 30/05/2026** (commit 9aca267) |
| BQ.2 | CRÍTICOS config-cobranca body-injection (C5/C6) + motor-proposta aprovar-presencial (C7) + cooper-token financeiro (A6) | ✅ **IMPLEMENTADO 30/05/2026** (commit 7185db2) |
| BQ.3 | motor-proposta (A7 + A8) + faturas (A1) + cooperados (A2 + M1) | ✅ **IMPLEMENTADO 30/05/2026** (commit d17ac3f) |
| BQ.4 | indicacoes (M2 + M3) | ✅ **IMPLEMENTADO 30/05/2026** (commit d17ac3f) |
| BQ.5 → D-novo-BR | Auditoria ampliada (Onda A + Onda B = 50 IDORs adicionais) + decisão híbrida arquitetural | ✅ **AUDITORIA COMPLETA + F0 IMPLEMENTADO 31/05/2026** — restantes em D-novo-BR Fases F1-F4 |
| BQ.6 (Onda A 19) | Inclusos em D-novo-BR F0 (31/05/2026) | ✅ **IMPLEMENTADO** |
| BQ.7 (Onda B críticos 7) | Inclusos em D-novo-BR F0 (31/05/2026) | ✅ **IMPLEMENTADO** |
| BQ.8 (Onda B altos+médios 24) | Defer pra D-novo-BR F3 ou após F2 Extension | 📋 Catalogado |

**BQ.1 implementação (commit a definir):**
- `contratos.service.ts.update()` — verificação posse no início (espelha `remove()` D-48). Callers `solicitacoes-contrato.service.ts` JÁ passavam `cooperativaId ?? null`, sem mudança.
- `usinas.controller.ts` — `update`/`remove` passam `req.user?.cooperativaId ?? null`. `usinas.service.ts` — `update(id, data, cooperativaId?)` + `remove(id, cooperativaId?)` com posse via `findFirst({where:{id,cooperativaId}})`; null cai em `findUnique` (preserva specs antigos).
- `ucs.controller.ts` + `ucs.service.ts` — idem (Uc tem `cooperativaId` direto).
- `geracao-mensal.controller.ts` + `geracao-mensal.service.ts` — helper privado `assertPosseOuFindOne(id, cooperativaId)` faz `findFirst({where:{id, usina:{cooperativaId}}})` (GeracaoMensal não tem `cooperativaId` direto — join via usina).

**Specs BQ.1:** 4 arquivos `*-idor-bq1.spec.ts` (21 cenários — 3 contratos + 6 usinas + 6 ucs + 6 geracao): tenant B → NotFound, tenant A próprio → sucesso, SUPER_ADMIN null → bypass. Verdes.

**Smoke BQ.1:** `scripts/smoke-bq1-idor.ts` — 12/12 cross-tenant validados em runtime contra Postgres real.

**BQ.2 implementação (30/05/2026):**
- `configuracao-cobranca.controller.ts` — helper `resolverTenant(req, body)` substitui `body.cooperativaId ?? 'default'`. ADMIN ignora body (sempre JWT); SUPER_ADMIN pode usar body (cross-tenant intencional). `upsertUsina` adicionalmente verifica `usinaId` pertence ao tenant (Forbidden se não).
- `motor-proposta.controller.ts` — `aprovarPresencial` passa `req.user?.cooperativaId ?? null`. `motor-proposta.service.ts.aprovarPresencial(id, cooperativaId?)` faz `findFirst({ where: { id, cooperado: { cooperativaId } } })` (espelha `analisarDocumentos`).
- `cooper-token.controller.ts` — `confirmarCompra` passa `req.user?.cooperativaId ?? null`. `cooper-token.service.ts.confirmarCompraParceiro(compraId, cooperativaId?)` valida `compra.cooperativaId === cooperativaId` ANTES do `creditarSaldoParceiro` — ForbiddenException previne credit indevido + emit de evento contábil cross-tenant.

**Specs BQ.2:** 3 arquivos `*-idor-bq2.spec.ts` (17 cenários — 8 config-cobranca + 3 motor-proposta + 6 cooper-token). Spec A6 valida explicitamente que `creditarSaldoParceiro` NÃO é chamado em cross-tenant + `eventEmitter.emit` NÃO dispara. Verdes.

**Smoke BQ.2:** `scripts/smoke-bq2-idor.ts` — 12/12 cross-tenant validados. Asserção financeira: saldo de B 0→0 após ataque A; 0→1000 após SUPER_ADMIN legítimo.

**BQ.3 implementação (30/05/2026 — commit d17ac3f):**
- `faturas.service.ts.vincularFaturaManual(id, coopId, cooperativaId)` — `findFirst({id, cooperativaId})`; controller passa null pra SUPER_ADMIN bypass via findUnique.
- `cooperados.service.ts.registrarFaturaMensal(id, dto, cooperativaId?)` + controller passa `req.user?.cooperativaId ?? null`.
- `cooperados.service.ts.alocarUsina(id, usinaId, cooperativaId?)` — posse cooperado (vazava nome/UC/consumo cross-tenant).
- `motor-proposta.service.ts.enviarAprovacao(id, canal, destino, cooperativaId?)` — `findFirst({ id, cooperado: { cooperativaId } })`; previne sequestro de tokenAprovacao.
- `motor-proposta.controller.ts.uploadModelo` — body→JWT (padrão C5/C6): ADMIN sempre JWT, SUPER_ADMIN pode body.

**BQ.4 implementação (30/05/2026 — commit d17ac3f):**
- `indicacoes.service.ts.registrarIndicacao(idado, codigo, cooperativaIdJwt?)` — indicador + indicado filtrados por cooperativaIdJwt quando informado. Callers legacy (publico/bot) passam null. Defesa em profundidade: `BadRequest` se `indicador.cooperativaId !== indicado.cooperativaId` mesmo no path legacy.
- `indicacoes.service.ts.processarPrimeiraFaturaPaga(coopId, valor, cooperativaIdJwt?)` — `findMany` agora aplica `cooperativaId` quando JWT informado; OnEvent caller interno mantém null (legacy preservado).

**Specs BQ.3+BQ.4:** 5 arquivos (18 cenários) — `faturas-idor-bq3.spec.ts` (3) + `cooperados-idor-bq3.spec.ts` (4) + `motor-proposta-idor-bq3.spec.ts` (3) + `motor-proposta-controller-idor-bq3.spec.ts` (3) + `indicacoes-idor-bq4.spec.ts` (5). Verdes.

**Smoke BQ.3+BQ.4:** `scripts/smoke-bq3-bq4-idor.ts` — 11/11 cross-tenant validados. A1: cooperadoId/ucId da fatura B intactos; A7: tokenAprovacao da proposta B NÃO sequestrado; M3: indicação B continua PENDENTE.

**Total IDOR specs sprint:** 56 verdes (21 BQ.1 + 17 BQ.2 + 18 BQ.3+BQ.4).
**Total runtime cross-tenant validados:** 35 cenários em 3 smokes programáticos.

**Refs:**
- Relatório: `docs/relatorios/2026-05-30-auditoria-idor-workflow.md`
- Padrão D-48 (referência): `contratos.service.ts.remove()` + `verificarListaEspera()` (`usinas.service.ts`)
- Padrão BQ.2 C5/C6: `resolverTenant` helper (controller-level) — primeira ocorrência do padrão JWT-vs-body no projeto.

---

### D-novo-BP — Convergência portal `/parceiro` vs `/dashboard` (P3)

**Severidade:** P3 — sprint refator UX futuro, não-bloqueador.

**Origem:** investigação read-only AN.3.1 (30/05/2026). Smoke visual de AN.3 e decisões anteriores revelaram inconsistência arquitetural:

- `/parceiro/*` é **ativo** com layout próprio 234 linhas + **30 páginas** funcionais (Cobrança, Faturamento, Financeiro, Relatórios, etc).
- `useContexto.rotaPorContexto:87` roteia `admin_parceiro → /parceiro` pós-login.
- **Inconsistência crescente:** sidebar parceiro já encaminha entidades complexas pra `/dashboard/*`:
  - Item "Membros" (linha 53) → `/dashboard/cooperados` (decisão antiga).
  - Item "Usinas" (linha 54) → `/dashboard/usinas` (decisão AN.4 30/05).
- Toda evolução funcional rica das entidades (Usinas: F.5/F.6/F.7 + BH despesas + AN repasses) foi pra `/dashboard/*`. `/parceiro/usinas/page.tsx` era display-only sem detalhe (virou redirect em AN.4).

**Caminhos possíveis** (decisão Luciano):

1. **Convergência total** — deprecar `/parceiro/*` redirecionando todas as 30 páginas pra `/dashboard/*`. Trabalho grande mas resolve a confusão de uma vez.
2. **Convergência seletiva** — só entidades complexas (Usinas, Membros, Contratos, Planos) viram redirect; manter `/parceiro/financeiro/*`, `/parceiro/relatorios`, `/parceiro/configuracoes` no portal próprio. Pragmatismo: muitas dessas páginas têm UX específica do admin parceiro.
3. **Status quo + acelerar redirects pontuais** — quando uma entidade ganhar funcionalidade rica em `/dashboard/*`, trocar o item da sidebar parceiro pra apontar pra lá (modelo AN.4). Continua acumulando inconsistência mas sem trabalho concentrado.

**Recomendação preliminar:** (2) convergência seletiva. Entidades complexas vão sendo migradas via redirect quando justificável; `/parceiro/financeiro` e `/parceiro/configuracoes` continuam dedicados.

**Estimativa:** 20-30h sprint refator UX (futuro) se opção (1) total ou (2) seletiva; 0h se opção (3) status quo.

**Status:** 📋 Catalogado em 2026-05-30 (AN.3.1 investigação + AN.4 ação parcial). Não bloqueia roadmap atual.

---

### D-novo-PUX — Sprint Polimento UX (P1 — bloqueia onboarding parceiro real porque Luciano não programa e perde fluxo em telinhas)

**Origem:** QA Luciano 31/05/2026 pós-CT.6. Detectou que (a) Dialog modal quebra o fluxo natural — Luciano não consegue fluir comparando dados lado-a-lado, perde contexto sempre que abre janelinha; (b) várias telas estão SEM help inline (viola regra 19/05 — `regra_help_automatico_paginas_19_05.md`); (c) padrão UX vigente até hoje permitia Dialog Tipo C pra ações — a partir de 31/05 está **banido**.

**Padrão UX vigente (decisão 31/05):**

| Cenário | Padrão CORRETO | Padrão BANIDO |
|---|---|---|
| Criar/editar entidade | **Página própria** `/dashboard/X/[id]/editar` | Dialog / Sheet / Drawer |
| Ação contextual (fechar, estornar, aprovar, marcar pago, cancelar) | **Inline expansível** (linha expande revelando confirmação) | Dialog / Sheet / Drawer |
| Visualização auxiliar (ciclo, histórico, detalhes do item) | **Inline expansível** OU seção da página própria | Dialog |
| Edição célula relação (Membro×Usina) | **Inline célula** (hover lápis, Enter/blur salva) | OK manter |

Documentação completa: `docs/arquitetura/padrao-ux-vigente.md`.

**6 fatias do Sprint Polimento UX:**

#### PUX.1 — Componentes reutilizáveis (`<HelpBox>` + `<AcaoInlineExpansivel>`)

Criar 2 componentes em `web/components/ui/`:

- **`<HelpBox>`** — banner help padronizado (azul claro com ícone + título + lista de bullets + dica). Substitui as N implementações ad-hoc espalhadas pelas telas. Props: `titulo`, `passos: string[]`, `dicaOpcional?: string`, `variante?: 'info'|'warning'`. Compõe TUDO que a regra 19/05 pede.
- **`<AcaoInlineExpansivel>`** — botão que, ao clicar, expande a linha (ou cell) revelando o conteúdo do form/confirmação INLINE. Sem overlay. Click fora colapsa. Loading state interno. Substitui Dialog Tipo C. Props: `titulo`, `textoBotao`, `cor` (variant), `children`, `onConfirm`, `onCancel`.

**Estimativa:** 4-6h Code (TDD com Playwright + specs unit).

#### PUX.2 — Banir telinhas (refator CT.6 Convenios + DialogEstornar)

Refatorar imediatamente as 4 telas CT.6 que usam Dialog Tipo C:

- `dashboard/contabilidade/convenios/page.tsx`: Dialog "Novo convênio" + "Remover" → página própria `/convenios/novo` + `/convenios/[id]/editar` + AcaoInlineExpansivel "Remover"
- `dashboard/contabilidade/apuracao/page.tsx`: Dialog "Fechar Apuração" → AcaoInlineExpansivel
- `components/repasses/DialogEstornar.tsx` → AcaoInlineExpansivel (fica como `web/components/repasses/EstornoInline.tsx`)
- `components/repasses/DialogCiclo.tsx` → expansão inline da linha do repasse PAGO (mostra ciclo abaixo)

**Estimativa:** 6-8h Code.

#### PUX.3 — Help inline em TODAS as telas (premissa 19/05 violada)

Auditoria + aplicação de `<HelpBox>` em:

- `dashboard/contabilidade/plano-contas` (sem help)
- `dashboard/contabilidade/convenios` (tem mas não-padronizado)
- `dashboard/repasses` + `dashboard/usinas/[id]/repasses` (sem help)
- `dashboard/financeiro/contas-pagar` (verificar)
- `dashboard/financeiro/despesas` (verificar)
- Demais telas catalogadas em PUX.6

**Estimativa:** 3-5h Code.

#### PUX.4 — Estorno do ciclo de repasse + visibilidade (refator frontend pra inline)

**Backend já pronto** (commit `93f38da`) — `PUT /repasses/:id/estornar` + `GET /repasses/:id/ciclo` + gate apuração FECHADA + transação atômica + specs verdes.

**Pendente:** refator frontend `DialogEstornar` + `DialogCiclo` → `AcaoInlineExpansivel` (PUX.1) + expansão da linha mostrando o ciclo. Quando dispara estorno, mostra resultado inline em vez de fechar modal.

**Estimativa:** 3-4h Code (usa PUX.1 já pronto).

#### PUX.5 — Refator telas existentes (Dialog/drawer legados)

Inventário inicial das telas com Dialog/drawer que precisam virar inline (auditoria PUX.6 vai catalogar resto):

- `components/repasses/DialogMarcarPago.tsx` → AcaoInlineExpansivel
- `components/repasses/DialogCancelar.tsx` → AcaoInlineExpansivel
- Telas de despesas (aprovar/rejeitar/resolver) — atualmente Dialog Tipo C
- Demais telas com Dialog catalogadas via PUX.6 lint

**Estimativa:** 6-10h Code (depende do inventário PUX.6).

#### PUX.6 — Lint UX (análogo ao `lint:tenant`)

Criar `scripts/lint-ux.ts`:

- Auditoria de cobertura: quais telas têm `<HelpBox>` (ou padrão equivalente), quais usam `Dialog`/`Sheet`/`Drawer`
- Baseline+ratchet: telas legadas vão pra allowlist; código novo é proibido de usar Dialog (falha CI)
- Helper: `npm run lint:ux` (mesmo modelo do `lint:tenant`)
- Relatório: gerar `docs/relatorios/ux-coverage-DATA.md` com %

**Estimativa:** 3-4h Code.

**Total Sprint Polimento UX:** ~25-37h Code (~3-5 sessões).

**Status:** 📋 Catalogado em 2026-05-31 noite. **Próximo Code arranca por PUX.1.**

---

### D-novo-CT-MULTI-REGIME-CLASSIFICACAO — Plano de Contas + naturezas próprias pra CONSORCIO/ASSOCIACAO/CONDOMINIO (P1, parte multi-regime)

**Origem:** CT.8 (01/06/2026). Ao construir classificação inline do Plano de Contas Segregado, ficou claro que a estrutura atual (`naturezaCooperativa` enum + `Convenio` Art. 88) é **exclusiva de COOPERATIVA**. Os outros 3 tipos de parceiro (CONSORCIO/ASSOCIACAO/CONDOMINIO) têm regime próprio e precisam de classificação própria — não basta deixar a coluna "não se aplica".

**Estado atual:**
- ✅ CT.8 enforça P0-1 no backend: parceiro não-cooperativa não consegue atribuir `naturezaCooperativa` → BadRequest com mensagem clara
- ✅ Frontend adapta visualmente via `useTipoParceiro()`: coluna "Natureza Cooperativa" desaparece pra não-coop + aviso amber explicando
- ❌ Não existem enums/colunas pra natureza própria de CONSÓRCIO (proporcional por consorciada — Lei 6.404/76 + Lei 14.300/2022)
- ❌ Não existem pra ASSOCIAÇÃO (sem fins lucrativos — CC Arts. 53-61 + Lei 9.532/97)
- ❌ Não existem pra CONDOMÍNIO (CC Arts. 1.314-1.358-A + Lei 14.300/2022)

**Escopo da fatia futura:**
- Schema: adicionar enums por regime (`NaturezaConsorcio`, `NaturezaAssociacao`, `NaturezaCondominio`) OU unificar em `NaturezaPorRegime { campo: string; valor: string }`
- Service `classificar`: validar combinação tipoParceiro × natureza permitida
- Frontend `useTipoParceiro` decide quais colunas renderizar
- Regime stub `CONSORCIO/ASSOCIACAO/CONDOMINIO.regime.stub.ts` (CT.2) ganha implementação real
- Apuração/DRE adaptadas (motor por regime — Luciano + orquestrador validam cada um)

**Base regulatória:** `docs/relatorios/2026-05-31-conformidade-contabil-multi-regime.md` (53 KB, 4 regimes parecer subagent cooperebr-analista-conformidade).

**Estimativa:** 30-50h Code dividido por regime (fatias separadas — só ativa quando 1º parceiro de cada tipo entrar). Luciano + orquestrador precisa validar separadamente.

**Bloqueia:** onboarding produção de Sinergia (consórcio anunciado) + qualquer outro parceiro não-COOPERATIVA.

**Status:** 📋 Catalogado em 2026-06-01 (CT.8). Não bloqueia CoopereBR (é COOPERATIVA). Aciona quando 2º parceiro real for não-coop.

---

### D-novo-CT-PLANO-GLOBAL-VS-TENANT — Plano de Contas: clonar globais → tenant no onboarding (P2 — decisão B aprovada 01/06; Sessão Luciano + orquestrador)

**Origem:** CT.8 Fase 1 read-only (01/06/2026). SQL revelou 32 contas: 28 com `cooperativaId=null` (globais — seed CT.1 da plataforma) e 4 tenant-scoped.

**Decisão Luciano 01/06/2026 noite — Opção B aprovada:**

> Cada parceiro tem o próprio plano (clone do template global no momento do onboarding). Admin + contador do parceiro classificam o próprio plano completo. As contas globais permanecem como **template imutável** da plataforma — só usadas no clone inicial.

**Por que B venceu (A/C descartadas):**
- A "manter globais compartilhadas" → se Luciano + orquestrador da CoopereBR classifica conta `2.4.01 Fundo de Reserva` como `FUNDOS_OBRIGATORIOS+PROPRIO`, vale igual pra todas — mas cooperativas com estatutos diferentes podem precisar de fundamentos legais distintos. Inviável de defender fiscalmente caso a caso.
- C "híbrido com override" → complexidade alta + UI confusa ("essa conta tá vindo do global ou do override?").
- B "clone por tenant" → cada cooperativa é dona do próprio plano. Customização total. Auditoria limpa (clone na criação registrada). Luciano + orquestrador classifica plano completo, não fica fragmentado entre globais+próprias.

**O que falta implementar:**
- Migration aditiva: bandeira `Cooperativa.planoClonado: Boolean @default(false)` (rastreia se já foi feito).
- Service `clonarPlanoContas(cooperativaId)`: copia as 28 globais (`cooperativaId=null`) criando réplicas tenant-scoped (mesma estrutura, sem classificação herdada — fica em branco pra Luciano + orquestrador classificar). Idempotente (skip se `planoClonado=true`).
- Hook no onboarding (criação de Cooperativa): chama `clonarPlanoContas` automaticamente.
- Backfill pras 4 cooperativas existentes (CoopereBR, CoopereBR Teste, TESTE-FASE-B5, BR F0 B): script `npx ts-node scripts/clonar-plano-contas-backfill.ts` (idempotente).
- Frontend `/dashboard/contabilidade/plano-contas`: passa a mostrar **só contas do tenant** (já filtra via `findAll(cooperativaId)` no service — mas SUPER_ADMIN hoje vê tudo; ajustar pra mostrar contas do tenant impersonado OU lista todas + indicador de qual cooperativa).
- Catalogar globais como "templates" (talvez tela separada `/dashboard/super-admin/templates-plano-contas` só pra SUPER_ADMIN ver/editar templates futuros).

**Amarrar com:** [D-novo-CT-MULTI-REGIME-CLASSIFICACAO](#d-novo-ct-multi-regime-classificacao--plano-de-contas--naturezas-pr%C3%B3prias-pra-consorcioassociacaocondominio-p1-parte-multi-regime) (P1) — **Sessão de Validação Fiscal Interna** vai cobrir os 2 simultaneamente: (a) clone do plano + classificação da CoopereBR (Luciano + orquestrador validam 32 contas reais, não 4) + (b) decisão sobre naturezas próprias pra CONSORCIO/ASSOC/CONDOMINIO quando aparecer 2º parceiro.

**Estimativa Code:** 4-6h (migration + service + hook + backfill + ajuste UI).

**Prioridade:** **P2** — não bloqueia onboarding técnico de 2º parceiro (sistema funciona), mas bloqueia operação fiscal completa (Luciano + orquestrador precisa classificar plano fragmentado hoje).

**Status:** 📋 Catalogado 2026-06-01 (CT.8). Decisão B aprovada 01/06 noite. Implementação na **Sessão Contabilidade Luciano + orquestrador** (junto com CT-MULTI-REGIME-CLASSIFICACAO + validação alíquotas/presunção + flag isencao PIS/COFINS).

---

### D-FISCAL-1 — Classificação do convênio CT deve ser CONFIGURÁVEL (P1)

**Origem:** Sessão de Validação Fiscal Interna 01/06/2026 noite — caso médico real (empresa médica cooperada custeando energia dos médicos cooperados em usina CESSÃO).

**Estado atual (hoje em produção pós CT.9):**
- `criarLancamentoConvenio` em `contabilidade-tributaria.service.ts` **hardcoda** classificação AUXILIAR via regime cooperativo (`FonteConvenio → NaturezaCooperativa.AUXILIAR`)
- `Convenio.classificacaoFiscal` é apenas texto livre (descritivo, não enforcement)
- 1 convênio teste criado em produção com lançamento Auxiliar

**Decisão fiscal:** classificação **depende do critério econômico** — não do tipo de convênio:

> **"A cooperativa fica com sobra/resultado (mesmo se repassada ao dono da estrutura)?"**

| Critério | Resposta | Natureza | Quando aplica |
|---|---|---|---|
| Cooperativa retém resíduo (mesmo repassando ao dono) | **SIM** | **PRÓPRIO** (Art. 79) | Caso médico: empresa médica paga energia, cooperativa repassa sobra ao dono da usina cedente |
| Fluxo é trânsito puro entrada=saída soma zero | **NÃO** | **AUXILIAR** (Art. 88) | Convênio de custeio com 4 travas (abaixo) |

**4 travas pra qualificar como AUXILIAR (Art. 88) — TODAS obrigatórias:**
1. Todos os participantes são cooperados (ou cooperativa é única operadora financeira)
2. Fluxo entra = sai (soma zero — sem retenção/margem residual)
3. Convênio documentado formalmente (objeto + prazo + valores + partes)
4. Escrituração contábil segregada (lançamentos visíveis na DRE Auxiliar)

**Implementação proposta (fatia futura — pode entrar dentro de D-FISCAL-2 se consolidação acontecer):**
- Schema: `Convenio.naturezaAtoCooperativo: NaturezaCooperativa?` (ou no `ContratoConvenio` consolidado pós D-FISCAL-2)
- UI: select obrigatório com helper text explicando as 4 travas + critério econômico
- Backend: `criarLancamentoConvenio` passa a ler `convenio.naturezaAtoCooperativo` em vez de hardcodar AUXILIAR
- Migração: setar manualmente os convênios existentes (caso médico = PRÓPRIO; convênios de custeio futuro = AUXILIAR; admin escolhe)
- Validação cruzada: se admin marca AUXILIAR, verificar/avisar sobre as 4 travas

**Estimativa:** ~4-6h Code (schema delta + service + UI + UX do critério).

**Bloqueia:** caso médico em produção fiscal real — hoje gera lançamento Auxiliar quando deveria ser Próprio (com fluxo passando por Contas a Receber + Contas a Pagar).

**Status:** 📋 Catalogado 2026-06-01 noite. Implementar **dentro da fatia D-FISCAL-2** (consolidação do convênio único) se decisão fiscal interna confirmar abordagem unificada.

---

### D-FISCAL-2 — Consolidação do convênio único (ContratoConvenio + flag fiscal + geração contábil universal) (P1 — SPRINT — próxima sessão)

**Origem:** Sessão de Validação Fiscal Interna 01/06/2026 noite. Conclusão: ter 2 modelos paralelos de convênio é desnecessário e confunde.

**Estado atual:**
- **`ContratoConvenio`** (legado MLM) — `/dashboard/convenios`. Campos: faixas, membros, indicações em cascata, desconto, conveniado, cooperado, status. Foco em **captação+MLM** (Hangar Academia, AESMP, ASSEJUFES).
- **`Convenio`** (CT.2 — contabilidade tributária) — `/dashboard/contabilidade/convenios`. Campos: fluxoFinanceiro (enum), classificacaoFiscal (texto), tipoBeneficio (enum), vigência. Foco em **Art. 88** com motor `criarLancamentoConvenio` (CT.9).
- **Caso médico real** força a estrutura B (Design B do D-novo-CT-CONVENIO-HOOK já catalogado): hook em Cobranca/ContaAPagar com `convenioId` opcional → motor universal de lançamento contábil.

**Decisão (Luciano 01/06):** **consolidar num modelo único** mantendo o nome `ContratoConvenio` por compatibilidade. Aposentar `Convenio` CT.2 + UI `/dashboard/contabilidade/convenios`.

**Escopo da sprint (a refinar em Fase 1 read-only da próxima sessão):**

1. **Mapear `ContratoConvenio` completo** (todos os campos + relações: faixas, membros, indicações, desconto, conveniado, status)
2. **Diff com `Convenio` CT.2/CT.9** — o que falta no legado:
   - `fluxoFinanceiro` (enum FluxoConvenio)
   - `classificacaoFiscal` (texto livre — talvez deprecar em favor de `naturezaAtoCooperativo`)
   - `naturezaAtoCooperativo` (D-FISCAL-1)
   - `geraLancamentoContabil: Boolean` (todo convênio com essa flag aciona motor universal)
   - `lancamentos` back-relation
3. **Schema delta aditivo** — adicionar campos novos no `ContratoConvenio`, **manter** `Convenio` CT.2 temporariamente pra migração faseada
4. **Estender service** que cria `LancamentoCaixa` pra olhar a flag + classificação do `ContratoConvenio` (em vez do `Convenio` CT)
5. **UI:** incorporar campos fiscais (naturezaAtoCooperativo + fluxoFinanceiro + geraLancamentoContabil) ao formulário existente do `ContratoConvenio` + HelpBox explicando critério das 4 travas
6. **Migração:** 1 convênio CT existente → criar `ContratoConvenio` equivalente com flags
7. **Deprecar `/dashboard/contabilidade/convenios`** → redirect pra `/dashboard/convenios` (ou remoção total)
8. **Hook em Cobranca/ContaAPagar** com `convenioId` opcional disparando lançamento (Design B já catalogado em D-novo-CT-CONVENIO-HOOK resolvido)
9. **Atualizar `criarLancamentoConvenio`** pra ler flag + naturezaAtoCooperativo do ContratoConvenio consolidado
10. **Caso médico** funciona naturalmente: convênio com `naturezaAtoCooperativo=PROPRIO` + `geraLancamentoContabil=true` + hook na cobrança da empresa médica + hook no repasse ao dono → Contas a Receber + Contas a Pagar lançam corretamente

**Estimativa:** ~12-20h Code (sprint substancial — schema delta + service + UI + migração + deprecação + hook B).

**Bloqueia:** uso fiscal real do caso médico + estrutura defensável pra qualquer novo convênio que tenha critério "cooperativa retém sobra".

**Prioridade:** **P1** — próxima sessão Code arranca por **Fase 1 read-only**.

**Status:** 📋 Catalogado 2026-06-01 noite. Próximo Code arranca pela Fase 1.

---

### D-FISCAL-MLM — Classificação fiscal da comissão de captação MLM (Hangar Academia) (P2)

**Origem:** Sessão de Validação Fiscal Interna 01/06/2026 noite — correção ao relatório `docs/relatorios/2026-05-31-conformidade-contabil-multi-regime.md`.

**Erro no relatório de conformidade 2026-05-31:** o documento cita Hangar Academia como exemplo de Art. 88 (ato cooperativo auxiliar). **Está errado** — Hangar é cooperado PJ que opera programa de **captação+MLM** (indicações em cascata + comissões), não convênio de custeio com soma zero.

**Análise fiscal preliminar:**
- **NÃO é Art. 79** (próprio) — não cumpre objeto social cooperativo direto da cooperativa
- **NÃO é Art. 88** (auxiliar) — não é convênio de custeio, não é trânsito entra=sai
- **Provavelmente Art. 86** (não-cooperativo, tributado Lucro Presumido) — captação remunerada externa
- Mas há argumento contrário: "captação de cooperados é objeto social da cooperativa" → pode levantar Art. 79

**Correções pendentes:**
1. Atualizar `docs/relatorios/2026-05-31-conformidade-contabil-multi-regime.md` removendo Hangar do exemplo Art. 88 + adicionando nota "[corrigido 01/06]"
2. Decidir definitivamente na Sessão de Validação Fiscal Interna: Art. 86 ou Art. 79?
3. Implementação no `ContratoConvenio` pós-D-FISCAL-2: programas de captação/MLM (Hangar, AESMP) ganham `naturezaAtoCooperativo` específica (provavelmente NAO_COOPERATIVO)

**Estimativa:** correção do relatório = 30min; decisão fiscal = sessão dedicada; implementação contábil = vem grátis depois de D-FISCAL-2.

**Prioridade:** **P2** — não bloqueia operação atual (Hangar continua sendo MLM via ContratoConvenio, sem geração contábil específica). Bloqueia precisão fiscal quando D-FISCAL-2 entrar em produção.

**Status:** 📋 Catalogado 2026-06-01 noite. Thread separada do D-FISCAL-2.

---

### D-novo-CT-PDF-AUXILIAR — 3 PDFs de defesa fiscal ignoram o Ato Auxiliar (Art. 88) (P2 — decidir na Sessão de Validação Fiscal Interna)

**Origem:** CT.9.1 (01/06/2026 noite) — varredura read-only de `relatorios-ct.service.ts` após CT.9 entregar registro de movimentos de convênio. Convênio aparece na DRE em tela mas **some** nos PDFs.

**Estado atual:**
- `htmlDemonstrativoNaoLucratividade` — só usa `receitaPropria/despesaPropria` + `fundoReserva`/`sobrasDistribuiveis`. Não menciona Ato Auxiliar.
- `htmlMemorialCalculoFiscal` — só `receitaNaoCoop/despesaNaoCoop` + tributos. Não menciona Ato Auxiliar.
- `htmlDemonstrativoRepasses` — só repasses a proprietários (`Usina.formaAquisicao`). Convênios ficam fora.
- **Resultado:** se um cooperado/fiscal abrir os PDFs, vai ver Próprio + Não-Coop **mas não enxerga os convênios Art. 88** registrados como movimentos Auxiliar (CT.9).

**Decisão fiscal pendente (a tomar na Sessão de Validação Fiscal Interna):**
1. **Estrutura visual:** adicionar seção "Ato Cooperativo Auxiliar (Art. 88)" no Demonstrativo de Não-Lucratividade + linha no Memorial de Cálculo Fiscal? Bloco separado ou agregado às sobras?
2. **Impacto contábil:** o Auxiliar impacta FATES/Fundo Reserva? Hoje o motor CT.4 trata Auxiliar como trânsito neutro (entrada=saída, soma zero), mas se houver retenção/sobra residual de convênio, vira FATES (Art. 87)?
3. **Demonstrativo de Repasses:** deve ter aba/seção pra repasses de convênio (mesmo padrão do repasse a proprietário, mas regido por Art. 88)?
4. **PDF defensável:** o que a auditoria fiscal espera ver de "Ato Auxiliar"? Texto livre tipo "Trânsito de Convênios Art. 88 — entrada=saída, classificação fiscal AUXILIAR"?

**Implementação técnica (~6-10h Code) depende das decisões acima:**
- Estender `DadosRelatorio` com `receitaAuxiliar/despesaAuxiliar` + lista de convênios ativos
- Templates HTML: nova seção "Ato Cooperativo Auxiliar" com tabela + texto fundamentando classificação
- Atualizar fundo defensabilidade citando Art. 88

**Bloqueia:** uso fiscal real dos PDFs **se** auditoria perguntar sobre convênios (Walter / fiscal externo). Não bloqueia operação técnica — DRE em tela mostra Auxiliar corretamente.

**Prioridade:** **P2** — aguarda decisão fiscal interna (Sessão de Validação Fiscal Interna). Implementação trivial uma vez tomada a decisão.

**Status:** 📋 Catalogado 2026-06-01 noite (CT.9.1 GAP 4). Resolver junto com D-novo-CT-VALIDACAO-FISCAL P0 + D-novo-CT-MULTI-REGIME-CLASSIFICACAO P1 + D-novo-CT-PLANO-GLOBAL-VS-TENANT P2.

---

### D-novo-CT-CONVENIO-HOOK — ✅ RESOLVIDO (Design A — CT.9, 01/06/2026 noite)

**Resolução:** Sprint CT.9 — endpoint manual `POST /contabilidade-tributaria/convenios/:id/movimentos` (botão "Registrar movimento" no Dialog Tipo C da página de edição do convênio). Admin lança valor + data + descrição; backend deriva sentido (RECEITA/DESPESA) do `Convenio.fluxoFinanceiro`, classifica como AUXILIAR via regime cooperativo CT.2 (com ENFORCEMENT P0-1 — só COOPERATIVA, citando D-novo-CT-MULTI-REGIME-CLASSIFICACAO se outro regime), grava `LancamentoCaixa{origemTipo=CONVENIO, convenioContabilId, naturezaAto=AUXILIAR}`. Gate apuração FECHADA bloqueia retroativo (CT.4 reusado). Síncrono — erro sobe pra UI (não fire-and-forget).

**Schema delta (aditivo, db push idempotente):**
- `enum OrigemLancamento += CONVENIO`
- `LancamentoCaixa.convenioContabilId String?` + relation `convenioContabil Convenio? @relation("LancamentoConvenioContabil")` — distinta do legado `convenioId → ContratoConvenio` MLM
- `Convenio.lancamentos LancamentoCaixa[] @relation("LancamentoConvenioContabil")` back-relation

**Frontend:** seção "Movimentos (lançamentos Auxiliar)" em `/dashboard/contabilidade/convenios/[id]/editar` via `<MovimentosConvenioSection>` reusável + `<HelpBox>` (PUX-A) com texto neutro + tabela histórico + Dialog Tipo C "Registrar movimento" (regra esclarecida 01/06 — ação simples OK em Dialog).

**Designs B/C ficam como evolução futura** (catalogados, não implementados):
- **(B) Hook auto-dispara em Cobranca/ContaAPagar com `convenioId` opcional** — não prioritário; exigiria UI complexa pra escolher convênio na hora de baixar cobrança/conta. Útil só quando ≥10 convênios ativos por tenant.
- **(C) Cron mensal lê convênios ativos + gera lançamentos baseado em valores configurados** — útil quando houver convênios recorrentes (ex: aporte EDP mensal fixo). Hoje 0 convênios com esse perfil.

**Original (preservado pra contexto pré-CT.9):**

**Origem:** PUX-A (01/06/2026 manhã). Ao criar páginas próprias `/convenios/novo` e `/[id]/editar` + HelpBox, ficou explícito (na documentação) que o **Convênio era apenas registro/documentação** — não disparava `LancamentoCaixa` automático.

**Estado atual:**
- ✅ Schema `Convenio` (CT.2) com `tipoBeneficio` + `fluxoFinanceiro` + `classificacaoFiscal` + vigência
- ✅ CRUD multi-tenant `/contabilidade-tributaria/convenios`
- ✅ UI completa (lista + página própria criar/editar + HelpBox)
- ❌ **Sem hook** análogo ao CT.3 que dispare `LancamentoCaixa{origemTipo='CONVENIO', origemId=<convenioId>, naturezaAto='AUXILIAR'}` quando há ingresso/repasse/custo real do convênio.

**Mesmo padrão CT.3 a aplicar:**
- `enum OrigemLancamento { COBRANCA CONTA_PAGAR REPASSE MANUAL CONVENIO }` — adicionar `CONVENIO`
- Service `ContabilidadeTributariaService.criarLancamentoConvenio(convenioId, valor, tipoMovimento, dataPagamento)` — análogo a `criarLancamentoRepasse`
- Idempotência via `@@unique([origemTipo, origemId])` + sub-key se múltiplos movimentos por convênio (ex: `origemId = '${convenioId}:${competencia}'`)
- Hook fire-and-forget — qualquer evento upstream (a definir: endpoint dedicado de "registrar movimento de convênio"? listener em Cobranca tagged como convênio?)

**Decisão de design pendente (perguntar Luciano antes de implementar):**
- (A) Endpoint dedicado `POST /convenios/:id/movimento` (admin lança manualmente)
- (B) Hook em Cobranca/ContaAPagar com `convenioId` opcional (auto-dispara quando vinculado)
- (C) Cron mensal lê convênios ativos + gera lançamento baseado em valores configurados

**Estimativa:** 3-4h Code (mesma estrutura do CT.3 com adaptação ao fluxo).

**Bloqueia:** não bloqueia produção (Luciano + orquestrador pode lançar manualmente como Auxiliar). Bloqueia automação completa de classificação Auxiliar nas DREs/Apuração quando houver movimento real de convênio.

**Prioridade:** **P2** — só ativa quando primeiro convênio real entrar em produção (hoje 0 convênios cadastrados).

**Status:** 📋 Catalogado em 2026-06-01 (PUX-A). Decidir A/B/C com Luciano antes de orçar fatia.

---

### D-novo-BR-CT-ESTORNO — Estorno de Cobrança/ContaAPagar (mesmo padrão de RepasseProprietario, fatia futura, P2)

**Origem:** Sprint Estorno RepasseProprietario (31/05/2026 noite). Luciano identificou no smoke pós-CT.6 que repasse PAGO não tinha como ser revertido. Fatia resolveu pra repasse — Cobranca e ContaAPagar têm o **mesmo gap**.

**Estado atual:**
- ✅ `RepasseProprietario` tem `PUT /repasses/:id/estornar` (status PAGO→PENDENTE + deleta `LancamentoCaixa` + desvincula despesas + gate apuração FECHADA + AuditLog)
- ✅ `RepasseProprietario` tem `GET /repasses/:id/ciclo` (visibilidade do lançamento + despesas abatidas)
- ❌ `Cobranca` (status PAGA): sem endpoint de estorno. Hook CT.3 criou `LancamentoCaixa origemTipo=COBRANCA` mas não há como deletar atomicamente revertendo Asaas/baixa manual.
- ❌ `ContaAPagar` (status=PAGO): sem endpoint de estorno. Hook CT.3 criou `LancamentoCaixa origemTipo=CONTA_PAGAR` mas não há como reverter.

**Mesmo padrão a aplicar:**
- Schema: `+estornadoEm +estornadoPorUsuarioId +motivoEstorno` em `Cobranca` e `ContaAPagar`
- Service: `estornar(id, motivo, usuarioId, coopId, perfil)` + transação atômica revertendo status + deletando `LancamentoCaixa` por `origemTipo/origemId` + gate apuração FECHADA (`ApuracaoMensalSegregada.status === 'FECHADA'` no mês de pagamento → bloqueia)
- Endpoint: `PUT /cobrancas/:id/estornar` + `PUT /contas-pagar/:id/estornar` (ADMIN/SA + @TenantResource + @AuditLog + body motivo ≥10 chars)
- UI: botão "Estornar" + DialogTipo C em /dashboard/cobrancas + /dashboard/financeiro/contas-pagar
- Visibilidade ciclo: `GET /cobrancas/:id/ciclo` + `GET /contas-pagar/:id/ciclo` retornando `{ recurso, lancamentoGerado, despesasAbatidas[] }` (no caso de ContaAPagar não há despesas abatidas; só lançamento)

**Estimativa:** 4-6h Code (mesma estrutura do estorno repasse — copy-paste com adaptação). Specs alinhados.

**Bloqueia:** não bloqueia produção (cancelamento Asaas já existe); só fecha o gap operacional de "errou na baixa".

**Prioridade:** **P2** — não bloqueia, mas necessário pra Luciano + orquestrador validamr contabilidade (poder corrigir erros operacionais sem ter que mexer no banco direto).

**Status:** 📋 Catalogado em 2026-05-31 noite (smoke pós-CT.6 Luciano).

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
