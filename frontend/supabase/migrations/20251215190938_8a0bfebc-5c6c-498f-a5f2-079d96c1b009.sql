-- Adicionar instituicao_id às tabelas relevantes para multi-tenancy
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS instituicao_id uuid REFERENCES public.instituicoes(id) ON DELETE SET NULL;
ALTER TABLE public.user_roles ADD COLUMN IF NOT EXISTS instituicao_id uuid REFERENCES public.instituicoes(id) ON DELETE SET NULL;

-- Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_profiles_instituicao_id ON public.profiles(instituicao_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_instituicao_id ON public.user_roles(instituicao_id);

-- SUPER_ADMIN pode gerenciar user_roles de qualquer instituição
DROP POLICY IF EXISTS "SUPER_ADMIN pode gerenciar user_roles" ON public.user_roles;
CREATE POLICY "SUPER_ADMIN pode gerenciar user_roles"
ON public.user_roles
FOR ALL
USING (has_role(auth.uid(), 'SUPER_ADMIN'));

-- SUPER_ADMIN pode gerenciar profiles de qualquer instituição
DROP POLICY IF EXISTS "SUPER_ADMIN pode gerenciar todos os perfis" ON public.profiles;
CREATE POLICY "SUPER_ADMIN pode gerenciar todos os perfis"
ON public.profiles
FOR ALL
USING (has_role(auth.uid(), 'SUPER_ADMIN'));

-- Função para obter instituição do usuário atual
CREATE OR REPLACE FUNCTION public.get_user_instituicao(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT instituicao_id
  FROM public.profiles
  WHERE id = _user_id
$$;