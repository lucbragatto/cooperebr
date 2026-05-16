# Sessão 2026-05-16 — Bloco H' (Cadastro Usina expandido modularizado)

## TL;DR

Marco M5 entregue. Schema `Usina` expandido com 11 campos novos (apelidoInterno + endereço completo + cnpjUsina + formaAquisicao + formaPagamentoDono + valorAluguelFixo + percentualGeracaoDono + numeroContratoEdp + dataContratoEdp) e 2 enums (`FormaAquisicao`, `FormaPagamentoDono`). **`classeGd`, `RegrasFioB` e guards de classificação NÃO foram adicionados** — ficam em Sprint "Módulo Classificação GD" separado, plugável pós-dossiê judicial CoopereBR×EDP. AMAGES saneada (`ambienteTeste=true`, referência externa). Exfishes CTR-000134 saneado (kwhContratoAnual=720.000, percentualUsina=8%) e migrado pra Cooperebr2. Cooperebr2 cadastrada (Linhares 2, 1.000 kWp, 157.000 kWh, EDP_ES, CUSD EDP-ES-04123/2025). Cooperebr1 apelidada. UI cadastro usina estendida com campos condicionais.

## Decisões Luciano (16/05)

1. **Modularização** — Bloco H original dividido em H' (cadastro essencial, sem classificação) + Sprint Módulo Classificação GD (futuro). Motivo: litígio CoopereBR×EDP em curso exige sistema neutro sobre classe GD.
2. **AMAGES Opção A** — `ambienteTeste=true` (preserva smoke histórico M4).
3. **Exfishes saneamento** — `kwhContratoAnual=720.000` (60.000/mês × 12, meio termo entre média histórica 647.880 e nota técnica 880.800), `percentualUsina=8` (cooperebr2 atual), migrar `usinaId` pra Cooperebr2.
4. **Flexibilidade pagamento dono** — 2 campos auxiliares (`valorAluguelFixo` + `percentualGeracaoDono`), condicionais à `formaPagamentoDono`. Valores ficam `null` até parceiro definir via UI (D-novo-D catalogado).
5. **formaAquisicao = ALUGUEL** em ambas Cooperebr1 e Cooperebr2 (CLAUDE.md cita "3 usinas arrendadas").

## Entregas

### Sub-tarefas concluídas

| Sub | Descrição | Status |
|---|---|---|
| H'.1 | Schema Usina expandido + 2 enums | ✅ |
| H'.2 | Migration segura (`prisma db push` + build + restart, 2 rounds) | ✅ |
| H'.3 | Saneamento AMAGES `ambienteTeste=true` | ✅ |
| H'.4 | Saneamento Exfishes CTR-000134 (720k anual, 60k mensal, 8%, migrado pra Cooperebr2) | ✅ |
| H'.5 | Cadastro Cooperebr2 `cmp8fkxvt0001valkj8utb8vr` | ✅ |
| H'.6 | Apelidos cooperebr1 + cooperebr2 + formaAquisicao=ALUGUEL | ✅ |
| H'.7 | UI `web/app/dashboard/usinas/nova/page.tsx` estendida com campos novos + condicionais FIXO/PERCENTUAL | ✅ |
| H'.8 | HTML cadastro-usinas v1.1 — pendente (claude.ai redige) | ⏸️ |
| H'.9 | Smoke E2E SELECT 5 passos PASS | ✅ |
| H'.10 | Mini-fechamento (este doc) | ✅ |

### IDs de banco criados/alterados

| Item | ID | Estado |
|---|---|---|
| Cooperebr2 nova | `cmp8fkxvt0001valkj8utb8vr` | Linhares 2, 1.000 kWp, 157.000 kWh, EDP_ES, CUSD EDP-ES-04123/2025 dt 2025-04-14, dataInicioProducao 2026-02-15 |
| Cooperebr1 (Linhares 1) | `usina-linhares` | `apelidoInterno='cooperebr1'`, `formaAquisicao=ALUGUEL`, demais campos pagamento null |
| AMAGES | `cmp7034d70002vaf0af5ws4ud` | `ambienteTeste: false → true` |
| Exfishes CTR-000134 | `cmn0ds7w0003cuolsty25olf8` | `usinaId: usina-linhares → cmp8fkxvt0001valkj8utb8vr` (Cooperebr2) + `kwhContratoAnual=720.000`, `kwhContratoMensal=60.000`, `percentualUsina=8` |

### Schema diff

Adicionados em `model Usina`:
- `apelidoInterno String?`
- `enderecoLogradouro String?` · `enderecoNumero String?` · `enderecoBairro String?` · `enderecoCep String?`
- `cnpjUsina String?`
- `formaAquisicao FormaAquisicao?`
- `formaPagamentoDono FormaPagamentoDono?`
- `valorAluguelFixo Decimal? @db.Decimal(10, 2)`
- `percentualGeracaoDono Decimal? @db.Decimal(5, 2)`
- `numeroContratoEdp String?`
- `dataContratoEdp DateTime?`

Enums:
```prisma
enum FormaAquisicao { CESSAO ALUGUEL PROPRIA }
enum FormaPagamentoDono { FIXO PERCENTUAL }
```

**Não adicionado** (módulo separado): `classeGd`, `RegrasFioB`, guards de classificação.

## Débitos novos catalogados

- **D-novo-D (P3)** — Definir `formaPagamentoDono` + valor concreto (`valorAluguelFixo` OU `percentualGeracaoDono`) para Cooperebr1, Cooperebr2 e demais 4 usinas históricas após acordo entre parceiro e dono. UI já permite ajuste a qualquer tempo. Bloqueia apenas relatórios financeiros completos de arrendamento.

## Validação smoke H'.9

```
✅ AMAGES ambienteTeste=true
✅ CTR-000134 Exfishes: usina=Cooperebr2, kwhContratoAnual=720000, percentualUsina=8
✅ Cooperebr1: apelidoInterno=cooperebr1, formaAquisicao=ALUGUEL
✅ Cooperebr2: criada com 18 campos preenchidos
✅ Listagem CoopereBR: 7 usinas (1 nova adicionada — Linhares 2 visível)
```

## Próximo passo

**Bloco C — Cadastro SEM_UC UI** (4-6h Code). Banco já suporta `tipoCooperado.SEM_UC` (validado em sessões anteriores) — falta UI visível. Pequeno, baixo risco, destrava MLM/D-44 MST.

Frase comandante canônica única atualizada em `docs/CONTROLE-EXECUCAO.md`.
