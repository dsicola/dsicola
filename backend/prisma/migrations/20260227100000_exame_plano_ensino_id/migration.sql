-- AlterTable
ALTER TABLE "exames" ADD COLUMN IF NOT EXISTS "plano_ensino_id" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "exames_plano_ensino_id_idx" ON "exames"("plano_ensino_id");

-- AddForeignKey (optional: only if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'exames_plano_ensino_id_fkey'
  ) THEN
    ALTER TABLE "exames" ADD CONSTRAINT "exames_plano_ensino_id_fkey"
      FOREIGN KEY ("plano_ensino_id") REFERENCES "plano_ensino"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
