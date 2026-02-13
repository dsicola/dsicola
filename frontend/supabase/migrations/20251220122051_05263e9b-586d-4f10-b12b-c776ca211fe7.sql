-- Tabela para leads comerciais (solicitações de planos)
CREATE TABLE public.leads_comerciais (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome_instituicao TEXT NOT NULL,
  nome_responsavel TEXT NOT NULL,
  email TEXT NOT NULL,
  telefone TEXT NOT NULL,
  cidade TEXT,
  mensagem TEXT,
  plano_interesse TEXT,
  status TEXT NOT NULL DEFAULT 'novo',
  notas TEXT,
  atendido_por UUID REFERENCES public.profiles(id),
  data_contato TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX idx_leads_comerciais_status ON public.leads_comerciais(status);
CREATE INDEX idx_leads_comerciais_created_at ON public.leads_comerciais(created_at DESC);

-- RLS
ALTER TABLE public.leads_comerciais ENABLE ROW LEVEL SECURITY;

-- Inserção pública (formulário de vendas)
CREATE POLICY "Permitir inserção pública de leads"
  ON public.leads_comerciais FOR INSERT
  WITH CHECK (true);

-- SUPER_ADMIN pode gerenciar todos os leads
CREATE POLICY "SUPER_ADMIN pode gerenciar leads"
  ON public.leads_comerciais FOR ALL
  USING (public.has_role(auth.uid(), 'SUPER_ADMIN'));

-- Trigger para updated_at
CREATE TRIGGER update_leads_comerciais_updated_at
  BEFORE UPDATE ON public.leads_comerciais
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();