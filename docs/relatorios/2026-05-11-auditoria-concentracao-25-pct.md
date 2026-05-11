# Auditoria de Concentração > 25% — 2026-05-11

> Relatório gerado pela Fase 8 (Sprint 0 passos iniciais) da sessão Code 11/05/2026.
> Mitigação parcial do risco D-30A (concentração regulatória ANEEL).

## Contexto regulatório

ANEEL define limite default de **25% por cooperado-usina** (Lei 14.300/2022). Concentrações acima podem gerar autuação + perda de habilitação SCEE. Limite é configurável por parceiro via flag `concentracaoMaxPorCooperadoUsina` (quando `ConfigRegulatoriaParceiro` for criada — Sprint 5).

## Resumo executivo

- Total de contratos analisados (ATIVO + PENDENTE_ATIVACAO com `percentualUsina`): **62**
- Total de agregações (cooperado × usina únicas): **62**
- **Casos > 25%: 0** ✅
- Casos limítrofes (20% ≤ x ≤ 25%): 0

## Base analisada por cooperativa

| Cooperativa | Tipo | Contratos ativos | Cooperados ativos | Usinas |
|---|---|---|---|---|
| CoopereBR Teste | COOPERATIVA | 0 | 4 | 2 |
| CoopereBR | COOPERATIVA | 71 | 300 | 6 |
| TESTE-FASE-B5 — Validação Engines | COOPERATIVA | 6 | 6 | 1 |

## Casos > 25% (ordenado por % decrescente)

Nenhum caso > 25% encontrado no banco atual. Ver seção "Diagnóstico" abaixo.

## Casos limítrofes (20% ≤ x ≤ 25%) — vigiar

Nenhum caso limítrofe.

## Distribuição geral por usina

| Usina | Cooperativa | Cooperados distintos | % máx | % médio | Soma % | Status |
|---|---|---|---|---|---|---|
| Solar Serra | CoopereBR | 1 | 0,03% | 0,03% | 0,03% | 🟢 |
| COOPERE BR - Usina Linhares | CoopereBR | 61 | 0,00% | 0,00% | 0,00% | 🟢 |

## Cross-check de casos nominais (documentados em sessões anteriores)

- ⚪ **FIGATTA** — não encontrado no banco atual (provavelmente limpo em sessão anterior ou nome divergente).
- ⚪ **CRIAR** — não encontrado no banco atual (provavelmente limpo em sessão anterior ou nome divergente).
- 🟢 **EXFISHES** encontrado: `EXFISHES TERMINAL PESQUEIRO SPE LTDA` em COOPERE BR - Usina Linhares (CoopereBR) — **0,00%** (1 contrato(s))

## Diagnóstico: por que 0 casos > 25%?

Hipóteses (não-exaustivas):

- **(a)** Banco dev tem dados mascarados ou anonimizados que podem ter alterado proporções originais.
- **(b)** Casos FIGATTA/CRIAR (mencionados em sessões 30/04) podem ter sido limpos em scripts de limpeza posteriores. EXFISHES ainda presente.
- **(c)** Banco dev legitimamente não tem concentrações altas hoje (base pequena: 62 contratos em 3 cooperativas).

**O risco D-30A permanece P0 estrutural** — sistema continua sem flag de proteção (`concentracaoMaxPorCooperadoUsina` configurável por parceiro). Quando rodar em prod com centenas/milhares de contratos, a probabilidade de surgir caso > 25% aumenta.

## Limitações deste relatório

- **NÃO inclui auditoria por classe GD** — `Usina.classeGd` não existe no schema atual (Sprint 5 vai criar). Sem isso, não dá pra detectar mix de classes proibido por flag `misturaClassesMesmaUsina`.
- **NÃO inclui auditoria de protocolo** — `Usina.dataProtocoloDistribuidora` e `Uc.dataProtocoloDistribuidora` não existem (Sprint 5).
- **NÃO inclui saldo > 2 meses parado** — D-30G fica pra Sprint 0 completo (precisa cruzar histórico Cobranca + consumo médio).
- **Limite 25% é o default ANEEL.** Quando `ConfigRegulatoriaParceiro` existir (Sprint 5), cada parceiro pode configurar seu próprio limite.
- **Só agrega por (cooperadoId, usinaId).** Concentrações cruzadas (cooperado com várias usinas, mesma classe GD) não são detectadas.

## Próximos passos sugeridos

1. **Luciano lê este relatório.** Identifica casos pra ação corretiva.
2. **Plano caso a caso** — pra cada caso > 25% (se houver), decisão:
   - (a) Reduzir `percentualUsina` do contrato existente
   - (b) Redistribuir parte pra outra usina compatível
   - (c) Aceitar risco regulatório formalmente (documentar)
3. **Sprint 5 completo** dá ferramentas estruturais (5 flags ANEEL + N:M Contrato↔Usina + cron diário + UI parceiro).
4. **Sprint 0 completo** dá relatórios automatizados periódicos (cron + dashboard `/dashboard/super-admin/auditoria-regulatoria`).

## Histórico do relatório

- Gerado em: 2026-05-11
- Script: `backend/scripts/auditoria-concentracao-25-pct.ts` (artefato local, não commitado — refazível a qualquer momento)
- Origem: Fase 8 da sessão Code 11/05/2026
