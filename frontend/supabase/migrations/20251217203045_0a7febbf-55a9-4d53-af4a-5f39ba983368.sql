-- Add tipo_instituicao column to instituicoes table
ALTER TABLE public.instituicoes 
ADD COLUMN IF NOT EXISTS tipo_instituicao text NOT NULL DEFAULT 'UNIVERSIDADE';

-- Add comment for documentation
COMMENT ON COLUMN public.instituicoes.tipo_instituicao IS 'Tipo de instituição: UNIVERSIDADE ou ENSINO_MEDIO';

-- Also add to configuracoes_instituicao for easier access
ALTER TABLE public.configuracoes_instituicao 
ADD COLUMN IF NOT EXISTS tipo_instituicao text NOT NULL DEFAULT 'UNIVERSIDADE';