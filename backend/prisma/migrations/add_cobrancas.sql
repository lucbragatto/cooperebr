-- Criar enum StatusCobranca
CREATE TYPE "StatusCobranca" AS ENUM ('PENDENTE', 'PAGO', 'VENCIDO', 'CANCELADO');

-- Criar tabela cobrancas
CREATE TABLE "cobrancas" (
    "id"                 TEXT             NOT NULL,
    "contratoId"         TEXT             NOT NULL,
    "mesReferencia"      INTEGER          NOT NULL,
    "anoReferencia"      INTEGER          NOT NULL,
    "valorBruto"         DECIMAL(10,2)    NOT NULL,
    "percentualDesconto" DECIMAL(5,2)     NOT NULL,
    "valorDesconto"      DECIMAL(10,2)    NOT NULL,
    "valorLiquido"       DECIMAL(10,2)    NOT NULL,
    "status"             "StatusCobranca" NOT NULL DEFAULT 'PENDENTE',
    "dataVencimento"     TIMESTAMP(3)     NOT NULL,
    "dataPagamento"      TIMESTAMP(3),
    "createdAt"          TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"          TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cobrancas_pkey" PRIMARY KEY ("id")
);

-- Foreign key para contratos
ALTER TABLE "cobrancas"
    ADD CONSTRAINT "cobrancas_contratoId_fkey"
    FOREIGN KEY ("contratoId") REFERENCES "contratos"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
