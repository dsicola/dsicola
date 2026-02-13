-- Adicionar coluna valor_mensalidade à tabela cursos
ALTER TABLE public.cursos 
ADD COLUMN IF NOT EXISTS valor_mensalidade numeric NOT NULL DEFAULT 50000;

-- Comentário para documentação
COMMENT ON COLUMN public.cursos.valor_mensalidade IS 'Valor da mensalidade do curso em Kz';