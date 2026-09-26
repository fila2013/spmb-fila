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

  return prisma.$transaction(async (transaction) => {
    const existing = await transaction.user.findUnique({
      where: { supabaseAuthUserId: identity.id },
    });

    if (!existing) {
      return transaction.user.create({
        data: {
          supabaseAuthUserId: identity.id,
          email: normalizedEmail,
          emailVerifiedAt,
          statusAktif: emailVerifiedAt !== null,
        },
      });
    }

    return transaction.user.update({
      where: { id: existing.id },
      data: {
        email: normalizedEmail,
        emailVerifiedAt,
        statusAktif:
          emailVerifiedAt === null
            ? false
            : existing.emailVerifiedAt === null
              ? true
              : existing.statusAktif,
      },
    });
  });
}
