import {
  appEnvironmentSchema,
  type AppEnvironment,
  publicEnvironmentSchema,
  supabasePublicEnvironmentSchema,
  type PublicEnvironment,
  type SupabasePublicEnvironment,
} from "@/lib/env/schema";

let cachedEnvironment: PublicEnvironment | undefined;
let cachedSupabaseEnvironment: SupabasePublicEnvironment | undefined;
let cachedAppEnvironment: AppEnvironment | undefined;

export function getAppEnvironment(): AppEnvironment {
  cachedAppEnvironment ??= appEnvironmentSchema.parse({
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  });

  return cachedAppEnvironment;
}

export function getSupabasePublicEnvironment(): SupabasePublicEnvironment {
  cachedSupabaseEnvironment ??= supabasePublicEnvironmentSchema.parse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  });

  return cachedSupabaseEnvironment;
}

export function getPublicEnvironment(): PublicEnvironment {
  cachedEnvironment ??= publicEnvironmentSchema.parse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_MIDTRANS_CLIENT_KEY:
      process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY,
  });

  return cachedEnvironment;
}
