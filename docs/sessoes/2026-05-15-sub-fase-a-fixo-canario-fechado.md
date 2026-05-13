# Sub-Fase A canário FIXO_MENSAL — fechada em 2026-05-15 madrugada (sessão Code 14-15/05)

> Continuação da sessão 14/05 tarde (Fatia A — Cenário 1c / fix D-48 / saneamento).
> Marco M2 (primeira receita real em pipeline FIXO_MENSAL) ainda em aberto — canário valida pipeline end-to-end em `ambienteTeste=true` mas com cooperados reais; faltam Asaas+WA reais (Sub-Fase B) e cooperado em produção (Caminho A).

## Resultado

✅ **4 cooperados-piloto reais criados na CoopereBR** + **D-48 (6 sites multi-tenant) corrigido** + **2 contratos divergentes saneados** + **auditoria global multi-tenant zero divergências**.

| Contrato | Cooperado | UC numero | usinaId | valorContrato | Cobrança valorLiquido | valorEconomiaMes |
|---|---|---|---|---:|---:|---:|
| CTR-2026-0004 | DIEGO ALLAN CORREIA PEREIRA | 0.001.516.624.054-75 | usina-linhares | 447,68 | R$ 447,68 | R$ 98,27 |
| CTR-2026-0005 | CAROLINA LEMOS CRAVO | 0.000.897.339.054-90 | usina-linhares | 142,32 | R$ 142,32 | R$ 31,24 |
| CTR-2026-0006 | ALMIR JOAO MUNIZ FREITAS | 0160213718 | usina-linhares | 940,93 | R$ 940,93 | R$ 206,54 |
| CTR-2026-0007 | THEOMAX COMERCIO DE CALCADOS E ACESSORIOS LTDA | 0000652942 | usina-linhares | 1.011,33 | R$ 1.011,33 | R$ 222,00 |
| **Total** | | | | **R$ 2.542,26** | **R$ 2.542,26** | **R$ 558,05** |

Todos em `ambienteTeste=true`, status `ATIVO`, plano `Plano Individual Residencial` FIXO_MENSAL 18%, vinculados a Usina Linhares CoopereBR.

## Linha do tempo da sessão

### 14/05 tarde — execução inicial (DIEGO falhou)
- Aplicação Fase 1 read-only (10 validações ok) — `backend/scripts/fase1-validar-piloto-4-cooperados.ts`
- Cherry-pick `b6f07bd` pra main (catálogo D-48 do worktree `xenodochial-tu-cf15c2`).
- DIEGO criado e processou 5 de 6 passos. `gerarCobrancaPosFatura` quebrou com `ForbiddenException: Violação multi-tenant no contrato CTR-2026-0004` (faturas.service.ts:1844).
- Causa-raiz: `motor-proposta.aceitar()` não filtrava Usinas por `cooperativaId` — pegou TESTE-USINA-B5 em vez de Usina Linhares.
- 2 manifestações no banco identificadas: CTR-2026-0004 (DIEGO, sessão) + CTR-2026-0003 (Luciana, seed mar/2026).

### 14/05 noite — fix D-48 + recuperação
1. **D-48 catalogado** completo (6 sub-itens, severidade P1 SEGURANÇA).
2. **7 patches aplicados** em 7 arquivos:
   - `motor-proposta.service.ts:639` — adiciona `cooperativaId: dono.cooperativaId` ao `whereUsina` (D-48.1)
   - `motor-proposta.service.ts:1152` — `findUnique` ganha `cooperativaId: contratoCompleto?.cooperativaId` (D-48.2)
   - `cooperados.service.ts:498,523` — 2 chamadas em `cadastroCompleto` ganham filtro tenant (D-48.3)
   - `cooperados.service.ts:1279` — `alocarUsina` usa `cooperado.cooperativaId` (D-48.4)
   - `migracoes-usina.service.ts:110,435,442` — 3 chamadas com bypass SUPER_ADMIN (D-48.5)
   - `contratos.service.ts` — `validarCapacidadeUsina` / `create` / `update` ganham parâmetro `cooperativaId` (`findFirst` em vez de `findUnique` pra aceitar filtro tenant); `contratos.controller.ts` injeta `@Req() req` e passa `req.user.cooperativaId` (D-48.6 CRÍTICO)
   - `usinas.service.ts:261` — `verificarListaEspera` ganha parâmetro `cooperativaId` + guard `ForbiddenException`; `usinas.controller.ts` injeta `@Req() req` (D-48.7)
3. **Build limpo:** `npm run build` sem erros TypeScript.
4. **Specs Jest:** 23/26 passou; 3 falhas são DI registration pré-existentes (cooperados.controller.spec, cooperados.service.spec, usinas.controller.spec — `RootTestModule` não registra `UsinasService`). Sem regressão das mudanças D-48 — specs dos serviços modificados passaram (`motor-proposta.aceitar`, `contratos.service`, `usinas.service`, `cooperados.service.guard-ativacao`, `cooperados.service.aprovar-concessionaria`).
5. **PM2 restart** após `pm2 stop` + `npm run build` + `pm2 restart`. Boot OK: `Nest application successfully started`.
6. **Smoke test D-48.1:** query `whereUsina { capacidadeKwh, cooperativaId: CoopereBR, distribuidora: EDP_ES }` retorna apenas 1 usina (Usina Linhares). Confirmado isolamento.
7. **Saneamento 2 contratos divergentes:**
   - CTR-2026-0004 (DIEGO): usinaId `cmopx8p4i0008va1smwv4sycj` (TESTE-USINA-B5) → `usina-linhares`; percentualUsina 4,0833 → 0,3267 (490/150000).
   - CTR-2026-0003 (Luciana): usinaId `cmn7rvqtd0008uop8pff0897s` (Solar Serra) → `usina-linhares`; percentualUsina 0,025 → 0,6667 (1000/150000).
8. **Cobrança DIEGO gerada** (passo 6/6 que faltou): `cmp4ktvi80001va3kg2higq07` FIXO_MENSAL R$ 447,68 economia R$ 98,27.
9. **3 cooperados restantes** (CAROLINA, ALMIR, THEOMAX) processados pelos 6 passos sem incidentes — motor agora pega Usina Linhares por consequência do fix D-48.1.

## Snapshots Fase B presentes em cada contrato

Todos os 4 contratos têm:
- `valorContrato` (valor mensal fixo R$)
- `valorCheioKwhAceite` (snapshot R$/kWh com tributos da fatura inicial)
- `baseCalculoAplicado='KWH_CHEIO'`
- `tipoDescontoAplicado='APLICAR_SOBRE_BASE'`
- `tarifaContratual` (R$/kWh pós-desconto 18%)
- `percentualUsina` (% da Usina Linhares ocupado)

Engine FIXO_MENSAL (`faturas.service.ts:1862-1902`) lê esses snapshots e grava:
- `valorBruto = kwhContratoMensal × valorCheioKwhAceite`
- `valorLiquido = valorContrato` (snapshot do aceite)
- `valorDesconto = valorBruto - valorLiquido`
- `valorEconomiaMes/Ano/5anos/15anos` via `projetarEconomia()`

## D-48 — manifestações descobertas e fix

| Sub-item | Site | Severidade | Fix |
|---|---|---|---|
| D-48.1 | `motor-proposta.service.ts:639` `findMany` Usina | 🚨 P1 (DIEGO 14/05) | 1 linha — adiciona `cooperativaId` |
| D-48.2 | `motor-proposta.service.ts:1152` `findUnique` Usina | Médio | 1 linha — `cooperativaId` opcional |
| D-48.3 | `cooperados.service.ts:498,523` 2× `findUnique` | Médio | 2 linhas — filtro tenant |
| D-48.4 | `cooperados.service.ts:1279` `alocarUsina` | Médio | usa `cooperado.cooperativaId` |
| D-48.5 | `migracoes-usina.service.ts:110,435,442` 3× | Médio | bypass SUPER_ADMIN |
| D-48.6 | `contratos.service.ts:68` `validarCapacidadeUsina` + create + update | 🚨 CRÍTICO | mudança de assinatura + `@Req() req` no controller |
| D-48.7 | `usinas.service.ts:261` `verificarListaEspera` | Médio | parâmetro `cooperativaId` + guard `ForbiddenException` + `@Req() req` controller |

**D-48 RESOLVIDO** — todos os 7 sub-itens fechados nesta sessão.

## Auditoria multi-tenant final

```sql
SELECT COUNT(*) FROM contratos ct
LEFT JOIN usinas u ON u.id = ct."usinaId"
WHERE ct."usinaId" IS NOT NULL
  AND u."cooperativaId" != ct."cooperativaId";
-- → 0
```

## Scripts criados nesta sessão (artefatos)

- `backend/scripts/fase1-validar-piloto-4-cooperados.ts` — Fase 1 read-only (já deletado em sessão posterior)
- `backend/scripts/sub-fase-a-canario-4-fixo.ts` — primeira tentativa (DIEGO travou)
- `backend/scripts/sub-fase-a-recuperacao-pos-d48.ts` — orquestrador Fases 4-8 (saneamento + smoke + DIEGO cobrança + 3 restantes)
- `backend/scripts/saneamento-d48-pos-fix.ts` — artefato idempotente de referência (já no-op, dados saneados)

## Próximos passos sugeridos

1. **Sub-Fase B AMAGES CREDITOS_COMPENSADOS** — desligar `BLOQUEIO_MODELOS_NAO_FIXO` temporariamente; cadastrar AMAGES + 2 UCs (PUTIRI A4_VERDE + SEDE ADM B3_COMERCIAL); validar engine COMPENSADOS E2E real
2. **Sub-canário Asaas+WA real** — pegar 1 dos 4 cooperados (sugerir CAROLINA, menor valor R$ 142,32), trocar `ambienteTeste=false`, disparar fluxo Asaas sandbox + WhatsApp
3. **D-49 (sugerido):** auditar outros pontos que assumem confiança no `usinaId` recebido — cobrancas, contas-pagar, geracao-mensal podem ter padrão similar
4. **Validação visual Luciano:** `/dashboard/cooperados` + `/dashboard/cobrancas` ver os 4 cooperados/cobranças aparecendo corretos

## Sub-step 0 do orchestrador original

Permanece efetivo: Usina Linhares mantida com `distribuidora='EDP_ES'` (alteração 14/05 madrugada). Persiste pós-saneamento.

## Frase de retomada

> "Sub-Fase A FECHADA 15/05 madrugada — 4 cooperados FIXO_MENSAL CoopereBR + D-48 resolvido + saneamento 2 contratos. Próxima sessão Code: confirmar visualmente no dashboard + decidir Sub-Fase B (AMAGES COMPENSADOS) ou sub-canário Asaas+WA real em 1 dos 4 (CAROLINA recomendada)."
