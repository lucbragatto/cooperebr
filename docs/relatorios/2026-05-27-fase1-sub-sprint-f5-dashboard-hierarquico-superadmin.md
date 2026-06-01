# Fase 1 read-only — Sub-Sprint F.5 Dashboard Hierárquico Super Admin

> Sessão Code 27/05/2026 noite. Decisão 23 ativa — zero código tocado.

## TL;DR

`MetricasSaasService.getListaParceirosEnriquecida()` (Sprint 13a M19) cobre ~50% do card cooperativa (membros/contratos/cobranças/saúde inadimplência), **falta 7 campos novos pro recorte proprietário**. O padrão de impersonate via `trocarContexto` JÁ existe pra SUPER_ADMIN se passar cooperativaId, MAS o contexto `proprietario_usina` exige que o usuário seja proprietário — Super Admin não é, então não funciona out-of-the-box. **Recomendo bypass via query param `?impersonate=true` no `/proprietario/usinas/:id`** (mais simples que estender `trocarContexto`, reusa componente client existente).

**Estimativa revisada: 7-9h** (preliminar 6-8h bate, fica no topo da faixa por causa de specs Jest + 2 endpoints novos). Sugiro fatiar em **F.5a Backend (3-4h)** + **F.5b Frontend (3.5-5h)** se Luciano quiser entregas incrementais.

---

## 1. Estado atual `/dashboard/proprietario`

**Arquivo:** `web/app/dashboard/proprietario/page.tsx` (220 linhas — código pré-Sub-Sprint F)

**Endpoint atual:** `GET /usinas/proprietario/dashboard` (linha 38) → `usinas.service.ts:554`

```ts
async proprietarioDashboard(cooperadoId: string) {
  if (!cooperadoId) return { usinas: [], repasses: [] };
  const usinas = await this.prisma.usina.findMany({
    where: { proprietarioCooperadoId: cooperadoId },   // ← só Caminho A
    // ...
  });
}
```

**Por isso "Nenhuma usina vinculada" pra Super Admin:** o controller (`usinas.controller.ts:62-65`) injeta `req.user?.cooperadoId` — Super Admin não é cooperado, então `cooperadoId=undefined`, retorna `{ usinas: [], repasses: [] }`.

**Texto vazio é hardcoded** em `page.tsx:65`: `<p>Nenhuma usina vinculada ao seu perfil de proprietário.</p>` (não vem de hook).

**Sidebar admin:** `web/app/dashboard/layout.tsx:152` (seção "Relatórios"):
```ts
{ href: '/dashboard/proprietario', label: 'Portal Proprietário', icon: Sun }
```

**Esse item aparece pra Admin + Super Admin** (seção Relatórios é universal). Pra F.5 ser **exclusiva Super Admin**, ou movemos pro bloco "Gestão Global" (linha 167, `if (perfil === 'SUPER_ADMIN')`), ou adicionamos guard no componente. Recomendo MOVER no sidebar — mais limpo.

---

## 2. Schema + Roles

**`PerfilUsuario` enum** (`backend/src/auth/perfil.enum.ts`): SUPER_ADMIN, ADMIN, OPERADOR, COOPERADO, AGREGADOR, PROPRIETARIO

**`Cooperativa` campos relevantes** (`schema.prisma`): id, nome, cnpj, tipoParceiro, ativo, statusSaas, planoSaas{}, createdAt

**`Usina` campos relevantes** (`schema.prisma:337-389`):
- Identidade: `id`, `nome`, `apelidoInterno`, `cooperativaId`
- Proprietário: `proprietarioCooperadoId` (Caminho A), `proprietarioEmail` (Caminho B), `proprietarioNome`, `proprietarioTelefone`, `proprietarioCpfCnpj`
- Capacidade: `potenciaKwp` (Decimal — capacidade instalada), `capacidadeKwh` (Decimal nullable — kWh/mês mensal por decisão 17/05)
- Operação: `statusHomologacao`, `statusOperacional` (default OPERANDO; enum OPERANDO/MANUTENCAO_PLANEJADA/MANUTENCAO_EMERGENCIAL/DESLIGADA/OFFLINE)
- Aluguel: `formaPagamentoDono` (FIXO/PERCENTUAL/HIBRIDO), `valorAluguelFixo`, `percentualGeracaoDono`, `valorKwhPadrao`

**`ConviteProprietario`** (`schema.prisma:429-443`): id, usinaId, token, email, expiresAt, usedAt, createdBy, createdAt. **Falta cooperativaId direto** — precisa join via `usina.cooperativaId`.

**`Contrato`** já tem `cooperativaId` + `dataFim` (campos disponíveis pra "vencendo 30d").

**Capacidade total** → `SUM(potenciaKwp)` em kWp (não confundir com `capacidadeKwh` MENSAL — usar `potenciaKwp` evita ambiguidade da convenção 17/05).

---

## 3. Padrão "Visão por Cooperativa"

**Rota existente:** `/dashboard/cooperativas/[id]` (`web/app/dashboard/cooperativas/[id]/page.tsx`) — detalhe completo: identidade, plano SaaS, módulos, membros, usinas, ações migração. Já é o padrão usado pra Super Admin drill-down em qualquer cooperativa.

**Breadcrumb:** não há componente formal de breadcrumb hoje. Padrão atual é `<Link href="/voltar">← Voltar</Link>` (ex: `proprietario/usinas/[id]/page.tsx:117`).

**Impersonate via `trocarContexto`** (`backend/src/auth/auth.service.ts:561-599`): SUPER_ADMIN passa `{contexto:'super_admin', cooperativaId:X}` → gera novo JWT com `cooperativaId` injetado. **Funciona pra ver telas multi-tenant como se fosse admin daquela cooperativa.** MAS não cobre o caso "vê como **proprietário**" — porque `obterContextosUsuario` só adiciona o contexto `proprietario_usina` se o usuário MESMO casa via `proprietarioCooperadoId` ou `proprietarioEmail` (linhas 516-536).

---

## 4. Endpoint agregado por cooperativa

**Reaproveitável:** `GET /saas/parceiros` (`saas.controller.ts:27-30` → `MetricasSaasService.getListaParceirosEnriquecida` linhas 171-294) já retorna por cooperativa:

| Campo | Já tem? |
|---|---|
| nome, cnpj, tipoParceiro, ativo, statusSaas, planoSaas | ✅ |
| membros (total + ativos) | ✅ |
| contratosAtivos (count total) | ✅ |
| cobrancasMes (total/pagas/vencidas/receitaPaga) | ✅ |
| saude.cor + taxaInadimplencia | ✅ |
| **Nº usinas com proprietário** (Caminho A OR B) | ❌ |
| **Nº proprietários únicos** (distinct emails + cooperadoIds) | ❌ |
| **Total YTD agregado** (sum repasses ano corrente) | ❌ |
| **Capacidade total kWp** (sum potenciaKwp) | ❌ |
| **Usinas OK/Atencao/Critico** (groupBy statusOperacional) | ❌ |
| **Convites pendentes** (ConviteProprietario.usedAt=null AND expiresAt>now) | ❌ |
| **Contratos vencendo 30d** (Contrato.dataFim entre now e now+30d) | ❌ |

**Decisão arquitetural:**
- **Opção A** — Ampliar `getListaParceirosEnriquecida` com 7 campos. Vantagem: 1 query só. Desvantagem: payload pesado pra quem só quer dados SaaS atuais (tela `/dashboard/super-admin/parceiros` já consome esse).
- **Opção B (recomendada)** — Criar endpoint novo `GET /saas/parceiros/proprietarios-overview` dedicado. Vantagem: separação de concerns, reutilização do método existente sem regressão.

---

## 5. Endpoint por usina dentro de cooperativa

**Não existe.** Precisa criar `GET /saas/parceiros/:id/usinas-proprietario` retornando array:

```ts
[{
  usinaId, nome, apelidoInterno,
  statusOperacional, statusHomologacao,
  proprietarioNome, proprietarioEmail, proprietarioCooperadoId,
  potenciaKwp, capacidadeKwh,
  ytdRepasse,                    // calculado loop geracoesMensais 2026 + calcularRepasse
  formaPagamentoDono,
  contratoArrendamento: 'FIXO_1000' | 'PERCENTUAL_15' | 'HIBRIDO_500_10' | 'NAO_CONFIGURADO',
}]
```

Helper `calcularRepasse` reusado de `proprietario.service.ts` (linha 150). Padrão de loop YTD já está em `dashboard()` linhas 156-169 — pode extrair em helper compartilhado.

---

## 6. Impersonate em `/proprietario/usinas/[id]`

**Backend atual** (`proprietario.service.ts:37-61` `resolverUsinasDoProprietario`):

```ts
const where: any[] = [];
if (user.cooperadoId) where.push({ proprietarioCooperadoId: user.cooperadoId });
if (user.email) where.push({ proprietarioEmail: user.email });
// ...
if (usinas.length === 0) throw new ForbiddenException(...);
```

Super Admin sem casamento → ForbiddenException. **3 abordagens analisadas:**

### Opção A — Estender `trocarContexto` pra aceitar (cooperativaId, usinaId)
Modifica `auth.service.ts:561-599` pra que SUPER_ADMIN troque pro contexto `proprietario_usina` impersonando uma usina específica. Token novo carrega `impersonatedUsinaId`. Backend lê isso em `resolverUsinasDoProprietario`.

**Custo:** alto (mexe em fluxo auth crítico + spec auth + ContextoSwitcher frontend). ❌

### Opção B (recomendada) — Query param `?impersonate=true` + role check
Frontend `/dashboard/proprietario/[cooperativaId]/[usinaId]` navega pra `/proprietario/usinas/[usinaId]?impersonate=true`. Backend em `proprietario.service.ts` adiciona ANTES do guard:

```ts
private async resolverUsinasDoProprietario(user, opts?: { impersonateUsinaId?: string }) {
  if (user?.perfil === 'SUPER_ADMIN' && opts?.impersonateUsinaId) {
    // bypass: valida só que a usina existe + audit log
    const u = await this.prisma.usina.findUnique({ where: { id: opts.impersonateUsinaId } });
    if (!u) throw new NotFoundException(...);
    return [u.id];
  }
  // fluxo normal abaixo
}
```

Frontend renderiza banner azul condicionalmente baseado em `searchParams.get('impersonate')`. Audit log catalogado (D-30N AuditLog ainda inativo — débito conhecido).

**Custo:** baixo (~30min backend + 15min frontend banner). ✅

### Opção C — Nova rota `/dashboard/proprietario/[coopId]/usinas/[id]` + novo endpoint admin
Duplicaria componente client + criaria endpoint `/admin/usinas/:id/proprietario-view`. Mais código, mais superfície de manutenção. ❌

**Recomendação: Opção B.** Banner azul exemplo:

```tsx
{searchParams.get('impersonate') === 'true' && (
  <div className="bg-blue-100 border border-blue-300 text-blue-900 px-4 py-2 rounded mb-4 text-sm flex items-center gap-2">
    <Shield className="w-4 h-4" />
    <strong>Modo Super Admin:</strong> visualizando como proprietário de {usina.nome} ({coop.nome}). Esta sessão é registrada em audit log.
  </div>
)}
```

---

## 7. Permissions / Guards

**Backend:**
- Endpoints novos `/saas/parceiros/proprietarios-overview` + `/saas/parceiros/:id/usinas-proprietario` → `@Roles(SUPER_ADMIN)`
- Bypass impersonate em `proprietario.service.ts` → check `user.perfil === 'SUPER_ADMIN'` antes do guard normal
- ADMIN parceiro acessando endpoints `/saas/*` → 403 (RolesGuard global)

**Frontend:**
- `/dashboard/proprietario` (novo grid): adicionar guard no `useEffect` — `if (usuario.perfil !== 'SUPER_ADMIN') router.replace('/dashboard')`
- `/dashboard/proprietario/[cooperativaId]`: mesmo guard
- `/proprietario/usinas/[id]?impersonate=true`: backend valida, frontend só renderiza banner

**Multi-tenant:** SUPER_ADMIN tem bypass global por design (vide `assertSameTenantOrSuperAdmin` em `tenant-guard.helper.ts`). Outras roles continuam isoladas — endpoints novos `/saas/*` já estão sob `@Roles(SUPER_ADMIN)`.

---

## Estimativa revisada

| Fatia | Item | Horas |
|---|---|---|
| **F.5a Backend** | Novo `GET /saas/parceiros/proprietarios-overview` (7 campos novos) | 1.5-2h |
|  | Novo `GET /saas/parceiros/:id/usinas-proprietario` | 1-1.5h |
|  | Bypass impersonate em `proprietario.service.ts` (3 métodos: dashboard/detalheUsina/listarRepasses) | 30-45min |
|  | Specs Jest (~10-15 testes) | 1-1.5h |
| **F.5b Frontend** | Refactor `/dashboard/proprietario/page.tsx` → grid cards cooperativa | 1.5-2h |
|  | Nova `/dashboard/proprietario/[cooperativaId]/page.tsx` (tabela usinas) | 1.5-2h |
|  | Banner impersonate condicional em `/proprietario/usinas/[id]/page.tsx` | 15-30min |
|  | Mover item sidebar pra "Gestão Global" + guards de role | 15-30min |
|  | Build (`next build`) + smoke visual | 30min |
| **Total** | | **7-9h** |

**Fatiamento sugerido:** F.5a + F.5b separados (commit por fatia, smoke independente). F.5a pode ser validado via curl + admin DevTools antes de F.5b consumir.

---

## Decisões adicionais que valeria bater

1. **Banner impersonate — escopo de auditoria:** D-30N AuditLog ainda inativo (interceptor não foi reativado pós-cleanup). Code DEVE adicionar `console.log` estruturado + nota pra D-30N futuro, OU esperamos AuditLog?  
   **Default proposto:** logar via `console.log` estruturado por enquanto (`{event:'super_admin_impersonate', usinaId, coopId, userId}`) — quando D-30N reativar, é só wireup.

2. **Filtro do grid cooperativas:** mostrar todas (incluindo as sem usinas com proprietário) ou só as que TÊM `>=1` usina com proprietário?  
   **Default proposto:** mostrar todas, com badge "0 proprietários" pras sem — info útil pra ver onboarding pendente.

3. **Sort default do grid:** alfabético por nome, OR por "saúde" (críticos primeiro), OR por "data mais recente cadastrada"?  
   **Default proposto:** alfabético (`getListaParceirosEnriquecida` já ordena `nome: 'asc'`).

4. **YTD agregado por cooperativa — performance:** calcular em runtime via loop GeracaoMensal pode ficar caro com N cooperativas × N usinas × 12 meses. Hoje há 2 cooperativas + ~10 usinas, então OK.  
   **Threshold pra cache:** se >50 cooperativas, considerar cache em memória 5-min.

5. **Mostra valor R$ do plano SaaS no card?** `getListaParceirosEnriquecida` já tem `planoSaas.mensalidadeBase` — pode entrar como badge "Plano OURO" + "R$ 5.900/mês".  
   **Default proposto:** sim, badge plano + valor — info-densa sem clutter.

6. **Card click → tabela usinas:** click no card inteiro ou só botão "Ver usinas"?  
   **Default proposto:** card inteiro com cursor pointer (padrão existente em outras telas).

---

## Próximo passo

Aguardando OK do Luciano nas:
- Opção arquitetural (B query param recomendada)
- Fatiamento F.5a + F.5b (preferência?)
- 6 decisões adicionais default propostas

Se OK e quiser fatiar, próximo prompt seria: "F.5a Backend — pode arrancar".

NÃO toquei código. Working tree limpo, último commit `79ba324` (M32 D-novo-AR resolvido).
