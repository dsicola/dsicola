
-- Backfill user_roles.instituicao_id from profiles
UPDATE public.user_roles ur
SET instituicao_id = p.instituicao_id
FROM public.profiles p
WHERE ur.user_id = p.id
  AND ur.instituicao_id IS NULL
  AND p.instituicao_id IS NOT NULL;

-- Create trigger to keep user_roles.instituicao_id in sync with profiles
CREATE OR REPLACE FUNCTION public.sync_user_role_instituicao()
RETURNS TRIGGER AS $$
BEGIN
  -- When profile instituicao_id changes, update user_roles
  IF NEW.instituicao_id IS DISTINCT FROM OLD.instituicao_id THEN
    UPDATE public.user_roles
    SET instituicao_id = NEW.instituicao_id
    WHERE user_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Drop trigger if exists
DROP TRIGGER IF EXISTS sync_user_role_instituicao_trigger ON public.profiles;

-- Create trigger
CREATE TRIGGER sync_user_role_instituicao_trigger
AFTER UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.sync_user_role_instituicao();
