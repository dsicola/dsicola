-- Update the handle_new_user function to NOT create ALUNO role if user has admin metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_instituicao_id uuid;
  v_role text;
BEGIN
  v_instituicao_id := NULLIF(NEW.raw_user_meta_data ->> 'instituicao_id', '')::uuid;
  v_role := COALESCE(NEW.raw_user_meta_data ->> 'role', 'ALUNO');

  INSERT INTO public.profiles (id, email, nome_completo, instituicao_id)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'nome_completo', NEW.email),
    v_instituicao_id
  );

  -- Only create default role if not already specified as admin type
  -- Admin roles should be created by the onboarding/creation process
  IF v_role NOT IN ('SUPER_ADMIN', 'ADMIN', 'SECRETARIA', 'PROFESSOR', 'RESPONSAVEL') THEN
    INSERT INTO public.user_roles (user_id, role, instituicao_id)
    VALUES (NEW.id, 'ALUNO', v_instituicao_id);
  END IF;

  RETURN NEW;
END;
$$;