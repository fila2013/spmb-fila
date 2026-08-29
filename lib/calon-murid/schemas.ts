import { z } from "zod";

import { SubKategoriAlumni } from "@/generated/prisma/enums";

const requiredUuid = z.string().uuid("Pilihan tidak valid.");

export const calonMuridIdSchema = requiredUuid;

export const createCalonMuridSchema = z.object({
  namaAnak: z
    .string()
    .trim()
    .min(2, "Nama anak minimal 2 karakter.")
    .max(150, "Nama anak maksimal 150 karakter."),
});

export const createCalonMuridWithJalurSchema = createCalonMuridSchema.extend({
  jalurId: requiredUuid,
});

export const selectJalurSchema = z.object({ jalurId: requiredUuid });

export const selectKategoriSchema = z
  .object({
    kategoriId: requiredUuid,
    subKategoriEnum: z.enum(SubKategoriAlumni).nullable().optional(),
    subKategoriText: z.string().trim().max(150).nullable().optional(),
  })
  .transform((value) => ({
    ...value,
    subKategoriEnum: value.subKategoriEnum ?? null,
    subKategoriText: value.subKategoriText || null,
  }));

export type CreateCalonMuridInput = z.infer<typeof createCalonMuridSchema>;
export type CreateCalonMuridWithJalurInput = z.infer<
  typeof createCalonMuridWithJalurSchema
>;
export type SelectJalurInput = z.infer<typeof selectJalurSchema>;
export type SelectKategoriInput = z.infer<typeof selectKategoriSchema>;
