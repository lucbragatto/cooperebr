# BUGFIX-CT-002: POST /cooper-token/parceiro/enviar retorna 403

## Problema

Usuarios com role ADMIN, OPERADOR ou AGREGADOR no contexto `admin_parceiro` recebiam erro ao tentar usar `POST /cooper-token/parceiro/enviar`.

## Causa raiz

Dois problemas no controller `cooper-token.controller.ts`:

### 1. OPERADOR ausente do `@Roles`

O decorator `@Roles(ADMIN, SUPER_ADMIN, AGREGADOR)` nao incluia `OPERADOR`. Usuarios com perfil OPERADOR em contexto `admin_parceiro` recebiam 403 do `RolesGuard`.

Referencia: `auth.service.ts` linhas 454-455 — tanto ADMIN quanto OPERADOR podem estar em contexto `admin_parceiro`.

### 2. Fallback de credito direto nao cobria OPERADOR nem AGREGADOR

A logica de credito direto (sem debito pessoal, para admins sem `cooperadoId` no JWT) verificava apenas ADMIN e SUPER_ADMIN:

```typescript
// ANTES (bugado)
if ((perfil === ADMIN || perfil === SUPER_ADMIN) && !remetenteCooperadoId) {
```

Usuarios OPERADOR e AGREGADOR no contexto `admin_parceiro`/`admin_agregador` nao possuem `cooperadoId` no JWT (definido apenas no contexto `cooperado`), portanto caiam no `BadRequestException('Cooperado remetente nao identificado no JWT')`.

## Correcao

Arquivo: `backend/src/cooper-token/cooper-token.controller.ts`

1. **Roles expandido:** `@Roles(ADMIN, SUPER_ADMIN, OPERADOR, AGREGADOR)`
2. **Fallback ampliado:** Todos os perfis administrativos entram no fluxo de credito direto quando nao possuem `cooperadoId`:

```typescript
// DEPOIS (corrigido)
if ([ADMIN, SUPER_ADMIN, OPERADOR, AGREGADOR].includes(perfil) && !remetenteCooperadoId) {
```

## Fluxo de autorizacao

```
Request -> JwtAuthGuard (401 se sem token)
        -> RolesGuard (403 se perfil nao permitido)
        -> ModuloGuard (403 se modulo desabilitado — nao se aplica aqui)
        -> ThrottlerGuard (429 se rate limit)
        -> Controller logic
```

- `RolesGuard` verifica `user.perfil` (vem do DB via `JwtStrategy.validate`) contra a lista do `@Roles`
- `SUPER_ADMIN` sempre bypassa o guard (hardcoded em `roles.guard.ts` linha 35)
- Guards aplicados globalmente via `APP_GUARD` em `app.module.ts`

## Impacto

- Endpoint `POST /cooper-token/parceiro/enviar` agora acessivel a ADMIN, OPERADOR, SUPER_ADMIN e AGREGADOR
- Nenhuma brecha: todos esses perfis ja tinham acesso a outros endpoints admin do cooper-token
- O credito direto respeita `cooperativaId` do JWT (isolamento multi-tenant mantido)

## Verificacao

- `npx tsc --noEmit` passa sem erros
- Fluxo ADMIN/OPERADOR em admin_parceiro: credito direto sem necessidade de cooperadoId
- Fluxo AGREGADOR sem cooperadoId: credito direto (antes falhava com 400)
- Fluxo usuario que tambem e cooperado (tem cooperadoId): transferencia com debito (inalterado)
