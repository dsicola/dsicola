-- Migration: Unique (estudanteId, disciplinaId, turmaId, professorId, componente) para evitar conflito entre professores na mesma turma
-- SEGURO: Não remove dados. Apenas substitui índice parcial e garante backfill.

-- 1) Garantir estudante_id preenchido (alias de aluno_id)
UPDATE "notas" SET "estudante_id" = "aluno_id" WHERE "estudante_id" IS NULL;

-- 2) Backfill ano_letivo_id e instituicao_id onde faltam
UPDATE "notas" n
SET "ano_letivo_id" = COALESCE(n."ano_letivo_id", pe."ano_letivo_id")
FROM "plano_ensino" pe
WHERE n."plano_ensino_id" = pe.id AND n."ano_letivo_id" IS NULL;

UPDATE "notas" n
SET "instituicao_id" = COALESCE(n."instituicao_id", pe."instituicao_id")
FROM "plano_ensino" pe
WHERE n."plano_ensino_id" = pe.id AND n."instituicao_id" IS NULL;

-- 3) Remover índice único parcial antigo (usava aluno_id)
DROP INDEX IF EXISTS "notas_estudante_disciplina_turma_professor_componente_key";

-- 4) Criar índice único parcial com estudante_id (evita conflito entre professores)
CREATE UNIQUE INDEX "notas_estudante_disciplina_turma_professor_componente_key"
  ON "notas" ("estudante_id", "disciplina_id", "turma_id", "professor_id", "componente")
  WHERE "estudante_id" IS NOT NULL
    AND "disciplina_id" IS NOT NULL
    AND "turma_id" IS NOT NULL
    AND "professor_id" IS NOT NULL
    AND "componente" IS NOT NULL;
