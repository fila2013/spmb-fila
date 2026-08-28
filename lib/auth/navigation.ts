import "server-only";

import { redirect } from "next/navigation";

import type { UserRole } from "@/generated/prisma/enums";
import { AuthorizationError } from "@/lib/auth/errors";
import { requireAuth, requireRole } from "@/lib/auth/session";

async function resolvePageGuard<T>(guard: () => Promise<T>, loginPath: string) {
  let failure: unknown;

  try {
    return await guard();
  } catch (error) {
    failure = error;
  }

  if (failure instanceof AuthorizationError) {
    redirect(
      failure.code === "UNAUTHENTICATED"
        ? loginPath
        : `${loginPath}?auth=forbidden`,
    );
  }

  throw failure;
}

export function requireAuthPage() {
  return resolvePageGuard(requireAuth, "/login");
}

export function requireRolePage(role: UserRole) {
  return resolvePageGuard(() => requireRole(role), "/admin/login");
}

