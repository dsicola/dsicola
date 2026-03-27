-- Pauta de conclusão do ciclo (secundário): ordens de classe + tipo de média final do curso
ALTER TABLE "parametros_sistema" ADD COLUMN IF NOT EXISTS "secundario_ciclo_ordens_conclusao" JSONB;
ALTER TABLE "parametros_sistema" ADD COLUMN IF NOT EXISTS "secundario_media_final_curso_tipo" TEXT DEFAULT 'SIMPLES';
