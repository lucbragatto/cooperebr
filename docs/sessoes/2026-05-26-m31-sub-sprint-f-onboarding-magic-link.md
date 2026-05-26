# M31 — Sub-Sprint F Sessão 2 (F.3 Onboarding magic link + cadastro manual)

> Sessão: 26/05/2026 (continuação imediata pós-M30).
> Marco: **M31 — F.3 Onboarding completo (magic link + cadastro manual coexistem)**.
> F.4 pendente: depende Luciano preencher cooperebr1.

## TL;DR

Sessão 2 do Sub-Sprint F entregue em **5 commits incrementais** (Etapas A→F) cobrindo onboarding completo dos 2 caminhos decididos em 27/05:

- **Cadastro manual** (usado AGORA pra cooperebr1): admin cria Usuario direto com senha temporária + copia credenciais pra clipboard pra mandar por chat/WhatsApp
- **Magic link por email** (futuros proprietários): admin envia link único TTL 7d, proprietário clica + define própria senha

Os 2 caminhos coexistem na MESMA tela admin de Usina (Card "Acesso do Proprietário" com 2 botões + Dialogs Shadcn).

Suite completa **917/928** (mesmos 11 pré-existentes; **+31 specs novos** vs M30: ConviteProprietarioService).

## Commits do dia (6)

| Hash | Mensagem |
|---|---|
| `34719bd` | feat(proprietario): F.3 Etapa A — ConviteProprietarioService + 31 specs |
| `6a845f1` | feat(proprietario): F.3 Etapas B+C+D — endpoints convite admin + público + email template |
| `2eb822b` | feat(web-admin): F.3 Etapa E — bloco onboarding proprietário na tela admin |
| `3ba6655` | feat(web-publico): F.3 Etapa F — página pública /proprietario/aceitar-convite/[token] |
| (este) | docs(sessao): fechamento M31 Sub-Sprint F Sessão 2 |

## Entregas por etapa

### Etapa A — ConviteProprietarioService (`34719bd`)

**7 métodos públicos:**

| Método | Função |
|---|---|
| `criarConvite({usinaId, email, criadoPorUserId, cooperativaId})` | Cria token (crypto.randomBytes 64 hex) + TTL 7d. Idempotente (reusa pendente se já existe pra mesma usina+email). |
| `validarToken(token)` | Retorna `{ valido, motivo?, dados? }` pra GET público pre-popular |
| `aceitarConvite(token, senhaNova)` | Cria Usuario PROPRIETARIO via **Supabase admin createUser** (mesmo padrão `auth.service.register`). Marca convite usedAt. |
| `listarPorUsina(usinaId, cooperativaId)` | Status derivado em runtime (PENDENTE/USADO/EXPIRADO). Token NUNCA retornado integral — só `tokenSufixo: '...XXXXXX'` |
| `reenviar(conviteId, cooperativaId)` | Regen token + estende expiresAt |
| `cancelar(conviteId, cooperativaId)` | DELETE real (sai da lista) |
| `cadastroManual({nome, email, senhaTemp, usinaId})` | Cria Usuario PROPRIETARIO via Supabase, retorna `senhaTemp` UMA VEZ pra admin copiar (política `regra-secrets-nao-memorizar.md` exceção controlada) |

Multi-tenant em **TODOS** os métodos (`cooperativaId` obrigatório; usina verificada por `cooperativaId`; convite verificado por `usina.cooperativaId`).

Senha forte exigida: mínimo 8 chars + 1 letra + 1 número.

**31/31 specs verdes** cobrindo: validações de input, multi-tenant violations, status derivado, idempotência, casos de erro (token invalido/expirado/usado, email duplicado, etc).

Mock Supabase no spec evita chamada real ao `auth.admin.createUser`.

### Etapas B+C+D — Endpoints admin + público + email (`6a845f1`)

**Etapa B — 5 endpoints admin** em `ProprietarioController` (`@Roles(SUPER_ADMIN, ADMIN)`):

```
POST   /proprietario/convite              — envia magic link por email
GET    /proprietario/convites/:usinaId    — lista status PENDENTE|USADO|EXPIRADO
POST   /proprietario/convite/:id/reenviar — regen token + reenvia email
DELETE /proprietario/convite/:id          — cancela (DELETE real)
POST   /proprietario/cadastro-manual      — cria Usuario direto, retorna senhaTemp
```

**Etapa C — 2 endpoints PÚBLICOS** (`@Public()`):

```
GET    /proprietario/aceitar-convite/:token  — valida token + retorna dados
POST   /proprietario/aceitar-convite/:token  — body { senhaNova } cria Usuario
```

**Etapa D — ConviteEmailService:**

- Template HTML inline (sem Handlebars) com amber theme
- Branding SISGD + lista features do portal (geração, repasse, despesas, contratos LGPD, PDF mensal)
- Botão "Aceitar convite e definir senha" linkado pra `FRONTEND_URL/proprietario/aceitar-convite/[token]`
- TTL 7 dias visível + link fallback texto puro pra copy-paste
- Footer "Se não esperava este convite, ignore"
- `escapeHtml` defesa XSS básica
- **Reusa `EmailService.enviarEmail`** (tenant-aware via `cooperativaId` + `podeEnviarEmDev` whitelist LGPD já respeita contatos teste em sandbox)

Wire no `ProprietarioModule`: `imports: [EmailModule]` (resolve DI `EmailService` → `EmailConfigService`).

### Etapa E — Frontend admin (`2eb822b`)

Componente `AcessoProprietarioBloco` adicionado no final da tela existente `/dashboard/usinas/[id]/proprietario`:

- Help inline azul explicando os 2 caminhos
- 2 botões Shadcn:
  - "Cadastrar manualmente" (outline amber) → `CadastroManualDialog`
  - "Convidar por email (magic link)" (filled amber) → `ConvidarEmailDialog`
- Lista de convites enviados com status badge + botões reenviar/cancelar condicionais

**CadastroManualDialog:**
- Form: nome + email (pré-populado de `Usina.proprietarioEmail`) + senha temp auto-gerada (12 chars + `A1` garantindo letra+número)
- Botão refresh regen senha
- POST `/proprietario/cadastro-manual`
- Pós-sucesso: card verde com credenciais visíveis + botão "Copiar credenciais" (clipboard com email + senha + URL login formatado)
- Política `regra-secrets`: senha aparece UMA VEZ na UI, admin copia e manda fora do sistema

**ConvidarEmailDialog:**
- Form: email pré-populado
- POST `/proprietario/convite`
- Pós-sucesso: link mostrado + botão copiar + TTL 7d visível
- Indica se foi convite reusado (idempotência) ou novo

### Etapa F — Frontend público (`3ba6655`)

NOVA rota `/proprietario/aceitar-convite/[token]/page.tsx` com **4 estados visuais**:

1. **Loading**: spinner amber
2. **Token inválido/expirado/usado**: Card vermelho + motivo + instrução pedir novo convite
3. **Form definir senha**: Card amber-gradient com:
   - Dados do convite (usina + email + expiresAt)
   - Campo senha + toggle mostrar/ocultar (Eye/EyeOff)
   - Indicador força de senha (3 barras coloridas fraca/média/forte)
   - Campo confirmar senha + validação client
   - Validações: ≥8 chars, 1 letra + 1 número, confirmar = senha
4. **Sucesso**: Card verde + botão "Fazer login agora"

`/proprietario/layout.tsx` modificado pra detectar `pathname.startsWith('/proprietario/aceitar-convite/')` e renderizar `children` direto (sem sidebar, sem `useContexto` autenticado).

Background `gradient-to-br from-amber-50 to-yellow-100` consistente com tema proprietário.

## Validação

- `nest build` ✅ + `tsc --noEmit` ✅
- **Suite completa: 917/928 passing** (+31 specs novos vs M30)
- Mesmos 11 pré-existentes em cooperados/usinas (fora do escopo)
- PM2 backend online pid 30144

## Constraints respeitadas

- ✅ TDD: 31 specs primeiro no `ConviteProprietarioService`
- ✅ Multi-tenant: `cooperativaId` em **TODAS** queries Prisma
- ✅ Token: `crypto.randomBytes(32).toString('hex')` (64 chars) com TTL 7d, single-use (`usedAt`)
- ✅ Endpoint público de aceitar-convite com `@Public()` (sem JWT mas exige token válido)
- ✅ Senha forte mínimo 8 chars + 1 letra + 1 número
- ✅ Política `regra-secrets-nao-memorizar.md` exceção controlada (senhaTemp UMA VEZ na UI)
- ✅ `EmailService.podeEnviarEmDev` whitelist LGPD respeita contatos teste em sandbox
- ✅ Sem `force push`, commits incrementais em português

## Próximo passo — F.4 Smoke Produção (~1-2h)

**BLOQUEADO POR LUCIANO OPERACIONAL** — pré-requisito:

1. **Preencher cooperebr1 via UI admin** `/dashboard/usinas/usina-linhares/proprietario`:
   - `proprietarioEmail` (E-Solares — GATILHO PRINCIPAL pra magic link / cadastro manual)
   - `formaPagamentoDono` (FIXO / PERCENTUAL / HIBRIDO)
   - `valorAluguelFixo` E/OU `percentualGeracaoDono` (conforme forma escolhida)
   - `statusOperacional`
   - `responsabilidadeDespesas` (matriz 15 categorias)
   - `valorKwhPadrao` OU cadastrar `TarifaConcessionaria` pra EDP_ES

2. **Cadastrar Usuario E-Solares** via:
   - (a) Cadastro manual na UI (mais rápido pra primeiro acesso) OU
   - (b) Magic link por email (testa o fluxo completo)

3. **Logar como E-Solares**, navegar pelo Portal Proprietário, drill-down em cooperebr1, baixar PDF, validar visualmente.

4. **Conectar cron PDF a EmailService** (D-novo-AO pendente — Luciano confirmar política anti-spam).

**Quando preencher cooperebr1 + cadastrar Usuario:** Code arranca F.4 em sessão curta. Não há trabalho técnico bloqueador.

## Frentes operacionais Luciano (acumulado)

- ⏳ Preencher cooperebr1 (proprietarioEmail é o GATILHO pra F.4)
- ⏳ Cadastrar Usuario E-Solares (manual OU magic link)
- ⏳ Definir matriz responsabilidadeDespesas
- ⏳ Definir valorKwhPadrao OU TarifaConcessionaria EDP_ES
- ⏳ Obter credenciais Sungrow/iSolar Cloud com E-Solares
- ⏳ Decidir política anti-spam pro cron PDF (D-novo-AO)
- ⏳ D-novo-AK gerenciador de senhas
- ⏳ Avisar time legado / script.sql / .pfx sandbox Banestes

## Carry-overs (não-bloqueantes)

- F.4 smoke produção (~1-2h) — sessão curta quando Luciano preencher cooperebr1
- D-novo-AL: integração iSolar Cloud E2E (SungrowService pronto)
- D-novo-AM: Empresa entidade separada (YAGNI até 2ª usina)
- D-novo-AN: RepasseProprietario tabela pra pagamento REAL
- D-novo-AO: cron PDF conectar EmailService

## Regras aplicadas

- TDD: 31 specs primeiro
- Multi-tenant: 100% queries com cooperativaId
- Política `regra-secrets-nao-memorizar.md`: senhaTemp aparece UMA VEZ
- Conventional commits em português, incrementais
- Sem `force push`, sem `--no-verify`

## Frase comandante

Próxima sessão Code abre verificando se Luciano preencheu cooperebr1 (gatilho `proprietarioEmail`). Se SIM, arranca F.4 (sessão curta ~1-2h — simular login E-Solares + navegar + baixar PDF + decidir política email cron). Se NÃO, oferece frentes paralelas (Sub-Sprint B aguarda script.sql, frente Sungrow E2E real depende credenciais E-Solares, D-novo-AK gerenciador senhas) ou pausa.
