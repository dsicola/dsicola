-- Tighten multi-tenant access controls (instituição) for Certificados and related data

-- 1) user_roles: remove overly permissive policies
DROP POLICY IF EXISTS "Admins podem gerenciar roles" ON public.user_roles;
DROP POLICY IF EXISTS "Secretaria pode ver roles de alunos" ON public.user_roles;
DROP POLICY IF EXISTS "POS pode ver roles de alunos" ON public.user_roles;

-- Recreate POS policy with instituição scoping (keep behavior but secure)
CREATE POLICY "POS pode ver roles de alunos da sua instituição"
ON public.user_roles
FOR SELECT
USING (
  has_role(auth.uid(), 'POS'::user_role)
  AND role = 'ALUNO'::user_role
  AND instituicao_id = get_user_instituicao(auth.uid())
);

-- 2) profiles: remove overly permissive cross-instituição read/write policies
DROP POLICY IF EXISTS "Admins podem ver todos os perfis" ON public.profiles;
DROP POLICY IF EXISTS "Secretaria pode ver perfis de alunos" ON public.profiles;
DROP POLICY IF EXISTS "POS pode ver perfis de alunos" ON public.profiles;

DROP POLICY IF EXISTS "Admins podem atualizar perfis" ON public.profiles;
DROP POLICY IF EXISTS "Admins podem deletar perfis" ON public.profiles;

-- Replace Secretaria update/insert with instituição-scoped policies
DROP POLICY IF EXISTS "Secretaria pode atualizar perfis de alunos" ON public.profiles;
CREATE POLICY "Secretaria pode atualizar perfis da sua instituição"
ON public.profiles
FOR UPDATE
USING (
  has_role(auth.uid(), 'SECRETARIA'::user_role)
  AND instituicao_id = get_user_instituicao(auth.uid())
)
WITH CHECK (
  has_role(auth.uid(), 'SECRETARIA'::user_role)
  AND instituicao_id = get_user_instituicao(auth.uid())
);

DROP POLICY IF EXISTS "Secretaria pode inserir perfis" ON public.profiles;
CREATE POLICY "Secretaria pode inserir perfis na sua instituição"
ON public.profiles
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'SECRETARIA'::user_role)
  AND instituicao_id = get_user_instituicao(auth.uid())
);

-- 3) documentos_emitidos (Certificados): scope ADMIN/SECRETARIA access by aluno.instituicao
DROP POLICY IF EXISTS "Admin pode gerenciar documentos" ON public.documentos_emitidos;
DROP POLICY IF EXISTS "Secretaria pode gerenciar documentos" ON public.documentos_emitidos;

CREATE POLICY "Admin pode gerenciar documentos da sua instituição"
ON public.documentos_emitidos
FOR ALL
USING (
  has_role(auth.uid(), 'ADMIN'::user_role)
  AND EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = documentos_emitidos.aluno_id
      AND p.instituicao_id = get_user_instituicao(auth.uid())
  )
)
WITH CHECK (
  has_role(auth.uid(), 'ADMIN'::user_role)
  AND EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = documentos_emitidos.aluno_id
      AND p.instituicao_id = get_user_instituicao(auth.uid())
  )
);

CREATE POLICY "Secretaria pode gerenciar documentos da sua instituição"
ON public.documentos_emitidos
FOR ALL
USING (
  has_role(auth.uid(), 'SECRETARIA'::user_role)
  AND EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = documentos_emitidos.aluno_id
      AND p.instituicao_id = get_user_instituicao(auth.uid())
  )
)
WITH CHECK (
  has_role(auth.uid(), 'SECRETARIA'::user_role)
  AND EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = documentos_emitidos.aluno_id
      AND p.instituicao_id = get_user_instituicao(auth.uid())
  )
);