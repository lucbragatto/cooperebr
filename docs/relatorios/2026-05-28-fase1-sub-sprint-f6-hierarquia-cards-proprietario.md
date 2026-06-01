# Fase 1 read-only mini — Sub-Sprint F.6 Reformulação Hierárquica Portal Proprietário

> Sessão Code 28/05/2026. Decisão 23 ativa — zero código tocado.

## TL;DR

F.5 (M33) entregou hierarquia de 2 níveis (grid cooperativas → tabela usinas) + impersonate. Luciano testou e decidiu: manter N1 intacto, **substituir N2 inteiro** (tabela → cards de proprietários), **adicionar N3 novo** (cards de usinas por proprietário com Tabs Usinas/Carregadores) e **remover impersonate completamente** (resolve naturalmente o BUG #5 Admin Parceiro click → erro). Endpoint atual `GET /admin/proprietarios/cooperativas/:id/usinas` é único cliente hoje (refator sem breaking externo). Backend pequeno (2-3h), frontend maior (4-6h) — **total 6-9h confirmado, fatiar F.6a + F.6b OK**. ⚠️ Shadcn **não tem Tabs nem Breadcrumb** instalados — adicionar custo: ~30min instalar Tabs via shadcn-ui CLI ou implementar manual com Radix.

---

## 1. Endpoints backend atuais (mapeamento)

### GET `/admin/proprietarios/cooperativas` (N1) — **MANTER INTACTO**

`admin-proprietarios.service.ts:71-237` `listarCooperativasComProprietarios()`. Sem alterações.

### GET `/admin/proprietarios/cooperativas/:id/usinas` (atual N2) — **REFATORAR**

`admin-proprietarios.service.ts:241-385` retorna `{cooperativa, usinas[]}` por usina. Response atual:

```ts
{
  cooperativa: { id, nome, tipoParceiro },
  usinas: [{
    usinaId, nome, apelidoInterno,
    statusOperacional, statusHomologacao,
    potenciaKwp, capacidadeKwh,
    proprietarioNome, proprietarioEmail (mascarado),
    proprietarioEmailRaw,           // ← REMOVER (era pra impersonate)
    temProprietario,
    contratoArrendamento,
    ytdRepasse, conviteStatus,
  }]
}
```

**Decisão:** ao invés de criar endpoint novo, **mudar shape do endpoint atual** pra retornar `{cooperativa, proprietarios[]}`. Único consumidor hoje é o frontend que vai ser refatorado — sem breaking externo.

---

## 2. Agregação por proprietário único (proposta)

### Chave de dedupe (3 caminhos)

```ts
function chaveProprietario(u: Usina): string {
  if (u.proprietarioCooperadoId) return `c-${u.proprietarioCooperadoId}`;
  if (u.proprietarioEmail) return `e-${u.proprietarioEmail.toLowerCase()}`;
  return 'SEM_PROPRIETARIO';
}
```

- **Caminho A (cooperado-proprietário):** chave `c-<cooperadoId>` — cuid URL-safe direto
- **Caminho B (proprietário externo):** chave `e-<email.toLowerCase()>` — case-insensitive
- **Órfã:** chave literal `SEM_PROPRIETARIO`

Case-insensitive em email é obrigatório (mesmo email com casing diferente deve agrupar — comum em uploads CSV/cadastros manuais inconsistentes).

### Resolução do `nome` exibido

Quando Caminho A, fazer JOIN com `Cooperado.nomeCompleto`. Quando Caminho B, usar `proprietarioNome` (string puro). Quando órfã, exibir "Sem proprietário cadastrado" + contagem de usinas.

**Edge case:** mesmo `proprietarioEmail` pode ter `proprietarioNome` diferente em usinas distintas (cadastro inconsistente). Política: **pegar o nome da usina mais recente** (`createdAt desc`). Catalogar essa inconsistência como warning futuro (D-novo-BE: validação cadastro proprietário).

### Estrutura da response refatorada

```ts
{
  cooperativa: { id, nome, tipoParceiro },
  proprietarios: [
    {
      propId: 'c-cmnxxx' | 'e-demo-esolares@example.com' | 'SEM_PROPRIETARIO',
      caminho: 'COOPERADO' | 'EMAIL' | 'SEM_PROPRIETARIO',
      nome: 'E-Solares Demo' | 'Sem proprietário cadastrado',
      tipo: 'PF' | 'PJ' | null,
      emailMascarado: 'de***@example.com' | null,
      numeroUsinas: 3,
      capacidadeTotalKwp: 1250.50,
      totalYtdAgregado: 4000.00,
      statusAgregado: { ok: 3, atencao: 0, critico: 0 },
    },
    // ...
  ]
}
```

Ordenação: alfabética por `nome`, com "SEM_PROPRIETARIO" sempre último (badge cinza visualmente diferenciado).

---

## 3. Novo endpoint N3 (proposta)

### GET `/admin/proprietarios/cooperativas/:coopId/proprietarios/:propId/usinas`

**`:propId`** aceita 3 formas:
- `c-<cooperadoId>` (Caminho A)
- `e-<email>` (Caminho B — email URL-encoded ou plain, parsing flexível)
- `SEM_PROPRIETARIO` literal

**⚠️ Decisão pendente:** email tem `@` e potencialmente `.` que precisam URL-encode em path. Opções:
- (a) URL-encode: `/proprietarios/e-demo-esolares%40example.com/usinas` — feio mas funciona
- (b) Base64URL do email: `/proprietarios/e-ZGVtby1lc29sYXJlc0BleGFtcGxlLmNvbQ/usinas` — backend decode
- (c) Hash determinístico curto (SHA1 16 chars) — backend lookup reverso via banco
- **(d) RECOMENDAÇÃO:** URL-encode (opção a). Next.js `useParams` decoda automaticamente, axios encoda automaticamente — transparente pro código frontend. Backend recebe email plain via `@Param`.

**Response:**

```ts
{
  cooperativa: { id, nome, tipoParceiro },
  proprietario: {
    propId, caminho, nome, tipo, emailMascarado,
    numeroUsinas, capacidadeTotalKwp, totalYtdAgregado,
  },
  usinas: [{
    usinaId, nome, apelidoInterno,
    statusOperacional, statusHomologacao,
    potenciaKwp, capacidadeKwh,
    contratoArrendamento, ytdRepasse,
    conviteStatus,   // se aplicável (Caminho B com convite)
  }]
}
```

**Multi-tenant guards (mesmo padrão M33 Etapa B):**
- SUPER_ADMIN: qualquer cooperativaId
- ADMIN: só `cooperativaId === user.cooperativaId` (senão 403)
- Outros: 403 (RolesGuard)

**Audit log:** NÃO. Acesso N3 é só visualização agregada por contexto admin — não há impersonação. Logging genérico via interceptor futuro (D-30N).

---

## 4. Inventário impersonate pra REMOVER

### Backend (3 arquivos)

| Arquivo | Linhas | Item |
|---|---|---|
| `backend/src/proprietario/proprietario.service.ts` | 30-66 | doc + `opts.impersonateUsinaId` bypass + audit log `[IMPERSONATE_PROPRIETARIO]` |
| `backend/src/proprietario/proprietario.service.ts` | 245-252 | `detalheUsina` aceita `opts.impersonate` |
| `backend/src/proprietario/proprietario.controller.ts` | 41-53 | `@Query('impersonate')` + flag isImpersonate |
| `backend/src/admin/proprietarios/admin-proprietarios.service.ts` | 359 | campo `proprietarioEmailRaw` no response (não mais necessário) |

### Specs backend (4 testes a remover)

`backend/src/proprietario/proprietario.service.spec.ts:124-184` — describe inteiro `'impersonate SUPER_ADMIN (F.5a)'`:
- bypassa quando SA + opts.impersonate=true
- não bypassa quando opts.impersonate=true mas perfil != SA
- não bypassa quando SA sem opts.impersonate
- NotFoundException quando impersonateUsinaId inexistente

### Frontend (2 arquivos)

| Arquivo | Linhas | Item |
|---|---|---|
| `web/app/proprietario/usinas/[id]/page.tsx` | 19 (import Shield) | remover `Shield` do lucide-react import |
| `web/app/proprietario/usinas/[id]/page.tsx` | 22-23 (import useSearchParams, useRouter) | remover se só usado pelo impersonate |
| `web/app/proprietario/usinas/[id]/page.tsx` | 88-104 | `useSearchParams`, `isImpersonate`, `cooperativaIdParam`, fetch URL condicional |
| `web/app/proprietario/usinas/[id]/page.tsx` | 141-163 | banner azul Shield + botão "Voltar pra tabela" |
| `web/app/dashboard/proprietario/[cooperativaId]/page.tsx` | TODO REFATORADO ANYWAY | tudo: linha 9 doc, linha 52 `proprietarioEmailRaw`, linha 162 texto help, linhas 264/320/325 URLs com `?impersonate=true&cooperativaId=` + botão "Impersonar" |

### Total impacto

- Backend: ~50 linhas remover + 4 specs deletados
- Frontend: ~30 linhas remover em `[id]/page.tsx` + arquivo `[cooperativaId]/page.tsx` reescrito do zero (já ia ser refatorado em N2)

**Bug #5 (Admin click → erro):** desaparece naturalmente porque o banner+botão "Voltar pra tabela" some, e o frontend não tenta mais chamar endpoint admin a partir do portal proprietário.

---

## 5. Componentes Shadcn

### Instalados (`web/components/ui/`)

`alert-dialog`, `badge`, `button`, `card`, `checkbox`, `dialog`, `input`, `label`, `progress`, `select`, `sheet`, `skeleton`, `switch`, `table`, `textarea`

### ⚠️ FALTAM

- **`tabs`** — usado pro N3 Usinas/Carregadores. Instalar via:
  ```bash
  cd web && npx shadcn@latest add tabs
  ```
  OU implementar manual com `@radix-ui/react-tabs` (mais provável de já estar instalado como peer dep).
- **`breadcrumb`** — opcional. Hoje uso `<Link>← Voltar` simples (padrão M33). Pode manter assim ou instalar:
  ```bash
  cd web && npx shadcn@latest add breadcrumb
  ```

**Recomendação:** instalar `tabs` (necessário); usar `<Link>← Voltar` simples como hoje (não precisa breadcrumb formal — hierarquia é shallow 3 níveis).

### Verificar antes de instalar

Possível que o projeto use Base UI (`@base-ui/react`) ao invés de Radix puro — vide M32 fix DialogTrigger asChild. Conferir `dialog.tsx` (já vi: usa `@base-ui/react/dialog`). Se padrão é Base UI, tem que verificar se tem `Tabs` em `@base-ui/react/tabs` antes de adotar Radix Tabs do Shadcn. Alternativa: implementar custom simples (Tabs é componente fácil — botões com state + conditional rendering).

---

## 6. Help inline + Loading/Empty states (proposta)

### N2 (proprietários cards)

**Help:** "Cada card é um proprietário com 1+ usinas nesta cooperativa. Clique pra ver as usinas dele." (azul Info banner padrão)

**Empty:**
- Cooperativa **sem nenhuma usina**: "Esta cooperativa ainda não tem usinas cadastradas." (Card central com ícone)
- Cooperativa **com usinas mas todas órfãs**: mostrar só o card "SEM_PROPRIETARIO (N usinas)" + alerta sutil "💡 Cadastre proprietários nas telas de usina pra agrupar aqui."

**Loading:** 3-4 Skeleton cards (mesmo padrão N1 atual).

### N3 (usinas do proprietário) — com Tabs

**Help:** "Usinas que [Nome Proprietário] administra nesta cooperativa." Em Carregadores: "(Em breve) Carregadores e infraestrutura desse proprietário."

**Tabs:**
- `Usinas` (ativa por padrão) — grid de cards usina
- `Carregadores` (placeholder) — badge "Em breve" + texto "Funcionalidade prevista pra Sub-Sprint EV Carregadores (futuro)."

**Empty (improvável mas tratar):** "Este proprietário não tem usinas registradas." (link voltar pra N2)

**Loading:** Skeleton + Tabs já renderizadas (UX consistente).

---

## Estimativa revisada

| Fatia | Item | Horas |
|---|---|---|
| **F.6a Backend** | Refactor `listarUsinasPorCooperativa` → agregação por proprietário | 1-1.5h |
|  | Novo endpoint N3 `/proprietarios/:propId/usinas` + helper de parsing propId | 45min-1h |
|  | Remover impersonate (3 arquivos + 4 specs) | 30min |
|  | Specs novos pra agregação + N3 (~10-12 testes) | 45min-1h |
| **F.6b Frontend** | Instalar Tabs Shadcn (ou implementar custom) | 15-30min |
|  | Refactor N2 (`[cooperativaId]/page.tsx`) tabela → cards proprietários | 1.5-2h |
|  | Nova rota N3 (`[cooperativaId]/proprietarios/[propId]/page.tsx`) com Tabs | 2-2.5h |
|  | Remover impersonate frontend (2 arquivos) | 20-30min |
|  | Build (`npm run build` — D-novo-AS) + smoke visual | 30min |
| **Total** | | **7.5-10h** |

**Atualização vs prelim:** ligeiramente acima (7.5-10h vs 6-9h preliminar) por causa do componente Tabs faltante + nova rota N3 mais elaborada (Tabs + cards + help condicional por proprietário com/sem usinas).

**Sugestão fatiamento confirmada:** F.6a + F.6b separados. F.6a validável via curl independente.

---

## Decisões adicionais que valeria bater

1. **`propId` no path com email URL-encoded** (`%40` etc) é OK? Alternativa Base64URL é mais bonito mas opaco. **Default proposto: URL-encode (opção a)** — Next.js `useParams` + axios fazem transparent encode/decode.

2. **Nome divergente em mesmo email** (mesma chave Caminho B, diferentes `proprietarioNome` em usinas distintas): pegar o nome da usina mais recente (`createdAt desc`). Catalogar D-novo-BE futuro (validação cadastro proprietário) — sem urgência.

3. **Card "SEM_PROPRIETARIO"**: rota N3 navega? Sim, mostrar lista de usinas órfãs com botão "Cadastrar proprietário" link pra `/dashboard/usinas/[id]/proprietario`. ✅ pra orquestrador confirmar.

4. **Carregadores tab visível pra TODOS perfis** (SUPER_ADMIN + ADMIN + futuramente PROPRIETARIO no portal próprio)? Decisão de UX. Default proposto: **sim**, com badge "Em breve" — sinaliza roadmap visualmente.

5. **`/proprietario/usinas/[id]` page (N4)** — fica MESMO portal do proprietário real (M30). Sem mudanças. Confirma?

6. **Remoção do `proprietarioEmailRaw` no response atual N2**: alguém consome? Verifiquei: zero referências em `web/`. Limpar livre.

7. **Default sort proprietários card**: alfabético por nome, "SEM_PROPRIETARIO" sempre último. Confirma?

8. **Status agregado por proprietário** — semáforo OK/atenção/crítico igual N1, mas escopado às usinas DESSE proprietário. Útil visualmente — confirma manter?

---

## Riscos / Breaking changes

- **Endpoint `GET /admin/proprietarios/cooperativas/:id/usinas` muda response.** Único consumidor hoje é `web/app/dashboard/proprietario/[cooperativaId]/page.tsx` que vai ser refatorado na mesma fatia (F.6b) → **sem risco externo**.
- **Specs M33** (17 do AdminProprietariosService): vão precisar de ajuste — 6-8 deles testam estrutura `usinas[]` que vira `proprietarios[]`. Reescrever.
- **Audit log impersonate (`[IMPERSONATE_PROPRIETARIO]`)**: dados de produção limpos (PM2 logs rotativos). Sem retenção a preservar.
- **Routes `/dashboard/proprietario/[cooperativaId]/[usinaId]?impersonate=true`** — não existem como rotas Next.js (eram só URLs construídas). Nenhum bookmark a manter (sistema interno SUPER_ADMIN).
- **NÃO há D-30N AuditLog ativo** — remover audit log impersonate não gera regressão.

---

## Quebra em fatias confirmada

**F.6a Backend** (~3-4h):
1. Remover impersonate (backend + 4 specs)
2. Refactor `listarUsinasPorCooperativa` → agregação por proprietário (`{proprietarios[]}`)
3. Novo endpoint N3 + helper `parsePropId(propId)` que devolve `{caminho, valor}`
4. Specs novos (agregação + N3 + multi-tenant guards já validados)
5. nest build + 1 spec ainda OK
6. Commit

**F.6b Frontend** (~4-6h):
1. Instalar/implementar Tabs
2. Refactor `[cooperativaId]/page.tsx` (tabela → cards proprietários) + remoção impersonate
3. Nova rota `[cooperativaId]/proprietarios/[propId]/page.tsx` (Tabs Usinas/Carregadores)
4. Cleanup banner/botão impersonate em `/proprietario/usinas/[id]/page.tsx`
5. Build web (D-novo-AS) + PM2 restart frontend
6. Smoke visual
7. Commit

---

## Próximo passo

Aguardando OK do Luciano nas:
- Estimativa revisada (7.5-10h, dentro da faixa 6-9h ± uma hora)
- 8 decisões adicionais (defaults propostos)
- Fatiamento F.6a + F.6b separados confirmado
- Sem alterações nas decisões já travadas (cards N1 intactos, impersonate removido total)

Se OK, próximo prompt: "F.6a Backend — pode arrancar".

NÃO toquei código. Working tree limpo, último commit `485a986` (fechamento M33).
