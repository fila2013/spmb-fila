import { NextResponse, type NextRequest } from "next/server";

import { ensureUserProfile } from "@/lib/auth/profile";
import { safeRedirectPath } from "@/lib/auth/redirect";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const next = safeRedirectPath(request.nextUrl.searchParams.get("next"));

  if (!code) {
    return NextResponse.redirect(new URL("/login?auth=invalid", request.url));
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.user.email) {
    return NextResponse.redirect(new URL("/login?auth=invalid", request.url));
  }

  await ensureUserProfile({ id: data.user.id, email: data.user.email });
  return NextResponse.redirect(new URL(next, request.url));
}

