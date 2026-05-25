# M29 — Sub-Sprint Gateways de Pagamento Fatia F2 Expandida (Schema Migration + Dual-Write Asaas + Rotação ASAAS_ENCRYPT_KEY)

> Sessão: 26/05/2026 noite (continuação pós-M28 F3 + inventário de secrets)
> Marco: **M29 — F2 schema migration aditiva + dual-write Asaas + rotação `ASAAS_ENCRYPT_KEY`**
> Decisão Luciano (26/05): juntar D-novo-AJ.1 (rotação `ASAAS_ENCRYPT_KEY` fraca) na mesma janela da F2 — eficiência operacional + minimizar restarts PM2 em produção.

## TL;DR

Migração aditiva da arquitetura de gateways pra `ConfigGateway` com **dual-write coexistência 30 dias** + **rotação simultânea da `ASAAS_ENCRYPT_KEY`** (que tinha entropia equivalente a senha curta — 31 chars textuais `_key`) por chave AES-256 base64 real.

**7 commits incrementais** (Etapas A→G):
- Etapa A: backup pg_dump 220KB / 347 objetos (sem commit — local)
- Etapa B: schema migration aditiva (`commit 0db2673`)
- Etapa C: dual-write Asaas + 7 specs (`commit f1aa803`)
- Etapa D: script idempotente de migração + apply após OK Luciano (`commit ff64c5c`)
- Etapa E: rotação `ASAAS_ENCRYPT_KEY` (sem commit — banco + `.env` apenas, scripts temp removidos)
- Etapa F: smoke E2E pós-rotação (sem commit — só verificação)
- Etapa G: docs + fechamento (este)

**Suíte completa:** 860/871 (mesmas 11 pré-existentes em cooperados/usinas). +7 dual-write specs todos verdes. Sem regressão.

**2 pontos de pausa obrigatórios respeitados** (OK Luciano explícito antes de cada):
1. Apply da migration de dados (Etapa D)
2. Restart PM2 pós-rotação (Etapa E item 8)

## Commits do dia (5 + fechamento)

| Hash | Mensagem |
|---|---|
| `0db2673` | feat(schema): F2 Etapa B — migration aditiva ConfigGateway credenciaisCriptografadas + metadados |
| `f1aa803` | feat(asaas): F2 Etapa C — dual-write AsaasConfig + ConfigGateway (transacao atomica) + 7 specs |
| `ff64c5c` | feat(asaas): F2 Etapa D — script idempotente de migracao AsaasConfig → ConfigGateway |
| (este) | docs(sessao): fechamento M29 F2 expandida + rotacao ASAAS_ENCRYPT_KEY (D-novo-AJ.1 ✅) |

## Etapa A — Backup do banco

Backup pg_dump completo via Docker (Supabase atualizou pra PostgreSQL 17.6, precisei pull de `postgres:17-alpine`).

- Path: `/c/Users/Luciano/backups/sisgd-pre-f2-20260525-163223.sql.gz`
- Tamanho: 220 KB gzipped
- Conteúdo: 347 objetos SQL (CREATE TABLE / CREATE INDEX / COPY)
- Conectado via: `DIRECT_URL` (não pgbouncer)
- `.gitignore`: `backups/` na linha 153 + backup mora fora do repo

## Etapa B — Schema Migration Aditiva

`ConfigGateway` ganhou 2 colunas JSONB:
- `credenciaisCriptografadas`: somente `__enc{...}` com cipher por campo secret
- `metadados`: campos não-secretos em texto puro (`apiKeyMasked`, `webhookTokenDefinido`, etc)

Coluna legada `credenciais` MANTIDA + marcada `@deprecated F2` no `schema.prisma`. Drop planejado pra sprint próprio futuro pós-30 dias de coexistência.

Migration MANUAL (escrita direta) — `prisma migrate dev` não funciona porque o baseline existente tem BOM UTF-8 que corrompe o shadow DB. Aplicada via `prisma migrate deploy` (sem shadow). SQL puramente aditivo:

```sql
ALTER TABLE "config_gateways"
    ADD COLUMN IF NOT EXISTS "credenciaisCriptografadas" JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE "config_gateways"
    ADD COLUMN IF NOT EXISTS "metadados" JSONB NOT NULL DEFAULT '{}'::jsonb;
```

`NOT NULL` com default sólido → operação non-blocking no PG17 (sem rewrite).

## Etapa C — Dual-Write Asaas

`AsaasService.salvarConfig` agora grava nos DOIS caminhos na MESMA transação atômica:

1. **`AsaasConfig`** (LEGADO, intacto) — `AsaasService.getApiClient` continua lendo daqui
2. **`ConfigGateway`** (NOVO) — espelho com `credenciaisCriptografadas` (`CredentialsEncryptor` / `GATEWAY_ENCRYPT_KEY` chave forte) + `metadados` (`apiKeyMasked`, `webhookTokenDefinido`, `atualizadoEm`, `origem='dual-write-asaas-salvarConfig'`)

Encryption com CHAVES DIFERENTES:
- Legado: SHA-256(`ASAAS_ENCRYPT_KEY`) → 32 bytes
- Novo: `GATEWAY_ENCRYPT_KEY` direto como 32 bytes base64

`AsaasModule` importa `EncryptionModule` (mesmo padrão F3 do `BanestesModule`).

7/7 specs novos verdes:
- grava nos 2 lados na mesma transacao
- encrypta com chaves diferentes nos 2 caminhos
- apiKeyMasked correto nos metadados
- webhookTokenDefinido true/false
- rollback ambos quando ConfigGateway upsert falha
- multi-tenant key composto cooperativaId_gateway

## Etapa D — Migration de Dados Existentes

Script idempotente `backend/scripts/migrate-asaas-to-config-gateway.ts` preenche o gap dos registros pré-existentes em `AsaasConfig` que não passaram pelo dual-write da Etapa C.

DRY-RUN apresentado antes do apply:
- 1 registro (CoopereBR ASAAS sandbox)
- Cipher legado sufixo `****dfe8` → decrypted real `****MzY5` → re-encrypted forte
- ConfigGateway ASAAS já existia desde 22/04 com `apiKeyMasked=(vazio)` — operação foi UPDATE (não CREATE)

**⏸️ Pausa obrigatória respeitada:** OK explícito do Luciano antes do apply.

APPLY:
- 1 UPDATE no banco
- cipher novo 266 chars formato `iv:cipher:tag` base64
- `metadados.apiKeyMasked=****MzY5`
- `metadados.webhookTokenDefinido=true`
- `metadados.origem='migrate-asaas-to-config-gateway-script'`
- `metadados.migradoEm` + `atualizadoEm` carimbados ISO

## Etapa E — Rotação `ASAAS_ENCRYPT_KEY`

**Mais delicada da sessão.** Chave anterior tinha 31 chars terminando em `_key` — placeholder textual com entropia equivalente a senha curta (passava por `SHA-256(key)` no `AsaasService.getEncryptKey` então funcionalmente rodava, mas a entropia real era a do texto curto).

Script temporário `__rotate-asaas-encrypt-key.ts` (removido pós-uso) executou sequência atômica:

1. Leu `ASAAS_ENCRYPT_KEY` ANTIGA do `.env` em variável temp
2. Gerou nova via `openssl rand -base64 32` (44 chars base64 validados)
3. Decrypt + encrypt de todos `AsaasConfig.apiKey` em memória
4. Transação Prisma: UPDATE em batch (1 registro)
5. Atualizou `.env` (substituiu linha `ASAAS_ENCRYPT_KEY=...`)
6. Rollback do banco caso atualização do `.env` falhasse (não precisou — tudo OK na primeira)
7. Variáveis temporárias limpas pós-uso

Antes do restart PM2:
- Banco: cipher novo `****f7ce` (390 chars, formato hex legado preservado pra compat com `AsaasService.decrypt`)
- `.env`: chave nova base64 sufixo `****S9s=`
- apiKey REAL preservada: `****MzY5` (valor Asaas não muda — só a chave que protege)

**⏸️ Pausa obrigatória respeitada:** chave nova apresentada UMA VEZ no terminal pro Luciano. Aguardou 2 papeis offline em locais DIFERENTES dos papeis da `GATEWAY_ENCRYPT_KEY` (defesa em profundidade). Confirmação `"asaas chave rotacionada, 2 papeis ok"` recebida.

Pós-OK:
- Restart PM2 → backend online pid 40264
- Logs limpos (sem erro de decryption no startup)

## Etapa F — Smoke E2E

Script temporário `__smoke-f2-pos-rotacao.ts` (removido pós-uso) validou consistência interna:

1. **AsaasConfig legado:** `AsaasService.decrypt` com chave nova → apiKey real `****MzY5` ✅
2. **ConfigGateway ASAAS espelho:** `credenciaisCriptografadas.apiKey` 266 chars formato `iv:cipher:tag` base64 + decrypt via `CredentialsEncryptor` → mesmo `****MzY5` ✅
3. **ConfigGateway BANESTES:** nenhum registro ainda (esperado — Luciano configurará quando obter `.pfx` sandbox)

`npm test`: 860/871 passing. 11 falhas pré-existentes em cooperados/usinas (fora do escopo). +7 dual-write specs todos verdes vs M28.

## Etapa G — Documentação + Fechamento

- `docs/seguranca/inventario-secrets.md`: `ASAAS_ENCRYPT_KEY` movida de 🟡 pra 🟢 (rotacionada, 2 papeis confirmados, próxima revisão 2027-05-26)
- `docs/debitos-tecnicos.md`: **D-novo-AJ.1 ✅ RESOLVIDO** com timeline da rotação
- Doc-sessão M29 (este arquivo)
- `docs/CONTROLE-EXECUCAO.md`: frase de retomada atualizada (Decisão 24 local único)

## Validação

- `npm run build` ✅ EXIT:0
- `npx tsc --noEmit -p tsconfig.build.json` ✅ EXIT:0
- **Suíte completa:** 860/871 passing (mesmas 11 pré-existentes)
- **Smoke E2E F2:** consistência interna OK (3/3 verificações)
- **PM2:** backend online sem erros decryption pós-rotação

## Constraints respeitadas

- ✅ TDD: specs antes da implementação (dual-write spec antes de salvarConfig)
- ✅ Multi-tenant: `cooperativaId` em 100% das queries
- ✅ Dry-run OBRIGATÓRIO antes de UPDATE em dados reais (Etapa D)
- ✅ AGUARDAR OK Luciano EXPLÍCITO antes de:
  - Apply da migration de dados (Etapa D)
  - Restart PM2 pós-rotação (Etapa E)
- ✅ Backup do banco ANTES de qualquer mexida (Etapa A)
- ✅ Sem commit de `.env`, `.sql.gz`, scripts com secrets
- ✅ Valores reais de chaves NÃO incluídos em docs, commits, logs visíveis
- ✅ Variáveis temporárias com chaves: nomes claros (`chaveAntigaSentinelTransient`) + limpeza imediata após uso + scripts temporários removidos
- ✅ Sem `force push`, commits pequenos em português
- ✅ Política `regra-secrets-nao-memorizar.md` respeitada (exceção controlada da apresentação UMA VEZ documentada)

## Próximo passo — F5 (drop coluna legado + smoke E2E final)

Em **sessão futura** após 30 dias de coexistência validada:

- `npx prisma migrate dev --name drop_credenciais_legado` (DROP COLUMN `credenciais`)
- Atualizar `AsaasService.getApiClient` pra ler de `ConfigGateway.credenciaisCriptografadas` (via `CredentialsEncryptor`)
- Smoke E2E final em ambiente sandbox
- Sprint próprio futuro

Depois: **F4 frontend** (`/dashboard/configuracoes/gateways-pagamento` tela genérica, ~6-9h, sub-sprint próprio).

## Frentes operacionais Luciano (acumulado)

- ✅ `GATEWAY_ENCRYPT_KEY` (M28) — 2 papeis offline confirmados
- ✅ `ASAAS_ENCRYPT_KEY` (M29) — 2 papeis offline em locais DIFERENTES dos da `GATEWAY_ENCRYPT_KEY`
- ⏳ Instalar gerenciador de senhas (D-novo-AK) — 1-2 semanas
- ⏳ Avisar time legado: senha Azure SQL + 5 `.pfx` vazados + senha em comentário + webhook sem validação
- ⏳ Obter `script.sql` do hb06a (Sub-Sprint B ETL)
- ⏳ Obter `.pfx` sandbox Banestes do portal desenvolvedor
- ⏳ Decisões regulatórias Sub-Sprint A (Assinafy, segregação tributária)
- ⏳ Definir regra parcelamento D-novo-AD
- ⏳ Configurar SMTP/IMAP `noreply@sisgdsolar.com.br`

## Regras aplicadas na sessão

- CLAUDE.md regra 6 segurança: backup banco + dry-run + auditoria prévia + pausa pra OK
- Decisão 23: validação prévia rigorosa em cada etapa
- TDD: specs primeiro
- Multi-tenant: 100% queries
- Conventional commits em português, incrementais
- Política `regra-secrets-nao-memorizar.md`: nenhum valor real em docs/commits
- Não trabalhar em paralelo (17/05): execução supervisionada com OKs explícitos
- Decisão 24: frase de retomada em local único

## Frase comandante

Próxima sessão Code (semanas futuras, sem urgência) abre validando:
1. 30 dias de coexistência `AsaasConfig` ↔ `ConfigGateway` sem regressão
2. Logs estáveis (sem erro de decryption ou dual-write desincronizado)
3. Confirmação operacional Luciano sobre F5 (drop coluna `credenciais`)

Frentes paralelas disponíveis enquanto F5 aguarda os 30 dias:
- Sprint Bot Proativo Fase 1 read-only ampla
- Cenário Completo Banestes (~6-8h) — depois Carolina pagar canário
- D-novo-AK (instalar gerenciador de senhas, 1-2h Luciano)
- PAUSA TOTAL

**M29 = ponto final do trabalho técnico backend Sub-Sprint Gateways de Pagamento por enquanto.** F4 (frontend tela genérica) e F5 (drop coluna) ficam pra sessões futuras.
