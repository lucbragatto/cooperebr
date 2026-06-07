# M25 — Sprint Bloco 2 (Empresa vê kWh dos funcionários) + Correção modelo kWh + Sprint Convite-Lote — 07/06/2026

## TL;DR

Sessão maratona Code (11 commits do dia) que entregou DOIS sprints completos + uma correção arquitetural crítica. **Bloco 2 do Sprint Onboarding Membro** (Fatias 2.1→2.4): empresa pagadora agora vê o consumo dos funcionários no portal, com fonte única real preservada (previewKwhConsolidado é o MESMO caminho que gerarCobrancaConsolidada usa). **Correção modelo kWh** (2 commits — `5f66ab3` + complemento `e427230`): o modelo conceitual estava errado — ALOCACAO_FIXA dividia os 200k do pacote entre os membros; o correto é SOMAR as cotas individuais (1200 kWh com 3 membros 300/400/500), com `kwhAlocadoMensal` virando "crédito disponível" (referência). Tela 2.4 reorganizada em 3 colunas: Disponível × Total atual × Valor a pagar. **Sprint Convite-Lote completo (LOTE.1→5)**: backend preview com 5 estados + envio em fila assíncrono com throttle 2s anti-spam + status polling + tela "Convidar em lote" no portal + modo B "Abrir no WhatsApp" manual com helper reusável pro MLM futuro. Schema delta aditivo em 2 lugares (`loteId` + `cooperadoIndicadorId`). Achado operacional crítico: tela kWh estava substituindo tabela por mensagem quando total=0 — Luciano não conseguia ver os funcionários. Fix `dac1907` garantiu tabela SEMPRE quando há membros (mensagem virou banner). Seed demo aplicou cotas 300/400/500 nos 3 membros da Clínica Teste — tela agora mostra "Total 1.200 kWh / R$ 1.200,00". 310/310 specs convenios verdes ao final.

## Marco entregue

**M25 — Bloco 2 Sprint Onboarding (Empresa vê kWh) + Correção Modelo kWh + Sprint Convite-Lote completo**

## Commits do dia (11 trabalho + 1 fechamento)

| Hash | Mensagem |
|---|---|
| `6664aed` | feat(custeio-convenio): Fatia 2.1 — helper read-only previewKwhConsolidado (Bloco 2 Sprint Onboarding) |
| `70bf820` | feat(custeio-convenio): Fatia 2.2 — helper puro ratearProporcionalCusteio (Bloco 2) |
| `4a8dec3` | feat(portal-empresa): Fatia 2.3 — endpoint GET /portal/meus-convenios/:id/kwh-consumo (Bloco 2) |
| `f74c3d6` | feat(portal-empresa): Fatia 2.4 — tela consumo dos funcionários no portal (Bloco 2 COMPLETO) |
| `5f66ab3` | fix(convenio-kwh): total = soma das cotas dos membros (não rateio do pacote) |
| `0756dcb` | feat(convite-lote): LOTE.1 — backend parser CSV + validação + PRÉVIA |
| `8de49e0` | feat(convite-lote): LOTE.2+3 — envio em fila com throttle + status |
| `e427230` | fix(convenio-kwh): complemento — valorAPagar no preview + tela 3 colunas correta |
| `635143e` | feat(convite-lote): LOTE.4 — tela Convidar em lote no portal + admin (Sprint COMPLETO) |
| `dac1907` | fix(portal-empresa): UI tela kWh — tabela SEMPRE renderiza quando há membros + seed demo |
| `8a957bd` | feat(convite-lote): LOTE.5 — modo B "Abrir no WhatsApp" + helper wa.me reusável |
| _(este)_  | docs(sessao): fechamento M25 |

## Entregas técnicas

### Bloco 2 — Empresa vê kWh dos funcionários (4 fatias)

**Backend — `previewKwhConsolidado` (Fatia 2.1):**
- Novo método público read-only em `ConveniosCusteioService`.
- FONTE ÚNICA DA VERDADE: `gerarCobrancaConsolidada` DELEGA pro preview (mesma fonte = preview e cobrança real nunca divergem).
- 5 estados não-throw: `OK` / `SEM_MEMBROS` / `SEM_UCS_CUSTEADAS` / `SEM_FATURAS_NO_MES` / `SEM_CONSUMO_CAPTURADO`.
- Anti-IDOR: filtro `where: { id, cooperativaId }` no findFirst — cross-tenant → 404.
- Entrada virtual `isPagador=true` quando a empresa COM_UC tem UCs custeadas.
- 12+ specs novos no `convenios-custeio.preview.spec.ts`.

**Backend — Helper rateio puro (Fatia 2.2):**
- `backend/src/convenios/lib/ratear-proporcional-custeio.ts` — função pura sem I/O.
- Paridade com `condominios.calcularRateio:PROPORCIONAL_CONSUMO` + INVARIANTE de fechamento de centavo (último item absorve resíduo).
- 15/15 specs unitários (6 deles cobrindo a INVARIANTE: 100/3, 999.99 entre 7 pesos, R$13.456,78, 200k×53 membros).
- **Aposentado do uso após o fix kWh** (preview soma cotas direto sem rateio).

**Backend — Endpoint portal-empresa (Fatia 2.3):**
- `GET /portal/meus-convenios/:id/kwh-consumo?mes=YYYY-MM` gated `@PagadorCooperadoOnly` + `@AuditLog`.
- Default `mes` = mês anterior corrente. Validação `mes <= corrente`.
- LGPD: UC retorna como `numeroMascarado` (`...054` — 3 últimos dígitos).
- 13 specs unitários (controller + helper mascaramento).
- Smoke E2E 4/4 verde incluindo cross-convênio → 404.

**Frontend — Tela 2.4 (`web/app/conveniada/convenio/[id]/page.tsx`):**
- Sub-componente `ConsumoFuncionariosCard` inline.
- Selector de mês (últimos 12, default mês anterior).
- Tabela: Funcionário · UC mascarada · kWh · % · Status badge.
- Badge "Sua empresa" em entrada virtual `isPagador`.
- Estados loading/erro/SEM_MEMBROS/SEM_UCS_CUSTEADAS/SEM_FATURAS_NO_MES.
- HelpBox azul com linguagem leiga (regra 19/05).

### Correção modelo kWh (2 commits — `5f66ab3` + `e427230`)

**Bug arquitetural descoberto:**
- ALOCACAO_FIXA com `kwhAlocadoMensal=200000` rateava entre N membros.
- Cobrança gerava R$ 200.000 sempre, **mesmo sem funcionários cadastrados**.
- Modelo conceitual errado.

**Modelo correto (Luciano 07/06):**
- Total = SOMA DINÂMICA das `cotaKwhMensal` (CONSUMO_REAL já era dinâmico; ALOCACAO_FIXA agora também).
- `kwhAlocadoMensal` vira "crédito disponível" (referência da assinatura) — pode ser excedido ou ficar abaixo.
- Valor a pagar = kwhTotal × tarifa do convênio (VALOR_FIXO ou PERCENTUAL_DESCONTO).
- Novo status `SEM_CONSUMO_CAPTURADO`: membros mas todas cotas=0 → cobrança skip.

**Refator preservando fonte única:**
- Helper privado `calcularValorEnergia({ convenio, kwhTotal, distribuidoraUsada })` encapsula a fórmula de tarifa.
- `gerarCobrancaConsolidada` chama o mesmo helper.
- `previewKwhConsolidado` virou wrapper sobre `previewKwhConsolidadoSemValor` + `enriquecerComValorAPagar`.
- Helper `ratearProporcionalCusteio` da Fatia 2.2 — **APOSENTADO** do fluxo (mantido no codebase como utilitário standalone, 15/15 specs vigentes; pode ser removido em housekeeping futuro P3).

**Tela 2.4 — 3 colunas corretas:**
- Disponível (assinatura) — referência cinza
- Total atual (soma) — laranja em destaque
- **Valor a pagar — verde emerald em destaque com `1200 kWh × R$ 1.00000/kWh`**
- Sobra/Excedente em linha separada com border-top (sinaliza sem bloquear)

**Fix UI crítico (`dac1907`):**
- Antes: quando total=0, a tela TROCAVA a tabela por uma mensagem. Luciano não via os funcionários.
- Depois: tabela SEMPRE renderiza quando `membros.length > 0`. Mensagem informativa vira banner azul ACIMA da tabela.
- Coluna `%` mostra "—" quando `kwhTotal=0` (proteção divisão).

**Seed demo (`backend/scripts/seed-clinica-teste-cotas.ts`):**
- 3 primeiros membros da Clínica Teste recebem cotas 300/400/500 kWh.
- Idempotente — pode rodar várias vezes.
- ANTES: Total 0 kWh / R$ 0,00. DEPOIS: **Total 1.200 kWh / R$ 1.200,00**.

**Smoke prova-real `smoke-fix-convenio-kwh.ts`** (14/14 verde):
- 3 membros 300/400/500 → kwhTotal=1200
- disponivelAssinatura=200000 (referência)
- excedente=undefined (1200 < 200000)
- `preview.valorAPagar === cobranca.valorLiquido` (FONTE ÚNICA do dinheiro confirmada)

### Sprint Convite-Lote completo (5 fatias)

**LOTE.1 — Backend preview (`0756dcb`):**
- Novo método `previewLote({ convenioId, cooperativaId, csv })` em `ConvitesConvenioService`.
- Parser flexível: separadores `,` / `;` / `\t`; cabeçalho `Nome,Telefone` ignorado.
- 5 estados por linha: `PRONTO` / `DUPLICATA_CSV` / `JA_MEMBRO` / `JA_CONVIDADO` / `INVALIDO`.
- Dedup interno (mesmo telefone no CSV) + externo (JA_MEMBRO via cooperado ativo, JA_CONVIDADO via convite vivo).
- Anti-IDOR (cross-tenant → 404). Convênio precisa ATIVO + pagador=EMPRESA.
- 16 specs Jest verdes.
- Endpoints `POST /convites/lote/preview` (admin + portal-empresa).

**LOTE.2+3 — Backend envio em fila + status (`8de49e0`):**
- Schema delta aditivo em `ConviteConvenioMembro`:
  - `loteId String?` — id opaco compartilhado.
  - `loteEnvioWaStatus String?` — PENDENTE | ENVIADO | FALHOU.
  - `loteEnvioWaErro String?` — motivo curto quando FALHOU.
  - `loteEnvioWaEm DateTime?` — timestamp última tentativa.
  - `@@index([loteId])`.
- `enviarLote` cria N convites síncronos no DB + dispara fila WA assíncrona via `setImmediate`. Caller recebe `{ loteId, total }` imediato.
- `processarFilaWa` com throttle in-process 2s entre envios (~30/min — anti-spam Meta).
- `statusLote` retorna agregado + lista com sufixo telefone (LGPD).
- 6 specs novos + smoke E2E 5/5 verde (resposta async em 1612ms + polling + LGPD + throttle 4214ms).

**LOTE.4 — Frontend Convidar em lote (`635143e`):**
- Novo componente `web/components/convenios/EnvioLoteSection.tsx` (reusado admin + portal-empresa via prop `source`).
- 4 steps state machine: `upload` → `previa` → `enviando` → `concluido`.
- Upload via textarea (colar) OU input file `.csv/.txt` (FileReader API).
- Prévia: 5 cards de resumo + tabela checkbox + toggle "Marcar todos PRONTO" + contador "X selecionados".
- Envio: progress bar laranja + breakdown "Na fila / Enviados / Falhas" + tabela com badge animado por destinatário.
- Concluído: botão "Fechar e atualizar lista".
- HelpBox azul leigo (regra 19/05).

**LOTE.5 — Modo B "Abrir no WhatsApp" + helper MLM (`8a957bd`):**
- Helper puro `backend/src/convenios/lib/wa-me-builder.ts`:
  - `buildWaMeConviteUrl({ telefoneDestinatario, nomeDestinatario, empresaNome, linkConvite, variante?, nomeIndicador? })`.
  - 2 variantes: `CONVENIO_EMPRESA` (default) e `INDICACAO_COOPERADO` (MLM individual futuro).
  - Normaliza telefone E.164 → wa.me; encodeURIComponent na mensagem.
  - 7/7 specs unitários.
- Schema delta `ConviteConvenioMembro.cooperadoIndicadorId String?` + `@@index` + relation `cooperadoIndicador`.
- Novo método `criarConviteComUrlWa({ ..., cooperadoIndicadorId?, variante?, nomeIndicador? })`.
- Endpoints `POST /convites/modo-b` (admin + portal-empresa). HTTP 201 com `{ id, urlWa, mensagem, ... }`.
- Frontend: coluna "Ação" na tabela de prévia + botão verde `MessageCircle` "Abrir no WhatsApp" por linha PRONTO → `window.open(urlWa, '_blank')`.
- HelpBox atualizado explicando os 2 modos.
- Smoke E2E 5/5 verde.

## Bugs resolvidos / catalogados

| # | Severidade | Causa raiz | Fix | Status |
|---|---|---|---|---|
| 1 | P0 fiscal/cobrança | ALOCACAO_FIXA cobrava 200k do pacote SEMPRE — independente de funcionários ou cotas. R$ 200.000 cobrança vazia caso Clínica Teste sem membros com cota | Modelo correto: kwhTotal = soma DINÂMICA das cotas; kwhAlocadoMensal vira referência | ✅ RESOLVIDO `5f66ab3` + `e427230` |
| 2 | P0 UX cega | Tela kWh substituía tabela por mensagem quando total=0 — Luciano não via funcionários cadastrados | Tabela SEMPRE quando `membros.length > 0`; mensagem vira banner | ✅ RESOLVIDO `dac1907` |
| 3 | P1 fonte única | Valor cobrado não era exposto no preview — UI tinha kWh mas precisava endpoint extra pro valor | Helper privado `calcularValorEnergia` compartilhado entre preview e cobrança real | ✅ RESOLVIDO `e427230` |

## Decisões estratégicas catalogadas

- **Modelo conceitual kWh (07/06)**: total = soma dinâmica das cotas; `kwhAlocadoMensal` é referência ("crédito disponível"), não o valor cobrado. Sinaliza excedente sem bloquear cobrança. **Fonte única real**: gerarCobrancaConsolidada delega pro previewKwhConsolidado — mesmo número garantido por construção.
- **Tela como espelho da fatura (07/06)**: `preview.valorAPagar === cobranca.valorLiquido` — sem surpresa pra empresa. Garantido pelo helper compartilhado `calcularValorEnergia`.
- **Tabela sempre presente quando há membros (07/06)**: UI nunca esconde a lista de funcionários cadastrados — estados de exceção (sem cota, sem fatura, etc) viram banners informativos acima/abaixo, não substituem a lista.
- **Convite em lote — 2 modos coexistentes (07/06)**: modo A automático (API Meta + throttle 2s) e modo B manual (wa.me + window.open). Empresa escolhe por destinatário. Helper de wa.me é puro e reusável.
- **Atribuição MLM no schema (07/06)**: `ConviteConvenioMembro.cooperadoIndicadorId String?` (nullable) — preparado pra member-to-member sem refator. Convite admin/empresa fica null.
- **Helper wa.me — 2 variantes**: CONVENIO_EMPRESA (lote atual) e INDICACAO_COOPERADO (MLM individual futuro do portal do membro). Mesma assinatura, mesmo encoding — diferem só na redação.

**Referência de memória existente:** `~/.claude/projects/C--Users-Luciano-cooperebr/memory/decisao_modelo_token_voucher_sobra_resgate_2026_06_04.md` cobre os 3 modelos token (Cooper Token desconto direto, Token voucher circuito fechado, Token + pagar concessionária via mandato). O Bloco "Pagar concessionária via mandato" é uma das duas opções da próxima sessão (concretiza esse modelo na prática).

## Próximo passo

**Escolher próximo bloco — duas opções:**
1. **Bloco 3 do Sprint Onboarding Membro** — cadastro fácil sem UC (membro pode entrar mesmo sem ter UC ativa; cooperativa gera UC depois). Continua o roadmap A→H do Sprint Onboarding.
2. **Módulo Pagar Concessionária (Mandato)** — concretiza o 3º modelo do circuito (cooperado dá mandato pra cooperativa pagar a concessionária direto; transparência total fiscal-tributária; ver memória `decisao_modelo_token_voucher_sobra_resgate_2026_06_04.md` § Mandato). Demanda maior dependência regulatória (parecer ANEEL/CC).

**Decisão pendente do Luciano** — qualquer das duas é arrancável Fase 1 read-only na próxima sessão.

## Pré-requisitos leitura próxima sessão (ordem fixa)

1. `docs/CONTROLE-EXECUCAO.md` (## ONDE PARAMOS topo + ## FRASE DE RETOMADA)
2. `~/.claude/projects/C--Users-Luciano-cooperebr/memory/MEMORY.md`
3. `~/.claude/projects/C--Users-Luciano-cooperebr/memory/decisao_modelo_token_voucher_sobra_resgate_2026_06_04.md` (3 modelos token/mandato — referência se Luciano escolher pagar-concessionária)
4. `docs/sessoes/2026-06-07-bloco-2-kwh-convite-lote.md` (esta — M25)
5. `docs/sessoes/2026-06-06-bloco-0-1-onboarding-membro.md` (M24 — anterior, Bloco 0+1)
6. `docs/especificacao-circuito-cooper-token-convenio.md` (Bloco 3 + Fatias C/D/E/G futuras)
7. Se escolher **Bloco 3**: `backend/src/cooperados/cooperados.service.ts` + `backend/src/ucs/ucs.service.ts` (cadastro SEM_UC atual via /publico/cadastro-sem-uc)
8. Se escolher **Pagar Concessionária**: `docs/especificacao-contabilidade-cooperativa-segregada.md` (PIS/COFINS isenção ato cooperativo) + memória do mandato
9. `CLAUDE.md` + `.claude/CLAUDE.md` (regras gerais + lição `next start`)
10. `git log --oneline -15`

## Carry-overs (não-bloqueantes)

- **⚠️ ACHADO REPETIDO (não-bloqueante mas precisa atenção):** 218 membros parciais detectados no tenant CoopereBR pelo DRY-RUN da sessão M24 (Hangar + Condomínio Moradas dominam). **NÃO** aplicar `--apply` em massa sem SEGMENTAÇÃO (oco genuíno × SEM_UC legítimo × lista de espera × cooperado sintético de teste). Catalogado como tarefa P2 separada. Estimativa: ~2-4h script de segmentação + dry-run categorizado.
- **Mensagem de convite nova precisa ser aplicada no Code** (sugerida pelo Luciano em outra conversa — depois desta sessão de fechamento).
- **Reprocessar fatura do LEONARDO PIZZOL VIGNA** (foi reconciliado na M24 com status=ATIVO + clube BRONZE + pendência "cota não capturada"; o seed M25 deu cota 500 demo, mas a fatura real do consumo dele ainda precisa ser reprocessada pra fechar o contrato 100%). P2 separada.
- **`.claude/agents/wa-bot-agent.md` modificado** (não-meu) — adições sobre Integração Stack Agentes (OpenClaw/Hermes + ECC + Obsidian). Provavelmente vem de outro tooling/IDE — Luciano avalia se commita junto com docs do agente ou descarta.
- **Helper `ratearProporcionalCusteio` (Fatia 2.2)**: órfão funcional (mantido no codebase, 15/15 specs vigentes; não usado pelo preview após fix kWh). Housekeeping futuro P3 — pode deletar `lib/ratear-proporcional-custeio.ts` + spec OU manter como utilitário standalone.
- **Carry-overs anteriores preservados**: 6 débitos M23 abertos (`D-novo-OTP-429-UX` P3 · `D-novo-OTP-DEV-RELAX` P3 · `D-novo-AUTO-INSCREVER-DEPRECATION` P3 · `D-novo-CAD-CONSUMO-MENSAL` P2 · `D-novo-CONVITE-MENUS-UX` P3 · `D-novo-TESTS-MOCK-PRISMA` P2) + 3 débitos M24 P3 (`D-novo-FATURA-SEGREGADA-ITENS` · `D-novo-CLUBE-LANCAMENTO-FISCAL` · `D-novo-CADWEB-FATURA-PROCESSADA`) + `D-novo-CT-VALIDACAO-FISCAL` P0 + `D-novo-CT-MULTI-REGIME-CLASSIFICACAO` P1 + `D-novo-BM` P0 BLOQUEADOR PRÉ-PROD + 256 legados allowlist `lint:tenant`.

## Regras aplicadas na sessão

- **Decisão 23 — Fase 1 read-only** aplicada antes de cada bloco grande (Bloco 2 mapeou convenios-custeio.service + condominios + portal-empresa + tela; correção kWh mapeou impactos arquiteturais + fonte única; LOTE.1-5 mapeou estado atual de criarConvite + enviarLinkPorWhatsapp + schema).
- **Padrão anti-spoof multi-tenant** — `cooperativaId` validado server-side em todos os endpoints novos (kwh-consumo, lote/preview, lote/enviar, modo-b). Cross-tenant → 404 (anti-enumeração).
- **FONTE ÚNICA da verdade** — preview e cobrança real chamam o MESMO `calcularValorEnergia` e o MESMO `previewKwhConsolidadoSemValor`. Garantido por construção, validado em smoke prova-real (`preview.valorAPagar === cobranca.valorLiquido`).
- **Atomicidade total via `$transaction Serializable`** — mantida em todos os caminhos críticos (Bloco 0+1 já preservava; nada mudou).
- **Degradação graciosa** — preview retorna estados não-OK sem throw (UI orienta); gerarCobrancaConsolidada traduz nos throws/returns esperados pelo cron/manual.
- **Math.round monetário obrigatório** — todos os valores `Math.round(x*100)/100` em 2 casas. INVARIANTE de centavo no helper `ratearProporcionalCusteio` (provada em 6 specs).
- **Smoke E2E programático versionado** — 14/14 smoke fix-convenio-kwh + 5/5 smoke LOTE.2 + 5/5 smoke LOTE.5 + smoke 1.4 mantido verde (regressão zero).
- **Regra commit SCOPED** — nenhum `git add .` ou `-A`; arquivos listados explicitamente. 11 commits SCOPED no dia.
- **Regra 18/05 `isAmbienteReal()`** — nenhum uso de `NODE_ENV` direto.
- **Regra 14/05 contatos teste** — smokes usam telefones whitelisted (`5511999988*` / `5511999955*`).
- **Regra HELP 19/05** — HelpBox azul leigo em cada bloco novo (consumo dos funcionários + convidar em lote).
- **Lição `next start` (04/06)** — `cd web ; npm run build ; pm2 restart cooperebr-frontend` em CADA mudança frontend (5x nesta sessão). HMR não rola.
- **Lição PM2 backend** — `pm2 stop ; npm run build ; pm2 restart` ritual em CADA schema delta. Aplicado 2x (LOTE.2 + LOTE.5).
- **Catalogação preventiva** — débitos catalogados imediatamente (helper rateio aposentado P3; reprocessar fatura LEONARDO P2; segmentar 218 P2; wa-bot-agent.md modificação não-minha).

## Frase comandante

Ver `docs/CONTROLE-EXECUCAO.md` seção `## FRASE DE RETOMADA — próxima sessão Code` (Decisão 24 — local único).
