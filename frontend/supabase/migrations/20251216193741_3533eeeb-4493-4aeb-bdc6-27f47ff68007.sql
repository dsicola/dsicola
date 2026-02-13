-- Strengthen RLS policies for complete multi-tenant isolation
-- This migration ensures all tenant-specific tables properly filter by instituicao_id

-- Drop and recreate policies for profiles to ensure strict institution isolation
DROP POLICY IF EXISTS "Usuários podem ver seus próprios perfis" ON public.profiles;
DROP POLICY IF EXISTS "Usuários podem atualizar seus próprios perfis" ON public.profiles;
DROP POLICY IF EXISTS "Admins podem ver perfis da sua instituição" ON public.profiles;
DROP POLICY IF EXISTS "Admins podem gerenciar perfis da sua instituição" ON public.profiles;
DROP POLICY IF EXISTS "SUPER_ADMIN pode ver todos perfis" ON public.profiles;

-- Allow users to see their own profile
CREATE POLICY "Usuários podem ver seus próprios perfis" 
ON public.profiles 
FOR SELECT 
USING (auth.uid() = id);

-- Allow users to update their own profile
CREATE POLICY "Usuários podem atualizar seus próprios perfis" 
ON public.profiles 
FOR UPDATE 
USING (auth.uid() = id);

-- ADMIN can see profiles from their institution
CREATE POLICY "Admins podem ver perfis da sua instituição" 
ON public.profiles 
FOR SELECT 
USING (
  has_role(auth.uid(), 'ADMIN'::user_role) AND 
  instituicao_id = get_user_instituicao(auth.uid())
);

-- ADMIN can manage profiles from their institution  
CREATE POLICY "Admins podem gerenciar perfis da sua instituição" 
ON public.profiles 
FOR ALL 
USING (
  has_role(auth.uid(), 'ADMIN'::user_role) AND 
  instituicao_id = get_user_instituicao(auth.uid())
);

-- SUPER_ADMIN can see all profiles
CREATE POLICY "SUPER_ADMIN pode ver todos perfis" 
ON public.profiles 
FOR ALL 
USING (has_role(auth.uid(), 'SUPER_ADMIN'::user_role));

-- Secretaria can see profiles from their institution
CREATE POLICY "Secretaria pode ver perfis da sua instituição" 
ON public.profiles 
FOR SELECT 
USING (
  has_role(auth.uid(), 'SECRETARIA'::user_role) AND 
  instituicao_id = get_user_instituicao(auth.uid())
);

-- Professor can see students in their classes
CREATE POLICY "Professor pode ver alunos de suas turmas" 
ON public.profiles 
FOR SELECT 
USING (
  has_role(auth.uid(), 'PROFESSOR'::user_role) AND 
  professor_can_view_student(auth.uid(), id)
);

-- Strengthen user_roles policies
DROP POLICY IF EXISTS "Usuários podem ver seus próprios roles" ON public.user_roles;
DROP POLICY IF EXISTS "SUPER_ADMIN pode gerenciar todos roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins podem ver roles da sua instituição" ON public.user_roles;
DROP POLICY IF EXISTS "Admins podem gerenciar roles da sua instituição" ON public.user_roles;

-- Allow users to see their own roles
CREATE POLICY "Usuários podem ver seus próprios roles" 
ON public.user_roles 
FOR SELECT 
USING (user_id = auth.uid());

-- SUPER_ADMIN can manage all roles
CREATE POLICY "SUPER_ADMIN pode gerenciar todos roles" 
ON public.user_roles 
FOR ALL 
USING (has_role(auth.uid(), 'SUPER_ADMIN'::user_role));

-- ADMIN can see roles from their institution
CREATE POLICY "Admins podem ver roles da sua instituição" 
ON public.user_roles 
FOR SELECT 
USING (
  has_role(auth.uid(), 'ADMIN'::user_role) AND 
  instituicao_id = get_user_instituicao(auth.uid())
);

-- ADMIN can manage roles from their institution (except SUPER_ADMIN)
CREATE POLICY "Admins podem gerenciar roles da sua instituição" 
ON public.user_roles 
FOR ALL 
USING (
  has_role(auth.uid(), 'ADMIN'::user_role) AND 
  instituicao_id = get_user_instituicao(auth.uid()) AND
  role != 'SUPER_ADMIN'::user_role
);

-- Secretaria can see roles from their institution
CREATE POLICY "Secretaria pode ver roles da sua instituição" 
ON public.user_roles 
FOR SELECT 
USING (
  has_role(auth.uid(), 'SECRETARIA'::user_role) AND 
  instituicao_id = get_user_instituicao(auth.uid())
);

-- Strengthen mensalidades policies  
DROP POLICY IF EXISTS "Admins podem gerenciar mensalidades" ON public.mensalidades;

CREATE POLICY "Admins podem gerenciar mensalidades da sua instituição" 
ON public.mensalidades 
FOR ALL 
USING (
  has_role(auth.uid(), 'ADMIN'::user_role) AND 
  instituicao_id = get_user_instituicao(auth.uid())
);

-- Strengthen comunicados policies
DROP POLICY IF EXISTS "Admin e Secretaria podem gerenciar comunicados" ON public.comunicados;

CREATE POLICY "Admin pode gerenciar comunicados da sua instituição" 
ON public.comunicados 
FOR ALL 
USING (
  has_role(auth.uid(), 'ADMIN'::user_role) AND 
  instituicao_id = get_user_instituicao(auth.uid())
);

CREATE POLICY "Secretaria pode gerenciar comunicados da sua instituição" 
ON public.comunicados 
FOR ALL 
USING (
  has_role(auth.uid(), 'SECRETARIA'::user_role) AND 
  instituicao_id = get_user_instituicao(auth.uid())
);

-- Update comunicados visibility policy
DROP POLICY IF EXISTS "Comunicados visíveis para todos autenticados" ON public.comunicados;

CREATE POLICY "Comunicados visíveis para usuários da instituição" 
ON public.comunicados 
FOR SELECT 
USING (
  ativo = true AND 
  (instituicao_id = get_user_instituicao(auth.uid()) OR instituicao_id IS NULL)
);