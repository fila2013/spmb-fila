-- Profiles are created together with Supabase Auth identities, but they must
-- remain inactive until the email identity has actually been confirmed.
ALTER TABLE public.users
  ADD COLUMN email_verified_at TIMESTAMPTZ(6);

-- Backfill verification state from the source of truth. Existing administrative
-- deactivations are preserved for confirmed users; unconfirmed/orphan profiles
-- are made inactive.
UPDATE public.users AS profile
SET
  email_verified_at = auth_user.email_confirmed_at,
  status_aktif = CASE
    WHEN auth_user.email_confirmed_at IS NULL THEN false
    ELSE profile.status_aktif
  END,
  updated_at = now()
FROM auth.users AS auth_user
WHERE auth_user.id = profile.supabase_auth_user_id;

UPDATE public.users AS profile
SET
  status_aktif = false,
  updated_at = now()
WHERE profile.email_verified_at IS NULL
  AND profile.status_aktif = true;

ALTER TABLE public.users
  ALTER COLUMN status_aktif SET DEFAULT false,
  ADD CONSTRAINT users_active_requires_verified_email_check
    CHECK (NOT status_aktif OR email_verified_at IS NOT NULL);

CREATE INDEX users_role_email_verified_at_status_aktif_idx
  ON public.users(role, email_verified_at, status_aktif);

COMMENT ON COLUMN public.users.email_verified_at IS
  'Waktu email dikonfirmasi di Supabase Auth; NULL berarti profil masih menunggu verifikasi.';

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

  INSERT INTO public.users AS profile (
    supabase_auth_user_id,
    email,
    role,
    status_aktif,
    email_verified_at
  )
  VALUES (
    NEW.id,
    normalized_email,
    'wali_murid'::public.user_role,
    NEW.email_confirmed_at IS NOT NULL,
    NEW.email_confirmed_at
  )
  ON CONFLICT (supabase_auth_user_id)
  DO UPDATE SET
    email = EXCLUDED.email,
    email_verified_at = EXCLUDED.email_verified_at,
    status_aktif = CASE
      WHEN EXCLUDED.email_verified_at IS NULL THEN false
      WHEN profile.email_verified_at IS NULL THEN true
      ELSE profile.status_aktif
    END,
    updated_at = now();

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_auth_user_profile() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sync_auth_user_profile() FROM anon;
REVOKE ALL ON FUNCTION public.sync_auth_user_profile() FROM authenticated;

DROP TRIGGER IF EXISTS on_auth_user_profile_sync ON auth.users;

CREATE TRIGGER on_auth_user_profile_sync
AFTER INSERT OR UPDATE OF email, email_confirmed_at ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.sync_auth_user_profile();
