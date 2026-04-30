# Mapeamento do que já existe sobre regulação ANEEL — 30/04/2026

> **Modo:** read-only puro (apenas grep/ls/leitura). Nenhum arquivo alterado.
> **Escopo:** Lei 14.300, classes GD, Fio B, concentração 25%, política de alocação,
> engine de otimização, diagnóstico pré-venda, 5 flags regulatórias e estruturas auxiliares.
> **Conclusão antecipada:** estado é **inicial** em todos os temas, com 1 spec
> detalhada de Fio B nunca implementada e 1 validação ANEEL real (mesma distribuidora UC × usina).

---

## 1. Schema (`backend/prisma/schema.prisma`)

| Termo buscado | Matches |
|---|---|
| `classeGd`, `gdI`, `gdII`, `gdIII`, `GD_I`, `GD_II`, `GD_III` | 0 |
| `fioB`, `fio_b`, `FIO_B`, `FioB`, `tusdFioA`, `tusdFioB` | 0 |
| `modalidadeGD`, `ModalidadeGD`, `GD1_`, `GD2_` | 0 |
| `dataProtocolo`, `protocoloDistribuidora` | 0 |
| `dataHomologacao` | **1** — `Usina.dataHomologacao DateTime?` (linha 330) |
| `concentracaoMaxima`, `limite25`, `maxConcentracao`, `maxPorCooperado` | 0 |
| `RegrasFioB`, `TabelaFioB`, `PoliticaAlocacao`, `FaixaAlocacao`, `AlocacaoOtima` | 0 |
| `engineOtimizacao` | 0 |
| `potenciaKwp` (Decimal) | **1** — `Usina.potenciaKwp` (linha 324) |
| `potenciaMinimaPct: Int @default(20)` | **1** — `UsinaMonitoramentoConfig` (linha 938). **NÃO é regulação:** é threshold de alerta de baixa geração. |

**Conclusão schema:** nenhum campo regulatório (Lei 14.300, classes GD, Fio B, concentração, política de alocação) presente. Apenas `dataHomologacao` e `potenciaKwp` da Usina, que servem operação genérica.

---

## 2. Código backend (`backend/src/**/*.ts`)

### 2.1 Lei 14.300 e classes GD
- `grep "14.300|14300|lei.14|classeGd|GD_I|GD_II|GD_III|geracaoDistribuida"` → **0 arquivos**.
- Apenas `coopere-ai.service.ts` menciona "GD" no system prompt: *"modelo de Geração Distribuída (GD), regulamentado pela ANEEL (Resolução Normativa nº 482/2012)"* — **referência defasada** (Lei 14.300/2022 substituiu). Sem cálculo, só copy.

### 2.2 Fio B
- `grep "fioB|fio_b|FioB|FIO_B|fio b"` → **1 arquivo** (`coopere-ai.service.ts`), linha 276:
  ```
  'tarifa': ['tarifa', 'tusd', 'fio b']
  ```
  Apenas keyword pra detectar intenção de pergunta sobre tarifa no chatbot. Nenhum cálculo, nenhuma tabela de percentuais.

### 2.3 Concentração 25% e limite por cooperado
- `grep "concentracao|limite25|maxPorCooperado|limite_25"` → **0 arquivos**.

### 2.4 Política de alocação / faixas
- `grep "politicaAlocacao|faixaAlocacao|FaixaConsumo|FaixaAlocacao"` → **0 arquivos**.

### 2.5 Engine de otimização
- `grep "otimizar|otimizacao|alocacaoOtima|splitAlocacao|engineAlocacao"` → **2 matches**, ambos em comentários de teste (`cooperados.service.guard-ativacao.spec.ts:105` e `metricas-saas.service.spec.ts:159`) sobre "otimização de query", sem relação com alocação inteligente.

### 2.6 Diagnóstico pré-venda
- `grep "diagnostico|simulador|preVenda|prevenda|leadAnalise"` → **2 arquivos**:
  - `faturas.controller.ts:139` `@Get('diagnostico')` + `faturas.service.ts:1162` `async diagnostico()` — **healthcheck técnico** (verifica config_tenant, faturas_processadas, bucket Supabase, campos novos do cooperado). **NÃO é diagnóstico de pré-venda regulatório.**

### 2.7 ANEEL — único código real existente
- `usinas.service.ts:77` — `validarCompatibilidadeAneel(ucId, usinaId)`: garante que UC e Usina têm a mesma `distribuidora`. Chamado em:
  - `cooperados.service.ts:495, 1151` (alocação de cooperado a usina)
  - `contratos.service.ts:178, 180, 304` (criação/edição de contrato)
- `bandeira-tarifaria/bandeira-aneel.service.ts` — scraping de `dadosabertos.aneel.gov.br/bandeira-tarifaria-acionamento.csv` para sincronizar bandeira mensal. Endpoint público em `/bandeiras-tarifarias/aneel/preview` e `/aneel/sincronizar`.

**Conclusão backend:** zero implementação de Lei 14.300/classes GD/Fio B/concentração/política de alocação/otimização. A única regra ANEEL é "mesma distribuidora UC×usina". Bandeira tarifária é sincronizada da ANEEL mas é tema diferente.

---

## 3. Telas frontend (`web/app/**/*.tsx`)

### Pastas regulatórias procuradas
| Caminho | Existe? |
|---|---|
| `web/app/dashboard/regulatorio/` | ❌ |
| `web/app/dashboard/diagnostico/` | ❌ |
| `web/app/dashboard/politica*/` | ❌ |
| `web/app/dashboard/alocacao/` | ❌ |
| `web/app/diagnostico/` | ❌ |
| `web/app/simulador/` | ❌ |

### Menções a ANEEL/Lei 14.300/Fio B no frontend
- `web/app/dashboard/configuracoes/bandeiras/page.tsx` — UI pra sincronizar bandeira ANEEL (já tem botão "Consultar bandeira atual" e "Sincronizar com ANEEL").
- `web/app/dashboard/cooperados/novo/steps/Step1Fatura.tsx` — usa "tarifa ANEEL (sem ICMS)" como base do cálculo de economia, e mostra "Consumo mínimo ANEEL" (30/50/100 kWh por mono/bi/trifásico).
- `web/app/dashboard/motor-proposta/configuracao/page.tsx:209` — "Bloco 5 — Mínimo faturável ANEEL" (configuração de consumo mínimo).
- `web/app/assinar/page.tsx:33,59` — Termo de adesão menciona **"Resolução Normativa nº 482/2012 e suas alterações"** (defasada — Lei 14.300/RN 1.000 substituiu).
- `web/app/convite/[codigo]/page.tsx:122` — badge "ANEEL Regulamentado" (marketing).
- `web/app/dashboard/condominios/[id]/page.tsx:295` — "Simulador de Rateio" (interno do condomínio, não pré-venda).

**Telas com palavras "classe GD", "GD I", "GD II", "Fio B", "14.300", "concentração", "política de alocação", "otimização", "alocação inteligente":** zero matches relevantes (todos os matches são casos isolados em ANEEL+bandeira+mínimo, já listados).

**Conclusão frontend:** nenhuma tela dedicada a regulação Lei 14.300, classes GD, Fio B, concentração 25%, política de alocação ou diagnóstico pré-venda. Termo de adesão usa resolução defasada.

---

## 4. Documentação (`docs/**/*.md`)

### 4.1 Specs encontradas

| Doc | Linhas | Resumo |
|---|---|---|
| `docs/specs/PROPOSTA-GD1-GD2-FIOB-2026-03-26.md` | 188 | **Proposta detalhada do Assis (26/03):** schema `tusdFioA`/`tusdFioB`/`ModalidadeGD` (enum GD1_ATE_75KW/GD1_ACIMA_75KW/GD2_COMPARTILHADO), tabela progressiva de % Fio B 2022-2029, fórmula `tarifaEfetiva = tusdFioA + (tusdFioB × pctVigente) + TE`, refactor de `calcularCobrancaMensal()`. **Status: nunca implementada** — schema não tem nenhum dos campos propostos. |
| `docs/specs/MODELO-COBRANCA-GD-2026-04-01.md` | 115 | Análise das 5 faturas EDP-ES, comparativo entre 3 modelos atuais (FIXO/COMPENSADOS/DINAMICO) + 2 modelos propostos (Modelo A "tarifa unitária da fatura" e Modelo B "valor cheio reconstruído"). Tem questão explícita: *"Fio B (2026): incorporar no cálculo agora ou deixar para depois?"* — não respondida. |
| `docs/specs/COOPERTOKEN-FUNDAMENTOS.md` | — | Não regulatório. |
| `docs/specs/PLANO-CONVENIOS-2026-04-01.md` | — | Não regulatório. |

### 4.2 Documentos jurídicos / contextuais

| Doc | Linhas | Conteúdo regulatório |
|---|---|---|
| `docs/historico/recebidos-2026-04-28-claude-ai/CONTEXTO-JURIDICO.md` | 323 | **Pacote jurídico recebido em 28/04 do claude.ai.** Lei 14.300 mencionada (linha 50: *"limite 5 MW POR CENTRAL GERADORA"*). Foco principal é **indébito tributário** (ICMS, PIS/COFINS) — temas STF (Tema 69, 176, 323, 536), STJ (Tema 986/TUSD, Súmula 391). RN 482, 687, 1.000, 1.059 listadas como referências, sem detalhamento. **Não é spec de implementação** — é briefing jurídico bruto. |
| `docs/historico/recebidos-2026-04-28-claude-ai/CONTEXTO-OPERACIONAL.md` | 687 | Briefing operacional recebido junto. Não foi lido em profundidade nesta investigação; matches em "ANEEL/14.300" não foram aprofundados. |
| `docs/referencia/REGRAS-PLANOS-E-COBRANCA.md` | 1.623 | Documento grande sobre planos. Único match regulatório foi "lista por usina pra concessionária" (backlog P2). Sem cobertura de Fio B/classes GD/concentração. |
| `docs/SISGD-VISAO-COMPLETA.md` | — | Match: "concentração". Sem cobertura técnica de regulação. |

### 4.3 Outros docs com menção a regulação
- `docs/MAPA-INTEGRIDADE-SISTEMA.md` — apenas registra `validarCompatibilidadeAneel` em status FUNCIONAL (linha 470). Sem cobertura ampla de Lei 14.300.
- `docs/PLANO-ATE-PRODUCAO.md` — match em Lei 14.300 (não detalhada).
- `docs/sessoes/2026-04-28-leitura-total-parte1.md` — leitura cataloga telas e códigos; sem análise regulatória profunda.

**Conclusão docs:** **1 spec detalhada de Fio B (Assis, 26/03/2026, 188 linhas) nunca implementada, com schema/fórmulas/tabela progressiva prontos**. Nada sobre concentração 25%, política de alocação, engine de otimização, diagnóstico pré-venda.

---

## 5. Configurações e flags

### 5.1 ConfigTenant
- `ConfigTenant` é o store de configurações por cooperativa. Modelo existe no schema (linha 676). Tem chaves como `modelo_cobranca_padrao`, `aprovacao_documentos_automatica`, `prazo_aprovacao_auto_horas` etc. **Nenhuma chave regulatória** (concentração, fio B, classe GD, política alocação) registrada.

### 5.2 .env (`backend/.env` + `.env.example`)
- `grep "ANEEL|GD_|FIO_B|REGULATORIO|LIMITE|POLITICA|OTIMIZACAO"` → **0 vars**.

### 5.3 Feature flags
- `grep "modulosAtivos|featureFlag|feature_flag"` → não houve matches relevantes pra regulação. (Há `BLOQUEIO_MODELOS_NAO_FIXO`, `CADASTRO_V2_ATIVO`, `NOTIFICACOES_ATIVAS` em `.env`, todas operacionais — não regulatórias.)

---

## 6. Débitos catalogados (`docs/debitos-tecnicos.md`)

Matches relevantes para regulação:
- Linha 323: **% Pronto 40%, ModeloDocumento limitado a CONTRATO/PROCURACAO** — falta `TERMO_ADESAO`, `TERMO_RESPONSABILIDADE`, `PROCURACAO_ANEEL` (cita ANEEL).
- Linha 470: **`validarCompatibilidadeAneel`** marcado como FUNCIONAL.
- **P0-03:** *"Tipos de ModeloDocumento limitados a CONTRATO/PROCURACAO — Impossível gerar Termo de Adesão, Procuração ANEEL real"* (estimado 2-3 dias).
- Linha 613: ação para adicionar 3 novos tipos: TERMO_ADESAO, TERMO_RESPONSABILIDADE, PROCURACAO_ANEEL.
- Linha 842: **"Sprint 18 (Engine DINAMICO) — bandeiras tarifárias mudam, ANEEL publica resoluções"** — menção solta a Sprint 18 com ideia de manter motor reativo a mudanças ANEEL.

**Nenhum débito catalogado sobre Lei 14.300, classes GD, Fio B, concentração 25%, política de alocação, engine de otimização ou diagnóstico pré-venda.**

---

## 7. Síntese executiva

### Nível de implementação por tema

| Tema | Status | Evidência |
|---|---|---|
| Lei 14.300 / classes GD | 🔴 Inicial | Schema 0 campos; código 0 referências de cálculo; CoopereAI cita RN 482/2012 (defasada). |
| Fio B (TUSD Fio A/B + tabela progressiva) | 🔴 Inicial | Spec detalhada existe (`PROPOSTA-GD1-GD2-FIOB-2026-03-26.md`) mas nunca foi implementada. Único match no código é keyword do chatbot. |
| Concentração 25% | 🔴 Inicial | Zero matches em schema/código/UI/docs/débitos. |
| Política de alocação (faixas) | 🔴 Inicial | Zero matches em schema/código/UI/docs/débitos. |
| Engine de otimização (alocação ótima) | 🔴 Inicial | Zero matches conceituais; matches em "otimização" são de query, não alocação. |
| Diagnóstico pré-venda | 🔴 Inicial | `faturas.diagnostico` existe mas é healthcheck técnico, não pré-venda. |
| 5 flags regulatórias (item 8 abaixo) | 🔴 Inicial | Todas zero. |

### Estado das 5 flags regulatórias (Parte 8)

| Flag | Schema? | Código backend? | UI? | Status |
|---|---|---|---|---|
| `multipleUsinasPerUc` | não | não | não | 🔴 |
| `multipleClassesGdPerUc` | não | não | não | 🔴 |
| `concentracaoMaxPorCooperadoUsina` | não | não | não | 🔴 |
| `misturaClassesMesmaUsina` | não | não | não | 🔴 |
| `transferenciaSaldoEntreUcs` | não | não | não | 🔴 |

### Estado das estruturas auxiliares

| Estrutura | Existe? | Notas |
|---|---|---|
| Schema N:M UC ↔ Usina (`UcUsina`/`uc_usina`) | 🔴 não | Hoje é 1:N via `Contrato.ucId` + `Contrato.usinaId`. Um cooperado pode ter múltiplos contratos, mas não há tabela de junção dedicada UC×Usina com rateio. |
| Cálculo mix de origens (`mixOrigens`/`fioBPonderado`/`fioBEfetivo`) | 🔴 não | 0 matches. |
| Audit trail de flags (`auditFlag`/`FlagAudit`/`HistoricoFlag`) | 🔴 não | 0 matches. (`AuditLog` existe pra outras coisas — Sprint 13b ainda inativo.) |
| Estabilidade mínima / cooldown de alocação | 🔴 não | 0 matches. |
| Multi-rateio em uma UC (`rateioMultiplo`/`percentualPorUsina`/`multipleRateios`) | 🔴 não no nome explícito | Schema atual: `Contrato.percentualUsina` (% que esse contrato ocupa da usina). É rateio do **lado da usina**, não da UC. Para "uma UC consumindo de várias usinas com rateio", precisaria modelagem nova. |

### Recomendações pra REGULATORIO-ANEEL.md

**O que reaproveitar como ponto de partida:**
1. `docs/specs/PROPOSTA-GD1-GD2-FIOB-2026-03-26.md` — spec de Fio B do Assis está pronta (schema + fórmulas + tabela). Validar se ainda é a abordagem desejada (tem 1 mês — pode ter evoluído).
2. `validarCompatibilidadeAneel()` em `usinas.service.ts:77` — único ponto consolidado de regra ANEEL no backend. Manter como referência de como expandir validações.
3. `BandeiraAneelService` — padrão de "scrape ANEEL para sincronizar dados oficiais". Pode servir de template se houver outras tabelas oficiais da ANEEL a importar (limites, classes etc).
4. `CONTEXTO-JURIDICO.md` (claude.ai 28/04) — usar como apêndice com referências jurídicas (Lei 14.300, RN 482/687/1000/1059, Lei 11.253/ES, jurisprudência STF/STJ).

**O que está em conflito com discussão claude.ai (e como):**
1. **Termo de adesão e CoopereAI usam "RN 482/2012"** — discussão atual é Lei 14.300/RN 1000. Atualizar texto + referências.
2. Spec do Assis (26/03) propõe **3 modalidades** (`GD1_ATE_75KW` / `GD1_ACIMA_75KW` / `GD2_COMPARTILHADO`). Discussão atual fala em **classes GD I/II/III** — verificar se é a mesma taxonomia ou se há divergência.
3. Spec do Assis usa enum `ModalidadeGD` no model `TarifaConcessionaria`; discussão atual sugere `classeGd` no nível da **Usina**. Decidir onde fica a fonte de verdade.

**O que claude.ai propôs que já existe sob outro nome:**
1. **"Mesma distribuidora UC×Usina"** — claude.ai pode ter chamado de outra coisa; já está implementado e ativo (`validarCompatibilidadeAneel`).
2. **"Diagnóstico"** — já existe endpoint `GET /faturas/diagnostico`, mas é técnico (não pré-venda). Reusar o nome pode confundir; sugerido renomear o existente para `/healthcheck` se o "diagnóstico pré-venda" usar o mesmo nome.
3. **"Bandeira tarifária ANEEL"** — completo (sync + UI + tarifa cadastrada), pode ser explicado como uma camada paralela ao Fio B no documento.

### Achado mais importante

**Existe uma spec de Fio B detalhada e tecnicamente completa (`docs/specs/PROPOSTA-GD1-GD2-FIOB-2026-03-26.md`, 188 linhas)** — schema, fórmulas, tabela 2022-2029, refactor do motor de cobrança, breakdown na fatura. **Nunca foi implementada.** Antes de escrever REGULATORIO-ANEEL.md do zero, vale decidir se essa proposta é o ponto de partida (atualizada para nomes/taxonomia da discussão atual) ou se há nova arquitetura preferida.

---

*Mapeamento conduzido por Claude Code (Opus 4.7) em 2026-04-30. Read-only. 0 arquivos alterados.*
