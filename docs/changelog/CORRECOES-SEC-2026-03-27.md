# Correções de Segurança — 2026-03-27

## SEC-05/MIG-01 — IDOR em lista-concessionaria (CRÍTICO) ✅

**Problema:** `GET /migracoes-usina/lista-concessionaria/:usinaId` não filtrava por tenant. Qualquer ADMIN podia passar UUID de usina de outra cooperativa e ver CPF, nome e UC de cooperados alheios.

**Correção:**
- `migracoes-usina.service.ts` → `gerarListaConcessionaria()` agora recebe `cooperativaId` opcional. Se fornecido, verifica que `usina.cooperativaId === cooperativaId`. Lança `ForbiddenException` se não bater.
- `migracoes-usina.controller.ts` → endpoint passa `req.user.cooperativaId` (ADMIN/OPERADOR) ou `null` (SUPER_ADMIN, que pode acessar qualquer usina).
- Mesma proteção aplicada em `gerarRelatorioDualLista` (SEC-06).

**Arquivos alterados:**
- `backend/src/migracoes-usina/migracoes-usina.service.ts`
- `backend/src/migracoes-usina/migracoes-usina.controller.ts`

---

## SEC-07 — Migração cross-tenant (CRÍTICO) ✅

**Problema:** `POST /migracoes-usina/cooperado` e `POST /migracoes-usina/ajustar-kwh` não verificavam se o cooperado pertencia à cooperativa do admin logado.

**Correção:**
- `migrarCooperado()` — antes de buscar contrato ativo, verifica `cooperado.cooperativaId === dto.cooperativaId`. Lança `ForbiddenException` se não bater.
- `ajustarKwh()` — mesma verificação adicionada.
- SUPER_ADMIN (sem cooperativaId no JWT) bypassa a checagem naturalmente pois `dto.cooperativaId` será `null`.

**Arquivos alterados:**
- `backend/src/migracoes-usina/migracoes-usina.service.ts`

---

## Validação

- `npx tsc --noEmit` — compilação limpa, sem erros.
