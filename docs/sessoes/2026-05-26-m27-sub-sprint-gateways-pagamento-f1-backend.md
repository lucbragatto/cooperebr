# M27 — Sub-Sprint Gateways de Pagamento Fatia F1 (Backend)

> Sessão: 26/05/2026 noite (continuação pós-fechamento Fase 1 read-only)
> Marco: **M27 — Sub-Sprint Gateways de Pagamento Fatia F1 Backend completo**
> Abordagem aprovada: **FATIAR** (backend agora F1+F2+F3+F5, frontend F4 depois)
> Timing aprovado: **arrancar agora** (F1 não depende do `.pfx` sandbox)

## TL;DR

Backend completo do novo módulo `gateways-pagamento-config/` entregue em
**6 commits incrementais** (Etapas A→F com specs verdes em cada commit).
**83 specs novos verdes** (12 encryptor + 24 registry + 29 service + 18 controller).
**8 endpoints REST** novos expostos. **0 mudança em schema Prisma** (planejado pra F2 com migration cuidadosa). **0 efeito colateral** no AsaasService legado ou BanestesAdapter (refator desses dois fica pra F2+F3 com dual-write durante coexistência 30 dias).

Próximo passo bloqueado por **Luciano operacional**: gerar `GATEWAY_ENCRYPT_KEY` real (`openssl rand -base64 32`) + 2 backups OFFLINE (papel + gerenciador senhas) ANTES da F2 mexer em dados reais. Mitigação obrigatória do risco crítico R2 catalogado na Fase 1.

## Commits do dia (6)

| Hash | Mensagem |
|---|---|
| `42119f6` | feat(gateways-config): Etapa A — modulo + zod + GATEWAY_ENCRYPT_KEY no .env.example |
| `b7e8b42` | feat(gateways-config): Etapa B — CredentialsEncryptor AES-256-GCM + 12 specs |
| `eaa1942` | feat(gateways-config): Etapa C — GatewayRegistry Zod + 2 DTOs + 24 specs |
| `95e04c1` | feat(gateways-config): Etapas D+E — Service CRUD multi-tenant + testarConexao + 29 specs |
| `bf441b1` | feat(gateways-config): Etapa F — Controller 8 endpoints + 18 specs |
| (este) | docs(sessao): fechamento M27 Sub-Sprint Gateways de Pagamento Fatia F1 Backend |

## Arquivos novos (módulo `backend/src/gateways-pagamento-config/`)

```
gateways-pagamento-config.module.ts
gateways-pagamento-config.controller.ts
gateways-pagamento-config.service.ts
credentials-encryptor.service.ts
gateway-registry.ts
dto/
  criar-gateway.dto.ts
  atualizar-gateway.dto.ts
```

Specs:

```
credentials-encryptor.service.spec.ts        (12 specs)
gateway-registry.spec.ts                     (24 specs)
gateways-pagamento-config.service.spec.ts    (29 specs)
gateways-pagamento-config.controller.spec.ts (18 specs)
```

Modificações em arquivos existentes:

- `backend/.env.example` — adicionado `GATEWAY_ENCRYPT_KEY` com aviso R2 (~+18 linhas)
- `backend/package.json` — `zod ^4.4.3` adicionado em dependencies
- `backend/src/app.module.ts` — `GatewaysPagamentoConfigModule` importado e registrado
- `backend/package-lock.json` — sync

## Endpoints REST expostos

```
GET    /gateways-pagamento/suportados       — registry público (form dinâmico)
GET    /gateways-pagamento                  — lista do tenant (mascarado)
GET    /gateways-pagamento/me/ativo?tipo=X  — ativo do tipo (uso interno, F3 consumirá)
GET    /gateways-pagamento/:id              — detalhe (mascarado)
POST   /gateways-pagamento                  — criar
PATCH  /gateways-pagamento/:id              — atualizar
DELETE /gateways-pagamento/:id              — remover
POST   /gateways-pagamento/:id/testar       — smoke conexão (delega adapter)
```

Auth: `@Roles(SUPER_ADMIN, ADMIN)` em todos. JWT global via `APP_GUARD` no `AppModule`. `@AuditLog` em mutations (criar/atualizar/remover/testar) com `recursoIdParam='id'` quando aplicável.

## Padrões técnicos aplicados

### CredentialsEncryptor (Etapa B)

- AES-256-GCM (padrão extraído do `AsaasService.encrypt/decrypt`).
- Formato: `iv:cipher:tag` em base64. IV 12 bytes (96 bits) aleatório por chamada.
- Tag 16 bytes (128 bits) — GCM rejeita ciphertext alterado (proteção tampering).
- Chave master 32 bytes (256 bits) base64, lida de `process.env.GATEWAY_ENCRYPT_KEY` em runtime (não cached — permite rotação em testes).
- Helper `mask()` mantém últimos 4 chars pra UI (`****dfe8`).

### GatewayRegistry (Etapa C)

- Estrutura declarativa `Object.freeze` com 2 entradas: ASAAS + BANESTES.
- Schema Zod por tipo (validação tipada no service antes de encriptar).
- `camposSecret` lista campos que o `encriptarSecrets` cifra.
- `camposMetadados` lista campos que ficam em texto puro.
- `suporta` mapeia operações vivas (UI desabilita botões incompatíveis).
- `getDescriptorPublico` retorna versão serializável JSON-friendly (sem Zod) pro frontend.
- Sicoob/BB **FORA** do registry (decisão 5 da Fase 1).

### Service CRUD multi-tenant (Etapas D+E)

- Todas queries Prisma filtram por `cooperativaId` (defesa IDOR sistêmica).
- `findFirst({ where: { id, cooperativaId } })` retorna `null` se tenant divergente → `NotFoundException` (não vaza informação sobre existência de id alheio).
- Persistência unificada em `credenciais Json`: `{ __enc: {...secrets}, ...metadadosTextoPuro }`. F2 migrará pro shape final (rename + add `metadados Json`).
- `resolverCooperativaId`: SUPER_ADMIN atua como tenant alheio via body; ADMIN rejeita divergência body↔JWT.
- `@@unique([cooperativaId, gateway])` violação → `ConflictException 409` com mensagem clara.
- `testarConexao` delega pro `GatewayPagamentoService.testarConexao` (que via factory chama o adapter correto). Captura exception como `ok=false` estruturado (UX limpa).

### Controller (Etapa F)

- Order critical: `/me/ativo` registrado ANTES de `/:id` pra Nest não interpretar `me` como id.
- `resolverTenantQuery()` centraliza defesa multi-tenant pros endpoints GET/PATCH/DELETE.
- Não-mutations não decoradas com `@AuditLog` (READ menos crítico que WRITE).

## Validação

- `nest build` ✅ limpo (`npm run build` sem erro)
- `tsc --noEmit -p tsconfig.build.json` ✅ EXIT:0
- **83/83 specs novos verdes** no módulo
- Suíte completa: **851/862 passing**. **11 falhas são PRÉ-EXISTENTES** em `cooperados.controller.spec.ts` + `cooperados.service.spec.ts` + `cooperados.service.guard-ativacao.spec.ts` + `usinas.controller.spec.ts` (confirmado revertendo `backend/src` pro estado pré-M27 — as falhas persistem). Fora do escopo do Sub-Sprint Gateways de Pagamento.

## Constraints respeitadas

- ✅ TDD: specs primeiro em cada Etapa B-F antes de commit
- ✅ Multi-tenant: `cooperativaId` em todas queries Prisma + guard em controller
- ✅ Schema Prisma **NÃO** alterado (rename + add `metadados` ficam pra F2)
- ✅ `AsaasConfig` legado **não tocado** (refator vem na F2 com dual-write)
- ✅ `AsaasAdapter` + `BanestesAdapter` **não modificados** (refator vem na F3)
- ✅ Sem registros criados no banco (specs usam mocks Prisma)
- ✅ Sem `force push`, commits pequenos, mensagens em português
- ✅ `GATEWAY_ENCRYPT_KEY` placeholder em `.env.example` com aviso R2 explícito

## Próximo passo — F2 (schema migration + dual-write Asaas)

**BLOQUEADO POR LUCIANO OPERACIONAL:** antes de F2 rodar, é OBRIGATÓRIO:

1. Gerar chave master real: `openssl rand -base64 32`
2. Configurar `GATEWAY_ENCRYPT_KEY` no `.env` do servidor de produção
3. **Backup OFFLINE em 2 cópias** (papel num cofre + gerenciador de senhas confiável)
4. Confirmar ao orquestrador que está feito
5. Aí F2 arranca

Justificativa: risco crítico **R2** catalogado na Fase 1. Perda da chave master = TODOS os gateways configurados ficam ilegíveis (impossível decriptar). Recovery exige os backups offline. Sem eles, F2 migration de dados reais é IRRESPONSÁVEL.

Estimativa F2 quando arrancar: **3-4h Code** (rename `credenciais → credenciaisCriptografadas` + add coluna `metadados Json` + migration com dry-run obrigatório CLAUDE.md regra 6 + dual-write `AsaasService.salvarConfig` + dual-read `AsaasService.getConfig`).

## Frentes operacionais Luciano (acumulado)

- ⚠️ **NOVA:** Gerar `GATEWAY_ENCRYPT_KEY` + backup offline 2 cópias antes de F2 (R2)
- Avisar time legado: senha Azure SQL + 5 `.pfx` vazados + senha `.pfx` em comentário + senha `.pfx` em coluna texto puro + webhook sem validação
- Obter `script.sql` do hb06a (Sub-Sprint B ETL)
- Obter `.pfx` sandbox Banestes do portal desenvolvedor
- Decisões regulatórias Sub-Sprint A (Assinafy, segregação tributária)
- Definir regra parcelamento D-novo-AD
- Configurar SMTP/IMAP `noreply@sisgdsolar.com.br`

## Carry-overs (não-bloqueantes)

- Sub-Sprint Gateways de Pagamento F2 (schema migration + dual-write Asaas) — aguarda backup offline `GATEWAY_ENCRYPT_KEY`
- Sub-Sprint Gateways de Pagamento F3 (refator BanestesConfigService multi-tenant) — segue F2
- Sub-Sprint Gateways de Pagamento F5 (migration dados + smoke E2E) — segue F2+F3
- Sub-Sprint Gateways de Pagamento F4 (frontend tela nova) — sub-sprint próprio depois do backend completo
- Sub-Sprint B (ETL legado→novo) — aguarda `script.sql`
- Cenário Completo Banestes (~6-8h Code futuro) — depois Carolina pagar canário
- Sprint Bot Proativo Fase 1 read-only — frente paralela disponível

## Regras aplicadas na sessão

- Decisão 23 (validação prévia rigorosa): cumprida — Fase 1 read-only ampla rodou na sub-sessão anterior, plano travado no relatório `docs/relatorios/2026-05-26-fase1-sub-sprint-gateways-pagamento.md`
- TDD (CLAUDE.md): specs antes da implementação em cada Etapa B-F
- Multi-tenant (CLAUDE.md regra dura): `cooperativaId` em 100% das queries Prisma
- Conventional commits em português, pequenos e descritivos
- Sem `force push`, sem `--no-verify`
- Não trabalhar em paralelo com Luciano (17/05): Luciano autorizou explícito antes da execução, não houve cruzamento de frentes

## Frase comandante

Próxima sessão Code abre verificando se Luciano confirmou backup offline da `GATEWAY_ENCRYPT_KEY` (2 cópias). Se SIM, arranca F2 (schema migration aditiva `rename credenciais → credenciaisCriptografadas` + add `metadados Json` + migration dry-run + dual-write `AsaasService`). Se NÃO, pausa e cobra Luciano operacionalmente (sem backup = sem F2). Frentes paralelas se F2 bloqueado: Sprint Bot Proativo Fase 1 read-only ou aguardar `script.sql` Sub-Sprint B.
