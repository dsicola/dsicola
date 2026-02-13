-- Add 'ativo' column to cursos table for Ensino Médio module
ALTER TABLE public.cursos ADD COLUMN IF NOT EXISTS ativo boolean NOT NULL DEFAULT true;

-- Add comment for documentation
COMMENT ON COLUMN public.cursos.ativo IS 'Indicates if the course is active (for Ensino Médio)';