-- Sub-Sprint F Sessao 1 MVP+ Caminho B Etapa B (M30, 2026-05-26)
-- Migration aditiva pura.
--
-- 1. Enum StatusOperacional novo (5 valores)
-- 2. Enum ResponsavelPagamento novo (3 valores)
-- 3. Expansao CategoriaContaAPagar (4 -> 12 valores)
-- 4. Usina.valorKwhPadrao Decimal? (override fórmula PERCENTUAL)
-- 5. Usina.responsabilidadeDespesas Json default {}
-- 6. Usina.statusOperacional StatusOperacional default OPERANDO
-- 7. ContaAPagar.responsavelPagamento ResponsavelPagamento?
--
-- NAO toca dados existentes — todos defaults safe.

-- 1. StatusOperacional enum novo
CREATE TYPE "StatusOperacional" AS ENUM (
    'OPERANDO',
    'MANUTENCAO_PLANEJADA',
    'MANUTENCAO_EMERGENCIAL',
    'DESLIGADA',
    'OFFLINE'
);

-- 2. ResponsavelPagamento enum novo
CREATE TYPE "ResponsavelPagamento" AS ENUM (
    'PARCEIRO',
    'PROPRIETARIO',
    'COMPARTILHADO'
);

-- 3. Expansao CategoriaContaAPagar (10 valores novos)
ALTER TYPE "CategoriaContaAPagar" ADD VALUE IF NOT EXISTS 'CUSD';
ALTER TYPE "CategoriaContaAPagar" ADD VALUE IF NOT EXISTS 'MANUTENCAO_PREVENTIVA';
ALTER TYPE "CategoriaContaAPagar" ADD VALUE IF NOT EXISTS 'MANUTENCAO_CORRETIVA';
ALTER TYPE "CategoriaContaAPagar" ADD VALUE IF NOT EXISTS 'ROCADA';
ALTER TYPE "CategoriaContaAPagar" ADD VALUE IF NOT EXISTS 'VIGILANCIA';
ALTER TYPE "CategoriaContaAPagar" ADD VALUE IF NOT EXISTS 'SEGURO';
ALTER TYPE "CategoriaContaAPagar" ADD VALUE IF NOT EXISTS 'IPTU_ITR';
ALTER TYPE "CategoriaContaAPagar" ADD VALUE IF NOT EXISTS 'CONSUMO_AUXILIAR';
ALTER TYPE "CategoriaContaAPagar" ADD VALUE IF NOT EXISTS 'INTERNET';
ALTER TYPE "CategoriaContaAPagar" ADD VALUE IF NOT EXISTS 'ACOMPANHAMENTO_TECNICO';
ALTER TYPE "CategoriaContaAPagar" ADD VALUE IF NOT EXISTS 'EQUIPAMENTOS';

-- 4-6. Usina: 3 colunas novas
ALTER TABLE "usinas"
    ADD COLUMN IF NOT EXISTS "valorKwhPadrao" DECIMAL(10, 5);

ALTER TABLE "usinas"
    ADD COLUMN IF NOT EXISTS "responsabilidadeDespesas" JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE "usinas"
    ADD COLUMN IF NOT EXISTS "statusOperacional" "StatusOperacional" NOT NULL DEFAULT 'OPERANDO';

-- 7. ContaAPagar: responsavelPagamento opcional
ALTER TABLE "contas_a_pagar"
    ADD COLUMN IF NOT EXISTS "responsavelPagamento" "ResponsavelPagamento";
