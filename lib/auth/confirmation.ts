import { safeRedirectPath } from "@/lib/auth/redirect";

export function authConfirmationUrl(appUrl: string) {
  return new URL("/auth/confirm", appUrl).toString();
}

export function confirmationDestination(type: string, next?: string) {
  return type === "recovery"
    ? safeRedirectPath(next, "/reset-password")
    : "/login?auth=confirmed";
}

export function callbackConfirmationDestination(next: string | null) {
  return safeRedirectPath(next, "/login?auth=confirmed") === "/reset-password"
    ? "/reset-password"
    : "/login?auth=confirmed";
}
