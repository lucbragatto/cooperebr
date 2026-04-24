# MAPA DE INTEGRIDADE DO SISTEMA — COOPEREBR (SISGD)
**Última atualização:** 2026-04-26 (fim Sprint 11 Dia 1 — Bloco 1 da Arquitetura de UC)
**Data da auditoria inicial:** 2026-04-24
**Auditor:** Claude Sonnet 4.6 (modo somente-leitura)
**Escopo:** 10 fluxos end-to-end, análise de código + testes + lacunas

> **Metodologia:** Leitura direta de arquivos, grep estruturado e análise estática.  
> Nenhum código foi modificado. Status "IMPLEMENTADO MAS NÃO TESTADO" indica código  
> existente sem suite de testes automatizados cobrindo o fluxo real de produção.

---

## Conquistas históricas do SISGD (25/04/2026)

Sprint 10 destravou problemas silenciosos que bloqueavam o sistema há meses:

1. **Primeiro email SMTP** enviado com sucesso na história do banco (`email_logs.status='ENVIADO'` passou de 0 pra 1+)
2. **Primeiro WhatsApp automático** enviado pós-reativação do serviço (parado desde 09/04/2026)
3. **LGPD compliance** implementada (112 registros reais mascarados, whitelist de dev, flag `ambienteTeste`)
4. **CADASTRO_V2_ATIVO** desbloqueado (estava `false` por default, criava só LeadWhatsapp em vez de Cooperado+UC)
5. **3 gaps arquiteturais** identificados pra Sprint 11 ("Gargalo Crítico — Ciclo de Ativação")

---

## GAPS RESOLVIDOS NO SPRINT 10

- **P0-01** CADASTRO_V2 desligado → ✅ RESOLVIDO (commit `c4f6ebf`)
- **P1-01** Lembrete 24h proposta pendente → ✅ RESOLVIDO (`motor-proposta.job.ts`)
- **P1-02** Cópia assinada pós-assinatura → ✅ RESOLVIDO (`motor-proposta.service.ts:enviarCopiaAssinada`)
- **P1-03** Email D-3/D-1 antes vencimento → ✅ RESOLVIDO (`cobrancas.job.ts:lembretesPreVencimento`)

---

## SPRINT 11 — PROGRESSO

### Tarefa 1 — Auditoria ampla de numeração dupla UC EDP
✅ COMPLETA (commit `7583659`, 2026-04-26)

### Tarefas 2 + 3 — consolidadas em "Arquitetura de UC"

#### Bloco 1 (hoje, 2026-04-26) — Schema + Service + Forms
✅ COMPLETO. Commits:
- `f36496f` — schema: remove `numeroInstalacaoEDP`, `distribuidora` vira `DistribuidoraEnum` obrigatório com default `OUTRAS`
- `559a87d` — `ucs.service`: 3 campos + validação formato (`normalizarNumeroCanonico`, `normalizarNumeroUC`, `validarDistribuidora`, `coerceDistribuidora`)
- `39b96b8` — forms admin (`/dashboard/ucs/nova` + `/dashboard/ucs/[id]`): 3 campos, select distribuidora, tooltips, validações client-side
- `fbc75c1` — form cadastro público (`/cadastro`): campo `numeroUCLegado` opcional, `mapearDistribuidoraOcr` pré-fill

**Observação importante:** ao aplicar a troca de `distribuidora String` → `DistribuidoraEnum`, o PostgreSQL dropou os 96 valores textuais legados (91 "EDP ES" + 5 variantes). Todos viraram `OUTRAS`. Bloco 2 re-classifica via OCR.

#### Bloco 2 (amanhã) — Normalização + Pipeline + E2E
PENDENTE:
- Script de normalização dos 326 `numero` legados (formatos variados → 10 dígitos canônicos)
- Correção de `resolverUcPorNumero` em `faturas.service.ts`: OR em `numero`/`numeroUC` + AND `distribuidora`
- Prompt OCR ajustado (pedir `distribuidora` como enum, extrair ambos os formatos de número)
- Reprocessar fatura UID 2032 do Luciano via pipeline pra validar match automático

---

## GARGALO CRÍTICO — Ciclo de Ativação COMPENSADOS/DINAMICO

Identificado em 25/04/2026 por Luciano. **3 gaps P0 interconectados** que juntos bloqueiam o funcionamento real dos modelos COMPENSADOS e DINAMICO em produção.

### Gap 1 — Numeração dupla de UC EDP

EDP em transição operacional divergente:
- **Faturamento B2C** usa numeração NOVA (10 dígitos canônico). Ex: `0400702214`
- **Compensação B2B** exige numeração LEGADA (9 dígitos) nas listas enviadas pela cooperativa. Ex: `160085263`

SISGD precisa manter ambos cadastrados e tratar como cidadãos de primeira classe até EDP unificar (prazo indefinido).

Schema já tem ambos (`Uc.numero` + `Uc.numeroUC`), mas pipelines, cadastros e exports **não usam consistentemente**. Pipeline OCR identifica UCs por `numero` canônico; faturas EDP chegam com legado no filename → match falha.

### Gap 2 — Classificação de faturas COM/SEM créditos

Pipeline atual trata todas faturas EDP igualmente. **3 cenários** precisam tratamento diferente:

1. **Fatura COM créditos + UC cadastrada:** cooperado ativo recebendo compensação → alimenta cobrança (COMPENSADOS/DINAMICO)
2. **Fatura SEM créditos + UC cadastrada:** cooperado recém-cadastrado aguardando EDP homologar → **NÃO gerar cobrança** + alertar admin "verificar homologação"
3. **Fatura SEM créditos + UC NÃO cadastrada:** LEAD potencial, distribuidora enviou 2ª via mas pessoa não se cadastrou no SISGD → alerta comercial pro admin

### Gap 3 — Cadastro de email EDP obrigatório não monitorado

Pra cooperativa receber faturas, a pessoa precisa ir no portal EDP e cadastrar email da cooperativa (`contato@cooperebr.com.br`) como 2ª via.

Se não cadastra → EDP não envia → cooperativa sem dados → cooperado fica "ativo" mas sem movimento real.

**Ajustes necessários:**
- Cadastro (admin e público): alertar cooperado sobre passo obrigatório + tutorial
- Monitoramento pós-cadastro: após N dias, verificar se faturas começaram a chegar
- Alerta admin: se UC ativada há 45+ dias sem fatura recebida
- Validação de ativação COMPENSADOS/DINAMICO: ativação real só quando cooperado confirma OU primeira fatura chega
- Fallback FIXO temporário: enquanto não fluem faturas, cobrar FIXO estimado com ajuste retroativo quando começar a fluir

### Por que são interconectados

Os 3 gaps são faces do mesmo problema: **ciclo de ativação do cooperado na prática**, do cadastro no SISGD até a primeira fatura processada com créditos.

**Sem resolver os 3, COMPENSADOS e DINAMICO ficam inviáveis em produção — bloqueio absoluto.**

---

## SEÇÃO 1 — MATRIZ EXECUTIVA (10 FLUXOS)

| # | Fluxo | Status Geral | % Pronto | Bloqueia Prod? |
|---|-------|-------------|----------|---------------|
| 1 | Cadastro Cooperado | FUNCIONAL | 85% | Sim — não alerta cooperado sobre email EDP (gap P0 Sprint 11) |
| 2 | Motor de Proposta | FUNCIONAL | 85% | Parcial — lembrete 24h + cópia assinada prontos; E2E real pendente |
| 3 | Modelos de Documento | PARCIAL | 40% | Sim — só 2 tipos, sem templates reais de prod |
| 4 | Email IMAP → OCR → Cobrança | PARCIAL | 75% | Sim — pipeline NUNCA rodou ponta a ponta (0 faturas processadas na história). Correção ampla em Sprint 11 |
| 5 | Emails Transacionais | FUNCIONAL | 80% | Não — SMTP operacional (1º email histórico OK), whitelist, D-3/D-1 implementados |
| 6 | Ciclo de Cobrança Mensal | FUNCIONAL | 80% | Não — fluxo principal funcional, lacunas menores |
| 7 | Contabilidade & Financeiro | PARCIAL | 50% | Parcialmente — sem DRE, sem conciliação bancária real |
| 8 | Relatórios por Papel | PARCIAL | 60% | Não — dashboards existem, dados incompletos para alguns papéis |
| 9 | Fluxo de Usina | PARCIAL | 65% | Parcialmente — Sungrow desativado, rebalanceamento ausente |
| 10 | Clube & Tokens | PARCIAL | 70% | Não — emissão/expiração funcionais, desvalorização ausente |

---

## SEÇÃO 2 — DETALHAMENTO POR FLUXO

---

### FLUXO 1 — CADASTRO COOPERADO

#### (a) Admin Wizard `/dashboard/cooperados/novo`

| Etapa | Status | Arquivo | Gap |
|-------|--------|---------|-----|
| Step1 Upload Fatura | FUNCIONAL | `web/app/dashboard/cooperados/novo/steps/Step1Fatura.tsx` | — |
| Step2 Dados Pessoais | FUNCIONAL | `web/app/dashboard/cooperados/novo/steps/Step2Dados.tsx` | — |
| Step3 Simulação | FUNCIONAL | `web/app/dashboard/cooperados/novo/steps/Step3Simulacao.tsx` | — |
| Step4 Proposta | FUNCIONAL | `web/app/dashboard/cooperados/novo/steps/Step4Proposta.tsx` | — |
| Step5 Documentos | FUNCIONAL | `web/app/dashboard/cooperados/novo/steps/Step5Documentos.tsx` | — |
| Step6 Contrato | FUNCIONAL | `web/app/dashboard/cooperados/novo/steps/Step6Contrato.tsx` | — |
| Step7 Alocação em Usina | FUNCIONAL | `web/app/dashboard/cooperados/novo/steps/Step7Alocacao.tsx` | — |
| Conexão com Motor de Proposta | IMPLEMENTADO MAS NÃO TESTADO | `backend/src/publico/publico.controller.ts:380` | Wizard chama `calcular()` + `aceitar()` mas não há teste E2E do fluxo completo |

**% Pronto:** 80%

#### (b) Cadastro Público `/cadastro`

| Etapa | Status | Arquivo | Gap |
|-------|--------|---------|-----|
| Upload e OCR fatura | FUNCIONAL | `publico.controller.ts:514` via `POST /publico/processar-fatura-ocr` | — |
| Preenchimento dados | FUNCIONAL | `web/app/cadastro/page.tsx` | — |
| Envio para backend | FUNCIONAL | `publico.controller.ts:126` `POST /publico/cadastro-web` | `CADASTRO_V2_ATIVO=true` — cria `Cooperado` + UC real. Testado E2E manual (20/04/2026) |
| Motor de Proposta no V2 | FUNCIONAL | `publico.controller.ts:369-413` | V2 ativo, cria Cooperado + UC + Proposta |
| Indicação | FUNCIONAL | `publico.controller.ts:417-455` | Testado com ref=codigoIndicacao, Indicacao criada corretamente |

**% Pronto:** 85% (V2 ativo e testado)

#### (c) Cadastro com código de referência `/cadastro?ref=XXXX`

| Etapa | Status | Arquivo | Gap |
|-------|--------|---------|-----|
| Leitura do `codigoRef` | FUNCIONAL | `web/app/cadastro/page.tsx` lê `searchParams` | — |
| GET convite | FUNCIONAL | `publico.controller.ts:108` `GET /publico/convite/:codigo` | — |
| Registro da indicação no V1 (lead) | PARCIAL | `publico.controller.ts:271` | Processa como lead, sem criar `Indicacao` real no V1 |
| Registro da indicação no V2 | FUNCIONAL | `publico.controller.ts:416-456` | BONUS_INDICACAO só na primeira fatura paga |
| Teste E2E | NAO_EXISTE | `tests/07-convite-publico.spec.ts` | Arquivo existe mas cobre apenas fluxo WA, não cadastro web |

**% Pronto:** 65%

#### (d) Via Convite + Convênio

| Etapa | Status | Arquivo | Gap |
|-------|--------|---------|-----|
| Página de convite | FUNCIONAL | `web/app/convite/page.tsx` | — |
| API GET convite-indicacao | FUNCIONAL | `backend/src/convite-indicacao/` | — |
| Vinculação ao convênio | IMPLEMENTADO MAS NÃO TESTADO | `publico.controller.ts:422-451` | Lógica presente, sem teste de integração |
| Aceite do convite com criação de cooperado | NAO_EXISTE | — | Não há endpoint que aceite convite e crie cooperado atomicamente |

**% Pronto:** 55%

**Resumo Fluxo 1:** 85% pronto. `CADASTRO_V2_ATIVO=true` desde Sprint 10 (20/04/2026). Bug termoAdesaoAceito corrigido. Testado E2E manual: DESCONTO, CLUBE (modoRemuneracao), ref=codigoIndicacao. Pendente: teste E2E automatizado.

---

### FLUXO 2 — MOTOR DE PROPOSTA

| Etapa | Status | Arquivo | Gap |
|-------|--------|---------|-----|
| `calcular()` — Tipo I básico | FUNCIONAL | `motor-proposta.service.ts:86` | — |
| `calcular()` — Tipo II condomínio | FUNCIONAL | `motor-proposta.service.ts:271` | Testado em `motor-proposta.service.spec.ts:252` |
| Detecção de outlier | FUNCIONAL | `motor-proposta.service.ts:392` | — |
| `calcularComPlano()` | FUNCIONAL | `motor-proposta.service.ts:271` | Coberto por spec |
| `aceitar()` — criação contrato/lista espera | FUNCIONAL | `motor-proposta.service.ts:620` | Coberto por `motor-proposta.service.aceitar.spec.ts` |
| Envio de proposta (PDF) | IMPLEMENTADO MAS NÃO TESTADO | `proposta-pdf.service.ts`, `pdf-generator.service.ts` | PDF gerado mas não há teste de renderização real |
| Link de aprovação cooperado | FUNCIONAL | `motor-proposta.service.ts:1189` | `GET /aprovar-proposta?token=` e página `web/app/aprovar-proposta/` |
| Envio WA do link | IMPLEMENTADO MAS NÃO TESTADO | `motor-proposta.service.ts:1456` | `NOTIFICACOES_ATIVAS=true` necessário |
| Envio email do link | IMPLEMENTADO MAS NÃO TESTADO | `motor-proposta.service.ts:1471` | `EMAIL_USER` configurado necessário |
| Assinatura digital (TERMO + PROCURAÇÃO) | IMPLEMENTADO MAS NÃO TESTADO | `motor-proposta.service.ts:1493` | Página `web/app/portal/assinar/` existe |
| Cópia assinada enviada por email | NAO_EXISTE | — | Após ambas assinaturas, apenas invalida token. Não envia cópia para cooperado |
| Lembrete 24h (cron) | NAO_EXISTE | — | **CRÍTICO:** Nenhum cron job para relembrar propostas pendentes de assinatura |
| PDF do contrato com ModeloDocumento | PARCIAL | `motor-proposta.service.ts:1543` | Só lê modelos tipo CONTRATO/PROCURACAO, não os 5 tipos necessários para prod |

**% Pronto:** 70%. Bloqueadores: ausência de lembrete automático e cópia assinada pós-assinatura.

---

### FLUXO 3 — MODELOS DE DOCUMENTO

| Etapa | Status | Arquivo | Gap |
|-------|--------|---------|-----|
| Model `ModeloDocumento` no schema | FUNCIONAL | `schema.prisma:1392` | Campos: id, cooperativaId, tipo, nome, conteudo, variaveis, ativo, isPadrao |
| Upload de modelo | IMPLEMENTADO MAS NÃO TESTADO | `motor-proposta.service.ts:1536` | Só aceita tipo CONTRATO ou PROCURACAO |
| CRUD endpoint | FUNCIONAL | `motor-proposta.controller.ts` | GET/POST/DELETE modelos |
| Substituição de variáveis | PARCIAL | `motor-proposta.service.ts` | Apenas variáveis de proposta — não há engine de template completa |
| Tipos suportados | PARCIAL | `schema.prisma:1396` `tipo String // CONTRATO \| PROCURACAO` | **Faltam:** Termo de adesão, Termo de responsabilidade, Aceite Clube, Contrato convênio |
| Geração PDF com variáveis dinâmicas | IMPLEMENTADO MAS NÃO TESTADO | `pdf-generator.service.ts` | usa Puppeteer, funciona em ambiente com Chromium configurado |
| Templates de produção cadastrados | NAO_EXISTE | DB | Contagem impossível sem acesso ao banco, mas campo `tipo` limita a 2 tipos |

**% Pronto:** 40%. Bloqueador: tipo de modelo limitado a CONTRATO/PROCURACAO — faltam Termo de Adesão, Termo de Responsabilidade, Procuração ANEEL, Aceite Clube, Contrato Convênio.

---

### FLUXO 4 — EMAIL IMAP → OCR → COBRANÇA

| Etapa | Status | Arquivo | Gap |
|-------|--------|---------|-----|
| Cron `verificarEmailsFaturas()` | FUNCIONAL | `email-monitor.service.ts:81` | Executa 1x/dia às 6h (não 30min como comentário sugere) |
| Config IMAP por tenant (DB) | FUNCIONAL | `email-monitor.service.ts:38-77` | Fallback para env vars se não configurado no banco |
| Detecção de PDF nos anexos | FUNCIONAL | `email-monitor.service.ts:128` | `pareceSerFaturaConcessionaria()` filtra por assunto/remetente |
| OCR via Claude AI | FUNCIONAL | `faturas.service.ts:304` → `extrairOcr()` | Conectado ao modelo `claude-sonnet-4-20250514` |
| Identificação de cooperado por email | FUNCIONAL | `email-monitor.service.ts:132` | `identificarCooperado()` busca por email do remetente |
| Identificação por OCR (fallback) | FUNCIONAL | `email-monitor.service.ts:170-198` | `identificarPorOcr()` usa UC extraída |
| Criação de `FaturaProcessada` | FUNCIONAL | `faturas.service.ts:317` via `uploadConcessionaria()` | — |
| Notificação admin via WhatsApp | FUNCIONAL | `email-monitor.service.ts:152` | `notificarAdminWhatsApp()` |
| Email não identificado → fila Pendente | PARCIAL | `email-monitor.service.ts:200-230` | Move para pasta "Pendentes" no IMAP, sem notificação ao admin |
| Fluxo de aprovação admin | FUNCIONAL | Dashboard `web/app/dashboard/faturas/` | Admin aprova/rejeita FaturaProcessada |
| Geração de cobrança após aprovação | FUNCIONAL | `faturas.service.ts:445` | `gerarCobrancaFromFatura()` chamado pelo controller |
| Teste automatizado | PARCIAL | `email-monitor.service.spec.ts` | Spec existe mas testa apenas lógica interna, não integração real IMAP |

**% Pronto:** 75%. Gap não-crítico: emails não identificados não notificam admin, ficam silenciosamente em "Pendentes".

---

### FLUXO 5 — EMAILS TRANSACIONAIS

| Evento | Status | Onde é chamado | Gap |
|--------|--------|---------------|-----|
| (a) Link proposta (assinatura) | FUNCIONAL | `motor-proposta.service.ts:1471` | Depende de `EMAIL_USER` configurado |
| (b) Lembrete 24h proposta pendente | NAO_EXISTE | — | **CRÍTICO:** Não implementado |
| (c) Cópia assinada após assinatura | NAO_EXISTE | — | **CRÍTICO:** Após `assinarDocumento()` não há envio de PDF assinado |
| (d) Aprovação concessionária (cooperado ativo) | IMPLEMENTADO MAS NÃO TESTADO | `email.service.ts:77` `enviarCadastroAprovado()` | Chamado em algum fluxo de ativação |
| (e) PDF 1ª cobrança | FUNCIONAL | `cobrancas.service.ts:258` `enviarFatura()` | Com PIX/boleto embutido |
| (f) Lembrete vencimento | NAO_EXISTE | — | **CRÍTICO:** Não há cron para D-3 ou D-1 de vencimento |
| (g) Notificação atraso | FUNCIONAL | `cobrancas.job.ts:99` | Via WhatsApp (não email), `notificarCobrancasVencidas()` |
| (h) Token expirando | NAO_EXISTE | — | `cooper-token.job.ts` expira tokens, mas não notifica por email |
| (i) Convite de convênio | IMPLEMENTADO MAS NÃO TESTADO | `convite-indicacao.service.ts:105` | Envia lembrete WA, não email |
| (j) Novo parceiro ativado | NAO_EXISTE | — | Sem email de boas-vindas para novo parceiro/conveniado |

**Templates existentes** (em `email-templates.ts`): boasVindas, cadastroAprovado, fatura, confirmacaoPagamento, documentoAprovado, documentoReprovado, contratoGerado, teste.

**% Pronto:** 55%. Ausentes: lembrete de proposta (24h), cópia assinada, lembrete de vencimento D-3, notificação de token expirando, email boas-vindas parceiro.

---

### FLUXO 6 — CICLO DE COBRANÇA MENSAL

| Etapa | Status | Arquivo | Gap |
|-------|--------|---------|-----|
| `GeracaoMensal` registrada | FUNCIONAL | `geracao-mensal.service.ts:10` | Manual pelo admin ou via importação |
| Geração de cobranças por lote | FUNCIONAL | `faturas.service.ts:445` `gerarCobrancaFromFatura()` | Dispara após aprovação de FaturaProcessada |
| Anti-duplicação | FUNCIONAL | `cobrancas.service.ts:88` | Guard `findFirst` + constraint unique no schema |
| PDF da cobrança | FUNCIONAL | `cobrancas/cobranca-pdf.service.ts` | Gerado com Puppeteer |
| Envio email da cobrança | FUNCIONAL | `cobrancas.service.ts:258` | Com PIX copia-e-cola e link boleto |
| Envio WA da cobrança | IMPLEMENTADO MAS NÃO TESTADO | `whatsapp-ciclo-vida.service.ts` | Chamado via `whatsappCicloVida` |
| Exibição no portal cooperado | FUNCIONAL | `web/app/portal/financeiro/page.tsx` | Lista cobranças com status |
| Pagamento via Asaas (PIX/boleto) | FUNCIONAL | `gateway-pagamento.service.ts` | Gateway abstrato com adaptador Asaas |
| Webhook Asaas → baixa | FUNCIONAL | `asaas.controller.ts` → `pagamento.confirmado` event | HMAC-SHA256 validado |
| `LancamentoCaixa` criado (PREVISTO) | FUNCIONAL | `cobrancas.service.ts:272-298` | Criado na geração |
| `LancamentoCaixa` atualizado (REALIZADO) | FUNCIONAL | `cobrancas.service.ts:376-416` | Atualizado no `darBaixa()` |
| Tokens liberados após pagamento | FUNCIONAL | `financeiro-token.listener.ts` | `@OnEvent('pagamento.confirmado')` |
| Cascade MLM (primeira fatura) | FUNCIONAL | `cobrancas.service.ts:431` + `indicacoes.service.ts:252` | BONUS_INDICACAO via evento |
| Marcação de vencidas (cron 2h) | FUNCIONAL | `cobrancas.job.ts:17` | Diário às 2h |
| Multa e juros (cron 3h) | FUNCIONAL | `cobrancas.job.ts:39` | Calcula por carência configurável |
| Notificação vencidas WA (cron 6h15) | FUNCIONAL | `cobrancas.job.ts:99` | Com rate-limit configurável |
| Engine COMPENSADOS/DINAMICO | BLOQUEADO | `faturas.service.ts:499-507` | `BLOQUEIO_MODELOS_NAO_FIXO` ativo — só FIXO_MENSAL funciona |
| GeracaoMensal vinculada à Cobrança | NAO_EXISTE | — | Não há FK entre `GeracaoMensal` e `Cobranca` |
| FaturaProcessada vinculada à Cobrança | PARCIAL | `cobrancas.service.ts` | `cobrancaGeradaId` existe em FaturaProcessada mas fluxo inverso não |

**% Pronto:** 80%. Principal limitação: engine bloqueada para modelos não-FIXO.

---

### FLUXO 7 — CONTABILIDADE & FINANCEIRO

| Etapa | Status | Arquivo | Gap |
|-------|--------|---------|-----|
| `LancamentoCaixa` CRUD | FUNCIONAL | `financeiro/lancamentos.service.ts` | Completo |
| Plano de contas CRUD | FUNCIONAL | `financeiro/plano-contas.service.ts` | — |
| Livro-caixa por competência | FUNCIONAL | `financeiro.controller.ts:79` | — |
| `ContaAPagar` CRUD | FUNCIONAL | `contas-pagar.service.ts` | Categorias: arrendamento, manutenção, etc. |
| `ContaReceber` (receitas) | PARCIAL | `lancamentos.service.ts` | Lançamentos RECEITA existem, sem módulo dedicado ContaReceber |
| Contabilidade Clube (tokens) | FUNCIONAL | `contabilidade-clube.controller.ts` | Provisões, emissão, expiração |
| DRE (Demonstração Resultado) | NAO_EXISTE | — | **CRÍTICO:** Sem endpoint de DRE consolidado |
| Conciliação bancária real | NAO_EXISTE | `integracao-bancaria/` | BB e Sicoob têm serviços mas webhook BB existe; conciliação automática NÃO existe |
| Fechamento de mês | NAO_EXISTE | — | Sem processo de fechamento contábil |
| Relatório financeiro admin | FUNCIONAL | `web/app/dashboard/financeiro/` | Lançamentos, contas a pagar |
| PIX Excedente | IMPLEMENTADO MAS NÃO TESTADO | `pix-excedente.service.ts` | `ASAAS_PIX_EXCEDENTE_ATIVO=false` em prod |

**% Pronto:** 50%. Bloqueadores: sem DRE, sem fechamento de mês, conciliação bancária ausente.

---

### FLUXO 8 — RELATÓRIOS POR PAPEL

#### SUPER_ADMIN

| Relatório | Status | Arquivo | Gap |
|-----------|--------|---------|-----|
| Dashboard SaaS | FUNCIONAL | `web/app/dashboard/saas/` | Faturas SaaS, planos |
| `FaturaSaas` mensal (cron) | FUNCIONAL | `saas.service.ts:130` | Cron dia 1 às 6h |
| Cooperativas/parceiros | FUNCIONAL | `web/app/dashboard/cooperativas/` | — |
| Token passivo (receita de tokens) | PARCIAL | `web/app/dashboard/cooper-token-financeiro/` | Página existe |
| Inadimplência cross-tenant | FUNCIONAL | `relatorios.service.ts` | Filtra por cooperativaId obrigatório — sem visão global |

#### ADMIN (Cooperativa)

| Relatório | Status | Arquivo | Gap |
|-----------|--------|---------|-----|
| Dashboard admin | FUNCIONAL | `web/app/dashboard/page.tsx` | — |
| Inadimplência | FUNCIONAL | `web/app/dashboard/relatorios/inadimplencia/` | — |
| Financeiro (lançamentos) | FUNCIONAL | `web/app/dashboard/financeiro/` | — |
| Conferência kWh | FUNCIONAL | `web/app/dashboard/relatorios/conferencia-kwh/` | — |
| Expansão/projeção | FUNCIONAL | `web/app/dashboard/relatorios/expansao/` | — |
| Projeção receita | FUNCIONAL | `web/app/dashboard/relatorios/projecao-receita/` | — |
| Posição do cooperado (cron 7h) | FUNCIONAL | `relatorios/posicao-cooperado.job.ts` | — |

#### CONVENIADO/PARCEIRO

| Relatório | Status | Arquivo | Gap |
|-----------|--------|---------|-----|
| Dashboard parceiro | FUNCIONAL | `web/app/parceiro/page.tsx` | — |
| Membros do convênio | FUNCIONAL | `web/app/parceiro/membros/` | — |
| Financeiro convênio | FUNCIONAL | `web/app/parceiro/financeiro/` | — |

#### COOPERADO

| Relatório | Status | Arquivo | Gap |
|-----------|--------|---------|-----|
| Portal financeiro (cobranças) | FUNCIONAL | `web/app/portal/financeiro/` | — |
| Faturas concessionária | FUNCIONAL | `web/app/portal/faturas-concessionaria/` | — |
| Tokens e saldo | FUNCIONAL | `web/app/portal/tokens/` | — |
| Créditos | FUNCIONAL | `web/app/portal/creditos/` | — |
| Economia acumulada | PARCIAL | `web/app/portal/page.tsx` | Mostra desconto% mas não calcula economia acumulada histórica |
| Indicações | FUNCIONAL | `web/app/portal/indicacoes/` | — |

**% Pronto:** 60%. Principal gap: sem DRE para qualquer papel, economia acumulada do cooperado incompleta.

---

### FLUXO 9 — FLUXO DE USINA

| Etapa | Status | Arquivo | Gap |
|-------|--------|---------|-----|
| Cadastro de usina | FUNCIONAL | `usinas.service.ts` + `web/app/dashboard/usinas/` | — |
| Homologação (status flow) | FUNCIONAL | `usinas.service.ts:205` | CADASTRADA → AGUARDANDO → HOMOLOGADA → EM_PRODUCAO |
| Validação ANEEL (distribuidora UC = usina) | FUNCIONAL | `usinas.service.ts:77` | `validarCompatibilidadeAneel()` |
| `GeracaoMensal` CRUD | FUNCIONAL | `geracao-mensal.service.ts` | — |
| Rateio de créditos por % | FUNCIONAL | `contratos.service.ts` | percentualUsina calculado no aceitar() |
| Validação % total ≤ 100% | FUNCIONAL | `motor-proposta.service.ts` | Com transação Prisma serializable |
| Lista de espera | FUNCIONAL | `motor-proposta.service.ts:748` | Entra em `ListaEspera` quando usina cheia |
| Promoção da lista de espera | NAO_EXISTE | — | **CRÍTICO:** Quando usina libera vaga, não há processo automático de promover cooperados em espera |
| Rebalanceamento entre usinas | NAO_EXISTE | — | Sem módulo de migração automática |
| `migracoes-usina` manual | FUNCIONAL | `backend/src/migracoes-usina/` | Módulo existe para migração manual |
| Monitoramento Sungrow | DESATIVADO | `monitoramento-usinas.service.ts:21` | Cron comentado: "reativar Sprint 9+" |
| Relatório analítico usina | FUNCIONAL | `usinas-analitico.service.ts` | — |

**% Pronto:** 65%. Bloqueadores para prod: promoção automática de lista de espera ausente, Sungrow desativado.

---

### FLUXO 10 — CLUBE & TOKENS

| Etapa | Status | Arquivo | Gap |
|-------|--------|---------|-----|
| Emissão tipo 1 (excedente geração) | FUNCIONAL | `cooper-token.job.ts:20` `apurarExcedentes()` | Cron diário às 6h |
| Emissão tipo 2 (BONUS_INDICACAO) | FUNCIONAL | `indicacoes.service.ts:355` | Na primeira fatura paga do indicado |
| Emissão tipo 3 (cobrança paga) | FUNCIONAL | `financeiro-token.listener.ts` | Via evento `pagamento.confirmado` |
| Saldo pendente/disponível | FUNCIONAL | `cooper-token.service.ts:105-140` | Sprint 8A: 3 condições para liberar pendente |
| Uso: abater fatura | FUNCIONAL | `cooper-token.service.ts:calculoDesconto` | Com `tokenDescontoMaxPerc` do plano |
| Uso: QR Code parceiro | IMPLEMENTADO MAS NÃO TESTADO | `cooper-token.service.ts:processarPagamentoQr` | Lógica presente, sem teste real |
| Transferência entre cooperados | IMPLEMENTADO MAS NÃO TESTADO | `cooper-token.controller.ts` | Endpoint existe |
| Expiração automática (cron) | FUNCIONAL | `cooper-token.job.ts:120` | Dia 1 de cada mês às 2h |
| Desvalorização progressiva | NAO_EXISTE | — | Não implementada |
| Relatório contábil tokens | FUNCIONAL | `contabilidade-clube.controller.ts` | Emissão, resgates, expirados |
| Rede de ofertas (parceiros) | FUNCIONAL | `web/app/dashboard/cooper-token-parceiro/` | — |
| Progressão de clube (tiers) | FUNCIONAL | `clube-vantagens.service.ts:48` | BRONZE→PRATA→OURO→DIAMANTE |
| Cron reavaliação clube | FUNCIONAL | `clube-vantagens.job.ts:15` | Dia 1 de cada mês às 9h |
| Notificação mudança de tier | IMPLEMENTADO MAS NÃO TESTADO | `clube-vantagens.service.ts` | WA via whatsappCicloVida |

**% Pronto:** 70%. Gap: desvalorização progressiva de tokens não implementada.

---

## SEÇÃO 3 — GAPS CRÍTICOS PARA PRODUÇÃO (por criticidade)

### P0 — Bloqueadores Absolutos

| # | Gap | Impacto | Fluxo | Esforço |
|---|-----|---------|-------|---------|
| P0-01 | `CADASTRO_V2_ATIVO=false`: cadastros públicos viram LeadWhatsapp sem criar cooperado real | 100% dos novos cadastros são inoperantes | 1b | 1h (ligar toggle + validar) |
| P0-02 | Engine de cobrança bloqueada para COMPENSADOS/DINAMICO (`BLOQUEIO_MODELOS_NAO_FIXO`) | Contratos non-FIXO não geram cobrança | 6 | 3-5 dias (engine completa) |
| P0-03 | Tipos de ModeloDocumento limitados a CONTRATO/PROCURACAO | Impossível gerar Termo de Adesão, Procuração ANEEL real | 3 | 2-3 dias |

### P1 — Críticos para Operação Contínua

| # | Gap | Impacto | Fluxo | Esforço |
|---|-----|---------|-------|---------|
| P1-01 | Ausência de lembrete 24h para propostas pendentes | Cooperados esquecem de assinar | 2 | 1-2 dias |
| P1-02 | Cópia assinada não enviada após assinatura digital | Cooperado fica sem comprovante | 2 | 1 dia |
| P1-03 | Email de lembrete D-3/D-1 de vencimento ausente | Aumento de inadimplência | 5 | 1 dia |
| P1-04 | Lista de espera sem promoção automática ao liberar vaga | Cooperados em espera não são notificados nem alocados | 9 | 2-3 dias |
| P1-05 | Monitoramento Sungrow desativado | Sem telemetria de usinas, risco operacional | 9 | Sprint dedicado |

### P2 — Importantes mas com Workaround

| # | Gap | Impacto | Fluxo | Esforço |
|---|-----|---------|-------|---------|
| P2-01 | DRE não existe | Gestão financeira incompleta | 7 | 3-5 dias |
| P2-02 | Conciliação bancária automática ausente | Reconciliação manual | 7 | 1-2 semanas |
| P2-03 | Email não identificado no IMAP não notifica admin | Faturas perdidas | 4 | 1 dia |
| P2-04 | Emails transacionais: token expirando, parceiro ativado | UX ruim | 5 | 2 dias |
| P2-05 | Rebalanceamento automático entre usinas | Ineficiência operacional | 9 | Sprint dedicado |
| P2-06 | Desvalorização progressiva de tokens | Tokenomics incompleto | 10 | 2-3 dias |
| P2-07 | Acesso à DB negado — contagens de registros não disponíveis | Auditoria incompleta | — | — |
| P2-08 | Fechamento de mês contábil | Gestão financeira incompleta | 7 | 2-3 dias |

### P3 — Lacunas de Teste

| # | Gap | Impacto |
|---|-----|---------|
| P3-01 | Zero testes E2E do fluxo completo de cadastro público → proposta → contrato | Regressões invisíveis |
| P3-02 | Sem teste de integração para email IMAP | Quebras silenciosas |
| P3-03 | PDF gerado com Puppeteer não testado automaticamente | Regressão visual |
| P3-04 | QR Code de tokens sem teste real | Fluxo de pagamento parceiro não validado |

---

## SEÇÃO 4 — PLANO DE SPRINTS PARA PRODUÇÃO

### Sprint 11 (7-10 dias) — Destravamento do Ciclo de Ativação

**Objetivo:** resolver os 3 gaps P0 interconectados que bloqueiam COMPENSADOS/DINAMICO em produção (ver "GARGALO CRÍTICO" no topo do documento).

**Tarefas:**

1. **Auditoria ampla da numeração dupla** (1 dia)
   - Mapear todos os pontos: cadastro, busca, exportação, OCR, relatórios
   - Listar UCs incompletas no banco (sem `numero` ou sem `numeroUC`)

2. **Correção do pipeline IMAP/OCR** (1-2 dias)
   - Busca de UC por OR (`numero = X OR numeroUC = X`)
   - Regex de filename aceita ambos formatos
   - Log explícito de match por legado

3. **Correção de cadastros** (1-2 dias)
   - Admin wizard: campo `numeroUC` obrigatório
   - Cadastro público: campo `numeroUC` obrigatório
   - Auditoria: UCs sem `numeroUC` → alerta admin

4. **Módulo de exportação pra EDP** (1 dia)
   - Geração de lista com `numeroUC` (legado)
   - Alerta se alguma UC está sem legado preenchido

5. **Classificação de faturas COM/SEM créditos** (1 dia)
   - OCR extrai flag "tem créditos" (já extrai `possuiCompensacao`)
   - `FaturaProcessada` ganha campo `temCreditos` indexado
   - Regras diferentes de processamento por cenário (A / B1 / B2)

6. **Email EDP obrigatório** (1 dia)
   - Tutorial automático pós-cadastro (email + WA)
   - Checkbox de confirmação no wizard
   - Alerta após 15 dias sem fatura recebida

7. **Fallback FIXO temporário** (1 dia)
   - Mecanismo de cobrança estimada enquanto fatura não flui
   - Transição automática pro modelo real escolhido
   - Ajuste retroativo (nota de crédito/débito)

8. **Testes E2E completos + validação com fatura real** (Luciano) (1 dia)
   - Fatura do Luciano processada ponta a ponta
   - Primeiro ciclo completo IMAP → OCR → cobrança na história

9. **Atualização do MAPA-INTEGRIDADE-SISTEMA.md**

**Dependências:** nenhuma além do que Sprint 10 entregou
**Estimativa total:** 7-10 dias, $80-120 em Sonnet
**Resultado esperado:** COMPENSADOS e DINAMICO viáveis pra produção

---

### Sprint A — Desbloqueio Crítico (1 semana)

**Objetivo:** Tornar o cadastro público funcional e garantir que propostas cheguem ao cooperado.

**Tarefas:**
1. Ligar `CADASTRO_V2_ATIVO=true` em produção (1h) + validar fluxo E2E
2. Implementar cron de lembrete 24h para propostas pendentes de assinatura
3. Implementar envio de cópia PDF assinada após `ambosAssinados=true`
4. Adicionar 3 novos tipos ao ModeloDocumento: TERMO_ADESAO, TERMO_RESPONSABILIDADE, PROCURACAO_ANEEL

**Dependências:** Nenhuma  
**Estimativa:** 5-6 dias  
**Resultado:** Fluxos 1, 2 e 3 sobem para 85%+

---

### Sprint B — Comunicação e Compliance (1 semana)

**Objetivo:** Completar emails transacionais e notificações críticas.

**Tarefas:**
1. Email lembrete D-3/D-1 de vencimento de cobrança (cron diário)
2. Notificação de token expirando (integrar ao `cooper-token.job.ts`)
3. Email de boas-vindas para novo parceiro/conveniado ativado
4. Notificação ao admin quando email IMAP não identifica cooperado

**Dependências:** Sprint A (templates de email prontos)  
**Estimativa:** 5 dias  
**Resultado:** Fluxo 5 sobe de 55% para 85%

---

### Sprint C — Gestão de Usinas e Lista de Espera (1 semana)

**Objetivo:** Completar o ciclo de usinas para operação contínua.

**Tarefas:**
1. Implementar promoção automática da `ListaEspera` quando usina libera vaga
2. Notificação WhatsApp/email ao cooperado promovido
3. Reativar cron Sungrow com integração real (ou stub configurável)
4. Vincular `GeracaoMensal` à `Cobranca` via FK (denormalização controlada)

**Dependências:** Credenciais Sungrow disponíveis  
**Estimativa:** 5-7 dias  
**Resultado:** Fluxo 9 sobe de 65% para 85%

---

### Sprint D — Financeiro e DRE (2 semanas)

**Objetivo:** Completar a contabilidade para conformidade fiscal.

**Tarefas:**
1. Implementar endpoint DRE consolidado (receitas - despesas por competência)
2. Implementar processo de fechamento de mês (bloquear lançamentos retroativos)
3. Conciliação bancária automática (extrato BB/Sicoob vs LancamentoCaixa)
4. Desvalorização progressiva de tokens (tokenomics)
5. Ativar `ASAAS_PIX_EXCEDENTE_ATIVO=true` (aguarda autorização do Luciano)

**Dependências:** Acesso a extratos bancários em sandbox  
**Estimativa:** 8-10 dias  
**Resultado:** Fluxo 7 sobe de 50% para 80%

---

### Sprint E — Testes e Engine Non-FIXO (2-3 semanas)

**Objetivo:** Segurança para modelos de cobrança avançados e cobertura de testes.

**Tarefas:**
1. Engine de cobrança CREDITOS_COMPENSADOS (calcular kWh compensado vs gerado)
2. Engine de cobrança CREDITOS_DINAMICO
3. Desligar `BLOQUEIO_MODELOS_NAO_FIXO` após testes
4. Testes E2E Playwright cobrindo: cadastro completo, proposta, assinatura, cobrança
5. Testes de integração: email IMAP, webhook Asaas, OCR

**Dependências:** Sprints A-D concluídos  
**Estimativa:** 10-15 dias  
**Resultado:** Fluxo 6 sobe de 80% para 95%

---

## SEÇÃO 5 — GAPS NÃO-BLOQUEADORES

Estes gaps degradam a experiência mas não impedem a operação em produção:

| # | Gap | Fluxo | Impacto |
|---|-----|-------|---------|
| N1 | Economia acumulada histórica não calculada no portal do cooperado | 8 | UX: cooperado não vê quanto economizou no total |
| N2 | Wizard Admin (7 steps) não sincronizado com estado de propostas pré-existentes | 1a | Se cooperado já tem proposta, wizard não detecta |
| N3 | Cadastro com convite+convênio sem criação atômica | 1d | Convite aceito sem criar cooperado no mesmo passo |
| N4 | QR Code de tokens sem teste real de fluxo | 10 | Parceiros sem validação do pagamento |
| N5 | Transferência de tokens entre cooperados sem confirmação by-email | 10 | Risco de transferências acidentais |
| N6 | Sem visão global de inadimplência cross-tenant para SUPER_ADMIN | 8 | Cada cooperativa vê só a própria |
| N7 | `pesquisarCooperados` sem paginação full | 1 | Performance degradada acima de 500 cooperados |
| N8 | Monitoramento Sungrow comentado (sem alertas de queda de usina) | 9 | Admin não sabe de falha na usina automaticamente |
| N9 | PIX Excedente desligado em prod aguardando autorização | 6 | Cooperados com excedente não recebem automaticamente |
| N10 | `CoopereAI` (bot educativo pré-menu) sem testes de regressão | — | Fluxo WA pode regredir silenciosamente |

---

## APÊNDICE — INVENTÁRIO DE TESTES EXISTENTES

### Testes Unitários/Integração (backend)

| Arquivo | O que testa |
|---------|-------------|
| `app.controller.spec.ts` | Sanity check do AppController |
| `cobrancas.service.spec.ts` | Anti-duplicação na criação de cobrança (T6) |
| `contratos.service.spec.ts` | Geração de número de contrato, conversão de data |
| `convenios-progressao.service.spec.ts` | Lógica pura de progressão de faixas de convênio |
| `cooperados.controller.spec.ts` | Controller básico |
| `cooperados.service.spec.ts` | Serviço de cooperados |
| `email-monitor.service.spec.ts` | Lógica interna do monitor de email |
| `faturas.service.calcular.spec.ts` | Cálculo de faturas |
| `faturas.service.factory.spec.ts` | Factory de FaturaProcessada |
| `faturas.service.matching.spec.ts` | Matching UC ↔ FaturaProcessada |
| `gateway-pagamento.service.spec.ts` | Gateway de pagamento abstrato |
| `motor-proposta.service.aceitar.spec.ts` | `aceitar()`: contrato, lista de espera, cooperativaId |
| `motor-proposta.service.spec.ts` | `calcularComPlano()` Tipo I e Tipo II |
| `saas.service.spec.ts` | FaturaSaas mensal |
| `ucs.controller.spec.ts` | Controller de UCs |
| `ucs.service.spec.ts` | Serviço de UCs |
| `usinas.controller.spec.ts` | Controller de usinas |
| `usinas.service.spec.ts` | Serviço de usinas |

### Testes E2E (Playwright — raiz do projeto `tests/`)

| Arquivo | O que testa |
|---------|-------------|
| `01-sanity.spec.ts` | Sanidade básica do sistema |
| `02-auth.spec.ts` | Autenticação JWT |
| `03-portal-cooperado.spec.ts` | Portal do cooperado |
| `04-parceiro-dashboard.spec.ts` | Dashboard do parceiro |
| `05-admin-dashboard.spec.ts` | Dashboard admin |
| `06-cooper-token-api.spec.ts` | API de tokens |
| `07-convite-publico.spec.ts` | Convite público (WA, não cadastro web) |

**Cobertura estimada de testes:** 35-40% dos fluxos críticos. Fluxos sem cobertura E2E: cadastro público completo, proposta + assinatura digital, ciclo email IMAP, webhook Asaas real.

---

## NOTAS FINAIS

1. **CADASTRO_V2_ATIVO** é o toggle mais crítico para produção. Ligar sem teste prévio pode criar cooperados sem UC corretamente mapeada.

2. **BLOQUEIO_MODELOS_NAO_FIXO** protege o sistema de uma engine incompleta. Não desligar sem implementar as engines COMPENSADOS e DINAMICO.

3. **ASAAS_PIX_EXCEDENTE_ATIVO** aguarda autorização explícita do Luciano. Código está pronto (commit b735dbe).

4. O sistema tem **arquitetura sólida** para multi-tenant, isolamento por cooperativaId, HMAC no webhook e idempotência anti-duplicação. Os gaps são funcionais, não estruturais.

5. **Monitoramento Sungrow** foi intencionalmente desativado no Sprint 6 (comentário no código). Reativação depende de credenciais e configuração real das usinas.

---

## GAP identificado em 2026-04-24 — a tratar em Sprint 11

### Numeração dupla de UCs (EDP em transição)

EDP mantém 2 sistemas divergentes:
- **Faturamento:** numeração NOVA (canônica, 10 dígitos). Ex: `0400702214`
- **Compensação:** exige numeração LEGADA (9 dígitos) em listas recebidas da cooperativa. Ex: `160085263`

Schema já tem ambos os campos no model `Uc`: `numero` (novo) e `numeroUC` (legado).
O filename das faturas EDP usa a numeração **legada** (ex: `ESCEFATELBT07_0160085263_*.pdf`),
mas o pipeline de identificação no OCR espera `numero` canônico. Isso explica por que faturas
reais não vinculam automaticamente ao cooperado mesmo existindo UC no banco.

**Pendente:**
- Auditoria completa do uso dos 2 campos no sistema (motor-proposta, faturas, ucs, convenios)
- Estratégia de migração: manter dupla até quando? Consultar EDP sobre sunset do legado
- Preencher campo `numero` em UCs legadas ou `numeroUC` em UCs novas, de acordo com a fonte

**Prioridade:** P0
**Sprint:** 11 (antes do primeiro parceiro real)
