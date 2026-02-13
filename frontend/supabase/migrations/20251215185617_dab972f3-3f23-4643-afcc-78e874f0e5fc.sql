-- Tabela de instituições da plataforma
CREATE TABLE public.instituicoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  subdominio TEXT NOT NULL UNIQUE,
  logo_url TEXT,
  email_contato TEXT,
  telefone TEXT,
  endereco TEXT,
  status TEXT NOT NULL DEFAULT 'ativa',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.instituicoes ENABLE ROW LEVEL SECURITY;

-- Apenas SUPER_ADMIN pode gerenciar instituições
CREATE POLICY "SUPER_ADMIN pode gerenciar instituições"
ON public.instituicoes
FOR ALL
USING (has_role(auth.uid(), 'SUPER_ADMIN'));

-- Trigger para atualizar updated_at
CREATE TRIGGER update_instituicoes_updated_at
BEFORE UPDATE ON public.instituicoes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Inserir a instituição padrão (DSICOLA)
INSERT INTO public.instituicoes (nome, subdominio, email_contato, status)
VALUES ('DSICOLA', 'dsicola', 'contato@dsicola.com', 'ativa');