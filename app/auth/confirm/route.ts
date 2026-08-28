import { type EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

import { ensureUserProfile } from "@/lib/auth/profile";
import { safeRedirectPath } from "@/lib/auth/redirect";
import { createClient } from "@/lib/supabase/server";

const validTypes = new Set<EmailOtpType>([
  "email",
  "invite",
  "magiclink",
  "recovery",
  "signup",
  "email_change",
]);

export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type") as EmailOtpType | null;
  const next = safeRedirectPath(request.nextUrl.searchParams.get("next"));

  if (!tokenHash || !type || !validTypes.has(type)) {
    return NextResponse.redirect(new URL("/login?auth=invalid", request.url));
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type,
  });

  if (error || !data.user?.email) {
    return NextResponse.redirect(new URL("/login?auth=invalid", request.url));
  }

  await ensureUserProfile({ id: data.user.id, email: data.user.email });
  return NextResponse.redirect(new URL(next, request.url));
}

