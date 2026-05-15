# Sessão 2026-05-15 — Bloco A Sub-Fase B AMAGES (engine COMPENSADOS E2E)

## TL;DR

Sub-Fase B AMAGES fechada em 1 sessão Code dedicada. Marco M4 redefinido para "1ª validação engine COMPENSADOS em ambiente real". Cadastrei AMAGES (5º cooperado piloto PJ — Associação dos Magistrados do Espírito Santo) com 2 UCs reais (PUTIRI A4 VERDE + SEDE ADM B3 CONVENCIONAL) extraídas de PDFs EDP mar/2026 reais. Engine COMPENSADOS gerou cobrança de R$ 979,20 via `PATCH /faturas/<id>/aprovar` HTTP real — 6/6 campos batem com expectativa. D-46.SEED resolvido permanente.

## Decisões da sessão

1. **Opção A confirmada** (AMAGES = cooperado piloto da CoopereBR, não 2ª cooperativa)
2. **D-46.SEED — `publico=false` PERMANENTE** (não religar — planos legados sem `tarifaContratual` snapshot seriam armadilha em vitrine pública)
3. **Marco M4 redefinido** de "2ª cooperativa real" para "1ª validação engine COMPENSADOS em ambiente real"
4. **Dados extraídos das faturas reais** em `C:/Users/Luciano/Downloads/` (3 PDFs)

## Entregas

### Estrutura criada no banco

| Item | ID | Observação |
|---|---|---|
| Cooperado AMAGES PJ | `cmp7034d70002vaf0af5ws4ud` | CNPJ 27.053.685/0001-90, tipoPessoa=PJ, ambienteTeste=false |
| UC PUTIRI | `cmp7034mq0005vaf0ezhwetvu` | numeroConcessionariaOriginal `0.001.334.421.054-40`, A4 VERDE, Aracruz/ES, medidor 0018126202 |
| UC SEDE ADM | `cmp7034v80007vaf09q0px8tn` | numeroConcessionariaOriginal `0.002.399.394.054-06`, B3 CONVENCIONAL, Vitória/ES, medidor 0017600268 |
| Plano AMAGES COMPENSADOS | `cmp7035400008vaf0uaj0xqrs` | descontoBase 18%, publico=false, cooperativaId CoopereBR |
| Contrato CTR-2026-0008 | `cmp7035il000avaf01hu9np3d` | Usina Linhares EDP_ES, kWh anual 101.028, mensal 8.419, percentualUsina 5,6127%, tarifaContratual R$ 0,19557 |
| FaturaProcessada mar/2026 | `cmp7035sp000cvaf0suoshazr` | SEDE ADM, consumo 6.935 kWh, créditos 5.006,89 kWh, valorTotal R$ 1.653,98, valorCheioKwh R$ 0,2385 |
| Cobrança mar/2026 | `cmp704sa00001va903qwikwvp` | modeloUsado=CREDITOS_COMPENSADOS, valorLiquido R$ 979,20 |
| LancamentoCaixa | `cmp704sk30003va907443gg08` | PREVISTO R$ 979,20, competência 2026-03 |

### Validação engine COMPENSADOS (6/6 PASS)

| Campo | Esperado | Obtido | ✓ |
|---|---|---|---|
| modeloCobrancaUsado | CREDITOS_COMPENSADOS | CREDITOS_COMPENSADOS | ✅ |
| kwhCompensado | 5006.89 | 5006.89 | ✅ |
| tarifaContratualAplicada | 0.19557 | 0.19557 | ✅ |
| valorBruto | 1194.14 | 1194.14 | ✅ |
| valorDesconto | 214.94 | 214.94 | ✅ |
| valorLiquido | 979.20 | 979.20 | ✅ |

Cálculo: `valorLiquido = 5.006,89 kWh × R$ 0,19557 = R$ 979,20` (kwhCompensado × tarifaContratual pós-18% desconto). Confere com Engine COMPENSADOS em `faturas.service.ts:1994`.

### Ciclo BLOQUEIO_MODELOS_NAO_FIXO

| Passo | Ação | Resultado |
|---|---|---|
| 2 (off) | `pm2 stop` → `.env BLOQUEIO=false` → `npm run build` → `pm2 restart --update-env` | Backend online PID 4212, engine COMPENSADOS desbloqueada |
| 7 | `PATCH /faturas/<id>/aprovar` via JWT admin | HTTP 200, cobrança gerada |
| 8 (on) | `pm2 stop` → `.env BLOQUEIO=true` → `npm run build` → `pm2 restart --update-env` | Backend online PID 24728, engine COMPENSADOS volta a estar bloqueada (segurança runtime padrão) |

## Commits da sessão

- `ccde5ec` — fix(planos): D-46.SEED RESOLVIDO — 5 planos COMPENSADOS publico=false permanente
- `a09a66e` — feat(canario): Bloco A Sub-Fase B AMAGES E2E real — engine COMPENSADOS validada
- *(este commit)* — docs(sessao): fechamento Bloco A 15/05

## Débitos resolvidos

- **D-46.SEED** ✅ RESOLVIDO permanente (5 planos `publico=false`)
- **Engine COMPENSADOS sem validação E2E real** ✅ RESOLVIDO (cobrança AMAGES R$ 979,20)
- **D-54 (LancamentoCaixa PREVISTO)** ✅ não ressurgiu — LancamentoCaixa criado automaticamente após cobrança

## Bugs descobertos durante validação

- Nenhum. A engine COMPENSADOS funcionou first-try com os snapshots corretos (`tarifaContratual` no contrato + `valorCheioKwh` na fatura + `creditosRecebidosKwh` em `dadosExtraidos`).

## Achados laterais

- **`Usina.capacidadeKwh = 150000`** — interpretação ambígua (mensal ou anual?). Usei MENSAL: `percentualUsina = (kwh mensal médio / 150000) × 100 = 5,6127%`. AMAGES com kWh anual 101.028 fica abaixo do limite 25% D-30A se usar interpretação mensal. **Catalogar** revisão da unidade `capacidadeKwh` no schema (P3).
- **`numeroUC` (9 dígitos legado)** — derivado heurístico do `numeroConcessionariaOriginal` ("0.001.334.421.054-40" → "133442105"). EDP pode ter formato distinto. **Catalogar** sub-débito (P3) sobre validação posterior contra portal EDP B2B.
- **Saldo de créditos PUTIRI** (6.828,53 kWh) e **SEDE ADM** (3.164,67 kWh) não estão sendo persistidos em modelo dedicado — só capturados em `FaturaProcessada.saldoKwhAnterior/Atual`. Falta tabela `SaldoCreditos` cooperado-UC. **Catalogar** novo débito para engine COMPENSADOS multi-mês.

## Pendências abertas pra próxima sessão

**Bloco H — Cadastro Usina expandido** (6-10h Code). Adicionar campos:
- `classeGd` (GD I / GD II / GD III) — mitiga risco P0 D-30A/D-30B Exfishes R$ 310k/ano
- `formaAquisicao` (PRÓPRIA / ARRENDADA / PARCERIA)
- `formaPagamentoDono` (mensal / por kWh / sem pagamento)
- `endereco` completo (CEP, logradouro, número, complemento, bairro, cidade, estado)
- Seletor cooperado-dono na UI (já tem o relacionamento `proprietarioCooperadoId`, falta UI)

Destrava Bloco E (realocação multi-usina) + Bloco F (automação concessionária).

## Aprendizados

- **Fase 1 read-only obrigatória pegou ambiguidade** "AMAGES = cooperado ou cooperativa?" antes de qualquer mutação. Confirmou hipótese da Opção A com Luciano antes de touch.
- **PDFs reais valem muito** — Downloads/ tinha 3 PDFs AMAGES (1 IRRF Unimed + 2 faturas EDP mar/2026) suficientes pra extrair CNPJ + razão social + endereços + UCs + consumo histórico 12m + MMGD + tarifas. Sem inventar dados.
- **Engine COMPENSADOS exige snapshot `tarifaContratual` no contrato** (Decisão B33, 03/05/2026). Sem isso, `gerarCobrancaPosFatura` lança BadRequestException. Documentado em `faturas.service.ts:1984`.
- **`PATCH /faturas/<id>/aprovar`** é o entry-point real da engine — não `gerarCobrancaPosFatura` diretamente. Testar via HTTP real (Nest stack completo + APP_INTERCEPTOR AuditLog + Roles guard) valida bem mais do que chamada direta ao service.

## Próximo passo único

**Bloco H — Cadastro Usina expandido** (6-10h). Frase comandante única em `docs/CONTROLE-EXECUCAO.md` seção "FRASE DE RETOMADA".
