import { safeRedirectPath } from "@/lib/auth/redirect";

export function authConfirmationUrl(appUrl: string, recovery = false) {
  const url = new URL("/auth/confirm", appUrl);
  if (recovery) url.searchParams.set("next", "/reset-password");
  return url.toString();
}

export function confirmationDestination(type: string) {
  if (type !== "recovery") return "/login?auth=confirmed";
  return "/reset-password";
}

export function callbackConfirmationDestination(next: string | null) {
  return safeRedirectPath(next, "/login?auth=confirmed") === "/reset-password"
    ? "/reset-password"
    : "/login?auth=confirmed";
}

export function authCodeCallbackPath(code: string, recovery = false) {
  const params = new URLSearchParams({ code });
  if (recovery) params.set("next", "/reset-password");
  return `/auth/callback?${params.toString()}`;
}
