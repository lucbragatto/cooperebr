# Sessão Code 18/05/2026 (tarde+noite) — Marco M12: Sub-Fase 1 Fase 4 + Fix Crítico Regra Contatos Teste

**Duração:** ~4-5h (continuação direta de M11 na mesma janela Code)
**Tipo:** Code (implementação + bug crítico investigação forense + fix 3 camadas + smoke re-executado)
**Marco entregue:** **M12 — Sub-Fase 1 Fase 4 (trigger ativação automática + WA/email cooperado homologado)**
**Bug crítico encontrado e resolvido:** D-novo-N P0 — falha sistêmica regra contatos teste

---

## TL;DR (legível pra leigo)

Implementei o gatilho automático que, quando admin confirma que a concessionária
homologou o cooperado, vira o contrato pra ATIVO + dispara confirmação por
WhatsApp e Email pro cooperado dizendo "sua adesão foi homologada, próxima
fatura virá com créditos". Durante o smoke validatório, descobri bug **grave de
segurança/LGPD**: o sistema ia disparar email/WhatsApp pro contato REAL do
banco em vez do override de teste (`27981341348` + `lucbragatto+homologado@gmail.com`).
Investigação revelou causa raiz estrutural: PM2 força `NODE_ENV=production`
em dev local, quebrando TODOS os checks de "estamos em dev?" do projeto inteiro.
Fix em **3 camadas defense in depth** (`AMBIENTE_REAL` flag + `cooperado.ambienteTeste`
+ pattern detection) — smoke re-executado e confirmado ✅ pelo Luciano. Bug
afetava sistema todo, não só Fase 4 — fix consertou TODO o projeto.

---

## Commits do M12 (3)

| # | Hash | Mensagem | Escopo |
|---|---|---|---|
| 1 | `4e87874` | `fix(common): AMBIENTE_REAL discriminador + pattern detection contatos fake` | 4 arquivos (ambiente.ts NOVO + whitelist-teste.ts + .env.example + ecosystem.config.cjs) |
| 2 | `e1bf552` | `feat(envio-lista): trigger ativacao Contrato + listener WA/email 3 camadas (M12)` | 7 arquivos (schema dataAtivacao + events.ts NOVO + service trigger + module + listener NOVO + email-templates + email.service) |
| 3 | `acc5168` | `docs(debitos+scripts): D-novo-N RESOLVIDO + scripts smoke Fase 4` | 7 arquivos (debitos-tecnicos + 6 scripts utilitários) |

Push: `e59a8f4..acc5168  main -> main` ✅

---

## Implementação M12 — Feature trigger ativação

### Schema delta (aditivo puro)
- `Contrato.dataAtivacao DateTime?` (linha 423 schema)
- Migration via `npx prisma db push` — sem `--accept-data-loss`, zero risco
- Validação SQL confirmou coluna presente (timestamp, nullable)

### Trigger no service (`registrarHomologacao`)
Após gravar `EnvioListaCooperado` com status HOMOLOGADO:
1. Busca contrato relacionado (`tx.contrato.findUnique`)
2. Se `contrato.status === 'PENDENTE_ATIVACAO'`: UPDATE → ATIVO + `dataAtivacao=now()`
3. Senão (já ATIVO): log warning, sem emit (evita duplicado em reenvios)
4. Após commit da tx (evita race condition): `eventEmitter.emit('envio-lista.cooperado-homologado', payload)`

### Listener `cooperado-homologado.listener.ts` (NOVO)
- `@OnEvent('envio-lista.cooperado-homologado')`
- Busca paralela cooperado + cooperativa + usina (com `cooperado.ambienteTeste`)
- 3 camadas defense in depth (ver seção bug crítico abaixo)
- Envia WhatsApp via `WhatsappSenderService` + Email via `EmailService` (best-effort, falha de um não bloqueia o outro)
- Log auditável EXPLÍCITO com `contatoOriginal vs contatoEnvio` + `motivo`

### Template email (9º template)
- `templateCooperadoHomologado` em `email-templates.ts` — cumprimento + confirmação visual + resumo (cooperativa/usina/data/protocolo) + próximos passos SCEE + link portal
- Método `enviarCooperadoHomologado(destinatario, dados, cooperativaId)` em `EmailService` — recebe `destinatario` separado do `cooperado.email` pra permitir override do listener

### Module wiring
- `EnvioListaConcessionariaModule` agora importa `EmailModule` + `WhatsappModule`
- Listener adicionado nos `providers`
- `EventEmitterModule` já estava global via `app.module.ts:63`

---

## Bug crítico D-novo-N (P0 RESOLVIDO)

### Linha do tempo

| Hora | Evento |
|---|---|
| 13:55:59 | Smoke fase 4 disparou homologação no envio LIST-cooperebr2-202605-003 |
| 13:55:59 | Trigger ativação contrato funcionou (status → ATIVO + dataAtivacao) ✅ |
| 13:55:59 | Listener logou: `"ambiente":"production","motivo":"PRODUCAO_REAL"` ❌ |
| 13:55:59 | Email DISPAROU pra `lucbragatto+fase4banco@gmail.com` (banco) ⚠️ |
| ~14:00 | Luciano detectou e disparou alarme "PARAR FASE 4 IMEDIATAMENTE" |
| 14:00-14:15 | Investigação forense (Decisão 23 — read-only) |
| 14:15 | Causa raiz identificada: H3 (NODE_ENV forçado pelo ecosystem) |
| 14:30 | Fix 3 camadas aprovado (Opção (a) defense in depth) |
| 14:30-15:30 | Implementação + validação automatizada + rebuild backend |
| 15:30 | Smoke re-executado com NOVO contrato reset — confirmado ✅ Luciano |

### Causa raiz

`ecosystem.config.cjs:36` define `env: { NODE_ENV: 'production' }` no PM2 backend
(intencional — Nest precisa rodar `dist/` compilado com otimizações Node).
Isso significa **NODE_ENV='production' SEMPRE**, em dev local E prod real.

TODO check `process.env.NODE_ENV !== 'production'` no projeto estava
estruturalmente quebrado:
- `whitelist-teste.ts:podeEnviarEmDev` retornava `true` sempre (bypassed)
- `whatsapp-sender.service.ts:80` guard nativo WA não funcionava em dev
- `email.service.ts:65` guard nativo Email não funcionava — **por isso email disparou**
- `cooperado-homologado.listener.ts:80` (meu) override sempre PRODUCAO_REAL

### Fix — Defense in depth 3 camadas

**Camada 1** — `backend/src/common/safety/ambiente.ts` NOVO:
- `isAmbienteReal()` lê `AMBIENTE_REAL === 'true'` (opt-in produção)
- Default ausente = dev (fail-safe)
- `.env.example` documenta + `ecosystem.config.cjs` propaga via `AMBIENTE_REAL: process.env.AMBIENTE_REAL || 'false'`
- **NUNCA usar `NODE_ENV` pra discriminar dev/prod**

**Camada 2** — `cooperado.ambienteTeste` respeitado:
- Schema JÁ tinha `ambienteTeste Boolean @default(false)` (linha 143)
- Listener: `deveOverride = !ambienteReal || cooperado.ambienteTeste`
- Cooperado teste SEMPRE override, mesmo em prod real (proteção de dados teste que vazem)

**Camada 3** — Pattern detection (`whitelist-teste.ts`):
- `ehEmailFake(email)`: `.invalid$|@removido|test@|fake@|noreply@|@example`
- `ehTelefoneFake(tel)`: `0{6,}`, `9{6,}`, `9{4,}\d{0,4}0{4,}$`, prefixos fake conhecidos (`551199988`, `551199900`, `551172620`, `551175410`, `551178110`), < 10 dígitos, `INATIVO-`
- Bloqueio FINAL pré-dispatch + reescrita `podeEnviarEmDev` (conserta WhatsappSenderService + EmailService automaticamente)

### Validação automatizada

Script `backend/scripts/validar-safety-helpers.js` (regression test):
- `isAmbienteReal()` → false (sem AMBIENTE_REAL no env)
- `ehEmailFake`: 7/7 OK (`.invalid`, `@removido`, `test@`, `fake@`, `noreply@` detectados; whitelist + emails reais passam)
- `ehTelefoneFake`: 9/9 OK (real cases — `+5511999990000` fake detectado, `27981341348` Luciano passa)
- `podeEnviarEmDev`: 4/4 OK (whitelist permite, fakes bloqueiam)

### Smoke re-executado (confirmado Luciano)

- ✅ WhatsApp recebido em **27981341348** (não `+5511999990000`)
- ✅ Email recebido em **lucbragatto+homologado@gmail.com** (não `+fase4banco`)
- ✅ Template renderiza corretamente (nome cooperado + cooperativa + usina + data)
- ✅ Log mostra `motivo: 'DEV_AMBIENTE'` ou `'COOPERADO_TESTE_FLAG'`
- ✅ `contatoOriginal ≠ contatoEnvio` no log

---

## Memórias novas/atualizadas

- **NOVO** `~/.claude/projects/.../memory/falha_regra_contatos_teste_18_05.md` — postmortem completo (linha do tempo, sintoma, causa raiz, fix 3 camadas, smoke pattern obrigatório, reforço regra inegociável)
- **EDIT** `~/.claude/projects/.../memory/regra_contato_teste_impreterivel.md` — adicionada seção "Falha sistêmica descoberta 18/05/2026 — NODE_ENV é INÚTIL como discriminador" + 3 camadas como obrigatórias em qualquer listener/service de comunicação
- **EDIT** `MEMORY.md` — linha adicionada referenciando postmortem

---

## Débitos catalogados / resolvidos

| Débito | Estado | Detalhe |
|---|---|---|
| **D-novo-N** (P0) | ✅ **RESOLVIDO** 18/05 | Falha sistêmica regra contatos teste — fix 3 camadas |

---

## Diretrizes novas (catalogadas em memória)

**NUNCA usar `NODE_ENV` pra discriminar dev/prod.** Sempre `isAmbienteReal()`.
Qualquer revisão de PR/código que envolva `NODE_ENV` deve ser flagada como suspeita.

**TODO listener/service de comunicação real DEVE ter as 3 camadas:**
1. Check `isAmbienteReal()` explícito
2. Respeito ao `cooperado.ambienteTeste`
3. Pattern detection final via `ehEmailFake`/`ehTelefoneFake`

**Smoke validation pattern obrigatório:** cooperado teste com email/telefone
OBVIAMENTE FAKE no banco + confirmar logs `contatoOriginal ≠ contatoEnvio`.

---

## Marcos pré-existentes vs nesta sessão

| Marco | Status | Origem |
|---|---|---|
| M11 — QA Completo + Bug Fix Sprint pós-QA | ✅ 18/05 manhã |
| **M12 — Sub-Fase 1 Fase 4 + fix D-novo-N** | ✅ **HOJE 18/05 tarde+noite** |
| M13 — Sub-Fase 1 Fase 5 (tests Jest + docs, fecha Sub-Fase 1) | 📋 sessão futura |

---

## Pendências abertas pra sessão futura

- **Sub-Fase 1 Fase 5 (M13):** tests Jest + docs Sub-Fase 1 completa (3-5h)
- **Sprint Housekeeping** (carry-over M11): reformat órfão stashed + LF/CRLF + 15 scripts untracked + 13 branches órfãs
- D-novo-J/K (specs Jest) — Bloco B Etapa 1 Fase 2 reabrirá
- D-novo-L/M — minor (docs + IMAP)
- D-novo-H — Sprint convenção MENSAL

---

## Validações executadas

- ✅ Schema delta `Contrato.dataAtivacao` aplicado via `npx prisma db push` (in sync)
- ✅ `npx tsc --noEmit -p tsconfig.build.json` — zero erros
- ✅ `npm run build` backend — silencioso clean
- ✅ PM2 restart limpo (`AMBIENTE_REAL: false` confirmado em `pm2 env 0`)
- ✅ 11 rotas `/envios-lista` mapeadas + listener `EnvioListaConcessionariaModule dependencies initialized`
- ✅ Trigger ativação smoke 1: contrato virou ATIVO + dataAtivacao em 2026-05-18T13:55:59
- ❌ Smoke 1: email disparou pro banco (BUG D-novo-N detectado)
- ✅ Fix 3 camadas + validação automatizada (script regression)
- ✅ Smoke 2 (pós-fix): Luciano confirmou WhatsApp + email nos overrides corretos
- ✅ `git push origin main` — `e59a8f4..acc5168` aceito

---

## Decisões catalogadas

- **Opção A1 (dataAtivacao no schema)** — campo novo aditivo em vez de reuse de `updatedAt` ou catalogar como débito separado. Semanticamente correto + auditoria completa.
- **Override `+homologado` em vez de `+fase4envio`** — alias mais semântico/sustentável pra futuros tipos de evento (não apenas Fase 4)
- **Opção (a) defense in depth 3 camadas** — em vez de fix mínimo só Camada 1. Justificada pela gravidade (P0) e abrangência da falha (4 lugares). Camada 3 defende contra config errada futura de `AMBIENTE_REAL`.
- **Contrato fase4 resetado pra novo smoke** — em vez de criar 2º cooperado teste. Idempotência mantida (`status: PENDENTE_ATIVACAO`, `dataAtivacao: null`).

---

## Próximo passo único e claro

**Sub-Fase 1 Fase 5 (M13)** — sessão futura:
1. Tests Jest do `envio-lista-concessionaria.service` (transições + trigger + multi-tenant)
2. Tests Jest do `cooperado-homologado.listener` (3 camadas com mocks AMBIENTE_REAL/cooperado.ambienteTeste/patterns fake)
3. Docs operacionais Sub-Fase 1 completa
4. Smoke E2E de regressão integrado
5. Fechamento canônico M13 + Sub-Fase 1 totalmente fechada

---

## Origem da sessão

Sessão Code 18/05 continuou em janela ÚNICA após fechamento M11 (decisão
Opção C — fechamento canônico do marco, não da janela). Contexto quente
mantido. Cache de prompt eficiente. Sub-Fase 1 Fase 4 iniciou após
confirmação Luciano de Opção β (cooperado teste novo em Cooperebr2 via
script idempotente) + acréscimo crítico do fix D-novo-N descoberto no smoke.
