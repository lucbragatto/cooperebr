# RELATORIO QA CoopereBR — 2026-04-09

**Data:** 2026-04-09 (quarta-feira)
**Hora:** 03:00 AM (America/Sao_Paulo)
**Analista:** QA Engineer (automatizado)
**Commits analisados desde ultimo relatorio:** 8 commits (eb9e81a..e304d9e)
**Cobertura da analise:** backend/, web/, whatsapp-service/

---

## RESUMO EXECUTIVO

| Categoria | Anterior (08/04) | Hoje (09/04) | Delta |
|---|---|---|---|
| Bugs P0 Criticos | 0 | 0 | = |
| Bugs P1 Altos | 2 | 0 | -2 (resolvidos) |
| Bugs P2 Medios | 4 | 3 | -1 |
| Bugs P3 Baixos | 2 | 2 | = |
| Seguranca | 2 | 2 | = |
| Total abertos | 10 | 7 | -3 |

**Destaques:**
- BUG-NOVO-001 (P1) RESOLVIDO: Taxa emissao corrigida com constantes TAXA_EMISSAO=2% e TAXA_QR=1%
- BUG-CARRY-002 (P1) RESOLVIDO: Validacao kwhContrato > 0 em calcularComPlano e aceitar
- 8 commits focados em features (CoopereAI, CooperToken contabil, dashboard financeiro, Clube de Vantagens)

---

## RESOLVIDOS DESDE O RELATORIO ANTERIOR

### BUG-NOVO-001 (P1) — Taxa emissao token: UI vs Backend
**Status:** RESOLVIDO
**Commit:** e304d9e `fix: BUG-NOVO-001 - corrigir taxa emissao tokens UI 1% para 2%, adicionar constantes TAXA_EMISSAO e TAXA_QR`

**Evidencia de codigo:**

Backend `cooper-token.service.ts:43-46`:
```typescript
/** Taxa de emissao de tokens (creditar) — 2% */
const TAXA_EMISSAO = 0.02;
/** Taxa de pagamento via QR Code (processarPagamentoQr) — 1% */
const TAXA_QR = 0.01;
```

Frontend `portal/tokens/page.tsx:333-334`:
```
Taxa de pagamento QR: 1% retida no pagamento
```

**Analise:** A UI agora exibe corretamente "1% retida no pagamento" referindo-se a TAXA_QR (pagamento via QR Code), enquanto o backend aplica TAXA_EMISSAO=2% na emissao (creditar) e TAXA_QR=1% no pagamento QR. As taxas estao consistentes e com constantes nomeadas.

**NOTA:** A UI na secao de QR Code mostra "Taxa de pagamento QR: 1%", que corresponde corretamente a TAXA_QR. A TAXA_EMISSAO de 2% e aplicada silenciosamente no creditar — considerar exibir esta informacao ao cooperado na tela de saldo/extrato para transparencia.

---

### BUG-CARRY-002 (P1) — kwhContrato=0 sem validacao no motor de proposta
**Status:** RESOLVIDO
**Commit:** 8e3fb51 `feat: BUG-CARRY-002 validacao kwhContrato + indicacao converte credita token automaticamente`

**Evidencia de codigo:**

`motor-proposta.service.ts:337-339` (calcularComPlano):
```typescript
if (kwhContrato <= 0) {
  throw new BadRequestException('kwhContrato calculado e zero ou negativo...');
}
```

`motor-proposta.service.ts:394-396` (aceitar):
```typescript
if (!r.kwhContrato || r.kwhContrato <= 0) {
  throw new BadRequestException('kwhContrato deve ser maior que zero para aceitar a proposta.');
}
```

**Analise:** Validacao adicionada em DOIS pontos criticos — calculo e aceitacao. Impede criacao de contratos com kwhContrato=0. Resolvido adequadamente.

---

## BUGS CRITICOS P0

Nenhum bug P0 identificado.

---

## BUGS ALTOS P1

Nenhum bug P1 aberto no momento. Todos os P1 anteriores foram resolvidos.

---

## BUGS MEDIOS P2

### BUG-CALCULO-001 (P2) — Imprecisao arredondamento multa/juros entre job e darBaixa
**Status:** PARCIALMENTE RESOLVIDO — risco residual baixo
**Arquivos:** `cobrancas.job.ts:78-82`, `cobrancas.service.ts:330-338`

**Analise detalhada:**

O **job** (`calcularMultaJuros`, executa 3AM) calcula assim:
```typescript
const multa = Math.round(valorOriginal * (multaAtraso / 100) * 100) / 100;  // 2dp direto
const juros = Math.round(valorOriginal * (jurosDiarios / 100) * diasEfetivos * 100) / 100;  // 2dp direto
const valorAtualizado = Math.round((valorOriginal + multa + juros) * 100) / 100;
```

O **darBaixa** (executa em tempo real no pagamento) calcula assim:
```typescript
const multa = Math.round(valorOriginal * (multaAtraso / 100) * 1e4) / 1e4;  // 4dp intermediario
const juros = Math.round(valorOriginal * (jurosDiarios / 100) * diasEfetivos * 1e4) / 1e4;  // 4dp intermediario
const valorAtualizado = Math.round((valorOriginal + multa + juros) * 100) / 100;  // 2dp final
// Persiste: Math.round(multa * 100) / 100 e Math.round(juros * 100) / 100
```

**Diferenca:** O darBaixa usa precisao intermediaria de 4 casas antes de arredondar para 2 na persistencia. Isso pode gerar diferenca de R$ 0,01 entre o valor pre-calculado pelo job e o recalculado no momento do pagamento.

**Impacto:** Baixo (maximo R$ 0,01 por cobranca), mas cria inconsistencia no historico de valores.

**Recomendacao:** Unificar a formula em uma funcao helper compartilhada com mesma precisao.

---

### BUG-WA-AUDIO (P2) — audioMessage e videoMessage sem handler no bot
**Status:** ABERTO
**Arquivo:** `whatsapp-service/index.mjs:218-258`

**Analise:** O handler de mensagens trata: `imageMessage`, `documentMessage`, `listResponseMessage`, `buttonsResponseMessage`, `conversation`, `extendedTextMessage`. NAO trata: `audioMessage`, `videoMessage`, `stickerMessage`, `contactMessage`, `locationMessage`.

Se um cooperado enviar audio ou video, o `corpo` ficara `null` e `tipo` ficara `texto`. A mensagem sera encaminhada ao backend com corpo vazio, potencialmente causando:
- Bot nao responde (mensagem "vazia")
- Cooperado fica sem retorno

**Recomendacao:** Adicionar handlers para `audioMessage` e `videoMessage` que enviem resposta ao cooperado informando que o tipo de mensagem nao e suportado, e encaminhem com `tipo: 'audio'` ou `tipo: 'video'` ao backend.

---

### BUG-NEW-002 (P2) — Webhook Asaas signature validation
**Status:** PARCIALMENTE RESOLVIDO — funcional mas sem HMAC

**Analise do fluxo atual:**

1. Controller (`asaas.controller.ts:126-133`):
   - Endpoint `@Public()` (sem JWT)
   - Aceita token via header `asaas-access-token` OU campo `token` no body
   - Passa token para `asaasService.processarWebhook()`

2. Service (`asaas.service.ts:342-354`):
   - Rejeita se token ausente (`UnauthorizedException`)
   - Busca `asaasConfig` onde `webhookToken === token`
   - Rejeita se nao encontrar configuracao

**Status de seguranca:**
- Token-based validation esta implementada e funcional
- Identifica o tenant pelo token (bom para multi-tenant)
- MAS: nao usa HMAC signature validation (Asaas envia header `asaas-signature` com HMAC-SHA256 do payload)
- Token comparado via igualdade simples (sem timing-safe comparison)

**Risco:** Medio. A validacao por token e funcional para impedir acesso nao-autorizado, mas nao valida integridade do payload (man-in-the-middle poderia alterar o conteudo mantendo o token). HMAC seria a pratica ideal.

**Recomendacao:**
1. Adicionar validacao HMAC-SHA256 do header `asaas-signature` (se disponivel)
2. Usar `crypto.timingSafeEqual()` para comparacao de tokens

---

## BUGS BAIXOS P3

### FRONT-WARN-001 (P3) — middleware.ts deprecated
**Status:** ABERTO — SEM IMPACTO FUNCIONAL

**Analise:** O `middleware.ts` do Next.js 16 esta funcional. Usa `NextRequest`/`NextResponse` e `config.matcher` que e o padrao atual do App Router. Nao encontrei uso de APIs deprecated. O middleware em si nao precisa de correcao imediata.

Verificar se houve warning especifico no build do Next.js 16 — pode ser referente a uso de `export const config` vs novo `middleware.config` (se aplicavel na versao 16).

---

### FRONT-WARN-002 (P3) — Lockfile ambiguo
**Status:** ABERTO — risco baixo

**Analise:** Existem `package-lock.json` em:
- `cooperebr/package-lock.json` (raiz do monorepo)
- `cooperebr/web/package-lock.json`

Ambos sao npm lockfiles (sem conflito yarn/pnpm). O risco e apenas de confusao na instalacao — ao rodar `npm install` na raiz vs dentro de `web/`. Para monorepo com workspaces isso e normal. Sem acao necessaria.

---

## STATUS CONSOLIDADO

| ID | Severidade | Descricao | Status | Desde |
|---|---|---|---|---|
| BUG-NOVO-001 | P1 | Taxa emissao token UI vs backend | RESOLVIDO (e304d9e) | 08/04 |
| BUG-CARRY-002 | P1 | kwhContrato=0 sem validacao | RESOLVIDO (8e3fb51) | 08/04 |
| BUG-CALCULO-001 | P2 | Arredondamento multa/juros job vs darBaixa | PARCIAL | 08/04 |
| BUG-WA-AUDIO | P2 | audio/videoMessage sem handler | ABERTO | 08/04 |
| BUG-NEW-002 | P2 | Webhook Asaas sem HMAC | PARCIAL | 08/04 |
| SEC-CT-002 | P2 | Secret na query string (WA webhook) | ABERTO | 08/04 |
| FRONT-WARN-001 | P3 | middleware.ts warnings | ABERTO | 08/04 |
| FRONT-WARN-002 | P3 | Lockfile ambiguo | ABERTO | 08/04 |
| CTK-04 | P2 | Loop apuracao contrato errado | NAO VERIFICADO | 03/04 |

**Legenda:** RESOLVIDO = corrigido com evidencia | PARCIAL = fix incompleto | ABERTO = sem fix | NAO VERIFICADO = sem analise

---

## STATUS DA INFRAESTRUTURA

| Servico | Porta | Observacao |
|---|---|---|
| Backend (NestJS) | 3000 | OK — novos modulos: CooperToken contabil, dashboard financeiro |
| Frontend (Next.js 16) | 3001 | OK — Clube de Vantagens, CoopereAI CTA |
| WhatsApp Service | 3002 | OK — CoopereAI fallback integrado, buffer de reconexao |
| CoopereAI (OpenClaw) | 18789 | OK — primeiro atendimento, captura leads |
| PostgreSQL (Supabase) | - | Sem alertas |

### Novos modulos adicionados (08-09/04):
1. **CoopereAI Camada 4A** — primeiro atendimento, captura leads, CTA contextual (eb9e81a)
2. **CooperToken contabilidade** — lancamentos contabeis automaticos via EventEmitter (97d314a)
3. **Dashboard financeiro tokens** — passivo, receita, fluxo de caixa (594abed)
4. **Regra primeiro atendimento** — captura nome/email, sem menu automatico (ec34972)
5. **Clube de Vantagens** — modal confirmacao antes do resgate (cc97c46), catalogo + resgate (0de26d8)
6. **Indicacao auto-token** — indicacao converte e credita token automaticamente (8e3fb51)

---

## FRONTEND — Status Geral

### Tokens Page (`web/app/portal/tokens/page.tsx`)
- Taxa QR exibida corretamente como 1% (linha 334)
- TAXA_EMISSAO de 2% nao exibida ao usuario — considerar adicionar no extrato
- `catch` silencioso no `carregarDados` (linha 51-52): erro de rede nao informa o usuario
- Uso de `any` no catch (linhas 113, 148) — aceitavel em error handlers mas poderia usar `unknown`

### Middleware (`web/middleware.ts`)
- Funcional e correto para Next.js App Router
- Protege rotas: /dashboard, /portal, /parceiro, /proprietario
- Redirect para /selecionar-contexto quando logado

### Observacoes gerais
- Shadcn/UI + Tailwind consistente
- Server/client boundary respeitado

---

## SEGURANCA

### SEC-CT-002 (P2) — Secret na query string do webhook WA
**Status:** ABERTO
**Arquivo:** `whatsapp-service/index.mjs:14`

```javascript
const BACKEND_WEBHOOK_URL =
  process.env.BACKEND_WEBHOOK_URL || 'http://localhost:3000/whatsapp/webhook-incoming?secret=cooperebr_wh_2026';
```

**Riscos:**
1. Secret visivel em logs de acesso (access logs registram query strings)
2. Secret hardcoded no fallback default
3. Pode vazar em stack traces ou error reports

**Recomendacao:**
- Mover secret para header HTTP (`X-Webhook-Secret` ou `Authorization: Bearer ...`)
- Remover default hardcoded — exigir via env var `BACKEND_WEBHOOK_SECRET`
- No backend, validar via header em vez de query parameter

### BUG-NEW-002 — Webhook Asaas sem HMAC
Ver secao P2 acima. Token validation funcional mas sem HMAC signature.

### Checklist de seguranca geral
- [x] Multi-tenant: cooperativaId filtrado nos endpoints verificados
- [x] JWT auth nos endpoints admin/operador
- [x] @Public() apenas em webhook Asaas (correto)
- [x] Secrets em env vars (exceto fallback WA)
- [ ] Webhook WA com secret na query string
- [ ] Webhook Asaas sem HMAC validation
- [ ] Timing-safe comparison nao utilizado

---

## RECOMENDACOES PARA O PROXIMO SPRINT

### Prioridade Alta
1. **SEC-CT-002:** Mover secret do webhook WA para header HTTP e remover fallback hardcoded
2. **BUG-WA-AUDIO:** Adicionar handlers para audioMessage/videoMessage com resposta amigavel
3. **BUG-CALCULO-001:** Unificar formula de multa/juros em helper compartilhado

### Prioridade Media
4. **BUG-NEW-002:** Implementar HMAC validation no webhook Asaas + timing-safe comparison
5. **CTK-04:** Investigar loop de apuracao que pode pegar contrato errado
6. **Transparencia taxa:** Exibir TAXA_EMISSAO de 2% no extrato/saldo do cooperado

### Prioridade Baixa
7. **FRONT-WARN-001:** Verificar warnings do build Next.js 16 e atualizar se necessario
8. **Testes:** Cobertura de testes para novos modulos (CooperToken contabil, Clube de Vantagens, CoopereAI CTA)
9. **Error handling portal:** Remover catch silencioso em `carregarDados` (tokens page) — mostrar toast de erro

---

## EVOLUCAO DO SCORE QA

| Data | Score | Observacao |
|---|---|---|
| 26/03 | 5.5 | Baseline inicial |
| 01/04 | 6.0 | Primeiros fixes de seguranca |
| 03/04 | 6.5 | Correcoes FATURA-01/02/03 |
| 04/04 | 7.0 | CONV-SEM-UC-01 resolvido |
| 05/04 | 7.5 | CTK-01 Math.round, financeiro |
| 06/04 | 7.0 | Regressao detectada |
| 08/04 | 8.5 | Bulk fix session |
| **09/04** | **8.5** | **2 P1 resolvidos, score mantido** |

**Justificativa do score 8.5:**
- (+) Dois bugs P1 criticos resolvidos com evidencia de codigo solido
- (+) 8 commits de features sem regressoes detectadas
- (+) Constantes nomeadas para taxas (boa pratica)
- (=) Bugs P2 de seguranca continuam abertos (SEC-CT-002, BUG-NEW-002)
- (=) BUG-WA-AUDIO continua aberto sem handler
- (=) Nenhum teste novo detectado nos commits
- Score mantido em 8.5 — os P1 resolvidos compensam a ausencia de testes, mas os P2 de seguranca impedem subida

**Para chegar a 9.0:**
- Resolver SEC-CT-002 (secret na query string)
- Resolver BUG-WA-AUDIO (handler audio/video)
- Adicionar testes para os novos modulos

---

*Relatorio gerado automaticamente pelo QA Engineer noturno — CoopereBR*
