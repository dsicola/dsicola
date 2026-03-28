-- AlterTable
ALTER TABLE "curso_disciplina" ADD COLUMN "classe_id" TEXT;

-- AddForeignKey
ALTER TABLE "curso_disciplina" ADD CONSTRAINT "curso_disciplina_classe_id_fkey" FOREIGN KEY ("classe_id") REFERENCES "classes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- DropIndex (unique curso+disciplina — substituído por índices parciais)
DROP INDEX IF EXISTS "curso_disciplina_curso_id_disciplina_id_key";

-- Unique: no máximo um vínculo "global" (sem classe) por par curso+disciplina
CREATE UNIQUE INDEX "curso_disciplina_curso_disc_sem_classe" ON "curso_disciplina"("curso_id", "disciplina_id") WHERE "classe_id" IS NULL;

-- Unique: no máximo um vínculo por par curso+disciplina+classe quando classe definida
CREATE UNIQUE INDEX "curso_disciplina_curso_disc_com_classe" ON "curso_disciplina"("curso_id", "disciplina_id", "classe_id") WHERE "classe_id" IS NOT NULL;

-- CreateIndex
CREATE INDEX "curso_disciplina_classe_id_idx" ON "curso_disciplina"("classe_id");
CREATE INDEX "curso_disciplina_curso_id_disciplina_id_classe_id_idx" ON "curso_disciplina"("curso_id", "disciplina_id", "classe_id");
