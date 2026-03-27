-- Add missing fields to existing tables
ALTER TABLE "conversas_whatsapp" ADD COLUMN IF NOT EXISTS "contadorFallback" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "cobrancas" ADD COLUMN IF NOT EXISTS "notificadoVencimento" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "cooperados" ADD COLUMN IF NOT EXISTS "pixChave" TEXT;
ALTER TABLE "cooperados" ADD COLUMN IF NOT EXISTS "pixTipo" TEXT;

-- Add cooperativa relation to contratos (column already exists, just ensure it's there)
ALTER TABLE "contratos" ADD COLUMN IF NOT EXISTS "cooperativaId" TEXT;

-- Administradoras
CREATE TABLE IF NOT EXISTS "administradoras" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "cooperativaId" TEXT NOT NULL,
  "razaoSocial" TEXT NOT NULL,
  "nomeFantasia" TEXT,
  "cnpj" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "telefone" TEXT NOT NULL,
  "responsavelNome" TEXT NOT NULL,
  "responsavelCpf" TEXT,
  "responsavelEmail" TEXT,
  "responsavelTelefone" TEXT,
  "ativo" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "administradoras_pkey" PRIMARY KEY ("id")
);

-- Condominios
CREATE TABLE IF NOT EXISTS "condominios" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "cooperativaId" TEXT,
  "nome" TEXT NOT NULL,
  "cnpj" TEXT,
  "endereco" TEXT NOT NULL,
  "cidade" TEXT NOT NULL,
  "estado" TEXT NOT NULL,
  "cep" TEXT,
  "administradoraId" TEXT,
  "sindicoNome" TEXT,
  "sindicoCpf" TEXT,
  "sindicoEmail" TEXT,
  "sindicoTelefone" TEXT,
  "modeloRateio" TEXT NOT NULL DEFAULT 'PROPORCIONAL_CONSUMO',
  "excedentePolitica" TEXT NOT NULL DEFAULT 'CREDITO_PROXIMO_MES',
  "excedentePixChave" TEXT,
  "excedentePixTipo" TEXT,
  "aliquotaIR" DOUBLE PRECISION,
  "aliquotaPIS" DOUBLE PRECISION,
  "aliquotaCOFINS" DOUBLE PRECISION,
  "taxaAdministrativa" DOUBLE PRECISION,
  "ativo" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "condominios_pkey" PRIMARY KEY ("id")
);

-- Unidades Condominio
CREATE TABLE IF NOT EXISTS "unidades_condominio" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "condominioId" TEXT NOT NULL,
  "numero" TEXT NOT NULL,
  "cooperadoId" TEXT,
  "fracaoIdeal" DOUBLE PRECISION,
  "percentualFixo" DOUBLE PRECISION,
  "ativo" BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT "unidades_condominio_pkey" PRIMARY KEY ("id")
);

-- Config Clube Vantagens
CREATE TABLE IF NOT EXISTS "config_clube_vantagens" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "cooperativaId" TEXT NOT NULL,
  "ativo" BOOLEAN NOT NULL DEFAULT false,
  "criterio" TEXT NOT NULL DEFAULT 'KWH_INDICADO_ACUMULADO',
  "niveisConfig" JSONB NOT NULL DEFAULT '[]',
  "bonusAniversario" DOUBLE PRECISION NOT NULL DEFAULT 0,
  CONSTRAINT "config_clube_vantagens_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "config_clube_vantagens_cooperativaId_key" ON "config_clube_vantagens"("cooperativaId");

-- Progressao Clube
CREATE TABLE IF NOT EXISTS "progressoes_clube" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "cooperadoId" TEXT NOT NULL,
  "nivelAtual" TEXT NOT NULL DEFAULT 'BRONZE',
  "kwhIndicadoAcumulado" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "indicadosAtivos" INTEGER NOT NULL DEFAULT 0,
  "receitaIndicados" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "beneficioPercentualAtual" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "beneficioReaisKwhAtual" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "dataUltimaPromocao" TIMESTAMP(3),
  "dataUltimaAvaliacao" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "progressoes_clube_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "progressoes_clube_cooperadoId_key" ON "progressoes_clube"("cooperadoId");

-- Historico Progressao
CREATE TABLE IF NOT EXISTS "historico_progressao" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "progressaoId" TEXT NOT NULL,
  "nivelAnterior" TEXT NOT NULL,
  "nivelNovo" TEXT NOT NULL,
  "kwhAcumulado" DOUBLE PRECISION NOT NULL,
  "indicadosAtivos" INTEGER NOT NULL,
  "receitaAcumulada" DOUBLE PRECISION NOT NULL,
  "motivo" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "historico_progressao_pkey" PRIMARY KEY ("id")
);

-- Observacao Ativa
CREATE TABLE IF NOT EXISTS "observacoes_ativas" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "observadorId" TEXT NOT NULL,
  "observadoId" TEXT,
  "observadoTelefone" TEXT,
  "observadorTelefone" TEXT NOT NULL,
  "escopo" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "motivo" TEXT,
  "cooperativaId" TEXT NOT NULL,
  "ativo" BOOLEAN NOT NULL DEFAULT true,
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "observacoes_ativas_pkey" PRIMARY KEY ("id")
);

-- Log Observacao
CREATE TABLE IF NOT EXISTS "logs_observacao" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "observacaoId" TEXT NOT NULL,
  "evento" TEXT NOT NULL,
  "detalhe" TEXT,
  "cooperativaId" TEXT NOT NULL,
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "logs_observacao_pkey" PRIMARY KEY ("id")
);

-- Transferencia PIX
CREATE TABLE IF NOT EXISTS "transferencias_pix" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "cooperativaId" TEXT,
  "cooperadoId" TEXT,
  "condominioId" TEXT,
  "valorBruto" DECIMAL(10,2) NOT NULL,
  "aliquotaIR" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "aliquotaPIS" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "aliquotaCOFINS" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "valorImpostos" DECIMAL(10,2) NOT NULL,
  "valorLiquido" DECIMAL(10,2) NOT NULL,
  "pixChave" TEXT NOT NULL,
  "pixTipo" TEXT NOT NULL DEFAULT 'ALEATORIA',
  "mesReferencia" TEXT NOT NULL,
  "kwhExcedente" DOUBLE PRECISION NOT NULL,
  "tarifaKwh" DOUBLE PRECISION NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'SIMULADO',
  "observacao" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "transferencias_pix_pkey" PRIMARY KEY ("id")
);

-- Migracao Usina
CREATE TABLE IF NOT EXISTS "migracoes_usina" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "cooperadoId" TEXT NOT NULL,
  "usinaOrigemId" TEXT,
  "usinaDestinoId" TEXT NOT NULL,
  "contratoAntigoId" TEXT NOT NULL,
  "contratoNovoId" TEXT NOT NULL,
  "kwhAnterior" DOUBLE PRECISION NOT NULL,
  "percentualAnterior" DOUBLE PRECISION NOT NULL,
  "kwhNovo" DOUBLE PRECISION NOT NULL,
  "percentualNovo" DOUBLE PRECISION NOT NULL,
  "motivo" TEXT,
  "tipo" TEXT NOT NULL DEFAULT 'MUDANCA_USINA',
  "realizadoPorId" TEXT NOT NULL,
  "cooperativaId" TEXT,
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "migracoes_usina_pkey" PRIMARY KEY ("id")
);

-- Foreign keys (only add if not exists)
DO $$ BEGIN
  ALTER TABLE "administradoras" ADD CONSTRAINT "administradoras_cooperativaId_fkey" FOREIGN KEY ("cooperativaId") REFERENCES "cooperativas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "condominios" ADD CONSTRAINT "condominios_cooperativaId_fkey" FOREIGN KEY ("cooperativaId") REFERENCES "cooperativas"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "condominios" ADD CONSTRAINT "condominios_administradoraId_fkey" FOREIGN KEY ("administradoraId") REFERENCES "administradoras"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "unidades_condominio" ADD CONSTRAINT "unidades_condominio_condominioId_fkey" FOREIGN KEY ("condominioId") REFERENCES "condominios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "unidades_condominio" ADD CONSTRAINT "unidades_condominio_cooperadoId_fkey" FOREIGN KEY ("cooperadoId") REFERENCES "cooperados"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "config_clube_vantagens" ADD CONSTRAINT "config_clube_vantagens_cooperativaId_fkey" FOREIGN KEY ("cooperativaId") REFERENCES "cooperativas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "progressoes_clube" ADD CONSTRAINT "progressoes_clube_cooperadoId_fkey" FOREIGN KEY ("cooperadoId") REFERENCES "cooperados"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "historico_progressao" ADD CONSTRAINT "historico_progressao_progressaoId_fkey" FOREIGN KEY ("progressaoId") REFERENCES "progressoes_clube"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "logs_observacao" ADD CONSTRAINT "logs_observacao_observacaoId_fkey" FOREIGN KEY ("observacaoId") REFERENCES "observacoes_ativas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "transferencias_pix" ADD CONSTRAINT "transferencias_pix_cooperativaId_fkey" FOREIGN KEY ("cooperativaId") REFERENCES "cooperativas"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "transferencias_pix" ADD CONSTRAINT "transferencias_pix_cooperadoId_fkey" FOREIGN KEY ("cooperadoId") REFERENCES "cooperados"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "transferencias_pix" ADD CONSTRAINT "transferencias_pix_condominioId_fkey" FOREIGN KEY ("condominioId") REFERENCES "condominios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "migracoes_usina" ADD CONSTRAINT "migracoes_usina_cooperadoId_fkey" FOREIGN KEY ("cooperadoId") REFERENCES "cooperados"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "migracoes_usina" ADD CONSTRAINT "migracoes_usina_cooperativaId_fkey" FOREIGN KEY ("cooperativaId") REFERENCES "cooperativas"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "contratos" ADD CONSTRAINT "contratos_cooperativaId_fkey" FOREIGN KEY ("cooperativaId") REFERENCES "cooperativas"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
