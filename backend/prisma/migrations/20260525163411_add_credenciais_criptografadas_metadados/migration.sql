-- Sub-Sprint Gateways de Pagamento Fatia F2 (M29, 2026-05-26)
-- Migration aditiva: adiciona colunas separadas pra credenciais encrypted
-- e metadados em texto puro no model ConfigGateway.
--
-- A coluna `credenciais` (legado de transicao F1/M27) permanece intacta
-- — sera DROPPADA em sprint proprio futuro apos 30 dias de coexistencia
-- validada via dual-write.
--
-- Forma pura ADD COLUMN com DEFAULT '{}' — operacao non-blocking no
-- PostgreSQL 17+ (sem rewrite da tabela).

ALTER TABLE "config_gateways"
    ADD COLUMN IF NOT EXISTS "credenciaisCriptografadas" JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE "config_gateways"
    ADD COLUMN IF NOT EXISTS "metadados" JSONB NOT NULL DEFAULT '{}'::jsonb;
