import { z } from "zod";

const postgresUrlSchema = z
  .string()
  .min(1, "URL database wajib diisi.")
  .refine(
    (value) => value.startsWith("postgresql://") || value.startsWith("postgres://"),
    "URL database harus menggunakan protokol PostgreSQL.",
  );

const booleanStringSchema = z
  .enum(["true", "false"])
  .transform((value) => value === "true");

export const publicEnvironmentSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_APP_URL: z.url(),
  NEXT_PUBLIC_MIDTRANS_CLIENT_KEY: z.string().min(1),
});

export const serverEnvironmentSchema = publicEnvironmentSchema
  .extend({
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
    DATABASE_URL: postgresUrlSchema,
    DIRECT_URL: postgresUrlSchema,
    SUPABASE_STORAGE_BUCKET_PEMBAYARAN: z.string().min(1),
    SUPABASE_STORAGE_BUCKET_CMS: z.string().min(1),
    MIDTRANS_SERVER_KEY: z.string().min(1),
    MIDTRANS_CLIENT_KEY: z.string().min(1),
    MIDTRANS_IS_PRODUCTION: booleanStringSchema,
    VERCEL_ENV: z.enum(["development", "preview", "production"]).optional(),
  })
  .superRefine((environment, context) => {
    if (
      environment.MIDTRANS_CLIENT_KEY !==
      environment.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY
    ) {
      context.addIssue({
        code: "custom",
        path: ["MIDTRANS_CLIENT_KEY"],
        message: "MIDTRANS_CLIENT_KEY dan NEXT_PUBLIC_MIDTRANS_CLIENT_KEY harus sama.",
      });
    }

    if (
      environment.VERCEL_ENV &&
      environment.VERCEL_ENV !== "production" &&
      environment.MIDTRANS_IS_PRODUCTION
    ) {
      context.addIssue({
        code: "custom",
        path: ["MIDTRANS_IS_PRODUCTION"],
        message: "Midtrans production hanya boleh aktif pada Vercel Production.",
      });
    }

    if (
      environment.VERCEL_ENV === "production" &&
      !environment.MIDTRANS_IS_PRODUCTION
    ) {
      context.addIssue({
        code: "custom",
        path: ["MIDTRANS_IS_PRODUCTION"],
        message: "Vercel Production wajib menggunakan konfigurasi Midtrans production.",
      });
    }
  });

export type PublicEnvironment = z.infer<typeof publicEnvironmentSchema>;
export type ServerEnvironment = z.infer<typeof serverEnvironmentSchema>;
