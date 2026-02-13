-- SUPER_ADMIN pode ver todos os user_roles
CREATE POLICY "SUPER_ADMIN pode ver todos os roles"
ON public.user_roles
FOR SELECT
USING (has_role(auth.uid(), 'SUPER_ADMIN'));

-- SUPER_ADMIN pode ver todos os profiles
CREATE POLICY "SUPER_ADMIN pode ver todos os perfis"
ON public.profiles
FOR SELECT
USING (has_role(auth.uid(), 'SUPER_ADMIN'));