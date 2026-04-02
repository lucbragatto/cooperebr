# AUDITORIA TECNICA COMPLETA — CoopereBR

**Data:** 2026-04-01
**Auditor:** Claude (Opus 4.6)
**Escopo:** Backend NestJS, Frontend Next.js, WhatsApp Service, Schema Prisma

---

## SUMARIO EXECUTIVO

O CoopereBR e uma plataforma SaaS multi-tenant para cooperativas de energia solar, composta por backend NestJS (38 modulos), frontend Next.js (portal cooperado + dashboard admin + paineis parceiro/proprietario), servico WhatsApp standalone (Baileys) e banco PostgreSQL via Prisma/Supabase.

### Pontos Fortes
- Arquitetura modular bem definida com 38 modulos NestJS
- JWT + Roles Guard global com rate limiting (100 req/60s)
- Chaves Asaas criptografadas com AES-256-GCM
- Isolamento tenant geralmente bem implementado via `req.user.cooperativaId`
- Transacoes atomicas em operacoes criticas (cadastro completo usa SERIALIZABLE)
- 17 cron jobs cobrindo ciclo financeiro, monitoramento e comunicacao
- Portal do cooperado completo com 9 paginas funcionais
- Motor de proposta maduro com deteccao de outliers

### Problemas Criticos Encontrados
- **6 bugs criticos** que afetam fluxo financeiro e MLM
- **12 bugs de severidade alta** em seguranca e integridade de dados
- **23 bugs de severidade media** em logica de negocio e UX
- **~20 modelos Prisma sem indices** em campos de alta consulta
- **~20 modelos com cooperativaId sem FK constraint** (isolamento tenant por convencao)
- **Cobertura de testes: ~0%** (apenas stubs encontrados)

---

## 1. ARQUITETURA GERAL

**Status: IMPLEMENTADO**

### Estrutura de Modulos (38 total)

| Modulo | Proposito |
|--------|-----------|
| auth | JWT + Supabase, multi-contexto, reconhecimento facial |
| cooperados | Gestao membros, cadastro completo, proxy, import |
| cooperativas | Gestao cooperativas/parceiros |
| usinas | CRUD usinas + analytics |
| ucs | Unidades consumidoras |
| contratos | Contratos de adesao |
| planos | Planos de adesao |
| cobrancas | Cobrancas, multa/juros, baixa |
| faturas | Upload OCR faturas (Claude API) |
| financeiro | Lancamentos, DRE, livro caixa, PIX excedente |
| asaas | Gateway pagamento (boleto, PIX, cartao) |
| integracao-bancaria | BB + Sicoob webhooks |
| indicacoes | Arvore MLM, beneficios |
| convite-indicacao | Convites com lifecycle |
| clube-vantagens | Gamificacao MLM (Bronze→Diamante) |
| cooper-token | Economia de tokens interna |
| whatsapp | Bot conversacional, cobranca, MLM, ciclo de vida |
| email | SMTP + IMAP + templates |
| relatorios | Inadimplencia, projecao, producao, materialized view |
| notificacoes | Notificacoes in-app |
| motor-proposta | Simulacao, proposta PDF, tarifas, reajustes |
| modelos-cobranca | Configuracao modelos cobranca |
| configuracao-cobranca | Hierarquia desconto (contrato→usina→cooperativa) |
| config-tenant | Chave-valor por tenant |
| fluxo-etapas | Motor de fluxo dinamico WhatsApp |
| monitoramento-usinas | Leitura Sungrow a cada minuto |
| geracao-mensal | Registro geracao kWh |
| documentos | Upload docs (Supabase Storage) |
| modelos-mensagem | Templates WhatsApp |
| lead-expansao | Leads do bot |
| lista-contatos | Listas para disparo em massa |
| migracoes-usina | Fluxo transferencia entre usinas |
| condominios / administradoras | Gestao condominial |
| prestadores | Prestadores de servico |
| ocorrencias | Chamados/incidentes |
| observador | Espionagem admin de chats |
| publico | Endpoints sem auth (landing, convites) |
| saas | Gestao planos SaaS (SUPER_ADMIN) |

### Bootstrap (main.ts)
- Body parser: 50MB (justificado por uploads base64)
- ValidationPipe: whitelist + forbidNonWhitelisted + transform
- CORS: via `CORS_ORIGINS` env
- Guards globais: JwtAuthGuard → RolesGuard → ThrottlerGuard

### Comunicacao entre servicos
- Backend ↔ Frontend: REST API via Axios
- Backend → WhatsApp: HTTP para porta 3002
- WhatsApp → Backend: Webhook com `?secret=`
- Sem message queue (tudo sincrono/cron)

---

## 2. FLUXO DO COOPERADO

**Status: IMPLEMENTADO (com bugs)**

### Lifecycle
```
PENDENTE → PENDENTE_VALIDACAO → PENDENTE_DOCUMENTOS → AGUARDANDO_CONCESSIONARIA
    → APROVADO → ATIVO → ATIVO_RECEBENDO_CREDITOS
    → SUSPENSO / ENCERRADO
```

### O que funciona
- Cadastro completo atomico (cooperado + UC + contrato + lista-espera) em transacao SERIALIZABLE
- Auto-promocao PENDENTE→APROVADO (docs aprovados + fatura processada)
- Auto-promocao APROVADO→ATIVO (contrato ativo)
- Cascade: cooperado ATIVO ativa contratos; cooperado SUSPENSO suspende contratos
- Import em lote com validacao
- Pre-cadastro proxy com expiracao (limpeza diaria as 3h)
- Desligamento via portal com checklist

### Bugs

| ID | Severidade | Arquivo | Linha | Descricao |
|----|-----------|---------|-------|-----------|
| BUG-COOP-1 | CRITICO | cooperados.service.ts | 638-660 | Cascade ativacao (cooperado + contratos) fora de transacao. Crash entre as duas queries deixa cooperado ATIVO com contratos PENDENTE_ATIVACAO |
| BUG-COOP-2 | MEDIO | cooperados.service.ts | 282 | `cooperativa: cooperativaId ? false : {...}` — `false` em include Prisma causa erro |
| BUG-COOP-3 | BAIXO | cooperados.service.ts | pre-cadastro | Endpoint publico sem rate limiting — flood possivel |

### Pendencias
- Lista de espera nao tem modulo proprio; promocao automatica quando usina abre vaga nao implementada
- Desligamento cria ocorrencia mas nao altera status automaticamente

---

## 3. CONVITE-INDICACAO E MLM

**Status: IMPLEMENTADO (com bugs criticos)**

### O que funciona
- Lifecycle: PENDENTE → LEMBRETE_ENVIADO → CADASTRADO → CONVERTIDO / EXPIRADO
- Cron lembrete diario (max 3 tentativas, cooldown 3 dias)
- Cron expiracao (7+ dias sem acao)
- Upsert por (cooperadoIndicadorId, telefoneConvidado)
- Arvore MLM multinivel com deteccao de ciclo
- Config por cooperativa: maxNiveis, modalidade, niveisConfig JSON
- Beneficios FIFO com cap por valor fatura

### Bugs

| ID | Severidade | Arquivo | Linha | Descricao |
|----|-----------|---------|-------|-----------|
| BUG-CONV-1 | CRITICO | convite-indicacao.job.ts | 43 | `reenviarConvite(convite.id)` sem `cooperativaId` — segundo parametro obrigatorio. Job falha silenciosamente |
| BUG-CONV-2 | MEDIO | convite-indicacao.job.ts | 81-88 | Raw SQL `UPDATE convites_indicacao` — nome da tabela pode nao corresponder ao `@@map` do Prisma |
| BUG-IND-1 | CRITICO | indicacoes.service.ts | 272-289 | REAIS_KWH armazena rate R$/kWh como `valorCalculado` sem multiplicar por kWh. Beneficio de R$0.05 ao inves de R$0.05 x kWh |
| BUG-IND-2 | MEDIO | indicacoes.service.ts | 238 | `mesRef` usa data atual, nao competencia da fatura. Beneficio creditado no mes errado |
| BUG-IND-3 | CRITICO | cobrancas.service.ts | — | `processarPrimeiraFaturaPaga` NUNCA e chamado automaticamente de `darBaixa`. Toda a cascade MLM (beneficios, clube, convite convertido) so dispara via endpoint manual |
| BUG-CLUBE-1 | MEDIO | clube-vantagens.service.ts | 83-88 | Promocao de nivel nao verifica `kwhMaximo` — cooperado pode pular niveis |
| BUG-CLUBE-3 | MEDIO | clube-vantagens.service.ts | 441-466 | Funil de conversao: `indicacoesCadastradas == totalIndicacoes` — etapa do funil sempre igual |

---

## 4. CLUBE DE VANTAGENS

**Status: IMPLEMENTADO (parcial)**

### O que funciona
- 4 niveis: BRONZE → PRATA → OURO → DIAMANTE (sem rebaixamento)
- Criterios: KWH_INDICADO_ACUMULADO, NUMERO_INDICADOS_ATIVOS, RECEITA_INDICADOS
- Ranking com filtro periodo (mes/ano/total)
- Analytics: pie chart, bar chart, funnel, evolucao
- Resumo mensal via WhatsApp (cron dia 1, 9h)

### Problemas
- Funil de conversao com bug (etapas iguais) — BUG-CLUBE-3
- Job reimplementa logica do service (codigo duplicado) — BUG-CLUBE-2
- Metricas do Clube so atualizam em `darBaixa` para indicadores ja em status `PRIMEIRA_FATURA_PAGA`, mas a transicao para esse status nunca e automatica (BUG-IND-3)

---

## 5. PLANOS E TARIFAS

**Status: PARCIAL**

### O que funciona
- CRUD planos com vigencia, campanha, desconto promocional
- Hierarquia desconto 3 niveis: contrato → usina → cooperativa
- Motor de proposta: outlier detection, MEDIA_12M vs MES_RECENTE, minimo ANEEL
- Tarifas por concessionaria com historico de reajustes

### Bugs

| ID | Severidade | Arquivo | Linha | Descricao |
|----|-----------|---------|-------|-----------|
| BUG-PLANO-1 | MEDIO | modelos-cobranca.service.ts | — | Sem metodo `create`. Tabela potencialmente vazia em todas as instalacoes |
| BUG-PLANO-2 | CRITICO | cobrancas.service.ts | 337-410 | Apenas CREDITOS_COMPENSADOS implementado. FIXO_MENSAL e CREDITOS_DINAMICO sao dead code — configuracoes aceitas mas nunca executadas |
| BUG-PLANO-3 | ALTO | motor-proposta.service.ts | 82-97 | Tarifa buscada globalmente sem filtro de distribuidora. Proposta pode usar tarifa errada em multi-distribuidora |

### Pendencias
- Reajuste automatico nao implementado (sem cron). `aplicarReajusteLote` existe mas e manual

---

## 6. CICLO FINANCEIRO

**Status: IMPLEMENTADO (com bug critico no Asaas)**

### Fluxo
```
GeracaoMensal → calcularCobrancaMensal → Cobranca (A_VENCER)
    → Asaas/BB/Sicoob (boleto/PIX)
    → Webhook pagamento → darBaixa → LancamentoCaixa + notificacoes
    → Crons: marcar VENCIDO, calcular multa/juros, notificar
```

### Bugs

| ID | Severidade | Arquivo | Linha | Descricao |
|----|-----------|---------|-------|-----------|
| BUG-ASAAS-1 | **CRITICO** | asaas.service.ts | 405-424 | Webhook PAYMENT_RECEIVED/CONFIRMED atualiza status para PAGO mas **NAO chama darBaixa**. Resultado: sem LancamentoCaixa, sem email/WhatsApp de confirmacao, sem atualizacao Clube, sem trigger MLM |
| BUG-COBR-1 | MEDIO | cobrancas.service.ts | 165 | Condicao `status === 'PENDENTE'` — status nao existe no enum StatusCobranca. Dead code |
| BUG-COBR-2 | BAIXO | cobrancas.service.ts | 184-186 | Multa com 4 decimais em darBaixa vs 2 decimais no cron. Valores ligeiramente diferentes |
| BUG-COBR-4 | ALTO | cobrancas.service.ts | 384-388 | Distribuidora match por texto livre ("CEMIG" vs "CEMIG Distribuicao S.A.") — sem normalizacao |
| BUG-ASAAS-2 | BAIXO | asaas.service.ts | 349 | Webhook token comparado sem timing-safe. Risco teorico de timing attack |
| BUG-ASAAS-3 | MEDIO | asaas.service.ts | 396 | Idempotencia por ultimoWebhookEventId sem constraint DB — race condition possivel |

### Integracao Bancaria (BB/Sicoob)
- **Funciona corretamente** — chama `darBaixa` no webhook (diferente do Asaas)
- Webhook protegido por `WEBHOOK_BANCO_TOKEN` (mas aceita tudo se env nao configurado)

### CooperToken

| ID | Severidade | Arquivo | Linha | Descricao |
|----|-----------|---------|-------|-----------|
| BUG-TOKEN-1 | MEDIO | cooper-token.job.ts | 20-103 | Encoding UTF-8 corrompido em todas as strings de log (caracteres mojibake) |
| BUG-TOKEN-2 | BAIXO | cooper-token.service.ts | 192-279 | Expiracao cria ledger EXPIRACAO para valor original mesmo se tokens ja foram gastos. Infla totalExpirado |
| BUG-TOKEN-3 | MEDIO | cooper-token.service.ts | 104-148 | Tipo do debito hardcoded como GERACAO_EXCEDENTE. Perde informacao de auditoria |

**Pendencia:** `calcularDesconto` existe mas nao e integrado em `calcularCobrancaMensal`. Tokens nunca sao aplicados automaticamente em cobrancas.

### Financeiro
- DRE, livro caixa, lancamentos manuais: funcionam
- PIX excedente: feature-flagged, sem automacao
- **Risco:** Se BUG-ASAAS-1 for corrigido, pagamentos Asaas gerarao LancamentoCaixa duplicado no livro caixa (via darBaixa + via query direta de AsaasCobranca)

---

## 7. BANCO DE DADOS (Prisma Schema)

**Status: FUNCIONAL (com problemas estruturais serios)**

### Estatisticas
- **63 modelos**, 14 enums, 1.594 linhas
- IDs: cuid (Prisma default)
- Provider: PostgreSQL via Supabase

### Indices — Criticos Ausentes

| Tabela | Campos sem indice | Impacto |
|--------|-------------------|---------|
| cobrancas | cooperativaId, status, dataVencimento, contratoId | **Tabela mais consultada** — full table scan em todos os crons e dashboards |
| contratos | cooperativaId, status, cooperadoId, usinaId | Todas as queries de tenant fazem scan |
| cooperados | cooperativaId, status | Listagem de membros sem indice |
| ucs | cooperadoId, cooperativaId | Join UC→cooperado sem indice |
| usinas | cooperativaId, statusHomologacao | — |
| faturas_processadas | cooperadoId, cooperativaId, status | — |
| indicacoes | cooperativaId, cooperadoIndicadorId, status | — |
| notificacoes | cooperadoId, lida | "Nao lidas" sem indice |
| ocorrencias | cooperativaId, cooperadoId, status | — |
| mensagens_whatsapp | telefone, cooperadoId | Lookup principal sem indice |
| leads_expansao | cooperativaId, status, telefone | — |

### cooperativaId sem FK Constraint (~20 modelos)

Os seguintes modelos armazenam `cooperativaId String?` como texto puro, **sem `@relation`** e sem constraint de FK no banco:

`Cobranca`, `FaturaProcessada`, `PropostaCooperado`, `ModeloCobrancaConfig`, `ListaEspera`, `UsinaAlerta`, `PlanoContas`, `LancamentoCaixa`, `ContratoConvenio`, `Uc`, `Plano`, `ConfigTenant`, `ConfiguracaoMotor`, `UsinaMonitoramentoConfig`, `MensagemWhatsapp`, `ConversaWhatsapp`, `Notificacao`

**Risco:** Isolamento tenant por convencao, nao por constraint. Typo ou dado stale cria contaminacao cross-tenant.

### cooperativaId deveria ser obrigatorio (nao nullable)

`Cooperado.cooperativaId`, `Usina.cooperativaId`, `Contrato.cooperativaId`, `Uc.cooperativaId`, `Cobranca.cooperativaId` — todos `String?`. Registros sem cooperativa sao orfaos e invisiveis em queries tenant.

### Campos Float que deveriam ser Decimal

- `Cobranca.kwhEntregue/kwhConsumido/kwhCompensado/kwhSaldo` — Float (risco de precisao em financeiro)
- `ProgressaoClube.receitaIndicados` e metricas — Float (agregados financeiros)

### Unique constraints ausentes

- `Cobranca [contratoId, mesReferencia, anoReferencia]` — duplicacao de cobranca possivel
- `Plano [cooperativaId, nome]` — planos duplicados por nome
- `TarifaConcessionaria [concessionaria, dataVigencia]` — tarifas duplicadas
- `UnidadeCondominio [condominioId, numero]` — unidades duplicadas

### Cascading
- **Zero regras de cascade definidas** (sem `onDelete`, sem `onUpdate`)
- Default: `NO ACTION` (RESTRICT) — delecao de pai bloqueada por filhos
- FKs nullable sem `onDelete: SetNull`

### Audit fields inconsistentes
- `EmailLog`, `ObservacaoAtiva`, `LogObservacao`, `MigracaoUsina` usam `criadoEm` em vez de `createdAt`
- `CooperTokenSaldo` tem `updatedAt` sem `createdAt`
- `ConfigClubeVantagens` sem nenhum timestamp
- 8+ modelos mutaveis sem `updatedAt`

### Status como String (sem Enum)
13 campos usam `String` para status com valores comentados: `CobrancaBancaria`, `AsaasCobranca`, `FaturaSaas`, `Indicacao`, `BeneficioIndicacao`, `ListaEspera`, `LancamentoCaixa`, `ContratoUso`, `TransferenciaPix`, `PropostaCooperado`, `Cooperativa.tipoParceiro`, `Cooperativa.statusSaas`

---

## 8. COMUNICACAO

### Email
**Status: IMPLEMENTADO (parcial)**

- SMTP via Gmail (nodemailer), 7 templates HTML estilizados
- IMAP polling a cada 5 min (extrai comprovantes mas **nao toma acao**)
- Log de envios no banco
- **Fatura nunca e enviada automaticamente na criacao** — apenas reenvio manual
- Silencio total se `EMAIL_USER` nao configurado (sem excecao)

### WhatsApp
**Status: IMPLEMENTADO (com bugs)**

- Baileys v7 em servico standalone (porta 3002)
- Bot com 40+ estados de conversa
- Cobranca: 3 crons (dia 5, diario 9h, diario 9h30)
- MLM: cron mensal dia 1
- Bulk messaging com rate limiting (30/run, 3-8s delay)
- **Sem auth entre servicos** — qualquer processo local pode enviar mensagens via porta 3002
- **CORS wildcard** no whatsapp-service
- Webhook secret hardcoded no source (`cooperebr_wh_2026`)
- NPS agendado via `setTimeout` (perdido em restart)
- `/send-interactive` chamado mas **nao existe** no whatsapp-service

### Notificacoes In-App
**Status: IMPLEMENTADO**

- CRUD basico, contagem nao-lidas, marcar como lida
- Broadcast (adminId null) + targeted
- **Sem isolamento tenant** na busca por cooperado (lookup por email global)

---

## 9. RELATORIOS

**Status: PARCIAL (2 de 4 com bugs)**

| Relatorio | Status | Problema |
|-----------|--------|----------|
| Inadimplencia | OK | Funciona. Agregacao em memoria (escala limitada) |
| Projecao Receita | BUG | Tarifa hardcoded R$0.80/kWh (nao usa tarifas reais) |
| Producao vs Cobranca | QUEBRADO | `geracaoUsina = 0` hardcoded — todos aparecem DEFICITARIO |
| Geracao por Usina | OK | Funciona |
| Materialized View | FUNCIONAL | Refresh diario 7h. Definicao da view ausente do codebase |

---

## 10. SEGURANCA

### Implementado (bom)
- JWT validado em todas as rotas (opt-out com `@Public()`)
- Roles Guard com 4 perfis (SUPER_ADMIN, ADMIN, OPERADOR, COOPERADO)
- SUPER_ADMIN bootstrap protegido por `SUPER_ADMIN_SECRET_KEY` com `crypto.timingSafeEqual`
- Asaas API keys criptografadas (AES-256-GCM)
- Rate limiting global (100/60s) + especifico em auth (3-30/min)
- ValidationPipe com whitelist + forbidNonWhitelisted
- Sem secrets hardcoded no codigo (todos via env)

### Problemas de Seguranca

| ID | Severidade | Descricao | Arquivo |
|----|-----------|-----------|---------|
| SEC-1 | CRITICO | WhatsApp service sem autenticacao na porta 3002 | whatsapp-service/index.mjs |
| SEC-2 | ALTO | Webhook banco aceita tudo se `WEBHOOK_BANCO_TOKEN` nao configurado | integracao-bancaria.controller.ts:17-19 |
| SEC-3 | ALTO | `GET /configuracao-cobranca` hardcoded `cooperativaId='default'` — ignora tenant | configuracao-cobranca.controller.ts:14-17 |
| SEC-4 | ALTO | Cookie JWT nao e httpOnly (acessivel a JS) | web/lib/auth.ts:5-12 |
| SEC-5 | ALTO | Middleware frontend so verifica presenca do token, nao perfil/role | web/middleware.ts |
| SEC-6 | ALTO | `POST /whatsapp/entrada-indicado` publico sem rate limiting | whatsapp-fatura.controller.ts:412 |
| SEC-7 | MEDIO | SUPER_ADMIN impersonacao sem audit log | auth.service.ts:486-521 |
| SEC-8 | MEDIO | `@Body() body: any` em 5+ controllers — bypassa ValidationPipe | Multiplos controllers |
| SEC-9 | MEDIO | Supabase/Anthropic keys com `!` assertion — falham em runtime, nao no startup | Multiplos services |
| SEC-10 | MEDIO | WhatsApp QR code exposto em `GET /status` — hijack de sessao possivel | whatsapp-service/index.mjs |
| SEC-11 | MEDIO | CORS wildcard no whatsapp-service | whatsapp-service/index.mjs:185-191 |
| SEC-12 | BAIXO | Webhook secret hardcoded no source: `cooperebr_wh_2026` | whatsapp-service/index.mjs:14 |
| SEC-13 | BAIXO | 50MB body limit global — pode causar OOM em rotas nao-upload | main.ts:10-11 |

---

## 11. FRONTEND

### Portal do Cooperado
**Status: IMPLEMENTADO**

| Pagina | Status | Notas |
|--------|--------|-------|
| /portal (Inicio) | OK | Dashboard com desconto, vencimento, kWh, alertas |
| /portal/ucs | OK | Lista UCs, grafico Recharts. Upload arquivo nao enviado (placeholder) |
| /portal/financeiro | OK | Historico cobrancas, boleto download. Cartao "Em breve" |
| /portal/documentos | PARCIAL | Upload funciona. Botao "Reenviar" sem onClick handler |
| /portal/indicacoes | OK | QR code via api.qrserver.com (terceiro), referral link, progresso |
| /portal/ranking | OK | Top-10. **Nao acessivel pela navegacao** (sem item no nav) |
| /portal/conta | OK | Editar perfil + trocar senha |
| /portal/desligamento | OK | Checklist + formulario |
| /portal/assinar/[token] | OK | Confirmacao contrato por token |

### Dashboard Admin
**Status: IMPLEMENTADO**

- Cooperados: wizard 7 etapas com OCR
- Parceiros: wizard 9 etapas
- Motor de proposta, clube vantagens, relatorios, WhatsApp, SaaS
- **KPIs no dashboard carregam datasets inteiros sem paginacao** — vai quebrar em escala

### Problemas Frontend

| ID | Severidade | Descricao | Arquivo |
|----|-----------|-----------|---------|
| FE-1 | ALTO | Rota `/` e o boilerplate Next.js (Vercel template) | web/app/page.tsx |
| FE-2 | ALTO | `.catch(() => {})` generalizado — erros silenciados, paginas vazias | Multiplos (portal/) |
| FE-3 | MEDIO | Botao "Reenviar" documento sem handler | portal/documentos/page.tsx:241 |
| FE-4 | MEDIO | Upload UC captura arquivo mas nao envia ao backend | portal/ucs/page.tsx:270 |
| FE-5 | MEDIO | `docsPendentes = 0` hardcoded no dashboard | dashboard/page.tsx:95 |
| FE-6 | MEDIO | `useContexto` duplica chamada `/auth/me` em cada layout | Multiplos layouts |
| FE-7 | BAIXO | Ranking nao tem item no nav do portal | portal/layout.tsx:18-24 |
| FE-8 | BAIXO | Acentos ausentes em strings do portal/assinar | portal/assinar/[token]/page.tsx |
| FE-9 | BAIXO | QR code gerado via terceiro (api.qrserver.com) — privacidade | portal/indicacoes/page.tsx |
| FE-10 | BAIXO | Sem validacao schema (Zod/Yup) em nenhum formulario | Global |

---

## 12. WHATSAPP SERVICE

### Bugs Especificos

| ID | Severidade | Descricao | Arquivo |
|----|-----------|-----------|---------|
| WA-1 | CRITICO | `/send-interactive` chamado pelo backend mas **nao existe** no express. Botoes interativos sempre fallback para texto | whatsapp-sender.service.ts:160 / index.mjs |
| WA-2 | MEDIO | `dadosTemp: undefined` em resetarConversa — Prisma ignora undefined, campo nunca e limpo | whatsapp-bot.service.ts:3486 |
| WA-3 | MEDIO | NPS via `setTimeout` (1h) — perdido em restart do servidor | whatsapp-bot.service.ts:3739 |
| WA-4 | MEDIO | Max 5 tentativas de reconexao (15s max backoff) — desiste apos ~45s | whatsapp-service/index.mjs:83-91 |
| WA-5 | BAIXO | Versao Baileys hardcoded `[2, 3000, 1034195523]` — fragil | whatsapp-service/index.mjs:45-46 |
| WA-6 | BAIXO | Eventos `whatsapp.mensagem.enviada/recebida` emitidos mas sem listener `@OnEvent()` | whatsapp-sender.service.ts:82 |

### Metricas de Complexidade
- `whatsapp-bot.service.ts`: **3.792 linhas** (limite recomendado: 800)
- `cooperados.service.ts`: **1.223 linhas**

---

## 13. TESTES

**Status: NAO IMPLEMENTADO**

- Apenas stubs `.spec.ts` encontrados (cooperados, usinas, contratos, motor-proposta)
- **Cobertura estimada: ~0%**
- Nenhum teste de integracao
- Nenhum teste E2E
- Nenhum pipeline CI/CD encontrado

---

## LISTA CONSOLIDADA DE BUGS POR PRIORIDADE

### CRITICOS (6) — Bloquantes para producao

| # | Bug | Impacto | Arquivo | Linha |
|---|-----|---------|---------|-------|
| 1 | BUG-ASAAS-1: Webhook Asaas nao chama darBaixa | Pagamentos Asaas nao geram lancamento, nao notificam, nao atualizam MLM/Clube | asaas.service.ts | 405-424 |
| 2 | BUG-IND-3: processarPrimeiraFaturaPaga nunca chamado de darBaixa | Toda a cascade MLM desconectada do fluxo de pagamento real | cobrancas.service.ts | — |
| 3 | BUG-PLANO-2: So CREDITOS_COMPENSADOS implementado | FIXO_MENSAL e CREDITOS_DINAMICO aceitos mas nunca calculados | cobrancas.service.ts | 337-410 |
| 4 | BUG-CONV-1: Job sem cooperativaId em reenviarConvite | Cron de lembrete de convites falha silenciosamente | convite-indicacao.job.ts | 43 |
| 5 | BUG-IND-1: REAIS_KWH armazena rate sem multiplicar por kWh | Beneficio MLM recorrente ~100x menor que esperado | indicacoes.service.ts | 272-289 |
| 6 | WA-1: /send-interactive nao existe no whatsapp-service | Todos os menus com botoes degradam para texto puro | whatsapp-sender.service.ts | 160 |

### ALTOS (12)

| # | Bug | Arquivo |
|---|-----|---------|
| 7 | SEC-1: WhatsApp service sem auth na porta 3002 | whatsapp-service/index.mjs |
| 8 | SEC-2: Webhook banco aceita tudo sem WEBHOOK_BANCO_TOKEN | integracao-bancaria.controller.ts:17-19 |
| 9 | SEC-3: GET /configuracao-cobranca ignora tenant (hardcoded 'default') | configuracao-cobranca.controller.ts:14-17 |
| 10 | SEC-4: Cookie JWT nao httpOnly | web/lib/auth.ts:5-12 |
| 11 | SEC-5: Middleware frontend nao verifica role | web/middleware.ts |
| 12 | SEC-6: /whatsapp/entrada-indicado publico sem rate limit | whatsapp-fatura.controller.ts:412 |
| 13 | BUG-COBR-4: Distribuidora match por texto livre | cobrancas.service.ts:384-388 |
| 14 | BUG-PLANO-3: Motor proposta busca tarifa sem filtro distribuidora | motor-proposta.service.ts:82-97 |
| 15 | FE-1: Rota / e boilerplate Next.js | web/app/page.tsx |
| 16 | REL-1: producaoVsCobranca hardcoda geracaoUsina=0 | relatorios-query.service.ts:60 |
| 17 | REL-2: Projecao receita com tarifa hardcoded R$0.80 | relatorios.service.ts:190 |
| 18 | BUG-COOP-1: Cascade ativacao fora de transacao | cooperados.service.ts:638-660 |

### MEDIOS (23)

| # | Bug | Arquivo |
|---|-----|---------|
| 19 | ~150 casts `as any` em chamadas Prisma | Multiplos |
| 20 | 5+ controllers com `@Body() body: any` | Multiplos |
| 21 | Maioria dos crons sem timezone America/Sao_Paulo | Multiplos jobs |
| 22 | ~20 modelos sem indice em cooperativaId | schema.prisma |
| 23 | ~20 modelos com cooperativaId sem FK constraint | schema.prisma |
| 24 | cooperativaId nullable em modelos core (cooperados, usinas, contratos, ucs, cobrancas) | schema.prisma |
| 25 | 13 campos status como String (sem enum) | schema.prisma |
| 26 | Float em campos financeiros de Cobranca | schema.prisma:396-399 |
| 27 | FluxoEtapa.findAll sem filtro cooperativaId | fluxo-etapas.service.ts:8 |
| 28 | Notificacoes sem isolamento tenant | notificacoes.service.ts:66-68 |
| 29 | WA-2: dadosTemp undefined nao limpa conversa | whatsapp-bot.service.ts:3486 |
| 30 | WA-3: NPS via setTimeout (nao persistente) | whatsapp-bot.service.ts:3739 |
| 31 | BUG-TOKEN-1: Encoding corrompido no job | cooper-token.job.ts:20-103 |
| 32 | BUG-TOKEN-3: Tipo debito hardcoded | cooper-token.service.ts:104-148 |
| 33 | BUG-IND-2: mesRef usa data atual, nao competencia | indicacoes.service.ts:238 |
| 34 | BUG-CLUBE-1: Promocao nivel pula brackets | clube-vantagens.service.ts:83-88 |
| 35 | BUG-CLUBE-3: Funil conversao com etapas iguais | clube-vantagens.service.ts:441-466 |
| 36 | BUG-CONV-2: Raw SQL com nome tabela potencialmente errado | convite-indicacao.job.ts:81-88 |
| 37 | BUG-ASAAS-3: Idempotencia webhook sem constraint DB | asaas.service.ts:396 |
| 38 | FE-3: Botao Reenviar documento sem handler | portal/documentos/page.tsx:241 |
| 39 | FE-4: Upload UC nao envia arquivo | portal/ucs/page.tsx:270 |
| 40 | FE-6: useContexto duplica chamadas /auth/me | Multiplos layouts |
| 41 | IMAP extrai comprovantes mas nao toma acao | email-recebimento.service.ts:70-81 |

---

## RECOMENDACOES POR PRIORIDADE

### Imediato (antes de ir para producao)

1. **Corrigir BUG-ASAAS-1**: Webhook Asaas deve chamar `darBaixa` em vez de update direto
2. **Corrigir BUG-IND-3**: Integrar `processarPrimeiraFaturaPaga` em `darBaixa`
3. **Corrigir BUG-CONV-1**: Passar `cooperativaId` no job de lembrete
4. **Corrigir WA-1**: Implementar `/send-interactive` no whatsapp-service ou ajustar sender
5. **Adicionar auth no whatsapp-service**: Bearer token ou API key no express middleware
6. **Validar envs obrigatorias no startup**: SUPABASE_SERVICE_KEY, WEBHOOK_BANCO_TOKEN, etc.
7. **Substituir rota `/` por landing page** ou redirect para `/entrar`

### Curto prazo (1-2 sprints)

8. Adicionar indices nas 10+ tabelas criticas (cobrancas, contratos, cooperados, ucs, usinas)
9. Converter cooperativaId para obrigatorio + @relation em modelos core
10. Implementar FIXO_MENSAL e CREDITOS_DINAMICO em calcularCobrancaMensal
11. Corrigir calculo REAIS_KWH (BUG-IND-1)
12. Adicionar timezone em todos os crons
13. Substituir `.catch(() => {})` por tratamento de erro com feedback ao usuario
14. Implementar refresh token (JWT 7 dias sem refresh e longo)

### Medio prazo (1-2 meses)

15. Escrever testes (meta: 80% cobertura em services criticos)
16. Quebrar `whatsapp-bot.service.ts` (3.792 linhas) em handlers por dominio
17. Converter campos Float para Decimal em cobrancas
18. Adicionar unique constraints ausentes
19. Implementar cascade rules (onDelete) no schema
20. Configurar CI/CD com lint + testes
21. Adicionar Swagger/OpenAPI
22. Paginacao nos endpoints do dashboard (KPIs carregam datasets inteiros)
23. Integrar CooperToken em calcularCobrancaMensal

### Longo prazo

24. Substituir servico WhatsApp Baileys por API oficial (risco de ban)
25. Implementar audit log para acoes SUPER_ADMIN
26. Migrar cookies JWT para httpOnly com BFF pattern
27. Adicionar branding por tenant no frontend (logo, cores)
28. Implementar queue (Bull/BullMQ) para jobs pesados em vez de crons sincronos

---

## METRICAS FINAIS

| Metrica | Valor |
|---------|-------|
| Modulos backend | 38 |
| Modelos Prisma | 63 |
| Enums | 14 |
| Cron jobs | 17 |
| Endpoints REST (estimado) | ~200+ |
| Paginas frontend | ~40+ |
| Estados bot WhatsApp | 40+ |
| Templates email | 7 |
| Bugs criticos | 6 |
| Bugs altos | 12 |
| Bugs medios | 23 |
| Cobertura testes | ~0% |
| Linhas maior arquivo | 3.792 (whatsapp-bot.service.ts) |

---

*Auditoria realizada em 2026-04-01 por Claude (Opus 4.6). Dados baseados na leitura completa do codigo-fonte.*
