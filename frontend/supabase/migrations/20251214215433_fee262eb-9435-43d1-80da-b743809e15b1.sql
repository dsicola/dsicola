-- Create mensalidades table for student payments
CREATE TABLE public.mensalidades (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  aluno_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  valor NUMERIC(10,2) NOT NULL DEFAULT 50000.00,
  status TEXT NOT NULL DEFAULT 'Pendente' CHECK (status IN ('Pendente', 'Pago', 'Atrasado')),
  data_vencimento DATE NOT NULL,
  data_pagamento DATE,
  multa BOOLEAN NOT NULL DEFAULT false,
  valor_multa NUMERIC(10,2) DEFAULT 0,
  percentual_multa NUMERIC(5,2) DEFAULT 10.00,
  mes_referencia INTEGER NOT NULL,
  ano_referencia INTEGER NOT NULL,
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(aluno_id, mes_referencia, ano_referencia)
);

-- Enable RLS
ALTER TABLE public.mensalidades ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admins podem gerenciar mensalidades"
ON public.mensalidades
FOR ALL
USING (has_role(auth.uid(), 'ADMIN'));

CREATE POLICY "Alunos podem ver suas próprias mensalidades"
ON public.mensalidades
FOR SELECT
USING (aluno_id = auth.uid());

-- Trigger for updated_at
CREATE TRIGGER update_mensalidades_updated_at
BEFORE UPDATE ON public.mensalidades
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Function to check if student has overdue payments
CREATE OR REPLACE FUNCTION public.aluno_tem_inadimplencia(_aluno_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.mensalidades
    WHERE aluno_id = _aluno_id
      AND status = 'Atrasado'
  )
$$;

-- Function to apply late fees and update status
CREATE OR REPLACE FUNCTION public.aplicar_multas_mensalidades()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Update status to 'Atrasado' and apply penalty for overdue payments
  UPDATE public.mensalidades
  SET 
    status = 'Atrasado',
    multa = true,
    valor_multa = valor * (percentual_multa / 100),
    updated_at = now()
  WHERE status = 'Pendente'
    AND data_vencimento < CURRENT_DATE
    AND data_pagamento IS NULL;
    
  -- Update student status to inactive for those with overdue payments
  UPDATE public.profiles
  SET 
    status_aluno = 'Inativo por inadimplência',
    updated_at = now()
  WHERE id IN (
    SELECT DISTINCT aluno_id 
    FROM public.mensalidades 
    WHERE status = 'Atrasado'
  )
  AND status_aluno != 'Inativo por inadimplência';
END;
$$;

-- Function to reactivate student when payment is made
CREATE OR REPLACE FUNCTION public.reativar_aluno_apos_pagamento()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If payment is being marked as paid
  IF NEW.status = 'Pago' AND OLD.status != 'Pago' THEN
    NEW.data_pagamento := COALESCE(NEW.data_pagamento, CURRENT_DATE);
    
    -- Check if student has no more overdue payments
    IF NOT EXISTS (
      SELECT 1 FROM public.mensalidades
      WHERE aluno_id = NEW.aluno_id
        AND status = 'Atrasado'
        AND id != NEW.id
    ) THEN
      -- Reactivate student
      UPDATE public.profiles
      SET status_aluno = 'Ativo', updated_at = now()
      WHERE id = NEW.aluno_id
        AND status_aluno = 'Inativo por inadimplência';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger to reactivate student after payment
CREATE TRIGGER trigger_reativar_aluno_apos_pagamento
BEFORE UPDATE ON public.mensalidades
FOR EACH ROW
EXECUTE FUNCTION public.reativar_aluno_apos_pagamento();

-- Enable realtime for mensalidades
ALTER PUBLICATION supabase_realtime ADD TABLE public.mensalidades;