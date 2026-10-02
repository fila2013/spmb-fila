import { z } from "zod";

import { SubKategoriAlumni } from "@/generated/prisma/enums";
import { TipeInput } from "@/generated/prisma/enums";
import { fieldValueError } from "@/lib/enrollment/rules";

const requiredUuid = z.string().uuid("Pilihan tidak valid.");

export const calonMuridIdSchema = requiredUuid;

export const createCalonMuridSchema = z.object({
  namaAnak: z
    .string()
    .trim()
    .min(2, "Nama anak minimal 2 karakter.")
    .max(150, "Nama anak maksimal 150 karakter."),
  tempatLahir: z.string().trim().min(2, "Tempat lahir wajib diisi (minimal 2 karakter).").max(150),
  tanggalLahir: z.string().refine(
    (value) => !fieldValueError({ id: "tanggalLahir", tipeInput: TipeInput.DATE, wajib: true, validasi: null }, value, true),
    "Masukkan tanggal lahir yang valid.",
  ),
});

export const createCalonMuridWithJalurSchema = createCalonMuridSchema.extend({
  jalurId: requiredUuid,
});

export const birthDetailsSchema = createCalonMuridSchema.pick({ tempatLahir: true, tanggalLahir: true });

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
export type BirthDetailsInput = z.infer<typeof birthDetailsSchema>;
