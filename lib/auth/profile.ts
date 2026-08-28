import "server-only";

import { prisma } from "@/lib/prisma";

type AuthIdentity = {
  id: string;
  email: string;
};

export async function ensureUserProfile(identity: AuthIdentity) {
  const normalizedEmail = identity.email.trim().toLowerCase();

  return prisma.user.upsert({
    where: { supabaseAuthUserId: identity.id },
    create: {
      supabaseAuthUserId: identity.id,
      email: normalizedEmail,
    },
    update: {
      email: normalizedEmail,
    },
  });
}

