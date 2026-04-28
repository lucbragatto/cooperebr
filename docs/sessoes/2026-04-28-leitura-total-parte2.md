# Leitura total — mapa funcional consolidado (Parte 2) — 2026-04-28

**Tipo:** read-only, gabarito para Doc-0
**Sessão:** continuação da Parte 1 fechada na manhã/tarde do mesmo dia
**Escopo desta parte:** frontend completo (Etapa 4) + schema (Etapa 5) + cruzamento das 53 funcionalidades do inventário SISGD-VISAO com código real (Etapa 6) + diagrama ASCII de interconexão (Etapa 7) + drift consolidado (Etapa 8) + hardcodes/TODOs vivos (Etapa 9) + recomendações (Etapa 10)

---

## 4. Mapeamento de frontend

### 4.1. Estatísticas globais

- **152 arquivos `page.tsx`** em `web/app/` (App Router Next.js 16)
- **5 super-rotas (raízes funcionais)**:

| Raiz | Telas (page.tsx) | Layout próprio? | Quem usa |
|---|---|---|---|
| `/dashboard/*` | 87 | ✅ `dashboard/layout.tsx` | SUPER_ADMIN + ADMIN (mistura) |
| `/parceiro/*` | 28 | ✅ `parceiro/layout.tsx` | ADMIN parceiro (visão única) |
| `/portal/*` | 16 | ✅ `portal/layout.tsx` | COOPERADO (Ana, Roberto) |
| `/proprietario/*` | 5 | ✅ `proprietario/layout.tsx` | Proprietário de usina |
| `/agregador/*` | 2 | ✅ `agregador/layout.tsx` | AGREGADOR (Carlos) |
| Públicos diretos | 14 | (sem layout — `/cadastro`, `/convite/[codigo]`, `/login`, `/entrar`, `/portal/login`, `/aprovar-proposta`, `/assinar`, `/esqueci-senha`, `/redefinir-senha`, `/selecionar-contexto`, etc.) | Anônimo / autenticado |

> **Drift estrutural confirmado e ampliado:** 3 das 5 super-rotas (`/parceiro`, `/portal`, `/proprietario`) não constam em CLAUDE.md, MAPA-INTEGRIDADE-SISTEMA, COOPEREBR-ALINHAMENTO ou RAIO-X. Apenas `/dashboard` e `/agregador` aparecem nos docs. Portanto: **49 telas (32% do total) são invisíveis na documentação principal.**

### 4.2. `/dashboard/*` — área administrativa "monolítica" (87 telas)

Mistura visões do SUPER_ADMIN com ADMIN parceiro. Sidebar reorganizada hoje em "Gestão Global" para SUPER_ADMIN e itens regulares para ADMIN.

**Subáreas:**

| Subárea | Telas | Notas |
|---|---|---|
| Núcleo (cooperados/contratos/ucs/usinas/cobrancas) | 22 | Maioria CRUD com `[id]/page.tsx` de detalhe |
| Financeiro | 7 | `/financeiro` + 6 sub: contas-pagar/contas-receber/despesas/fluxo-caixa/pix-excedente + raiz |
| Configurações | 7 | asaas/bandeiras/documentos/email/email-faturas/financeiro/seguranca |
| Motor proposta | 5 | raiz + configuracao/lista-espera/reajustes/tarifas |
| Relatórios | 4 | conferencia-kwh/expansao/inadimplencia/projecao-receita |
| SaaS / Super-Admin | 5 | super-admin (Painel SISGD), super-admin/parceiros, saas/{convenios-globais,faturas,planos} |
| Cooperativas/Parceiros (gestão admin) | 7 | cooperativas/{,nova,[id],[id]/editar} + parceiros/{,novo,configurar,[id]} |
| Comerciais (clube/cooper-token/convenios/indicacoes) | 11 | inclui `cooper-token-financeiro` e `cooper-token-parceiro` |
| Outros (administradoras/condominios/convites/observador/ocorrencias/contas-pagar/notificacoes) | 19 | |

### 4.3. `/parceiro/*` — portal admin parceiro (28 telas, **invisível em docs**)

Layout próprio com sidebar dedicada. Aparente intenção: **isolar** a visão do ADMIN parceiro do "monolito" de `/dashboard`. Sobreposição funcional grande com `/dashboard`.

```
/parceiro                    → page.tsx (dashboard próprio)
/parceiro/agregadores        → lista
/parceiro/agregadores/[id]   → detalhe
/parceiro/clube/validar      → validação clube
/parceiro/clube-vantagens
/parceiro/cobrancas
/parceiro/condominios
/parceiro/configuracoes
/parceiro/contratos
/parceiro/convenios
/parceiro/convites
/parceiro/enviar-tokens      → CooperToken parceiro: distribuir
/parceiro/faturas
/parceiro/financeiro         → raiz + 4 sub: contas-pagar, contas-receber, despesas, fluxo-caixa
/parceiro/indicacoes
/parceiro/membros            → lista
/parceiro/membros/[id]       → detalhe
/parceiro/modelos-cobranca
/parceiro/motor-proposta
/parceiro/planos
/parceiro/receber-tokens     → CooperToken parceiro: receber
/parceiro/relatorios
/parceiro/tokens-recebidos
/parceiro/ucs
/parceiro/usinas
/parceiro/usuarios
/parceiro/whatsapp
```

> **Achado:** `/parceiro/` chama `/cooperativas/meu-dashboard` (endpoint ADMIN-only existente). Provavelmente foi a tentativa anterior de criar a "visão isolada" que `/dashboard` deveria ter. Hoje as duas convivem — origem do drift.

### 4.4. `/portal/*` — área do cooperado (16 telas, **invisível em docs principais**)

| Tela | Função |
|---|---|
| `/portal/login` | login cooperado |
| `/portal` | dashboard cooperado |
| `/portal/conta` | meus dados |
| `/portal/ucs` | minhas UCs |
| `/portal/financeiro` | minhas faturas/cobranças |
| `/portal/faturas-concessionaria` | upload da fatura EDP |
| `/portal/clube` | clube vantagens (pra Ana) |
| `/portal/tokens` | meus CooperTokens |
| `/portal/creditos` | créditos kWh |
| `/portal/convenio` | meu convênio |
| `/portal/indicacoes` | minhas indicações |
| `/portal/ranking` | ranking de indicações |
| `/portal/documentos` | documentos KYC |
| `/portal/desligamento` | solicitar desligamento |
| `/portal/assinar/[token]` | assinar termo (entrada via link) |

**Cobertura vs SISGD-VISAO seção 5.3:** painel da Ana é descrito como "OK" — confirmado, está presente.

### 4.5. `/proprietario/*` — Portal Proprietário (5 telas, **mockado**)

| Tela | Função | Estado real |
|---|---|---|
| `/proprietario` | dashboard | mockado (R$ 0,50/kWh hardcoded em `usinas.service.ts:503`) |
| `/proprietario/usinas` | minhas usinas | OK |
| `/proprietario/contratos` | contratos uso | usa `ContratoUso` (existe), mas dashboard ignora ele |
| `/proprietario/repasses` | repasses recebidos | depende de cron mensal que **não existe** |
| (layout próprio) | | usa `useContexto` |

### 4.6. `/agregador/*` — Carlos (rede MLM) (2 telas)

`/agregador` (dashboard) + `/agregador/membros` (rede). SISGD-VISAO descreve este como "PARCIAL" — confirmado: existe esqueleto, cruzamento de dados real não.

### 4.7. Telas públicas e auxiliares (sem layout principal, 14)

| Tela | Função |
|---|---|
| `/` (raiz) | landing/redirect |
| `/login` | login geral |
| `/entrar` | alternativo de login |
| `/cadastro` | cadastro público V2 |
| `/convite/[codigo]` | aceitar convite agregador/indicação |
| `/aprovar-proposta` | aprovação rápida via link |
| `/assinar` | assinar termo |
| `/esqueci-senha` + `/redefinir-senha` | recuperação |
| `/selecionar-contexto` | quando usuário tem múltiplos contextos |

### 4.8. Hooks e componentes compartilhados

**Hooks (`web/hooks/`, 3 arquivos):**

- `useTipoParceiro.ts` (70 linhas) — resolve tipoMembro/tipoMembroPlural a partir de `tipoParceiro`. Usado em 21 telas (registrado no CLAUDE.md). **Débito P2:** ainda 50+ telas com termos hardcoded.
- `useContexto.ts` (96 linhas) — resolve contexto ativo (super_admin / admin_parceiro / cooperado / proprietario_usina / admin_agregador) e função `rotaPorContexto()` que define a rota home. **Esta função é o switch raiz das 5 super-rotas.**
- `useModulos.ts` — controla quais módulos o parceiro tem habilitados.

**Componentes (`web/components/`, 8 + UI + WhatsApp):**

- `AcoesLoteBar.tsx` — ações em lote
- `BadgeNivelClube.tsx` — badge de tier do clube
- `ContextoSwitcher.tsx` — troca de contexto multi-papel
- `ConviteCard.tsx` — card de convite
- `DisparoSeletivo.tsx` — disparo seletivo de mensagem
- `DualListaConcessionaria.tsx` — listagem dual concessionária (lista compensação?)
- `FaturaUploadOCR.tsx` — upload de fatura com OCR Claude
- `RelatorioFaturaCooperado.tsx` — relatório de fatura do cooperado
- `ui/` (subpasta Shadcn/UI)
- `whatsapp/` (subpasta com componentes específicos do WA)

> **Achado:** existem só 3 hooks compartilhados num projeto de 152 telas. Maior parte das telas faz fetch direto via `api` (axios em `web/lib/api.ts`). Sem TanStack Query / SWR. Não é necessariamente um problema, mas confirma o estilo "client-fetch tradicional".

---

## 5. Mapeamento de schema (80 models)

Categorização funcional, baseada em análise de `backend/prisma/schema.prisma` (2.029 linhas):

### 5.1. Núcleo multi-tenant (5 models)

| Model | Linha | Função |
|---|---|---|
| `Cooperativa` | 11 | TENANT ROOT (apesar do nome) |
| `Usuario` | 75 | login/sessão |
| `Cooperado` | 106 | membro do parceiro (cooperado/consorciado/associado/condômino) |
| `DocumentoCooperado` | 195 | documentos KYC |
| `ConfigTenant` | 676 | config por parceiro |

### 5.2. Operação (UC + Usina + Contrato + Plano + Geração) (10 models)

| Model | Função |
|---|---|
| `Uc` | unidade consumidora (4 campos numéricos: numero, numeroUC, numeroConcessionariaOriginal, distribuidora) |
| `Usina` | geradora |
| `Contrato` | elo cooperado↔UC↔usina↔plano |
| `Plano` | modelo de cobrança vinculado |
| `GeracaoMensal` | kWh gerado/mês por usina |
| `MigracaoUsina` | migração entre usinas |
| `Prestador` | prestadores (manutenção etc.) |
| `UsinaMonitoramentoConfig` | config Sungrow (desligado) |
| `UsinaLeitura` | leituras (Sungrow desligado) |
| `UsinaAlerta` | alertas (Sungrow desligado) |

### 5.3. Cobrança & financeiro (15 models)

`Cobranca`, `Ocorrencia`, `FaturaProcessada`, `ConfiguracaoMotor`, `TarifaConcessionaria`, `HistoricoReajuste`, `HistoricoReajusteTarifa`, `ModeloCobrancaConfig`, `ConfiguracaoCobranca`, `PlanoContas`, `LancamentoCaixa`, `ConfiguracaoNotificacaoCobranca`, `ContaAPagar`, `BandeiraTarifaria`, `FormaPagamentoCooperado`.

### 5.4. Gateways de pagamento (8 models)

`AsaasConfig`, `AsaasCustomer`, `AsaasCobranca`, `ConfigGateway`, `ConfigGatewayPlataforma`, `CobrancaGateway`, `ConfiguracaoBancaria`, `CobrancaBancaria`.

### 5.5. SaaS multi-tenant (Luciano cobra parceiros) (2 models)

`PlanoSaas`, `FaturaSaas`. **1 fatura PENDENTE no banco hoje** (CoopereBR Teste R$ 5.900 vencida 10/04 — registro de teste).

### 5.6. Proposta + lista de espera (3 models)

`PropostaCooperado` (4 registros), `ListaEspera` (32 registros), `ContratoUso` (0 registros — esqueleto pra Portal Proprietário).

### 5.7. Convênios (3 models)

`ContratoConvenio`, `ConvenioCooperado`, `HistoricoFaixaConvenio` — 0 registros, módulo 53 KB.

### 5.8. Indicações + MLM (3 models)

`ConfigIndicacao`, `Indicacao` (10 registros), `BeneficioIndicacao`, `ConviteIndicacao` (0 enviados).

### 5.9. WhatsApp (5 models)

`ConversaWhatsapp`, `MensagemWhatsapp`, `ModeloMensagem` (21 modelos), `FluxoEtapa` (22 etapas), `LeadWhatsapp`.

### 5.10. CooperToken & Clube (10 models)

`CooperTokenLedger`, `CooperTokenSaldo`, `ConfigCooperToken`, `CooperTokenSaldoParceiro`, `CooperTokenCompra`, `OfertaClube`, `ResgateClubeVantagens`, `ConfigClubeVantagens`, `ProgressaoClube` (1 registro), `HistoricoProgressao`.

### 5.11. Estrutura física (Condomínios + Administradoras) (3 models)

`Administradora` (1 registro), `Condominio` (1), `UnidadeCondominio` (10 unidades de teste).

### 5.12. Audit & Observador (5 models)

`ObservacaoAtiva`, `LogObservacao`, `AuditLog` (criado Sprint 13a Dia 1, 0 registros — ativação Sprint 13b), `HistoricoStatusCooperado` (0 registros — esqueleto), `EmailLog` (Sprint 10).

### 5.13. Outros (8 models)

`Notificacao` (37), `ListaContatos`, `ConversaoCreditoSemUc`, `ModeloDocumento`, `LeadExpansao` (0), `NpsResposta`, `TransferenciaPix` (PIX excedente).

### 5.14. Total: 80 models

| Categoria | Models | % |
|---|---|---|
| Núcleo multi-tenant | 5 | 6,3% |
| Operação | 10 | 12,5% |
| Cobrança & financeiro | 15 | 18,8% |
| Gateways pagamento | 8 | 10% |
| SaaS multi-tenant | 2 | 2,5% |
| Proposta + lista | 3 | 3,8% |
| Convênios | 3 | 3,8% |
| Indicações & MLM | 3 | 3,8% |
| WhatsApp | 5 | 6,3% |
| CooperToken & Clube | 10 | 12,5% |
| Estrutura física | 3 | 3,8% |
| Audit & Observador | 5 | 6,3% |
| Outros | 8 | 10% |

---

## 6. Cruzamento — 53 funcionalidades (SISGD-VISAO seção 4) × código real

Pra cada item do inventário, descrevo **como** está implementado hoje (não só se existe). Marcação ⭐ = drift entre status declarado no doc e status real.

### 6.1. Cadastro & propostas

| Funcionalidade | Status doc | Como está implementado | Drift? |
|---|---|---|---|
| Cadastro público V2 | ✅ | `web/app/cadastro/page.tsx` + endpoints `publico` (6) — gera Cooperado em `PENDENTE_DOCUMENTOS` | — |
| Cadastro com `?ref=` | ✅ | mesma rota com query param. Gera `Indicacao` automática (model existente, 10 registros) | — |
| OCR de fatura PDF | ✅ | `FaturaUploadOCR.tsx` + `faturas.service.ts` (60KB) chama Claude AI. Pipeline E2E validado Sprint 11 Fase D | — |
| Identificação UC por OCR (4 campos) | ✅ | Sprint 11 Bloco 2 — service preenche `numero`+`numeroUC`+`numeroConcessionariaOriginal`+`distribuidora` | — |
| Cadastro admin wizard 7 passos | ✅ | `/dashboard/cooperados/novo` + subpasta `steps/` | — |
| Aprovação de documentos (KYC) | ✅ | `documentos-aprovacao.job.ts` cron horário; status `PENDENTE_DOCUMENTOS`→`APROVADO`. **Cuidado:** auto-aprova só se algum humano revisou (linha 77) | — |
| Geração de proposta FIXO_MENSAL | ✅ | `motor-proposta.service.ts` (45KB), 32 endpoints. Cálculo financeiro completo | — |
| Geração proposta COMPENSADOS / DINAMICO | 🟡 | **Bloqueio em vigor** via flag `BLOQUEIO_MODELOS_NAO_FIXO`. Sprint 17 do PLANO-ATE-PRODUCAO | — |
| Assinatura digital de termo + procuração | ✅ | `/portal/assinar/[token]` + `/assinar` (link público). Token único por proposta | — |
| Criação de Contrato (UC+Usina+Plano) | ✅ | Validação ANEEL: mesma distribuidora UC × Usina | — |
| Lista de espera | ✅ | `ListaEspera` model, 32 registros | — |
| Hook bloqueando ativação UC sem `numeroUC` | ✅ | Sprint 11 Fase D — exceção clara, bypass `ambienteTeste` | — |

### 6.2. Cobrança & pagamento

| Funcionalidade | Status doc | Implementação | Drift? |
|---|---|---|---|
| Cobrança FIXO_MENSAL | ✅ | Cron mensal → Asaas → email/WA. `cobrancas/cobrancas.job.ts` × 4 crons | — |
| Cobrança COMPENSADOS / DINAMICO | 🔴 | Engines não implementadas. Sprint 17 | — |
| Email lembrete D-3/D-1 | ✅ | Sprint 10. Cron `cobrancas` + `EmailLog` | — |
| Lembrete 24h proposta pendente | ✅ | `motor-proposta.job.ts` `EVERY_DAY_AT_9AM` | — |
| Cópia proposta assinada por email | ✅ | Sprint 10 | — |
| Webhook Asaas baixa pagamento | 🟡 | Sandbox validado Sprint 12. Produção real **nunca rodou** (nenhum cooperado pagou) | — |
| QR Code PIX + boleto | ✅ | Em sandbox | — |
| Lembrete WhatsApp cobrança vencida | ✅ | `whatsapp-cobranca.job.ts` × 3 crons (mensal/diário/tarefas-pós) | — |

### 6.3. Multi-tenant & comunicação

| Funcionalidade | Status doc | Implementação | Drift? |
|---|---|---|---|
| Email + WhatsApp por parceiro | ✅ | Sprint 11 — SMTP+IMAP por parceiro. Service em `email/`, 8 endpoints | — |
| Pipeline IMAP buscando faturas EDP | ✅ | `email-monitor.service.ts` cron 6h diário. 13/13 OCR sucesso na última rodada | — |
| Match automático fatura → cooperado | 🟡 | OK quando UC cadastrada. Pra leads (UC nova): identifica como "lead potencial" mas **sem fluxo automático** | — |
| Painel "leads potenciais" | 🔴 | **Confirmado faltando.** Lead detectado, tela não existe | — |

### 6.4. Indicações & fidelidade

| Funcionalidade | Status doc | Implementação | Drift? |
|---|---|---|---|
| Indicações com bônus em cascata (MLM) | ✅ | Em código (`indicacoes/`, 11 endpoints, 53KB cooper-token). 10 indicações no banco. **Nunca rodou ponta a ponta com pagamento real** | — |
| CooperToken (emissão, saldo, ledger) | 🟡 | Emissão funciona — 6 ledger entries, 3 saldos. Painel completo + ofertas resgatáveis: esqueleto. **Hardcode `valorTokenReais = 0.20`** em 2 lugares (cobranca-pdf:60 + cooper-token.service:258) | ⭐ |
| Clube de Vantagens (tiers) | 🟡 | 1 ProgressaoClube no banco, 0 ofertas, 0 resgates. `clube-vantagens.job.ts` cron mensal de progressão. Esqueleto | — |
| Convênios (parceiros institucionais) | 🟡 | 53 KB de código no módulo, 18 endpoints, 3 tables. **0 registros em produção.** Spec PLANO-CONVENIOS é o maior doc do projeto (1.456 linhas) | — |

### 6.5. Estruturas físicas (Condomínios + Administradoras)

| Funcionalidade | Status doc | Implementação | Drift? |
|---|---|---|---|
| Cadastro atomizado Condomínio + condôminos | 🔴 | Schema existe. Tela `/dashboard/condominios/{,novo,[id]}` existe. **Fluxo guiado não.** 1 condomínio + 10 unidades de teste | ⭐ schema + tela existem — drift menor que doc indica |
| Painel síndico | 🔴 | **Confirmado faltando.** Helena não tem login dedicado | — |
| Painel administradora | 🔴 | Esqueleto: `/dashboard/administradoras/{,novo,[id]}` (3 telas). 1 registro. Mas não é "painel administradora" — é cadastro pelo SUPER_ADMIN | ⭐ existe esqueleto de cadastro, não painel operacional |
| Painel agregador (rede MLM) | 🟡 | `/agregador` + `/agregador/membros` existem. Cruzamento real falta | — |

### 6.6. SaaS (Luciano cobra parceiros)

| Funcionalidade | Status doc | Implementação | Drift? |
|---|---|---|---|
| FaturaSaas (Luciano cobra parceiros) | 🔴 (no doc, 2026-04-26) | **Cron criado em Sprint 6 T10** (`saas.service.ts` `0 6 1 * *`). 1 fatura PENDENTE de teste no banco. Painel SISGD `/dashboard/super-admin` operacional desde 28/04 | ⭐⭐ **DOC DESATUALIZADO** — Sprint 13a P0+Dia1+Dia2+Dia3 entregaram tudo isso |
| DRE consolidado | 🔴 | `LancamentoCaixa` + `PlanoContas` existem. **Cálculo DRE não.** Sprint 8 do PLANO | — |
| Conciliação bancária | 🔴 | `integracao-bancaria/` (11 endpoints, 1 cron `5 6 * * *`). 0 configs ativas — nunca rodou | — |
| Fechamento de mês | 🔴 | Não existe | — |
| Visão cross-tenant pro Luciano | 🟡 (no doc) | **Hoje:** `/dashboard/super-admin` + `/dashboard/super-admin/parceiros` + cards de saúde em `/dashboard/cooperativas/[id]` | ⭐⭐ **DOC DESATUALIZADO** — Sprint 13a entregou |
| Painel saúde técnica (cron, OCR, WA, fila) | 🔴 | Confirmado: faltando. Citado em SISGD-VISAO 5.1 como "pulse técnico" | — |

### 6.7. Audit, segurança, infra

| Funcionalidade | Status doc | Implementação | Drift? |
|---|---|---|---|
| Audit trail completo | 🟡 | **Hoje:** `AuditLog` model criado Sprint 13a Dia 1, **0 registros**. Interceptor previsto Sprint 13b. `HistoricoStatusCooperado` também 0 | ⭐ schema atualizado |
| Notificações in-app | ✅ | 37 notificações no banco | — |
| Backup do banco | 🟡 | Supabase faz snapshot automático. **Restore manual nunca testado** | — |
| Modo Observador | ✅ | `/dashboard/observador` + 1 cron `EVERY_5_MINUTES` (expirar sessões) | — |
| Whitelist envios em dev | ✅ | Sprint 10 | — |
| Mascaramento LGPD em dev | ✅ | Sprint 10 — 112 registros | — |
| Reset senha por email | ✅ | `/esqueci-senha` + 5 endpoints `auth` | — |
| Login facial (FaceMatch) | 🟡 | `fotoFacialUrl` existe, upload OK. **FaceMatch contra documento não roda** | — |

### 6.8. Concessionária (EDP) e operação

| Funcionalidade | Status doc | Implementação | Drift? |
|---|---|---|---|
| Tradução pra outras concessionárias | 🟡 | Enum `DistribuidoraEnum` aceita CEMIG/Enel/Light/Celesc. OCR só validado em EDP | — |
| Sungrow (monitoramento real) | 🟡 | Módulo existe, **cron comentado** intencionalmente (`monitoramento-usinas`) | — |
| PIX Excedente | 🟡 | Código pronto. `ASAAS_PIX_EXCEDENTE_ATIVO` desligado em prod. Tela `/dashboard/financeiro/pix-excedente` existe | — |
| Bandeiras tarifárias ANEEL | ✅ | `bandeira-aneel.job.ts` `0 6 1 * *` mensal | — |

### 6.9. Faltas crônicas (5 itens 🔴 confirmados)

| Funcionalidade | Status doc | Verdade |
|---|---|---|
| Contas a Pagar (despesas parceiro) | 🟡 | Tela `/dashboard/contas-pagar` + `/dashboard/financeiro/contas-pagar` (duplicação). Model `ContaAPagar` existe. **0 registros** | ⭐ duplicação de tela |
| Contas a Receber separado | 🔴 | **Confirmado faltando** — tudo em `LancamentoCaixa` misturado | — |
| Lista de compensação EDP | 🔴 | `DualListaConcessionaria.tsx` é componente em `web/components/`! E tela `/dashboard/usinas/listas` existe! | ⭐⭐ **DRIFT GRAVE** — está implementado parcialmente, doc diz "manual via SQL". Verificar se é 🟡 ou ✅ |
| Lista de homologação EDP | 🔴 | Mesmo: `/dashboard/usinas/listas` existe. Status UC `AGUARDANDO_CONCESSIONARIA` no schema | ⭐ pode estar parcial, não 🔴 puro |

> **Achado crítico:** SISGD-VISAO 4.2 diz que listas de compensação/homologação EDP "são exportação manual via SQL". Mas `/dashboard/usinas/listas/page.tsx` existe e o componente `DualListaConcessionaria.tsx` parece feito justamente pra isso. **Auditoria dedicada necessária** — possivelmente entregue Sprint 11 e não documentado.

### 6.10. Resumo do cruzamento (52 itens efetivos)

- **Status correto no doc:** ~38 itens (73%)
- **Drift menor (⭐):** ~9 itens (17%)
- **Drift grave (⭐⭐):** ~5 itens (10%) — todos itens onde a Sprint 13a (e Sprint 11 listas EDP) entregou e o doc não foi atualizado

---

## 7. Diagrama ASCII de interconexão

Visão das **5 super-rotas frontend** + os **44 módulos backend** + as **5 entidades-elo** + os **10 fluxos críticos**:

```
                        ┌─────────────────────────────────────────────┐
                        │       FRONTEND (Next.js 16, App Router)     │
                        ├─────────────────────────────────────────────┤
                        │                                             │
   ┌────────────────────┼─────────────────┬────────────────┬──────────┼─────────────┐
   │                    │                 │                │          │             │
   ▼                    ▼                 ▼                ▼          ▼             ▼
/dashboard/         /parceiro/         /portal/      /proprietario/ /agregador/  públicas
(87 telas)          (28 telas)         (16 telas)    (5 telas)       (2 telas)   (14 telas)
SUPER_ADMIN+ADMIN   ADMIN parceiro     COOPERADO     proprietário    AGREGADOR   anônimas
                    (visão isolada)    (Ana,Roberto) (mockado)       (Carlos)    (cadastro,
                    INVISÍVEL EM DOCS  INV. EM DOCS  INV. EM DOCS                login etc.)
                                                                                  
                                       hooks: useTipoParceiro · useContexto · useModulos
                                       components: 8 + ui/ + whatsapp/

═══════════════════════════════════════════════════════════════════════════════════════

                        ┌─────────────────────────────────────────────┐
                        │   BACKEND (NestJS, 44 módulos, 447 endpoints) │
                        └─────────────────────────────────────────────┘

  ┌─────────────────┬──────────────────┬──────────────────┬───────────────────┐
  │   AUTENTICAÇÃO  │  TENANT/SAAS     │   CADASTRO       │   COMUNICAÇÃO     │
  ├─────────────────┼──────────────────┼──────────────────┼───────────────────┤
  │ auth (17 ep)    │ cooperativas(12) │ cooperados (33)  │ whatsapp (27,5cr) │
  │ + JWT + roles   │ + IDOR fix hoje  │ publico (6)      │ email (8,1cr)     │
  │ + tenant-guard  │ saas (11)        │ documentos       │ email-monitor(1cr)│
  │   (Sprint 13a)  │ planos (6)       │ convite-indicacao│ notificacoes      │
  │                 │ admin/condom.    │ indicacoes (11)  │ modelos-mensagem  │
  └─────────────────┴──────────────────┴──────────────────┴───────────────────┘

  ┌─────────────────┬──────────────────┬──────────────────┬───────────────────┐
  │   OPERAÇÃO      │  COBRANÇA        │   FINANCEIRO     │   GATEWAY $        │
  ├─────────────────┼──────────────────┼──────────────────┼───────────────────┤
  │ ucs (6)         │ cobrancas(10,4cr)│ financeiro (30)  │ gateway-pagamento │
  │ usinas (12)     │ faturas (16)     │ contas-pagar     │ asaas (9)         │
  │ contratos (7)   │ motor-proposta   │ relatorios (5)   │ integracao-banc.  │
  │ geracao-mensal  │   (32,1cr)       │ bandeira-tarif.  │   (11,1cr)        │
  │ migracoes-usina │ modelos-cobranca │   (7,1cr)        │ TransferenciaPix  │
  │ monitor.usinas  │ configuracao-cob.│ contratos-uso    │                   │
  │ (Sungrow off)   │                  │   (no financeiro)│                   │
  └─────────────────┴──────────────────┴──────────────────┴───────────────────┘

  ┌─────────────────┬──────────────────┬──────────────────┬───────────────────┐
  │   FIDELIDADE    │  CONVÊNIOS       │   AUDIT/OBSERV.  │   OUTROS          │
  ├─────────────────┼──────────────────┼──────────────────┼───────────────────┤
  │ cooper-token    │ convenios        │ observador(1cr)  │ ocorrencias (6)   │
  │   (28,2cr)      │   (18,1cr,53KB)  │ AuditLog (Sp13b) │ prestadores (5)   │
  │ clube-vantagens │ conversao-credito│ HistoricoStatus  │ administradoras   │
  │   (15,1cr)      │                  │ EmailLog         │ condominios (8)   │
  │                 │                  │                  │ lead-expansao     │
  │                 │                  │                  │ fluxo-etapas      │
  │                 │                  │                  │ config-tenant     │
  └─────────────────┴──────────────────┴──────────────────┴───────────────────┘

═══════════════════════════════════════════════════════════════════════════════════════
                              5 ENTIDADES-ELO
                              (que conectam o sistema todo)

         Cooperativa          ┌── Cooperado ──┐
       (TENANT ROOT)          │               │
              ▲               ▼               ▼
              │           Contrato ◄─────► UC ◄──── distribuidora (EDP, etc.)
              │               ▲               
              ▼               │
         PlanoSaas            ▼               
         FaturaSaas        Plano + Usina
                              │
                              ▼
                          Cobrança ──► Asaas (PIX/boleto) ──► webhook ──► LancamentoCaixa

═══════════════════════════════════════════════════════════════════════════════════════
                            10 FLUXOS CRÍTICOS (ponta a ponta)

1. CADASTRO PÚBLICO  → /cadastro → publico.controller → Cooperado(PENDENTE_DOCUMENTOS)
                                                       → DocumentoCooperado
                                                       → email confirmação

2. PROPOSTA          → motor-proposta calcula → PropostaCooperado → email "assine"
                       → /portal/assinar/[token] → Contrato criado → Asaas customer

3. OCR FATURA EDP    → email-monitor IMAP → faturas.service Claude AI
                       → FaturaProcessada → match com Cooperado/UC
                                          → ou marca como "lead potencial"

4. COBRANÇA MENSAL   → cron mensal → cobrancas.job → Cobranca → Asaas → email/WA
                       → cooperado paga → webhook Asaas → LancamentoCaixa

5. INDICAÇÃO/MLM     → ?ref= → Indicacao → primeira fatura paga → BeneficioIndicacao
                       → CooperTokenLedger (50 tokens) → cron diário cooper-token

6. CLUBE             → cron mensal → ProgressaoClube (BRONZE/PRATA/OURO/DIAMANTE)
                       → OfertaClube (0 hoje) → ResgateClubeVantagens

7. PIX EXCEDENTE     → cobrança paga > cota → TransferenciaPix → Asaas (DESLIGADO)

8. SAAS BILLING      → cron mensal saas.service → FaturaSaas → email Luciano→parceiro
                       → painel /dashboard/super-admin (Sprint 13a)

9. PORTAL PROPRIETÁRIO (mockado)
                     → /proprietario → usinas.proprietarioDashboard
                       → kWh × R$ 0,50 hardcoded (não usa ContratoUso)

10. AUDIT TRAIL      → (Sprint 13b) interceptor → AuditLog
                     → hoje 0 registros (esqueleto)

═══════════════════════════════════════════════════════════════════════════════════════
                          27 CRONS ATIVOS (1 comentado)

DIÁRIOS: cobrancas×4 (lembrete/vencer/multa/notificar) · cooper-token (excedentes)
         convenios · convite-indicacao×2 · documentos (horário) · cooperados×2
         email-monitor (6h) · integracao-bancaria · motor-proposta (9h)
         observador (5min) · posicao-cooperado · whatsapp-cobranca×2

MENSAIS: bandeira-aneel · clube-vantagens · cooper-token (expirar) · saas (FaturaSaas)
         whatsapp-cobranca-mensal · whatsapp-mlm

HORÁRIOS: whatsapp-conversa.job

LEGADOS: email-recebimento (5min, antigo) · monitoramento-usinas (COMENTADO Sungrow)
```

---

## 8. Drift consolidado (Etapa 8 do prompt)

### 8.1. Drift estrutural (frontend invisível em docs)

| Item | Telas | Status nos docs |
|---|---|---|
| `/parceiro/*` | 28 | **invisível** em CLAUDE.md, MAPA-INTEGRIDADE-SISTEMA, COOPEREBR-ALINHAMENTO, RAIO-X-PROJETO |
| `/portal/*` | 16 | **invisível** nos mesmos 4 docs (citado parcialmente em SISGD-VISAO 5.3 como "OK" sem listar telas) |
| `/proprietario/*` | 5 | **invisível** (citado como mockado em sessões, sem inventário de telas) |
| `/agregador/*` | 2 | mencionado em SISGD-VISAO 5.4 como "PARCIAL"; sem inventário |

**Total: 51 telas (33% das 152) sem rastro nos docs.**

### 8.2. Drift de status (funcionalidades)

| Categoria | Quantidade | Itens |
|---|---|---|
| Drift menor (⭐) | ~9 | CooperToken hardcode 0.20, Condomínio cadastro existe, Administradora esqueleto, Audit schema atualizado, etc. |
| Drift grave (⭐⭐) | ~5 | Painel SISGD (entregue Sprint 13a), Lista Compensação/Homologação EDP (componente existe), FaturaSaas (cron existe Sprint 6 T10), visão cross-tenant Luciano (entregue) |

### 8.3. Drift de inventário do banco

RAIO-X-PROJETO 2026-04-20:
- Diz "5 cooperativas (1 lixo)" → hoje 2 (Sprint 13a P0 limpou)
- Diz "FaturaSaas 0 — sem cron" → hoje 1 fatura, cron rodando
- Diz "ContratoUso 0 — nunca usado" → hoje 0 ainda, mas service existe completo
- Diz "AsaasCobranca 0" → ainda 0 em prod, sandbox sim
- Diz "125 cooperados" → 303 hoje (Sprint 11 normalizou + crescimento)

### 8.4. Múltiplas fontes-da-verdade simultâneas

4 docs declarando-se "fonte única":

| Doc | Idade | Cobertura | Estado |
|---|---|---|---|
| SISGD-VISAO-COMPLETA | 2026-04-26 | narrativa humana + inventário | mais valioso, atualizar pra capturar Sprint 13a |
| COOPEREBR-ALINHAMENTO | 2026-04-23 | "documento único definitivo" | parcialmente desatualizado |
| RAIO-X-PROJETO | 2026-04-20 | snapshot do banco + sidebar | desatualizado |
| MAPA-INTEGRIDADE-SISTEMA | 2026-04-28 | log cronológico | bússola perdida — virou append-only |

**Hierarquia atual:** nenhuma. Sobreposição alta. Origem clara do drift.

### 8.5. Memória `~/.claude/...` vs `memory/` no repo

- `~/.claude/projects/C--Users-Luciano-cooperebr/memory/` — memória do Claude Code (a leitura desta sessão)
- `memory/` (raiz do repo) — 13 arquivos antigos mar/abr 2026 com correções pontuais. Pasta legítima do repo. **Não é a mesma coisa.**

Confusão recorrente — risco vivo (já causou erro nesta sessão de manhã ao analisar arquivos recebidos).

---

## 9. Hardcodes e TODOs vivos (Etapa 9 do prompt)

### 9.1. Hardcodes de valor (críticos)

| Local | Valor | Implicação |
|---|---|---|
| `backend/src/usinas/usinas.service.ts:503` | `kwhGeradoMes * 0.50` | Portal Proprietário usa R$ 0,50/kWh fixo. **Bloqueia** Portal Proprietário virar real |
| `backend/src/usinas/usinas.service.ts:525` | `g.kwhGerado * 0.50` | Mesmo problema, em outro lugar |
| `backend/src/cobrancas/cobranca-pdf.service.ts:60` | `valorTokenReais = 0.20; // TODO: ler do plano` | PDF mostra valor de token errado se plano não for 0,20 |
| `backend/src/cooper-token/cooper-token.service.ts:258` | `quantidade * 0.20` (TODO) | Cálculo de "valor estimado" em tokens — mesmo problema |
| `web/app/dashboard/cobrancas/nova/page.tsx:68` | `valorTokenReais = 0.20` | Replicação do erro no frontend |
| `web/app/dashboard/configuracoes/asaas/page.tsx:24` | `cooperativaId hardcoded pra CoopereBR (primeira cooperativa)` | **SUPER_ADMIN não consegue configurar Asaas de outro parceiro pelo painel** — bloqueio multi-tenant |

### 9.2. TODOs vivos (10 totais nos arquivos críticos)

1. `whatsapp-fluxo-motor.service.ts:175` — "TODO: integrar com notificação (email, Slack, etc.)"
2. `cobranca-pdf.service.ts:60` — "TODO: ler valorTokenReais do plano" (já listado acima)
3. `cooper-token.service.ts:258` — "TODO: ler valorTokenReais do plano" (idem)
4. `faturas.service.ts:1818` — "TODO T4b/Sprint7: valorBruto aqui deveria ser 'valor sem cooperativa'" (Sprint 7 antigo, ainda em vigor)
5. `metricas-saas.service.ts:11` — "Cache 5min: TODO Sprint 13b com @CacheKey/@CacheTTL ou Redis" (Sprint 13b já planejado)
6. `web/app/dashboard/cobrancas/nova/page.tsx:68` — TODO replicado

### 9.3. Fallbacks hardcoded em WhatsApp (intencionais)

- `whatsapp-fluxo-motor.service.ts:54` — fallback hardcoded quando `FluxoEtapa` não cobre estado
- `whatsapp-bot.service.ts:411` — fallback hardcoded em erro do motor dinâmico
- `whatsapp-bot.service.ts:143` — fallback hardcoded de mensagens

> Estes são intencionais e estão documentados nas próprias linhas como fallback. Aceitável, mas o frontend `whatsapp-config/page.tsx:660` mostra um badge "Fallback hardcoded" — tornado visível pro admin, ótimo.

### 9.4. Templates hardcoded

- `motor-proposta.service.ts:1633` — "Retornar templates hardcoded se não existirem no banco" (idem WhatsApp, é fallback intencional)

---

## 10. Recomendações priorizadas (Etapa 10)

### 10.1. Antes de Doc-0 (próxima sessão claude.ai)

1. **Atualizar SISGD-VISAO-COMPLETA seção 4** pra refletir Sprint 11 (numeração UC, listas EDP existentes) + Sprint 13a (Painel SISGD entregue, FaturaSaas com cron, parceiros listados, cards saúde) — **5 itens 🔴/🟡 viraram ✅/🟡**.
2. **Adicionar inventário das 4 super-rotas frontend invisíveis** (parceiro/portal/proprietario/agregador) ao SISGD-VISAO seção 5 ou nova seção 6.
3. **Decidir hierarquia entre os 4 docs** — qual é fonte única, quais viram subordinados.

### 10.2. Sprint dedicada de drift (P2 já registrado em débitos)

- Mover RAIO-X-PROJETO para `docs/historico/` (snapshot histórico) ou regenerar
- Quebrar MAPA-INTEGRIDADE-SISTEMA em 2: bússola estrutural (curta) + log de mudanças (cronológico)
- Renomear `memory/` raiz pra `legado/notas-mar-abr-2026/` pra evitar colisão com `~/.claude/...`
- Auditoria das listas EDP em `/dashboard/usinas/listas` — confirmar se está completa ou parcial

### 10.3. Antes de onboarding Sinergia / produção real

1. **Auditoria geral IDOR P2** (já registrada) — replicar `assertSameTenantOrSuperAdmin` em cooperados, contratos, cobranças, usinas, ucs, faturas. **1-2 dias úteis.**
2. **Resolver hardcode de Asaas SUPER_ADMIN** em `configuracoes/asaas/page.tsx:24` — bloqueio multi-tenant real
3. **Resolver hardcode R$ 0,50/kWh** em Portal Proprietário antes do primeiro repasse real
4. **Vocabulário multi-tipo** — 50+ telas + 73 exceptions backend ainda hardcoded (P2 já registrado)
5. **Cobertura de testes:** 17 specs / 80 models / 447 endpoints = ~2% — débito P2 a registrar formalmente

### 10.4. Próximo construtivo

- Confirmar Auditoria IDOR como Sprint imediata (Luciano decide)
- Sprint 14 cron FaturaSaas pré-prod (já planejado)
- Portal Proprietário (5-7 dias) usando ContratoUso
- Sprint 17 engine COMPENSADOS (alto risco)

---

## 11. Estado da sessão e fechamento

**Token usage:** moderado — Parte 2 cabe inteira sem comprometer Doc-0.

**Cobertura final da leitura total (Parte 1 + Parte 2):**

- ✅ Inventário 130+ docs (Etapa 1)
- ✅ Leitura sistemática Tier 1 (Etapa 2)
- ✅ Backend 44 módulos / 447 endpoints / 27 crons (Etapa 3)
- ✅ Frontend 152 telas / 5 super-rotas / 3 hooks / 8 componentes (Etapa 4)
- ✅ Schema 80 models classificados em 13 categorias (Etapa 5)
- ✅ Cruzamento 53 funcionalidades × código (Etapa 6)
- ✅ Diagrama ASCII (Etapa 7)
- ✅ Drift consolidado (Etapa 8)
- ✅ Hardcodes e TODOs vivos (Etapa 9)
- ✅ Recomendações (Etapa 10)

**Achados ouro (não estavam na hipótese inicial):**

1. **49 telas invisíveis** em docs principais (3 super-rotas inteiras: parceiro/portal/proprietario)
2. **Listas Compensação/Homologação EDP têm tela e componente próprios** (`/dashboard/usinas/listas` + `DualListaConcessionaria.tsx`) — doc diz que é manual via SQL
3. **Hardcode crítico em `configuracoes/asaas/page.tsx:24`** — SUPER_ADMIN bloqueado pra configurar Asaas de outro parceiro pelo painel
4. **5 itens 🔴/🟡 do SISGD-VISAO já estão ✅** após Sprint 13a + Sprint 11
5. **Função `rotaPorContexto()` em `useContexto.ts`** é o switch raiz das 5 super-rotas — núcleo arquitetural não documentado

**Próximo passo sugerido (escolha do Luciano):**

1. **Doc-0 (claude.ai)** — usar Parte 1 + Parte 2 + manifesto Luciano pra reescrever fontes-da-verdade (CLAUDE.md / PRODUTO.md / SISTEMA.md em fatias)
2. **Auditoria IDOR P2** — replicar helper antes de Sprint 14 ou Sinergia
3. **Sprint 14** (cron FaturaSaas pré-produção)

**Frase de retomada se for Doc-0:**

> Entrar em sessão claude.ai com Parte 1 + Parte 2 colados + manifesto Luciano. Pedir reorganização de CLAUDE.md / SISGD-VISAO / COOPEREBR-ALINHAMENTO numa hierarquia de 3 níveis: (1) PRODUTO (humano), (2) SISTEMA (técnico), (3) MAPA-INTEGRIDADE (bússola estrutural curta). RAIO-X vai pra histórico. Memory/ raiz renomeado.

---

*Gerado por Claude Code (Opus 4.7 1M context) em 2026-04-28 fim do dia, após Sprint 13a 3/3 fechado e Parte 1 entregue.*
*Read-only. Nenhuma modificação em código ou docs originais.*
