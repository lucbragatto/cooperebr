-- Sub-Sprint F Sessao 1 F.1 Etapa A (M30, 2026-05-26)
-- Migration aditiva:
-- 1. Adiciona valor PROPRIETARIO ao enum PerfilUsuario (Postgres ALTER TYPE)
-- 2. Cria tabela convites_proprietario (magic link pra onboarding F.3)
--
-- Migration MANUAL (sem prisma migrate dev) — mesmo motivo do M29: baseline
-- tem BOM UTF-8 que corrompe shadow DB. Aplicada via prisma migrate deploy.
--
-- Puramente aditiva: sem alterar dados existentes, sem rewrite de tabela.

-- ── 1. Adicionar PROPRIETARIO ao enum PerfilUsuario ───────────────
-- Note: Postgres exige ALTER TYPE sem transacao explicita pra ADD VALUE
-- (operacao implicitamente nao-transacional). Funciona em migrate deploy.
ALTER TYPE "PerfilUsuario" ADD VALUE IF NOT EXISTS 'PROPRIETARIO';

-- ── 2. Criar tabela convites_proprietario ─────────────────────────
CREATE TABLE IF NOT EXISTS "convites_proprietario" (
    "id" TEXT NOT NULL,
    "usinaId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "convites_proprietario_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "convites_proprietario_token_key" ON "convites_proprietario"("token");
CREATE INDEX IF NOT EXISTS "convites_proprietario_token_idx" ON "convites_proprietario"("token");
CREATE INDEX IF NOT EXISTS "convites_proprietario_email_idx" ON "convites_proprietario"("email");

ALTER TABLE "convites_proprietario"
    ADD CONSTRAINT "convites_proprietario_usinaId_fkey"
    FOREIGN KEY ("usinaId") REFERENCES "usinas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
