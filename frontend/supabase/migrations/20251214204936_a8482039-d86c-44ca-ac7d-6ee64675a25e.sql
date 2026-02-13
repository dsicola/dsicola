-- Drop the problematic policy that causes infinite recursion
DROP POLICY IF EXISTS "Alunos podem ver suas turmas" ON public.turmas;

-- Recreate the policy without recursion by using a simpler approach
-- Alunos can see turmas they are enrolled in via a subquery that doesn't reference turmas again
CREATE POLICY "Alunos podem ver suas turmas" 
ON public.turmas 
FOR SELECT 
USING (
  has_role(auth.uid(), 'ADMIN'::user_role) OR
  professor_id = auth.uid() OR
  id IN (SELECT turma_id FROM public.matriculas WHERE aluno_id = auth.uid())
);