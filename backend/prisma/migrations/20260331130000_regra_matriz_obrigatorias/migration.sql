-- Regra de aprovação: exigir aprovação nas disciplinas obrigatórias da matriz curricular (curso_disciplina)
ALTER TABLE "regras_aprovacao"
  ADD COLUMN IF NOT EXISTS "exige_aprovacao_matriz_obrigatorias" BOOLEAN NOT NULL DEFAULT false;
