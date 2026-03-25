-- Adicionar campos de endereço, data de nascimento e razão social ao cooperado
ALTER TABLE "cooperados" ADD COLUMN IF NOT EXISTS "dataNascimento" TIMESTAMP;
ALTER TABLE "cooperados" ADD COLUMN IF NOT EXISTS "razaoSocial" TEXT;
ALTER TABLE "cooperados" ADD COLUMN IF NOT EXISTS "cep" TEXT;
ALTER TABLE "cooperados" ADD COLUMN IF NOT EXISTS "logradouro" TEXT;
ALTER TABLE "cooperados" ADD COLUMN IF NOT EXISTS "numero" TEXT;
ALTER TABLE "cooperados" ADD COLUMN IF NOT EXISTS "complemento" TEXT;
ALTER TABLE "cooperados" ADD COLUMN IF NOT EXISTS "bairro" TEXT;
ALTER TABLE "cooperados" ADD COLUMN IF NOT EXISTS "cidade" TEXT;
ALTER TABLE "cooperados" ADD COLUMN IF NOT EXISTS "estado" TEXT;
