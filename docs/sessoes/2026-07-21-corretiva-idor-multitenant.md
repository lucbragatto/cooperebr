# Corretiva IDOR/multi-tenant — sessão dedicada — 21/07/2026

## TL;DR

Sessão dedicada de segurança (Luciano orquestrando, Code executando) fechou **13 furos IDOR/multi-tenant + SUSPECT contratos**, em 3 ondas por severidade + 1 onda 3.5 pós-revisão. Escopo definido no início: **NÃO tocar em asaas/cobrancas/cooper-token** (reservados pra Tarefa 4). **6 commits pushados** (`cfe4813..f15439f`), 25 arquivos backend + specs + débitos. **Suite 110/110 PASS** (Auth 90 + Onda 1: 5 + Onda 2: 7 + HS256: 8 = novos 20). **Zero regressão.** 2 revisores obrigatórios rodados no fim (multitenant + financeiro-token), 3 fixes P1/P2 aplicados pós-revisão + 7 débitos catalogados. A prova por mutação foi feita em runtime em 3 pontos (Onda 1 pixChave, Onda 2 faturas gate, Onda 3 HS256 SEM pin). Corretiva Mensageria WA 9/9 do arco 16-21/07 permanece fechada; esta sessão IDOR é frente independente.

## Marco entregue

**Corretiva IDOR/multi-tenant — Ondas 1+2+3+3.5 + spec HS256 (BLOQUEIO DE PUSH resolvido)**

## Commits do dia (6)

| Hash | Mensagem | Escopo |
|---|---|---|
| `cfe4813` | `fix(seg): Onda 1 IDOR — 5 furos LGPD fechados (itens 1+3+5+7+9) + helper tenant-resolver fail-CLOSED` | LGPD |
| `7e6aace` | `fix(seg): Onda 2 IDOR — 5 furos estruturais fechados (itens 2, 4, 6, 8a/b/c, SUSPECT) + testes 5/5` | IDOR estrutural |
| `d3bfc63` | `fix(seg): Onda 3 IDOR hardening (itens 10-13) + regressao Uc drift NULL na Onda 2` | Hardening |
| `7ff4ee4` | `fix(seg): Onda 3.5 hardening pos-revisao — 2 P1 fail-CLOSED + 1 P2 usinas cross-tenant + 7 debitos catalogados` | Achados dos revisores |
| `a6d6a49` | `test(seg): spec HS256 automatizado + 2 debitos DHCP/UX (fecha Task 3 bloqueio de push)` | Spec + débitos DHCP |
| `f15439f` | `docs(seg): nota CI no spec HS256 — dep JWT_SECRET via backend/.env ou env var (feedback Luciano pos-review)` | Nota CI |

## Entregas técnicas por onda

### Helper novo `backend/src/auth/tenant-resolver.ts`

`resolveTenantIdFromReq(req, bodyCooperativaId?)` — decisão **por PERFIL, fail-CLOSED**. Substitui o padrão anterior `req.user?.cooperativaId ?? null` que confundia "ausente" com "SUPER_ADMIN bypass". SUPER_ADMIN → bypass legítimo (aceita body); qualquer outro sem cooperativaId → 403 imediato. 11 unit tests cobrindo todos os perfis. Aplicado em pix-excedente (Onda 1), faturas/documento (Onda 1), faturas/upload-concessionaria (Onda 2), usinas/findDisponiveis (Onda 2), ucs.create (Onda 2), contratos.create+update (Onda 2+3.5), documentos 4 handlers (Onda 3.5).

### Onda 1 — LGPD (5 itens, `cfe4813`)

- **Item 1** — `POST /financeiro/pix-excedente` — VAZAMENTO LGPD ATIVO. Controller aceitava `body.cooperativaId` (ADMIN de A escolhia tenant B). Service `pix-excedente.service.ts:53/63` fazia `findUnique` sem tenant → retornava `pixChave` de outro tenant. **Ordem crítica**: leitura pixChave ANTES do check da feature flag (linha 121), então vazava mesmo com PIX real desativado (só simulado). Fix: `resolveTenantIdFromReq` no controller + `findFirst` com filtro tenant no service, cooperado E condomínio. Preservou eixo `administradoraId` do Condominio.
- **Item 3** — `POST /faturas/documento` — sem `@Req()`, sem self-check FATURA-01. Espelhado do vizinho `upload-concessionaria` linhas 82-87 + `resolveTenantIdFromReq` + validação service-level.
- **Item 5** — `GET /usinas/:id/{distribuicao,lista-concessionaria,saude-financeira,ocupacao}` — VAZAMENTO nome+CPF (via `distribuicao`). `@TenantResource({model:'usina'})` nos 4 handlers.
- **Item 7** — `GET /documentos/cooperado/:cooperadoId` — VAZAMENTO RG/CNH. `@TenantResource({model:'cooperado', idParam:'cooperadoId'})`.
- **Item 9** — 3 handlers (`ocorrencias/cooperado/:id`, `clube-vantagens/cooperado/:id`, `motor-proposta/proposta/:id/html`) — `@TenantResource` em cada.

**MUTATION test explícito rodado**: revertí filtro tenant do pix-excedente → response veio com `pixChave: "cooperado-B-pix-SECRETO-nao-vazar"` + `TransferenciaPix cmruv152a000ava64nx326h4s` criado no banco cross-tenant → restaurei → verde.

### Onda 2 — IDOR estrutural (5 itens + SUSPECT, `7e6aace`)

- **Item 2** — `POST /motor-proposta/proposta/:id/enviar-pdf` — `@TenantResource({model:'propostaCooperado'})`.
- **Item 4** — `POST /faturas/upload-concessionaria` — controller `resolveTenantIdFromReq` + service novo param `cooperativaIdJwt` + gate `ForbiddenException` (defesa em profundidade). 3 callers atualizados: cooperados.controller + 2 em email-monitor.service (passam `cooperativaId` do scope).
- **Item 6** — `GET /usinas/disponiveis?ucId` — Query param, fora do @TenantResource. Fix service-level: valida UC via `cooperado.cooperativaId` (drift).
- **Item 8** — 3 endpoints em `/ucs/*`: 8a `@TenantResource({model:'uc', via:'cooperado.cooperativaId'})` (via cooperado por causa do drift, decisão Luciano); 8b `@TenantResource({model:'cooperado', idParam:'cooperadoId'})`; 8c service novo param + validação de cooperado no tenant + caller `cooperados.controller.ts:480` atualizado.
- **SUSPECT contratos** — service valida cooperado + UC no tenant ANTES da `$transaction`; UC via `cooperado.cooperativaId` (drift). Injeta `cooperativaId` EXPLÍCITO no `tx.contrato.create` com `tenantFinal = cooperativaId ?? _c ?? null` + throw 403 se ambos vazios (correção Luciano: chave explícita vence o spread). DTO ganha `cooperativaId?` opcional pra SUPER_ADMIN passar via body.

**MUTATION test explícito rodado**: revertí `ForbiddenException` do gate faturas → service prosseguiu até OCR (linha 1613) sem bloquear cross-tenant → restaurei → verde.

**Testes de drift Uc.cooperativaId=NULL** (2 tests adicionais na Onda 2, resposta ao pedido do Luciano após aprovar): instanciam `TenantOwnershipGuard` com `PrismaClient` real + `Reflector` real. Provam que `via:'cooperado.cooperativaId'` (1) pega ONDE a coluna Uc.cooperativaId=NULL (19 registros no banco), e (2) BLOQUEIA cross-tenant mesmo com coluna nula.

### Onda 3 — hardening (4 itens, `d3bfc63`)

- **Item 10** — `POST /publico/iniciar-cadastro` — `@Throttle({default:{limit:5,ttl:60000}})`. Dispara WA de saída (custo real + risco flood).
- **Item 11** — `POST /publico/processar-fatura-ocr` — throttle apertado 30/min → 5/min. OCR queima Claude API.
- **Item 12** — FileInterceptor com `{limits:{fileSize: 15 * 1024 * 1024}}` em 2 uploads públicos (cadastro/upload-doc, processar-fatura-ocr).
- **Item 13** — `jwt.strategy.ts` recebe `algorithms:['HS256']`. Antes: passport-jwt aceitava qualquer alg do header → vulnerável a algorithm confusion (`alg:'none'`, RS256 com HMAC key como PEM).

### Onda 3.5 — hardening pós-revisão (`7ff4ee4`)

Achados dos 2 revisores subagents (multitenant + financeiro-token) sobre os commits das Ondas 1+2+3. Aplicados dentro do escopo:

- **P1 documentos.controller.ts:35/40/49/54** — 4 handlers usavam `?? null` em vez do helper. Fix: `resolveTenantIdFromReq`.
- **P1 contratos.controller.ts:59 (update)** — mesmo padrão. Fix: mesmo helper.
- **P2 usinas.service.ts findDisponiveis** — a validação da UC no tenant não bastava; a query `prisma.usina.findMany({where})` NÃO filtrava por `cooperativaId` → ADMIN de A com UC válida em A recebia usinas de TODOS os tenants (nome, capacidade, proprietário). Fix: `if (cooperativaIdJwt) where.cooperativaId = cooperativaIdJwt`.
- **Fix lateral**: CPFs únicos por execução nos 2 specs (Jest roda paralelo, CPFs hardcoded colidiam).

### Task 3 — spec HS256 (`a6d6a49` + `f15439f`)

Bloqueava push por pedido explícito do Luciano após alarme falso do login humano (era DHCP, não a corretiva). 2 camadas:

- **(A) Integration HTTP** contra backend rodando: baseline sem token → 401; HS256 válido → não-401; **HS512 mesmo secret → 401** (pin rejeita); **alg=none → 401**.
- **(B) Unit jsonwebtoken** — prova por mutação sem tocar código live: COM pin, HS256 passa; COM pin, HS512 lança `JsonWebTokenError`; **🔴 SEM pin, HS512 PASSA** (comprova que o pin bloqueia; cenário pré-fix); COM pin, alg=none rejeitado.

8/8 PASS. Baseline anti-vazio: "token VÁLIDO → não-401" é a asserção real de que o algorithm pin está pegando (não só "sem token → 401", que não distingue "auth funcionando" de "todo mundo trancado fora").

## 3 correções de desenho que a revisão forçou ANTES de virar código

Documentadas separadas porque foram fase 1 read-only e mudaram o desenho antes de virar diff:

1. **Helper fail-CLOSED por PERFIL** — a versão original do desenho usava `req.user?.cooperativaId ?? null` (padrão já consolidado em ~38 handlers desde D-novo-BR F1.1 31/05). A auditoria do Luciano descobriu 1 COOPERADO no banco com `cooperativaId=null` no token. Com o padrão antigo, esse COOPERADO cairia no branch "SUPER_ADMIN bypass" e ganharia IDOR novo introduzido pelo próprio fix. Solução: helper decide por PERFIL (SUPER_ADMIN → bypass; outros sem cooperativaId → 403 imediato). Novo padrão a propagar em fixes futuros.

2. **Testes de drift `Uc.cooperativaId=NULL`** — o spec do `TenantOwnershipGuard` prova o MECANISMO; não prova o DADO. O motivo real de usar `via:'cooperado.cooperativaId'` no item 8a é o dado: 19 UCs com Uc.cooperativaId=NULL + 2 com drift (coluna aponta tenant divergente do dono real via cooperado). Se `via` estivesse mal montado, 19 UCs sumiriam e só descobriríamos por reclamação. Adicionados 2 testes que instanciam o guard real com PrismaClient e provam que `via` (1) pega onde a coluna falha e (2) bloqueia cross-tenant.

3. **Prova real do HS256** no lugar do smoke `/auth/me 401` — a versão inicial da Onda 3 usava só smoke `sem token → 401` + `Bearer inválido → 401` como prova. Isso NÃO distingue "auth funcionando" de "todo mundo trancado fora". A prova correta é **token VÁLIDO → não-401 + token com alg errada → 401 + prova por mutação SEM pin → HS512 passa**. Bloqueou o push até virar spec automatizado (Task 3).

## 2 alarmes falsos desmontados

1. **"Frontend errored" no PM2** (Onda 3.5, meio da sessão) — `pm2 list` mostrava frontend em status `errored`, mas o serviço estava servindo HTTP 200 normalmente na porta 3001. Diagnóstico: contabilidade do PM2 daemon ficou furada (rpc.sock EPERM depois da corretiva ACL de 20/07), reportando estado errado. Reparo: `pm2 kill` + `Stop-Process` explícito nos PIDs derivados de `Get-NetTCPConnection` + `pm2 start ecosystem`. Cascade descoberto: ao matar wa-service abruptamente, sessão Baileys se perdeu do lado Meta (auth_info intacto mas Meta invalidou) → `/status = awaiting_qr`. **Bot precisa re-parear pelo celular quando Luciano tiver janela.**

2. **Login falhando** (Task 3, teste do HS256 humano) — POST `/auth/login` dava `ERR_CONNECTION_TIMED_OUT`. Diagnóstico: DHCP mudou IP da máquina de 192.168.3.88 → 192.168.3.11, e `web/.env.local` tinha `NEXT_PUBLIC_API_URL=http://192.168.3.88:3000` bakeado no build. **Nem chegou no backend** → algorithms:['HS256'] não foi exercitado pelo login humano. Fix: atualizar `.env.local` + rebuild frontend + restart. Débito estrutural catalogado (`D-novo-API-URL-IP-CONGELADO`).

## Bugs resolvidos / débitos catalogados

### Resolvidos (14 furos + SUSPECT)

Todos os 13 furos + SUSPECT contratos + 3 do Onda 3.5 pós-revisão. Ver commits `cfe4813..7ff4ee4`.

### Novos catalogados nesta sessão

**Da revisão** (`docs/debitos-tecnicos.md`, 7 débitos):
- P1 `D-novo-PIX-EXCEDENTE-SUPERADMIN-ORFAO` — SUPER_ADMIN sem body.cooperativaId cria TransferenciaPix com cooperativaId=null.
- P1 `D-novo-PIX-EXCEDENTE-IDEMPOTENCIA` — sem guard, double-click dispara 2 PIX reais quando flag ativa. **Mesma família da Tarefa 4** (próxima sessão).
- P2 `D-novo-PIX-EXCEDENTE-SUBTOTAIS-IMPOSTO` — subtotais rearredondados diferem 1 centavo do total.
- P3 `D-novo-ASAAS-LOG-PIXCHAVE-VAZAMENTO` — log de erro Asaas pode incluir pixChave.
- P3 `D-novo-EMAILMONITOR-IDENTIFICARPOROCR` — método não auditado; verificar filtro por cooperativaId.
- P3 `D-novo-CLUBE-VANTAGENS-QCOOPID-PADRAO` — padrão pré-existente `|| qCoopId` não discrimina perfil.
- P3 `D-novo-TESTS-DRIFT-DOCUMENTOCOOPERADO` — replicar test de drift NULL pro DocumentoCooperado / CooperToken / Indicacao.

**Do alarme falso do login** (2 débitos):
- P2 `D-novo-API-URL-IP-CONGELADO` — NEXT_PUBLIC_API_URL bakeado no build quebra login toda vez que DHCP muda IP.
- P2 `D-novo-LOGIN-ERRO-ENGANOSO` (UX) — network error mostrado como "senha inválida".

**Catálogos originais Ondas 1-3** (3 débitos):
- P3 `D-novo-JWT-TTL-LONGO` — TTL 7d largo, sem refresh infra. `algorithms:['HS256']` já mata vetor crítico.
- P3 `D-novo-OCR-PUBLICO-TOKEN-SESSAO` — throttle 5/min é paliativo, precisa token de sessão.
- P3 `D-novo-UC-TENANT-DRIFT` — 19 UCs com Uc.cooperativaId NULL + 2 com drift. Sem fix técnico — decisão semântica de usar `via`.

**Ampliação do D-novo-WA-ZUMBI-PORTA-3002** (Sessão 20/07 anterior):
- Cobre agora **daemon PM2 inteiro** (rpc.sock EPERM), não só :3002. + cascade WA (sessão perdida quando wa-service morto abrupto).

**Deferido / pendente pra próxima sessão de segurança**:
- P3 `D-novo-BJ /uploads/` estático sem auth (main.ts:22) — ampliar escopo pra cobrir RG/CNH/faturas além dos comprovantes. Não implementado nesta sessão (marcado deferir no início).

## Regra nova (métodologia)

**Baseline de mudança em auth = "token VÁLIDO → 200"**, nunca "sem token → 401". Sem essa asserção positiva, um bug de "todo mundo trancado fora" (auth quebrada) passa despercebido — 401 na ausência de token continua sendo o comportamento esperado. Aplica-se a: JWT, guards, tenant checks, throttle (verificar que request legítimo passa e não é throttled indevidamente). Catalogar como diretriz na próxima sprint de docs.

## Próximo passo

**Tarefa 4 — Asaas emissão idempotência + retry unificado.**

Pré-check já feito nesta sessão: gateway em SANDBOX, 0 duplicatas hoje, última emissão real em 11/06 — é **bloqueador de virada pra produção real**, não emergência de dinheiro real hoje.

**Levar junto** `D-novo-PIX-EXCEDENTE-IDEMPOTENCIA` (P1 catalogado nesta sessão pelo revisor financeiro): sem guard no `pix-excedente.service.ts:176`, double-click dispara 2 PIX reais quando `ASAAS_PIX_EXCEDENTE_ATIVO` ligar. Mesma família de idempotência da Tarefa 4 — resolver os 2 numa sessão só faz sentido (padrão `WebhookEvent @@unique` já consolidado desde FASE 2 de 20/07).

## Pré-requisitos leitura próxima sessão

- `docs/CONTROLE-EXECUCAO.md` seção "ONDE PARAMOS — 2026-07-21 (IDOR)"
- `docs/sessoes/2026-07-21-corretiva-idor-multitenant.md` (este)
- `docs/debitos-tecnicos.md` seções da última atualização 2026-07-21 tarde
- `backend/src/cobrancas/cobrancas.service.ts` linhas 362-376, 887-890 (defeitos 1)
- `backend/src/asaas/asaas.service.ts` linha 260 (defeito 2)
- `backend/src/financeiro/pix-excedente.service.ts` linhas 176+ (D-novo-PIX-EXCEDENTE-IDEMPOTENCIA)

## Carry-overs (não-bloqueantes)

- **Sessão WA perdida no cascade do reparo PM2** — bot em `awaiting_qr` até re-pareamento manual pelo celular. Não bloqueia Tarefa 4 (não depende de WA).
- **`docs/diagramas/cadastro-usinas.html` M pré-existente** — última mudança semântica em 17/05/2026 (commit `7382063`); o `M` atual é 21+/21- (line-ending CRLF/LF flip). **NÃO commitado nesta sessão.**
- **Untracked**: `.agent/`, `.claude/agents/*`, `.e2e-tmp/`, `backend/scripts/__*`, `whatsapp-service/auth_info.acl.pre-corretiva.bak`.
- **Frontend rebuild** aplicado com IP `192.168.3.11` (DHCP atual). Se DHCP mudar de novo, `login` volta a quebrar — Task deferida `D-novo-API-URL-IP-CONGELADO`.

## jornada-membro.html — skip justificado

Ritual de fechamento (CLAUDE.md item 4) sugere regenerar `docs/diagramas/jornada-membro.html` quando a sessão modifica estado do projeto. Esta sessão **NÃO alterou nada da jornada do membro** — mudou apenas postura de segurança (guards, filtros, algorithm pin, throttle). Fluxos, telas, papéis, transições de status de cooperado seguem idênticos. Skip registrado por decisão do Luciano.

## Regras aplicadas na sessão

- **regra_fechamento_sessao_inegociavel** (13/05) — este doc + CONTROLE-EXECUCAO + commit/push.
- **regra_contato_teste_impreterivel** (14/05) — specs usam `27981341348` + `lucbragatto+idor*@gmail.com` (aliases whitelistados).
- **regra_secrets_nao_memorizar_26_05** — JWT_SECRET lido de `.env` em runtime, nunca ecoado. Assertivas do spec HS256 só usam status HTTP + tipo de erro, nunca imprimem o secret.
- **regra_validacao_previa_e_retomada** (Decisões 15/20/23) — Fase 1 read-only rigorosa com 3 correções bloqueantes aplicadas ANTES da Onda 1.
- **regra_nao_trabalhar_paralelo_com_code_17_05** — Luciano orquestrou passo a passo; Code aguardou aprovação em cada onda.
- **regra_coerencia_sistemica_mapa_impacto_10_06** — Fase 1 entregou mapeamento completo dos 13 furos + fix EXATO por endpoint antes de qualquer edit.
- **CLAUDE.md — PM2 stop antes de rebuild** — respeitado nos 3+ rebuilds do backend.
- **CLAUDE.md — regra SEM push sem OK** — respeitada; 5 commits ficaram locais até OK explícito do Luciano após Task 3 verde.
