-- Permitir que ADMIN atualize perfis (necessário para ativar/desativar funcionários)
DROP POLICY IF EXISTS "Admins podem atualizar perfis" ON public.profiles;

CREATE POLICY "Admins podem atualizar perfis"
ON public.profiles
FOR UPDATE
USING (has_role(auth.uid(), 'ADMIN'::user_role))
WITH CHECK (has_role(auth.uid(), 'ADMIN'::user_role));
