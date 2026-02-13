-- AlterTable: Adicionar campos condicionais ao plano_ensino
ALTER TABLE "plano_ensino" ADD COLUMN "semestre" INTEGER,
ADD COLUMN "classe_ou_ano" TEXT,
ADD COLUMN "carga_horaria_planejada" INTEGER,
ADD COLUMN "conteudo_programatico" TEXT;

-- DropIndex: Remover constraint único antigo
DROP INDEX IF EXISTS "plano_ensino_curso_id_classe_id_disciplina_id_professor_id__key";

-- CreateIndex: Adicionar novo constraint único (instituicao_id, disciplina_id, ano_letivo_id)
CREATE UNIQUE INDEX "plano_ensino_instituicao_id_disciplina_id_ano_letivo_id_key" ON "plano_ensino"("instituicao_id", "disciplina_id", "ano_letivo_id");

-- CreateIndex: Adicionar índices para melhor performance
CREATE INDEX IF NOT EXISTS "plano_ensino_curso_id_idx" ON "plano_ensino"("curso_id");
CREATE INDEX IF NOT EXISTS "plano_ensino_classe_id_idx" ON "plano_ensino"("classe_id");
CREATE INDEX IF NOT EXISTS "plano_ensino_disciplina_id_idx" ON "plano_ensino"("disciplina_id");
CREATE INDEX IF NOT EXISTS "plano_ensino_professor_id_idx" ON "plano_ensino"("professor_id");
CREATE INDEX IF NOT EXISTS "plano_ensino_instituicao_id_idx" ON "plano_ensino"("instituicao_id");

