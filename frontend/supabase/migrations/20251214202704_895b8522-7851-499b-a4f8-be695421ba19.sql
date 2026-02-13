-- Add new columns to profiles for student management
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS data_nascimento DATE,
ADD COLUMN IF NOT EXISTS status_aluno TEXT DEFAULT 'Ativo';

-- Create table for student-discipline enrollments
CREATE TABLE public.aluno_disciplinas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  aluno_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  disciplina_id UUID NOT NULL REFERENCES public.disciplinas(id) ON DELETE CASCADE,
  turma_id UUID REFERENCES public.turmas(id) ON DELETE SET NULL,
  ano INTEGER NOT NULL,
  semestre TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Matriculado',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(aluno_id, disciplina_id, ano, semestre)
);

-- Enable RLS
ALTER TABLE public.aluno_disciplinas ENABLE ROW LEVEL SECURITY;

-- RLS Policies for aluno_disciplinas
CREATE POLICY "Admins podem gerenciar matrículas de alunos" 
ON public.aluno_disciplinas 
FOR ALL 
USING (has_role(auth.uid(), 'ADMIN'::user_role));

CREATE POLICY "Alunos podem ver suas próprias matrículas" 
ON public.aluno_disciplinas 
FOR SELECT 
USING (aluno_id = auth.uid());

CREATE POLICY "Professores podem ver matrículas de suas disciplinas" 
ON public.aluno_disciplinas 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM professor_disciplinas pd
    WHERE pd.disciplina_id = aluno_disciplinas.disciplina_id
    AND pd.professor_id = auth.uid()
  )
);

-- Trigger for updated_at
CREATE TRIGGER update_aluno_disciplinas_updated_at
BEFORE UPDATE ON public.aluno_disciplinas
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();