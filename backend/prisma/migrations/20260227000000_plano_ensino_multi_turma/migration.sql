-- Permite que o mesmo professor dê a mesma disciplina em várias turmas
-- Ex: Professor Informática em 10ª A (08h-10h) e 10ª B (11h-12h)

-- 1. Remover constraint antiga (1 plano por disciplina/ano)
DROP INDEX IF EXISTS "plano_ensino_instituicao_id_disciplina_id_ano_letivo_id_key";

-- 2. Novo unique: um plano por (professor, disciplina, ano, turma)
-- Com turma preenchida: permite múltiplas turmas para o mesmo professor
-- Sem turma (null): partial index garante no máx. 1 por (prof, disc, ano)
CREATE UNIQUE INDEX "plano_ensino_instituicao_id_professor_id_disciplina_id_ano_key" 
ON "plano_ensino"("instituicao_id", "professor_id", "disciplina_id", "ano_letivo_id", "turma_id") 
WHERE "turma_id" IS NOT NULL;

CREATE UNIQUE INDEX "plano_ensino_sem_turma_unique_idx" 
ON "plano_ensino"("instituicao_id", "professor_id", "disciplina_id", "ano_letivo_id") 
WHERE "turma_id" IS NULL;
