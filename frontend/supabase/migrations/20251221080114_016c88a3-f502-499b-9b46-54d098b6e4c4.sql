
-- CORREÇÃO CRÍTICA: Remover roles ALUNO duplicadas de usuários que são ADMIN
-- Isso corrige o problema onde ADMINs estão sendo tratados como ALUNOs

-- 1. Remover role ALUNO de usuários que também possuem role ADMIN ou superior
DELETE FROM public.user_roles 
WHERE role = 'ALUNO' 
AND user_id IN (
  SELECT user_id 
  FROM public.user_roles 
  WHERE role IN ('SUPER_ADMIN', 'ADMIN', 'SECRETARIA', 'PROFESSOR', 'POS', 'RESPONSAVEL')
);

-- 2. Atualizar a função handle_new_user para NÃO criar role ALUNO automaticamente para usuários com metadata indicando role administrativa
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_instituicao_id uuid;
  v_role text;
BEGIN
  v_instituicao_id := NULLIF(NEW.raw_user_meta_data ->> 'instituicao_id', '')::uuid;
  v_role := COALESCE(NULLIF(NEW.raw_user_meta_data ->> 'role', ''), NULL);

  -- Criar perfil
  INSERT INTO public.profiles (id, email, nome_completo, instituicao_id)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'nome_completo', NEW.email),
    v_instituicao_id
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    nome_completo = COALESCE(EXCLUDED.nome_completo, profiles.nome_completo),
    instituicao_id = COALESCE(EXCLUDED.instituicao_id, profiles.instituicao_id);

  -- IMPORTANTE: Só criar role ALUNO automaticamente se:
  -- 1. NÃO houver metadata de role especificada
  -- 2. E o usuário ainda não tiver nenhuma role
  -- Isso evita criar ALUNO para usuários criados como ADMIN/PROFESSOR/etc.
  IF v_role IS NULL THEN
    -- Verificar se o usuário já tem alguma role
    IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = NEW.id) THEN
      INSERT INTO public.user_roles (user_id, role, instituicao_id)
      VALUES (NEW.id, 'ALUNO', v_instituicao_id)
      ON CONFLICT (user_id, role) DO NOTHING;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- 3. Criar índice para melhorar performance de consultas de roles
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id_role ON public.user_roles(user_id, role);
