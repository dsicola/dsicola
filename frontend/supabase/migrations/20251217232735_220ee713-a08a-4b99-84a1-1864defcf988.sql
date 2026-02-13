-- Add subscription period type to assinaturas table
ALTER TABLE public.assinaturas 
ADD COLUMN IF NOT EXISTS tipo_periodo text NOT NULL DEFAULT 'mensal' CHECK (tipo_periodo IN ('mensal', 'trimestral', 'semestral', 'anual'));

-- Add comment for clarity
COMMENT ON COLUMN public.assinaturas.tipo_periodo IS 'Tipo de período da assinatura: mensal, trimestral, semestral, anual';