-- Permitir que SECRETARIA veja user_roles de alunos para listagem
CREATE POLICY "Secretaria pode ver roles de alunos" 
ON public.user_roles 
FOR SELECT 
USING (has_role(auth.uid(), 'SECRETARIA'::user_role));

-- Permitir que POS veja user_roles de alunos para listagem
CREATE POLICY "POS pode ver roles de alunos" 
ON public.user_roles 
FOR SELECT 
USING (has_role(auth.uid(), 'POS'::user_role));