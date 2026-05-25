# M28 — Sub-Sprint Gateways de Pagamento Fatia F3 (BanestesConfigService Multi-Tenant)

> Sessão: 26/05/2026 noite (continuação pós-M27 F1 Backend)
> Marco: **M28 — BanestesConfigService refatorado pra multi-tenant**
> Abordagem confirmada: **FATIAR** (F3 enquanto F2 aguarda backup offline `GATEWAY_ENCRYPT_KEY`)
> F2 (schema migration + dual-write Asaas) permanece BLOQUEADA por Luciano operacional

## TL;DR

`BanestesConfigService` criado no M26 (lia `process.env.BANESTES_*` globais)
agora lê **ConfigGateway BANESTES por tenant** do banco com decryption via
`CredentialsEncryptor` (M27). Cache `https.Agent` + OAuth token segregado
por `cooperativaId` (Map). Endpoint admin `POST /gateway-pagamento/banestes/testar-conexao`
remove fallback `'plataforma'` e exige `cooperativaId` real (JWT pra ADMIN
ou query pra SUPER_ADMIN).

**4 commits incrementais** (Etapas A+B → C → D) + commit fechamento.

**25 specs novos verdes** no módulo Banestes (18 config service + 7 controller) +
23 mantidos no adapter = 48/48 no módulo. Suíte completa: 853/864 (mesmos 11
pré-existentes falhando em cooperados/usinas, fora do escopo).

`nest build` limpo. `tsc --noEmit` limpo.

## Commits do dia (4 + fechamento)

| Hash | Mensagem |
|---|---|
| `dc325af` | feat(banestes): F3 Etapas A+B — BanestesConfigService multi-tenant + adapter aceita cooperativaId |
| `9c1b5bc` | feat(banestes): F3 Etapa C — BanestesController exige cooperativaId real (sem fallback) |
| `a71cbb1` | docs(env): F3 Etapa D — deprecation BANESTES_* no .env.example |
| (este) | docs(sessao): fechamento M28 Sub-Sprint Gateways de Pagamento F3 |

## Arquivos modificados/criados

**Novo:**
- `backend/src/gateways-pagamento-config/encryption.module.ts` — módulo dedicado pro `CredentialsEncryptor`, extraído pra quebrar ciclo de dependência

**Modificados (backend/src/gateway-pagamento/banestes/):**
- `banestes-config.service.ts` — refator completo (constructor + carregarConfig + caches segregados)
- `banestes-config.service.spec.ts` — 18 specs novos cobrindo multi-tenant
- `banestes.adapter.ts` — 3 callsites internos passando `cooperativaId`
- `banestes.controller.ts` — remove fallback `'plataforma'`, exige tenant real
- `banestes.controller.spec.ts` — 7 specs cobrindo SUPER_ADMIN/ADMIN/divergente
- `banestes.module.ts` — imports `EncryptionModule`

**Modificados (backend/src/gateways-pagamento-config/):**
- `gateways-pagamento-config.module.ts` — imports `EncryptionModule` em vez de declarar `CredentialsEncryptor` direto

**Modificado (backend/):**
- `.env.example` — 6 vars BANESTES_* marcadas `@deprecated F3`

## Decisão arquitetural: EncryptionModule pra quebrar ciclo

Caminho do ciclo evitado:

```
GatewaysPagamentoConfigModule
  └─→ GatewayPagamentoModule
        └─→ BanestesModule
              └─→ (se importasse direto) GatewaysPagamentoConfigModule  ← CICLO
```

Solução: `EncryptionModule` (dedicado pro `CredentialsEncryptor`) fica
fora desse caminho:

```
EncryptionModule  (provê CredentialsEncryptor)
  ├─→ GatewaysPagamentoConfigModule  (importa)
  └─→ BanestesModule                 (importa)
```

Sem `forwardRef`, sem duplicação de provider. NestJS resolve normalmente.

## Padrão de persistência (mantido do M27)

`ConfigGateway.credenciais` (Json schemaless do schema atual) armazena
shape unificado:

```json
{
  "__enc": {
    "pfxSenha":     "iv:cipher:tag",
    "clientId":     "iv:cipher:tag",
    "clientSecret": "iv:cipher:tag",
    "chavePix":     "iv:cipher:tag"
  },
  "pfxPath": "/opt/certs/cooperebr-sandbox.pfx"
}
```

`__enc` contém os 4 secrets cifrados via `CredentialsEncryptor` (AES-256-GCM
com `GATEWAY_ENCRYPT_KEY`). `pfxPath` em texto puro (metadado não-secreto).

`ConfigGateway.ambiente` (coluna própria SANDBOX/PRODUCAO) determina:
- `baseUrl` derivado: `sandbox` → `api-pix-sandbox.banestes.b.br` / `producao` → `api-pix.banestes.b.br`

Decryption no `BanestesConfigService.carregarConfig`:
- Itera `__enc[campo]` → `encryptor.decrypt(ciphertext)`
- Preserva metadados (`pfxPath`) em texto puro
- Throw `GatewayError CREDENCIAIS_INVALIDAS` claro se:
  - `cooperativaId` vazio
  - ConfigGateway ausente / inativa
  - Decrypt falha (chave rotacionada sem migrar dados)
  - Campos obrigatórios faltando após decrypt

## Cache segregado por tenant

Estado anterior (M26): cache global (1 token + 1 Agent pra app inteira).

Estado novo (F3 M28):
- `httpsAgentCache: Map<cooperativaId, Agent>` — `.pfx` lido do disco apenas uma vez por (cooperativaId + path)
- `tokenCache: Map<cooperativaId, { accessToken, expiresAt }>` — OAuth token TTL `expires_in - 5min`

Métodos novos:
- `invalidarTokenCache(cooperativaId)` — limpa token de 1 tenant
- `invalidarCacheTenant(cooperativaId)` — limpa Agent + token de 1 tenant (útil quando admin edita credenciais via `PATCH /gateways-pagamento/:id`)
- `resetCache()` — limpa todos os tenants

## Operações vivas no `BanestesAdapter` (M28)

Métodos com `cooperativaId` agora propagado pros consumidores do config:

| Método adapter | Chama config |
|---|---|
| `emitirCobranca(cooperadoId, cooperativaId, dados)` | `config.getAccessToken(cooperativaId)` + `config.getHttpClient(cooperativaId)` |
| `testarConexao(cooperativaId)` | idem |
| `traduzirHttpError(status, data, cooperativaId)` (privado) | `config.invalidarTokenCache(cooperativaId)` em 401/403 |
| `criarCustomer` | no-op, sem chamada |
| `cancelarCobranca` | stub (Cenário Completo) |
| `processarWebhook` | stub D-novo-AH (baixa manual via Bloco 8) |

Interface `GatewayPagamentoAdapter` **não** precisou mudar — já tinha
`cooperativaId` em todos os métodos relevantes (M26 já entregou assinatura
correta).

## Endpoints admin

`POST /gateway-pagamento/banestes/testar-conexao` — refatorado:

| Caso | Comportamento |
|---|---|
| ADMIN com JWT.cooperativaId | usa JWT, ignora query se igual |
| ADMIN com query divergente JWT | `BadRequestException` |
| SUPER_ADMIN com query `?cooperativaId=X` | usa query |
| SUPER_ADMIN sem query nem JWT.coop | `BadRequestException` |
| ADMIN sem JWT.coop | `BadRequestException` |

Endpoint alternativo (M27): `POST /gateways-pagamento/:id/testar` também
funciona — esse passa pelo `GatewaysPagamentoConfigService` que delega
pro mesmo adapter via factory.

## Validação

- `npm run build` ✅ EXIT:0
- `npx tsc --noEmit -p tsconfig.build.json` ✅ EXIT:0
- **48/48 specs verdes** no módulo Banestes (18 config + 23 adapter + 7 controller)
- Suíte completa: **853/864** passing. 11 falhas pré-existentes (cooperados/usinas, fora do escopo).

## Constraints respeitadas

- ✅ TDD: specs reescritos antes da implementação do refator
- ✅ Multi-tenant: `cooperativaId` em **TODAS** as chamadas Banestes
- ✅ AsaasAdapter **NÃO** tocado (F2 fará dual-write Asaas)
- ✅ Schema Prisma **NÃO** alterado
- ✅ `GATEWAY_ENCRYPT_KEY` placeholder do M27 cobre os specs (não usa chave real)
- ✅ Sem `force push`, commits pequenos, mensagens em português

## Próximo passo

**F2 PERMANECE BLOQUEADA** por Luciano operacional. Antes de F2 rodar:

1. Gerar chave master real: `openssl rand -base64 32`
2. Configurar `GATEWAY_ENCRYPT_KEY` no `.env` de produção
3. **BACKUP OFFLINE em 2 cópias** (papel num cofre + gerenciador de senhas)
4. Confirmar ao orquestrador
5. Aí F2 arranca (schema migration aditiva + dual-write Asaas, ~3-4h)

Justificativa: risco crítico **R2** catalogado na Fase 1. Sem backup
offline, F2 migration de dados reais é IRRESPONSÁVEL.

Fluxo completo backend Sub-Sprint Gateways de Pagamento após F2 rodar:
- **F5 (3h)** — migration de dados existentes (`AsaasConfig` → `ConfigGateway` ASAAS via dual-write) + smoke E2E sandbox
- **F4 (6-9h)** — frontend tela `/dashboard/configuracoes/gateways-pagamento` (sub-sprint próprio futuro)

## Frentes paralelas disponíveis

Enquanto F2 bloqueado:
- **Sprint Bot Proativo Fase 1 read-only ampla** — mapeia infra de lembrete pré-vencimento + webhook pagamento + escalação inadimplência
- **Cenário Completo Banestes** (~6-8h) — depois Carolina pagar canário: implementa `cancelarCobranca` + `processarWebhook` + `GatewayWebhookLog` + cron alerta `.pfx` D-30
- **PAUSA TOTAL** — esperar Luciano voltar com `GATEWAY_ENCRYPT_KEY` backup

## Frentes operacionais Luciano (acumulado)

- ⚠️ **PRIORITÁRIO:** Gerar `GATEWAY_ENCRYPT_KEY` + backup offline 2 cópias (bloqueia F2)
- Avisar time legado: senha Azure SQL + 5 `.pfx` vazados + senha em comentário + senha em coluna texto puro + webhook sem validação
- Obter `script.sql` do hb06a (Sub-Sprint B ETL)
- Obter `.pfx` sandbox Banestes do portal desenvolvedor
- Decisões regulatórias Sub-Sprint A (Assinafy, segregação tributária)
- Definir regra parcelamento D-novo-AD
- Configurar SMTP/IMAP `noreply@sisgdsolar.com.br`

## Regras aplicadas na sessão

- Decisão 23 (validação prévia): cumprida — releitura focada do `banestes-config.service.ts`, `banestes.adapter.ts`, `banestes.controller.ts` + interface `GatewayPagamentoAdapter` antes do refator
- TDD: specs reescritos antes da implementação em cada etapa
- Multi-tenant (CLAUDE.md): 100% das chamadas Banestes carregam `cooperativaId`
- Não trabalhar em paralelo com Luciano (17/05): execução autorizada explicitamente, sem cruzamento
- Conventional commits em português, pequenos e descritivos

## Frase comandante

Próxima sessão Code abre verificando se Luciano confirmou backup offline
da `GATEWAY_ENCRYPT_KEY`. Se SIM, arranca F2 (schema migration aditiva
`rename credenciais → credenciaisCriptografadas` + add `metadados Json`
+ dry-run obrigatório + dual-write `AsaasService`). Se NÃO, oferece
frentes paralelas (Sprint Bot Proativo Fase 1 / Cenário Completo Banestes /
PAUSA) e cobra Luciano operacionalmente. **Sem backup = sem F2.**
