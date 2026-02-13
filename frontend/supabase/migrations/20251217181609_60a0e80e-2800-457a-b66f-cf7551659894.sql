-- Update the record_failed_login function with progressive lockout (5 min, then 10 min)
CREATE OR REPLACE FUNCTION public.record_failed_login(p_email text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_attempt_count integer;
  v_locked_until timestamp with time zone;
  v_previous_lockouts integer;
  v_max_attempts constant integer := 5;
  v_first_lockout_duration constant interval := '5 minutes';
  v_second_lockout_duration constant interval := '10 minutes';
  v_lockout_duration interval;
BEGIN
  -- Get previous lockout count to determine duration
  SELECT 
    CASE 
      WHEN locked_until IS NOT NULL AND locked_until > now() - interval '30 minutes' THEN 1
      ELSE 0
    END INTO v_previous_lockouts
  FROM public.login_attempts
  WHERE email = LOWER(p_email);
  
  -- Determine lockout duration based on previous lockouts
  v_lockout_duration := CASE 
    WHEN COALESCE(v_previous_lockouts, 0) >= 1 THEN v_second_lockout_duration
    ELSE v_first_lockout_duration
  END;

  -- Insert or update login attempts record
  INSERT INTO public.login_attempts (email, attempt_count, last_attempt_at)
  VALUES (LOWER(p_email), 1, now())
  ON CONFLICT (email) DO UPDATE SET
    attempt_count = CASE
      -- If lockout expired, reset counter
      WHEN login_attempts.locked_until IS NOT NULL AND login_attempts.locked_until < now() THEN 1
      -- If last attempt was more than 5 minutes ago, reset
      WHEN login_attempts.last_attempt_at < now() - v_first_lockout_duration THEN 1
      ELSE login_attempts.attempt_count + 1
    END,
    last_attempt_at = now(),
    locked_until = CASE
      WHEN login_attempts.locked_until IS NOT NULL AND login_attempts.locked_until < now() THEN NULL
      WHEN login_attempts.last_attempt_at < now() - v_first_lockout_duration THEN NULL
      WHEN login_attempts.attempt_count + 1 >= v_max_attempts THEN 
        now() + CASE 
          WHEN login_attempts.locked_until IS NOT NULL AND login_attempts.locked_until > now() - interval '30 minutes' 
          THEN v_second_lockout_duration
          ELSE v_first_lockout_duration
        END
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
$function$;