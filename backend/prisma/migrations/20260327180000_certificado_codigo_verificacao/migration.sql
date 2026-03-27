-- AlterTable
ALTER TABLE "certificados" ADD COLUMN "codigo_verificacao" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "certificados_codigo_verificacao_key" ON "certificados"("codigo_verificacao");

-- Backfill:  caracteres hex maiúsculos (8), sem extensão pgcrypto (usa gen_random_uuid nativo)
UPDATE "certificados" c
SET "codigo_verificacao" = upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))
WHERE c."codigo_verificacao" IS NULL;

UPDATE "certificados" c
SET "codigo_verificacao" = upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10))
WHERE c."codigo_verificacao" IS NULL;
