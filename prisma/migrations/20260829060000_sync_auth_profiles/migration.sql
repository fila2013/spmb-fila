-- Sinkronkan identitas Supabase Auth ke profile aplikasi.
-- Role dan status aktif tidak pernah diambil dari metadata user yang dapat diubah client.
CREATE OR REPLACE FUNCTION public.sync_auth_user_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.email IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.users (
    supabase_auth_user_id,
    email,
    role,
    status_aktif
  )
  VALUES (
    NEW.id,
    lower(NEW.email),
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

REVOKE ALL ON FUNCTION public.sync_auth_user_profile() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sync_auth_user_profile() FROM anon;
REVOKE ALL ON FUNCTION public.sync_auth_user_profile() FROM authenticated;

DROP TRIGGER IF EXISTS on_auth_user_profile_sync ON auth.users;

CREATE TRIGGER on_auth_user_profile_sync
AFTER INSERT OR UPDATE OF email ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.sync_auth_user_profile();

-- Backfill aman untuk akun Auth yang mungkin telah ada sebelum migration ini.
INSERT INTO public.users (
  supabase_auth_user_id,
  email,
  role,
  status_aktif
)
SELECT
  id,
  lower(email),
  'wali_murid'::public.user_role,
  true
FROM auth.users
WHERE email IS NOT NULL
ON CONFLICT (supabase_auth_user_id)
DO UPDATE SET
  email = EXCLUDED.email,
  updated_at = now();
