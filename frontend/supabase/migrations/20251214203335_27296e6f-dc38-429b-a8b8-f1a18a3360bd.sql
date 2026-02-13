-- Adicionar novos campos ao perfil de aluno
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS nome_pai TEXT,
ADD COLUMN IF NOT EXISTS nome_mae TEXT,
ADD COLUMN IF NOT EXISTS morada TEXT,
ADD COLUMN IF NOT EXISTS profissao TEXT;