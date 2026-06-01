# Fase 1 read-only — Análise código Banestes do legado SISGDSOLAR e proposta de adapter novo

> 26/05/2026 — Frente paralela enquanto `script.sql` do hb06a não chega pro Sub-Sprint B ETL.
> Decisão 23 ativa. Investigação read-only do `SISGDSOLAR-main.zip` (leitura seletiva via `System.IO.Compression`). Nada extraído pro disco, nada commitado de senha/cert.
> ⚠️ Todas credenciais/senhas/keys redactadas com `[REDACTED]`.

## TL;DR (6 linhas)

O legado SISGDSOLAR tem integração Banestes **só pra PIX** (não boleto registrado nem CNAB) — 7 classes Java cobrindo OAuth2 + mTLS + emissão de cobrança + listagem + consulta de pagamentos + webhook (já desenhado pra rota `/webhook/cooperativa`). Toda comunicação usa Java 11 `HttpClient` nativo com `SSLContext` TLSv1.2 carregando o `.pfx` via `KeyStore PKCS12`. Existe também adapter Inter (mesmo padrão Factory, conjunto de classes paralelo) — Banestes e Inter coexistem como **estratégias do Factory `EmissorCobrancaPixCooperadoFactory`**, exatamente o padrão de adapter que o nosso `gateway-pagamento` já tem hoje pro Asaas. A nossa interface `GatewayPagamentoAdapter` (5 métodos: `criarCustomer`, `emitirCobranca`, `cancelarCobranca`, `processarWebhook`, `testarConexao`) **encaixa direto** — só precisa ajustar `criarCustomer` (Banestes não tem customer model — cobrança recebe devedor inline). Estimativa: **18-28h Code** pra adapter PIX completo + webhook + specs. **Quick win:** método `emitirCobranca` PIX isolado em **6-8h** (sem webhook, sem listagem, suficiente pra canário Carolina pagar via cópia-e-cola).

## 🚨 ALERTAS DE SEGURANÇA (PRIORITÁRIOS)

### 1. Senha do `.pfx` em comentário no código fonte

`SISGDSOLAR/.../pagamentos/banestes/Certificado_Banestes.java` linha 18 tem **comentário inline com a senha real do `.pfx`** (formato `Senha padrão [REDACTED]`). Qualquer pessoa que clone o repo do legado lê a senha do certificado de produção CoopereBR. **Risco crítico:** se vazar com o `.pfx` (que também está no zip!), terceiros emitem cobranças no nome da CoopereBR.

**Recomendação imediata pro Luciano:**
1. Avisar time legado pra rotacionar senha do `.pfx` (regenerar via openssl)
2. Remover comentário (commit dedicado)
3. Mover senha pra variável de ambiente / Azure Key Vault
4. Considerar invalidar `.pfx` atual (gerar novo) — o atual pode ter sido visto por quem teve acesso ao repo

### 2. Certificados `.pfx` empacotados no `.jar` em `src/main/java/com/sisgdsolar/spring/certificados/`

5 arquivos `.pfx` reais (sandbox + produção CoopereBR + sandbox + produção Sisgdsolar + produção Sinergia Ambiental) e 1 `.jks` (webhook sandbox) commitados no repo. **Distribuídos com cada build .war** que vai pra Azure App Service. Risco médio (build é privado mas distribuído por team).

**Recomendação pro novo sistema:**
- `.pfx` NUNCA dentro do `dist/` Nest. Path absoluto em variável de ambiente, lido em runtime.
- Considerar Azure Key Vault / AWS Secrets Manager pra gerenciar `.pfx` em produção.

### 3. Tabela `tbl_certificado_banestes` guarda senha em texto puro

Campo `senhacertificado String` na entidade `Tbl_certificado_banestes`. **Senha do `.pfx` guardada no banco SQL Server em coluna texto puro** — qualquer SELECT do banco lê senha. No nosso modelo Prisma novo, considerar criptografia AES-256 (chave em env) ou usar Azure Key Vault diretamente.

### 4. `Webhook_Cooperado_Banestes.java` **NÃO valida autenticidade** do payload

Controller `@RequestMapping("/webhook/cooperativa")` com `@CrossOrigin("*")` recebe POST sem **nenhuma validação** de origem (sem assinatura HMAC, sem IP whitelist, sem token compartilhado). Qualquer um pode forjar POST e marcar parcelas como pagas. **Brecha grave.**

**Recomendação no adapter novo:**
- Validar IP de origem (Banestes publica faixa? Confirmar com banco)
- Adicionar `webhookToken` compartilhado (criar campo em `ConfigGateway`) — mesmo modelo do Asaas
- Buscar nas docs Banestes se há HMAC signature header (PIX padrão BACEN tem mecanismo SCIP — investigar)

---

## Frente 1 — Arquitetura atual no legado

### Inventário de classes (24 arquivos Java + 2 SPs + 1 doc)

**Organização principal:** `com/sisgdsolar/spring/pagamentos/`

```
banestes/
├── Certificado_Banestes.java                  ← carrega .pfx, monta SSLContext
├── cooperativa/                                ← cobranças do cooperado
│   ├── Gerar_Token_Cooperado_Banestes.java    ← OAuth2 (gera access_token)
│   ├── EmitirCobrancaPix_Cooperado_Banestes.java  (16.8 KB)
│   ├── ConsultarPagamentoPix_Cooperado_Banestes.java
│   ├── ListarCobrancaPix_Cooperado_Banestes.java
│   ├── ListarCobrancaPixEspecificoCooperado_Banestes.java
│   └── webhook/
│       └── Webhook_Cooperado_Banestes.java    ← controller POST /webhook/cooperativa
├── sisgdsolar/                                 ← cobranças da própria CoopereBR/SISGD pra parceiros (FaturaSaas)
│   ├── Gerar_Token_Sisgdsolar_Banestes.java
│   ├── EmitirCobrancaPix_Sisgdsolar_Banestes.java (13.1 KB)
│   ├── ListarCobrancaPix_Sisgdsolar_Banestes.java
│   ├── ListarCobrancaPixEspecifico_Sisgdsolar_Banestes.java
│   └── webhook/Webhook_Sisgdsolar_Banestes.java
└── model/                                      ← DTOs de request/response
    ├── cobranca/
    │   ├── CobrancaRequestModel_Banestes.java
    │   ├── CobrancaResponseModel_Banestes.java
    │   ├── CalendarioCobrancaModel_Banestes.java
    │   ├── DevedorCobrancaModel_Banestes.java
    │   ├── ValorCobrancaModel_Banestes.java
    │   ├── LocCobrancaModel_Banestes.java
    │   ├── PixCobrancaModel_Banestes.java
    │   ├── JurosMoraModel_Banestes.java
    │   ├── MultaModel_Banestes.java
    │   └── InfoAdicionaisCobrancaModel_Banestes.java
    ├── ResponseTokenModel_Banestes.java
    ├── WebhookResponse_Banestes.java + WebhookPixResponse_Banestes.java
    ├── ItensCertificadoDTO_Banestes.java     ← envelope SSLContext + params
    └── BeneficiarioFinalModel_Banestes.java

inter/                                          ← adapter Inter paralelo
├── cooperativa/...
└── sisgdsolar/...

factory/
├── EmissorCobrancaPixCooperadoFactory.java    ← seleciona Banestes ou Inter
└── EmissorCobrancaPixSisgdsolarFactory.java

interfaces/
├── EmissorCobrancaPixCooperado.java           ← contrato comum
├── EmissorCobrancaPixSisgdsolar.java
├── ConsultarPagamentoPixCooperado.java
└── ListarCobrancaPixEspecificoCooperado.java
```

**Observação fundamental:** o legado já tem padrão Factory pra escolher entre Banestes vs Inter. Nosso `gateway-pagamento` segue mesmo padrão (Asaas hoje, Banestes/Sicoob/BB no futuro).

### Bibliotecas Java usadas

| Função | Lib | Versão | Equivalente Node/TS |
|---|---|---|---|
| HTTP cliente | `java.net.http.HttpClient` (nativo Java 11) | builtin | `node:https` nativo OU `axios` / `node-fetch` |
| JSON | `org.json.JSONObject` (legado) + Jackson `ObjectMapper` (DTOs) | 20160810 / Jackson via Spring | nativo `JSON.parse` / `JSON.stringify` |
| mTLS / .pfx | `java.security.KeyStore` + `KeyManagerFactory` + `SSLContext` | builtin | `node:https` aceita `pfx` direto em opts |
| Spring HTTP recebimento webhook | `@RestController` + `@RequestMapping` | Spring 4.3 | NestJS `@Controller` + `@Post` |
| Persistência | Hibernate + JPA | 5.4.2 | Prisma |

### Configuração — vem do banco

- Tabela `tbl_certificado_banestes` (campos: `id`, `autorizacao`, `senhacertificado`, `nomecertificado`, `expira`, `observacao`, `banco`, `chave`)
- Vinculada via `Tbl_sistema_compensacao.tbl_certificado_banestes` (n para 1)
- `nomecertificado` é prefixo do arquivo (ex: `cooperebr` → busca `certificado_banestes_cooperebr_<ambiente>.pfx`)
- `senhacertificado` é a senha pra abrir o `.pfx`
- `autorizacao` é o `client_id:client_secret` em base64 (Basic Auth pro OAuth)
- `chave` é a chave PIX do recebedor
- `VariaveisGlobais.AMBIENTE_CERTIFICADO` = `"sandbox"` ou `""` (controla sufixo URL + nome do `.pfx`)
- `VariaveisGlobais.URL_VER_PAGAMENTOS` = URL base (vista em `ConsultarPagamentoPix`)
- `VariaveisGlobais.TEMPO_BOLETO_EXPIRA` = TTL em segundos da cobrança PIX

---

## Frente 2 — Certificado `.pfx` — pipeline completo

### Como o legado carrega

```java
File file = ResourceUtils.getFile("classpath:com/sisgdsolar/spring/certificados/"
    + nomecertificado + ".pfx");
KeyStore clientKeyStore = KeyStore.getInstance("PKCS12");
char[] pwdChars = senhaCertificado.toCharArray();
clientKeyStore.load(new FileInputStream(file), pwdChars);

KeyManagerFactory keyMgrFactory = KeyManagerFactory.getInstance(KeyManagerFactory.getDefaultAlgorithm());
keyMgrFactory.init(clientKeyStore, pwdChars);

SSLContext sslCtx = SSLContext.getInstance("TLSv1.2");
sslCtx.init(keyMgrFactory.getKeyManagers(), null, null);
```

**Limitações do legado:**
- `.pfx` é classpath resource — empacotado no `.war`. Atualizar = redeploy.
- Senha em campo de banco texto puro
- SSLContext criado fresh a CADA chamada (overhead — caching seria melhor)

### Tabela `tbl_certificado_banestes`

```sql
CREATE TABLE tbl_certificado_banestes (
  id INT PRIMARY KEY IDENTITY,
  autorizacao TEXT,             -- "client_id:client_secret" em base64 (Basic Auth OAuth)
  senhacertificado VARCHAR(255), -- senha do .pfx (texto puro — RISCO)
  nomecertificado VARCHAR(255),  -- "cooperebr" / "sisgdsolar" / "sinergiaambiental"
  expira DATE,                   -- data de validade do .pfx
  observacao TEXT,
  banco VARCHAR(50),             -- "Banestes"
  chave VARCHAR(255)             -- chave PIX recebedor (CPF/CNPJ/email/random)
);
```

### Processo de renovação (`Certificado_Banestes.md`)

1. Banestes desenvolvedor portal: renovar validade (`https://desenvolvedores.banestes.com.br/api-portal/pt-br/user`)
2. Receber 2 arquivos: `REQUEST_CERTIFICADO.crt` + `PRIVATE_KEY.key`
3. Converter pra `.pfx`:
   ```bash
   openssl pkcs12 -export -in REQUEST_CERTIFICADO.crt -inkey PRIVATE_KEY.key -out certificadogerado.pfx
   ```
4. Renomear pro padrão `certificado_banestes_<cooperativa>_<ambiente>.pfx`
5. Atualizar tabela `tbl_certificado_banestes` (data `expira`)
6. Restartar aplicação

**Lead time típico:** ~7 dias úteis pra Banestes processar (conforme catalogado no orquestrador 25/05).

**Última renovação documentada:** 22/01/2026.

---

## Frente 3 — Operações Banestes implementadas

### Tabela operação × endpoint

| Operação | Verbo HTTP | URL Banestes | Auth | Body |
|---|---|---|---|---|
| **Gerar OAuth token** | POST | `https://api-pix[-sandbox].banestes.b.br/oauth/v1/access-token` | Basic `<base64 client_id:secret>` + mTLS | `grant_type=client_credentials` (form-urlencoded) |
| **Criar cobrança PIX** | POST | `https://api-pix[-sandbox].banestes.b.br/pix-qrcode-cobranca/v1/cob/` | Bearer `<token>` + mTLS | JSON (`CobrancaRequestModel`) |
| **Atualizar cobrança PIX (mesmo txid)** | PUT | `https://api-pix[-sandbox].banestes.b.br/pix-qrcode-cobranca/v1/cob/{txid}` | Bearer + mTLS | JSON (`CobrancaRequestModel`) |
| **Listar cobranças** | GET | `https://api-pix[-sandbox].banestes.b.br/pix-qrcode-cobranca/v1/cob/?...` | Bearer + mTLS | — (params query) |
| **Listar pix recebidos** | GET | `VariaveisGlobais.URL_VER_PAGAMENTOS?inicio=&fim=&cpf=&txid=` | Bearer + mTLS | — |
| **Listar cobrança específica** | GET | `https://api-pix[-sandbox].banestes.b.br/pix-qrcode-cobranca/v1/cob/{txid}` | Bearer + mTLS | — |

### Body da cobrança PIX (formato canônico Banestes / PIX BACEN)

```json
{
  "chave": "<chave_pix_recebedor>",
  "solicitacaoPagador": "CoopereBR - Venc: 25/05/2026",
  "calendario": { "expiracao": <TEMPO_BOLETO_EXPIRA_seconds> },
  "valor": {
    "original": "100.00",
    "modalidadeAlteracao": 0
  },
  "devedor": {
    "nome": "Carolina Cravo",
    "cpf": "12345678900"     // OU "cnpj" pra PJ
  },
  "infoAdicionais": [
    { "nome": "Parcela: 1", "valor": "Titular: Carolina Cravo" },
    { "nome": "Cod. Parcela: ", "valor": "<idParcela>" }
  ]
}
```

**Observações importantes:**
- `modalidadeAlteracao: 0` = cobrança valor fixo (cooperado não pode escolher quanto pagar)
- `infoAdicionais` é onde o legado coloca metadados pra reconciliação (no webhook usa `Cod. Parcela:` pra mapear de volta)
- `solicitacaoPagador` é o texto curto que aparece pro pagador no app do banco

### Resposta da cobrança

```json
{
  "txid": "<id_unico_banestes>",
  "status": "ATIVA",         // ou CONCLUIDA depois do pagamento
  "pixCopiaECola": "<string_pra_copy_paste>",
  "chave": "<chave_pix>",
  "calendario": { "expiracao": ... },
  "devedor": {...},
  "valor": {...},
  "loc": {...},
  "location": "<url_qrcode_imagem>",
  "infoAdicionais": [...]
}
```

### Fluxo de dados (legado `EmitirCobrancaPix_Cooperado_Banestes`)

```
1. Validações pré (parcela tem vencimento, não tá paga, não desativada)
2. Verifica se já existe pagamento em tbl_pagamentos pra essa parcela
   → se sim, extrai txid existente (PUT em vez de POST)
3. Carrega Certificado_Banestes (.pfx + senha do banco)
4. Gera token OAuth (cacheado em HttpSession por cooperativa)
5. Monta CobrancaRequestModel:
   - Calcula juros/multa via CalcularJurosMultaUseCase
   - Devedor: nome + cpf/cnpj do tbl_usuario
   - InfoAdicionais: "Parcela: N", "Cod. Parcela: <id>"
6. HTTP POST/PUT com mTLS
7. Se 200/201:
   - Persiste em tbl_pagamentos (txid + pixCopiaECola + url)
   - Atualiza HttpSession com sistema_compensacao recarregado
8. Se erro:
   - Grava em tbl_erros
```

**Reuso de cobranças (otimização inteligente):** se já existe pagamento gerado pra parcela, faz PUT no mesmo txid em vez de criar novo. Evita poluição de cobranças no painel Banestes.

---

## Frente 4 — Webhook / recebimento de pagamento

### Controller legado

```java
@RestController
@RequestMapping("/webhook/cooperativa")
@CrossOrigin("*")
public class Webhook_Cooperado_Banestes {
  @RequestMapping(method = RequestMethod.POST)
  public void handleWebhook(@RequestBody String payload, ...) {
    // ...
  }
}
```

**URL configurada no Banestes (cadastro de webhook):** `https://portal.sisgdsolar.com.br/webhook/cooperativa`

### Payload esperado

```json
{
  "pix": [
    {
      "endToEndId": "<id_BACEN>",
      "txid": "<txid_da_cobranca>",
      "chave": "<chave_pix_do_recebedor>",
      "valor": "100.00",
      "horario": "2026-05-26T15:30:00Z"
    }
  ]
}
```

### Lógica do legado (resumida)

```
1. Lê payload JSON, deserializa pra WebhookResponse_Banestes
2. Pra cada pix recebido:
   a. Busca tbl_certificado_banestes WHERE chave = pix.chave → identifica qual tenant
   b. Busca tbl_pagamentos WHERE url contém pix.txid
   c. Re-consulta cobrança no Banestes (GET /cob/{txid}) pra confirmar status CONCLUIDA
   d. Se CONCLUIDA:
      - tbl_pagamentos.parcela_paga = true, dataPagamento = now
      - tbl_parcela.parcela_paga = true (cascata)
      - Loga em tbl_log_webhook
3. Se exceção: salva tbl_erros + envia email ao admin (Leonardo + Henrique CC)
```

### Tabela `tbl_log_webhook`

```sql
CREATE TABLE tbl_log_webhook (
  id INT PRIMARY KEY IDENTITY,
  data_recebimento DATETIME,
  payload TEXT,           -- raw JSON pra auditoria
  id_parcela INT          -- nullable; nullable se erro/ignorado
);
```

**Funções:** auditoria + replay manual em caso de bug + investigação de pagamentos não conciliados.

### Stored Procedures relacionadas

**`atualizar_quitacoes`** (rodada periodicamente pelo Quartz):
- Busca beneficiários com plano "Inativa" + parcelas vencidas
- Se todas parcelas pagas → muda `tbl_plano_assinatura_benef.status` pra "Ativa + Confirmado"
- **Lógica humana:** "se cooperado tava bloqueado por inadimplência e pagou tudo, libera o plano"

**`atualizar_quitacoes_parcela_unica`** (rodada periodicamente):
- Trata "parcela pai acumulativa" (quando há boleto único agrupando várias parcelas)
- Se a parcela-pai foi paga, marca todas as parcelas-filhas como pagas

**Equivalência no SISGD novo:**
- `atualizar_quitacoes` = listener `pagamento.confirmado` que reativa cooperado + cron `cobrancas.job.ts:99` que marca vencidas
- `atualizar_quitacoes_parcela_unica` = não temos parcelamento agrupador hoje (D-novo-AD futuro)

---

## Frente 5 — Configurações e segredos necessários

### Variáveis de ambiente / `.env` do novo adapter

```
# === Banestes — config por tenant (em ConfigGateway do banco) ===
BANESTES_<TENANT>_CLIENT_ID=<base64_redacted>
BANESTES_<TENANT>_CLIENT_SECRET=<base64_redacted>  # ou ja combinado em authorization_basic
BANESTES_<TENANT>_AUTHORIZATION_BASIC=<base64(client_id:secret)>
BANESTES_<TENANT>_CHAVE_PIX=<email_ou_cpf_ou_random>
BANESTES_<TENANT>_PFX_PATH=/opt/certs/banestes_<tenant>_prod.pfx   # path ABSOLUTO
BANESTES_<TENANT>_PFX_SENHA=<senha_redacted>                       # idealmente Azure Key Vault
BANESTES_<TENANT>_AMBIENTE=production                              # ou sandbox

# === Banestes — config global ===
BANESTES_TIMEOUT_MS=10000                                          # 10s no legado
BANESTES_TEMPO_COBRANCA_EXPIRA_SEGUNDOS=3600                       # = VariaveisGlobais.TEMPO_BOLETO_EXPIRA
BANESTES_WEBHOOK_TOKEN_SHARED=<random>                             # token compartilhado pra validar webhook entrada
BANESTES_WEBHOOK_URL_BASE=https://app.cooperebr.com.br/gateway-pagamento/banestes/webhook
```

**Decisão:** prefiro guardar credenciais por tenant no schema `ConfigGateway` Prisma (já existe), não em env vars (multi-tenant). Apenas timeouts/TTLs globais ficam em env.

### Lead times reais

- **Cert .pfx renovação:** ~7 dias úteis (Banestes processar Generate Scripts)
- **Cadastro webhook URL no painel Banestes:** ~1 dia útil
- **Mudança chave PIX:** instantâneo
- **Sandbox vs Prod:** Banestes tem ambos disponíveis no portal (`api-pix-sandbox.banestes.b.br` vs `api-pix.banestes.b.br`)

### URLs canônicas confirmadas

```
PROD:    https://api-pix.banestes.b.br/...
SANDBOX: https://api-pix-sandbox.banestes.b.br/...

Endpoints:
  POST /oauth/v1/access-token              → token OAuth
  POST /pix-qrcode-cobranca/v1/cob/        → criar cobrança
  PUT  /pix-qrcode-cobranca/v1/cob/{txid}  → atualizar cobrança
  GET  /pix-qrcode-cobranca/v1/cob/{txid}  → consultar 1
  GET  /pix-qrcode-cobranca/v1/cob/        → listar (com paginação)

Portal: https://desenvolvedores.banestes.com.br/api-portal/pt-br/user
Webhook URL legado: https://portal.sisgdsolar.com.br/webhook/cooperativa
```

---

## Frente 6 — Proposta de arquitetura — adapter novo

### Estrutura de arquivos sugerida

```
backend/src/gateway-pagamento/
├── interfaces/
│   └── gateway-pagamento-adapter.interface.ts        ← já existe
├── adapters/
│   ├── asaas.adapter.ts                              ← já existe
│   └── banestes/                                     ← NOVO módulo
│       ├── banestes.adapter.ts                       ← implementa GatewayPagamentoAdapter
│       ├── banestes-config.service.ts                ← carrega .pfx + token OAuth + cache
│       ├── banestes-http.service.ts                  ← cliente HTTP com mTLS configurado
│       ├── banestes-webhook.controller.ts            ← POST /gateway-pagamento/banestes/webhook
│       ├── dto/
│       │   ├── cobranca-request.dto.ts               ← formato JSON pro Banestes
│       │   ├── cobranca-response.dto.ts              ← resposta Banestes
│       │   ├── webhook-payload.dto.ts                ← payload do webhook
│       │   └── oauth-response.dto.ts                 ← { access_token, expires_in }
│       └── banestes.adapter.spec.ts                  ← unit tests (axios mock + .pfx fake)
├── errors/
└── gateway-pagamento.module.ts                       ← injetar BanestesAdapter
```

### Mapeamento Java → TypeScript

| Operação legado Java | Método TS proposto | Complexidade | Dependências |
|---|---|---|---|
| `Certificado_Banestes.gerarcertificado()` | `BanestesConfigService.carregarCertificado(tenant)` | 🟢 BAIXA | `fs` nativo + `node:https` aceita `pfx` direto |
| `Gerar_Token_Cooperado_Banestes.gerar_token()` | `BanestesConfigService.obterToken(tenant)` (com cache TTL) | 🟢 BAIXA | axios + memoria/Redis cache |
| `EmitirCobrancaPix_Cooperado_Banestes.emitir()` | `BanestesAdapter.emitirCobranca(...)` | 🟡 MÉDIA | inclui PUT pra atualizar txid existente |
| `EmitirCobrancaPix_Cooperado_Banestes.emitirSemSessao()` | mesma `.emitirCobranca()` (não precisa de "sem sessão" — nossa arquitetura é stateless) | — | — |
| `ConsultarPagamentoPix_Cooperado_Banestes.pesquisar()` | `BanestesAdapter.listarPagamentosRecebidos(filtros)` | 🟡 MÉDIA | GET com query params |
| `ListarCobrancaPix_Cooperado_Banestes.listar()` | `BanestesAdapter.listarCobrancas(filtros)` | 🟢 BAIXA | GET simples |
| `ListarCobrancaPixEspecificoCooperado_Banestes.mostrar()` | `BanestesAdapter.consultarCobranca(txid)` | 🟢 BAIXA | GET /{txid} |
| `Webhook_Cooperado_Banestes.handleWebhook()` | `BanestesWebhookController.handle()` | 🟡 MÉDIA | + validação token compartilhado (gap do legado) |
| (não tem) `cancelarCobranca` | `BanestesAdapter.cancelarCobranca(txid)` | 🟡 MÉDIA | PATCH /{txid} com `status: REMOVIDA_PELO_USUARIO_RECEBEDOR` (PIX BACEN padrão) |
| (não tem) `criarCustomer` | `BanestesAdapter.criarCustomer()` retorna `{ gatewayCustomerId: '' }` (no-op) | 🟢 BAIXA | Banestes não tem conceito de customer — devedor vai inline na cobrança |
| (não tem) `testarConexao` | `BanestesAdapter.testarConexao()` faz GET de listar cobranças com limit=1 | 🟢 BAIXA | reuso de `listarCobrancas` |

### Interface `GatewayPagamentoAdapter` — encaixe

A interface atual encaixa **sem alterações**. Apenas `criarCustomer` precisa retornar um "no-op" no Banestes (já que ele não tem customer model):

```typescript
async criarCustomer(cooperadoId: string, cooperativaId: string): Promise<ResultadoCustomer> {
  // Banestes nao tem customer model — devedor vai inline em cada cobranca.
  // Retorna placeholder pra satisfazer a interface.
  return { gatewayCustomerId: `banestes:${cooperadoId}` };
}
```

### Estratégia mTLS em Node.js

Node.js `https` (e `axios` via `httpsAgent`) aceita `.pfx` direto:

```typescript
import { Agent } from 'node:https';
import { readFileSync } from 'node:fs';

const httpsAgent = new Agent({
  pfx: readFileSync(this.config.pfxPath),    // buffer do .pfx
  passphrase: this.config.pfxSenha,
  minVersion: 'TLSv1.2',
  // requestCert: true, // já implícito no mTLS quando ambos os lados configurados
});

const axiosClient = axios.create({
  httpsAgent,
  timeout: 10_000,
});

await axiosClient.post('https://api-pix.banestes.b.br/...', body, {
  headers: { Authorization: `Bearer ${token}` }
});
```

**Otimizações sobre o legado:**
- `httpsAgent` reusável (singleton por tenant) — evita reconstruir SSLContext a cada chamada
- Cache de OAuth token (TTL declarado pelo Banestes em `expires_in` — geralmente 1h)
- Pode usar Redis se Sinergia entrar com volume alto (hoje memória local serve)

### Webhook controller (controlador novo)

```typescript
@Controller('gateway-pagamento/banestes')
export class BanestesWebhookController {
  @Public()
  @Post('webhook')
  async receber(
    @Body() payload: BanestesWebhookPayloadDto,
    @Headers('x-banestes-token') token: string,
    @Req() req: Request,
  ) {
    // 1. Valida token compartilhado (definido em ConfigGateway)
    //    GAP do legado: legado nao validava nada.
    // 2. (opcional) Valida IP de origem se Banestes publicar faixa
    // 3. Para cada pix em payload.pix:
    //    a. Identifica tenant pela `chave` PIX → ConfigGateway
    //    b. Busca AsaasCobranca por txid
    //    c. Re-consulta status na API Banestes (GET /cob/{txid})
    //    d. Se CONCLUIDA → emite evento `pagamento.confirmado`
    //       (financeiro-token.listener.ts já existe + tokens MLM cascata)
    //    e. Persiste BanestesLogWebhook (tabela nova, equivalente a tbl_log_webhook)
  }
}
```

**Decisão de schema:** criar `BanestesLogWebhook` no Prisma (similar a `tbl_log_webhook` legado) ou reusar `AsaasLogWebhook` com `gateway` enum field? **Recomendação:** criar `GatewayWebhookLog` genérico com `tipoGateway: BANESTES | ASAAS | ...` — multi-gateway nativo.

### Reuso eventos pós-pagamento já existentes

O evento `pagamento.confirmado` no nosso sistema já dispara:
- `financeiro-token.listener.ts` → emite tokens FATURA_CHEIA se modeloCobranca=CLUBE
- `LancamentoCaixa` REALIZADO (em `cobrancas.service.ts:darBaixa`)
- `BONUS_INDICACAO` MLM cascata (em `indicacoes.service.ts`)

**Bom design:** o adapter Banestes só precisa **emitir o evento** ao receber webhook. Todos os efeitos cascata já funcionam.

---

## Tabela executiva — operações × esforço

| Operação | Esforço TS | Complexidade | Dependências externas |
|---|---|---|---|
| Carregar `.pfx` + montar `httpsAgent` cacheado | 1-2h | 🟢 BAIXA | path do `.pfx` em disco + senha |
| Cache de OAuth token (TTL respeitando `expires_in`) | 1-2h | 🟢 BAIXA | — |
| `emitirCobranca` PIX (POST + PUT pra atualizar) | 3-4h | 🟡 MÉDIA | — |
| `consultarCobranca(txid)` (GET) | 1h | 🟢 BAIXA | — |
| `listarCobrancas` (GET com filtros) | 1-2h | 🟢 BAIXA | — |
| `listarPagamentosRecebidos` (GET) | 1-2h | 🟡 MÉDIA | precisa entender filtros (data/cpf/txid) |
| `cancelarCobranca` (PATCH com status=REMOVIDA) | 1-2h | 🟡 MÉDIA | confirmar endpoint exato com Banestes |
| `BanestesWebhookController` + validação token | 2-3h | 🟡 MÉDIA | gap de segurança vs legado (adicionar validação) |
| `testarConexao` (reusa listar com limit=1) | 30min | 🟢 BAIXA | — |
| Schema `GatewayWebhookLog` (Prisma) | 1h | 🟢 BAIXA | migration aditiva |
| Specs Jest unit (mock axios + pfx fake) | 4-6h | 🟡 MÉDIA | nock ou MSW pra fixtures |
| Integração no `GatewayPagamentoService` (factory por tenant) | 1-2h | 🟢 BAIXA | reuso de padrão existente |
| Documentação operacional (cert renovation, env vars) | 1-2h | 🟢 BAIXA | — |
| **TOTAL** | **18-28h** | — | — |

### Quick wins — começar primeiro (caminho mínimo viável)

**Cenário canário Carolina paga PIX real (~6-8h Code):**

1. `BanestesConfigService` (carrega `.pfx` + cache token) — 2h
2. `BanestesAdapter.emitirCobranca` (POST PIX, retorna `pixCopiaECola` + `txid`) — 3h
3. `BanestesAdapter.testarConexao` (smoke) — 30min
4. Spec unit do adapter (mocked axios) — 1-2h
5. Smoke E2E manual: Luciano gera cobrança, paga pelo banco, vê PIX caindo

**Não inclui webhook ainda** — Carolina pode pagar e ser marcada como paga manualmente via painel admin (Bloco 8 já cobre com `marcarPago: true`). Webhook entra na fase 2 quando frequência aumentar.

### Bloqueadores externos

| Bloqueio | Lead time | Quem resolve |
|---|---|---|
| **Cert `.pfx` produção CoopereBR válido** | imediato (já existe no legado) — só copiar pra cofre seguro novo + ROTACIONAR SENHA | Luciano + time legado |
| Cert `.pfx` sandbox CoopereBR | imediato (já existe) | idem |
| Conta Banestes sandbox separada do legado | ? — verificar se o ambiente sandbox é compartilhado ou se cada deploy tem o seu | Luciano + Banestes |
| Webhook URL apontando pra novo backend | 1 dia útil pós-deploy | Luciano cadastra no painel Banestes |
| Chave PIX da CoopereBR (já existe — `tbl_certificado_banestes.chave`) | imediato | — |
| Decisão: criar tabela `GatewayWebhookLog` Prisma | 30min decisão | Code/Luciano |

---

## Riscos / pontos de atenção

### Risco 1 — Renovação do `.pfx` é manual + offline

Cert tem validade (campo `expira`). Se vencer sem aviso, **todas cobranças param**. Hoje no legado a renovação é manual (sem alerta automático).

**Mitigação no novo:**
- Cron diário que checa `ConfigGateway.banestes.certExpiraEm` vs `Date.now() + 30 dias` → email/WA admin
- Tela admin com semáforo (verde > 90 dias, amarelo 30-90, vermelho < 30)

### Risco 2 — Mudanças de API Banestes (versionamento)

Banestes evolui a API ao longo dos anos. Atualmente é `pix-qrcode-cobranca/v1/`. Quando virar `v2`, adapter quebra silenciosamente.

**Mitigação:** alertas em build (testar smoke contra `/oauth/v1/access-token` em CI no canário).

### Risco 3 — Sandbox vs Prod compartilham mesma URL base

URL base é `api-pix[-sandbox]` — sufixo `-sandbox`. **NÃO há header X-Environment ou similar.** Se a env var `AMBIENTE_CERTIFICADO` virar wrong em prod, cobrança real vai pro sandbox (não notifica o cliente, mas estraga). Inverso (sandbox indo pra prod) é ainda mais grave.

**Mitigação:**
- `isAmbienteReal()` no adapter (diretriz CLAUDE.md 18/05)
- Whitelist hardcoded de ambiente "production" pra produção
- Log explícito no startup mostrando ambiente atual

### Risco 4 — Webhook sem validação de origem (gap do legado)

Já listado em "Alertas de Segurança #4". Aqui só reforço: adicionar **obrigatoriamente** validação no novo adapter.

### Risco 5 — `tbl_certificado_banestes.chave` é a chave PIX recebedora

Se essa chave for alterada no painel Banestes mas não no banco, cobranças vão pra chave errada. Hoje no legado, alterar é via SQL direto. **Mitigação:** tela admin Asaas-like pra editar chave PIX com confirmação.

---

## Estimativa total

### Cenário Mínimo (canário Carolina paga PIX real)

**6-8h Code** — adapter sem webhook, sem listagem, sem cancelamento. Suficiente pra Sub-Sprint B canário rodar.

### Cenário Completo (adapter pronto pra produção plena)

**18-28h Code** + ~5h operacional Luciano (renovar `.pfx`, cadastrar webhook URL no painel Banestes, rotacionar senha cert).

### Cenário Completo + observabilidade

**+4-6h Code** (cron alerta cert vencendo + tela admin estado/edição + dashboard de pagamentos por gateway). Total: **22-34h**.

### Recomendação Luciano

**Cenário Mínimo primeiro** (6-8h). Roda canário Carolina. Se funcionar limpo, expande pra Cenário Completo (mais 12-20h) **em paralelo com onboarding cooperebr1**. Webhook entra **depois** do `script.sql` do hb06a chegar (porque ETL precisa importar `tbl_pagamentos` legados primeiro pra ter base de reconciliação).

---

## Decisões de produto pendentes pro Luciano

1. **`GatewayWebhookLog` genérico vs `BanestesWebhookLog` específico?**
   - (a) Genérico: 1 tabela `gateway_webhook_log` com `tipoGateway` enum → flexível, futuro-prova
   - (b) Específico: tabela `banestes_log_webhook` espelhando legado → mais simples migração ETL
   - **Recomendação:** (a) — multi-gateway design, casa com adapter pattern existente.

2. **`.pfx` em disco vs Azure Key Vault**
   - (a) Disco: `.pfx` em `/opt/certs/` com permissões restritas — simples, mas Luciano precisa lembrar de copiar
   - (b) Azure Key Vault: cert + senha no vault → integração runtime → mais seguro, mais infra
   - **Recomendação inicial:** (a) com plano migrar pra (b) quando Sinergia entrar.

3. **Cache de OAuth token: memória ou Redis?**
   - Hoje CoopereBR é 1 tenant → memória suficiente
   - Quando Sinergia entrar com volume alto → Redis recomendado
   - **Recomendação:** memória agora, refator pra Redis em sprint próprio quando virar bloqueio.

4. **Quando rodar Cenário Mínimo (6-8h)?**
   - (a) Imediatamente (próxima sessão Code) — antes mesmo do `script.sql` chegar
   - (b) Depois do Sub-Sprint B (ETL) rodar
   - **Recomendação:** (a) — destrava canário Carolina + valida estratégia mTLS no Node, sem dependência do legado. Risco: precisa do `.pfx` produção (Luciano confirma).

---

## Apêndice — dependências encontradas no legado

Bibliotecas Java relevantes (do `pom.xml`):
- `java.net.http` (nativo Java 11+) → equivalente Node nativo `https`/`fetch`
- `org.json:json:20160810` (DEPRECATED — usar Jackson) → nativo Node JSON
- `com.fasterxml.jackson` (via Spring) → nativo Node JSON
- `spring-webmvc:4.3.9.RELEASE` (antigo — Spring 6 atual) → NestJS já cobre
- `hibernate-core:5.4.2.Final` → Prisma já cobre
- `org.quartz-scheduler:2.3.2` → `@nestjs/schedule` já cobre
- `com.google.zxing` (QR code) → não precisamos (Banestes retorna pixCopiaECola pronto + location URL pro QR code)
- `com.sun.mail:javax.mail:1.6.2` → nossa stack já tem (`EmailService`)
- `mssql-jdbc` → não precisamos (Prisma Postgres)

**Conclusão dependências:** **nada exótico**. `axios` (já temos em outras integrações) + Node `https` nativo cobre tudo.

---

## Conclusão e próximo passo

Adapter Banestes é **factível** em 6-8h pra cenário canário (sem webhook) ou 18-28h pra cenário completo (com webhook + listagem + cancelamento + observability). A interface `GatewayPagamentoAdapter` atual encaixa direto. Os bloqueadores externos são pequenos (já existe `.pfx` produção válido no legado).

**Risco principal:** alertas de segurança identificados (senha em comentário, `.pfx` no repo, webhook sem validação) — todos resolvidos no design do adapter novo.

**Quick win disponível:** canário Carolina paga via PIX real Banestes em ~6-8h Code + 2-3h operacional (copiar `.pfx`, rotacionar senha, cadastrar URL webhook).

**Próximo passo (após OK Luciano):** Sub-Sprint Adapter Banestes Fase 2 EXECUÇÃO no cenário Mínimo. Aguardando autorização.

## Notas operacionais

- Backend online (PM2 estável)
- Working tree limpo (último commit `772e16f` — fechamento M25 Sprint Housekeeping)
- 234/234 specs verdes no motor
- Frontend dev `:3001` ativo
- Nenhum arquivo do legado foi extraído pro disco — leitura seletiva via `System.IO.Compression` apenas
