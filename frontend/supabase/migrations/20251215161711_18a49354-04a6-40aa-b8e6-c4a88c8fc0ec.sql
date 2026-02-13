-- Corrigir a função can_view_turma para evitar recursão infinita
-- Usar SECURITY DEFINER para bypasear RLS dentro da função

CREATE OR REPLACE FUNCTION public.can_view_turma(_user_id uuid, _turma_id uuid)
RETURNS boolean
LANGUAGE sql
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

-- Atualizar a política de alunos para turmas sem causar recursão
DROP POLICY IF EXISTS "Alunos podem ver suas turmas" ON public.turmas;

CREATE POLICY "Alunos podem ver suas turmas" 
ON public.turmas 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.matriculas m 
    WHERE m.turma_id = turmas.id 
    AND m.aluno_id = auth.uid()
  )
);