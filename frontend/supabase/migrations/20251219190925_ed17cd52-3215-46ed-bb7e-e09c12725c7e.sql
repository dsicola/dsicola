-- Add secondary and tertiary color columns
ALTER TABLE public.configuracoes_instituicao 
ADD COLUMN IF NOT EXISTS cor_secundaria text DEFAULT '#1F2937',
ADD COLUMN IF NOT EXISTS cor_terciaria text DEFAULT '#F8FAFC';