-- Criar enum TipoOcorrencia
CREATE TYPE "TipoOcorrencia" AS ENUM ('FALTA_ENERGIA', 'MEDICAO_INCORRETA', 'PROBLEMA_FATURA', 'SOLICITACAO', 'OUTROS');

-- Criar enum StatusOcorrencia
CREATE TYPE "StatusOcorrencia" AS ENUM ('ABERTA', 'EM_ANDAMENTO', 'RESOLVIDA', 'CANCELADA');

-- Criar enum PrioridadeOcorrencia
CREATE TYPE "PrioridadeOcorrencia" AS ENUM ('BAIXA', 'MEDIA', 'ALTA', 'CRITICA');

-- Criar tabela ocorrencias
CREATE TABLE "ocorrencias" (
    "id"          TEXT                   NOT NULL,
    "cooperadoId" TEXT                   NOT NULL,
    "ucId"        TEXT,
    "tipo"        "TipoOcorrencia"       NOT NULL,
    "descricao"   TEXT                   NOT NULL,
    "status"      "StatusOcorrencia"     NOT NULL DEFAULT 'ABERTA',
    "prioridade"  "PrioridadeOcorrencia" NOT NULL,
    "resolucao"   TEXT,
    "createdAt"   TIMESTAMP(3)           NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3)           NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ocorrencias_pkey" PRIMARY KEY ("id")
);

-- Foreign key para cooperados
ALTER TABLE "ocorrencias"
    ADD CONSTRAINT "ocorrencias_cooperadoId_fkey"
    FOREIGN KEY ("cooperadoId") REFERENCES "cooperados"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- Foreign key para ucs (opcional)
ALTER TABLE "ocorrencias"
    ADD CONSTRAINT "ocorrencias_ucId_fkey"
    FOREIGN KEY ("ucId") REFERENCES "ucs"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
