-- Add RLS policy for POS role to view mensalidades
CREATE POLICY "POS pode visualizar mensalidades pendentes" 
ON public.mensalidades 
FOR SELECT 
USING (has_role(auth.uid(), 'POS'::user_role));

-- Add RLS policy for POS role to update mensalidades
CREATE POLICY "POS pode atualizar mensalidades" 
ON public.mensalidades 
FOR UPDATE 
USING (has_role(auth.uid(), 'POS'::user_role));

-- Add RLS policy for POS to view profiles (for student info)
CREATE POLICY "POS pode ver perfis de alunos" 
ON public.profiles 
FOR SELECT 
USING (has_role(auth.uid(), 'POS'::user_role));