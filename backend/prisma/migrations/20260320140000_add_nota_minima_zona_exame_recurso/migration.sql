-- Nota mínima da zona de recurso/exame (0-20), configurável por instituição; padrão 7 (Angola / escala 0-20).
ALTER TABLE "parametros_sistema" ADD COLUMN IF NOT EXISTS "nota_minima_zona_exame_recurso" DECIMAL(5,2) DEFAULT 7;

UPDATE "parametros_sistema" SET "nota_minima_zona_exame_recurso" = 7 WHERE "nota_minima_zona_exame_recurso" IS NULL;
