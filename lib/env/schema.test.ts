import { describe, expect, it } from "vitest";

import {
  publicEnvironmentSchema,
  serverEnvironmentSchema,
} from "@/lib/env/schema";

const validPublicEnvironment = {
  NEXT_PUBLIC_SUPABASE_URL: "https://project-ref.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
  NEXT_PUBLIC_APP_URL: "http://localhost:3000",
  NEXT_PUBLIC_MIDTRANS_CLIENT_KEY: "Mid-client-example",
};

const validServerEnvironment = {
  ...validPublicEnvironment,
  SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
  DATABASE_URL:
    "postgresql://postgres:password@pooler.example.invalid:6543/postgres?pgbouncer=true",
  DIRECT_URL:
    "postgresql://postgres:password@db.example.invalid:5432/postgres",
  SUPABASE_STORAGE_BUCKET_PEMBAYARAN: "bukti-pembayaran",
  SUPABASE_STORAGE_BUCKET_CMS: "konten-cms",
  MIDTRANS_SERVER_KEY: "Mid-server-example",
  MIDTRANS_CLIENT_KEY: "Mid-client-example",
  MIDTRANS_IS_PRODUCTION: "false",
  VERCEL_ENV: "preview" as const,
};

describe("publicEnvironmentSchema", () => {
  it("menerima kontrak public yang valid", () => {
    expect(publicEnvironmentSchema.parse(validPublicEnvironment)).toEqual(
      validPublicEnvironment,
    );
  });

  it("menolak URL Supabase yang tidak valid", () => {
    expect(() =>
      publicEnvironmentSchema.parse({
        ...validPublicEnvironment,
        NEXT_PUBLIC_SUPABASE_URL: "bukan-url",
      }),
    ).toThrow();
  });
});

describe("serverEnvironmentSchema", () => {
  it("mengubah flag Midtrans menjadi boolean", () => {
    const environment = serverEnvironmentSchema.parse(validServerEnvironment);

    expect(environment.MIDTRANS_IS_PRODUCTION).toBe(false);
  });

  it("menolak koneksi database non-PostgreSQL", () => {
    expect(() =>
      serverEnvironmentSchema.parse({
        ...validServerEnvironment,
        DATABASE_URL: "mysql://localhost/spmb",
      }),
    ).toThrow();
  });

  it("menolak client key Midtrans yang tidak konsisten", () => {
    expect(() =>
      serverEnvironmentSchema.parse({
        ...validServerEnvironment,
        MIDTRANS_CLIENT_KEY: "Mid-client-berbeda",
      }),
    ).toThrow();
  });

  it("menolak Midtrans production pada Vercel Preview", () => {
    expect(() =>
      serverEnvironmentSchema.parse({
        ...validServerEnvironment,
        MIDTRANS_IS_PRODUCTION: "true",
      }),
    ).toThrow();
  });

  it("mewajibkan Midtrans production pada Vercel Production", () => {
    expect(() =>
      serverEnvironmentSchema.parse({
        ...validServerEnvironment,
        VERCEL_ENV: "production",
      }),
    ).toThrow();
  });
});
