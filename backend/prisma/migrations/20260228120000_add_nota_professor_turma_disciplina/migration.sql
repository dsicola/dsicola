-- Migration: Adicionar campos explícitos em Nota para evitar conflito entre professores na mesma turma (SIGA/SIGAE)
-- OBJETIVO: Garantir que cada nota seja vinculada a estudanteId, disciplinaId, turmaId, professorId e componente.
-- SEGURO: Não remove dados nem campos existentes. Apenas adiciona e backfill.

-- 1) Adicionar novas colunas (nullable para permitir backfill gradual)
ALTER TABLE "notas" ADD COLUMN IF NOT EXISTS "estudante_id" TEXT;
ALTER TABLE "notas" ADD COLUMN IF NOT EXISTS "disciplina_id" TEXT;
ALTER TABLE "notas" ADD COLUMN IF NOT EXISTS "turma_id" TEXT;
ALTER TABLE "notas" ADD COLUMN IF NOT EXISTS "professor_id" TEXT;
ALTER TABLE "notas" ADD COLUMN IF NOT EXISTS "semestre_id" TEXT;
ALTER TABLE "notas" ADD COLUMN IF NOT EXISTS "componente" TEXT;

-- 2) Backfill: preencher a partir de plano_ensino, exame e avaliacao
-- Notas com exameId: obter turma do exame, disciplina/professor/semestre do plano
UPDATE "notas" n
SET
  estudante_id = sub.aluno_id,
  disciplina_id = sub.disciplina_id,
  turma_id = sub.turma_id,
  professor_id = sub.professor_id,
  semestre_id = sub.semestre_id,
  componente = sub.componente
FROM (
  SELECT n2.id, n2.aluno_id, pe.disciplina_id, pe.professor_id,
    COALESCE(e.turma_id, pe.turma_id) AS turma_id,
    pe.semestre_id,
    'exame-' || n2.exame_id AS componente
  FROM "notas" n2
  JOIN "plano_ensino" pe ON n2.plano_ensino_id = pe.id
  LEFT JOIN "exames" e ON e.id = n2.exame_id
  WHERE n2.exame_id IS NOT NULL AND n2.exame_id <> ''
) sub
WHERE n.id = sub.id;

-- Notas com avaliacaoId: obter turma da avaliacao, disciplina/professor/semestre do plano
UPDATE "notas" n
SET
  estudante_id = sub.aluno_id,
  disciplina_id = sub.disciplina_id,
  turma_id = sub.turma_id,
  professor_id = sub.professor_id,
  semestre_id = sub.semestre_id,
  componente = sub.componente
FROM (
  SELECT n2.id, n2.aluno_id, pe.disciplina_id, pe.professor_id,
    COALESCE(a.turma_id, pe.turma_id) AS turma_id,
    pe.semestre_id,
    'av-' || n2.avaliacao_id AS componente
  FROM "notas" n2
  JOIN "plano_ensino" pe ON n2.plano_ensino_id = pe.id
  JOIN "avaliacoes" a ON a.id = n2.avaliacao_id AND a.plano_ensino_id = pe.id
  WHERE n2.avaliacao_id IS NOT NULL AND n2.avaliacao_id <> ''
) sub
WHERE n.id = sub.id;

-- Fallback para notas que não foram preenchidas (ex: apenas plano, sem exame/avaliacao)
UPDATE "notas" n
SET
  estudante_id = COALESCE(n.estudante_id, sub.aluno_id),
  disciplina_id = COALESCE(n.disciplina_id, sub.disciplina_id),
  turma_id = COALESCE(n.turma_id, sub.turma_id),
  professor_id = COALESCE(n.professor_id, sub.professor_id),
  semestre_id = COALESCE(n.semestre_id, sub.semestre_id),
  componente = COALESCE(n.componente, sub.componente)
FROM (
  SELECT n2.id, n2.aluno_id, pe.disciplina_id, pe.turma_id, pe.professor_id, pe.semestre_id,
    'legacy-' || n2.id AS componente
  FROM "notas" n2
  JOIN "plano_ensino" pe ON n2.plano_ensino_id = pe.id
  WHERE n2.disciplina_id IS NULL OR n2.professor_id IS NULL OR n2.componente IS NULL
) sub
WHERE n.id = sub.id;

-- 3) Adicionar índices para performance
CREATE INDEX IF NOT EXISTS "notas_disciplina_id_idx" ON "notas"("disciplina_id");
CREATE INDEX IF NOT EXISTS "notas_turma_id_idx" ON "notas"("turma_id");
CREATE INDEX IF NOT EXISTS "notas_professor_id_idx" ON "notas"("professor_id");

-- 4) Adicionar FKs (apenas se não existirem)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'notas_estudante_id_fkey') THEN
    ALTER TABLE "notas" ADD CONSTRAINT "notas_estudante_id_fkey"
      FOREIGN KEY ("estudante_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'notas_disciplina_id_fkey') THEN
    ALTER TABLE "notas" ADD CONSTRAINT "notas_disciplina_id_fkey"
      FOREIGN KEY ("disciplina_id") REFERENCES "disciplinas"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'notas_turma_id_fkey') THEN
    ALTER TABLE "notas" ADD CONSTRAINT "notas_turma_id_fkey"
      FOREIGN KEY ("turma_id") REFERENCES "turmas"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'notas_professor_id_fkey') THEN
    ALTER TABLE "notas" ADD CONSTRAINT "notas_professor_id_fkey"
      FOREIGN KEY ("professor_id") REFERENCES "professores"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'notas_semestre_id_fkey') THEN
    ALTER TABLE "notas" ADD CONSTRAINT "notas_semestre_id_fkey"
      FOREIGN KEY ("semestre_id") REFERENCES "semestres"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- 5) Criar índice único PARCIAL para evitar duplicatas (estudante, disciplina, turma, professor, componente)
-- Aplica-se apenas quando todos os campos estão preenchidos (dados backfilled ou novos)
CREATE UNIQUE INDEX IF NOT EXISTS "notas_estudante_disciplina_turma_professor_componente_key"
  ON "notas" ("aluno_id", "disciplina_id", "turma_id", "professor_id", "componente")
  WHERE "disciplina_id" IS NOT NULL
    AND "turma_id" IS NOT NULL
    AND "professor_id" IS NOT NULL
    AND "componente" IS NOT NULL;
