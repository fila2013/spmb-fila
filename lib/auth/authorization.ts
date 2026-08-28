import type { UserRole } from "@/generated/prisma/enums";
import { AuthorizationError } from "@/lib/auth/errors";

export type AuthorizationContext = {
  userId: string;
  role: UserRole;
};

export function assertRole(
  context: AuthorizationContext,
  requiredRole: UserRole,
) {
  if (context.role !== requiredRole) {
    throw new AuthorizationError(
      "FORBIDDEN",
      "Akun tidak memiliki akses ke area ini.",
    );
  }
}

export function assertOwnership(
  context: AuthorizationContext,
  ownerUserId: string,
) {
  if (context.userId !== ownerUserId) {
    throw new AuthorizationError(
      "FORBIDDEN",
      "Data ini bukan milik akun yang sedang masuk.",
    );
  }
}

