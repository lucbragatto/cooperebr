-- ════════════════════════════════════════════════════════════════════════════
-- AUDITORIA D-31 — Contrato.percentualUsina zerado/irrealista
-- Data: 2026-06-10  |  Bloqueador: Sprint 5 + canário
-- ════════════════════════════════════════════════════════════════════════════
--
-- COMO USAR
--   1) pm2 stop cooperebr-backend         (libera locks do Prisma)
--   2) psql "$DATABASE_URL" -f docs/relatorios/2026-06-10-auditoria-d31-percentualUsina.sql > /tmp/d31.txt
--   3) ler /tmp/d31.txt e colar resultado de volta na sessão
--   4) pm2 restart cooperebr-backend
--
-- Cada bloco é independente. Pode rodar isolado copiando trecho específico.
--
-- ARQUITETURA INVESTIGADA (sessão 11/05)
--   - `contratos.service.ts:67` retorna `0` silenciosamente quando
--     `usina.capacidadeKwh` é null/0 → contrato fica com `percentualUsina = 0`.
--   - 4 caminhos criam contrato (contratos.service, cooperados.service,
--     motor-proposta.service, migracoes-usina.service). Todos usam a mesma
--     lógica. Migrações SQL históricas (`add_*`, `fix_*`) podem ter inserido
--     contratos fora desses caminhos.
-- ════════════════════════════════════════════════════════════════════════════


-- ─── H1 — usinas com capacidadeKwh null/0 (CAUSA MAIS PROVÁVEL) ──────────────
-- Se uma usina não tem capacidade definida, TODOS os contratos novos dela
-- recebem `percentualUsina = 0` sem aviso. Backfill correto exige primeiro
-- preencher a capacidade real.

\echo '═══ H1: Usinas SEM capacidadeKwh (causa raiz) ═══'
SELECT
  u.id,
  u.nome,
  u."cooperativaId",
  u."capacidadeKwh",
  COUNT(c.id) AS contratos_afetados,
  COUNT(c.id) FILTER (WHERE c.status IN ('ATIVO','PENDENTE_ATIVACAO')) AS contratos_ativos
FROM usinas u
LEFT JOIN contratos c ON c."usinaId" = u.id
WHERE u."capacidadeKwh" IS NULL
   OR u."capacidadeKwh" <= 0
GROUP BY u.id, u.nome, u."cooperativaId", u."capacidadeKwh"
ORDER BY contratos_afetados DESC;


-- ─── H2 — contratos com percentualUsina suspeito ────────────────────────────
-- Sintoma direto. EXFISHES histórico mencionado no doc D-31 deveria cair aqui.

\echo '═══ H2: Contratos com percentualUsina = 0, null, ou >100 ═══'
SELECT
  c.id,
  c.numero,
  c.status,
  c."cooperadoId",
  co.nome AS cooperado,
  c."usinaId",
  u.nome AS usina,
  u."capacidadeKwh",
  c."percentualUsina",
  c."kwhContratoAnual",
  c."kwhContrato",
  c."kwhContratoMensal",
  -- recalcula o que DEVERIA ser:
  CASE
    WHEN u."capacidadeKwh" > 0 AND c."kwhContratoAnual" IS NOT NULL
      THEN ROUND((c."kwhContratoAnual" / u."capacidadeKwh") * 100, 4)
    WHEN u."capacidadeKwh" > 0 AND c."kwhContrato" IS NOT NULL
      THEN ROUND((c."kwhContrato" * 12 / u."capacidadeKwh") * 100, 4)
    ELSE NULL
  END AS percentual_esperado,
  c."createdAt"
FROM contratos c
LEFT JOIN cooperados co ON co.id = c."cooperadoId"
LEFT JOIN usinas u ON u.id = c."usinaId"
WHERE c.status IN ('ATIVO','PENDENTE_ATIVACAO')
  AND (
       c."percentualUsina" IS NULL
    OR c."percentualUsina" = 0
    OR c."percentualUsina" > 100
  )
ORDER BY c.status, c."createdAt";


-- ─── H3 — contratos com usinaId null OU kwhContratoAnual null ───────────────
-- Os guards `if (data.usinaId && kwhContratoAnual)` deixam `percentualUsina`
-- undefined → Prisma persiste como NULL. Esses contratos são bug semântico:
-- contrato sem usina não faz sentido fora de LISTA_ESPERA.

\echo '═══ H3: Contratos com usinaId ou kwhContratoAnual ausente ═══'
SELECT
  c.id, c.numero, c.status, c."usinaId", c."kwhContratoAnual",
  c."kwhContrato", c."kwhContratoMensal", c."createdAt"
FROM contratos c
WHERE c.status IN ('ATIVO','PENDENTE_ATIVACAO')
  AND (c."usinaId" IS NULL OR c."kwhContratoAnual" IS NULL);


-- ─── Cross-check: discrepância entre percentualUsina gravado vs recalculado ─
-- Se o gravado bate com o recalculado, dado é coerente (talvez antigo, mas ok).
-- Se diverge >0.5pp, indica que alguém alterou kwh ou capacidade depois sem
-- recalcular.

\echo '═══ X1: Drift entre percentualUsina gravado vs recalculado ═══'
SELECT
  c.id, c.numero, c.status,
  c."percentualUsina" AS gravado,
  ROUND((c."kwhContratoAnual" / NULLIF(u."capacidadeKwh", 0)) * 100, 4) AS recalculado,
  ABS(
    c."percentualUsina"
    - (c."kwhContratoAnual" / NULLIF(u."capacidadeKwh", 0)) * 100
  ) AS delta_pp,
  u.nome AS usina
FROM contratos c
JOIN usinas u ON u.id = c."usinaId"
WHERE c.status IN ('ATIVO','PENDENTE_ATIVACAO')
  AND u."capacidadeKwh" > 0
  AND c."kwhContratoAnual" IS NOT NULL
  AND c."percentualUsina" IS NOT NULL
  AND ABS(
        c."percentualUsina"
        - (c."kwhContratoAnual" / NULLIF(u."capacidadeKwh", 0)) * 100
      ) > 0.5
ORDER BY delta_pp DESC;


-- ─── Cross-check: ocupação real por usina ───────────────────────────────────
-- Mesmo cálculo que o Sprint 0 fez, mas baseado em kWh (não dependente de
-- `percentualUsina` gravado — útil pra ter dado confiável de concentração
-- enquanto D-31 não fecha).

\echo '═══ X2: Ocupação real por usina (via kwhContratoAnual) ═══'
SELECT
  u.id,
  u.nome,
  u."capacidadeKwh" AS capacidade_anual,
  COUNT(c.id) FILTER (WHERE c.status IN ('ATIVO','PENDENTE_ATIVACAO')) AS contratos_ativos,
  SUM(COALESCE(c."kwhContratoAnual", c."kwhContrato" * 12))
    FILTER (WHERE c.status IN ('ATIVO','PENDENTE_ATIVACAO')) AS kwh_anual_alocado,
  ROUND(
    100.0 * SUM(COALESCE(c."kwhContratoAnual", c."kwhContrato" * 12))
              FILTER (WHERE c.status IN ('ATIVO','PENDENTE_ATIVACAO'))
            / NULLIF(u."capacidadeKwh", 0),
    2
  ) AS ocupacao_percentual,
  SUM(c."percentualUsina")
    FILTER (WHERE c.status IN ('ATIVO','PENDENTE_ATIVACAO')) AS soma_percentualUsina_gravado
FROM usinas u
LEFT JOIN contratos c ON c."usinaId" = u.id
GROUP BY u.id, u.nome, u."capacidadeKwh"
ORDER BY ocupacao_percentual DESC NULLS LAST;


-- ─── Cross-check: concentração por cooperado-usina (D-30A relacionado) ─────
-- Refaz a auditoria do Sprint 0 sem depender de `percentualUsina` gravado.
-- Lista qualquer par (cooperado, usina) acima de 20% via kWh real.

\echo '═══ X3: Concentração cooperado-usina via kWh real (não confia gravado) ═══'
WITH alocacao AS (
  SELECT
    c."cooperadoId",
    c."usinaId",
    SUM(COALESCE(c."kwhContratoAnual", c."kwhContrato" * 12)) AS kwh_alocado
  FROM contratos c
  WHERE c.status IN ('ATIVO','PENDENTE_ATIVACAO')
  GROUP BY c."cooperadoId", c."usinaId"
)
SELECT
  co.nome AS cooperado,
  u.nome AS usina,
  a.kwh_alocado,
  u."capacidadeKwh",
  ROUND(100.0 * a.kwh_alocado / NULLIF(u."capacidadeKwh", 0), 2) AS pct_via_kwh
FROM alocacao a
JOIN cooperados co ON co.id = a."cooperadoId"
JOIN usinas u ON u.id = a."usinaId"
WHERE u."capacidadeKwh" > 0
  AND a.kwh_alocado / NULLIF(u."capacidadeKwh", 0) > 0.20
ORDER BY pct_via_kwh DESC;


-- ─── Origem: data de criação dos contratos suspeitos ───────────────────────
-- Se a maioria dos contratos zerados foi criada antes de uma data X, dá
-- pista se foi seed/import legado vs bug em código de produção.

\echo '═══ X4: Distribuição temporal dos contratos com percentualUsina problemático ═══'
SELECT
  DATE_TRUNC('month', c."createdAt") AS mes,
  COUNT(*) FILTER (WHERE c."percentualUsina" IS NULL) AS null_count,
  COUNT(*) FILTER (WHERE c."percentualUsina" = 0) AS zero_count,
  COUNT(*) FILTER (WHERE c."percentualUsina" > 0 AND c."percentualUsina" <= 100) AS ok_count,
  COUNT(*) AS total
FROM contratos c
WHERE c.status IN ('ATIVO','PENDENTE_ATIVACAO')
GROUP BY mes
ORDER BY mes;


-- ════════════════════════════════════════════════════════════════════════════
-- PRÓXIMOS PASSOS conforme padrão dos resultados:
--
--   Se H1 retorna >0 linhas → preencher capacidadeKwh das usinas listadas,
--   depois rodar UPDATE backfill (gerado em scripts/backfill-percentual-usina.ts
--   a ser escrito SE Luciano autorizar — ver checklist migration safety).
--
--   Se H2 retorna ~todos os contratos ativos → bug sistêmico nos services
--   (improvável, código novo está correto). Mais provável: H1 explicando H2.
--
--   Se X1 mostra drift → kwh ou capacidade foram alterados depois sem
--   recalcular. Solução: trigger no Prisma (event hook) ou script periódico.
-- ════════════════════════════════════════════════════════════════════════════
