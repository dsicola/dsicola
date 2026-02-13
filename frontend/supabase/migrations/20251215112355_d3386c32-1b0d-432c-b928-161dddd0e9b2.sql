-- Add new fields to profiles table for professor details
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS genero TEXT,
ADD COLUMN IF NOT EXISTS cidade TEXT,
ADD COLUMN IF NOT EXISTS pais TEXT,
ADD COLUMN IF NOT EXISTS codigo_postal TEXT,
ADD COLUMN IF NOT EXISTS tipo_sanguineo TEXT,
ADD COLUMN IF NOT EXISTS qualificacao TEXT,
ADD COLUMN IF NOT EXISTS data_admissao DATE,
ADD COLUMN IF NOT EXISTS data_saida DATE,
ADD COLUMN IF NOT EXISTS cargo_atual TEXT,
ADD COLUMN IF NOT EXISTS codigo_funcionario TEXT,
ADD COLUMN IF NOT EXISTS horas_trabalho TEXT;