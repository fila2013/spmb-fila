-- Keep application profiles consistent when an Auth identity is deleted.
-- Wali profiles with children are retained but disabled so participant data is
-- never removed implicitly. Empty wali profiles are safe to remove.

CREATE OR REPLACE FUNCTION public.sync_auth_user_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  normalized_email text;
BEGIN
  IF NEW.email IS NULL THEN
    RETURN NEW;
  END IF;

  normalized_email := lower(btrim(NEW.email));

  -- Recover from a legacy/manual Auth deletion that left an empty wali profile.
  -- Profiles with children and privileged profiles are deliberately not reclaimed.
  DELETE FROM public.users AS stale
  WHERE stale.email = normalized_email
    AND stale.supabase_auth_user_id <> NEW.id
    AND stale.role = 'wali_murid'::public.user_role
    AND NOT EXISTS (
      SELECT 1
      FROM auth.users AS auth_user
      WHERE auth_user.id = stale.supabase_auth_user_id
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.calon_murid AS participant
      WHERE participant.user_id = stale.id
    );

  INSERT INTO public.users (
    supabase_auth_user_id,
    email,
    role,
    status_aktif
  )
  VALUES (
    NEW.id,
    normalized_email,
    'wali_murid'::public.user_role,
    true
  )
  ON CONFLICT (supabase_auth_user_id)
  DO UPDATE SET
    email = EXCLUDED.email,
    updated_at = now();

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_deleted_auth_user_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.users
  SET
    status_aktif = false,
    updated_at = now()
  WHERE supabase_auth_user_id = OLD.id;

  DELETE FROM public.users AS profile
  WHERE profile.supabase_auth_user_id = OLD.id
    AND profile.role = 'wali_murid'::public.user_role
    AND NOT EXISTS (
      SELECT 1
      FROM public.calon_murid AS participant
      WHERE participant.user_id = profile.id
    );

  RETURN OLD;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_auth_user_profile() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sync_auth_user_profile() FROM anon;
REVOKE ALL ON FUNCTION public.sync_auth_user_profile() FROM authenticated;
REVOKE ALL ON FUNCTION public.sync_deleted_auth_user_profile() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sync_deleted_auth_user_profile() FROM anon;
REVOKE ALL ON FUNCTION public.sync_deleted_auth_user_profile() FROM authenticated;

DROP TRIGGER IF EXISTS on_auth_user_profile_delete ON auth.users;

CREATE TRIGGER on_auth_user_profile_delete
AFTER DELETE ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.sync_deleted_auth_user_profile();

-- One-time cleanup for legacy empty wali profiles whose Auth identity was
-- already removed before the delete trigger existed.
DELETE FROM public.users AS stale
WHERE stale.role = 'wali_murid'::public.user_role
  AND NOT EXISTS (
    SELECT 1
    FROM auth.users AS auth_user
    WHERE auth_user.id = stale.supabase_auth_user_id
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.calon_murid AS participant
    WHERE participant.user_id = stale.id
  );
