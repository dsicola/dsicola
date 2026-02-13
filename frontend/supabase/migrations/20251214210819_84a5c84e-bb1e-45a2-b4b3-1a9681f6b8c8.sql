-- Add DELETE policy for profiles table to allow admin deletion via edge functions
CREATE POLICY "Admins podem deletar perfis" 
ON public.profiles 
FOR DELETE 
USING (has_role(auth.uid(), 'ADMIN'::user_role));