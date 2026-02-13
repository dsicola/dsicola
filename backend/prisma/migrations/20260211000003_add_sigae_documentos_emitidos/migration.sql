-- AlterTable documentos_emitidos: adicionar campos SIGAE e multi-tenant
-- Backfill instituicao_id a partir do aluno (users.instituicao_id)

-- 1. Adicionar novas colunas (nullable inicialmente para permitir backfill)
ALTER TABLE "documentos_emitidos" ADD COLUMN IF NOT EXISTS "instituicao_id" TEXT;
ALTER TABLE "documentos_emitidos" ADD COLUMN IF NOT EXISTS "tipo_documento" TEXT;
ALTER TABLE "documentos_emitidos" ADD COLUMN IF NOT EXISTS "matricula_id" TEXT;
ALTER TABLE "documentos_emitidos" ADD COLUMN IF NOT EXISTS "ano_letivo_id" TEXT;
ALTER TABLE "documentos_emitidos" ADD COLUMN IF NOT EXISTS "serie" TEXT DEFAULT '';
ALTER TABLE "documentos_emitidos" ADD COLUMN IF NOT EXISTS "codigo_verificacao" TEXT;
ALTER TABLE "documentos_emitidos" ADD COLUMN IF NOT EXISTS "hash_integridade" TEXT;
ALTER TABLE "documentos_emitidos" ADD COLUMN IF NOT EXISTS "motivo_anulacao" TEXT;
ALTER TABLE "documentos_emitidos" ADD COLUMN IF NOT EXISTS "anulado_por" TEXT;
ALTER TABLE "documentos_emitidos" ADD COLUMN IF NOT EXISTS "anulado_em" TIMESTAMP(3);

-- 2. Backfill instituicao_id e tipo_documento a partir de dados existentes
UPDATE "documentos_emitidos" de
SET instituicao_id = u.instituicao_id
FROM "users" u
WHERE de.aluno_id = u.id AND u.instituicao_id IS NOT NULL;

UPDATE "documentos_emitidos" 
SET tipo_documento = 'DECLARACAO_MATRICULA' 
WHERE tipo_documento IS NULL;

-- Para documentos sem match: usar primeira instituição (exige que exista ao menos uma)
UPDATE "documentos_emitidos" 
SET instituicao_id = COALESCE((SELECT id FROM "instituicoes" LIMIT 1), (SELECT id FROM "instituicoes" ORDER BY "created_at" ASC LIMIT 1))
WHERE instituicao_id IS NULL;

UPDATE "documentos_emitidos" 
SET tipo_documento = 'DECLARACAO_MATRICULA' 
WHERE tipo_documento IS NULL;

-- 3. Tornar instituicao_id e tipo_documento NOT NULL
ALTER TABLE "documentos_emitidos" ALTER COLUMN "instituicao_id" SET NOT NULL;
ALTER TABLE "documentos_emitidos" ALTER COLUMN "tipo_documento" SET NOT NULL;

-- 4. Tornar tipo_documento_id nullable
ALTER TABLE "documentos_emitidos" ALTER COLUMN "tipo_documento_id" DROP NOT NULL;

-- 5. Garantir serie não nula
UPDATE "documentos_emitidos" SET serie = '' WHERE serie IS NULL;
ALTER TABLE "documentos_emitidos" ALTER COLUMN "serie" SET DEFAULT '';
ALTER TABLE "documentos_emitidos" ALTER COLUMN "serie" SET NOT NULL;

-- 6. Atualizar status default para ATIVO
UPDATE "documentos_emitidos" SET status = 'ATIVO' WHERE status IN ('emitido', 'Emitido');

-- 7. Criar unique constraint (instituicao_id, serie, numero_documento)
CREATE UNIQUE INDEX "documentos_emitidos_instituicao_id_serie_numero_documento_key" 
ON "documentos_emitidos"("instituicao_id", "serie", "numero_documento");

-- 8. Adicionar FKs e índices (apenas se não existirem)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'documentos_emitidos_instituicao_id_fkey') THEN
    ALTER TABLE "documentos_emitidos" ADD CONSTRAINT "documentos_emitidos_instituicao_id_fkey" 
    FOREIGN KEY ("instituicao_id") REFERENCES "instituicoes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'documentos_emitidos_ano_letivo_id_fkey') THEN
    ALTER TABLE "documentos_emitidos" ADD CONSTRAINT "documentos_emitidos_ano_letivo_id_fkey" 
    FOREIGN KEY ("ano_letivo_id") REFERENCES "anos_letivos"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "documentos_emitidos_instituicao_id_idx" ON "documentos_emitidos"("instituicao_id");
CREATE INDEX IF NOT EXISTS "documentos_emitidos_aluno_id_idx" ON "documentos_emitidos"("aluno_id");
CREATE INDEX IF NOT EXISTS "documentos_emitidos_codigo_verificacao_idx" ON "documentos_emitidos"("codigo_verificacao");
CREATE INDEX IF NOT EXISTS "documentos_emitidos_status_idx" ON "documentos_emitidos"("status");
