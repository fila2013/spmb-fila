import "server-only";

import { createClient } from "@supabase/supabase-js";

import { getSupabaseAdminEnvironment } from "@/lib/env/server";

export function createAdminClient() {
  const environment = getSupabaseAdminEnvironment();
  const adminKey =
    environment.SUPABASE_SECRET_KEY ??
    environment.SUPABASE_SERVICE_ROLE_KEY;

  if (!adminKey) {
    throw new Error("Supabase admin key belum dikonfigurasi.");
  }

  return createClient(
    environment.NEXT_PUBLIC_SUPABASE_URL,
    adminKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}
