-- Adiciona campo administradoraId ao Usuario para vinculo com Agregador
ALTER TABLE "usuarios" ADD COLUMN IF NOT EXISTS "administradoraId" TEXT;

-- FK para administradoras
ALTER TABLE "usuarios"
  ADD CONSTRAINT "usuarios_administradoraId_fkey"
  FOREIGN KEY ("administradoraId")
  REFERENCES "administradoras"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Adiciona valor AGREGADOR ao enum PerfilUsuario
ALTER TYPE "PerfilUsuario" ADD VALUE IF NOT EXISTS 'AGREGADOR';
