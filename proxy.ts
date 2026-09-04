import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import {
  authCodeCallbackPath,
  isAuthReturnPath,
} from "@/lib/auth/confirmation";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  if (code && isAuthReturnPath(request.nextUrl.pathname)) {
    return NextResponse.redirect(
      new URL(
        authCodeCallbackPath(
          code,
          request.nextUrl.searchParams.get("sb_flow_id"),
        ),
        request.url,
      ),
    );
  }

  return updateSession(request);
}

export const config = {
  matcher: [
    "/((?!api/webhooks/midtrans(?:/|$)|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
