
-- Add additional fields to profiles table for professors
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS telefone text,
ADD COLUMN IF NOT EXISTS numero_identificacao text;

-- Create junction table for professor-discipline assignments
CREATE TABLE public.professor_disciplinas (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  professor_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  disciplina_id uuid NOT NULL REFERENCES public.disciplinas(id) ON DELETE CASCADE,
  ano integer NOT NULL,
  semestre text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  
  -- Ensure a discipline can only have 1 professor per semester/year
  UNIQUE(disciplina_id, ano, semestre)
);

-- Enable RLS
ALTER TABLE public.professor_disciplinas ENABLE ROW LEVEL SECURITY;

-- RLS policies for professor_disciplinas
CREATE POLICY "Admins podem gerenciar atribuições de professores"
ON public.professor_disciplinas
FOR ALL
USING (has_role(auth.uid(), 'ADMIN'::user_role));

CREATE POLICY "Professores podem ver suas atribuições"
ON public.professor_disciplinas
FOR SELECT
USING (professor_id = auth.uid());

-- Create index for better query performance
CREATE INDEX idx_professor_disciplinas_professor ON public.professor_disciplinas(professor_id);
CREATE INDEX idx_professor_disciplinas_disciplina ON public.professor_disciplinas(disciplina_id);
CREATE INDEX idx_professor_disciplinas_periodo ON public.professor_disciplinas(ano, semestre);

-- Create storage bucket for avatars if not exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for avatars
CREATE POLICY "Avatar images are publicly accessible"
ON storage.objects
FOR SELECT
USING (bucket_id = 'avatars');

CREATE POLICY "Admins can upload avatars"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'avatars' AND has_role(auth.uid(), 'ADMIN'::user_role));

CREATE POLICY "Admins can update avatars"
ON storage.objects
FOR UPDATE
USING (bucket_id = 'avatars' AND has_role(auth.uid(), 'ADMIN'::user_role));

CREATE POLICY "Admins can delete avatars"
ON storage.objects
FOR DELETE
USING (bucket_id = 'avatars' AND has_role(auth.uid(), 'ADMIN'::user_role));

CREATE POLICY "Users can upload their own avatar"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their own avatar"
ON storage.objects
FOR UPDATE
USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
