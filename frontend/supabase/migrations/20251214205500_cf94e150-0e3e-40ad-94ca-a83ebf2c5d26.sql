-- Drop all existing policies on turmas to start fresh
DROP POLICY IF EXISTS "Alunos podem ver suas turmas" ON public.turmas;
DROP POLICY IF EXISTS "Admins podem gerenciar turmas" ON public.turmas;
DROP POLICY IF EXISTS "Professores podem ver suas turmas" ON public.turmas;

-- Create a security definer function to check if user can view turma (avoids recursion)
CREATE OR REPLACE FUNCTION public.can_view_turma(_user_id uuid, _turma_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.matriculas
    WHERE turma_id = _turma_id
      AND aluno_id = _user_id
  )
$$;

-- Recreate policies without recursion
CREATE POLICY "Admins podem gerenciar turmas" 
ON public.turmas 
FOR ALL 
USING (has_role(auth.uid(), 'ADMIN'::user_role))
WITH CHECK (has_role(auth.uid(), 'ADMIN'::user_role));

CREATE POLICY "Professores podem ver suas turmas" 
ON public.turmas 
FOR SELECT 
USING (professor_id = auth.uid());

CREATE POLICY "Alunos podem ver suas turmas" 
ON public.turmas 
FOR SELECT 
USING (can_view_turma(auth.uid(), id));