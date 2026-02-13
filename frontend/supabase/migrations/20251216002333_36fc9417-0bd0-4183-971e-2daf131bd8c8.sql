-- Create candidaturas table for online applications
CREATE TABLE public.candidaturas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome_completo TEXT NOT NULL,
  email TEXT NOT NULL,
  telefone TEXT,
  numero_identificacao TEXT NOT NULL,
  data_nascimento DATE,
  genero TEXT,
  morada TEXT,
  cidade TEXT,
  pais TEXT DEFAULT 'Angola',
  curso_pretendido UUID REFERENCES public.cursos(id),
  turno_preferido TEXT,
  instituicao_id UUID REFERENCES public.instituicoes(id),
  documentos_url TEXT[],
  status TEXT NOT NULL DEFAULT 'Pendente',
  observacoes TEXT,
  data_candidatura TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  data_analise TIMESTAMP WITH TIME ZONE,
  analisado_por UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.candidaturas ENABLE ROW LEVEL SECURITY;

-- Create policies for candidaturas
CREATE POLICY "Permitir inserção pública de candidaturas" 
ON public.candidaturas 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Admins podem ver todas candidaturas da instituição" 
ON public.candidaturas 
FOR SELECT 
USING (
  has_role(auth.uid(), 'ADMIN'::user_role) 
  AND instituicao_id = get_user_instituicao(auth.uid())
);

CREATE POLICY "Admins podem atualizar candidaturas da instituição" 
ON public.candidaturas 
FOR UPDATE 
USING (
  has_role(auth.uid(), 'ADMIN'::user_role) 
  AND instituicao_id = get_user_instituicao(auth.uid())
);

CREATE POLICY "Secretaria pode ver candidaturas da instituição" 
ON public.candidaturas 
FOR SELECT 
USING (
  has_role(auth.uid(), 'SECRETARIA'::user_role)
);

CREATE POLICY "Secretaria pode atualizar candidaturas" 
ON public.candidaturas 
FOR UPDATE 
USING (
  has_role(auth.uid(), 'SECRETARIA'::user_role)
);

CREATE POLICY "SUPER_ADMIN pode ver todas candidaturas" 
ON public.candidaturas 
FOR ALL 
USING (has_role(auth.uid(), 'SUPER_ADMIN'::user_role));

-- Create index for better performance
CREATE INDEX idx_candidaturas_status ON public.candidaturas(status);
CREATE INDEX idx_candidaturas_instituicao ON public.candidaturas(instituicao_id);
CREATE INDEX idx_candidaturas_email ON public.candidaturas(email);

-- Create trigger for updated_at
CREATE TRIGGER update_candidaturas_updated_at
BEFORE UPDATE ON public.candidaturas
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();