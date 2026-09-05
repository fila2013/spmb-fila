import { z } from "zod";

import { KategoriTipe } from "@/generated/prisma/enums";

const nullableDateSchema = z
  .union([z.iso.date(), z.literal(""), z.null()])
  .transform((value) => (value ? new Date(`${value}T00:00:00.000Z`) : null));

const nullableQuotaSchema = z
  .union([z.number().int().min(0).max(1_000_000), z.null()]);

const nullableUuidSchema = z.union([z.uuid(), z.literal(""), z.null()]).transform(
  (value) => value || null,
);

const periodFields = {
  periodeMulai: nullableDateSchema,
  periodeSelesai: nullableDateSchema,
};

function validatePeriod(
  value: { periodeMulai?: Date | null; periodeSelesai?: Date | null },
  context: z.RefinementCtx,
) {
  if (
    value.periodeMulai &&
    value.periodeSelesai &&
    value.periodeMulai > value.periodeSelesai
  ) {
    context.addIssue({
      code: "custom",
      path: ["periodeSelesai"],
      message: "Tanggal selesai harus sama atau setelah tanggal mulai.",
    });
  }
}

export const createJalurSchema = z
  .object({
    nama: z.string().trim().min(2).max(50),
    statusAktif: z.boolean(),
    ...periodFields,
    kuotaMaks: nullableQuotaSchema,
    fallbackJalurId: nullableUuidSchema,
    hapusDataJikaGagal: z.boolean(),
    pilihanJalurFinalAktif: z.boolean(),
  })
  .superRefine((value, context) => {
    validatePeriod(value, context);
    if (value.fallbackJalurId && value.hapusDataJikaGagal) {
      context.addIssue({
        code: "custom",
        path: ["hapusDataJikaGagal"],
        message: "Auto-delete tidak boleh aktif bersamaan dengan fallback.",
      });
    }
    if (value.pilihanJalurFinalAktif && !value.fallbackJalurId) {
      context.addIssue({
        code: "custom",
        path: ["pilihanJalurFinalAktif"],
        message: "Pilihan jalur final memerlukan jalur fallback.",
      });
    }
  });

export const updateJalurSchema = createJalurSchema.extend({ id: z.uuid() });

export const createKategoriSchema = z
  .object({
    nama: z.string().trim().min(2).max(50),
    tipe: z.enum(KategoriTipe),
    statusAktif: z.boolean(),
    ...periodFields,
    kuotaMaks: nullableQuotaSchema,
  })
  .superRefine(validatePeriod);

export const updateKategoriSchema = createKategoriSchema.extend({ id: z.uuid() });

export const createBiayaSchema = z.object({
  jalurId: z.uuid(),
  kategoriId: z.uuid(),
  nominal: z.number().int().positive().max(2_000_000_000),
  statusAktif: z.boolean(),
});

export const updateBiayaSchema = z.object({
  id: z.uuid(),
  nominal: z.number().int().positive().max(2_000_000_000),
  statusAktif: z.boolean(),
});

export type CreateJalurInput = z.infer<typeof createJalurSchema>;
export type UpdateJalurInput = z.infer<typeof updateJalurSchema>;
export type CreateKategoriInput = z.infer<typeof createKategoriSchema>;
export type UpdateKategoriInput = z.infer<typeof updateKategoriSchema>;
export type CreateBiayaInput = z.infer<typeof createBiayaSchema>;
export type UpdateBiayaInput = z.infer<typeof updateBiayaSchema>;
