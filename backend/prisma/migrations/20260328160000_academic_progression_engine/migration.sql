-- Motor de progressão: classes com curso opcional, ordem NOT NULL, regras e disciplinas chave
-- Enum StatusMatriculaAnual: adicionar DESISTENTE (idempotente em desenvolvimento)
DO $$ BEGIN
  ALTER TYPE "StatusMatriculaAnual" ADD VALUE 'DESISTENTE';
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Classe: curso opcional + ordem obrigatória
ALTER TABLE "classes" ADD COLUMN IF NOT EXISTS "curso_id" TEXT;
UPDATE "classes" SET "ordem" = 0 WHERE "ordem" IS NULL;
ALTER TABLE "classes" ALTER COLUMN "ordem" SET NOT NULL;
ALTER TABLE "classes" ALTER COLUMN "ordem" SET DEFAULT 0;

ALTER TABLE "classes" DROP CONSTRAINT IF EXISTS "classes_curso_id_fkey";
ALTER TABLE "classes" ADD CONSTRAINT "classes_curso_id_fkey"
  FOREIGN KEY ("curso_id") REFERENCES "cursos"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX IF NOT EXISTS "classes_curso_id_idx" ON "classes"("curso_id");

-- regras_aprovacao
CREATE TABLE IF NOT EXISTS "regras_aprovacao" (
  "id" TEXT NOT NULL,
  "instituicao_id" TEXT NOT NULL,
  "curso_id" TEXT,
  "classe_id" TEXT,
  "media_minima" DECIMAL(5,2),
  "max_reprovacoes" INTEGER,
  "exige_disciplinas_chave" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "regras_aprovacao_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "regras_aprovacao_instituicao_id_curso_id_classe_id_idx"
  ON "regras_aprovacao"("instituicao_id", "curso_id", "classe_id");

ALTER TABLE "regras_aprovacao" DROP CONSTRAINT IF EXISTS "regras_aprovacao_instituicao_id_fkey";
ALTER TABLE "regras_aprovacao" ADD CONSTRAINT "regras_aprovacao_instituicao_id_fkey"
  FOREIGN KEY ("instituicao_id") REFERENCES "instituicoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "regras_aprovacao" DROP CONSTRAINT IF EXISTS "regras_aprovacao_curso_id_fkey";
ALTER TABLE "regras_aprovacao" ADD CONSTRAINT "regras_aprovacao_curso_id_fkey"
  FOREIGN KEY ("curso_id") REFERENCES "cursos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "regras_aprovacao" DROP CONSTRAINT IF EXISTS "regras_aprovacao_classe_id_fkey";
ALTER TABLE "regras_aprovacao" ADD CONSTRAINT "regras_aprovacao_classe_id_fkey"
  FOREIGN KEY ("classe_id") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- disciplinas_chave
CREATE TABLE IF NOT EXISTS "disciplinas_chave" (
  "id" TEXT NOT NULL,
  "instituicao_id" TEXT NOT NULL,
  "curso_id" TEXT NOT NULL,
  "classe_id" TEXT,
  "disciplina_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "disciplinas_chave_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "disciplinas_chave_instituicao_id_curso_id_classe_id_idx"
  ON "disciplinas_chave"("instituicao_id", "curso_id", "classe_id");
CREATE INDEX IF NOT EXISTS "disciplinas_chave_disciplina_id_idx" ON "disciplinas_chave"("disciplina_id");

ALTER TABLE "disciplinas_chave" DROP CONSTRAINT IF EXISTS "disciplinas_chave_instituicao_id_fkey";
ALTER TABLE "disciplinas_chave" ADD CONSTRAINT "disciplinas_chave_instituicao_id_fkey"
  FOREIGN KEY ("instituicao_id") REFERENCES "instituicoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "disciplinas_chave" DROP CONSTRAINT IF EXISTS "disciplinas_chave_curso_id_fkey";
ALTER TABLE "disciplinas_chave" ADD CONSTRAINT "disciplinas_chave_curso_id_fkey"
  FOREIGN KEY ("curso_id") REFERENCES "cursos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "disciplinas_chave" DROP CONSTRAINT IF EXISTS "disciplinas_chave_classe_id_fkey";
ALTER TABLE "disciplinas_chave" ADD CONSTRAINT "disciplinas_chave_classe_id_fkey"
  FOREIGN KEY ("classe_id") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "disciplinas_chave" DROP CONSTRAINT IF EXISTS "disciplinas_chave_disciplina_id_fkey";
ALTER TABLE "disciplinas_chave" ADD CONSTRAINT "disciplinas_chave_disciplina_id_fkey"
  FOREIGN KEY ("disciplina_id") REFERENCES "disciplinas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
