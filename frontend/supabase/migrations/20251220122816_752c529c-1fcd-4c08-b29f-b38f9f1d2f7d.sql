-- Adicionar preços diferenciados por tipo de instituição na tabela planos
ALTER TABLE public.planos 
ADD COLUMN IF NOT EXISTS preco_secundario numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS preco_universitario numeric DEFAULT 0;

-- Adicionar suporte a período de teste na tabela assinaturas
ALTER TABLE public.assinaturas 
ADD COLUMN IF NOT EXISTS em_teste boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS data_fim_teste date,
ADD COLUMN IF NOT EXISTS dias_teste integer DEFAULT 14;

-- Atualizar os preços existentes (copiar preco_mensal para ambos os tipos)
UPDATE public.planos 
SET preco_secundario = preco_mensal,
    preco_universitario = preco_mensal
WHERE preco_secundario = 0 OR preco_universitario = 0;