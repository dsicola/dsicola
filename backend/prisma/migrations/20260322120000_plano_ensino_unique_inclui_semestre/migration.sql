-- Ensino superior: um professor pode ter planos distintos por semestre na mesma turma/disciplina/ano.
-- Antes: índice único (inst, prof, disciplina, ano_letivo_id, turma_id) impedia 2º semestre.
-- Depois: com turma + semestre_id → unicidade inclui semestre; com turma sem semestre (secundário/legacy) → comportamento anterior.

DROP INDEX IF EXISTS "plano_ensino_instituicao_id_professor_id_disciplina_id_ano_key";

CREATE UNIQUE INDEX "plano_ensino_com_turma_sem_semestre_unique"
ON "plano_ensino" ("instituicao_id", "professor_id", "disciplina_id", "ano_letivo_id", "turma_id")
WHERE "turma_id" IS NOT NULL AND "semestre_id" IS NULL;

CREATE UNIQUE INDEX "plano_ensino_com_turma_com_semestre_unique"
ON "plano_ensino" ("instituicao_id", "professor_id", "disciplina_id", "ano_letivo_id", "turma_id", "semestre_id")
WHERE "turma_id" IS NOT NULL AND "semestre_id" IS NOT NULL;
