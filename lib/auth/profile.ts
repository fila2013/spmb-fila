import "server-only";

import { prisma } from "@/lib/prisma";

type AuthIdentity = {
  id: string;
  email: string;
  emailVerifiedAt: string | Date | null;
};

export async function ensureUserProfile(identity: AuthIdentity) {
  const normalizedEmail = identity.email.trim().toLowerCase();
  const emailVerifiedAt = identity.emailVerifiedAt
    ? new Date(identity.emailVerifiedAt)
    : null;

  const existing = await prisma.user.findUnique({
    where: { supabaseAuthUserId: identity.id },
  });

  if (
    existing &&
    existing.email === normalizedEmail &&
    existing.emailVerifiedAt?.getTime() === emailVerifiedAt?.getTime()
  ) {
    return existing;
  }

  // A single upsert keeps first-confirmation activation atomic while preserving
  // an administrator's later deactivation, without starting an interactive
  // transaction on the login path.
  await prisma.$executeRaw`
    INSERT INTO public.users (
      supabase_auth_user_id, email, role, status_aktif, email_verified_at
    )
    VALUES (
      ${identity.id}::uuid,
      ${normalizedEmail},
      'wali_murid'::public.user_role,
      ${emailVerifiedAt !== null},
      ${emailVerifiedAt}::timestamptz
    )
    ON CONFLICT (supabase_auth_user_id)
    DO UPDATE SET
      email = EXCLUDED.email,
      email_verified_at = EXCLUDED.email_verified_at,
      status_aktif = CASE
        WHEN EXCLUDED.email_verified_at IS NULL THEN false
        WHEN public.users.email_verified_at IS NULL THEN true
        ELSE public.users.status_aktif
      END,
      updated_at = now()
  `;

  return prisma.user.findUniqueOrThrow({
    where: { supabaseAuthUserId: identity.id },
  });
}
