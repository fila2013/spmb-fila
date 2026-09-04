"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import {
  authCodeCallbackPath,
  isAuthReturnPath,
} from "@/lib/auth/confirmation";
import { createClient } from "@/lib/supabase/client";

function authErrorPath(code: string | null | undefined) {
  return code === "otp_expired"
    ? "/login?auth=otp_expired"
    : "/login?auth=invalid";
}

export function AuthRedirectFallback() {
  const router = useRouter();

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const code = query.get("code");
    if (code && isAuthReturnPath(window.location.pathname)) {
      router.replace(authCodeCallbackPath(code, query.get("sb_flow_id")));
      return;
    }

    if (!window.location.hash) return;
    const params = new URLSearchParams(window.location.hash.slice(1));
    const errorCode = params.get("error_code");
    if (params.get("error") || errorCode) {
      window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
      router.replace(authErrorPath(errorCode));
      return;
    }

    const accessToken = params.get("access_token");
    const refreshToken = params.get("refresh_token");
    if (!accessToken || !refreshToken) return;

    const recovery = params.get("type") === "recovery";
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
    let active = true;

    void (async () => {
      const supabase = createClient();
      const { error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });
      if (!active) return;
      if (error) {
        router.replace(authErrorPath(error.code));
        return;
      }
      if (recovery) {
        router.replace("/reset-password");
        return;
      }
      await supabase.auth.signOut();
      if (active) router.replace("/login?auth=confirmed");
    })();

    return () => {
      active = false;
    };
  }, [router]);

  return null;
}
