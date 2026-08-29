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

const midtransEnvironmentFields = {
  MIDTRANS_MERCHANT_ID: z.string().min(1),
  MIDTRANS_SERVER_KEY: z.string().min(1),
  MIDTRANS_CLIENT_KEY: z.string().min(1),
  NEXT_PUBLIC_MIDTRANS_CLIENT_KEY: z.string().min(1),
  MIDTRANS_IS_PRODUCTION: booleanStringSchema,
  MIDTRANS_NOTIFICATION_URL: z
    .url()
    .refine((value) => value.startsWith("https://"), "Webhook Midtrans harus menggunakan HTTPS.")
    .optional(),
  VERCEL_ENV: z.enum(["development", "preview", "production"]).optional(),
};

function validateMidtransEnvironment(
  environment: {
    MIDTRANS_CLIENT_KEY: string;
    NEXT_PUBLIC_MIDTRANS_CLIENT_KEY: string;
    MIDTRANS_IS_PRODUCTION: boolean;
    VERCEL_ENV?: "development" | "preview" | "production";
  },
  context: z.core.$RefinementCtx,
) {
  if (
    environment.MIDTRANS_CLIENT_KEY !==
    environment.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY
  ) {
    context.addIssue({
      code: "custom",
      path: ["MIDTRANS_CLIENT_KEY"],
      message: "MIDTRANS_CLIENT_KEY dan NEXT_PUBLIC_MIDTRANS_CLIENT_KEY harus sama.",
      input: environment.MIDTRANS_CLIENT_KEY,
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
      input: environment.MIDTRANS_IS_PRODUCTION,
    });
  }
}

export const midtransEnvironmentSchema = z
  .object(midtransEnvironmentFields)
  .superRefine(validateMidtransEnvironment);

export const supabasePublicEnvironmentSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
});

export const appEnvironmentSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.url(),
});

export const databaseEnvironmentSchema = z.object({
  DATABASE_URL: postgresUrlSchema,
  DIRECT_URL: postgresUrlSchema,
});

export const publicEnvironmentSchema = supabasePublicEnvironmentSchema.extend({
  NEXT_PUBLIC_APP_URL: z.url(),
  NEXT_PUBLIC_MIDTRANS_CLIENT_KEY: z.string().min(1),
});

export const supabaseAdminEnvironmentSchema =
  supabasePublicEnvironmentSchema
    .extend({
      SUPABASE_SECRET_KEY: z.string().min(1).optional(),
      SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
    })
    .superRefine((environment, context) => {
      if (
        !environment.SUPABASE_SECRET_KEY &&
        !environment.SUPABASE_SERVICE_ROLE_KEY
      ) {
        context.addIssue({
          code: "custom",
          path: ["SUPABASE_SECRET_KEY"],
          message:
            "SUPABASE_SECRET_KEY atau SUPABASE_SERVICE_ROLE_KEY wajib diisi.",
        });
      }
    });

export const serverEnvironmentSchema = publicEnvironmentSchema
  .extend({
    SUPABASE_SECRET_KEY: z.string().min(1).optional(),
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
    DATABASE_URL: postgresUrlSchema,
    DIRECT_URL: postgresUrlSchema,
    SUPABASE_STORAGE_BUCKET_PEMBAYARAN: z.string().min(1),
    SUPABASE_STORAGE_BUCKET_CMS: z.string().min(1),
    MIDTRANS_MERCHANT_ID: midtransEnvironmentFields.MIDTRANS_MERCHANT_ID,
    MIDTRANS_SERVER_KEY: midtransEnvironmentFields.MIDTRANS_SERVER_KEY,
    MIDTRANS_CLIENT_KEY: midtransEnvironmentFields.MIDTRANS_CLIENT_KEY,
    MIDTRANS_IS_PRODUCTION: midtransEnvironmentFields.MIDTRANS_IS_PRODUCTION,
    MIDTRANS_NOTIFICATION_URL:
      midtransEnvironmentFields.MIDTRANS_NOTIFICATION_URL,
    VERCEL_ENV: midtransEnvironmentFields.VERCEL_ENV,
  })
  .superRefine((environment, context) => {
    if (
      !environment.SUPABASE_SECRET_KEY &&
      !environment.SUPABASE_SERVICE_ROLE_KEY
    ) {
      context.addIssue({
        code: "custom",
        path: ["SUPABASE_SECRET_KEY"],
        message:
          "SUPABASE_SECRET_KEY atau SUPABASE_SERVICE_ROLE_KEY wajib diisi.",
      });
    }

    validateMidtransEnvironment(environment, context);
  });

export type PublicEnvironment = z.infer<typeof publicEnvironmentSchema>;
export type SupabasePublicEnvironment = z.infer<
  typeof supabasePublicEnvironmentSchema
>;
export type SupabaseAdminEnvironment = z.infer<
  typeof supabaseAdminEnvironmentSchema
>;
export type AppEnvironment = z.infer<typeof appEnvironmentSchema>;
export type DatabaseEnvironment = z.infer<typeof databaseEnvironmentSchema>;
export type ServerEnvironment = z.infer<typeof serverEnvironmentSchema>;
export type MidtransEnvironment = z.infer<typeof midtransEnvironmentSchema>;
