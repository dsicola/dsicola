-- Add curso_estudo_id to turmas table for tracking study track (Ciências, Informática, etc.)
-- This is separate from curso_id which represents the grade level (classe) for Ensino Médio

ALTER TABLE public.turmas 
ADD COLUMN IF NOT EXISTS curso_estudo_id uuid REFERENCES public.cursos(id);

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_turmas_curso_estudo_id ON public.turmas(curso_estudo_id);

-- Add comment for clarity
COMMENT ON COLUMN public.turmas.curso_estudo_id IS 'Curso de estudo (ex: Ciências Humanas, Informática) para Ensino Médio. Diferente de curso_id que representa a classe/ano.';