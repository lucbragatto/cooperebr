# Decisões Doc-0 Fatia 2 — Sessão claude.ai 2026-04-30

> Captura cronológica de decisões da sessão Luciano × claude.ai do dia 30/04.
> **Insumo direto pra:** `docs/PRODUTO.md` + `docs/REGULATORIO-ANEEL.md` (escritos em sessão Code subsequente).
> **Documento histórico:** snapshot da sessão. Não atualizar.

---

## CONTEXTO INICIAL

Sessão começou com Luciano voltando após o dia 29/04 (validação INVs 4-8).
**Objetivo:** fechar plano de PRODUTO.md.
**Estado:** 8 das 10 camadas do PRODUTO.md já cobertas pelas investigações Code dos dias 28-29/04; faltavam decisões finais de produto.

A sessão evoluiu além do PRODUTO.md. Caso Exfishes (cooperado real) provocou descobertas regulatórias que mudaram a categoria do produto, gerando um **4º documento do Doc-0** (REGULATORIO-ANEEL.md) e **+10 sprints estruturados** no plano até produção.

---

## DECISÕES CONSOLIDADAS

### Decisão 1 — Modelo de produto (3 entidades fundamentais)

**Contexto.** A discussão pré-30/04 oscilava entre 4 e 5 entidades de identidade no SISGD (parceiro, membro, agregador, proprietário, conveniado). Cada uma com tabela própria parecia sobre-engenharia.

**Decisão final.** Apenas **3 entidades de identidade** existem no SISGD:

- **SISGD** (a plataforma — entidade conceitual, dona Luciano).
- **Parceiro** (assina contrato com SISGD; tabela legada `Cooperativa`; 4 tipos ANEEL: COOPERATIVA, CONSORCIO, ASSOCIACAO, CONDOMINIO).
- **Membro** (assina contrato com Parceiro; tabela legada `Cooperado`; nomenclatura por tipo: cooperado/consorciado/associado/condômino).

**Tudo demais é atributo sobreposto, não categoria nova:**
- Proprietário de usina = atributo (`usinaPropriaId` ou `Usina.proprietarioCooperadoId`).
- Conveniado/MLM raiz = atributo (`AGREGADOR` em `PerfilUsuario` + `indicadorCooperadoId`).
- Parceiro pode ser membro de si mesmo (Luciano cadastrado como cooperado da CoopereBR).
- Convênio funciona com PF e PJ no mesmo registro (`ContratoConvenio` aceita CPF ou CNPJ).

**Justificativa.** Modelo simples, alinhado ao schema atual, evita migração desnecessária. Validado por leitura total dos dias 28-29/04.

**Implicações.**
- Documentação humana (PRODUTO.md) descreve **12 papéis** (Marcos, Ana, Carlos, Helena, etc.) como **personas operacionais**, não como tipos de entidade.
- Schema permanece estável.
- Vocabulário multi-tipo (hook `useTipoParceiro`) já implementa parcialmente — débito P2 de adoção em ~50 telas + 73 exceptions backend.

---

### Decisão 2 — Sprint OCR-Integração + Sprint 14 (opção C mista)

**Contexto.** Pré-30/04 havia 3 frentes desconexas: (a) pipeline OCR ↔ Motor de Proposta, (b) destravar `BLOQUEIO_MODELOS_NAO_FIXO` para COMPENSADOS, (c) implementar CREDITOS_DINAMICO (`NotImplementedException` em `faturas.service.ts:1882`). Diagnóstico de fatura real (commit `5ae9dfd`) mostrou que **0 cobranças no banco têm `modeloCobrancaUsado` preenchido** — pipeline nunca rodou em produção.

**Decisão final.** Sprint atômico que cobre as 3 frentes simultaneamente:
1. Implementar `CREDITOS_DINAMICO` (fórmula `kwhCompensado × tarifaCheia × (1 − desconto)` revisada pra normalização por consumo).
2. Validar `CREDITOS_COMPENSADOS` com dados reais (auditar `tarifaContratual` vazia em contratos existentes — bug do snapshot do Motor.aceitar).
3. **Detecção automática EDP via `kwhCompensado>0`** — fatura aprovada na Central dispara `gerarCobrancaPosFatura` (já existe).
4. Decisão de produto **resolvida**: pipeline OCR alimenta `Cobranca`, **não** o Motor de Proposta. Motor é só pro cadastro inicial.

**Justificativa.** Sprint isolado para cobranças mensais reais. Sem OCR×Motor desconectado, COMPENSADOS bloqueado e DINAMICO não implementado, **nenhum parceiro pode ir pra produção real com modelo COMPENSADOS ou DINAMICO**.

**Implicações.**
- Vira **Sprint 2** da nova pilha (após Sprint 0 Auditoria + Sprint 1 FaturaSaas).
- Bloqueio `BLOQUEIO_MODELOS_NAO_FIXO` ainda é controle pré-produção: destravado por env quando o Sprint 2 finaliza.
- Diagnóstico de fatura real (commit `5ae9dfd`) é o insumo de validação.

---

### Decisão 3 — ContratoUso 3 modalidades

**Contexto.** O documento "% lucro líquido" da seção 4 do SISGD-VISAO sugeria que ContratoUso (proprietário ↔ usina) calcularia repasse como `(receita − despesas) × percentualRepasse`. Investigação 29/04 (`docs/sessoes/2026-04-29-validacao-invs-4-8.md`) confirmou: `ContratoUso.percentualRepasse` está no schema mas **nunca é consumido**. Hoje só roda "aluguel fixo R$ X/mês".

**Decisão final.** ContratoUso terá **3 modalidades** combináveis livremente:

1. **Fixa por mês** (`valorFixoMensal`) — aluguel tradicional.
2. **Fixa por kWh gerado** (`valorPorUnidade`) — proporcional à geração da usina.
3. **Percentual sobre tarifa concessionária sem tributos** (`percentualRepasse` × tarifa SCEE da distribuidora sem ICMS) — atrelado ao mercado SCEE.

**Princípios:**
- **Combinação livre** entre as 3 (proprietário pode ter `valorFixoMensal=R$ 5.000` + `percentualRepasse=10%` simultaneamente).
- **NÃO é "% lucro líquido"** — proprietário não vê despesas operacionais do parceiro (compliance/transparência limitada por contrato).
- **Tarifa de referência** vem de `TarifaConcessionaria` (já existe modelo).

**Implicações.**
- Schema atual já tem `valorFixoMensal` + `valorPorUnidade` + `percentualRepasse` — não precisa migrar.
- Cron mensal precisa ser criado (`gerarLancamentoMensal` só roda no `create()` hoje).
- Tela `/proprietario` mostra cálculo discriminado das 3 parcelas.
- Hardcode `R$ 0,50/kWh` em `usinas.service.ts:503,525` precisa ser removido.

---

### Decisão 4 — Assinafy + 5 documentos do sistema

**Contexto.** Hoje `motor-proposta.service.ts:1192` tem `enviarAprovacao()` fake (só `console.log`). Assinatura digital é por campos no model (`termoAdesaoAssinadoEm`, `procuracaoAssinadaEm`), não passa por provedor de assinatura legalmente válido. Termo de adesão (`web/app/assinar/page.tsx`) cita "RN 482/2012" defasada.

**Decisão final.**

- **Provedor:** Assinafy (assinatura digital com validade jurídica brasileira).
- **5 documentos do sistema:**
  1. **Proposta Comercial** (gerada pelo Motor, hoje só PDF preview)
  2. **Termo de Adesão** (entre membro e parceiro)
  3. **Termo de Responsabilidade** (sobre uso da plataforma e dados)
  4. **Procuração** (membro autoriza parceiro a representá-lo perante distribuidora — atualizar pra Lei 14.300/RN 1.000/2021)
  5. **Contrato** (formalização final do vínculo)
- **Admin do parceiro escolhe** quais documentos usar e pode **agrupar pra 1 assinatura** (uma única jornada de assinatura cobrindo múltiplos documentos).
- **SISGD oferece templates iniciais**; cada parceiro customiza com sua marca e regras locais.

**Justificativa.** Assinafy resolve validade jurídica + traceability. Modelo "templates SISGD + customização do parceiro" replica o pattern já usado em `ModeloMensagem` (WA) e `ModeloDocumento`.

**Implicações.**
- Vira **Sprint 3** da nova pilha.
- Resolve débitos D-30H (termo cita RN 482/2012) e D-30I (bot cita RN 482/2012).
- Schema: novos tipos `TERMO_ADESAO`, `TERMO_RESPONSABILIDADE`, `PROCURACAO_ANEEL` em `ModeloDocumento` (P0-03 do débito atual).

---

### Decisão 5 — Caso Exfishes (descoberta crítica)

**Contexto.** Luciano apresentou na sessão 4 planilhas Excel + 1 PDF de um cooperado real (referido aqui como "Exfishes" para anonimização parcial — UC e números preservados, identidade ofuscada quando citada em PRODUTO/REGULATORIO).

**Os fatos do caso:**
- Em **abril de 2026**, Exfishes ocupava **39,55% da Usina A (GD I)**. Limite ANEEL/distribuidoras como referência de não-concentração: **25%**. **Sistema não detectou nem alertou.**
- Em **maio de 2026**, alguém realizou **realocação cega** do cooperado para Usina B (GD III).
- A mudança fez a fatura saltar de **~R$ 6.600/mês** (média) para **R$ 32.486/mês** (mês imediato pós-realocação).
- **Prejuízo estimado:** R$ 310.000/ano se a realocação não fosse revertida rapidamente.
- **Status atual** (informado por Luciano em sessão): Exfishes está com 0,05% na Usina B "queimando saldo"; plano é mover 100% pra Usina A.

**A descoberta estrutural.**
1. Sistema não tem **validação de concentração 25%** por cooperado-usina (D-30A).
2. Sistema não tem **detecção de mudança de classe GD** na realocação (D-30B).
3. **Saldo grande não é monitorado** (Exfishes acumulou 118.153 kWh ≈ 1,6 meses de consumo do cooperado).

**Investigação adicional na sessão (Luciano + dados do banco):** outras concentrações suspeitas existem hoje:
- **FIGATTA**: 35% na Usina GD II (55.000 kWh / 157.000 kWh).
- **CRIAR Centro de Saúde**: 16% na mesma Usina GD II (25.000 kWh).
- **Agregado FIGATTA + CRIAR**: 51% em apenas 2 cooperados na mesma usina.

**Decisão.** Sprint 0 (Auditoria Regulatória Emergencial) foi criado como P0 urgente, **podendo rodar antes de Doc-0 fechar**.

**Implicações.**
- Caso Exfishes vira **Caso A do Apêndice C** do PRODUTO.md e **Caso A da Seção 16** do REGULATORIO-ANEEL.md (anonimizado).
- 2 débitos P0 (D-30A, D-30B) + 6 P1/P2/P3 derivados.
- **Risco regulatório ativo em produção** — comunicado pra Luciano.

---

### Decisão 6 — Classe GD vem da usina, não da UC

**Contexto.** Documentação inicial sugeria que UC tinha "classe GD". Na sessão, Luciano corrigiu a interpretação: **classe GD vem da DATA DE HOMOLOGAÇÃO da usina geradora**, não da UC consumidora.

**A regra correta:**
- **Classe GD I** — usina homologada **antes** de 07/01/2023 (marco da Lei 14.300/2022).
- **Classe GD II** — usina homologada **entre 07/01/2023 e 06/01/2024** (regras transitórias, faixas de Fio B aceleradas).
- **Classe GD III** — usina homologada **a partir de 07/01/2024** (regime pleno da Lei 14.300, Fio B em 60% em 2026).

**Princípio fundamental.** **A UC herda a classe GD da usina à qual está vinculada.** Mudou de usina → mudou de classe → mudou o cálculo do Fio B → muda a fatura efetiva do cooperado.

**Justificativa.** Spec original do Assis (`docs/specs/PROPOSTA-GD1-GD2-FIOB-2026-03-26.md`) propunha enum `ModalidadeGD` na `TarifaConcessionaria`; mas a categorização correta é **por usina**, não por tarifa nem por UC.

**Implicações.**
- Schema novo: campo `Usina.classeGd` (enum GD_I/GD_II/GD_III) + `Usina.dataProtocoloDistribuidora` (DateTime).
- Cálculo de classe GD efetiva: **lookup no `Contrato.usinaId` → `Usina.classeGd`**.
- Caso Exfishes: realocação Usina A → Usina B foi mudança implícita de classe GD I → GD III, mas o sistema tratou como mudança trivial.
- Spec do Assis (26/03) é marcada como **insumo histórico** (D-30L) — sua taxonomia (`GD1_ATE_75KW`/`GD1_ACIMA_75KW`/`GD2_COMPARTILHADO`) é diferente da decisão claude.ai 30/04 (GD I/II/III por data de homologação).

---

### Decisão 7 — 5 flags regulatórias configuráveis

**Contexto.** Cada distribuidora pode ter regras locais ligeiramente diferentes (alguns aceitam mistura de classes em uma usina, outros não; alguns aceitam transferência de saldo entre UCs, outros não). Hard-coding qualquer regra única **viola realidade operacional**.

**Decisão final.** **5 flags** configuráveis por parceiro com **audit trail obrigatório** (mudança de flag gera registro em `AuditLog`):

| Flag | Default | O que controla |
|---|---|---|
| `multipleUsinasPerUc` | `false` | Permite uma UC consumir de múltiplas usinas (schema N:M Contrato↔Usina por UC) |
| `multipleClassesGdPerUc` | `false` | Permite uma UC consumir de usinas de classes GD diferentes (mix de origens) |
| `concentracaoMaxPorCooperadoUsina` | `25` (percentual) | Limite máximo de % que um cooperado pode ocupar em uma usina |
| `misturaClassesMesmaUsina` | `false` | Permite cooperados de classes GD diferentes na mesma usina (raro, mas possível em casos especiais) |
| `transferenciaSaldoEntreUcs` | `false` | Saldo intransferível entre UCs por padrão (ANEEL: cada UC tem saldo próprio em SCEE) |

**Princípio fundamental.** **Saldo é por par (UC, Usina, mês)**, não por cooperado nem por contrato. Todas as flags pressupõem isso.

**Justificativa.** Flags refletem regras locais de distribuidora. Default conservador (todas em `false` exceto a de concentração que tem valor numérico). Audit trail garante rastreabilidade quando alguém ativa uma flag.

**Implicações.**
- Novo modelo `RegrasFioB` no schema (tabela com regras vigentes por classe GD por ano).
- Novo modelo `ConfigRegulatoriaParceiro` (1:1 com `Cooperativa`) com as 5 flags.
- Validações no **Motor.aceitar()** + **alocarListaEspera()** + **gerarCobrancaPosFatura** consultam essas flags.
- UI nova: `/parceiro/configuracoes/regulatorio` com toggle de cada flag e campo numérico do `concentracaoMax`.
- Documentadas em `docs/REGULATORIO-ANEEL.md` Seção 8.

---

### Decisão 8 — Política de Alocação por Faixas

**Contexto.** Hoje a alocação é **manual** — Marcos (admin) pega cooperado da `ListaEspera`, escolhe usina compatível, atribui. Sem regra estruturada, o caso Exfishes acontece.

**Decisão final.** Modelo `PoliticaAlocacao` com **faixas configuráveis** por parceiro:

```
Pequenos consumidores (até 500 kWh/mês)  → Usinas GD II (sentem menos Fio B)
Médios (500-2.000 kWh/mês)               → Usinas GD I ou GD II conforme disponibilidade
Grandes (acima de 2.000 kWh/mês)         → Usinas GD I (máximo benefício de Fio B isento)
```

**Estrutura da decisão:**
- **Padrão SISGD** publicado (faixas + regras acima).
- **Customização por parceiro** (cada parceiro pode definir faixas próprias).
- **Simulação prévia obrigatória** (antes de alocar, sistema mostra "se mover X cooperado para Usina Y, sua concentração ficará em Z%").
- **Migração controlada** (quando muda política, cooperados existentes não migram automaticamente — Engine de Otimização sugere realocações em lote).

**Implicações.**
- Vira parte da **Sprint 8** (Política + Engine de Otimização).
- Tabela `PoliticaAlocacao` com colunas configuráveis: `parceiroId`, `faixaMin`, `faixaMax`, `classeGdPreferida`, `usinasElegiveis[]`.
- Tela `/parceiro/configuracoes/politica-alocacao`.

---

### Decisão 9 — Engine de Otimização com Split

**Contexto.** Sem otimização automática, parceiros têm que monitorar manualmente concentrações, mudanças de classe GD, saldos acumulados. Caso Exfishes mostra que mesmo o admin experiente erra.

**Decisão final.** **Engine de Otimização com Split** que:

1. **Algoritmo** — minimiza custo total da operação respeitando:
   - Concentração ≤ flag `concentracaoMaxPorCooperadoUsina`.
   - Política de Alocação por Faixas em vigor.
   - Capacidade da usina (`kwhContrato` ≤ `Usina.capacidade`).
   - Compatibilidade ANEEL (mesma distribuidora UC×Usina).
   - **Estabilidade mínima** (cooperado alocado há < 3 meses não migra — anti-rebalanceamento agressivo).

2. **Split** — uma UC pode ser dividida entre **múltiplas usinas** (controlado por flag `multipleUsinasPerUc`). Útil para grandes consumidores que excedem capacidade de uma usina.

3. **Modos:**
   - **Sugestão (default)** — engine sugere realocações em painel; admin aprova caso a caso.
   - **Automático com guard-rails** — engine executa realocações pequenas (até X% por mês) automaticamente; grandes precisam aprovação. **Default OFF** (decisão pendente — Luciano confirma).

4. **Recálculo** — periódico (mensal) + sob demanda (trigger admin).

**Implicações.**
- Vira parte da **Sprint 8**.
- Modelo `AlocacaoOtima` com snapshot do estado calculado.
- Algoritmo de otimização provavelmente programação linear ou heurística greedy + busca local.
- Painel `/parceiro/alocacao` com sugestões + aprovação.

---

### Decisão 10 — Motor de Diagnóstico Pré-Venda

**Contexto.** Hoje o funil de captura é `/cadastro` + `/entrar` + `/convite/[codigo]`. Lead chega, é captado, mas não tem ferramenta de **diagnóstico pré-venda** (analisar conta de luz e mostrar economia projetada antes de virar cooperado).

**Decisão final.** **Motor de Diagnóstico Pré-Venda** como funcionalidade pública.

**Funil completo:**
1. Lead acessa `/diagnostico` (rota nova).
2. Faz upload de fatura PDF/imagem ou cola dados manualmente.
3. Pipeline ingestão (já existe — `faturas.service.ts:extrairOcr`) processa.
4. Motor de análise (regras + LLM híbrido) gera relatório.

**Versões:**
- **Express grátis** — análise resumida em <30s, mostra economia estimada e sugere plano. Inclui captcha + rate limit anti-abuso.
- **Completo pago** (sugestão R$ 199-499 — validar com mercado) — relatório aprofundado: comparativo vs plano FIXO/COMPENSADOS/DINAMICO, breakdown de Fio B por classe GD, projeção 2026-2029, recomendação personalizada de usina.

**Anti-abuso:** captcha + rate limit (X requests/IP/dia) + cookie de sessão.

**Conflito a resolver:** já existe `GET /faturas/diagnostico` no backend, mas é **healthcheck técnico** (config_tenant, faturas, bucket). Decisão: **renomear o existente para `/faturas/healthcheck`** antes de Sprint 9 (D-30K).

**Implicações.**
- Vira **Sprint 9** (último da pilha pré-produção).
- Nova rota pública `/diagnostico` (frontend) + `/diagnostico/*` endpoints (backend).
- Vira **gancho de vendas concreto** — lead recebe valor antes de ser cooperado.

---

### Decisão 11 — REGULATORIO-ANEEL.md como 4º documento do Doc-0

**Contexto.** Decisão original do Doc-0 (Fatia 1) foi hierarquia 3 níveis: CLAUDE.md (operacional) + PRODUTO.md (humano) + SISTEMA.md (técnico). A profundidade regulatória descoberta na sessão 30/04 (5 flags + classes GD + Fio B + política + engine + diagnóstico + caso Exfishes) extrapola o que cabe em PRODUTO.md sem inflar.

**Decisão final.** **4 documentos no Doc-0:**

```
docs/
├── CLAUDE.md           — instruções operacionais Claude Code
├── PRODUTO.md          — visão humana e funcional do SISGD (11 camadas + 4 apêndices)
├── SISTEMA.md          — mapa técnico (44 módulos, 152 telas, 80 models, schema)
└── REGULATORIO-ANEEL.md — manual técnico-regulatório (18 seções em 4 partes)
```

**Cross-references obrigatórias:**
- PRODUTO.md → REGULATORIO-ANEEL.md (Camada 5b "Regulação ANEEL — referência curta", Camada 11 "Motor Diagnóstico").
- REGULATORIO-ANEEL.md → PRODUTO.md (visão humana de cada flag/política).
- Ambos → SISTEMA.md (schema + endpoints quando técnico).

**Justificativa.** Audiências distintas:
- PRODUTO.md = Luciano + visão de produto.
- SISTEMA.md = devs + revisão arquitetural.
- REGULATORIO-ANEEL.md = devs implementando Sprints 0/5/8/9 + advogado validando premissas.

**Implicações.**
- **Disclaimer pesado em REGULATORIO-ANEEL.md** — não substitui consultoria jurídica especializada.
- Recomendação explícita de validação local com cada distribuidora antes de ativar funcionalidades regulatoriamente sensíveis.

---

### Decisão 12 — CONTROLE-EXECUCAO.md como arquivo vivo

**Contexto.** Doc-0 entrega documentos de longa duração (PRODUTO/SISTEMA/REGULATORIO). Estado atual de execução (qual sprint, quais débitos abertos, próximos passos) precisa ser **atualizado a cada sessão** sem poluir os docs principais.

**Decisão final.** Criar `docs/CONTROLE-EXECUCAO.md` como **arquivo vivo único** que:
- Lista status atual de cada Fatia do Doc-0 (concluída/pendente).
- Lista status atual de cada Sprint (não iniciado/em andamento/concluído).
- Captura **decisões cronológicas** das sessões claude.ai e Code (resumidas, com link pra captura completa em `docs/sessoes/`).
- Lista **decisões pendentes** aguardando Luciano.
- Lista **próximos passos imediatos**.
- Tem instruções de **como retomar** (frase de retomada para próxima sessão claude.ai e próxima sessão Code).

**Princípio:** atualizar em **toda sessão** (claude.ai e Code). Quem entra novo lê esse 1 arquivo + memory persistente e tem contexto completo em <5 minutos.

**Implicações.**
- Substitui informalmente `MAPA-INTEGRIDADE-SISTEMA.md` como bússola estrutural curta (MAPA continua sendo log cronológico técnico).
- Mencionado no fim de PRODUTO.md, REGULATORIO-ANEEL.md, e na Fatia 4 (CLAUDE.md refator).

---

### Decisão 13 — Sprint 0 Auditoria Regulatória Emergencial

**Contexto.** Casos Exfishes + FIGATTA + CRIAR provam que **risco regulatório está ativo em produção hoje**. Esperar Doc-0 fechar pra agir é negligência.

**Decisão final.** **Sprint 0** criado como **P0 urgente, paralelo ao Doc-0**.

**Escopo:**
- Listar todas as UCs ativas com **classe GD declarada × classe GD real** (cruzar `Uc.id → Contrato.usinaId → Usina.dataHomologacao`).
- Listar **concentrações > 25%** por cooperado-usina.
- Listar UCs com **saldo > 2 meses** (proxy: agregar `Cobranca.kwhCompensado` recente vs consumo médio).
- Listar **UCs sem data de protocolo** (campo `Usina.dataProtocoloDistribuidora` ainda inexistente — precisa criar antes da auditoria).

**Entrega:**
- Relatório executivo (1 PDF + 1 dashboard temporário em `/dashboard/super-admin/auditoria-regulatoria`).
- **Plano corretivo** caso a caso (qual cooperado realocar, qual saldo "queimar", quais UCs regularizar).

**Estimativa:** 1 semana de Code dedicado.

**Dependências:** nenhuma (pode rodar enquanto Doc-0 Fatias 3/4/5 são escritas).

**Implicações.**
- Caso Exfishes vira **caso teste** da auditoria.
- Resolve sintoma **antes** do Sprint 5 (Módulo Regulatório ANEEL) implementar a estrutura completa.
- Tem upside imediato: identificar outros casos suspeitos antes que virem prejuízo.

---

## RESPOSTAS A PERGUNTAS PENDENTES (P1-P4 da sessão)

### P1 — Status Exfishes hoje

**Resposta:** 0,05% na Usina B (GD III) "queimando saldo". Plano: passar 100% pra Usina A (GD I) assim que saldo atual for consumido. Decisão de produto: **não realocar saldo** entre UCs (flag `transferenciaSaldoEntreUcs=false`). Cooperado precisa esperar saldo zerar.

### P2 — Regras de mistura de classes GD

**Resposta:** flags `multipleClassesGdPerUc` e `misturaClassesMesmaUsina` controlam. Default ambas em `false` (regulação ANEEL conservadora). Ativação caso a caso, **com validação local com a distribuidora**.

### P3 — Quem decide alocação hoje

**Resposta:** Marcos, manualmente. Caso Exfishes prova que **ninguém lembrou da mudança GD I → GD III** quando trocou de Usina A para Usina B. Por isso Engine de Otimização (Sprint 8) entra como **modo Sugestão default** — admin aprova, mas sistema avisa.

### P4 — Estratégia de alocação geral

**Resposta:**
- Pequenos (até 500 kWh) → GD II (sentem menos Fio B mas têm faixas progressivas).
- Médios (500-2.000) → GD I ou GD II conforme disponibilidade.
- Grandes (acima de 2.000) → GD I (Fio B isento).

Esta é a **política padrão SISGD** — cada parceiro pode customizar.

---

## INSUMOS UTILIZADOS NA SESSÃO

- **234 KB de documentação histórica** anexada (SISGD-VISAO, COOPEREBR-ALINHAMENTO, RAIO-X, MAPA-INTEGRIDADE, débitos, plano).
- **Diagnóstico de fatura real** (Luciano, UC `000142138005470`, EDP-ES, mês 2026-03 — `docs/sessoes/2026-04-30-diagnostico-fatura-real.md`, commit `5ae9dfd`).
- **4 planilhas Excel + 1 PDF** da Exfishes (não versionados — fonte primária do caso real).
- **Mapeamento regulatório existente** (`docs/sessoes/2026-04-30-mapeamento-regulatorio-existente.md`, commit `71dce8b`).
- **Validação INVs 4-8** (sessão 29/04, `docs/sessoes/2026-04-29-validacao-invs-4-8.md`).
- **Investigação Motor de Proposta** (sessão 29/04, `docs/sessoes/2026-04-29-investigacao-motor-proposta.md`).
- **Investigação Cadastro+OCR+Motor** (sessão 29/04, `docs/sessoes/2026-04-29-investigacao-cadastro-ocr-motor.md`).
- **Leitura Total Parte 1+2** (sessão 28/04).

---

## LIMITAÇÕES DESTA CAPTURA

- Esta captura sintetiza decisões **estruturantes**. Trocas finas durante a sessão (sugestões abandonadas, hipóteses revisadas) não estão aqui.
- **Premissas regulatórias** (limite 25%, transição GD II/III, mistura de classes) precisam **validação com advogado especializado em ANEEL** antes de ativação em produção. Disclaimer reforçado em REGULATORIO-ANEEL.md.
- **Sugestão de preços** do Diagnóstico Completo (R$ 199-499) é **chute educado** — validar com mercado real.

---

*Documento histórico. Snapshot da sessão claude.ai 2026-04-30. Não atualizar — captura imutável.*
