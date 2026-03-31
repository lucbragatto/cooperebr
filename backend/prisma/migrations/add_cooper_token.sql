-- CooperToken Fase 1 Migration

-- Enums
CREATE TYPE "CooperTokenTipo" AS ENUM ('GERACAO_EXCEDENTE', 'FLEX', 'SOCIAL', 'BONUS_INDICACAO');
CREATE TYPE "CooperTokenOperacao" AS ENUM ('CREDITO', 'DEBITO', 'EXPIRACAO', 'DOACAO_ENVIADA', 'DOACAO_RECEBIDA');

-- Campos novos em planos
ALTER TABLE "planos" ADD COLUMN "cooperTokenAtivo" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "planos" ADD COLUMN "tokenPorKwhExcedente" DECIMAL(5,4);
ALTER TABLE "planos" ADD COLUMN "valorTokenReais" DECIMAL(10,2);
ALTER TABLE "planos" ADD COLUMN "tokenExpiracaoMeses" INTEGER;
ALTER TABLE "planos" ADD COLUMN "tokenDescontoMaxPerc" DECIMAL(5,2);
ALTER TABLE "planos" ADD COLUMN "tokenSocialAtivo" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "planos" ADD COLUMN "tokenFlexAtivo" BOOLEAN NOT NULL DEFAULT false;

-- Campos novos em cobrancas
ALTER TABLE "cobrancas" ADD COLUMN "tokenDescontoQt" DECIMAL(10,4);
ALTER TABLE "cobrancas" ADD COLUMN "tokenDescontoReais" DECIMAL(10,2);
ALTER TABLE "cobrancas" ADD COLUMN "ledgerDebitoId" TEXT;

-- Campos novos em planos_saas
ALTER TABLE "planos_saas" ADD COLUMN "taxaTokenPerc" DECIMAL(5,2) NOT NULL DEFAULT 0;
ALTER TABLE "planos_saas" ADD COLUMN "limiteTokenMensal" INTEGER;
ALTER TABLE "planos_saas" ADD COLUMN "cooperTokenHabilitado" BOOLEAN NOT NULL DEFAULT false;

-- Campos novos em faturas_saas
ALTER TABLE "faturas_saas" ADD COLUMN "volumeTokensMes" DECIMAL(12,4);
ALTER TABLE "faturas_saas" ADD COLUMN "receitaTokens" DECIMAL(10,2);

-- Campo tokenApurado em faturas_processadas
ALTER TABLE "faturas_processadas" ADD COLUMN "tokenApurado" BOOLEAN NOT NULL DEFAULT false;

-- Tabela cooper_token_ledger
CREATE TABLE "cooper_token_ledger" (
    "id" TEXT NOT NULL,
    "cooperadoId" TEXT NOT NULL,
    "cooperativaId" TEXT NOT NULL,
    "tipo" "CooperTokenTipo" NOT NULL,
    "operacao" "CooperTokenOperacao" NOT NULL,
    "quantidade" DECIMAL(10,4) NOT NULL,
    "saldoApos" DECIMAL(10,4) NOT NULL,
    "valorReais" DECIMAL(10,2),
    "referenciaId" TEXT,
    "referenciaTabela" TEXT,
    "expiracaoEm" TIMESTAMP(3),
    "descricao" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cooper_token_ledger_pkey" PRIMARY KEY ("id")
);

-- Tabela cooper_token_saldo
CREATE TABLE "cooper_token_saldo" (
    "id" TEXT NOT NULL,
    "cooperadoId" TEXT NOT NULL,
    "cooperativaId" TEXT NOT NULL,
    "saldoDisponivel" DECIMAL(10,4) NOT NULL DEFAULT 0,
    "saldoPendente" DECIMAL(10,4) NOT NULL DEFAULT 0,
    "totalEmitido" DECIMAL(10,4) NOT NULL DEFAULT 0,
    "totalResgatado" DECIMAL(10,4) NOT NULL DEFAULT 0,
    "totalExpirado" DECIMAL(10,4) NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cooper_token_saldo_pkey" PRIMARY KEY ("id")
);

-- Índices
CREATE INDEX "cooper_token_ledger_cooperadoId_createdAt_idx" ON "cooper_token_ledger"("cooperadoId", "createdAt");
CREATE INDEX "cooper_token_ledger_cooperativaId_idx" ON "cooper_token_ledger"("cooperativaId");
CREATE INDEX "cooper_token_ledger_expiracaoEm_idx" ON "cooper_token_ledger"("expiracaoEm");
CREATE UNIQUE INDEX "cooper_token_saldo_cooperadoId_key" ON "cooper_token_saldo"("cooperadoId");

-- Foreign keys
ALTER TABLE "cooper_token_ledger" ADD CONSTRAINT "cooper_token_ledger_cooperadoId_fkey" FOREIGN KEY ("cooperadoId") REFERENCES "cooperados"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cooper_token_ledger" ADD CONSTRAINT "cooper_token_ledger_cooperativaId_fkey" FOREIGN KEY ("cooperativaId") REFERENCES "cooperativas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cooper_token_saldo" ADD CONSTRAINT "cooper_token_saldo_cooperadoId_fkey" FOREIGN KEY ("cooperadoId") REFERENCES "cooperados"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
