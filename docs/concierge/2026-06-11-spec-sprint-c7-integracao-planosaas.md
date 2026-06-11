# SPEC Sprint C7 — Integração Concierge → PlanoSaas (read-only)

> Documento de especificação **somente leitura**. Implementação fica enfileirada pro Code (implementador único no core), provavelmente junto do Sprint Hardening Mass-Write (M3) que já toca `propagarModulosDoPlano`.
>
> Cowork autor: 2026-06-11. Revisão necessária pelo Code antes de implementar.

## TL;DR

Substituir a flag isolada `Cooperativa.moduloConciergeAtivo` (MVP commit `2440f94`) pelo módulo `"CONCIERGE"` no enum de `PlanoSaas.modulosHabilitados`. Plano OURO passa a incluir Concierge nativamente; plano PRATA não inclui — admin compra adicional à la carte (via `modulosExtras` proposto). Manter compatibilidade durante 2-3 sprints.

## Estado atual mapeado

### 1) Schema relevante (apenas leitura, sem alteração nesta spec)

```prisma
model Cooperativa {
  modulosAtivos         String[]    @default([])  // cache do plano
  modalidadesAtivas     Json        @default("{}")
  planoSaasId           String?
  planoSaas             PlanoSaas?  @relation(...)

  // ── MVP Concierge (2026-06-11, commit 2440f94, A DEPRECAR) ──
  moduloConciergeAtivo  Boolean     @default(false)
  conciergeAtivadoEm    DateTime?
}

model PlanoSaas {
  // ...
  modulosHabilitados   String[]  // array de slugs
  modalidadesModulos   Json      // { "MOTOR_PROPOSTA": "AVANCADO", ... }
}
```

### 2) `propagarModulosDoPlano` atual (`saas.service.ts:111`)

```typescript
private async propagarModulosDoPlano(planoSaasId: string) {
  const plano = await this.prisma.planoSaas.findUnique({ where: { id: planoSaasId } });
  if (!plano) return;

  await this.prisma.cooperativa.updateMany({
    where: { planoSaasId },
    data: {
      modulosAtivos: plano.modulosHabilitados,         // SOBRESCREVE
      modalidadesAtivas: plano.modalidadesModulos ?? {}, // SOBRESCREVE
    },
  });
}
```

**Problema observado pelo Code**: `updateMany` substitui `modulosAtivos` **integralmente**. Qualquer módulo "extra" ativado fora do plano (à la carte) seria apagado ao editar o plano.

### 3) `vincularPlano` atual (`saas.service.ts:77`)

Mesmo padrão de overwrite quando vincula plano novo a uma cooperativa.

### 4) Guard atual

`ModuloGuard` (`auth/modulo.guard.ts`) — opt-in via decorator. Sem decorator, passa direto. Não-quebrante.

### 5) Lista de módulos hoje (deduzida da tela `/dashboard/saas/planos`)

15 slugs:
```
USINAS, MEMBROS, UCS, CONTRATOS, COBRANCAS, MODELOS_COBRANCA,
MOTOR_PROPOSTA, WHATSAPP, INDICACOES, CLUBE_VANTAGENS, CONVENIOS,
RELATORIOS_AVANCADOS, CONDOMINIOS, USUARIOS, PLANOS_ASSINATURA
```

Falta canonicalizar essa lista num enum tipado. Hoje é string mágica espalhada.

## Problemas estruturais a resolver

### P1 — Merge plano ∪ extras (à la carte sobrevive overwrite)

**Cenário**: Cooperativa "Sinergia" está no plano PRATA (sem Concierge). Admin SISGD ativa Concierge à la carte como cortesia. Mais tarde, SISGD edita o plano PRATA pra adicionar módulo "RELATORIOS_AVANCADOS". `propagarModulosDoPlano` roda e **APAGA o Concierge da Sinergia** porque o plano PRATA não tem.

**Soluções propostas (Code escolhe)**:

#### Opção A — Novo campo `modulosExtras` em Cooperativa

```prisma
model Cooperativa {
  modulosAtivos    String[]  // cache derivado: plano.modulosHabilitados ∪ modulosExtras
  modulosExtras    String[]  @default([])  // adicionais à la carte
}
```

`propagarModulosDoPlano` vira:

```typescript
const novosModulos = [
  ...new Set([...plano.modulosHabilitados, ...coop.modulosExtras])
];
```

Vantagens: explícito, audita-bilidade, separação clara plano vs extras.
Desvantagens: schema delta; `modulosAtivos` vira sempre derivado (cuidar de invariante).

#### Opção B — Cálculo lazy do merge sem cache

Remove `modulosAtivos` do cache, sempre lê do plano + extras em runtime. ModuloGuard busca dinamicamente.

Vantagens: zero risco de divergência cache vs realidade.
Desvantagens: cada request bate no banco pra checar (perf), refatoração mais ampla.

#### Opção C — Manter `modulosAtivos` como verdade + flag por módulo "origem"

```prisma
model CooperativaModulo {
  cooperativaId  String
  moduloSlug     String
  origem         OrigemModulo  // PLANO | EXTRA
  ativadoEm      DateTime
  @@unique([cooperativaId, moduloSlug])
}
```

Vantagens: máxima granularidade, histórico, fácil reverter por origem.
Desvantagens: schema delta maior, nova tabela.

**Recomendação Cowork**: Opção A. Simples, audita-bilidade, schema delta mínimo. Code pode achar Opção C melhor pra futuro (CooperToken e Clube também viram módulos extras um dia).

### P2 — Hardening Mass-Write em `propagarModulosDoPlano`

Sprint Hardening Mass-Write SUPER_ADMIN (M3 mapeado em pipeline) ataca exatamente esse `updateMany`. Quando integrar Concierge:

- **Preview** antes do commit: listar quantas cooperativas serão afetadas, quais módulos serão adicionados/removidos por cooperativa, quantos `modulosExtras` serão preservados.
- **Confirmação dupla**: dialog SUPER_ADMIN "vai afetar N parceiros — confirma?"
- **AuditLog** estruturado: cada propagação gera entries `AUDIT_PROPAGACAO_MODULOS` por cooperativa com diff (`modulosAntes`, `modulosDepois`, `extrasPreservados`).
- **Idempotência**: se rodar 2x seguidas com mesmo plano, segundo no-op.

Reutiliza padrão do D-novo-BR (TenantOwnershipGuard) — opt-in via decorator `@MassWrite('modulosAtivos')` ou similar.

### P3 — Depreciação `moduloConciergeAtivo` com compat

Plano em 3 sprints:

| Sprint | Ação | Risco |
|---|---|---|
| **C7 (implementar)** | Adicionar `"CONCIERGE"` ao enum de módulos. `propagarModulosDoPlano` passa a respeitar `modulosExtras`. ConciergeGuard passa a olhar `modulosAtivos.includes('CONCIERGE')` **AND** `moduloConciergeAtivo === true` (OR semântico — qualquer das duas libera). | Baixo (não-quebra) |
| **C7+1** | Campo `moduloConciergeAtivo` marcado `@deprecated` em comentário. Script de backfill: pra toda cooperativa onde `moduloConciergeAtivo=true`, garantir que `"CONCIERGE" ∈ modulosExtras OR ∈ plano.modulosHabilitados`. ConciergeGuard passa a olhar SÓ `modulosAtivos`. | Médio |
| **C7+2** | `prisma migrate` remove campos `moduloConciergeAtivo` + `conciergeAtivadoEm`. Tela `/dashboard/super-admin/concierge` removida (substituída pela tela genérica de gestão de extras por cooperativa, que deve nascer no Hardening). | Baixo (após backfill) |

### P4 — Tela `/dashboard/saas/planos` (modal de plano)

Adicionar checkbox **"Concierge Tributário"** na grade de módulos. Slug `CONCIERGE`. Label em português + tooltip explicativo:

```
☐ Concierge Tributário
  Auditor automático de fatura de energia. Detecta indébitos
  PIS/COFINS + ICMS via 3 teses (Tema 69, Tese 3 dossiê, Tese 2
  TUSD-G). Gera briefing pra advogado parceiro. Inclui adapter
  EDP-ES + ELFSM (mais distribuidoras conforme demanda).
```

Plano OURO sai habilitado por padrão; PRATA opcional.

### P5 — Tela `/dashboard/super-admin/concierge`

Após C7+1 vira **read-only dashboard** mostrando:
- Cooperativas com Concierge **via plano** (não-removível sem mudar plano)
- Cooperativas com Concierge **via extra à la carte** (botão "remover extra")
- Cooperativas sem Concierge

Toggle de ativação manual desaparece — substituído por (a) editar plano da cooperativa via `/dashboard/saas/parceiros/[id]/editar` OR (b) adicionar/remover na lista de extras.

## Estimativa Code

| Atividade | Esforço |
|---|---|
| Schema delta `modulosExtras` String[] | 5min |
| Refatorar `vincularPlano` + `propagarModulosDoPlano` pra merge | 30min |
| ConciergeGuard com compat `OR` | 10min |
| Adicionar `"CONCIERGE"` ao enum de módulos disponíveis | 10min |
| Tela `/dashboard/saas/planos` (checkbox novo) | 15min |
| Specs Jest (merge logic + idempotência + hardening preview) | 1h |
| AuditLog + dialog preview SUPER_ADMIN (parte M3) | 1-2h |
| Script backfill `moduloConciergeAtivo → modulosExtras` | 30min |
| Total | **~4-5h** |

## Riscos identificados

1. **Cooperativas atualmente com `moduloConciergeAtivo=true` sem plano** (caso CoopereBR pós-MVP) — se C7 mudar gate para `modulosAtivos.includes('CONCIERGE')` sem backfill prévio, perde o acesso. Compat OR resolve isso, mas Code precisa garantir.

2. **`modalidadesAtivas` (Json) também é overwrite no propagar** — mesmo problema do `modulosAtivos`. Spec C7 não cobre porque foge do escopo Concierge, mas o problema é gêmeo. Catalogar como `D-novo-MODALIDADES-EXTRAS-MERGE` P3 quando rodar C7.

3. **Lista de slugs de módulos hoje é string mágica** — risco de typo no enum. Refatorar pra `const MODULOS_SISGD = ['USINAS', 'MEMBROS', ..., 'CONCIERGE'] as const` + tipo derivado.

## Notas para o Code

- Cowork **NÃO toca em `src/saas/`, `src/auth/`, `prisma/schema.prisma`** durante C7 — implementação é tua.
- Próxima sessão Cowork vai focar em **Sprint C4** (orquestrador + endpoint `/preview-cooperado/:id` + pontes OCR→rubricas) — isolada em `src/concierge/`. Sem conflito.
- Se Code escolher Opção C (tabela `CooperativaModulo`), Cowork ajusta o frontend `/dashboard/concierge/*` depois pra consumir o formato novo. Avisar antes.

## Carry-overs catalogados

- `D-novo-CONCIERGE-PLANOSAAS-INTEGRACAO` P1 — esta spec inteira.
- `D-novo-MODALIDADES-EXTRAS-MERGE` P3 — mesmo problema do `modulosAtivos`, mas pra `modalidadesAtivas`.
- `D-novo-MODULOS-SLUGS-ENUM` P3 — refatorar string mágica pra enum tipado.

---

**Status**: read-only spec entregue 2026-06-11. Aguarda revisão Code antes de enfileirar implementação (junto do Hardening Mass-Write M3).
