# M26 — Adapter Banestes Cenário Mínimo — 26/05/2026

## TL;DR

Adapter Banestes PIX entregue em **Cenário Mínimo** (~6-8h estimado, **executado em 4h efetivas**). 4 commits + fechamento. Encaixe direto na interface `GatewayPagamentoAdapter` existente (mesmo padrão Asaas). Implementa `emitirCobranca` PIX + `criarCustomer` no-op + `testarConexao` + endpoint admin `POST /gateway-pagamento/banestes/testar-conexao`. **Stubs deliberados:** `cancelarCobranca` + `processarWebhook` (Cenário Completo futuro — D-novo-AH catalogado, baixa manual via Bloco 8 painel admin enquanto isso). **46 specs novos verdes** no módulo Banestes (config + adapter + controller). Suite geral: 288/288 verdes (234 motor + 51 gateway + 3 controller Banestes). Backend restartou, rota ativa (curl 401 sem JWT confirma auth + roteamento). 2 débitos novos catalogados (D-novo-AG/AH). **Próximo passo Luciano:** obter `.pfx` sandbox Banestes do portal desenvolvedor + configurar `.env BANESTES_*` + smoke `testar-conexao`.

## Marco entregue

**M26 — Adapter Banestes PIX (Cenário Mínimo)**

## Commits do dia (5)

| Hash | Mensagem |
|---|---|
| `e4e0f77` | feat(gateway): Adapter Banestes Etapa A — BanestesConfigService + module |
| `903fce9` | feat(gateway): Adapter Banestes Etapa B — BanestesAdapter PIX + factory + 23 specs |
| `692406e` | feat(gateway): Adapter Banestes Etapa C — endpoint admin testar-conexao + 3 specs |
| `0041da6` | docs(banestes): Adapter Banestes Etapa D — cataloga D-novo-AG + AH + atualiza gateways.md + .env.example |
| (fechamento) | docs(sessao): fechamento M26 Adapter Banestes Cenário Mínimo |

## Entregas técnicas

### Etapa A — BanestesConfigService (`e4e0f77`)

Centraliza:
- Carregamento de `.pfx` do disco (path em ENV `BANESTES_PFX_PATH`)
- Montagem singleton de `https.Agent` reusável com **mTLS TLSv1.2** (cache evita reconstruir SSL a cada chamada — otimização sobre o legado Java)
- Cache em memória do OAuth `access_token` respeitando `expires_in` com margem de segurança de 5min (TTL mínimo 60s pra proteger contra OAuth mau configurado)
- Cliente axios pré-configurado com mTLS + timeout 10s default
- 6 variáveis de ambiente novas

**Padrões preservados:** `GatewayError` tipado, `Logger` Nest, `OnModuleDestroy` cleanup.

**Nota segurança:** usa `node:https Agent({ pfx, passphrase })` NATIVO. Sem biblioteca terceiro pra parsing de `.pfx` — reduz superfície de ataque.

20 specs verdes.

### Etapa B — BanestesAdapter PIX + factory (`903fce9`)

`BanestesAdapter` implementa `GatewayPagamentoAdapter` (mesma interface do AsaasAdapter).

**Operações vivas:**
- `emitirCobranca` PIX: POST `/pix-qrcode-cobranca/v1/cob/` com payload canônico Banestes (devedor inline + valor 2 decimais + calendário expiração + chave PIX do tenant + `infoAdicionais` com `cobrancaId`/`cooperadoId` pra reconciliação)
- `criarCustomer`: no-op (Banestes não tem customer model — devedor inline). Retorna `banestes:<cooperadoId>` placeholder.
- `testarConexao`: smoke leve (GET listar cobrancas com paginação 1 item) — exercita `.pfx` + token + endpoint em conjunto.

**Stubs deliberados:**
- `cancelarCobranca`: `NotImplementedException` (PATCH com `status=REMOVIDA_PELO_USUARIO_RECEBEDOR` pendente)
- `processarWebhook`: `NotImplementedException` + referência explícita ao D-novo-AH

**Tratamento de erros tipado:**
- 401/403 → `CREDENCIAIS_INVALIDAS` + invalida cache token automaticamente
- 400/422 com `cpf`/`cnpj`/`devedor` na mensagem → `COOPERADO_INVALIDO`
- 400/422 com `duplica`/`txid` → `COBRANCA_DUPLICADA`
- 500+ → `GATEWAY_INDISPONIVEL` (retryable=true)
- `ECONNREFUSED`/`ENOTFOUND`/`ETIMEDOUT` → `GATEWAY_INDISPONIVEL`
- Resposta 200 sem `txid`/`pixCopiaECola` → `DESCONHECIDO` (retryable=true)

**Validações pré-chamada:**
- `formaPagamento === 'PIX'` (BOLETO rejeitado com erro claro)
- Cooperado existe + tem CPF/CNPJ cadastrado
- ConfigGateway BANESTES ativo + `credenciais.chavePix` preenchido
- CPF/CNPJ sanitizado (remove pontos/traços)
- Descrição truncada pra 140 chars (limite Banestes `solicitacaoPagador`)
- CPF (11 dig) vai em `devedor.cpf`, CNPJ (14 dig) em `devedor.cnpj`

**Factory atualizado:** `GatewayPagamentoService.resolverAdapter` agora suporta `gateway=BANESTES`. `processarWebhook` delega pro adapter (que lança `NotImplementedException` no Cenário Mínimo).

23 specs novos verdes (4 criarCustomer + 13 emitirCobranca + 2 stubs + 4 testarConexao).

### Etapa C — Endpoint admin `testar-conexao` (`692406e`)

`BanestesController`:
```
POST /gateway-pagamento/banestes/testar-conexao
Auth: JWT SUPER_ADMIN ou ADMIN
@AuditLog: gateway_banestes.testar_conexao
```

Delega pro `BanestesAdapter.testarConexao(cooperativaId)`. Sucesso (`ok: true`) confirma em conjunto: `.pfx` carregou + senha correta + OAuth válido + DNS/rede + mTLS handshake passou.

Permite Luciano validar setup pós-configurar `.env BANESTES_*` sem precisar emitir cobrança de verdade ainda.

Smoke produção: `curl POST` sem JWT retorna 401 (auth ativa). Com JWT retorna `{ ok: true/false, totalCustomers?, erro? }`.

3 specs novos verdes.

### Etapa D — Docs + débitos catalogados (`0041da6`)

**`docs/arquitetura/gateways.md`** ganha seção completa nova:
- Adapter Banestes M26 listado no diagrama
- Tabela de arquivos atualizada (5 arquivos novos do módulo)
- Seção "Adapter Banestes — M26 Cenário Mínimo" detalhada (escopo, env vars, processo configuração sandbox→prod, mTLS estratégia, OAuth flow, 4 riscos)

**`docs/debitos-tecnicos.md`** ganha 2 débitos novos:

**D-novo-AG (P2):** `.pfx` Banestes em disco do servidor. Aceitável pra CoopereBR single tenant. **Migrar pra Azure Key Vault quando Sinergia entrar em produção.** Fix ~6-10h Code + 2-3h operacional.

**D-novo-AH (P2):** webhook Banestes pendente (Cenário Completo). Baixa de pagamento é **MANUAL** pela equipe via painel admin Bloco 8 (`marcarPago: true`) enquanto webhook não implementado. Fix ~6-8h Code + 1h operacional.

**`backend/.env.example`** ganha 7 variáveis BANESTES_* documentadas com alertas operacionais embutidos (rotacionar senha do `.pfx` antes de produção, etc).

## Validação

- **288/288 specs verdes** na suite tocada (234 motor + 51 gateway + 3 controller Banestes)
- `nest build` limpo após cada etapa (5 builds consecutivos OK)
- Backend reiniciado após Etapa C — rota ativa (curl 401 sem JWT confirma roteamento + auth)
- Working tree limpo entre etapas (commits pequenos sequenciais)
- Sem hardcoded credentials no código nem nos specs (env vars + axios mock)

## Bugs resolvidos / catalogados

| # | Severidade | Causa raiz | Status |
|---|---|---|---|
| Falta de gateway alternativo ao Asaas pra cooperebr1 produção | Risco operacional | Asaas SANDBOX + apiKey PF Luciano (D-novo-A); CoopereBR usa Banestes em produção há anos | ✅ Adapter Banestes Cenário Mínimo entregue |
| **D-novo-AG** | P2 | `.pfx` em disco; mau escala pra multi-tenant Sinergia | 📋 CATALOGADO (sprint próprio pós-Sinergia) |
| **D-novo-AH** | P2 | Webhook Banestes não implementado; baixa manual via painel admin | 📋 CATALOGADO (Cenário Completo Banestes) |

## Decisões estratégicas catalogadas

**5 decisões Luciano locked no prompt Fase 2 do M26:**

1. **Quando:** ARRANCAR NESTA SESSÃO (26/05). ✅ Feito.
2. **Escopo de pagamento:** SÓ PIX (igual ao legado, sem boleto/CNAB). ✅ Respeitado.
3. **`GatewayWebhookLog`:** GENÉRICO (1 tabela serve Banestes/Asaas/Inter/Sicoob futuros). **Pendente** — não criado nesta sessão (precisa schema migration). Catalogado pra implementação na Cenário Completo Banestes ou no primeiro webhook genérico necessário.
4. **`.pfx` storage:** DISCO por enquanto. D-novo-AG cataloga migração pra Azure Key Vault. ✅ Catalogado.
5. **Cache OAuth token:** MEMÓRIA single-instance. ✅ Implementado em `BanestesConfigService` com TTL respeitando `expires_in` + margem 5min.

**Achados de segurança do legado (referência da Fase 1):**
- 🚨 Senha do `.pfx` em comentário no código legado → `.env.example` traz alerta explícito de rotacionar antes de produção
- 🚨 5 `.pfx` reais commitados no Git legado → workflow novo nunca commita `.pfx` (path absoluto em disco)
- 🚨 Senha em texto puro na `tbl_certificado_banestes` legado → no novo, senha em env var (D-novo-AG migra pra Key Vault)
- 🚨 Webhook legado sem validação de origem → Cenário Completo desenha do zero com token compartilhado + IP whitelist opcional

## Próximo passo

### Operacional Luciano (próxima janela)

1. **Obter `.pfx` SANDBOX Banestes** do portal desenvolvedor (`https://desenvolvedores.banestes.com.br/api-portal/pt-br/user`). **NÃO** usar o `.pfx` produção CoopereBR do legado (vazado no Git legado).
2. **Configurar `.env BANESTES_*`** com valores sandbox:
   - `BANESTES_PFX_PATH=/opt/certs/banestes_sandbox.pfx`
   - `BANESTES_PFX_SENHA=<senha sandbox>`
   - `BANESTES_CLIENT_ID=<client_id sandbox>`
   - `BANESTES_CLIENT_SECRET=<client_secret sandbox>`
   - `BANESTES_AMBIENTE=sandbox`
3. **Reiniciar PM2 backend** após `.env`.
4. **Smoke** `curl POST /gateway-pagamento/banestes/testar-conexao` autenticado JWT — esperado `{ ok: true }`.

### Após sandbox validar

1. **ROTACIONAR senha** do `.pfx` produção (gerar novo via openssl — `docs/Certificado_Banestes.md` do legado tem comando).
2. Configurar `ConfigGateway` Banestes do tenant CoopereBR com `credenciais.chavePix`.
3. Habilitar gateway=BANESTES no `ConfigGateway` da Carolina (canário) ou criar nova entrada (tenant CoopereBR única).
4. **Carolina paga PIX REAL via Banestes** — primeira cobrança via novo adapter.
5. Equipe marca pago manualmente via painel Bloco 8 (D-novo-AH) — webhook fica pra Cenário Completo.

### Cenário Completo Banestes (~6-8h Code futuros)

- Implementar `BanestesAdapter.cancelarCobranca` (PATCH com status REMOVIDA)
- Implementar `BanestesAdapter.processarWebhook` + `BanestesWebhookController` com:
  - Validação token compartilhado (env `BANESTES_WEBHOOK_TOKEN_SHARED`)
  - IP whitelist opcional (se Banestes publicar faixa)
  - Re-consulta `GET /cob/{txid}` pra confirmar status CONCLUIDA
  - Emit evento `pagamento.confirmado`
  - Persiste em `GatewayWebhookLog` (tabela nova multi-gateway)
- Cron alerta D-30 antes do `.pfx` expirar
- Tela admin de gerenciamento (semáforo do `.pfx`, edit chave PIX, etc)

## Pré-requisitos leitura próxima sessão

- `docs/CONTROLE-EXECUCAO.md` — ONDE PARAMOS + FRASE DE RETOMADA
- `docs/sessoes/2026-05-26-m26-adapter-banestes-cenario-minimo.md` — esta sessão
- `docs/arquitetura/gateways.md` — seção Banestes detalhada
- `docs/relatorios/2026-05-26-fase1-banestes-legado-mapa-adapter.md` — Fase 1 read-only (mapa do legado)
- `backend/src/gateway-pagamento/banestes/` — código novo (4 arquivos)
- `backend/.env.example` — referência das 7 envs BANESTES_*
- `docs/debitos-tecnicos.md` — D-novo-AG + AH novos

## Carry-overs (não-bloqueantes)

- D-novo-AG + AH catalogados (sprints futuros)
- 6 débitos restantes do Sprint Bot (V/AA/AB/AD/AE/AF — pós-validação prod ou sprints próprios)
- Sub-Sprint B (ETL legado→novo) aguarda `script.sql` do hb06a
- Sprint Bot Proativo Fase 1 — frente paralela restante
- Sprint NPS Trimestral + Sprint Regra Parcelamento (catalogados no M25)
- 11 falhas pré-existentes na suíte Jest (cooperados/usinas — não-minhas, idênticas M19+)
- Configurar SMTP/IMAP `noreply@sisgdsolar.com.br` (engano da sessão anterior, pendente)

## Regras aplicadas na sessão

- ✅ Decisão 23 (Fase 1 read-only): relatório `docs/relatorios/2026-05-26-fase1-banestes-legado-mapa-adapter.md` foi insumo direto
- ✅ Decisão 14 (validação prévia): leitura completa de 24 classes do legado antes de implementar
- ✅ TDD: specs primeiro pras 3 classes novas (config + adapter + controller). 46/46 verdes
- ✅ `GatewayError` tipado com `retryable` flag (padrão do projeto preservado)
- ✅ Multi-tenant: `cooperativaId` em todas as queries (Cooperado + ConfigGateway)
- ✅ Sem hardcoded credentials no código nem specs (env vars + axios mock + .pfx mock buffer)
- ✅ Sem vazamento de senhas em logs (mensagens estruturadas com placeholders)
- ✅ Bot não toca contatos reais — sessão não disparou nenhuma comunicação
- ✅ NÃO conectou em produção Banestes nesta sessão — só sandbox URLs derivadas + specs com mock
- ✅ NEVER force push / NEVER --no-verify
- ✅ Commits pequenos em português (4 commits de código/docs + 1 fechamento = 5 total)
- ✅ Fechamento canônico em curso (skill `fechamento-sessao`)

## Frase comandante

> Frase canônica única em `docs/CONTROLE-EXECUCAO.md` seção `## FRASE DE RETOMADA — próxima sessão Code` (Decisão 24 — local único, atualizada 26/05 fechamento M26 Adapter Banestes Cenário Mínimo).
