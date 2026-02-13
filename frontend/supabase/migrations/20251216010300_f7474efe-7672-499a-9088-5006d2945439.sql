-- Tabela para rastrear tentativas de login
CREATE TABLE public.login_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  attempt_count integer NOT NULL DEFAULT 0,
  last_attempt_at timestamp with time zone NOT NULL DEFAULT now(),
  locked_until timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(email)
);

-- RLS para a tabela (apenas sistema pode acessar)
ALTER TABLE public.login_attempts ENABLE ROW LEVEL SECURITY;

-- Política para permitir inserção e atualização pelo sistema
CREATE POLICY "Sistema pode gerenciar tentativas de login"
ON public.login_attempts
FOR ALL
USING (true)
WITH CHECK (true);

-- Função para verificar se conta está bloqueada
CREATE OR REPLACE FUNCTION public.is_account_locked(p_email text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_locked_until timestamp with time zone;
BEGIN
  SELECT locked_until INTO v_locked_until
  FROM public.login_attempts
  WHERE email = LOWER(p_email);
  
  IF v_locked_until IS NOT NULL AND v_locked_until > now() THEN
    RETURN true;
  END IF;
  
  RETURN false;
END;
$$;

-- Função para obter tempo restante de bloqueio
CREATE OR REPLACE FUNCTION public.get_lockout_remaining(p_email text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_locked_until timestamp with time zone;
BEGIN
  SELECT locked_until INTO v_locked_until
  FROM public.login_attempts
  WHERE email = LOWER(p_email);
  
  IF v_locked_until IS NOT NULL AND v_locked_until > now() THEN
    RETURN EXTRACT(EPOCH FROM (v_locked_until - now()))::integer;
  END IF;
  
  RETURN 0;
END;
$$;

-- Função para registrar tentativa de login falhada
CREATE OR REPLACE FUNCTION public.record_failed_login(p_email text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_attempt_count integer;
  v_locked_until timestamp with time zone;
  v_max_attempts constant integer := 5;
  v_lockout_duration constant interval := '15 minutes';
BEGIN
  -- Inserir ou atualizar registro de tentativas
  INSERT INTO public.login_attempts (email, attempt_count, last_attempt_at)
  VALUES (LOWER(p_email), 1, now())
  ON CONFLICT (email) DO UPDATE SET
    attempt_count = CASE
      -- Se já passou o período de bloqueio, resetar contador
      WHEN login_attempts.locked_until IS NOT NULL AND login_attempts.locked_until < now() THEN 1
      -- Se última tentativa foi há mais de 15 minutos, resetar
      WHEN login_attempts.last_attempt_at < now() - v_lockout_duration THEN 1
      ELSE login_attempts.attempt_count + 1
    END,
    last_attempt_at = now(),
    locked_until = CASE
      WHEN login_attempts.locked_until IS NOT NULL AND login_attempts.locked_until < now() THEN NULL
      WHEN login_attempts.last_attempt_at < now() - v_lockout_duration THEN NULL
      WHEN login_attempts.attempt_count + 1 >= v_max_attempts THEN now() + v_lockout_duration
      ELSE login_attempts.locked_until
    END,
    updated_at = now()
  RETURNING attempt_count, locked_until INTO v_attempt_count, v_locked_until;
  
  RETURN jsonb_build_object(
    'attempt_count', v_attempt_count,
    'max_attempts', v_max_attempts,
    'is_locked', v_locked_until IS NOT NULL AND v_locked_until > now(),
    'locked_until', v_locked_until,
    'remaining_attempts', GREATEST(0, v_max_attempts - v_attempt_count)
  );
END;
$$;

-- Função para resetar tentativas após login bem-sucedido
CREATE OR REPLACE FUNCTION public.reset_login_attempts(p_email text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.login_attempts WHERE email = LOWER(p_email);
END;
$$;

-- Trigger para atualizar updated_at
CREATE TRIGGER update_login_attempts_updated_at
BEFORE UPDATE ON public.login_attempts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();