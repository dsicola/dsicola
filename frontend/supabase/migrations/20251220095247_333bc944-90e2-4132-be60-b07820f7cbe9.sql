-- Add grau and duracao columns to cursos table
ALTER TABLE public.cursos 
ADD COLUMN IF NOT EXISTS grau text DEFAULT 'Licenciatura',
ADD COLUMN IF NOT EXISTS duracao text DEFAULT '4 anos';