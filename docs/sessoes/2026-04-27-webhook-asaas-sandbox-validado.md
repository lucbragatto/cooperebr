# Sessão 2026-04-27 — Webhook Asaas validado em sandbox + 3 bugs descobertos

## Contexto inicial

Antes desta sessão, o sistema tinha:

- `AsaasConfig` da CoopereBR com `webhookToken=NULL` (webhook nunca passou validação)
- 1 cobrança PENDING em sandbox há 4 dias (`pay_ljre4hjyjieu22tc`, R$ 500), nunca confirmada
- 30 cobranças no banco — todas via caminho automático (faturas.service.ts a partir de OCR de fatura)
- Caminho manual da UI (`/dashboard/cobrancas/nova`) **nunca tinha rodado de verdade**
- Infra PM2 sem monitor de crash loop
- Nenhum teste end-to-end de webhook Asaas em produção real

Plano original do dia: "Configurar webhook Asaas em sandbox e validar fluxo end-to-end".

Plano real do dia: descobrir e consertar 3 bugs ao tentar fazer isso.

## Cronologia narrada

1. **08h00 — Setup webhookToken.** Script `scripts/setar-webhook-token-asaas.ts` setou o token base64 (`TVbd...YpQ=`) no `AsaasConfig` da CoopereBR principal (id `cmn3acjxi0001uot4n33t3pm6`, multi-tenant respeitado, **não** o tenant "CoopereBR Teste" que existia em paralelo). Idempotente.

2. **08h30 — ngrok + Dashboard Asaas.** Túnel `https://hatchery-outer-joining.ngrok-free.dev`. Webhook configurado com token + URL `/asaas/webhook` + eventos PAYMENT_RECEIVED/CONFIRMED.

3. **09h34 — Primeiro POST /asaas/webhook 200 OK.** Cobrança `pay_ljre4...` virou RECEIVED. Mas descoberta acidental: PM2 estava em crash loop com **298 restarts** acumulados — porta 3000 ocupada por node órfão (PID 4396) de sessão antiga. Backend "online" no PM2 era ilusão; quem respondia o webhook era o órfão.

4. **09h45 — Limpeza.** Kill PID 4396, `pm2 stop` + `pm2 start cooperebr-backend` limpo. Backend novo PID 20948 estável.

5. **10h00 — Tentativa criar cobrança via UI.** `PrismaClientValidationError: Argument percentualDesconto is missing.` Frontend calculava desconto pra mostrar na tela mas não enviava no payload, backend tipava o campo como obrigatório.

6. **10h15 — Investigação arquitetural do desconto.** Confirmou modelo Plano → Proposta → Contrato → Cobrança correto. Os 2 callers automáticos (faturas.service.ts:637 e :1018) **já buscavam `percentualDesconto` do contrato corretamente**. Apenas o caminho manual confiava no body.

7. **10h30 — Bug 1 corrigido.** `cobrancas.service.create()` agora busca `Contrato.percentualDesconto` como fallback. Tipagem `percentualDesconto?` opcional no service e controller. 4 specs novos cobrindo cenários numéricos.

8. **10h45 — Bug 2: dataVencimento.** Frontend HTML `<input type="date">` envia `"2026-05-03"`, Prisma exigia ISO completo. Helper `normalizarData()` aceita 3 formatos (Date | "YYYY-MM-DD" | ISO completo) + valida com `BadRequestException`. 2 specs novos.

9. **11h00 — Cobrança via UI funcionou.** R$ 10 / TESTE E2E CLUBE SPRINT9 → criou Cobrança + AsaasCobranca + sincronizou via API Asaas. Webhook PAYMENT_RECEIVED → cobrança PAGO + LancamentoCaixa criado + tokens emitidos. **Aparente sucesso** — mas o cooperado de teste tinha contrato sem `planoId` e modo CLUBE, então tokens emitidos pareciam normais.

10. **11h45 — Insistência: testar plano não-token.** Luciano pediu pra rodar com cooperado real (AGOSTINHO, PLANO OURO com `cooperTokenAtivo=false`) pra validar que `LancamentoCaixa` seria criado **sem** emissão de token. Cobrança R$ 15 → R$ 12 cobrado → LancamentoCaixa R$ 12 ✅ → mas **2.94 tokens FATURA_CHEIA emitidos**, NÃO deveriam.

11. **12h15 — Investigação do paradoxo.** Especificação `docs/especificacao-clube-cooper-token.md` é cristalina:
    - **Caminho DESCONTO:** paga reduzido, sem tokens
    - **Caminho CLUBE:** paga **valor cheio**, recebe tokens equivalentes

    Código aplicava desconto cego em `cobrancas.service.ts:141-148` sem checar `cooperado.modoRemuneracao`. AGOSTINHO (modo CLUBE, descoberto pela query) recebeu **dupla bonificação**: pagou R$ 12 (cheio menos desconto) E ganhou R$ 3 em tokens. Bug arquitetural P1 latente desde Sprint 8B, exposto agora porque o caminho manual nunca tinha rodado antes.

12. **13h00 — Bug 3 corrigido.** Helper `calcularValoresCobranca(valBruto, pctDesc, modoClube)` extraído em escopo módulo. Aplicado nos 3 callers (cobrancas.service.create + faturas.service:631 + faturas.service:1012). Frontend display sincronizado: badge "CLUBE" no card de cálculo + linha "Modo CLUBE — paga cheio". 4 specs novos cobrindo CLUBE/DESCONTO/override/null.

13. **13h45 — Validação contraprova:**
    - **AGOSTINHO 07/2026 (CLUBE):** R$ 20 bruto = R$ 20 líquido pagos cheio + 4 tokens emitidos ✅
    - **ADRIANA 07/2026 (DESCONTO):** R$ 50 bruto, R$ 40 líquido (desconto 20% aplicado), zero tokens ✅

14. **14h30 — UX dropdown.** Mostra "Nome — CTR-XXX" em vez de cuid, filtra ATIVO+ATIVO, ordem alfabética, badge "CLUBE" colorido. CSS forçado pra resolver problema de sobreposição (z-100, bg-white sólido, min-w-420px, scroll).

15. **15h30 — Commit consolidado** `16302e9` (5 arquivos, +181/-31).

## Os 3 bugs em detalhe

### Bug 1 — `percentualDesconto missing` (P1, latente desde início do projeto)

- **Sintoma:** `PrismaClientValidationError: Argument percentualDesconto is missing` em `cobrancas.service.ts:115`
- **Causa raiz:** controller `POST /cobrancas` declarava `percentualDesconto: number` como obrigatório no body. Frontend calculava o valor pra display mas não incluía no payload. Os 2 callers automáticos não passavam pelo controller — chamavam o service direto.
- **Fix:** backend busca `Contrato.percentualDesconto` como fallback. Tipagem opcional no service + controller. Body explícito vira override pontual (caso de admin querer aplicar desconto diferente em cobrança específica).

### Bug 2 — `dataVencimento sem hora ISO` (P1, latente)

- **Sintoma:** `premature end of input. Expected ISO-8601 DateTime`
- **Causa raiz:** input HTML `<input type="date">` envia `"2026-05-03"` (10 chars). Prisma `DateTime` exige ISO completo ou Date object.
- **Fix:** helper module-level `normalizarData(valor, campo)` que aceita 3 formatos e lança `BadRequestException` em entrada inválida. Aplicado a `dataVencimento` (obrigatório) e `dataPagamento` (opcional).

### Bug 3 — Modo CLUBE cobrava reduzido + emitia tokens (P1, ARQUITETURAL, latente desde Sprint 8B)

- **Sintoma:** AGOSTINHO (modo CLUBE) recebia cobrança com desconto aplicado E ainda ganhava tokens equivalentes ao desconto. Dupla bonificação financeira.
- **Causa raiz:** o cálculo de `valorLiquido` em todos os 3 callers de criação de cobrança nunca consultava `cooperado.modoRemuneracao`. A regra "CLUBE paga cheio" estava **só** no PDF (escondia visualmente a linha de desconto) e no `darBaixa()` (emitia tokens depois do pagamento). O cálculo do valor cobrado, sem checagem, sempre aplicava desconto.
- **Por que ficou latente:** caminho manual da UI estava bloqueado pelos bugs 1 e 2. Cobranças automáticas via OCR não exercitavam casos CLUBE em volume significativo. Especificação existia desde Sprint 8B mas implementação ficou incompleta.
- **Fix:** helper `calcularValoresCobranca` decide líquido com base em `modoClube`. Aplicado nos 3 callers. Frontend mostra "Modo CLUBE — paga cheio" com tokens estimados quando aplicável. Override por body preservado (em caso de negociação avulsa).

## Lições e padrões observados

1. **Padrão recorrente: backend confiando no frontend.** Bugs 1 e 2 são variações do mesmo problema — service/controller esperando que o caller traga campos completos. Reflete um caminho que nunca foi exercitado fim-a-fim. Vigiar isso em outras telas.

2. **Bug latente exposto por destrava de outro bug.** Bug 3 (CLUBE dupla bonificação) só ficou visível depois que bugs 1 e 2 foram resolvidos e o caminho manual passou a funcionar. Exercitar caminhos novos descobre coisas que ninguém via.

3. **Whitelist de notificações funcionou.** Vários webhooks dispararam fluxos de notificação WhatsApp/email mas zero saiu de verdade — `NOTIFICACOES_ATIVAS=false` segurou. Confiança na safety net mantida.

4. **PM2 sem monitor de crash loop = bomba-relógio.** 4 horas em loop com 298 restarts sem alerta. Em produção real um cliente teria visto sistema lento, intermitente ou caído. Débito P3 registrado pra Sprint 14 (pré-produção).

5. **Insistência do produto > checklist técnico.** Após o "1º teste OK" eu estava pronto pra dar a sessão por encerrada. Luciano pediu testar com outro cooperado pra ver `LancamentoCaixa`. Esse pedido descobriu o bug arquitetural P1 que estava na frente de todos há semanas. Validações cruzadas (não só "passou no caso feliz") são o que pega bugs reais.

6. **Especificação valeu ouro.** `docs/especificacao-clube-cooper-token.md` foi escrita há semanas e não tinha sido lida na investigação inicial. Quando finalmente aberta, definiu sem ambiguidade que CLUBE = paga cheio. Documentação não é overhead — é fonte de verdade quando o código diverge.

## Estado final

Sandbox 100% validado nos 2 modos:
- **CLUBE** (cooperado paga cheio + recebe tokens): AGOSTINHO 07/2026 R$ 20 + 4 tokens ✅
- **DESCONTO** (cooperado paga reduzido, sem tokens): ADRIANA 07/2026 R$ 40 ✅

Sprint 12 (Webhook Asaas em produção) reduzido pra ~1 dia. Bloqueio único:
- Luciano abrir conta Asaas em produção
- Substituir credenciais sandbox→produção no `AsaasConfig` da CoopereBR

Estado da infra ao final da sessão:
- PM2 `cooperebr-backend` PID 16036, online, restart count 301, estável
- ngrok ativo em `hatchery-outer-joining.ngrok-free.dev` — manter ligado pra próxima sessão se for testar mais; pode desligar com segurança quando fechar
- Bug PM2 crash loop registrado P3 em débitos técnicos, não corrigido nesta sessão

## Próxima sessão

**Frase de retomada:** "Webhook Asaas sandbox 100% validado em 27/04. Próximo: Sprint 13 (Painel Luciano super-admin) ou Sprint 12 produção quando conta Asaas produção for criada."

Caminhos possíveis (decidir com Luciano):
1. Sprint 13 (Painel Luciano) — sem dependência externa, ~4 dias úteis
2. Sprint 12 produção — esperando conta Asaas
3. Sessão dedicada `Uc.numero` (decisão arquitetural, ~1h) — destrava Sprint 17
4. Outra prioridade que Luciano puxar

## Commits do dia

```
16302e9 fix(cobrancas): conserta CLUBE dupla bonificacao + percentualDesconto/dataVencimento + UX dropdown
915f8a3 fix(cobrancas): backend normaliza percentualDesconto e dataVencimento
52db061 docs(debitos): registra bug de formatarMoeda em relatorio de inadimplencia
```

Cobranças criadas/validadas hoje (CoopereBR sandbox):

| ID | Ref | Cooperado | Modo | Bruto | Desc% | Líq | Tokens | Status |
|----|-----|-----------|------|-------|-------|-----|--------|--------|
| `cmoh8z…` | 04/2026 | TESTE E2E CLUBE SPRINT9 | CLUBE | R$ 10 | 20% | R$ 8 | 1.96 | ⚠️ pré-fix CLUBE |
| `cmoh9n…` | 04/2026 | AGOSTINHO | CLUBE | R$ 15 | 20% | R$ 12 | 2.94 | ⚠️ pré-fix CLUBE (descobriu o bug) |
| `cmojX…` | 07/2026 | AGOSTINHO | CLUBE | R$ 20 | 20% | **R$ 20** | 4.00 | ✅ pós-fix |
| `cmojY…` | 07/2026 | ADRIANA | DESCONTO | R$ 50 | 20% | **R$ 40** | 0 | ✅ pós-fix contraprova |

(IDs `cmojX/cmojY` são placeholders — substituir pelos cuids reais ao consultar `lancamentos_caixa` da sessão se for fazer auditoria.)
