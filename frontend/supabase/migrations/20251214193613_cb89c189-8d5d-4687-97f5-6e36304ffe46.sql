-- Criar função SECURITY DEFINER para verificar se professor pode ver perfil do aluno
CREATE OR REPLACE FUNCTION public.professor_can_view_student(_professor_id uuid, _student_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM turmas t
    JOIN matriculas m ON m.turma_id = t.id
    WHERE t.professor_id = _professor_id
      AND m.aluno_id = _student_id
  )
$$;

-- Remover política problemática que causa recursão
DROP POLICY IF EXISTS "Professores podem ver perfis de alunos em suas turmas" ON public.profiles;

-- Recriar política usando a função SECURITY DEFINER
CREATE POLICY "Professores podem ver perfis de alunos em suas turmas" 
ON public.profiles 
FOR SELECT 
USING (
  public.professor_can_view_student(auth.uid(), id)
);