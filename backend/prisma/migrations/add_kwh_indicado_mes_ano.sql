-- CLB-01: Adicionar campos kwhIndicadoMes e kwhIndicadoAno na ProgressaoClube
-- para ranking mensal/anual usar métricas do período em vez do acumulado histórico

ALTER TABLE "progressoes_clube"
  ADD COLUMN IF NOT EXISTS "kwhIndicadoMes" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "mesReferenciaKwh" TEXT,
  ADD COLUMN IF NOT EXISTS "kwhIndicadoAno" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "anoReferenciaKwh" TEXT;
