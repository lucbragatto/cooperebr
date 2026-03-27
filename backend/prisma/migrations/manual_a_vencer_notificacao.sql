-- Migration manual: adicionar A_VENCER ao enum e criar tabela de configuracao de notificacoes

ALTER TYPE "StatusCobranca" ADD VALUE IF NOT EXISTS 'A_VENCER';

CREATE TABLE IF NOT EXISTS "configuracao_notificacao_cobranca" (
  "id" TEXT NOT NULL,
  "cooperativaId" TEXT,
  "tipo" TEXT NOT NULL,
  "ativo" BOOLEAN NOT NULL DEFAULT true,
  "diasReferencia" INTEGER NOT NULL,
  "texto" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "configuracao_notificacao_cobranca_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "configuracao_notificacao_cobranca_cooperativaId_tipo_key" 
  ON "configuracao_notificacao_cobranca"("cooperativaId", "tipo");
