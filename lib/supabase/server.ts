import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { getServerEnvironment } from "@/lib/env/server";

export async function createClient() {
  const cookieStore = await cookies();
  const environment = getServerEnvironment();

  return createServerClient(
    environment.NEXT_PUBLIC_SUPABASE_URL,
    environment.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Server Components tidak dapat menulis cookie. Proxy Auth pada
            // Phase 2 akan menangani refresh session dan penulisan cookie.
          }
        },
      },
    },
  );
}
