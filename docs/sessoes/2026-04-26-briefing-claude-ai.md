# Briefing para nova sessão no Claude.ai — CoopereBR / Sprint 11 Dia 3

> **Como usar este documento:** cole o conteúdo abaixo (de "## CONTEXTO" até o
> fim) em uma conversa nova no Claude.ai. Se o assistant tiver acesso ao
> repositório, ele consegue retomar exatamente de onde paramos. Se não tiver,
> use isso como referência pra explicar o que precisa ser feito.

---

## CONTEXTO

**Projeto:** CoopereBR (SISGD) — plataforma SaaS multi-tenant pra cooperativas,
consórcios e associações de energia solar em Geração Distribuída (GD) no Brasil.

**Stack:**
- Backend NestJS (porta 3000, gerenciado por **PM2** como `cooperebr-backend`)
- Frontend Next.js 16 App Router (porta 3001)
- WhatsApp Service (porta 3002)
- PostgreSQL via Supabase + Prisma 6.19.2 (engine `query_engine_bg.wasm`)
- OCR Claude (Anthropic SDK) pra extrair dados de faturas EDP

**Plataforma local:** Windows 11 + Git Bash. Encadeia comandos com `;` em
PowerShell, não `&&`.

**Repositório local:** `C:/Users/Luciano/cooperebr`
**Branch:** `main`

---

## ONDE PARAMOS — Sprint 11 (Arquitetura de UC)

### O que é o Sprint 11

Sprint 11 está resolvendo o **gargalo crítico do ciclo de ativação** —
3 gaps P0 interconectados que bloqueiam os modelos de cobrança
COMPENSADOS e DINAMICO em produção:

1. **Numeração dupla de UC EDP** — concessionária EDP usa formatos diferentes
   no faturamento (10 dígitos canônico) e na compensação B2B (9 dígitos legado).
   Existe ainda um terceiro formato display oficial: `0.000.512.828.054-91`
   (15 díg + DV com pontuação).
2. **Classificação faturas COM/SEM créditos** — 3 cenários (cooperado ativo,
   recém-cadastrado aguardando homologação, lead potencial) precisam tratamento
   diferente.
3. **Email EDP obrigatório não monitorado** — pra cooperativa receber faturas,
   pessoa precisa cadastrar email da cooperativa no portal EDP. Sem isso,
   pipeline não tem dados pra processar.

### Schema atual (`backend/prisma/schema.prisma`)

Após Bloco 1 + Fase A do Bloco 2, model `Uc` tem **4 campos de identificação**:

| Campo | Tipo | Formato | Status |
|---|---|---|---|
| `numero` | `String @unique` | 10 díg canônico SISGD (ex: `0400702214`) | OBRIGATÓRIO |
| `numeroUC` | `String?` | 9 díg legado EDP (ex: `160085263`) | opcional no cadastro, OBRIGATÓRIO antes da ativação (a implementar Fase D) |
| `numeroConcessionariaOriginal` | `String? @db.VarChar(50)` | formato exato da fatura preservado (`0.000.512.828.054-91`) | opcional |
| `distribuidora` | `DistribuidoraEnum @default(OUTRAS)` | Enum: EDP_ES, EDP_SP, CEMIG, ENEL_SP, LIGHT_RJ, CELESC, OUTRAS | OBRIGATÓRIO |

**Campo deletado** no Bloco 1: `numeroInstalacaoEDP` (era 0/326 preenchido,
campo morto).

### Commits recentes (mais novo primeiro)

```
45d0aaf docs: fecha Sprint 11 Dia 2 - Fase A entregue + regra PM2 + plano Dia 3
92d610e feat(sprint11-bloco2-A): adiciona numeroConcessionariaOriginal como 4o campo de UC
9de64ab fix(sprint11): seed.ts usa enum DistribuidoraEnum (debito do bloco 1)
73b697e docs: fecha Sprint 11 Dia 1 - Bloco 1 Arquitetura UC + incidente perda de dados + regra auditoria previa
257e9a3 docs: fecha Dia 1 Sprint 11 (auditoria + Bloco 1 Arquitetura UC)
fbc75c1 feat(sprint11-arq-uc): form cadastro publico com 3 campos + OCR preenche distribuidora
39b96b8 feat(sprint11-arq-uc): forms admin UC com 3 campos + select distribuidora + tooltips
559a87d feat(sprint11-arq-uc): ucs.service com 3 campos + validacao de formato
f36496f feat(sprint11-arq-uc): schema - delete numeroInstalacaoEDP, distribuidora como enum
7583659 docs: auditoria numeracao dupla UC EDP (Sprint 11 T1)
```

### Estado dos arquivos chave

| Arquivo | Estado |
|---|---|
| `backend/prisma/schema.prisma` | ✅ 4 campos prontos (linha ~280) |
| `backend/src/ucs/ucs.service.ts` | ✅ Validação dos 4 campos + helpers `normalizarNumeroCanonico`, `normalizarNumeroUC`, `validarNumeroOriginal`, `validarDistribuidora`, `coerceDistribuidora` |
| `backend/src/ucs/ucs.controller.ts` | ✅ Body POST aceita os 4 campos |
| `backend/src/publico/publico.controller.ts` | ✅ `cadastroWebV2` aceita os 4 campos |
| `web/app/dashboard/ucs/nova/page.tsx` | ✅ Form completo com tooltips |
| `web/app/dashboard/ucs/[id]/page.tsx` | ✅ Display + edição |
| `web/app/cadastro/page.tsx` | ✅ Cadastro público com auto-pré-fill OCR |
| `backend/src/faturas/faturas.service.ts` | 🔄 Pendente Fase B |
| `backend/src/email-monitor/email-monitor.service.ts` | 🔄 Pendente Fase B (consumir função corrigida) |

---

## PRÓXIMA TAREFA — Fase B do Bloco 2

### Objetivo
Pipeline OCR + função de match de UC funcionando ponta-a-ponta com os 4 campos.

### Item 1 — Ajustar prompt OCR

**Arquivo:** `backend/src/faturas/faturas.service.ts:1201+`

O prompt atual pede `distribuidora` como texto livre genérico ("nome da
distribuidora"). Claude OCR retorna textos como `"EDP ES DISTRIB DE ENERGIA SA"`
que não batem com o enum.

**Trocar para:**
- `distribuidora`: pedir explicitamente um dos valores do enum
  (`EDP_ES`, `EDP_SP`, `CEMIG`, `ENEL_SP`, `LIGHT_RJ`, `CELESC`, `OUTRAS`)
  com instruções claras (ex: "se for EDP do Espírito Santo retorne `EDP_ES`")
- `numero`: 10 dígitos canônicos (com zero à esquerda)
- `numeroUC`: 9 dígitos legado, se aparecer
- `numeroConcessionariaOriginal`: formato exato como na fatura (com pontuação/hífen)

### Item 2 — Corrigir `resolverUcPorNumero`

**Arquivo:** `backend/src/faturas/faturas.service.ts:38-64`

**Comportamento atual:** só compara contra `u.numero`.

```typescript
// HOJE (linha 38-64):
export async function resolverUcPorNumero(
  prisma, tenantId, numeroOCR, logger,
): Promise<{ id: string; numero: string } | null> {
  const alvo = normalizarNumeroUc(numeroOCR);
  if (!alvo || !tenantId) return null;
  const ucs = await prisma.uc.findMany({
    where: { OR: [{ cooperativaId: tenantId }, { cooperado: { cooperativaId: tenantId } }] },
    select: { id: true, numero: true },  // ← só pega numero
  });
  const achou = ucs.find(u => normalizarNumeroUc(u.numero) === alvo);
  // ...
}
```

**Trocar para:** OR nos 3 campos + AND `distribuidora` quando disponível.

```typescript
// META:
// 1. Receber também `distribuidoraOCR?: DistribuidoraEnum`
// 2. SELECT { id, numero, numeroUC, numeroConcessionariaOriginal, distribuidora }
// 3. Comparar normalizado contra os 3 campos (numero, numeroUC, numeroConcessionariaOriginal)
// 4. Se distribuidoraOCR informada, filtrar uc.distribuidora === distribuidoraOCR
// 5. Prioridade: numero > numeroUC > numeroConcessionariaOriginal
// 6. Log explícito: "match por numero" / "match por numeroUC" / "match por numeroConcessionariaOriginal"
// 7. Retornar { id, numero, matchPor: 'numero'|'numeroUC'|'numeroConcessionariaOriginal' }
```

### Item 3 — Atualizar callers de `resolverUcPorNumero`

Usado em:
- `backend/src/faturas/faturas.service.ts:1428` (`resolverUcDaFatura`)
- `backend/src/faturas/faturas.service.ts:1515` (`criarFaturaProcessada`)
- `backend/src/email-monitor/email-monitor.service.ts:258` (`identificarPorOcr`)

Passar `distribuidoraOCR` quando disponível. Tratar novo retorno.

### Critério de aceite

- `npx tsc --noEmit` no backend: 0 erros novos (4 cosméticos antigos OK)
- Teste manual: rodar pipeline com fatura do Luciano (ago/2025, UID 2032 do
  email IMAP) e confirmar que vincula automaticamente à UC dele
  (`numero=0400702214`, `numeroUC=160085263`)

### Commit esperado

```
feat(sprint11-bloco2-B): pipeline OCR com 3 campos de busca + distribuidora enum

- Prompt OCR pede distribuidora como valor enum direto (EDP_ES, EDP_SP, etc)
- resolverUcPorNumero faz OR em numero/numeroUC/numeroConcessionariaOriginal
  + AND em distribuidora (quando disponivel)
- Prioridade de match: numero > numeroUC > numeroConcessionariaOriginal
- Log explicito de qual campo deu match (debug)
- Callers atualizados em faturas.service.ts e email-monitor.service.ts
```

**Estimativa:** 30-45 min, ~$5-8 em Sonnet.

---

## REGRAS OPERACIONAIS CRÍTICAS

### 1. Backend gerenciado por PM2

Comandos:
```powershell
pm2 list                          # ver status
pm2 stop cooperebr-backend         # parar
pm2 restart cooperebr-backend      # reiniciar
pm2 logs cooperebr-backend --lines 30
```

**NUNCA** rodar `npm run start:dev` direto — PM2 ressuscita processos.

### 2. Antes de `prisma generate` ou `db push`

**OBRIGATÓRIO:**
1. `pm2 stop cooperebr-backend`
2. Confirmar porta 3000 livre: `netstat -ano | findstr :3000` (sem `LISTENING`)
3. Rodar comando Prisma
4. `pm2 restart cooperebr-backend`

Sem parar PM2, dá EPERM no `query_engine_bg.wasm` (engine binário Windows-locked).
Prisma v6 usa `.wasm`, não `.dll`. O `query_engine-windows.dll.node` antigo no
disco é lixo, ignorar.

### 3. Auditoria prévia em mudanças de schema

Qualquer alteração que envolva: mudança de tipo, NULL→NOT NULL, deletar campo,
alterar default, renomear, alterar constraints — exige **auditoria prévia dos
dados afetados** antes de aplicar. Nunca usar `--accept-data-loss` sem audit.

Regra criada após incidente de 2026-04-25: 96 valores textuais de
`Uc.distribuidora` foram perdidos em migration `String → Enum` sem auditoria
prévia.

### 4. Whitelist de envios em dev

Backend tem whitelist em `backend/src/common/safety/whitelist-teste.ts` que
bloqueia envios WA/email pra qualquer destino que não seja Luciano em
ambiente dev. Crons de notificação também filtram `cooperado.ambienteTeste = false`.
Em produção (`NODE_ENV=production`) whitelist é bypassada.

### 5. Commits em português, pequenos, descritivos

Padrão: `feat(escopo): descricao` / `fix(escopo): descricao` / `docs: ...` / `chore(...): ...`.

### 6. Multi-tenant

Toda query Prisma deve filtrar por `cooperativaId` (vem do JWT, nunca do body).

---

## DOCUMENTOS PARA LEITURA OBRIGATÓRIA

Antes de qualquer ação, ler:

1. **`CLAUDE.md`** (raiz do repo) — instruções permanentes do projeto, regras
   PM2, regras de migrations, estado atual
2. **`docs/MAPA-INTEGRIDADE-SISTEMA.md`** — diagnóstico ponta-a-ponta dos 10
   fluxos do sistema. Seção crítica agora: "Sprint 11 Dia 1" e "Bloco 2
   (em andamento)"
3. **`docs/sessoes/`** — relatórios de sessões anteriores (relevantes recentes:
   `2026-04-26-auditoria-numeracao-dupla.md`, `2026-04-26-briefing-claude-ai.md`
   este arquivo)
4. **`backend/prisma/schema.prisma`** — schema atual (model `Uc` linha ~277,
   enum `DistribuidoraEnum` linha ~305)

---

## CONTAS DE SERVIÇO E CREDENCIAIS

- **Admin temporário** (criado 2026-04-25, deletar quando não precisar):
  - Email: `luciano-admin@cooperebr.com.br`
  - Senha: `Coopere2026!Admin`
  - Perfil: ADMIN da cooperativa CoopereBR
  - Vinculado via Supabase Auth (`supabaseId = b276aaad-183d-409a-9762-6eb4e046b644`)

- **Cooperativa principal:** CoopereBR (`id = cmn0ho8bx0000uox8wu96u6fd`)

---

## DÍVIDAS TÉCNICAS CONHECIDAS

1. **96 UCs com `distribuidora = OUTRAS`** — perdidas em migration de
   2026-04-25. Decisão Luciano: correção manual caso a caso quando admin
   precisar (não gerar script automático). Heurística rápida disponível se
   mudar de ideia: ES → EDP_ES recupera ~91.

2. **`scripts/teste-ocr-fatura-luciano.ts`** — 4 erros TS cosméticos
   (`mailparser` types). Não bloqueia, ignorar.

3. **Prompt OCR genérico** — pede `distribuidora` como texto livre, retorna
   strings tipo `"EDP ES DISTRIB DE ENERGIA SA"`. Será corrigido na Fase B.

4. **`numeroUC` opcional na ativação** — hoje cooperado pode ser ativado sem
   `numeroUC`. Será bloqueado na Fase D.

---

## COMO RETOMAR

**Frase de retomada sugerida no chat:**

> "Retomando Sprint 11 Dia 3 do projeto CoopereBR. Estou na Fase B do Bloco 2
> (Arquitetura de UC). Preciso ajustar o prompt OCR em
> `backend/src/faturas/faturas.service.ts` linha 1201+ pra pedir
> `distribuidora` como valor enum direto, e corrigir `resolverUcPorNumero`
> linha 38-64 pra fazer OR em `numero`/`numeroUC`/`numeroConcessionariaOriginal`
> + AND em `distribuidora`. Detalhes em
> `docs/sessoes/2026-04-26-briefing-claude-ai.md`."

**Sequência da sessão:**

1. Ler CLAUDE.md, MAPA-INTEGRIDADE-SISTEMA.md (seção Sprint 11), este briefing
2. `pm2 list` confirma backend rodando
3. Implementar Fase B (Items 1-3 acima)
4. Validar `tsc --noEmit`
5. Commit
6. Avançar pra Fase C (normalização dos 326 registros — exige aprovação
   explícita do Luciano antes de aplicar, regra CLAUDE.md)
7. Fase D (validação ativação + E2E fatura UID 2032)

---

## PERFIL DO USUÁRIO (LUCIANO)

- Juiz TJES, fundador da CoopereBR
- **NÃO programa** — explicar decisões em linguagem humana, sem jargão
  técnico desnecessário
- Decisões técnicas puras (estrutura, libs, organização): você decide e
  comunica o motivo
- Decisões de produto (regra de negócio, fluxo de usuário): pergunta
  antes de executar
- Direto e objetivo. Quer relatórios curtos com números concretos.
- Aprova diff antes de aplicar mudanças destrutivas (regra firme após
  incidente de perda de dados)
