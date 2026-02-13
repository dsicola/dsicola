-- Create configuracoes_instituicao table
CREATE TABLE public.configuracoes_instituicao (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome_instituicao TEXT NOT NULL DEFAULT 'Universidade',
  logo_url TEXT,
  imagem_capa_login_url TEXT,
  cor_primaria TEXT DEFAULT '#8B5CF6',
  email TEXT,
  telefone TEXT,
  endereco TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.configuracoes_instituicao ENABLE ROW LEVEL SECURITY;

-- RLS Policies - Everyone can read, only admins can modify
CREATE POLICY "Todos podem ver configurações"
ON public.configuracoes_instituicao
FOR SELECT
USING (true);

CREATE POLICY "Admins podem gerenciar configurações"
ON public.configuracoes_instituicao
FOR ALL
USING (has_role(auth.uid(), 'ADMIN'));

-- Trigger for updated_at
CREATE TRIGGER update_configuracoes_instituicao_updated_at
BEFORE UPDATE ON public.configuracoes_instituicao
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default configuration
INSERT INTO public.configuracoes_instituicao (nome_instituicao)
VALUES ('Universidade');

-- Create storage bucket for institution assets
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('instituicao', 'instituicao', true, 1048576);

-- Storage policies for institution bucket
CREATE POLICY "Public can view institution assets"
ON storage.objects FOR SELECT
USING (bucket_id = 'instituicao');

CREATE POLICY "Admins can upload institution assets"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'instituicao' AND has_role(auth.uid(), 'ADMIN'));

CREATE POLICY "Admins can update institution assets"
ON storage.objects FOR UPDATE
USING (bucket_id = 'instituicao' AND has_role(auth.uid(), 'ADMIN'));

CREATE POLICY "Admins can delete institution assets"
ON storage.objects FOR DELETE
USING (bucket_id = 'instituicao' AND has_role(auth.uid(), 'ADMIN'));