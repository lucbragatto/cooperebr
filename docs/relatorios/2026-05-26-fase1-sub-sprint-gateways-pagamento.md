# Sub-Sprint Gateways de Pagamento — Fase 1 Read-Only

> Sessão: 26/05/2026 noite (pós-M26 Adapter Banestes Cenário Mínimo)
> Decisão 23 ativa — Fase 1 read-only. Nenhum arquivo editado nesta análise.
> Estimativa Fase 1 esgotada: ~3h. Próxima fase aguarda OK Luciano.

## 0. TL;DR

- A infraestrutura backend já tem 80% do que a tela genérica precisa: model `ConfigGateway` Json schemaless existente, `GatewayPagamentoService` factory funcional, criptografia AES-256-GCM no `AsaasService` (módulo encrypt/decrypt já testado).
- **Há divergência ATIVA de dados:** `AsaasConfig.apiKey` (legado, sufixo `dfe8`) ≠ `ConfigGateway.credenciais.apiKey` (multi-gateway novo, sufixo `2776`). O AsaasAdapter delega pro `AsaasService` que lê de `AsaasConfig`, então `ConfigGateway.ASAAS.credenciais.apiKey` HOJE não é usado pra emitir cobrança Asaas — só `ConfigGateway.gateway/ativo` é consultado pra resolver factory. Migração precisa unificar.
- A tela atual `/dashboard/configuracoes/asaas` salva apenas em `AsaasConfig` (legado), não em `ConfigGateway`. Após refator, tela nova salva direto em `ConfigGateway` e `AsaasConfig` vira reflexo via shim/dual-write OU é descontinuado.
- Encryption recomendada pra AGORA: **(a) Encrypt no app antes de salvar com `crypto` nativo Node + chave master `GATEWAY_ENCRYPT_KEY` no `.env`**, mesmo padrão AES-256-GCM já em uso pro Asaas. Débito futuro: migrar pra Azure Key Vault junto com `.pfx` Banestes (D-novo-AG).
- `.pfx` Banestes: **manter em disco** (path armazenado em `ConfigGateway.credenciais.pfxPath`). Upload pelo painel grava em `/opt/certs/{tenantId}-{ambiente}.pfx` com permissão 0600. Bytes no DB ficam pra Azure Key Vault.
- Estimativa Sub-Sprint completo: **24-34h Code** em 5 fases sequenciais.

## 1. CONFIGGATEWAY ATUAL — schema + uso real

### 1.1 Schema (`backend/prisma/schema.prisma:1352`)

```prisma
model ConfigGateway {
  id            String      @id @default(cuid())
  cooperativaId String
  cooperativa   Cooperativa @relation(fields: [cooperativaId], references: [id])
  gateway       String      // ASAAS | SICOOB | BB | ITAU | MANUAL
  ambiente      String      @default("SANDBOX") // SANDBOX | PRODUCAO
  credenciais   Json        @default("{}")     // schemaless por gateway — comentário diz "criptografado pelo adapter" mas NÃO está
  ativo         Boolean     @default(true)
  webhookToken  String?
  createdAt     DateTime    @default(now())
  updatedAt     DateTime    @updatedAt
  @@unique([cooperativaId, gateway])
  @@map("config_gateways")
}
```

**Características relevantes:**
- 1 ConfigGateway por par (cooperativa, gateway) — `@@unique([cooperativaId, gateway])`. Logo, 1 cooperativa pode ter Asaas + Banestes ativos simultaneamente.
- Comentário linha 1358 diz "criptografado pelo adapter" mas o campo `credenciais` Json hoje está em texto puro no DB (confirmado pelo audit script — `apiKey_suffix '****2776'` sem prefixo IV).
- `webhookToken` é coluna própria (não dentro do Json).
- Cardinalidade já suporta multi-gateway por tenant.

### 1.2 Consumidores hoje (5 ocorrências em código não-spec)

| Arquivo | Linha | Operação | Comentário |
|---|---|---|---|
| `gateway-pagamento.service.ts` | 37, 78 | `findFirst` por `cooperativaId, ativo: true` | Factory `resolverAdapter` — só lê `gateway` |
| `banestes.adapter.ts` | 102 | `findFirst` por `cooperativaId, gateway:'BANESTES', ativo:true` | Lê `credenciais.chavePix` recebedora |
| `cobrancas.service.ts` | 725 | `findFirst` por `cooperativaId, ativo: true` | Gate condicional pra `emitirNoGatewaySeConfigurado` |

Nenhum consumidor lê `credenciais.apiKey`, `clientId`, `secret` etc — Asaas pega tudo do `AsaasConfig`, Banestes pega quase tudo do `.env`.

### 1.3 Dados reais hoje (audit script `auditar-asaasconfig.ts`)

```
=== AsaasConfig (LEGADO) ===
Total: 1
{ cooperativa: 'CoopereBR', ambiente: 'SANDBOX',
  apiKey_len: 390, apiKey_suffix: '****dfe8',  ← CRIPTOGRAFADA AES-256-GCM (390 chars = formato iv:enc:tag)
  webhookToken_len: 44 }

=== ConfigGateway ===
Total: 1
{ cooperativa: 'CoopereBR', gateway: 'ASAAS', ambiente: 'SANDBOX',
  ativo: true, credenciais_keys: ['apiKey'],
  apiKey_suffix: '****2776',  ← TEXTO PURO, e diferente do AsaasConfig.apiKey
  webhookToken_len: 0 }

=== ConfigGatewayPlataforma === Total: 0  ← vazia, modelo nunca foi populado
```

**🚨 Achado crítico:** o `ConfigGateway.credenciais.apiKey` (sufixo `2776`) é **plain text** e **não é a apiKey real do Asaas** (que está criptografada em `AsaasConfig.apiKey`, sufixo `dfe8`). Hoje funciona porque o adapter lê de `AsaasConfig`. Se a refatoração fizer o adapter passar a ler de `ConfigGateway`, **vai quebrar** até a migração unificar os dados.

## 2. INTEGRAÇÃO ASAAS EXISTENTE — fluxo completo

### 2.1 Backend

- **`AsaasService` (`backend/src/asaas/asaas.service.ts`, 462 linhas):**
  - `getEncryptKey()` → SHA-256 de `process.env.ASAAS_ENCRYPT_KEY` (32 bytes); lança erro se ausente
  - `encrypt(text)` → AES-256-GCM com IV 12 bytes random; output `iv:cipher:tag` em hex
  - `decrypt(s)` → fallback gracioso: se string não tem 3 partes, retorna como está (legado plain text); se decrypt falha, retorna como está
  - `salvarConfig(cooperativaId, { apiKey, ambiente, webhookToken })` → upsert em `asaasConfig`, criptografa `apiKey` antes
  - `getApiClient(cooperativaId)` → busca config, decrypt apiKey, devolve `axios.create({ baseURL, headers: access_token })`
  - `processarWebhook(payload, token)` → busca todos `asaasConfig` com webhookToken, compara `timingSafeEqual`, processa evento, emite `pagamento.confirmado`
  - `testarConexao(cooperativaId)` → GET `/customers?limit=1`

- **`AsaasController` (`backend/src/asaas/asaas.controller.ts`):**
  - `POST /asaas/config` (SUPER_ADMIN, ADMIN) — salva apiKey + ambiente + webhookToken
  - `GET /asaas/config` (SUPER_ADMIN, ADMIN) — retorna config com apiKey **mascarada** (`****abcd`)
  - `GET /asaas/testar-conexao` (SUPER_ADMIN, ADMIN)
  - Demais: `/cobrancas`, `/cobrancas/:id/cancelar`, `/cobrancas/:id/status`, `/assinaturas`, `/webhook` (Public)

- **`AsaasModule`:** providers `[AsaasService, PrismaService]`, exports `[AsaasService]`. Importado por `app.module`, `financeiro.module`, `gateway-pagamento.module`.

- **AsaasAdapter (`backend/src/gateway-pagamento/adapters/asaas.adapter.ts`):**
  - Apenas delega pro `AsaasService` + traduz erros pra `GatewayError`.
  - Hoje 100% dependente de `AsaasConfig` (legado), **não** de `ConfigGateway`.

### 2.2 Frontend

- **Tela única `/dashboard/configuracoes/asaas/page.tsx` (235 linhas):**
  - Hook tenant: `COOPEREBR_ID = 'cmn0ho8bx0000uox8wu96u6fd'` HARDCODED no client (comentário diz "futuramente: seletor")
  - Componentes Shadcn: `Card`, `Input`, `Label`, `Button`, `Loader2`
  - Estado: apiKey (input password), ambiente (toggle SANDBOX/PRODUCAO), webhookToken
  - 3 ações: `handleSave` (POST `/asaas/config`), `handleTest` (GET `/asaas/testar-conexao`), `loadConfig` (GET `/asaas/config?cooperativaId=...`)
  - Avisa "Webhook URL: {origin}/asaas/webhook" pra colar no painel Asaas
  - Sem Zod, sem react-hook-form, sem react-query/swr — `useState` puro + try/catch

- **Sidebar (`web/app/dashboard/layout.tsx:158`):** `'/dashboard/configuracoes/asaas' → 'Asaas (Pagamentos)'`, ícone `Settings`.
- **`web/types/index.ts:306` define `AsaasConfig` typeshape** consumido pela página.
- **`web/app/dashboard/cooperados/[id]/asaas-tab.tsx`** existe — aba dentro do detalhe do cooperado listando suas cobranças Asaas (`GET /asaas/cobrancas/:cooperadoId`). **Independente da tela de config.** Não bloqueia refator (continua chamando Asaas REST direto pra listar histórico).
- **`web/app/dashboard/parceiros/configurar/steps/Step3Configuracoes.tsx:468`** lista `{ key: 'asaas', titulo: 'Integração Asaas (Pagamentos)', visivel: true }` no wizard de configuração de parceiros. **Refator de UI deve atualizar pra "Gateways de Pagamento"**.

## 3. BANESTES (M26 recém-criado)

### 3.1 Estado de configuração hoje

`BanestesConfigService` lê 7 env vars em runtime:

| Env var | Tipo | Sensível? |
|---|---|---|
| `BANESTES_PFX_PATH` | string (path absoluto) | Não-secret |
| `BANESTES_PFX_SENHA` | string | **SECRET** |
| `BANESTES_CLIENT_ID` | string | **SECRET** (OAuth client_id) |
| `BANESTES_CLIENT_SECRET` | string | **SECRET** |
| `BANESTES_AMBIENTE` | 'sandbox' \| 'producao' | Não-secret |
| `BANESTES_BASE_URL` | string opcional (override) | Não-secret |
| `BANESTES_TIMEOUT_MS` | number (default 10000) | Não-secret |
| `BANESTES_TEMPO_COBRANCA_EXPIRA_SEGUNDOS` | number (default 3600) | Não-secret |

`BanestesAdapter.emitirCobranca` JÁ LÊ `ConfigGateway.credenciais.chavePix` (linha 102) — chave PIX recebedora do tenant. Outros 7 valores virão do `.env` até o refator.

### 3.2 `.pfx` em disco vs DB — prós e contras

**Opção A — `.pfx` em disco, path armazenado em DB (RECOMENDADO):**
- ✅ Continua usando `https.Agent({ pfx: readFileSync(path) })` que é nativo Node — sem reescrita.
- ✅ Permissão 0600 em FS protege contra acesso indevido.
- ✅ Backup: `.pfx` raramente muda (~6-12 meses). Snapshot do `/opt/certs/` é trivial.
- ⚠️ Upload via UI precisa endpoint multipart + escrita atômica + validação de senha antes de gravar.
- ⚠️ Migrar pra container/Cloud Run exige volume persistente (ou Azure Key Vault — D-novo-AG).

**Opção B — bytes do `.pfx` no DB (campo `Bytes` Postgres BYTEA):**
- ✅ Multi-tenant trivial sem mexer em FS.
- ✅ Deploy stateless (sem volumes).
- ❌ `.pfx` tem 2-8 KB criptografado por DPAPI — coluna BYTEA ok, mas restoring na hora gera escrita temporária pra `https.Agent` (que aceita Buffer direto — verificável, sem fs).
- ⚠️ Sem encryption at-rest no DB, `.pfx` cru fica acessível pra qualquer leitor de banco. **Tem que criptografar bytes antes do `.create()`**.
- ❌ Backup do .pfx anda junto com backup do DB — mistura risco operacional.

**Verificação rápida (read-only):** Node `https.Agent({ pfx: Buffer })` aceita buffer direto, então Opção B é tecnicamente viável sem temp file. Mas adiciona complexidade.

**Recomendação:** **Opção A** (path em disco). Decisão de produto pra confirmar.

## 4. ENCRYPTION AT REST — 3 opções analisadas

### Opção (a) — Encrypt no app antes de salvar (RECOMENDADO)

- Implementação: módulo `crypto/credentials-encryptor.service.ts` reusando o pattern do `AsaasService.encrypt/decrypt` (AES-256-GCM, IV 12 bytes, tag 16 bytes, formato `iv:cipher:tag` em hex).
- Chave master: `GATEWAY_ENCRYPT_KEY` (novo env var, 32 bytes hex via `openssl rand -hex 32`). Pode aproveitar a `ASAAS_ENCRYPT_KEY` existente OU separar — recomenda separar (`GATEWAY_ENCRYPT_KEY`) e migrar Asaas pra ela depois.
- Trade-off: app sabe descriptografar — se o app for comprometido, secrets caem. Mas **DB sozinho não tem como descriptografar.**
- Custo: 0 lib externa, ~50 linhas de service, ~80 linhas de specs.
- Recomenda: **aplicar imediatamente.**

### Opção (b) — Postgres pgcrypto

- `pgcrypto` extension habilitada, `pgp_sym_encrypt(text, key)` no INSERT/UPDATE.
- Chave master vai no payload SQL — visível em `pg_stat_statements` se logs ativos. **Risco operacional alto.**
- Útil em cenários onde o app é multi-tenant lambda e cada tenant tem chave própria gerenciada externamente. Não é nosso caso.
- Custo: setup migration + alterar queries do Prisma pra usar raw. Quebra padrão Prisma puro.
- Recomenda: **descartar pra hoje.** Avaliar só se decidir multi-app com cada um tendo apenas SELECT no DB.

### Opção (c) — Azure Key Vault

- Cada credential vira um secret no Key Vault (`tenants/{id}/asaas-apikey`, `tenants/{id}/banestes-pfx`, etc).
- App busca via `@azure/keyvault-secrets` SDK + Managed Identity (sem secret no `.env`).
- Trade-off: lead time pra Sinergia provisionar Key Vault + IAM. Cost: ~$0.03 por 10k transações + cobra storage de secrets.
- Recomenda: **D-novo-AI a catalogar — destino futuro quando Sinergia entrar.** Hoje a equipe não tem infra Azure provisionada.

### Decisão (a sugerir ao Luciano)

Aplicar **(a)** AGORA com `GATEWAY_ENCRYPT_KEY` separada. Catalogar débito **D-novo-AI (P3): migrar pra Azure Key Vault quando Sinergia entrar em produção**, junto com D-novo-AG (`.pfx`).

## 5. PROPOSTA DE SCHEMA ConfigGateway REDESENHADO

### 5.1 Schema com migração aditiva

```prisma
model ConfigGateway {
  id              String      @id @default(cuid())
  cooperativaId   String
  cooperativa     Cooperativa @relation(fields: [cooperativaId], references: [id])
  gateway         String      // ASAAS | BANESTES | (futuros: SICOOB, BB, ITAU)
  ambiente        String      @default("SANDBOX") // SANDBOX | PRODUCAO
  // credenciais SECRETAS criptografadas com GATEWAY_ENCRYPT_KEY (AES-256-GCM)
  // Formato: { [field]: 'iv:cipher:tag' } — cada secret independente
  credenciaisCriptografadas Json @default("{}")
  // metadados NÃO-secretos em texto puro pra exibir UI rapidamente
  metadados       Json        @default("{}") // { apiKeyMasked, ambiente, baseUrl, pfxPath, ultimoTesteEm, ultimoTesteOk, ... }
  ativo           Boolean     @default(true)
  webhookToken    String?     // ⚠️ também criptografar (mover pra credenciaisCriptografadas no futuro)
  createdAt       DateTime    @default(now())
  updatedAt       DateTime    @updatedAt
  @@unique([cooperativaId, gateway])
  @@map("config_gateways")
}
```

**Mudanças aditivas (sem perder dado):**
- Renomear `credenciais` → `credenciaisCriptografadas` (rename Prisma + migration `ALTER TABLE config_gateways RENAME COLUMN credenciais TO credenciais_criptografadas`)
- Adicionar `metadados Json @default("{}")` — texto puro pra UI
- Manter `webhookToken` separado por agora (compat com webhook do Asaas que valida via `timingSafeEqual`)

**Por que não 1 colunão criptografado:**
- UI precisa exibir `****abcd` da apiKey sem decrypt no servidor. Mascaramento fica em `metadados.apiKeyMasked` (gravado quando salva config).
- `ultimoTesteOk: bool` + `ultimoTesteEm: Date` ajuda admin a saber "essa config foi testada hoje" sem rodar smoke a toa.
- Separação **secret vs metadado** é o padrão usado pelo Vault/Doppler/etc.

### 5.2 Schema do conteúdo de `credenciaisCriptografadas` por tipo

```typescript
// Cada field é encrypted independente (envelope opaco "iv:cipher:tag")

// ASAAS
type AsaasCredentials = {
  apiKey: string;          // ENCRYPTED
};
type AsaasMetadados = {
  apiKeyMasked: string;    // "****abcd"
  ambienteUrl: string;     // "https://sandbox.asaas.com/api/v3"
  ultimoTesteEm?: string;  // ISO
  ultimoTesteOk?: boolean;
};

// BANESTES
type BanestesCredentials = {
  pfxSenha: string;        // ENCRYPTED
  clientId: string;        // ENCRYPTED
  clientSecret: string;    // ENCRYPTED
  chavePix: string;        // ENCRYPTED (pode ser CPF/CNPJ — dado sensível)
};
type BanestesMetadados = {
  pfxPath: string;         // "/opt/certs/{tenant}-{ambiente}.pfx" — não secret
  pfxFingerprint?: string; // SHA-256 do .pfx pra detectar troca
  ambienteUrl: string;
  ultimoTesteEm?: string;
  ultimoTesteOk?: boolean;
};
```

### 5.3 Migração dos dados existentes (CLAUDE.md regra de segurança)

**Pré-validação (read-only) antes do dry-run:**

```sql
-- 1 registro em config_gateways (CoopereBR ASAAS sandbox)
SELECT id, cooperativa_id, gateway, ambiente, credenciais, ativo, webhook_token
FROM config_gateways;

-- 1 registro em asaas_configs (CoopereBR sandbox, apiKey CRIPTOGRAFADA dfe8)
SELECT id, cooperativa_id, ambiente, length(api_key), webhook_token
FROM asaas_configs;
```

**Estratégia de migração (em script dry-run + aprovação Luciano):**

1. Adicionar `credenciaisCriptografadas` + `metadados` (NOT NULL com default `{}`) — campos novos não destrutivos.
2. Pra cada `ConfigGateway` com `gateway='ASAAS'`:
   - Buscar `AsaasConfig` correspondente (mesmo `cooperativaId`).
   - Decriptar `AsaasConfig.apiKey` com `ASAAS_ENCRYPT_KEY` (gracioso — fallback `decrypt` já lida com plain text).
   - Encriptar com `GATEWAY_ENCRYPT_KEY` e gravar em `ConfigGateway.credenciaisCriptografadas.apiKey`.
   - Gravar `metadados.apiKeyMasked = '****' + key.slice(-4)`.
   - **Sobrescrever** o `credenciais` antigo (plain `apiKey` divergente) — esse dado era inconsistente.
3. Pra cada `ConfigGateway` com `gateway='BANESTES'` (hoje 0 registros — Sub-Sprint cria os primeiros do zero, sem dado pra migrar).
4. **Manter `AsaasConfig` (legado) intacto por 1-2 sprints** como redundância — `AsaasService.getApiClient` continua lendo de lá até o ASA-CFG-OFF (consigo coordenar com sprint próprio quando confiança ≥ 1 mês de uso da nova tela).
5. Deletar `AsaasConfig` apenas quando smoke `testar-conexao` em produção confirmar nova fonte funciona ≥ 30 dias sem incidente.

**Risco mapeado:** durante a coexistência (`AsaasConfig` legado + `ConfigGateway` novo), **edição via tela nova precisa fazer DUAL-WRITE** pros 2 modelos até o cutoff. Caso contrário, salvar na tela nova não muda a config que o adapter Asaas usa.

## 6. GATEWAY REGISTRY (backend)

### 6.1 Sugestão de estrutura

```
backend/src/gateways-pagamento-config/    ← módulo NOVO (irmão de gateway-pagamento)
  gateways-config.module.ts
  gateways-config.controller.ts
  gateways-config.service.ts
  gateway-registry.ts                     ← lista declarativa
  credentials-encryptor.service.ts        ← encrypt/decrypt AES-256-GCM
  dto/
    salvar-config-gateway.dto.ts          ← class-validator + Zod
    testar-conexao.dto.ts
  schemas/                                ← schemas Zod por tipo (compartilhados com frontend? só backend?)
    asaas.schema.ts
    banestes.schema.ts
  __tests__/
    gateway-registry.spec.ts
    credentials-encryptor.spec.ts
    gateways-config.service.spec.ts
    gateways-config.controller.spec.ts
```

**Por que módulo separado de `gateway-pagamento/`:**
- `gateway-pagamento/` = motor de emissão (factory + adapters). Não muda.
- `gateways-pagamento-config/` = administração das credenciais (CRUD).
- Separação respeita o padrão NestJS de módulos por responsabilidade.

### 6.2 `gateway-registry.ts` (declarativo)

```typescript
import { z } from 'zod';

export type GatewayTipo = 'ASAAS' | 'BANESTES';

export interface GatewayDescriptor {
  tipo: GatewayTipo;
  nome: string;                      // "Asaas (Pagamentos)" — exibido na UI
  descricao: string;                 // descrição curta pra modal
  iconUrl?: string;
  ambientes: Array<'SANDBOX' | 'PRODUCAO'>;
  // Schema Zod pra validação (frontend reusa via JSON Schema export)
  schemaCredenciais: z.ZodTypeAny;   // valida o body { apiKey, ... }
  schemaMetadados?: z.ZodTypeAny;
  // Campos que devem ser encriptados antes de persistir
  camposSecret: string[];            // ex: ['apiKey'] | ['pfxSenha','clientId','clientSecret','chavePix']
  // Operações suportadas pelo adapter (info pra UI desabilitar botões)
  suporta: {
    boleto: boolean;
    pix: boolean;
    cartao: boolean;
    cancelarCobranca: boolean;
    webhook: boolean;
  };
  // Quais env vars (se houver) ainda precisam estar setadas — usado pra alerta "este gateway requer .pfx em disco"
  envObrigatorias?: string[];
}

export const GATEWAY_REGISTRY: Record<GatewayTipo, GatewayDescriptor> = {
  ASAAS: {
    tipo: 'ASAAS',
    nome: 'Asaas',
    descricao: 'Boleto, PIX e cartão de crédito via Asaas',
    ambientes: ['SANDBOX', 'PRODUCAO'],
    schemaCredenciais: z.object({ apiKey: z.string().min(20) }),
    schemaMetadados: z.object({ webhookToken: z.string().optional() }).optional(),
    camposSecret: ['apiKey'],
    suporta: { boleto: true, pix: true, cartao: true, cancelarCobranca: true, webhook: true },
  },
  BANESTES: {
    tipo: 'BANESTES',
    nome: 'Banestes',
    descricao: 'PIX cobrança imediata via Banestes (mTLS + OAuth2)',
    ambientes: ['SANDBOX', 'PRODUCAO'],
    schemaCredenciais: z.object({
      pfxSenha: z.string().min(1),
      clientId: z.string().min(1),
      clientSecret: z.string().min(1),
      chavePix: z.string().min(11),
    }),
    schemaMetadados: z.object({ pfxPath: z.string().startsWith('/opt/certs/') }),
    camposSecret: ['pfxSenha', 'clientId', 'clientSecret', 'chavePix'],
    suporta: { boleto: false, pix: true, cartao: false, cancelarCobranca: false, webhook: false },
  },
};
```

### 6.3 Adapter Asaas → ler de `ConfigGateway` (refator)

`AsaasAdapter.criarCustomer/emitirCobranca/etc` HOJE delegam pro `AsaasService.{criarOuBuscarCustomer/emitirCobranca/...}` que internamente lê `asaasConfig`. Pra refator:

**Opção 1 (menor blast):** modificar `AsaasService.getConfig(cooperativaId)` pra primeiro tentar `ConfigGateway.ASAAS`, fallback pra `AsaasConfig` legado. Decrypt usa `GATEWAY_ENCRYPT_KEY` (novo) ou `ASAAS_ENCRYPT_KEY` (legado fallback) conforme origem. Manter por 30 dias.

**Opção 2 (corte cirúrgico):** após dual-write de 30 dias, deletar `AsaasConfig` model + remover fallback. Sprint próprio "ASA-CFG-OFF".

### 6.4 Adapter Banestes → migrar de `.env` pra `ConfigGateway`

`BanestesConfigService.getConfig()` hoje lê de `process.env`. Pra refator:

1. Aceitar `cooperativaId` como parâmetro (assinatura quebra — preciso atualizar `BanestesAdapter`).
2. Em vez de `process.env.BANESTES_PFX_PATH`, busca `ConfigGateway.metadados.pfxPath`.
3. Em vez de `process.env.BANESTES_PFX_SENHA`, busca `ConfigGateway.credenciaisCriptografadas.pfxSenha` e decripta.
4. Cache do `https.Agent` muda de **singleton global** pra **map por `cooperativaId`** (`Map<string, Agent>`).
5. Cache do OAuth token também vira `Map<cooperativaId, { token, expiresAt }>`.

**Pré-requisito operacional:** upload do `.pfx` via UI já tem que existir antes do refator. Sequência: (a) UI sem `.pfx` upload — Banestes continua via .env por 1 sprint → (b) UI com `.pfx` upload + multi-tenant → (c) refator BanestesConfigService quebra dependência do .env.

## 7. UI/UX — TELA NOVA `/dashboard/configuracoes/gateways-pagamento`

### 7.1 Estrutura de arquivos sugerida

```
web/app/dashboard/configuracoes/gateways-pagamento/
  page.tsx                              ← lista de gateways configurados + botão "+ Adicionar"
  _components/
    GatewayCard.tsx                     ← card de cada gateway configurado
    AdicionarGatewayDialog.tsx          ← modal step 1 (escolher tipo)
    ConfigGatewayDialog.tsx             ← modal step 2 (form dinâmico)
    DynamicCredentialsForm.tsx          ← renderiza form baseado em schema Zod
    TestarConexaoButton.tsx             ← isolado pra reuso
  _hooks/
    useGatewaysConfig.ts                ← SWR/react-query (a definir — projeto usa só fetch hoje)
  _lib/
    gateway-registry-client.ts          ← mirror leve do registry backend (JSON via API)
```

### 7.2 Fluxo do usuário

**Página lista:**

```
┌──────────────────────────────────────────────────────────────┐
│ Gateways de Pagamento                                        │
│ Configure os gateways que sua cooperativa usará pra cobrar.  │
│                                                              │
│ ┌────────────────────────┐  ┌────────────────────────┐      │
│ │ 🟢 Asaas               │  │ 🟢 Banestes            │      │
│ │ Sandbox · OK ontem     │  │ Produção · OK há 2h    │      │
│ │ ****dfe8               │  │ /opt/certs/...sb.pfx   │      │
│ │ [Editar] [Testar] [✕]  │  │ [Editar] [Testar] [✕]  │      │
│ └────────────────────────┘  └────────────────────────┘      │
│                                                              │
│ [+ Adicionar gateway]                                        │
└──────────────────────────────────────────────────────────────┘
```

**Modal "Adicionar":**

Step 1 — escolher tipo:

```
┌──────────────────────────────────┐
│ Adicionar novo gateway     [✕]   │
│                                  │
│ ┌─────────────┐  ┌────────────┐  │
│ │ Asaas       │  │ Banestes   │  │
│ │ Boleto+PIX  │  │ PIX (mTLS) │  │
│ └─────────────┘  └────────────┘  │
│                                  │
│             [Cancelar] [Próximo] │
└──────────────────────────────────┘
```

Step 2 — form dinâmico (baseado em `schemaCredenciais` do tipo):

- Para **Asaas**: input apiKey (password) + select ambiente + input webhookToken (opcional)
- Para **Banestes**: input password pfxSenha + clientId + clientSecret + chavePix + upload `.pfx` (multipart `/gateways-pagamento/:id/pfx-upload`) + select ambiente

**Modal "Editar":** mesmo form, valores secretos NUNCA pré-preenchidos (segue padrão Asaas atual — placeholder "Key configurada (insira nova para alterar)"). Metadados (apiKeyMasked, ambiente, ultimoTesteOk) ficam visíveis acima do form como info.

### 7.3 Outros pontos UI

- **Sidebar** (`web/app/dashboard/layout.tsx:158`):
  - **Antes:** `{ href: '/dashboard/configuracoes/asaas', label: 'Asaas (Pagamentos)', icon: Settings }`
  - **Depois:** `{ href: '/dashboard/configuracoes/gateways-pagamento', label: 'Gateways de Pagamento', icon: Settings }`

- **Wizard parceiros configurar Step3 (`web/app/dashboard/parceiros/configurar/steps/Step3Configuracoes.tsx:468`):**
  - **Antes:** `{ key: 'asaas', titulo: 'Integração Asaas (Pagamentos)', visivel: true }`
  - **Depois:** `{ key: 'gateways-pagamento', titulo: 'Gateways de Pagamento', visivel: true }`

- **Redirect rota antiga:** `web/app/dashboard/configuracoes/asaas/page.tsx` vira:
  ```tsx
  'use client';
  import { redirect } from 'next/navigation';
  export default function RedirectAsaas() {
    redirect('/dashboard/configuracoes/gateways-pagamento');
  }
  ```
  Mantém compat com bookmarks/Google.

- **Reuso de componentes Shadcn:** `Dialog`, `Card`, `Input`, `Label`, `Button`, `Select` (native dentro do Dialog — padrão `solucao_select_nativo_dentro_dialog_19_05.md`), `Badge` (status), `Alert` (perigo produção).

- **Hint contextual (regra `regra_help_automatico_paginas_19_05.md`):** banner azul no topo da tela explicando "O que é um gateway?" + link pra docs.

## 8. ENDPOINTS REST NOVOS

```
GET    /gateways-pagamento/suportados                    ← lista de tipos + schema Zod cada
GET    /gateways-pagamento                                ← lista de gateways configurados do tenant
GET    /gateways-pagamento/:id                            ← detalhe (metadados, NÃO retorna secrets)
POST   /gateways-pagamento                                ← cria (body { tipoGateway, ambiente, credenciais, metadados })
PATCH  /gateways-pagamento/:id                            ← atualiza
DELETE /gateways-pagamento/:id                            ← desativa (soft delete via ativo=false) ou hard delete
POST   /gateways-pagamento/:id/testar                     ← smoke conexão
POST   /gateways-pagamento/:id/pfx-upload                 ← multipart, só pra BANESTES
```

**Comportamento:**

- Auth JWT obrigatório, `@Roles(SUPER_ADMIN, ADMIN)`, `@AuditLog` em todos os mutations.
- Multi-tenant: `cooperativaId` vem do JWT (req.user); SUPER_ADMIN pode passar via query/body pra atuar como tenant específico (padrão já em uso no AsaasController).
- Validação por DTO + `gatewayRegistry[tipo].schemaCredenciais.parse(credenciais)` — falha 422.
- POST/PATCH: criptografar `camposSecret` ANTES do `prisma.configGateway.upsert`. Mascarar (`****abcd`) em `metadados.apiKeyMasked` no mesmo ato.
- GET (lista/detalhe): NUNCA retornar `credenciaisCriptografadas`. Retornar apenas `metadados` + `gateway` + `ambiente` + `ativo` + `webhookToken: 'definido' | 'vazio'`.
- POST `/testar`: descripta credenciais em memória, chama `GatewayPagamentoService.testarConexao(cooperativaId)` (que via factory chama `adapter.testarConexao`). Grava `metadados.ultimoTesteEm` + `metadados.ultimoTesteOk` após.
- DELETE: 1ª fase ativo=false (soft); 2ª fase oferecer hard delete só se não tem `CobrancaGateway` com gateway+ativo > 0.
- `/pfx-upload`: aceita multipart com 1 arquivo `<= 50KB`, valida senha em memória chamando `https.Agent({ pfx, passphrase })` (se lança = senha errada). Grava em `/opt/certs/{tenantId}-{ambiente}.pfx` com `fs.writeFile(path, buf, { mode: 0o600 })`. Atualiza `metadados.pfxPath` + `metadados.pfxFingerprint`.

## 9. TABELA EXISTE × CRIAR — por camada

### 9.1 Schema Prisma

| Item | Existe? | Ação |
|---|---|---|
| Model `ConfigGateway` | ✅ | Refator: rename `credenciais` → `credenciaisCriptografadas` + adicionar `metadados Json` |
| Model `AsaasConfig` | ✅ | Manter por 1-2 sprints (coexistência dual-write); deletar em sprint próprio "ASA-CFG-OFF" |
| Model `ConfigGatewayPlataforma` | ✅ vazio | Manter por enquanto (sprint próprio quando FaturaSaas migrar pra gateway) |
| Model `CobrancaGateway` | ✅ | Sem mudança |

### 9.2 Backend NestJS

| Item | Existe? | Ação |
|---|---|---|
| `gateway-pagamento.service.ts` factory | ✅ | Sem mudança (já lê `ConfigGateway.gateway`) |
| `AsaasService` encrypt/decrypt | ✅ | Manter; potencialmente extrair `CredentialsEncryptor` reutilizável |
| `AsaasAdapter` | ✅ | Pequeno refator: aceitar fallback `ConfigGateway` → `AsaasConfig` (1 sprint coexistência) |
| `AsaasService.getConfig` | ✅ | Adicionar fallback `ConfigGateway` → `AsaasConfig` |
| `BanestesConfigService` | ✅ (lê .env) | Refator: aceitar `cooperativaId`, ler de `ConfigGateway`, cache por tenant |
| `BanestesAdapter` | ✅ | Pequena mudança: passar `cooperativaId` pro `config.getHttpClient(cooperativaId)` etc |
| **NOVO** módulo `gateways-pagamento-config/` | ❌ | Criar: controller + service + DTOs + registry + encryptor + specs |
| **NOVO** `gateway-registry.ts` | ❌ | Criar |
| **NOVO** `credentials-encryptor.service.ts` | ❌ | Criar (refatorar `AsaasService.encrypt/decrypt` pra reuso) |
| **NOVO** endpoint `/gateways-pagamento/*` | ❌ | 8 rotas listadas em §8 |
| **NOVO** endpoint `/gateways-pagamento/:id/pfx-upload` | ❌ | Multipart com validação senha |
| Env var `GATEWAY_ENCRYPT_KEY` | ❌ | Adicionar no `.env.example` (64 chars hex via `openssl rand -hex 32`) |

### 9.3 Frontend Next.js

| Item | Existe? | Ação |
|---|---|---|
| Tela `/configuracoes/asaas` | ✅ | Vira REDIRECT pra `/configuracoes/gateways-pagamento` |
| Sidebar entry "Asaas (Pagamentos)" | ✅ | Renomear pra "Gateways de Pagamento" + atualizar href |
| Wizard parceiros Step3 referência | ✅ | Renomear título |
| Aba Asaas dentro cooperado (`asaas-tab.tsx`) | ✅ | Sem mudança (lista cobranças, não config) |
| Type `AsaasConfig` em `types/index.ts` | ✅ | Manter; criar `ConfigGatewayDescriptor` + `ConfigGatewayDto` novos |
| **NOVO** `/configuracoes/gateways-pagamento/page.tsx` | ❌ | Criar |
| **NOVO** componentes `GatewayCard`, `AdicionarGatewayDialog`, `ConfigGatewayDialog`, `DynamicCredentialsForm` | ❌ | Criar |

## 10. ESTIMATIVA POR FASE (Code)

| Fase | Escopo | Estimativa |
|---|---|---|
| **F1** | Backend: módulo `gateways-pagamento-config/` + `credentials-encryptor` + `gateway-registry` + 8 endpoints + specs (>=15 specs) + auditoria/migration script dry-run de dados existentes | **8-12h** |
| **F2** | Schema migration aditiva (rename + add `metadados`) + dual-write em `AsaasService.salvarConfig` + dual-read em `AsaasService.getConfig` | **3-4h** |
| **F3** | Refator `BanestesConfigService` pra ler de `ConfigGateway` + cache por `cooperativaId` + ajuste assinaturas `BanestesAdapter` + specs novos | **4-6h** |
| **F4** | Frontend tela nova + componentes Shadcn + redirect rota antiga + sidebar/wizard rename | **6-9h** |
| **F5** | Migration de dados (script com dry-run + aprovação Luciano) + smoke E2E sandbox Asaas + sandbox Banestes (depende `.pfx` Luciano) | **3-3h** |
| **TOTAL** | | **24-34h** |

**Observação:** F5 só destrava quando Luciano tiver `.pfx` sandbox Banestes em mãos. F1-F4 podem ir em paralelo ao Luciano providenciar.

## 11. DECISÕES DE PRODUTO PRO LUCIANO

1. **Encryption — aprovar opção (a) `GATEWAY_ENCRYPT_KEY` no .env + AES-256-GCM no app?**
   - SIM (recomendo). Catalogar D-novo-AI (P3) pra Azure Key Vault no futuro com D-novo-AG.
   - Alternativa: descartar opção (b) pgcrypto e (c) Key Vault hoje.

2. **`.pfx` Banestes — manter em disco ou bytes no DB?**
   - Disco (recomendo). Path em `metadados.pfxPath`; senha encrypted em `credenciaisCriptografadas.pfxSenha`.
   - Upload via UI multipart → `/opt/certs/{tenantId}-{ambiente}.pfx` (0600).

3. **Destino do `AsaasConfig` legado?**
   - Manter coexistência 30+ dias (dual-write) e deletar em sprint próprio "ASA-CFG-OFF" pós-confirmação.
   - Risco zero — não força corte cirúrgico.

4. **Cardinalidade `ConfigGateway`?**
   - Manter `@@unique([cooperativaId, gateway])` (1 por tenant por gateway tipo).
   - Cooperativa NÃO pode ter Asaas sandbox + Asaas produção simultâneo no mesmo tenant.
   - Trade-off: pra alternar sandbox/produção precisa UPDATE `ambiente`. Aceitável (raro switch em produção).
   - Alternativa avaliada e descartada: `@@unique([cooperativaId, gateway, ambiente])` → exigiria refator factory pra escolher `ambiente` (hoje ele só pega `findFirst ativo: true`).

5. **`ConfigGatewayPlataforma` (FaturaSaas dono da plataforma) — refator junto?**
   - **Adiar** pra sprint próprio. Modelo está vazio (FaturaSaas hoje é cobrança manual). Não bloqueia.

6. **Sicoob / BB / Itaú no registry?**
   - **Não exibir** até o adapter existir. Padrão registry permite adicionar sem mexer em outras camadas.

7. **Webhook Banestes — incluir no sprint?**
   - **NÃO.** Já está catalogado D-novo-AH (Cenário Completo). Esse sub-sprint foca CRUD de credenciais.

## 12. RISCOS MAPEADOS

| ID | Risco | Severidade | Mitigação |
|---|---|---|---|
| R1 | Dual-write divergente (`AsaasConfig` ↔ `ConfigGateway.ASAAS`) | Alta | F2 implementa `salvarConfig` que grava nos dois; nunca grava só num |
| R2 | `GATEWAY_ENCRYPT_KEY` perdida → dados encriptados ilegíveis | Catastrófica | Backup da chave em local físico + 2 admins têm cópia; documentar processo recovery |
| R3 | Cooperado existente tem `AsaasConfig` com `apiKey` diferente do `ConfigGateway.credenciais.apiKey` | Confirmada | Migration F5 sobrescreve `ConfigGateway.credenciaisCriptografadas` com decrypt de `AsaasConfig` (fonte legada confiável) |
| R4 | Upload `.pfx` aceito mas senha errada — gateway quebra em runtime | Média | Endpoint `/pfx-upload` valida senha em memória ANTES de gravar (chama `new Agent({ pfx, passphrase })`); 422 se inválida |
| R5 | Banestes mTLS singleton global vira map por tenant — possível memory leak em onboarding massa | Baixa | `Map` com TTL ou LRU cap 20 entries (Banestes raro ter 20+ tenants ativos no curto prazo) |
| R6 | Migração apaga `AsaasConfig` antes de smoke confirmar | Alta | NUNCA deletar em F5; sprint próprio futuro com 30 dias de coexistência confirmado em logs |
| R7 | Webhook Asaas (`AsaasService.processarWebhook`) usa `webhookToken` que ficou em `AsaasConfig`, não migrou | Média | F2 dual-write inclui `webhookToken`; F3 atualiza `processarWebhook` pra também buscar em `ConfigGateway.webhookToken` |
| R8 | Decisão 23: este relatório não fez verificações no banco com `db push` ou migration — só leitura | Baixa | Migration F2 vai ser preparada em sprint próprio com dry-run + aprovação Luciano (CLAUDE.md regra 6 segurança) |
| R9 | Frontend não tem react-query/SWR/zustand — só `useState` (página Asaas atual usa fetch direto) | Baixa | Manter padrão atual (`useState` + `useEffect`) por consistência; introduzir SWR seria refator paralelo |

## 13. CONFIRMAÇÕES NECESSÁRIAS LUCIANO

1. ✅ Aprovar Opção (a) encryption AGORA?
2. ✅ Aprovar `.pfx` em disco?
3. ✅ Aprovar coexistência `AsaasConfig` + `ConfigGateway` por 30 dias?
4. ✅ Aprovar `@@unique([cooperativaId, gateway])` (1 ambiente por gateway por tenant)?
5. ✅ Confirmar nome "Gateways de Pagamento" (já vinha decidido) e adiar `ConfigGatewayPlataforma`?
6. ✅ Confirmar que Sicoob/BB ficam fora do registry até adapter existir?
7. ✅ Aprovar estimativa 24-34h em 5 fases?
8. ✅ Quando Luciano quer iniciar F1 (backend)? F5 depende do `.pfx` Banestes — F1-F4 podem rolar antes.

## 14. CHECKLIST PRÉ-FASE 2

Antes de tocar código:

- [ ] Luciano OK nas 8 decisões de produto (§13)
- [ ] Gerar `GATEWAY_ENCRYPT_KEY` (64 hex chars) e gravar em `.env` local + 2 cópias offline
- [ ] Dry-run script `scripts/auditar-asaasconfig.ts` rodado novamente pré-migração pra capturar estado de referência
- [ ] Backup snapshot Supabase Postgres (`pg_dump`) antes de F2 migration
- [ ] Confirmar `AsaasModule.exports` pode adicionar `AsaasService` se ainda não exporta (já exporta — checado)

---

**Fim Fase 1.** Aguardando OK Luciano nas decisões §13 pra iniciar Fase 2 (F1 backend).
