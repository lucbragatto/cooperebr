# Adenda — correções na frase de retomada pós-standby — 22/07/2026

## TL;DR

Sessão curta (~15min) sob `/fechamento-sessao` re-invocado pra formalizar 3 correções aplicadas na FRASE DE RETOMADA do fechamento anterior (`56a04fb`). Todas são falso-diagnóstico que estava gravado em documento permanente — corrigir antes que virasse convenção. Adicionalmente 1 débito novo catalogado (`D-novo-WA-DIAGNOSTICO-REPAREAR-PRECIPITADO`). Zero mudança de código, só docs.

## Marco entregue

**Correção da frase de retomada 21/07** — falso-diagnósticos removidos antes de virarem convenção.

## Commits do dia (2)

| Hash | Mensagem |
|---|---|
| `9ffd8ab` | `docs(controle): corrige diagnostico WA + comando smoke na frase de retomada` |
| _(este)_ | `docs(sessao): fechamento 22/07 — adenda correcoes frase retomada` |

## Entregas técnicas

### 3 correções na FRASE DE RETOMADA (`docs/CONTROLE-EXECUCAO.md`)

**Correção 1 — PASSO 0 item 4 comando smoke WA:**
- Antes: `curl http://localhost:3002/status`
- Depois: `Invoke-RestMethod http://127.0.0.1:3002/status`
- Razão: `curl` + `localhost` resolve `::1` (IPv6) e dá exit 7 FALSO-NEGATIVO — o serviço wa-service escuta `127.0.0.1` IPv4 puro (loopback-only bind desde a corretiva de `d5e547c`). O falso-negativo já tinha sido sinalizado em 21/07 manhã e não tinha sido aplicado, voltou pra frase.

**Correção 2 — PASSO 0 item 4 conclusão do WhatsApp:**
- Removido: "bot precisa re-parear pelo celular"
- Substituído por escada de diagnóstico (`a → b → c → d`):
  - a) Checar zumbi: `Get-NetTCPConnection -LocalPort 3002 -State Listen` (mais de um processo ou PID que PM2 não conhece = zumbi).
  - b) `pm2 restart cooperebr-whatsapp` + `Start-Sleep 20` + re-checar `/status`.
  - c) Ler o log: `pm2 logs cooperebr-whatsapp --lines 40 --nostream` — procurar `405`, `Connection Failure`, ou `loggedOut` explícito.
  - d) SÓ re-parear se o log mostrar `loggedOut/401` E o próprio código tiver apagado o `auth_info` (`index.mjs` faz `fs.rmSync(AUTH_DIR)` em desconexão real).
- Evidência estrutural que impede o falso-diagnóstico: `/status = failed` COM QR, MAS `auth_info/` existe com 1.578 arquivos + `creds.json` gravado 21/07 12:46. Se fosse desconexão real, o `fs.rmSync` teria rodado. **Não é sessão perdida, é `failed` de esgotamento de retry** (mesmo estado 20/07 manhã, resolvido com restart sem re-parear).

**Correção 3 — PASSO 0 item 5 Bloco 6 ROTA B:**
- Antes: "Bloco 6 monitor pendente (agendar pra 22/07)".
- Depois: **JÁ CHECADO 22/07 09:00 no log real** (`logs/nest-out.log`):
  - Usos do fallback `?secret=` hoje: **0**
  - `Unauthorized` hoje: **0**
  - Inbounds reais pós-rotação das 07:46: **2** (07:51 e 08:05), ambos via header
- Sinal limpo. Janela 24h que fecha 22/07 07:46 é formalidade. Pode retirar o fallback query do receptor (`whatsapp-fatura.controller.ts:100-111`) quando der.

## Bugs resolvidos / catalogados

| # | Sev | Causa raiz | Fix | Status |
|---|---|---|---|---|
| `D-novo-WA-DIAGNOSTICO-REPAREAR-PRECIPITADO` | P3 | "Re-parear a sessão WhatsApp" foi recomendado 4× nesta semana e estava errado nas 4 (causa real: versão WA vencida ou processo zumbi). Falso-diagnóstico estrutural — não distingue `failed` de retry esgotado de desconexão real do Meta. | Escada de diagnóstico canônica no PASSO 0 item 4; commentário `WARNING` proposto no `index.mjs` no callsite do `fs.rmSync(AUTH_DIR)` alertando que é a ÚNICA condição que exige re-pareamento; propagar padrão pra frases de retomada e docs futuras. | CATALOGADO (aplicado no PASSO 0 item 4 da frase 22/07; commentário no `index.mjs` fica pra sessão futura) |

## Decisões estratégicas catalogadas

Nenhuma decisão nova nesta adenda — apenas formalização de padrões operacionais:

- Regra derivada: **evidência estrutural precede recomendação de ação em WA** — antes de sugerir "re-parear", checar se o próprio código apagou o `auth_info` (única condição válida). Documentada em `D-novo-WA-DIAGNOSTICO-REPAREAR-PRECIPITADO`.
- Regra derivada: **smoke de WA sempre com IPv4 explícito** (`127.0.0.1`) em vez de `localhost`, pra evitar exit 7 falso-negativo. Documentado no PASSO 0 item 4.

## Próximo passo

**Tarefa 4 — Asaas EMISSÃO** (idempotência + retry unificado + `D-novo-PIX-EXCEDENTE-IDEMPOTENCIA` da mesma família). Fase 1 read-only já feita em 21/07 tarde pelo orquestrador — desenho aprovado das 6 correções travado na FRASE DE RETOMADA (não refazer levantamento). Ver `docs/sessoes/2026-07-21-corretiva-idor-multitenant.md` seção "Próximo passo" e a FRASE DE RETOMADA em `docs/CONTROLE-EXECUCAO.md`.

## Pré-requisitos leitura próxima sessão

- `docs/CONTROLE-EXECUCAO.md` seção `## FRASE DE RETOMADA — próxima sessão Code` (corrigida 22/07)
- `docs/sessoes/2026-07-21-corretiva-idor-multitenant.md` (contexto Corretiva IDOR — helper `resolveTenantIdFromReq`, padrão `@TenantResource` + `via`)
- `docs/sessoes/2026-07-21-rota-b-achado-3-rotacao-secret.md` (contexto ROTA B — mensageria WA 9/9)
- `docs/sessoes/2026-07-22-adenda-correcoes-frase-retomada.md` (este)
- `docs/debitos-tecnicos.md` seções das 2 últimas atualizações (22/07 + 21/07 tarde)

## Carry-overs (não-bloqueantes)

- **Sessão WA em `awaiting_qr` do 21/07 tarde** — cascade do reparo PM2 daemon. Aplicar escada de diagnóstico (PASSO 0 item 4) antes de re-parear.
- **`docs/diagramas/cadastro-usinas.html` M pré-existente** — line-ending flip (última mudança semântica 17/05 commit `7382063`). NÃO commitar.
- **Untrackeds catalogados**: `.agent/`, `.claude/agents/*` não-meus, `.e2e-tmp/`, scripts experimentais, `whatsapp-service/auth_info.acl.pre-corretiva.bak`.
- **Frontend com IP `.11`** — DHCP atual. Se mudar de novo, rebuild frontend + restart (`D-novo-API-URL-IP-CONGELADO`).
- **`D-novo-BJ /uploads/` estático sem auth** — deferido desde 21/07 tarde; segue pending pra sessão futura de segurança.

## Regras aplicadas na sessão

- **regra_fechamento_sessao_inegociavel** (13/05) — este doc + frase de retomada re-apresentada no terminal + commit/push.
- **regra_secrets_nao_memorizar_26_05** — nada de secret nesta adenda.
- **regra_validacao_previa_e_retomada** (Decisão 23) — pré-validações executadas antes de qualquer edição.
- **regra_nao_trabalhar_paralelo_com_code_17_05** — Luciano apontou os 3 falso-diagnósticos, Code corrigiu passo a passo.
- **CLAUDE.md — SEM `git add .`** — respeitado; só doc-sessão + CONTROLE-EXECUCAO + debitos-tecnicos adicionados explicitamente (commit anterior `9ffd8ab`).

## Nota de método (registrar)

**Falso-diagnóstico virou débito P3** porque foi recomendado 4× nesta semana. O sinal é: quando uma recomendação técnica é reincidente E fica errada em >50% dos casos, ela merece débito estrutural — não é caso isolado, é padrão de raciocínio errado. Regra derivada: no fechamento canônico, releitura da FRASE DE RETOMADA passa por "esse conselho tem evidência estrutural que o valida em runtime?". Se não, remover ou reformular como escada de diagnóstico.
