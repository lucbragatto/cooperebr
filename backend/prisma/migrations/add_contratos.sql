-- Criar enum StatusContrato
CREATE TYPE "StatusContrato" AS ENUM ('ATIVO', 'SUSPENSO', 'ENCERRADO');

-- Criar tabela contratos
CREATE TABLE "contratos" (
    "id"                 TEXT            NOT NULL,
    "numero"             TEXT            NOT NULL,
    "cooperadoId"        TEXT            NOT NULL,
    "ucId"               TEXT            NOT NULL,
    "usinaId"            TEXT            NOT NULL,
    "dataInicio"         TIMESTAMP(3)    NOT NULL,
    "dataFim"            TIMESTAMP(3),
    "percentualDesconto" DECIMAL(5,2)    NOT NULL,
    "status"             "StatusContrato" NOT NULL DEFAULT 'ATIVO',
    "createdAt"          TIMESTAMP(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"          TIMESTAMP(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contratos_pkey" PRIMARY KEY ("id")
);

-- Índice único para numero
CREATE UNIQUE INDEX "contratos_numero_key" ON "contratos"("numero");

-- Foreign keys
ALTER TABLE "contratos"
    ADD CONSTRAINT "contratos_cooperadoId_fkey"
    FOREIGN KEY ("cooperadoId") REFERENCES "cooperados"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "contratos"
    ADD CONSTRAINT "contratos_ucId_fkey"
    FOREIGN KEY ("ucId") REFERENCES "ucs"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "contratos"
    ADD CONSTRAINT "contratos_usinaId_fkey"
    FOREIGN KEY ("usinaId") REFERENCES "usinas"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
