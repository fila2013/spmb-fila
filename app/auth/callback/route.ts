import { NextResponse, type NextRequest } from "next/server";

import { ensureUserProfile } from "@/lib/auth/profile";
import { callbackConfirmationDestination } from "@/lib/auth/confirmation";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const next = callbackConfirmationDestination(
    request.nextUrl.searchParams.get("next"),
  );

  if (!code) {
    const authStatus =
      request.nextUrl.searchParams.get("error_code") === "otp_expired"
        ? "otp_expired"
        : "invalid";
    return NextResponse.redirect(
      new URL(`/login?auth=${authStatus}`, request.url),
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.user.email) {
    return NextResponse.redirect(
      new URL(
        `/login?auth=${error?.code === "otp_expired" ? "otp_expired" : "invalid"}`,
        request.url,
      ),
    );
  }

  await ensureUserProfile({ id: data.user.id, email: data.user.email });
  if (next === "/reset-password") {
    return NextResponse.redirect(new URL(next, request.url));
  }

  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/login?auth=confirmed", request.url));
}
