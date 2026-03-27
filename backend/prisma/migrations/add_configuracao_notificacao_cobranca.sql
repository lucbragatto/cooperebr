-- Criar tabela configuracoes_notificacao_cobranca
CREATE TABLE "configuracoes_notificacao_cobranca" (
    "id"             TEXT         NOT NULL,
    "cooperativaId"  TEXT,
    "tipo"           TEXT         NOT NULL,
    "ativo"          BOOLEAN      NOT NULL DEFAULT true,
    "diasReferencia" INTEGER      NOT NULL,
    "texto"          TEXT         NOT NULL,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3) NOT NULL,

    CONSTRAINT "configuracoes_notificacao_cobranca_pkey" PRIMARY KEY ("id")
);

-- Índice unique (cooperativaId, tipo)
CREATE UNIQUE INDEX "configuracoes_notificacao_cobranca_cooperativaId_tipo_key"
    ON "configuracoes_notificacao_cobranca"("cooperativaId", "tipo");

-- FK para cooperativas
ALTER TABLE "configuracoes_notificacao_cobranca"
    ADD CONSTRAINT "configuracoes_notificacao_cobranca_cooperativaId_fkey"
    FOREIGN KEY ("cooperativaId") REFERENCES "cooperativas"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
