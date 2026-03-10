-- Criar enum PerfilUsuario
CREATE TYPE "PerfilUsuario" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'OPERADOR', 'COOPERADO');

-- Adicionar coluna perfil na tabela usuarios
ALTER TABLE "usuarios"
  ADD COLUMN "perfil" "PerfilUsuario" NOT NULL DEFAULT 'COOPERADO';
