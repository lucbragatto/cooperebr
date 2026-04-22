# Investigacao Sprint 8 — CooperToken + Clube de Vantagens

> Gerado em 2026-04-20 via investigacao read-only. Todas as referencias sao arquivo:linha.

---

## SECAO 1 — SCHEMA (Prisma)

### Enums

**CooperTokenTipo** (`schema.prisma:1815`)
```
GERACAO_EXCEDENTE | FATURA_CHEIA | FLEX | SOCIAL | BONUS_INDICACAO | PAGAMENTO_QR | DESCONTO_FATURA
```

**CooperTokenOperacao** (`schema.prisma:1825`)
```
CREDITO | DEBITO | EXPIRACAO | DOACAO_ENVIADA | DOACAO_RECEBIDA | COMPRA_PARCEIRO | ABATIMENTO_ENERGIA | TRANSFERENCIA_PARCEIRO | RESGATE_CLUBE
```

### Models CooperToken

**CooperTokenLedger** (`schema.prisma:1837`) — **6 registros**
| Campo | Tipo | Observacao |
|---|---|---|
| id | String @id @default(cuid()) | |
| cooperadoId | String | FK Cooperado |
| cooperativaId | String | FK Cooperativa |
| tipo | CooperTokenTipo | |
| operacao | CooperTokenOperacao | |
| quantidade | Decimal(10,4) | |
| saldoApos | Decimal(10,4) | |
| valorReais | Decimal(10,2)? | |
| referenciaId | String? | FK polimorfca |
| referenciaTabela | String? | FaturaProcessada, Cobranca, Indicacao, CooperTokenLedger |
| expiracaoEm | DateTime? | |
| descricao | String? | |
| parceiroId | String? | cooperativaId do parceiro |
| createdAt | DateTime | |
Indices: [cooperadoId,createdAt], [cooperativaId], [expiracaoEm], [parceiroId]. Map: `cooper_token_ledger`.

**CooperTokenSaldo** (`schema.prisma:1862`) — **3 registros**
| Campo | Tipo |
|---|---|
| id | String @id |
| cooperadoId | String @unique |
| cooperativaId | String |
| saldoDisponivel | Decimal(10,4) default 0 |
| saldoPendente | Decimal(10,4) default 0 |
| totalEmitido | Decimal(10,4) default 0 |
| totalResgatado | Decimal(10,4) default 0 |
| totalExpirado | Decimal(10,4) default 0 |
| updatedAt | DateTime @updatedAt |
Map: `cooper_token_saldo`.

**ConfigCooperToken** (`schema.prisma:1935`) — **0 registros**
| Campo | Tipo | Default |
|---|---|---|
| id | String @id | |
| modoGeracao | String | "AMBOS" (PRE_COMPRA / COTA_MENSAL / AMBOS) |
| modeloVida | String | "AMBOS" (EXPIRACAO_29D / DECAY_CONTINUO / AMBOS) |
| limiteTokenMensal | Int? | |
| valorTokenReais | Decimal(10,2) | 0.45 |
| descontoMaxPerc | Decimal(5,2) | 30 |
| tetoCoop | Int? | |
| ativo | Boolean | true |
| cooperativaId | String @unique | |
| createdAt, updatedAt | DateTime | |
Map: `config_cooper_token`.

**CooperTokenSaldoParceiro** (`schema.prisma:1952`) — **0 registros**
| Campo | Tipo |
|---|---|
| id | String @id |
| cooperativaId | String @unique |
| saldoDisponivel | Decimal(10,4) default 0 |
| totalRecebido | Decimal(10,4) default 0 |
| totalUsadoEnergia | Decimal(10,4) default 0 |
| totalTransferido | Decimal(10,4) default 0 |
| totalComprado | Decimal(10,4) default 0 |
| updatedAt, createdAt | DateTime |
Map: `cooper_token_saldo_parceiro`.

**CooperTokenCompra** (`schema.prisma:1967`) — **0 registros**
| Campo | Tipo |
|---|---|
| id | String @id |
| cooperativaId | String |
| quantidade | Decimal(10,4) |
| valorTokenReais | Decimal(10,2) |
| valorTotal | Decimal(10,2) |
| formaPagamento | String (PIX / BOLETO) |
| status | String default "AGUARDANDO_PAGAMENTO" |
| dataPagamento | DateTime? |
| asaasId | String? |
| createdAt, updatedAt | DateTime |
Map: `cooper_token_compras`.

### Models Clube de Vantagens

**ConfigClubeVantagens** (`schema.prisma:1615`) — **1 registro**
| Campo | Tipo | Default |
|---|---|---|
| id | String @id | |
| cooperativaId | String @unique | |
| ativo | Boolean | false |
| criterio | String | "KWH_INDICADO_ACUMULADO" |
| niveisConfig | Json | "[]" |
| bonusAniversario | Float | 0 |
Map: `config_clube_vantagens`.

**ProgressaoClube** (`schema.prisma:1627`) — **1 registro**
| Campo | Tipo | Default |
|---|---|---|
| id | String @id | |
| cooperadoId | String @unique | |
| nivelAtual | String | "BRONZE" |
| kwhIndicadoAcumulado | Float | 0 |
| indicadosAtivos | Int | 0 |
| receitaIndicados | Float | 0 |
| beneficioPercentualAtual | Float | 0 |
| beneficioReaisKwhAtual | Float | 0 |
| kwhIndicadoMes | Float | 0 |
| mesReferenciaKwh | String? | |
| kwhIndicadoAno | Float | 0 |
| anoReferenciaKwh | String? | |
| dataUltimaPromocao | DateTime? | |
| dataUltimaAvaliacao | DateTime? | |
| createdAt | DateTime | |
| historico | HistoricoProgressao[] | |
Map: `progressoes_clube`.

**HistoricoProgressao** (`schema.prisma:1649`) — **0 registros**
| Campo | Tipo |
|---|---|
| id | String @id |
| progressaoId | String FK ProgressaoClube |
| nivelAnterior | String |
| nivelNovo | String |
| kwhAcumulado | Float |
| indicadosAtivos | Int |
| receitaAcumulada | Float |
| motivo | String? |
| createdAt | DateTime |
Map: `historico_progressao`.

**OfertaClube** (`schema.prisma:1985`) — **0 registros**
| Campo | Tipo |
|---|---|
| id | String @id |
| cooperativaId | String FK Cooperativa |
| titulo | String |
| descricao | String |
| quantidadeTokens | Int |
| beneficio | String |
| ativo | Boolean default true |
| validadeAte | DateTime? |
| estoque | Int? (null = ilimitado) |
| totalResgatado | Int default 0 |
| emoji | String? default "🎁" |
| createdAt, updatedAt | DateTime |
Indice: [cooperativaId, ativo]. Map: `ofertas_clube`.

**ResgateClubeVantagens** (`schema.prisma:2006`) — **0 registros**
| Campo | Tipo |
|---|---|
| id | String @id |
| cooperadoId | String FK Cooperado |
| ofertaId | String FK OfertaClube |
| cooperativaId | String |
| tokensUsados | Int |
| codigoResgate | String @unique |
| validado | Boolean default false |
| validadoEm | DateTime? |
| createdAt | DateTime |
Indices: [cooperadoId], [cooperativaId], [codigoResgate]. Map: `resgates_clube_vantagens`.

### Model Plano (campos CooperToken)

**Plano** (`schema.prisma:397`, linhas 426-436) contem campos de token por plano:
| Campo | Tipo | Default |
|---|---|---|
| cooperTokenAtivo | Boolean | false |
| tokenOpcaoCooperado | String | "AMBAS" |
| tokenValorTipo | String | "KWH_APURADO" |
| tokenValorFixo | Decimal(10,4)? | |
| tokenPorKwhExcedente | Decimal(5,4)? | |
| valorTokenReais | Decimal(10,2)? | |
| tokenExpiracaoMeses | Int? | |
| tokenDescontoMaxPerc | Decimal(5,2)? | |
| tokenSocialAtivo | Boolean | false |
| tokenFlexAtivo | Boolean | false |
| modoToken | String | "DESCONTO_DIRETO" |

**DUALIDADE CRITICA:** Existem duas fontes de configuracao de token — `ConfigCooperToken` (por cooperativa) e `Plano` (por plano de contrato). O service usa `Plano` para operacoes de cobranca/fatura e `ConfigCooperToken` para config admin e compras parceiro. Os campos se sobrepoe (valorTokenReais, descontoMaxPerc). Nenhum codigo faz merge entre os dois.

---

## SECAO 2 — BACKEND FILES

### backend/src/cooper-token/ (5 arquivos)

| Arquivo | Linhas* | Testes | Importado por |
|---|---|---|---|
| `cooper-token.service.ts` | ~1641 | NAO | cobrancas, faturas, indicacoes, clube-vantagens, publico |
| `cooper-token.controller.ts` | ~553 | NAO | (auto-registrado via module) |
| `cooper-token.job.ts` | ~155 | NAO | (controller chama diretamente) |
| `cooper-token.events.ts` | ~50 | NAO | service, financeiro-token.listener |
| `cooper-token.module.ts` | ~13 | NAO | app.module, cobrancas, faturas, indicacoes, clube-vantagens, publico |

*Linhas aproximadas baseadas na leitura dos arquivos.

**cooper-token.service.ts** — Metodos exportados:
| Metodo | Linha | Descricao |
|---|---|---|
| `creditar(params)` | :60 | Credita tokens com taxa 2%, idempotente por referenciaId |
| `debitar(params)` | :170 | Debita tokens do saldo, valida saldo suficiente |
| `calcularValorAtual(valorEmissao, createdAt)` | :216 | Decay: 100% ate 10d, 90% 11-20d, 75% 21-26d, 50% 27-29d, 0% apos |
| `getSaldo(cooperadoId)` | :222 | Retorna saldo + valor estimado atual |
| `calcularDesconto(params)` | :268 | Calcula tokens necessarios e desconto maximo em R$ |
| `expirarVencidos(cooperativaId)` | :290 | Expira ledgers CREDITO com expiracaoEm < now, lanca EXPIRACAO |
| `getExtrato(cooperadoId, page, limit)` | :392 | Extrato paginado do cooperado |
| `getLedger(cooperativaId, page, limit)` | :414 | Ledger admin paginado |
| `getResumoAdmin(cooperativaId)` | :434 | KPIs agregados para admin |
| `getCooperativaIdByCooperado(cooperadoId)` | :510 | Helper |
| `getConsolidado(cooperativaId, page, limit)` | :518 | Saldos de todos cooperados + totais mes |
| `enviarTokens(params)` | :563 | Doacao entre cooperados (sem taxa) |
| `getConfig(cooperativaId)` | :680 | Busca ConfigCooperToken |
| `upsertConfig(cooperativaId, data)` | :687 | Cria/atualiza ConfigCooperToken |
| `gerarQrPagamento(params)` | :716 | Gera JWT QR com 5min TTL (requer COOPERTOKEN_QR_SECRET) |
| `processarPagamentoQr(params)` | :751 | Processa QR: debita pagador, credita recebedor (taxa 1%) |
| `getSaldoParceiro(cooperativaId)` | :896 | Saldo do parceiro (cooperativa) |
| `getExtratoParceiro(cooperativaId, page, limit)` | :912 | Extrato parceiro |
| `usarTokensEnergia(params)` | :935 | Parceiro abate tokens em energia |
| `transferirTokensParceiro(params)` | :998 | Transfere tokens entre cooperativas |
| `processarQrParceiro(params)` | :1124 | QR especifico para parceiro |
| `usarNaFatura(params)` | :1177 | Cooperado usa tokens para desconto em cobranca |
| `comprarTokensParceiro(params)` | :1270 | Parceiro compra tokens (PIX/BOLETO) |
| `confirmarCompraParceiro(compraId)` | :1319 | Confirma pagamento e credita |
| `getCobrancasPendentesCooperado(cooperadoId, cooperativaId)` | :1368 | Lista cobrancas A_VENCER/VENCIDO |
| `listarSaldosParceiros()` | :1394 | SUPER_ADMIN: todos saldos parceiros |
| `creditarSaldoParceiro(cooperativaId, quantidade)` | :1405 | Credita no SaldoParceiro |
| `getFinanceiro(cooperativaId, periodo, ano, mes)` | :1442 | Relatorio financeiro completo |
| `getFluxoCaixa(cooperativaId)` | :1540 | Fluxo de caixa 12 meses |
| `getRendimentoCooperados(cooperativaId, limit)` | :1598 | Top cooperados por debitos |

**cooper-token.controller.ts** — 30 endpoints REST:
| Rota | Metodo | Roles | Linha |
|---|---|---|---|
| GET /cooper-token/saldo | getSaldo | COOPERADO,ADMIN,SUPER_ADMIN,OPERADOR | :29 |
| GET /cooper-token/extrato | getExtrato | COOPERADO,ADMIN,SUPER_ADMIN,OPERADOR | :38 |
| GET /cooper-token/admin/consolidado | getConsolidado | ADMIN,SUPER_ADMIN | :56 |
| POST /cooper-token/admin/creditar-manual | creditarManual | ADMIN,SUPER_ADMIN | :74 |
| GET /cooper-token/admin/ledger | getLedger | ADMIN,SUPER_ADMIN | :132 |
| GET /cooper-token/admin/resumo | getResumo | ADMIN,SUPER_ADMIN | :150 |
| GET /cooper-token/admin/financeiro | getFinanceiro | ADMIN,SUPER_ADMIN | :160 |
| GET /cooper-token/admin/fluxo-caixa | getFluxoCaixa | ADMIN,SUPER_ADMIN | :180 |
| GET /cooper-token/admin/rendimento-cooperados | getRendimentoCooperados | ADMIN,SUPER_ADMIN | :190 |
| POST /cooper-token/admin/processar | processar | ADMIN,SUPER_ADMIN | :206 |
| POST /cooper-token/gerar-qr-pagamento | gerarQrPagamento | COOPERADO+ | :217 |
| POST /cooper-token/processar-pagamento-qr | processarPagamentoQr | COOPERADO+ | :242 |
| POST /cooper-token/usar-na-fatura | usarNaFatura | COOPERADO+ | :269 |
| GET /cooper-token/cobrancas-pendentes | getCobrancasPendentes | COOPERADO+ | :296 |
| GET /cooper-token/admin/config | getConfig | ADMIN,SUPER_ADMIN | :312 |
| PUT /cooper-token/admin/config | upsertConfig | ADMIN,SUPER_ADMIN | :322 |
| GET /cooper-token/superadmin/config-defaults | getConfigDefaults | SUPER_ADMIN | :344 |
| PUT /cooper-token/superadmin/config-defaults | updateConfigDefaults | SUPER_ADMIN | :359 (501 NOT_IMPLEMENTED) |
| GET /cooper-token/parceiro/saldo | getSaldoParceiro | ADMIN,SUPER_ADMIN,OPERADOR,AGREGADOR | :368 |
| GET /cooper-token/parceiro/extrato | getExtratoParceiro | ADMIN,SUPER_ADMIN,OPERADOR,AGREGADOR | :378 |
| POST /cooper-token/parceiro/comprar | comprarTokens | ADMIN,SUPER_ADMIN,OPERADOR,AGREGADOR | :398 |
| POST /cooper-token/admin/confirmar-compra | confirmarCompra | ADMIN,SUPER_ADMIN | :421 |
| POST /cooper-token/parceiro/usar-energia | usarTokensEnergia | ADMIN,SUPER_ADMIN,OPERADOR,AGREGADOR | :433 |
| POST /cooper-token/parceiro/transferir | transferirTokensParceiro | ADMIN,SUPER_ADMIN,OPERADOR,AGREGADOR | :453 |
| POST /cooper-token/admin/processar-qr-parceiro | processarQrParceiro | ADMIN,SUPER_ADMIN,OPERADOR,AGREGADOR | :474 |
| GET /cooper-token/admin/parceiros/saldos | listarSaldosParceiros | SUPER_ADMIN | :498 |
| POST /cooper-token/parceiro/enviar | enviarTokens | ADMIN,SUPER_ADMIN,OPERADOR,AGREGADOR | :506 |

**cooper-token.job.ts** — 2 cron jobs (ver secao 3).

**cooper-token.events.ts** — 4 eventos de dominio consumidos por `FinanceiroTokenListener` (`financeiro/financeiro-token.listener.ts:13`).

### backend/src/clube-vantagens/ (4 arquivos)

| Arquivo | Linhas* | Testes | Importado por |
|---|---|---|---|
| `clube-vantagens.service.ts` | ~858 | NAO | indicacoes, cobrancas |
| `clube-vantagens.controller.ts` | ~168 | NAO | (auto-registrado via module) |
| `clube-vantagens.job.ts` | ~85 | NAO | (cron interno) |
| `clube-vantagens.module.ts` | ~16 | NAO | app.module, indicacoes, cobrancas |

**clube-vantagens.service.ts** — Metodos exportados:
| Metodo | Linha | Descricao |
|---|---|---|
| `criarOuObterProgressao(cooperadoId)` | :34 | Cria ProgressaoClube se nao existe |
| `avaliarProgressao(cooperadoId)` | :48 | Avalia e promove nivel (nunca rebaixa) |
| `atualizarMetricas(cooperadoId, deltaKwh, deltaReceita)` | :144 | Incrementa kWh/receita com reset mensal/anual |
| `getProgressao(cooperadoId)` | :182 | Retorna progressao + historico |
| `recalcularIndicadosAtivos(cooperadoId)` | :189 | Conta indicacoes PRIMEIRA_FATURA_PAGA |
| `upsertConfig(cooperativaId, dto)` | :208 | Valida ranges/sobreposicao e salva config |
| `getConfig(cooperativaId)` | :276 | Busca ConfigClubeVantagens |
| `getRanking(cooperativaId, cooperadoLogadoId)` | :282 | Top 10 por kwhIndicadoAcumulado |
| `getAnalytics(cooperativaId)` | :340 | Totais + distribuicao por nivel |
| `getRankingPorPeriodo(cooperativaId, cooperadoLogadoId, periodo)` | :385 | Ranking filtrado por mes/ano/total |
| `getEvolucaoMensalNiveis(cooperativaId, meses)` | :441 | Promocoes por mes para grafico |
| `getFunilConversao(cooperativaId)` | :474 | Funil indicacao -> clube |
| `gerarResumoMensalCooperado(cooperadoId)` | :536 | Gera e envia resumo WA individual |
| `enviarResumosMensaisLote()` | :581 | Envia resumos para todos com indicados |
| `notificarPontosGanhos(telefone, pontosGanhos, totalAcumulado)` | :610 | WA: pontos ganhos |
| `notificarNovoNivel(telefone, nivel)` | :624 | WA: novo nivel |
| `resumoMensalPontos(cooperadoId)` | :634 | Texto resumo para notificacao |
| `listarOfertas(cooperativaId)` | :653 | Ofertas ativas para cooperado |
| `listarOfertasAdmin(cooperativaId)` | :667 | Todas ofertas para admin |
| `criarOferta(cooperativaId, dto)` | :674 | Cria oferta |
| `atualizarOferta(cooperativaId, ofertaId, dto)` | :701 | Atualiza oferta |
| `resgatarOferta(cooperadoId, cooperativaId, ofertaId)` | :733 | Resgate atomico: valida estoque, debita tokens, gera UUID |
| `validarResgate(cooperativaId, codigoResgate)` | :807 | Admin valida codigo de resgate |
| `meusResgates(cooperadoId)` | :850 | Lista resgates do cooperado |

**clube-vantagens.controller.ts** — 14 endpoints:
| Rota | Metodo | Roles | Linha |
|---|---|---|---|
| GET /clube-vantagens/config | getConfig | SUPER_ADMIN,ADMIN | :12 |
| PUT /clube-vantagens/config | upsertConfig | SUPER_ADMIN,ADMIN | :23 |
| GET /clube-vantagens/minha-progressao | getMinhaProgressao | COOPERADO,ADMIN,SUPER_ADMIN | :32 |
| GET /clube-vantagens/cooperado/:id | getProgressaoCooperado | SUPER_ADMIN,ADMIN | :46 |
| GET /clube-vantagens/ranking | getRanking | COOPERADO,ADMIN,SUPER_ADMIN | :59 |
| GET /clube-vantagens/analytics | getAnalytics | SUPER_ADMIN,ADMIN | :72 |
| GET /clube-vantagens/analytics/mensal | getAnalyticsMensal | SUPER_ADMIN,ADMIN | :82 |
| GET /clube-vantagens/analytics/funil | getAnalyticsFunil | SUPER_ADMIN,ADMIN | :92 |
| GET /clube-vantagens/ofertas | listarOfertas | COOPERADO,ADMIN,SUPER_ADMIN | :100 |
| GET /clube-vantagens/ofertas/admin | listarOfertasAdmin | SUPER_ADMIN,ADMIN | :109 |
| POST /clube-vantagens/ofertas | criarOferta | SUPER_ADMIN,ADMIN | :118 |
| PUT /clube-vantagens/ofertas/:id | atualizarOferta | SUPER_ADMIN,ADMIN | :127 |
| POST /clube-vantagens/resgatar | resgatar | COOPERADO | :138 |
| GET /clube-vantagens/meus-resgates | meusResgates | COOPERADO,ADMIN,SUPER_ADMIN | :150 |
| POST /clube-vantagens/validar-resgate | validarResgate | SUPER_ADMIN,ADMIN | :159 |

**Nenhum dos 9 arquivos .ts tem arquivo .spec.ts correspondente.** Zero testes unitarios.

---

## SECAO 3 — CRON JOBS

### CooperToken

| Arquivo:Linha | Expressao | Metodo | Descricao |
|---|---|---|---|
| `cooper-token.job.ts:20` | `0 6 * * *` | `apurarExcedentes()` | Diariamente as 6h: busca FaturaProcessada APROVADA com tokenApurado=false e plano cooperTokenAtivo=true, calcula excedente (kwhGerado - cotaKwh), credita tokens GERACAO_EXCEDENTE. Marca tokenApurado=true. |
| `cooper-token.job.ts:120` | `0 2 1 * *` | `expirarTokensVencidos()` | Dia 1 de cada mes as 2h: itera cooperativas ativas, expira ledgers CREDITO com expiracaoEm < now, cria ledger EXPIRACAO, atualiza saldo. |

### Clube de Vantagens

| Arquivo:Linha | Expressao | Metodo | Descricao |
|---|---|---|---|
| `clube-vantagens.job.ts:15` | `0 9 1 * *` | `enviarResumosMensais()` | Dia 1 de cada mes as 9h: envia resumo mensal WA para cooperados com indicadosAtivos > 0. **BLOQUEADO** por env var `CLUBE_RESUMO_MENSAL_HABILITADO !== 'true'`. Delay 3-5s entre envios. |

---

## SECAO 4 — FRONTEND PAGES

### Dashboard (area admin)

**`web/app/dashboard/cooper-token/page.tsx`** (~462 linhas)
- Exibe: KPIs (total emitido, em circulacao, expirados, emitido mes), config do plano, emissao manual com busca de cooperado, ledger de transacoes paginado.
- APIs: `GET /cooper-token/admin/resumo`, `GET /cooper-token/admin/ledger`, `POST /cooper-token/admin/processar`, `POST /cooper-token/admin/creditar-manual`, `GET /cooperados`.
- Status: **FUNCIONAL** — UI completa com paginacao, emissao manual, badges de operacao/tipo.

**`web/app/dashboard/cooper-token-parceiro/page.tsx`** (~381 linhas)
- Exibe: Saldo parceiro (disponivel, recebido, energia, transferido), form "usar tokens para energia", form "transferir para outro parceiro" com busca, extrato paginado.
- APIs: `GET /cooper-token/parceiro/saldo`, `GET /cooper-token/parceiro/extrato`, `POST /cooper-token/parceiro/usar-energia`, `POST /cooper-token/parceiro/transferir`, `GET /cooperativas`.
- Status: **FUNCIONAL** — UI completa.

**`web/app/dashboard/cooper-token-financeiro/page.tsx`** (~300 linhas)
- Exibe: KPIs (passivo total, receita parceiros, custo resgates, receita expiracao), grafico fluxo de caixa 12 meses (BarChart), tabela top 10 cooperados por economia. Filtros: periodo (mes/trimestre/ano), mes, ano.
- APIs: `GET /cooper-token/admin/financeiro`, `GET /cooper-token/admin/fluxo-caixa`, `GET /cooper-token/admin/rendimento-cooperados`.
- Status: **FUNCIONAL** — UI completa com graficos Recharts.

**`web/app/dashboard/clube-vantagens/page.tsx`** (~303 linhas)
- Exibe: KPIs (membros, indicados ativos, receita, kWh total), PieChart distribuicao por nivel, BarChart evolucao mensal, top 10 indicadores, funil de conversao (heatmap).
- APIs: `GET /clube-vantagens/analytics`, `GET /clube-vantagens/analytics/mensal`, `GET /clube-vantagens/analytics/funil`.
- Status: **FUNCIONAL** — Dashboard analitico completo.

**`web/app/dashboard/clube-vantagens/config/page.tsx`** (~281 linhas)
- Exibe: Toggle ativo, seletor criterio (KWH_INDICADO_ACUMULADO / NUMERO_INDICADOS_ATIVOS / RECEITA_INDICADOS), tabela de niveis editavel (BRONZE/PRATA/OURO/DIAMANTE com min/max/beneficio%/R$kWh), bonus aniversario.
- APIs: `GET /clube-vantagens/config`, `PUT /clube-vantagens/config`, `GET /cooperativas`.
- Status: **FUNCIONAL** — Suporta SUPER_ADMIN com seletor de cooperativa.

**`web/app/dashboard/clube-vantagens/ranking/page.tsx`** (~188 linhas)
- Exibe: Ranking top 10 com seletor de periodo (mes/ano/total), grafico de barras horizontal por kWh, tabela com badges de nivel, posicao do cooperado logado.
- APIs: `GET /clube-vantagens/ranking?periodo=X`.
- Status: **FUNCIONAL**.

### Portal (area cooperado)

**`web/app/portal/tokens/page.tsx`** (~370 linhas)
- Exibe: Saldo disponivel, lista de cobrancas pendentes com botao "usar tokens" (modal inline), gerador de QR Code com countdown de 5min.
- APIs: `GET /cooper-token/saldo`, `GET /cooper-token/cobrancas-pendentes`, `POST /cooper-token/usar-na-fatura`, `POST /cooper-token/gerar-qr-pagamento`.
- Status: **FUNCIONAL** — Usa `qrcode.react` para QR Code.

**`web/app/portal/clube/page.tsx`** (~264 linhas)
- Exibe: Saldo CTK, catalogo de ofertas com botao resgatar (com confirmacao), modal de resultado com codigo UUID, lista "meus resgates" com status validado/pendente.
- APIs: `GET /clube-vantagens/ofertas`, `GET /cooper-token/saldo`, `GET /clube-vantagens/meus-resgates`, `POST /clube-vantagens/resgatar`.
- Status: **FUNCIONAL** — Fluxo completo de resgate.

**`web/app/portal/ranking/page.tsx`** (~156 linhas)
- Exibe: Ranking top 10, posicao do cooperado logado (fora do top), badges de nivel.
- APIs: `GET /clube-vantagens/ranking`.
- Status: **FUNCIONAL** — Sem seletor de periodo (diferente do dashboard).

---

## SECAO 5 — FLUXOS DE EMISSAO (CREDITO)

Todos os pontos onde `cooperTokenLedger.create` com operacao CREDITO ocorre, direta ou indiretamente via `cooperTokenService.creditar()`:

| # | Arquivo:Linha | Tipo | Trigger | Em producao? |
|---|---|---|---|---|
| 1 | `cooper-token.service.ts:135` | Dinamico (param) | Chamado por todos os creditar() abaixo | SIM — metodo central |
| 2 | `cooper-token.job.ts:89` | GERACAO_EXCEDENTE | Cron 6h: fatura APROVADA com excedente | SIM (cron ativo) |
| 3 | `cobrancas.service.ts:140` | FATURA_CHEIA | Geracao de cobranca quando modoToken=FATURA_CHEIA_TOKEN | SIM (automatico) |
| 4 | `faturas.service.ts:1000` | GERACAO_EXCEDENTE | Aprovacao de fatura (kwhCompensado > 0, tokenValorTipo=KWH_APURADO ou FIXO) | SIM (automatico) |
| 5 | `faturas.service.ts:1033` | GERACAO_EXCEDENTE | Aprovacao de fatura (excedente: creditosRecebidosKwh > kwhContrato) | SIM (automatico) |
| 6 | `indicacoes.service.ts:352` | BONUS_INDICACAO | Processamento de indicacao PRIMEIRA_FATURA_PAGA | SIM (automatico) |
| 7 | `cooper-token.controller.ts:115` | GERACAO_EXCEDENTE/BONUS_INDICACAO/SOCIAL | POST /admin/creditar-manual | SIM (manual admin) |
| 8 | `cooper-token.controller.ts:530` | BONUS_INDICACAO | POST /parceiro/enviar (quando admin sem cooperadoId) | SIM (manual admin) |
| 9 | `cooper-token.service.ts:653` | BONUS_INDICACAO | enviarTokens() — doacao recebida (DOACAO_RECEBIDA) | SIM |
| 10 | `cooper-token.service.ts:862` | PAGAMENTO_QR | processarPagamentoQr() — credito no recebedor | SIM |
| 11 | `cooper-token.service.ts:1095` | PAGAMENTO_QR | transferirTokensParceiro() — credito no parceiro destinatario | SIM |
| 12 | `cooper-token.service.ts:355` | Herda tipo original | expirarVencidos() — cria ledger EXPIRACAO (nao e credito, e registro de expiracao) | SIM |

**Obs:** Linhas 614 e 821 sao ledgers de DOACAO_ENVIADA e DEBITO (pagamento QR pagador), nao creditos.

---

## SECAO 6 — FLUXOS DE DEBITO

| # | Arquivo:Linha | Trigger | UI? | Funciona? |
|---|---|---|---|---|
| 1 | `cooper-token.service.ts:195` | `debitar()` central — chamado por todos abaixo | Indireto | SIM |
| 2 | `cobrancas.service.ts:175` | Geracao de cobranca com modoToken=DESCONTO_DIRETO e tokenDescontoMaxPerc > 0 | Automatico | SIM — desconto automatico na fatura |
| 3 | `cooper-token.service.ts:1229` | `usarNaFatura()` — cooperado aplica tokens manualmente em cobranca | Portal: `/portal/tokens` | SIM |
| 4 | `clube-vantagens.service.ts:755` | `resgatarOferta()` — cooperado resgata oferta do clube | Portal: `/portal/clube` | SIM — tipo FLEX hardcoded |
| 5 | `cooper-token.service.ts:607-613` | `enviarTokens()` — remetente sofre debito (DOACAO_ENVIADA) | Indireto via parceiro/enviar | SIM |
| 6 | `cooper-token.service.ts:821` | `processarPagamentoQr()` — pagador sofre debito (PAGAMENTO_QR) | Portal QR | SIM |
| 7 | `cooper-token.service.ts:975` | `usarTokensEnergia()` — parceiro abate em energia (ABATIMENTO_ENERGIA) | Dashboard parceiro | SIM |
| 8 | `cooper-token.service.ts:1082` | `transferirTokensParceiro()` — remetente parceiro (TRANSFERENCIA_PARCEIRO) | Dashboard parceiro | SIM |

---

## SECAO 7 — DECISOES PENDENTES

### 7.1 Dualidade ConfigCooperToken vs Plano

**Problema critico:** Existem duas fontes de verdade para configuracao de tokens:

1. **`ConfigCooperToken`** (`schema.prisma:1935`) — por cooperativa. Campos: `modoGeracao`, `modeloVida`, `limiteTokenMensal`, `valorTokenReais`, `descontoMaxPerc`, `tetoCoop`, `ativo`. Tem **0 registros** no banco. Usado por:
   - `cooper-token.service.ts:680` (getConfig)
   - `cooper-token.service.ts:381` (expirarVencidos fallback)
   - `cooper-token.service.ts:1285` (comprarTokensParceiro)
   - `indicacoes.service.ts:347` (bonusIndicacao — campo `bonusIndicacao` que NAO existe no model)

2. **`Plano`** (`schema.prisma:426-436`) — por plano de contrato. Campos token: `cooperTokenAtivo`, `tokenOpcaoCooperado`, `tokenValorTipo`, `tokenValorFixo`, `tokenPorKwhExcedente`, `valorTokenReais`, `tokenExpiracaoMeses`, `tokenDescontoMaxPerc`, `tokenSocialAtivo`, `tokenFlexAtivo`, `modoToken`. Usado em:
   - `cobrancas.service.ts:125` (geracao de cobranca)
   - `faturas.service.ts:985,1024` (aprovacao de fatura)
   - `cooper-token.service.ts:473-508` (getResumoAdmin)
   - `cooper-token.service.ts:1471-1606` (getFinanceiro, getFluxoCaixa, getRendimentoCooperados)
   - `cooper-token.job.ts:33` (apurarExcedentes)

**Decisao necessaria:** Unificar ou documentar qual fonte prevalece em cada cenario. Hoje `ConfigCooperToken` esta **vazio** — toda logica real usa `Plano`.

### 7.2 Endpoint superadmin/config-defaults

`cooper-token.controller.ts:362` — PUT /superadmin/config-defaults retorna 501 NOT_IMPLEMENTED (SEC-NEW-001). O GET retorna hardcoded defaults. Nao ha logica para propagar defaults globais para novas cooperativas.

### 7.3 bonusAniversario nao implementado

`clube-vantagens.service.ts:212,264,271` — Campo `bonusAniversario` e salvo na config e exibido no frontend (`config/page.tsx:266-276`), mas **nenhum codigo aplica o bonus**. Nao existe cron ou trigger que verifique data de nascimento do cooperado e aplique bonus extra.

### 7.4 bonusIndicacao no ConfigCooperToken

`indicacoes.service.ts:350` — Acessa `(configToken as any)?.bonusIndicacao` que **NAO existe** no model `ConfigCooperToken`. O campo `bonusIndicacao` nao esta no schema. Fallback para 50 tokens. Decisao: adicionar campo ao schema ou usar Plano.

### 7.5 tokenSocialAtivo e tokenFlexAtivo sem uso

`schema.prisma:434-435` — Campos `tokenSocialAtivo` e `tokenFlexAtivo` existem no Plano mas **nenhum codigo do backend consulta esses campos** para decidir se deve emitir tokens SOCIAL ou FLEX. O tipo SOCIAL so e emitido via creditar-manual. O tipo FLEX so e usado como tipo de debito no resgate de oferta (`clube-vantagens.service.ts:759`).

### 7.6 modoGeracao e modeloVida sem uso

`ConfigCooperToken.modoGeracao` (PRE_COMPRA / COTA_MENSAL / AMBOS) e `modeloVida` (EXPIRACAO_29D / DECAY_CONTINUO / AMBOS) estao no schema e na UI admin, mas **nenhum codigo os consulta** para alterar comportamento. A expiracao e sempre baseada em `expiracaoMeses` (default 12). O decay de valor (`calcularValorAtual`, linha 216) e hardcoded com thresholds fixos de 10/20/26/29 dias.

### 7.7 Fallback 0.45 hardcoded

`valorTokenReais` tem fallback `?? 0.45` em **26+ locais** no codigo:
- `cooper-token.service.ts:253,271,381,490,1224,1285,1476,1557,1606`
- `cobrancas.service.ts:134`
- `faturas.service.ts:1038`

Se nenhum plano/config define valor, R$ 0,45 e usado. Isso deveria ser uma constante nomeada.

### 7.8 Zero testes

Nenhum dos 9 arquivos backend (5 cooper-token + 4 clube-vantagens) possui arquivo `.spec.ts`. Cobertura de testes: **0%**.

### 7.9 COOPERTOKEN_QR_SECRET

`cooper-token.service.ts:734,758` — QR Code requer `COOPERTOKEN_QR_SECRET` com minimo 32 caracteres. Se nao configurado, `gerarQrPagamento` e `processarPagamentoQr` lancam BadRequestException. Nao verificado no startup.

### 7.10 CLUBE_RESUMO_MENSAL_HABILITADO

`clube-vantagens.job.ts:18` — Cron de resumo mensal WA esta **bloqueado** por default. Requer `CLUBE_RESUMO_MENSAL_HABILITADO=true` no `.env`. Decisao explicita de Luciano necessaria.

### 7.11 Operacao RESGATE_CLUBE definida mas nao usada

`CooperTokenOperacao.RESGATE_CLUBE` existe no enum (`schema.prisma:1834`) mas o resgate de oferta em `clube-vantagens.service.ts:755` chama `debitar()` que usa o tipo default (GERACAO_EXCEDENTE via `params.tipo ?? CooperTokenTipo.GERACAO_EXCEDENTE`, linha 199). Ou seja, resgates sao registrados como DEBITO/GERACAO_EXCEDENTE em vez de usar RESGATE_CLUBE.

**Correcao sugerida:** `clube-vantagens.service.ts:759` passa `tipo: 'FLEX'` mas o `operacao` resultante e DEBITO (via `debitar()`). O enum RESGATE_CLUBE nunca e usado em nenhum lugar do codigo.

### 7.12 limiteTokenMensal e tetoCoop sem uso

`ConfigCooperToken.limiteTokenMensal` e `tetoCoop` estao no schema e expostos na UI admin (PUT config), mas **nenhum codigo verifica esses limites** antes de creditar tokens. Um cooperado ou cooperativa pode receber tokens ilimitados.

### 7.13 saldoPendente sem uso

`CooperTokenSaldo.saldoPendente` (`schema.prisma:1868`) existe no schema com default 0, mas **nenhum codigo escreve nesse campo**. Sempre zero.

### 7.14 Ofertas sem relacao com nivel do Clube

As ofertas (`OfertaClube`) nao tem campo `nivelMinimo`. Qualquer cooperado com tokens suficientes pode resgatar qualquer oferta, independente do nivel no Clube de Vantagens. Os dois sistemas (Clube de niveis e Ofertas de resgate) estao desconectados — o nivel do clube nao influencia quais ofertas estao disponiveis.
