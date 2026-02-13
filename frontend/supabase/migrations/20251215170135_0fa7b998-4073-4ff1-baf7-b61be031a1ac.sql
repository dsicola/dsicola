-- Drop the problematic policy on matriculas that causes infinite recursion
DROP POLICY IF EXISTS "Professores podem ver matrículas de suas turmas" ON public.matriculas;

-- Create a security definer function to check if professor owns a turma
CREATE OR REPLACE FUNCTION public.professor_owns_turma(_professor_id uuid, _turma_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.turmas
    WHERE id = _turma_id
      AND professor_id = _professor_id
  )
$$;

-- Recreate the policy using the security definer function
CREATE POLICY "Professores podem ver matrículas de suas turmas" 
ON public.matriculas
FOR SELECT
USING (public.professor_owns_turma(auth.uid(), turma_id));