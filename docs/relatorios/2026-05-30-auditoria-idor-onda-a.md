# Auditoria IDOR Onda A — Módulos Secundários Alto Risco (30/05/2026)

> Gerada via **Dynamic Workflow** (BQ.5 Onda A) — 25 subagentes, 1.242.427 tokens, ~3.4 min.
> Escopo: 20 módulos de alto risco NÃO cobertos pela auditoria núcleo.
> Complementa `docs/relatorios/2026-05-30-auditoria-idor-workflow.md` (núcleo, 18 IDORs já corrigidos em BQ.1-BQ.4).

## Resumo executivo

| Métrica | Valor |
|---|---|
| Endpoints de mutação mapeados | 87 |
| Seguros | 67 |
| Suspeitos brutos | 20 |
| **IDORs CONFIRMADOS** | **19** |
| CRÍTICOS | 2 |
| ALTOS | 12 |
| MÉDIOS | 4 |
| BAIXOS | 1 |

**Total geral do sistema (núcleo + Onda A):** 18 + 19 = **37 IDORs** (18 corrigidos, 19 pendentes).

**Módulos LIMPOS (todos seguros):** cooperativas, convenios (×3), clube-vantagens, conversao-credito, convite-indicacao, contas-pagar (BH fez certo!), bandeira-tarifaria, planos, alocacao. 67 de 87 endpoints seguros.

**Módulos com IDOR:** administradoras, documentos, ocorrencias, prestadores, modelos-cobranca, condominios, observador, lead-expansao.

**Padrão idêntico ao núcleo:** controller não passa cooperativaId / service findUnique sem filtro / body-injection. Fix mecânico igual BQ.1-BQ.4.

---

## CRÍTICOS (2)

### CA1 — PATCH /administradoras/:id (`administradoras.service.ts:43`)
ADMIN edita administradora de outro tenant. Padrão de proteção existe em `findOne` mas omitido na escrita. Fix: posse antes do update.

### CA2 — DELETE /administradoras/:id (`administradoras.service.ts:50`)
ADMIN desativa administradora alheia. Fix: posse antes do soft-delete.

---

## ALTOS (12)

| ID | Endpoint | Service | Problema |
|---|---|---|---|
| AA1 | POST /administradoras | `:38` | body-injection cooperativaId |
| AA2 | PATCH /documentos/:id/aprovar | `:51` | sem posse via cooperado (dispara WhatsApp ao cooperado alheio) |
| AA3 | PATCH /documentos/:id/reprovar | `:85` | idem |
| AA4 | DELETE /documentos/:id | `:160` | deleta doc + arquivo Supabase de outro tenant |
| AA5 | PUT /ocorrencias/:id | `:54` | edita ocorrência alheia |
| AA6 | DELETE /ocorrencias/:id | `:58` | deleta ocorrência alheia |
| AA7 | PATCH /prestadores/:id | `:31` | sem posse + body-injection (DTO tem cooperativaId) |
| AA8 | DELETE /prestadores/:id | `:34` | deleta prestador alheio |
| AA9 | PUT /modelos-cobranca/:id | `:24` | edita modelo de outro tenant |
| AA10 | POST /modelos-cobranca/:id/ativar | `:32` | ativa modelo alheio |
| **AA11** | POST /modelos-cobranca/:id/desativar | `:38` | **pode desativar modelo GLOBAL usado por TODOS os tenants (impacto sistêmico)** |
| AA12 | DELETE /observador/:id | `:69` | encerra observação de outro tenant |

---

## MÉDIOS (4)

| ID | Endpoint | Problema |
|---|---|---|
| MA1 | POST /documentos/upload/:cooperadoId | upload em cooperado alheio + WhatsApp |
| MA2 | POST /ocorrencias | body-injection cooperativaId + cooperadoId cross-tenant |
| MA3 | POST /prestadores | body-injection cooperativaId |
| MA4 | POST /condominios | body-injection (`body.cooperativaId || jwt`) |

## BAIXO (1)

| ID | Endpoint | Problema |
|---|---|---|
| BA1 | POST /condominios/:id/rateio | leitura cross-tenant (vaza nomes/cotas de membros alheios) |

---

## Plano de correção (BQ.6 — fatias)

Fix idêntico ao BQ.1-BQ.4 (posse + SUPER_ADMIN bypass; body-injection → JWT). Sugestão:
- **BQ.6.1** — administradoras (CA1+CA2+AA1) + modelos-cobranca (AA9+AA10+AA11, atenção modelo global) — críticos + impacto sistêmico
- **BQ.6.2** — documentos (AA2+AA3+AA4+MA1) — via cooperado, dispara WhatsApp
- **BQ.6.3** — ocorrencias (AA5+AA6+MA2) + prestadores (AA7+AA8+MA3, remover cooperativaId dos DTOs)
- **BQ.6.4** — condominios (MA4+BA1) + observador (AA12)
- Cada fatia: fix + spec isolamento + smoke cross-tenant

**Pendente:** Onda B (whatsapp/notificacoes/asaas/gateways/infra) ainda não auditada.
