-- Add description field to configuracoes_instituicao
ALTER TABLE public.configuracoes_instituicao 
ADD COLUMN IF NOT EXISTS descricao TEXT;

-- Add metas_financeiras table for financial goals
CREATE TABLE IF NOT EXISTS public.metas_financeiras (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  mes INTEGER NOT NULL CHECK (mes >= 1 AND mes <= 12),
  ano INTEGER NOT NULL,
  valor_meta NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(mes, ano)
);

-- Enable RLS on metas_financeiras
ALTER TABLE public.metas_financeiras ENABLE ROW LEVEL SECURITY;

-- RLS policies for metas_financeiras
CREATE POLICY "Admins podem gerenciar metas"
ON public.metas_financeiras
FOR ALL
USING (has_role(auth.uid(), 'ADMIN'::user_role));

CREATE POLICY "Secretaria pode ver metas"
ON public.metas_financeiras
FOR SELECT
USING (has_role(auth.uid(), 'SECRETARIA'::user_role));

-- Trigger for updated_at
CREATE TRIGGER update_metas_financeiras_updated_at
BEFORE UPDATE ON public.metas_financeiras
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();