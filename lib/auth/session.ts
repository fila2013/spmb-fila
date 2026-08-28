import "server-only";

import { cache } from "react";

import { UserRole } from "@/generated/prisma/enums";
import { assertOwnership, assertRole } from "@/lib/auth/authorization";
import { AuthorizationError } from "@/lib/auth/errors";
import { ensureUserProfile } from "@/lib/auth/profile";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

export type AuthContext = {
  userId: string;
  supabaseAuthUserId: string;
  email: string;
  role: UserRole;
};

export const getAuthContext = cache(async (): Promise<AuthContext> => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const authUserId = data?.claims?.sub;

  if (error || !authUserId) {
    throw new AuthorizationError(
      "UNAUTHENTICATED",
      "Silakan masuk untuk melanjutkan.",
    );
  }

  let profile = await prisma.user.findUnique({
    where: { supabaseAuthUserId: authUserId },
  });

  if (!profile) {
    const { data: userData, error: userError } = await supabase.auth.getUser();
    const email = userData.user?.email;

    if (userError || !userData.user || !email) {
      throw new AuthorizationError(
        "PROFILE_NOT_FOUND",
        "Profile akun belum tersedia.",
      );
    }

    profile = await ensureUserProfile({ id: userData.user.id, email });
  }

  if (!profile.statusAktif) {
    throw new AuthorizationError(
      "INACTIVE_PROFILE",
      "Akun telah dinonaktifkan.",
    );
  }

  return {
    userId: profile.id,
    supabaseAuthUserId: profile.supabaseAuthUserId,
    email: profile.email,
    role: profile.role,
  };
});

export async function requireAuth() {
  return getAuthContext();
}

export async function requireRole(role: UserRole) {
  const context = await getAuthContext();
  assertRole(context, role);
  return context;
}

export async function requireCalonMuridOwnership(calonMuridId: string) {
  const context = await getAuthContext();
  const calonMurid = await prisma.calonMurid.findUnique({
    where: { id: calonMuridId },
    select: { userId: true },
  });

  if (!calonMurid) {
    throw new AuthorizationError(
      "RESOURCE_NOT_FOUND",
      "Data calon murid tidak ditemukan.",
    );
  }

  assertOwnership(context, calonMurid.userId);
  return context;
}

export { UserRole };

