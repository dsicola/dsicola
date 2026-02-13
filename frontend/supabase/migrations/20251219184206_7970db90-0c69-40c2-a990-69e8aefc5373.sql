-- Drop the global unique constraint on codigo
ALTER TABLE public.cursos DROP CONSTRAINT IF EXISTS cursos_codigo_key;

-- Create a composite unique constraint for codigo + instituicao_id
-- This allows same codigo in different institutions
CREATE UNIQUE INDEX IF NOT EXISTS cursos_codigo_instituicao_unique 
ON public.cursos (codigo, instituicao_id) 
WHERE instituicao_id IS NOT NULL;

-- For null instituicao_id (global/legacy courses), keep codigo unique
CREATE UNIQUE INDEX IF NOT EXISTS cursos_codigo_global_unique 
ON public.cursos (codigo) 
WHERE instituicao_id IS NULL;