# Portal Multi-Papel — Relatório de Implementação

**Data:** 2026-03-25
**Commits:** 3 incrementais no branch `main`

---

## Resumo

Implementado o sistema de portal multi-papel que permite que um mesmo usuário acesse múltiplos contextos simultâneos no CoopereBR (ex: Luciano como SUPER_ADMIN + Cooperado).

---

## O que foi implementado

### 1. Backend — Contexto Multi-Papel

**Arquivo:** `backend/src/auth/auth.service.ts` — método `obterContextosUsuario()`

O endpoint `GET /auth/me` agora retorna:
```json
{
  "usuario": { ... },
  "contextos": [
    { "tipo": "super_admin", "label": "Super Administrador" },
    { "tipo": "cooperado", "label": "Cooperado — CoopereBR", "id": "xxx", "cooperativaId": "yyy" },
    { "tipo": "admin_parceiro", "label": "Admin — CoopereBR", ... },
    { "tipo": "proprietario_usina", "label": "Proprietário — Usina Solar 1" }
  ],
  "cooperadoId": "...",
  "usinasProprietario": [{ "id": "...", "nome": "..." }],
  "parceirosDisponiveis": [...]  // só para SUPER_ADMIN
}
```

**Detecção automática de papéis:**
- `super_admin` — se `perfil === 'SUPER_ADMIN'`
- `admin_parceiro` — se `perfil === 'ADMIN'` e tem `cooperativaId`
- `cooperado` — match por CPF ou email na tabela `Cooperado`
- `proprietario_usina` — match via `proprietarioCooperadoId` ou `proprietarioEmail` na tabela `Usina`

**Arquivo:** `backend/src/auth/contexto-ativo.decorator.ts`
- Decorator `@ContextoAtivo()` para extrair `X-Contexto-Ativo` do header

### 2. Frontend — Infraestrutura de Contexto

| Arquivo | Função |
|---------|--------|
| `web/types/index.ts` | Tipos `TipoContexto`, `ContextoUsuario`, `MeResponse` |
| `web/hooks/useContexto.ts` | Hook que chama `/auth/me`, gerencia contexto ativo via `localStorage` |
| `web/lib/api.ts` | Interceptor envia `X-Contexto-Ativo` automaticamente em cada request |
| `web/lib/auth.ts` | `logout()` e `logoutPortal()` limpam `contexto_ativo` do localStorage |
| `web/middleware.ts` | Suporta rotas `/parceiro`, `/proprietario`, `/selecionar-contexto` |

### 3. Frontend — Componentes Compartilhados

| Componente | Arquivo | Descrição |
|-----------|---------|-----------|
| `ContextoSwitcher` | `web/components/ContextoSwitcher.tsx` | Dropdown de troca de contexto com ícones/cores por tipo |
| Tela de seleção | `web/app/selecionar-contexto/page.tsx` | Cards bonitos pós-login para escolher contexto |

### 4. Portal do Parceiro/Admin (`/parceiro`)

| Rota | Página | Funcionalidade |
|------|--------|----------------|
| `/parceiro` | Dashboard | KPIs: membros ativos, inadimplência, receita, usinas |
| `/parceiro/membros` | Lista | Busca por nome/CPF/email, filtro por status |
| `/parceiro/membros/[id]` | Detalhe | Dados, contratos, documentos, cobranças do membro |
| `/parceiro/financeiro` | Financeiro | Recebido, a receber, vencido + tabela de cobranças |
| `/parceiro/usinas` | Usinas | Cards com status, potência, capacidade, localização |
| `/parceiro/convites` | Convites | Link de indicação, lista de indicados |
| `/parceiro/configuracoes` | Config | Dados do parceiro, multa/juros/carência |

**Layout:** Sidebar azul (`bg-blue-50`) + ContextoSwitcher no header.

### 5. Portal do Proprietário de Usina (`/proprietario`)

| Rota | Página | Funcionalidade |
|------|--------|----------------|
| `/proprietario` | Dashboard | KPIs: usinas, produção, capacidade, repasse |
| `/proprietario/usinas` | Usinas | Detalhes (potência, capacidade, local, distribuidor) |
| `/proprietario/repasses` | Repasses | Histórico + download PDF |
| `/proprietario/contratos` | Contratos | Contratos vinculados às usinas do proprietário |

**Layout:** Sidebar âmbar (`bg-amber-50`) + ContextoSwitcher no header.

### 6. Fluxo de Navegação

```
Login → /selecionar-contexto
         ├── 1 contexto → redireciona direto
         ├── N contextos + salvo válido → redireciona direto
         └── N contextos + nenhum salvo → mostra tela de seleção

Contexto ativo salvo no localStorage ('contexto_ativo')
ContextoSwitcher disponível em todos os headers

Cada contexto redireciona:
  super_admin       → /dashboard
  admin_parceiro    → /parceiro
  cooperado         → /portal
  proprietario_usina → /proprietario
```

---

## Cores por contexto

| Contexto | Cor primária | Ícone |
|----------|-------------|-------|
| Super Admin | Purple (roxo) | Shield |
| Admin Parceiro | Blue (azul) | Building2 |
| Cooperado | Green (verde) | User |
| Proprietário Usina | Amber (âmbar) | Sun |

---

## Próximos passos sugeridos

1. **Backend:** Criar endpoints específicos para o contexto proprietário (`/proprietario/repasses`, `/proprietario/usinas`)
2. **Backend:** Implementar impersonation para SUPER_ADMIN (view-only em qualquer contexto)
3. **Frontend:** Adicionar breadcrumb com contexto ativo
4. **Frontend:** Responsividade mobile para as áreas /parceiro e /proprietario (sidebar colapsável)
5. **Testes:** Testar cenário real de usuário com múltiplos papéis
