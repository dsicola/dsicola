-- Add policy for SECRETARIA to update profiles (needed for creating students)
CREATE POLICY "Secretaria pode atualizar perfis de alunos" 
ON public.profiles 
FOR UPDATE 
USING (has_role(auth.uid(), 'SECRETARIA'::user_role))
WITH CHECK (has_role(auth.uid(), 'SECRETARIA'::user_role));

-- Add policy for SECRETARIA to insert into profiles (for new students created via edge function)
CREATE POLICY "Secretaria pode inserir perfis" 
ON public.profiles 
FOR INSERT 
WITH CHECK (has_role(auth.uid(), 'SECRETARIA'::user_role));