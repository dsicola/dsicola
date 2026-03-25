-- AlterTable
ALTER TABLE "instituicoes" ADD COLUMN IF NOT EXISTS "dominio_customizado" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "instituicoes_dominio_customizado_key" ON "instituicoes"("dominio_customizado");
