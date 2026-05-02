# Investigação read-only — 6 áreas de produto — 02/05/2026 tarde

**Modo:** investigação read-only autorizada. Sem decisões de sprint. Sem código alterado.
**Aplica regra de validação prévia + retomada + ritual.**
**Princípio Luciano:** *"tudo o que escrevi tem que ser investigado antes de executar pra ver o que está pronto."*

---

## Quadro executivo — vereditos por área

| # | Área | Veredito | Síntese |
|---|---|---|---|
| 1 | Modelos COMPENSADOS + DINAMICO | 🔴 NÃO PRONTO | Congelamento triplo (Sprint 5) + bug D-30R bloqueia COMPENSADOS; DINAMICO sem implementação |
| 2 | CooperToken configurável | 🟡 PARCIAL | 4/5 flags em schema; **3 campos desvalorização ausentes** + curva fixa hard-coded 29 dias + **0 specs no módulo cooper-token/** |
| 3 | Modo Observador | 🟡 PARCIAL | Admin-spy WhatsApp/ações funcional 100%; role OBSERVADOR cooperado-leitura **não existe** |
| 4 | Convênios + ligação | 🟡 PARCIAL | Backend D-30P/Q resolveu vínculo; faltam **token específico** + **landing personalizada** |
| 5 | FaturaSaas + relatório | 🟡 PARCIAL | Cron + painel OK; **FaturaSaas→Asaas nunca emite** + sem dashboard parceiro + sem breakdown modular |
| 6 | Planos SaaS modulares | 🟡 PARCIAL | Schema/frontend já modulares; decorator `@RequireModulo` **não usado em controller real** |

**Saldo:** 0 áreas ✅, 5 áreas 🟡, 1 área 🔴, 0 áreas ⚠️.

---

## Área 1 — Modelos COMPENSADOS + DINAMICO 🔴

**Localização das engines:**
- FIXO_MENSAL — `backend/src/faturas/faturas.service.ts:1805-1837` ✅ operacional
- CREDITOS_COMPENSADOS — `faturas.service.ts:1840-1877` 🔴 bloqueado
- CREDITOS_DINAMICO — `faturas.service.ts:1880-1884` 🔴 lança `NotImplementedException`

**Congelamento Sprint 5 (commit `9174461`) — 3 camadas:**
- `motor-proposta.service.ts:549-556` — env `BLOQUEIO_MODELOS_NAO_FIXO=true` (default), `aceitar()` joga `BadRequestException` se plano não-FIXO
- `contratos.service.ts` + DTOs — validador `@IsModeloNaoBloqueado()` impede criação direta
- `planos.service.ts` — `/planos/ativos?publico=true` filtra só FIXO_MENSAL

**D-30R confirmado (causa raiz precisa):**
- Schema `schema.prisma:399` — `tarifaContratual Decimal? @db.Decimal(10, 5)` nullable
- `Motor.aceitar()` (`motor-proposta.service.ts:467-744`) **nunca popula** `tarifaContratual` "normal"; só popula `valorContrato` (FIXO) + variantes promocionais
- COMPENSADOS depende em `Number(contrato.tarifaContratual ?? 0)` (linha 1845) → fallback OCR (1847) → se ausente, `BadRequestException` (1852-1858)
- 100% dos 72 contratos com `tarifaContratual=null` (confirmado em sessão Fase 1)

**Cobranças no banco:** 0 com `modeloCobrancaUsado IN ('COMPENSADOS','DINAMICO')`. FIXO domina via fallback `resolverModeloCobranca()` (1895-1919).

**Specs Jest:**
- T3 Snapshots (`motor-proposta.service.aceitar.spec.ts:16-503`) — 5 cenários FIXO + bloqueio COMPENSADOS ✅
- T4 Promoção (mesmo arquivo, 254-502) — 8 snapshots promocionais ✅
- COMPENSADOS cálculo (`faturas.service.calcular.spec.ts:117-159`) — 3 testes ✅
- DINAMICO — **0 testes**

**Documentação dedicada (revisão posterior à investigação inicial):**
- `docs/especificacao-modelos-cobranca.md` ✅ 130 linhas — define os 3 modelos (FIXO, COMPENSADOS, DINAMICO) com fórmulas e personas
- `docs/FORMULAS-COBRANCA.md` ⚠️ **OBSOLETO** — movido pra `historico/` (CLAUDE.md ainda referencia como fonte de verdade — incoerência documental)
- `docs/PRODUTO.md` ✅ 709 linhas — visão produto: FIXO "único ativo em produção"; COMPENSADOS "bloqueado flag"; DINAMICO `NotImplementedException:1882`
- `docs/PLANO-ATE-PRODUCAO.md` ✅ 473 linhas — Sprint 2 traz DINAMICO + COMPENSADOS atômicos (bloqueado por Sprint 0); Sprint 5 implementa `RegrasFioB`, schema N:M `UcUsinaRateio`, Fio B ponderado
- `docs/REGULATORIO-ANEEL.md` ✅ 954 linhas — Fio B 2022-2029 documentado; classes GD definidas; **mas `Usina.classeGd` enum NÃO existe no schema** + `RegrasFioB` model **NÃO existe**
- `docs/debitos-tecnicos.md` linhas 314-362 — D-30R catalogado com fix 30-45 min
- Decisão 17: Sprint 15 + 21 descartadas (sem demanda)
- Doc-código ALINHADOS no geral; lacunas: ① `FORMULAS-COBRANCA.md` órfão na raiz, ② schema GD/Fio B documentado mas não codificado, ③ DINAMICO especificado mas não implementado

**Funcionalidade Planos comerciais (revisão posterior):**

Schema `Plano` (`schema.prisma:417-457`):
- `modeloCobranca: ModeloCobranca` (enum 3 valores)
- `descontoBase` (Decimal 5,2), `baseCalculo` (KWH_CHEIO/SEM_TRIBUTO/COM_ICMS/CUSTOM)
- `tipoDesconto` (APLICAR_SOBRE_BASE/ABATER_DA_CHEIA) — define se 20% vira 20% real ou ~14% real
- CooperToken integrado (tokenAtivo, tokenOpcaoCooperado, tokenValorTipo)
- Multi-tenant: `cooperativaId?` permite planos globais (null) OU por coop
- Relações: `contratos: Contrato[]`, `propostas: PropostaCooperado[]`

Cadeia override resolução modelo (`faturas.service.ts:1895-1919`):
1. `Contrato.modeloCobrancaOverride` (maior prioridade)
2. `Usina.modeloCobrancaOverride`
3. `ConfigTenant['modelo_cobranca_padrao']` (por cooperativaId)
4. `Plano.modeloCobranca`
5. `FIXO_MENSAL` (fallback)

Backend `backend/src/planos/planos.service.ts`:
- `create()` aceita os 3 modelos no DTO sem bloqueio local
- `findAtivos(publico=true)` filtra COMPENSADOS/DINAMICO se `BLOQUEIO_MODELOS_NAO_FIXO=true`
- **Seed `onModuleInit` cria "Plano Básico" `CREDITOS_COMPENSADOS`** ⚠️ — gera plano bloqueado ao subir o app (incoerente com bloqueio Sprint 5)
- `remove()` bloqueia se contrato ATIVO/PENDENTE_ATIVACAO vinculado

Bloqueio `BLOQUEIO_MODELOS_NAO_FIXO=true` (4 pontos enforcement):
- `planos.service.ts:58` — filtragem pública
- `contratos.service.ts:126-147` — valida create/update de contrato
- `motor-proposta.service.ts:548-549` — bloqueia `aceitar()` proposta
- `faturas.service.ts:574, 987` — bloqueia calcular cobrança

Frontend admin (`web/app/dashboard/planos/`):
- `novo/page.tsx:183-196` e `[id]/page.tsx:385-394` — `<select>` com options COMPENSADOS/DINAMICO `disabled` ("bloqueado — Sprint 5") — bloqueio só visual, DTO aceita
- `page.tsx` listagem — cores por modelo (azul FIXO, verde COMPENSADOS, roxo DINAMICO)

Override Usina/Contrato:
- DTOs aceitam `modeloCobrancaOverride?` em ambos
- 🔴 **Sem UI** — só via API direta

**Veredito 🔴 (mantido, contexto enriquecido):** congelamento + D-30R + DINAMICO sem implementação. Bloqueio é **defesa em profundidade saudável** (4 pontos enforcement + UI desabilitada). Lacunas adicionais identificadas:
1. Seed automático cria Plano `CREDITOS_COMPENSADOS` ao subir — incoerente com bloqueio
2. UI de override em Usina/Contrato inexistente
3. `FORMULAS-COBRANCA.md` órfão (CLAUDE.md aponta pra ele mas está em `historico/`)
4. `RegrasFioB` model + `Usina.classeGd` enum documentados mas não no schema

Para destravar COMPENSADOS: D-30R fix + backfill 72 contratos + remover (ou flexibilizar) `BLOQUEIO_MODELOS_NAO_FIXO` + ativar opções `<select>` no frontend + revisar seed Plano Básico + corrigir referência CLAUDE.md → FORMULAS-COBRANCA.md. DINAMICO requer Sprint dedicado (3-5 dias) + Sprint 5 (Fio B + classes GD) como pré-requisito.

---

## Área 2 — CooperToken configurável 🟡

**Schema Prisma — campos existentes (`Cooperativa`/`PlanoSaas`):**
- `cooperTokenAtivo` (Bool), `tokenOpcaoCooperado` (OPCAO_A/B/AMBAS)
- `tokenValorTipo` (KWH_APURADO/FIXO), `tokenValorFixo` (Decimal)
- `tokenPorKwhExcedente`, `valorTokenReais`
- **`tokenExpiracaoMeses` (Int)** ✅ — flag 1 da visão Luciano
- `tokenDescontoMaxPerc` (Decimal) — teto conversão
- `tokenSocialAtivo`, `tokenFlexAtivo`
- `modoToken` (DESCONTO_DIRETO/FATURA_CHEIA_TOKEN), `modoRemuneracao` (DESCONTO/CLUBE)

**Campos AUSENTES no schema:**
- `tokenDesvalorizacaoPeriodoGraca` 🔴
- `tokenDesvalorizacaoTaxaPercentual` 🔴
- `tokenDesvalorizacaoPiso` 🔴

**Backend — `backend/src/cooper-token/`:**
- `cooper-token.service.ts:61-204` — `creditar()` com idempotência + expiração ✅
- `cooper-token.service.ts:280-284` — `calcularValorAtual()` com **curva HARD-CODED**:
  - Dias 0-10: 100% | 10-20: 90% | 20-26: 75% | 26-29: 50% | >29: 0%
  - Não consulta nenhum campo do banco, não é configurável por parceiro
- `cooper-token.job.ts:20-49` — Cron diário 6h `apurarExcedentes()`
- **Ausentes:** job de expiração automática, job de desvalorização mensal, notificações WhatsApp pré-vencimento

**Frontend:**
- `web/app/dashboard/planos/[id]/page.tsx:105-150` — edição de plano expõe `cooperTokenAtivo`, `tokenExpiracaoMeses`, `tokenDescontoMaxPerc`, `tokenValorFixo` ✅
- `web/app/dashboard/cooper-token/page.tsx:15-28` — dashboard com ledger
- **Sem campos UI** para desvalorização (período graça/taxa/piso)

**Mapeamento 5 flags Luciano:**
| Flag | Schema | Backend | UI | Status |
|---|---|---|---|---|
| 1. Expiração (prazo meses) | ✅ | 🟡 sem cron | ✅ | Parcial |
| 2a. Desvalorização — período graça | 🔴 | 🔴 | 🔴 | Faltando |
| 2b. Desvalorização — taxa % | 🔴 | 🔴 (hard-coded) | 🔴 | Faltando |
| 2c. Desvalorização — piso | 🔴 | 🔴 | 🔴 | Faltando |
| 3. Conversão token→desconto (teto) | ✅ | 🟡 | ✅ | Parcial |
| 4. Ativação Clube por parceiro | ✅ | ✅ | ✅ | Completo |
| 5. Regras emissão | 🟡 | 🟡 | 🟡 | Parcial |

**Specs Jest — gap completo (revisão posterior à investigação inicial):**
- `backend/src/cooper-token/` tem **0 arquivos `*.spec.ts`** (4 fontes: `cooper-token.service.ts`, `cooper-token.job.ts`, `cooper-token.controller.ts`, `contabilidade-clube.controller.ts` — todos sem teste)
- Único spec que toca CooperToken vive em `backend/src/cobrancas/cobrancas.service.spec.ts:235-285` (4 testes do bloco "Modo CLUBE"):
  - CLUBE: bruto=líquido=100, descontoRegistrado=20 ✅
  - DESCONTO regressão: bruto=100, líquido=80 ✅
  - CLUBE com override `valorLiquido` ✅
  - `modoRemuneracao=null` → tratado como DESCONTO ✅
- Esses 4 testam o **lado da Cobrança** (gravar `descontoRegistrado` certo) — **não exercitam CooperToken em si**
- **Funções não testadas em lugar nenhum:**
  - `creditar()` — idempotência por `eventoOrigemId`
  - `apurarExcedentes()` — cron diário 6h
  - `calcularValorAtual()` — curva hard-coded 29 dias (a função mais crítica de produção)
  - `getSaldo()` — agregação saldo + valor estimado
  - Eventos `cooper-token.events.ts`
  - Expiração (cron de limpeza inexistente)

**Veredito 🟡:** ~70% MVP **com qualidade frágil**. Bloqueia produção real por dois eixos:
1. **Configuração:** parceiro não consegue customizar desvalorização (curva 29-dias hard-coded).
2. **Qualidade:** função `calcularValorAtual()` (núcleo financeiro do CooperToken) sem 1 spec sequer — qualquer regressão na curva vira surpresa em produção.

Sprint pra completar: 3 campos schema desvalorização + cron desvalorização mensal + cron expiração + telas admin + **specs Jest pra creditar/calcularValorAtual/apurarExcedentes/getSaldo** (mínimo 8 cenários). Estimativa revisada: 3-4 dias (era 2-3, +1 dia pra specs).

---

## Área 3 — Modo Observador 🟡

**Backend — `backend/src/observador/`:**
- `observador.controller.ts` (87 linhas) — 4 endpoints (POST, DELETE, GET ativas, GET histórico, GET buscar-usuarios)
- `observador.service.ts` (310 linhas) — escopos (WHATSAPP_ENVIADO/RECEBIDO/TOTAL, ACOES_PLATAFORMA, TUDO) + cron expiração 5min + event listeners + multi-tenant
- Integrado em `app.module.ts:40,92`

**Frontend — `web/app/dashboard/observador/page.tsx`:**
- Modal busca por nome/CPF/telefone + entrada manual ✅
- Seletor escopo (5 opções) + expiração (1h/4h/24h/sem) + motivo
- Auto-refresh 30s + abas Ativas/Histórico 24h
- Quick-icon `window.__observadorAbrirModal`

**Auth — gap crítico:**
- `PerfilUsuario` enum: SUPER_ADMIN, ADMIN, OPERADOR, COOPERADO, AGREGADOR
- **Não há OBSERVADOR como role**
- Endpoints protegidos por `@Roles(SUPER_ADMIN, ADMIN)` — só admin ativa observação
- Não há geração de token externo de observador

**Permissões:**
- "Observador" no código atual = **admin monitorando WhatsApp/ações de cooperado**
- NÃO é "cooperado/usuário externo com leitura sem alteração" (visão Luciano)
- Limite 10 observações simultâneas por admin (`observador.service.ts:34`)

**Schema:**
- `ObservacaoAtiva` (observador, observado, escopo, expiresAt, motivo) + `LogObservacao` ✅
- Sem coluna `role=OBSERVADOR` em `Usuario`

**Documentação:**
- Menção CLAUDE.md:80 ("modo leitura para cooperados")
- Sem doc dedicado em `docs/`
- Sem casos de uso documentados

**Veredito 🟡:** o que existe (admin-spy WhatsApp) está completo e funcional. **O que Luciano descreveu como "Modo Observador"** (cooperado/usuário externo com acesso só-leitura) **não existe** — feature planejada, não entregue. Discrepância nominal: dois conceitos diferentes compartilham o mesmo nome no código + visão.

**Decisão pendente Luciano:** "Modo Observador" = renomear admin-spy + criar role OBSERVADOR cooperado-leitura como Sprint novo, ou consolidar como módulo único.

---

## Área 4 — Convênios + ligação ao indicador 🟡

**Schema (`ContratoConvenio` + `ConvenioCooperado`):**
- `ContratoConvenio`: numero, tipo (CONDOMINIO/ADMINISTRADORA/ASSOCIACAO/SINDICATO/EMPRESA/CLUBE/OUTRO), `conveniadoId` (raiz), `configBeneficio` (JSON com faixas + descontos), `faixaAtualIndex`, `membrosAtivosCache`, `descontoMembrosAtual`, `descontoConveniadoAtual`, `registrarComoIndicacao` (default true)
- `ConvenioCooperado`: unique `[convenioId, cooperadoId]`, `indicacaoId` unique (vínculo Indicacao), `status` (MEMBRO_ATIVO/SUSPENSO/DESLIGADO), `faixaAtual` (cache label)

**Backend — fluxo cadastro público (D-30P/Q resolvido 01/05):**
1. `publico.controller.ts:438-479` recebe `codigoRef` = `codigoIndicacao` do indicador
2. `registrarIndicacao(codigoRef)` busca cooperado indicador
3. Se indicador é membro/conveniado: busca `ContratoConvenio` (conveniado) ou `ConvenioCooperado` (membro)
4. Chama `conveniosMembros.adicionarMembro(convenioId, cooperadoId)`:
   - Cria/reativa `ConvenioCooperado`
   - `registrarIndicacaoConvenio()` se `convenio.registrarComoIndicacao=true`
   - `recalcularFaixa(convenioId, 'NOVO_MEMBRO')` atualiza cache desconto
5. Fire-and-forget — erro logado, não interrompe

**Token específico de convênio — AUSENTE 🔴:**
- `Convenio` NÃO tem campo `tokenConvenio`
- Cadastro público só aceita `codigoRef=<cooperado-code>`
- Vínculo é **derivado do indicador**, não direto via convênio

**Landing personalizada — AUSENTE 🔴:**
- `web/app/cadastro/page.tsx` é página única
- Sem rota dinâmica `/cadastro/[convenioId]`
- Sem logo + benefícios + faixas pré-renderizados
- Sem pré-seleção de convênio no form

**Progressão BRONZE→DIAMANTE — IMPLEMENTADA ✅:**
- `convenios-progressao.service.ts:28-185` `recalcularFaixa()`
- Trigger: `adicionarMembro()` / `removerMembro()` / `recalcularTodos()` (cron)
- Lógica: conta `ConvenioCooperado.ativo=true` → busca faixa em `configBeneficio.faixas` onde `minMembros ≤ ativos` → atualiza cache + histórico em `HistoricoFaixaConvenio`
- Se `efeitoMudancaFaixa=INCLUIR_PENDENTES`: recalcula cobranças do mês retroativamente
- Se `tipoBeneficioConveniado=TOKENS|MISTO`: emite tokens ao conveniado raiz

**Banco:**
- Schema completo, com `indicacaoId` populado
- Seed-extra.ts (575 linhas): zero referências a `ConvenioCooperado` ou `adicionarMembro` — os 215 registros mencionados antes são **dados legados**, não seed novo

**Veredito 🟡:** mecânica interna de convênios (membros, progressão, beneficios) ✅ completa. **UX pública via convênio** (link específico + landing personalizada) 🔴 ausente — alinha com sugestão #2 já catalogada em `sugestoes_pendentes.md`. Sprint pra fechar: 1-2 dias (campo token + rota dinâmica + página com config).

---

## Área 5 — FaturaSaas + relatório mensal 🟡

**Schema `FaturaSaas` (`schema.prisma:1395`):**
- `id`, `cooperativaId`, `competencia`, `valorBase`, `valorReceita`, `valorTotal`
- `status` (PENDENTE/PAGO/VENCIDO/CANCELADO), `dataVencimento`, `dataPagamento`
- `asaasCobrancaId` (campo existe mas **não é populado** atualmente)
- `volumeTokensMes`, `receitaTokens`
- Unique `[cooperativaId, competencia]` — evita duplicação ✅

**Cron mensal — `backend/src/saas/saas.service.ts:130-143`:**
- `@Cron('0 6 1 * *')` — 1º dia do mês 6h
- Idempotente (`JA_EXISTE` se duplicado)
- Calcula `valorBase` (do plano) + `valorReceita` (25% sobre cobranças PAGAS no mês anterior)
- `dataVencimento` configurável via `Cooperativa.diaVencimentoSaas`
- Status inicial PENDENTE

**Endpoints existentes:**
- `GET /saas/dashboard` (super-admin) — MRR fixo/variável, inadimplência SaaS, "incêndios"
- `GET /saas/parceiros` — lista enriquecida com 9 métricas por parceiro
- `GET /saas/parceiros/:id/saude` — saúde operacional + plataforma
- `GET /saas/faturas` — lista FaturaSaas (filtro status)
- `POST /saas/faturas/gerar` — trigger manual

**Painel super-admin (`web/app/dashboard/super-admin/page.tsx`):**
- Resumo: parceiros ativos, MRR (fixo + variável estimado), faturamento mês, "incêndios" (>20% cobranças vencidas)
- Alerta SaaS: qtd faturas vencidas + valor total vencido (linhas 128-142) ✅
- Página parceiros (`super-admin/parceiros/page.tsx`) com saúde colorida ✅

**Gaps críticos:**
1. **FaturaSaas → Asaas — nunca emite cobrança** 🔴 — `asaasCobrancaId` permanece NULL; `gerarFaturaParaCooperativa()` não chama `asaas.criarCobranca()`
2. **Dashboard parceiro — não vê suas próprias FaturaSaas** 🔴 — só Luciano (super-admin) vê
3. **Relatório modular ausente** 🔴 — falta breakdown de consumo por módulo (CooperToken, Convênios, MLM, etc) no relatório mensal
4. **Cobrança automática — sem boleto/PIX gerado quando vence** 🔴

**Banco:** 1 FaturaSaas PENDENTE (CoopereBR Teste, R$ 5.900) criada Sprint 13a P0.

**Veredito 🟡:** núcleo (geração + painel inadimplência) ~60% pronto. Para produção real precisa: ponte FaturaSaas→Asaas + dashboard parceiro + relatório modular + envio automático boleto/PIX. Sprint estimado: 2-3 dias (já alinhado com Sprint 13c na visão atual).

---

## Área 6 — Planos SaaS modulares 🟡

**Schema (`schema.prisma:1372-1393`):**
- `Cooperativa.planoSaasId` → FK para `PlanoSaas`
- `Cooperativa.modulosAtivos[]` (String[], cache do plano)
- `Cooperativa.modalidadesAtivas` (JSON) — ex: `{indicacoes:'STANDALONE', clube_vantagens:'STANDALONE'}`
- `PlanoSaas.modulosHabilitados[]` + `modalidadesModulos` (JSON)
- **Sem enum BRONZE/PRATA/OURO** — planos são dinâmicos por nome
- Status SaaS: ATIVO/TRIAL/INADIMPLENTE/SUSPENSO (string, não enum)
- Achado importante: BRONZE→DIAMANTE existe sim, mas é tier de progressão de **clube-vantagens** (membros), **NÃO plano SaaS**

**Backend — gates de feature:**
- `saas.service.ts:76` — `vincularPlano()` replica `modulosHabilitados` → `modulosAtivos` na cooperativa + propaga em edição de plano
- `auth/modulo.guard.ts` — Guard ativo, valida `modulosAtivos.includes(modulo)` por request, bypass SUPER_ADMIN
- `auth/require-modulo.decorator.ts` — `@RequireModulo('clube_vantagens')` registra gate
- **🔴 Gap crítico:** decorator `@RequireModulo` **não está em uso em controller real algum** (grep retorna vazio). Gates atuais são **env vars** (`WA_MLM_CONVITES_HABILITADO`, `CLUBE_RESUMO_MENSAL_HABILITADO`) — fallback frágil.

**Frontend — edição plano (já existe, NÃO é Sprint 13c futuro):**
- `web/app/dashboard/saas/planos/page.tsx` ✅
- 15 módulos: usinas, membros, ucs, contratos, cobrancas, modelos_cobranca, motor_proposta, whatsapp, indicacoes, clube_vantagens, convenios, relatorios, condominios, usuarios, planos
- Modalidades para 3 módulos (indicacoes, clube_vantagens, convenios) com valores STANDALONE/etc
- POST/PATCH/DELETE plano ✅
- Vinculação `/cooperativas/[id]/page.tsx:399` POST `/saas/planos/vincular` ✅

**Migração entre planos:**
- `vincularPlano()` direto, sem transição suave
- Sem veto de downgrade quando `membros > limiteMembros`
- Sem aviso de perda de módulos

**Veredito 🟡:** infra modular **já existe** — schema e frontend prontos pra ligar/desligar módulo por parceiro. Faltam **2 coisas pra fechar**:
1. Aplicar `@RequireModulo()` em todos endpoints relevantes (gate real, não env var)
2. Veto de downgrade quando excede limites (membros > limiteMembros)

Sprint estimado: 1-2 dias. **Sprint 13c já está direcionado para isso.**

---

## Padrões observados nas 6 áreas

**Padrão 1 — Esqueleto pronto, telas admin existem, lógica de fundo incompleta:**
Vale pra Áreas 2 (CooperToken sem desvalorização configurável), 5 (FaturaSaas sem ponte Asaas), 6 (Planos sem gate real). Em todos: schema OK, UI OK, **runtime não consome o que está configurado**.

**Padrão 2 — Conceito nominal divergente entre visão e código:**
Áreas 3 (Observador admin-spy ≠ Observador cooperado-leitura) e 4 (Convênio token-genérico ≠ Convênio link-específico).

**Padrão 3 — Bloqueio formal (Sprint 5) sem fix preparatório aplicado:**
Área 1 (D-30R não corrigido). Bloqueio é defesa em profundidade saudável, mas para destravar precisa fix prévio.

---

## Estimativas grosseiras por área (NÃO catalogadas como sprint)

| Área | O que falta | Esforço |
|---|---|---|
| 1 — COMPENSADOS | D-30R fix + backfill 72 contratos + remover bloqueio + smoke test | ~1 dia |
| 1 — DINAMICO | Implementação do zero | 3-5 dias |
| 2 — CooperToken desvalorização | 3 campos schema + cron mensal + cron expiração + UI admin + notif WA | 2-3 dias |
| 3 — Observador cooperado-leitura | Role enum + token gerador + páginas read-only + auth path | 2-3 dias |
| 4 — Convênios link-específico | Campo `tokenConvenio` + rota dinâmica `/cadastro/[convenioId]` + landing | 1-2 dias |
| 5 — FaturaSaas pra produção | Ponte Asaas + dashboard parceiro + relatório modular + envio automático | 2-3 dias |
| 6 — Planos modulares prod | `@RequireModulo` em controllers + veto downgrade | 1-2 dias |

**Total absoluto se tudo virasse sprint:** ~12-19 dias. **NÃO é decisão Code** — Luciano decide ordem/escopo/quais entram.

---

## Pendências decisórias para Luciano

Dessas investigações, surgiram 6 decisões para registrar (não tomadas aqui):

1. **D-30R:** aplicar fix Motor.aceitar agora ou aguardar destrava de COMPENSADOS?
2. **DINAMICO:** sprint dedicado vs descartar (Decisão 17 já descartou Sprint 21 cv-moradas)?
3. **CooperToken desvalorização:** 3 flags configuráveis prioridade alta ou aceitar curva 29-dias hard-coded em prod?
4. **Modo Observador:** consolidar admin-spy + cooperado-leitura no mesmo módulo, ou criar Observador separado e renomear o existente?
5. **Convênios link-específico:** sprint paralelo agora ou aguardar primeiro convênio real entrar?
6. **Planos modulares gates:** aplicar `@RequireModulo` retroativo (15 módulos × N controllers ≈ 50 endpoints) ou só novos?

---

## Pendências catalogáveis como sprints (sugeridas, não decididas)

Aplicando padrão Decisão 18 (5 itens mínimos), surgem 3 sprints com material pra catalogação imediata:

- **Sprint X — D-30R fix Motor.aceitar + backfill** (≤1 dia, P2)
- **Sprint Y — CooperToken desvalorização configurável** (2-3 dias, P2/P3)
- **Sprint Z — Convênios link-específico + landing** (1-2 dias, P3)

**Não catalogados:** áreas 1-DINAMICO, 3-Observador-leitura, 5-FaturaSaas-produção, 6-Planos-gates — dependem de decisões Luciano antes.

---

*Investigação conduzida 02/05/2026 tarde por Claude Code (Opus). 6 agentes Explore paralelos, 1 agente de consolidação. Sem alteração de código. Sem decisões de produto. Materiais brutos por agente preservados na conversa de origem.*
