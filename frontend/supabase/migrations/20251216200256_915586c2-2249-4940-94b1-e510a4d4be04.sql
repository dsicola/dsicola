-- Multi-tenant hardening (DSICOLA)

-- 1) Add instituicao_id to configuracoes_instituicao (was global and caused "first institution" leakage)
ALTER TABLE public.configuracoes_instituicao
ADD COLUMN IF NOT EXISTS instituicao_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'configuracoes_instituicao_instituicao_id_fkey'
  ) THEN
    ALTER TABLE public.configuracoes_instituicao
    ADD CONSTRAINT configuracoes_instituicao_instituicao_id_fkey
    FOREIGN KEY (instituicao_id) REFERENCES public.instituicoes(id)
    ON DELETE CASCADE;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS configuracoes_instituicao_instituicao_id_unique
  ON public.configuracoes_instituicao (instituicao_id)
  WHERE instituicao_id IS NOT NULL;

-- Backfill: try to match by name
UPDATE public.configuracoes_instituicao ci
SET instituicao_id = i.id
FROM public.instituicoes i
WHERE ci.instituicao_id IS NULL
  AND i.nome = ci.nome_instituicao;

-- Ensure each instituicao has a config row
INSERT INTO public.configuracoes_instituicao (
  instituicao_id,
  nome_instituicao,
  logo_url,
  imagem_capa_login_url,
  cor_primaria,
  email,
  telefone,
  endereco,
  descricao
)
SELECT
  i.id,
  i.nome,
  i.logo_url,
  NULL,
  '#8B5CF6',
  i.email_contato,
  i.telefone,
  i.endereco,
  NULL
FROM public.instituicoes i
WHERE NOT EXISTS (
  SELECT 1
  FROM public.configuracoes_instituicao ci
  WHERE ci.instituicao_id = i.id
);


-- 2) Add instituicao_id to alojamentos (was globally visible)
ALTER TABLE public.alojamentos
ADD COLUMN IF NOT EXISTS instituicao_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'alojamentos_instituicao_id_fkey'
  ) THEN
    ALTER TABLE public.alojamentos
    ADD CONSTRAINT alojamentos_instituicao_id_fkey
    FOREIGN KEY (instituicao_id) REFERENCES public.instituicoes(id)
    ON DELETE CASCADE;
  END IF;
END $$;

-- Backfill existing rooms to the oldest instituicao (demo-safe; new records will be set by UI)
UPDATE public.alojamentos a
SET instituicao_id = (
  SELECT id FROM public.instituicoes ORDER BY created_at ASC LIMIT 1
)
WHERE a.instituicao_id IS NULL;


-- 3) Helper trigger to stamp instituicao_id for tenant tables (prevents missing instituicao_id on inserts)
CREATE OR REPLACE FUNCTION public.set_instituicao_id_from_auth()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- SUPER_ADMIN can set any instituicao_id (or keep null)
  IF public.has_role(auth.uid(), 'SUPER_ADMIN'::user_role) THEN
    RETURN NEW;
  END IF;

  -- For normal users, always force to their institution (if available)
  NEW.instituicao_id := COALESCE(NEW.instituicao_id, public.get_user_instituicao(auth.uid()));
  NEW.instituicao_id := public.get_user_instituicao(auth.uid());

  RETURN NEW;
END;
$$;

-- Apply to core tenant tables that must always be scoped
DO $$
BEGIN
  -- cursos
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'tr_set_tenant_cursos') THEN
    CREATE TRIGGER tr_set_tenant_cursos
    BEFORE INSERT OR UPDATE ON public.cursos
    FOR EACH ROW
    EXECUTE FUNCTION public.set_instituicao_id_from_auth();
  END IF;

  -- disciplinas
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'tr_set_tenant_disciplinas') THEN
    CREATE TRIGGER tr_set_tenant_disciplinas
    BEFORE INSERT OR UPDATE ON public.disciplinas
    FOR EACH ROW
    EXECUTE FUNCTION public.set_instituicao_id_from_auth();
  END IF;

  -- turmas
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'tr_set_tenant_turmas') THEN
    CREATE TRIGGER tr_set_tenant_turmas
    BEFORE INSERT OR UPDATE ON public.turmas
    FOR EACH ROW
    EXECUTE FUNCTION public.set_instituicao_id_from_auth();
  END IF;

  -- configuracoes_instituicao
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'tr_set_tenant_configuracoes_instituicao') THEN
    CREATE TRIGGER tr_set_tenant_configuracoes_instituicao
    BEFORE INSERT OR UPDATE ON public.configuracoes_instituicao
    FOR EACH ROW
    EXECUTE FUNCTION public.set_instituicao_id_from_auth();
  END IF;

  -- alojamentos
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'tr_set_tenant_alojamentos') THEN
    CREATE TRIGGER tr_set_tenant_alojamentos
    BEFORE INSERT OR UPDATE ON public.alojamentos
    FOR EACH ROW
    EXECUTE FUNCTION public.set_instituicao_id_from_auth();
  END IF;
END $$;


-- 4) Update handle_new_user to persist instituicao_id when provided in signup metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_instituicao_id uuid;
BEGIN
  v_instituicao_id := NULLIF(NEW.raw_user_meta_data ->> 'instituicao_id', '')::uuid;

  INSERT INTO public.profiles (id, email, nome_completo, instituicao_id)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'nome_completo', NEW.email),
    v_instituicao_id
  );

  -- Default role ALUNO (scoped to instituicao when available)
  INSERT INTO public.user_roles (user_id, role, instituicao_id)
  VALUES (NEW.id, 'ALUNO', v_instituicao_id);

  RETURN NEW;
END;
$$;


-- 5) RLS hardening: remove permissive "true" reads and enforce tenant isolation

-- instituicoes: allow anonymous to read active institutions (for subdomain login),
-- but authenticated users can only read their own institution; SUPER_ADMIN keeps full access.
DROP POLICY IF EXISTS "Todos podem ver instituições ativas" ON public.instituicoes;
DROP POLICY IF EXISTS "Usuários podem ver sua instituição" ON public.instituicoes;
DROP POLICY IF EXISTS "Anon pode ver instituições ativas" ON public.instituicoes;

CREATE POLICY "Anon pode ver instituições ativas"
ON public.instituicoes
FOR SELECT
USING (auth.uid() IS NULL AND status = 'ativa');

CREATE POLICY "Usuários podem ver sua instituição"
ON public.instituicoes
FOR SELECT
USING (
  auth.uid() IS NOT NULL
  AND id = public.get_user_instituicao(auth.uid())
);

-- configuracoes_instituicao
DROP POLICY IF EXISTS "Todos podem ver configurações" ON public.configuracoes_instituicao;
DROP POLICY IF EXISTS "Admins podem gerenciar configurações" ON public.configuracoes_instituicao;

CREATE POLICY "Usuários podem ver configurações da sua instituição"
ON public.configuracoes_instituicao
FOR SELECT
USING (
  public.has_role(auth.uid(), 'SUPER_ADMIN'::user_role)
  OR instituicao_id = public.get_user_instituicao(auth.uid())
);

CREATE POLICY "Admin pode gerenciar configurações da sua instituição"
ON public.configuracoes_instituicao
FOR ALL
USING (
  public.has_role(auth.uid(), 'SUPER_ADMIN'::user_role)
  OR (public.has_role(auth.uid(), 'ADMIN'::user_role) AND instituicao_id = public.get_user_instituicao(auth.uid()))
)
WITH CHECK (
  public.has_role(auth.uid(), 'SUPER_ADMIN'::user_role)
  OR (public.has_role(auth.uid(), 'ADMIN'::user_role) AND (instituicao_id IS NULL OR instituicao_id = public.get_user_instituicao(auth.uid())))
);

-- cursos
DROP POLICY IF EXISTS "Todos autenticados podem ver cursos" ON public.cursos;
DROP POLICY IF EXISTS "Secretaria pode ver cursos" ON public.cursos;
DROP POLICY IF EXISTS "Admins podem gerenciar cursos" ON public.cursos;

CREATE POLICY "Usuários podem ver cursos da sua instituição"
ON public.cursos
FOR SELECT
USING (
  public.has_role(auth.uid(), 'SUPER_ADMIN'::user_role)
  OR instituicao_id = public.get_user_instituicao(auth.uid())
);

CREATE POLICY "Admin pode gerenciar cursos da sua instituição"
ON public.cursos
FOR ALL
USING (
  public.has_role(auth.uid(), 'SUPER_ADMIN'::user_role)
  OR (public.has_role(auth.uid(), 'ADMIN'::user_role) AND instituicao_id = public.get_user_instituicao(auth.uid()))
)
WITH CHECK (
  public.has_role(auth.uid(), 'SUPER_ADMIN'::user_role)
  OR (public.has_role(auth.uid(), 'ADMIN'::user_role) AND (instituicao_id IS NULL OR instituicao_id = public.get_user_instituicao(auth.uid())))
);

-- disciplinas
DROP POLICY IF EXISTS "Todos autenticados podem ver disciplinas" ON public.disciplinas;
DROP POLICY IF EXISTS "Admins podem gerenciar disciplinas" ON public.disciplinas;

CREATE POLICY "Usuários podem ver disciplinas da sua instituição"
ON public.disciplinas
FOR SELECT
USING (
  public.has_role(auth.uid(), 'SUPER_ADMIN'::user_role)
  OR instituicao_id = public.get_user_instituicao(auth.uid())
);

CREATE POLICY "Admin pode gerenciar disciplinas da sua instituição"
ON public.disciplinas
FOR ALL
USING (
  public.has_role(auth.uid(), 'SUPER_ADMIN'::user_role)
  OR (public.has_role(auth.uid(), 'ADMIN'::user_role) AND instituicao_id = public.get_user_instituicao(auth.uid()))
)
WITH CHECK (
  public.has_role(auth.uid(), 'SUPER_ADMIN'::user_role)
  OR (public.has_role(auth.uid(), 'ADMIN'::user_role) AND (instituicao_id IS NULL OR instituicao_id = public.get_user_instituicao(auth.uid())))
);

-- turmas
DROP POLICY IF EXISTS "Admins podem gerenciar turmas" ON public.turmas;

CREATE POLICY "Admin pode gerenciar turmas da sua instituição"
ON public.turmas
FOR ALL
USING (
  public.has_role(auth.uid(), 'SUPER_ADMIN'::user_role)
  OR (public.has_role(auth.uid(), 'ADMIN'::user_role) AND instituicao_id = public.get_user_instituicao(auth.uid()))
)
WITH CHECK (
  public.has_role(auth.uid(), 'SUPER_ADMIN'::user_role)
  OR (public.has_role(auth.uid(), 'ADMIN'::user_role) AND (instituicao_id IS NULL OR instituicao_id = public.get_user_instituicao(auth.uid())))
);

-- alojamentos
DROP POLICY IF EXISTS "Todos autenticados podem ver alojamentos" ON public.alojamentos;
DROP POLICY IF EXISTS "Admins podem gerenciar alojamentos" ON public.alojamentos;

CREATE POLICY "Usuários podem ver alojamentos da sua instituição"
ON public.alojamentos
FOR SELECT
USING (
  public.has_role(auth.uid(), 'SUPER_ADMIN'::user_role)
  OR instituicao_id = public.get_user_instituicao(auth.uid())
);

CREATE POLICY "Admin pode gerenciar alojamentos da sua instituição"
ON public.alojamentos
FOR ALL
USING (
  public.has_role(auth.uid(), 'SUPER_ADMIN'::user_role)
  OR (public.has_role(auth.uid(), 'ADMIN'::user_role) AND instituicao_id = public.get_user_instituicao(auth.uid()))
)
WITH CHECK (
  public.has_role(auth.uid(), 'SUPER_ADMIN'::user_role)
  OR (public.has_role(auth.uid(), 'ADMIN'::user_role) AND (instituicao_id IS NULL OR instituicao_id = public.get_user_instituicao(auth.uid())))
);
