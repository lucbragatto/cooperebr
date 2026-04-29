# Validação INVs 4-8 do Doc-0 Fatia 2 — 2026-04-29

> Validação read-only de afirmações que claude.ai fez sobre INVs 4-8 (FaturaSaas, Financeiro, Fidelidade, WhatsApp).
> Princípio: código vence quando contradiz. Banco do dev é referência única para contagens.

---

## INV 4 — FaturaSaas

### Afirmações validadas

| Afirmação claude.ai | Resultado |
|---|---|
| Cron `@Cron('0 6 1 * *')` em `saas.service.ts:130` | ✅ Confirmado — linha exata |
| Sprint 6 Ticket 10 commit `fd35c0d` | ✅ Confirmado — `fd35c0d feat(sprint6): cron mensal FaturaSaas automatica (Ticket 10)` |
| 1 FaturaSaas PENDENTE no banco | ✅ Confirmado — `FaturaSaas total: 1 (PENDENTE: 1)` |

### Afirmações divergentes

**❌ "6 componentes de cobrança via PlanoSaas".** O cálculo real lê **apenas 2 componentes**:

```ts
// saas.service.ts:207
const valorBase = Number(coop.planoSaas.mensalidadeBase);
// :211-222 — só executa se percentualReceita > 0
const valorReceita = Math.round(receitaTotal * (Number(coop.planoSaas.percentualReceita) / 100) * 100) / 100;
const valorTotal = Math.round((valorBase + valorReceita) * 100) / 100;
```

O schema `PlanoSaas` tem 13 campos no total. Os outros (`taxaSetup`, `limiteMembros`, `taxaTokenPerc`, `limiteTokenMensal`, `cooperTokenHabilitado`, `modulosHabilitados`, `modalidadesModulos`, `ativo`) **não são consumidos no cálculo da fatura**. Existem como configuração/governança mas não viram linha na FaturaSaas.

Conclusão: **2 componentes, não 6.** Se quiser cobrança variável (taxa de setup, taxa por token, taxa por módulo), precisa implementar.

### Lacunas investigadas

#### 1. FaturaSaas → Asaas: ❌ NÃO existe

```bash
grep -rn "asaas\|asaasCobrancaId" backend/src/saas/ → 0 matches
grep -rn "FaturaSaas|faturaSaas" backend/src/asaas/ → 0 matches
```

Não há integração entre FaturaSaas e gateway Asaas. Quando cron cria a fatura, ela vive só no banco do SISGD — parceiro não recebe boleto/PIX/QR automático.

#### 2. Comunicação automática pro parceiro: ❌ NÃO existe

```bash
grep -rn "FaturaSaas|fatura.*saas" backend/src/email/ backend/src/whatsapp/ → 0 matches
```

Cron logaria a criação no console (`this.logger.log('Cron FaturaSaas: X criada(s)...')`), mas não envia email nem WhatsApp pro parceiro avisando que tem fatura nova ou vencendo. Parceiro só vê quando entra no painel SUPER_ADMIN.

#### 3. Pagamento processado: ❌ NÃO existe

Endpoints saas:
```
GET    /saas/dashboard
GET    /saas/parceiros
GET    /saas/parceiros/:id/saude
GET    /saas/planos
GET    /saas/planos/:id
POST   /saas/planos/vincular
POST   /saas/planos
PATCH  /saas/planos/:id
DELETE /saas/planos/:id
GET    /saas/faturas
POST   /saas/faturas/gerar
```

Não há `PATCH /saas/faturas/:id/pagar` nem webhook handler que mude status. Para marcar uma FaturaSaas como PAGA hoje, precisa **UPDATE direto no banco** ou criar um campo manualmente. **Não há reconciliação automática.**

---

## INV 5 — Financeiro & Contábil

### Afirmações validadas

| Afirmação | Resultado |
|---|---|
| `LancamentoCaixa` CRUD em `financeiro/lancamentos.service.ts` | ✅ Confirmado — 278 linhas |
| Cobrança paga → LancamentoCaixa criado em `cobrancas.service.ts` | ✅ Confirmado — gravação PREVISTO em `:355`, atualização para REALIZADO em `:455-489` |
| ContaAPagar 0 registros | ✅ Confirmado |

### Afirmações divergentes (pequenas)

**🟡 LancamentoCaixa = 53 (não 35).** Banco evoluiu desde que claude.ai contou. PlanoContas = 24 confere.

**🟡 Linhas exatas dos pontos de gravação:**
- Criação PREVISTO: `cobrancas.service.ts:345-370` (claude.ai disse `:272-298` — errado)
- Atualização REALIZADO: `:449-493` (claude.ai disse `:376-416` — errado)
- Cancelamento: `:646-661`

### Lacunas investigadas

#### ContratoUso e "% lucro líquido"

**% lucro líquido NÃO está implementado.** Confirmado lendo todo o `contratos-uso.service.ts` (160 linhas):

- Schema tem `percentualRepasse` mas **nunca é consumido**.
- `gerarLancamentoMensal()` (linha 116-151) usa **só `valorFixoMensal`**:
  ```ts
  const valor = Number(contrato.valorFixoMensal ?? 0);
  if (valor <= 0) return null;
  ```
- Não há lógica de "deduzir despesas antes de calcular %".
- **Não há cron** que rode `gerarLancamentoMensal` automaticamente todo mês — a função só é chamada **uma vez no momento da criação do contrato** (linha 81-83 do service).

Resumo: hoje só funciona "aluguel fixo de R$ X/mês". Para "% lucro líquido sobre receita da usina", **falta**:
1. Cron mensal que execute `gerarLancamentoMensal` para todos contratos ATIVO.
2. Lógica de cálculo: somar receita da usina (cobranças vinculadas), deduzir despesas (ContaAPagar), aplicar `percentualRepasse`.
3. UI no portal proprietário que mostre o cálculo.

**→ Sprint Portal Proprietário precisa definir essa fórmula.**

#### DRE / Conciliação / Fechamento

```bash
grep -rn "DRE|demonstracaoResultado" backend/src/ → 0 matches
grep -rn "conciliacao|conciliar|matchTransacao" backend/src/integracao-bancaria/ → 0 matches
grep -rn "fecharMes|fechamentoMensal|bloquearLancamentos|fecharCompetencia" → 0 matches
```

Confirmado **100%**:
- ❌ DRE não existe
- ❌ Conciliação bancária não existe (BB e Sicoob são integrações de geração de boleto, não de conciliação de extrato)
- ❌ Fechamento mensal não existe (nenhum mecanismo trava lançamentos retroativos)

---

## INV 6 — Mecanismos de Fidelidade

### CooperToken

#### Afirmações validadas

| Afirmação | Resultado |
|---|---|
| Cron `apurarExcedentes()` | ✅ `cooper-token.job.ts:20` `@Cron('0 6 * * *')` (diário às 6h) |
| Cron `expirarTokensVencidos()` | ✅ `cooper-token.job.ts:120` `@Cron('0 2 1 * *')` (mensal dia 1 às 2h) |
| Hardcode `0.20` | ✅ Encontrado em `cooper-token.service.ts:258` com TODO: `const valorEstimado = Math.round(quantidade * 0.20 * 100) / 100; // TODO: ler valorTokenReais do plano` |

#### Detalhe importante

Existem **3 fallbacks distintos** para `valorTokenReais` no service:
- Linha 258: `0.20` hardcoded com TODO (única ocorrência problemática)
- Linhas 451, 561, 670: `Number(plano.valorTokenReais ?? 0.45)` — leem do plano com fallback `0.45` (default sensato)
- Linha 352 (controller): expõe `valorTokenReais: 0.45` como default em DTO

**Inconsistência:** alguns pontos usam fallback `0.45`, um ponto usa hardcode `0.20`. Vale unificar.

#### Estado em produção
- `CooperTokenLedger`: 9 entradas
- `CooperTokenSaldo`: 5 saldos por cooperado/parceiro

### CooperToken Parceiro

Schema separado (`CooperTokenSaldoParceiro`, `CooperTokenCompra`, `OfertaClube`, `ResgateClubeVantagens`). Confirmado modular.

### Convênios

#### Afirmações validadas

| Afirmação | Resultado |
|---|---|
| ~53 KB de código | ✅ 1956 linhas total em `convenios/` (`convenios.service.ts:451`, `convenios-progressao.service.ts:234`, etc.) |
| Suporte PF e PJ no service | ✅ DTOs aceitam `conveniadoCpf` e `conveniadoCnpj`, fallback para `CONV-${randomUUID()}` quando nenhum dos dois (`convenios.service.ts:58`) |
| Faixas progressivas implementadas | ✅ `validarFaixas()` + campo `faixaAtualIndex` + `HistoricoFaixaConvenio` model + service `convenios-progressao.service.ts` (234 linhas) |
| Modalidade GLOBAL vs STANDALONE | ✅ Implementado — `STANDALONE` aprova automático (`statusAprovacao = APROVADO`); `GLOBAL` precisa SUPER_ADMIN aprovar (`statusAprovacao = PENDENTE`) — `convenios.service.ts:107` |

#### Estado em produção
- `ContratoConvenio`: 2 ATIVOS
- `ConvenioCooperado` (vínculos): 215

### Clube de Vantagens

#### Afirmações validadas

| Afirmação | Resultado |
|---|---|
| Cron mensal dia 1 às 9h | ✅ `clube-vantagens.job.ts:15` `@Cron('0 9 1 * *')` |
| Guarda env `CLUBE_RESUMO_MENSAL_HABILITADO` | ✅ Linha 18 — bloqueia disparo a menos que `=true` |
| `ConfigClubeVantagens` + `ProgressaoClube` + `ResgateClubeVantagens` | ✅ Models existem |

#### Estado em produção
- `OfertaClube`: 0 (sem catálogo cadastrado ainda)
- `ResgateClubeVantagens`: 0 (sem resgates)

### PIX Excedente

#### Afirmações validadas

| Afirmação | Resultado |
|---|---|
| Flag `ASAAS_PIX_EXCEDENTE_ATIVO` | ✅ Lida em `pix-excedente.service.ts:121` |
| Mecanismo genérico (qualquer cooperado) | ✅ Não há filtro por tipo de parceiro/cooperado — qualquer um com saldo elegível pode receber via `TransferenciaPix` |
| Service tem 294 linhas | ✅ Confirmado |

### Investigação: regras entre os 5 conceitos

```bash
grep -rn "convenio.*indicacao|indicacao.*convenio|hasConvenio|conveniadoAtivo" backend/src/ → 0 matches
```

**Resposta: NÃO há cruzamento entre Convênios e Indicações (MLM) no código.** São paralelos puros. Quando um cooperado vira conveniado, **nenhuma flag é mudada** em `Indicacao`. Os 5 mecanismos (CooperToken, CooperToken Parceiro, Clube, Convênios, PIX Excedente) operam de forma independente — não há regra "se está em convênio, MLM desativa".

→ Para PRODUTO.md: **deixar claro que os 5 conceitos compõem livremente** (o cooperado pode estar em todos simultaneamente).

---

## INV 8 — WhatsApp Bot

### Afirmações validadas

| Afirmação | Resultado |
|---|---|
| 10 services | ✅ `coopere-ai`, `modelo-mensagem`, `whatsapp-bot`, `whatsapp-ciclo-vida`, `whatsapp-cobranca`, `whatsapp-fatura`, `whatsapp-fluxo-motor`, `whatsapp-mlm`, `whatsapp-notificacoes`, `whatsapp-sender` |
| 27 endpoints | ✅ `grep -c @(Get|Post|Put|Patch|Delete) backend/src/whatsapp/*.controller.ts → 27` |
| 5 crons | ✅ Confirmados: |
| | • `whatsapp-cobranca.service.ts:27` `@Cron('0 8 5 * *')` — disparo mensal de cobranças dia 5 às 8h |
| | • `whatsapp-cobranca.service.ts:217` `@Cron('0 9 * * *')` — diário 9h fluxo de inadimplência |
| | • `whatsapp-cobranca.service.ts:441` `@Cron('30 9 * * *')` — diário 9:30 |
| | • `whatsapp-conversa.job.ts:13` `@Cron(EVERY_HOUR)` |
| | • `whatsapp-mlm.service.ts:20` `@Cron('0 10 1 * *')` — mensal dia 1 às 10h |
| Estados ConversaWhatsapp + timeout 30 min | ✅ Hardcoded em `whatsapp-bot.service.ts:338` (`if (diffMin > 30 && conversa.estado !== 'INICIAL' && conversa.estado !== 'CONCLUIDO')`) |
| OCR via WhatsApp em 2 estados | ✅ Confirmado em sessão anterior — `whatsapp-bot.service.ts:1499` (`processarOcrFatura`) e `:3297` |
| CoopereAI funcional, não só conceito | ✅ `coopere-ai.service.ts:127` log "CoopereAI inicializado com Claude API direta"; `:204` "respondeu (X chars) para Y"; integração direta com Anthropic SDK quando `ANTHROPIC_API_KEY` setada |

### Lista completa de estados ConversaWhatsapp (extraída do code)

`AGUARDANDO_CPF`, `AGUARDANDO_NOME`, `AGUARDANDO_EMAIL`, `AGUARDANDO_CONFIRMACAO_DADOS`, `AGUARDANDO_CONFIRMACAO_PROPOSTA`, `AGUARDANDO_CONFIRMACAO_CADASTRO`, `AGUARDANDO_FOTO_FATURA`, `AGUARDANDO_COMPROVANTE_PAGAMENTO`, `AGUARDANDO_DISPOSITIVO_EMAIL`, `AGUARDANDO_DISTRIBUIDORA`, `AGUARDANDO_VALOR_FATURA`, `AGUARDANDO_NOVO_NOME`, `AGUARDANDO_NOVO_EMAIL`, `AGUARDANDO_NOVO_TELEFONE`, `AGUARDANDO_NOVO_CEP`, `AGUARDANDO_NOVO_KWH`, `AGUARDANDO_FATURA_PROXY`, `AGUARDANDO_ATENDENTE`, `CADASTRO_EXPRESS_NOME`, `CADASTRO_EXPRESS_CPF`, `CADASTRO_EXPRESS_EMAIL`, `CADASTRO_EXPRESS_VALOR_FATURA`, `CADASTRO_PROXY_NOME`, `CADASTRO_PROXY_TELEFONE`, `AGUARDANDO_PROPRIETARIO_FATURA`, `AGUARDANDO_CONFIRMACAO_OCR`, `AGUARDANDO_NOME_TERCEIRO`, `AGUARDANDO_TELEFONE_TERCEIRO`, `AGUARDANDO_CONFIRMACAO_CELULAR`, `AGUARDANDO_CELULAR_CORRETO`, `AGUARDANDO_INDICACAO`, `RECEBENDO_CONTATOS`. Plus estados base `INICIAL`, `MENU_PRINCIPAL`, `MENU_COOPERADO`, `MENU_CLIENTE`, `MENU_CONVITE`, `CONCLUIDO`.

**Total: ~38 estados conversacionais.** Bot é máquina de estados de complexidade média-alta.

### Lacuna confirmada

**❌ Sem testes de regressão.** `find backend/src/whatsapp -name "*.spec.ts"` retorna **vazio**. Considerando 4051 linhas no `whatsapp-bot.service.ts` e 38+ estados, a ausência de specs é débito alto. Registrar P3 alto.

### Estado em produção
- `ConversaWhatsapp`: 43 conversas

---

## Síntese

### Afirmações de claude.ai confirmadas: **20 de 23**

### Divergências encontradas

1. **FaturaSaas: 2 componentes, não 6.** Cálculo só usa `mensalidadeBase + percentualReceita`. Outros campos do `PlanoSaas` (taxaSetup, taxaTokenPerc, etc.) são governança/configuração, não viram linha na fatura.
2. **Linhas erradas em `cobrancas.service.ts`:** PREVISTO em `:345-370` (claude.ai disse `:272-298`); REALIZADO em `:449-493` (claude.ai disse `:376-416`).
3. **LancamentoCaixa = 53, não 35.** Banco evoluiu.

### Lacunas que continuam abertas (precisam de Luciano)

1. **% lucro líquido em ContratoUso** — fórmula precisa ser definida no Sprint Portal Proprietário. Hoje só roda "aluguel fixo R$/mês".
2. **FaturaSaas → Asaas** — decisão de produto: gerar boleto/PIX automático? Ou parceiros pagam por TED com confirmação manual?
3. **FaturaSaas → comunicação parceiro** — email/WA quando criada/vencendo? Hoje silêncio.
4. **FaturaSaas → marcar PAGA** — endpoint dedicado ou UPDATE manual no DB? Sem fluxo automático hoje.

### Débitos novos identificados (5)

| ID | Descrição | Severidade |
|---|---|---|
| D-29A | Hardcode `valorTokenReais = 0.20` em `cooper-token.service.ts:258` com TODO | P2 |
| D-29B | Inconsistência fallback `valorTokenReais`: 0.20 vs 0.45 nos diferentes pontos do mesmo service | P3 |
| D-29C | `ContratoUso.percentualRepasse` gravado mas nunca consumido — só `valorFixoMensal` é usado | P2 |
| D-29D | Sem cron mensal pra `ContratoUso.gerarLancamentoMensal` — só roda na criação do contrato | P2 |
| D-29E | WhatsApp bot sem specs Jest (4051 linhas em `whatsapp-bot.service.ts`, 0 specs) | P3 |
| D-29F | FaturaSaas sem integração Asaas + sem comunicação parceiro + sem fluxo de pagamento | P1 (bloqueia produção SaaS real) |

### Confirmações importantes para PRODUTO.md

- **DRE, conciliação bancária, fechamento mensal não existem.** Listar como gaps no apêndice de semáforo.
- **5 mecanismos de fidelidade são paralelos puros.** Não há regra de exclusão mútua entre Convênios e Indicações.
- **CoopereAI está realmente funcional** (não é apenas conceito) — usa Anthropic SDK direto.
- **WhatsApp bot é máquina de estado complexa** (38+ estados, 4051 linhas) sem testes — risco operacional alto.

---

*Validação read-only. Conduzida por Claude Code (Sonnet) em 2026-04-29. Tudo aqui é leitura do código atual + contagem direta do banco dev.*
