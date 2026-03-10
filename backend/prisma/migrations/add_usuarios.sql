-- Criar tabela usuarios
CREATE TABLE "usuarios" (
    "id"         TEXT         NOT NULL,
    "nome"       TEXT         NOT NULL,
    "email"      TEXT         NOT NULL,
    "cpf"        TEXT,
    "telefone"   TEXT,
    "supabaseId" TEXT,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- Índices únicos
CREATE UNIQUE INDEX "usuarios_email_key"      ON "usuarios"("email");
CREATE UNIQUE INDEX "usuarios_cpf_key"        ON "usuarios"("cpf");
CREATE UNIQUE INDEX "usuarios_telefone_key"   ON "usuarios"("telefone");
CREATE UNIQUE INDEX "usuarios_supabaseId_key" ON "usuarios"("supabaseId");
