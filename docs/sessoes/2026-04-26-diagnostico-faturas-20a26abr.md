# Diagnóstico — Faturas IMAP CoopereBR (20/04 → 26/04/2026)

**Gerado em:** 26/04/2026, 18:29:59
**Janela:** 2026-04-20T03:00:00.000Z → 2026-04-27T02:59:59.000Z (TZ servidor: America/Sao_Paulo)

## Sumário executivo

| Métrica | Valor |
|---|---|
| Emails na janela | 42 |
| Com PDF anexo | 13 |
| Passaram filtro de fatura | 13 |
| Processadas (OCR) | 13 |
| OCR sucesso | 13 |
| OCR falha | 0 |
| UC resolvida (cooperado encontrado) | 0 |
| UC não resolvida (lead potencial) | 0 |
| Custo OCR estimado | $1.56 |
| Planos CoopereBR ativos | 2 |
| BLOQUEIO_MODELOS_NAO_FIXO | false |

## Planos da CoopereBR (cadastrados)

| ID | Nome | Modelo | Desconto base | Base cálculo | Referência |
|---|---|---|---|---|---|
| dqqg34fm | Plano Condomínio Básico | FIXO_MENSAL | 20% | KWH_CHEIO | MEDIA_3M |
| fwydmqjm | Plano Individual Residencial | FIXO_MENSAL | 18% | KWH_CHEIO | MEDIA_3M |

## Faturas sem UC cadastrada (leads potenciais)

| Remetente | Assunto | UC orig (OCR) | Distribuidora | Valor |
|---|---|---|---|---|
| <edpcontaporemail@edpbr.com.br> | EDP - FATURAS | 0.001.563.510.054-34 | EDP_ES | R$ 772.15 |
| <edpcontaporemail@edpbr.com.br> | EDP - FATURAS | 0.000.886.403.054-54 | EDP_ES | R$ 1578.95 |
| <edpdocumentoporemail@edpbr.com.br> | EDP - CARTA MEDIÇÃO DE TENSÃO | 0.002.410.013.054-78 | EDP_ES | R$ 0.00 |
| <edpcontaporemail@edpbr.com.br> | EDP - FATURAS | 0.001.608.748.054-94 | EDP_ES | R$ 1019.26 |
| <edpcontaporemail@edpbr.com.br> | EDP - FATURAS | 0.001.100.718.054-06 | EDP_ES | R$ 436.40 |
| <edpcontaporemail@edpbr.com.br> | EDP - FATURAS | 0.000.723.545.054-74 | EDP_ES | R$ 229.56 |
| <edpcontaporemail@edpbr.com.br> | EDP - FATURAS | 0.002.361.406.054-47 | EDP_ES | R$ 872.76 |
| <edpcontaporemail@edpbr.com.br> | EDP - FATURAS | 0.000.596.185.054-94 | EDP_ES | R$ 431.07 |
| <edpcontaporemail@edpbr.com.br> | EDP - FATURAS | 0.001.074.358.054-38 | EDP_ES | R$ 429.51 |
| <edpcontaporemail@edpbr.com.br> | EDP - FATURAS | 0.000.443.647.054-06 | EDP_ES | R$ 528.70 |
| <edpcontaporemail@edpbr.com.br> | EDP - FATURAS | 0.002.222.000.054-05 | EDP_ES | R$ 536.64 |
| <edpcontaporemail@edpbr.com.br> | EDP - FATURAS | 0.000.071.898.054-01 | EDP_ES | R$ 401.25 |
| <edpcontaporemail@edpbr.com.br> | EDP - FATURAS | 0.002.222.060.054-09 | EDP_ES | R$ 725.43 |

## Observações finais

- Pipeline read-only confirmou: pegou 13 faturas via IMAP, OCR 13 sucessos, 0 matches em UC.
- ⚠ Apenas 2 planos cadastrados na CoopereBR (prompt assumiu 9 — ajustar expectativa).
- ✅ Modelos não-FIXO permitidos.

## Próximos passos sugeridos

1. Luciano valida visualmente cada projeção: bate com o esperado?
2. Se houver divergência grande entre projetado e cobrança real: investigar fórmula no Motor de Proposta.
3. Leads potenciais (sem UC): definir fluxo (admin contacta? auto-email "venha se cadastrar"?).
4. Cadastrar mais planos se for o caso (hoje só 2).
