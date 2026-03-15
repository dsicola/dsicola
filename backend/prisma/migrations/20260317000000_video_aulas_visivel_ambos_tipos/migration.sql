-- Video aulas: definir tipo_instituicao = NULL para serem visíveis em Secundário E Superior
-- tipo_instituicao NULL = "Ambos" (visível para ambos os tipos de instituição)
-- Corrige o problema onde video aulas só apareciam no Secundário e não no Superior
UPDATE video_aulas
SET tipo_instituicao = NULL
WHERE tipo_instituicao IS NOT NULL;
