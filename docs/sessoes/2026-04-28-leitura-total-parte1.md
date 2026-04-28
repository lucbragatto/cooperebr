# Leitura total — mapa funcional consolidado (Parte 1) — 2026-04-28

**Tipo:** read-only, gabarito para Doc-0
**Sessão:** Sprint 13a Dia 3 fechado, próxima é Doc-0
**Escopo desta parte:** inventário de docs (Etapa 1) + leitura sistemática (Etapa 2) + mapeamento backend completo (Etapa 3)
**Parte 2 (próxima sessão):** frontend (Etapa 4) + schema (Etapa 5) + cruzamento funcional (Etapa 6) + drift (Etapa 7) + diagnóstico final (Etapa 8) + hardcodes/TODOs (Etapa 10)

---

## 1. Inventário de documentos

**Total geral: 130+ arquivos `.md`, 42.144 linhas no diretório `docs/` + raiz + `memory/`.**

### Tier 1 — fonte da verdade declarada (raiz `docs/` + repo root)

| Caminho | Linhas | Atualizado em (no doc) | Resumo |
|---|---|---|---|
| `CLAUDE.md` (raiz) | ~250 | 2026-04-28 | Instruções permanentes Claude Code. Estado atual Sprint 13a Dia 1 (ATENÇÃO: o que escrevi hoje à noite, ainda referencia Dia 1 — atualizar pra refletir Dia 2 e Dia 3 também). Tem regras PM2, Frontend Next.js dev, vocabulário multi-tipo, regras migration auditada. |
| `docs/SISGD-VISAO-COMPLETA.md` | 635 | 2026-04-26 | **Documento mais valioso do projeto.** Mapa narrativo completo: 12 papéis humanos, 3 histórias completas (Ana cooperada solta, Carlos agregador Hangar, Helena síndica Moradas), inventário com semáforo (✅🟡🔴), mapa de fidelidade (4 conceitos: CooperToken / CooperToken Parceiro / Clube Vantagens / Convênio), operação EDP (cadastro email, lista compensação, lista homologação), painéis necessários por papel, ordem de construção (15 itens), glossário. Conhecimento humano-tradutor pra Luciano. |
| `docs/MAPA-INTEGRIDADE-SISTEMA.md` | 986 | 2026-04-28 (atualizei hoje) | Estado técnico em formato cronológico (anexar ao final virou padrão — sintoma do débito P2 de drift). Atualmente cobre Sprint 11 + 12 + 13a P0/Dia 1. Ainda não tem Dia 2 e Dia 3. |
| `docs/PLANO-ATE-PRODUCAO.md` | 538 | 2026-04-28 | Roteiro de 15 sprints (12-26). Sprint 13 dividido em 13a/13b/13c (atualizei hoje). Inclui Sprint 14 (cron FaturaSaas), Sprint 17 (engine COMPENSADOS — risco alto), Sprint 22 (audit), Sprint 26 (pré-prod). |
| `docs/RAIO-X-PROJETO.md` | 1.018 | 2026-04-20 (commit 9e409bc) | Snapshot do banco e sidebar gerado pelo Code. **DESATUALIZADO** — números do banco mudaram (Sprint 13a P0 limpou cooperativas-fantasma). Útil como referência histórica do estado pré-Sprint 11. |
| `docs/COOPEREBR-ALINHAMENTO.md` | 473 | 2026-04-23 | "Documento único definitivo" — versão narrativa-técnica do mapa. Cobre quem é quem, modelo financeiro, inventário de saúde por módulo (semáforo), 14 fluxos de negócio, 10 buracos prioritários (alguns marcados RESOLVIDO). **Parcialmente desatualizado** — Sprint 13a não consta. |
| `docs/debitos-tecnicos.md` | 595 | 2026-04-28 (atualizei hoje) | P1/P2/P3 vivos. Inclui IDOR resolvido hoje, auditoria geral IDOR P2, 4 P3 do Sprint 13a Dia 1, drift docs/código P2, vocabulário hardcoded P2. |

### Tier 2 — referência técnica (`docs/referencia/`, 13 arquivos)

| Arquivo | Linhas | Data | Resumo |
|---|---|---|---|
| `ARQUITETURA-RESUMO.md` | 347 | (sem data clara) | Entidades core (Cooperativa = TENANT ROOT, etc.) |
| `BRIEFING-ARQUITETURA-v2.md` | 264 | (sem data) | Briefing arquitetura v2 — contexto do sistema |
| `CONTEXTO-CLAUDEAI.md` | 456 | 2026-04-15 | Contexto pra outras sessões claude.ai — versão SaaS multi-tenant |
| `CONTEXTO-PROJETO.md` | 220 | (sem data) | "O que é o CoopereBR" — descrição alta nível |
| `DIAGRAMA-SISTEMA.md` | 534 | 2026-03-31 | Diagramas Mermaid + workflow completo (Assis) |
| `FORMULAS-COBRANCA.md` | 218 | (marcado "desatualizado", substituído por REGRAS-PLANOS-E-COBRANCA) | Antiga fonte de verdade pra cálculo |
| `MAPA-MENTAL-SISTEMA.md` | 375 | 2026-03-31 | Mapa mental por camadas (Assis) |
| `REGRAS-PLANOS-E-COBRANCA.md` | **1.623** | (sem data clara, mais recente) | **Maior doc do Tier 2.** Substitui FORMULAS-COBRANCA. Regras de planos + cobrança. |
| `RELATORIO-ARQUITETURA-PARCEIROS-2026-03-28.md` | 211 | 2026-03-28 | Modelo de parceiros como Luciano definiu |
| `RELATORIO-ATUAL.md` | 130 | 2026-03-13 (commit c35fb43) | Stack + status — **muito desatualizado** |
| `RELATORIO-COMPLETO-COOPEREBR-2026-03-29.md` | 290 | 2026-03-29 | Relatório estratégico (Assis) |
| `RETOMADA-SESSAO.md` | 213 | (sem data) | Ponto de retomada pra nova sessão |
| `SPRINT-BACKLOG-COMPLETO.md` | 531 | (sem data) | Backlog de sprints + fluxo de cadastro definição final |

### Tier 3 — especificações temáticas (raiz `docs/` + `docs/specs/`)

| Arquivo | Linhas | Resumo |
|---|---|---|
| `docs/especificacao-clube-cooper-token.md` | 198 | Especificação Clube + CooperToken (referência viva, citada em CLAUDE.md) |
| `docs/especificacao-contabilidade-clube.md` | 152 | Contabilidade do Clube (princípio fundamental) |
| `docs/especificacao-modelos-cobranca.md` | 196 | Modelos de cobrança SISGD (FIXO/COMPENSADOS/DINAMICO) |
| `docs/investigacao-sprint8-cooper-token-clube.md` | 528 | Investigação Sprint 8 |
| `docs/specs/COOPERTOKEN-FUNDAMENTOS.md` | 440 | 2026-04-02 — Aprovado, fundamentos econômicos+jurídicos |
| `docs/specs/ESTRATEGIA-COOPERTOKEN-COMPLETA.md` | 224 | 2026-03-31 — Modelo completo |
| `docs/specs/ESTRATEGIA-INOVACAO-2026.md` | 273 | CoopereBR como VPP (Virtual Power Plant) |
| `docs/specs/MODELO-COBRANCA-GD-2026-04-01.md` | 274 | Em discussão |
| `docs/specs/PLANO-CONVENIOS-2026-04-01.md` | 1.456 | **Maior spec.** Implementação módulo Convênios |
| `docs/specs/PROPOSTA-GD1-GD2-FIOB-2026-03-26.md` | 199 | Proposta técnica Fio B |
| `docs/specs/PROPOSTA-MODO-OBSERVADOR-2026-03-26.md` | 175 | Modo Observador (Shadow Mode) |
| `docs/specs/SPEC-COOPERTOKEN-v1.md` | 734 | Rascunho CooperToken v1 |

### Tier 4 — sessões (`docs/sessoes/`, 33 arquivos)

10 mais recentes (2026-04-25 → 2026-04-28):

| Arquivo | Tema |
|---|---|
| `2026-04-28-sprint13a-p0-e-dia1.md` | Sprint 13a P0 + Dia 1 |
| `2026-04-27-webhook-asaas-sandbox-validado.md` | Webhook Asaas sandbox + 3 bugs (CLUBE dupla bonif, percentualDesconto, dataVencimento) |
| `2026-04-26-diagnostico-faturas-20a26abr.md` | Diagnóstico IMAP 13/13 OCR sucesso |
| `2026-04-26-sprint11-fase-d-e2e.md` | E2E pipeline OCR fatura Luciano |
| `2026-04-26-email-multi-parceiro.md` | Arquitetura email multi-parceiro |
| `2026-04-26-fase-c-pulada.md` | Decisão arquitetural Sprint 11 Fase C |
| `2026-04-26-briefing-claude-ai.md` | Briefing claude.ai |
| `2026-04-26-auditoria-numeracao-dupla.md` | Numeração dupla UC EDP |
| `2026-04-25-teste-ocr-fatura-luciano.md` | OCR fatura UID 2032 |
| `2026-04-25-sprint10-e2e.md` | Sprint 10 E2E |

### Tier 5/6 — outros

- **`docs/qa/` — 33 arquivos** com relatórios QA diários de mar/abr 2026 (RELATORIO-QA-2026-03-25.md ... 2026-04-19.md). Patroniza-se obsolete; útil só pra arqueologia.
- **`docs/changelog/` — 16 arquivos** com correções/implementações pontuais.
- **`docs/historico/` — 8 arquivos** (incluindo 6 arquivos preservados `recebidos-2026-04-28-claude-ai/` desta sessão de manhã).
- **`docs/arquitetura/gateways.md`** — único arquivo ali.
- **`docs/sessoes/PROMPT-*.md`, `RELATORIO-AGENDA-CLAUDE-15H.md`, `RELATORIO-ORQUESTRADOR-v2.md`, `TAREFA-P-URGENTE.md`, `TASK-CENTRAL-FATURAS.md`** — prompts antigos, em local errado (deveria ser `historico/` ou raiz separada).
- **`memory/` (raiz)** — 13 arquivos antigos (mar/abr 2026) com correções pontuais. Não é a memória do Claude Code (essa é em `~/.claude/projects/...`). Pasta legítima do repo, separada.

### Sintomas de drift identificados nesta etapa

1. **Múltiplas fontes da verdade declarando-se únicas:** SISGD-VISAO-COMPLETA, COOPEREBR-ALINHAMENTO, RAIO-X, MAPA-INTEGRIDADE — todas declaram ser "fonte única de verdade", mas se cobrem com sobreposição alta + datas diferentes.
2. **Datas inconsistentes:** RAIO-X é de 2026-04-20 (Sprint 11 ainda não tinha começado). COOPEREBR-ALINHAMENTO é de 2026-04-23. Ambos descrevem números de banco que **não batem** com o estado de hoje (Sprint 13a P0 limpou banco).
3. **FORMULAS-COBRANCA marcado "desatualizado":** mas continua referenciado em memória (`reference_formulas_cobranca.md` — "fonte de verdade pra cálculos"). Memória aponta pra arquivo que própria leitura sinaliza como obsoleto.
4. **Tier 5/6 (qa/, changelog/) pesados:** 50+ arquivos que são arqueologia, ocupam espaço de cabeça sem agregar.
5. **Sessões `docs/sessoes/`** misturadas com PROMPT-*.md (prompts antigos) — pasta cumpre 2 funções (registros pós-fato + briefings pré-fato).

---

## 2. Mapeamento de backend

### 2.1 Estatísticas globais

- **44 módulos backend** em `backend/src/`
- **447 endpoints HTTP** distribuídos
- **27 crons** agendados (1 comentado, 26 ativos)
- **80 models Prisma** (`backend/prisma/schema.prisma`, 2.029 linhas)
- **~17 specs Jest** (.spec.ts) — cobertura ainda limitada

### 2.2 Módulos top por endpoints

| Módulo | Endpoints | Notas |
|---|---|---|
| `cooperados` | 33 | Núcleo de membros |
| `motor-proposta` | 32 | Cálculo + assinatura + lista de espera |
| `financeiro` | 30 | LancamentoCaixa, plano de contas, contas-pagar, fluxo-caixa, contratos-uso |
| `cooper-token` | 28 | Ledger, saldo, ofertas |
| `whatsapp` | 27 | Bot + cobrança + MLM + comunicação |
| `convenios` | 18 | 53 KB de código, 0 registros em prod |
| `auth` | 17 | JWT, registro, recuperação senha, contexto |
| `faturas` | 16 | OCR, central de faturas, processamento |
| `clube-vantagens` | 15 | Tiers BRONZE→DIAMANTE |
| `usinas` | 12 | Cadastro + analítico + Portal Proprietário (mockado) |
| `cooperativas` | 12 | Tenant management + IDOR fix de hoje |
| `saas` | 11 | Dashboard, Parceiros, Saúde, Planos SaaS, FaturaSaas |
| `integracao-bancaria` | 11 | BB/Sicoob configurado mas nunca usado |
| `indicacoes` | 11 | MLM cascata |
| `cobrancas` | 10 | Geração, multa/juros, status |

### 2.3 Lista completa de módulos backend (44 + 1 `common`)

```
administradoras    asaas              auth               bandeira-tarifaria
clube-vantagens    cobrancas          common (helpers)   condominios
config-tenant      configuracao-cobranca  contas-pagar  contratos
convenios          conversao-credito  convite-indicacao  cooperados
cooperativas       cooper-token       documentos         email
email-monitor      faturas            financeiro         fluxo-etapas
gateway-pagamento  geracao-mensal     indicacoes         integracao-bancaria
lead-expansao      migracoes-usina    modelos-cobranca   modelos-mensagem
monitoramento-usinas  motor-proposta  notificacoes       observador
ocorrencias        planos             prestadores        publico
relatorios         saas               ucs                usinas
whatsapp
```

### 2.4 Crons (27)

| Service | Schedule | O que faz |
|---|---|---|
| `bandeira-tarifaria/bandeira-aneel` | `0 6 1 * *` | Sincronização ANEEL bandeiras (mensal) |
| `clube-vantagens/clube-vantagens.job` | `0 9 1 * *` | Resumos mensais clube |
| `cobrancas/cobrancas.job` (×4) | `0 8 * * *`, `EVERY_DAY_AT_2AM`, `EVERY_DAY_AT_3AM`, `15 6 * * *` | Lembretes pré-vencimento, marcar vencidas, multa/juros, notificar vencidas |
| `convenios/convenios.job` | `0 3 * * *` | Reconciliar faixas progressivas |
| `convite-indicacao/convite-indicacao.job` (×2) | `0 10 * * *`, `0 3 * * *` | Lembrete convites + expirar convites |
| `cooper-token/cooper-token.job` (×2) | `0 6 * * *`, `0 2 1 * *` | Apurar excedentes diário, expirar tokens vencidos mensal |
| `cooperados/cooperados.job` (×2) | `0 3 * * *` (×2) | Limpar cooperados proxy expirados/zumbi |
| `documentos/documentos-aprovacao.job` | `0 */1 * * *` | Aprovação automática hora a hora |
| `email/email-recebimento` | `EVERY_5_MINUTES` | Verificar emails recebidos (cron antigo) |
| `email-monitor/email-monitor` | `0 0 6 * * *` | Verificar emails faturas 6h (cron novo) |
| `integracao-bancaria` | `5 6 * * *` | Polling liquidadas (BB/Sicoob — nunca rodou em prod) |
| `monitoramento-usinas` | `// @Cron('* * * * *')` | **COMENTADO** (Sungrow desligado intencionalmente) |
| `motor-proposta/motor-proposta.job` | `EVERY_DAY_AT_9AM` | Lembrete propostas pendentes 24h |
| `observador/observador` | `EVERY_5_MINUTES` | Expirar sessões automáticas observador |
| `relatorios/posicao-cooperado.job` | `0 7 * * *` | Recalcular posição diária |
| `saas/saas.service` | `0 6 1 * *` | **Cron FaturaSaas** — gerador mensal (entregue Sprint 6 Ticket 10, mas ver débito) |
| `whatsapp/whatsapp-cobranca` (×3) | `0 8 5 * *`, `0 9 * * *`, `30 9 * * *` | Cobrança mensal + diária + tarefas pós |
| `whatsapp/whatsapp-conversa.job` | `EVERY_HOUR` | Status conversas |
| `whatsapp/whatsapp-mlm` | `0 10 1 * *` | MLM mensal |

### 2.5 Tabela completa: módulo × evidências

| Módulo | Service(s) | Endpoints | Specs | Crons | Observação |
|---|---|---|---|---|---|
| administradoras | 1 | 5 | 0 | 0 | 1 registro, esqueleto |
| asaas | 1 | 9 | 0 | 0 | sandbox OK, prod nunca rodou |
| auth | 1 | 17 | 1 | 0 | JWT + IDOR fix hoje em tenant-guard |
| bandeira-tarifaria | 2 | 7 | 0 | 1 | sincronização ANEEL ativa |
| clube-vantagens | 1 | 15 | 0 | 1 | 0 ofertas cadastradas |
| cobrancas | 4 | 10 | 1 | 4 | núcleo financeiro membros |
| common | (helpers) | — | — | — | utilitários compartilhados |
| condominios | 1 | 8 | 0 | 0 | 1 condomínio + 10 unidades teste |
| config-tenant | 1 | 7 | 0 | 0 | 14 configs |
| configuracao-cobranca | 1 | (não medido) | 0 | 0 | 5 configs ativas |
| contas-pagar | 1 | (não medido) | 0 | 0 | módulo CRUD vazio (0 registros) |
| contratos | 1 | 7 | 1 | 0 | 73 contratos ativos |
| convenios | 3 | 18 | 1 | 1 | 53 KB código, 0 registros |
| conversao-credito | 1 | (não medido) | 0 | 0 | 0 registros |
| convite-indicacao | 1 | 8 | 0 | 2 | 0 convites enviados |
| cooperados | 1 | 33 | 3 | 2 | 125 cooperados (era — Sprint 13a P0 ainda mantém número) |
| cooperativas | 1 | 12 | 1 | 0 | **IDOR fix hoje em 6 endpoints** |
| cooper-token | 1 | 28 | 0 | 2 | ledger 6, saldo 3, sem ofertas |
| documentos | 1 | (não medido) | 0 | 1 | aprovação automática hora a hora |
| email | 3 | 8 | 1 | 1 | SMTP por parceiro novo (Sprint 11) |
| email-monitor | 1 | (não medido) | 1 | 1 | pipeline IMAP→OCR (Sprint 11 validou) |
| faturas | 2 | 16 | 3 | 0 | OCR Claude AI |
| financeiro | 7 | 30 | 0 | 0 | 7 services! (LancamentoCaixa, planoContas, contas-pagar, fluxo-caixa, contratos-uso, etc.) |
| fluxo-etapas | 1 | (não medido) | 0 | 0 | 22 etapas WA |
| gateway-pagamento | 1 | 0 (sem controller) | 1 | 0 | adapter pattern (Asaas, BB, Sicoob) |
| geracao-mensal | 1 | (não medido) | 0 | 0 | 15 registros |
| indicacoes | 1 | 11 | 0 | 0 | 10 indicações, MLM em código |
| integracao-bancaria | 3 | 11 | 0 | 1 | BB/Sicoob configurado mas 0 configs |
| lead-expansao | 1 | (não medido) | 0 | 0 | 0 leads |
| migracoes-usina | 1 | 7 | 0 | 0 | migração entre usinas |
| modelos-cobranca | 1 | (não medido) | 0 | 0 | 4 configs |
| modelos-mensagem | 1 | (não medido) | 0 | 0 | 21 modelos |
| monitoramento-usinas | 2 | 7 | 0 | (comentado) | Sungrow desligado |
| motor-proposta | 3 | 32 | 2 | 1 | 4 propostas, lista espera 32 |
| notificacoes | 1 | (não medido) | 0 | 0 | 37 notificações |
| observador | 1 | (não medido) | 0 | 1 | shadow mode |
| ocorrencias | 1 | 6 | 0 | 0 | 4 registros |
| planos | 1 | 6 | 0 | 0 | 9 planos |
| prestadores | 1 | 5 | 0 | 0 | 0 registros |
| publico | 0 (só controller) | 6 | 0 | 0 | endpoints públicos cadastro |
| relatorios | 3 | 5 | 0 | 1 | inadimplência, projeção, expansão |
| saas | 2 | 11 | 2 | 1 | **Sprint 13a entregou** Painel SISGD + lista parceiros + saúde + cron FaturaSaas |
| ucs | 1 | 6 | 2 | 0 | 108 UCs (Sprint 11 normalizou 326) |
| usinas | 2 | 12 | 2 | 0 | 10 usinas + Portal Proprietário (mockado) |
| whatsapp | 10 | 27 | 0 | 5 | maior módulo em quantidade de services |

### 2.6 Endpoints por categoria funcional

#### Autenticação & contexto (`auth`)
- `POST /auth/register` `/register-admin` `/login` `/criar-super-admin` `/criar-usuario` `/criar-usuario-agregador`
- `GET /auth/me` `/usuarios`
- `PUT /auth/usuarios/:id`
- `POST /auth/esqueci-senha` `/verificar-canal` `/esqueci-senha-whatsapp` `/redefinir-senha` `/alterar-senha` `/trocar-contexto`

#### Tenant management (`cooperativas`, `saas`)
- `GET /cooperativas` `/tipos` `/meu-dashboard` `/:id` `/:id/painel-parceiro` `/:id/qrcode` `/financeiro/:id`
- `POST /cooperativas`, `PUT /:id`, `PATCH /:id/plano`, `PATCH /financeiro/:id`, `DELETE /:id`
- `GET /saas/dashboard` (Sprint 13a Dia 1) `/saas/parceiros` (Dia 2) `/saas/parceiros/:id/saude` (Dia 3)
- `GET/POST /saas/planos` etc.
- **Todos `:id` em `/cooperativas/` agora protegidos por `assertSameTenantOrSuperAdmin` (commit 1569ca8)**

#### Asaas
- `POST /asaas/config` `/asaas/cobrancas` `/asaas/cobrancas/:asaasId/cancelar` `/asaas/assinaturas` `/asaas/webhook`
- `GET /asaas/config` `/asaas/testar-conexao` `/asaas/cobrancas/:cooperadoId` `/asaas/cobrancas/:asaasId/status`

#### Outras categorias (lista resumida)
- **Cooperados (33)**: CRUD completo + ciclo de vida + KYC + facial + indicações relacionadas
- **Motor Proposta (32)**: cálculo, aceitar, assinar, lista espera, lembretes
- **Financeiro (30)**: LancamentoCaixa, plano de contas, contas a pagar, fluxo caixa, contratos de uso (arrendamento), DRE não-implementado
- **CooperToken (28)**: ledger, saldos, configs, ofertas, resgates, compras (parceiro)
- **WhatsApp (27)**: bot, conversas, mensagens, fluxos, MLM, cobrança
- **Convênios (18)**: contratos, faixas progressivas, benefícios
- **Faturas (16)**: OCR, central, processamento, status, aprovação
- **Clube Vantagens (15)**: configs, progressão tiers, ofertas, resgates
- **Usinas (12)**: CRUD + analítico + listas concessionária + Portal Proprietário (`/usinas/proprietario/dashboard`)
- **Indicações (11)**: MLM, beneficios, configs
- **Integração Bancária (11)**: BB, Sicoob, conciliação, webhooks
- **Cobranças (10)**: criação, status, multa/juros, vencimento

---

## 3. Achados gerais até aqui

### 3.1 Discrepâncias com docs

| Doc | O que diz | Verdade no código |
|---|---|---|
| RAIO-X 2026-04-20 | "5 cooperativas no banco (1 lixo)" | 2 hoje (Sprint 13a P0 limpou 2 fantasmas + cooperativa "aaaaaaa") |
| RAIO-X 2026-04-20 | "AsaasCustomer 0 / AsaasCobranca 0" | Sandbox validado em Sprint 12, ainda 0 em prod |
| RAIO-X 2026-04-20 | "FaturaSaas 0 — sem cron" | **Cron criado em Sprint 6 T10** + 1 fatura teste R$ 5.900 hoje |
| RAIO-X 2026-04-20 | "ContratoUso 0 — nunca usado" | **Service completo (160 linhas, CRUD + lançamento automático)**, mas 0 registros — esqueleto pronto |
| COOPEREBR-ALINHAMENTO | "5 parceiros + 125 cooperados" | 2 parceiros + 303 cooperados (303 ATIVOS) hoje |
| SISGD-VISAO-COMPLETA | "Audit trail HistoricoStatusCooperado 0 registros" | **Confirmado** — model AuditLog adicionado Sprint 13a Dia 1, ativação prevista Sprint 13b |
| MAPA-INTEGRIDADE | Cobertura de Sprint 11/12, parcial Sprint 13a | Hoje fechou Sprint 13a 3/3 — atualizar para refletir Dia 2/Dia 3 |

### 3.2 Sintomas de drift estrutural

1. **Existe `web/app/parceiro/` (singular, 25 subpastas) paralelo a `/dashboard/`** — portal admin do parceiro com layout próprio. **Não consta em CLAUDE.md, MAPA, SISGD-VISAO ou RAIO-X.** Drift estrutural confirmado.
2. **Existe módulo `gateway-pagamento`** (com adapter pattern documentado em `docs/arquitetura/gateways.md`) — mencionado em CLAUDE.md mas não cruzado com docs principais.
3. **27 crons rodando** — apenas alguns mencionados nos docs. Painel "saúde técnica" não existe (citado em SISGD-VISAO 5.1 como FALTA).
4. **17 specs Jest** num projeto de 80 models e 447 endpoints — cobertura baixa. Nenhum doc menciona estado de testes além do RAIO-X cobrir parcialmente.
5. **Memória `~/.claude/projects/.../memory/`** vs **`memory/` no repo** — duas pastas com nomes iguais, propósitos diferentes — fonte recorrente de confusão (incluindo nesta sessão de manhã ao analisar arquivos recebidos).

### 3.3 Heatmap de docs vs reality

Áreas com **mais drift** (estimativa pré-Etapa 6):

1. **Inventário do banco** (RAIO-X 2026-04-20 desatualizado — números crescem todo sprint)
2. **Estado dos módulos** (semáforos do COOPEREBR-ALINHAMENTO + SISGD-VISAO podem divergir caso a caso)
3. **Telas que existem** (sidebar do RAIO-X é de antes da reorganização "Gestão Global")
4. **Sprint vigente** (vários docs com data 2026-04-20, 04-23, 04-26 descrevem "próximo Sprint" diferente)
5. **Portal /parceiro/** — invisível em qualquer doc

Áreas com **menos drift**:
- SISGD-VISAO-COMPLETA seções 1, 2, 4.1, 4.2 — narrativa humana é resistente a drift
- Glossário em SISGD-VISAO seção 7 — termos não mudam tanto
- Especificações técnicas (`especificacao-clube-cooper-token.md`, etc.) — definem invariantes

---

## 4. Estado da sessão

**Token usage:** ~moderado-alto. Posso fazer mais 1-2 etapas curtas, mas Etapa 4-6 (frontend completo + cruzamento de 24+ funcionalidades + diagrama ASCII) excede o que cabe com qualidade.

**Recomendação:** salvar este relatório (Parte 1), Luciano abre nova sessão com prompt de continuação focado em Etapa 4-10.

---

## 5. Frase pra próxima sessão (Parte 2)

> "Continuando leitura total — Parte 2. Já tenho mapeamento de docs (130+ md), backend (44 módulos / 447 endpoints / 27 crons / 80 models). Próximo: frontend (rotas + hooks), cruzamento das 24 funcionalidades de Doc-0 com código real, diagrama ASCII de interconexão, hardcodes/TODOs vivos, drift consolidado. Salvar em docs/sessoes/2026-04-28-leitura-total-parte2.md."

---

*Gerado por Claude Code (Opus 4.7 1M context) em 2026-04-28, fim de sessão Sprint 13a fechada.*
*Read-only. Nenhuma modificação em código ou docs originais.*
