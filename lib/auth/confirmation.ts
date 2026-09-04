const AUTH_RETURN_PATHS = new Set([
  "/",
  "/auth/confirm",
  "/forgot-password",
  "/login",
  "/register",
  "/reset-password",
]);

export function authConfirmationUrl(appUrl: string) {
  return new URL("/auth/confirm", appUrl).toString();
}

export function isAuthReturnPath(pathname: string) {
  return AUTH_RETURN_PATHS.has(pathname);
}

export function confirmationDestination(type: string) {
  if (type !== "recovery") return "/login?auth=confirmed";
  return "/reset-password";
}

export function callbackConfirmationDestination(redirectType: string | null) {
  return redirectType === "recovery"
    ? "/reset-password"
    : "/login?auth=confirmed";
}

export function authCodeCallbackPath(code: string, flowId?: string | null) {
  const params = new URLSearchParams({ code });
  if (flowId) params.set("sb_flow_id", flowId);
  return `/auth/callback?${params.toString()}`;
}
