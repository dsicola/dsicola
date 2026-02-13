-- AlterTable
-- Adicionar coluna updated_at como nullable primeiro
ALTER TABLE "emails_enviados" ADD COLUMN "updated_at" TIMESTAMP(3);

-- Preencher valores existentes com created_at (ou CURRENT_TIMESTAMP se created_at for NULL)
UPDATE "emails_enviados" SET "updated_at" = COALESCE("created_at", CURRENT_TIMESTAMP) WHERE "updated_at" IS NULL;

-- Tornar a coluna NOT NULL
ALTER TABLE "emails_enviados" ALTER COLUMN "updated_at" SET NOT NULL;

-- Adicionar colunas de retry
ALTER TABLE "emails_enviados" ADD COLUMN "tentativas" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "ultima_tentativa" TIMESTAMP(3),
ADD COLUMN "proxima_tentativa" TIMESTAMP(3),
ADD COLUMN "dados_email" JSONB;

-- CreateIndex
CREATE INDEX "emails_enviados_status_tentativas_idx" ON "emails_enviados"("status", "tentativas");

-- CreateIndex
CREATE INDEX "emails_enviados_proxima_tentativa_idx" ON "emails_enviados"("proxima_tentativa");

