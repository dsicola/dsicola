-- Drop potentially conflicting policies that may cause issues
DROP POLICY IF EXISTS "Admins podem gerenciar turmas" ON public.turmas;
DROP POLICY IF EXISTS "Professores podem ver suas turmas" ON public.turmas;

-- Recreate admin policy
CREATE POLICY "Admins podem gerenciar turmas" 
ON public.turmas 
FOR ALL 
USING (has_role(auth.uid(), 'ADMIN'::user_role));

-- Recreate professor policy without recursion
CREATE POLICY "Professores podem ver suas turmas" 
ON public.turmas 
FOR SELECT 
USING (professor_id = auth.uid());