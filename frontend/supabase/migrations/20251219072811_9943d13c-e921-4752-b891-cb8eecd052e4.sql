-- Add tipo field to cursos table for Ensino Médio
ALTER TABLE public.cursos 
ADD COLUMN IF NOT EXISTS tipo text DEFAULT 'geral';

-- Add comment for clarity
COMMENT ON COLUMN public.cursos.tipo IS 'Tipo do curso: geral, tecnico';

-- Create index for better filtering
CREATE INDEX IF NOT EXISTS idx_cursos_tipo ON public.cursos(tipo);