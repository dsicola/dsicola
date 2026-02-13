-- Create storage bucket for student documents
INSERT INTO storage.buckets (id, name, public) VALUES ('documentos_alunos', 'documentos_alunos', false);

-- Create table to track uploaded student documents
CREATE TABLE public.documentos_aluno (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  aluno_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  nome_arquivo TEXT NOT NULL,
  tipo_documento TEXT NOT NULL, -- 'bi_copia', 'certificado', 'comprovante_residencia', 'outro'
  descricao TEXT,
  arquivo_url TEXT NOT NULL,
  tamanho_bytes INTEGER,
  uploaded_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.documentos_aluno ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admins podem gerenciar documentos de alunos"
  ON public.documentos_aluno FOR ALL
  USING (has_role(auth.uid(), 'ADMIN'));

CREATE POLICY "Secretaria pode gerenciar documentos de alunos"
  ON public.documentos_aluno FOR ALL
  USING (has_role(auth.uid(), 'SECRETARIA'));

CREATE POLICY "Alunos podem ver seus próprios documentos"
  ON public.documentos_aluno FOR SELECT
  USING (aluno_id = auth.uid());

CREATE POLICY "Alunos podem inserir seus próprios documentos"
  ON public.documentos_aluno FOR INSERT
  WITH CHECK (aluno_id = auth.uid() OR has_role(auth.uid(), 'ADMIN') OR has_role(auth.uid(), 'SECRETARIA'));

-- Trigger for updated_at
CREATE TRIGGER update_documentos_aluno_updated_at
  BEFORE UPDATE ON public.documentos_aluno
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Storage policies for documentos_alunos bucket
CREATE POLICY "Admins podem ver todos os documentos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'documentos_alunos' AND has_role(auth.uid(), 'ADMIN'));

CREATE POLICY "Secretaria pode ver todos os documentos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'documentos_alunos' AND has_role(auth.uid(), 'SECRETARIA'));

CREATE POLICY "Alunos podem ver seus documentos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'documentos_alunos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Admins podem fazer upload de documentos"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'documentos_alunos' AND has_role(auth.uid(), 'ADMIN'));

CREATE POLICY "Secretaria pode fazer upload de documentos"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'documentos_alunos' AND has_role(auth.uid(), 'SECRETARIA'));

CREATE POLICY "Alunos podem fazer upload de seus documentos"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'documentos_alunos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Admins podem deletar documentos"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'documentos_alunos' AND has_role(auth.uid(), 'ADMIN'));

CREATE POLICY "Secretaria pode deletar documentos"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'documentos_alunos' AND has_role(auth.uid(), 'SECRETARIA'));