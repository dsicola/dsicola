-- Renomear valores do enum para maiúsculo
ALTER TYPE user_role RENAME VALUE 'admin' TO 'ADMIN';
ALTER TYPE user_role RENAME VALUE 'professor' TO 'PROFESSOR';
ALTER TYPE user_role RENAME VALUE 'aluno' TO 'ALUNO';

-- Atualizar função has_role para usar novos valores
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role user_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Atualizar função get_user_role
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id uuid)
RETURNS user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM public.user_roles
  WHERE user_id = _user_id
  LIMIT 1
$$;

-- Atualizar trigger para usar ALUNO como padrão
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, nome_completo)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'nome_completo', NEW.email)
  );
  
  -- Por padrão, novos usuários são ALUNO
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'ALUNO');
  
  RETURN NEW;
END;
$$;