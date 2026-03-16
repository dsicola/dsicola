-- Modelo de pauta por curso: PADRAO (mini pauta por disciplina) ou SAUDE (pauta conclusão)
ALTER TABLE "cursos" ADD COLUMN IF NOT EXISTS "modelo_pauta" TEXT DEFAULT 'PADRAO';
