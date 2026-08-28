import "server-only";

import {
  databaseEnvironmentSchema,
  type DatabaseEnvironment,
  serverEnvironmentSchema,
  type ServerEnvironment,
  supabaseAdminEnvironmentSchema,
  type SupabaseAdminEnvironment,
} from "@/lib/env/schema";

let cachedEnvironment: ServerEnvironment | undefined;
let cachedSupabaseAdminEnvironment: SupabaseAdminEnvironment | undefined;
let cachedDatabaseEnvironment: DatabaseEnvironment | undefined;

export function getDatabaseEnvironment(): DatabaseEnvironment {
  cachedDatabaseEnvironment ??= databaseEnvironmentSchema.parse({
    DATABASE_URL: process.env.DATABASE_URL,
    DIRECT_URL: process.env.DIRECT_URL,
  });

  return cachedDatabaseEnvironment;
}

export function getSupabaseAdminEnvironment(): SupabaseAdminEnvironment {
  cachedSupabaseAdminEnvironment ??= supabaseAdminEnvironmentSchema.parse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  });

  return cachedSupabaseAdminEnvironment;
}

export function getServerEnvironment(): ServerEnvironment {
  cachedEnvironment ??= serverEnvironmentSchema.parse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_MIDTRANS_CLIENT_KEY:
      process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY,
    SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    DATABASE_URL: process.env.DATABASE_URL,
    DIRECT_URL: process.env.DIRECT_URL,
    SUPABASE_STORAGE_BUCKET_PEMBAYARAN:
      process.env.SUPABASE_STORAGE_BUCKET_PEMBAYARAN,
    SUPABASE_STORAGE_BUCKET_CMS: process.env.SUPABASE_STORAGE_BUCKET_CMS,
    MIDTRANS_SERVER_KEY: process.env.MIDTRANS_SERVER_KEY,
    MIDTRANS_CLIENT_KEY: process.env.MIDTRANS_CLIENT_KEY,
    MIDTRANS_IS_PRODUCTION: process.env.MIDTRANS_IS_PRODUCTION,
    VERCEL_ENV: process.env.VERCEL_ENV,
  });

  return cachedEnvironment;
}
