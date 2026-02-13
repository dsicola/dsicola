-- Create table for institution payment history
CREATE TABLE public.pagamentos_instituicao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instituicao_id UUID NOT NULL REFERENCES public.instituicoes(id) ON DELETE CASCADE,
  assinatura_id UUID REFERENCES public.assinaturas(id) ON DELETE SET NULL,
  valor NUMERIC NOT NULL DEFAULT 0,
  data_pagamento DATE,
  data_vencimento DATE NOT NULL,
  forma_pagamento TEXT NOT NULL DEFAULT 'Multicaixa Express',
  status TEXT NOT NULL DEFAULT 'Pendente',
  comprovativo_url TEXT,
  comprovativo_texto TEXT,
  observacoes TEXT,
  confirmado_por UUID REFERENCES auth.users(id),
  data_confirmacao TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add columns to assinaturas for payment info
ALTER TABLE public.assinaturas
ADD COLUMN IF NOT EXISTS iban TEXT,
ADD COLUMN IF NOT EXISTS multicaixa_numero TEXT,
ADD COLUMN IF NOT EXISTS instrucoes_pagamento TEXT,
ADD COLUMN IF NOT EXISTS dias_antes_lembrete INTEGER DEFAULT 5,
ADD COLUMN IF NOT EXISTS ultimo_lembrete_enviado TIMESTAMP WITH TIME ZONE;

-- Enable RLS
ALTER TABLE public.pagamentos_instituicao ENABLE ROW LEVEL SECURITY;

-- RLS Policies for pagamentos_instituicao
CREATE POLICY "SUPER_ADMIN pode gerenciar todos pagamentos"
ON public.pagamentos_instituicao
FOR ALL
USING (has_role(auth.uid(), 'SUPER_ADMIN'::user_role));

CREATE POLICY "ADMIN pode ver pagamentos da sua instituição"
ON public.pagamentos_instituicao
FOR SELECT
USING (
  has_role(auth.uid(), 'ADMIN'::user_role) 
  AND instituicao_id = get_user_instituicao(auth.uid())
);

CREATE POLICY "ADMIN pode inserir pagamentos da sua instituição"
ON public.pagamentos_instituicao
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'ADMIN'::user_role) 
  AND instituicao_id = get_user_instituicao(auth.uid())
);

-- Create trigger for updated_at
CREATE TRIGGER update_pagamentos_instituicao_updated_at
BEFORE UPDATE ON public.pagamentos_instituicao
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Function to check if institution subscription is expired
CREATE OR REPLACE FUNCTION public.instituicao_assinatura_expirada(_instituicao_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT 
      CASE 
        WHEN a.status IN ('suspensa', 'cancelada') THEN true
        WHEN a.data_proximo_pagamento IS NOT NULL AND a.data_proximo_pagamento < CURRENT_DATE THEN true
        ELSE false
      END
     FROM assinaturas a
     WHERE a.instituicao_id = _instituicao_id
     LIMIT 1),
    false
  )
$$;

-- Function to check subscription status for a user
CREATE OR REPLACE FUNCTION public.usuario_instituicao_bloqueada(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT public.instituicao_assinatura_expirada(p.instituicao_id)
     FROM profiles p
     WHERE p.id = _user_id AND p.instituicao_id IS NOT NULL),
    false
  )
$$;