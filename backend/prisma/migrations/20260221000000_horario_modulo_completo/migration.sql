-- CreateEnum: StatusHorario
DO $$ BEGIN
  CREATE TYPE "StatusHorario" AS ENUM ('RASCUNHO', 'APROVADO', 'INATIVO');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 1. Adicionar colunas (sem IF NOT EXISTS para compatibilidade)
DO $$ BEGIN
  ALTER TABLE "horarios" ADD COLUMN "instituicao_id" TEXT;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "horarios" ADD COLUMN "ano_letivo_id" TEXT;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "horarios" ADD COLUMN "plano_ensino_id" TEXT;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "horarios" ADD COLUMN "disciplina_id" TEXT;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "horarios" ADD COLUMN "professor_id" TEXT;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "horarios" ADD COLUMN "status" "StatusHorario" DEFAULT 'RASCUNHO';
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

-- 2. Backfill a partir da turma
UPDATE "horarios" h
SET
  "instituicao_id" = t."instituicao_id",
  "ano_letivo_id" = t."ano_letivo_id",
  "disciplina_id" = COALESCE(t."disciplina_id", (SELECT pe."disciplina_id" FROM "plano_ensino" pe WHERE pe."turma_id" = h."turma_id" AND pe."turma_id" IS NOT NULL LIMIT 1)),
  "professor_id" = COALESCE(t."professor_id", (SELECT pe."professor_id" FROM "plano_ensino" pe WHERE pe."turma_id" = h."turma_id" AND pe."turma_id" IS NOT NULL LIMIT 1))
FROM "turmas" t
WHERE h."turma_id" = t.id;

-- 3. Backfill restante via plano_ensino (para turmas sem disciplina_id/professor_id legacy)
UPDATE "horarios" h
SET
  "disciplina_id" = COALESCE(h."disciplina_id", subq."disciplina_id"),
  "professor_id" = COALESCE(h."professor_id", subq."professor_id")
FROM (
  SELECT DISTINCT ON (pe."turma_id") pe."turma_id", pe."disciplina_id", pe."professor_id"
  FROM "plano_ensino" pe
  WHERE pe."turma_id" IS NOT NULL
) subq
WHERE h."turma_id" = subq."turma_id"
  AND (h."disciplina_id" IS NULL OR h."professor_id" IS NULL);

-- 4. Garantir instituicao_id e ano_letivo_id preenchidos
UPDATE "horarios" h
SET "instituicao_id" = t."instituicao_id", "ano_letivo_id" = t."ano_letivo_id"
FROM "turmas" t
WHERE h."turma_id" = t.id AND (h."instituicao_id" IS NULL OR h."ano_letivo_id" IS NULL);

-- 5. Remover horários órfãos (turma inexistente) para poder aplicar NOT NULL
DELETE FROM "horarios" WHERE "instituicao_id" IS NULL OR "ano_letivo_id" IS NULL;

-- 6. Alterar para NOT NULL
ALTER TABLE "horarios" ALTER COLUMN "instituicao_id" SET NOT NULL;
ALTER TABLE "horarios" ALTER COLUMN "ano_letivo_id" SET NOT NULL;

-- 7. Adicionar FKs (ignorar se já existem)
DO $$ BEGIN
  ALTER TABLE "horarios" ADD CONSTRAINT "horarios_instituicao_id_fkey" FOREIGN KEY ("instituicao_id") REFERENCES "instituicoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "horarios" ADD CONSTRAINT "horarios_ano_letivo_id_fkey" FOREIGN KEY ("ano_letivo_id") REFERENCES "anos_letivos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "horarios" ADD CONSTRAINT "horarios_plano_ensino_id_fkey" FOREIGN KEY ("plano_ensino_id") REFERENCES "plano_ensino"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "horarios" ADD CONSTRAINT "horarios_disciplina_id_fkey" FOREIGN KEY ("disciplina_id") REFERENCES "disciplinas"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "horarios" ADD CONSTRAINT "horarios_professor_id_fkey" FOREIGN KEY ("professor_id") REFERENCES "professores"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 8. Criar índices
CREATE INDEX IF NOT EXISTS "horarios_instituicao_id_idx" ON "horarios"("instituicao_id");
CREATE INDEX IF NOT EXISTS "horarios_ano_letivo_id_idx" ON "horarios"("ano_letivo_id");
CREATE INDEX IF NOT EXISTS "horarios_plano_ensino_id_idx" ON "horarios"("plano_ensino_id");
CREATE INDEX IF NOT EXISTS "horarios_professor_id_idx" ON "horarios"("professor_id");
CREATE INDEX IF NOT EXISTS "horarios_disciplina_id_idx" ON "horarios"("disciplina_id");
CREATE INDEX IF NOT EXISTS "horarios_status_idx" ON "horarios"("status");
CREATE INDEX IF NOT EXISTS "horarios_dia_semana_idx" ON "horarios"("dia_semana");
