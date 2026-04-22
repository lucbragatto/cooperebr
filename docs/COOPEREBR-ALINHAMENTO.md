# COOPEREBR — DOCUMENTO DE ALINHAMENTO

**Data:** 21/04/2026
**Propósito:** documento único, definitivo, consolidado. Arraste este arquivo em qualquer sessão futura com Claude (claude.ai). Em 5 minutos, o contexto está completo.

**Fontes consolidadas:**
- RAIO-X-PROJETO.md (gerado pelo Claude Code, baseado em código real, commit `9e409bc`)
- Discussões de arquitetura de negócio (sessão 20-21/04/2026)
- Schema Prisma + CONTEXTO-CLAUDEAI.md + ARQUITETURA-RESUMO.md

---

## PARTE 1 — O QUE É O PROJETO (1 página)

### Definição em uma frase

**CoopereBR é uma plataforma SaaS multi-tenant** que permite que cooperativas, consórcios, associações e condomínios operem serviços de **Geração Distribuída de energia solar (GD)** pra seus membros, com gestão completa do ciclo (cadastro → contrato → cobrança → pagamento → fidelidade).

### Os atores (quem é quem)

| Ator | Papel | Quantidade hoje |
|------|-------|-----------------|
| **Dono da plataforma** | Empresa (a ser formalizada) de Luciano. Vende o SaaS pros parceiros. | 1 |
| **Parceiros** | Cooperativas/consórcios/associações/condomínios que assinam a plataforma | 5 no banco (1 é lixo de teste) |
| **Membros** (cooperados, associados, etc.) | Usuários finais dos parceiros. Recebem energia descontada. | 125 no banco, distribuídos entre parceiros |
| **Concessionárias** | EDP-ES e outras. Emitem créditos GD. Enviam faturas. | Integração via OCR de faturas PDF |
| **Gateway de pagamento** | Asaas (PIX + boleto) | 1 config ativa, **nunca usado em produção real** |

### Parceiros existentes no banco hoje

| # | Nome | Tipo | Plano SaaS | Membros | Usinas |
|---|------|------|------------|---------|--------|
| 1 | **CoopereBR** | COOPERATIVA | PRATA (R$5.900/mês) | 89 | 6 |
| 2 | Consórcio Sul | CONSORCIO | nenhum | 23 | 1 |
| 3 | CoopereVerde | COOPERATIVA | nenhum | 3 | 1 |
| 4 | CoopereBR Teste | COOPERATIVA | nenhum | 5 | 2 |
| 5 | "aaaaaaa" | CONDOMINIO | TRIAL | 0 | 0 (LIXO DE TESTE — excluir) |

**CoopereBR é o parceiro principal**, não o dono da plataforma. É a vitrine — primeira cooperativa a usar o sistema de verdade. O nome do sistema ficou do parceiro que puxou, mas o sistema é uma **plataforma** que pode (e deve) atender N parceiros.

---

## PARTE 2 — QUEM PAGA QUEM (modelo financeiro completo)

Esta é a **chave mestra** do sistema. Se você (Luciano) errar aqui, erra tudo.

### Dois circuitos financeiros independentes

**CIRCUITO 1 — PARCEIRO ↔ MEMBROS (dinheiro que NÃO é do dono da plataforma)**

Membro paga mensalidade → Asaas do parceiro → Conta bancária DO PARCEIRO → Parceiro paga suas despesas (arrendamento de usina, manutenção, funcionários dele).

⚠ Esse dinheiro NÃO passa pela conta do dono da plataforma.

**CIRCUITO 2 — PLATAFORMA ↔ PARCEIROS (dinheiro que É do dono da plataforma)**

Dono da plataforma emite FaturaSaas → Parceiro paga → Conta bancária DO DONO → Dono paga suas despesas (Supabase, Anthropic API, salários dos devs, marketing).

✓ Esta é a única receita da empresa da plataforma.

### Modelos de cobrança do SaaS (Circuito 2)

O dono cobra dos parceiros combinando qualquer um destes (via `PlanoSaas`):

| Componente | Campo schema | Exemplo |
|------------|--------------|---------|
| **Taxa fixa mensal** | `mensalidadeBase` | R$ 5.900 |
| **% da receita** | `percentualReceita` | 25% do que o parceiro recebe dos membros |
| **Limite de membros** | `limiteMembros` | Até X membros; acima disso, upgrade |
| **Taxa sobre tokens** | `taxaTokenPerc` | % sobre CooperToken emitido pelo parceiro |
| **Setup inicial** | `taxaSetup` | Taxa de adesão, paga uma vez |
| **Módulos habilitados** | `modulosHabilitados` | Habilita/desabilita CooperToken, Clube, MLM |

**Hoje cadastrados:**
- PRATA: R$ 5.900/mês + 25% receita, sem limite de membros
- OUTRO: R$ 9.999/mês + 20% receita, sem limite de membros

### O problema crítico #1

**`FaturaSaas` tem 0 registros no banco.** Nunca foi emitida. Não existe cron que gere automaticamente. Mesmo a CoopereBR (que tem plano PRATA vinculado) nunca foi cobrada.

Resultado: **a empresa da plataforma tem R$ 0 de receita formal até hoje**.

Isso é o **primeiro buraco** do sistema. Não é bug — é **funcionalidade nunca implementada**. É o que vai virar **Ticket 10** (ou o nome que você der) em Sprint 6.

---

## PARTE 3 — O QUE O SISTEMA TEM (inventário honesto)

### Resumo quantitativo

- **80+ models Prisma** (entidades do banco)
- **44 módulos backend** (NestJS)
- **80+ páginas frontend** (Next.js)
- **24 cron jobs** agendados
- **44+ rotas no sidebar** (distribuídas por role)

### Distribuição de saúde por módulo (semáforo)

#### 🟢 FUNCIONAIS E LIGADOS (fluxos ativos com dados)

| Módulo | Evidência |
|--------|-----------|
| Cadastro de membros | 125 cooperados, ciclo de vida funcionando |
| UCs e usinas | 108 UCs, 10 usinas, contratos ligando os dois |
| Contratos | 73 contratos ativos, snapshots funcionando (Sprint 5 T3) |
| Motor de Proposta | 4 propostas, cálculo com Tipo I/II (Sprint 5 T2) |
| Lista de Espera | 32 na fila, fluxo ativo |
| WhatsApp bot | 43 conversas, 531 mensagens trocadas |
| OCR de faturas (Claude AI) | 8 faturas processadas |
| Cobranças com multa/juros | 30 cobranças, 3 crons rodando (2AM, 3AM, 6:15AM) |
| Notificações | 37 notificações criadas |
| Indicações MLM (parcial) | 10 indicações registradas |
| LancamentoCaixa | 35 lançamentos — núcleo financeiro funciona |
| PlanoContas | 24 categorias cadastradas |

#### 🟡 FUNCIONAL MAS DESCONECTADO (existe, mas não flui)

| Módulo | Por que está solto |
|--------|-------------------|
| **Asaas (pagamentos)** | 1 config, **0 customers, 0 cobranças**. Cooperados pagam por fora (PIX manual). |
| **Planos SaaS** | 2 planos cadastrados, 0 faturas emitidas. CoopereBR nunca foi cobrada. |
| **Integração bancária BB/Sicoob** | Controllers, webhooks e cron existem. **0 configs, 0 cobranças.** |
| **GeracaoMensal → Cobrança** | 15 geracões manuais, mas as 30 cobranças não referenciam. Cálculo está ilhado. |
| **FaturaProcessada → Cobrança** | OCR extrai 8 faturas, mas `cobrancaGeradaId` sempre null. Manual depois. |
| **TransferenciaPix (PIX excedente)** | 5 registros existem, guardada por env var `ASAAS_PIX_EXCEDENTE_ATIVO` (off em prod). |
| **Audit trail (HistoricoStatusCooperado)** | Código existe, mas 0 registros. Não dispara em todos os caminhos. |

#### 🟠 PARCIAL / ESQUELETO (esqueleto escrito, zero uso)

| Módulo | Situação |
|--------|----------|
| **CooperToken** | Ledger tem 6 registros (testes), saldos 3, **mas 0 configs, 0 compras, 0 ofertas**. Fluxo não completa. |
| **Clube de Vantagens** | 1 config, **0 ofertas, 0 resgates, 0 histórico**. Ninguém resgata porque não há o que resgatar. |
| **Convênios** | Modelo completo no schema (faixas progressivas, benefícios). **0 contratos, 0 membros, 0 histórico**. |
| **ConviteIndicacao** | Nenhum convite enviado ainda. |
| **Agregadores (Hangar Academia)** | 1 administradora, 0 operações. Enum `PerfilUsuario.AGREGADOR` existe mas painel não. |

#### 🔴 MORTO (código escrito, nunca completou ciclo)

| Módulo | Estado |
|--------|--------|
| **Prestadores** | 0 registros. Para ocorrências. |
| **UsinaMonitoramento** (Sungrow) | 0 configs, 0 leituras, 0 alertas. **Cron roda a cada minuto sem fazer nada.** |
| **NPS** | 0 respostas. |
| **LeadExpansao** | 0 leads capturados. |
| **ContratoUso (arrendamento)** | 0 registros. Arrendamento de usina hoje é manual, fora do sistema. |
| **FormaPagamentoCooperado** | 0 registros. |
| **ObservacaoAtiva** (auditoria) | 0 registros. |
| **ModeloDocumento** | 0 registros. |

---

## PARTE 4 — OS 14 FLUXOS DE NEGÓCIO E SEU ESTADO

Extraído dos diagramas Mermaid da Seção 6 do RAIO-X.

| # | Fluxo | Estado | Observação |
|---|-------|--------|-----------|
| 1 | Cadastro de membro | 🟢 Funciona | 125 no banco |
| 2 | Ciclo de vida do cooperado (status) | 🟡 Funciona mas audit trail vazio | HistoricoStatusCooperado = 0 |
| 3 | Cadastro de UC | 🟢 Funciona | 108 UCs |
| 4 | Motor de proposta — calcular | 🟡 Funciona mas 2 versões | `calcular()` legado + `calcularComPlano()` novo |
| 5 | Motor de proposta — aceitar | 🟢 Funciona (Sprint 5 T3) | Snapshots no contrato |
| 6 | Pipeline OCR de faturas | 🟡 Funciona mas bugs | 3 tickets abertos (tarifas B3, campos GD, normalização) |
| 7 | Email → OCR → FaturaProcessada | 🟡 Funciona mas 2 crons competindo | legacy 5min + novo 6AM |
| 8 | Geração de cobrança | 🟡 Manual | Admin gera por botão, não automático mensal |
| 9 | Ciclo de vencimento + multa | 🟢 Funciona | 3 crons diários |
| 10 | Webhook Asaas | 🔴 Nunca recebeu evento real | Asaas não usado em prod |
| 11 | Webhook bancário BB/Sicoob | 🔴 Nunca recebeu evento real | Configs vazias |
| 12 | WhatsApp — envio de cobran��as | 🟢 Funciona | Cron mensal + diário |
| 13 | PIX excedente | 🟡 Guardado por env var | 5 registros históricos |
| 14 | Cascata de desconto (4 níveis) | 🟢 Funciona | Core do motor de cobrança |

### O fluxo que deveria existir e NÃO existe

| # | Fluxo ausente | Impacto |
|---|---------------|---------|
| **A** | **FaturaSaas gerada mensal automaticamente** | Dono da plataforma cobra parceiros → única receita do negócio |
| **B** | Cobrança gerada disparando Asaas automático | Pagamentos de membros são manuais hoje |
| **C** | Cobrança paga gerando LancamentoCaixa SAIDA | Fluxo de caixa pode não refletir realidade |
| **D** | ContaAPagar paga gerando LancamentoCaixa ENTRADA | Mesmo problema pelo lado oposto |
| **E** | Onboarding self-service de parceiro novo | Hoje provavelmente é manual (SQL + config) |
| **F** | Ativação de CooperToken fim-a-fim | Cooperado não vê saldo, não usa, não resgata |
| **G** | Consolidação financeira do dono da plataforma | Não tem dashboard separado mostrando receita da empresa da plataforma |

---

## PARTE 5 — OS 10 BURACOS PRIORITÁRIOS

Consolidados dos GAPs do RAIO-X + análise arquitetural.

### Buraco 1 — Receita inexistente do SaaS ~~(CRÍTICO)~~ RESOLVIDO

**Resolvido:** Sprint 6 Ticket 10 (`fd35c0d`). Cron `@Cron('0 6 1 * *')` gera FaturaSaas mensal. Primeira fatura será emitida dia 01/05/2026.

### Buraco 2 — Asaas não opera em produção (EM ANDAMENTO)

**Sprint 7 em progresso (22/04/2026):**
- Fase A completa: 82 cooperados validados (CPF/CNPJ + email), 0 problemas
- Script batch criado: `backend/scripts/asaas-criar-customers-batch.ts` (dry-run OK, 9 batches)
- **Bloqueado:** Luciano precisa abrir conta Asaas (sandbox ou prod) e cadastrar API key
- Próximo: rodar `--real` após conta aberta

### Buraco 3 — Separação de painéis Dono vs Parceiro

**Evidência:** sidebar tem "Dashboard Financeiro", "Contas a Receber" que são do parceiro. **Não existe painel separado pro dono da plataforma ver receita da empresa da plataforma.**
**Impacto:** você não consegue ver, num só lugar, quanto a plataforma tá faturando de todos os parceiros.
**Tamanho:** M (3-4 dias).
**Dependências:** rotas `/super-admin/financeiro` novas. Filtro de permissão por SUPER_ADMIN.

### Buraco 4 — Onboarding manual de parceiro novo

**Evidência:** não existe fluxo auto-provisionamento de Cooperativa.
**Impacto:** pra vender pra novo parceiro, Luciano precisa rodar SQL, criar admin, configurar Asaas dele, configurar plano SaaS. **Não escala.**
**Tamanho:** L (1-2 semanas).

### Buraco 5 — GeracaoMensal desconectada de Cobrança

**Evidência:** 15 geracões manuais, 30 cobranças, mas `Cobranca.geracaoMensalId` raramente preenchido.
**Impacto:** cobrança gerada não reflete geração real da usina. Cálculo fica aproximado.
**Tamanho:** M.

### Buraco 6 — CooperToken nunca completa ciclo

**Evidência:** 6 ledger, 3 saldos, **0 configs, 0 ofertas, 0 resgates, 0 compras**.
**Impacto:** diferencial competitivo do produto está no schema mas invisível pro membro final.
**Tamanho:** L (sprint dedicada).

### Buraco 7 — Clube de Vantagens não transaciona

**Evidência:** 1 config, 0 ofertas cadastradas, 0 resgates.
**Impacto:** menu existe, admin não consegue popular, parceiros externos (nutricionista, academia) não estão ligados.
**Tamanho:** M.

### Buraco 8 — Multi-tenant vazando ~~(5 órfãos)~~ RESOLVIDO

**Resolvido:** Sprint 6 Ticket 11 (`a749bd4`). 2 órfãos movidos pra CoopereBR, 3 lixo deletados, cooperativa "aaaaaaa" deletada. 0 órfãos restantes.

### Buraco 9 — OCR retorna dados sujos ~~(Tickets 6, 7, 8)~~ RESOLVIDO

**Resolvido:** Sprint 6 Tickets 6, 7, 8 (`5f32eca`). Prompt melhorado (tarifas B3, anti-alucinação GD) + pós-processamento (numeroUC normalizado, mesReferencia YYYY-MM). Fixtures regeneradas (`e18b0d9`).

### Buraco 10 — Audit trail HistoricoStatusCooperado vazio — NÃO É BUG

**Resolvido:** Sprint 6 Ticket 12. Código existe em `cooperados.service.ts:721` e dispara corretamente. Os 0 registros são porque os 125 cooperados foram importados direto no banco, sem passar pelo fluxo de mudança de status. Próximas mudanças reais vão popular a tabela automaticamente.

---

## PARTE 6 — DECISÕES ARQUITETURAIS IMPORTANTES

Capturadas do RAIO-X seção 8 + discussões do sprint. **Se não souber uma destas, eu faço pergunta errada.**

### Sobre cobrança e desconto

- **tipoDesconto:** `APLICAR_SOBRE_BASE` (Tipo I — desconto % sobre base escolhida) vs `ABATER_DA_CHEIA` (Tipo II — abate valor absoluto da conta cheia). Escolhido na Sprint 5 T2.
- **Cascata de desconto:** Contrato.descontoOverride → ConfiguracaoCobranca(usina) → ConfiguracaoCobranca(cooperativa) → ERRO. Plus `resolverDescontoConvenio` como adicional.
- **Snapshot no contrato:** ao aceitar proposta, copia valores do plano (`valorContrato`, `tarifaContratual`, `descontoPromocionalAplicado`). Plano pode mudar depois sem afetar contratos ativos.
- **Fio B:** ANEEL progressivo. 2026 = 60%. 2027 = 75%. 2028 = 90%. 2029+ = 100%.

### Sobre multi-tenant

- Toda query Prisma **deve** filtrar por `cooperativaId`.
- `cooperativaId` é **nullable em alguns models** (`Contrato`, `Uc`, `Cobranca`). Isso é **bug de schema** (risco de leak). Ver Buraco 8.
- SUPER_ADMIN pode ver cross-tenant. ADMIN só vê seu próprio tenant.

### Sobre UC

- `Uc.numero` é **canônico** (`@unique`). Usado em matching.
- `Uc.numeroUC` é **legado nullable** (não usar — provavelmente vai guardar "número novo EDP" no futuro).
- OCR retorna numeroUC com pontos/hífen (`0.001.421.380.054-70`). Sistema espera normalizado (só dígitos). Ticket 8 Sprint 6.

### Sobre bloqueio de modelos

- Env var `BLOQUEIO_MODELOS_NAO_FIXO` (default true) bloqueia `CREDITOS_COMPENSADOS` e `CREDITOS_DINAMICO` em produção. Só `FIXO_MENSAL` liberado.
- Guard está espalhado em 7+ arquivos (antipattern). Ticket de refactor pra middleware central.
- T9 Sprint 5 (última pendente) ia desligar em dev.

### Sobre OCR

- `FaturaProcessada.dadosExtraidos` é JSON livre — **sem schema validation**.
- Claude AI (Anthropic) retorna 48 campos aproximadamente.
- Já temos 3 fixtures em `backend/test/fixtures/faturas/`: edp-carol.pdf, edp-moradas-enseada.pdf, edp-luciano-gd.pdf.
- Script de smoke test multi-fixture: `backend/scripts/smoke-pipeline-fatura.ts` (modo --update, --cached, padrão híbrido).

---

## PARTE 7 — ROADMAP RECOMENDADO

### Sprint 5 (fechado 8/9)

8 tarefas técnicas fechadas (T0-T8). T9 pendente (desligar `BLOQUEIO_MODELOS_NAO_FIXO`) — pode ser feita no Sprint 7 quando Asaas entrar.

### Sprint 6 — Receita e Higiene (CONCLUÍDO 21/04/2026)

| Ticket | Descrição | Commit | Status |
|---|---|---|---|
| 10 | FaturaSaas automática — cron mensal | `fd35c0d` | Fechado |
| 11 | Limpeza multi-tenant + cron Sungrow desativado | `a749bd4` | Fechado |
| 6 | OCR tarifas B3 — prompt melhorado | `5f32eca` | Fechado |
| 7 | OCR campos GD — prompt anti-alucinação | `5f32eca` | Fechado |
| 8 | OCR normalização — numeroUC + mesReferencia | `5f32eca` | Fechado |
| 9 | Campo numeroInstalacaoEDP na UC | `03742cb` | Fechado |
| 12 | Audit trail HistoricoStatusCooperado | — | Não é bug |

Estado pós-Sprint 6: 4 cooperativas, 0 órfãos, 89 testes, fixtures OCR regeneradas.

Próximo: **Sprint 7 — Asaas em Produção.**

### Sprint 7 — Asaas em Produção

1. Migrar Asaas de sandbox pra prod na CoopereBR.
2. Criar AsaasCustomer pra cada cooperado ATIVO.
3. Ao gerar Cobrança, emitir AsaasCobranca automática.
4. Webhook processar pagamento → LancamentoCaixa.
5. Tickets 1, 2, 3, 4 do backlog atual.

### Sprint 8 — Ativar CooperToken e Clube

1. Fluxo completo de emissão de token.
2. Uso de token pra abater fatura automaticamente.
3. Cadastro de OfertaClube + portal do parceiro externo.
4. Resgate fim-a-fim com notificação via WA.

### Sprint 9+ — Refinar Motor e Painéis

1. Separar painel Dono da Plataforma vs Admin Parceiro (Buraco 3).
2. Onboarding self-service de parceiro novo (Buraco 4).
3. Integração real Sungrow (Monitoramento de usinas).
4. Ticket 5 do backlog: infra E2E Playwright.

---

## PARTE 8 — COMO TRABALHAR COM CLAUDE

### Em cada sessão nova (claude.ai)

1. Arrasta este arquivo pra conversa.
2. Diz o que quer fazer hoje (ou "continua de onde paramos").
3. Claude lê em 5 min, está alinhado com modelo de negócio correto.
4. Trabalhamos direto, sem re-explicar do zero.

### Divisão de responsabilidade

| Quando | Ferramenta |
|--------|-----------|
| Executar código, rodar testes, commitar | Claude Code (terminal) |
| Decisão técnica pura | Claude Code decide, comunica motivo |
| Decisão de produto | Claude.ai pergunta antes |
| Revisão arquitetural | Claude.ai (30 min objetiva) |
| Alinhamento de prioridades | Claude.ai (uma vez por sprint) |

### Postura do Claude

- **Tomar decisões técnicas como engenheiro.** Não devolver perguntas simples.
- **Ser exaustivo, não curado.**
- **Não resumir arquivos pedidos pra revisão humana.** Colar bruto.
- **Não inventar.** Se não sabe, dizer "DESCONHECIDO" ou "NÃO IMPLEMENTADO".

---

## PARTE 9 — PRÓXIMO PASSO IMEDIATO

Sprint 6 concluído (21/04/2026). Próxima prioridade: **Sprint 7 — Asaas em Produção.**

Objetivo: migrar Asaas de sandbox pra produção na CoopereBR, criar customers, emitir cobranças automaticamente, processar webhooks de pagamento.

T9 do Sprint 5 (desligar `BLOQUEIO_MODELOS_NAO_FIXO`) pode entrar como item do Sprint 7 — destrava COMPENSADOS/DINAMICO quando Asaas estiver pronto.

---

**FIM DO DOCUMENTO**
