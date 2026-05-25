# Arquitetura de Gateways de Pagamento

> Sprint 7 — Refatoração multi-gateway (22/04/2026)
> Adapter Banestes Cenário Mínimo adicionado em M26 (26/05/2026).

## Visão geral

O sistema suporta múltiplos gateways de pagamento por parceiro.
Cada parceiro (cooperativa/consórcio/etc) escolhe qual gateway usar.
O dono da plataforma tem gateway separado pra cobrar FaturaSaas.

```
Cobranca.create()
    ↓
GatewayPagamentoService (orquestrador)
    ↓ resolve adapter via ConfigGateway
    ├─ AsaasAdapter     (implementado — Sprint 7)
    ├─ BanestesAdapter  (M26 — PIX-only, Cenário Mínimo)
    ├─ SicoobAdapter    (futuro)
    ├─ BBAdapter        (futuro)
    └─ outros
    ↓
CobrancaGateway (registro unificado)
```

## Arquivos

| Arquivo | Papel |
|---|---|
| `src/gateway-pagamento/interfaces/gateway-pagamento-adapter.interface.ts` | Interface com 5 métodos |
| `src/gateway-pagamento/adapters/asaas.adapter.ts` | Adapter Asaas (delega pro AsaasService) |
| `src/gateway-pagamento/banestes/banestes-config.service.ts` | Banestes — carrega `.pfx` + cache OAuth + mTLS Agent |
| `src/gateway-pagamento/banestes/banestes.adapter.ts` | Banestes — implementa `GatewayPagamentoAdapter` (PIX) |
| `src/gateway-pagamento/banestes/banestes.controller.ts` | Banestes — endpoint admin `POST /gateway-pagamento/banestes/testar-conexao` |
| `src/gateway-pagamento/banestes/banestes.module.ts` | Banestes — module NestJS |
| `src/gateway-pagamento/gateway-pagamento.service.ts` | Orquestrador — resolve adapter por ConfigGateway |
| `src/gateway-pagamento/gateway-pagamento.module.ts` | Module NestJS raiz |
| `src/gateway-pagamento/errors/gateway-error.ts` | Erro padronizado (6 codes) |

## Interface — 5 métodos

```typescript
criarCustomer(cooperadoId, cooperativaId)     → { gatewayCustomerId }
emitirCobranca(cooperadoId, cooperativaId, dados) → ResultadoEmissao
cancelarCobranca(gatewayId, cooperativaId)    → void
processarWebhook(payload, token)              → WebhookResult
testarConexao(cooperativaId)                  → { ok, erro? }
```

## Schema

- `ConfigGateway` — config por parceiro + gateway (@@unique cooperativaId+gateway)
- `ConfigGatewayPlataforma` — config do dono da plataforma
- `CobrancaGateway` — registro unificado com gateway, gatewayId, link, PIX, boleto

## Como adicionar novo gateway

1. Criar `src/gateway-pagamento/adapters/<nome>.adapter.ts` implementando `GatewayPagamentoAdapter`
2. Registrar no `GatewayPagamentoService.resolverAdapter()` (switch case)
3. Adicionar no `gateway-pagamento.module.ts` como provider
4. Parceiro configura via `ConfigGateway` com `gateway = '<NOME>'`

## Exceção documentada

`pix-excedente.service.ts` usa `AsaasService.getApiClient()` direto — API de
transferência PIX é específica do Asaas. Não abstraída por enquanto.

## GatewayError

Erros padronizados com 6 codes: `CREDENCIAIS_INVALIDAS`, `CONEXAO_FALHOU`,
`GATEWAY_INDISPONIVEL`, `COBRANCA_DUPLICADA`, `COOPERADO_INVALIDO`, `DESCONHECIDO`.
Campo `retryable` indica se vale tentar de novo.

---

## Adapter Banestes — M26 (26/05/2026), Cenário Mínimo

### Escopo

PIX-only (igual ao legado SISGDSOLAR). Boleto registrado / CNAB NÃO implementados — fora do escopo do Cenário Mínimo.

| Operação | Status M26 | Observação |
|---|---|---|
| `emitirCobranca` | ✅ implementado | `POST /pix-qrcode-cobranca/v1/cob/` |
| `criarCustomer` | ✅ no-op | Banestes não tem customer model — devedor inline |
| `testarConexao` | ✅ implementado | Smoke: token OAuth + GET listar cobrancas |
| `cancelarCobranca` | 🟡 stub | `NotImplementedException` — Cenário Completo futuro |
| `processarWebhook` | 🟡 stub | `NotImplementedException` — D-novo-AH catalogado |

### Variáveis de ambiente (`.env`)

```
BANESTES_PFX_PATH=/opt/certs/banestes_cooperebr_sandbox.pfx   # path absoluto do .pfx
BANESTES_PFX_SENHA=...                                         # senha do .pfx (REDACTED no banco)
BANESTES_CLIENT_ID=...                                         # OAuth client_id
BANESTES_CLIENT_SECRET=...                                     # OAuth client_secret
BANESTES_AMBIENTE=sandbox                                      # ou "producao"
BANESTES_BASE_URL=                                             # opcional, override sobre derivação automática
BANESTES_TIMEOUT_MS=10000                                      # default 10s
BANESTES_TEMPO_COBRANCA_EXPIRA_SEGUNDOS=3600                   # TTL da cobrança PIX, default 1h
```

### Endpoint do parceiro (config tenant)

`ConfigGateway` com:
- `gateway: 'BANESTES'`
- `ambiente: 'SANDBOX'` ou `'PRODUCAO'`
- `credenciais: { chavePix: '<chave_pix_recebedora_do_parceiro>' }`
- `ativo: true`

### Processo de configuração (operacional Luciano)

1. **Sandbox primeiro:**
   - Obter `.pfx` sandbox do portal Banestes desenvolvedor (`https://desenvolvedores.banestes.com.br/api-portal/pt-br/user`)
   - Copiar `.pfx` pra `/opt/certs/` (path absoluto, permissão `0600`)
   - Configurar `.env` (BANESTES_* sandbox)
   - Reiniciar backend (PM2)
   - `POST /gateway-pagamento/banestes/testar-conexao` autenticado → esperado `{ ok: true }`
2. **Produção (após sandbox validar):**
   - **ROTACIONAR senha do `.pfx`** (não usar a senha vazada do legado)
   - Gerar `.pfx` novo via openssl conforme `docs/Certificado_Banestes.md` (do legado)
   - Atualizar `BANESTES_*` produção
   - Cadastrar webhook URL no painel Banestes (Cenário Completo futuro)
3. **ConfigGateway por tenant:**
   - Inserir registro em `ConfigGateway` com `gateway='BANESTES'` + `credenciais.chavePix` da CoopereBR
   - Marcar `ativo=true`
   - Quando cobrança for emitida pela `GatewayPagamentoService.emitirCobranca`, o factory resolve `banestesAdapter`

### mTLS — estratégia técnica

Node.js `https.Agent({ pfx, passphrase })` nativo. **Não há biblioteca terceiro pra parsing de `.pfx`** — reduz superfície de ataque vs Java legado.

```typescript
const httpsAgent = new Agent({
  pfx: readFileSync(BANESTES_PFX_PATH),
  passphrase: BANESTES_PFX_SENHA,
  minVersion: 'TLSv1.2',
  keepAlive: true,
});
```

Singleton por instância (cache via `BanestesConfigService`) — evita reconstruir SSL a cada chamada (otimização sobre o Java legado).

### OAuth — Client Credentials + Basic Auth

```
POST /oauth/v1/access-token
Authorization: Basic base64(CLIENT_ID:CLIENT_SECRET)
Content-Type: application/x-www-form-urlencoded
Body: grant_type=client_credentials

Response: { access_token, expires_in, ... }
```

Cache em memória com TTL = `expires_in - 5 minutos` (margem de segurança). Refresh automático na próxima chamada após vencimento.

### Riscos catalogados

- **D-novo-AG (P2):** `.pfx` em disco hoje. Migrar pra Azure Key Vault quando Sinergia entrar em produção.
- **D-novo-AH (P2):** webhook Banestes stub `NotImplementedException`. Baixa de pagamento é MANUAL pela equipe via painel admin Bloco 8 (`marcarPago: true`). Implementar webhook na Cenário Completo (~6-8h Code).
- **Renovação `.pfx`:** Banestes leva ~7 dias úteis. Cron de alerta D-30 antes do vencimento ainda não implementado (sub-item Cenário Completo).
- **Sandbox vs Prod URL diferem apenas por sufixo `-sandbox`** — usar `isAmbienteReal()` + `BANESTES_AMBIENTE` explícito pra evitar confusão.
