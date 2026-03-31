CREATE MATERIALIZED VIEW IF NOT EXISTS vw_posicao_cooperado AS
SELECT
  co.id AS cooperado_id,
  co.nome_completo,
  co.cooperativa_id,
  c.id AS contrato_id,
  c.kwh_contrato,
  c.percentual_usina,
  u.id AS usina_id,
  u.nome AS usina_nome,
  gm.id AS geracao_id,
  gm.competencia,
  ROUND(CAST(gm.kwh_gerado * (CAST(c.percentual_usina AS NUMERIC) / 100) AS NUMERIC), 2) AS kwh_entregue,
  ROUND(CAST(gm.kwh_gerado * (CAST(c.percentual_usina AS NUMERIC) / 100) AS NUMERIC) - CAST(c.kwh_contrato AS NUMERIC), 2) AS excedente_kwh,
  CASE
    WHEN ROUND(CAST(gm.kwh_gerado * (CAST(c.percentual_usina AS NUMERIC) / 100) AS NUMERIC), 2) >= CAST(c.kwh_contrato AS NUMERIC) THEN 'SUPERAVITARIO'
    WHEN ROUND(CAST(gm.kwh_gerado * (CAST(c.percentual_usina AS NUMERIC) / 100) AS NUMERIC), 2) >= CAST(c.kwh_contrato AS NUMERIC) * 0.8 THEN 'ADEQUADO'
    ELSE 'DEFICITARIO'
  END AS status_geracao
FROM contratos c
JOIN cooperados co ON c.cooperado_id = co.id
JOIN usinas u ON c.usina_id = u.id
JOIN geracao_mensal gm ON gm.usina_id = c.usina_id
WHERE c.status = 'ATIVO'
  AND c.percentual_usina IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_vw_posicao_cooperado
ON vw_posicao_cooperado (contrato_id, geracao_id);

CREATE INDEX IF NOT EXISTS idx_vw_posicao_cooperado_coop
ON vw_posicao_cooperado (cooperativa_id, competencia);
